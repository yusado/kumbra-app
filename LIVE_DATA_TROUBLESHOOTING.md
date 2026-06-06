# Kumbra live data troubleshooting

## First tests after deploy

Open these URLs after Vercel redeploy:

```text
https://kumbra-app.vercel.app/api/health
```

Expected:

```json
{"ok":true,"env":{"hasTwelveDataKey":true}}
```

Then test NASDAQ/US quotes:

```text
https://kumbra-app.vercel.app/api/quotes?symbols=AAPL,MSFT,QQQ&debug=1
```

If `hasTwelveDataKey` is false, add this Vercel environment variable and redeploy:

```text
TWELVE_DATA_API_KEY=your_key
```

The app also accepts these fallback names, but `TWELVE_DATA_API_KEY` is preferred:

```text
VITE_TWELVE_DATA_API_KEY
NASDAQ_API_KEY
VITE_NASDAQ_API_KEY
```

## Important

The API key must be added in Vercel under:

```text
Project → Settings → Environment Variables
```

Select Production, Preview, and Development. Then redeploy the latest production deployment.

## Provider order for US/NASDAQ

The serverless API tries:

1. Twelve Data using `TWELVE_DATA_API_KEY`
2. Yahoo Finance fallback
3. Stooq fallback

So even when Twelve Data is missing or limited, common US symbols such as AAPL, MSFT, NVDA, QQQ, SPY should still return delayed fallback data when the external providers are reachable.
