
/**
 * Feature Quarantine System
 * Isolates failing features to prevent cascade failures
 */

interface FeatureHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'quarantined';
  errorCount: number;
  lastError?: string;
  lastErrorTime?: number;
  quarantineUntil?: number;
}

interface QuarantineConfig {
  errorThreshold: number;
  timeWindow: number; // minutes
  quarantineDuration: number; // minutes
  criticalFeatures: string[]; // Features that should never be quarantined
}

class FeatureQuarantineService {
  private featureHealth: Map<string, FeatureHealth> = new Map();
  private config: QuarantineConfig = {
    errorThreshold: 5,
    timeWindow: 10, // 10 minutes
    quarantineDuration: 30, // 30 minutes
    criticalFeatures: ['authentication', 'compliance', 'core-transaction']
  };

  /**
   * Register a feature for monitoring
   */
  registerFeature(featureName: string): void {
    if (!this.featureHealth.has(featureName)) {
      this.featureHealth.set(featureName, {
        name: featureName,
        status: 'healthy',
        errorCount: 0
      });
    }
  }

  /**
   * Check if a feature is available (not quarantined)
   */
  isFeatureAvailable(featureName: string): boolean {
    const feature = this.featureHealth.get(featureName);
    if (!feature) return true; // Unknown features are assumed available

    // Check if quarantine period has expired
    if (feature.status === 'quarantined' && feature.quarantineUntil) {
      if (Date.now() > feature.quarantineUntil) {
        this.releaseFromQuarantine(featureName);
        return true;
      }
      return false;
    }

    return feature.status !== 'quarantined';
  }

  /**
   * Record an error for a feature
   */
  recordError(featureName: string, error: string): void {
    this.registerFeature(featureName);
    const feature = this.featureHealth.get(featureName)!;

    // Don't quarantine critical features
    if (this.config.criticalFeatures.includes(featureName)) {
      feature.lastError = error;
      feature.lastErrorTime = Date.now();
      console.warn(`Critical feature ${featureName} error (not quarantined): ${error}`);
      return;
    }

    // Reset error count if time window has passed
    const timeWindow = this.config.timeWindow * 60 * 1000;
    if (feature.lastErrorTime && (Date.now() - feature.lastErrorTime) > timeWindow) {
      feature.errorCount = 0;
    }

    feature.errorCount++;
    feature.lastError = error;
    feature.lastErrorTime = Date.now();

    // Check if feature should be quarantined
    if (feature.errorCount >= this.config.errorThreshold) {
      this.quarantineFeature(featureName);
    } else if (feature.errorCount >= Math.floor(this.config.errorThreshold / 2)) {
      feature.status = 'degraded';
    }
  }

  /**
   * Quarantine a feature
   */
  private quarantineFeature(featureName: string): void {
    const feature = this.featureHealth.get(featureName)!;
    feature.status = 'quarantined';
    feature.quarantineUntil = Date.now() + (this.config.quarantineDuration * 60 * 1000);

    console.error(`FEATURE QUARANTINED: ${featureName} - Too many errors (${feature.errorCount})`);
    
    // Send alert notification
    this.sendQuarantineAlert(featureName, feature);
  }

  /**
   * Release a feature from quarantine
   */
  private releaseFromQuarantine(featureName: string): void {
    const feature = this.featureHealth.get(featureName)!;
    feature.status = 'healthy';
    feature.errorCount = 0;
    feature.quarantineUntil = undefined;

    console.info(`Feature ${featureName} released from quarantine`);
  }

  /**
   * Get health status of all features
   */
  getHealthStatus(): FeatureHealth[] {
    return Array.from(this.featureHealth.values());
  }

  /**
   * Middleware to check feature availability
   */
  featureGuard(featureName: string) {
    return (req: any, res: any, next: any) => {
      if (!this.isFeatureAvailable(featureName)) {
        return res.status(503).json({
          success: false,
          message: `Feature ${featureName} is temporarily unavailable`,
          code: 'FEATURE_QUARANTINED',
          estimatedRecovery: this.featureHealth.get(featureName)?.quarantineUntil
        });
      }
      next();
    };
  }

  /**
   * Wrapper for service operations with automatic error tracking
   */
  async executeWithQuarantine<T>(
    featureName: string,
    operation: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    if (!this.isFeatureAvailable(featureName)) {
      if (fallback) {
        console.warn(`Using fallback for quarantined feature: ${featureName}`);
        return await fallback();
      }
      throw new Error(`Feature ${featureName} is quarantined`);
    }

    try {
      const result = await operation();
      this.recordSuccess(featureName);
      return result;
    } catch (error: any) {
      this.recordError(featureName, error.message);
      throw error;
    }
  }

  /**
   * Record successful operation
   */
  private recordSuccess(featureName: string): void {
    const feature = this.featureHealth.get(featureName);
    if (feature && feature.status === 'degraded') {
      feature.errorCount = Math.max(0, feature.errorCount - 1);
      if (feature.errorCount === 0) {
        feature.status = 'healthy';
      }
    }
  }

  /**
   * Send quarantine alert
   */
  private sendQuarantineAlert(featureName: string, feature: FeatureHealth): void {
    // TODO: Integrate with your notification service
    console.error(`QUARANTINE ALERT: ${featureName}`, {
      errorCount: feature.errorCount,
      lastError: feature.lastError,
      quarantineUntil: new Date(feature.quarantineUntil!)
    });
  }
}

export const featureQuarantine = new FeatureQuarantineService();

// Register all platform features
featureQuarantine.registerFeature('ai-agents');
featureQuarantine.registerFeature('paypal-payments');
featureQuarantine.registerFeature('crypto-swaps');
featureQuarantine.registerFeature('p2p-transfers');
featureQuarantine.registerFeature('referral-system');
featureQuarantine.registerFeature('notifications');
featureQuarantine.registerFeature('authentication');
featureQuarantine.registerFeature('compliance');
featureQuarantine.registerFeature('core-transaction');
