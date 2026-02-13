-- Add source field to reviews to distinguish Google reviews from user reviews

ALTER TABLE reviews ADD COLUMN source TEXT DEFAULT 'user' CHECK (source IN ('user', 'google'));
ALTER TABLE reviews ADD COLUMN google_author_url TEXT;
ALTER TABLE reviews ADD COLUMN google_profile_photo_url TEXT;

-- Add index
CREATE INDEX idx_reviews_source ON reviews(source);

COMMENT ON COLUMN reviews.source IS 'Source of the review: user (submitted via form) or google (from Google Places API)';
COMMENT ON COLUMN reviews.google_author_url IS 'Google reviewer profile URL (if from Google)';
COMMENT ON COLUMN reviews.google_profile_photo_url IS 'Google reviewer profile photo (if from Google)';

-- Google reviews are auto-approved
CREATE OR REPLACE FUNCTION set_google_review_status()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.source = 'google' THEN
        NEW.status = 'approved';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_google_review_status
BEFORE INSERT ON reviews
FOR EACH ROW
EXECUTE FUNCTION set_google_review_status();
