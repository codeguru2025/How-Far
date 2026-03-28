// Process Settlement - Admin approval and EcoCash payment
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { sendEcoCashPayment } from "../_shared/ecocash.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: "Auth required" }), 
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );
    
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_ANON_KEY") || "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ success: false, error: "Invalid auth" }), 
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Verify admin
    const { data: admin } = await supabase
      .from("admins")
      .select("id, pin_hash, is_active")
      .eq("user_id", user.id)
      .single();

    if (!admin?.is_active) {
      return new Response(JSON.stringify({ success: false, error: "Admin access required" }), 
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { settlement_id, admin_pin, action } = await req.json();

    // Verify PIN
    const pinHash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(admin_pin));
    const pinHashHex = Array.from(new Uint8Array(pinHash)).map(b => b.toString(16).padStart(2, "0")).join("");

    if (pinHashHex !== admin.pin_hash) {
      await supabase.from("admin_audit_log").insert({
        admin_id: admin.id, action: "pin_failed", entity_id: settlement_id
      });
      return new Response(JSON.stringify({ success: false, error: "Invalid PIN" }), 
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get settlement
    const { data: settlement } = await supabase
      .from("daily_settlements")
      .select("*")
      .eq("id", settlement_id)
      .single();

    if (!settlement) {
      return new Response(JSON.stringify({ success: false, error: "Not found" }), 
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const paymentRef = `HF-${Date.now()}-${settlement_id.substring(0, 8)}`;

    // Process based on action
    if (action === "approve_and_process") {
      await supabase.from("daily_settlements").update({
        status: "processing", approved_by: admin.id, approved_at: new Date().toISOString()
      }).eq("id", settlement_id);

      const payment = await sendEcoCashPayment({
        phoneNumber: settlement.ecocash_number || settlement.driver_phone,
        amount: settlement.payout_amount,
        reference: paymentRef,
      });

      const newStatus = payment.success ? "completed" : "failed";
      await supabase.from("daily_settlements").update({
        status: newStatus,
        payment_reference: payment.transactionId || paymentRef,
        payment_confirmed_at: payment.success ? new Date().toISOString() : null,
        payment_error: payment.error,
      }).eq("id", settlement_id);

      await supabase.from("admin_audit_log").insert({
        admin_id: admin.id,
        action: `settlement_${newStatus}`,
        entity_id: settlement_id,
        details: { amount: settlement.payout_amount, ref: paymentRef }
      });

      return new Response(JSON.stringify({
        success: payment.success,
        status: newStatus,
        payment_reference: paymentRef,
        message: payment.success ? `$${settlement.payout_amount} sent` : payment.error
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: false, error: "Invalid action" }), 
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: String(error) }), 
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

