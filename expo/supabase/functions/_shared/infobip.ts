/**
 * Infobip 2FA OTP Service
 * 
 * This module provides OTP (One-Time Password) functionality using Infobip's 2FA API.
 * 
 * Required environment variables:
 * - INFOBIP_API_KEY: Your Infobip API key
 * - INFOBIP_BASE_URL: Your Infobip base URL (e.g., xxxxx.api.infobip.com)
 * - INFOBIP_2FA_APP_ID: Your 2FA application ID (created via API or dashboard)
 * - INFOBIP_2FA_MESSAGE_ID: Your 2FA message template ID
 */

// Types
interface InfobipConfig {
  apiKey: string;
  baseUrl: string;
  appId: string;
  messageId: string;
}

interface SendOTPResult {
  success: boolean;
  pinId?: string;
  to?: string;
  ncStatus?: string;
  error?: string;
}

interface VerifyOTPResult {
  success: boolean;
  pinId?: string;
  msisdn?: string;
  verified?: boolean;
  attemptsRemaining?: number;
  error?: string;
}

interface ResendOTPResult {
  success: boolean;
  pinId?: string;
  to?: string;
  ncStatus?: string;
  error?: string;
}

interface Create2FAAppResult {
  success: boolean;
  applicationId?: string;
  name?: string;
  error?: string;
}

interface Create2FAMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Get Infobip configuration from environment
 */
function getInfobipConfig(): InfobipConfig {
  return {
    apiKey: Deno.env.get("INFOBIP_API_KEY") || "",
    baseUrl: Deno.env.get("INFOBIP_BASE_URL") || "",
    appId: Deno.env.get("INFOBIP_2FA_APP_ID") || "",
    messageId: Deno.env.get("INFOBIP_2FA_MESSAGE_ID") || "",
  };
}

/**
 * Check if Infobip is properly configured
 */
export function isInfobipConfigured(): boolean {
  const config = getInfobipConfig();
  return !!(config.apiKey && config.baseUrl);
}

/**
 * Check if 2FA is fully configured (has app and message IDs)
 */
export function is2FAConfigured(): boolean {
  const config = getInfobipConfig();
  return !!(config.apiKey && config.baseUrl && config.appId && config.messageId);
}

/**
 * Make authenticated request to Infobip API
 */
async function infobipRequest<T>(
  endpoint: string,
  method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
  body?: unknown
): Promise<{ success: boolean; data?: T; error?: string; status?: number }> {
  const config = getInfobipConfig();
  
  if (!config.apiKey || !config.baseUrl) {
    return { success: false, error: "Infobip not configured" };
  }

  // Use the base URL directly (could be "api.infobip.com" or "xxxxx.api.infobip.com")
  const baseUrl = config.baseUrl.includes('://') ? config.baseUrl : `https://${config.baseUrl}`;
  const url = `${baseUrl}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      method,
      headers: {
        "Authorization": `App ${config.apiKey}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Infobip API error:", data);
      return {
        success: false,
        error: data.requestError?.serviceException?.text || 
               data.requestError?.serviceException?.messageId ||
               `HTTP ${response.status}`,
        status: response.status,
      };
    }

    return { success: true, data, status: response.status };
  } catch (error) {
    console.error("Infobip request error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

// ============================================
// 2FA APPLICATION MANAGEMENT
// ============================================

/**
 * Create a 2FA Application
 * 
 * This is typically done once during setup. The applicationId should be 
 * saved to INFOBIP_2FA_APP_ID environment variable.
 */
export async function create2FAApplication(
  name: string = "How Far OTP"
): Promise<Create2FAAppResult> {
  const result = await infobipRequest<{
    applicationId: string;
    name: string;
    configuration: unknown;
  }>("/2fa/2/applications", "POST", {
    name,
    enabled: true,
    configuration: {
      pinAttempts: 5,          // Max attempts to verify PIN
      allowMultiplePinVerifications: false,
      pinTimeToLive: "10m",    // PIN expires in 10 minutes
      verifyPinLimit: "1/3s",  // Rate limit: 1 verification per 3 seconds
      sendPinPerApplicationLimit: "100/1d", // Rate limit per application
      sendPinPerPhoneNumberLimit: "5/1d",   // Rate limit per phone number
    },
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  console.log("Created 2FA Application:", result.data);
  
  return {
    success: true,
    applicationId: result.data?.applicationId,
    name: result.data?.name,
  };
}

/**
 * Create a 2FA Message Template
 * 
 * This is typically done once during setup. The messageId should be 
 * saved to INFOBIP_2FA_MESSAGE_ID environment variable.
 */
export async function create2FAMessageTemplate(
  applicationId: string
): Promise<Create2FAMessageResult> {
  const result = await infobipRequest<{
    messageId: string;
    applicationId: string;
    messageText: string;
    pinLength: number;
    pinType: string;
    senderId: string;
  }>(`/2fa/2/applications/${applicationId}/messages`, "POST", {
    messageText: "Your How Far verification code is: {{pin}}. Valid for 10 minutes. Do not share this code.",
    pinLength: 6,
    pinType: "NUMERIC",
    senderId: "HowFar",
    language: "en",
    repeatDTMF: "1#",
    speechRate: 1,
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  console.log("Created 2FA Message Template:", result.data);
  
  return {
    success: true,
    messageId: result.data?.messageId,
  };
}

// ============================================
// OTP OPERATIONS
// ============================================

/**
 * Send OTP to a phone number
 * 
 * @param phoneNumber - Phone number in international format (e.g., +263771234567)
 * @returns SendOTPResult with pinId for verification
 */
export async function sendOTP(phoneNumber: string): Promise<SendOTPResult> {
  const config = getInfobipConfig();
  
  if (!config.appId || !config.messageId) {
    return { success: false, error: "2FA not configured. Run setup first." };
  }

  // Normalize phone number (ensure + prefix)
  const normalizedPhone = phoneNumber.startsWith("+") 
    ? phoneNumber 
    : `+${phoneNumber}`;

  const result = await infobipRequest<{
    pinId: string;
    to: string;
    ncStatus: string;
    smsStatus: string;
  }>("/2fa/2/pin", "POST", {
    applicationId: config.appId,
    messageId: config.messageId,
    from: "HowFar",
    to: normalizedPhone,
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  console.log(`OTP sent to ${normalizedPhone}, pinId: ${result.data?.pinId}`);

  return {
    success: true,
    pinId: result.data?.pinId,
    to: result.data?.to,
    ncStatus: result.data?.ncStatus,
  };
}

/**
 * Verify OTP entered by user
 * 
 * @param pinId - The pinId returned from sendOTP
 * @param pin - The OTP code entered by the user
 * @returns VerifyOTPResult indicating success or failure
 */
export async function verifyOTP(pinId: string, pin: string): Promise<VerifyOTPResult> {
  const result = await infobipRequest<{
    pinId: string;
    msisdn: string;
    verified: boolean;
    attemptsRemaining: number;
  }>(`/2fa/2/pin/${pinId}/verify`, "POST", {
    pin,
  });

  if (!result.success) {
    // Check if it's a verification failure (wrong PIN)
    if (result.status === 400) {
      return {
        success: true, // Request succeeded, but verification failed
        verified: false,
        pinId,
        error: result.error || "Invalid PIN",
      };
    }
    return { success: false, error: result.error };
  }

  return {
    success: true,
    pinId: result.data?.pinId,
    msisdn: result.data?.msisdn,
    verified: result.data?.verified,
    attemptsRemaining: result.data?.attemptsRemaining,
  };
}

/**
 * Resend OTP to the same phone number
 * 
 * @param pinId - The pinId from the original sendOTP call
 * @returns ResendOTPResult with new pinId
 */
export async function resendOTP(pinId: string): Promise<ResendOTPResult> {
  const result = await infobipRequest<{
    pinId: string;
    to: string;
    ncStatus: string;
    smsStatus: string;
  }>(`/2fa/2/pin/${pinId}/resend`, "POST");

  if (!result.success) {
    return { success: false, error: result.error };
  }

  console.log(`OTP resent, new pinId: ${result.data?.pinId}`);

  return {
    success: true,
    pinId: result.data?.pinId,
    to: result.data?.to,
    ncStatus: result.data?.ncStatus,
  };
}

/**
 * Get OTP status
 * 
 * @param pinId - The pinId to check
 * @returns Status information about the PIN
 */
export async function getOTPStatus(pinId: string): Promise<{
  success: boolean;
  pinId?: string;
  to?: string;
  verified?: boolean;
  attemptsRemaining?: number;
  error?: string;
}> {
  const result = await infobipRequest<{
    pinId: string;
    to: string;
    verified: boolean;
    attemptsRemaining: number;
  }>(`/2fa/2/pin/${pinId}/status`, "GET");

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return {
    success: true,
    pinId: result.data?.pinId,
    to: result.data?.to,
    verified: result.data?.verified,
    attemptsRemaining: result.data?.attemptsRemaining,
  };
}

// ============================================
// SETUP HELPER
// ============================================

/**
 * Setup Infobip 2FA (creates application and message template)
 * 
 * Run this once to get the applicationId and messageId, then save them
 * as environment variables.
 */
export async function setup2FA(): Promise<{
  success: boolean;
  applicationId?: string;
  messageId?: string;
  error?: string;
}> {
  console.log("Setting up Infobip 2FA...");

  // Step 1: Create application
  const appResult = await create2FAApplication("How Far OTP");
  if (!appResult.success || !appResult.applicationId) {
    return { success: false, error: `Failed to create application: ${appResult.error}` };
  }

  console.log(`Application created: ${appResult.applicationId}`);

  // Step 2: Create message template
  const msgResult = await create2FAMessageTemplate(appResult.applicationId);
  if (!msgResult.success || !msgResult.messageId) {
    return { success: false, error: `Failed to create message template: ${msgResult.error}` };
  }

  console.log(`Message template created: ${msgResult.messageId}`);

  console.log("\n=== SAVE THESE VALUES ===");
  console.log(`INFOBIP_2FA_APP_ID=${appResult.applicationId}`);
  console.log(`INFOBIP_2FA_MESSAGE_ID=${msgResult.messageId}`);
  console.log("========================\n");

  return {
    success: true,
    applicationId: appResult.applicationId,
    messageId: msgResult.messageId,
  };
}

