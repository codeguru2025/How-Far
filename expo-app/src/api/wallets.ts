// Wallet API operations
import { supabase, CONFIG } from './supabase';
import { Wallet } from '../types';
import { apiCache } from '../utils/apiCache';

const WALLET_CACHE_TTL = 10000; // 10 seconds

export async function getWallet(userId: string, forceRefresh = false): Promise<Wallet | null> {
  const cacheKey = `wallet:${userId}`;
  
  // Check cache first (unless force refresh)
  if (!forceRefresh) {
    const cached = apiCache.get<Wallet>(cacheKey);
    if (cached) {
      return cached;
    }
  }
  
  const { data, error } = await supabase
    .from('wallets')
    .select('id, user_id, balance, currency, pending_balance')
    .eq('user_id', userId)
    .single();
  
  if (error || !data) return null;
  
  const wallet: Wallet = {
    id: data.id,
    user_id: data.user_id,
    balance: data.balance || 0,
    currency: data.currency || 'USD',
    pending_balance: data.pending_balance || 0,
  };
  
  // Cache the result
  apiCache.set(cacheKey, wallet, WALLET_CACHE_TTL);
  
  return wallet;
}

// Invalidate wallet cache (call after transactions)
export function invalidateWalletCache(userId: string): void {
  apiCache.invalidate(`wallet:${userId}`);
}

export async function creditWallet(transactionId: string, userId: string): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  try {
    const response = await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/creditWallet`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        transaction_id: transactionId,
        user_id: userId,
      }),
    });

    const result = await response.json();
    if (result.success) {
      return { success: true, newBalance: result.newBalance };
    }
    return { success: false, error: result.error };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

