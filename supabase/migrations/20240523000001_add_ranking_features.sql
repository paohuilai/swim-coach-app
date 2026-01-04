-- Add is_public column to athletes
ALTER TABLE athletes ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;

-- Allow public read access to athletes who opted in
CREATE POLICY "Public athletes are viewable by everyone" 
ON athletes FOR SELECT 
USING (is_public = true);

-- Allow public read access to training_logs of public athletes
CREATE POLICY "Public training_logs are viewable by everyone" 
ON training_logs FOR SELECT 
USING (
  exists (
    select 1 from athletes 
    where athletes.id = training_logs.athlete_id 
    and athletes.is_public = true
  )
);

-- Allow public read access to performance_entries of public athletes
CREATE POLICY "Public performance_entries are viewable by everyone" 
ON performance_entries FOR SELECT 
USING (
  exists (
    select 1 from training_logs 
    join athletes on athletes.id = training_logs.athlete_id
    where training_logs.id = performance_entries.log_id 
    and athletes.is_public = true
  )
);
