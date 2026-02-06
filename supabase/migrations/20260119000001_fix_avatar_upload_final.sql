-- Fix Avatar Policy (Already Exists Error) and Add Column
DO $$
BEGIN
    -- 1. Ensure avatar_url column exists in athletes table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'athletes' AND column_name = 'avatar_url') THEN
        ALTER TABLE athletes ADD COLUMN avatar_url text;
    END IF;

    -- 2. Drop existing policy if it exists to avoid conflict
    DROP POLICY IF EXISTS "Avatar Full Access" ON storage.objects;
    
    -- 3. Create comprehensive policy
    CREATE POLICY "Avatar Full Access" ON storage.objects
    FOR ALL TO authenticated, anon
    USING (bucket_id = 'avatars')
    WITH CHECK (bucket_id = 'avatars');

    -- 4. Ensure bucket exists
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('avatars', 'avatars', true)
    ON CONFLICT (id) DO UPDATE SET public = true;
END $$;
