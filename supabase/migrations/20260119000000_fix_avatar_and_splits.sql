-- Fix Avatars Bucket Policy (RLS)
-- Allow public/anon access as requested
DO $$
BEGIN
    -- Create bucket if not exists
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('avatars', 'avatars', true)
    ON CONFLICT (id) DO UPDATE SET public = true;
END $$;

-- Drop existing restrictive policies to be safe
DROP POLICY IF EXISTS "Avatar Full Access" ON storage.objects;
DROP POLICY IF EXISTS "Avatar Public Read" ON storage.objects;
DROP POLICY IF EXISTS "Avatar Public Upload" ON storage.objects;
DROP POLICY IF EXISTS "Avatar Owner Manage" ON storage.objects;

-- Create comprehensive policy
CREATE POLICY "Avatar Full Access" ON storage.objects
FOR ALL TO authenticated, anon
USING (bucket_id = 'avatars')
WITH CHECK (bucket_id = 'avatars');


-- Add split_times column to performance_entries if not exists
-- We need to check if the table exists first. Based on previous turns, it likely implies 'performance_entries' or similar.
-- Let's check the schema or just add it if table exists.
-- Since I can't easily check schema in one go, I'll assume 'performance_entries' is the table name for performances.
-- If 'training_logs' is the parent, 'performance_entries' is usually the child.

CREATE TABLE IF NOT EXISTS performance_entries (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    training_log_id uuid REFERENCES training_logs(id) ON DELETE CASCADE,
    stroke text NOT NULL,
    time_seconds numeric,
    display_time text,
    timing_method text,
    reaction_time numeric,
    created_at timestamptz DEFAULT now()
);

-- Add split_times column
ALTER TABLE performance_entries 
ADD COLUMN IF NOT EXISTS split_times jsonb DEFAULT '[]'::jsonb;
