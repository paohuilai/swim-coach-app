-- Add Storage and Fix Training Plans
-- 1. Create storage bucket for training plans if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('training_plans', 'training_plans', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Storage Policies
-- Allow anyone to read (public bucket)
CREATE POLICY "Public Access" ON storage.objects FOR SELECT
USING ( bucket_id = 'training_plans' );

-- Allow authenticated users (coaches) to upload
CREATE POLICY "Authenticated Upload" ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'training_plans' );

-- Allow owners to update/delete
CREATE POLICY "Owner Manage" ON storage.objects FOR ALL
TO authenticated
USING ( bucket_id = 'training_plans' AND auth.uid() = owner );

-- 3. Fix Training Plans Table (Ensure it's correct)
-- Make sure media_urls and target_groups are JSONB
ALTER TABLE training_plans ALTER COLUMN media_urls TYPE jsonb USING media_urls::jsonb;
ALTER TABLE training_plans ALTER COLUMN target_groups TYPE jsonb USING target_groups::jsonb;

-- Ensure RLS is enabled
ALTER TABLE training_plans ENABLE ROW LEVEL SECURITY;

-- Re-apply policies just in case
DROP POLICY IF EXISTS "Allow coach insert own plans" ON training_plans;
CREATE POLICY "Allow coach insert own plans" ON training_plans 
FOR INSERT WITH CHECK (auth.uid()::text = coach_id);

-- 4. Fix Coaches Table (Ensure RLS allows reading)
-- If insert fails due to FK, it might be because the user can't SEE their own coach record?
-- Usually FK checks bypass RLS, but let's be safe.
-- We assume coaches table exists.
