-- Remove logo field from programs table

ALTER TABLE programs DROP COLUMN IF EXISTS logo;
