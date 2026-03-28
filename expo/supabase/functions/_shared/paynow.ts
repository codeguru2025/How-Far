// PayNow (Zimbabwe) payment gateway integration utilities

import { encode as base64Encode } from "https://deno.land/std@0.177.0/encoding/base64.ts";
import { hmac } from "https://deno.land/x/hmac@v2.0.1/mod.ts";

// PayNow API endpoints
const PAYNOW_INIT_URL = "https://www.paynow.co.zw/interface/initiatetransaction";
const PAYNOW_STATUS_URL = "https://www.paynow.co.zw/interface/pollstatus";

// PayNow status codes
export enum PayNowStatus {
  Created = "Created",
  Sent = "Sent",
  Paid = "Paid",
  Awaiting_Delivery = "Awaiting Delivery",
  Delivered = "Delivered",
  Cancelled = "Cancelled",
  Refunded = "Refunded",
  Disputed = "Disputed",
}

export interface PayNowConfig {
  merchantId: string;
  clientKey: string;
  clientSecret: string;
  webhookSecret: string;
  resultUrl: string;
  returnUrl: string;
}

export interface PayNowInitRequest {
  reference: string;
  amount: number;
  email?: string;
  phone: string;
  additionalInfo?: string;
}

export interface PayNowInitResponse {
  success: boolean;
  status: string;
  browserUrl?: string;
  pollUrl?: string;
  hash?: string;
  paynowReference?: string;
  error?: string;
}

export interface PayNowWebhookPayload {
  reference: string;
  paynowreference: string;
  amount: string;
  status: string;
  pollurl: string;
  hash: string;
}

/**
 * Get PayNow configuration from environment variables
 */
export function getPayNowConfig(): PayNowConfig {
  const merchantId = Deno.env.get("PAYNOW_MERCHANT_ID");
  const clientKey = Deno.env.get("PAYNOW_CLIENT_KEY");
  const clientSecret = Deno.env.get("PAYNOW_CLIENT_SECRET");
  const webhookSecret = Deno.env.get("PAYNOW_WEBHOOK_SECRET");
  const resultUrl = Deno.env.get("PAYNOW_RESULT_URL") || "";
  const returnUrl = Deno.env.get("PAYNOW_RETURN_URL") || "";

  if (!merchantId || !clientKey || !clientSecret || !webhookSecret) {
    throw new Error("Missing PayNow configuration. Ensure PAYNOW_MERCHANT_ID, PAYNOW_CLIENT_KEY, PAYNOW_CLIENT_SECRET, and PAYNOW_WEBHOOK_SECRET are set.");
  }

  return {
    merchantId,
    clientKey,
    clientSecret,
    webhookSecret,
    resultUrl,
    returnUrl,
  };
}

/**
 * Generate PayNow request hash
 * PayNow uses a hash to verify request integrity
 */
export function generatePayNowHash(values: string[], secret: string): string {
  const concatenated = values.join("");
  const hash = hmac("sha512", secret, concatenated, "utf8", "hex");
  return hash.toUpperCase();
}

/**
 * Verify PayNow webhook signature
 */
export function verifyWebhookSignature(payload: PayNowWebhookPayload, secret: string): boolean {
  // PayNow webhook hash is computed from specific fields
  const values = [
    payload.reference,
    payload.paynowreference,
    payload.amount,
    payload.status,
    payload.pollurl,
  ];
  
  const expectedHash = generatePayNowHash(values, secret);
  
  // Constant-time comparison
  if (expectedHash.length !== payload.hash.length) {
    return false;
  }
  
  let diff = 0;
  for (let i = 0; i < expectedHash.length; i++) {
    diff |= expectedHash.charCodeAt(i) ^ payload.hash.charCodeAt(i);
  }
  
  return diff === 0;
}

/**
 * URL encode a value for PayNow
 */
function urlEncode(value: string): string {
  return encodeURIComponent(value).replace(/%20/g, "+");
}

/**
 * Build form-urlencoded body for PayNow
 */
function buildFormBody(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([key, value]) => `${urlEncode(key)}=${urlEncode(value)}`)
    .join("&");
}

/**
 * Parse PayNow response
 */
function parsePayNowResponse(responseText: string): Record<string, string> {
  const result: Record<string, string> = {};
  
  // PayNow returns URL-encoded key=value pairs separated by &
  const pairs = responseText.split("&");
  for (const pair of pairs) {
    const [key, value] = pair.split("=");
    if (key && value !== undefined) {
      result[decodeURIComponent(key)] = decodeURIComponent(value.replace(/\+/g, " "));
    }
  }
  
  return result;
}

/**
 * Initiate a PayNow transaction
 */
export async function initiatePayNowTransaction(request: PayNowInitRequest): Promise<PayNowInitResponse> {
  const config = getPayNowConfig();
  
  // Check if we're in dev mode
  const devMode = Deno.env.get("PAYNOW_DEV_MODE") === "true";
  
  if (devMode) {
    // Return mock response for development
    console.log("[PayNow Dev Mode] Mocking initiate transaction:", request);
    return {
      success: true,
      status: "Ok",
      browserUrl: `https://www.paynow.co.zw/payment/mock/${request.reference}`,
      pollUrl: `https://www.paynow.co.zw/interface/pollstatus?guid=mock-${request.reference}`,
      paynowReference: `PN-MOCK-${Date.now()}`,
    };
  }
  
  // Build request parameters
  const params: Record<string, string> = {
    id: config.merchantId,
    reference: request.reference,
    amount: request.amount.toFixed(2),
    additionalinfo: request.additionalInfo || `Wallet top-up: ${request.reference}`,
    returnurl: config.returnUrl,
    resulturl: config.resultUrl,
    status: "Message",
  };
  
  // Add auth method for mobile money
  if (request.phone) {
    params.authemail = request.email || "";
    params.phone = request.phone;
  }
  
  // Generate hash
  const hashValues = [
    params.id,
    params.reference,
    params.amount,
    params.additionalinfo,
    params.returnurl,
    params.resulturl,
    params.status,
  ];
  params.hash = generatePayNowHash(hashValues, config.clientSecret);
  
  try {
    const response = await fetch(PAYNOW_INIT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: buildFormBody(params),
    });
    
    const responseText = await response.text();
    const parsedResponse = parsePayNowResponse(responseText);
    
    if (parsedResponse.status?.toLowerCase() === "error") {
      return {
        success: false,
        status: "Error",
        error: parsedResponse.error || "Unknown PayNow error",
      };
    }
    
    return {
      success: true,
      status: parsedResponse.status || "Ok",
      browserUrl: parsedResponse.browserurl,
      pollUrl: parsedResponse.pollurl,
      paynowReference: parsedResponse.paynowreference,
      hash: parsedResponse.hash,
    };
  } catch (error) {
    console.error("PayNow initiate error:", error);
    return {
      success: false,
      status: "Error",
      error: error instanceof Error ? error.message : "Failed to connect to PayNow",
    };
  }
}

/**
 * Poll PayNow for transaction status
 */
export async function pollPayNowStatus(pollUrl: string): Promise<{
  success: boolean;
  status: string;
  paynowReference?: string;
  error?: string;
}> {
  const devMode = Deno.env.get("PAYNOW_DEV_MODE") === "true";
  
  if (devMode) {
    console.log("[PayNow Dev Mode] Mocking poll status for:", pollUrl);
    return {
      success: true,
      status: PayNowStatus.Paid,
      paynowReference: "PN-MOCK-PAID",
    };
  }
  
  try {
    const response = await fetch(pollUrl);
    const responseText = await response.text();
    const parsedResponse = parsePayNowResponse(responseText);
    
    return {
      success: parsedResponse.status?.toLowerCase() !== "error",
      status: parsedResponse.status || "Unknown",
      paynowReference: parsedResponse.paynowreference,
      error: parsedResponse.error,
    };
  } catch (error) {
    console.error("PayNow poll error:", error);
    return {
      success: false,
      status: "Error",
      error: error instanceof Error ? error.message : "Failed to poll PayNow",
    };
  }
}

/**
 * Check if a PayNow status indicates successful payment
 */
export function isPaymentSuccessful(status: string): boolean {
  const successStatuses = [
    PayNowStatus.Paid.toLowerCase(),
    PayNowStatus.Awaiting_Delivery.toLowerCase(),
    PayNowStatus.Delivered.toLowerCase(),
  ];
  return successStatuses.includes(status.toLowerCase());
}

/**
 * Format phone number for PayNow (Zimbabwe format)
 */
export function formatPhoneForPayNow(phone: string): string {
  // Remove any non-digit characters except +
  let cleaned = phone.replace(/[^\d+]/g, "");
  
  // If starts with +263, convert to local format
  if (cleaned.startsWith("+263")) {
    cleaned = "0" + cleaned.substring(4);
  } else if (cleaned.startsWith("263")) {
    cleaned = "0" + cleaned.substring(3);
  }
  
  return cleaned;
}



