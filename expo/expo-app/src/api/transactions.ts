// Transaction API operations
import { supabase } from './supabase';
import { Transaction, TransactionType } from '../types';

export async function getTransactions(userId: string, limit: number = 20): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (error || !data) return [];
  return data as Transaction[];
}

export async function getPendingTransactions(userId: string): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .not('paynow_poll_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (error || !data) return [];
  return data as Transaction[];
}

export async function createTransaction(params: {
  userId: string;
  type: TransactionType;
  amount: number;
  reference: string;
  description?: string;
  metadata?: Record<string, any>;
}): Promise<Transaction | null> {
  const { data, error } = await supabase
    .from('transactions')
    .insert({
      user_id: params.userId,
      type: params.type,
      status: 'pending',
      amount: params.amount,
      currency: 'USD',
      reference: params.reference,
      description: params.description,
      metadata: params.metadata || {},
    })
    .select()
    .single();

  if (error || !data) return null;
  return data as Transaction;
}

export async function updateTransaction(id: string, updates: Partial<Transaction>): Promise<boolean> {
  const { error } = await supabase
    .from('transactions')
    .update(updates)
    .eq('id', id);
  
  return !error;
}

