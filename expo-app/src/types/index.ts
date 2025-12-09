// ============ TYPES ============

export type Screen = 'splash' | 'signin' | 'signup' | 'home' | 'wallet' | 'topup' | 'profile' | 'driver';
export type UserRole = 'passenger' | 'driver';
export type PaymentMethod = 'ecocash' | 'onemoney' | 'innbucks' | 'bank';
export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'cancelled';
export type TransactionType = 'topup' | 'payment' | 'transfer' | 'ride';

export interface User {
  id: string;
  phone_number: string;
  first_name?: string;
  last_name?: string;
  role: UserRole;
  status?: string;
}

export interface Wallet {
  id?: string;
  user_id?: string;
  balance: number;
  currency: string;
  pending_balance?: number;
}

export interface Transaction {
  id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  status: TransactionStatus;
  description?: string;
  reference: string;
  paynow_poll_url?: string;
  created_at: string;
  metadata?: Record<string, any>;
}

export interface PayNowResponse {
  success: boolean;
  error?: string;
  browserUrl?: string;
  pollUrl?: string;
  instructions?: string;
  innbucksCode?: string | null;
  innbucksDeepLink?: string | null;
  innbucksQR?: string | null;
  innbucksExpiry?: string | null;
  isInnbucks?: boolean;
}

