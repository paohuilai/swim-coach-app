-- Manager Task System Tables

-- 1. Manager Tasks Table
-- Published by Managers/Admins, targeted at their venue
CREATE TABLE IF NOT EXISTS manager_tasks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  type text NOT NULL CHECK (type IN ('plan_upload', 'score_record')),
  title text NOT NULL,
  description text,
  deadline timestamptz NOT NULL,
  venue text NOT NULL, -- Target venue (coaches in this venue receive task)
  created_by text NOT NULL, -- References coaches(id)
  created_at timestamptz DEFAULT now()
);

-- 2. Task Submissions Table
-- Tracks individual coach status for each task
CREATE TABLE IF NOT EXISTS task_submissions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES manager_tasks(id) ON DELETE CASCADE,
  coach_id text NOT NULL, -- References coaches(id)
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  submission_id uuid, -- Reference to the created training_plan or training_log entry (optional link)
  submitted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(task_id, coach_id) -- One submission per task per coach
);

-- RLS Policies

-- Enable RLS
ALTER TABLE manager_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_submissions ENABLE ROW LEVEL SECURITY;

-- Policies for manager_tasks

-- 1. View:
-- Admins: View all
-- Managers: View tasks for their managed venue (or created by them)
-- Coaches: View tasks for their venue
CREATE POLICY "View Tasks Policy" ON manager_tasks
FOR SELECT USING (
  -- Admin
  (EXISTS (SELECT 1 FROM coaches WHERE id = auth.uid()::text AND role = 'admin')) OR
  -- Manager (View own creations or tasks in their managed venue)
  (created_by = auth.uid()::text) OR
  -- Coach/Manager (View tasks assigned to their venue)
  (venue = (SELECT venue FROM coaches WHERE id = auth.uid()::text))
);

-- 2. Insert/Update/Delete:
-- Admins: All
-- Managers: Only for their own tasks (and matching their managed venue ideally)
CREATE POLICY "Manage Tasks Policy" ON manager_tasks
FOR ALL USING (
  (EXISTS (SELECT 1 FROM coaches WHERE id = auth.uid()::text AND role = 'admin')) OR
  (
    EXISTS (SELECT 1 FROM coaches WHERE id = auth.uid()::text AND role = 'manager') AND
    (created_by = auth.uid()::text OR created_by IS NULL) -- Allow insert (created_by check is for update/delete)
  )
) WITH CHECK (
  (EXISTS (SELECT 1 FROM coaches WHERE id = auth.uid()::text AND role = 'admin')) OR
  (
    EXISTS (SELECT 1 FROM coaches WHERE id = auth.uid()::text AND role = 'manager') AND
    created_by = auth.uid()::text
  )
);


-- Policies for task_submissions

-- 1. View:
-- Admins: All
-- Managers: Submissions for tasks they created (or in their venue)
-- Coaches: Their own submissions
CREATE POLICY "View Submissions Policy" ON task_submissions
FOR SELECT USING (
  -- Admin
  (EXISTS (SELECT 1 FROM coaches WHERE id = auth.uid()::text AND role = 'admin')) OR
  -- Manager (View submissions for tasks they created)
  (EXISTS (SELECT 1 FROM manager_tasks WHERE id = task_submissions.task_id AND created_by = auth.uid()::text)) OR
  -- Coach (View own)
  (coach_id = auth.uid()::text)
);

-- 2. Update (Submit):
-- Coaches can update their own submission status
CREATE POLICY "Coach Submit Policy" ON task_submissions
FOR UPDATE USING (
  coach_id = auth.uid()::text
) WITH CHECK (
  coach_id = auth.uid()::text
);

-- 3. Insert:
-- System/Trigger usually creates these, or Manager creates them when publishing?
-- Let's allow Managers to create them for all coaches in venue, or a trigger.
-- For simplicity, let's assume the Frontend creates them or we use a Trigger.
-- A trigger is better to ensure all coaches get it.

-- Trigger to auto-assign tasks to coaches in the venue
CREATE OR REPLACE FUNCTION assign_task_to_coaches()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO task_submissions (task_id, coach_id, status)
  SELECT NEW.id, id, 'pending'
  FROM coaches
  WHERE venue = NEW.venue AND (role = 'coach' OR role = 'manager'); -- Assign to coaches and managers? Usually just coaches. Let's say coaches.
  -- User req: "接收者自动限定为该场馆下所有在职教练" (All working coaches in venue)
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_assign_task
AFTER INSERT ON manager_tasks
FOR EACH ROW
EXECUTE FUNCTION assign_task_to_coaches();

-- Add Indexes
CREATE INDEX idx_manager_tasks_venue ON manager_tasks(venue);
CREATE INDEX idx_task_submissions_task_id ON task_submissions(task_id);
CREATE INDEX idx_task_submissions_coach_id ON task_submissions(coach_id);
