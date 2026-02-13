-- Simple seed data for testing the new schema

-- Insert a test program
INSERT INTO programs (
  name,
  category,
  description,
  age_min,
  age_max,
  operating_days,
  hours_per_day,
  price_min,
  price_max,
  price_unit,
  provider_name,
  provider_website,
  contact_email,
  contact_phone,
  status
) VALUES (
  'Marina Swimming School',
  ARRAY['swimming'],
  'Professional swimming lessons for all ages in a heated indoor pool. Our certified instructors focus on water safety and proper technique.',
  5,
  12,
  ARRAY['monday', 'wednesday', 'friday', 'saturday'],
  '{
    "monday": {"open": "16:00", "close": "17:00"},
    "wednesday": {"open": "16:00", "close": "17:00"},
    "friday": {"open": "16:00", "close": "17:00"},
    "saturday": {"open": "10:00", "close": "12:00"}
  }'::JSONB,
  120.00,
  180.00,
  'per month',
  'Marina Aquatics Center',
  'https://example.com',
  'info@marinaswim.com',
  '(415) 555-0123',
  'active'
);

-- Get the program ID we just inserted
DO $$
DECLARE
  program_uuid UUID;
BEGIN
  SELECT id INTO program_uuid FROM programs WHERE name = 'Marina Swimming School' LIMIT 1;

  -- Insert location for this program
  INSERT INTO program_locations (
    program_id,
    name,
    address,
    neighborhood,
    latitude,
    longitude,
    is_primary
  ) VALUES (
    program_uuid,
    'Main Pool',
    '2500 Marina Blvd, San Francisco, CA 94123',
    'Marina District',
    37.8053,
    -122.4371,
    true
  );

  -- Insert a sample review
  INSERT INTO reviews (
    program_id,
    reviewer_name,
    reviewer_email,
    rating,
    comment,
    status
  ) VALUES (
    program_uuid,
    'Sarah Johnson',
    'sarah@example.com',
    5,
    'My kids love this program! The instructors are patient and professional.',
    'approved'
  );
END $$;
