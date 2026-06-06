const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function sendJson(res, status, data, cacheSeconds = 120) {
  Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', `s-maxage=${cacheSeconds}, stale-while-revalidate=600`);
  res.status(status).json(data);
}

function normalizeInputSymbol(symbol) {
  return String(symbol || '').trim().toUpperCase();
}

function isBistSymbol(symbol) {
  const s = normalizeInputSymbol(symbol);
  return s.endsWith('.IS') || s.startsWith('XU');
}

function yahooSymbol(symbol) {
  const s = normalizeInputSymbol(symbol);
  if (isBistSymbol(s)) return s;
  return s;
}

function mapToTwelveSymbol(symbol) {
  const s = normalizeInputSymbol(symbol);
  const map = {
    'USDTRY=X': 'USD/TRY',
    'EURTRY=X': 'EUR/TRY',
    'EURUSD=X': 'EUR/USD',
    'GBPUSD=X': 'GBP/USD',
    'GC=F': 'XAU/USD',
    'SI=F': 'XAG/USD',
    '^GSPC': 'SPX',
    '^IXIC': 'IXIC',
  };
  return map[s] || s;
}

function rangeSettings(range) {
  const key = String(range || '1y').toLowerCase();
  return {
    '1d': { tdInterval: '5min', tdSize: 288, yahooInterval: '5m', yahooRange: '1d' },
    '1w': { tdInterval: '30min', tdSize: 336, yahooInterval: '30m', yahooRange: '5d' },
    '1m': { tdInterval: '1day', tdSize: 31, yahooInterval: '1d', yahooRange: '1mo' },
    '6m': { tdInterval: '1day', tdSize: 190, yahooInterval: '1d', yahooRange: '6mo' },
    '1y': { tdInterval: '1day', tdSize: 380, yahooInterval: '1d', yahooRange: '1y' },
    '2y': { tdInterval: '1week', tdSize: 110, yahooInterval: '1wk', yahooRange: '2y' },
    '5y': { tdInterval: '1week', tdSize: 270, yahooInterval: '1wk', yahooRange: '5y' },
  }[key] || { tdInterval: '1day', tdSize: 365, yahooInterval: '1d', yahooRange: '1y' };
}

async function fetchJson(url, options = {}, timeoutMs = 12000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: ctrl.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(id);
  }
}

async function fetchTwelveHistory(symbol, range) {
  const apiKey = process.env.TWELVE_DATA_API_KEY || process.env.VITE_TWELVE_DATA_API_KEY;
  if (!apiKey) return [];
  const settings = rangeSettings(range);
  const tdSymbol = mapToTwelveSymbol(symbol);
  const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(tdSymbol)}&interval=${encodeURIComponent(settings.tdInterval)}&outputsize=${settings.tdSize}&apikey=${encodeURIComponent(apiKey)}&format=JSON`;
  const data = await fetchJson(url, {}, 12000);
  if (!data || data.status === 'error' || !Array.isArray(data.values)) return [];
  return data.values
    .slice()
    .reverse()
    .map((p) => ({
      date: String(p.datetime || p.date || '').replace(' ', 'T'),
      close: Math.round(Number(p.close) * 10000) / 10000,
      volume: p.volume ? Number(p.volume) : undefined,
    }))
    .filter((p) => p.date && Number.isFinite(p.close) && p.close > 0);
}

async function fetchYahooHistory(symbol, range) {
  const settings = rangeSettings(range);
  const s = yahooSymbol(symbol);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s)}?interval=${settings.yahooInterval}&range=${settings.yahooRange}&_=${Date.now()}`;
  const data = await fetchJson(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Accept': 'application/json,text/plain,*/*',
      'Referer': 'https://finance.yahoo.com/',
    },
  }, 12000);
  const result = data?.chart?.result?.[0];
  if (!result) return [];
  const timestamps = result.timestamp || [];
  const closes = result.indicators?.quote?.[0]?.close || [];
  const volumes = result.indicators?.quote?.[0]?.volume || [];
  const points = [];
  for (let i = 0; i < timestamps.length; i++) {
    const close = Number(closes[i]);
    if (!Number.isFinite(close) || close <= 0) continue;
    points.push({
      date: new Date(timestamps[i] * 1000).toISOString(),
      close: Math.round(close * 10000) / 10000,
      volume: volumes[i] ? Number(volumes[i]) : undefined,
    });
  }
  return points;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));
    return res.status(204).end();
  }
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' }, 10);

  const symbol = normalizeInputSymbol(req.query?.symbol);
  const range = String(req.query?.range || '1y').toLowerCase();
  if (!symbol) return sendJson(res, 400, { error: 'symbol query param required' }, 10);

  try {
    const history = (await fetchTwelveHistory(symbol, range)) || [];
    const fallback = history.length > 0 ? history : await fetchYahooHistory(symbol, range);
    return sendJson(res, 200, fallback, range === '1d' ? 30 : 300);
  } catch (err) {
    return sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) }, 10);
  }
}
