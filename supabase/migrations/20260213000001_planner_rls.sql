-- ============================================================================
-- Family Planner: RLS policies for all planner tables
-- Follows the featured_subscriptions pattern (20240122000000)
-- ============================================================================

-- Enable RLS on all planner tables
ALTER TABLE planner_kids ENABLE ROW LEVEL SECURITY;
ALTER TABLE planner_adults ENABLE ROW LEVEL SECURITY;
ALTER TABLE planner_saved_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE planner_program_kids ENABLE ROW LEVEL SECURITY;
ALTER TABLE planner_todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE planner_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE planner_discrepancy_dismissed ENABLE ROW LEVEL SECURITY;
ALTER TABLE planner_user_preferences ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- planner_kids
-- =============================================================
CREATE POLICY "Users can read own kids"
    ON planner_kids FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own kids"
    ON planner_kids FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own kids"
    ON planner_kids FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own kids"
    ON planner_kids FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Service role full access kids"
    ON planner_kids FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- =============================================================
-- planner_adults
-- =============================================================
CREATE POLICY "Users can read own adults"
    ON planner_adults FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own adults"
    ON planner_adults FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own adults"
    ON planner_adults FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own adults"
    ON planner_adults FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Service role full access adults"
    ON planner_adults FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- =============================================================
-- planner_saved_programs
-- =============================================================
CREATE POLICY "Users can read own saved programs"
    ON planner_saved_programs FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own saved programs"
    ON planner_saved_programs FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own saved programs"
    ON planner_saved_programs FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own saved programs"
    ON planner_saved_programs FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Service role full access saved programs"
    ON planner_saved_programs FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- =============================================================
-- planner_program_kids
-- Access controlled via the parent saved_program ownership
-- =============================================================
CREATE POLICY "Users can manage own program kids"
    ON planner_program_kids FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM planner_saved_programs
            WHERE id = saved_program_id AND user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM planner_saved_programs
            WHERE id = saved_program_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Service role full access program kids"
    ON planner_program_kids FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- =============================================================
-- planner_todos
-- =============================================================
CREATE POLICY "Users can manage own todos"
    ON planner_todos FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access todos"
    ON planner_todos FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- =============================================================
-- planner_reminders
-- =============================================================
CREATE POLICY "Users can manage own reminders"
    ON planner_reminders FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access reminders"
    ON planner_reminders FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- =============================================================
-- planner_discrepancy_dismissed
-- =============================================================
CREATE POLICY "Users can manage own dismissals"
    ON planner_discrepancy_dismissed FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access dismissals"
    ON planner_discrepancy_dismissed FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- =============================================================
-- planner_user_preferences
-- =============================================================
CREATE POLICY "Users can manage own preferences"
    ON planner_user_preferences FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access preferences"
    ON planner_user_preferences FOR ALL TO service_role
    USING (true) WITH CHECK (true);
