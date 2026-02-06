-- Fix RLS policies for manager_tasks

-- Drop existing policies to avoid conflicts (if any)
DROP POLICY IF EXISTS "Allow managers to insert tasks" ON manager_tasks;
DROP POLICY IF EXISTS "Allow managers to view their tasks" ON manager_tasks;
DROP POLICY IF EXISTS "Allow admins to view all tasks" ON manager_tasks;

-- 1. Allow managers to insert tasks for their own venue
CREATE POLICY "Allow managers to insert tasks" ON manager_tasks 
FOR INSERT TO authenticated 
WITH CHECK ( 
  auth.jwt() ->> 'role' = 'manager' 
  AND venue_id = (SELECT venue_id FROM coaches WHERE id = auth.uid()) 
); 

-- 2. Allow managers to view tasks for their own venue
CREATE POLICY "Allow managers to view their tasks" ON manager_tasks 
FOR SELECT TO authenticated 
USING ( 
  (auth.jwt() ->> 'role' = 'manager' AND venue_id = (SELECT venue_id FROM coaches WHERE id = auth.uid()))
  OR
  (auth.jwt() ->> 'role' = 'coach' AND venue_id = (SELECT venue_id FROM coaches WHERE id = auth.uid()))
); 

-- 3. Allow admins to view all tasks
CREATE POLICY "Allow admins to view all tasks" ON manager_tasks 
FOR SELECT TO authenticated 
USING (auth.jwt() ->> 'role' = 'admin');

-- 4. Allow admins to insert/update/delete any task
CREATE POLICY "Allow admins to manage all tasks" ON manager_tasks
FOR ALL TO authenticated
USING (auth.jwt() ->> 'role' = 'admin')
WITH CHECK (auth.jwt() ->> 'role' = 'admin');
