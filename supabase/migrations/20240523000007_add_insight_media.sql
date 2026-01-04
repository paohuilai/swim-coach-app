-- Create insight_media table
CREATE TABLE IF NOT EXISTS public.insight_media (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    insight_id uuid REFERENCES public.training_insights(id) ON DELETE CASCADE,
    type text NOT NULL CHECK (type IN ('image', 'video')),
    url text NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.insight_media ENABLE ROW LEVEL SECURITY;

-- Policies for insight_media
CREATE POLICY "Everyone can view insight media" ON public.insight_media
    FOR SELECT USING (true);

CREATE POLICY "Coaches can insert their own insight media" ON public.insight_media
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.training_insights
            WHERE id = insight_media.insight_id
            AND coach_id = current_setting('request.jwt.claims', true)::json->>'sub'
        )
    );

CREATE POLICY "Coaches can delete their own insight media" ON public.insight_media
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.training_insights
            WHERE id = insight_media.insight_id
            AND coach_id = current_setting('request.jwt.claims', true)::json->>'sub'
        )
    );

-- Create a storage bucket for insights if it doesn't exist
-- Note: This requires privileges. If it fails, the user might need to create it manually.
INSERT INTO storage.buckets (id, name, public)
VALUES ('insights', 'insights', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Give public access to insights bucket" ON storage.objects
    FOR SELECT USING (bucket_id = 'insights');

CREATE POLICY "Allow authenticated uploads to insights bucket" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'insights' 
        AND auth.role() = 'authenticated'
    );
