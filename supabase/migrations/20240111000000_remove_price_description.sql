-- Remove price_description field from programs table

ALTER TABLE programs DROP COLUMN IF EXISTS price_description;
