import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private supabase: SupabaseClient;
  private supabaseAdmin: SupabaseClient;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseAnonKey = this.configService.get<string>('SUPABASE_ANON_KEY');
    const supabaseServiceKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('⚠️ Supabase credentials not configured. Some features may not work.');
      return;
    }

    // Client for public operations
    this.supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Admin client for server-side operations (bypasses RLS)
    if (supabaseServiceKey) {
      this.supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
    }

    console.log('✅ Supabase client initialized');
  }

  /**
   * Get the public Supabase client
   */
  getClient(): SupabaseClient {
    return this.supabase;
  }

  /**
   * Get the admin Supabase client (bypasses RLS)
   */
  getAdminClient(): SupabaseClient {
    return this.supabaseAdmin || this.supabase;
  }

  // ==================== AUTH HELPERS ====================

  /**
   * Sign up user with phone (Supabase Auth)
   */
  async signUpWithPhone(phone: string) {
    const { data, error } = await this.supabaseAdmin.auth.signInWithOtp({
      phone,
    });
    
    if (error) throw error;
    return data;
  }

  /**
   * Verify phone OTP (Supabase Auth)
   */
  async verifyPhoneOtp(phone: string, token: string) {
    const { data, error } = await this.supabaseAdmin.auth.verifyOtp({
      phone,
      token,
      type: 'sms',
    });
    
    if (error) throw error;
    return data;
  }

  /**
   * Get user from Supabase Auth by ID
   */
  async getAuthUser(userId: string) {
    const { data, error } = await this.supabaseAdmin.auth.admin.getUserById(userId);
    if (error) throw error;
    return data.user;
  }

  /**
   * Delete user from Supabase Auth
   */
  async deleteAuthUser(userId: string) {
    const { error } = await this.supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw error;
  }

  // ==================== STORAGE HELPERS ====================

  /**
   * Upload file to Supabase Storage
   */
  async uploadFile(
    bucket: string,
    path: string,
    file: Buffer,
    contentType: string,
  ): Promise<string> {
    const { data, error } = await this.supabaseAdmin.storage
      .from(bucket)
      .upload(path, file, {
        contentType,
        upsert: true,
      });

    if (error) throw error;

    // Get public URL
    const { data: urlData } = this.supabaseAdmin.storage
      .from(bucket)
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  }

  /**
   * Delete file from Supabase Storage
   */
  async deleteFile(bucket: string, path: string) {
    const { error } = await this.supabaseAdmin.storage
      .from(bucket)
      .remove([path]);

    if (error) throw error;
  }

  /**
   * Get signed URL for private file
   */
  async getSignedUrl(bucket: string, path: string, expiresIn = 3600): Promise<string> {
    const { data, error } = await this.supabaseAdmin.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn);

    if (error) throw error;
    return data.signedUrl;
  }

  // ==================== REALTIME HELPERS ====================

  /**
   * Broadcast to a Supabase Realtime channel
   */
  async broadcastToChannel(channel: string, event: string, payload: any) {
    const channelInstance = this.supabase.channel(channel);
    
    await channelInstance.send({
      type: 'broadcast',
      event,
      payload,
    });
  }

  /**
   * Subscribe to Supabase Realtime channel
   */
  subscribeToChannel(
    channel: string,
    callback: (payload: any) => void,
  ) {
    return this.supabase
      .channel(channel)
      .on('broadcast', { event: '*' }, callback)
      .subscribe();
  }

  // ==================== DATABASE HELPERS (Edge Functions) ====================

  /**
   * Call a Supabase Edge Function
   */
  async callFunction<T = any>(
    functionName: string,
    body?: any,
  ): Promise<T> {
    const { data, error } = await this.supabase.functions.invoke(functionName, {
      body,
    });

    if (error) throw error;
    return data as T;
  }
}
