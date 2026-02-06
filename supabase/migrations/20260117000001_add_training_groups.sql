-- Create training_groups table for custom age groups
CREATE TABLE IF NOT EXISTS training_groups (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id text NOT NULL, -- references coaches(id) or just auth.uid()
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(coach_id, name)
);

-- Enable RLS
ALTER TABLE training_groups ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Allow coach all on groups" ON training_groups;

CREATE POLICY "Allow coach all on groups" ON training_groups
FOR ALL
USING (auth.uid()::text = coach_id OR auth.role() = 'anon')
WITH CHECK (auth.uid()::text = coach_id OR auth.role() = 'anon');

-- Add index
CREATE INDEX IF NOT EXISTS idx_training_groups_coach ON training_groups(coach_id);

-- Backfill default groups if needed (optional, handled by frontend usually)
