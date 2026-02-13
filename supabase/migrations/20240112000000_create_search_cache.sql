-- Create table to cache Google Places search results
CREATE TABLE IF NOT EXISTS google_places_search_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  search_query TEXT NOT NULL,
  results JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on search_query for fast lookups
CREATE INDEX idx_search_cache_query ON google_places_search_cache(search_query);

-- Create index on created_at for cleanup of old entries
CREATE INDEX idx_search_cache_created_at ON google_places_search_cache(created_at);

-- Add comment
COMMENT ON TABLE google_places_search_cache IS 'Cache for Google Places API search results to avoid repeated API calls';
