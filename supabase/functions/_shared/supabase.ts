// Supabase client utilities for Edge Functions

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          phone: string;
          phone_verified: boolean;
          email: string | null;
          password_hash: string;
          first_name: string | null;
          last_name: string | null;
          display_name: string | null;
          avatar_url: string | null;
          date_of_birth: string | null;
          role: "passenger" | "driver" | "admin";
          status: "active" | "suspended" | "pending_verification" | "deactivated";
          preferred_language: string;
          notification_preferences: Record<string, boolean>;
          created_at: string;
          updated_at: string;
          last_login_at: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["users"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["users"]["Insert"]>;
      };
      wallets: {
        Row: {
          id: string;
          user_id: string;
          balance: number;
          currency: string;
          pending_balance: number;
          daily_topup_limit: number;
          daily_spend_limit: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["wallets"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["wallets"]["Insert"]>;
      };
      transactions: {
        Row: {
          id: string;
          from_wallet_id: string | null;
          to_wallet_id: string | null;
          user_id: string;
          type: "topup" | "ride_payment" | "refund" | "settlement" | "adjustment";
          status: "pending" | "completed" | "failed" | "cancelled" | "reconciling";
          amount: number;
          currency: string;
          fee: number;
          net_amount: number;
          reference: string | null;
          external_reference: string | null;
          ride_id: string | null;
          paynow_reference: string | null;
          paynow_poll_url: string | null;
          paynow_status: string | null;
          description: string | null;
          metadata: Record<string, unknown>;
          idempotency_key: string | null;
          created_at: string;
          updated_at: string;
          completed_at: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["transactions"]["Row"], "id" | "created_at" | "updated_at" | "net_amount">;
        Update: Partial<Database["public"]["Tables"]["transactions"]["Insert"]>;
      };
      drivers: {
        Row: {
          id: string;
          user_id: string;
          license_number: string;
          license_expiry: string;
          license_verified: boolean;
          is_online: boolean;
          is_available: boolean;
          current_location: unknown;
          last_location_update: string | null;
          rating_average: number;
          rating_count: number;
          total_rides: number;
          qr_code_data: string | null;
          qr_session_token: string | null;
          qr_session_expires: string | null;
          created_at: string;
          updated_at: string;
          approved_at: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["drivers"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["drivers"]["Insert"]>;
      };
      driver_bank_details: {
        Row: {
          id: string;
          driver_id: string;
          bank_name_encrypted: string;
          account_number_encrypted: string;
          account_holder_name_encrypted: string;
          branch_code_encrypted: string;
          country: string;
          currency: string;
          is_verified: boolean;
          verified_at: string | null;
          verified_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["driver_bank_details"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["driver_bank_details"]["Insert"]>;
      };
      settlements: {
        Row: {
          id: string;
          driver_id: string;
          period_start: string;
          period_end: string;
          gross_amount: number;
          fees: number;
          net_amount: number;
          currency: string;
          status: "pending" | "processing" | "processed" | "failed" | "paid";
          bank_details_snapshot: string | null;
          batch_id: string | null;
          export_generated_at: string | null;
          export_file_url: string | null;
          processed_at: string | null;
          processed_by: string | null;
          paid_at: string | null;
          payment_reference: string | null;
          transaction_count: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["settlements"]["Row"], "id" | "created_at" | "updated_at" | "net_amount">;
        Update: Partial<Database["public"]["Tables"]["settlements"]["Insert"]>;
      };
    };
  };
};

/**
 * Create a Supabase client with the service role key
 * Use this for admin operations that bypass RLS
 */
export function createServiceClient(): SupabaseClient<Database> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase configuration");
  }

  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Create a Supabase client with the user's JWT
 * Use this for operations that should respect RLS
 */
export function createUserClient(authHeader: string): SupabaseClient<Database> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase configuration");
  }

  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Extract user ID from JWT token
 */
export async function getUserFromToken(authHeader: string): Promise<{ id: string; phone: string; role: string } | null> {
  const client = createUserClient(authHeader);
  
  const { data: { user }, error } = await client.auth.getUser();
  
  if (error || !user) {
    return null;
  }

  // Get additional user data from our users table
  const serviceClient = createServiceClient();
  const { data: userData } = await serviceClient
    .from("users")
    .select("id, phone, role")
    .eq("id", user.id)
    .single();

  if (!userData) {
    return null;
  }

  return {
    id: userData.id,
    phone: userData.phone,
    role: userData.role,
  };
}

/**
 * Generate a unique transaction reference
 */
export function generateReference(prefix: string = "TXN"): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 10).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}



