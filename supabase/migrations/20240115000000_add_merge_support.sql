-- Add support for merging duplicate programs
ALTER TABLE programs
ADD COLUMN IF NOT EXISTS merged_into UUID REFERENCES programs(id) ON DELETE SET NULL;

-- Add index for merged programs
CREATE INDEX IF NOT EXISTS idx_programs_merged_into ON programs(merged_into);

-- Comment
COMMENT ON COLUMN programs.merged_into IS 'If this program was merged into another, this references the target program';

-- Update status enum to include 'merged' (if not already there)
-- This is informational - the actual status column constraint may need manual update
