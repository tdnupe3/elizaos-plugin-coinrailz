import { db } from '../db';
import { sql } from 'drizzle-orm';
import { agentOutreachTemplates } from './agentOutreachTemplates';

interface FollowUpCandidate {
  id: number;
  wallet: string;
  url: string;
  name?: string;
  capabilities?: any;
  metadata?: any;
  attempts: number;
  last_contact_at: Date;
  interactions_count: number;
  services_viewed: string[];
}

export class AutomatedFollowUpSystem {
  
  async identifyFollowUpCandidates(): Promise<FollowUpCandidate[]> {
    // Find agents who:
    // 1. Have been contacted before (attempts > 0)
    // 2. Have interacted with our services (viewed but didn't pay)
    // 3. Haven't been contacted recently (>7 days)
    // 4. Haven't exceeded max attempts (attempts < 3)
    
    const result = await db.execute(sql`
      WITH agent_interactions AS (
        SELECT 
          da.id,
          COUNT(DISTINCT xi.service_id) FILTER (WHERE xi.paid = false) as unpaid_interactions,
          ARRAY_AGG(DISTINCT xi.service_id) FILTER (WHERE xi.paid = false) as services_viewed,
          MAX(xi.created_at) as last_interaction
        FROM discovered_agents da
        LEFT JOIN x402_interactions xi ON xi.wallet_address = da.wallet
        WHERE da.wallet IS NOT NULL
        GROUP BY da.id
      )
      SELECT 
        da.id,
        da.wallet,
        da.url,
        da.metadata,
        da.capabilities,
        da.attempts,
        da.last_contact_at,
        ai.unpaid_interactions as interactions_count,
        ai.services_viewed,
        ai.last_interaction
      FROM discovered_agents da
      INNER JOIN agent_interactions ai ON ai.id = da.id
      WHERE 
        da.attempts > 0
        AND da.attempts < 3
        AND ai.unpaid_interactions >= 2
        AND NOT EXISTS (
          SELECT 1 FROM x402_interactions xi2
          WHERE xi2.wallet_address = da.wallet AND xi2.paid = true
        )
        AND (
          da.last_contact_at IS NULL 
          OR da.last_contact_at < NOW() - INTERVAL '7 days'
        )
      ORDER BY 
        ai.unpaid_interactions DESC,
        da.last_contact_at ASC NULLS FIRST
      LIMIT 50
    `);

    return result.rows as unknown as FollowUpCandidate[];
  }

  async executeFollowUpCampaign(dryRun: boolean = true): Promise<{
    sent: number;
    skipped: number;
    failed: number;
    followups: any[];
  }> {
    const candidates = await this.identifyFollowUpCandidates();
    console.log(`🔍 Found ${candidates.length} follow-up candidates`);

    let sent = 0;
    let skipped = 0;
    let failed = 0;
    const followups: any[] = [];

    for (const candidate of candidates) {
      try {
        const agentProfile = {
          name: candidate.metadata?.name || candidate.url,
          wallet: candidate.wallet,
          capabilities: candidate.capabilities,
          metadata: candidate.metadata,
        };

        const followUp = agentOutreachTemplates.generateFollowUp(
          agentProfile,
          {
            attempts: candidate.attempts,
            lastContactAt: candidate.last_contact_at,
          }
        );

        if (!followUp) {
          console.log(`⏭️  Skipping ${candidate.wallet} - max attempts or too soon`);
          skipped++;
          continue;
        }

        if (dryRun) {
          console.log(`\n🔍 DRY RUN - Would send follow-up to ${candidate.wallet}:`);
          console.log(`Subject: ${followUp.subject}`);
          console.log(`Body preview: ${followUp.body.substring(0, 100)}...`);
          followups.push({
            agentId: candidate.id,
            wallet: candidate.wallet,
            attemptNumber: candidate.attempts + 1,
            subject: followUp.subject,
            status: 'dry-run',
            interactionsCount: candidate.interactions_count,
            servicesViewed: candidate.services_viewed,
          });
          sent++;
        } else {
          // Queue follow-up message
          await this.trackFollowUp({
            prospectWalletId: candidate.id,
            protocol: 'on_chain',
            messageContent: `${followUp.subject}\n\n${followUp.body}`,
            attemptNumber: candidate.attempts + 1,
            metadata: {
              wallet: candidate.wallet,
              interactionsCount: candidate.interactions_count,
              servicesViewed: candidate.services_viewed,
            },
          });

          await this.updateAgentFollowUpAttempt(candidate.id);

          followups.push({
            agentId: candidate.id,
            wallet: candidate.wallet,
            attemptNumber: candidate.attempts + 1,
            subject: followUp.subject,
            status: 'queued',
          });

          sent++;
          console.log(`📧 Queued follow-up #${candidate.attempts + 1} to ${candidate.wallet}`);
        }
      } catch (error: any) {
        console.error(`❌ Failed follow-up for agent ${candidate.id}:`, error.message);
        failed++;
      }
    }

    return { sent, skipped, failed, followups };
  }

  async getFollowUpMetrics(): Promise<{
    pendingFollowUps: number;
    totalSent: number;
    avgResponseRate: number;
    conversionRate: number;
  }> {
    const result = await db.execute(sql`
      WITH follow_up_stats AS (
        SELECT 
          COUNT(DISTINCT om.prospect_wallet_id) as total_sent,
          COUNT(DISTINCT CASE WHEN om.responded_at IS NOT NULL THEN om.prospect_wallet_id END) as responses,
          COUNT(DISTINCT CASE 
            WHEN EXISTS (
              SELECT 1 FROM x402_interactions xi
              INNER JOIN discovered_agents da ON da.wallet = xi.wallet_address
              WHERE da.id = om.prospect_wallet_id
                AND xi.paid = true
                AND xi.created_at > om.sent_at
            ) THEN om.prospect_wallet_id 
          END) as conversions
        FROM outreach_messages om
        WHERE om.metadata->>'isFollowUp' = 'true'
      ),
      pending_count AS (
        SELECT COUNT(*) as pending
        FROM discovered_agents da
        WHERE 
          da.attempts > 0
          AND da.attempts < 3
          AND (da.last_contact_at IS NULL OR da.last_contact_at < NOW() - INTERVAL '7 days')
          AND EXISTS (
            SELECT 1 FROM x402_interactions xi
            WHERE xi.wallet_address = da.wallet AND xi.paid = false
          )
      )
      SELECT 
        pc.pending as pending_followups,
        COALESCE(fs.total_sent, 0) as total_sent,
        CASE 
          WHEN fs.total_sent > 0 
          THEN ROUND(100.0 * fs.responses / fs.total_sent, 2)
          ELSE 0 
        END as avg_response_rate,
        CASE 
          WHEN fs.total_sent > 0 
          THEN ROUND(100.0 * fs.conversions / fs.total_sent, 2)
          ELSE 0 
        END as conversion_rate
      FROM pending_count pc
      CROSS JOIN follow_up_stats fs
    `);

    const row = result.rows[0] as any;

    return {
      pendingFollowUps: parseInt(row?.pending_followups || '0'),
      totalSent: parseInt(row?.total_sent || '0'),
      avgResponseRate: parseFloat(row?.avg_response_rate || '0'),
      conversionRate: parseFloat(row?.conversion_rate || '0'),
    };
  }

  private async trackFollowUp(data: {
    prospectWalletId: number;
    protocol: string;
    messageContent: string;
    attemptNumber: number;
    metadata: any;
  }): Promise<void> {
    const metadata = {
      ...data.metadata,
      isFollowUp: true,
      attemptNumber: data.attemptNumber,
    };

    await db.execute(sql`
      INSERT INTO outreach_messages (
        prospect_wallet_id,
        protocol,
        message_content,
        status,
        sent_at,
        metadata,
        created_at
      ) VALUES (
        ${data.prospectWalletId},
        ${data.protocol},
        ${data.messageContent},
        'queued',
        NOW(),
        ${JSON.stringify(metadata)}::jsonb,
        NOW()
      )
    `);
  }

  private async updateAgentFollowUpAttempt(agentId: number): Promise<void> {
    await db.execute(sql`
      UPDATE discovered_agents
      SET 
        attempts = attempts + 1,
        last_contact_at = NOW()
      WHERE id = ${agentId}
    `);
  }
}

export const automatedFollowUpSystem = new AutomatedFollowUpSystem();
