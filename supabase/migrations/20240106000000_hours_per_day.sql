-- Remove schedule and hours_of_operation fields
-- Add hours_per_day JSONB field for day-specific operating hours

-- Remove old fields
ALTER TABLE programs DROP COLUMN IF EXISTS schedule;
ALTER TABLE programs DROP COLUMN IF EXISTS hours_of_operation;

-- Add new hours_per_day field
ALTER TABLE programs ADD COLUMN hours_per_day JSONB DEFAULT '{}'::JSONB;

-- Add index for JSONB queries
CREATE INDEX idx_programs_hours_per_day ON programs USING GIN (hours_per_day);

COMMENT ON COLUMN programs.hours_per_day IS 'Operating hours per day: {"monday": {"open": "09:00", "close": "17:00"}, "tuesday": null, ...}';

-- Example structure:
-- {
--   "monday": {"open": "09:00", "close": "17:00"},
--   "tuesday": {"open": "09:00", "close": "17:00"},
--   "wednesday": null,
--   "thursday": {"open": "10:00", "close": "18:00"},
--   "friday": {"open": "09:00", "close": "17:00"},
--   "saturday": {"open": "10:00", "close": "15:00"},
--   "sunday": null
-- }
