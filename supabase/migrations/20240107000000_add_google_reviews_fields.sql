-- Add Google-related fields to programs table

ALTER TABLE programs ADD COLUMN google_place_id TEXT;
ALTER TABLE programs ADD COLUMN google_reviews_url TEXT;
ALTER TABLE programs ADD COLUMN google_rating DECIMAL(2, 1);
ALTER TABLE programs ADD COLUMN google_review_count INTEGER DEFAULT 0;

CREATE INDEX idx_programs_google_place_id ON programs(google_place_id);

COMMENT ON COLUMN programs.google_place_id IS 'Google Place ID for fetching reviews';
COMMENT ON COLUMN programs.google_reviews_url IS 'Direct link to Google reviews page';
COMMENT ON COLUMN programs.google_rating IS 'Average Google rating (1-5)';
COMMENT ON COLUMN programs.google_review_count IS 'Total number of Google reviews';

-- Add source field to reviews table to track where review came from
ALTER TABLE reviews ADD COLUMN source TEXT DEFAULT 'user';
COMMENT ON COLUMN reviews.source IS 'Source of review: user, google, yelp, etc.';
