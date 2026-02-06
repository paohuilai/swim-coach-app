-- Enable authenticated users to select coaches
-- This ensures that the coach list is visible to authenticated users (Managers, Admins)

CREATE POLICY "Allow authenticated select" ON coaches
FOR SELECT TO authenticated
USING (true);
