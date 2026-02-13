-- Add camp-specific fields to programs table

-- Program type to distinguish between regular programs and camps
ALTER TABLE programs ADD COLUMN IF NOT EXISTS program_type TEXT DEFAULT 'program' CHECK (program_type IN ('program', 'camp'));

-- Camp season (summer, spring, fall, winter)
ALTER TABLE programs ADD COLUMN IF NOT EXISTS camp_season TEXT CHECK (camp_season IN ('summer', 'spring', 'fall', 'winter'));

-- Camp days format (daily or weekly)
ALTER TABLE programs ADD COLUMN IF NOT EXISTS camp_days_format TEXT CHECK (camp_days_format IN ('daily', 'weekly'));

-- Hours for camps/programs
ALTER TABLE programs ADD COLUMN IF NOT EXISTS hours_start TEXT;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS hours_end TEXT;

-- Create index for program_type filtering
CREATE INDEX IF NOT EXISTS idx_programs_program_type ON programs(program_type);
CREATE INDEX IF NOT EXISTS idx_programs_camp_season ON programs(camp_season);
