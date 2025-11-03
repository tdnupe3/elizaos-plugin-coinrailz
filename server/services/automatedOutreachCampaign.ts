import { db } from '../db';
import { sql } from 'drizzle-orm';
import { agentOutreachTemplates } from './agentOutreachTemplates';

interface AgentProfile {
  id: number;
  name?: string;
  url: string;
  wallet?: string;
  capabilities?: any;
  metadata?: any;
  score: number;
  attempts: number;
  last_contact_at?: Date;
  channels?: any;
}

interface CampaignConfig {
  name: string;
  channel: 'xmtp' | 'twitter' | 'discord';
  targetMinScore?: number;
  targetMaxAttempts?: number;
  maxAgentsPerRun?: number;
  dryRun?: boolean;
}

export class AutomatedOutreachCampaign {
  
  async selectTargetAgents(config: CampaignConfig): Promise<AgentProfile[]> {
    const minScore = config.targetMinScore || 10;
    const maxAttempts = config.targetMaxAttempts || 3;
    const maxAgents = config.maxAgentsPerRun || 50;

    const result = await db.execute(sql`
      SELECT 
        id,
        url,
        wallet,
        capabilities,
        metadata,
        score,
        attempts,
        last_contact_at,
        channels
      FROM discovered_agents
      WHERE 
        score >= ${minScore}
        AND attempts < ${maxAttempts}
        AND (
          last_contact_at IS NULL 
          OR last_contact_at < NOW() - INTERVAL '7 days'
        )
        AND status = 'new'
      ORDER BY 
        score DESC,
        last_contact_at ASC NULLS FIRST
      LIMIT ${maxAgents}
    `);

    return result.rows as unknown as AgentProfile[];
  }

  async executeTwitterCampaign(config: CampaignConfig): Promise<{ sent: number; failed: number; messages: any[] }> {
    const agents = await this.selectTargetAgents(config);
    const results: any[] = [];
    let sent = 0;
    let failed = 0;

    for (const agent of agents) {
      try {
        const twitterHandle = this.extractTwitterHandle(agent);
        if (!twitterHandle) {
          console.log(`⏭️  No Twitter handle for agent ${agent.url}`);
          continue;
        }

        const message = agentOutreachTemplates.generateTwitterOutreach(agent);
        
        if (config.dryRun) {
          console.log(`\n🔍 DRY RUN - Would send to @${twitterHandle}:`);
          console.log(message);
          results.push({
            agentId: agent.id,
            wallet: agent.wallet,
            handle: twitterHandle,
            message,
            status: 'dry-run',
          });
          sent++;
        } else {
          // TODO: Integrate with Twitter API to actually send
          // For now, just log and track in database
          await this.trackOutreach({
            campaignId: null,
            prospectWalletId: agent.id,
            protocol: 'twitter',
            messageContent: `@${twitterHandle}\n\n${message}`,
            status: 'queued',
            metadata: { twitterHandle, agentUrl: agent.url },
          });

          await this.updateAgentContactAttempts(agent.id);

          results.push({
            agentId: agent.id,
            wallet: agent.wallet,
            handle: twitterHandle,
            message,
            status: 'queued',
          });
          
          sent++;
          console.log(`📧 Queued Twitter outreach to @${twitterHandle}`);
        }
      } catch (error: any) {
        console.error(`❌ Failed to send to agent ${agent.id}:`, error.message);
        failed++;
      }
    }

    return { sent, failed, messages: results };
  }

  async executeXMTPCampaign(config: CampaignConfig): Promise<{ sent: number; failed: number; messages: any[] }> {
    const agents = await this.selectTargetAgents(config);
    const results: any[] = [];
    let sent = 0;
    let failed = 0;

    for (const agent of agents) {
      try {
        if (!agent.wallet) {
          console.log(`⏭️  No wallet for agent ${agent.url}`);
          continue;
        }

        const message = agentOutreachTemplates.generateXMTPMessage(agent);
        
        if (config.dryRun) {
          console.log(`\n🔍 DRY RUN - Would send XMTP to ${agent.wallet}:`);
          console.log(message);
          results.push({
            agentId: agent.id,
            wallet: agent.wallet,
            message,
            status: 'dry-run',
          });
          sent++;
        } else {
          // TODO: Integrate with XMTP SDK to actually send
          // For now, just track in database
          await this.trackOutreach({
            campaignId: null,
            prospectWalletId: agent.id,
            protocol: 'xmtp',
            messageContent: message,
            status: 'queued',
            metadata: { wallet: agent.wallet, agentUrl: agent.url },
          });

          await this.updateAgentContactAttempts(agent.id);

          results.push({
            agentId: agent.id,
            wallet: agent.wallet,
            message,
            status: 'queued',
          });
          
          sent++;
          console.log(`📧 Queued XMTP outreach to ${agent.wallet}`);
        }
      } catch (error: any) {
        console.error(`❌ Failed to send to agent ${agent.id}:`, error.message);
        failed++;
      }
    }

    return { sent, failed, messages: results };
  }

  async executeDiscordCampaign(config: CampaignConfig): Promise<{ sent: number; failed: number; messages: any[] }> {
    const agents = await this.selectTargetAgents(config);
    const results: any[] = [];
    let sent = 0;
    let failed = 0;

    for (const agent of agents) {
      try {
        const discordId = this.extractDiscordId(agent);
        if (!discordId) {
          console.log(`⏭️  No Discord ID for agent ${agent.url}`);
          continue;
        }

        const message = agentOutreachTemplates.generateDiscordOutreach(agent);
        
        if (config.dryRun) {
          console.log(`\n🔍 DRY RUN - Would send Discord DM to ${discordId}:`);
          console.log(message);
          results.push({
            agentId: agent.id,
            wallet: agent.wallet,
            discordId,
            message,
            status: 'dry-run',
          });
          sent++;
        } else {
          // TODO: Integrate with Discord bot to actually send
          // For now, just track in database
          await this.trackOutreach({
            campaignId: null,
            prospectWalletId: agent.id,
            protocol: 'discord',
            messageContent: message,
            status: 'queued',
            metadata: { discordId, agentUrl: agent.url },
          });

          await this.updateAgentContactAttempts(agent.id);

          results.push({
            agentId: agent.id,
            wallet: agent.wallet,
            discordId,
            message,
            status: 'queued',
          });
          
          sent++;
          console.log(`📧 Queued Discord outreach to ${discordId}`);
        }
      } catch (error: any) {
        console.error(`❌ Failed to send to agent ${agent.id}:`, error.message);
        failed++;
      }
    }

    return { sent, failed, messages: results };
  }

  private extractTwitterHandle(agent: AgentProfile): string | null {
    if (agent.channels?.twitter) return agent.channels.twitter;
    if (agent.metadata?.twitter) return agent.metadata.twitter;
    
    const twitterMatch = agent.url?.match(/twitter\.com\/([^\/\?]+)/);
    if (twitterMatch) return twitterMatch[1];
    
    return null;
  }

  private extractDiscordId(agent: AgentProfile): string | null {
    if (agent.channels?.discord) return agent.channels.discord;
    if (agent.metadata?.discord) return agent.metadata.discord;
    return null;
  }

  private async trackOutreach(data: {
    campaignId: number | null;
    prospectWalletId: number;
    protocol: string;
    messageContent: string;
    status: string;
    metadata: any;
  }): Promise<void> {
    await db.execute(sql`
      INSERT INTO outreach_messages (
        campaign_id,
        prospect_wallet_id,
        protocol,
        message_content,
        status,
        sent_at,
        metadata,
        created_at
      ) VALUES (
        ${data.campaignId},
        ${data.prospectWalletId},
        ${data.protocol},
        ${data.messageContent},
        ${data.status},
        NOW(),
        ${JSON.stringify(data.metadata)}::jsonb,
        NOW()
      )
    `);
  }

  private async updateAgentContactAttempts(agentId: number): Promise<void> {
    await db.execute(sql`
      UPDATE discovered_agents
      SET 
        attempts = attempts + 1,
        last_contact_at = NOW()
      WHERE id = ${agentId}
    `);
  }

  async getCampaignStats(campaignName: string): Promise<any> {
    const result = await db.execute(sql`
      SELECT 
        protocol,
        COUNT(*) as total_sent,
        COUNT(*) FILTER (WHERE status = 'delivered') as delivered,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        COUNT(*) FILTER (WHERE responded_at IS NOT NULL) as responses
      FROM outreach_messages
      WHERE metadata->>'campaignName' = ${campaignName}
      GROUP BY protocol
    `);

    return result.rows;
  }
}

export const automatedOutreachCampaign = new AutomatedOutreachCampaign();
