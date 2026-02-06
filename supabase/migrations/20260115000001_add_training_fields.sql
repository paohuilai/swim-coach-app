-- Add new fields to training_logs
ALTER TABLE training_logs 
ADD COLUMN IF NOT EXISTS test_type text DEFAULT '日常体能测试',
ADD COLUMN IF NOT EXISTS pool_info text,
ADD COLUMN IF NOT EXISTS recorder text,
ADD COLUMN IF NOT EXISTS rpe integer,
ADD COLUMN IF NOT EXISTS stroke_rate integer,
ADD COLUMN IF NOT EXISTS stroke_length float;

-- Add new fields to performance_entries
ALTER TABLE performance_entries
ADD COLUMN IF NOT EXISTS timing_method text DEFAULT 'electronic',
ADD COLUMN IF NOT EXISTS split_times jsonb,
ADD COLUMN IF NOT EXISTS reaction_time float;
