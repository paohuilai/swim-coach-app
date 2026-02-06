-- Fix RLS policy to allow Anonymous inserts as a fallback
-- This handles cases where the Clerk-Supabase JWT integration is not fully configured
-- It allows the 'anon' role (used by the default supabase client) to insert data

-- 1. Competitions: Allow Anon Insert
DROP POLICY IF EXISTS "Allow authenticated insert" ON competitions;
CREATE POLICY "Allow authenticated or anon insert" ON competitions FOR INSERT WITH CHECK (
  auth.role() = 'authenticated' OR auth.role() = 'anon'
);

-- 2. Competition Results: Allow Anon Insert
DROP POLICY IF EXISTS "Allow authenticated insert" ON competition_results;
CREATE POLICY "Allow authenticated or anon insert" ON competition_results FOR INSERT WITH CHECK (
  auth.role() = 'authenticated' OR auth.role() = 'anon'
);
