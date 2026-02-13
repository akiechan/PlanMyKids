-- P0: Expand program_type to support birthday_venue and league
-- P0: Create child tables for type-specific fields
-- P1: Create tags + program_tags reference tables
-- P2: Create neighborhoods reference table
-- P3: Add composite indexes for query performance
-- P3: Add trigger to null out featured_subscriptions.program_data

-- =============================================================
-- 1. Widen program_type CHECK constraint
-- =============================================================

ALTER TABLE programs DROP CONSTRAINT IF EXISTS programs_program_type_check;
ALTER TABLE programs ADD CONSTRAINT programs_program_type_check
  CHECK (program_type IN ('program', 'camp', 'birthday_venue', 'league'));

-- =============================================================
-- 2. Child tables for type-specific fields
-- =============================================================

-- Camp details (migrate existing camp-specific columns)
CREATE TABLE IF NOT EXISTS camp_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL UNIQUE REFERENCES programs(id) ON DELETE CASCADE,
  season TEXT CHECK (season IN ('summer', 'spring', 'fall', 'winter')),
  days_format TEXT CHECK (days_format IN ('daily', 'weekly')),
  before_care BOOLEAN DEFAULT false,
  before_care_start TEXT,  -- HH:MM
  after_care BOOLEAN DEFAULT false,
  after_care_end TEXT,     -- HH:MM
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Backfill camp_details from existing programs
INSERT INTO camp_details (program_id, season, days_format, before_care, before_care_start, after_care, after_care_end)
SELECT id, camp_season, camp_days_format, before_care, before_care_start, after_care, after_care_end
FROM programs
WHERE program_type = 'camp'
  AND (camp_season IS NOT NULL OR camp_days_format IS NOT NULL OR before_care = true OR after_care = true)
ON CONFLICT (program_id) DO NOTHING;

CREATE INDEX idx_camp_details_program_id ON camp_details(program_id);

-- Birthday venue details
CREATE TABLE IF NOT EXISTS birthday_venue_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL UNIQUE REFERENCES programs(id) ON DELETE CASCADE,
  venue_capacity INTEGER,
  min_party_size INTEGER,
  max_party_size INTEGER,
  venue_type TEXT CHECK (venue_type IN ('indoor', 'outdoor', 'both')),
  package_options JSONB DEFAULT '[]'::JSONB,  -- [{name, price, description, includes}]
  catering_available BOOLEAN DEFAULT false,
  decorations_included BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_birthday_venue_details_program_id ON birthday_venue_details(program_id);
CREATE INDEX idx_birthday_venue_capacity ON birthday_venue_details(venue_capacity) WHERE venue_capacity IS NOT NULL;
CREATE INDEX idx_birthday_venue_type ON birthday_venue_details(venue_type) WHERE venue_type IS NOT NULL;

-- League details
CREATE TABLE IF NOT EXISTS league_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL UNIQUE REFERENCES programs(id) ON DELETE CASCADE,
  sport TEXT,
  season TEXT CHECK (season IN ('spring', 'summer', 'fall', 'winter', 'year-round')),
  division TEXT,          -- e.g., 'recreational', 'competitive', 'elite'
  team_size INTEGER,
  game_schedule JSONB DEFAULT '[]'::JSONB,  -- [{day, time, location}]
  practices_per_week INTEGER,
  season_length_weeks INTEGER,
  registration_deadline DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_league_details_program_id ON league_details(program_id);
CREATE INDEX idx_league_details_sport ON league_details(sport) WHERE sport IS NOT NULL;
CREATE INDEX idx_league_details_season ON league_details(season) WHERE season IS NOT NULL;

-- =============================================================
-- 3. Tags reference table (replaces TEXT[] category on programs)
-- =============================================================

CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tag_type TEXT NOT NULL CHECK (tag_type IN ('category', 'amenity', 'sport', 'feature')),
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(name, tag_type)
);

CREATE TABLE IF NOT EXISTS program_tags (
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (program_id, tag_id)
);

CREATE INDEX idx_program_tags_tag_id ON program_tags(tag_id);
CREATE INDEX idx_tags_type ON tags(tag_type);

-- Seed tags from existing categories in programs
INSERT INTO tags (name, tag_type, display_name)
SELECT DISTINCT LOWER(TRIM(unnest(category))), 'category', INITCAP(TRIM(unnest(category)))
FROM programs
WHERE category IS NOT NULL AND array_length(category, 1) > 0
ON CONFLICT (name, tag_type) DO NOTHING;

-- Backfill program_tags from existing category arrays
INSERT INTO program_tags (program_id, tag_id)
SELECT p.id, t.id
FROM programs p,
     LATERAL unnest(p.category) AS cat(val),
     tags t
WHERE t.name = LOWER(TRIM(cat.val))
  AND t.tag_type = 'category'
ON CONFLICT (program_id, tag_id) DO NOTHING;

-- =============================================================
-- 4. Neighborhoods reference table
-- =============================================================

CREATE TABLE IF NOT EXISTS neighborhoods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  aliases TEXT[] DEFAULT '{}',
  street_patterns TEXT[] DEFAULT '{}',  -- keywords for scraper auto-detection
  city TEXT NOT NULL DEFAULT 'San Francisco',
  state TEXT NOT NULL DEFAULT 'CA',
  is_canonical BOOLEAN DEFAULT true,   -- false = should be merged into another
  canonical_id UUID REFERENCES neighborhoods(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_neighborhoods_name ON neighborhoods(name);
CREATE INDEX idx_neighborhoods_canonical ON neighborhoods(is_canonical) WHERE is_canonical = true;

-- Seed from existing unique neighborhoods in program_locations
INSERT INTO neighborhoods (name)
SELECT DISTINCT neighborhood
FROM program_locations
WHERE neighborhood IS NOT NULL AND TRIM(neighborhood) != ''
ON CONFLICT (name) DO NOTHING;

-- Populate SF neighborhood aliases and street patterns
UPDATE neighborhoods SET aliases = ARRAY['The Marina'], street_patterns = ARRAY['marina', 'chestnut', 'lombard']
WHERE name = 'Marina District';
UPDATE neighborhoods SET aliases = ARRAY['The Mission'], street_patterns = ARRAY['mission', 'valencia', '24th', '16th']
WHERE name = 'Mission District';
UPDATE neighborhoods SET aliases = ARRAY['SoMa', 'South of Market'], street_patterns = ARRAY['townsend', 'folsom', 'howard']
WHERE name = 'SOMA';
UPDATE neighborhoods SET street_patterns = ARRAY['geary', 'clement']
WHERE name = 'Richmond District';
UPDATE neighborhoods SET street_patterns = ARRAY['judah', 'noriega']
WHERE name = 'Sunset District';
UPDATE neighborhoods SET aliases = ARRAY['Pac Heights'], street_patterns = ARRAY['fillmore', 'divisadero']
WHERE name = 'Pacific Heights';
UPDATE neighborhoods SET street_patterns = ARRAY['hayes', 'fell', 'oak']
WHERE name = 'Hayes Valley';
UPDATE neighborhoods SET aliases = ARRAY['The Castro'], street_patterns = ARRAY['castro', 'market', 'noe']
WHERE name = 'Castro';
UPDATE neighborhoods SET aliases = ARRAY['Noe'], street_patterns = ARRAY['noe', '24th', 'church']
WHERE name = 'Noe Valley';
UPDATE neighborhoods SET street_patterns = ARRAY['haight', 'ashbury']
WHERE name = 'Haight-Ashbury';
UPDATE neighborhoods SET aliases = ARRAY['Potrero'], street_patterns = ARRAY['potrero', 'mariposa', 'de haro']
WHERE name = 'Potrero Hill';
UPDATE neighborhoods SET aliases = ARRAY['The Dogpatch'], street_patterns = ARRAY['tennessee', 'minnesota', '3rd']
WHERE name = 'Dogpatch';
UPDATE neighborhoods SET aliases = ARRAY['Bernal'], street_patterns = ARRAY['cortland', 'precita']
WHERE name = 'Bernal Heights';
UPDATE neighborhoods SET aliases = ARRAY['The Excelsior'], street_patterns = ARRAY['mission', 'excelsior', 'geneva']
WHERE name = 'Excelsior';

-- =============================================================
-- 5. Composite indexes for query performance (P3)
-- =============================================================

-- The most common query: active programs/camps
CREATE INDEX IF NOT EXISTS idx_programs_type_status
  ON programs(program_type, status)
  WHERE status = 'active';

-- Date range queries for camps
CREATE INDEX IF NOT EXISTS idx_programs_date_range
  ON programs(start_date, end_date)
  WHERE start_date IS NOT NULL;

-- Neighborhood lookups
CREATE INDEX IF NOT EXISTS idx_program_locations_neighborhood
  ON program_locations(neighborhood);

-- =============================================================
-- 6. Trigger: null out featured_subscriptions.program_data
--    when program_id is set (program has been created)
-- =============================================================

CREATE OR REPLACE FUNCTION cleanup_featured_subscription_program_data()
RETURNS TRIGGER AS $$
BEGIN
  -- When program_id transitions from NULL to a value, clear program_data
  IF OLD.program_id IS NULL AND NEW.program_id IS NOT NULL THEN
    NEW.program_data = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_cleanup_featured_program_data ON featured_subscriptions;
CREATE TRIGGER trigger_cleanup_featured_program_data
  BEFORE UPDATE ON featured_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_featured_subscription_program_data();
