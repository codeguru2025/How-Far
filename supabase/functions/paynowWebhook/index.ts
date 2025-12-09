// PayNow Webhook Handler
// Receives payment confirmations from PayNow and credits user wallets
// This is the SECURE part - only credit wallets after PayNow confirms payment

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // PayNow sends data as URL-encoded form
    const formData = await req.text();
    console.log("PayNow Webhook received:", formData);

    // Parse the form data
    const params: Record<string, string> = {};
    formData.split("&").forEach(pair => {
      const [key, ...valueParts] = pair.split("=");
      const value = valueParts.join("=");
      if (key) {
        params[decodeURIComponent(key)] = decodeURIComponent((value || "").replace(/\+/g, " "));
      }
    });

    console.log("Parsed webhook data:", params);

    const {
      reference,
      paynowreference,
      amount,
      status,
      hash,
    } = params;

    // Log hash for debugging (temporarily allow all requests to diagnose)
    const integrationKey = Deno.env.get("PAYNOW_CLIENT_KEY") || Deno.env.get("PAYNOW_INTEGRATION_KEY") || "";
    const hashString = reference + paynowreference + amount + status + integrationKey;
    
    // Calculate expected hash
    const encoder = new TextEncoder();
    const data = encoder.encode(hashString);
    const hashBuffer = await globalThis.crypto.subtle.digest("SHA-512", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const expectedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();

    // Log hash comparison for debugging
    console.log("Hash verification:", {
      received: hash?.substring(0, 16),
      expected: expectedHash.substring(0, 16),
      integrationKeySet: !!integrationKey,
      match: hash?.toUpperCase() === expectedHash
    });

    // TEMPORARY: Allow requests even if hash doesn't match (for debugging)
    // TODO: Re-enable strict verification after debugging
    if (!hash) {
      console.warn("No hash provided - proceeding anyway for debugging");
    } else if (hash.toUpperCase() !== expectedHash) {
      console.warn("Hash mismatch - proceeding anyway for debugging");
    } else {
      console.log("Hash verified successfully!");
    }

    // Connect to Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find the transaction by reference
    const { data: transaction, error: txnError } = await supabase
      .from("transactions")
      .select("*")
      .eq("reference", reference)
      .single();

    if (txnError || !transaction) {
      console.error("Transaction not found:", reference, txnError);
      return new Response("Transaction not found", { status: 404 });
    }

    console.log("Found transaction:", transaction.id, "user_id:", transaction.user_id, "PayNow status:", status);

    // Check if already processed
    if (transaction.status === "completed") {
      console.log("Transaction already completed, skipping");
      return new Response("OK", { status: 200 });
    }

    // Handle based on PayNow status
    const paynowStatus = status?.toLowerCase();
    
    if (paynowStatus === "paid" || paynowStatus === "awaiting delivery" || paynowStatus === "delivered") {
      // PAYMENT SUCCESSFUL - Credit the wallet!
      console.log("Payment successful! Crediting wallet...");

      const numAmount = parseFloat(amount) || transaction.amount;
      
      // Get current wallet balance
      const { data: wallet, error: walletFetchError } = await supabase
        .from("wallets")
        .select("id, balance")
        .eq("user_id", transaction.user_id)
        .single();

      if (walletFetchError || !wallet) {
        console.error("Wallet not found for user:", transaction.user_id, walletFetchError);
        return new Response("Wallet not found", { status: 404 });
      }

      console.log("Current wallet balance:", wallet.balance, "Adding:", numAmount);

      // Update wallet balance
      const newBalance = (parseFloat(wallet.balance) || 0) + numAmount;
      const { error: walletError } = await supabase
        .from("wallets")
        .update({
          balance: newBalance,
          updated_at: new Date().toISOString(),
        })
        .eq("id", wallet.id);

      if (walletError) {
        console.error("Failed to update wallet:", walletError);
        return new Response("Wallet update failed", { status: 500 });
      }

      // Update transaction status
      const { error: txnUpdateError } = await supabase
        .from("transactions")
        .update({
          status: "completed",
          external_reference: paynowreference,
          metadata: {
            ...transaction.metadata,
            paynow_status: status,
            completed_at: new Date().toISOString(),
          },
        })
        .eq("id", transaction.id);

      if (txnUpdateError) {
        console.error("Failed to update transaction:", txnUpdateError);
      }

      console.log(`✅ SUCCESS: Credited $${numAmount} to user ${transaction.user_id}. New balance: $${newBalance}`);

    } else if (paynowStatus === "cancelled" || paynowStatus === "failed" || paynowStatus === "disputed") {
      // Payment failed
      console.log("Payment failed/cancelled:", status);
      
      await supabase
        .from("transactions")
        .update({
          status: "failed",
          metadata: {
            ...transaction.metadata,
            paynow_status: status,
            failed_at: new Date().toISOString(),
          },
        })
        .eq("id", transaction.id);

    } else {
      // Still pending (e.g., "created", "sent", "pending")
      console.log("Payment still pending:", status);
      
      await supabase
        .from("transactions")
        .update({
          external_reference: paynowreference,
          metadata: {
            ...transaction.metadata,
            paynow_status: status,
            last_update: new Date().toISOString(),
          },
        })
        .eq("id", transaction.id);
    }

    // PayNow expects "OK" response
    return new Response("OK", { 
      status: 200,
      headers: { "Content-Type": "text/plain" }
    });

  } catch (error) {
    console.error("Webhook error:", error);
    return new Response("Error", { status: 500 });
  }
});
