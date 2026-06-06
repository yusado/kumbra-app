const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function sendJson(res, status, data, cacheSeconds = 300) {
  Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', `s-maxage=${cacheSeconds}, stale-while-revalidate=900`);
  res.status(status).json(data);
}

function norm(value) {
  return String(value || '').trim().toUpperCase();
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .trim();
}

function mapExchange(exchange, micCode) {
  const raw = `${exchange || ''} ${micCode || ''}`.toUpperCase();
  if (raw.includes('NASDAQ') || raw.includes('XNAS')) return 'NASDAQ';
  if (raw.includes('NYSE') || raw.includes('XNYS') || raw.includes('ARCX') || raw.includes('AMEX')) return 'NYSE';
  if (raw.includes('BIST') || raw.includes('XIST') || raw.includes('ISTANBUL')) return 'BIST';
  return 'US';
}

function isAllowedMarket(mappedMarket, requestedMarket) {
  if (!requestedMarket || requestedMarket === 'ALL') return true;
  if (requestedMarket === 'US') return mappedMarket === 'NASDAQ' || mappedMarket === 'NYSE';
  return mappedMarket === requestedMarket;
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

function dedupe(items) {
  const map = new Map();
  items.forEach(item => {
    if (!item?.symbol || !item?.market) return;
    const symbol = norm(item.symbol);
    const key = `${item.market}:${symbol}`;
    if (!map.has(key)) map.set(key, { ...item, symbol });
  });
  return Array.from(map.values()).sort((a, b) => a.symbol.localeCompare(b.symbol, 'tr'));
}

let bistCache = { at: 0, rows: [] };
async function loadBistRows(debug) {
  const gasUrl = process.env.BIST_GAS_URL || process.env.VITE_BIST_GAS_URL;
  if (!gasUrl) {
    debug.push('BIST_GAS_URL missing');
    return [];
  }
  if (Date.now() - bistCache.at < 300_000 && Array.isArray(bistCache.rows)) return bistCache.rows;
  const result = await fetchJson(gasUrl, {}, 12000);
  if (!result.ok) {
    debug.push(`BIST GAS failed: ${result.status} ${String(result.text).slice(0, 120)}`);
    return [];
  }
  const data = result.data;
  const rawRows = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : Array.isArray(data?.rows) ? data.rows : [];
  const rows = rawRows.map(row => {
    const symbol = norm(row.symbol || row.ticker || row.code || '');
    return {
      symbol: symbol.replace(/\.IS$/i, ''),
      name: String(row.name || row.asset_name || symbol || 'BIST Hissesi'),
      market: 'BIST',
      type: 'stock',
      currency: 'TRY',
    };
  }).filter(item => item.symbol);
  bistCache = { at: Date.now(), rows };
  return rows;
}

async function searchTwelve(q, requestedMarket, limit, debug) {
  const apiKey = process.env.TWELVE_DATA_API_KEY || process.env.VITE_TWELVE_DATA_API_KEY || process.env.NASDAQ_API_KEY || process.env.VITE_NASDAQ_API_KEY;
  if (!apiKey) {
    debug.push('Twelve Data key missing');
    return [];
  }
  const url = `https://api.twelvedata.com/symbol_search?symbol=${encodeURIComponent(q)}&apikey=${encodeURIComponent(apiKey)}`;
  const result = await fetchJson(url, {}, 9000);
  if (!result.ok) {
    debug.push(`Twelve symbol_search failed: ${result.status} ${String(result.text).slice(0, 120)}`);
    return [];
  }
  const rows = Array.isArray(result.data?.data) ? result.data.data : Array.isArray(result.data) ? result.data : [];
  return rows.map(row => {
    const market = mapExchange(row.exchange, row.mic_code);
    return {
      symbol: norm(row.symbol),
      name: String(row.instrument_name || row.name || row.symbol || ''),
      market,
      type: 'stock',
      currency: row.currency === 'TRY' ? 'TRY' : row.currency === 'EUR' ? 'EUR' : 'USD',
    };
  }).filter(item => item.symbol && item.name && isAllowedMarket(item.market, requestedMarket)).slice(0, limit);
}

async function searchBist(q, requestedMarket, limit, debug) {
  if (requestedMarket !== 'ALL' && requestedMarket !== 'BIST') return [];
  const rows = await loadBistRows(debug);
  const nq = normalizeText(q);
  return rows.filter(row => normalizeText(row.symbol).includes(nq) || normalizeText(row.name).includes(nq)).slice(0, limit);
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));
    return res.status(204).end();
  }
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' }, 10);

  const q = String(req.query?.q || req.query?.query || '').trim();
  const market = norm(req.query?.market || 'ALL');
  const limit = Math.min(Math.max(Number(req.query?.limit || 30), 1), 80);
  const debugEnabled = req.query?.debug === '1';
  const debug = [];

  if (q.length < 1) return sendJson(res, 200, { results: [], debug: debugEnabled ? debug : undefined }, 300);

  try {
    const [usRows, bistRows] = await Promise.all([
      searchTwelve(q, market, limit, debug),
      searchBist(q, market, limit, debug),
    ]);
    const results = dedupe([...bistRows, ...usRows]).slice(0, limit);
    return sendJson(res, 200, debugEnabled ? { results, debug } : { results }, 300);
  } catch (err) {
    return sendJson(res, 500, { error: err instanceof Error ? err.message : String(err), debug }, 10);
  }
}
