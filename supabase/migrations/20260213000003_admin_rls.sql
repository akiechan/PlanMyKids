-- ============================================================
-- Admin RLS Policies for PlanMyKids
-- Adds is_admin() function and admin-override policies
-- ============================================================

-- Helper function: checks JWT app_metadata for admin role
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true)::jsonb
      -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$;

-- ============================================================
-- Programs table (RLS not yet enabled)
-- ============================================================
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active programs" ON programs
  FOR SELECT USING (status = 'active');

CREATE POLICY "Admins have full access to programs" ON programs
  FOR ALL USING (is_admin());

-- ============================================================
-- Program locations table (RLS not yet enabled)
-- ============================================================
ALTER TABLE program_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read program locations" ON program_locations
  FOR SELECT USING (true);

CREATE POLICY "Admins have full access to program_locations" ON program_locations
  FOR ALL USING (is_admin());

-- ============================================================
-- Featured subscriptions table (RLS not yet enabled)
-- ============================================================
ALTER TABLE featured_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own featured subscriptions" ON featured_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own featured subscriptions" ON featured_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins have full access to featured_subscriptions" ON featured_subscriptions
  FOR ALL USING (is_admin());

-- ============================================================
-- Admin activity log table (RLS not yet enabled)
-- ============================================================
ALTER TABLE admin_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins have full access to admin_activity_log" ON admin_activity_log
  FOR ALL USING (is_admin());

-- ============================================================
-- Planner tables — admin-override policies only
-- (RLS + user policies already exist from 20260213000001)
-- ============================================================

CREATE POLICY "Admins manage all kids" ON planner_kids
  FOR ALL USING (is_admin());

CREATE POLICY "Admins manage all adults" ON planner_adults
  FOR ALL USING (is_admin());

CREATE POLICY "Admins manage all saved programs" ON planner_saved_programs
  FOR ALL USING (is_admin());

CREATE POLICY "Admins manage all todos" ON planner_todos
  FOR ALL USING (is_admin());

CREATE POLICY "Admins manage all reminders" ON planner_reminders
  FOR ALL USING (is_admin());

CREATE POLICY "Admins manage all preferences" ON planner_user_preferences
  FOR ALL USING (is_admin());

CREATE POLICY "Admins manage all discrepancy dismissed" ON planner_discrepancy_dismissed
  FOR ALL USING (is_admin());

CREATE POLICY "Admins manage all program kids" ON planner_program_kids
  FOR ALL USING (is_admin());
