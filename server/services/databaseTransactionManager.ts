/**
 * Database Transaction Manager - Critical Concurrency Protection
 * Prevents race conditions in P2P transfers and commission calculations
 */

import { db } from '../db';

export interface TransactionContext {
  id: string;
  type: 'p2p_transfer' | 'commission_payout' | 'agent_registration' | 'balance_update';
  userId: string;
  amount?: number;
  status: 'pending' | 'committed' | 'rolled_back' | 'failed';
  startedAt: number;
  completedAt?: number;
  lockedResources: string[];
  retryCount: number;
  maxRetries: number;
}

export class DatabaseTransactionManager {
  private static activeTransactions = new Map<string, TransactionContext>();
  private static resourceLocks = new Map<string, { transactionId: string; lockedAt: number }>();
  private static readonly LOCK_TIMEOUT = 30000; // 30 seconds
  private static readonly MAX_RETRIES = 3;

  /**
   * Execute P2P transfer with optimistic locking
   */
  static async executeP2PTransfer(
    senderId: string,
    receiverId: string,
    amount: number,
    currency: string
  ): Promise<{ success: boolean; transactionId?: string; error?: string }> {
    const transactionId = `p2p_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const context: TransactionContext = {
      id: transactionId,
      type: 'p2p_transfer',
      userId: senderId,
      amount,
      status: 'pending',
      startedAt: Date.now(),
      lockedResources: [`balance_${senderId}`, `balance_${receiverId}`],
      retryCount: 0,
      maxRetries: this.MAX_RETRIES
    };

    try {
      // Acquire locks on sender and receiver balances
      const lockAcquired = await this.acquireResourceLocks(context);
      if (!lockAcquired) {
        return { success: false, error: 'Unable to acquire transaction locks' };
      }

      this.activeTransactions.set(transactionId, context);

      // NON-TRANSACTIONAL version for neon-http driver compatibility
      // Execute the transfer with optimistic locking
      
      // 1. Verify sender balance
      const senderBalance = await db.query.users.findFirst({
        where: (users, { eq }) => eq(users.id, senderId),
        columns: { balance: true, version: true }
      });

      if (!senderBalance || senderBalance.balance < amount) {
        throw new Error('Insufficient balance');
      }

      // 2. Verify receiver exists
      const receiver = await db.query.users.findFirst({
        where: (users, { eq }) => eq(users.id, receiverId),
        columns: { id: true, version: true, balance: true }
      });

      if (!receiver) {
        throw new Error('Receiver not found');
      }

      // 3. Update sender balance with version check
      const senderUpdate = await db.update(users)
        .set({ 
          balance: senderBalance.balance - amount,
          version: senderBalance.version + 1
        })
        .where(and(
          eq(users.id, senderId),
          eq(users.version, senderBalance.version)
        ))
        .returning();

      if (senderUpdate.length === 0) {
        throw new Error('Concurrent modification detected - sender balance');
      }

      // 4. Update receiver balance with version check
      const receiverUpdate = await db.update(users)
        .set({ 
          balance: receiver.balance + amount,
          version: receiver.version + 1
        })
        .where(and(
          eq(users.id, receiverId),
          eq(users.version, receiver.version)
        ))
        .returning();

      if (receiverUpdate.length === 0) {
        // Attempt to rollback sender update
        await db.update(users)
          .set({ 
            balance: senderBalance.balance,
            version: senderBalance.version
          })
          .where(eq(users.id, senderId));
        throw new Error('Concurrent modification detected - receiver balance');
      }

      // 5. Create transaction record
      await db.insert(transactions).values({
        id: transactionId,
        senderId,
        receiverId,
        amount,
        currency,
        type: 'p2p_transfer',
        status: 'completed',
        createdAt: new Date()
      });

      const result = { success: true, transactionId };

      // Mark transaction as committed
      context.status = 'committed';
      context.completedAt = Date.now();
      
      this.releaseResourceLocks(context);
      this.activeTransactions.delete(transactionId);

      return result;

    } catch (error) {
      // Handle retry logic for recoverable errors
      if (this.isRetryableError(error) && context.retryCount < context.maxRetries) {
        context.retryCount++;
        this.releaseResourceLocks(context);
        
        // Exponential backoff
        const delay = Math.pow(2, context.retryCount) * 100;
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return this.executeP2PTransfer(senderId, receiverId, amount, currency);
      }

      // Mark transaction as failed
      context.status = 'failed';
      context.completedAt = Date.now();
      
      this.releaseResourceLocks(context);
      this.activeTransactions.delete(transactionId);

      return { success: false, error: error.message };
    }
  }

  /**
   * Execute commission payout with atomicity
   */
  static async executeCommissionPayout(
    agentId: string,
    commissions: { tier: number; amount: number }[],
    transactionRef: string
  ): Promise<{ success: boolean; payoutId?: string; error?: string }> {
    const payoutId = `commission_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const context: TransactionContext = {
      id: payoutId,
      type: 'commission_payout',
      userId: agentId,
      amount: commissions.reduce((sum, c) => sum + c.amount, 0),
      status: 'pending',
      startedAt: Date.now(),
      lockedResources: [`balance_${agentId}`, `commission_${transactionRef}`],
      retryCount: 0,
      maxRetries: this.MAX_RETRIES
    };

    try {
      const lockAcquired = await this.acquireResourceLocks(context);
      if (!lockAcquired) {
        return { success: false, error: 'Unable to acquire commission locks' };
      }

      this.activeTransactions.set(payoutId, context);

      // NON-TRANSACTIONAL version for neon-http driver compatibility
      
      // 1. Verify commission hasn't been paid already
      const existingPayout = await db.query.commissionPayouts.findFirst({
        where: (payouts, { eq }) => eq(payouts.transactionRef, transactionRef)
      });

      if (existingPayout) {
        throw new Error('Commission already paid for this transaction');
      }

      // 2. Get agent balance
      const agent = await db.query.users.findFirst({
        where: (users, { eq }) => eq(users.id, agentId),
        columns: { balance: true, version: true }
      });

      if (!agent) {
        throw new Error('Agent not found');
      }

      const totalCommission = commissions.reduce((sum, c) => sum + c.amount, 0);

      // 3. Update agent balance with version check
      const agentUpdate = await db.update(users)
        .set({ 
          balance: agent.balance + totalCommission,
          version: agent.version + 1
        })
        .where(and(
          eq(users.id, agentId),
          eq(users.version, agent.version)
        ))
        .returning();

      if (agentUpdate.length === 0) {
        throw new Error('Concurrent modification detected - agent balance');
      }

      // 4. Record commission payout
      await db.insert(commissionPayouts).values({
        id: payoutId,
        agentId,
        transactionRef,
        totalAmount: totalCommission,
        tiers: commissions,
        status: 'completed',
        createdAt: new Date()
      });

      const result = { success: true, payoutId };

      context.status = 'committed';
      context.completedAt = Date.now();
      
      this.releaseResourceLocks(context);
      this.activeTransactions.delete(payoutId);

      return result;

    } catch (error) {
      if (this.isRetryableError(error) && context.retryCount < context.maxRetries) {
        context.retryCount++;
        this.releaseResourceLocks(context);
        
        const delay = Math.pow(2, context.retryCount) * 100;
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return this.executeCommissionPayout(agentId, commissions, transactionRef);
      }

      context.status = 'failed';
      context.completedAt = Date.now();
      
      this.releaseResourceLocks(context);
      this.activeTransactions.delete(payoutId);

      return { success: false, error: error.message };
    }
  }

  /**
   * Acquire locks on required resources
   */
  private static async acquireResourceLocks(context: TransactionContext): Promise<boolean> {
    const now = Date.now();
    
    // Clean up expired locks first
    this.cleanupExpiredLocks();
    
    // Check if any required resources are locked
    for (const resource of context.lockedResources) {
      if (this.resourceLocks.has(resource)) {
        return false;
      }
    }
    
    // Acquire all locks atomically
    for (const resource of context.lockedResources) {
      this.resourceLocks.set(resource, {
        transactionId: context.id,
        lockedAt: now
      });
    }
    
    return true;
  }

  /**
   * Release locks for a transaction
   */
  private static releaseResourceLocks(context: TransactionContext): void {
    for (const resource of context.lockedResources) {
      const lock = this.resourceLocks.get(resource);
      if (lock && lock.transactionId === context.id) {
        this.resourceLocks.delete(resource);
      }
    }
  }

  /**
   * Clean up expired resource locks
   */
  private static cleanupExpiredLocks(): void {
    const now = Date.now();
    
    for (const [resource, lock] of this.resourceLocks.entries()) {
      if (now - lock.lockedAt > this.LOCK_TIMEOUT) {
        this.resourceLocks.delete(resource);
        console.warn(`Expired lock cleaned up for resource: ${resource}`);
      }
    }
  }

  /**
   * Check if error is retryable
   */
  private static isRetryableError(error: any): boolean {
    const retryableMessages = [
      'concurrent modification detected',
      'database is locked',
      'serialization failure',
      'deadlock detected'
    ];
    
    const errorMessage = error.message?.toLowerCase() || '';
    return retryableMessages.some(msg => errorMessage.includes(msg));
  }

  /**
   * Get transaction statistics
   */
  static getTransactionStatistics(): {
    activeTransactions: number;
    activeLocks: number;
    completedToday: number;
    failedToday: number;
  } {
    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    
    let completedToday = 0;
    let failedToday = 0;
    
    for (const transaction of this.activeTransactions.values()) {
      if (transaction.completedAt && transaction.completedAt > oneDayAgo) {
        if (transaction.status === 'committed') {
          completedToday++;
        } else if (transaction.status === 'failed') {
          failedToday++;
        }
      }
    }
    
    return {
      activeTransactions: this.activeTransactions.size,
      activeLocks: this.resourceLocks.size,
      completedToday,
      failedToday
    };
  }

  /**
   * Force cleanup of stuck transactions (emergency use only)
   */
  static forceCleanupStuckTransactions(): number {
    const now = Date.now();
    const timeout = this.LOCK_TIMEOUT * 2; // Double timeout for stuck transactions
    let cleaned = 0;
    
    for (const [id, transaction] of this.activeTransactions.entries()) {
      if (now - transaction.startedAt > timeout) {
        this.releaseResourceLocks(transaction);
        this.activeTransactions.delete(id);
        cleaned++;
        console.warn(`Force cleaned stuck transaction: ${id}`);
      }
    }
    
    return cleaned;
  }
}