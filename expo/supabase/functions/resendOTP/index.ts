/**
 * Resend OTP Edge Function
 * 
 * Resends the OTP to the same phone number.
 * 
 * POST /functions/v1/resendOTP
 * Body: { pinId: "xxx" }
 * 
 * Response: { success: true, pinId: "new-xxx", message: "OTP resent" }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resendOTP, is2FAConfigured } from "../_shared/infobip.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Check if Infobip 2FA is configured
    if (!is2FAConfigured()) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "OTP service not configured. Contact support.",
        }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse request
    const { pinId } = await req.json();

    if (!pinId) {
      return new Response(
        JSON.stringify({ success: false, error: "pinId is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Initialize Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if OTP request exists
    const { data: otpRequest, error: fetchError } = await supabase
      .from("otp_requests")
      .select("*")
      .eq("pin_id", pinId)
      .single();

    if (fetchError || !otpRequest) {
      return new Response(
        JSON.stringify({ success: false, error: "OTP request not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if already verified
    if (otpRequest.verified) {
      return new Response(
        JSON.stringify({ success: false, error: "OTP already verified" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check rate limit (max 3 resends)
    const resendCount = otpRequest.resend_count || 0;
    if (resendCount >= 3) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Maximum resend limit reached. Please start over.",
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Resend OTP via Infobip
    const result = await resendOTP(pinId);

    if (!result.success) {
      console.error("Failed to resend OTP:", result.error);
      return new Response(
        JSON.stringify({ success: false, error: result.error }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Update OTP request with new pinId
    await supabase
      .from("otp_requests")
      .update({
        pin_id: result.pinId,
        resend_count: resendCount + 1,
        attempts: 0, // Reset attempts on resend
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      })
      .eq("id", otpRequest.id);

    return new Response(
      JSON.stringify({
        success: true,
        pinId: result.pinId,
        message: "OTP resent successfully",
        resendsRemaining: 3 - (resendCount + 1),
        expiresIn: 600,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("resendOTP error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

