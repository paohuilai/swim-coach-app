
-- Drop the old table if it exists
DROP TABLE IF EXISTS athlete_status;

-- Add new columns to training_logs
ALTER TABLE training_logs ADD COLUMN IF NOT EXISTS status_score INTEGER CHECK (status_score >= 0 AND status_score <= 100);
ALTER TABLE training_logs ADD COLUMN IF NOT EXISTS status_note TEXT;
