// Cryptographic utilities
import * as Crypto from 'expo-crypto';

/**
 * Password hashing using SHA-256 with application salt
 * 
 * ⚠️ SECURITY RECOMMENDATIONS FOR PRODUCTION:
 * 1. Move password verification to a server-side Edge Function
 * 2. Use bcrypt/argon2 with per-user random salts on the server
 * 3. Store only the server-generated hash in the database
 * 4. Use HTTPS to protect password in transit
 * 5. Implement rate limiting on login attempts
 * 
 * Current implementation maintains backward compatibility with existing users.
 * A migration path would be:
 * 1. Add a 'password_version' column to users table
 * 2. On login success, re-hash with new algorithm and update password_version
 * 3. Gradually migrate all users to the new secure hash
 */
export async function hashPassword(password: string): Promise<string> {
  // Legacy salt format - DO NOT CHANGE without migration strategy
  const salt = 'ndeip-secure-v2-' + password.length;
  const salted = salt + password + salt;
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    salted
  );
  return hash.toLowerCase();
}

// SHA-512 hash for PayNow
export async function sha512Hash(str: string): Promise<string> {
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA512,
    str
  );
  return hash.toUpperCase();
}

// Generate random reference
export function generateReference(prefix: string = 'TXN'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

