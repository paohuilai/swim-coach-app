-- Drop old table if exists
DROP TABLE IF EXISTS competition_scores;

-- Create competitions table
CREATE TABLE IF NOT EXISTS competitions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  date date NOT NULL,
  created_by text REFERENCES coaches(id),
  created_at timestamptz DEFAULT now()
);

-- Create competition_results table
CREATE TABLE IF NOT EXISTS competition_results (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  competition_id uuid REFERENCES competitions(id) ON DELETE CASCADE,
  athlete_name text NOT NULL,
  age_group text NOT NULL,
  event text NOT NULL,
  score text NOT NULL,
  rank integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE competition_results ENABLE ROW LEVEL SECURITY;

-- Policies for competitions
CREATE POLICY "Allow public read access" ON competitions FOR SELECT USING (true);
CREATE POLICY "Allow admin all" ON competitions FOR ALL USING (
  EXISTS (SELECT 1 FROM coaches WHERE id = auth.uid()::text AND role = 'admin')
);

-- Policies for competition_results
CREATE POLICY "Allow public read access" ON competition_results FOR SELECT USING (true);
CREATE POLICY "Allow admin all" ON competition_results FOR ALL USING (
  EXISTS (SELECT 1 FROM coaches WHERE id = auth.uid()::text AND role = 'admin')
);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON competitions TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON competition_results TO anon, authenticated;
