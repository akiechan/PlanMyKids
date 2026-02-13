-- Create table to store Google Places search history
CREATE TABLE IF NOT EXISTS google_places_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id TEXT NOT NULL,
  name TEXT NOT NULL,
  formatted_address TEXT NOT NULL,
  rating DECIMAL,
  user_ratings_total INTEGER,
  place_types TEXT[],
  search_query TEXT NOT NULL,
  added_to_programs BOOLEAN DEFAULT FALSE,
  added_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_google_places_history_place_id ON google_places_history(place_id);
CREATE INDEX IF NOT EXISTS idx_google_places_history_search_query ON google_places_history(search_query);
CREATE INDEX IF NOT EXISTS idx_google_places_history_added_to_programs ON google_places_history(added_to_programs);
CREATE INDEX IF NOT EXISTS idx_google_places_history_created_at ON google_places_history(created_at DESC);

-- Add comment
COMMENT ON TABLE google_places_history IS 'History of all places found via Google Places API searches with tracking of which were added to programs';
