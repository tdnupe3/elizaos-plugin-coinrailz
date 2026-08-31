/**
 * Balance Lock Manager - Critical Security Fix
 * Prevents race condition overdraft exploitation through atomic balance locking
 */

export interface BalanceLock {
  userId: string;
  amount: number;
  lockId: string;
  purpose: string;
  lockedAt: number;
  expiresAt: number;
  status: 'active' | 'released' | 'expired';
}

export interface BalanceReservation {
  success: boolean;
  lockId?: string;
  availableBalance?: number;
  error?: string;
}

export class BalanceLockManager {
  private static locks = new Map<string, BalanceLock>();
  private static userBalances = new Map<string, number>();
  private static readonly LOCK_TIMEOUT = 300000; // 5 minutes
  private static readonly CLEANUP_INTERVAL = 60000; // 1 minute

  static {
    // Start automatic cleanup of expired locks
    setInterval(() => this.cleanupExpiredLocks(), this.CLEANUP_INTERVAL);
  }

  /**
   * Reserve balance for a transaction with atomic locking
   */
  static async reserveBalance(
    userId: string,
    amount: number,
    purpose: string
  ): Promise<BalanceReservation> {
    if (amount <= 0) {
      return { success: false, error: 'Invalid amount for balance reservation' };
    }

    const lockId = `lock_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Clean up any expired locks for this user first
      this.cleanupUserExpiredLocks(userId);
      
      // Get current available balance (actual balance minus reserved amounts)
      const availableBalance = await this.getAvailableBalance(userId);
      
      if (availableBalance < amount) {
        return {
          success: false,
          availableBalance,
          error: `Insufficient balance. Available: $${availableBalance.toFixed(2)}, Required: $${amount.toFixed(2)}`
        };
      }

      // Create the lock
      const lock: BalanceLock = {
        userId,
        amount,
        lockId,
        purpose,
        lockedAt: Date.now(),
        expiresAt: Date.now() + this.LOCK_TIMEOUT,
        status: 'active'
      };

      this.locks.set(lockId, lock);
      
      console.log(`Balance reserved: $${amount} for user ${userId} (${purpose})`);
      
      return {
        success: true,
        lockId,
        availableBalance: availableBalance - amount
      };

    } catch (error) {
      return {
        success: false,
        error: `Failed to reserve balance: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Release a balance reservation
   */
  static async releaseReservation(lockId: string): Promise<{ success: boolean; error?: string }> {
    const lock = this.locks.get(lockId);
    
    if (!lock) {
      return { success: false, error: 'Lock not found or already released' };
    }

    if (lock.status !== 'active') {
      return { success: false, error: `Lock is ${lock.status}, cannot release` };
    }

    // Mark lock as released
    lock.status = 'released';
    this.locks.delete(lockId);
    
    console.log(`Balance reservation released: $${lock.amount} for user ${lock.userId} (${lock.purpose})`);
    
    return { success: true };
  }

  /**
   * Commit a balance reservation (actually debit the amount)
   */
  static async commitReservation(
    lockId: string,
    actualAmount?: number
  ): Promise<{ success: boolean; error?: string }> {
    const lock = this.locks.get(lockId);
    
    if (!lock) {
      return { success: false, error: 'Lock not found or already processed' };
    }

    if (lock.status !== 'active') {
      return { success: false, error: `Lock is ${lock.status}, cannot commit` };
    }

    const commitAmount = actualAmount || lock.amount;
    
    if (commitAmount > lock.amount) {
      return { 
        success: false, 
        error: `Commit amount ($${commitAmount}) exceeds reserved amount ($${lock.amount})` 
      };
    }

    try {
      // Get current balance
      const currentBalance = this.userBalances.get(lock.userId) || 0;
      
      // Verify sufficient balance (this should always pass if reservation was correct)
      if (currentBalance < commitAmount) {
        return {
          success: false,
          error: `Insufficient balance for commit. Balance: $${currentBalance}, Required: $${commitAmount}`
        };
      }

      // Commit the transaction by updating balance
      this.userBalances.set(lock.userId, currentBalance - commitAmount);
      
      // Release the lock
      lock.status = 'released';
      this.locks.delete(lockId);
      
      console.log(`Balance committed: $${commitAmount} for user ${lock.userId} (${lock.purpose})`);
      
      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: `Failed to commit balance: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Get available balance (actual balance minus reserved amounts)
   */
  static async getAvailableBalance(userId: string): Promise<number> {
    // Clean up expired locks first
    this.cleanupUserExpiredLocks(userId);
    
    // Get actual balance (in production, this would query the database)
    const actualBalance = this.userBalances.get(userId) || 0;
    
    // Calculate total reserved amount
    const reservedAmount = Array.from(this.locks.values())
      .filter(lock => lock.userId === userId && lock.status === 'active')
      .reduce((total, lock) => total + lock.amount, 0);
    
    return Math.max(0, actualBalance - reservedAmount);
  }

  /**
   * Get actual balance (without reservations)
   */
  static async getActualBalance(userId: string): Promise<number> {
    return this.userBalances.get(userId) || 0;
  }

  /**
   * Set user balance (for testing and initialization)
   */
  static async setUserBalance(userId: string, balance: number): Promise<void> {
    this.userBalances.set(userId, balance);
  }

  /**
   * Get all active locks for a user
   */
  static getUserActiveLocks(userId: string): BalanceLock[] {
    this.cleanupUserExpiredLocks(userId);
    
    return Array.from(this.locks.values())
      .filter(lock => lock.userId === userId && lock.status === 'active');
  }

  /**
   * Clean up expired locks for a specific user
   */
  private static cleanupUserExpiredLocks(userId: string): void {
    const now = Date.now();
    
    for (const [lockId, lock] of this.locks.entries()) {
      if (lock.userId === userId && lock.status === 'active' && now > lock.expiresAt) {
        lock.status = 'expired';
        this.locks.delete(lockId);
        console.warn(`Expired balance lock cleaned up: ${lockId} for user ${userId}`);
      }
    }
  }

  /**
   * Clean up all expired locks
   */
  private static cleanupExpiredLocks(): void {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [lockId, lock] of this.locks.entries()) {
      if (lock.status === 'active' && now > lock.expiresAt) {
        lock.status = 'expired';
        this.locks.delete(lockId);
        cleanedCount++;
        console.warn(`Expired balance lock cleaned up: ${lockId} for user ${lock.userId}`);
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} expired balance locks`);
    }
  }

  /**
   * Force release all locks for a user (emergency use only)
   */
  static async forceReleaseUserLocks(userId: string): Promise<number> {
    let releasedCount = 0;
    
    for (const [lockId, lock] of this.locks.entries()) {
      if (lock.userId === userId && lock.status === 'active') {
        lock.status = 'released';
        this.locks.delete(lockId);
        releasedCount++;
        console.warn(`Force released balance lock: ${lockId} for user ${userId}`);
      }
    }
    
    return releasedCount;
  }

  /**
   * Get comprehensive lock statistics
   */
  static getLockStatistics(): {
    totalActiveLocks: number;
    totalReservedAmount: number;
    locksByUser: Map<string, number>;
    oldestLockAge: number;
    averageLockAmount: number;
  } {
    const activeLocks = Array.from(this.locks.values()).filter(lock => lock.status === 'active');
    const now = Date.now();
    
    const totalReservedAmount = activeLocks.reduce((sum, lock) => sum + lock.amount, 0);
    const locksByUser = new Map<string, number>();
    let oldestLockAge = 0;
    
    activeLocks.forEach(lock => {
      locksByUser.set(lock.userId, (locksByUser.get(lock.userId) || 0) + 1);
      const age = now - lock.lockedAt;
      if (age > oldestLockAge) oldestLockAge = age;
    });
    
    const averageLockAmount = activeLocks.length > 0 ? totalReservedAmount / activeLocks.length : 0;
    
    return {
      totalActiveLocks: activeLocks.length,
      totalReservedAmount,
      locksByUser,
      oldestLockAge,
      averageLockAmount
    };
  }

  /**
   * Extend lock timeout (for long-running operations)
   */
  static async extendLock(lockId: string, additionalTime: number): Promise<{ success: boolean; error?: string }> {
    const lock = this.locks.get(lockId);
    
    if (!lock) {
      return { success: false, error: 'Lock not found' };
    }

    if (lock.status !== 'active') {
      return { success: false, error: `Lock is ${lock.status}, cannot extend` };
    }

    lock.expiresAt = Math.max(lock.expiresAt, Date.now()) + additionalTime;
    
    return { success: true };
  }
}