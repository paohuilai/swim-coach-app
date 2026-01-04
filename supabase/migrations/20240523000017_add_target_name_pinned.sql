-- Add name and is_pinned columns to coach_targets
ALTER TABLE coach_targets
ADD COLUMN IF NOT EXISTS name TEXT,
ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;

-- Update RLS if needed (existing policies should cover new columns since they are on the table)
-- But ensuring the schema cache updates is good.
