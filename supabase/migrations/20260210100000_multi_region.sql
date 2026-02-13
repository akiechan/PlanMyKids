-- Multi-region support: regions table, region_id FKs, backfill

-- =============================================================
-- 1. Create regions table
-- =============================================================

CREATE TABLE IF NOT EXISTS regions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  center_lat DOUBLE PRECISION NOT NULL,
  center_lng DOUBLE PRECISION NOT NULL,
  default_zoom INTEGER DEFAULT 12,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed SF Bay Area as the default region
INSERT INTO regions (slug, name, short_name, center_lat, center_lng, default_zoom)
VALUES ('sf-bay-area', 'San Francisco Bay Area', 'SF Bay Area', 37.7749, -122.4194, 12)
ON CONFLICT (slug) DO NOTHING;

-- =============================================================
-- 2. Add region_id to program_locations
-- =============================================================

ALTER TABLE program_locations
  ADD COLUMN IF NOT EXISTS region_id UUID REFERENCES regions(id);

-- Backfill all existing locations to SF region
UPDATE program_locations
SET region_id = (SELECT id FROM regions WHERE slug = 'sf-bay-area')
WHERE region_id IS NULL;

-- Make NOT NULL after backfill
ALTER TABLE program_locations ALTER COLUMN region_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_program_locations_region ON program_locations(region_id);

-- =============================================================
-- 3. Add region_id to neighborhoods (only if table exists)
-- =============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'neighborhoods') THEN
    ALTER TABLE neighborhoods ADD COLUMN IF NOT EXISTS region_id UUID REFERENCES regions(id);
    UPDATE neighborhoods SET region_id = (SELECT id FROM regions WHERE slug = 'sf-bay-area') WHERE region_id IS NULL;
    ALTER TABLE neighborhoods ALTER COLUMN region_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_neighborhoods_region ON neighborhoods(region_id);
  END IF;
END $$;

-- =============================================================
-- 4. Ensure neighborhood aliases are populated for SF
-- =============================================================

-- Only runs if neighborhoods table exists (created by program_type_expansion migration)
DO $$
DECLARE
  sf_region_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'neighborhoods') THEN
    RETURN;
  END IF;

  SELECT id INTO sf_region_id FROM regions WHERE slug = 'sf-bay-area';

  INSERT INTO neighborhoods (name, aliases, region_id) VALUES
    ('Richmond District', ARRAY['The Richmond'], sf_region_id),
    ('Inner Richmond', ARRAY['Inner Richmond'], sf_region_id),
    ('Outer Richmond', ARRAY['Outer Richmond'], sf_region_id),
    ('Sunset District', ARRAY['The Sunset'], sf_region_id),
    ('Inner Sunset', ARRAY['Inner Sunset'], sf_region_id),
    ('Outer Sunset', ARRAY['Outer Sunset'], sf_region_id),
    ('Noe Valley', ARRAY['Noe'], sf_region_id),
    ('Pacific Heights', ARRAY['Pac Heights'], sf_region_id),
    ('Lower Pacific Heights', ARRAY['Lower Pac Heights'], sf_region_id),
    ('Russian Hill', '{}', sf_region_id),
    ('Nob Hill', '{}', sf_region_id),
    ('Telegraph Hill', '{}', sf_region_id),
    ('North Beach', '{}', sf_region_id),
    ('Mission District', ARRAY['The Mission', 'Mission'], sf_region_id),
    ('SoMa', ARRAY['SOMA', 'South of Market'], sf_region_id),
    ('Hayes Valley', '{}', sf_region_id),
    ('Lower Haight', '{}', sf_region_id),
    ('Haight-Ashbury', ARRAY['Haight Ashbury', 'The Haight'], sf_region_id),
    ('Cole Valley', '{}', sf_region_id),
    ('Castro', ARRAY['The Castro'], sf_region_id),
    ('Glen Park', '{}', sf_region_id),
    ('Bernal Heights', ARRAY['Bernal'], sf_region_id),
    ('Potrero Hill', ARRAY['Potrero'], sf_region_id),
    ('Dogpatch', ARRAY['The Dogpatch'], sf_region_id),
    ('Bayview', '{}', sf_region_id),
    ('Bayview-Hunters Point', ARRAY['Hunters Point'], sf_region_id),
    ('Visitacion Valley', '{}', sf_region_id),
    ('Excelsior', ARRAY['The Excelsior'], sf_region_id),
    ('Crocker-Amazon', ARRAY['Crocker Amazon'], sf_region_id),
    ('Portola', '{}', sf_region_id),
    ('Marina', ARRAY['Marina District', 'The Marina'], sf_region_id),
    ('Cow Hollow', '{}', sf_region_id),
    ('Presidio Heights', '{}', sf_region_id),
    ('Laurel Heights', '{}', sf_region_id),
    ('Jordan Park', '{}', sf_region_id),
    ('Lone Mountain', '{}', sf_region_id),
    ('Western Addition', '{}', sf_region_id),
    ('Japantown', '{}', sf_region_id),
    ('Fillmore', '{}', sf_region_id),
    ('Tenderloin', ARRAY['The Tenderloin'], sf_region_id),
    ('Civic Center', '{}', sf_region_id),
    ('Financial District', ARRAY['FiDi'], sf_region_id),
    ('Chinatown', '{}', sf_region_id),
    ('Union Square', '{}', sf_region_id),
    ('Sea Cliff', '{}', sf_region_id),
    ('Lake Street', '{}', sf_region_id),
    ('Anza Vista', '{}', sf_region_id),
    ('Balboa Terrace', '{}', sf_region_id),
    ('Forest Hill', '{}', sf_region_id),
    ('Forest Knolls', '{}', sf_region_id),
    ('West Portal', '{}', sf_region_id),
    ('St. Francis Wood', ARRAY['Saint Francis Wood'], sf_region_id),
    ('Miraloma Park', '{}', sf_region_id),
    ('Diamond Heights', '{}', sf_region_id),
    ('Twin Peaks', '{}', sf_region_id),
    ('Clarendon Heights', '{}', sf_region_id),
    ('Mission Bay', '{}', sf_region_id),
    ('South Beach', '{}', sf_region_id),
    ('Rincon Hill', '{}', sf_region_id),
    ('Treasure Island', '{}', sf_region_id),
    ('Parkside', '{}', sf_region_id),
    ('Stonestown', '{}', sf_region_id),
    ('Lake Merced', '{}', sf_region_id),
    ('Ingleside', '{}', sf_region_id),
    ('Oceanview', '{}', sf_region_id),
    ('Merced Heights', '{}', sf_region_id),
    ('Mount Davidson', '{}', sf_region_id),
    ('Sunnyside', '{}', sf_region_id),
    ('Westwood Park', '{}', sf_region_id),
    ('Monterey Heights', '{}', sf_region_id),
    ('Sherwood Forest', '{}', sf_region_id),
    ('NoPa', ARRAY['North Panhandle', 'North of the Panhandle'], sf_region_id),
    ('Duboce Triangle', '{}', sf_region_id),
    ('Alamo Square', '{}', sf_region_id),
    ('Balboa Park', '{}', sf_region_id),
    ('Lakeshore', '{}', sf_region_id)
  ON CONFLICT (name) DO UPDATE SET
    aliases = EXCLUDED.aliases,
    region_id = EXCLUDED.region_id;
END $$;
