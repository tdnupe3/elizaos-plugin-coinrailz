/**
 * Data Encryption and Protection Middleware
 * Addresses sensitive data exposure and storage vulnerabilities
 */

import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

interface EncryptionConfig {
  algorithm: string;
  keyLength: number;
  ivLength: number;
  tagLength: number;
}

export class DataEncryption {
  private static readonly config: EncryptionConfig = {
    algorithm: 'aes-256-gcm',
    keyLength: 32,
    ivLength: 16,
    tagLength: 16
  };

  private static encryptionKey: Buffer;

  /**
   * Initialize encryption system
   */
  static initialize() {
    const key = process.env.DATA_ENCRYPTION_KEY;
    if (!key) {
      // Generate a new key if none exists (for development)
      this.encryptionKey = crypto.randomBytes(this.config.keyLength);
      console.warn('No encryption key found, generated temporary key for development');
    } else {
      this.encryptionKey = Buffer.from(key, 'hex');
    }
  }

  /**
   * Encrypt sensitive data
   */
  static encrypt(plaintext: string, additionalData?: string): {
    encrypted: string;
    iv: string;
    tag: string;
  } {
    const iv = crypto.randomBytes(this.config.ivLength);
    const cipher = crypto.createCipher(this.config.algorithm, this.encryptionKey);
    cipher.setAAD(Buffer.from(additionalData || '', 'utf8'));

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex')
    };
  }

  /**
   * Decrypt sensitive data
   */
  static decrypt(encryptedData: string, iv: string, tag: string, additionalData?: string): string {
    const decipher = crypto.createDecipher(this.config.algorithm, this.encryptionKey);
    decipher.setAuthTag(Buffer.from(tag, 'hex'));
    decipher.setAAD(Buffer.from(additionalData || '', 'utf8'));

    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Hash sensitive data for storage
   */
  static hashSensitiveData(data: string, salt?: string): {
    hash: string;
    salt: string;
  } {
    const useSalt = salt || crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(data, useSalt, 100000, 64, 'sha512').toString('hex');
    
    return { hash, salt: useSalt };
  }

  /**
   * Verify hashed data
   */
  static verifyHashedData(data: string, hash: string, salt: string): boolean {
    const verifyHash = crypto.pbkdf2Sync(data, salt, 100000, 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(verifyHash, 'hex'));
  }

  /**
   * Encrypt PII fields in request/response
   */
  static piiEncryptionMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Encrypt sensitive fields in request body
      if (req.body && typeof req.body === 'object') {
        req.body = this.encryptPIIFields(req.body);
      }

      // Intercept response to decrypt PII before sending
      const originalSend = res.send;
      res.send = function(body: any) {
        if (typeof body === 'string') {
          try {
            const parsed = JSON.parse(body);
            const decrypted = DataEncryption.decryptPIIFields(parsed);
            body = JSON.stringify(decrypted);
          } catch (e) {
            // Not JSON, leave as is
          }
        } else if (typeof body === 'object') {
          body = DataEncryption.decryptPIIFields(body);
        }
        
        return originalSend.call(this, body);
      };

      next();
    };
  }

  /**
   * Encrypt PII fields in object
   */
  private static encryptPIIFields(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;

    const piiFields = [
      'email', 'phone', 'ssn', 'address', 'firstName', 'lastName',
      'dateOfBirth', 'bankAccount', 'routingNumber', 'walletAddress'
    ];

    const result = { ...obj };

    for (const field of piiFields) {
      if (result[field] && typeof result[field] === 'string') {
        const encrypted = this.encrypt(result[field], field);
        result[field] = {
          _encrypted: true,
          data: encrypted.encrypted,
          iv: encrypted.iv,
          tag: encrypted.tag
        };
      }
    }

    return result;
  }

  /**
   * Decrypt PII fields in object
   */
  private static decryptPIIFields(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;

    const result = { ...obj };

    for (const [key, value] of Object.entries(result)) {
      if (value && typeof value === 'object' && (value as any)._encrypted) {
        const encryptedObj = value as any;
        try {
          result[key] = this.decrypt(
            encryptedObj.data,
            encryptedObj.iv,
            encryptedObj.tag,
            key
          );
        } catch (error) {
          console.error(`Failed to decrypt field ${key}:`, error);
          result[key] = '[ENCRYPTED]';
        }
      }
    }

    return result;
  }

  /**
   * Secure logging that excludes sensitive data
   */
  static secureLogger(level: 'info' | 'warn' | 'error', message: string, data?: any) {
    const sanitizedData = data ? this.sanitizeLogData(data) : undefined;
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data: sanitizedData,
      pid: process.pid
    };

    console.log(JSON.stringify(logEntry));
  }

  /**
   * Sanitize data for logging
   */
  private static sanitizeLogData(data: any): any {
    if (!data || typeof data !== 'object') return data;

    const sensitiveFields = [
      'password', 'token', 'secret', 'key', 'email', 'phone', 'ssn',
      'address', 'firstName', 'lastName', 'bankAccount', 'routingNumber',
      'walletAddress', 'privateKey', 'mnemonic'
    ];

    const sanitized = { ...data };

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    // Recursively sanitize nested objects
    for (const [key, value] of Object.entries(sanitized)) {
      if (value && typeof value === 'object') {
        sanitized[key] = this.sanitizeLogData(value);
      }
    }

    return sanitized;
  }

  /**
   * Generate secure API keys
   */
  static generateSecureAPIKey(): string {
    const prefix = 'crl_'; // Coin Railz prefix
    const randomBytes = crypto.randomBytes(32).toString('hex');
    return prefix + randomBytes;
  }

  /**
   * Validate API key format
   */
  static validateAPIKeyFormat(apiKey: string): boolean {
    return /^crl_[a-f0-9]{64}$/.test(apiKey);
  }

  /**
   * Create secure backup encryption
   */
  static encryptBackupData(data: string): {
    encrypted: string;
    key: string;
    iv: string;
    tag: string;
  } {
    const backupKey = crypto.randomBytes(32);
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipher('aes-256-gcm', backupKey);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();

    return {
      encrypted,
      key: backupKey.toString('hex'),
      iv: iv.toString('hex'),
      tag: tag.toString('hex')
    };
  }

  /**
   * Middleware to prevent sensitive data in responses
   */
  static responseSanitizationMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const originalJson = res.json;
      
      res.json = function(body: any) {
        const sanitized = DataEncryption.sanitizeResponse(body);
        return originalJson.call(this, sanitized);
      };

      next();
    };
  }

  /**
   * Sanitize response data
   */
  private static sanitizeResponse(data: any): any {
    if (!data || typeof data !== 'object') return data;

    const sensitiveFields = [
      'password', 'privateKey', 'mnemonic', 'internalId', 'sessionSecret'
    ];

    const sanitized = Array.isArray(data) ? [...data] : { ...data };

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        delete sanitized[field];
      }
    }

    // Recursively sanitize nested objects
    for (const [key, value] of Object.entries(sanitized)) {
      if (value && typeof value === 'object') {
        sanitized[key] = this.sanitizeResponse(value);
      }
    }

    return sanitized;
  }
}

// Initialize encryption on module load
DataEncryption.initialize();

export default DataEncryption;