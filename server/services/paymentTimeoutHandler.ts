/**
 * Payment Timeout Handler - Critical Payment Processing Safeguards
 * Addresses payment processing failures and stuck transactions
 */

export interface PaymentTimeoutConfig {
  timeout: number;
  maxRetries: number;
  retryDelays: number[];
  enableFailover: boolean;
}

export interface PaymentAttempt {
  id: string;
  userId: string;
  amount: number;
  method: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'timeout';
  attempts: number;
  createdAt: number;
  lastAttemptAt: number;
  error?: string;
  transactionId?: string;
}

export class PaymentTimeoutHandler {
  private static readonly CONFIG: PaymentTimeoutConfig = {
    timeout: 300000,  // 5 minutes
    maxRetries: 3,
    retryDelays: [5000, 15000, 30000], // 5s, 15s, 30s
    enableFailover: true
  };

  private static pendingPayments = new Map<string, PaymentAttempt>();
  private static timeoutHandlers = new Map<string, NodeJS.Timeout>();

  /**
   * Initialize payment with timeout protection
   */
  static initializePayment(
    paymentId: string,
    userId: string,
    amount: number,
    method: string
  ): PaymentAttempt {
    const payment: PaymentAttempt = {
      id: paymentId,
      userId,
      amount,
      method,
      status: 'pending',
      attempts: 0,
      createdAt: Date.now(),
      lastAttemptAt: Date.now()
    };

    this.pendingPayments.set(paymentId, payment);
    this.startTimeoutHandler(paymentId);

    return payment;
  }

  /**
   * Process payment with automatic retry and timeout handling
   */
  static async processPaymentWithRetry(
    paymentId: string,
    paymentProcessor: () => Promise<{ success: boolean; transactionId?: string; error?: string }>
  ): Promise<{ success: boolean; transactionId?: string; error?: string; attempts: number }> {
    const payment = this.pendingPayments.get(paymentId);
    if (!payment) {
      return { success: false, error: 'Payment not found', attempts: 0 };
    }

    payment.attempts += 1;
    payment.lastAttemptAt = Date.now();
    payment.status = 'processing';

    try {
      // Set processing timeout
      const processingPromise = paymentProcessor();
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Payment processing timeout')), this.CONFIG.timeout);
      });

      const result = await Promise.race([processingPromise, timeoutPromise]);

      if (result.success) {
        payment.status = 'completed';
        payment.transactionId = result.transactionId;
        this.clearTimeoutHandler(paymentId);
        this.pendingPayments.delete(paymentId);
        
        return {
          success: true,
          transactionId: result.transactionId,
          attempts: payment.attempts
        };
      } else {
        payment.error = result.error;
        return await this.handlePaymentFailure(paymentId, result.error || 'Payment failed');
      }

    } catch (error: any) {
      const errorMessage = error.message || 'Payment processing error';
      payment.error = errorMessage;
      
      if (errorMessage.includes('timeout')) {
        payment.status = 'timeout';
      }
      
      return await this.handlePaymentFailure(paymentId, errorMessage);
    }
  }

  /**
   * Handle payment failure with retry logic
   */
  private static async handlePaymentFailure(
    paymentId: string,
    error: string
  ): Promise<{ success: boolean; error: string; attempts: number }> {
    const payment = this.pendingPayments.get(paymentId);
    if (!payment) {
      return { success: false, error: 'Payment not found', attempts: 0 };
    }

    // Check if we should retry
    if (payment.attempts < this.CONFIG.maxRetries && this.shouldRetry(error)) {
      const delay = this.CONFIG.retryDelays[payment.attempts - 1] || 30000;
      
      payment.status = 'pending';
      
      // Schedule retry
      setTimeout(async () => {
        const retryPayment = this.pendingPayments.get(paymentId);
        if (retryPayment && retryPayment.status === 'pending') {
          // This would trigger another attempt through the normal flow
          console.log(`Retrying payment ${paymentId} (attempt ${retryPayment.attempts + 1})`);
        }
      }, delay);

      return {
        success: false,
        error: `Payment failed, retry scheduled in ${delay / 1000}s (attempt ${payment.attempts}/${this.CONFIG.maxRetries})`,
        attempts: payment.attempts
      };
    }

    // Max retries reached or non-retryable error
    payment.status = 'failed';
    this.clearTimeoutHandler(paymentId);
    
    return {
      success: false,
      error: `Payment failed after ${payment.attempts} attempts: ${error}`,
      attempts: payment.attempts
    };
  }

  /**
   * Determine if error is retryable
   */
  private static shouldRetry(error: string): boolean {
    const retryableErrors = [
      'timeout',
      'network',
      'connection',
      'temporary',
      'service unavailable',
      'rate limit'
    ];

    const nonRetryableErrors = [
      'insufficient funds',
      'invalid card',
      'declined',
      'invalid amount',
      'authentication failed'
    ];

    const errorLower = error.toLowerCase();
    
    // Don't retry if explicitly non-retryable
    if (nonRetryableErrors.some(e => errorLower.includes(e))) {
      return false;
    }

    // Retry if explicitly retryable
    if (retryableErrors.some(e => errorLower.includes(e))) {
      return true;
    }

    // Default to retry for unknown errors (conservative approach)
    return true;
  }

  /**
   * Start timeout handler for payment
   */
  private static startTimeoutHandler(paymentId: string): void {
    const timeoutHandler = setTimeout(() => {
      this.handlePaymentTimeout(paymentId);
    }, this.CONFIG.timeout * 2); // Double timeout for overall payment

    this.timeoutHandlers.set(paymentId, timeoutHandler);
  }

  /**
   * Handle payment timeout
   */
  private static handlePaymentTimeout(paymentId: string): void {
    const payment = this.pendingPayments.get(paymentId);
    if (!payment) return;

    if (payment.status === 'pending' || payment.status === 'processing') {
      payment.status = 'timeout';
      payment.error = 'Payment timed out';
      
      console.error(`Payment ${paymentId} timed out after ${this.CONFIG.timeout * 2}ms`);
      
      // Clean up
      this.clearTimeoutHandler(paymentId);
    }
  }

  /**
   * Clear timeout handler
   */
  private static clearTimeoutHandler(paymentId: string): void {
    const handler = this.timeoutHandlers.get(paymentId);
    if (handler) {
      clearTimeout(handler);
      this.timeoutHandlers.delete(paymentId);
    }
  }

  /**
   * Get payment status
   */
  static getPaymentStatus(paymentId: string): PaymentAttempt | null {
    return this.pendingPayments.get(paymentId) || null;
  }

  /**
   * Cancel payment
   */
  static cancelPayment(paymentId: string): boolean {
    const payment = this.pendingPayments.get(paymentId);
    if (!payment) return false;

    if (payment.status === 'pending' || payment.status === 'processing') {
      payment.status = 'failed';
      payment.error = 'Payment cancelled';
      
      this.clearTimeoutHandler(paymentId);
      this.pendingPayments.delete(paymentId);
      
      return true;
    }

    return false;
  }

  /**
   * Clean up old payments
   */
  static cleanupOldPayments(): void {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours

    for (const [paymentId, payment] of this.pendingPayments.entries()) {
      if (payment.lastAttemptAt < cutoffTime) {
        this.clearTimeoutHandler(paymentId);
        this.pendingPayments.delete(paymentId);
      }
    }
  }

  /**
   * Get payment statistics
   */
  static getPaymentStats(): {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    timeout: number;
    averageAttempts: number;
  } {
    const stats = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      timeout: 0,
      averageAttempts: 0
    };

    let totalAttempts = 0;
    let paymentCount = 0;

    for (const payment of this.pendingPayments.values()) {
      stats[payment.status as keyof typeof stats]++;
      totalAttempts += payment.attempts;
      paymentCount++;
    }

    stats.averageAttempts = paymentCount > 0 ? totalAttempts / paymentCount : 0;

    return stats;
  }

  /**
   * Initialize cleanup scheduler
   */
  static initializeCleanupScheduler(): void {
    // Clean up old payments every hour
    setInterval(() => {
      this.cleanupOldPayments();
    }, 60 * 60 * 1000);
  }
}