import { db } from "../db";
import { subscriptions, subscriptionPlans, paymentMethods, type Subscription, type SubscriptionPlan } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-07-30.basil",
});

export interface SubscriptionTier {
  id: string;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  yearlyDiscount: number;
  tradingFeeReduction: number;
  crossChainFeeReduction: number;
  aiMarketplaceCredits: number;
  features: string[];
}

export const SUBSCRIPTION_TIERS: SubscriptionTier[] = [
  {
    id: 'free',
    name: 'Free',
    monthlyPrice: 0,
    yearlyPrice: 0,
    yearlyDiscount: 0,
    tradingFeeReduction: 0, // 0.25% standard
    crossChainFeeReduction: 0, // 0.5% standard
    aiMarketplaceCredits: 0,
    features: [
      'Full DEX trading access',
      'Standard platform fees (0.25%)',
      'Basic P2P transfers',
      'Cross-chain transactions (0.5%)',
      'AI Marketplace browsing',
      'Transaction history (30 days)'
    ]
  },
  {
    id: 'starter',
    name: 'Starter',
    monthlyPrice: 9.99,
    yearlyPrice: 95.90, // 20% off
    yearlyDiscount: 20,
    tradingFeeReduction: 10, // 0.225% (10% savings)
    crossChainFeeReduction: 10, // 0.45% (10% savings)
    aiMarketplaceCredits: 10,
    features: [
      'Reduced trading fees (0.225%)',
      'Reduced cross-chain fees (0.45%)',
      '$10/month AI Marketplace credits',
      'Priority email support (24h)',
      'Extended history (6 months)',
      'Mobile notifications'
    ]
  },
  {
    id: 'pro',
    name: 'Pro',
    monthlyPrice: 29.99,
    yearlyPrice: 287.90, // 20% off
    yearlyDiscount: 20,
    tradingFeeReduction: 20, // 0.2% (20% savings)
    crossChainFeeReduction: 20, // 0.4% (20% savings)
    aiMarketplaceCredits: 50,
    features: [
      'Discounted trading fees (0.2%)',
      'Discounted cross-chain fees (0.4%)',
      '$50/month AI Marketplace credits',
      'Advanced trading tools',
      'Portfolio analytics',
      'API access',
      'Live chat support',
      'Unlimited transaction history'
    ]
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyPrice: 99.99,
    yearlyPrice: 959.90, // 20% off
    yearlyDiscount: 20,
    tradingFeeReduction: 30, // 0.175% (30% savings)
    crossChainFeeReduction: 30, // 0.35% (30% savings)
    aiMarketplaceCredits: 200,
    features: [
      'Premium trading fees (0.175%)',
      'Premium cross-chain fees (0.35%)',
      '$200/month AI Marketplace credits',
      'White-label solutions',
      'Dedicated account manager',
      'Custom API limits',
      'Advanced analytics dashboard',
      'Institutional features'
    ]
  }
];

export class SubscriptionService {
  /**
   * Get all available subscription tiers
   */
  getSubscriptionTiers(): SubscriptionTier[] {
    return SUBSCRIPTION_TIERS;
  }

  /**
   * Get subscription tier by ID
   */
  getSubscriptionTier(tierId: string): SubscriptionTier | undefined {
    return SUBSCRIPTION_TIERS.find(tier => tier.id === tierId);
  }

  /**
   * Calculate effective trading fee for user based on subscription
   */
  calculateTradingFee(amount: number, userSubscription?: Subscription): number {
    const baseFee = 0.0025; // 0.25% standard
    if (!userSubscription || userSubscription.status !== 'active') {
      return amount * baseFee;
    }

    const tier = this.getSubscriptionTier(userSubscription.planId);
    if (!tier) return amount * baseFee;

    const reduction = tier.tradingFeeReduction / 100;
    const effectiveFeeRate = baseFee * (1 - reduction);
    return amount * effectiveFeeRate;
  }

  /**
   * Calculate effective cross-chain fee for user based on subscription
   */
  calculateCrossChainFee(amount: number, userSubscription?: Subscription): number {
    const baseFee = 0.005; // 0.5% standard
    if (!userSubscription || userSubscription.status !== 'active') {
      return amount * baseFee;
    }

    const tier = this.getSubscriptionTier(userSubscription.planId);
    if (!tier) return amount * baseFee;

    const reduction = tier.crossChainFeeReduction / 100;
    const effectiveFeeRate = baseFee * (1 - reduction);
    return amount * effectiveFeeRate;
  }

  /**
   * Get user's current subscription
   */
  async getUserSubscription(userId: string): Promise<Subscription | undefined> {
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);
    
    return subscription;
  }

  /**
   * Create Stripe subscription for monthly plan
   */
  async createStripeMonthlySubscription(
    userId: string,
    planId: string,
    stripeCustomerId: string
  ): Promise<Stripe.Subscription> {
    const tier = this.getSubscriptionTier(planId);
    if (!tier) throw new Error('Invalid subscription plan');

    // Create Stripe product and price if needed
    const product = await stripe.products.create({
      name: `Railz Token ${tier.name} Plan`,
      description: `Monthly subscription to ${tier.name} tier`,
    });

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: Math.round(tier.monthlyPrice * 100), // Convert to cents
      currency: 'usd',
      recurring: { interval: 'month' },
    });

    return await stripe.subscriptions.create({
      customer: stripeCustomerId,
      items: [{ price: price.id }],
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent'],
    });
  }

  /**
   * Create Stripe subscription for yearly plan (20% discount)
   */
  async createStripeYearlySubscription(
    userId: string,
    planId: string,
    stripeCustomerId: string
  ): Promise<Stripe.Subscription> {
    const tier = this.getSubscriptionTier(planId);
    if (!tier) throw new Error('Invalid subscription plan');

    const product = await stripe.products.create({
      name: `Railz Token ${tier.name} Plan (Annual)`,
      description: `Annual subscription to ${tier.name} tier (20% off)`,
    });

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: Math.round(tier.yearlyPrice * 100), // Convert to cents
      currency: 'usd',
      recurring: { interval: 'year' },
    });

    return await stripe.subscriptions.create({
      customer: stripeCustomerId,
      items: [{ price: price.id }],
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent'],
    });
  }

  /**
   * Create PayPal subscription
   */
  async createPayPalSubscription(
    userId: string,
    planId: string,
    isYearly: boolean = false
  ): Promise<{ planId: string; subscriptionId: string }> {
    const tier = this.getSubscriptionTier(planId);
    if (!tier) throw new Error('Invalid subscription plan');

    // This would integrate with PayPal's subscription API
    // For now, returning mock structure
    return {
      planId: `paypal_${planId}_${isYearly ? 'yearly' : 'monthly'}`,
      subscriptionId: `sub_${Date.now()}`
    };
  }

  /**
   * Process USDC subscription payment
   */
  async processUSDCSubscription(
    userId: string,
    planId: string,
    isYearly: boolean,
    usdcPaymentTxHash: string
  ): Promise<Subscription> {
    const tier = this.getSubscriptionTier(planId);
    if (!tier) throw new Error('Invalid subscription plan');

    const amount = isYearly ? tier.yearlyPrice : tier.monthlyPrice;
    const endDate = new Date();
    if (isYearly) {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }

    // Create subscription record
    const [subscription] = await db
      .insert(subscriptions)
      .values({
        userId,
        planId,
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: endDate,
        cancelAtPeriodEnd: false,
        stripeSubscriptionId: null,
        paypalSubscriptionId: null,
        usdcPaymentTxHash,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    return subscription;
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(userId: string): Promise<void> {
    const subscription = await this.getUserSubscription(userId);
    if (!subscription) throw new Error('No active subscription found');

    if (subscription.stripeSubscriptionId) {
      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: true
      });
    }

    await db
      .update(subscriptions)
      .set({
        cancelAtPeriodEnd: true,
        updatedAt: new Date()
      })
      .where(eq(subscriptions.userId, userId));
  }

  /**
   * Check if subscription is active and not expired
   */
  isSubscriptionActive(subscription?: Subscription): boolean {
    if (!subscription) return false;
    if (subscription.status !== 'active') return false;
    
    const now = new Date();
    const endDate = new Date(subscription.currentPeriodEnd);
    return now <= endDate;
  }

  /**
   * Get user's effective subscription tier for fee calculations
   */
  async getUserEffectiveTier(userId: string): Promise<SubscriptionTier> {
    const subscription = await this.getUserSubscription(userId);
    
    if (!subscription || !this.isSubscriptionActive(subscription)) {
      return this.getSubscriptionTier('free')!;
    }

    return this.getSubscriptionTier(subscription.planId) || this.getSubscriptionTier('free')!;
  }

  /**
   * Get remaining AI marketplace credits for user
   */
  async getAIMarketplaceCredits(userId: string): Promise<number> {
    const tier = await this.getUserEffectiveTier(userId);
    // This would track actual credit usage - for now return tier amount
    return tier.aiMarketplaceCredits;
  }
}

export const subscriptionService = new SubscriptionService();