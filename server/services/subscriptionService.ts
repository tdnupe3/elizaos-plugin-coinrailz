import { db } from "../db";
import { subscriptions, subscriptionPlans, paymentMethods, type Subscription, type SubscriptionPlan } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { stripe } from './stripeClient';
import { nowPaymentsService } from "./nowPaymentsService";
import { XRPPaymentService } from "./xrpPaymentService";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}


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

  /**
   * Create NOWPayments subscription
   */
  async createNOWPaymentsSubscription(
    userId: string,
    planId: string,
    isYearly: boolean,
    email: string,
    preferredCurrency: string = "USDT"
  ): Promise<{ paymentId: string; paymentUrl: string; amount: number }> {
    const tier = this.getSubscriptionTier(planId);
    if (!tier) throw new Error('Invalid subscription plan');

    const amount = isYearly ? tier.yearlyPrice : tier.monthlyPrice;
    
    try {
      // Create NOWPayments payment
      const payment = await nowPaymentsService.createPayment({
        price_amount: amount,
        price_currency: "USD",
        pay_currency: preferredCurrency,
        order_id: `sub_${userId}_${planId}_${Date.now()}`,
        order_description: `${tier.name} Plan - ${isYearly ? 'Annual' : 'Monthly'} Subscription`,
        ipn_callback_url: `${process.env.BACKEND_URL}/api/nowpayments/subscription-webhook`
      });

      return {
        paymentId: payment.payment_id,
        paymentUrl: payment.payment_url,
        amount: amount
      };
    } catch (error: any) {
      console.error('NOWPayments subscription creation failed:', error);
      throw new Error(`NOWPayments error: ${error.message}`);
    }
  }

  /**
   * Create XRP subscription
   */
  async createXRPSubscription(
    userId: string,
    planId: string,
    isYearly: boolean,
    xrpAddress: string,
    xrpTxHash?: string
  ): Promise<{ subscription?: Subscription; paymentAddress?: string; amount?: number; amountXRP?: number }> {
    const tier = this.getSubscriptionTier(planId);
    if (!tier) throw new Error('Invalid subscription plan');

    const usdAmount = isYearly ? tier.yearlyPrice : tier.monthlyPrice;
    
    // If transaction hash provided, verify and create subscription
    if (xrpTxHash) {
      // In a real implementation, you'd verify the XRP transaction here
      const endDate = new Date();
      if (isYearly) {
        endDate.setFullYear(endDate.getFullYear() + 1);
      } else {
        endDate.setMonth(endDate.getMonth() + 1);
      }

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
          usdcPaymentTxHash: xrpTxHash,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();

      return { subscription };
    } else {
      // Return payment details for user to send XRP
      try {
        const xrpAmount = await XRPPaymentService.getCorridorOptimization("USD", "XRP", usdAmount);
        
        return {
          paymentAddress: process.env.PLATFORM_XRP_ADDRESS || 'rGs1Z6KkeSfQqY9m1NofySRsc1mDKTBzyW',
          amount: usdAmount,
          amountXRP: usdAmount / (xrpAmount.exchangeRate || 0.5), // Fallback exchange rate
        };
      } catch (error) {
        throw new Error('Failed to calculate XRP payment amount');
      }
    }
  }

  /**
   * Process treasury transfer subscription
   */
  async processTreasuryTransferSubscription(
    userId: string,
    planId: string,
    isYearly: boolean,
    confirmationReference: string
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

    // Create subscription record with treasury reference
    const [subscription] = await db
      .insert(subscriptions)
      .values({
        userId,
        planId,
        status: 'pending', // Treasury transfers need manual verification
        currentPeriodStart: new Date(),
        currentPeriodEnd: endDate,
        cancelAtPeriodEnd: false,
        stripeSubscriptionId: null,
        paypalSubscriptionId: null,
        usdcPaymentTxHash: `treasury_${confirmationReference}`,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    return subscription;
  }

  /**
   * Get treasury wallet information for direct transfers
   */
  getTreasuryWalletInfo(): {
    usdcAddress: string;
    ethAddress: string;
    xrpAddress: string;
    btcAddress: string;
    achDetails: { routingNumber: string; accountNumber: string; accountName: string };
    wireDetails: { bankName: string; swiftCode: string; accountNumber: string; accountName: string };
  } {
    return {
      usdcAddress: process.env.TREASURY_USDC_ADDRESS || '0x742d35Cc6934C0532925a3b8D162aE0661b13E3E',
      ethAddress: process.env.TREASURY_ETH_ADDRESS || '0x742d35Cc6934C0532925a3b8D162aE0661b13E3E',
      xrpAddress: process.env.PLATFORM_XRP_ADDRESS || 'rGs1Z6KkeSfQqY9m1NofySRsc1mDKTBzyW',
      btcAddress: process.env.TREASURY_BTC_ADDRESS || 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
      achDetails: {
        routingNumber: process.env.TREASURY_ACH_ROUTING || '121000248',
        accountNumber: process.env.TREASURY_ACH_ACCOUNT || '****1234',
        accountName: 'Coin Railz Treasury'
      },
      wireDetails: {
        bankName: process.env.TREASURY_BANK_NAME || 'Wells Fargo Bank',
        swiftCode: process.env.TREASURY_SWIFT || 'WFBIUS6S',
        accountNumber: process.env.TREASURY_WIRE_ACCOUNT || '****5678',
        accountName: 'Coin Railz Treasury'
      }
    };
  }
}

export const subscriptionService = new SubscriptionService();