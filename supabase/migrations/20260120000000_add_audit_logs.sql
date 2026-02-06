-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    user_id TEXT NOT NULL, -- Clerk User ID or Coach ID
    action TEXT NOT NULL, -- e.g. 'create_athlete', 'delete_athlete', 'update_performance'
    target_type TEXT NOT NULL, -- e.g. 'athlete', 'training_log'
    target_id UUID, -- The ID of the object being acted upon
    details JSONB, -- Store old/new values or other metadata
    venue TEXT -- Optional: for filtering logs by venue
);

-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Policies
-- Admins/Managers can view logs for their venue (or all for Admin)
CREATE POLICY "Managers can view logs for their venue"
    ON audit_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM coaches
            WHERE coaches.id = auth.uid()
            AND (
                coaches.role = 'admin' 
                OR (coaches.role = 'manager' AND coaches.venue = audit_logs.venue)
            )
        )
    );

-- Coaches can insert logs (for their own actions)
CREATE POLICY "Coaches can insert audit logs"
    ON audit_logs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_venue ON audit_logs(venue);
