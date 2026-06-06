const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function sendJson(res, status, data, cacheSeconds = 30) {
  Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', `s-maxage=${cacheSeconds}, stale-while-revalidate=120`);
  res.status(status).json(data);
}

function normalizeInputSymbol(symbol) {
  return String(symbol || '').trim().toUpperCase();
}

function isBistSymbol(symbol) {
  const s = normalizeInputSymbol(symbol);
  return s.endsWith('.IS') || s.startsWith('XU') || ['ASELS','GARAN','THYAO','AKBNK','ISCTR','EREGL','BIMAS','SISE','KCHOL','TUPRS'].includes(s);
}

function bistBase(symbol) {
  return normalizeInputSymbol(symbol).replace(/\.IS$/i, '');
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
    '^DJI': 'DJI',
  };
  return map[s] || s;
}

function yahooSymbol(symbol) {
  const s = normalizeInputSymbol(symbol);
  if (s === 'XU100.IS') return 'XU100.IS';
  if (isBistSymbol(s) && !s.endsWith('.IS')) return `${s}.IS`;
  return s;
}

function stooqSymbol(symbol) {
  const s = normalizeInputSymbol(symbol);
  const map = {
    'AAPL': 'aapl.us',
    'MSFT': 'msft.us',
    'NVDA': 'nvda.us',
    'AMD': 'amd.us',
    'TSLA': 'tsla.us',
    'AMZN': 'amzn.us',
    'META': 'meta.us',
    'GOOGL': 'googl.us',
    'GOOG': 'goog.us',
    'NFLX': 'nflx.us',
    'QQQ': 'qqq.us',
    'SPY': 'spy.us',
    '^GSPC': '^spx',
    '^IXIC': '^ndq',
    '^DJI': '^dji',
  };
  if (map[s]) return map[s];
  if (/^[A-Z.]{1,8}$/.test(s) && !s.includes('.IS')) return `${s.toLowerCase()}.us`;
  return null;
}

function makeQuote(symbol, price, name, currency, change, changePercent, source, extra = {}) {
  const p = Number(price);
  if (!Number.isFinite(p) || p <= 0) return null;
  const ch = Number(change || 0);
  const cp = Number(changePercent || 0);
  return {
    price: p,
    name: name || symbol,
    currency: currency || (isBistSymbol(symbol) ? 'TRY' : 'USD'),
    change: Number.isFinite(ch) ? ch : 0,
    changePercent: Number.isFinite(cp) ? cp : 0,
    timestamp: new Date().toISOString(),
    source,
    ...extra,
  };
}

async function fetchJson(url, options = {}, timeoutMs = 9000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: ctrl.signal });
    const text = await res.text();
    if (!res.ok) return { ok: false, status: res.status, text };
    try { return { ok: true, data: JSON.parse(text), text }; }
    catch { return { ok: true, data: null, text }; }
  } catch (err) {
    return { ok: false, status: 0, text: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(id);
  }
}

let bistCache = { at: 0, rows: [] };

async function loadBistRows(debugInfo) {
  const gasUrl = process.env.BIST_GAS_URL || process.env.VITE_BIST_GAS_URL;
  if (!gasUrl) {
    debugInfo?.push('BIST_GAS_URL missing');
    return [];
  }
  if (Date.now() - bistCache.at < 60_000 && Array.isArray(bistCache.rows)) return bistCache.rows;

  const result = await fetchJson(gasUrl, {}, 12000);
  if (!result.ok) {
    debugInfo?.push(`BIST GAS failed: ${result.status} ${String(result.text).slice(0, 120)}`);
    return [];
  }
  const data = result.data;
  const rawRows = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : Array.isArray(data?.rows) ? data.rows : [];
  const rows = rawRows.map((r) => {
    const symbol = normalizeInputSymbol(r.symbol || r.ticker || r.code || '');
    const price = Number(r.price ?? r.last ?? r.close ?? r.value);
    const change = Number(r.change ?? r.dailyChange ?? 0);
    const changePercent = Number(r.changePercent ?? r.change_percent ?? r.percent ?? r.dailyChangePercent ?? 0);
    return {
      symbol,
      name: r.name || r.asset_name || symbol,
      price,
      change,
      changePercent,
      currency: r.currency || 'TRY',
      timestamp: r.timestamp || new Date().toISOString(),
      source: r.source || 'Google Apps Script',
    };
  }).filter((r) => r.symbol && Number.isFinite(r.price) && r.price > 0);

  bistCache = { at: Date.now(), rows };
  return rows;
}

async function fetchBistQuote(symbol, debugInfo) {
  const base = bistBase(symbol);
  const wanted = new Set([base, `${base}.IS`, normalizeInputSymbol(symbol)]);
  const rows = await loadBistRows(debugInfo);
  const row = rows.find((r) => wanted.has(normalizeInputSymbol(r.symbol)) || wanted.has(`${normalizeInputSymbol(r.symbol)}.IS`));
  if (!row) return null;
  return makeQuote(symbol, row.price, row.name, row.currency || 'TRY', row.change, row.changePercent, 'Google Apps Script');
}

async function fetchTwelveQuote(symbol, debugInfo) {
  const apiKey = process.env.TWELVE_DATA_API_KEY || process.env.VITE_TWELVE_DATA_API_KEY || process.env.NASDAQ_API_KEY || process.env.VITE_NASDAQ_API_KEY;
  if (!apiKey) {
    debugInfo?.push('Twelve Data key missing. Add TWELVE_DATA_API_KEY in Vercel, then redeploy.');
    return null;
  }
  const tdSymbol = mapToTwelveSymbol(symbol);
  const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(tdSymbol)}&apikey=${encodeURIComponent(apiKey)}`;
  const result = await fetchJson(url, {}, 9000);
  if (!result.ok) {
    debugInfo?.push(`Twelve quote ${tdSymbol} failed: ${result.status} ${String(result.text).slice(0, 160)}`);
    return null;
  }
  const data = result.data;
  if (!data || data.status === 'error' || data.code || data.message) {
    debugInfo?.push(`Twelve quote ${tdSymbol} returned error: ${data?.message || data?.code || 'unknown'}`);
    return null;
  }

  const price = Number(data.close ?? data.price ?? data.previous_close);
  const prevClose = Number(data.previous_close ?? data.open ?? price);
  const change = Number(data.change ?? (Number.isFinite(price) && Number.isFinite(prevClose) ? price - prevClose : 0));
  const changePercent = Number(data.percent_change ?? (prevClose > 0 ? (change / prevClose) * 100 : 0));
  return makeQuote(symbol, price, data.name || data.symbol || symbol, data.currency || (symbol.includes('=X') ? 'TRY' : 'USD'), change, changePercent, 'Twelve Data');
}

async function fetchYahooQuote(symbol, debugInfo) {
  const s = yahooSymbol(symbol);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s)}?interval=1d&range=5d&_=${Date.now()}`;
  const result = await fetchJson(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Accept': 'application/json,text/plain,*/*',
      'Referer': 'https://finance.yahoo.com/',
    },
  }, 9000);
  if (!result.ok) {
    debugInfo?.push(`Yahoo ${s} failed: ${result.status} ${String(result.text).slice(0, 160)}`);
    return null;
  }
  const meta = result.data?.chart?.result?.[0]?.meta;
  if (!meta) {
    debugInfo?.push(`Yahoo ${s} returned no meta`);
    return null;
  }
  const price = Number(meta.regularMarketPrice ?? meta.previousClose ?? meta.chartPreviousClose);
  const prevClose = Number(meta.chartPreviousClose ?? meta.previousClose ?? price);
  const change = Number.isFinite(price) && Number.isFinite(prevClose) ? price - prevClose : 0;
  const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;
  return makeQuote(symbol, price, meta.shortName || meta.longName || meta.symbol || symbol, meta.currency, change, changePercent, 'Yahoo Finance fallback');
}

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQ = !inQ;
    else if (ch === ',' && !inQ) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map(v => v.replace(/^"|"$/g, '').trim());
}

async function fetchStooqQuote(symbol, debugInfo) {
  const sq = stooqSymbol(symbol);
  if (!sq) return null;
  const url = `https://stooq.com/q/l/?s=${encodeURIComponent(sq)}&f=sd2t2ohlcvn&e=csv`;
  const result = await fetchJson(url, {}, 9000);
  if (!result.ok || !result.text) {
    debugInfo?.push(`Stooq ${sq} failed: ${result.status} ${String(result.text).slice(0, 120)}`);
    return null;
  }
  const lines = result.text.trim().split(/\r?\n/);
  if (lines.length < 2) {
    debugInfo?.push(`Stooq ${sq} returned empty csv`);
    return null;
  }
  const headers = parseCsvLine(lines[0]);
  const values = parseCsvLine(lines[1]);
  const row = Object.fromEntries(headers.map((h, i) => [h.toLowerCase(), values[i]]));
  const close = Number(row.close);
  const open = Number(row.open);
  if (!Number.isFinite(close) || close <= 0) {
    debugInfo?.push(`Stooq ${sq} has invalid close`);
    return null;
  }
  const change = Number.isFinite(open) && open > 0 ? close - open : 0;
  const changePercent = Number.isFinite(open) && open > 0 ? (change / open) * 100 : 0;
  return makeQuote(symbol, close, row.name || symbol, 'USD', change, changePercent, 'Stooq fallback', {
    delayed: true,
    stooqSymbol: sq,
  });
}

async function fetchQuoteForSymbol(symbol, debug = false) {
  const debugInfo = [];
  let quote = null;
  if (isBistSymbol(symbol)) {
    quote = (await fetchBistQuote(symbol, debugInfo)) || (await fetchYahooQuote(symbol, debugInfo));
  } else {
    quote = (await fetchTwelveQuote(symbol, debugInfo)) || (await fetchYahooQuote(symbol, debugInfo)) || (await fetchStooqQuote(symbol, debugInfo));
  }
  if (quote && debug) quote.debug = debugInfo;
  return [quote, debugInfo];
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));
    return res.status(204).end();
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return sendJson(res, 405, { error: 'Method not allowed' }, 10);
  }

  try {
    const body = req.method === 'POST' ? (req.body || {}) : {};
    const querySymbols = typeof req.query?.symbols === 'string' ? req.query.symbols.split(',') : [];
    const bodySymbols = Array.isArray(body.symbols) ? body.symbols : [];
    const debug = req.query?.debug === '1' || body.debug === true;
    const symbols = [...new Set([...bodySymbols, ...querySymbols].map(normalizeInputSymbol).filter(Boolean))];

    if (symbols.length === 0) return sendJson(res, 400, { error: 'symbols array required' }, 10);

    const allSymbols = [...new Set([...symbols, 'USDTRY=X', 'EURTRY=X'])];
    const entries = await Promise.all(allSymbols.map(async (symbol) => {
      const [quote, providerDebug] = await fetchQuoteForSymbol(symbol, debug);
      return [symbol, quote, providerDebug];
    }));
    const result = {};
    const debugResult = {};
    for (const [symbol, quote, providerDebug] of entries) {
      if (quote) result[symbol] = quote;
      if (debug) debugResult[symbol] = providerDebug;
    }
    if (debug) {
      result.__debug = {
        env: {
          TWELVE_DATA_API_KEY: Boolean(process.env.TWELVE_DATA_API_KEY || process.env.VITE_TWELVE_DATA_API_KEY || process.env.NASDAQ_API_KEY || process.env.VITE_NASDAQ_API_KEY),
          BIST_GAS_URL: Boolean(process.env.BIST_GAS_URL || process.env.VITE_BIST_GAS_URL),
        },
        providers: debugResult,
      };
    }

    return sendJson(res, 200, result, 45);
  } catch (err) {
    return sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) }, 10);
  }
}
