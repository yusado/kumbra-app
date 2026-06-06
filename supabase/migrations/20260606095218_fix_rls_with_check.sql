-- Fix RLS policies - add WITH CHECK clause for INSERT operations

-- Drop existing INSERT policies
DROP POLICY IF EXISTS wl_insert_own ON watchlist;
DROP POLICY IF EXISTS exp_insert_own ON expenses;
DROP POLICY IF EXISTS inc_insert_own ON income;

-- Recreate with WITH CHECK clause
CREATE POLICY "wl_insert_own" ON watchlist FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "exp_insert_own" ON expenses FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "inc_insert_own" ON income FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
