// Cryptographic utilities
import * as Crypto from 'expo-crypto';

// Secure password hashing using expo-crypto
export async function hashPassword(password: string): Promise<string> {
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

