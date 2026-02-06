
-- 1. Training Plan Templates
CREATE TABLE IF NOT EXISTS training_plan_templates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id text NOT NULL, -- Owner
  title text NOT NULL,
  content text,
  target_groups text[], -- Array of strings
  created_at timestamptz DEFAULT now()
);

-- 2. Task Assignment Groups (Saved selections)
CREATE TABLE IF NOT EXISTS task_assignment_templates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  manager_id text NOT NULL, -- Owner
  name text NOT NULL, -- e.g. "Senior Coaches"
  coach_ids text[], -- Array of coach IDs
  created_at timestamptz DEFAULT now()
);

-- Policies
ALTER TABLE training_plan_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow auth all training_plan_templates" ON training_plan_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE task_assignment_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow auth all task_assignment_templates" ON task_assignment_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);
