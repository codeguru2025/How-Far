// Wallet API operations
import { supabase } from './supabase';
import { Wallet } from '../types';

export async function getWallet(userId: string): Promise<Wallet | null> {
  console.log('getWallet - fetching for userId:', userId);
  
  const { data, error } = await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  console.log('getWallet - result:', data, 'error:', error);
  
  if (error || !data) return null;
  return {
    id: data.id,
    user_id: data.user_id,
    balance: data.balance || 0,
    currency: data.currency || 'USD',
    pending_balance: data.pending_balance || 0,
  };
}

export async function creditWallet(transactionId: string, userId: string): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  try {
    const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/creditWallet`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
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

