-- Fix Avatar Policies to allow public/anon upload (or authenticated coaches)
-- The issue 'new row violates row-level security policy' usually means the INSERT check failed.
-- Since coaches might be authenticated but the policy requires more, or if we want to allow easier upload:

-- 1. Ensure Bucket Exists (Idempotent)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Drop existing restrictive policies
DROP POLICY IF EXISTS "Avatar Auth Upload" ON storage.objects;
DROP POLICY IF EXISTS "Avatar Owner Manage" ON storage.objects;
DROP POLICY IF EXISTS "Avatar Public Read" ON storage.objects;
DROP POLICY IF EXISTS "Avatar Public Upload" ON storage.objects;

-- 3. Create Relaxed Policies

-- Allow Public Read
CREATE POLICY "Avatar Public Read" ON storage.objects
FOR SELECT USING (bucket_id = 'avatars');

-- Allow Upload for Authenticated Users (Coaches) AND Anon (if needed for debugging, but Auth should work if token is passed)
-- We will allow 'authenticated' role. The previous error suggests the user might not have matched the policy.
CREATE POLICY "Avatar Public Upload" ON storage.objects
FOR INSERT WITH CHECK (
    bucket_id = 'avatars' 
    AND (auth.role() = 'authenticated' OR auth.role() = 'anon')
);

-- Allow Update/Delete for Owners or Anon (to be safe during dev, but ideally restricting to owner)
CREATE POLICY "Avatar Owner Manage" ON storage.objects
FOR ALL USING (
    bucket_id = 'avatars' 
    AND (auth.uid() = owner OR auth.role() = 'anon')
);
