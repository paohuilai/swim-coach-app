CREATE TABLE athlete_status_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  athlete_id uuid REFERENCES athletes(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL CHECK (status IN ('training', 'paused', 'trial', 'transferred')),
  start_date date NOT NULL,
  end_date date,
  destination text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE athlete_status_history ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users
CREATE POLICY "Users can manage their athletes' status history" ON athlete_status_history
  FOR ALL USING (
    auth.uid()::text IN (
      SELECT coach_id FROM athletes WHERE id = athlete_status_history.athlete_id
    )
  );

-- Migrate existing data
INSERT INTO athlete_status_history (athlete_id, status, start_date, end_date, destination)
SELECT id, status, status_start_date, status_end_date, transfer_destination
FROM athletes;

-- Drop old columns
ALTER TABLE athletes DROP COLUMN status;
ALTER TABLE athletes DROP COLUMN status_start_date;
ALTER TABLE athletes DROP COLUMN status_end_date;
ALTER TABLE athletes DROP COLUMN transfer_destination;
ALTER TABLE athletes DROP COLUMN cumulative_training_days;
