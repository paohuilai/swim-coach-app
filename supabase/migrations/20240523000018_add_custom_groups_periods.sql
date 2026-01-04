-- Create coach_custom_groups table
CREATE TABLE IF NOT EXISTS coach_custom_groups (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    coach_id TEXT NOT NULL,
    name TEXT NOT NULL,
    birth_years INTEGER[] NOT NULL,
    is_pinned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create coach_periods table
CREATE TABLE IF NOT EXISTS coach_periods (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    coach_id TEXT NOT NULL,
    custom_group_id UUID REFERENCES coach_custom_groups(id) ON DELETE CASCADE,
    birth_year INTEGER, -- Used if custom_group_id is NULL (0 for All, or specific year)
    name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_pinned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add custom_group_id to coach_targets
ALTER TABLE coach_targets
ADD COLUMN IF NOT EXISTS custom_group_id UUID REFERENCES coach_custom_groups(id) ON DELETE CASCADE;

-- Add custom_group_id to coach_signins
ALTER TABLE coach_signins
ADD COLUMN IF NOT EXISTS custom_group_id UUID REFERENCES coach_custom_groups(id) ON DELETE CASCADE;

-- Enable RLS
ALTER TABLE coach_custom_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_periods ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Enable all access for anon" ON coach_custom_groups FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for anon" ON coach_periods FOR ALL TO anon USING (true) WITH CHECK (true);

-- Grant permissions
GRANT ALL ON coach_custom_groups TO anon;
GRANT ALL ON coach_periods TO anon;
GRANT ALL ON coach_custom_groups TO authenticated;
GRANT ALL ON coach_periods TO authenticated;
