// PayNow Payment Initiation - Production
// Real PayNow API integration for EcoCash, OneMoney, InnBucks, Bank

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// PayNow API endpoints - try both HTTP and HTTPS
const PAYNOW_URLS = [
  "https://www.paynow.co.zw/interface/initiatetransaction",
  "https://paynow.co.zw/interface/initiatetransaction",
];

interface PaymentRequest {
  user_id: string;
  amount: number;
  phone: string;
  reference: string;
  payment_method: "ecocash" | "onemoney" | "innbucks" | "bank";
  transaction_id?: string;
}

// Retry fetch with multiple URLs
async function fetchWithRetry(urls: string[], options: RequestInit, maxRetries = 2): Promise<Response> {
  let lastError: Error | null = null;
  
  for (const url of urls) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Attempting ${url} (attempt ${attempt + 1})`);
        const response = await fetch(url, {
          ...options,
          // Add timeout via AbortController
          signal: AbortSignal.timeout(30000),
        });
        return response;
      } catch (error) {
        console.error(`Attempt ${attempt + 1} failed for ${url}:`, error);
        lastError = error instanceof Error ? error : new Error(String(error));
        // Wait before retry
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
    }
  }
  
  throw lastError || new Error("All fetch attempts failed");
}

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: PaymentRequest = await req.json();
    
    // Validate required fields
    if (!body.user_id || !body.amount || !body.phone || !body.reference) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get PayNow credentials from environment
    const merchantId = Deno.env.get("PAYNOW_MERCHANT_ID");
    const integrationKey = Deno.env.get("PAYNOW_CLIENT_KEY");
    const integrationSecret = Deno.env.get("PAYNOW_CLIENT_SECRET");
    const resultUrl = Deno.env.get("PAYNOW_RESULT_URL") || "https://example.com/paynow/result";
    const returnUrl = Deno.env.get("PAYNOW_RETURN_URL") || "https://example.com/paynow/return";

    console.log("PayNow Config Check:", {
      merchantId: merchantId ? `SET (${merchantId})` : "MISSING",
      integrationKey: integrationKey ? "SET" : "MISSING", 
      integrationSecret: integrationSecret ? "SET" : "MISSING",
      resultUrl,
      returnUrl,
    });

    if (!merchantId || !integrationKey || !integrationSecret) {
      return new Response(
        JSON.stringify({ success: false, error: "PayNow not configured. Please set PAYNOW_MERCHANT_ID, PAYNOW_CLIENT_KEY, PAYNOW_CLIENT_SECRET secrets." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format phone for PayNow (0771234567 format)
    let phone = body.phone.replace(/[^\d]/g, "");
    if (phone.startsWith("263")) {
      phone = "0" + phone.substring(3);
    } else if (!phone.startsWith("0")) {
      phone = "0" + phone;
    }

    // Build PayNow request
    const paynowParams: Record<string, string> = {
      id: merchantId,
      reference: body.reference,
      amount: body.amount.toFixed(2),
      additionalinfo: "Ndeip-Zthin wallet top-up",
      returnurl: returnUrl,
      resulturl: resultUrl,
      status: "Message",
    };

    // Add mobile money parameters for EcoCash/OneMoney
    if (body.payment_method === "ecocash" || body.payment_method === "onemoney") {
      paynowParams.authemail = "";
      paynowParams.phone = phone;
      paynowParams.method = body.payment_method;
    }

    // Generate hash - PayNow uses SHA512
    const hashValues = [
      paynowParams.id,
      paynowParams.reference,
      paynowParams.amount,
      paynowParams.additionalinfo,
      paynowParams.returnurl,
      paynowParams.resulturl,
      paynowParams.status,
    ];
    
    const hashString = hashValues.join("") + integrationSecret;
    const encoder = new TextEncoder();
    const data = encoder.encode(hashString);
    const hashBuffer = await globalThis.crypto.subtle.digest("SHA-512", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    paynowParams.hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();

    console.log("Request params:", {
      reference: body.reference,
      amount: body.amount,
      phone: phone,
      method: body.payment_method,
    });

    // Build form body
    const formBody = Object.entries(paynowParams)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join("&");

    console.log("Form body:", formBody);

    // Call PayNow API with retry
    let paynowResponse: Response;
    try {
      paynowResponse = await fetchWithRetry(PAYNOW_URLS, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "Mozilla/5.0 (compatible; Ndeip-Zthin/1.0)",
          "Accept": "*/*",
        },
        body: formBody,
      });
    } catch (fetchError) {
      console.error("All PayNow fetch attempts failed:", fetchError);
      
      // Return a helpful error with instructions
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `PayNow connection failed: ${fetchError instanceof Error ? fetchError.message : 'Network error'}. PayNow may be blocking cloud server requests. Please try again or use the web interface.`,
          debug: {
            merchant_id: merchantId,
            reference: body.reference,
            amount: body.amount,
            phone: phone,
          }
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const responseText = await paynowResponse.text();
    console.log("PayNow Response Status:", paynowResponse.status);
    console.log("PayNow Response:", responseText);

    // Parse PayNow response (URL encoded format)
    const parsedResponse: Record<string, string> = {};
    responseText.split("&").forEach(pair => {
      const [key, ...valueParts] = pair.split("=");
      const value = valueParts.join("=");
      if (key && value !== undefined) {
        parsedResponse[decodeURIComponent(key)] = decodeURIComponent(value.replace(/\+/g, " "));
      }
    });

    console.log("Parsed response:", parsedResponse);

    // Check for errors
    if (parsedResponse.status?.toLowerCase() === "error") {
      console.error("PayNow Error:", parsedResponse.error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: parsedResponse.error || "PayNow transaction failed" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update transaction in database
    if (body.transaction_id) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        await supabase
          .from("transactions")
          .update({
            external_reference: parsedResponse.paynowreference,
            paynow_poll_url: parsedResponse.pollurl,
            status: "pending",
            metadata: {
              browser_url: parsedResponse.browserurl,
              instructions: parsedResponse.instructions,
              paynow_status: parsedResponse.status,
            },
          })
          .eq("id", body.transaction_id);
      } catch (dbError) {
        console.error("Database update error:", dbError);
        // Continue even if DB update fails
      }
    }

    // Parse instructions if present
    let instructions = null;
    if (parsedResponse.instructions) {
      try {
        instructions = JSON.parse(parsedResponse.instructions);
      } catch {
        instructions = { raw: parsedResponse.instructions };
      }
    }

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        status: parsedResponse.status,
        paynow_reference: parsedResponse.paynowreference,
        poll_url: parsedResponse.pollurl,
        browser_url: parsedResponse.browserurl,
        instructions: instructions,
        message: body.payment_method === "ecocash" || body.payment_method === "onemoney"
          ? `Payment request sent to ${phone}. Check your ${body.payment_method === "ecocash" ? "EcoCash" : "OneMoney"} for approval.`
          : "Payment initiated successfully",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Payment initiation error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Internal server error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
