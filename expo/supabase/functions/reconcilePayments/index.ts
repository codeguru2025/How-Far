// Reconcile Payments - Check PayNow for pending transactions and credit wallets
// Call this to recover missed webhook payments

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user_id from request (optional - if not provided, reconcile all)
    let userId: string | null = null;
    try {
      const body = await req.json();
      userId = body.user_id;
    } catch {
      // No body provided, that's fine
    }

    console.log("Starting payment reconciliation...", userId ? `for user ${userId}` : "for all users");

    // Get all pending transactions with poll URLs
    let query = supabase
      .from("transactions")
      .select("*")
      .eq("status", "pending")
      .not("paynow_poll_url", "is", null);

    if (userId) {
      query = query.eq("user_id", userId);
    }

    const { data: pendingTxns, error: fetchError } = await query;

    if (fetchError) {
      console.error("Error fetching transactions:", fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!pendingTxns || pendingTxns.length === 0) {
      return new Response(JSON.stringify({ 
        message: "No pending transactions to reconcile",
        reconciled: 0 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${pendingTxns.length} pending transactions to check`);

    let reconciledCount = 0;
    let totalCredited = 0;
    const results: any[] = [];

    for (const txn of pendingTxns) {
      try {
        console.log(`Checking ${txn.reference}...`);

        // Poll PayNow for status
        const pollResponse = await fetch(txn.paynow_poll_url);
        const pollText = await pollResponse.text();
        
        console.log(`PayNow response for ${txn.reference}:`, pollText);

        // Parse PayNow response (URL encoded)
        const params: Record<string, string> = {};
        pollText.split("&").forEach(pair => {
          const [key, value] = pair.split("=");
          if (key) {
            params[decodeURIComponent(key).toLowerCase()] = decodeURIComponent((value || "").replace(/\+/g, " "));
          }
        });

        const paynowStatus = params.status?.toLowerCase();
        console.log(`PayNow status for ${txn.reference}: ${paynowStatus}`);

        if (paynowStatus === "paid" || paynowStatus === "awaiting delivery" || paynowStatus === "delivered") {
          // Payment is confirmed! Credit the wallet
          console.log(`✅ Payment ${txn.reference} is PAID! Crediting wallet...`);

          // Get current wallet balance
          const { data: wallet, error: walletFetchError } = await supabase
            .from("wallets")
            .select("id, balance")
            .eq("user_id", txn.user_id)
            .single();

          if (walletFetchError || !wallet) {
            console.error(`Wallet not found for user ${txn.user_id}`);
            results.push({ reference: txn.reference, status: "error", error: "Wallet not found" });
            continue;
          }

          // Update wallet balance
          const newBalance = (parseFloat(wallet.balance) || 0) + txn.amount;
          const { error: walletUpdateError } = await supabase
            .from("wallets")
            .update({ balance: newBalance, updated_at: new Date().toISOString() })
            .eq("id", wallet.id);

          if (walletUpdateError) {
            console.error(`Failed to update wallet:`, walletUpdateError);
            results.push({ reference: txn.reference, status: "error", error: "Wallet update failed" });
            continue;
          }

          // Update transaction status
          await supabase
            .from("transactions")
            .update({
              status: "completed",
              metadata: {
                ...txn.metadata,
                paynow_status: paynowStatus,
                reconciled_at: new Date().toISOString(),
              },
            })
            .eq("id", txn.id);

          reconciledCount++;
          totalCredited += txn.amount;
          results.push({ 
            reference: txn.reference, 
            status: "credited", 
            amount: txn.amount,
            newBalance: newBalance 
          });

          console.log(`✅ Credited $${txn.amount} to wallet. New balance: $${newBalance}`);

        } else if (paynowStatus === "cancelled" || paynowStatus === "failed") {
          // Mark as failed
          await supabase
            .from("transactions")
            .update({
              status: "failed",
              metadata: { ...txn.metadata, paynow_status: paynowStatus, reconciled_at: new Date().toISOString() },
            })
            .eq("id", txn.id);

          results.push({ reference: txn.reference, status: "failed", paynow_status: paynowStatus });

        } else {
          // Still pending
          results.push({ reference: txn.reference, status: "still_pending", paynow_status: paynowStatus });
        }

      } catch (pollError) {
        console.error(`Error polling ${txn.reference}:`, pollError);
        results.push({ reference: txn.reference, status: "error", error: String(pollError) });
      }
    }

    const response = {
      message: `Reconciliation complete`,
      checked: pendingTxns.length,
      reconciled: reconciledCount,
      totalCredited: totalCredited,
      results: results,
    };

    console.log("Reconciliation complete:", response);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Reconciliation error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

