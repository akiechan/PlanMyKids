-- Remove registration_email column from programs table
ALTER TABLE programs DROP COLUMN IF EXISTS registration_email;
