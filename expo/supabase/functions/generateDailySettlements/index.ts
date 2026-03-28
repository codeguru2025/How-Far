// Generate Daily Settlements Edge Function
// Runs at midnight to create settlement records for the previous day
// Can be triggered by a cron job or manually

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SettlementResult {
  success: boolean;
  settlements_created?: number;
  total_amount?: number;
  batch_id?: string;
  error?: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // This function can be called by:
    // 1. Supabase cron (no auth needed - use service role)
    // 2. Admin manually (needs auth)
    
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    // Optional: Check for secret token for cron jobs
    const cronToken = req.headers.get("x-cron-token");
    const expectedToken = Deno.env.get("CRON_SECRET_TOKEN");
    
    if (cronToken && expectedToken && cronToken !== expectedToken) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid cron token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Starting daily settlement generation...");
    
    const settlementDate = new Date();
    settlementDate.setDate(settlementDate.getDate() - 1); // Yesterday
    const dateStr = settlementDate.toISOString().split('T')[0];

    // Check if settlements already exist for this date
    const { data: existingBatch } = await supabase
      .from("settlement_batches")
      .select("id")
      .eq("batch_date", dateStr)
      .single();

    if (existingBatch) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Settlements already generated for ${dateStr}`,
          batch_id: existingBatch.id 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all completed bookings from yesterday
    const startOfDay = `${dateStr}T00:00:00.000Z`;
    const endOfDay = `${dateStr}T23:59:59.999Z`;

    const { data: bookings, error: bookingsError } = await supabase
      .from("bookings")
      .select(`
        id,
        fare,
        trip_id,
        paid_at,
        trips!inner(
          id,
          driver_id,
          drivers!inner(
            id,
            user_id,
            users!inner(
              id,
              first_name,
              last_name,
              phone_number
            )
          )
        )
      `)
      .eq("payment_status", "paid")
      .gte("paid_at", startOfDay)
      .lte("paid_at", endOfDay);

    if (bookingsError) {
      console.error("Error fetching bookings:", bookingsError);
      throw new Error("Failed to fetch bookings");
    }

    if (!bookings || bookings.length === 0) {
      // Create empty batch
      const { data: batch } = await supabase
        .from("settlement_batches")
        .insert({
          batch_date: dateStr,
          status: "completed",
          total_settlements: 0,
          total_amount: 0,
          completed_at: new Date().toISOString()
        })
        .select()
        .single();

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No bookings to settle for this date",
          settlements_created: 0,
          total_amount: 0,
          batch_id: batch?.id
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Group bookings by driver
    const driverEarnings = new Map<string, {
      driver_id: string;
      driver_user_id: string;
      driver_name: string;
      driver_phone: string;
      total_fare: number;
      booking_ids: string[];
    }>();

    for (const booking of bookings) {
      const trip = booking.trips as any;
      const driver = trip.drivers;
      const user = driver.users;
      const driverId = driver.id;

      if (!driverEarnings.has(driverId)) {
        driverEarnings.set(driverId, {
          driver_id: driverId,
          driver_user_id: driver.user_id,
          driver_name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
          driver_phone: user.phone_number,
          total_fare: 0,
          booking_ids: [],
        });
      }

      const earnings = driverEarnings.get(driverId)!;
      earnings.total_fare += Number(booking.fare || 0);
      earnings.booking_ids.push(booking.id);
    }

    // Create batch
    const { data: batch, error: batchError } = await supabase
      .from("settlement_batches")
      .insert({
        batch_date: dateStr,
        status: "pending",
        total_settlements: driverEarnings.size,
      })
      .select()
      .single();

    if (batchError) {
      throw new Error("Failed to create settlement batch");
    }

    // Platform fee: 7.5% already deducted during booking
    // Driver gets 92.5% of fare (already calculated)
    const platformFeeRate = 0.075;
    
    // Create settlement records
    const settlements = [];
    let totalPayoutAmount = 0;

    for (const [_, earnings] of driverEarnings) {
      const platformFee = Number((earnings.total_fare * platformFeeRate).toFixed(2));
      const payoutAmount = Number((earnings.total_fare - platformFee).toFixed(2));
      totalPayoutAmount += payoutAmount;

      settlements.push({
        settlement_date: dateStr,
        driver_id: earnings.driver_id,
        driver_user_id: earnings.driver_user_id,
        driver_name: earnings.driver_name,
        driver_phone: earnings.driver_phone,
        ecocash_number: earnings.driver_phone,
        gross_earnings: earnings.total_fare,
        platform_fee: platformFee,
        payout_amount: payoutAmount,
        booking_ids: earnings.booking_ids,
        booking_count: earnings.booking_ids.length,
        status: "pending",
      });
    }

    // Insert all settlements
    const { error: settlementsError } = await supabase
      .from("daily_settlements")
      .insert(settlements);

    if (settlementsError) {
      console.error("Error creating settlements:", settlementsError);
      throw new Error("Failed to create settlement records");
    }

    // Update batch total
    await supabase
      .from("settlement_batches")
      .update({ total_amount: totalPayoutAmount })
      .eq("id", batch.id);

    // Notify all admins
    const { data: admins } = await supabase
      .from("admins")
      .select("id")
      .eq("is_active", true);

    if (admins && admins.length > 0) {
      const notifications = admins.map(admin => ({
        admin_id: admin.id,
        title: "New Settlements Ready",
        body: `${settlements.length} driver settlements ($${totalPayoutAmount.toFixed(2)}) ready for approval`,
        type: "settlement",
        data: { batch_id: batch.id, count: settlements.length, amount: totalPayoutAmount }
      }));

      await supabase.from("admin_notifications").insert(notifications);
    }

    console.log(`Created ${settlements.length} settlements, total: $${totalPayoutAmount.toFixed(2)}`);

    const result: SettlementResult = {
      success: true,
      settlements_created: settlements.length,
      total_amount: totalPayoutAmount,
      batch_id: batch.id,
    };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Settlement generation error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Settlement generation failed" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

