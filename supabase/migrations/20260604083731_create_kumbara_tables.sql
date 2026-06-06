/*
  # Kumbara - Asset Tracker Schema

  ## Summary
  Creates the core data model for the Kumbara portfolio tracking app.

  ## New Tables

  ### `assets`
  Stores individual stock holdings per user session.
  - `id` - UUID primary key
  - `session_id` - Browser-generated session identifier (no auth required)
  - `ticker` - Stock ticker symbol (e.g. AAPL, GARAN.IS)
  - `name` - Display name of the stock
  - `exchange` - Either 'US' (Nasdaq/NYSE) or 'BIST' (Borsa Istanbul)
  - `quantity` - Number of shares held
  - `purchase_price` - Price per share at time of purchase
  - `currency` - Currency of the purchase price (USD or TRY)
  - `created_at` - Timestamp of when the asset was added

  ### `portfolio_snapshots`
  Stores periodic portfolio value snapshots for the line chart.
  - `id` - UUID primary key
  - `session_id` - Browser-generated session identifier
  - `total_value_usd` - Total portfolio value in USD at snapshot time
  - `total_value_try` - Total portfolio value in TRY at snapshot time
  - `recorded_at` - Timestamp of the snapshot

  ## Security
  - RLS enabled on both tables
  - Access restricted to the matching session_id
  - No authenticated user required; session-based access control
*/

CREATE TABLE IF NOT EXISTS assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  ticker text NOT NULL,
  name text NOT NULL,
  exchange text NOT NULL CHECK (exchange IN ('US', 'BIST')),
  quantity numeric NOT NULL CHECK (quantity > 0),
  purchase_price numeric NOT NULL CHECK (purchase_price > 0),
  currency text NOT NULL DEFAULT 'USD',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  total_value_usd numeric NOT NULL DEFAULT 0,
  total_value_try numeric NOT NULL DEFAULT 0,
  recorded_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS assets_session_id_idx ON assets(session_id);
CREATE INDEX IF NOT EXISTS snapshots_session_id_idx ON portfolio_snapshots(session_id);
CREATE INDEX IF NOT EXISTS snapshots_recorded_at_idx ON portfolio_snapshots(recorded_at);

ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_snapshots ENABLE ROW LEVEL SECURITY;

-- Assets policies: session-based access
CREATE POLICY "Session can select own assets"
  ON assets FOR SELECT
  USING (session_id = current_setting('request.headers', true)::json->>'x-session-id');

CREATE POLICY "Session can insert own assets"
  ON assets FOR INSERT
  WITH CHECK (session_id = current_setting('request.headers', true)::json->>'x-session-id');

CREATE POLICY "Session can update own assets"
  ON assets FOR UPDATE
  USING (session_id = current_setting('request.headers', true)::json->>'x-session-id')
  WITH CHECK (session_id = current_setting('request.headers', true)::json->>'x-session-id');

CREATE POLICY "Session can delete own assets"
  ON assets FOR DELETE
  USING (session_id = current_setting('request.headers', true)::json->>'x-session-id');

-- Portfolio snapshots policies
CREATE POLICY "Session can select own snapshots"
  ON portfolio_snapshots FOR SELECT
  USING (session_id = current_setting('request.headers', true)::json->>'x-session-id');

CREATE POLICY "Session can insert own snapshots"
  ON portfolio_snapshots FOR INSERT
  WITH CHECK (session_id = current_setting('request.headers', true)::json->>'x-session-id');
