/**
 * COINRAILZ SDK - MAIN ENTERPRISE CLASS
 * $2K-$200K Revenue Driver for AI Companies & Fintech Startups
 */

import { PaymentProcessor } from '../payments/PaymentProcessor';
import { AIAgentRegistry } from '../agents/AIAgentRegistry';
import { ComplianceEngine } from '../compliance/ComplianceEngine';
import { AnalyticsCollector } from '../analytics/AnalyticsCollector';
import { validateLicense } from '../utils';
import { LicenseError, CoinRailzError } from '../errors';
import type { 
  SDKConfiguration, 
  LicenseInfo, 
  PaymentResult, 
  AIAgent, 
  PlatformMetrics 
} from '../types';

export class CoinRailzSDK {
  private config: SDKConfiguration;
  private licenseInfo: LicenseInfo | null = null;
  private isInitialized = false;

  // Core modules
  public payments: PaymentProcessor;
  public agents: AIAgentRegistry;
  public compliance: ComplianceEngine;
  public analytics: AnalyticsCollector;

  constructor(config: SDKConfiguration) {
    this.config = config;
    
    // Initialize core modules
    this.payments = new PaymentProcessor(config);
    this.agents = new AIAgentRegistry(config);
    this.compliance = new ComplianceEngine(config);
    this.analytics = new AnalyticsCollector(config);
  }

  /**
   * Initialize SDK with license validation
   */
  async initialize(): Promise<void> {
    try {
      console.log('🚀 Initializing CoinRailz AI Payments SDK...');
      
      // Validate license key
      this.licenseInfo = await this.validateLicense();
      
      if (!this.licenseInfo.isValid) {
        throw new LicenseError('Invalid or expired license key');
      }

      // Initialize all modules
      await Promise.all([
        this.payments.initialize(),
        this.agents.initialize(),
        this.compliance.initialize(),
        this.analytics.initialize()
      ]);

      this.isInitialized = true;
      
      // Report initialization to platform
      await this.analytics.track('sdk_initialized', {
        licenseKey: this.config.licenseKey,
        tier: this.licenseInfo.tier,
        companyName: this.licenseInfo.companyName
      });

      console.log(`✅ CoinRailz SDK initialized for ${this.licenseInfo.companyName}`);
      console.log(`📊 License Tier: ${this.licenseInfo.tier}`);
      console.log(`💰 Monthly Quota: $${this.licenseInfo.monthlyVolumeLimit.toLocaleString()}`);
      
    } catch (error) {
      console.error('❌ SDK initialization failed:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new CoinRailzError(`SDK initialization failed: ${message}`);
    }
  }

  /**
   * Process payment with comprehensive error handling and compliance
   */
  async processPayment(
    amount: number,
    currency: string = 'USD',
    method: string = 'usdc',
    metadata: Record<string, any> = {}
  ): Promise<PaymentResult> {
    this.ensureInitialized();
    
    try {
      // Compliance checks
      const complianceResult = await this.compliance.validateTransaction({
        amount,
        currency,
        method,
        metadata
      });

      if (!complianceResult.approved) {
        throw new CoinRailzError(`Transaction blocked: ${complianceResult.reason}`);
      }

      // Process payment
      const result = await this.payments.process({
        amount,
        currency,
        method,
        metadata: {
          ...metadata,
          licenseKey: this.config.licenseKey,
          companyName: this.licenseInfo?.companyName
        }
      });

      // Track analytics
      await this.analytics.track('payment_processed', {
        amount,
        currency,
        method,
        success: result.success,
        transactionId: result.transactionId
      });

      return result;
      
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      await this.analytics.track('payment_failed', {
        amount,
        currency,
        method,
        error: message
      });
      throw error;
    }
  }

  /**
   * Register AI agent for marketplace participation
   */
  async registerAgent(agent: Partial<AIAgent>): Promise<AIAgent> {
    this.ensureInitialized();
    
    const registeredAgent = await this.agents.register({
      ...agent,
      owner: {
        ...agent.owner,
        companyName: this.licenseInfo?.companyName || agent.owner?.companyName || 'Unknown',
        contactEmail: agent.owner?.contactEmail || '',
        licenseKey: this.config.licenseKey
      }
    });

    await this.analytics.track('agent_registered', {
      agentId: registeredAgent.id,
      capabilities: registeredAgent.capabilities
    });

    return registeredAgent;
  }

  /**
   * Get real-time platform metrics and analytics
   */
  async getMetrics(): Promise<PlatformMetrics> {
    this.ensureInitialized();
    
    const [paymentMetrics, agentMetrics, complianceMetrics] = await Promise.all([
      this.payments.getMetrics(),
      this.agents.getMetrics(), 
      this.compliance.getMetrics()
    ]);

    return {
      payments: paymentMetrics,
      agents: agentMetrics,
      compliance: complianceMetrics,
      license: {
        tier: this.licenseInfo?.tier || 'Unknown',
        monthlyVolumeUsed: paymentMetrics.monthlyVolume,
        monthlyVolumeLimit: this.licenseInfo?.monthlyVolumeLimit || 0,
        daysUntilRenewal: this.licenseInfo?.daysUntilRenewal || 0,
        usagePercentage: this.licenseInfo?.monthlyVolumeLimit 
          ? (paymentMetrics.monthlyVolume / this.licenseInfo.monthlyVolumeLimit) * 100 
          : 0
      }
    };
  }

  /**
   * Create secure payment session
   */
  async createPaymentSession(options: {
    amount: number;
    currency?: string;
    successUrl: string;
    cancelUrl: string;
    metadata?: Record<string, any>;
  }): Promise<{ sessionId: string; checkoutUrl: string }> {
    this.ensureInitialized();
    
    return await this.payments.createSession({
      ...options,
      licenseKey: this.config.licenseKey
    });
  }

  /**
   * Get license information and usage stats
   */
  getLicenseInfo(): LicenseInfo | null {
    return this.licenseInfo;
  }

  /**
   * Check if SDK is properly initialized
   */
  isReady(): boolean {
    return this.isInitialized && this.licenseInfo?.isValid === true;
  }

  /**
   * Validate license with CoinRailz platform
   */
  private async validateLicense(): Promise<LicenseInfo> {
    const result = await validateLicense(
      this.config.licenseKey,
      this.config.platformUrl || 'https://api.coinrailz.com'
    );
    
    if (!result.success || !result.license) {
      throw new LicenseError(result.error || 'License validation failed');
    }
    
    return result.license;
  }

  /**
   * Ensure SDK is initialized before operations
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new CoinRailzError('SDK not initialized. Call initialize() first.');
    }
  }
}

export default CoinRailzSDK;