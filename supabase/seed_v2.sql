-- Seed data for PlanMyKids (v2 - No images, multiple locations)

-- Insert sample programs
INSERT INTO programs (
    name, category, description,
    age_min, age_max, age_description,
    hours_of_operation, schedule,
    price_min, price_max, price_unit, price_description,
    provider_name, provider_website, contact_email, contact_phone,
    status
) VALUES
(
    'Golden Gate Swimming Academy',
    ARRAY['swimming', 'sports'],
    'Premier swimming instruction for all ages and skill levels. Our experienced coaches focus on water safety, technique, and building confidence in the water. Small class sizes ensure personalized attention.',
    4, 16,
    'Preschool through High School',
    'Mon-Fri 6am-9pm, Sat-Sun 8am-6pm',
    'Classes run Mon-Fri 3:30-6:00pm, Sat-Sun 9am-2pm',
    120.00,
    180.00,
    'per month',
    '8 sessions per month. Price varies by level. Sibling discount: 10% off',
    'Golden Gate Swim School',
    'https://example.com/ggswim',
    'info@ggswim.com',
    '(415) 555-0123',
    'active'
),
(
    'Mission Art Studio for Kids',
    ARRAY['art', 'creative'],
    'Nurture your child''s creativity with painting, drawing, sculpture, and mixed media projects. Our studio provides a fun, encouraging environment where young artists can explore and express themselves.',
    5, 14,
    'Kindergarten through 8th grade',
    'Tue-Thu 3-7pm, Sat 9am-5pm',
    'Classes: Tuesdays 4-5:30pm, Thursdays 4-5:30pm, Saturdays 10am-12pm',
    100.00,
    140.00,
    'per month',
    'All materials included. Price varies by class type',
    'Mission Arts Collective',
    'https://example.com/missionart',
    'hello@missionart.com',
    '(415) 555-0145',
    'active'
),
(
    'SF Chess Champions',
    ARRAY['chess', 'academic'],
    'Learn strategic thinking and problem-solving through chess! Our program teaches children from beginners to tournament players.',
    6, 18,
    '1st grade and up',
    'Wed 2-6pm, Sat 10am-5pm',
    'Beginner classes: Wed 3:30-5pm, Advanced: Sat 1-3pm',
    75.00,
    125.00,
    'per month',
    'First session free. Price based on experience level',
    'SF Chess Academy',
    'https://example.com/sfchess',
    'coach@sfchess.com',
    '(415) 555-0167',
    'active'
);

-- Insert locations for programs
INSERT INTO program_locations (program_id, name, address, neighborhood, latitude, longitude, is_primary) VALUES
-- Golden Gate Swimming Academy - Main location
(
    (SELECT id FROM programs WHERE name = 'Golden Gate Swimming Academy' LIMIT 1),
    'Main Campus',
    '2500 Marina Blvd, San Francisco, CA 94123',
    'Marina District',
    37.8053,
    -122.4371,
    true
),
-- Golden Gate Swimming Academy - Second location
(
    (SELECT id FROM programs WHERE name = 'Golden Gate Swimming Academy' LIMIT 1),
    'Sunset Branch',
    '1234 Great Highway, San Francisco, CA 94122',
    'Sunset District',
    37.7605,
    -122.5094,
    false
),
-- Mission Art Studio
(
    (SELECT id FROM programs WHERE name = 'Mission Art Studio for Kids' LIMIT 1),
    null,
    '3255 22nd St, San Francisco, CA 94110',
    'Mission District',
    37.7557,
    -122.4186,
    true
),
-- SF Chess Champions - Multiple locations
(
    (SELECT id FROM programs WHERE name = 'SF Chess Champions' LIMIT 1),
    'Richmond Location',
    '5200 Geary Blvd, San Francisco, CA 94118',
    'Richmond District',
    37.7804,
    -122.4699,
    true
),
(
    (SELECT id FROM programs WHERE name = 'SF Chess Champions' LIMIT 1),
    'Downtown Location',
    '123 Market St, San Francisco, CA 94103',
    'Downtown',
    37.7898,
    -122.3997,
    false
);

-- Insert sample reviews
INSERT INTO reviews (program_id, reviewer_name, reviewer_email, rating, comment, status) VALUES
(
    (SELECT id FROM programs WHERE name = 'Golden Gate Swimming Academy' LIMIT 1),
    'Sarah Martinez',
    'sarah.m@example.com',
    5,
    'My daughter went from being afraid of water to swimming confidently in just 3 months! The instructors are patient and encouraging.',
    'approved'
),
(
    (SELECT id FROM programs WHERE name = 'Mission Art Studio for Kids' LIMIT 1),
    'Emily Rodriguez',
    'emily.r@example.com',
    5,
    'Such a creative and welcoming space! The teachers really know how to bring out each child''s artistic side.',
    'approved'
),
(
    (SELECT id FROM programs WHERE name = 'SF Chess Champions' LIMIT 1),
    'Michael Wong',
    'mwong@example.com',
    5,
    'This program has been amazing for my son''s critical thinking skills. He recently won his first tournament!',
    'approved'
);
