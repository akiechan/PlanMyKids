-- Add review_url field to reviews table to link to original review (e.g., Google review page)

ALTER TABLE reviews ADD COLUMN review_url TEXT;

COMMENT ON COLUMN reviews.review_url IS 'Link to the original review on external platform (Google, Yelp, etc.)';
