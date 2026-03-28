-- Add missing pickup/dropoff columns to bookings table

-- Add pickup location columns
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pickup_latitude DECIMAL(10, 8);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pickup_longitude DECIMAL(11, 8);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pickup_address TEXT;

-- Add dropoff location columns  
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS dropoff_latitude DECIMAL(10, 8);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS dropoff_longitude DECIMAL(11, 8);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS dropoff_address TEXT;

-- Verify columns added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'bookings' 
AND column_name LIKE '%pickup%' OR column_name LIKE '%dropoff%'
ORDER BY column_name;

