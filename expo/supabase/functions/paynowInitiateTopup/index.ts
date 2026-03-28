// PayNow Initiate Top-up Edge Function
// Creates a payment request for wallet top-ups

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createServiceClient, createUserClient, getUserFromToken, generateReference } from "../_shared/supabase.ts";
import { initiatePayNowTransaction, formatPhoneForPayNow } from "../_shared/paynow.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TopupRequest {
  amount: number;
  phone?: string; // Optional, use user's phone if not provided
  currency?: string;
  idempotency_key?: string;
}

interface TopupResponse {
  success: boolean;
  transaction_id?: string;
  reference?: string;
  browser_url?: string;
  poll_url?: string;
  paynow_reference?: string;
  message?: string;
  error?: string;
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

    // Get user from token
    const user = await getUserFromToken(authHeader);
    if (!user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body: TopupRequest = await req.json();
    
    // Validate amount
    if (!body.amount || body.amount <= 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid amount. Must be greater than 0." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate minimum and maximum amounts
    const minAmount = 1.00;
    const maxAmount = 10000.00;
    
    if (body.amount < minAmount) {
      return new Response(
        JSON.stringify({ success: false, error: `Minimum top-up amount is ${minAmount}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (body.amount > maxAmount) {
      return new Response(
        JSON.stringify({ success: false, error: `Maximum top-up amount is ${maxAmount}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const serviceClient = createServiceClient();

    // Check idempotency
    if (body.idempotency_key) {
      const { data: existingTxn } = await serviceClient
        .from("transactions")
        .select("id, reference, status, paynow_reference")
        .eq("idempotency_key", body.idempotency_key)
        .single();

      if (existingTxn) {
        // Return existing transaction details
        return new Response(
          JSON.stringify({
            success: true,
            transaction_id: existingTxn.id,
            reference: existingTxn.reference,
            paynow_reference: existingTxn.paynow_reference,
            message: "Transaction already exists (idempotent request)",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Get user's wallet
    const { data: wallet, error: walletError } = await serviceClient
      .from("wallets")
      .select("id, daily_topup_limit")
      .eq("user_id", user.id)
      .single();

    if (walletError || !wallet) {
      return new Response(
        JSON.stringify({ success: false, error: "Wallet not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check daily limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { data: todayTopups } = await serviceClient
      .from("transactions")
      .select("amount")
      .eq("user_id", user.id)
      .eq("type", "topup")
      .eq("status", "completed")
      .gte("created_at", today.toISOString());

    const totalTodayTopups = (todayTopups || []).reduce((sum, t) => sum + Number(t.amount), 0);
    
    if (totalTodayTopups + body.amount > wallet.daily_topup_limit) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Daily top-up limit exceeded. Remaining: ${wallet.daily_topup_limit - totalTodayTopups}` 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate unique reference
    const reference = generateReference("TOPUP");
    const phone = body.phone || user.phone;

    // Create pending transaction
    const { data: transaction, error: txnError } = await serviceClient
      .from("transactions")
      .insert({
        user_id: user.id,
        to_wallet_id: wallet.id,
        type: "topup",
        status: "pending",
        amount: body.amount,
        currency: body.currency || "USD",
        fee: 0,
        reference: reference,
        description: `Wallet top-up via PayNow`,
        idempotency_key: body.idempotency_key || null,
        metadata: {
          phone: phone,
          initiated_at: new Date().toISOString(),
        },
      })
      .select()
      .single();

    if (txnError || !transaction) {
      console.error("Failed to create transaction:", txnError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to create transaction" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initiate PayNow transaction
    const paynowResult = await initiatePayNowTransaction({
      reference: reference,
      amount: body.amount,
      phone: formatPhoneForPayNow(phone),
      additionalInfo: `Ndeip-Zthin wallet top-up: ${reference}`,
    });

    if (!paynowResult.success) {
      // Mark transaction as failed
      await serviceClient
        .from("transactions")
        .update({
          status: "failed",
          metadata: {
            ...transaction.metadata,
            paynow_error: paynowResult.error,
          },
        })
        .eq("id", transaction.id);

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: paynowResult.error || "Failed to initiate PayNow transaction" 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update transaction with PayNow details
    await serviceClient
      .from("transactions")
      .update({
        paynow_reference: paynowResult.paynowReference,
        paynow_poll_url: paynowResult.pollUrl,
        paynow_status: paynowResult.status,
        metadata: {
          ...transaction.metadata,
          browser_url: paynowResult.browserUrl,
        },
      })
      .eq("id", transaction.id);

    // Return success response
    const response: TopupResponse = {
      success: true,
      transaction_id: transaction.id,
      reference: reference,
      browser_url: paynowResult.browserUrl,
      poll_url: paynowResult.pollUrl,
      paynow_reference: paynowResult.paynowReference,
      message: "Payment initiated. Complete payment on PayNow.",
    };

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Topup error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Internal server error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});



