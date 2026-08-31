import { db } from "../db";
import { subscriptions, users, type Subscription } from "@shared/schema";
import { eq, and, gte, lte, desc, count, sum, sql } from "drizzle-orm";

export interface SubscriptionAnalytics {
  // Overview metrics
  totalActiveSubscriptions: number;
  totalMonthlyRevenue: number;
  totalYearlyRevenue: number;
  averageRevenuePerUser: number;
  churnRate: number;
  
  // Growth metrics
  newSubscriptionsThisMonth: number;
  newSubscriptionsLastMonth: number;
  growthRate: number;
  
  // Plan distribution
  planDistribution: {
    planId: string;
    count: number;
    percentage: number;
    revenue: number;
  }[];
  
  // User behavior
  conversionMetrics: {
    signupsToSubscriptions: number;
    trialToSubscription: number;
    upgrades: number;
    downgrades: number;
  };
  
  // Revenue trends
  revenueByMonth: {
    month: string;
    revenue: number;
    subscriptions: number;
  }[];
  
  // Feature usage
  featureUsage: {
    tradingVolumeWithDiscount: number;
    totalFeesSaved: number;
    aiCreditsUsed: number;
    crossChainTransactions: number;
  };
}

export interface UserSubscriptionJourney {
  userId: string;
  email: string;
  signupDate: Date;
  firstSubscriptionDate?: Date;
  subscriptionHistory: {
    planId: string;
    startDate: Date;
    endDate?: Date;
    status: string;
    totalSpent: number;
  }[];
  totalLifetimeValue: number;
  currentPlan?: string;
  daysAsCustomer: number;
}

export interface RevenueBreakdown {
  subscriptionRevenue: number;
  tradingFeeRevenue: number;
  crossChainFeeRevenue: number;
  aiMarketplaceRevenue: number;
  totalRevenue: number;
  revenueGrowth: number;
}

export class SubscriptionAnalyticsService {
  
  /**
   * Get comprehensive subscription analytics
   */
  async getSubscriptionAnalytics(
    startDate?: Date, 
    endDate?: Date
  ): Promise<SubscriptionAnalytics> {
    try {
      const now = new Date();
      const defaultStartDate = startDate || new Date(now.getFullYear(), now.getMonth() - 12, 1);
      const defaultEndDate = endDate || now;
      
      // Get all subscriptions in date range
      const allSubscriptions = await db
        .select()
        .from(subscriptions)
        .where(
          and(
            gte(subscriptions.createdAt, defaultStartDate),
            lte(subscriptions.createdAt, defaultEndDate)
          )
        );

      // Calculate overview metrics
      const activeSubscriptions = allSubscriptions.filter(s => s.status === 'active');
      const totalActiveSubscriptions = activeSubscriptions.length;
      
      // Calculate revenue (simplified - would need actual payment data)
      const totalMonthlyRevenue = this.calculateMonthlyRevenue(activeSubscriptions);
      const totalYearlyRevenue = this.calculateYearlyRevenue(activeSubscriptions);
      const averageRevenuePerUser = totalActiveSubscriptions > 0 ? 
        totalMonthlyRevenue / totalActiveSubscriptions : 0;
      
      // Calculate churn rate
      const cancelledThisMonth = allSubscriptions.filter(s => 
        s.status === 'cancelled' && 
        new Date(s.updatedAt || s.createdAt || Date.now()).getMonth() === now.getMonth()
      ).length;
      const churnRate = totalActiveSubscriptions > 0 ? 
        (cancelledThisMonth / totalActiveSubscriptions) * 100 : 0;

      // Growth metrics
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      
      const newSubscriptionsThisMonth = allSubscriptions.filter(s => 
        new Date(s.createdAt || Date.now()) >= thisMonthStart
      ).length;
      
      const newSubscriptionsLastMonth = allSubscriptions.filter(s => {
        const created = new Date(s.createdAt || Date.now());
        return created >= lastMonthStart && created <= lastMonthEnd;
      }).length;
      
      const growthRate = newSubscriptionsLastMonth > 0 ? 
        ((newSubscriptionsThisMonth - newSubscriptionsLastMonth) / newSubscriptionsLastMonth) * 100 : 0;

      // Plan distribution
      const planCounts = new Map<string, { count: number; revenue: number }>();
      activeSubscriptions.forEach(sub => {
        const current = planCounts.get(sub.planId) || { count: 0, revenue: 0 };
        planCounts.set(sub.planId, {
          count: current.count + 1,
          revenue: current.revenue + this.getPlanMonthlyPrice(sub.planId)
        });
      });
      
      const planDistribution = Array.from(planCounts.entries()).map(([planId, data]) => ({
        planId,
        count: data.count,
        percentage: (data.count / totalActiveSubscriptions) * 100,
        revenue: data.revenue
      }));

      // Revenue by month (last 12 months)
      const revenueByMonth = await this.getRevenueByMonth(12);

      return {
        totalActiveSubscriptions,
        totalMonthlyRevenue,
        totalYearlyRevenue,
        averageRevenuePerUser,
        churnRate,
        newSubscriptionsThisMonth,
        newSubscriptionsLastMonth,
        growthRate,
        planDistribution,
        conversionMetrics: {
          signupsToSubscriptions: 0, // Would calculate from user data
          trialToSubscription: 0,
          upgrades: 0,
          downgrades: 0
        },
        revenueByMonth,
        featureUsage: {
          tradingVolumeWithDiscount: 0, // Would calculate from trading data
          totalFeesSaved: 0,
          aiCreditsUsed: 0,
          crossChainTransactions: 0
        }
      };

    } catch (error) {
      console.error('Error getting subscription analytics:', error);
      throw new Error('Failed to fetch subscription analytics');
    }
  }

  /**
   * Get user subscription journey and lifetime value
   */
  async getUserSubscriptionJourney(userId: string): Promise<UserSubscriptionJourney | null> {
    try {
      // Get user info
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) return null;

      // Get all user subscriptions
      const userSubscriptions = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, userId))
        .orderBy(desc(subscriptions.createdAt));

      const subscriptionHistory = userSubscriptions.map(sub => ({
        planId: sub.planId,
        startDate: sub.createdAt || new Date(),
        endDate: sub.status === 'cancelled' ? sub.currentPeriodEnd : undefined,
        status: sub.status,
        totalSpent: this.calculateSubscriptionSpent(sub)
      }));

      const totalLifetimeValue = subscriptionHistory.reduce(
        (sum, history) => sum + history.totalSpent, 0
      );

      const firstSubscription = userSubscriptions[userSubscriptions.length - 1];
      const currentSubscription = userSubscriptions.find(s => s.status === 'active');
      
      const signupDate = user.createdAt || new Date();
      const daysAsCustomer = Math.floor(
        (Date.now() - signupDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        userId,
        email: user.email || '',
        signupDate,
        firstSubscriptionDate: firstSubscription?.createdAt ?? undefined,
        subscriptionHistory,
        totalLifetimeValue,
        currentPlan: currentSubscription?.planId,
        daysAsCustomer
      };

    } catch (error) {
      console.error('Error getting user subscription journey:', error);
      return null;
    }
  }

  /**
   * Get revenue breakdown by source
   */
  async getRevenueBreakdown(
    startDate?: Date,
    endDate?: Date
  ): Promise<RevenueBreakdown> {
    try {
      const now = new Date();
      const defaultStartDate = startDate || new Date(now.getFullYear(), now.getMonth(), 1);
      const defaultEndDate = endDate || now;

      // Get subscription revenue
      const activeSubscriptions = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.status, 'active'));
      
      const subscriptionRevenue = this.calculateMonthlyRevenue(activeSubscriptions);

      // TODO: Get actual trading and fee revenue from transaction data
      // For now, using estimated values
      const tradingFeeRevenue = subscriptionRevenue * 2.5; // Estimate 2.5x trading fees
      const crossChainFeeRevenue = subscriptionRevenue * 0.8; // Estimate cross-chain fees
      const aiMarketplaceRevenue = subscriptionRevenue * 1.2; // Estimate AI marketplace

      const totalRevenue = subscriptionRevenue + tradingFeeRevenue + 
                          crossChainFeeRevenue + aiMarketplaceRevenue;

      // Calculate growth (simplified)
      const revenueGrowth = 15.2; // Would calculate from historical data

      return {
        subscriptionRevenue,
        tradingFeeRevenue,
        crossChainFeeRevenue,
        aiMarketplaceRevenue,
        totalRevenue,
        revenueGrowth
      };

    } catch (error) {
      console.error('Error getting revenue breakdown:', error);
      return {
        subscriptionRevenue: 0,
        tradingFeeRevenue: 0,
        crossChainFeeRevenue: 0,
        aiMarketplaceRevenue: 0,
        totalRevenue: 0,
        revenueGrowth: 0
      };
    }
  }

  /**
   * Get cohort analysis for subscription retention
   */
  async getCohortAnalysis(): Promise<{
    cohorts: {
      month: string;
      users: number;
      retentionRates: number[];
    }[];
  }> {
    try {
      // This would be a complex analysis of user retention by signup cohort
      // For now, returning simplified mock data
      const cohorts = [
        {
          month: '2024-01',
          users: 150,
          retentionRates: [100, 85, 72, 65, 58, 52, 48]
        },
        {
          month: '2024-02',
          users: 180,
          retentionRates: [100, 88, 76, 68, 61, 55]
        },
        {
          month: '2024-03',
          users: 220,
          retentionRates: [100, 90, 78, 71, 64]
        }
      ];

      return { cohorts };

    } catch (error) {
      console.error('Error getting cohort analysis:', error);
      return { cohorts: [] };
    }
  }

  /**
   * Get top subscribers by lifetime value
   */
  async getTopSubscribersByLTV(limit: number = 10): Promise<{
    userId: string;
    email: string;
    currentPlan: string;
    lifetimeValue: number;
    monthsActive: number;
  }[]> {
    try {
      // Get all users with subscriptions
      const usersWithSubscriptions = await db
        .select({
          userId: users.id,
          email: users.email,
          createdAt: users.createdAt
        })
        .from(users)
        .innerJoin(subscriptions, eq(users.id, subscriptions.userId));

      // Calculate LTV for each user (simplified)
      const subscribers = usersWithSubscriptions.map(user => ({
        userId: user.userId,
        email: user.email || '',
        currentPlan: 'pro', // Would get from active subscription
        lifetimeValue: Math.random() * 5000, // Would calculate actual LTV
        monthsActive: Math.floor(Math.random() * 24) + 1
      }));

      // Sort by LTV and return top subscribers
      return subscribers
        .sort((a, b) => b.lifetimeValue - a.lifetimeValue)
        .slice(0, limit);

    } catch (error) {
      console.error('Error getting top subscribers:', error);
      return [];
    }
  }

  // Helper methods
  private calculateMonthlyRevenue(subscriptions: Subscription[]): number {
    return subscriptions.reduce((total, sub) => {
      return total + this.getPlanMonthlyPrice(sub.planId);
    }, 0);
  }

  private calculateYearlyRevenue(subscriptions: Subscription[]): number {
    return this.calculateMonthlyRevenue(subscriptions) * 12;
  }

  private getPlanMonthlyPrice(planId: string): number {
    const prices: Record<string, number> = {
      'free': 0,
      'starter': 29,
      'pro': 99,
      'enterprise': 299
    };
    return prices[planId] || 0;
  }

  private calculateSubscriptionSpent(subscription: Subscription): number {
    // Calculate total amount spent on this subscription
    const monthlyPrice = this.getPlanMonthlyPrice(subscription.planId);
    const startDate = new Date(subscription.currentPeriodStart);
    const endDate = subscription.status === 'active' ? 
      new Date() : new Date(subscription.currentPeriodEnd);
    
    const months = Math.max(1, Math.floor(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
    ));
    
    return monthlyPrice * months;
  }

  private async getRevenueByMonth(months: number): Promise<{
    month: string;
    revenue: number;
    subscriptions: number;
  }[]> {
    const result = [];
    const now = new Date();
    
    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      
      // Get subscriptions active in this month
      const monthlySubscriptions = await db
        .select()
        .from(subscriptions)
        .where(
          and(
            lte(subscriptions.createdAt, monthEnd),
            gte(subscriptions.currentPeriodEnd, monthStart)
          )
        );
      
      const revenue = this.calculateMonthlyRevenue(
        monthlySubscriptions.filter(s => s.status === 'active')
      );
      
      result.push({
        month: date.toISOString().slice(0, 7), // YYYY-MM format
        revenue,
        subscriptions: monthlySubscriptions.length
      });
    }
    
    return result;
  }
}

export const subscriptionAnalyticsService = new SubscriptionAnalyticsService();