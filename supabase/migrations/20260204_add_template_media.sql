-- 1. Create Storage Bucket for Media
-- (Assuming we need to do this via SQL, but typically buckets are created via API or Dashboard. 
-- However, we can set RLS policies for objects table.)
-- For this SQL, we will focus on the schema changes.

-- 2. Add media column to training_plan_templates
ALTER TABLE training_plan_templates
ADD COLUMN IF NOT EXISTS media_urls text[] DEFAULT '{}';

-- 3. Storage Policies (If bucket 'templates' exists)
-- Since we can't easily create buckets via SQL migration in standard Supabase setup without extension,
-- We assume the user or we will create it via dashboard or we rely on the client to upload to an existing bucket.
-- Let's create a policy for the 'storage.objects' table just in case.

-- Allow public upload to 'templates' bucket
CREATE POLICY "Public Upload to Templates" ON storage.objects
FOR INSERT TO public
WITH CHECK (bucket_id = 'templates');

-- Allow public read
CREATE POLICY "Public Read Templates" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'templates');
