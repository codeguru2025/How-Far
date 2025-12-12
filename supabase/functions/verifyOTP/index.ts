/**
 * Verify OTP Edge Function
 * 
 * Verifies the OTP code entered by the user.
 * 
 * POST /functions/v1/verifyOTP
 * Body: { pinId: "xxx", pin: "123456" }
 * 
 * Response: { success: true, verified: true, message: "Phone verified" }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyOTP, is2FAConfigured } from "../_shared/infobip.ts";

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
    const { pinId, pin } = await req.json();

    if (!pinId || !pin) {
      return new Response(
        JSON.stringify({ success: false, error: "pinId and pin are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate PIN format (6 digits)
    const pinRegex = /^\d{6}$/;
    if (!pinRegex.test(pin)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid PIN format. Must be 6 digits." }),
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

    // Check if OTP request exists and is not expired
    const { data: otpRequest, error: fetchError } = await supabase
      .from("otp_requests")
      .select("*")
      .eq("pin_id", pinId)
      .single();

    if (fetchError || !otpRequest) {
      return new Response(
        JSON.stringify({ success: false, error: "OTP request not found or expired" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if already verified
    if (otpRequest.verified) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          verified: true, 
          message: "Already verified",
          phoneNumber: otpRequest.phone_number,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if expired
    if (new Date(otpRequest.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ success: false, error: "OTP has expired. Please request a new one." }),
        {
          status: 410,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check max attempts (5 attempts max)
    if (otpRequest.attempts >= 5) {
      return new Response(
        JSON.stringify({ success: false, error: "Too many attempts. Please request a new OTP." }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Increment attempts
    await supabase
      .from("otp_requests")
      .update({ attempts: otpRequest.attempts + 1 })
      .eq("id", otpRequest.id);

    // Verify OTP via Infobip
    const result = await verifyOTP(pinId, pin);

    if (!result.success) {
      console.error("OTP verification failed:", result.error);
      return new Response(
        JSON.stringify({ success: false, error: result.error }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!result.verified) {
      const remaining = 5 - (otpRequest.attempts + 1);
      return new Response(
        JSON.stringify({
          success: true,
          verified: false,
          error: "Incorrect PIN",
          attemptsRemaining: remaining,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Mark as verified in database
    await supabase
      .from("otp_requests")
      .update({
        verified: true,
        verified_at: new Date().toISOString(),
      })
      .eq("id", otpRequest.id);

    // If this is for user verification, update user record
    if (otpRequest.purpose === "registration" || otpRequest.purpose === "verification") {
      await supabase
        .from("users")
        .update({ phone_verified: true, phone_verified_at: new Date().toISOString() })
        .eq("phone_number", otpRequest.phone_number);
    }

    return new Response(
      JSON.stringify({
        success: true,
        verified: true,
        message: "Phone number verified successfully",
        phoneNumber: otpRequest.phone_number,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("verifyOTP error:", error);
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

