/**
 * Transaction Security Middleware
 * Implements atomic operations and prevents race conditions
 */

import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { transactions, users } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';

interface SecureTransaction {
  userId: string;
  amount: number;
  type: 'debit' | 'credit';
  description: string;
  metadata?: any;
}

export class TransactionSecurity {
  private static pendingTransactions = new Map<string, Set<string>>();

  /**
   * Atomic balance operation with race condition protection
   */
  static async atomicBalanceUpdate(
    userId: string,
    amount: number,
    operation: 'debit' | 'credit',
    transactionId: string
  ): Promise<{ success: boolean; newBalance?: number; error?: string }> {
    // Check for concurrent transactions
    if (this.pendingTransactions.has(userId)) {
      const pending = this.pendingTransactions.get(userId)!;
      if (pending.has(transactionId)) {
        return { success: false, error: 'Transaction already in progress' };
      }
      pending.add(transactionId);
    } else {
      this.pendingTransactions.set(userId, new Set([transactionId]));
    }

    try {
      return await db.transaction(async (tx) => {
        // Lock user row for update
        const [user] = await tx
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .for('update');

        if (!user) {
          return { success: false, error: 'User not found' };
        }

        const currentBalance = parseFloat(user.usdBalance || '0');
        let newBalance: number;

        if (operation === 'debit') {
          if (currentBalance < amount) {
            return { success: false, error: 'Insufficient balance' };
          }
          newBalance = currentBalance - amount;
        } else {
          newBalance = currentBalance + amount;
        }

        // Update balance with optimistic locking
        const [updatedUser] = await tx
          .update(users)
          .set({ 
            usdBalance: newBalance.toFixed(2),
            updatedAt: new Date()
          })
          .where(eq(users.id, userId))
          .returning();

        return { success: true, newBalance: newBalance };
      });
    } catch (error) {
      console.error('Atomic balance update failed:', error);
      return { success: false, error: 'Transaction failed' };
    } finally {
      // Clean up pending transaction
      const pending = this.pendingTransactions.get(userId);
      if (pending) {
        pending.delete(transactionId);
        if (pending.size === 0) {
          this.pendingTransactions.delete(userId);
        }
      }
    }
  }

  /**
   * Enhanced amount validation with attack prevention
   */
  static validateAmount(amount: any): { isValid: boolean; value?: number; error?: string } {
    // Convert to string first to handle various input types
    const amountStr = String(amount).trim();

    // Check for unicode attacks and suspicious patterns
    if (/[^\d\.\-\+e]/i.test(amountStr)) {
      return { isValid: false, error: 'Invalid characters in amount' };
    }

    // Parse with strict validation
    const numAmount = Number(amountStr);

    if (!Number.isFinite(numAmount)) {
      return { isValid: false, error: 'Amount must be a finite number' };
    }

    if (numAmount < 0) {
      return { isValid: false, error: 'Amount cannot be negative' };
    }

    if (numAmount === 0) {
      return { isValid: false, error: 'Amount must be greater than zero' };
    }

    // Prevent micro-transaction spam (minimum $2.50)
    if (numAmount < 2.50) {
      return { isValid: false, error: 'Minimum transaction $2.50' };
    }

    // Prevent excessively large amounts (maximum $1M per transaction)
    if (numAmount > 1000000) {
      return { isValid: false, error: 'Amount too large (maximum $1,000,000)' };
    }

    // Round to prevent floating point precision attacks
    const roundedAmount = Math.round(numAmount * 100) / 100;

    return { isValid: true, value: roundedAmount };
  }

  /**
   * Transaction signature validation
   */
  static validateTransactionSignature(
    transaction: any,
    expectedUserId: string
  ): boolean {
    // Verify transaction ownership
    if (transaction.userId !== expectedUserId) {
      return false;
    }

    // Additional signature validation can be added here
    // For now, ensure basic integrity
    return true;
  }

  /**
   * Anti-replay attack protection
   */
  private static processedTransactions = new Set<string>();

  static checkReplayAttack(transactionId: string): boolean {
    if (this.processedTransactions.has(transactionId)) {
      return true; // Replay detected
    }
    
    this.processedTransactions.add(transactionId);
    
    // Clean up old entries (keep last 10000)
    if (this.processedTransactions.size > 10000) {
      const entries = Array.from(this.processedTransactions);
      this.processedTransactions.clear();
      entries.slice(-5000).forEach(id => this.processedTransactions.add(id));
    }
    
    return false;
  }
}

/**
 * Middleware for securing financial transactions
 */
export function secureTransactionMiddleware(
  req: Request, 
  res: Response, 
  next: NextFunction
) {
  // Add transaction security methods to request
  (req as any).transactionSecurity = TransactionSecurity;
  
  // Validate transaction ID to prevent replays
  const transactionId = req.body.transactionId || req.headers['x-transaction-id'];
  if (transactionId && TransactionSecurity.checkReplayAttack(transactionId)) {
    return res.status(400).json({
      success: false,
      error: 'Duplicate transaction detected'
    });
  }
  
  next();
}

export default TransactionSecurity;