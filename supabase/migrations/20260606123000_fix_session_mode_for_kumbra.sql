-- Kumbra session-mode fix
-- The frontend uses a browser-generated x-session-id instead of Supabase Auth.
-- This migration lets anon/authenticated clients read/write their own rows
-- using that header, and keeps market data readable.

CREATE OR REPLACE FUNCTION public.kumbra_session_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(NULLIF(current_setting('request.headers', true), '')::jsonb ->> 'x-session-id', '')
$$;

-- Profiles
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_session_select" ON profiles;
DROP POLICY IF EXISTS "profiles_session_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_session_update" ON profiles;

CREATE POLICY "profiles_session_select" ON profiles
  FOR SELECT TO anon, authenticated
  USING (id::text = public.kumbra_session_id());

CREATE POLICY "profiles_session_insert" ON profiles
  FOR INSERT TO anon, authenticated
  WITH CHECK (id::text = public.kumbra_session_id());

CREATE POLICY "profiles_session_update" ON profiles
  FOR UPDATE TO anon, authenticated
  USING (id::text = public.kumbra_session_id())
  WITH CHECK (id::text = public.kumbra_session_id());

-- Transactions
DROP POLICY IF EXISTS "tx_select_own" ON transactions;
DROP POLICY IF EXISTS "tx_insert_own" ON transactions;
DROP POLICY IF EXISTS "tx_update_own" ON transactions;
DROP POLICY IF EXISTS "tx_delete_own" ON transactions;
DROP POLICY IF EXISTS "tx_session_select" ON transactions;
DROP POLICY IF EXISTS "tx_session_insert" ON transactions;
DROP POLICY IF EXISTS "tx_session_update" ON transactions;
DROP POLICY IF EXISTS "tx_session_delete" ON transactions;

CREATE POLICY "tx_session_select" ON transactions FOR SELECT TO anon, authenticated USING (user_id::text = public.kumbra_session_id());
CREATE POLICY "tx_session_insert" ON transactions FOR INSERT TO anon, authenticated WITH CHECK (user_id::text = public.kumbra_session_id());
CREATE POLICY "tx_session_update" ON transactions FOR UPDATE TO anon, authenticated USING (user_id::text = public.kumbra_session_id()) WITH CHECK (user_id::text = public.kumbra_session_id());
CREATE POLICY "tx_session_delete" ON transactions FOR DELETE TO anon, authenticated USING (user_id::text = public.kumbra_session_id());

-- Watchlist
DROP POLICY IF EXISTS "wl_select_own" ON watchlist;
DROP POLICY IF EXISTS "wl_insert_own" ON watchlist;
DROP POLICY IF EXISTS "wl_delete_own" ON watchlist;
DROP POLICY IF EXISTS "wl_session_select" ON watchlist;
DROP POLICY IF EXISTS "wl_session_insert" ON watchlist;
DROP POLICY IF EXISTS "wl_session_delete" ON watchlist;

CREATE POLICY "wl_session_select" ON watchlist FOR SELECT TO anon, authenticated USING (user_id::text = public.kumbra_session_id());
CREATE POLICY "wl_session_insert" ON watchlist FOR INSERT TO anon, authenticated WITH CHECK (user_id::text = public.kumbra_session_id());
CREATE POLICY "wl_session_delete" ON watchlist FOR DELETE TO anon, authenticated USING (user_id::text = public.kumbra_session_id());

-- Expenses
DROP POLICY IF EXISTS "exp_select_own" ON expenses;
DROP POLICY IF EXISTS "exp_insert_own" ON expenses;
DROP POLICY IF EXISTS "exp_update_own" ON expenses;
DROP POLICY IF EXISTS "exp_delete_own" ON expenses;
DROP POLICY IF EXISTS "exp_session_select" ON expenses;
DROP POLICY IF EXISTS "exp_session_insert" ON expenses;
DROP POLICY IF EXISTS "exp_session_update" ON expenses;
DROP POLICY IF EXISTS "exp_session_delete" ON expenses;

CREATE POLICY "exp_session_select" ON expenses FOR SELECT TO anon, authenticated USING (user_id::text = public.kumbra_session_id());
CREATE POLICY "exp_session_insert" ON expenses FOR INSERT TO anon, authenticated WITH CHECK (user_id::text = public.kumbra_session_id());
CREATE POLICY "exp_session_update" ON expenses FOR UPDATE TO anon, authenticated USING (user_id::text = public.kumbra_session_id()) WITH CHECK (user_id::text = public.kumbra_session_id());
CREATE POLICY "exp_session_delete" ON expenses FOR DELETE TO anon, authenticated USING (user_id::text = public.kumbra_session_id());

-- Income
DROP POLICY IF EXISTS "inc_select_own" ON income;
DROP POLICY IF EXISTS "inc_insert_own" ON income;
DROP POLICY IF EXISTS "inc_update_own" ON income;
DROP POLICY IF EXISTS "inc_delete_own" ON income;
DROP POLICY IF EXISTS "inc_session_select" ON income;
DROP POLICY IF EXISTS "inc_session_insert" ON income;
DROP POLICY IF EXISTS "inc_session_update" ON income;
DROP POLICY IF EXISTS "inc_session_delete" ON income;

CREATE POLICY "inc_session_select" ON income FOR SELECT TO anon, authenticated USING (user_id::text = public.kumbra_session_id());
CREATE POLICY "inc_session_insert" ON income FOR INSERT TO anon, authenticated WITH CHECK (user_id::text = public.kumbra_session_id());
CREATE POLICY "inc_session_update" ON income FOR UPDATE TO anon, authenticated USING (user_id::text = public.kumbra_session_id()) WITH CHECK (user_id::text = public.kumbra_session_id());
CREATE POLICY "inc_session_delete" ON income FOR DELETE TO anon, authenticated USING (user_id::text = public.kumbra_session_id());

-- Liabilities
DROP POLICY IF EXISTS "liab_select_own" ON liabilities;
DROP POLICY IF EXISTS "liab_insert_own" ON liabilities;
DROP POLICY IF EXISTS "liab_update_own" ON liabilities;
DROP POLICY IF EXISTS "liab_delete_own" ON liabilities;
DROP POLICY IF EXISTS "liab_session_select" ON liabilities;
DROP POLICY IF EXISTS "liab_session_insert" ON liabilities;
DROP POLICY IF EXISTS "liab_session_update" ON liabilities;
DROP POLICY IF EXISTS "liab_session_delete" ON liabilities;

CREATE POLICY "liab_session_select" ON liabilities FOR SELECT TO anon, authenticated USING (user_id::text = public.kumbra_session_id());
CREATE POLICY "liab_session_insert" ON liabilities FOR INSERT TO anon, authenticated WITH CHECK (user_id::text = public.kumbra_session_id());
CREATE POLICY "liab_session_update" ON liabilities FOR UPDATE TO anon, authenticated USING (user_id::text = public.kumbra_session_id()) WITH CHECK (user_id::text = public.kumbra_session_id());
CREATE POLICY "liab_session_delete" ON liabilities FOR DELETE TO anon, authenticated USING (user_id::text = public.kumbra_session_id());

-- Cash accounts
DROP POLICY IF EXISTS "cash_select_own" ON cash_accounts;
DROP POLICY IF EXISTS "cash_insert_own" ON cash_accounts;
DROP POLICY IF EXISTS "cash_update_own" ON cash_accounts;
DROP POLICY IF EXISTS "cash_delete_own" ON cash_accounts;
DROP POLICY IF EXISTS "cash_session_select" ON cash_accounts;
DROP POLICY IF EXISTS "cash_session_insert" ON cash_accounts;
DROP POLICY IF EXISTS "cash_session_update" ON cash_accounts;
DROP POLICY IF EXISTS "cash_session_delete" ON cash_accounts;

CREATE POLICY "cash_session_select" ON cash_accounts FOR SELECT TO anon, authenticated USING (user_id::text = public.kumbra_session_id());
CREATE POLICY "cash_session_insert" ON cash_accounts FOR INSERT TO anon, authenticated WITH CHECK (user_id::text = public.kumbra_session_id());
CREATE POLICY "cash_session_update" ON cash_accounts FOR UPDATE TO anon, authenticated USING (user_id::text = public.kumbra_session_id()) WITH CHECK (user_id::text = public.kumbra_session_id());
CREATE POLICY "cash_session_delete" ON cash_accounts FOR DELETE TO anon, authenticated USING (user_id::text = public.kumbra_session_id());

-- Settings
DROP POLICY IF EXISTS "set_select_own" ON settings;
DROP POLICY IF EXISTS "set_insert_own" ON settings;
DROP POLICY IF EXISTS "set_update_own" ON settings;
DROP POLICY IF EXISTS "set_session_select" ON settings;
DROP POLICY IF EXISTS "set_session_insert" ON settings;
DROP POLICY IF EXISTS "set_session_update" ON settings;

CREATE POLICY "set_session_select" ON settings FOR SELECT TO anon, authenticated USING (user_id::text = public.kumbra_session_id());
CREATE POLICY "set_session_insert" ON settings FOR INSERT TO anon, authenticated WITH CHECK (user_id::text = public.kumbra_session_id());
CREATE POLICY "set_session_update" ON settings FOR UPDATE TO anon, authenticated USING (user_id::text = public.kumbra_session_id()) WITH CHECK (user_id::text = public.kumbra_session_id());

-- Public market data: allow anon reads/inserts for prototype market snapshots.
DROP POLICY IF EXISTS "prices_read_all" ON asset_prices;
DROP POLICY IF EXISTS "prices_insert_all" ON asset_prices;
DROP POLICY IF EXISTS "rates_read_all" ON exchange_rates;
DROP POLICY IF EXISTS "rates_insert_all" ON exchange_rates;
DROP POLICY IF EXISTS "rates_update_all" ON exchange_rates;
DROP POLICY IF EXISTS "logs_read_all" ON data_source_logs;
DROP POLICY IF EXISTS "logs_insert_all" ON data_source_logs;

CREATE POLICY "prices_read_all" ON asset_prices FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "prices_insert_all" ON asset_prices FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "rates_read_all" ON exchange_rates FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "rates_insert_all" ON exchange_rates FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "rates_update_all" ON exchange_rates FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "logs_read_all" ON data_source_logs FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "logs_insert_all" ON data_source_logs FOR INSERT TO anon, authenticated WITH CHECK (true);
