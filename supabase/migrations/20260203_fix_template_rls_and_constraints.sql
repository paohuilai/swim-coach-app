-- Fix RLS policy for training_plan_templates to allow all authenticated users to insert
-- User requirement: Create new INSERT policy, allow all authenticated users to write data. Use WITH CHECK (true).

-- 1. Drop existing restrictive INSERT policy
DROP POLICY IF EXISTS "Coaches create own templates" ON training_plan_templates;

-- 2. Create permissive INSERT policy
CREATE POLICY "allow_all_insert" ON training_plan_templates
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- 3. Ensure SELECT policy exists (as requested to keep it)
-- (Already exists as "Public view all templates" in previous migrations, but good to be safe)
DROP POLICY IF EXISTS "Public view all templates" ON training_plan_templates;
CREATE POLICY "Public view all templates" ON training_plan_templates
    FOR SELECT
    TO authenticated
    USING (true);

-- 4. Ensure UPDATE/DELETE are still restricted to owner
DROP POLICY IF EXISTS "Coaches manage own templates" ON training_plan_templates;
CREATE POLICY "Coaches manage own templates" ON training_plan_templates
    FOR UPDATE
    TO authenticated
    USING (coach_id = auth.uid()::text);

DROP POLICY IF EXISTS "Coaches delete own templates" ON training_plan_templates;
CREATE POLICY "Coaches delete own templates" ON training_plan_templates
    FOR DELETE
    TO authenticated
    USING (coach_id = auth.uid()::text);

-- 5. Add NOT NULL constraint to age_group if not exists (as per requirement "Database: age_group field set NOT NULL constraint")
-- We first update any nulls to a default to avoid error
UPDATE training_plan_templates SET age_group = '2018组' WHERE age_group IS NULL;
ALTER TABLE training_plan_templates ALTER COLUMN age_group SET NOT NULL;
