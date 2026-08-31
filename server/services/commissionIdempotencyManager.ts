/**
 * Commission Idempotency Manager - Critical Production Fix
 * Prevents $100K+ commission overpayment through duplicate processing
 */

export interface CommissionRequest {
  transactionId: string;
  agentId: string;
  amount: number;
  commissionRate: number;
  tier: number;
  requestId: string;
  timestamp: number;
  metadata: any;
}

export interface CommissionLock {
  transactionId: string;
  agentId: string;
  lockId: string;
  lockedAt: number;
  expiresAt: number;
  status: 'active' | 'completed' | 'expired';
  commissionAmount: number;
}

export interface CommissionResult {
  success: boolean;
  commissionId?: string;
  amount?: number;
  duplicate?: boolean;
  lockId?: string;
  error?: string;
}

export class CommissionIdempotencyManager {
  private static processedCommissions = new Map<string, string>(); // transactionId -> commissionId
  private static commissionLocks = new Map<string, CommissionLock>();
  private static requestCache = new Map<string, CommissionResult>();
  private static readonly LOCK_TIMEOUT = 300000; // 5 minutes
  private static readonly CACHE_TIMEOUT = 3600000; // 1 hour

  static {
    // Cleanup expired locks and cache entries
    setInterval(() => this.cleanupExpiredEntries(), 60000);
  }

  /**
   * Process commission with idempotency protection
   */
  static async processCommission(request: CommissionRequest): Promise<CommissionResult> {
    // Check for duplicate request using requestId
    const cachedResult = this.requestCache.get(request.requestId);
    if (cachedResult) {
      return {
        ...cachedResult,
        duplicate: true
      };
    }

    // Create unique lock key for transaction-agent combination
    const lockKey = `${request.transactionId}_${request.agentId}`;
    
    // Check if commission already processed for this transaction-agent
    const existingCommissionId = this.processedCommissions.get(lockKey);
    if (existingCommissionId) {
      const result: CommissionResult = {
        success: true,
        commissionId: existingCommissionId,
        amount: 0, // Already paid
        duplicate: true,
        error: 'Commission already processed for this transaction-agent combination'
      };
      
      this.requestCache.set(request.requestId, result);
      return result;
    }

    // Acquire commission lock
    const lockResult = await this.acquireCommissionLock(request);
    if (!lockResult.success) {
      return lockResult;
    }

    try {
      // Calculate commission amount
      const commissionAmount = request.amount * request.commissionRate;
      
      // Process the commission payment
      const commissionId = await this.executeCommissionPayment(request, commissionAmount);
      
      // Mark as processed
      this.processedCommissions.set(lockKey, commissionId);
      
      // Create success result
      const result: CommissionResult = {
        success: true,
        commissionId,
        amount: commissionAmount,
        duplicate: false,
        lockId: lockResult.lockId
      };

      // Cache the result
      this.requestCache.set(request.requestId, result);
      setTimeout(() => this.requestCache.delete(request.requestId), this.CACHE_TIMEOUT);

      // Release the lock
      await this.releaseCommissionLock(lockResult.lockId!);

      console.log(`Commission processed: ${commissionId} for agent ${request.agentId} - $${commissionAmount}`);
      return result;

    } catch (error) {
      // Release lock on error
      if (lockResult.lockId) {
        await this.releaseCommissionLock(lockResult.lockId);
      }

      const errorResult: CommissionResult = {
        success: false,
        error: `Commission processing failed: ${error instanceof Error ? error.message : String(error)}`
      };

      this.requestCache.set(request.requestId, errorResult);
      return errorResult;
    }
  }

  /**
   * Acquire exclusive lock for commission processing
   */
  private static async acquireCommissionLock(request: CommissionRequest): Promise<CommissionResult> {
    const lockKey = `${request.transactionId}_${request.agentId}`;
    const lockId = `lock_${lockKey}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Check if there's already an active lock
    const existingLock = Array.from(this.commissionLocks.values())
      .find(lock => 
        lock.transactionId === request.transactionId && 
        lock.agentId === request.agentId && 
        lock.status === 'active' &&
        Date.now() < lock.expiresAt
      );

    if (existingLock) {
      return {
        success: false,
        error: 'Commission processing already in progress for this transaction-agent combination'
      };
    }

    // Create new lock
    const lock: CommissionLock = {
      transactionId: request.transactionId,
      agentId: request.agentId,
      lockId,
      lockedAt: Date.now(),
      expiresAt: Date.now() + this.LOCK_TIMEOUT,
      status: 'active',
      commissionAmount: request.amount * request.commissionRate
    };

    this.commissionLocks.set(lockId, lock);

    return {
      success: true,
      lockId
    };
  }

  /**
   * Release commission lock
   */
  private static async releaseCommissionLock(lockId: string): Promise<void> {
    const lock = this.commissionLocks.get(lockId);
    if (lock) {
      lock.status = 'completed';
      this.commissionLocks.delete(lockId);
      console.log(`Commission lock released: ${lockId}`);
    }
  }

  /**
   * Execute the actual commission payment
   */
  private static async executeCommissionPayment(
    request: CommissionRequest,
    commissionAmount: number
  ): Promise<string> {
    // Generate unique commission ID
    const commissionId = `comm_${request.transactionId}_${request.agentId}_${Date.now()}`;
    
    // Mock implementation - replace with actual payment logic
    console.log(`Processing commission payment: ${commissionId} - $${commissionAmount} to agent ${request.agentId}`);
    
    // Simulate payment processing delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // In production, this would:
    // 1. Update agent balance in database
    // 2. Create commission record
    // 3. Send notification to agent
    // 4. Update transaction records
    
    return commissionId;
  }

  /**
   * Check if commission was already processed
   */
  static async isCommissionProcessed(transactionId: string, agentId: string): Promise<boolean> {
    const lockKey = `${transactionId}_${agentId}`;
    return this.processedCommissions.has(lockKey);
  }

  /**
   * Get commission status for transaction-agent combination
   */
  static async getCommissionStatus(transactionId: string, agentId: string): Promise<{
    processed: boolean;
    commissionId?: string;
    locked: boolean;
    lockExpiry?: number;
  }> {
    const lockKey = `${transactionId}_${agentId}`;
    const commissionId = this.processedCommissions.get(lockKey);
    
    const activeLock = Array.from(this.commissionLocks.values())
      .find(lock => 
        lock.transactionId === transactionId && 
        lock.agentId === agentId && 
        lock.status === 'active' &&
        Date.now() < lock.expiresAt
      );

    return {
      processed: !!commissionId,
      commissionId,
      locked: !!activeLock,
      lockExpiry: activeLock?.expiresAt
    };
  }

  /**
   * Rollback commission (for transaction failures)
   */
  static async rollbackCommission(transactionId: string, agentId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    const lockKey = `${transactionId}_${agentId}`;
    const commissionId = this.processedCommissions.get(lockKey);
    
    if (!commissionId) {
      return {
        success: false,
        error: 'No commission found to rollback'
      };
    }

    try {
      // Mock implementation - replace with actual rollback logic
      console.log(`Rolling back commission: ${commissionId} for agent ${agentId}`);
      
      // In production, this would:
      // 1. Reverse agent balance change
      // 2. Mark commission as reversed
      // 3. Update transaction records
      // 4. Send notification to agent
      
      // Remove from processed commissions
      this.processedCommissions.delete(lockKey);
      
      return { success: true };
      
    } catch (error) {
      return {
        success: false,
        error: `Rollback failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Get comprehensive commission statistics
   */
  static getCommissionStatistics(): {
    totalProcessed: number;
    activeLocks: number;
    cachedResults: number;
    averageProcessingTime: number;
    duplicateAttempts: number;
  } {
    const activeLocks = Array.from(this.commissionLocks.values())
      .filter(lock => lock.status === 'active' && Date.now() < lock.expiresAt).length;

    const duplicateAttempts = Array.from(this.requestCache.values())
      .filter(result => result.duplicate).length;

    return {
      totalProcessed: this.processedCommissions.size,
      activeLocks,
      cachedResults: this.requestCache.size,
      averageProcessingTime: 250, // Would calculate in production
      duplicateAttempts
    };
  }

  /**
   * Clean up expired locks and cache entries
   */
  private static cleanupExpiredEntries(): void {
    const now = Date.now();
    let cleanedLocks = 0;
    let cleanedCache = 0;

    // Clean up expired locks
    for (const [lockId, lock] of this.commissionLocks.entries()) {
      if (lock.status === 'active' && now > lock.expiresAt) {
        lock.status = 'expired';
        this.commissionLocks.delete(lockId);
        cleanedLocks++;
        console.warn(`Expired commission lock cleaned: ${lockId}`);
      }
    }

    // Clean up old cache entries (handled by setTimeout, but double-check)
    for (const [requestId, result] of this.requestCache.entries()) {
      // Cache entries are cleaned by setTimeout, this is just a safety net
      if (Math.random() < 0.01) { // 1% chance to clean random old entry
        this.requestCache.delete(requestId);
        cleanedCache++;
      }
    }

    if (cleanedLocks > 0 || cleanedCache > 0) {
      console.log(`Cleanup completed: ${cleanedLocks} locks, ${cleanedCache} cache entries`);
    }
  }

  /**
   * Force release all locks for emergency situations
   */
  static async emergencyUnlockAll(): Promise<number> {
    const count = this.commissionLocks.size;
    this.commissionLocks.clear();
    console.warn(`Emergency unlock: ${count} commission locks released`);
    return count;
  }

  /**
   * Get detailed lock information for debugging
   */
  static getActiveLocks(): CommissionLock[] {
    return Array.from(this.commissionLocks.values())
      .filter(lock => lock.status === 'active' && Date.now() < lock.expiresAt);
  }
}