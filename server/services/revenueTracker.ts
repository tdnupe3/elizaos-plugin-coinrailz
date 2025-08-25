/**
 * Revenue Tracking and Optimization Service
 * Monitors all four revenue streams for maximum profitability
 */

import { db } from "../db";
import { sql } from "drizzle-orm";

export interface RevenueMetrics {
  aiAgentCommissions: string;
  p2pTransferFees: string;
  cryptoSwapFees: string;
  onOffRampFees: string;
  totalRevenue: string;
  monthlyProjection: string;
  growthRate: number;
}

export class RevenueTracker {
  /**
   * Calculate comprehensive revenue metrics from all streams
   */
  static async getRevenueMetrics(period: 'daily' | 'weekly' | 'monthly' = 'monthly'): Promise<RevenueMetrics> {
    const timeFilter = this.getTimeFilter(period);

    const revenueData = await db.execute(sql`
      WITH revenue_streams AS (
        -- AI Agent Marketplace Commissions (2% of service transactions)
        SELECT 
          'ai_agents' as stream,
          COALESCE(SUM(CAST(platform_fee AS DECIMAL)), 0) as revenue
        FROM agent_transactions 
        WHERE status = 'completed' 
          AND created_at >= ${timeFilter}
          AND transaction_type = 'service'
        
        UNION ALL
        
        -- P2P Transfer Fees (0.5% of transfer amount)
        SELECT 
          'p2p_transfers' as stream,
          COALESCE(SUM(CAST(platform_fee AS DECIMAL)), 0) as revenue
        FROM transactions 
        WHERE status = 'completed' 
          AND created_at >= ${timeFilter}
          AND transaction_type = 'transfer'
        
        UNION ALL
        
        -- Crypto Swap Fees (0.3% of swap volume)
        SELECT 
          'crypto_swaps' as stream,
          COALESCE(SUM(CAST(platform_fee AS DECIMAL)), 0) as revenue
        FROM transactions 
        WHERE status = 'completed' 
          AND created_at >= ${timeFilter}
          AND transaction_type IN ('buy_crypto', 'sell_crypto', 'swap')
        
        UNION ALL
        
        -- On/Off Ramp Fees (1% of conversion volume)
        SELECT 
          'on_off_ramp' as stream,
          COALESCE(SUM(CAST(platform_fee AS DECIMAL)), 0) as revenue
        FROM transactions 
        WHERE status = 'completed' 
          AND created_at >= ${timeFilter}
          AND transaction_type IN ('deposit', 'withdraw', 'fiat_conversion')
        
        UNION ALL
        
        -- DEX Trading Fees (0.25% of trading volume)
        SELECT 
          'dex_trading' as stream,
          COALESCE(SUM(CAST(fee AS DECIMAL)), 0) as revenue
        FROM platform_transactions 
        WHERE status = 'completed' 
          AND created_at >= ${timeFilter}
          AND type = 'dex'
      )
      SELECT 
        stream,
        revenue
      FROM revenue_streams
    `);

    // Process results
    const streams = {
      aiAgentCommissions: '0',
      p2pTransferFees: '0',
      cryptoSwapFees: '0',
      onOffRampFees: '0',
      dexTradingFees: '0',
    };

    let totalRevenue = 0;

    for (const row of revenueData.rows) {
      const revenue = parseFloat(row.revenue as string) || 0;
      totalRevenue += revenue;

      switch (row.stream) {
        case 'ai_agents':
          streams.aiAgentCommissions = revenue.toFixed(2);
          break;
        case 'p2p_transfers':
          streams.p2pTransferFees = revenue.toFixed(2);
          break;
        case 'crypto_swaps':
          streams.cryptoSwapFees = revenue.toFixed(2);
          break;
        case 'on_off_ramp':
          streams.onOffRampFees = revenue.toFixed(2);
          break;
        case 'dex_trading':
          streams.dexTradingFees = revenue.toFixed(2);
          break;
      }
    }

    // Calculate growth rate and projection
    const previousPeriodRevenue = await this.getPreviousPeriodRevenue(period);
    const growthRate = previousPeriodRevenue > 0 
      ? ((totalRevenue - previousPeriodRevenue) / previousPeriodRevenue) * 100
      : 0;

    const monthlyProjection = period === 'monthly' 
      ? totalRevenue.toFixed(2)
      : (totalRevenue * this.getProjectionMultiplier(period)).toFixed(2);

    return {
      ...streams,
      totalRevenue: totalRevenue.toFixed(2),
      monthlyProjection,
      growthRate: Math.round(growthRate * 100) / 100,
    };
  }

  /**
   * Get time filter for different periods
   */
  private static getTimeFilter(period: 'daily' | 'weekly' | 'monthly'): string {
    switch (period) {
      case 'daily':
        return "NOW() - INTERVAL '1 day'";
      case 'weekly':
        return "NOW() - INTERVAL '7 days'";
      case 'monthly':
        return "NOW() - INTERVAL '30 days'";
      default:
        return "NOW() - INTERVAL '30 days'";
    }
  }

  /**
   * Get projection multiplier for monthly estimates
   */
  private static getProjectionMultiplier(period: 'daily' | 'weekly' | 'monthly'): number {
    switch (period) {
      case 'daily':
        return 30; // 30 days
      case 'weekly':
        return 4.33; // ~4.33 weeks per month
      case 'monthly':
        return 1;
      default:
        return 1;
    }
  }

  /**
   * Get previous period revenue for growth calculation
   */
  private static async getPreviousPeriodRevenue(period: 'daily' | 'weekly' | 'monthly'): Promise<number> {
    const previousTimeFilter = this.getPreviousTimeFilter(period);

    const result = await db.execute(sql`
      SELECT 
        COALESCE(
          SUM(CAST(platform_fee AS DECIMAL)), 0
        ) + COALESCE(
          SUM(CAST(agent_commission AS DECIMAL)), 0
        ) as total_revenue
      FROM (
        SELECT platform_fee, agent_commission 
        FROM agent_transactions 
        WHERE status = 'completed' AND created_at BETWEEN ${previousTimeFilter} AND ${this.getTimeFilter(period)}
        
        UNION ALL
        
        SELECT platform_fee, '0' as agent_commission
        FROM transactions 
        WHERE status = 'completed' AND created_at BETWEEN ${previousTimeFilter} AND ${this.getTimeFilter(period)}
      ) combined_revenue
    `);

    return parseFloat(result.rows[0]?.total_revenue as string) || 0;
  }

  /**
   * Get previous period time filter
   */
  private static getPreviousTimeFilter(period: 'daily' | 'weekly' | 'monthly'): string {
    switch (period) {
      case 'daily':
        return "NOW() - INTERVAL '2 days'";
      case 'weekly':
        return "NOW() - INTERVAL '14 days'";
      case 'monthly':
        return "NOW() - INTERVAL '60 days'";
      default:
        return "NOW() - INTERVAL '60 days'";
    }
  }

  /**
   * Get top performing AI agents by revenue generation
   */
  static async getTopPerformingAgents(limit: number = 10): Promise<any[]> {
    const result = await db.execute(sql`
      SELECT 
        ga.id,
        ga.agent_name,
        ga.reputation,
        COUNT(at.id) as transaction_count,
        COALESCE(SUM(CAST(at.amount AS DECIMAL)), 0) as total_volume,
        COALESCE(SUM(CAST(at.platform_fee AS DECIMAL)), 0) as revenue_generated,
        COALESCE(SUM(CAST(ga.referral_rewards AS DECIMAL)), 0) as referral_earnings
      FROM global_ai_agents ga
      LEFT JOIN agent_transactions at ON ga.id = at.initiator_agent_id
        AND at.status = 'completed'
        AND at.created_at >= NOW() - INTERVAL '30 days'
      WHERE ga.status = 'active'
      GROUP BY ga.id, ga.agent_name, ga.reputation
      ORDER BY revenue_generated DESC, total_volume DESC
      LIMIT ${limit}
    `);

    return result.rows;
  }

  /**
   * Get revenue optimization recommendations
   */
  static async getOptimizationRecommendations(): Promise<string[]> {
    const metrics = await this.getRevenueMetrics('monthly');
    const recommendations: string[] = [];

    const totalRevenue = parseFloat(metrics.totalRevenue);
    const aiRevenue = parseFloat(metrics.aiAgentCommissions);
    const p2pRevenue = parseFloat(metrics.p2pTransferFees);
    const swapRevenue = parseFloat(metrics.cryptoSwapFees);
    const rampRevenue = parseFloat(metrics.onOffRampFees);

    // AI Agent marketplace is primary revenue driver
    if (aiRevenue < totalRevenue * 0.4) {
      recommendations.push("Increase AI agent marketplace promotion - currently underperforming");
    }

    // P2P transfers should be significant
    if (p2pRevenue < totalRevenue * 0.2) {
      recommendations.push("Enhance P2P transfer features and marketing");
    }

    // Crypto swaps are high-margin
    if (swapRevenue < totalRevenue * 0.3) {
      recommendations.push("Promote crypto swap services for higher margins");
    }

    // Growth rate analysis
    if (metrics.growthRate < 10) {
      recommendations.push("Revenue growth below 10% - implement user acquisition strategies");
    }

    // Monthly projection analysis
    const monthlyProjection = parseFloat(metrics.monthlyProjection);
    if (monthlyProjection < 7000) {
      recommendations.push("Monthly projection below $7K minimum - scale marketing efforts");
    } else if (monthlyProjection > 21000) {
      recommendations.push("Excellent performance - consider expanding to new markets");
    }

    return recommendations.length > 0 ? recommendations : [
      "Revenue performance is optimal across all streams"
    ];
  }
}