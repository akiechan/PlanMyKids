-- Backfill google_reviews_url for programs that have a google_place_id but no google_reviews_url
UPDATE programs
SET google_reviews_url = 'https://search.google.com/local/reviews?placeid=' || google_place_id
WHERE google_place_id IS NOT NULL
  AND google_place_id != ''
  AND (google_reviews_url IS NULL OR google_reviews_url = '');

-- Add comment
COMMENT ON COLUMN programs.google_reviews_url IS 'URL to Google Reviews page for this program';
