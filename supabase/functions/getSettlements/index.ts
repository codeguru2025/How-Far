// Get Settlements - Admin endpoint to fetch pending settlements
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

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
      return new Response(JSON.stringify({ error: "Auth required" }), 
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
      return new Response(JSON.stringify({ error: "Invalid auth" }), 
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Verify admin
    const { data: admin } = await supabase
      .from("admins")
      .select("id, is_active")
      .eq("user_id", user.id)
      .single();

    if (!admin?.is_active) {
      return new Response(JSON.stringify({ error: "Admin access required" }), 
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const url = new URL(req.url);
    const status = url.searchParams.get("status") || "pending";
    const date = url.searchParams.get("date");

    let query = supabase
      .from("daily_settlements")
      .select("*")
      .order("created_at", { ascending: false });

    if (status !== "all") {
      query = query.eq("status", status);
    }
    if (date) {
      query = query.eq("settlement_date", date);
    }

    const { data: settlements, error } = await query.limit(100);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), 
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get batch summary
    const { data: batches } = await supabase
      .from("settlement_batches")
      .select("*")
      .order("batch_date", { ascending: false })
      .limit(7);

    // Calculate totals
    const pendingTotal = settlements?.filter(s => s.status === "pending")
      .reduce((sum, s) => sum + Number(s.payout_amount), 0) || 0;
    const todayCompleted = settlements?.filter(s => s.status === "completed")
      .reduce((sum, s) => sum + Number(s.payout_amount), 0) || 0;

    return new Response(JSON.stringify({
      settlements,
      batches,
      summary: {
        pending_count: settlements?.filter(s => s.status === "pending").length || 0,
        pending_total: pendingTotal,
        completed_today: todayCompleted,
      }
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), 
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

