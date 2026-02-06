
-- ==============================================================================
-- 20260128_clean_feature_extensions.sql
-- 1. Soft Delete Support
-- 2. Manager Supervision Permissions (Fixed UUID casting issues)
-- ==============================================================================

-- 1. Add deleted_at to performance_entries for soft delete
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'performance_entries' AND column_name = 'deleted_at') THEN
        ALTER TABLE performance_entries ADD COLUMN deleted_at timestamptz;
    END IF;
END $$;

-- 2. Grant Managers Access to All Data (Supervision)
-- We use auth.uid()::text to ensure compatibility with the text-based 'id' column in 'coaches' table.

-- A. Training Plans: Managers view all; Coaches view own.
DROP POLICY IF EXISTS "Managers view all plans" ON training_plans;
CREATE POLICY "Managers view all plans" ON training_plans
    FOR SELECT
    TO authenticated
    USING (
        auth.uid()::text IN (
            SELECT id FROM coaches WHERE role IN ('manager', 'admin')
        )
        OR coach_id = auth.uid()::text
    );

-- B. Performance Entries: Managers view all.
DROP POLICY IF EXISTS "Managers view all performances" ON performance_entries;
CREATE POLICY "Managers view all performances" ON performance_entries
    FOR SELECT
    TO authenticated
    USING (
        auth.uid()::text IN (
            SELECT id FROM coaches WHERE role IN ('manager', 'admin')
        )
    );

-- C. Task Submissions: Managers view all; Coaches view own.
DROP POLICY IF EXISTS "Managers view all submissions" ON task_submissions;
CREATE POLICY "Managers view all submissions" ON task_submissions
    FOR SELECT
    TO authenticated
    USING (
        auth.uid()::text IN (
            SELECT id FROM coaches WHERE role IN ('manager', 'admin')
        )
        OR coach_id = auth.uid()::text
    );

-- 3. Fix Task Publish RLS
-- Allow Managers to INSERT task submissions for other coaches.
DROP POLICY IF EXISTS "Managers insert submissions" ON task_submissions;
CREATE POLICY "Managers insert submissions" ON task_submissions
    FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid()::text IN (
            SELECT id FROM coaches WHERE role IN ('manager', 'admin')
        )
    );
