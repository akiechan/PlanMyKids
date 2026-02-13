-- Add operating_days array for searchable day-of-week filtering

ALTER TABLE programs ADD COLUMN operating_days TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Create index for fast searching
CREATE INDEX idx_programs_operating_days ON programs USING GIN (operating_days);

COMMENT ON COLUMN programs.operating_days IS 'Days of week program operates: monday, tuesday, wednesday, thursday, friday, saturday, sunday';

-- Example update to set operating_days based on hours_of_operation text
-- This is optional - you can run this to parse existing data
-- UPDATE programs SET operating_days =
--   CASE
--     WHEN hours_of_operation ILIKE '%mon%' THEN ARRAY['monday']
--     ELSE ARRAY[]::TEXT[]
--   END
-- WHERE operating_days = ARRAY[]::TEXT[];
