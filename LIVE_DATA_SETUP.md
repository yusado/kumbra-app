# Kumbra canlı veri kurulumu

Bu sürümde canlı veri Vercel Serverless Functions üzerinden çalışır:

- `/api/quotes` → anlık fiyatlar
- `/api/history` → grafik geçmişi

Bu sayede Twelve Data API key tarayıcıya gömülmez. Vercel ortam değişkenlerine eklenir.

## Vercel Environment Variables

Vercel > Project > Settings > Environment Variables bölümüne şunları ekle:

```env
TWELVE_DATA_API_KEY=senin_twelve_data_keyin
BIST_GAS_URL=senin_google_apps_script_web_app_urlin
VITE_SUPABASE_URL=https://...supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
```

Ekledikten sonra Vercel'de son deployment için **Redeploy** yap.

## NASDAQ / ABD verileri

`TWELVE_DATA_API_KEY` varsa ABD hisseleri için önce Twelve Data denenir. API limiti veya hata olursa server tarafında Yahoo fallback denenir.

## BIST verileri

`BIST_GAS_URL` varsa BIST sembolleri Google Apps Script JSON endpointinden çekilir. Endpoint satır formatı:

```json
[
  {
    "symbol": "ASELS",
    "name": "Aselsan",
    "price": 123.45,
    "change": 1.25,
    "changePercent": 1.03,
    "currency": "TRY",
    "timestamp": "2026-06-06T12:00:00+03:00",
    "source": "Google Apps Script"
  }
]
```

BIST endpoint yoksa Yahoo fallback denenir; olmazsa uygulama mevcut mock/son veriyle ayakta kalır.

## Grafikler

Desteklenen aralıklar:

- 24 saat
- 1 hafta
- 1 ay
- 6 ay
- 1 yıl
- 2 yıl
- 5 yıl

Grafik önce `/api/history` üzerinden canlı veri dener. Veri yoksa Supabase `asset_prices` snapshot tablosundan geçmiş oluşturmaya çalışır.

## Not

Vite local dev (`npm run dev`) Vercel `/api` fonksiyonlarını çalıştırmaz. Canlı Vercel deployunda çalışır. Lokal serverless test için `vercel dev` kullanılabilir.
