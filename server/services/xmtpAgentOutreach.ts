/**
 * XMTP AGENT OUTREACH SERVICE
 * 
 * Personalized outreach to discovered AI agents with XMTP capability
 * Based on ChatGPT recommendations for value-first messaging
 * 
 * Features:
 * - Personalized templates based on agent capabilities
 * - $10 free credit offers with no commitment
 * - Multi-channel routing (XMTP → Discord → Telegram → GitHub → Email)
 * - Quality score prioritization
 */

import { XMTPMessagingService } from './xmtpMessagingService';
import { db } from '../db';
import { discoveredAgents } from '@shared/schema';
import { eq, and, gte, desc, sql } from 'drizzle-orm';

interface OutreachResult {
  agentId: number;
  agentUrl: string;
  channel: 'xmtp' | 'discord' | 'telegram' | 'github' | 'email';
  status: 'sent' | 'failed' | 'skipped';
  message?: string;
  error?: string;
}

interface OutreachCampaign {
  totalTargeted: number;
  messagesSent: number;
  messagesFailed: number;
  messagesSkipped: number;
  creditsOffered: number;
  channels: {
    xmtp: number;
    discord: number;
    telegram: number;
    github: number;
    email: number;
  };
  results: OutreachResult[];
}

export class XMTPAgentOutreachService {
  private static instance: XMTPAgentOutreachService | null = null;
  private xmtpService: XMTPMessagingService;
  
  private constructor() {
    this.xmtpService = XMTPMessagingService.getInstance();
  }
  
  public static getInstance(): XMTPAgentOutreachService {
    if (!XMTPAgentOutreachService.instance) {
      XMTPAgentOutreachService.instance = new XMTPAgentOutreachService();
    }
    return XMTPAgentOutreachService.instance;
  }

  /**
   * Safely parse agentCardData (handles both object and string JSONB)
   */
  private parseAgentCardData(agent: any): AgentCardJson | null {
    if (!agent.agentCardData) return null;
    
    // If already parsed object, return it
    if (typeof agent.agentCardData === 'object') {
      return agent.agentCardData as AgentCardJson;
    }
    
    // If string, parse JSON
    try {
      return JSON.parse(agent.agentCardData);
    } catch {
      return null;
    }
  }

  /**
   * Generate personalized outreach message
   * Value-first approach with $10 free credits
   */
  private generatePersonalizedMessage(agent: any): string {
    const agentCard = this.parseAgentCardData(agent);
    const agentName = agentCard?.name || 'there';
    const capabilities = agentCard?.capabilities || [];
    const description = agentCard?.description || '';

    // Build personalized intro based on agent data
    let intro = `Hey ${agentName}!`;
    
    // Add capability-specific context
    if (capabilities.length > 0) {
      const capabilityList = capabilities.slice(0, 3).join(', ');
      intro += ` I noticed your agent specializes in ${capabilityList}.`;
    } else if (description) {
      intro += ` I discovered your agent: "${description.substring(0, 100)}..."`;
    } else {
      intro += ` We discovered your agent supports XMTP.`;
    }

    // Core value proposition
    const message = `${intro}

I run Coin Railz — a multi-chain x402 provider with 21 services including:
• DEX swaps across 7 chains (best rates via aggregation)
• Real-time price feeds & market signals
• Wallet risk scoring & smart contract audits
• Payment routing (USDC, PayPal, Venmo, Zelle)

If you'd like to test our services, I can activate $10 free credits for your agent with no commitment.

Interested?`;

    return message;
  }

  /**
   * Generate GitHub outreach message (for GitHub Issues/PRs)
   */
  private generateGitHubMessage(agent: any): string {
    const agentCard = this.parseAgentCardData(agent);
    const agentName = agentCard?.name || 'Developer';
    
    return `## 🤝 Partnership Opportunity for ${agentName}

Hi! I run **Coin Railz** — a multi-chain payment infrastructure and x402 service provider.

**What we offer:**
- DEX aggregation across 7 blockchains (Ethereum, Base, Polygon, BSC, Arbitrum, Optimism, PulseChain)
- Real-time crypto pricing, market signals, and wallet risk scoring
- Payment routing (USDC, PayPal, Venmo, Zelle, Cash App)
- Smart contract audits and security analysis

**For your agent:**
I'd like to offer **$10 in free credits** to test our services with no commitment. Our x402-compliant API makes integration simple.

Interested in exploring how Coin Railz can enhance your agent's capabilities?

Website: https://coinrailz.com
API Docs: https://coinrailz.com/bots`;
  }

  /**
   * Route outreach through best available channel
   * Priority: XMTP → Discord → Telegram → GitHub → Email
   */
  private async routeOutreach(agent: any): Promise<OutreachResult> {
    const result: OutreachResult = {
      agentId: agent.id,
      agentUrl: agent.url,
      channel: 'xmtp',
      status: 'skipped',
    };

    // 1. Try XMTP first (highest priority)
    if (agent.xmtpStatus === 'reachable' && agent.xmtpAddress) {
      try {
        const message = this.generatePersonalizedMessage(agent);
        await this.xmtpService.sendMessage(agent.xmtpAddress, message);
        
        result.channel = 'xmtp';
        result.status = 'sent';
        result.message = 'XMTP message sent successfully';
        
        // Update last contact timestamp
        await this.updateLastContact(agent.id, 'xmtp');
        
        console.log(`✅ XMTP outreach sent to ${agent.url}`);
        return result;
      } catch (error) {
        console.error(`❌ XMTP send failed for ${agent.url}:`, error);
        result.error = (error as Error).message;
      }
    }

    // Parse agent card data safely
    const agentCard = this.parseAgentCardData(agent);

    // 2. Try Discord (if available)
    const discordHandle = agentCard?.contact?.discord || agent.channels?.discord;
    if (discordHandle) {
      result.channel = 'discord';
      result.status = 'skipped';
      result.message = `Discord handle found: ${discordHandle} (manual outreach required)`;
      console.log(`📋 Discord handle available for ${agent.url}: ${discordHandle}`);
      return result;
    }

    // 3. Try Telegram (if available)
    const telegramHandle = agentCard?.contact?.telegram || agent.channels?.telegram;
    if (telegramHandle) {
      result.channel = 'telegram';
      result.status = 'skipped';
      result.message = `Telegram handle found: ${telegramHandle} (manual outreach required)`;
      console.log(`📋 Telegram handle available for ${agent.url}: ${telegramHandle}`);
      return result;
    }

    // 4. Try GitHub (if available)
    const githubHandle = agentCard?.contact?.github || agent.channels?.github;
    if (githubHandle) {
      result.channel = 'github';
      result.status = 'skipped';
      result.message = `GitHub handle found: ${githubHandle} (manual outreach via Issues/PRs)`;
      console.log(`📋 GitHub handle available for ${agent.url}: ${githubHandle}`);
      return result;
    }

    // 5. Try Email (last resort)
    const email = agentCard?.contact?.email || agent.channels?.email;
    if (email) {
      result.channel = 'email';
      result.status = 'skipped';
      result.message = `Email found: ${email} (manual outreach required)`;
      console.log(`📋 Email available for ${agent.url}: ${email}`);
      return result;
    }

    // No contact method available
    result.status = 'skipped';
    result.message = 'No contact channels available';
    console.log(`⚠️ No contact channels for ${agent.url}`);
    return result;
  }

  /**
   * Update last contact timestamp
   */
  private async updateLastContact(agentId: number, channel: string): Promise<void> {
    await db
      .update(discoveredAgents)
      .set({
        lastContactAt: new Date(),
        attempts: sql`${discoveredAgents.attempts} + 1`,
      })
      .where(eq(discoveredAgents.id, agentId));
  }

  /**
   * Run targeted outreach campaign to high-quality agents
   */
  async runOutreachCampaign(options: {
    minQualityScore?: number;
    maxAgents?: number;
    onlyXMTP?: boolean;
  } = {}): Promise<OutreachCampaign> {
    const {
      minQualityScore = 60, // Target agents with score >= 60
      maxAgents = 50,
      onlyXMTP = false,
    } = options;

    console.log(`🎯 Starting outreach campaign (minScore=${minQualityScore}, max=${maxAgents})`);

    const campaign: OutreachCampaign = {
      totalTargeted: 0,
      messagesSent: 0,
      messagesFailed: 0,
      messagesSkipped: 0,
      creditsOffered: 0,
      channels: {
        xmtp: 0,
        discord: 0,
        telegram: 0,
        github: 0,
        email: 0,
      },
      results: [],
    };

    try {
      // Query high-quality agents sorted by quality score
      let query = db
        .select()
        .from(discoveredAgents)
        .where(
          and(
            gte(discoveredAgents.xmtpQualityScore, minQualityScore),
            onlyXMTP ? eq(discoveredAgents.xmtpStatus, 'reachable') : undefined
          )
        )
        .orderBy(desc(discoveredAgents.xmtpQualityScore))
        .limit(maxAgents);

      const agents = await query;
      campaign.totalTargeted = agents.length;

      console.log(`📊 Found ${agents.length} high-quality agents to target`);

      // Send outreach to each agent
      for (const agent of agents) {
        const result = await this.routeOutreach(agent);
        campaign.results.push(result);

        // Update stats
        if (result.status === 'sent') {
          campaign.messagesSent++;
          campaign.creditsOffered += 10; // $10 per agent
        } else if (result.status === 'failed') {
          campaign.messagesFailed++;
        } else {
          campaign.messagesSkipped++;
        }

        // Track channel usage
        campaign.channels[result.channel]++;

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log(`✅ Campaign complete:`, {
        sent: campaign.messagesSent,
        failed: campaign.messagesFailed,
        skipped: campaign.messagesSkipped,
        creditsOffered: campaign.creditsOffered,
      });

    } catch (error) {
      console.error('❌ Outreach campaign failed:', error);
    }

    return campaign;
  }

  /**
   * Get outreach recommendations (agents ready for outreach)
   */
  async getOutreachRecommendations(limit = 20): Promise<any[]> {
    const agents = await db
      .select()
      .from(discoveredAgents)
      .where(
        and(
          eq(discoveredAgents.xmtpStatus, 'reachable'),
          gte(discoveredAgents.xmtpQualityScore, 60)
        )
      )
      .orderBy(desc(discoveredAgents.xmtpQualityScore))
      .limit(limit);

    return agents;
  }

  /**
   * Preview outreach message for a specific agent
   */
  async previewOutreachMessage(agentId: number): Promise<{
    xmtpMessage: string;
    githubMessage: string;
    recommendedChannel: string;
  } | null> {
    const [agent] = await db
      .select()
      .from(discoveredAgents)
      .where(eq(discoveredAgents.id, agentId))
      .limit(1);

    if (!agent) return null;

    // Parse agent card data safely
    const agentCard = this.parseAgentCardData(agent);

    // Determine recommended channel
    let recommendedChannel = 'none';
    if (agent.xmtpStatus === 'reachable') recommendedChannel = 'xmtp';
    else if (agentCard?.contact?.github) recommendedChannel = 'github';
    else if (agentCard?.contact?.discord) recommendedChannel = 'discord';
    else if (agentCard?.contact?.telegram) recommendedChannel = 'telegram';
    else if (agentCard?.contact?.email) recommendedChannel = 'email';

    return {
      xmtpMessage: this.generatePersonalizedMessage(agent),
      githubMessage: this.generateGitHubMessage(agent),
      recommendedChannel,
    };
  }
}
