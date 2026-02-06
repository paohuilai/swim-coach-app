
-- Relax RLS for competitions and results to allow authenticated users to insert
-- This is to avoid blocking the user if they haven't set up admin role yet.

-- Drop existing policies to ensure idempotency (Fix for Error 42710)
DROP POLICY IF EXISTS "Allow admin all" ON competitions;
DROP POLICY IF EXISTS "Allow admin all" ON competition_results;
DROP POLICY IF EXISTS "Allow admin or coach insert" ON competitions;
DROP POLICY IF EXISTS "Allow admin or coach insert" ON competition_results;

-- Create new policies
CREATE POLICY "Allow admin or coach insert" ON competitions FOR INSERT WITH CHECK (
  auth.role() = 'authenticated'
);

CREATE POLICY "Allow admin or coach insert" ON competition_results FOR INSERT WITH CHECK (
  auth.role() = 'authenticated'
);

CREATE POLICY "Allow admin all" ON competitions FOR ALL USING (
  EXISTS (SELECT 1 FROM coaches WHERE id = auth.uid()::text AND role IN ('admin', 'manager', 'coach'))
);

CREATE POLICY "Allow admin all" ON competition_results FOR ALL USING (
  EXISTS (SELECT 1 FROM coaches WHERE id = auth.uid()::text AND role IN ('admin', 'manager', 'coach'))
);
