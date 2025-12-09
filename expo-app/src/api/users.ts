// User API operations
import { supabase } from './supabase';
import { User } from '../types';
import { hashPassword } from '../utils/crypto';
import { normalizePhone } from '../utils/phone';

export async function getUserByPhone(phone: string): Promise<User | null> {
  const normalizedPhone = normalizePhone(phone);
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('phone_number', normalizedPhone)
    .single();
  
  if (error || !data) return null;
  return data as User;
}

export async function getUserById(id: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error || !data) return null;
  return data as User;
}

export async function signIn(phone: string, password: string): Promise<{ user: User | null; error: string | null }> {
  try {
    const normalizedPhone = normalizePhone(phone);
    const passwordHash = await hashPassword(password);
    
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('phone_number', normalizedPhone)
      .single();

    if (error || !user) {
      return { user: null, error: 'User not found. Please sign up first.' };
    }

    if (user.password_hash !== passwordHash) {
      return { user: null, error: 'Incorrect password' };
    }

    return { user: user as User, error: null };
  } catch (e: any) {
    return { user: null, error: e.message || 'Sign in failed' };
  }
}

export async function signUp(params: {
  phone: string;
  password: string;
  firstName: string;
  lastName?: string;
}): Promise<{ user: User | null; error: string | null }> {
  try {
    const normalizedPhone = normalizePhone(params.phone);
    const passwordHash = await hashPassword(params.password);
    
    // Check if user exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('phone_number', normalizedPhone)
      .single();

    if (existing) {
      return { user: null, error: 'User with this phone number already exists' };
    }

    // Create user
    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        phone_number: normalizedPhone,
        first_name: params.firstName,
        last_name: params.lastName,
        password_hash: passwordHash,
        role: 'passenger',
        status: 'active',
      })
      .select()
      .single();

    if (error) {
      return { user: null, error: 'Failed to create account' };
    }

    // Create wallet for user
    await supabase.from('wallets').insert({
      user_id: newUser.id,
      balance: 0,
      currency: 'USD',
      pending_balance: 0,
    });

    return { user: newUser as User, error: null };
  } catch (e: any) {
    return { user: null, error: e.message || 'Sign up failed' };
  }
}

export async function updateUserRole(userId: string, role: 'passenger' | 'driver'): Promise<boolean> {
  const { error } = await supabase
    .from('users')
    .update({ role })
    .eq('id', userId);
  
  return !error;
}

