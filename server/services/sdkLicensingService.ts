import { db } from "../db";
import { sdkLicenseTiers, sdkLicenseSubscriptions, type SDKLicenseTier, type SDKLicenseSubscription } from "@shared/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import Stripe, { stripe } from './stripeClient';
import crypto from "crypto";
import { nanoid } from "nanoid";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}


export interface SDKLicenseTierConfig {
  name: string;
  description: string;
  yearlyPrice: number;
  monthlyPrice: number;
  setupFee?: number;
  transactionFeeRate: number; // e.g., 0.0099 for 0.99%
  fixedFeePerTransaction: number; // e.g., 0.05
  monthlyTransactionLimit?: number | null; // null = unlimited
  monthlyVolumeLimit?: number | null; // null = unlimited
  supportLevel: 'email' | 'priority' | 'dedicated' | 'white_glove';
  slaGuarantee?: string; // e.g., '99.9%'
  customIntegrations?: boolean;
  whiteLabeling?: boolean;
  dedicatedInfrastructure?: boolean;
  apiRequestsPerSecond?: number;
  webhookEndpoints?: number;
  teamMembers?: number;
  features: string[];
  targetMarket: 'startup' | 'growth' | 'enterprise_ai' | 'fortune_500';
}

export const SDK_LICENSE_TIERS: SDKLicenseTierConfig[] = [
  {
    name: 'Startup',
    description: 'Perfect for AI startups and early-stage companies testing payment infrastructure',
    yearlyPrice: 2000, // $2K/year
    monthlyPrice: 200, // $200/month (17% more than yearly)
    setupFee: 0,
    transactionFeeRate: 0.0175, // 1.75%
    fixedFeePerTransaction: 0.10,
    monthlyTransactionLimit: 5000,
    monthlyVolumeLimit: 500000, // $500K/month
    supportLevel: 'email',
    slaGuarantee: '99.5%',
    customIntegrations: false,
    whiteLabeling: false,
    dedicatedInfrastructure: false,
    apiRequestsPerSecond: 50,
    webhookEndpoints: 10,
    teamMembers: 3,
    features: [
      'Circle USDC integration',
      'TypeScript SDK',
      'Email support (48h response)',
      'Standard webhooks',
      'Basic documentation',
      'Community forum access',
      '5,000 transactions/month',
      '$500K volume limit',
      'Multi-chain support',
      '99.5% uptime SLA'
    ],
    targetMarket: 'startup'
  },
  {
    name: 'Growth',
    description: 'For scaling AI companies requiring higher limits and priority support',
    yearlyPrice: 8000, // $8K/year
    monthlyPrice: 800, // $800/month (20% more than yearly)
    setupFee: 500,
    transactionFeeRate: 0.0150, // 1.50%
    fixedFeePerTransaction: 0.08,
    monthlyTransactionLimit: 25000,
    monthlyVolumeLimit: 2500000, // $2.5M/month
    supportLevel: 'priority',
    slaGuarantee: '99.9%',
    customIntegrations: true,
    whiteLabeling: false,
    dedicatedInfrastructure: false,
    apiRequestsPerSecond: 100,
    webhookEndpoints: 25,
    teamMembers: 10,
    features: [
      'Everything in Startup',
      'Priority support (12h response)',
      'Custom integrations included',
      'Advanced webhooks & callbacks',
      'Detailed analytics dashboard',
      '25,000 transactions/month',
      '$2.5M volume limit',
      'Dedicated Slack channel',
      'Quarterly business reviews',
      '99.9% uptime SLA'
    ],
    targetMarket: 'growth'
  },
  {
    name: 'Enterprise AI',
    description: 'Comprehensive solution for enterprise AI companies with high-volume requirements',
    yearlyPrice: 25000, // $25K/year
    monthlyPrice: 2500, // $2.5K/month (20% more than yearly)
    setupFee: 2000,
    transactionFeeRate: 0.0125, // 1.25%
    fixedFeePerTransaction: 0.05,
    monthlyTransactionLimit: 100000,
    monthlyVolumeLimit: 10000000, // $10M/month
    supportLevel: 'dedicated',
    slaGuarantee: '99.95%',
    customIntegrations: true,
    whiteLabeling: true,
    dedicatedInfrastructure: false,
    apiRequestsPerSecond: 500,
    webhookEndpoints: 100,
    teamMembers: 50,
    features: [
      'Everything in Growth',
      'Dedicated account manager',
      'White-label SDK options',
      'Custom fee structures',
      'Advanced security features',
      'Compliance certifications',
      '100,000 transactions/month',
      '$10M volume limit',
      'Phone support available',
      'Monthly business reviews',
      'Custom contract terms',
      '99.95% uptime SLA'
    ],
    targetMarket: 'enterprise_ai'
  },
  {
    name: 'Fortune 500',
    description: 'Premium infrastructure for Fortune 500 companies requiring maximum scale and customization',
    yearlyPrice: 100000, // $100K/year
    monthlyPrice: 10000, // $10K/month (20% more than yearly)
    setupFee: 10000,
    transactionFeeRate: 0.0099, // 0.99% (best rate)
    fixedFeePerTransaction: 0.05,
    monthlyTransactionLimit: null, // unlimited
    monthlyVolumeLimit: null, // unlimited
    supportLevel: 'white_glove',
    slaGuarantee: '99.99%',
    customIntegrations: true,
    whiteLabeling: true,
    dedicatedInfrastructure: true,
    apiRequestsPerSecond: 2000,
    webhookEndpoints: 500,
    teamMembers: 200,
    features: [
      'Everything in Enterprise AI',
      'Dedicated infrastructure',
      'White-glove onboarding',
      'Custom SLA agreements',
      'Regulatory compliance support',
      'Multi-region deployment',
      'Unlimited transactions',
      'Unlimited volume',
      '24/7 phone support',
      'Weekly business reviews',
      'C-level executive access',
      'Custom contract negotiation',
      '99.99% uptime guarantee'
    ],
    targetMarket: 'fortune_500'
  },
  {
    name: 'Custom Enterprise',
    description: 'Fully customized solution for unique enterprise requirements',
    yearlyPrice: 200000, // $200K/year starting point
    monthlyPrice: 20000, // $20K/month (20% more than yearly)
    setupFee: 25000,
    transactionFeeRate: 0.0075, // 0.75% (negotiable)
    fixedFeePerTransaction: 0.03,
    monthlyTransactionLimit: null, // unlimited
    monthlyVolumeLimit: null, // unlimited
    supportLevel: 'white_glove',
    slaGuarantee: '99.99%',
    customIntegrations: true,
    whiteLabeling: true,
    dedicatedInfrastructure: true,
    apiRequestsPerSecond: 5000,
    webhookEndpoints: 1000,
    teamMembers: 500,
    features: [
      'Fully customized solution',
      'Dedicated engineering team',
      'Custom features development',
      'Private cloud deployment',
      'Regulatory compliance team',
      'Global infrastructure',
      'Unlimited everything',
      'Custom pricing models',
      'Immediate support response',
      'Daily status calls',
      'Direct CEO access',
      'Negotiated contract terms',
      'Custom uptime guarantees'
    ],
    targetMarket: 'fortune_500'
  }
];

export class SDKLicensingService {
  /**
   * Get all available SDK license tiers
   */
  async getSDKLicenseTiers(): Promise<SDKLicenseTier[]> {
    return await db.select().from(sdkLicenseTiers).where(eq(sdkLicenseTiers.isActive, true));
  }

  /**
   * Get SDK license tier by ID
   */
  async getSDKLicenseTier(tierId: number): Promise<SDKLicenseTier | undefined> {
    const [tier] = await db.select().from(sdkLicenseTiers).where(eq(sdkLicenseTiers.id, tierId)).limit(1);
    return tier;
  }

  /**
   * Create new SDK license tier
   */
  async createSDKLicenseTier(tierConfig: SDKLicenseTierConfig): Promise<SDKLicenseTier> {
    const [tier] = await db.insert(sdkLicenseTiers).values({
      name: tierConfig.name,
      description: tierConfig.description,
      yearlyPrice: tierConfig.yearlyPrice.toString(),
      monthlyPrice: tierConfig.monthlyPrice.toString(),
      setupFee: (tierConfig.setupFee || 0).toString(),
      transactionFeeRate: tierConfig.transactionFeeRate.toString(),
      fixedFeePerTransaction: tierConfig.fixedFeePerTransaction.toString(),
      monthlyTransactionLimit: tierConfig.monthlyTransactionLimit ?? undefined,
      monthlyVolumeLimit: tierConfig.monthlyVolumeLimit?.toString() ?? undefined,
      supportLevel: tierConfig.supportLevel,
      slaGuarantee: tierConfig.slaGuarantee,
      customIntegrations: tierConfig.customIntegrations || false,
      whiteLabeling: tierConfig.whiteLabeling || false,
      dedicatedInfrastructure: tierConfig.dedicatedInfrastructure || false,
      apiRequestsPerSecond: tierConfig.apiRequestsPerSecond || 10,
      webhookEndpoints: tierConfig.webhookEndpoints || 5,
      teamMembers: tierConfig.teamMembers || 1,
      features: tierConfig.features,
      targetMarket: tierConfig.targetMarket
    }).returning();
    
    return tier;
  }

  /**
   * Generate secure license key
   */
  generateLicenseKey(): string {
    // Format: SDK-XXXX-XXXX-XXXX-XXXX where X is alphanumeric
    const segments = [];
    for (let i = 0; i < 4; i++) {
      segments.push(nanoid(4).toUpperCase());
    }
    return `SDK-${segments.join('-')}`;
  }

  /**
   * Hash license key for secure storage
   */
  hashLicenseKey(licenseKey: string): string {
    return crypto.createHash('sha256').update(licenseKey).digest('hex');
  }

  /**
   * Create new SDK license subscription
   */
  async createSDKLicenseSubscription(params: {
    tierId: number;
    companyName: string;
    contactEmail: string;
    contactName: string;
    phoneNumber?: string;
    companySize?: string;
    useCase?: string;
    billingCycle: 'monthly' | 'yearly';
    paymentMethod: 'stripe' | 'crypto' | 'wire_transfer' | 'check';
    allowedDomains?: string[];
    webhookUrls?: string[];
    signupSource?: string;
  }): Promise<{ subscription: SDKLicenseSubscription; licenseKey: string }> {
    const tier = await this.getSDKLicenseTier(params.tierId);
    if (!tier) {
      throw new Error('Invalid tier ID');
    }

    // Generate license key
    const licenseKey = this.generateLicenseKey();
    const licenseKeyHash = this.hashLicenseKey(licenseKey);

    // Calculate end date
    const startDate = new Date();
    const endDate = new Date();
    const nextBillingDate = new Date();
    
    if (params.billingCycle === 'yearly') {
      endDate.setFullYear(endDate.getFullYear() + 1);
      nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
    }

    const [subscription] = await db.insert(sdkLicenseSubscriptions).values({
      licenseKey,
      licenseKeyHash,
      companyName: params.companyName,
      contactEmail: params.contactEmail,
      contactName: params.contactName,
      phoneNumber: params.phoneNumber,
      companySize: params.companySize,
      useCase: params.useCase,
      tierId: params.tierId,
      billingCycle: params.billingCycle,
      startDate,
      endDate,
      nextBillingDate,
      paymentMethod: params.paymentMethod,
      allowedDomains: params.allowedDomains,
      webhookUrls: params.webhookUrls,
      signupSource: params.signupSource || 'website'
    }).returning();

    return { subscription, licenseKey };
  }

  /**
   * Get SDK license subscription by license key
   */
  async getSDKLicenseByKey(licenseKey: string): Promise<SDKLicenseSubscription | undefined> {
    const licenseKeyHash = this.hashLicenseKey(licenseKey);
    const [subscription] = await db
      .select()
      .from(sdkLicenseSubscriptions)
      .where(eq(sdkLicenseSubscriptions.licenseKeyHash, licenseKeyHash))
      .limit(1);
    
    return subscription;
  }

  /**
   * Validate license key and check limits
   */
  async validateLicenseKey(licenseKey: string): Promise<{
    valid: boolean;
    subscription?: SDKLicenseSubscription;
    tier?: SDKLicenseTier;
    reason?: string;
  }> {
    const subscription = await this.getSDKLicenseByKey(licenseKey);
    
    if (!subscription) {
      return { valid: false, reason: 'Invalid license key' };
    }

    if (subscription.status !== 'active') {
      return { valid: false, reason: `License status: ${subscription.status}` };
    }

    const now = new Date();
    const endDate = new Date(subscription.endDate);
    if (now > endDate) {
      return { valid: false, reason: 'License expired' };
    }

    const tier = await this.getSDKLicenseTier(subscription.tierId);
    if (!tier) {
      return { valid: false, reason: 'Invalid tier configuration' };
    }

    // Check monthly limits
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const lastReset = new Date(subscription.lastUsageReset || new Date());
    
    // Reset counters if it's a new month
    if (lastReset.getMonth() !== currentMonth || lastReset.getFullYear() !== currentYear) {
      await this.resetMonthlyUsage(subscription.id);
      subscription.currentMonthTransactions = 0;
      subscription.currentMonthVolume = '0.00';
    }

    // Check transaction limit
    if (tier.monthlyTransactionLimit && (subscription.currentMonthTransactions || 0) >= tier.monthlyTransactionLimit) {
      return { 
        valid: false, 
        reason: `Monthly transaction limit exceeded (${subscription.currentMonthTransactions || 0}/${tier.monthlyTransactionLimit})` 
      };
    }

    // Check volume limit
    if (tier.monthlyVolumeLimit) {
      const currentVolume = parseFloat(subscription.currentMonthVolume || '0');
      const volumeLimit = parseFloat(tier.monthlyVolumeLimit);
      if (currentVolume >= volumeLimit) {
        return { 
          valid: false, 
          reason: `Monthly volume limit exceeded ($${currentVolume.toLocaleString()}/$${volumeLimit.toLocaleString()})` 
        };
      }
    }

    return { valid: true, subscription, tier };
  }

  /**
   * Reset monthly usage counters
   */
  async resetMonthlyUsage(subscriptionId: number): Promise<void> {
    await db
      .update(sdkLicenseSubscriptions)
      .set({
        currentMonthTransactions: 0,
        currentMonthVolume: '0.00',
        lastUsageReset: new Date()
      })
      .where(eq(sdkLicenseSubscriptions.id, subscriptionId));
  }

  /**
   * Increment usage counters
   */
  async incrementUsage(subscriptionId: number, transactionAmount: number): Promise<void> {
    const [subscription] = await db
      .select()
      .from(sdkLicenseSubscriptions)
      .where(eq(sdkLicenseSubscriptions.id, subscriptionId))
      .limit(1);

    if (!subscription) return;

    const currentVolume = parseFloat(subscription.currentMonthVolume || '0');
    const newVolume = currentVolume + transactionAmount;
    const totalVolume = parseFloat(subscription.totalLifetimeVolume || '0') + transactionAmount;
    const totalRevenue = parseFloat(subscription.totalLifetimeRevenue || '0') + transactionAmount;

    await db
      .update(sdkLicenseSubscriptions)
      .set({
        currentMonthTransactions: (subscription.currentMonthTransactions || 0) + 1,
        currentMonthVolume: newVolume.toString(),
        totalLifetimeTransactions: (subscription.totalLifetimeTransactions || 0) + 1,
        totalLifetimeVolume: totalVolume.toString(),
        totalLifetimeRevenue: totalRevenue.toString()
      })
      .where(eq(sdkLicenseSubscriptions.id, subscriptionId));
  }

  /**
   * Calculate fees for a transaction
   */
  async calculateFees(licenseKey: string, amount: number): Promise<{
    transactionFee: number;
    fixedFee: number;
    totalFee: number;
    netAmount: number;
    feeRate: string;
  }> {
    const validation = await this.validateLicenseKey(licenseKey);
    
    if (!validation.valid || !validation.tier) {
      throw new Error(validation.reason || 'Invalid license');
    }

    const feeRate = parseFloat(validation.tier.transactionFeeRate);
    const fixedFee = parseFloat(validation.tier.fixedFeePerTransaction);
    
    const transactionFee = amount * feeRate;
    const totalFee = transactionFee + fixedFee;
    const netAmount = amount - totalFee;

    return {
      transactionFee,
      fixedFee,
      totalFee,
      netAmount,
      feeRate: `${(feeRate * 100).toFixed(2)}% + $${fixedFee.toFixed(2)}`
    };
  }

  /**
   * Create Stripe subscription for SDK license
   */
  async createStripeSubscription(
    subscriptionId: number,
    stripeCustomerId: string
  ): Promise<Stripe.Subscription> {
    const [subscription] = await db
      .select()
      .from(sdkLicenseSubscriptions)
      .where(eq(sdkLicenseSubscriptions.id, subscriptionId))
      .limit(1);

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    const tier = await this.getSDKLicenseTier(subscription.tierId);
    if (!tier) {
      throw new Error('Tier not found');
    }

    // Create Stripe product
    const product = await stripe.products.create({
      name: `Coin Railz SDK - ${tier.name}`,
      description: tier.description,
    });

    // Create Stripe price
    const amount = subscription.billingCycle === 'yearly' 
      ? parseFloat(tier.yearlyPrice) 
      : parseFloat(tier.monthlyPrice);

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      recurring: { 
        interval: subscription.billingCycle === 'yearly' ? 'year' : 'month' 
      },
    });

    // Create Stripe subscription
    const stripeSubscription = await stripe.subscriptions.create({
      customer: stripeCustomerId,
      items: [{ price: price.id }],
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent'],
    });

    // Update our subscription with Stripe details
    await db
      .update(sdkLicenseSubscriptions)
      .set({
        stripeCustomerId,
        stripeSubscriptionId: stripeSubscription.id
      })
      .where(eq(sdkLicenseSubscriptions.id, subscriptionId));

    return stripeSubscription;
  }

  /**
   * Get subscription analytics
   */
  async getSubscriptionAnalytics(subscriptionId: number): Promise<{
    totalTransactions: number;
    totalVolume: number;
    totalRevenue: number;
    currentMonthTransactions: number;
    currentMonthVolume: number;
    averageTransactionSize: number;
    monthlyGrowthRate: number;
  }> {
    const [subscription] = await db
      .select()
      .from(sdkLicenseSubscriptions)
      .where(eq(sdkLicenseSubscriptions.id, subscriptionId))
      .limit(1);

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    const totalTransactions = subscription.totalLifetimeTransactions || 0;
    const totalVolume = parseFloat(subscription.totalLifetimeVolume || '0');
    const totalRevenue = parseFloat(subscription.totalLifetimeRevenue || '0');
    const currentMonthTransactions = subscription.currentMonthTransactions || 0;
    const currentMonthVolume = parseFloat(subscription.currentMonthVolume || '0');
    
    const averageTransactionSize = totalTransactions > 0 ? totalVolume / totalTransactions : 0;
    
    // Calculate monthly growth rate (simplified - would need historical data for accuracy)
    const monthlyGrowthRate = currentMonthVolume > 0 ? 
      ((currentMonthVolume / (totalVolume || 1)) * 100) : 0;

    return {
      totalTransactions,
      totalVolume,
      totalRevenue,
      currentMonthTransactions,
      currentMonthVolume,
      averageTransactionSize,
      monthlyGrowthRate
    };
  }

  /**
   * Initialize default SDK license tiers
   */
  async initializeDefaultTiers(): Promise<void> {
    console.log('🏗️ Initializing default SDK license tiers...');
    
    const existingTiers = await this.getSDKLicenseTiers();
    if (existingTiers.length > 0) {
      console.log(`✅ Found ${existingTiers.length} existing SDK license tiers`);
      return;
    }

    for (const tierConfig of SDK_LICENSE_TIERS) {
      try {
        const tier = await this.createSDKLicenseTier(tierConfig);
        console.log(`✅ Created SDK license tier: ${tier.name} ($${tierConfig.yearlyPrice}/year)`);
      } catch (error) {
        console.error(`❌ Failed to create tier ${tierConfig.name}:`, error);
      }
    }

    console.log('🎯 SDK license tiers initialization complete');
  }
}

export const sdkLicensingService = new SDKLicensingService();