
-- Add venue column to athletes table
ALTER TABLE athletes ADD COLUMN IF NOT EXISTS venue TEXT;
