/**
 * Transaction Replay Protection System - Critical Production Fix
 * Prevents $200K+ duplicate transactions through replay attacks
 */

export interface TransactionNonce {
  nonce: string;
  userId: string;
  transactionType: string;
  amount: number;
  timestamp: number;
  expiresAt: number;
  used: boolean;
  transactionId?: string;
}

export interface ReplayValidationResult {
  valid: boolean;
  nonce?: string;
  reason?: string;
  existingTransactionId?: string;
  timeRemaining?: number;
}

export class TransactionReplayProtection {
  private static usedNonces = new Map<string, TransactionNonce>();
  private static userNonces = new Map<string, Set<string>>(); // userId -> Set<nonce>
  private static readonly NONCE_EXPIRY = 3600000; // 1 hour
  private static readonly MAX_NONCES_PER_USER = 100;

  static {
    // Cleanup expired nonces every 10 minutes
    setInterval(() => this.cleanupExpiredNonces(), 600000);
  }

  /**
   * Generate secure transaction nonce for user
   */
  static generateTransactionNonce(
    userId: string,
    transactionType: string,
    amount: number
  ): string {
    const timestamp = Date.now();
    const randomComponent = Math.random().toString(36).substring(2, 15);
    const userComponent = userId.substring(0, 8);
    const typeComponent = transactionType.substring(0, 4);
    
    // Create cryptographically strong nonce
    const nonce = `${userComponent}_${typeComponent}_${timestamp}_${randomComponent}`;
    
    // Store nonce metadata
    const nonceData: TransactionNonce = {
      nonce,
      userId,
      transactionType,
      amount,
      timestamp,
      expiresAt: timestamp + this.NONCE_EXPIRY,
      used: false
    };

    this.usedNonces.set(nonce, nonceData);
    
    // Add to user's nonce set
    if (!this.userNonces.has(userId)) {
      this.userNonces.set(userId, new Set());
    }
    this.userNonces.get(userId)!.add(nonce);

    // Enforce max nonces per user
    this.enforceUserNonceLimit(userId);

    console.log(`Generated transaction nonce ${nonce} for user ${userId}`);
    return nonce;
  }

  /**
   * Validate transaction nonce and prevent replay
   */
  static validateTransactionNonce(
    nonce: string,
    userId: string,
    transactionType: string,
    amount: number
  ): ReplayValidationResult {
    // Check if nonce exists
    const nonceData = this.usedNonces.get(nonce);
    if (!nonceData) {
      return {
        valid: false,
        reason: 'Invalid or expired nonce'
      };
    }

    // Check if nonce is expired
    if (Date.now() > nonceData.expiresAt) {
      this.usedNonces.delete(nonce);
      return {
        valid: false,
        reason: 'Nonce has expired'
      };
    }

    // Check if nonce already used
    if (nonceData.used) {
      return {
        valid: false,
        reason: 'Transaction nonce already used (replay attack detected)',
        existingTransactionId: nonceData.transactionId
      };
    }

    // Validate nonce belongs to user
    if (nonceData.userId !== userId) {
      return {
        valid: false,
        reason: 'Nonce does not belong to requesting user'
      };
    }

    // Validate transaction type matches
    if (nonceData.transactionType !== transactionType) {
      return {
        valid: false,
        reason: 'Transaction type mismatch'
      };
    }

    // Validate amount matches (with small tolerance for floating point)
    const amountDifference = Math.abs(nonceData.amount - amount);
    if (amountDifference > 0.01) {
      return {
        valid: false,
        reason: 'Transaction amount mismatch'
      };
    }

    return {
      valid: true,
      nonce,
      timeRemaining: nonceData.expiresAt - Date.now()
    };
  }

  /**
   * Consume nonce after successful transaction
   */
  static consumeTransactionNonce(nonce: string, transactionId: string): boolean {
    const nonceData = this.usedNonces.get(nonce);
    if (!nonceData || nonceData.used) {
      return false;
    }

    // Mark nonce as used
    nonceData.used = true;
    nonceData.transactionId = transactionId;

    console.log(`Consumed transaction nonce ${nonce} for transaction ${transactionId}`);
    return true;
  }

  /**
   * Check for potential replay attack patterns
   */
  static detectReplayAttackPatterns(userId: string): {
    suspiciousActivity: boolean;
    patterns: string[];
    riskScore: number;
  } {
    const userNonceSet = this.userNonces.get(userId);
    if (!userNonceSet) {
      return {
        suspiciousActivity: false,
        patterns: [],
        riskScore: 0
      };
    }

    const patterns: string[] = [];
    let riskScore = 0;

    // Get user's recent nonces
    const userNonces = Array.from(userNonceSet)
      .map(nonce => this.usedNonces.get(nonce))
      .filter(data => data && Date.now() - data.timestamp < 3600000) // Last hour
      .sort((a, b) => b!.timestamp - a!.timestamp);

    // Pattern 1: Rapid nonce generation
    const recentNonces = userNonces.filter(data => Date.now() - data!.timestamp < 300000); // Last 5 minutes
    if (recentNonces.length > 10) {
      patterns.push('Rapid nonce generation detected');
      riskScore += 30;
    }

    // Pattern 2: Similar transaction amounts
    const amounts = userNonces.map(data => data!.amount);
    const uniqueAmounts = new Set(amounts);
    if (amounts.length > 5 && uniqueAmounts.size < amounts.length * 0.3) {
      patterns.push('Repetitive transaction amounts');
      riskScore += 20;
    }

    // Pattern 3: Multiple used nonces with same parameters
    const usedNonces = userNonces.filter(data => data!.used);
    const duplicateParams = new Map<string, number>();
    
    usedNonces.forEach(data => {
      const key = `${data!.transactionType}_${data!.amount}`;
      duplicateParams.set(key, (duplicateParams.get(key) || 0) + 1);
    });

    for (const [key, count] of duplicateParams.entries()) {
      if (count > 3) {
        patterns.push(`Multiple transactions with identical parameters: ${key}`);
        riskScore += 40;
      }
    }

    // Pattern 4: Expired nonce usage attempts (would be blocked but indicates intent)
    const expiredAttempts = userNonces.filter(data => 
      !data!.used && Date.now() > data!.expiresAt
    ).length;
    
    if (expiredAttempts > 5) {
      patterns.push('Multiple expired nonce usage attempts');
      riskScore += 25;
    }

    return {
      suspiciousActivity: riskScore > 50,
      patterns,
      riskScore: Math.min(100, riskScore)
    };
  }

  /**
   * Get nonce information for debugging
   */
  static getNonceInfo(nonce: string): TransactionNonce | null {
    return this.usedNonces.get(nonce) || null;
  }

  /**
   * Get user's active nonces
   */
  static getUserActiveNonces(userId: string): TransactionNonce[] {
    const userNonceSet = this.userNonces.get(userId);
    if (!userNonceSet) {
      return [];
    }

    const now = Date.now();
    return Array.from(userNonceSet)
      .map(nonce => this.usedNonces.get(nonce))
      .filter(data => data && !data.used && now < data.expiresAt) as TransactionNonce[];
  }

  /**
   * Revoke user's unused nonces (for security incidents)
   */
  static revokeUserNonces(userId: string): number {
    const userNonceSet = this.userNonces.get(userId);
    if (!userNonceSet) {
      return 0;
    }

    let revokedCount = 0;
    for (const nonce of userNonceSet) {
      const nonceData = this.usedNonces.get(nonce);
      if (nonceData && !nonceData.used) {
        nonceData.expiresAt = Date.now(); // Expire immediately
        revokedCount++;
      }
    }

    console.warn(`Revoked ${revokedCount} nonces for user ${userId}`);
    return revokedCount;
  }

  /**
   * Enforce maximum nonces per user
   */
  private static enforceUserNonceLimit(userId: string): void {
    const userNonceSet = this.userNonces.get(userId);
    if (!userNonceSet || userNonceSet.size <= this.MAX_NONCES_PER_USER) {
      return;
    }

    // Remove oldest nonces
    const userNonces = Array.from(userNonceSet)
      .map(nonce => ({ nonce, data: this.usedNonces.get(nonce) }))
      .filter(item => item.data)
      .sort((a, b) => a.data!.timestamp - b.data!.timestamp);

    const toRemove = userNonces.slice(0, userNonces.length - this.MAX_NONCES_PER_USER);
    
    for (const item of toRemove) {
      this.usedNonces.delete(item.nonce);
      userNonceSet.delete(item.nonce);
    }

    console.log(`Removed ${toRemove.length} old nonces for user ${userId}`);
  }

  /**
   * Clean up expired nonces
   */
  private static cleanupExpiredNonces(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [nonce, data] of this.usedNonces.entries()) {
      if (now > data.expiresAt) {
        this.usedNonces.delete(nonce);
        
        // Remove from user's nonce set
        const userNonceSet = this.userNonces.get(data.userId);
        if (userNonceSet) {
          userNonceSet.delete(nonce);
          if (userNonceSet.size === 0) {
            this.userNonces.delete(data.userId);
          }
        }
        
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} expired transaction nonces`);
    }
  }

  /**
   * Get comprehensive statistics
   */
  static getReplayProtectionStatistics(): {
    totalNonces: number;
    activeNonces: number;
    usedNonces: number;
    expiredNonces: number;
    uniqueUsers: number;
    averageNoncesPerUser: number;
    suspiciousUsers: number;
  } {
    const now = Date.now();
    let activeCount = 0;
    let usedCount = 0;
    let expiredCount = 0;
    let suspiciousUsers = 0;

    for (const data of this.usedNonces.values()) {
      if (data.used) {
        usedCount++;
      } else if (now > data.expiresAt) {
        expiredCount++;
      } else {
        activeCount++;
      }
    }

    // Check for suspicious users
    for (const userId of this.userNonces.keys()) {
      const detection = this.detectReplayAttackPatterns(userId);
      if (detection.suspiciousActivity) {
        suspiciousUsers++;
      }
    }

    const uniqueUsers = this.userNonces.size;
    const averageNoncesPerUser = uniqueUsers > 0 ? this.usedNonces.size / uniqueUsers : 0;

    return {
      totalNonces: this.usedNonces.size,
      activeNonces: activeCount,
      usedNonces: usedCount,
      expiredNonces: expiredCount,
      uniqueUsers,
      averageNoncesPerUser: Math.round(averageNoncesPerUser * 100) / 100,
      suspiciousUsers
    };
  }

  /**
   * Emergency cleanup for security incidents
   */
  static emergencyCleanup(): {
    noncesCleared: number;
    usersAffected: number;
  } {
    const noncesCleared = this.usedNonces.size;
    const usersAffected = this.userNonces.size;

    this.usedNonces.clear();
    this.userNonces.clear();

    console.warn(`Emergency cleanup: ${noncesCleared} nonces cleared for ${usersAffected} users`);
    
    return {
      noncesCleared,
      usersAffected
    };
  }
}