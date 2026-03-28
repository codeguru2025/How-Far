/**
 * Send OTP Edge Function
 * 
 * Sends a one-time password to a phone number for verification.
 * 
 * POST /functions/v1/sendOTP
 * Body: { phoneNumber: "+263771234567" }
 * 
 * Response: { success: true, pinId: "xxx", message: "OTP sent" }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendOTP, is2FAConfigured } from "../_shared/infobip.ts";

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
    const { phoneNumber, purpose } = await req.json();

    if (!phoneNumber) {
      return new Response(
        JSON.stringify({ success: false, error: "Phone number is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Normalize phone number
    let normalizedPhone = phoneNumber.replace(/\s+/g, "");
    
    // Handle Zimbabwe numbers
    if (normalizedPhone.startsWith("0")) {
      normalizedPhone = "+263" + normalizedPhone.substring(1);
    } else if (!normalizedPhone.startsWith("+")) {
      normalizedPhone = "+" + normalizedPhone;
    }

    // Validate phone format
    const phoneRegex = /^\+[1-9]\d{6,14}$/;
    if (!phoneRegex.test(normalizedPhone)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid phone number format" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check rate limiting (optional - store pending OTPs in DB)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if there's a recent OTP for this number
    const { data: existingOTP } = await supabase
      .from("otp_requests")
      .select("*")
      .eq("phone_number", normalizedPhone)
      .eq("verified", false)
      .gte("created_at", new Date(Date.now() - 60000).toISOString()) // Last 1 minute
      .single();

    if (existingOTP) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Please wait 1 minute before requesting another OTP",
          retryAfter: 60,
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Send OTP via Infobip
    const result = await sendOTP(normalizedPhone);

    if (!result.success) {
      console.error("Failed to send OTP:", result.error);
      return new Response(
        JSON.stringify({ success: false, error: result.error }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Store OTP request in database for tracking
    await supabase.from("otp_requests").insert({
      phone_number: normalizedPhone,
      pin_id: result.pinId,
      purpose: purpose || "verification",
      verified: false,
      attempts: 0,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
    });

    return new Response(
      JSON.stringify({
        success: true,
        pinId: result.pinId,
        message: "OTP sent successfully",
        expiresIn: 600, // 10 minutes in seconds
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("sendOTP error:", error);
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

