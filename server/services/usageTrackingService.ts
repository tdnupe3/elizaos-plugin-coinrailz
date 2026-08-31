/**
 * 📊 USAGE TRACKING SERVICE
 * Comprehensive tracking and reporting for API usage
 * CRITICAL: Ensures fair usage enforcement and billing accuracy
 */

import { db } from '../db';
import { aiAgentSubscriptions } from '../../shared/schema';
import { eq, sql } from 'drizzle-orm';

interface UsageStats {
  requests_today: number;
  requests_month: number;
  last_reset?: string;
  last_request?: string;
  last_endpoint?: string;
}

export class UsageTrackingService {
  /**
   * 📈 GET USAGE STATISTICS FOR SUBSCRIPTION
   */
  async getUsageStats(subscriptionId: number): Promise<any> {
    try {
      const subscriptions = await db.select()
        .from(aiAgentSubscriptions)
        .where(eq(aiAgentSubscriptions.id, subscriptionId))
        .limit(1);

      if (subscriptions.length === 0) {
        throw new Error('Subscription not found');
      }

      const subscription = subscriptions[0];
      const usageStats = this.getUsageStatsValue(subscription.usageStats);

      // Get product limits
      const productLimits = this.getProductLimits(subscription.productId);

      return {
        current_usage: {
          today: usageStats.requests_today,
          month: usageStats.requests_month,
          last_request: usageStats.last_request || 'Never',
          last_endpoint: usageStats.last_endpoint || 'None'
        },
        limits: {
          daily: productLimits.dailyLimit || 'Unlimited',
          monthly: productLimits.monthlyLimit || 'Unlimited'
        },
        remaining: {
          today: productLimits.dailyLimit ? Math.max(0, productLimits.dailyLimit - usageStats.requests_today) : 'Unlimited',
          month: productLimits.monthlyLimit ? Math.max(0, productLimits.monthlyLimit - usageStats.requests_month) : 'Unlimited'
        },
        subscription: {
          tier: this.getTierName(subscription.productId),
          status: subscription.status,
          agent_id: subscription.agentId
        }
      };

    } catch (error) {
      console.error('Failed to get usage stats:', error);
      throw error;
    }
  }

  /**
   * 📊 GET DETAILED USAGE REPORT
   */
  async getUsageReport(agentId: string): Promise<any> {
    try {
      // Get all subscriptions for this agent
      const subscriptions = await db.select()
        .from(aiAgentSubscriptions)
        .where(eq(aiAgentSubscriptions.agentId, agentId));

      if (subscriptions.length === 0) {
        return {
          agent_id: agentId,
          active_subscriptions: 0,
          total_usage: 0,
          message: 'No active subscriptions found'
        };
      }

      const reports = subscriptions.map(subscription => {
        const usageStats = this.getUsageStatsValue(subscription.usageStats);

        return {
          subscription_id: subscription.id,
          product_tier: this.getTierName(subscription.productId),
          status: subscription.status,
          usage_today: usageStats.requests_today,
          usage_month: usageStats.requests_month,
          last_request: usageStats.last_request || 'Never',
          monthly_revenue: Number(subscription.monthlyRevenue ?? 0)
        };
      });

      const totalUsage = reports.reduce((sum, report) => sum + report.usage_month, 0);
      const totalRevenue = reports.reduce((sum, report) => sum + report.monthly_revenue, 0);

      return {
        agent_id: agentId,
        active_subscriptions: subscriptions.length,
        total_usage_this_month: totalUsage,
        total_monthly_revenue: totalRevenue,
        subscriptions: reports,
        generated_at: new Date().toISOString()
      };

    } catch (error) {
      console.error('Failed to generate usage report:', error);
      throw error;
    }
  }

  /**
   * 🔄 RESET USAGE COUNTERS (for billing cycles)
   */
  async resetUsageCounters(type: 'daily' | 'monthly'): Promise<void> {
    try {
      console.log(`🔄 Resetting ${type} usage counters...`);

      // Get all active subscriptions
      const subscriptions = await db.select()
        .from(aiAgentSubscriptions)
        .where(eq(aiAgentSubscriptions.status, 'active'));

      for (const subscription of subscriptions) {
        const usageStats = this.getUsageStatsValue(subscription.usageStats);

        const newUsageStats = {
          ...usageStats,
          ...(type === 'daily' && { requests_today: 0 }),
          ...(type === 'monthly' && { requests_month: 0 }),
          last_reset: new Date().toISOString()
        };

        await db.update(aiAgentSubscriptions)
          .set({ usageStats: newUsageStats })
          .where(eq(aiAgentSubscriptions.id, subscription.id));
      }

      console.log(`✅ ${type} usage counters reset for ${subscriptions.length} subscriptions`);

    } catch (error) {
      console.error(`Failed to reset ${type} usage counters:`, error);
      throw error;
    }
  }

  /**
   * 🚨 CHECK USAGE OVERAGES
   */
  async checkUsageOverages(): Promise<any[]> {
    try {
      const subscriptions = await db.select()
        .from(aiAgentSubscriptions)
        .where(eq(aiAgentSubscriptions.status, 'active'));

      const overages = [];

      for (const subscription of subscriptions) {
        const usageStats = this.getUsageStatsValue(subscription.usageStats);

        const productLimits = this.getProductLimits(subscription.productId);

        // Check for overages
        const dailyLimit = productLimits.dailyLimit;
        const monthlyLimit = productLimits.monthlyLimit;
        const dailyOverage = dailyLimit !== undefined && usageStats.requests_today > dailyLimit;
        const monthlyOverage = monthlyLimit !== undefined && usageStats.requests_month > monthlyLimit;

        if (dailyOverage || monthlyOverage) {
          overages.push({
            subscription_id: subscription.id,
            agent_id: subscription.agentId,
            tier: this.getTierName(subscription.productId),
            daily_overage: dailyOverage ? {
              used: usageStats.requests_today,
              limit: dailyLimit!,
              excess: usageStats.requests_today - dailyLimit!
            } : null,
            monthly_overage: monthlyOverage ? {
              used: usageStats.requests_month,
              limit: monthlyLimit!,
              excess: usageStats.requests_month - monthlyLimit!
            } : null
          });
        }
      }

      return overages;

    } catch (error) {
      console.error('Failed to check usage overages:', error);
      return [];
    }
  }

  /**
   * 📈 GET PLATFORM USAGE SUMMARY
   */
  async getPlatformUsageSummary(): Promise<any> {
    try {
      const subscriptions = await db.select()
        .from(aiAgentSubscriptions)
        .where(eq(aiAgentSubscriptions.status, 'active'));

      let totalRequests = 0;
      let totalRevenue = 0;
      const tierStats = { starter: 0, pro: 0, enterprise: 0 };

      for (const subscription of subscriptions) {
        const usageStats = this.getUsageStatsValue(subscription.usageStats);
        totalRequests += usageStats.requests_month;
        totalRevenue += Number(subscription.monthlyRevenue ?? 0);

        const tier = this.getTierName(subscription.productId).toLowerCase();
        if (tier in tierStats) {
          const tierKey = tier as keyof typeof tierStats;
          tierStats[tierKey]++;
        }
      }

      return {
        total_active_subscriptions: subscriptions.length,
        total_requests_this_month: totalRequests,
        total_monthly_revenue: totalRevenue,
        tier_distribution: tierStats,
        avg_requests_per_subscription: subscriptions.length > 0 ? Math.round(totalRequests / subscriptions.length) : 0,
        avg_revenue_per_subscription: subscriptions.length > 0 ? Math.round(totalRevenue / subscriptions.length) : 0,
        generated_at: new Date().toISOString()
      };

    } catch (error) {
      console.error('Failed to get platform usage summary:', error);
      throw error;
    }
  }

  /**
   * 🔧 HELPER METHODS
   */
  private getProductLimits(productId: number): {
    dailyLimit?: number;
    monthlyLimit?: number;
    restrictedEndpoints: string[];
  } {
    const limits: Record<number, {
      dailyLimit?: number;
      monthlyLimit?: number;
      restrictedEndpoints: string[];
    }> = {
      1: { // Starter
        dailyLimit: 1000,
        monthlyLimit: 30000,
        restrictedEndpoints: ['/api/premium/trading/signals', '/api/premium/analytics/advanced']
      },
      2: { // Pro
        dailyLimit: 5000,
        monthlyLimit: 150000,
        restrictedEndpoints: ['/api/premium/analytics/advanced']
      },
      3: { // Enterprise
        dailyLimit: undefined, // unlimited
        monthlyLimit: undefined, // unlimited
        restrictedEndpoints: []
      }
    };

    return limits[productId] || limits[1];
  }

  private getTierName(productId: number): string {
    const tiers: Record<number, string> = {
      1: 'Starter',
      2: 'Pro', 
      3: 'Enterprise'
    };

    return tiers[productId] || 'Unknown';
  }

  private getUsageStatsValue(value: unknown): UsageStats {
    const record = value !== null && typeof value === 'object'
      ? value as Record<string, unknown>
      : {};
    return {
      requests_today: typeof record.requests_today === 'number' ? record.requests_today : 0,
      requests_month: typeof record.requests_month === 'number' ? record.requests_month : 0,
      last_reset: typeof record.last_reset === 'string' ? record.last_reset : new Date().toISOString(),
      last_request: typeof record.last_request === 'string' ? record.last_request : undefined,
      last_endpoint: typeof record.last_endpoint === 'string' ? record.last_endpoint : undefined,
    };
  }
}

// Export singleton instance
export const usageTracking = new UsageTrackingService();