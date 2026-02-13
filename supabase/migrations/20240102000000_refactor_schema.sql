-- Migration: Remove price_type, add multiple locations support, add geocoding

-- Drop old programs table and recreate with new structure
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS programs CASCADE;

-- Enable UUID and PostGIS extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create programs table (refactored)
CREATE TABLE programs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    category TEXT[] NOT NULL,
    description TEXT NOT NULL,

    -- Pricing (price range support)
    price_min DECIMAL(10, 2),
    price_max DECIMAL(10, 2),
    price_unit TEXT,
    price_description TEXT,

    -- Audience
    age_min INTEGER NOT NULL,
    age_max INTEGER NOT NULL,
    age_description TEXT,

    -- Logistics
    hours_of_operation TEXT, -- General hours like "Mon-Fri 9am-5pm"
    schedule TEXT NOT NULL, -- Specific class schedule like "Tuesdays 4-5pm"
    start_date DATE,
    end_date DATE,

    -- Provider
    provider_name TEXT NOT NULL,
    provider_website TEXT,
    contact_email TEXT,
    contact_phone TEXT,

    -- Media (no images for now)
    logo TEXT,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
    average_rating DECIMAL(3, 2) DEFAULT 0,
    review_count INTEGER DEFAULT 0
);

-- Create locations table for multiple locations per program
CREATE TABLE program_locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,

    -- Location details
    name TEXT, -- Optional name like "Main Campus", "East Bay Location"
    address TEXT NOT NULL,
    neighborhood TEXT NOT NULL,

    -- Geocoding
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    geom GEOGRAPHY(POINT, 4326), -- PostGIS geography for distance calculations

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_primary BOOLEAN DEFAULT false -- Mark one location as primary
);

-- Create reviews table
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    reviewer_name TEXT NOT NULL,
    reviewer_email TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected'))
);

-- Create indexes
CREATE INDEX idx_programs_category ON programs USING GIN (category);
CREATE INDEX idx_programs_age_range ON programs(age_min, age_max);
CREATE INDEX idx_programs_status ON programs(status);
CREATE INDEX idx_program_locations_program_id ON program_locations(program_id);
CREATE INDEX idx_program_locations_geom ON program_locations USING GIST (geom);
CREATE INDEX idx_reviews_program_id ON reviews(program_id);
CREATE INDEX idx_reviews_status ON reviews(status);

-- Trigger to automatically set geom from lat/lng
CREATE OR REPLACE FUNCTION update_location_geom()
RETURNS TRIGGER AS $$
BEGIN
    NEW.geom = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_location_geom
BEFORE INSERT OR UPDATE OF latitude, longitude ON program_locations
FOR EACH ROW
EXECUTE FUNCTION update_location_geom();

-- Function to update average rating
CREATE OR REPLACE FUNCTION update_program_rating()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE programs
    SET
        average_rating = (
            SELECT COALESCE(AVG(rating), 0)
            FROM reviews
            WHERE program_id = NEW.program_id AND status = 'approved'
        ),
        review_count = (
            SELECT COUNT(*)
            FROM reviews
            WHERE program_id = NEW.program_id AND status = 'approved'
        )
    WHERE id = NEW.program_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_program_rating
AFTER INSERT OR UPDATE OF status ON reviews
FOR EACH ROW
EXECUTE FUNCTION update_program_rating();

-- Function to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_programs_updated_at
BEFORE UPDATE ON programs
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Helper function: Find programs within distance (in meters)
CREATE OR REPLACE FUNCTION find_programs_near(
    user_lat DECIMAL,
    user_lng DECIMAL,
    max_distance_meters INTEGER DEFAULT 10000
)
RETURNS TABLE (
    program_id UUID,
    program_name TEXT,
    location_name TEXT,
    address TEXT,
    distance_meters DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.name,
        pl.name,
        pl.address,
        ST_Distance(
            pl.geom,
            ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography
        )::DECIMAL as distance_meters
    FROM programs p
    JOIN program_locations pl ON p.id = pl.program_id
    WHERE p.status = 'active'
    AND ST_DWithin(
        pl.geom,
        ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
        max_distance_meters
    )
    ORDER BY distance_meters;
END;
$$ LANGUAGE plpgsql;
