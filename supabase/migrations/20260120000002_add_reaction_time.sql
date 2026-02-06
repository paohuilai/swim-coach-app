-- Add reaction_time column to performance_entries
ALTER TABLE performance_entries 
ADD COLUMN IF NOT EXISTS reaction_time NUMERIC;

COMMENT ON COLUMN performance_entries.reaction_time IS '出发反应时 (秒)';
