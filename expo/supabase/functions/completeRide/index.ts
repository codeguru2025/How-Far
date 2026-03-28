// Complete Ride Edge Function
// Works with custom auth (users table)
// Handles ride completion and payment processing

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-id',
};

interface CompleteRideBody {
  userId: string; // User ID from custom auth
  rideId: string;
  actualDistance?: number;
  actualDuration?: number;
  tipAmount?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body: CompleteRideBody = await req.json();

    if (!body.userId || !body.rideId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get ride details
    const { data: ride, error: rideError } = await supabase
      .from('rides')
      .select('*, drivers(*)')
      .eq('id', body.rideId)
      .single();

    if (rideError || !ride) {
      return new Response(
        JSON.stringify({ error: 'Ride not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the request is from ride participant
    const isRider = ride.user_id === body.userId;
    const isDriver = ride.drivers?.user_id === body.userId;

    if (!isRider && !isDriver) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate final price
    const finalPrice = ride.base_price + (body.tipAmount || 0);

    // Process payment from rider's wallet
    const { data: riderWallet, error: riderWalletError } = await supabase
      .from('wallets')
      .select('id, balance')
      .eq('user_id', ride.user_id)
      .single();

    if (riderWalletError || !riderWallet || riderWallet.balance < finalPrice) {
      return new Response(
        JSON.stringify({ error: 'Insufficient balance for payment' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Deduct from rider wallet
    const { error: deductError } = await supabase
      .from('wallets')
      .update({ 
        balance: riderWallet.balance - finalPrice,
        updated_at: new Date().toISOString()
      })
      .eq('id', riderWallet.id);

    if (deductError) {
      console.error('Deduct error:', deductError);
      return new Response(
        JSON.stringify({ error: 'Payment processing failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create transaction record for rider
    await supabase
      .from('transactions')
      .insert({
        user_id: ride.user_id,
        type: 'ride_payment',
        amount: finalPrice,
        status: 'completed',
        reference: `RIDE-${ride.id.substring(0, 8).toUpperCase()}`,
        description: `Ride payment to ${ride.dropoff_address}`,
      });

    // Credit driver (80% of ride fare, platform takes 20%)
    const driverEarnings = ride.base_price * 0.8;
    
    if (ride.drivers?.user_id) {
      const { data: driverWallet } = await supabase
        .from('wallets')
        .select('id, balance')
        .eq('user_id', ride.drivers.user_id)
        .single();

      if (driverWallet) {
        await supabase
          .from('wallets')
          .update({ 
            balance: driverWallet.balance + driverEarnings + (body.tipAmount || 0),
            updated_at: new Date().toISOString()
          })
          .eq('id', driverWallet.id);

        // Create transaction for driver
        await supabase
          .from('transactions')
          .insert({
            user_id: ride.drivers.user_id,
            type: 'ride_earnings',
            amount: driverEarnings + (body.tipAmount || 0),
            status: 'completed',
            reference: `EARN-${ride.id.substring(0, 8).toUpperCase()}`,
            description: `Ride earnings from ${ride.pickup_address}`,
          });
      }
    }

    // Update ride as completed
    await supabase
      .from('rides')
      .update({
        status: 'completed',
        payment_status: 'completed',
        final_price: finalPrice,
        tip_amount: body.tipAmount || 0,
        distance: body.actualDistance || ride.distance,
        duration: body.actualDuration || ride.duration,
        completed_at: new Date().toISOString(),
      })
      .eq('id', body.rideId);

    // Mark driver as available again
    if (ride.drivers) {
      await supabase
        .from('drivers')
        .update({ 
          is_available: true,
          total_rides: (ride.drivers.total_rides || 0) + 1,
          total_earnings: (ride.drivers.total_earnings || 0) + driverEarnings,
        })
        .eq('id', ride.driver_id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        ride_id: body.rideId,
        final_price: finalPrice,
        payment_status: 'completed',
        message: 'Ride completed and payment processed',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Complete ride error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
