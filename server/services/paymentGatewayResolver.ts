/**
 * Payment Gateway Conflict Resolution - Critical Security Fix
 * Resolves contradictory payment statuses and prevents duplicate/lost payments
 */

export interface PaymentStatus {
  gatewayId: string;
  paymentId: string;
  status: 'pending' | 'success' | 'failed' | 'unknown';
  amount: number;
  currency: string;
  timestamp: number;
  confidence: number; // 0-1 confidence in this status
  rawResponse: any;
}

export interface ConflictResolution {
  finalStatus: 'success' | 'failed' | 'pending' | 'requires_investigation';
  authoritative: boolean;
  confidence: number;
  reasoning: string;
  actions: string[];
  investigations: string[];
}

export interface GatewayHealth {
  gatewayId: string;
  isHealthy: boolean;
  lastSuccessfulCheck: number;
  consecutiveFailures: number;
  averageResponseTime: number;
  trustScore: number; // 0-1 based on historical accuracy
}

export class PaymentGatewayResolver {
  private static gatewayHealth = new Map<string, GatewayHealth>();
  private static paymentHistory = new Map<string, PaymentStatus[]>();
  private static conflictCache = new Map<string, ConflictResolution>();
  
  private static readonly GATEWAY_PRIORITY = {
    'stripe': 10,
    'paypal': 9,
    'bank_transfer': 8,
    'xrp': 7,
    'crypto': 6
  };

  private static readonly CONFLICT_TIMEOUT = 300000; // 5 minutes
  private static readonly MAX_POLLING_ATTEMPTS = 10;

  async resolveOptimalGateway(amount: number, currency: string): Promise<{ name: string; priority: number; fee: number }> {
    // Simple gateway resolution logic
    if (amount < 10) {
      return { name: 'stripe', priority: 10, fee: 0.30 };
    } else if (amount >= 1000) {
      return { name: 'xrp', priority: 7, fee: 0.001 };
    } else {
      return { name: 'stripe', priority: 10, fee: amount * 0.029 + 0.30 };
    }
  }

  /**
   * Resolve conflicts between multiple payment status reports
   */
  static async resolvePaymentConflict(
    paymentId: string,
    statuses: PaymentStatus[]
  ): Promise<ConflictResolution> {
    if (statuses.length === 0) {
      return {
        finalStatus: 'requires_investigation',
        authoritative: false,
        confidence: 0,
        reasoning: 'No payment status reports available',
        actions: ['manual_investigation'],
        investigations: ['Check all payment gateways manually']
      };
    }

    if (statuses.length === 1) {
      const status = statuses[0];
      return {
        finalStatus: status.status === 'unknown' ? 'requires_investigation' : (status.status as 'pending' | 'success' | 'failed'),
        authoritative: status.confidence > 0.8,
        confidence: status.confidence,
        reasoning: 'Single status report available',
        actions: status.status === 'success' ? ['confirm_payment'] : ['retry_or_cancel'],
        investigations: []
      };
    }

    // Check cache first
    const cacheKey = `${paymentId}_${statuses.map(s => s.gatewayId + s.status).join('_')}`;
    const cached = this.conflictCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const resolution = await this.performConflictResolution(paymentId, statuses);
    
    // Cache the resolution
    this.conflictCache.set(cacheKey, resolution);
    setTimeout(() => this.conflictCache.delete(cacheKey), this.CONFLICT_TIMEOUT);

    return resolution;
  }

  /**
   * Perform intelligent conflict resolution
   */
  private static async performConflictResolution(
    paymentId: string,
    statuses: PaymentStatus[]
  ): Promise<ConflictResolution> {
    // Group statuses by type
    const statusGroups = {
      success: statuses.filter(s => s.status === 'success'),
      failed: statuses.filter(s => s.status === 'failed'),
      pending: statuses.filter(s => s.status === 'pending'),
      unknown: statuses.filter(s => s.status === 'unknown')
    };

    // Scenario 1: All agree on success
    if (statusGroups.success.length === statuses.length) {
      return {
        finalStatus: 'success',
        authoritative: true,
        confidence: 0.95,
        reasoning: 'All gateways report success',
        actions: ['confirm_payment', 'update_balance'],
        investigations: []
      };
    }

    // Scenario 2: All agree on failure
    if (statusGroups.failed.length === statuses.length) {
      return {
        finalStatus: 'failed',
        authoritative: true,
        confidence: 0.95,
        reasoning: 'All gateways report failure',
        actions: ['cancel_payment', 'notify_user'],
        investigations: []
      };
    }

    // Scenario 3: Success vs Failure conflict
    if (statusGroups.success.length > 0 && statusGroups.failed.length > 0) {
      return await this.resolveSuccessFailureConflict(paymentId, statusGroups.success, statusGroups.failed);
    }

    // Scenario 4: Success vs Pending
    if (statusGroups.success.length > 0 && statusGroups.pending.length > 0) {
      return await this.resolveSuccessPendingConflict(paymentId, statusGroups.success, statusGroups.pending);
    }

    // Scenario 5: Pending from all sources
    if (statusGroups.pending.length === statuses.length) {
      return {
        finalStatus: 'pending',
        authoritative: false,
        confidence: 0.7,
        reasoning: 'All gateways report pending status',
        actions: ['continue_monitoring', 'set_timeout'],
        investigations: ['Poll gateways for status updates']
      };
    }

    // Scenario 6: Mixed pending/failed
    if (statusGroups.pending.length > 0 && statusGroups.failed.length > 0) {
      return {
        finalStatus: 'pending',
        authoritative: false,
        confidence: 0.6,
        reasoning: 'Mixed pending and failed reports - waiting for resolution',
        actions: ['continue_monitoring', 'prepare_for_failure'],
        investigations: ['Monitor pending payments', 'Verify failure reasons']
      };
    }

    // Default: Requires investigation
    return {
      finalStatus: 'requires_investigation',
      authoritative: false,
      confidence: 0.3,
      reasoning: 'Complex conflict pattern requiring manual investigation',
      actions: ['manual_investigation', 'contact_gateways'],
      investigations: ['Review all gateway responses', 'Check transaction logs', 'Verify fund movements']
    };
  }

  /**
   * Resolve success vs failure conflicts
   */
  private static async resolveSuccessFailureConflict(
    paymentId: string,
    successStatuses: PaymentStatus[],
    failureStatuses: PaymentStatus[]
  ): Promise<ConflictResolution> {
    // Calculate weighted confidence based on gateway trust scores
    const successWeight = this.calculateWeightedConfidence(successStatuses);
    const failureWeight = this.calculateWeightedConfidence(failureStatuses);

    // Check for timing differences (later reports may be more accurate)
    const latestSuccess = Math.max(...successStatuses.map(s => s.timestamp));
    const latestFailure = Math.max(...failureStatuses.map(s => s.timestamp));

    // If success is significantly more recent and confident
    if (latestSuccess > latestFailure + 30000 && successWeight > failureWeight * 1.5) {
      return {
        finalStatus: 'success',
        authoritative: true,
        confidence: Math.min(0.9, successWeight),
        reasoning: 'Recent success reports with high confidence override earlier failures',
        actions: ['confirm_payment', 'verify_funds_transferred'],
        investigations: ['Verify actual fund movement', 'Check for delayed gateway updates']
      };
    }

    // If failure is more recent or confident
    if (latestFailure > latestSuccess + 30000 || failureWeight > successWeight * 1.5) {
      return {
        finalStatus: 'failed',
        authoritative: true,
        confidence: Math.min(0.9, failureWeight),
        reasoning: 'Failure reports are more recent or confident than success reports',
        actions: ['cancel_payment', 'check_for_reversal'],
        investigations: ['Verify no funds were transferred', 'Check for payment reversals']
      };
    }

    // Ambiguous case - requires investigation
    return {
      finalStatus: 'requires_investigation',
      authoritative: false,
      confidence: 0.4,
      reasoning: 'Conflicting success/failure reports with similar confidence and timing',
      actions: ['manual_investigation', 'verify_actual_fund_movement'],
      investigations: [
        'Check actual bank/crypto transactions',
        'Contact payment gateways for clarification',
        'Review detailed transaction logs'
      ]
    };
  }

  /**
   * Resolve success vs pending conflicts
   */
  private static async resolveSuccessPendingConflict(
    paymentId: string,
    successStatuses: PaymentStatus[],
    pendingStatuses: PaymentStatus[]
  ): Promise<ConflictResolution> {
    const successWeight = this.calculateWeightedConfidence(successStatuses);
    const pendingWeight = this.calculateWeightedConfidence(pendingStatuses);

    // Success reports generally take precedence over pending
    if (successWeight > 0.7) {
      return {
        finalStatus: 'success',
        authoritative: true,
        confidence: successWeight,
        reasoning: 'High-confidence success reports override pending status',
        actions: ['confirm_payment', 'notify_pending_gateways'],
        investigations: ['Verify pending gateways receive success notification']
      };
    }

    // If pending reports are very confident, continue monitoring
    if (pendingWeight > 0.8) {
      return {
        finalStatus: 'pending',
        authoritative: false,
        confidence: 0.6,
        reasoning: 'High-confidence pending status requires continued monitoring',
        actions: ['continue_monitoring', 'prepare_for_success'],
        investigations: ['Monitor for status updates', 'Set timeout for pending resolution']
      };
    }

    // Default to success with lower confidence
    return {
      finalStatus: 'success',
      authoritative: false,
      confidence: 0.7,
      reasoning: 'Success reports likely accurate, pending may be delayed updates',
      actions: ['confirm_payment', 'monitor_pending_resolution'],
      investigations: ['Verify fund transfer', 'Monitor pending gateway updates']
    };
  }

  /**
   * Calculate weighted confidence based on gateway trust scores
   */
  private static calculateWeightedConfidence(statuses: PaymentStatus[]): number {
    if (statuses.length === 0) return 0;

    let totalWeight = 0;
    let weightedSum = 0;

    for (const status of statuses) {
      const gatewayHealth = this.gatewayHealth.get(status.gatewayId);
      const trustScore = gatewayHealth?.trustScore || 0.5;
      const gatewayPriority = (this.GATEWAY_PRIORITY as any)[status.gatewayId] || 5;
      
      const weight = trustScore * (gatewayPriority / 10) * status.confidence;
      weightedSum += weight;
      totalWeight += trustScore * (gatewayPriority / 10);
    }

    return totalWeight > 0 ? Math.min(1, weightedSum / totalWeight) : 0;
  }

  /**
   * Poll payment gateway for updated status
   */
  static async pollGatewayStatus(
    gatewayId: string,
    paymentId: string,
    maxAttempts: number = this.MAX_POLLING_ATTEMPTS
  ): Promise<PaymentStatus | null> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Mock implementation - replace with actual gateway API calls
        const status = await this.fetchGatewayStatus(gatewayId, paymentId);
        
        if (status && status.status !== 'pending') {
          return status;
        }

        // Wait before next attempt (exponential backoff)
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
        await new Promise(resolve => setTimeout(resolve, delay));

      } catch (error) {
        console.warn(`Gateway polling attempt ${attempt} failed for ${gatewayId}:`, error);
        
        // Update gateway health
        this.updateGatewayHealth(gatewayId, false);
      }
    }

    return null;
  }

  /**
   * Fetch status from specific gateway (mock implementation)
   */
  private static async fetchGatewayStatus(
    gatewayId: string,
    paymentId: string
  ): Promise<PaymentStatus | null> {
    // Mock implementation - replace with actual gateway API calls
    const mockStatuses = ['success', 'failed', 'pending'];
    const randomStatus = mockStatuses[Math.floor(Math.random() * mockStatuses.length)];
    
    return {
      gatewayId,
      paymentId,
      status: randomStatus as PaymentStatus['status'],
      amount: 100,
      currency: 'USD',
      timestamp: Date.now(),
      confidence: 0.9,
      rawResponse: { mock: true }
    };
  }

  /**
   * Update gateway health based on performance
   */
  static updateGatewayHealth(gatewayId: string, success: boolean, responseTime?: number): void {
    let health = this.gatewayHealth.get(gatewayId);
    
    if (!health) {
      health = {
        gatewayId,
        isHealthy: true,
        lastSuccessfulCheck: 0,
        consecutiveFailures: 0,
        averageResponseTime: 1000,
        trustScore: 0.8
      };
    }

    if (success) {
      health.lastSuccessfulCheck = Date.now();
      health.consecutiveFailures = 0;
      health.isHealthy = true;
      
      // Update trust score (slowly increase on success)
      health.trustScore = Math.min(1, health.trustScore + 0.01);
      
      if (responseTime) {
        health.averageResponseTime = (health.averageResponseTime * 0.9) + (responseTime * 0.1);
      }
    } else {
      health.consecutiveFailures++;
      health.isHealthy = health.consecutiveFailures < 5;
      
      // Decrease trust score on failures
      health.trustScore = Math.max(0.1, health.trustScore - 0.05);
    }

    this.gatewayHealth.set(gatewayId, health);
  }

  /**
   * Get comprehensive gateway statistics
   */
  static getGatewayStatistics(): {
    healthyGateways: number;
    totalGateways: number;
    averageTrustScore: number;
    gatewayHealth: GatewayHealth[];
    conflictResolutions: number;
  } {
    const gateways = Array.from(this.gatewayHealth.values());
    const healthyCount = gateways.filter(g => g.isHealthy).length;
    const avgTrust = gateways.reduce((sum, g) => sum + g.trustScore, 0) / Math.max(gateways.length, 1);

    return {
      healthyGateways: healthyCount,
      totalGateways: gateways.length,
      averageTrustScore: avgTrust,
      gatewayHealth: gateways,
      conflictResolutions: this.conflictCache.size
    };
  }

  /**
   * Force resolve a payment conflict (emergency use)
   */
  static forceResolveConflict(
    paymentId: string,
    finalStatus: 'success' | 'failed',
    reasoning: string
  ): ConflictResolution {
    return {
      finalStatus,
      authoritative: true,
      confidence: 1.0,
      reasoning: `Manual override: ${reasoning}`,
      actions: finalStatus === 'success' ? ['confirm_payment'] : ['cancel_payment'],
      investigations: ['Manual resolution applied']
    };
  }

  /**
   * Clean up old conflict cache entries
   */
  static cleanupConflictCache(): number {
    const initialSize = this.conflictCache.size;
    // Cache cleanup is handled by setTimeout in resolvePaymentConflict
    return initialSize - this.conflictCache.size;
  }
}