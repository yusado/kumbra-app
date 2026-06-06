/*
  # Fix RLS policies for session-based access

  Updates the RLS policies to correctly extract the x-session-id header from request headers.
*/

DROP POLICY IF EXISTS "Session can select own assets" ON assets;
DROP POLICY IF EXISTS "Session can insert own assets" ON assets;
DROP POLICY IF EXISTS "Session can update own assets" ON assets;
DROP POLICY IF EXISTS "Session can delete own assets" ON assets;
DROP POLICY IF EXISTS "Session can select own snapshots" ON portfolio_snapshots;
DROP POLICY IF EXISTS "Session can insert own snapshots" ON portfolio_snapshots;

CREATE POLICY "Session can select own assets"
  ON assets FOR SELECT
  USING (session_id = (current_setting('request.headers')::jsonb->>'x-session-id'));

CREATE POLICY "Session can insert own assets"
  ON assets FOR INSERT
  WITH CHECK (session_id = (current_setting('request.headers')::jsonb->>'x-session-id'));

CREATE POLICY "Session can update own assets"
  ON assets FOR UPDATE
  USING (session_id = (current_setting('request.headers')::jsonb->>'x-session-id'))
  WITH CHECK (session_id = (current_setting('request.headers')::jsonb->>'x-session-id'));

CREATE POLICY "Session can delete own assets"
  ON assets FOR DELETE
  USING (session_id = (current_setting('request.headers')::jsonb->>'x-session-id'));

CREATE POLICY "Session can select own snapshots"
  ON portfolio_snapshots FOR SELECT
  USING (session_id = (current_setting('request.headers')::jsonb->>'x-session-id'));

CREATE POLICY "Session can insert own snapshots"
  ON portfolio_snapshots FOR INSERT
  WITH CHECK (session_id = (current_setting('request.headers')::jsonb->>'x-session-id'));
