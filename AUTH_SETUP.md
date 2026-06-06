# Kumbra Auth / Çok Cihazlı Kullanım Kurulumu

Bu sürüm iki modda çalışır:

1. **Demo mod**: `VITE_SUPABASE_URL` ve `VITE_SUPABASE_ANON_KEY` yoksa uygulama açılır, veriler sadece tarayıcı localStorage içinde saklanır.
2. **Hesap modu**: Supabase env değerleri varsa kullanıcı e-posta/şifre ile giriş yapar. Harcama, gelir, takip listesi, portföy işlemleri, borç ve nakit verileri `user_id = auth.uid()` mantığıyla Supabase'e kaydedilir.

## Vercel Environment Variables

Vercel > Project > Settings > Environment Variables içine ekle:

```env
VITE_SUPABASE_URL=SUPABASE_PROJECT_URL
VITE_SUPABASE_ANON_KEY=SUPABASE_ANON_KEY
VITE_BIST_GAS_URL=GOOGLE_APPS_SCRIPT_WEB_APP_URL
VITE_TWELVE_DATA_API_KEY=TWELVE_DATA_KEY
```

İlk iki değer hesap sistemi için zorunludur. Son iki değer piyasa verileri için kullanılır.

## Supabase SQL

Supabase SQL Editor içinde migration dosyalarını sırayla çalıştır. En kritik yeni dosya:

```text
supabase/migrations/20260606170000_add_supabase_auth_accounts.sql
```

Bu dosya hem Supabase Auth hesabı hem de eski demo/session modu için RLS policy'lerini hibrit hale getirir.

## Kullanıcı Deneyimi

- Env yoksa: uygulama demo modda açılır.
- Env varsa ve kullanıcı giriş yapmamışsa: login/kayıt ekranı gelir.
- Kullanıcı giriş yaptıktan sonra: veriler Supabase hesabına bağlı kaydedilir.
- Cihazda eski demo verileri varsa: uygulama “Hesabıma aktar” seçeneği gösterir.
