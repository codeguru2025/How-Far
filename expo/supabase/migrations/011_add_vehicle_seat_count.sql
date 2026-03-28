-- Migration: Add seat_count column to vehicles table
-- This column was missing from the original schema but is needed by the app

-- Add seat_count column to vehicles table
ALTER TABLE vehicles 
ADD COLUMN IF NOT EXISTS seat_count INTEGER DEFAULT 4;

-- Add passenger_capacity as an alias (some parts of the app use this name)
ALTER TABLE vehicles 
ADD COLUMN IF NOT EXISTS passenger_capacity INTEGER DEFAULT 4;

-- Add constraint to ensure valid seat counts
ALTER TABLE vehicles
ADD CONSTRAINT vehicles_seat_count_valid 
CHECK (seat_count > 0 AND seat_count <= 50);

-- Update existing vehicles to have default seat count based on type
UPDATE vehicles 
SET seat_count = CASE 
    WHEN type = 'sedan' THEN 4
    WHEN type = 'suv' THEN 5
    WHEN type = 'minivan' THEN 7
    WHEN type = 'motorcycle' THEN 1
    ELSE 4
END,
passenger_capacity = CASE 
    WHEN type = 'sedan' THEN 4
    WHEN type = 'suv' THEN 5
    WHEN type = 'minivan' THEN 7
    WHEN type = 'motorcycle' THEN 1
    ELSE 4
END
WHERE seat_count IS NULL OR passenger_capacity IS NULL;

-- Create index for seat_count queries
CREATE INDEX IF NOT EXISTS idx_vehicles_seat_count ON vehicles(seat_count);

COMMENT ON COLUMN vehicles.seat_count IS 'Number of passenger seats available in the vehicle';
COMMENT ON COLUMN vehicles.passenger_capacity IS 'Alias for seat_count - passenger capacity of the vehicle';

