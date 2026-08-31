import { db } from '../db';
import { sql } from 'drizzle-orm';
import { offerLinkService } from './offerLinkService';

interface InteractionData {
  serviceId: string;
  walletAddress?: string;
  ipAddress?: string;
  userAgent?: string;
  requestPath: string;
  requestMethod: string;
  responseStatus: number;
  paid: boolean;
  amount?: number;
  interactionType: 'view' | 'attempt' | 'payment' | 'error';
  requestId?: string;
  eventType?: string;
  serviceName?: string;
  x402ClientHeader?: string;
  referer?: string;
  challengePayload?: object;
  latencyMs?: number;
  retryCount?: number;
  paymentReceived?: boolean;
  paymentAmount?: number;
  errorMessage?: string;
  offerTrackingId?: string;
  metadata?: object;
}

export class X402InteractionTracker {
  
  async trackInteraction(data: InteractionData): Promise<void> {
    try {
      await db.execute(sql`
        INSERT INTO x402_interactions (
          service_id,
          wallet_address,
          ip_address,
          user_agent,
          request_path,
          request_method,
          response_status,
          paid,
          amount,
          interaction_type,
          request_id,
          event_type,
          service_name,
          x402_client_header,
          referer,
          challenge_payload,
          latency_ms,
          retry_count,
          payment_received,
          payment_amount,
          error_message,
          offer_tracking_id,
          metadata,
          created_at
        ) VALUES (
          ${data.serviceId},
          ${data.walletAddress || null},
          ${data.ipAddress || null},
          ${data.userAgent || null},
          ${data.requestPath},
          ${data.requestMethod},
          ${data.responseStatus},
          ${data.paid},
          ${data.amount || null},
          ${data.interactionType},
          ${data.requestId || null},
          ${data.eventType || null},
          ${data.serviceName || data.serviceId},
          ${data.x402ClientHeader || null},
          ${data.referer || null},
          ${data.challengePayload ? JSON.stringify(data.challengePayload) : null}::jsonb,
          ${data.latencyMs || null},
          ${data.retryCount || 0},
          ${data.paymentReceived || false},
          ${data.paymentAmount || null},
          ${data.errorMessage || null},
          ${data.offerTrackingId || null},
          ${data.metadata ? JSON.stringify(data.metadata) : null}::jsonb,
          NOW()
        )
      `);
      
      // Record conversion in offer tracking if this is a paid interaction with an offer tracking ID
      if (data.paid && data.offerTrackingId) {
        try {
          await offerLinkService.recordConversion(data.offerTrackingId, data.paymentAmount ?? 0);
          console.log(`💰 Offer conversion recorded: ${data.offerTrackingId} → ${data.paymentAmount || 'no amount'} USDC`);
        } catch (conversionError: any) {
          console.error('⚠️ Failed to record offer conversion:', conversionError.message);
        }
      }
    } catch (error: any) {
      console.error('❌ Failed to track x402 interaction:', error.message);
    }
  }

  async getAgentInteractionHistory(walletAddress: string): Promise<any[]> {
    const result = await db.execute(sql`
      SELECT 
        service_id,
        COUNT(*) as total_interactions,
        SUM(CASE WHEN paid THEN 1 ELSE 0 END) as paid_interactions,
        SUM(CASE WHEN interaction_type = 'view' THEN 1 ELSE 0 END) as views,
        SUM(CASE WHEN interaction_type = 'attempt' THEN 1 ELSE 0 END) as attempts,
        SUM(CASE WHEN interaction_type = 'error' THEN 1 ELSE 0 END) as errors,
        SUM(amount) FILTER (WHERE paid) as total_revenue,
        MAX(created_at) as last_interaction,
        MIN(created_at) as first_interaction
      FROM x402_interactions
      WHERE wallet_address = ${walletAddress}
      GROUP BY service_id
      ORDER BY total_interactions DESC
    `);
    
    return result.rows as any[];
  }

  async getServiceAnalytics(serviceId: string, days: number = 30): Promise<any> {
    const intervalDays = `${Math.max(1, Math.min(365, days))} days`;
    const result = await db.execute(sql`
      SELECT 
        COUNT(*) as total_interactions,
        COUNT(DISTINCT wallet_address) FILTER (WHERE wallet_address IS NOT NULL) as unique_wallets,
        COUNT(*) FILTER (WHERE paid) as conversions,
        COUNT(*) FILTER (WHERE interaction_type = 'view') as views,
        COUNT(*) FILTER (WHERE interaction_type = 'attempt') as payment_attempts,
        SUM(amount) FILTER (WHERE paid) as total_revenue,
        ROUND(
          100.0 * COUNT(*) FILTER (WHERE paid) / NULLIF(COUNT(*), 0),
          2
        ) as conversion_rate
      FROM x402_interactions
      WHERE 
        service_id = ${serviceId}
        AND created_at > NOW() - CAST(${intervalDays} AS INTERVAL)
    `);
    
    return result.rows[0] || {};
  }

  async getHotLeads(minInteractions: number = 3, excludePaidAgents: boolean = true): Promise<any[]> {
    const excludePaid = excludePaidAgents ? sql`AND NOT EXISTS (
      SELECT 1 FROM x402_interactions i2 
      WHERE i2.wallet_address = i.wallet_address AND i2.paid = true
    )` : sql``;

    const result = await db.execute(sql`
      SELECT 
        wallet_address,
        COUNT(*) as total_interactions,
        COUNT(DISTINCT service_id) as services_viewed,
        MAX(created_at) as last_seen,
        ARRAY_AGG(DISTINCT service_id) as interested_services,
        COUNT(*) FILTER (WHERE interaction_type = 'attempt') as payment_attempts
      FROM x402_interactions i
      WHERE 
        wallet_address IS NOT NULL
        ${excludePaid}
      GROUP BY wallet_address
      HAVING COUNT(*) >= ${minInteractions}
      ORDER BY 
        COUNT(*) DESC,
        MAX(created_at) DESC
      LIMIT 100
    `);
    
    return result.rows as any[];
  }

  async getOutreachAttribution(walletAddress: string): Promise<any | null> {
    const result = await db.execute(sql`
      SELECT 
        oc.campaign_name,
        oc.channel,
        oc.sent_at,
        MIN(xi.created_at) as first_interaction_after_outreach,
        COUNT(xi.id) as total_interactions,
        SUM(xi.amount) FILTER (WHERE xi.paid) as revenue_generated
      FROM outreach_campaigns oc
      LEFT JOIN x402_interactions xi 
        ON xi.wallet_address = oc.target_wallet 
        AND xi.created_at > oc.sent_at
      WHERE oc.target_wallet = ${walletAddress}
      GROUP BY oc.campaign_name, oc.channel, oc.sent_at
      ORDER BY oc.sent_at DESC
      LIMIT 1
    `);
    
    return result.rows[0] || null;
  }
}

export const x402InteractionTracker = new X402InteractionTracker();
