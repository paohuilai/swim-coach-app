
-- 1. Create tables if not exist
CREATE TABLE IF NOT EXISTS coach_goals (
  id uuid default gen_random_uuid() primary key,
  coach_id text references coaches(id) not null,
  content text not null,
  created_at timestamptz default now(),
  is_active boolean default true,
  birth_year int,
  custom_group_id uuid references coach_custom_groups(id)
);

CREATE TABLE IF NOT EXISTS training_tasks (
  id uuid default gen_random_uuid() primary key,
  coach_id text references coaches(id) not null,
  content text not null,
  deadline date,
  status text default 'pending' check (status in ('pending', 'on_time', 'delayed')),
  created_at timestamptz default now(),
  completed_at timestamptz,
  birth_year int,
  custom_group_id uuid references coach_custom_groups(id)
);

-- 2. Enable RLS
ALTER TABLE coach_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_tasks ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies to avoid "policy already exists" error
DROP POLICY IF EXISTS "Users can manage their own goals" ON coach_goals;
DROP POLICY IF EXISTS "Users can manage their own tasks" ON training_tasks;

-- 4. Re-create policies
CREATE POLICY "Users can manage their own goals" ON coach_goals
  FOR ALL USING (auth.uid()::text = coach_id);

CREATE POLICY "Users can manage their own tasks" ON training_tasks
  FOR ALL USING (auth.uid()::text = coach_id);

-- 5. Grant permissions
GRANT ALL ON coach_goals TO authenticated;
GRANT ALL ON training_tasks TO authenticated;
