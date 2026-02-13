-- Remove user review rating fields from programs table
-- We only use Google review ratings now

ALTER TABLE programs DROP COLUMN IF EXISTS average_rating;
ALTER TABLE programs DROP COLUMN IF EXISTS review_count;
