/**
 * PII Data Encryption Utility
 * Handles encryption/decryption of sensitive personally identifiable information
 */

import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.PII_ENCRYPTION_KEY || crypto.randomBytes(32);
const ALGORITHM = 'aes-256-gcm';

export class PIIEncryption {
  private static key: Buffer = typeof ENCRYPTION_KEY === 'string'
    ? Buffer.from(ENCRYPTION_KEY, 'hex')
    : ENCRYPTION_KEY;

  /**
   * Encrypt sensitive PII data
   * Output format: v2:{iv_hex}:{authTag_hex}:{encrypted_hex}
   */
  static encrypt(text: string): string {
    if (!text) return text;

    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);
      cipher.setAAD(Buffer.from('pii-data'));

      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag();

      // v2 format: v2:{iv_hex}:{authTag_hex}:{encrypted_hex}
      return `v2:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    } catch (error) {
      console.error('PII encryption failed:', error);
      throw new Error('Failed to encrypt sensitive data');
    }
  }

  /**
   * Decrypt sensitive PII data
   * Supports v2 format (createCipheriv) and legacy format (pre-fix createCipher)
   */
  static decrypt(encryptedData: string): string {
    if (!encryptedData || !encryptedData.includes(':')) return encryptedData;

    try {
      // v2 format: v2:{iv_hex}:{authTag_hex}:{encrypted_hex}
      if (encryptedData.startsWith('v2:')) {
        const parts = encryptedData.slice(3).split(':');
        if (parts.length !== 3) throw new Error('Invalid v2 PII encrypted data format');

        const [ivHex, authTagHex, encrypted] = parts;
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');

        const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv);
        decipher.setAAD(Buffer.from('pii-data'));
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
      }

      // Legacy format: {ivHex}:{authTagHex}:{encrypted} (3 parts, no v2 prefix)
      // The old createCipher call did not properly use the IV or GCM auth tag.
      // Best-effort legacy decrypt — wrapped so callers get original data on failure.
      const parts = encryptedData.split(':');
      if (parts.length === 3) {
        const [, authTagHex, encrypted] = parts;
        const authTag = Buffer.from(authTagHex, 'hex');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const decipher = (crypto as any).createDecipher(ALGORITHM, this.key);
        decipher.setAAD(Buffer.from('pii-data'));
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
      }

      throw new Error('Unrecognized encrypted data format');
    } catch (error) {
      console.error('PII decryption failed:', error);
      // Return original data if decryption fails (backwards compatibility)
      return encryptedData;
    }
  }

  /**
   * Hash sensitive data for indexing (one-way)
   */
  static hash(text: string): string {
    if (!text) return text;

    return crypto
      .createHash('sha256')
      .update(text + (process.env.PII_SALT || 'coinrailz-pii-salt'))
      .digest('hex');
  }

  /**
   * Encrypt SSN with special formatting preservation
   */
  static encryptSSN(ssn: string): string {
    if (!ssn) return ssn;

    // Remove any formatting and encrypt
    const cleanSSN = ssn.replace(/\D/g, '');
    if (cleanSSN.length !== 9) {
      throw new Error('Invalid SSN format');
    }

    return this.encrypt(cleanSSN);
  }

  /**
   * Decrypt and format SSN
   */
  static decryptSSN(encryptedSSN: string, format: boolean = true): string {
    if (!encryptedSSN) return encryptedSSN;

    const decrypted = this.decrypt(encryptedSSN);

    if (format && decrypted.length === 9) {
      return `${decrypted.slice(0, 3)}-${decrypted.slice(3, 5)}-${decrypted.slice(5)}`;
    }

    return decrypted;
  }

  /**
   * Encrypt phone number
   */
  static encryptPhone(phone: string): string {
    if (!phone) return phone;

    // Remove formatting and encrypt
    const cleanPhone = phone.replace(/\D/g, '');
    return this.encrypt(cleanPhone);
  }

  /**
   * Decrypt and format phone number
   */
  static decryptPhone(encryptedPhone: string, format: boolean = true): string {
    if (!encryptedPhone) return encryptedPhone;

    const decrypted = this.decrypt(encryptedPhone);

    if (format && decrypted.length === 10) {
      return `(${decrypted.slice(0, 3)}) ${decrypted.slice(3, 6)}-${decrypted.slice(6)}`;
    }

    return decrypted;
  }

  /**
   * Encrypt bank account information
   */
  static encryptBankInfo(bankInfo: any): any {
    if (!bankInfo || typeof bankInfo !== 'object') return bankInfo;

    const encrypted = { ...bankInfo };

    if (encrypted.accountNumber) {
      encrypted.accountNumber = this.encrypt(encrypted.accountNumber);
    }

    if (encrypted.routingNumber) {
      encrypted.routingNumber = this.encrypt(encrypted.routingNumber);
    }

    return encrypted;
  }

  /**
   * Decrypt bank account information
   */
  static decryptBankInfo(encryptedBankInfo: any): any {
    if (!encryptedBankInfo || typeof encryptedBankInfo !== 'object') return encryptedBankInfo;

    const decrypted = { ...encryptedBankInfo };

    if (decrypted.accountNumber) {
      decrypted.accountNumber = this.decrypt(decrypted.accountNumber);
    }

    if (decrypted.routingNumber) {
      decrypted.routingNumber = this.decrypt(decrypted.routingNumber);
    }

    return decrypted;
  }

  /**
   * Generate encryption key for environment setup
   */
  static generateKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Validate encryption key
   */
  static validateKey(key: string): boolean {
    try {
      const keyBuffer = Buffer.from(key, 'hex');
      return keyBuffer.length === 32;
    } catch {
      return false;
    }
  }
}

// Helper functions for database operations
export function encryptPIIFields(data: any): any {
  if (!data) return data;

  const encrypted = { ...data };

  // Encrypt SSN
  if (encrypted.ssn) {
    encrypted.ssn = PIIEncryption.encryptSSN(encrypted.ssn);
  }

  // Encrypt phone number
  if (encrypted.phoneNumber) {
    encrypted.phoneNumber = PIIEncryption.encryptPhone(encrypted.phoneNumber);
  }

  // Encrypt bank account in JSONB fields
  if (encrypted.bankAccount) {
    encrypted.bankAccount = PIIEncryption.encryptBankInfo(encrypted.bankAccount);
  }

  return encrypted;
}

export function decryptPIIFields(data: any): any {
  if (!data) return data;

  const decrypted = { ...data };

  // Decrypt SSN
  if (decrypted.ssn) {
    decrypted.ssn = PIIEncryption.decryptSSN(decrypted.ssn, false);
  }

  // Decrypt phone number
  if (decrypted.phoneNumber) {
    decrypted.phoneNumber = PIIEncryption.decryptPhone(decrypted.phoneNumber, false);
  }

  // Decrypt bank account in JSONB fields
  if (decrypted.bankAccount) {
    decrypted.bankAccount = PIIEncryption.decryptBankInfo(decrypted.bankAccount);
  }

  return decrypted;
}
