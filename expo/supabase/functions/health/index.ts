// Health Check Endpoint
// Use this to monitor if the Edge Functions are working

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

  const checks: Record<string, { status: string; latency?: number; error?: string }> = {};
  const startTime = Date.now();

  // Check Supabase connection
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const dbStart = Date.now();
    const { error } = await supabase.from("users").select("id").limit(1);
    const dbLatency = Date.now() - dbStart;
    
    if (error) {
      checks.database = { status: "error", error: error.message };
    } else {
      checks.database = { status: "ok", latency: dbLatency };
    }
  } catch (e: any) {
    checks.database = { status: "error", error: e.message };
  }

  // Check PayNow config
  const paynowKey = Deno.env.get("PAYNOW_CLIENT_KEY");
  checks.paynow = {
    status: paynowKey ? "configured" : "missing",
  };

  // Overall status
  const allOk = Object.values(checks).every(c => c.status === "ok" || c.status === "configured");
  const totalLatency = Date.now() - startTime;

  const response = {
    status: allOk ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    latency: totalLatency,
    version: "1.0.0",
    checks,
  };

  return new Response(JSON.stringify(response, null, 2), {
    status: allOk ? 200 : 503,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

