-- Add new columns to training_logs table if they don't exist
ALTER TABLE training_logs 
ADD COLUMN IF NOT EXISTS test_type TEXT DEFAULT '日常体能测试',
ADD COLUMN IF NOT EXISTS pool_info TEXT,
ADD COLUMN IF NOT EXISTS recorder TEXT,
ADD COLUMN IF NOT EXISTS rpe NUMERIC,
ADD COLUMN IF NOT EXISTS stroke_rate NUMERIC,
ADD COLUMN IF NOT EXISTS stroke_length NUMERIC;

-- Add comment to explain columns
COMMENT ON COLUMN training_logs.test_type IS '测试类型: 日常体能测试/专项技术测试/赛前模拟测试';
COMMENT ON COLUMN training_logs.pool_info IS '泳池信息: 25米池/50米池等';
COMMENT ON COLUMN training_logs.recorder IS '记录员姓名';
COMMENT ON COLUMN training_logs.rpe IS 'RPE 自感疲劳度 (1-10)';
COMMENT ON COLUMN training_logs.stroke_rate IS '划频';
COMMENT ON COLUMN training_logs.stroke_length IS '划幅';

-- Ensure performance_entries has timing_method
ALTER TABLE performance_entries
ADD COLUMN IF NOT EXISTS timing_method TEXT DEFAULT 'electronic'; -- 'electronic' | 'manual'

-- Add audit_logs if not exists (Double check)
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  performed_by TEXT, -- User ID or Name
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy for audit_logs (Allow insert for authenticated, read for admins)
CREATE POLICY "Enable insert for authenticated users" ON audit_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable select for authenticated users" ON audit_logs FOR SELECT TO authenticated USING (true);
