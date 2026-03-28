// Crypto utilities for encryption/decryption of sensitive data
// Uses AES-256-GCM for authenticated encryption

import { encode as base64Encode, decode as base64Decode } from "https://deno.land/std@0.177.0/encoding/base64.ts";

const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits for GCM
const TAG_LENGTH = 128; // bits

/**
 * Derives a CryptoKey from the base64-encoded encryption key in env
 */
export async function getEncryptionKey(): Promise<CryptoKey> {
  const keyBase64 = Deno.env.get("BANK_DETAILS_ENCRYPTION_KEY");
  if (!keyBase64) {
    throw new Error("BANK_DETAILS_ENCRYPTION_KEY not configured");
  }

  const keyBytes = base64Decode(keyBase64);
  if (keyBytes.length !== 32) {
    throw new Error("BANK_DETAILS_ENCRYPTION_KEY must be 32 bytes (256 bits)");
  }

  return await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypts plaintext using AES-256-GCM
 * Returns format: {iv}:{ciphertext}:{authTag} all base64 encoded
 */
export async function encrypt(plaintext: string): Promise<string> {
  const key = await getEncryptionKey();
  
  // Generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  
  // Encode plaintext to bytes
  const encoder = new TextEncoder();
  const plaintextBytes = encoder.encode(plaintext);
  
  // Encrypt
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: ALGORITHM,
      iv: iv,
      tagLength: TAG_LENGTH,
    },
    key,
    plaintextBytes
  );
  
  // The ciphertext includes the auth tag at the end
  const ciphertextArray = new Uint8Array(ciphertext);
  
  // Format: iv:ciphertext (auth tag is included in ciphertext for GCM)
  return `${base64Encode(iv)}:${base64Encode(ciphertextArray)}`;
}

/**
 * Decrypts ciphertext encrypted with encrypt()
 * Input format: {iv}:{ciphertext} all base64 encoded
 */
export async function decrypt(encryptedData: string): Promise<string> {
  const key = await getEncryptionKey();
  
  const parts = encryptedData.split(":");
  if (parts.length !== 2) {
    throw new Error("Invalid encrypted data format");
  }
  
  const [ivBase64, ciphertextBase64] = parts;
  
  const iv = base64Decode(ivBase64);
  const ciphertext = base64Decode(ciphertextBase64);
  
  // Decrypt (GCM mode verifies auth tag automatically)
  const decrypted = await crypto.subtle.decrypt(
    {
      name: ALGORITHM,
      iv: iv,
      tagLength: TAG_LENGTH,
    },
    key,
    ciphertext
  );
  
  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

/**
 * Encrypts bank details object
 */
export async function encryptBankDetails(details: {
  bank_name: string;
  account_number: string;
  account_holder_name: string;
  branch_code: string;
}): Promise<{
  bank_name_encrypted: string;
  account_number_encrypted: string;
  account_holder_name_encrypted: string;
  branch_code_encrypted: string;
}> {
  return {
    bank_name_encrypted: await encrypt(details.bank_name),
    account_number_encrypted: await encrypt(details.account_number),
    account_holder_name_encrypted: await encrypt(details.account_holder_name),
    branch_code_encrypted: await encrypt(details.branch_code),
  };
}

/**
 * Decrypts bank details object (for settlement functions only)
 */
export async function decryptBankDetails(encryptedDetails: {
  bank_name_encrypted: string;
  account_number_encrypted: string;
  account_holder_name_encrypted: string;
  branch_code_encrypted: string;
}): Promise<{
  bank_name: string;
  account_number: string;
  account_holder_name: string;
  branch_code: string;
}> {
  return {
    bank_name: await decrypt(encryptedDetails.bank_name_encrypted),
    account_number: await decrypt(encryptedDetails.account_number_encrypted),
    account_holder_name: await decrypt(encryptedDetails.account_holder_name_encrypted),
    branch_code: await decrypt(encryptedDetails.branch_code_encrypted),
  };
}

/**
 * Hash a password using bcrypt-compatible approach
 * Note: For production, consider using Argon2 via a WASM module
 */
export async function hashPassword(password: string): Promise<string> {
  // Using PBKDF2 as a fallback since bcrypt isn't natively available in Deno
  // For production, integrate a proper bcrypt or Argon2 library
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  
  const hash = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );
  
  // Format: $pbkdf2-sha256$iterations$salt$hash
  return `$pbkdf2-sha256$100000$${base64Encode(salt)}$${base64Encode(new Uint8Array(hash))}`;
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split("$");
  if (parts.length !== 5 || parts[1] !== "pbkdf2-sha256") {
    throw new Error("Invalid hash format");
  }
  
  const iterations = parseInt(parts[2], 10);
  const salt = base64Decode(parts[3]);
  const expectedHash = base64Decode(parts[4]);
  
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  
  const hash = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );
  
  const hashArray = new Uint8Array(hash);
  
  // Constant-time comparison
  if (hashArray.length !== expectedHash.length) {
    return false;
  }
  
  let diff = 0;
  for (let i = 0; i < hashArray.length; i++) {
    diff |= hashArray[i] ^ expectedHash[i];
  }
  
  return diff === 0;
}

/**
 * Generate a secure random token for password reset
 */
export function generateResetToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return base64Encode(bytes).replace(/[+/=]/g, (c) => {
    switch (c) {
      case "+": return "-";
      case "/": return "_";
      case "=": return "";
      default: return c;
    }
  });
}

/**
 * Hash a reset token for storage
 */
export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return base64Encode(new Uint8Array(hashBuffer));
}



