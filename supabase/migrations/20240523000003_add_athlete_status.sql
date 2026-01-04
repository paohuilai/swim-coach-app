
-- Create athlete_status table
CREATE TABLE IF NOT EXISTS athlete_status (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  athlete_id UUID REFERENCES athletes(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS
ALTER TABLE athlete_status ENABLE ROW LEVEL SECURITY;

-- Create policies for athlete_status
-- Coaches can view status of their own athletes (via athlete -> coach_id relationship)
CREATE POLICY "Coaches can view status of their own athletes" ON athlete_status
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM athletes
      WHERE athletes.id = athlete_status.athlete_id
      AND athletes.coach_id = auth.uid()
    )
  );

-- Coaches can insert status for their own athletes
CREATE POLICY "Coaches can insert status for their own athletes" ON athlete_status
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM athletes
      WHERE athletes.id = athlete_status.athlete_id
      AND athletes.coach_id = auth.uid()
    )
  );

-- Coaches can update status for their own athletes
CREATE POLICY "Coaches can update status for their own athletes" ON athlete_status
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM athletes
      WHERE athletes.id = athlete_status.athlete_id
      AND athletes.coach_id = auth.uid()
    )
  );

-- Coaches can delete status for their own athletes
CREATE POLICY "Coaches can delete status for their own athletes" ON athlete_status
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM athletes
      WHERE athletes.id = athlete_status.athlete_id
      AND athletes.coach_id = auth.uid()
    )
  );
