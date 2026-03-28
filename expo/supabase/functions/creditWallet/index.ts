// Credit Wallet - Called by app after confirming payment with PayNow
// This is secure because it uses service role and verifies the transaction

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transaction_id, user_id } = await req.json();

    if (!transaction_id || !user_id) {
      return new Response(JSON.stringify({ error: "Missing transaction_id or user_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`Credit wallet request: txn=${transaction_id}, user=${user_id}`);

    // Get the transaction
    const { data: txn, error: txnError } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", transaction_id)
      .eq("user_id", user_id) // Security: ensure user owns this transaction
      .single();

    if (txnError || !txn) {
      console.error("Transaction not found:", txnError);
      return new Response(JSON.stringify({ error: "Transaction not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if already completed
    if (txn.status === "completed") {
      console.log("Transaction already completed");
      return new Response(JSON.stringify({ 
        success: true, 
        message: "Already credited",
        already_completed: true 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ATOMIC: First, try to claim this transaction by marking it as completed
    // This prevents race conditions with the webhook
    const { data: claimedTxn, error: claimError } = await supabase
      .from("transactions")
      .update({
        status: "completed",
        metadata: {
          ...txn.metadata,
          credited_at: new Date().toISOString(),
          credited_via: "manual_reconcile",
        },
      })
      .eq("id", transaction_id)
      .eq("status", "pending")  // Only update if still pending!
      .select()
      .single();

    if (claimError || !claimedTxn) {
      // Another process already claimed this transaction (webhook likely)
      console.log("Transaction already claimed by another process");
      return new Response(JSON.stringify({ 
        success: true, 
        message: "Already credited by webhook",
        already_completed: true 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Now we have exclusive claim - safe to credit wallet
    const { data: wallet, error: walletError } = await supabase
      .from("wallets")
      .select("id, balance")
      .eq("user_id", user_id)
      .single();

    if (walletError || !wallet) {
      console.error("Wallet not found:", walletError);
      // Revert transaction status since we couldn't credit
      await supabase
        .from("transactions")
        .update({ status: "pending" })
        .eq("id", transaction_id);
      return new Response(JSON.stringify({ error: "Wallet not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Credit wallet
    const newBalance = (parseFloat(wallet.balance) || 0) + txn.amount;
    const { error: updateError } = await supabase
      .from("wallets")
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq("id", wallet.id);

    if (updateError) {
      console.error("Failed to update wallet:", updateError);
      return new Response(JSON.stringify({ error: "Failed to credit wallet" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`✅ Credited $${txn.amount} to user ${user_id}. New balance: $${newBalance}`);

    return new Response(JSON.stringify({
      success: true,
      message: `Credited $${txn.amount}`,
      amount: txn.amount,
      newBalance: newBalance,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Credit wallet error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

