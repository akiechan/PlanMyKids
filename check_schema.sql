-- Quick check to see if hours_per_day column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'programs' 
AND column_name IN ('hours_per_day', 'schedule', 'hours_of_operation')
ORDER BY column_name;
