-- Add re_enrollment_date and new_registration_date columns
-- Keep next_registration_date for backwards compatibility during migration

-- Add new columns
ALTER TABLE programs ADD COLUMN IF NOT EXISTS re_enrollment_date DATE;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS new_registration_date DATE;

-- Migrate existing data: copy next_registration_date to new_registration_date
UPDATE programs
SET new_registration_date = next_registration_date
WHERE next_registration_date IS NOT NULL;

-- Drop old column (optional - can keep for now)
-- ALTER TABLE programs DROP COLUMN IF EXISTS next_registration_date;
