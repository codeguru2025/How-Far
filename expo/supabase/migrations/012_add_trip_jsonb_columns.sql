-- Migration: Add JSONB origin/destination columns to trips table
-- The app expects JSONB columns for origin and destination, but the schema has separate lat/lng/address columns
-- This migration adds the JSONB columns to support the app's expected format

-- Add origin as JSONB column (contains latitude, longitude, address)
ALTER TABLE trips 
ADD COLUMN IF NOT EXISTS origin JSONB;

-- Add destination as JSONB column (contains latitude, longitude, address)
ALTER TABLE trips 
ADD COLUMN IF NOT EXISTS destination JSONB;

-- Add waypoints as JSONB array column
ALTER TABLE trips 
ADD COLUMN IF NOT EXISTS waypoints JSONB DEFAULT '[]'::jsonb;

-- Add owner_id column (references the user who created the trip)
ALTER TABLE trips 
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES users(id);

-- Add seats_total column (alias for total_seats)
ALTER TABLE trips 
ADD COLUMN IF NOT EXISTS seats_total INTEGER DEFAULT 4;

-- Add seats_available column (alias for available_seats)  
ALTER TABLE trips 
ADD COLUMN IF NOT EXISTS seats_available INTEGER DEFAULT 4;

-- Migrate existing data from separate columns to JSONB
UPDATE trips 
SET 
  origin = jsonb_build_object(
    'latitude', origin_latitude,
    'longitude', origin_longitude,
    'address', COALESCE(origin_address, 'Unknown')
  ),
  destination = jsonb_build_object(
    'latitude', destination_latitude,
    'longitude', destination_longitude,
    'address', COALESCE(destination_address, 'Unknown')
  ),
  seats_total = COALESCE(total_seats, 4),
  seats_available = COALESCE(available_seats, 4)
WHERE origin IS NULL OR destination IS NULL;

-- Create index on origin for location-based queries
CREATE INDEX IF NOT EXISTS idx_trips_origin_jsonb ON trips USING GIN (origin);

-- Create index on destination for location-based queries
CREATE INDEX IF NOT EXISTS idx_trips_destination_jsonb ON trips USING GIN (destination);

-- Add comment
COMMENT ON COLUMN trips.origin IS 'JSONB object with latitude, longitude, address for trip origin';
COMMENT ON COLUMN trips.destination IS 'JSONB object with latitude, longitude, address for trip destination';
COMMENT ON COLUMN trips.waypoints IS 'JSONB array of waypoint objects with latitude, longitude, address, order';

