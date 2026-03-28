// Create Transaction Edge Function
// Handles QR-based ride payments from passenger wallet to driver

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createServiceClient, getUserFromToken, generateReference } from "../_shared/supabase.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TransactionRequest {
  driver_session_token: string; // From QR code scan
  amount: number;
  ride_id?: string;
  idempotency_key?: string;
  tip_amount?: number;
}

interface TransactionResponse {
  success: boolean;
  transaction_id?: string;
  reference?: string;
  passenger_new_balance?: number;
  message?: string;
  error?: string;
}

/**
 * Verify driver session token and get driver info
 */
async function verifyDriverSession(
  serviceClient: ReturnType<typeof createServiceClient>,
  sessionToken: string
): Promise<{ valid: boolean; driver?: { id: string; user_id: string; wallet_id: string }; error?: string }> {
  // Find driver by session token
  const { data: driver, error } = await serviceClient
    .from("drivers")
    .select(`
      id,
      user_id,
      qr_session_token,
      qr_session_expires,
      users!inner(id)
    `)
    .eq("qr_session_token", sessionToken)
    .single();

  if (error || !driver) {
    return { valid: false, error: "Invalid driver session token" };
  }

  // Check expiry
  if (driver.qr_session_expires && new Date(driver.qr_session_expires) < new Date()) {
    return { valid: false, error: "Driver session token expired" };
  }

  // Get driver's wallet
  const { data: wallet } = await serviceClient
    .from("wallets")
    .select("id")
    .eq("user_id", driver.user_id)
    .single();

  if (!wallet) {
    return { valid: false, error: "Driver wallet not found" };
  }

  return {
    valid: true,
    driver: {
      id: driver.id,
      user_id: driver.user_id,
      wallet_id: wallet.id,
    },
  };
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get passenger from token
    const passenger = await getUserFromToken(authHeader);
    if (!passenger) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body: TransactionRequest = await req.json();

    // Validate required fields
    if (!body.driver_session_token) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing driver session token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!body.amount || body.amount <= 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid amount" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const totalAmount = body.amount + (body.tip_amount || 0);
    const serviceClient = createServiceClient();

    // Check idempotency
    if (body.idempotency_key) {
      const { data: existingTxn } = await serviceClient
        .from("transactions")
        .select("id, reference, status")
        .eq("idempotency_key", body.idempotency_key)
        .single();

      if (existingTxn) {
        return new Response(
          JSON.stringify({
            success: true,
            transaction_id: existingTxn.id,
            reference: existingTxn.reference,
            message: "Transaction already exists (idempotent request)",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Verify driver session token
    const driverVerification = await verifyDriverSession(serviceClient, body.driver_session_token);
    if (!driverVerification.valid || !driverVerification.driver) {
      return new Response(
        JSON.stringify({ success: false, error: driverVerification.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const driver = driverVerification.driver;

    // Prevent self-payment
    if (driver.user_id === passenger.id) {
      return new Response(
        JSON.stringify({ success: false, error: "Cannot pay yourself" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get passenger wallet
    const { data: passengerWallet, error: walletError } = await serviceClient
      .from("wallets")
      .select("id, balance, daily_spend_limit")
      .eq("user_id", passenger.id)
      .single();

    if (walletError || !passengerWallet) {
      return new Response(
        JSON.stringify({ success: false, error: "Passenger wallet not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check sufficient balance
    if (passengerWallet.balance < totalAmount) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Insufficient balance",
          current_balance: passengerWallet.balance,
          required_amount: totalAmount,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check daily spend limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { data: todaySpends } = await serviceClient
      .from("transactions")
      .select("amount")
      .eq("user_id", passenger.id)
      .eq("type", "ride_payment")
      .eq("status", "completed")
      .gte("created_at", today.toISOString());

    const totalTodaySpends = (todaySpends || []).reduce((sum, t) => sum + Number(t.amount), 0);
    
    if (totalTodaySpends + totalAmount > passengerWallet.daily_spend_limit) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Daily spend limit exceeded. Remaining: ${passengerWallet.daily_spend_limit - totalTodaySpends}` 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate reference
    const reference = generateReference("RIDE");

    // Calculate platform fee (e.g., 10%)
    const platformFeePercentage = 0.10;
    const platformFee = Number((body.amount * platformFeePercentage).toFixed(2));
    const driverNetAmount = body.amount - platformFee + (body.tip_amount || 0);

    // Start transaction
    // Debit passenger wallet
    const newPassengerBalance = Number((passengerWallet.balance - totalAmount).toFixed(2));
    
    const { error: debitError } = await serviceClient
      .from("wallets")
      .update({ balance: newPassengerBalance })
      .eq("id", passengerWallet.id);

    if (debitError) {
      console.error("Failed to debit passenger wallet:", debitError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to process payment" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Credit driver's pending balance
    const { data: driverWallet } = await serviceClient
      .from("wallets")
      .select("pending_balance")
      .eq("id", driver.wallet_id)
      .single();

    const newPendingBalance = Number(((driverWallet?.pending_balance || 0) + driverNetAmount).toFixed(2));
    
    const { error: creditError } = await serviceClient
      .from("wallets")
      .update({ pending_balance: newPendingBalance })
      .eq("id", driver.wallet_id);

    if (creditError) {
      // Rollback passenger debit
      await serviceClient
        .from("wallets")
        .update({ balance: passengerWallet.balance })
        .eq("id", passengerWallet.id);

      console.error("Failed to credit driver wallet:", creditError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to process payment" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create transaction record
    const { data: transaction, error: txnError } = await serviceClient
      .from("transactions")
      .insert({
        user_id: passenger.id,
        from_wallet_id: passengerWallet.id,
        to_wallet_id: driver.wallet_id,
        type: "ride_payment",
        status: "completed",
        amount: totalAmount,
        fee: platformFee,
        currency: "USD",
        reference: reference,
        ride_id: body.ride_id || null,
        description: `Ride payment to driver`,
        idempotency_key: body.idempotency_key || null,
        completed_at: new Date().toISOString(),
        metadata: {
          driver_id: driver.id,
          tip_amount: body.tip_amount || 0,
          platform_fee: platformFee,
          driver_net_amount: driverNetAmount,
        },
      })
      .select()
      .single();

    if (txnError) {
      console.error("Failed to create transaction record:", txnError);
      // Note: Payment already processed, log for reconciliation
    }

    // Update ride if ride_id provided
    if (body.ride_id && transaction) {
      await serviceClient
        .from("rides")
        .update({
          is_paid: true,
          payment_transaction_id: transaction.id,
          actual_fare: body.amount,
        })
        .eq("id", body.ride_id);
    }

    // Update driver stats
    await serviceClient
      .from("drivers")
      .update({
        total_rides: serviceClient.rpc ? undefined : undefined, // Increment would use RPC
      })
      .eq("id", driver.id);

    // Log to audit
    await serviceClient
      .from("audit_log")
      .insert({
        user_id: passenger.id,
        action: "ride_payment_completed",
        table_name: "transactions",
        record_id: transaction?.id,
        new_values: {
          amount: totalAmount,
          reference: reference,
          driver_id: driver.id,
        },
      });

    const response: TransactionResponse = {
      success: true,
      transaction_id: transaction?.id,
      reference: reference,
      passenger_new_balance: newPassengerBalance,
      message: "Payment successful",
    };

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Transaction error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Internal server error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});



