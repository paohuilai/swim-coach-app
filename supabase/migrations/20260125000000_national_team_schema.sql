-- National Team Module Schema
-- Created based on user requirements for "National Team Swimming Coach Management System"

-- 1. National Team Athletes Extension
-- Links to existing 'athletes' table but adds national team specific data
CREATE TABLE IF NOT EXISTS national_athletes (
  id uuid PRIMARY KEY REFERENCES athletes(id) ON DELETE CASCADE,
  status text CHECK (status IN ('active', 'injured', 'rehabilitation', 'suspended', 'retired')) DEFAULT 'active',
  level text CHECK (level IN ('national', 'national_youth', 'provincial')),
  main_stroke text,
  height numeric,
  weight numeric,
  wingspan numeric,
  medical_history jsonb DEFAULT '[]'::jsonb, -- Array of injury records
  growth_trajectory jsonb DEFAULT '[]'::jsonb, -- Array of calculated stats snapshots
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Smart Training Plans
-- Advanced version of training plans with drag-drop structure and load monitoring
CREATE TABLE IF NOT EXISTS national_training_plans (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  coach_id text NOT NULL, -- References coaches(id)
  start_date date NOT NULL,
  end_date date NOT NULL,
  cycle_type text CHECK (cycle_type IN ('macro', 'meso', 'micro')),
  modules jsonb DEFAULT '[]'::jsonb, -- Stores the drag-drop modules structure
  total_load numeric DEFAULT 0, -- Calculated TRIMP or other metric
  status text CHECK (status IN ('draft', 'published', 'completed', 'archived')) DEFAULT 'draft',
  feedback jsonb, -- Athlete/Coach feedback
  is_template boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Command Center Tasks (Extended)
-- More complex tasks with dependencies and priorities
CREATE TABLE IF NOT EXISTS national_tasks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  type text CHECK (type IN ('training', 'medical', 'research', 'admin')),
  priority text CHECK (priority IN ('high', 'medium', 'low')) DEFAULT 'medium',
  status text CHECK (status IN ('pending', 'in_progress', 'completed', 'overdue', 'archived')) DEFAULT 'pending',
  creator_id text NOT NULL, -- References coaches(id)
  assignee_id text, -- References coaches(id)
  assignee_role text, -- 'doctor', 'researcher', 'coach'
  deadline timestamptz NOT NULL,
  dependencies uuid[], -- Array of task IDs that must be completed first
  quality_score integer CHECK (quality_score BETWEEN 0 AND 10),
  attachments jsonb DEFAULT '[]'::jsonb, -- URLs to files in storage
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4. War Room (Competition Analysis)
CREATE TABLE IF NOT EXISTS national_war_room_projects (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  competition_name text,
  date date,
  creator_id text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS national_war_room_videos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid REFERENCES national_war_room_projects(id) ON DELETE CASCADE,
  url text NOT NULL,
  type text CHECK (type IN ('self', 'opponent')),
  athlete_name text,
  lane_number integer,
  annotations jsonb DEFAULT '[]'::jsonb, -- Canvas drawings/notes
  sync_offset numeric DEFAULT 0, -- Time offset for sync playback
  created_at timestamptz DEFAULT now()
);

-- 5. Team Collaboration (Knowledge Base)
CREATE TABLE IF NOT EXISTS national_knowledge_base (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  content text,
  tags text[],
  author_id text NOT NULL,
  category text CHECK (category IN ('technique', 'recovery', 'psychology', 'strategy')),
  is_pinned boolean DEFAULT false,
  likes_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- RLS Policies

-- Enable RLS
ALTER TABLE national_athletes ENABLE ROW LEVEL SECURITY;
ALTER TABLE national_training_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE national_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE national_war_room_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE national_war_room_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE national_knowledge_base ENABLE ROW LEVEL SECURITY;

-- Simple "Allow authenticated" policies for MVP (Can be refined to role-based later)
-- In a real national team scenario, we would check for specific roles like 'national_coach'.
-- For now, we assume all authenticated users in this specific environment are trusted or we use the existing 'admin'/'manager' roles.

CREATE POLICY "Allow auth read national_athletes" ON national_athletes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow auth write national_athletes" ON national_athletes FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow auth read national_training_plans" ON national_training_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow auth write national_training_plans" ON national_training_plans FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow auth read national_tasks" ON national_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow auth write national_tasks" ON national_tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow auth read war_room" ON national_war_room_projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow auth write war_room" ON national_war_room_projects FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow auth read war_room_videos" ON national_war_room_videos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow auth write war_room_videos" ON national_war_room_videos FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow auth read knowledge_base" ON national_knowledge_base FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow auth write knowledge_base" ON national_knowledge_base FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Indexes for Performance
CREATE INDEX idx_national_tasks_assignee ON national_tasks(assignee_id);
CREATE INDEX idx_national_tasks_status ON national_tasks(status);
CREATE INDEX idx_national_plans_coach ON national_training_plans(coach_id);
CREATE INDEX idx_knowledge_tags ON national_knowledge_base USING GIN(tags);

-- Function: Auto-update Task Status on Deadline
CREATE OR REPLACE FUNCTION update_overdue_tasks()
RETURNS void AS $$
BEGIN
  UPDATE national_tasks
  SET status = 'overdue'
  WHERE status IN ('pending', 'in_progress') AND deadline < now();
END;
$$ LANGUAGE plpgsql;

-- (Optional) Schedule this function using pg_cron extension if available, or call it via Edge Function periodically.
