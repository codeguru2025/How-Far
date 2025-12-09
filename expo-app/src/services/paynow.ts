// PayNow Zimbabwe Payment Integration Service
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Types
export interface TopUpRequest {
  amount: number;
  phone?: string;
  currency?: string;
}

export interface TopUpResponse {
  success: boolean;
  transactionId?: string;
  reference?: string;
  browserUrl?: string;
  pollUrl?: string;
  paynowReference?: string;
  message?: string;
  error?: string;
}

export interface PaymentStatus {
  success: boolean;
  status: 'pending' | 'paid' | 'failed' | 'cancelled';
  reference?: string;
  amount?: number;
  error?: string;
}

// PayNow status mapping
export const PayNowStatuses = {
  Created: 'pending',
  Sent: 'pending',
  Paid: 'paid',
  'Awaiting Delivery': 'paid',
  Delivered: 'paid',
  Cancelled: 'cancelled',
  Refunded: 'failed',
  Disputed: 'failed',
} as const;

/**
 * Generate a unique idempotency key for requests
 */
function generateIdempotencyKey(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Initiate a PayNow top-up transaction
 */
export async function initiateTopUp(request: TopUpRequest): Promise<TopUpResponse> {
  try {
    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      return {
        success: false,
        error: 'Not authenticated. Please sign in again.',
      };
    }

    // Call the Supabase edge function
    const response = await fetch(`${supabaseUrl}/functions/v1/paynowInitiateTopup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        amount: request.amount,
        phone: request.phone,
        currency: request.currency || 'USD',
        idempotency_key: generateIdempotencyKey(),
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      return {
        success: false,
        error: data.error || 'Failed to initiate payment',
      };
    }

    return {
      success: true,
      transactionId: data.transaction_id,
      reference: data.reference,
      browserUrl: data.browser_url,
      pollUrl: data.poll_url,
      paynowReference: data.paynow_reference,
      message: data.message,
    };
  } catch (error) {
    console.error('PayNow initiate error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error. Please try again.',
    };
  }
}

/**
 * Open PayNow payment page in browser
 */
export async function openPayNowPayment(browserUrl: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Configure return URL for deep linking
    const returnUrl = Linking.createURL('payment/complete');
    
    // Open PayNow in browser
    const result = await WebBrowser.openBrowserAsync(browserUrl, {
      dismissButtonStyle: 'close',
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
      controlsColor: '#E85A24',
      toolbarColor: '#E85A24',
    });

    // User dismissed the browser
    if (result.type === 'dismiss' || result.type === 'cancel') {
      return { success: true }; // Not an error, user may have completed payment
    }

    return { success: true };
  } catch (error) {
    console.error('PayNow browser error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to open payment page',
    };
  }
}

/**
 * Check the status of a payment transaction
 */
export async function checkPaymentStatus(transactionId: string): Promise<PaymentStatus> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return {
        success: false,
        status: 'failed',
        error: 'Not authenticated',
      };
    }

    // Query the transaction
    const { data: transaction, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .single();

    if (error || !transaction) {
      return {
        success: false,
        status: 'failed',
        error: 'Transaction not found',
      };
    }

    // Map PayNow status to our status
    let status: PaymentStatus['status'] = 'pending';
    if (transaction.status === 'completed') {
      status = 'paid';
    } else if (transaction.status === 'failed') {
      status = 'failed';
    } else if (transaction.status === 'cancelled') {
      status = 'cancelled';
    }

    return {
      success: true,
      status,
      reference: transaction.reference,
      amount: transaction.amount,
    };
  } catch (error) {
    console.error('Check payment status error:', error);
    return {
      success: false,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Failed to check status',
    };
  }
}

/**
 * Poll for payment completion (with retries)
 */
export async function pollPaymentStatus(
  transactionId: string,
  maxAttempts: number = 10,
  intervalMs: number = 3000
): Promise<PaymentStatus> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const status = await checkPaymentStatus(transactionId);
    
    if (status.status === 'paid' || status.status === 'failed' || status.status === 'cancelled') {
      return status;
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  return {
    success: true,
    status: 'pending',
    error: 'Payment still processing. Check back later.',
  };
}

/**
 * Get wallet balance
 */
export async function getWalletBalance(userId: string): Promise<{ balance: number; currency: string } | null> {
  try {
    const { data, error } = await supabase
      .from('wallets')
      .select('balance, currency')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      balance: data.balance || 0,
      currency: data.currency || 'USD',
    };
  } catch (error) {
    console.error('Get wallet balance error:', error);
    return null;
  }
}

/**
 * Get transaction history
 */
export async function getTransactionHistory(userId: string, limit: number = 20): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Get transactions error:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Get transaction history error:', error);
    return [];
  }
}

export default {
  initiateTopUp,
  openPayNowPayment,
  checkPaymentStatus,
  pollPaymentStatus,
  getWalletBalance,
  getTransactionHistory,
};


