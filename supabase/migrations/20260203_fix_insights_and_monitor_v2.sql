
-- ==============================================================================
-- 20260203_fix_insights_and_monitor_v2.sql
-- 1. Fix RLS for training_plan_templates (allow insert)
-- 2. Clean up Insights data (Safe Truncate)
-- 3. Fix Monitor Console permissions
-- ==============================================================================

-- 1. Fix RLS for training_plan_templates
-- Ensure table exists and has columns before modifying policies
DO $$
BEGIN
    -- Check if table exists
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'training_plan_templates') THEN
        -- Add columns if missing
        ALTER TABLE training_plan_templates ADD COLUMN IF NOT EXISTS likes_count integer DEFAULT 0;
        ALTER TABLE training_plan_templates ADD COLUMN IF NOT EXISTS favorites_count integer DEFAULT 0;
        
        -- Update Policy
        DROP POLICY IF EXISTS "Coaches create own templates" ON training_plan_templates;
        CREATE POLICY "Coaches create own templates" ON training_plan_templates
            FOR INSERT
            TO authenticated
            WITH CHECK (coach_id = auth.uid()::text);
    END IF;
END $$;


-- 2. Cleanup Insights Data (Deep Clean with Safe Checks)
-- Use dynamic SQL or checks to avoid "relation does not exist" errors
DO $$
BEGIN
    -- Truncate insights/training_insights if exists
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'insights') THEN
        TRUNCATE TABLE insights CASCADE;
    ELSIF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'training_insights') THEN
        TRUNCATE TABLE training_insights CASCADE;
    END IF;

    -- Truncate related media tables if they exist
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'insight_media') THEN
        TRUNCATE TABLE insight_media CASCADE;
    END IF;
    
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'insight_likes') THEN
        TRUNCATE TABLE insight_likes CASCADE;
    END IF;
    
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'insight_comments') THEN
        TRUNCATE TABLE insight_comments CASCADE;
    END IF;
END $$;


-- 3. Fix Monitor Console Permissions (Manager Access)
-- Ensure managers can view all data

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
