/**
 * Services Layer - DEPRECATED
 * 
 * All service functionality has been consolidated into the API layer.
 * 
 * Use these imports instead:
 * - Supabase: import { supabase } from '../api/supabase'
 * - PayNow: import { initiatePayment, pollPayment } from '../api/paynow'
 * - Trips: import { ... } from '../api/trips'
 * - Wallets: import { ... } from '../api/wallets'
 * 
 * This directory is kept for backwards compatibility but should not be used
 * for new code. All new services should be added to the /api directory.
 */

// Re-export from api for backwards compatibility
export { supabase } from '../api/supabase';
export { initiatePayment, pollPayment } from '../api/paynow';

