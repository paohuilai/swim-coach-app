
-- ==============================================================================
-- 20260203_fix_insights_and_monitor.sql
-- 1. Fix RLS for training_plan_templates (allow insert)
-- 2. Clean up Insights data
-- 3. Fix Monitor Console permissions
-- ==============================================================================

-- 1. Fix RLS for training_plan_templates
-- The previous policy might have been too restrictive if coach_id wasn't exactly auth.uid()::text
-- Let's ensure the policy allows insertion if the coach_id matches the authenticated user.
-- Also ensure the table has the correct columns.

ALTER TABLE training_plan_templates 
ADD COLUMN IF NOT EXISTS likes_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS favorites_count integer DEFAULT 0;

DROP POLICY IF EXISTS "Coaches create own templates" ON training_plan_templates;
CREATE POLICY "Coaches create own templates" ON training_plan_templates
    FOR INSERT
    TO authenticated
    WITH CHECK (coach_id = auth.uid()::text);


-- 2. Cleanup Insights Data (Deep Clean)
-- Delete all insights and related media
TRUNCATE TABLE insights CASCADE;
TRUNCATE TABLE insight_media CASCADE;
TRUNCATE TABLE insight_likes CASCADE;
TRUNCATE TABLE insight_comments CASCADE;

-- Note: Storage files need to be deleted via API or manual script, SQL can't delete storage files directly easily.
-- But we can clear the database references.


-- 3. Fix Monitor Console Permissions (Manager Access)
-- Ensure managers can view all data
-- Check 'coaches' table policies

-- Policy: Managers can view all coaches
DROP POLICY IF EXISTS "Managers view all coaches" ON coaches;
CREATE POLICY "Managers view all coaches" ON coaches
    FOR SELECT
    TO authenticated
    USING (
        -- Allow if user is manager or admin
        EXISTS (
            SELECT 1 FROM coaches c 
            WHERE c.id = auth.uid()::text 
            AND (c.role = 'manager' OR c.role = 'admin')
        )
        OR 
        -- Allow users to view themselves
        id = auth.uid()::text
    );

-- Policy: Managers can view all task submissions
DROP POLICY IF EXISTS "Managers view all submissions" ON task_submissions;
CREATE POLICY "Managers view all submissions" ON task_submissions
    FOR SELECT
    TO authenticated
    USING (
        -- Allow if user is manager or admin
        EXISTS (
            SELECT 1 FROM coaches c 
            WHERE c.id = auth.uid()::text 
            AND (c.role = 'manager' OR c.role = 'admin')
        )
        OR 
        -- Allow coaches to view their own
        coach_id = auth.uid()::text
    );

-- Policy: Managers can view all training plans (for detail view)
DROP POLICY IF EXISTS "Managers view all plans" ON training_plans;
CREATE POLICY "Managers view all plans" ON training_plans
    FOR SELECT
    TO authenticated
    USING (
        -- Allow if user is manager or admin
        EXISTS (
            SELECT 1 FROM coaches c 
            WHERE c.id = auth.uid()::text 
            AND (c.role = 'manager' OR c.role = 'admin')
        )
        OR 
        -- Allow coaches to view their own
        coach_id = auth.uid()::text
    );
