import { db } from '../db';
import { sql } from 'drizzle-orm';

interface AttributionMetrics {
  totalRevenue: number;
  convertedAgents: number;
  averageTimeToConversion: number;
  conversionRate: number;
  revenueByChannel: {
    channel: string;
    revenue: number;
    conversions: number;
  }[];
  topPerformingCampaigns: {
    campaignName: string;
    revenue: number;
    conversions: number;
    sent: number;
    conversionRate: number;
  }[];
}

export class RevenueAttributionService {
  
  async getOverallMetrics(daysBack: number = 30): Promise<AttributionMetrics> {
    const [revenueData, channelData, campaignData] = await Promise.all([
      this.getTotalRevenueMetrics(daysBack),
      this.getRevenueByChannel(daysBack),
      this.getTopCampaigns(daysBack, 10),
    ]);

    return {
      ...revenueData,
      revenueByChannel: channelData,
      topPerformingCampaigns: campaignData,
    };
  }

  private async getTotalRevenueMetrics(daysBack: number): Promise<Omit<AttributionMetrics, 'revenueByChannel' | 'topPerformingCampaigns'>> {
    const result = await db.execute(sql`
      SELECT 
        COALESCE(SUM(xi.amount), 0) as total_revenue,
        COUNT(DISTINCT xi.wallet_address) FILTER (WHERE xi.paid = true) as converted_agents,
        COALESCE(AVG(
          EXTRACT(EPOCH FROM (xi.created_at - om.sent_at)) / 3600
        ) FILTER (WHERE xi.paid = true AND om.sent_at IS NOT NULL), 0) as avg_hours_to_conversion,
        COUNT(DISTINCT om.prospect_wallet_id) as total_contacted,
        CASE 
          WHEN COUNT(DISTINCT om.prospect_wallet_id) > 0 
          THEN ROUND(100.0 * COUNT(DISTINCT xi.wallet_address) FILTER (WHERE xi.paid = true) / COUNT(DISTINCT om.prospect_wallet_id), 2)
          ELSE 0 
        END as conversion_rate
      FROM x402_interactions xi
      FULL OUTER JOIN outreach_messages om 
        ON om.sent_at > NOW() - INTERVAL '${sql.raw(daysBack.toString())} days'
      LEFT JOIN discovered_agents da ON da.id = om.prospect_wallet_id AND da.wallet = xi.wallet_address
      WHERE 
        xi.created_at > NOW() - INTERVAL '${sql.raw(daysBack.toString())} days' 
        OR om.sent_at > NOW() - INTERVAL '${sql.raw(daysBack.toString())} days'
        OR (xi.created_at IS NULL AND om.sent_at IS NULL)
    `);

    const row = result.rows[0] as any;
    
    return {
      totalRevenue: parseFloat(row?.total_revenue || '0'),
      convertedAgents: parseInt(row?.converted_agents || '0'),
      averageTimeToConversion: parseFloat(row?.avg_hours_to_conversion || '0'),
      conversionRate: parseFloat(row?.conversion_rate || '0'),
    };
  }

  private async getRevenueByChannel(daysBack: number): Promise<{ channel: string; revenue: number; conversions: number }[]> {
    const result = await db.execute(sql`
      SELECT 
        COALESCE(om.protocol, 'unknown') as channel,
        COALESCE(SUM(xi.amount) FILTER (WHERE xi.paid = true), 0) as revenue,
        COUNT(DISTINCT xi.wallet_address) FILTER (WHERE xi.paid = true) as conversions
      FROM outreach_messages om
      LEFT JOIN discovered_agents da ON da.id = om.prospect_wallet_id
      LEFT JOIN x402_interactions xi 
        ON xi.wallet_address = da.wallet
        AND xi.paid = true
        AND xi.created_at > om.sent_at
      WHERE om.sent_at > NOW() - INTERVAL '${sql.raw(daysBack.toString())} days'
      GROUP BY om.protocol
      ORDER BY revenue DESC
    `);

    if (result.rows.length === 0) {
      return [];
    }

    return result.rows.map((row: any) => ({
      channel: row.channel,
      revenue: parseFloat(row.revenue || '0'),
      conversions: parseInt(row.conversions || '0'),
    }));
  }

  private async getTopCampaigns(daysBack: number, limit: number): Promise<any[]> {
    const result = await db.execute(sql`
      WITH campaign_stats AS (
        SELECT 
          COALESCE(om.metadata->>'campaignName', 'unknown') as campaign_name,
          COUNT(DISTINCT om.prospect_wallet_id) as sent,
          COUNT(DISTINCT CASE WHEN xi.paid THEN om.prospect_wallet_id END) as conversions,
          COALESCE(SUM(xi.amount) FILTER (WHERE xi.paid), 0) as revenue
        FROM outreach_messages om
        INNER JOIN discovered_agents da ON da.id = om.prospect_wallet_id
        LEFT JOIN x402_interactions xi 
          ON xi.wallet_address = da.wallet
          AND xi.paid = true
          AND xi.created_at > om.sent_at
        WHERE om.sent_at > NOW() - INTERVAL '${daysBack} days'
        GROUP BY campaign_name
      )
      SELECT 
        campaign_name,
        sent,
        conversions,
        revenue,
        CASE 
          WHEN sent > 0 
          THEN ROUND(100.0 * conversions / sent, 2)
          ELSE 0 
        END as conversion_rate
      FROM campaign_stats
      WHERE sent > 0
      ORDER BY revenue DESC, conversions DESC
      LIMIT ${limit}
    `);

    return result.rows.map((row: any) => ({
      campaignName: row.campaign_name,
      sent: parseInt(row.sent),
      conversions: parseInt(row.conversions),
      revenue: parseFloat(row.revenue),
      conversionRate: parseFloat(row.conversion_rate),
    }));
  }

  async getAgentAttributionDetails(walletAddress: string): Promise<any> {
    const result = await db.execute(sql`
      SELECT 
        om.protocol,
        om.sent_at,
        om.message_content,
        om.metadata,
        xi.created_at as first_payment_at,
        xi.amount as first_payment_amount,
        EXTRACT(EPOCH FROM (xi.created_at - om.sent_at)) / 3600 as hours_to_conversion,
        (
          SELECT COALESCE(SUM(amount), 0)
          FROM x402_interactions
          WHERE wallet_address = ${walletAddress}
            AND paid = true
            AND created_at > om.sent_at
        ) as total_attributed_revenue
      FROM outreach_messages om
      INNER JOIN discovered_agents da ON da.id = om.prospect_wallet_id
      LEFT JOIN x402_interactions xi 
        ON xi.wallet_address = da.wallet
        AND xi.paid = true
        AND xi.created_at > om.sent_at
      WHERE da.wallet = ${walletAddress}
      ORDER BY om.sent_at DESC
      LIMIT 1
    `);

    return result.rows[0] || null;
  }

  async getRevenueTimeSeries(daysBack: number = 30): Promise<any[]> {
    const result = await db.execute(sql`
      SELECT 
        DATE(xi.created_at) as date,
        SUM(xi.amount) as revenue,
        COUNT(DISTINCT xi.wallet_address) as unique_payers,
        COUNT(*) as transactions
      FROM x402_interactions xi
      WHERE 
        xi.paid = true
        AND xi.created_at > NOW() - INTERVAL '${daysBack} days'
      GROUP BY DATE(xi.created_at)
      ORDER BY date DESC
    `);

    return result.rows.map((row: any) => ({
      date: row.date,
      revenue: parseFloat(row.revenue),
      uniquePayers: parseInt(row.unique_payers),
      transactions: parseInt(row.transactions),
    }));
  }
}

export const revenueAttributionService = new RevenueAttributionService();
