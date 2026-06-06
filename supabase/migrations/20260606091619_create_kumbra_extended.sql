-- Kumbra Extended Schema - adds comprehensive finance tracking

-- ============================================
-- PROFILES (user data)
-- ============================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT,
  base_currency TEXT DEFAULT 'TRY',
  privacy_mode TEXT DEFAULT 'visible_try' CHECK (privacy_mode IN ('visible_try', 'visible_usd', 'hidden')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ASSET PRICES (extended market data)
-- ============================================
CREATE TABLE asset_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL,
  price NUMERIC(18,6) NOT NULL,
  currency TEXT DEFAULT 'TRY',
  change NUMERIC(18,6),
  change_percent NUMERIC(10,4),
  change_1w NUMERIC(10,4),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  source TEXT DEFAULT 'manual',
  interval TEXT DEFAULT '1d'
);

CREATE INDEX idx_asset_prices_symbol ON asset_prices(symbol);
CREATE INDEX idx_asset_prices_ts ON asset_prices(timestamp DESC);

-- ============================================
-- TRANSACTIONS (comprehensive portfolio)
-- ============================================
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  symbol TEXT NOT NULL,
  asset_name TEXT,
  market TEXT DEFAULT 'US',
  type TEXT NOT NULL CHECK (type IN ('buy', 'sell', 'dividend', 'fund_buy', 'fund_sell', 'commission', 'cash_in', 'cash_out')),
  quantity NUMERIC(18,6) NOT NULL DEFAULT 0,
  unit_price NUMERIC(18,6) NOT NULL DEFAULT 0,
  total_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'TRY',
  fee NUMERIC(18,2) DEFAULT 0,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transactions_user ON transactions(user_id);
CREATE INDEX idx_transactions_symbol ON transactions(symbol);
CREATE INDEX idx_transactions_date ON transactions(transaction_date DESC);

-- ============================================
-- WATCHLIST
-- ============================================
CREATE TABLE watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  symbol TEXT NOT NULL,
  asset_name TEXT,
  market TEXT DEFAULT 'US',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, symbol)
);

CREATE INDEX idx_watchlist_user ON watchlist(user_id);

-- ============================================
-- EXPENSES
-- ============================================
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  category TEXT NOT NULL,
  amount NUMERIC(18,2) NOT NULL,
  currency TEXT DEFAULT 'TRY',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  repeat_type TEXT DEFAULT 'none' CHECK (repeat_type IN ('none', 'daily', 'weekly', 'monthly', 'yearly')),
  payment_method TEXT DEFAULT 'cash' CHECK (payment_method IN ('cash', 'debit', 'credit', 'bank')),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_expenses_user ON expenses(user_id);
CREATE INDEX idx_expenses_date ON expenses(date DESC);

-- ============================================
-- INCOME
-- ============================================
CREATE TABLE income (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  category TEXT NOT NULL,
  amount NUMERIC(18,2) NOT NULL,
  currency TEXT DEFAULT 'TRY',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  repeat_type TEXT DEFAULT 'none' CHECK (repeat_type IN ('none', 'daily', 'weekly', 'monthly', 'yearly')),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_income_user ON income(user_id);
CREATE INDEX idx_income_date ON income(date DESC);

-- ============================================
-- LIABILITIES (debts, loans)
-- ============================================
CREATE TABLE liabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  amount NUMERIC(18,2) NOT NULL,
  currency TEXT DEFAULT 'TRY',
  due_date DATE,
  monthly_payment NUMERIC(18,2) DEFAULT 0,
  category TEXT DEFAULT 'other',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_liabilities_user ON liabilities(user_id);

-- ============================================
-- CASH ACCOUNTS
-- ============================================
CREATE TABLE cash_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  balance NUMERIC(18,2) DEFAULT 0,
  currency TEXT DEFAULT 'TRY',
  account_type TEXT DEFAULT 'bank' CHECK (account_type IN ('cash', 'bank', 'credit_card')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cash_accounts_user ON cash_accounts(user_id);

-- ============================================
-- EXCHANGE RATES
-- ============================================
CREATE TABLE exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pair TEXT NOT NULL UNIQUE,
  rate NUMERIC(18,6) NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  source TEXT DEFAULT 'manual'
);

-- ============================================
-- USER SETTINGS
-- ============================================
CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  key TEXT NOT NULL,
  value TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, key)
);

-- ============================================
-- DATA SOURCE LOGS
-- ============================================
CREATE TABLE data_source_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE income ENABLE ROW LEVEL SECURITY;
ALTER TABLE liabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_source_logs ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Transactions
CREATE POLICY "tx_select_own" ON transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "tx_insert_own" ON transactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tx_update_own" ON transactions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tx_delete_own" ON transactions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Watchlist
CREATE POLICY "wl_select_own" ON watchlist FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "wl_insert_own" ON watchlist FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "wl_delete_own" ON watchlist FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Expenses
CREATE POLICY "exp_select_own" ON expenses FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "exp_insert_own" ON expenses FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "exp_update_own" ON expenses FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "exp_delete_own" ON expenses FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Income
CREATE POLICY "inc_select_own" ON income FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "inc_insert_own" ON income FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "inc_update_own" ON income FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "inc_delete_own" ON income FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Liabilities
CREATE POLICY "liab_select_own" ON liabilities FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "liab_insert_own" ON liabilities FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "liab_update_own" ON liabilities FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "liab_delete_own" ON liabilities FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Cash accounts
CREATE POLICY "cash_select_own" ON cash_accounts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "cash_insert_own" ON cash_accounts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cash_update_own" ON cash_accounts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cash_delete_own" ON cash_accounts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Settings
CREATE POLICY "set_select_own" ON settings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "set_insert_own" ON settings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "set_update_own" ON settings FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Public read for market data
CREATE POLICY "prices_read_all" ON asset_prices FOR SELECT TO authenticated USING (true);
CREATE POLICY "prices_insert_all" ON asset_prices FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "rates_read_all" ON exchange_rates FOR SELECT TO authenticated USING (true);
CREATE POLICY "rates_insert_all" ON exchange_rates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "rates_update_all" ON exchange_rates FOR UPDATE TO authenticated USING (true);

CREATE POLICY "logs_read_all" ON data_source_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "logs_insert_all" ON data_source_logs FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================
-- SEED DATA
-- ============================================

INSERT INTO exchange_rates (pair, rate, source) VALUES
('USDTRY', 45.50, 'manual'),
('EURTRY', 49.20, 'manual')
ON CONFLICT (pair) DO UPDATE SET rate = EXCLUDED.rate, timestamp = NOW();

-- Seed some asset prices
INSERT INTO asset_prices (symbol, price, currency, change_percent, source) VALUES
('AAPL', 210.50, 'USD', 1.5, 'yahoo'),
('MSFT', 415.20, 'USD', 0.8, 'yahoo'),
('NVDA', 880.00, 'USD', 2.3, 'yahoo'),
('GARAN.IS', 125.80, 'TRY', 1.2, 'yahoo'),
('THYAO.IS', 295.00, 'TRY', 0.5, 'yahoo'),
('USDTRY=X', 45.50, 'TRY', 0.1, 'yahoo'),
('EURTRY=X', 49.20, 'TRY', 0.2, 'yahoo'),
('GC=F', 2350.00, 'USD', 0.5, 'yahoo'),
('SPY', 530.00, 'USD', 0.7, 'yahoo'),
('QQQ', 460.00, 'USD', 1.1, 'yahoo')
ON CONFLICT DO NOTHING;
