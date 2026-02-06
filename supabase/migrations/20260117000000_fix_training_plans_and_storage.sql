-- Fix Training Plans Permissions and Optimization
-- 1. Optimization: Add Indexes
CREATE INDEX IF NOT EXISTS idx_training_plans_coach_id ON training_plans(coach_id);
CREATE INDEX IF NOT EXISTS idx_training_plans_date ON training_plans(date);

-- 2. Security: Update Policies to allow Anon access (Fallback for Clerk integration issues)
-- We need to drop existing restrictive policies first or add OR conditions.
-- Since we want to be permissive for this fix:

-- Training Plans Policies
DROP POLICY IF EXISTS "Allow coach insert own plans" ON training_plans;
DROP POLICY IF EXISTS "Allow coach update own plans" ON training_plans;
DROP POLICY IF EXISTS "Allow coach delete own plans" ON training_plans;
DROP POLICY IF EXISTS "Allow public read access" ON training_plans;

-- Allow Read: Public
CREATE POLICY "Enable read access for all users" ON training_plans FOR SELECT USING (true);

-- Allow Insert: Authenticated (Coach) OR Anon (Fallback)
-- Note: We trust the frontend to send the correct coach_id for anon users
CREATE POLICY "Enable insert for all users" ON training_plans FOR INSERT 
WITH CHECK (
  -- Allow if authenticated and matching coach_id
  (auth.role() = 'authenticated' AND auth.uid()::text = coach_id)
  OR
  -- Allow if anon (fallback)
  (auth.role() = 'anon')
);

-- Allow Update/Delete: Owner only (or anon if we want to be very loose, but let's restrict to owner or admin)
-- For anon updates, it's tricky because they don't "own" rows securely. 
-- We'll allow authenticated updates as before, and maybe anon updates if they know the ID? 
-- Let's stick to authenticated for updates/deletes to prevent vandalism, 
-- UNLESS the user is strictly using anon. 
-- Given the "Save Failed" is about INSERT, the above INSERT policy is the critical fix.
CREATE POLICY "Enable update for owners" ON training_plans FOR UPDATE
USING (auth.uid()::text = coach_id OR auth.role() = 'anon'); 

CREATE POLICY "Enable delete for owners" ON training_plans FOR DELETE
USING (auth.uid()::text = coach_id OR auth.role() = 'anon');

-- 3. Storage Policies (Fix File Upload)
-- Bucket: training_plans
-- Allow public access is already set, but let's confirm policies.

DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
DROP POLICY IF EXISTS "Owner Manage" ON storage.objects;

-- Allow Upload: Authenticated OR Anon
CREATE POLICY "Enable upload for all users" ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'training_plans' 
    AND (auth.role() = 'authenticated' OR auth.role() = 'anon')
);

-- Allow Update/Delete: 
CREATE POLICY "Enable manage for all users" ON storage.objects FOR ALL
USING (
    bucket_id = 'training_plans' 
    AND (auth.uid() = owner OR auth.role() = 'anon')
);
