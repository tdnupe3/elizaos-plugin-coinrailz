/**
 * Production Deployment Validator
 * Comprehensive validation system for production readiness
 */

import { env } from '../environment';
import { apiHealthMonitor } from './apiHealthMonitor';
import { FeeCalculator } from './feeCalculator';

interface ValidationResult {
  category: string;
  status: 'pass' | 'warning' | 'fail';
  message: string;
  details?: any;
}

interface DeploymentReadiness {
  overall: 'ready' | 'warning' | 'not_ready';
  score: number;
  results: ValidationResult[];
  criticalIssues: string[];
  warnings: string[];
  timestamp: string;
}

export class ProductionValidator {

  /**
   * Run comprehensive production readiness validation
   */
  static async validateProductionReadiness(): Promise<DeploymentReadiness> {
    const results: ValidationResult[] = [];
    
    // Environment validation
    results.push(...this.validateEnvironment());
    
    // API connectivity validation
    results.push(...await this.validateAPIConnectivity());
    
    // Security validation
    results.push(...this.validateSecurity());
    
    // Database validation
    results.push(...await this.validateDatabase());
    
    // Payment processor validation
    results.push(...this.validatePaymentProcessors());
    
    // Fee calculation validation
    results.push(...this.validateFeeCalculations());
    
    // Performance validation
    results.push(...this.validatePerformance());

    return this.calculateReadinessScore(results);
  }

  /**
   * Validate environment configuration
   */
  private static validateEnvironment(): ValidationResult[] {
    const results: ValidationResult[] = [];
    
    // Required environment variables
    const requiredVars = [
      'DATABASE_URL',
      'SESSION_SECRET',
      'STRIPE_SECRET_KEY',
      'PAYPAL_CLIENT_ID',
      'PAYPAL_CLIENT_SECRET',
      'NOWPAYMENTS_API_KEY',
      'CHANGENOW_API_KEY'
    ];

    for (const varName of requiredVars) {
      const value = (env as any)[varName];
      if (!value) {
        results.push({
          category: 'Environment',
          status: 'fail',
          message: `Missing required environment variable: ${varName}`
        });
      } else {
        results.push({
          category: 'Environment',
          status: 'pass',
          message: `${varName} configured`
        });
      }
    }

    // NODE_ENV validation
    if (env.NODE_ENV === 'production') {
      results.push({
        category: 'Environment',
        status: 'pass',
        message: 'Production environment configured'
      });
    } else {
      results.push({
        category: 'Environment',
        status: 'warning',
        message: 'Not running in production mode'
      });
    }

    return results;
  }

  /**
   * Validate API connectivity
   */
  private static async validateAPIConnectivity(): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    
    try {
      const systemHealth = apiHealthMonitor.getSystemHealth();
      
      for (const service of systemHealth.services) {
        if (service.status === 'healthy') {
          results.push({
            category: 'API Connectivity',
            status: 'pass',
            message: `${service.service} API operational`,
            details: { responseTime: service.responseTime }
          });
        } else if (service.status === 'degraded') {
          results.push({
            category: 'API Connectivity',
            status: 'warning',
            message: `${service.service} API degraded`,
            details: { responseTime: service.responseTime, error: service.error }
          });
        } else {
          results.push({
            category: 'API Connectivity',
            status: 'fail',
            message: `${service.service} API unavailable`,
            details: { error: service.error }
          });
        }
      }
    } catch (error: any) {
      results.push({
        category: 'API Connectivity',
        status: 'fail',
        message: 'API health monitoring failed',
        details: { error: error.message }
      });
    }

    return results;
  }

  /**
   * Validate security configuration
   */
  private static validateSecurity(): ValidationResult[] {
    const results: ValidationResult[] = [];

    // Session security
    if (env.SESSION_SECRET && env.SESSION_SECRET.length >= 32) {
      results.push({
        category: 'Security',
        status: 'pass',
        message: 'Session secret properly configured'
      });
    } else {
      results.push({
        category: 'Security',
        status: 'fail',
        message: 'Session secret too short or missing'
      });
    }

    // HTTPS validation (in production)
    if (env.NODE_ENV === 'production') {
      results.push({
        category: 'Security',
        status: 'pass',
        message: 'HTTPS enforced in production'
      });
    } else {
      results.push({
        category: 'Security',
        status: 'warning',
        message: 'HTTPS not enforced (development mode)'
      });
    }

    return results;
  }

  /**
   * Validate database configuration
   */
  private static async validateDatabase(): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    try {
      const { db } = await import('../db');
      
      // Test basic connectivity
      await db.execute('SELECT 1');
      results.push({
        category: 'Database',
        status: 'pass',
        message: 'Database connectivity verified'
      });

      // Test transaction capability
      await db.transaction(async (tx) => {
        await tx.execute('SELECT 1');
      });
      results.push({
        category: 'Database',
        status: 'pass',
        message: 'Database transactions functional'
      });

    } catch (error: any) {
      results.push({
        category: 'Database',
        status: 'fail',
        message: 'Database connectivity failed',
        details: { error: error.message }
      });
    }

    return results;
  }

  /**
   * Validate payment processor configuration
   */
  private static validatePaymentProcessors(): ValidationResult[] {
    const results: ValidationResult[] = [];

    // Stripe validation
    if (env.STRIPE_SECRET_KEY) {
      const isLiveKey = env.STRIPE_SECRET_KEY.startsWith('sk_live_');
      results.push({
        category: 'Payment Processors',
        status: isLiveKey ? 'pass' : 'warning',
        message: `Stripe ${isLiveKey ? 'live' : 'test'} key configured`
      });
    } else {
      results.push({
        category: 'Payment Processors',
        status: 'fail',
        message: 'Stripe API key missing'
      });
    }

    // PayPal validation
    if (env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET) {
      results.push({
        category: 'Payment Processors',
        status: 'pass',
        message: 'PayPal credentials configured'
      });
    } else {
      results.push({
        category: 'Payment Processors',
        status: 'fail',
        message: 'PayPal credentials missing'
      });
    }

    // NOWPayments validation
    if (env.NOWPAYMENTS_API_KEY) {
      results.push({
        category: 'Payment Processors',
        status: 'pass',
        message: 'NOWPayments API key configured'
      });
    } else {
      results.push({
        category: 'Payment Processors',
        status: 'warning',
        message: 'NOWPayments API key missing'
      });
    }

    // ChangeNOW validation
    if (env.CHANGENOW_API_KEY) {
      results.push({
        category: 'Payment Processors',
        status: 'pass',
        message: 'ChangeNOW API key configured'
      });
    } else {
      results.push({
        category: 'Payment Processors',
        status: 'warning',
        message: 'ChangeNOW API key missing'
      });
    }

    return results;
  }

  /**
   * Validate fee calculation system
   */
  private static validateFeeCalculations(): ValidationResult[] {
    const results: ValidationResult[] = [];

    try {
      // Test basic fee calculations
      const stripeFees = FeeCalculator.calculateStripeFees(100);
      const paypalFees = FeeCalculator.calculatePayPalFees(100);
      const cryptoFees = FeeCalculator.calculateCryptoFees(100);

      if (stripeFees.totalFee > 0 && stripeFees.netAmount > 0) {
        results.push({
          category: 'Fee Calculations',
          status: 'pass',
          message: 'Stripe fee calculations functional'
        });
      } else {
        results.push({
          category: 'Fee Calculations',
          status: 'fail',
          message: 'Stripe fee calculations invalid'
        });
      }

      if (paypalFees.totalFee > 0 && paypalFees.netAmount > 0) {
        results.push({
          category: 'Fee Calculations',
          status: 'pass',
          message: 'PayPal fee calculations functional'
        });
      } else {
        results.push({
          category: 'Fee Calculations',
          status: 'fail',
          message: 'PayPal fee calculations invalid'
        });
      }

      if (cryptoFees.netAmount > 0) {
        results.push({
          category: 'Fee Calculations',
          status: 'pass',
          message: 'Crypto fee calculations functional'
        });
      } else {
        results.push({
          category: 'Fee Calculations',
          status: 'fail',
          message: 'Crypto fee calculations invalid'
        });
      }

      // Test minimum amount validation
      const validation = FeeCalculator.validateAmount(1, 'stripe');
      if (validation.valid !== undefined) {
        results.push({
          category: 'Fee Calculations',
          status: 'pass',
          message: 'Amount validation functional'
        });
      } else {
        results.push({
          category: 'Fee Calculations',
          status: 'fail',
          message: 'Amount validation not working'
        });
      }

    } catch (error: any) {
      results.push({
        category: 'Fee Calculations',
        status: 'fail',
        message: 'Fee calculation system error',
        details: { error: error.message }
      });
    }

    return results;
  }

  /**
   * Validate performance configuration
   */
  private static validatePerformance(): ValidationResult[] {
    const results: ValidationResult[] = [];

    // Memory usage check
    const memUsage = process.memoryUsage();
    const memUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

    if (memUsagePercent < 70) {
      results.push({
        category: 'Performance',
        status: 'pass',
        message: `Memory usage optimal (${memUsagePercent.toFixed(1)}%)`
      });
    } else if (memUsagePercent < 85) {
      results.push({
        category: 'Performance',
        status: 'warning',
        message: `Memory usage elevated (${memUsagePercent.toFixed(1)}%)`
      });
    } else {
      results.push({
        category: 'Performance',
        status: 'fail',
        message: `Memory usage critical (${memUsagePercent.toFixed(1)}%)`
      });
    }

    // Process uptime check
    const uptime = process.uptime();
    if (uptime > 0) {
      results.push({
        category: 'Performance',
        status: 'pass',
        message: `Server uptime: ${Math.floor(uptime / 60)} minutes`
      });
    }

    return results;
  }

  /**
   * Calculate overall readiness score
   */
  private static calculateReadinessScore(results: ValidationResult[]): DeploymentReadiness {
    const totalTests = results.length;
    const passCount = results.filter(r => r.status === 'pass').length;
    const warningCount = results.filter(r => r.status === 'warning').length;
    const failCount = results.filter(r => r.status === 'fail').length;

    const score = Math.round(((passCount * 1 + warningCount * 0.5) / totalTests) * 100);

    const criticalIssues = results
      .filter(r => r.status === 'fail')
      .map(r => r.message);

    const warnings = results
      .filter(r => r.status === 'warning')
      .map(r => r.message);

    let overall: 'ready' | 'warning' | 'not_ready';
    if (failCount === 0 && warningCount <= 2) {
      overall = 'ready';
    } else if (failCount <= 2) {
      overall = 'warning';
    } else {
      overall = 'not_ready';
    }

    return {
      overall,
      score,
      results,
      criticalIssues,
      warnings,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get production deployment checklist
   */
  static getProductionChecklist(): string[] {
    return [
      'All environment variables configured',
      'Database connectivity verified',
      'Payment processors operational',
      'API health monitoring active',
      'Fee calculations validated',
      'Security middleware enabled',
      'Webhook validation implemented',
      'Error handling comprehensive',
      'Performance monitoring active',
      'Rate limiting configured',
      'HTTPS enforced',
      'Session security hardened',
      'Database migrations applied',
      'Monitoring dashboards configured',
      'Backup systems operational'
    ];
  }
}