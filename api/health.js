export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(200).json({
    ok: true,
    timestamp: new Date().toISOString(),
    env: {
      hasTwelveDataKey: Boolean(process.env.TWELVE_DATA_API_KEY || process.env.VITE_TWELVE_DATA_API_KEY || process.env.NASDAQ_API_KEY || process.env.VITE_NASDAQ_API_KEY),
      hasBistGasUrl: Boolean(process.env.BIST_GAS_URL || process.env.VITE_BIST_GAS_URL),
      hasSupabaseUrl: Boolean(process.env.VITE_SUPABASE_URL),
      hasSupabaseKey: Boolean(process.env.VITE_SUPABASE_ANON_KEY),
    },
  });
}
