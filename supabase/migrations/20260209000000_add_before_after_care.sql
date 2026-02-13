-- Add before care and after care fields to programs table
ALTER TABLE programs
ADD COLUMN IF NOT EXISTS before_care boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS before_care_start text,
ADD COLUMN IF NOT EXISTS after_care boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS after_care_end text;

-- Add comment for documentation
COMMENT ON COLUMN programs.before_care IS 'Whether the program offers before care';
COMMENT ON COLUMN programs.before_care_start IS 'Time when before care starts (HH:MM format)';
COMMENT ON COLUMN programs.after_care IS 'Whether the program offers after care';
COMMENT ON COLUMN programs.after_care_end IS 'Time when after care ends (HH:MM format)';
