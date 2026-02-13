-- Add 'rejected' to the program_status

-- First, check if we're using an ENUM type or a CHECK constraint
-- If using CHECK constraint, drop it and recreate with 'rejected'
ALTER TABLE programs DROP CONSTRAINT IF EXISTS programs_status_check;

-- Add the new CHECK constraint with 'rejected' included
ALTER TABLE programs ADD CONSTRAINT programs_status_check
  CHECK (status IN ('active', 'inactive', 'pending', 'rejected'));

-- If using an ENUM type instead, add the value
-- This will fail silently if the type doesn't exist, which is fine
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'program_status') THEN
    -- Only add if it doesn't already exist
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum
      WHERE enumtypid = 'program_status'::regtype
      AND enumlabel = 'rejected'
    ) THEN
      ALTER TYPE program_status ADD VALUE 'rejected';
    END IF;
  END IF;
END $$;

-- Add a comment explaining the status values
COMMENT ON COLUMN programs.status IS 'Program status: active (live), inactive (hidden), pending (awaiting review), rejected (denied by admin)';
