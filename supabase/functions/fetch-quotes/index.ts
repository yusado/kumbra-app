import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface QuoteResult {
  price: number;
  name: string;
  currency: string;
  changePercent: number;
  change: number;
}

interface HistoryPoint {
  date: string;
  close: number;
}

const FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
  "Pragma": "no-cache",
  "Referer": "https://finance.yahoo.com/",
  "Origin": "https://finance.yahoo.com",
};

async function tryFetch(url: string): Promise<Response | null> {
  for (const host of ["query2", "query1"]) {
    try {
      const res = await fetch(url.replace("{host}", host), { headers: FETCH_HEADERS });
      if (res.ok) return res;
    } catch {}
  }
  return null;
}

async function fetchSymbol(symbol: string): Promise<QuoteResult | null> {
  const ts = Date.now();
  const url = `https://{host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d&_=${ts}`;
  const res = await tryFetch(url);
  if (!res) return null;

  const data = await res.json();
  const meta = data?.chart?.result?.[0]?.meta;
  if (!meta?.regularMarketPrice) return null;

  const currentPrice: number = meta.regularMarketPrice;
  const prevClose: number = meta.chartPreviousClose ?? meta.previousClose ?? currentPrice;
  const change = currentPrice - prevClose;
  const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

  return {
    price: currentPrice,
    name: meta.shortName || meta.longName || meta.symbol || symbol,
    currency: meta.currency ?? "USD",
    changePercent,
    change,
  };
}

async function fetchHistory(symbol: string, range: string): Promise<HistoryPoint[]> {
  const ts = Date.now();
  const intervalMap: Record<string, string> = {
    '1d': '5m',
    '1w': '15m',
    '1m': '1h',
    '6m': '1d',
    '1y': '1d',
    '2y': '1wk',
    '5y': '1wk',
  };
  const interval = intervalMap[range] || '1d';

  const url = `https://{host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}&_=${ts}`;
  const res = await tryFetch(url);
  if (!res) return [];

  const data = await res.json();
  const result = data?.chart?.result?.[0];
  if (!result) return [];

  const timestamps: number[] = result.timestamp ?? [];
  const closes: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];

  const points: HistoryPoint[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const close = closes[i];
    if (close == null || close <= 0) continue;
    const date = new Date(timestamps[i] * 1000).toISOString().slice(0, 10);
    points.push({ date, close: Math.round(close * 100) / 100 });
  }
  return points;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const url = new URL(req.url);

  // GET /fetch-quotes/history?symbol=GARAN.IS&range=1y
  if (req.method === "GET" && url.pathname.includes("/history")) {
    const symbol = url.searchParams.get("symbol");
    const range = url.searchParams.get("range") || "1y";
    if (!symbol) {
      return new Response(JSON.stringify({ error: "symbol query param required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    try {
      const history = await fetchHistory(symbol, range);
      return new Response(JSON.stringify(history), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  // POST /fetch-quotes  { symbols: string[] }
  try {
    const { symbols } = await req.json();

    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return new Response(JSON.stringify({ error: "symbols array is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Always include USD/TRY for currency conversion
    const allSymbols: string[] = [...new Set([...symbols, "USDTRY=X"])];

    const results = await Promise.all(
      allSymbols.map(async (symbol) => ({ symbol, data: await fetchSymbol(symbol) }))
    );

    const result: Record<string, QuoteResult> = {};
    for (const { symbol, data } of results) {
      if (data) result[symbol] = data;
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
