-- ============================================================================
-- Family Planner: localStorage → Database Migration
-- Creates tables for user planner data (kids, adults, saved programs, etc.)
-- ============================================================================

-- =============================================================
-- 1. planner_kids
-- =============================================================
CREATE TABLE planner_kids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    birthday DATE,
    avatar TEXT NOT NULL DEFAULT '🐣',
    color TEXT NOT NULL DEFAULT 'blue',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_planner_kids_user_id ON planner_kids(user_id);

-- =============================================================
-- 2. planner_adults
-- =============================================================
CREATE TABLE planner_adults (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    relationship TEXT NOT NULL DEFAULT 'Parent',
    avatar TEXT NOT NULL DEFAULT '🦁',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_planner_adults_user_id ON planner_adults(user_id);

-- =============================================================
-- 3. planner_saved_programs
-- =============================================================
CREATE TABLE planner_saved_programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,

    -- Reference to programs table (NULL for custom programs pending review)
    program_id UUID REFERENCES programs(id) ON DELETE SET NULL,

    -- For duplicates: which saved program was this duplicated from?
    source_saved_program_id UUID REFERENCES planner_saved_programs(id) ON DELETE SET NULL,

    -- User status
    status TEXT NOT NULL DEFAULT 'considering'
        CHECK (status IN ('considering', 'registered', 'enrolled')),

    -- Schedule overrides
    schedule_days TEXT[] DEFAULT '{}',
    schedule_times JSONB DEFAULT '[]',

    -- Session dates (for camps)
    session_start_date DATE,
    session_end_date DATE,

    -- Enrollment details
    enroll_hours_start TEXT,
    enroll_hours_end TEXT,
    cost_per_session NUMERIC(10,2),

    -- User date/URL overrides (canonical values live in programs table)
    override_re_enrollment_date DATE,
    override_new_registration_date DATE,
    override_registration_url TEXT,

    -- Logistics: adult assignments
    assigned_adult_id UUID REFERENCES planner_adults(id) ON DELETE SET NULL,
    dropoff_adult_id UUID REFERENCES planner_adults(id) ON DELETE SET NULL,
    pickup_adult_id UUID REFERENCES planner_adults(id) ON DELETE SET NULL,
    dropoff_time TEXT,
    pickup_time TEXT,

    -- Assign all kids flag (replaces magic ['all'] array value)
    assign_all_kids BOOLEAN DEFAULT false,

    -- Display ordering
    priority INTEGER,

    -- Custom program data (when program_id is NULL, stores name/website/etc.)
    custom_program_data JSONB,

    -- Tracks if user has a pending edit request for the source program
    has_pending_edit BOOLEAN DEFAULT false,

    -- Metadata
    saved_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_planner_saved_programs_user_id ON planner_saved_programs(user_id);
CREATE INDEX idx_planner_saved_programs_program_id ON planner_saved_programs(program_id);
CREATE INDEX idx_planner_saved_programs_status ON planner_saved_programs(status);
CREATE INDEX idx_planner_saved_programs_source ON planner_saved_programs(source_saved_program_id)
    WHERE source_saved_program_id IS NOT NULL;

-- =============================================================
-- 4. planner_program_kids (many-to-many junction)
-- =============================================================
CREATE TABLE planner_program_kids (
    saved_program_id UUID NOT NULL REFERENCES planner_saved_programs(id) ON DELETE CASCADE,
    kid_id UUID NOT NULL REFERENCES planner_kids(id) ON DELETE CASCADE,
    PRIMARY KEY (saved_program_id, kid_id)
);

CREATE INDEX idx_planner_program_kids_kid ON planner_program_kids(kid_id);

-- =============================================================
-- 5. planner_todos
-- =============================================================
CREATE TABLE planner_todos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    text TEXT NOT NULL,
    completed BOOLEAN DEFAULT false,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_planner_todos_user_id ON planner_todos(user_id);

-- =============================================================
-- 6. planner_reminders
-- =============================================================
CREATE TABLE planner_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    saved_program_id UUID NOT NULL REFERENCES planner_saved_programs(id) ON DELETE CASCADE,
    reminder_type TEXT NOT NULL CHECK (reminder_type IN ('registration', 're_enrollment')),
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, saved_program_id, reminder_type)
);

CREATE INDEX idx_planner_reminders_user_id ON planner_reminders(user_id);
CREATE INDEX idx_planner_reminders_saved_program ON planner_reminders(saved_program_id);

-- =============================================================
-- 7. planner_discrepancy_dismissed (persistent dismissals)
-- =============================================================
CREATE TABLE planner_discrepancy_dismissed (
    user_id UUID NOT NULL,
    program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    dismissed_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, program_id)
);

-- =============================================================
-- 8. planner_user_preferences
-- =============================================================
CREATE TABLE planner_user_preferences (
    user_id UUID PRIMARY KEY,
    welcome_dismissed BOOLEAN DEFAULT false,
    reminder_lead_time_days INTEGER DEFAULT 7,
    reminder_email_enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================
-- Triggers for updated_at
-- =============================================================
CREATE OR REPLACE FUNCTION planner_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_planner_kids_updated_at
    BEFORE UPDATE ON planner_kids FOR EACH ROW
    EXECUTE FUNCTION planner_update_updated_at();

CREATE TRIGGER trigger_planner_adults_updated_at
    BEFORE UPDATE ON planner_adults FOR EACH ROW
    EXECUTE FUNCTION planner_update_updated_at();

CREATE TRIGGER trigger_planner_saved_programs_updated_at
    BEFORE UPDATE ON planner_saved_programs FOR EACH ROW
    EXECUTE FUNCTION planner_update_updated_at();

CREATE TRIGGER trigger_planner_todos_updated_at
    BEFORE UPDATE ON planner_todos FOR EACH ROW
    EXECUTE FUNCTION planner_update_updated_at();

CREATE TRIGGER trigger_planner_user_preferences_updated_at
    BEFORE UPDATE ON planner_user_preferences FOR EACH ROW
    EXECUTE FUNCTION planner_update_updated_at();
