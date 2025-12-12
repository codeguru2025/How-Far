// Admin API - Settlement management
import { supabase } from './supabase';
import Constants from 'expo-constants';

const SUPABASE_URL = Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL;

export interface Settlement {
  id: string;
  settlement_date: string;
  driver_id: string;
  driver_name: string;
  driver_phone: string;
  ecocash_number: string;
  gross_earnings: number;
  platform_fee: number;
  payout_amount: number;
  status: 'pending' | 'approved' | 'processing' | 'completed' | 'failed' | 'cancelled';
  booking_count: number;
  payment_reference?: string;
  payment_error?: string;
  created_at: string;
}

export interface SettlementBatch {
  id: string;
  batch_date: string;
  total_settlements: number;
  total_amount: number;
  status: string;
  successful_count: number;
  failed_count: number;
}

export interface SettlementSummary {
  pending_count: number;
  pending_total: number;
  completed_today: number;
}

export interface GetSettlementsResponse {
  settlements: Settlement[];
  batches: SettlementBatch[];
  summary: SettlementSummary;
}

// Get pending settlements for admin
export async function getSettlements(status: string = 'pending', date?: string): Promise<GetSettlementsResponse | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    let url = `${SUPABASE_URL}/functions/v1/getSettlements?status=${status}`;
    if (date) url += `&date=${date}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) return null;
    return await response.json();
  } catch (e) {
    console.error('getSettlements error:', e);
    return null;
  }
}

// Process a settlement (approve and pay)
export async function processSettlement(
  settlementId: string, 
  adminPin: string
): Promise<{ success: boolean; message?: string; error?: string; payment_reference?: string }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { success: false, error: 'Not authenticated' };

    const response = await fetch(`${SUPABASE_URL}/functions/v1/processSettlement`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        settlement_id: settlementId,
        admin_pin: adminPin,
        action: 'approve_and_process',
      }),
    });

    return await response.json();
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// Check if current user is an admin
export async function checkAdminStatus(): Promise<{ isAdmin: boolean; adminId?: string; role?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { isAdmin: false };

    const { data: admin } = await supabase
      .from('admins')
      .select('id, role, is_active')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (admin) {
      return { isAdmin: true, adminId: admin.id, role: admin.role };
    }
    return { isAdmin: false };
  } catch {
    return { isAdmin: false };
  }
}

// Set admin PIN (first time or update)
export async function setAdminPin(pin: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    // Hash the PIN client-side
    const encoder = new TextEncoder();
    const data = encoder.encode(pin);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const { error } = await supabase
      .from('admins')
      .update({ pin_hash: hashHex })
      .eq('user_id', user.id);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// Get admin notifications
export async function getAdminNotifications(): Promise<any[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: admin } = await supabase
      .from('admins')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!admin) return [];

    const { data } = await supabase
      .from('admin_notifications')
      .select('*')
      .eq('admin_id', admin.id)
      .is('read_at', null)
      .order('created_at', { ascending: false })
      .limit(20);

    return data || [];
  } catch {
    return [];
  }
}

// Mark notification as read
export async function markNotificationRead(notificationId: string): Promise<void> {
  await supabase
    .from('admin_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId);
}

