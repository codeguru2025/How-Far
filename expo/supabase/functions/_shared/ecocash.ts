// EcoCash Payment Integration
// Secure payment to driver phone numbers via EcoCash

export interface EcoCashConfig {
  merchantCode: string;
  merchantPin: string;
  apiUrl: string;
  apiKey: string;
}

export interface EcoCashPaymentRequest {
  phoneNumber: string;      // Recipient phone (format: 263XXXXXXXXX)
  amount: number;           // Amount in USD
  reference: string;        // Unique reference
  narration?: string;       // Description
}

export interface EcoCashPaymentResponse {
  success: boolean;
  transactionId?: string;
  reference?: string;
  message?: string;
  error?: string;
}

function getConfig(): EcoCashConfig {
  return {
    merchantCode: Deno.env.get("ECOCASH_MERCHANT_CODE") || "",
    merchantPin: Deno.env.get("ECOCASH_MERCHANT_PIN") || "",
    apiUrl: Deno.env.get("ECOCASH_API_URL") || "https://api.ecocash.co.zw/v1",
    apiKey: Deno.env.get("ECOCASH_API_KEY") || "",
  };
}

// Format phone number for EcoCash (263XXXXXXXXX)
export function formatPhoneForEcoCash(phone: string): string {
  // Remove all non-digits
  let cleaned = phone.replace(/\D/g, "");
  
  // Handle different formats
  if (cleaned.startsWith("0")) {
    // Local format: 077XXXXXXX -> 26377XXXXXXX
    cleaned = "263" + cleaned.substring(1);
  } else if (cleaned.startsWith("263")) {
    // Already in international format
    // Nothing to do
  } else if (cleaned.startsWith("+263")) {
    cleaned = cleaned.substring(1);
  } else if (cleaned.length === 9) {
    // Just the number without country code: 77XXXXXXX
    cleaned = "263" + cleaned;
  }
  
  return cleaned;
}

// Send money to a phone number via EcoCash
export async function sendEcoCashPayment(
  request: EcoCashPaymentRequest
): Promise<EcoCashPaymentResponse> {
  const config = getConfig();
  
  if (!config.merchantCode || !config.apiKey) {
    // Return mock success for testing when EcoCash not configured
    console.log("EcoCash not configured - using mock mode");
    return {
      success: true,
      transactionId: `MOCK-${Date.now()}`,
      reference: request.reference,
      message: "Mock payment successful (EcoCash not configured)",
    };
  }
  
  try {
    const formattedPhone = formatPhoneForEcoCash(request.phoneNumber);
    
    const payload = {
      merchantCode: config.merchantCode,
      merchantPin: config.merchantPin,
      recipientMsisdn: formattedPhone,
      amount: request.amount.toFixed(2),
      currency: "USD",
      reference: request.reference,
      narration: request.narration || `How Far driver payout - ${request.reference}`,
    };
    
    console.log(`Sending EcoCash payment: ${request.amount} USD to ${formattedPhone}`);
    
    const response = await fetch(`${config.apiUrl}/payments/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.apiKey}`,
        "X-Merchant-Code": config.merchantCode,
      },
      body: JSON.stringify(payload),
    });
    
    const data = await response.json();
    
    if (response.ok && data.success) {
      return {
        success: true,
        transactionId: data.transactionId || data.transaction_id,
        reference: request.reference,
        message: data.message || "Payment sent successfully",
      };
    } else {
      return {
        success: false,
        error: data.message || data.error || "Payment failed",
        reference: request.reference,
      };
    }
  } catch (error) {
    console.error("EcoCash payment error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Payment request failed",
      reference: request.reference,
    };
  }
}

// Check payment status
export async function checkEcoCashPaymentStatus(
  transactionId: string
): Promise<EcoCashPaymentResponse> {
  const config = getConfig();
  
  if (!config.merchantCode || !config.apiKey) {
    return {
      success: true,
      transactionId,
      message: "Mock status check (EcoCash not configured)",
    };
  }
  
  try {
    const response = await fetch(`${config.apiUrl}/payments/status/${transactionId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${config.apiKey}`,
        "X-Merchant-Code": config.merchantCode,
      },
    });
    
    const data = await response.json();
    
    return {
      success: data.status === "completed" || data.status === "success",
      transactionId,
      message: data.message || `Status: ${data.status}`,
    };
  } catch (error) {
    return {
      success: false,
      transactionId,
      error: error instanceof Error ? error.message : "Status check failed",
    };
  }
}

