-- Add hours of operations and price range support

-- Add hours_of_operation field to programs
ALTER TABLE programs ADD COLUMN hours_of_operation TEXT;

-- Replace single price with price range
ALTER TABLE programs DROP COLUMN IF EXISTS price;
ALTER TABLE programs ADD COLUMN price_min DECIMAL(10, 2);
ALTER TABLE programs ADD COLUMN price_max DECIMAL(10, 2);

-- Update existing data (if any) - set ranges based on old price
-- This is just for migration - new data will use ranges directly

COMMENT ON COLUMN programs.hours_of_operation IS 'General operating hours, e.g., "Mon-Fri 9am-5pm, Sat 10am-2pm"';
COMMENT ON COLUMN programs.price_min IS 'Minimum price for the program';
COMMENT ON COLUMN programs.price_max IS 'Maximum price for the program (same as min if fixed price)';
COMMENT ON COLUMN programs.schedule IS 'Specific class/session schedule, e.g., "Tuesdays 4-5pm"';
