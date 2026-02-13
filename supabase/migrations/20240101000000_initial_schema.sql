-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create programs table
CREATE TABLE programs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    category TEXT[] NOT NULL,
    description TEXT NOT NULL,

    -- Location
    neighborhood TEXT NOT NULL,
    address TEXT NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),

    -- Audience
    age_min INTEGER NOT NULL,
    age_max INTEGER NOT NULL,
    age_description TEXT,

    -- Logistics
    schedule TEXT NOT NULL,
    start_date DATE,
    end_date DATE,

    -- Pricing
    price_type TEXT NOT NULL CHECK (price_type IN ('free', 'one-time', 'recurring')),
    price DECIMAL(10, 2),
    price_unit TEXT,
    price_description TEXT,

    -- Provider
    provider_name TEXT NOT NULL,
    provider_website TEXT,
    contact_email TEXT,
    contact_phone TEXT,

    -- Media
    images TEXT[],
    logo TEXT,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
    average_rating DECIMAL(3, 2) DEFAULT 0,
    review_count INTEGER DEFAULT 0
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

-- Create indexes for better query performance
CREATE INDEX idx_programs_category ON programs USING GIN (category);
CREATE INDEX idx_programs_neighborhood ON programs(neighborhood);
CREATE INDEX idx_programs_age_range ON programs(age_min, age_max);
CREATE INDEX idx_programs_status ON programs(status);
CREATE INDEX idx_reviews_program_id ON reviews(program_id);
CREATE INDEX idx_reviews_status ON reviews(status);

-- Create function to update average rating
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

-- Create trigger to automatically update ratings
CREATE TRIGGER trigger_update_program_rating
AFTER INSERT OR UPDATE OF status ON reviews
FOR EACH ROW
EXECUTE FUNCTION update_program_rating();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for programs table
CREATE TRIGGER update_programs_updated_at
BEFORE UPDATE ON programs
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
