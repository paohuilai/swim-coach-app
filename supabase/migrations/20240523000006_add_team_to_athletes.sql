
-- Add team column to athletes table
ALTER TABLE athletes ADD COLUMN IF NOT EXISTS team TEXT;
