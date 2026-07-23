/**
 * AES-256-GCM wallet key encryption utility
 * Keyed from ENCRYPTION_KEY secret — fail-closed if missing
 * Format: v1:iv(hex):tag(hex):ciphertext(hex)
 */
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const VERSION = 'v1';
const KEY_LEN = 32; // 256-bit

function getDerivedKey(): Buffer {
  const rawKey = process.env.ENCRYPTION_KEY;
  if (!rawKey) {
    throw new Error('FATAL: ENCRYPTION_KEY not set — cannot encrypt/decrypt wallet keys');
  }
  return crypto.createHash('sha256').update(rawKey).digest();
}

/**
 * Encrypt a wallet private key.
 * Returns a versioned string safe to store in DB.
 */
export function encryptPrivateKey(plaintext: string): string {
  const key = getDerivedKey();
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypt a stored wallet private key.
 * Handles both versioned encrypted strings and legacy plaintext (triggers lazy migration warning).
 */
export function decryptPrivateKey(stored: string): string {
  if (!stored.startsWith('v1:')) {
    // Legacy plaintext — warn loudly, return as-is so existing code doesn't break
    // Caller should re-encrypt and persist the new value
    console.warn('⚠️ WALLET SECURITY: plaintext private key detected — re-encrypt immediately');
    return stored;
  }
  const [, ivHex, tagHex, ciphertextHex] = stored.split(':');
  if (!ivHex || !tagHex || !ciphertextHex) {
    throw new Error('Malformed encrypted key: expected v1:iv:tag:ciphertext');
  }
  const key = getDerivedKey();
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext).toString('utf8') + decipher.final('utf8');
}

/**
 * Returns true if the stored value is already encrypted (versioned).
 */
export function isEncrypted(stored: string): boolean {
  return stored.startsWith('v1:');
}
