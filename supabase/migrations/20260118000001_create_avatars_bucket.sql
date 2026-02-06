-- Create Avatars Bucket and Policies

-- 1. Create Bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Storage Policies

-- Allow Public Read
CREATE POLICY "Avatar Public Read" ON storage.objects
FOR SELECT USING (bucket_id = 'avatars');

-- Allow Authenticated Upload
CREATE POLICY "Avatar Auth Upload" ON storage.objects
FOR INSERT WITH CHECK (
    bucket_id = 'avatars' 
    AND auth.role() = 'authenticated'
);

-- Allow Owner Update/Delete
CREATE POLICY "Avatar Owner Manage" ON storage.objects
FOR ALL USING (
    bucket_id = 'avatars' 
    AND auth.uid() = owner
);
