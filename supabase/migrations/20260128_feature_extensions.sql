
-- ==============================================================================
-- 20260128_feature_extensions.sql
-- 1. Soft Delete for Performance Entries
-- 2. Manager Supervision Permissions
-- ==============================================================================

-- 1. Add deleted_at to performance_entries for soft delete
ALTER TABLE performance_entries ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Update RLS to hide deleted entries by default for normal queries
-- Note: We might need to drop existing policies if they conflict, but usually we just append a filter in the application. 
-- However, for true soft delete security, we should update the "Select" policy.
-- For now, we will handle filtering in the application to avoid breaking existing queries, 
-- but we ensure the "Delete" action sets this column instead of hard deleting.

-- 2. Grant Managers Access to All Data (Supervision)

-- A. Training Plans
DROP POLICY IF EXISTS "Managers view all plans" ON training_plans;
CREATE POLICY "Managers view all plans" ON training_plans
    FOR SELECT
    TO authenticated
    USING (
        auth.uid() IN (
            SELECT id FROM coaches WHERE role IN ('manager', 'admin')
        )
        OR coach_id = auth.uid()::text -- Keep own access
    );

-- B. Performance Entries
-- Existing policies might be "Coaches view own athletes' performance".
-- We add a policy for managers.
DROP POLICY IF EXISTS "Managers view all performances" ON performance_entries;
CREATE POLICY "Managers view all performances" ON performance_entries
    FOR SELECT
    TO authenticated
    USING (
        auth.uid() IN (
            SELECT id FROM coaches WHERE role IN ('manager', 'admin')
        )
    );

-- C. Task Submissions (for supervision of tasks)
DROP POLICY IF EXISTS "Managers view all submissions" ON task_submissions;
CREATE POLICY "Managers view all submissions" ON task_submissions
    FOR SELECT
    TO authenticated
    USING (
        auth.uid() IN (
            SELECT id FROM coaches WHERE role IN ('manager', 'admin')
        )
        OR coach_id = auth.uid()::text -- Keep own access
    );

-- 3. Fix Task Publish RLS (Refining based on user error)
-- Ensure the Manager can INSERT into task_submissions for ANY coach
DROP POLICY IF EXISTS "Managers insert submissions" ON task_submissions;
CREATE POLICY "Managers insert submissions" ON task_submissions
    FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() IN (
            SELECT id FROM coaches WHERE role IN ('manager', 'admin')
        )
    );

-- 4. Fix Template RLS (Refining based on user error)
-- Ensure 'coach_id' is optional in check if it matches auth.uid
-- or simply trust the backend to validate (since we can't easily check 'coach_id' validity against a table in a CHECK without performance hit)
-- We stick to: You can only insert if coach_id is YOUR id.
-- The error "violates row-level security" implies the frontend sent a coach_id that isn't auth.uid().
-- We will verify frontend. If frontend is fixed, this SQL part is not strictly needed, 
-- but we can add a fallback policy for "System Templates" if we ever need them.

