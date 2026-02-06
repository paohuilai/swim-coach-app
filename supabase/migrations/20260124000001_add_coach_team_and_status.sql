-- Add team column to coaches
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS team TEXT;

-- Add custom_status to athlete_status_history
ALTER TABLE athlete_status_history ADD COLUMN IF NOT EXISTS custom_status TEXT;

-- Update status check constraint if exists (Postgres enums or check constraints)
-- If it's a check constraint:
ALTER TABLE athlete_status_history DROP CONSTRAINT IF EXISTS athlete_status_history_status_check;
ALTER TABLE athlete_status_history ADD CONSTRAINT athlete_status_history_status_check 
  CHECK (status IN ('training', 'paused', 'trial', 'transferred', 'other'));
