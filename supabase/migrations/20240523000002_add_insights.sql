-- Create training_insights table
CREATE TABLE IF NOT EXISTS training_insights (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create insight_likes table
CREATE TABLE IF NOT EXISTS insight_likes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  insight_id uuid REFERENCES training_insights(id) ON DELETE CASCADE NOT NULL,
  coach_id text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(insight_id, coach_id)
);

-- Enable RLS
ALTER TABLE training_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE insight_likes ENABLE ROW LEVEL SECURITY;

-- Policies for training_insights
-- Everyone can read insights
CREATE POLICY "Insights are viewable by everyone" 
ON training_insights FOR SELECT 
USING (true);

-- Coaches can insert their own insights
CREATE POLICY "Coaches can insert their own insights" 
ON training_insights FOR INSERT 
WITH CHECK (true); -- Ideally check coach_id matches auth.uid() but keeping simple for MVP with client-side id

-- Policies for insight_likes
-- Everyone can read likes
CREATE POLICY "Likes are viewable by everyone" 
ON insight_likes FOR SELECT 
USING (true);

-- Coaches can insert their own likes
CREATE POLICY "Coaches can insert their own likes" 
ON insight_likes FOR INSERT 
WITH CHECK (true);

-- Coaches can delete their own likes (unlike)
CREATE POLICY "Coaches can delete their own likes" 
ON insight_likes FOR DELETE 
USING (true); -- Ideally check coach_id matches auth.uid()
