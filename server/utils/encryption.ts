import crypto from 'crypto';

export class EncryptionUtils {
  private static readonly ALGORITHM = 'aes-256-cbc';
  private static readonly KEY_LENGTH = 32;
  private static readonly IV_LENGTH = 16;

  private static getEncryptionKey(): Buffer {
    const key = process.env.ENCRYPTION_KEY || 'dev-key-change-in-production';
    if (key === 'dev-key-change-in-production' && process.env.NODE_ENV === 'production') {
      throw new Error('ENCRYPTION_KEY environment variable must be set in production');
    }
    return crypto.scryptSync(key, 'salt', this.KEY_LENGTH);
  }

  static encrypt(text: string): string {
    try {
      const key = this.getEncryptionKey();
      const iv = crypto.randomBytes(this.IV_LENGTH);
      const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);

      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // v2 format: v2:{iv_hex}:{encrypted}
      return 'v2:' + iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Failed to encrypt sensitive data');
    }
  }

  static decrypt(encryptedData: string): string {
    try {
      const key = this.getEncryptionKey();

      // v2 format: v2:{iv_hex}:{encrypted_hex}
      if (encryptedData.startsWith('v2:')) {
        const rest = encryptedData.slice(3);
        const colonIdx = rest.indexOf(':');
        if (colonIdx === -1) throw new Error('Invalid v2 encrypted data format');
        const iv = Buffer.from(rest.slice(0, colonIdx), 'hex');
        const encrypted = rest.slice(colonIdx + 1);
        const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
      }

      // Legacy format (pre-fix): {unused_iv_hex}:{encrypted}
      // createCipher derived its own IV from key — must use createDecipher to match
      const parts = encryptedData.split(':');
      if (parts.length !== 2) throw new Error('Invalid encrypted data format');
      const encrypted = parts[1];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const decipher = (crypto as any).createDecipher(this.ALGORITHM, key);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Failed to decrypt sensitive data');
    }
  }

  static hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  static maskSSN(ssn: string): string {
    if (!ssn || ssn.length < 4) return '*****';
    return '*****' + ssn.slice(-4);
  }

  static maskBankAccount(accountNumber: string): string {
    if (!accountNumber || accountNumber.length < 4) return '****';
    return '****' + accountNumber.slice(-4);
  }
}
