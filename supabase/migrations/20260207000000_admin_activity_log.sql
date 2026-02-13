-- Admin Activity Log table
CREATE TABLE IF NOT EXISTS admin_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_email TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL, -- 'program', 'subscription', 'user', etc.
  entity_id UUID,
  entity_name TEXT,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for filtering by admin
CREATE INDEX idx_admin_activity_admin_email ON admin_activity_log(admin_email);

-- Index for filtering by action
CREATE INDEX idx_admin_activity_action ON admin_activity_log(action);

-- Index for filtering by entity type
CREATE INDEX idx_admin_activity_entity_type ON admin_activity_log(entity_type);

-- Index for date range queries
CREATE INDEX idx_admin_activity_created_at ON admin_activity_log(created_at DESC);

-- Enable RLS
ALTER TABLE admin_activity_log ENABLE ROW LEVEL SECURITY;

-- Only allow service role to insert (via API routes)
CREATE POLICY "Service role can insert activity logs"
  ON admin_activity_log FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Allow authenticated admins to read (will verify admin status in API)
CREATE POLICY "Authenticated users can read activity logs"
  ON admin_activity_log FOR SELECT
  TO authenticated
  USING (true);

-- Grant permissions
GRANT SELECT ON admin_activity_log TO authenticated;
GRANT INSERT ON admin_activity_log TO service_role;
