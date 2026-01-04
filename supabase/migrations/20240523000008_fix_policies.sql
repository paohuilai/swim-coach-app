-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Coaches can insert their own insight media" ON public.insight_media;
DROP POLICY IF EXISTS "Coaches can delete their own insight media" ON public.insight_media;
DROP POLICY IF EXISTS "Allow authenticated uploads to insights bucket" ON storage.objects;

-- Create permissive policies for insight_media (Relies on frontend for ownership check in MVP)
CREATE POLICY "Enable insert for everyone" ON public.insight_media FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable delete for everyone" ON public.insight_media FOR DELETE USING (true);

-- Create delete policy for training_insights
DROP POLICY IF EXISTS "Coaches can delete their own insights" ON public.training_insights;
CREATE POLICY "Enable delete for everyone" ON public.training_insights FOR DELETE USING (true);

-- Update storage policies
CREATE POLICY "Allow anon uploads to insights bucket" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'insights');
    
-- Ensure update is also allowed if needed (though we only insert/delete)
-- storage.objects update is usually for replacing files
