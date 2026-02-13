-- Migration for scheduled scrape jobs and history tracking

-- Table for scheduled scrape jobs
CREATE TABLE IF NOT EXISTS scheduled_scrape_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL DEFAULT 'Scheduled Provider Update',
    -- Schedule configuration
    schedule_type TEXT NOT NULL DEFAULT 'once' CHECK (schedule_type IN ('once', 'daily', 'weekly', 'monthly')),
    scheduled_time TIMESTAMPTZ NOT NULL,
    next_run_at TIMESTAMPTZ,
    -- Job configuration
    max_pages INTEGER NOT NULL DEFAULT 10,
    max_depth INTEGER NOT NULL DEFAULT 2,
    only_missing BOOLEAN NOT NULL DEFAULT false,
    program_filter TEXT, -- JSON array of program IDs to include, null = all
    -- Status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    -- Metadata
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for scrape run history
CREATE TABLE IF NOT EXISTS scrape_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES scheduled_scrape_jobs(id) ON DELETE SET NULL,
    -- Run details
    run_type TEXT NOT NULL DEFAULT 'manual' CHECK (run_type IN ('manual', 'scheduled')),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    -- Results
    total_programs INTEGER NOT NULL DEFAULT 0,
    programs_scraped INTEGER NOT NULL DEFAULT 0,
    programs_updated INTEGER NOT NULL DEFAULT 0,
    programs_failed INTEGER NOT NULL DEFAULT 0,
    -- Status
    status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
    error_message TEXT,
    -- Detailed results (JSON)
    results JSONB,
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for individual program scrape results within a run
CREATE TABLE IF NOT EXISTS scrape_history_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    history_id UUID NOT NULL REFERENCES scrape_history(id) ON DELETE CASCADE,
    program_id UUID NOT NULL,
    program_name TEXT,
    provider_name TEXT,
    -- Scrape results
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'success', 'failed', 'skipped')),
    -- Found data
    registration_url_found TEXT,
    re_enrollment_date_found TEXT,
    new_registration_date_found TEXT,
    pages_crawled INTEGER DEFAULT 0,
    -- What was updated
    fields_updated JSONB, -- {"registration_url": "old -> new", ...}
    error_message TEXT,
    -- Timing
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_scheduled_scrape_jobs_next_run ON scheduled_scrape_jobs(next_run_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_scheduled_scrape_jobs_status ON scheduled_scrape_jobs(status);
CREATE INDEX IF NOT EXISTS idx_scrape_history_job_id ON scrape_history(job_id);
CREATE INDEX IF NOT EXISTS idx_scrape_history_started_at ON scrape_history(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_scrape_history_items_history_id ON scrape_history_items(history_id);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_scheduled_scrape_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_scheduled_scrape_jobs_updated_at ON scheduled_scrape_jobs;
CREATE TRIGGER trigger_scheduled_scrape_jobs_updated_at
    BEFORE UPDATE ON scheduled_scrape_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_scheduled_scrape_jobs_updated_at();

-- Enable RLS
ALTER TABLE scheduled_scrape_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE scrape_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE scrape_history_items ENABLE ROW LEVEL SECURITY;

-- Policies for admin access (using service role key bypasses RLS)
-- For authenticated users, we can add more restrictive policies later
CREATE POLICY "Allow all operations for service role" ON scheduled_scrape_jobs FOR ALL USING (true);
CREATE POLICY "Allow all operations for service role" ON scrape_history FOR ALL USING (true);
CREATE POLICY "Allow all operations for service role" ON scrape_history_items FOR ALL USING (true);
