// SMS provider utilities for sending password reset tokens

interface SMSConfig {
  provider: string;
  apiKey?: string;
  accountSid?: string;
  authToken?: string;
  phoneNumber?: string;
  senderId?: string;
  apiUrl?: string;
}

interface SMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Get SMS configuration from environment
 */
function getSMSConfig(): SMSConfig {
  return {
    provider: Deno.env.get("SMS_PROVIDER") || "twilio",
    apiKey: Deno.env.get("SMS_PROVIDER_KEY"),
    accountSid: Deno.env.get("TWILIO_ACCOUNT_SID"),
    authToken: Deno.env.get("TWILIO_AUTH_TOKEN"),
    phoneNumber: Deno.env.get("TWILIO_PHONE_NUMBER"),
    senderId: Deno.env.get("SMS_PROVIDER_SENDER_ID") || "NdeipZthin",
    apiUrl: Deno.env.get("SMS_PROVIDER_URL"),
  };
}

/**
 * Check if SMS is in dev mode (logs instead of sending)
 */
function isDevMode(): boolean {
  return Deno.env.get("SMS_DEV_MODE") === "true";
}

/**
 * Send SMS via Twilio
 */
async function sendViaTwilio(to: string, message: string, config: SMSConfig): Promise<SMSResult> {
  if (!config.accountSid || !config.authToken || !config.phoneNumber) {
    throw new Error("Twilio configuration incomplete");
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`;
  
  const auth = btoa(`${config.accountSid}:${config.authToken}`);
  
  const body = new URLSearchParams({
    To: to,
    From: config.phoneNumber,
    Body: message,
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const data = await response.json();

  if (!response.ok) {
    return {
      success: false,
      error: data.message || "Failed to send SMS via Twilio",
    };
  }

  return {
    success: true,
    messageId: data.sid,
  };
}

/**
 * Send SMS via AfricasTalking
 */
async function sendViaAfricasTalking(to: string, message: string, config: SMSConfig): Promise<SMSResult> {
  const username = Deno.env.get("AT_USERNAME");
  const apiKey = Deno.env.get("AT_API_KEY");
  
  if (!username || !apiKey) {
    throw new Error("AfricasTalking configuration incomplete");
  }

  const url = "https://api.africastalking.com/version1/messaging";
  
  const body = new URLSearchParams({
    username: username,
    to: to,
    message: message,
    from: config.senderId || "",
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "apiKey": apiKey,
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json",
    },
    body: body.toString(),
  });

  const data = await response.json();

  if (!response.ok || data.SMSMessageData?.Recipients?.[0]?.status !== "Success") {
    return {
      success: false,
      error: data.SMSMessageData?.Message || "Failed to send SMS via AfricasTalking",
    };
  }

  return {
    success: true,
    messageId: data.SMSMessageData?.Recipients?.[0]?.messageId,
  };
}

/**
 * Send SMS via generic HTTP API
 */
async function sendViaGenericAPI(to: string, message: string, config: SMSConfig): Promise<SMSResult> {
  if (!config.apiUrl || !config.apiKey) {
    throw new Error("Generic SMS API configuration incomplete");
  }

  const response = await fetch(config.apiUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: to,
      message: message,
      sender_id: config.senderId,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    return {
      success: false,
      error: data.message || "Failed to send SMS",
    };
  }

  return {
    success: true,
    messageId: data.message_id || data.id,
  };
}

/**
 * Send an SMS message
 */
export async function sendSMS(to: string, message: string): Promise<SMSResult> {
  // Check dev mode first
  if (isDevMode()) {
    console.log(`[SMS Dev Mode] Would send to ${to}:`, message);
    return {
      success: true,
      messageId: `DEV-${Date.now()}`,
    };
  }

  const config = getSMSConfig();

  try {
    switch (config.provider.toLowerCase()) {
      case "twilio":
        return await sendViaTwilio(to, message, config);
      
      case "africas_talking":
      case "africastalking":
        return await sendViaAfricasTalking(to, message, config);
      
      case "generic":
      default:
        return await sendViaGenericAPI(to, message, config);
    }
  } catch (error) {
    console.error("SMS send error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown SMS error",
    };
  }
}

/**
 * Send password reset token via SMS
 */
export async function sendPasswordResetSMS(phone: string, token: string): Promise<SMSResult> {
  const message = `Your Ndeip-Zthin password reset code is: ${token}. This code expires in 15 minutes. Do not share this code with anyone.`;
  
  return await sendSMS(phone, message);
}

/**
 * Send ride notification SMS
 */
export async function sendRideNotificationSMS(phone: string, rideDetails: {
  passengerName: string;
  driverName: string;
  vehicleInfo: string;
  tripShareUrl?: string;
}): Promise<SMSResult> {
  const message = `Ndeip-Zthin: ${rideDetails.passengerName} has started a ride with ${rideDetails.driverName} (${rideDetails.vehicleInfo}).${rideDetails.tripShareUrl ? ` Track: ${rideDetails.tripShareUrl}` : ''}`;
  
  return await sendSMS(phone, message);
}

/**
 * Send SOS alert SMS to guardians
 */
export async function sendSOSAlertSMS(phone: string, alert: {
  userName: string;
  location: string;
}): Promise<SMSResult> {
  const message = `🆘 EMERGENCY: ${alert.userName} has triggered an SOS alert on Ndeip-Zthin. Location: ${alert.location}. Please check on them immediately.`;
  
  return await sendSMS(phone, message);
}



