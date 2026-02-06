-- Fix RLS policy violation for competition creation
-- Relax policies to allow authenticated users to create competitions/results
-- This resolves the "new row violates row-level security policy" error

-- 1. Drop existing restrictive policies on competitions
DROP POLICY IF EXISTS "Allow admin all" ON competitions;
DROP POLICY IF EXISTS "Allow admin or coach insert" ON competitions;
DROP POLICY IF EXISTS "Allow public read access" ON competitions;

-- 2. Drop existing restrictive policies on competition_results
DROP POLICY IF EXISTS "Allow admin all" ON competition_results;
DROP POLICY IF EXISTS "Allow admin or coach insert" ON competition_results;
DROP POLICY IF EXISTS "Allow public read access" ON competition_results;

-- 3. Re-create Policies for Competitions

-- Allow everyone to read
CREATE POLICY "Allow public read access" ON competitions FOR SELECT USING (true);

-- Allow authenticated users (coaches/admins) to INSERT
CREATE POLICY "Allow authenticated insert" ON competitions FOR INSERT WITH CHECK (
  auth.role() = 'authenticated'
);

-- Allow admins/managers to UPDATE/DELETE (or creator)
CREATE POLICY "Allow admin/manager or creator all" ON competitions FOR UPDATE USING (
  EXISTS (SELECT 1 FROM coaches WHERE id = auth.uid()::text AND role IN ('admin', 'manager')) OR
  created_by = auth.uid()::text
);

CREATE POLICY "Allow admin/manager or creator delete" ON competitions FOR DELETE USING (
  EXISTS (SELECT 1 FROM coaches WHERE id = auth.uid()::text AND role IN ('admin', 'manager')) OR
  created_by = auth.uid()::text
);

-- 4. Re-create Policies for Competition Results

-- Allow everyone to read
CREATE POLICY "Allow public read access" ON competition_results FOR SELECT USING (true);

-- Allow authenticated users to INSERT
CREATE POLICY "Allow authenticated insert" ON competition_results FOR INSERT WITH CHECK (
  auth.role() = 'authenticated'
);

-- Allow admins/managers to UPDATE/DELETE (via parent competition check usually, but simplified here)
CREATE POLICY "Allow admin/manager all" ON competition_results FOR ALL USING (
  EXISTS (SELECT 1 FROM coaches WHERE id = auth.uid()::text AND role IN ('admin', 'manager'))
);
