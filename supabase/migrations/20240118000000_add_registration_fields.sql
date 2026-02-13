-- Add registration site link, next registration date, and registration email to programs table
ALTER TABLE programs ADD COLUMN IF NOT EXISTS registration_url TEXT;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS next_registration_date DATE;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS registration_email TEXT;

-- Add comments
COMMENT ON COLUMN programs.registration_url IS 'URL to the program registration page';
COMMENT ON COLUMN programs.next_registration_date IS 'Next upcoming registration date for the program';
COMMENT ON COLUMN programs.registration_email IS 'Email address for registration inquiries';
