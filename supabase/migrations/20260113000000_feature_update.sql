-- Add role and venue to coaches
ALTER TABLE coaches 
ADD COLUMN IF NOT EXISTS role text DEFAULT 'coach' CHECK (role IN ('admin', 'manager', 'coach')),
ADD COLUMN IF NOT EXISTS venue text,
ADD COLUMN IF NOT EXISTS managed_venue text;

-- Create training_plans table
CREATE TABLE IF NOT EXISTS training_plans (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id text NOT NULL REFERENCES coaches(id),
  date date NOT NULL,
  title text,
  content text,
  media_urls jsonb DEFAULT '[]'::jsonb, -- Array of {type: 'image'|'video', url: string}
  target_groups jsonb DEFAULT '[]'::jsonb, -- Array of target identifiers (e.g., "2020", "group_id")
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS for training_plans
ALTER TABLE training_plans ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to ensure idempotency
DROP POLICY IF EXISTS "Allow public read access" ON training_plans;
DROP POLICY IF EXISTS "Allow coach insert own plans" ON training_plans;
DROP POLICY IF EXISTS "Allow coach update own plans" ON training_plans;
DROP POLICY IF EXISTS "Allow coach delete own plans" ON training_plans;

-- Create policies
CREATE POLICY "Allow public read access" ON training_plans FOR SELECT USING (true);
CREATE POLICY "Allow coach insert own plans" ON training_plans FOR INSERT WITH CHECK (auth.uid()::text = coach_id);
CREATE POLICY "Allow coach update own plans" ON training_plans FOR UPDATE USING (auth.uid()::text = coach_id);
CREATE POLICY "Allow coach delete own plans" ON training_plans FOR DELETE USING (auth.uid()::text = coach_id);

-- Grant permissions (safe to re-run)
GRANT SELECT, INSERT, UPDATE, DELETE ON training_plans TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON training_plans TO authenticated;

-- Create competition_scores table (Module 3)
CREATE TABLE IF NOT EXISTS competition_scores (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  date date NOT NULL,
  scores jsonb NOT NULL, -- Flexible JSON structure for scores
  created_by text REFERENCES coaches(id), -- Should be admin
  created_at timestamptz DEFAULT now()
);

-- Enable RLS for competition_scores
ALTER TABLE competition_scores ENABLE ROW LEVEL SECURITY;

-- Drop existing policies for competition_scores
DROP POLICY IF EXISTS "Allow public read access" ON competition_scores;
DROP POLICY IF EXISTS "Allow admin all" ON competition_scores;

-- Create policies for competition_scores
CREATE POLICY "Allow public read access" ON competition_scores FOR SELECT USING (true);
CREATE POLICY "Allow admin all" ON competition_scores FOR ALL USING (
  EXISTS (SELECT 1 FROM coaches WHERE id = auth.uid()::text AND role = 'admin')
);

GRANT SELECT, INSERT, UPDATE, DELETE ON competition_scores TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON competition_scores TO authenticated;
