-- Create coach_targets table
CREATE TABLE IF NOT EXISTS coach_targets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    coach_id TEXT NOT NULL,
    birth_year INTEGER NOT NULL, -- 0 for "All" or specific year
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    target_sessions INTEGER DEFAULT 0,
    target_km DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create coach_signins table
CREATE TABLE IF NOT EXISTS coach_signins (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    coach_id TEXT NOT NULL,
    birth_year INTEGER NOT NULL, -- 0 for "All" or specific year
    signin_date DATE DEFAULT CURRENT_DATE,
    sessions INTEGER DEFAULT 1,
    km DECIMAL(10, 2) DEFAULT 0,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE coach_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_signins ENABLE ROW LEVEL SECURITY;

-- Drop potential conflicting policies if re-running
DROP POLICY IF EXISTS "Enable all access for anon" ON coach_targets;
DROP POLICY IF EXISTS "Enable all access for anon" ON coach_signins;

-- Create permissive policies for anon (matching existing project pattern)
CREATE POLICY "Enable all access for anon" ON coach_targets FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for anon" ON coach_signins FOR ALL TO anon USING (true) WITH CHECK (true);

-- Grant permissions
GRANT ALL ON coach_targets TO authenticated;
GRANT ALL ON coach_signins TO authenticated;
GRANT ALL ON coach_targets TO anon;
GRANT ALL ON coach_signins TO anon;
