-- Verify the schema is correct

-- Check if operating_days column exists and its type
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'programs'
AND column_name = 'operating_days';

-- Check if the index exists
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'programs'
AND indexname = 'idx_programs_operating_days';

-- Show a sample of programs with their operating_days
SELECT
    id,
    name,
    operating_days,
    hours_of_operation
FROM programs
LIMIT 5;
