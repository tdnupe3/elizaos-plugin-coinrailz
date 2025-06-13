/**
 * Transaction Validator - Critical Input Validation and Limits
 * Addresses Priority 1 security vulnerabilities
 */

export interface TransactionValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
  adjustedAmount?: number;
}

export interface TransactionLimits {
  minAmount: number;
  maxAmount: number;
  dailyMonitoringThreshold: number;   // No limit, just monitoring
  monthlyMonitoringThreshold: number; // No limit, just monitoring
  maxVelocity: number; // transactions per minute
  manualReviewThreshold: number;
}

export class TransactionValidator {
  private static readonly LIMITS: TransactionLimits = {
    minAmount: 5.00,                      // $5 minimum
    maxAmount: 10000.00,                  // $10K maximum (AML threshold) - FIAT ONLY
    dailyMonitoringThreshold: 25000.00,   // $25K daily monitoring (no blocking)
    monthlyMonitoringThreshold: 100000.00, // $100K monthly monitoring (no blocking)
    maxVelocity: 10,                      // 10 transactions per minute max (increased for volume)
    manualReviewThreshold: 5000.00        // $5K manual review threshold
  };

  private static userTransactionHistory = new Map<string, {
    daily: { amount: number; count: number; date: string };
    monthly: { amount: number; count: number; month: string };
    recent: number[]; // timestamps of recent transactions
  }>();

  /**
   * Validate transaction amount and limits
   */
  static validateTransaction(
    userId: string,
    amount: number,
    paymentMethod: string
  ): TransactionValidationResult {
    const warnings: string[] = [];

    // Basic amount validation
    if (amount === null || amount === undefined || isNaN(amount)) {
      return { valid: false, error: 'Invalid amount provided' };
    }

    if (amount <= 0) {
      return { valid: false, error: 'Amount must be greater than zero' };
    }

    if (amount < this.LIMITS.minAmount) {
      return { 
        valid: false, 
        error: `Minimum transaction amount is $${this.LIMITS.minAmount}` 
      };
    }

    // Maximum amount validation - ONLY for fiat transactions
    const isCrypto = ['crypto', 'xrp', 'bitcoin', 'ethereum'].includes(paymentMethod.toLowerCase());
    if (!isCrypto && amount > this.LIMITS.maxAmount) {
      return { 
        valid: false, 
        error: `Maximum fiat transaction amount is $${this.LIMITS.maxAmount} (AML compliance)` 
      };
    }

    // Floating point precision fix
    const adjustedAmount = Math.round(amount * 100) / 100;
    if (amount !== adjustedAmount) {
      warnings.push('Amount rounded to nearest cent for precision');
    }

    // Monitoring thresholds (no blocking, just tracking)
    const monitoringCheck = this.checkMonitoringThresholds(userId, adjustedAmount);
    if (monitoringCheck.warnings.length > 0) {
      warnings.push(...monitoringCheck.warnings);
    }

    // Velocity validation
    const velocityCheck = this.validateVelocity(userId);
    if (!velocityCheck.valid) {
      return velocityCheck;
    }

    // Manual review threshold
    if (adjustedAmount >= this.LIMITS.manualReviewThreshold) {
      warnings.push('Transaction flagged for manual review (>$5K)');
    }

    // AML threshold warning
    if (adjustedAmount >= 3000) {
      warnings.push('Large transaction - additional monitoring applied');
    }

    // Crypto transaction special handling
    if (isCrypto && adjustedAmount > 50000) {
      warnings.push('Large crypto transaction - enhanced monitoring applied');
    }

    return {
      valid: true,
      adjustedAmount,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * Check monitoring thresholds (no blocking, just tracking and alerting)
   */
  private static checkMonitoringThresholds(
    userId: string,
    amount: number
  ): { warnings: string[] } {
    const warnings: string[] = [];
    const today = new Date().toISOString().split('T')[0];
    const thisMonth = new Date().toISOString().substring(0, 7);

    let userHistory = this.userTransactionHistory.get(userId);
    if (!userHistory) {
      userHistory = {
        daily: { amount: 0, count: 0, date: today },
        monthly: { amount: 0, count: 0, month: thisMonth },
        recent: []
      };
      this.userTransactionHistory.set(userId, userHistory);
    }

    // Reset daily counter if new day
    if (userHistory.daily.date !== today) {
      userHistory.daily = { amount: 0, count: 0, date: today };
    }

    // Reset monthly counter if new month
    if (userHistory.monthly.month !== thisMonth) {
      userHistory.monthly = { amount: 0, count: 0, month: thisMonth };
    }

    // Check daily monitoring threshold
    const newDailyAmount = userHistory.daily.amount + amount;
    if (newDailyAmount > this.LIMITS.dailyMonitoringThreshold) {
      warnings.push(`Account exceeds daily monitoring threshold ($${this.LIMITS.dailyMonitoringThreshold}) - enhanced tracking enabled`);
    }

    // Check monthly monitoring threshold
    const newMonthlyAmount = userHistory.monthly.amount + amount;
    if (newMonthlyAmount > this.LIMITS.monthlyMonitoringThreshold) {
      warnings.push(`Account exceeds monthly monitoring threshold ($${this.LIMITS.monthlyMonitoringThreshold}) - enhanced tracking enabled`);
    }

    return { warnings };
  }

  /**
   * Validate transaction velocity (prevent rapid-fire transactions)
   */
  private static validateVelocity(userId: string): TransactionValidationResult {
    const userHistory = this.userTransactionHistory.get(userId);
    if (!userHistory) return { valid: true };

    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Clean old timestamps
    userHistory.recent = userHistory.recent.filter(ts => ts > oneMinuteAgo);

    // Check velocity
    if (userHistory.recent.length >= this.LIMITS.maxVelocity) {
      return {
        valid: false,
        error: 'Transaction velocity limit exceeded. Please wait before submitting another transaction.'
      };
    }

    return { valid: true };
  }

  /**
   * Record successful transaction
   */
  static recordTransaction(userId: string, amount: number): void {
    const today = new Date().toISOString().split('T')[0];
    const thisMonth = new Date().toISOString().substring(0, 7);
    const now = Date.now();

    let userHistory = this.userTransactionHistory.get(userId);
    if (!userHistory) {
      userHistory = {
        daily: { amount: 0, count: 0, date: today },
        monthly: { amount: 0, count: 0, month: thisMonth },
        recent: []
      };
    }

    // Update daily stats
    if (userHistory.daily.date === today) {
      userHistory.daily.amount += amount;
      userHistory.daily.count += 1;
    } else {
      userHistory.daily = { amount: amount, count: 1, date: today };
    }

    // Update monthly stats
    if (userHistory.monthly.month === thisMonth) {
      userHistory.monthly.amount += amount;
      userHistory.monthly.count += 1;
    } else {
      userHistory.monthly = { amount: amount, count: 1, month: thisMonth };
    }

    // Add to recent transactions
    userHistory.recent.push(now);

    this.userTransactionHistory.set(userId, userHistory);
  }

  /**
   * Validate payment method
   */
  static validatePaymentMethod(paymentMethod: string): TransactionValidationResult {
    const validMethods = ['credit_card', 'paypal', 'crypto', 'xrp', 'stripe'];
    
    if (!paymentMethod || typeof paymentMethod !== 'string') {
      return { valid: false, error: 'Payment method is required' };
    }

    const normalizedMethod = paymentMethod.toLowerCase().trim();
    if (!validMethods.includes(normalizedMethod)) {
      return { 
        valid: false, 
        error: `Invalid payment method. Supported: ${validMethods.join(', ')}` 
      };
    }

    return { valid: true };
  }

  /**
   * Detect potential fraud patterns
   */
  static detectFraudPatterns(
    userId: string,
    amount: number,
    userAgent?: string,
    ipAddress?: string
  ): { riskLevel: 'low' | 'medium' | 'high'; flags: string[] } {
    const flags: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' = 'low';

    const userHistory = this.userTransactionHistory.get(userId);
    
    // Check for suspicious velocity
    if (userHistory && userHistory.recent.length > 3) {
      flags.push('High transaction velocity');
      riskLevel = 'medium';
    }

    // Check for round amount patterns (potential testing)
    if (amount % 100 === 0 && amount >= 1000) {
      flags.push('Round amount pattern');
      riskLevel = 'medium';
    }

    // Check for large first transaction
    if (!userHistory && amount > 1000) {
      flags.push('Large first transaction');
      riskLevel = 'high';
    }

    // Check for rapid amount escalation
    if (userHistory && userHistory.daily.count > 1) {
      const avgDaily = userHistory.daily.amount / userHistory.daily.count;
      if (amount > avgDaily * 3) {
        flags.push('Rapid amount escalation');
        riskLevel = 'high';
      }
    }

    return { riskLevel, flags };
  }

  /**
   * Get user transaction summary with monitoring thresholds
   */
  static getUserTransactionSummary(userId: string): {
    dailyUsed: number;
    dailyMonitoringThreshold: number;
    monthlyUsed: number;
    monthlyMonitoringThreshold: number;
    recentTransactionCount: number;
    isUnderMonitoring: boolean;
  } {
    const userHistory = this.userTransactionHistory.get(userId);
    
    if (!userHistory) {
      return {
        dailyUsed: 0,
        dailyMonitoringThreshold: this.LIMITS.dailyMonitoringThreshold,
        monthlyUsed: 0,
        monthlyMonitoringThreshold: this.LIMITS.monthlyMonitoringThreshold,
        recentTransactionCount: 0,
        isUnderMonitoring: false
      };
    }

    const isUnderMonitoring = userHistory.daily.amount > this.LIMITS.dailyMonitoringThreshold || 
                             userHistory.monthly.amount > this.LIMITS.monthlyMonitoringThreshold;

    return {
      dailyUsed: userHistory.daily.amount,
      dailyMonitoringThreshold: this.LIMITS.dailyMonitoringThreshold,
      monthlyUsed: userHistory.monthly.amount,
      monthlyMonitoringThreshold: this.LIMITS.monthlyMonitoringThreshold,
      recentTransactionCount: userHistory.recent.length,
      isUnderMonitoring
    };
  }
}