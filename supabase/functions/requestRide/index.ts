// Request Ride Edge Function
// Works with custom auth (users table)
// Creates a ride request and initiates driver matching

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-id',
};

interface RideRequestBody {
  userId: string; // User ID from custom auth
  pickup: {
    latitude: number;
    longitude: number;
    address: string;
  };
  dropoff: {
    latitude: number;
    longitude: number;
    address: string;
  };
  vehicleType: 'sedan' | 'suv' | 'minivan' | 'motorcycle';
  estimatedDistance: number;
  estimatedDuration: number;
  estimatedPrice: number;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body: RideRequestBody = await req.json();

    // Validate request
    if (!body.userId || !body.pickup || !body.dropoff || !body.vehicleType) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user exists
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('id', body.userId)
      .single();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check user has sufficient wallet balance
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('balance')
      .eq('user_id', body.userId)
      .single();

    if (walletError || !wallet || wallet.balance < body.estimatedPrice) {
      return new Response(
        JSON.stringify({ 
          error: 'Insufficient wallet balance',
          required: body.estimatedPrice,
          available: wallet?.balance || 0
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create ride request
    const { data: request, error: requestError } = await supabase
      .from('ride_requests')
      .insert({
        user_id: body.userId,
        pickup_latitude: body.pickup.latitude,
        pickup_longitude: body.pickup.longitude,
        pickup_address: body.pickup.address,
        dropoff_latitude: body.dropoff.latitude,
        dropoff_longitude: body.dropoff.longitude,
        dropoff_address: body.dropoff.address,
        vehicle_type: body.vehicleType,
        estimated_distance: body.estimatedDistance,
        estimated_duration: body.estimatedDuration,
        estimated_price: body.estimatedPrice,
        status: 'matching',
      })
      .select()
      .single();

    if (requestError) {
      console.error('Error creating request:', requestError);
      return new Response(
        JSON.stringify({ error: 'Failed to create ride request' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find nearby drivers
    const { data: drivers, error: driversError } = await supabase
      .rpc('find_nearby_drivers', {
        p_latitude: body.pickup.latitude,
        p_longitude: body.pickup.longitude,
        p_vehicle_type: body.vehicleType,
        p_radius_km: 15,
      });

    if (driversError) {
      console.error('Error finding drivers:', driversError);
    }

    // If drivers found, match with closest available driver
    if (drivers && drivers.length > 0) {
      const matchedDriver = drivers[0];

      // Update request with matched driver
      await supabase
        .from('ride_requests')
        .update({
          status: 'matched',
          matched_driver_id: matchedDriver.driver_id,
          matched_at: new Date().toISOString(),
        })
        .eq('id', request.id);

      // Mark driver as unavailable
      await supabase
        .from('drivers')
        .update({ is_available: false })
        .eq('id', matchedDriver.driver_id);

      // Create the ride
      const { data: ride, error: rideError } = await supabase
        .from('rides')
        .insert({
          request_id: request.id,
          user_id: body.userId,
          driver_id: matchedDriver.driver_id,
          pickup_latitude: body.pickup.latitude,
          pickup_longitude: body.pickup.longitude,
          pickup_address: body.pickup.address,
          dropoff_latitude: body.dropoff.latitude,
          dropoff_longitude: body.dropoff.longitude,
          dropoff_address: body.dropoff.address,
          vehicle_type: body.vehicleType,
          distance: body.estimatedDistance,
          duration: body.estimatedDuration,
          base_price: body.estimatedPrice,
          status: 'driver_assigned',
        })
        .select()
        .single();

      if (rideError) {
        console.error('Error creating ride:', rideError);
        return new Response(
          JSON.stringify({ error: 'Failed to create ride' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          request_id: request.id,
          ride_id: ride.id,
          status: 'matched',
          driver: {
            id: matchedDriver.driver_id,
            name: `${matchedDriver.first_name} ${matchedDriver.last_name}`,
            rating: matchedDriver.rating,
            total_rides: matchedDriver.total_rides,
            distance_km: matchedDriver.distance_km,
            vehicle: matchedDriver.vehicle_info,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // No drivers available - return pending status
    return new Response(
      JSON.stringify({
        success: true,
        request_id: request.id,
        status: 'matching',
        message: 'Looking for available drivers...',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Request ride error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
