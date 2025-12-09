import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase, User } from '../services/supabase';

type AuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (phone: string, password: string, firstName?: string, lastName?: string) => Promise<{ error: Error | null }>;
  signIn: (phone: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/[^\d+]/g, '');
  if (!cleaned.startsWith('+')) {
    cleaned = cleaned.startsWith('0') ? '+263' + cleaned.substring(1) : '+263' + cleaned;
  }
  return cleaned;
}

function phoneToEmail(phone: string): string {
  return `${normalizePhone(phone).replace('+', '')}@ndeip.local`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) fetchUserProfile(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_, session) => {
      setSession(session);
      if (session?.user) await fetchUserProfile(session.user.id);
      else setUser(null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchUserProfile(userId: string) {
    try {
      const { data, error } = await supabase.from('users').select('*').eq('id', userId).single();
      if (!error && data) setUser(data);
    } catch (e) {
      console.error('Error fetching profile:', e);
    } finally {
      setLoading(false);
    }
  }

  async function signUp(phone: string, password: string, firstName?: string, lastName?: string) {
    try {
      const email = phoneToEmail(phone);
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { data: { phone: normalizePhone(phone), first_name: firstName, last_name: lastName } },
      });
      if (error) throw error;
      if (data.user) {
        await supabase.from('users').upsert({
          id: data.user.id, phone: normalizePhone(phone), first_name: firstName, last_name: lastName,
          display_name: `${firstName || ''} ${lastName || ''}`.trim(), role: 'passenger', status: 'active',
        });
      }
      return { error: null };
    } catch (error) { return { error: error as Error }; }
  }

  async function signIn(phone: string, password: string) {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: phoneToEmail(phone), password });
      if (error) throw error;
      return { error: null };
    } catch (error) { return { error: error as Error }; }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
