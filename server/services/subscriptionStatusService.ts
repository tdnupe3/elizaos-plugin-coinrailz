import { db } from "../db";
import { subscriptions, users, type Subscription } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { subscriptionService } from "./subscriptionService";

export interface SubscriptionStatus {
  isActive: boolean;
  planId: string;
  planName: string;
  tier: 'free' | 'starter' | 'pro' | 'enterprise';
  tradingFeeReduction: number;
  crossChainFeeReduction: number;
  aiMarketplaceCredits: number;
  currentPeriodEnd: Date;
  daysUntilRenewal: number;
  status: 'active' | 'cancelled' | 'expired' | 'pending';
  cancelAtPeriodEnd: boolean;
  paymentMethod?: string;
  billingPeriod?: 'monthly' | 'yearly';
  features: string[];
}

export interface SubscriptionUsage {
  userId: string;
  period: string; // YYYY-MM for monthly tracking
  tradingVolume: number;
  tradingFeesSaved: number;
  crossChainTransactions: number;
  crossChainFeesSaved: number;
  aiMarketplaceCreditsUsed: number;
  totalSavings: number;
  lastUpdated: Date;
}

export class SubscriptionStatusService {
  private statusCache = new Map<string, { status: SubscriptionStatus; expires: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Get comprehensive subscription status for a user
   * Uses caching for performance on high-frequency DEX operations
   */
  async getUserSubscriptionStatus(userId: string): Promise<SubscriptionStatus> {
    // Check cache first
    const cached = this.statusCache.get(userId);
    if (cached && Date.now() < cached.expires) {
      return cached.status;
    }

    // Fetch from database
    const status = await this.fetchSubscriptionStatus(userId);
    
    // Cache the result
    this.statusCache.set(userId, {
      status,
      expires: Date.now() + this.CACHE_TTL
    });

    return status;
  }

  /**
   * Fetch fresh subscription status from database
   */
  private async fetchSubscriptionStatus(userId: string): Promise<SubscriptionStatus> {
    try {
      // Get user's active subscription
      const [subscription] = await db
        .select()
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.userId, userId),
            // Only get active or cancelled (but not expired) subscriptions
          )
        )
        .orderBy(desc(subscriptions.createdAt))
        .limit(1);

      // If no subscription found, return free tier
      if (!subscription) {
        return this.getFreeTierStatus();
      }

      // Get plan details
      const planDetails = subscriptionService.getSubscriptionTier(subscription.planId);
      if (!planDetails) {
        return this.getFreeTierStatus();
      }

      // Calculate days until renewal
      const currentPeriodEnd = new Date(subscription.currentPeriodEnd);
      const now = new Date();
      const daysUntilRenewal = Math.ceil((currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      // Determine if subscription is actually active
      const isActive = subscription.status === 'active' && daysUntilRenewal > 0;

      return {
        isActive,
        planId: subscription.planId,
        planName: planDetails.name,
        tier: subscription.planId as 'free' | 'starter' | 'pro' | 'enterprise',
        tradingFeeReduction: isActive ? planDetails.tradingFeeReduction : 0,
        crossChainFeeReduction: isActive ? planDetails.crossChainFeeReduction : 0,
        aiMarketplaceCredits: isActive ? planDetails.aiMarketplaceCredits : 0,
        currentPeriodEnd,
        daysUntilRenewal: Math.max(0, daysUntilRenewal),
        status: subscription.status as 'active' | 'cancelled' | 'expired' | 'pending',
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd || false,
        paymentMethod: subscription.stripeSubscriptionId ? 'stripe' : 
                       subscription.paypalSubscriptionId ? 'paypal' : 
                       subscription.usdcPaymentTxHash ? 'usdc' : undefined,
        billingPeriod: undefined, // Will be determined from plan duration
        features: planDetails.features
      };

    } catch (error) {
      console.error('Error fetching subscription status:', error);
      return this.getFreeTierStatus();
    }
  }

  /**
   * Get free tier status (default for users without subscriptions)
   */
  private getFreeTierStatus(): SubscriptionStatus {
    const freeTier = subscriptionService.getSubscriptionTier('free');
    if (!freeTier) {
      // Fallback if free tier not found
      return {
        isActive: true,
        planId: 'free',
        planName: 'Free',
        tier: 'free',
        tradingFeeReduction: 0,
        crossChainFeeReduction: 0,
        aiMarketplaceCredits: 0,
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        daysUntilRenewal: 365,
        status: 'active',
        cancelAtPeriodEnd: false,
        features: ['Basic Trading', 'Standard Support']
      };
    }

    return {
      isActive: true, // Free tier is always "active"
      planId: 'free',
      planName: freeTier.name,
      tier: 'free',
      tradingFeeReduction: 0,
      crossChainFeeReduction: 0,
      aiMarketplaceCredits: 0,
      currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
      daysUntilRenewal: 365,
      status: 'active',
      cancelAtPeriodEnd: false,
      features: freeTier.features
    };
  }

  /**
   * Calculate actual trading fee for user based on subscription
   */
  async calculateTradingFee(userId: string, baseAmount: number): Promise<{
    baseFee: number;
    discountAmount: number;
    finalFee: number;
    feeReduction: number;
  }> {
    const status = await this.getUserSubscriptionStatus(userId);
    
    const baseFeeRate = 0.015; // 1.5% base trading fee
    const baseFee = baseAmount * baseFeeRate;
    
    const discountAmount = baseFee * (status.tradingFeeReduction / 100);
    const finalFee = baseFee - discountAmount;
    
    return {
      baseFee,
      discountAmount,
      finalFee,
      feeReduction: status.tradingFeeReduction
    };
  }

  /**
   * Calculate cross-chain fee for user based on subscription
   */
  async calculateCrossChainFee(userId: string, baseAmount: number): Promise<{
    baseFee: number;
    discountAmount: number;
    finalFee: number;
    feeReduction: number;
  }> {
    const status = await this.getUserSubscriptionStatus(userId);
    
    const baseFeeRate = 0.025; // 2.5% base cross-chain fee
    const baseFee = baseAmount * baseFeeRate;
    
    const discountAmount = baseFee * (status.crossChainFeeReduction / 100);
    const finalFee = baseFee - discountAmount;
    
    return {
      baseFee,
      discountAmount,
      finalFee,
      feeReduction: status.crossChainFeeReduction
    };
  }

  /**
   * Track subscription usage for analytics
   */
  async trackSubscriptionUsage(userId: string, type: 'trading' | 'crosschain' | 'ai', data: {
    volume?: number;
    feesSaved?: number;
    creditsUsed?: number;
  }): Promise<void> {
    try {
      const period = new Date().toISOString().slice(0, 7); // YYYY-MM format
      
      // This would insert/update usage tracking in a separate table
      // For now, we'll just log it
      console.log(`📊 Subscription usage tracked: ${userId} - ${type}`, {
        period,
        ...data
      });
      
      // TODO: Implement actual usage tracking table and queries
      
    } catch (error) {
      console.error('Error tracking subscription usage:', error);
    }
  }

  /**
   * Clear cache for a specific user (call after subscription changes)
   */
  clearUserCache(userId: string): void {
    this.statusCache.delete(userId);
  }

  /**
   * Clear all cached statuses (call during maintenance)
   */
  clearAllCache(): void {
    this.statusCache.clear();
  }

  /**
   * Check if user has specific feature access
   */
  async hasFeatureAccess(userId: string, feature: string): Promise<boolean> {
    const status = await this.getUserSubscriptionStatus(userId);
    return status.features.includes(feature);
  }

  /**
   * Get subscription benefits summary for UI display
   */
  async getSubscriptionBenefits(userId: string): Promise<{
    tradingFeeReduction: string;
    crossChainFeeReduction: string;
    aiCredits: string;
    planName: string;
    isActive: boolean;
  }> {
    const status = await this.getUserSubscriptionStatus(userId);
    
    return {
      tradingFeeReduction: status.tradingFeeReduction > 0 ? `${status.tradingFeeReduction}%` : 'None',
      crossChainFeeReduction: status.crossChainFeeReduction > 0 ? `${status.crossChainFeeReduction}%` : 'None',
      aiCredits: status.aiMarketplaceCredits > 0 ? `$${status.aiMarketplaceCredits}` : 'None',
      planName: status.planName,
      isActive: status.isActive
    };
  }

  /**
   * Get real-time subscription metrics for admin dashboard
   */
  async getSubscriptionMetrics(): Promise<{
    totalActiveSubscriptions: number;
    totalCancelledSubscriptions: number;
    totalExpiredSubscriptions: number;
    totalPendingSubscriptions: number;
    revenueThisMonth: number;
    churnRate: number;
  }> {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      // Get all subscriptions
      const allSubscriptions = await db.select().from(subscriptions);
      
      const active = allSubscriptions.filter(s => s.status === 'active').length;
      const cancelled = allSubscriptions.filter(s => s.status === 'cancelled').length;
      const expired = allSubscriptions.filter(s => s.status === 'expired').length;
      const pending = allSubscriptions.filter(s => s.status === 'pending').length;
      
      // Calculate basic metrics
      const totalActiveSubscriptions = active;
      const totalCancelledSubscriptions = cancelled;
      const totalExpiredSubscriptions = expired;
      const totalPendingSubscriptions = pending;
      
      // TODO: Implement proper revenue and churn calculations
      const revenueThisMonth = 0; // Would calculate from payment records
      const churnRate = cancelled > 0 && active > 0 ? (cancelled / (cancelled + active)) * 100 : 0;
      
      return {
        totalActiveSubscriptions,
        totalCancelledSubscriptions,
        totalExpiredSubscriptions,
        totalPendingSubscriptions,
        revenueThisMonth,
        churnRate
      };
      
    } catch (error) {
      console.error('Error getting subscription metrics:', error);
      return {
        totalActiveSubscriptions: 0,
        totalCancelledSubscriptions: 0,
        totalExpiredSubscriptions: 0,
        totalPendingSubscriptions: 0,
        revenueThisMonth: 0,
        churnRate: 0
      };
    }
  }
}

export const subscriptionStatusService = new SubscriptionStatusService();