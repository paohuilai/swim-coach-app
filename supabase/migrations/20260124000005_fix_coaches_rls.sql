-- Enable authenticated users to manage coaches (Fixes Admin update issue)
-- Previously only 'anon' had write access, preventing logged-in Admins from updating coach details (like venue)

CREATE POLICY "Allow authenticated insert" ON coaches
FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated update" ON coaches
FOR UPDATE TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow authenticated delete" ON coaches
FOR DELETE TO authenticated
USING (true);
