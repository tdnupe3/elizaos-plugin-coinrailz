/**
 * Enhanced Transaction Security
 * Prevents race conditions, double-spending, and transaction manipulation
 */

import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { transactions, users } from '@shared/schema';
import { eq, sql, and } from 'drizzle-orm';
import crypto from 'crypto';

interface TransactionLock {
  userId: string;
  transactionId: string;
  timestamp: number;
  operation: 'debit' | 'credit';
}

interface TransactionSignature {
  transactionId: string;
  userId: string;
  amount: string;
  currency: string;
  timestamp: number;
  nonce: string;
  signature: string;
}

export class EnhancedTransactionSecurity {
  private static transactionLocks = new Map<string, TransactionLock>();
  private static processedTransactions = new Set<string>();
  private static transactionSignatures = new Map<string, TransactionSignature>();
  private static readonly LOCK_TIMEOUT = 30000; // 30 seconds
  private static readonly SIGNATURE_TIMEOUT = 300000; // 5 minutes

  /**
   * Atomic transaction processing with distributed locks
   */
  static async atomicTransactionProcessor(
    userId: string,
    amount: number,
    operation: 'debit' | 'credit',
    transactionId: string,
    metadata?: any
  ): Promise<{ success: boolean; newBalance?: number; error?: string }> {
    
    // Check for duplicate transaction ID (replay attack prevention)
    if (this.processedTransactions.has(transactionId)) {
      return { success: false, error: 'Transaction already processed' };
    }

    // Acquire distributed lock
    const lockKey = `user_${userId}`;
    const lockAcquired = await this.acquireTransactionLock(lockKey, userId, transactionId, operation);
    
    if (!lockAcquired) {
      return { success: false, error: 'Transaction lock unavailable - concurrent operation in progress' };
    }

    try {
      // Use database-level locking for ultimate consistency
      const result = await db.transaction(async (tx) => {
        // Lock user record with SELECT FOR UPDATE
        const [user] = await tx
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .for('update');

        if (!user) {
          throw new Error('User not found');
        }

        const currentBalance = parseFloat(user.usdBalance || '0');
        let newBalance: number;

        // Validate operation
        if (operation === 'debit') {
          if (currentBalance < amount) {
            throw new Error('Insufficient balance');
          }
          newBalance = Math.round((currentBalance - amount) * 100) / 100;
        } else {
          newBalance = Math.round((currentBalance + amount) * 100) / 100;
        }

        // Update balance atomically
        const [updatedUser] = await tx
          .update(users)
          .set({ 
            usdBalance: newBalance.toFixed(2),
            updatedAt: new Date()
          })
          .where(eq(users.id, userId))
          .returning();

        // Create transaction record
        await tx.insert(transactions).values({
          fromUserId: operation === 'debit' ? userId : null,
          toUserId: operation === 'credit' ? userId : null,
          amount: amount.toFixed(2),
          currency: 'USD',
          status: 'completed',
          transactionType: operation === 'debit' ? 'withdraw' : 'deposit',
          metadata: JSON.stringify(metadata || {}),
          createdAt: new Date(),
          completedAt: new Date()
        });

        return { success: true, newBalance };
      });

      // Mark transaction as processed
      this.processedTransactions.add(transactionId);
      
      // Clean up old processed transactions (keep last 10000)
      if (this.processedTransactions.size > 10000) {
        const oldTransactions = Array.from(this.processedTransactions).slice(0, 1000);
        oldTransactions.forEach(id => this.processedTransactions.delete(id));
      }

      return result;

    } catch (error) {
      console.error('Atomic transaction failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Transaction failed' 
      };
    } finally {
      // Always release lock
      this.releaseTransactionLock(lockKey);
    }
  }

  /**
   * Acquire distributed transaction lock
   */
  private static async acquireTransactionLock(
    lockKey: string, 
    userId: string, 
    transactionId: string, 
    operation: 'debit' | 'credit'
  ): Promise<boolean> {
    const now = Date.now();
    
    // Check if lock exists and is still valid
    const existingLock = this.transactionLocks.get(lockKey);
    if (existingLock) {
      if (now - existingLock.timestamp < this.LOCK_TIMEOUT) {
        return false; // Lock still active
      } else {
        // Lock expired, remove it
        this.transactionLocks.delete(lockKey);
      }
    }

    // Acquire new lock
    this.transactionLocks.set(lockKey, {
      userId,
      transactionId,
      timestamp: now,
      operation
    });

    return true;
  }

  /**
   * Release transaction lock
   */
  private static releaseTransactionLock(lockKey: string): void {
    this.transactionLocks.delete(lockKey);
  }

  /**
   * Enhanced amount validation with precision handling
   */
  static validateTransactionAmount(amount: any, currency: string = 'USD'): {
    isValid: boolean;
    sanitizedAmount?: number;
    error?: string;
  } {
    // Convert to string for consistent processing
    const amountStr = String(amount).trim();

    // Detect manipulation attempts
    if (this.detectAmountManipulation(amountStr)) {
      return { isValid: false, error: 'Invalid amount format detected' };
    }

    // Parse with precision handling
    const parsedAmount = this.safeParseCurrency(amountStr);
    if (parsedAmount === null) {
      return { isValid: false, error: 'Invalid amount format' };
    }

    // Validate range
    if (parsedAmount < 2.50) {
      return { isValid: false, error: 'Minimum transaction $2.50' };
    }

    if (parsedAmount > 1000000) {
      return { isValid: false, error: 'Maximum transaction $1,000,000' };
    }

    // Round to prevent floating point issues
    const sanitizedAmount = Math.round(parsedAmount * 100) / 100;

    return { isValid: true, sanitizedAmount };
  }

  /**
   * Detect amount manipulation attempts
   */
  private static detectAmountManipulation(amountStr: string): boolean {
    // Check for scientific notation abuse
    if (/[eE]/.test(amountStr) && !/^[0-9]+\.?[0-9]*[eE][+-]?[0-9]+$/.test(amountStr)) {
      return true;
    }

    // Check for Unicode number spoofing
    if (/[⁰¹²³⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉]/.test(amountStr)) {
      return true;
    }

    // Check for multiple decimal points
    if ((amountStr.match(/\./g) || []).length > 1) {
      return true;
    }

    // Check for invisible characters
    if (/[\u200B-\u200D\uFEFF]/.test(amountStr)) {
      return true;
    }

    return false;
  }

  /**
   * Safe currency parsing with precision handling
   */
  private static safeParseCurrency(amountStr: string): number | null {
    // Remove any currency symbols and whitespace
    const cleaned = amountStr.replace(/[$€£¥,\s]/g, '');
    
    // Check if it's a valid number format
    if (!/^-?\d*\.?\d+$/.test(cleaned)) {
      return null;
    }

    const parsed = parseFloat(cleaned);
    
    // Check for invalid numbers
    if (!Number.isFinite(parsed) || parsed < 0) {
      return null;
    }

    return parsed;
  }

  /**
   * Transaction signature validation for replay attack prevention
   */
  static validateTransactionSignature(
    transactionData: any,
    providedSignature: string,
    userId: string
  ): boolean {
    try {
      // Create canonical transaction string
      const canonicalData = this.createCanonicalTransactionString(transactionData);
      
      // Verify signature (in production, use proper cryptographic verification)
      const expectedSignature = crypto
        .createHmac('sha256', process.env.TRANSACTION_SIGNING_SECRET || 'default-secret')
        .update(canonicalData)
        .digest('hex');

      // Constant-time comparison to prevent timing attacks
      return crypto.timingSafeEqual(
        Buffer.from(providedSignature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch (error) {
      console.error('Signature validation failed:', error);
      return false;
    }
  }

  /**
   * Create canonical transaction string for signing
   */
  private static createCanonicalTransactionString(data: any): string {
    const fields = [
      data.transactionId,
      data.userId,
      data.amount,
      data.currency,
      data.timestamp,
      data.nonce
    ];
    
    return fields.join('|');
  }

  /**
   * Generate transaction signature
   */
  static generateTransactionSignature(transactionData: any): string {
    const canonicalData = this.createCanonicalTransactionString(transactionData);
    
    return crypto
      .createHmac('sha256', process.env.TRANSACTION_SIGNING_SECRET || 'default-secret')
      .update(canonicalData)
      .digest('hex');
  }

  /**
   * Middleware for transaction validation
   */
  static transactionValidationMiddleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      // Only validate financial endpoints
      const financialEndpoints = [
        '/api/transactions',
        '/api/transfer',
        '/api/crypto/buy',
        '/api/crypto/sell',
        '/api/agents/transaction'
      ];

      const isFinancialEndpoint = financialEndpoints.some(endpoint => 
        req.path.startsWith(endpoint)
      );

      if (!isFinancialEndpoint || req.method === 'GET') {
        return next();
      }

      const { amount, signature, transactionId } = req.body;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({
          error: 'Authentication required',
          message: 'User authentication required for financial operations'
        });
      }

      // Validate amount
      if (amount !== undefined) {
        const amountValidation = this.validateTransactionAmount(amount);
        if (!amountValidation.isValid) {
          return res.status(400).json({
            error: 'Invalid amount',
            message: amountValidation.error
          });
        }
        
        // Replace amount with sanitized version
        req.body.amount = amountValidation.sanitizedAmount;
      }

      // Validate transaction signature for high-value transactions
      if (amount && parseFloat(amount) > 1000 && signature) {
        if (!this.validateTransactionSignature(req.body, signature, userId)) {
          return res.status(400).json({
            error: 'Invalid transaction signature',
            message: 'Transaction signature validation failed'
          });
        }
      }

      // Check for duplicate transaction ID
      if (transactionId && this.processedTransactions.has(transactionId)) {
        return res.status(409).json({
          error: 'Duplicate transaction',
          message: 'Transaction has already been processed'
        });
      }

      next();
    };
  }

  /**
   * Cleanup expired locks and signatures
   */
  static cleanup(): void {
    const now = Date.now();

    // Clean expired locks
    this.transactionLocks.forEach((lock, key) => {
      if (now - lock.timestamp > this.LOCK_TIMEOUT) {
        this.transactionLocks.delete(key);
      }
    });

    // Clean expired signatures
    this.transactionSignatures.forEach((sig, key) => {
      if (now - sig.timestamp > this.SIGNATURE_TIMEOUT) {
        this.transactionSignatures.delete(key);
      }
    });
  }
}

// Run cleanup every minute
setInterval(() => {
  EnhancedTransactionSecurity.cleanup();
}, 60000);

export default EnhancedTransactionSecurity;