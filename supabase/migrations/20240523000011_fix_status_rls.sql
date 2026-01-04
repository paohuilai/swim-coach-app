-- Drop old policy if exists
DROP POLICY IF EXISTS "Users can manage their athletes' status history" ON athlete_status_history;

-- Create new policy
CREATE POLICY "Users can manage their athletes' status history" ON athlete_status_history
  FOR ALL USING (coach_id = auth.uid()::text);
