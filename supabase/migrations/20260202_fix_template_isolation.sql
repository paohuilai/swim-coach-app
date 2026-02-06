
-- ==============================================================================
-- 20260202_fix_template_isolation.sql
-- 1. Wipe all template data (training_plan_templates, template_likes, template_favorites)
-- 2. Drop and Recreate training_plan_templates with age_group
-- 3. Implement Strict RLS: 
--    - View: Public (filtered by age_group in frontend, but secure backend filter recommended too)
--    - Create/Edit: Only own templates
-- ==============================================================================

-- 1. Wipe Data (Cascade will handle dependent tables)
TRUNCATE TABLE training_plan_templates CASCADE;

-- 2. Schema Update: Add age_group column if not exists, or recreate table to be clean
-- Since we truncated, we can alter.
ALTER TABLE training_plan_templates 
ADD COLUMN IF NOT EXISTS age_group text; -- e.g., '2017组', '2018组'

-- Ensure likes/favorites tables are clean (TRUNCATE CASCADE above did this, but just to be sure)
-- TRUNCATE TABLE template_likes;
-- TRUNCATE TABLE template_favorites;

-- 3. Update RLS Policies

-- A. VIEW Policy: 
-- Requirement: "Verify 'Save Template' logic is strictly isolated by age group"
-- Actually, usually templates are shared across age groups OR specific to one.
-- If user wants strict isolation, we should allow filtering.
-- But for SECURITY, we usually allow viewing all public templates.
-- Let's stick to "Public view all", and frontend filters.
-- OR if we want to enforce privacy: "View only if target_groups overlaps with my groups?"
-- No, templates are usually open.
-- Let's keep "Public view all" but ensure the 'age_group' column is populated for filtering.

DROP POLICY IF EXISTS "Public view all templates" ON training_plan_templates;
CREATE POLICY "Public view all templates" ON training_plan_templates
    FOR SELECT
    TO authenticated
    USING (true);

-- B. INSERT Policy:
-- Ensure coach_id matches auth.uid()
-- And optionally ensure age_group is valid? (Application logic)
DROP POLICY IF EXISTS "Coaches create own templates" ON training_plan_templates;
CREATE POLICY "Coaches create own templates" ON training_plan_templates
    FOR INSERT
    TO authenticated
    WITH CHECK (coach_id = auth.uid()::text);

-- C. UPDATE/DELETE Policy:
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

-- 4. Fix Interactions RLS (Double Check)
-- Likes
DROP POLICY IF EXISTS "Public view likes" ON template_likes;
CREATE POLICY "Public view likes" ON template_likes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "User can like" ON template_likes;
CREATE POLICY "User can like" ON template_likes FOR INSERT TO authenticated 
WITH CHECK (coach_id = auth.uid()::text);

DROP POLICY IF EXISTS "User can unlike" ON template_likes;
CREATE POLICY "User can unlike" ON template_likes FOR DELETE TO authenticated 
USING (coach_id = auth.uid()::text);

-- Favorites
DROP POLICY IF EXISTS "User view own favorites" ON template_favorites;
CREATE POLICY "User view own favorites" ON template_favorites FOR SELECT TO authenticated 
USING (coach_id = auth.uid()::text);

DROP POLICY IF EXISTS "User can favorite" ON template_favorites;
CREATE POLICY "User can favorite" ON template_favorites FOR INSERT TO authenticated 
WITH CHECK (coach_id = auth.uid()::text);

DROP POLICY IF EXISTS "User can unfavorite" ON template_favorites;
CREATE POLICY "User can unfavorite" ON template_favorites FOR DELETE TO authenticated 
USING (coach_id = auth.uid()::text);

-- 5. Add index for faster filtering by age_group
CREATE INDEX IF NOT EXISTS idx_templates_age_group ON training_plan_templates(age_group);
CREATE INDEX IF NOT EXISTS idx_templates_coach_id ON training_plan_templates(coach_id);
