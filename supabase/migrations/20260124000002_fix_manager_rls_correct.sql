-- 1. Drop ALL existing policies for manager_tasks to ensure a clean slate
DROP POLICY IF EXISTS "Allow managers to insert tasks" ON manager_tasks;
DROP POLICY IF EXISTS "Allow managers to view their tasks" ON manager_tasks;
DROP POLICY IF EXISTS "Allow admins to view all tasks" ON manager_tasks;
DROP POLICY IF EXISTS "Allow admins to manage all tasks" ON manager_tasks;
DROP POLICY IF EXISTS "View Tasks Policy" ON manager_tasks;
DROP POLICY IF EXISTS "Manage Tasks Policy" ON manager_tasks;
DROP POLICY IF EXISTS "Managers can insert tasks for their venue" ON manager_tasks;
DROP POLICY IF EXISTS "Managers can view tasks for their venue" ON manager_tasks;
DROP POLICY IF EXISTS "Admins can view all tasks" ON manager_tasks;
DROP POLICY IF EXISTS "Coaches can view tasks for their venue" ON manager_tasks;

-- 2. Create Insert Policy for Managers
-- Logic: Authenticated user is a manager AND the task venue matches their venue
CREATE POLICY "Managers can insert tasks for their venue" ON manager_tasks
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM coaches
    WHERE id = auth.uid()::text
    AND role = 'manager'
    AND venue = manager_tasks.venue
  )
);

-- 3. Create View Policy for Managers & Coaches
-- Logic: Authenticated user (manager or coach) can view tasks in their venue
CREATE POLICY "Managers and Coaches can view tasks for their venue" ON manager_tasks
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM coaches
    WHERE id = auth.uid()::text
    AND (role = 'manager' OR role = 'coach')
    AND venue = manager_tasks.venue
  )
);

-- 4. Create View Policy for Admins
-- Logic: Admin can view all
CREATE POLICY "Admins can view all tasks" ON manager_tasks
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM coaches
    WHERE id = auth.uid()::text
    AND role = 'admin'
  )
);

-- 5. Create Manage Policy for Admins (Insert/Update/Delete)
CREATE POLICY "Admins can manage all tasks" ON manager_tasks
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM coaches
    WHERE id = auth.uid()::text
    AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM coaches
    WHERE id = auth.uid()::text
    AND role = 'admin'
  )
);
