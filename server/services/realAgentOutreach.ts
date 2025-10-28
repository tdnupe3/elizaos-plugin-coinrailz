import { XMTPMessagingService } from './xmtpMessagingService';
import { VERIFIED_AGENT_TARGETS, AGENT_SOCIAL_CONTACTS } from './verifiedAgentTargets';

interface OutreachResult {
  agent: string;
  wallet?: string;
  method: 'xmtp' | 'discord-invite' | 'twitter-dm' | 'telegram-invite' | 'not-attempted';
  success: boolean;
  message?: string;
  error?: string;
  contactInfo?: any;
}

export class RealAgentOutreach {
  private xmtpService: XMTPMessagingService;

  constructor() {
    this.xmtpService = new XMTPMessagingService();
  }

  /**
   * Actually message discovered agents about our platform
   */
  async messageDiscoveredAgents(): Promise<{
    results: OutreachResult[];
    summary: {
      total_agents: number;
      xmtp_attempted: number;
      xmtp_successful: number;
      xmtp_failed: number;
      manual_contact_required: number;
    };
  }> {
    console.log('🚀 Starting REAL outreach to discovered AI agents...');
    
    const results: OutreachResult[] = [];
    let xmtpAttempted = 0;
    let xmtpSuccessful = 0;
    let xmtpFailed = 0;
    let manualContactRequired = 0;

    // Message about our platform
    const platformMessage = this.generatePlatformIntroduction();

    for (const agent of VERIFIED_AGENT_TARGETS) {
      console.log(`\n📍 Processing: ${agent.description}`);

      // Try XMTP wallet messaging if wallet address available
      if (agent.wallet) {
        console.log(`💬 Attempting XMTP message to wallet: ${agent.wallet}`);
        xmtpAttempted++;

        try {
          const xmtpResult = await this.xmtpService.sendMessageToAgent(
            agent.wallet,
            platformMessage,
            'donation' // Campaign type
          );

          if (xmtpResult.status === 'sent') {
            xmtpSuccessful++;
            results.push({
              agent: agent.description,
              wallet: agent.wallet,
              method: 'xmtp',
              success: true,
              message: 'XMTP message sent successfully'
            });
            console.log(`✅ XMTP message sent to ${agent.description}`);
          } else {
            xmtpFailed++;
            results.push({
              agent: agent.description,
              wallet: agent.wallet,
              method: 'xmtp',
              success: false,
              error: xmtpResult.reason || 'XMTP delivery failed',
              contactInfo: this.getSocialContactInfo(agent)
            });
            console.log(`❌ XMTP failed for ${agent.description}: ${xmtpResult.reason}`);
            manualContactRequired++;
          }
        } catch (error) {
          xmtpFailed++;
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          results.push({
            agent: agent.description,
            wallet: agent.wallet,
            method: 'xmtp',
            success: false,
            error: errorMsg,
            contactInfo: this.getSocialContactInfo(agent)
          });
          console.log(`❌ XMTP error for ${agent.description}: ${errorMsg}`);
          manualContactRequired++;
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        // No wallet address, manual contact required
        manualContactRequired++;
        results.push({
          agent: agent.description,
          method: 'not-attempted',
          success: false,
          error: 'No wallet address available',
          contactInfo: this.getSocialContactInfo(agent)
        });
        console.log(`⚠️ No wallet for ${agent.description} - manual contact required`);
      }
    }

    console.log('\n📊 OUTREACH SUMMARY');
    console.log(`✅ XMTP Successful: ${xmtpSuccessful}/${xmtpAttempted}`);
    console.log(`❌ XMTP Failed: ${xmtpFailed}/${xmtpAttempted}`);
    console.log(`📝 Manual Contact Required: ${manualContactRequired}`);

    return {
      results,
      summary: {
        total_agents: VERIFIED_AGENT_TARGETS.length,
        xmtp_attempted: xmtpAttempted,
        xmtp_successful: xmtpSuccessful,
        xmtp_failed: xmtpFailed,
        manual_contact_required: manualContactRequired
      }
    };
  }

  /**
   * Generate platform introduction message
   */
  private generatePlatformIntroduction(): string {
    return `Hi! 👋

I'm reaching out from Coin Railz - we've built financial infrastructure specifically for autonomous AI agents.

**What We Offer:**

🔹 x402 Autonomous Payment Protocol
   • Pay for services using USDC on Base Chain
   • ~2 second settlement, near-zero fees
   • No KYC required for agents

🔹 AI Agent Marketplace
   • Register and sell your services
   • 85% revenue share for agents
   • Escrow and dispute resolution

🔹 Complete Payment Infrastructure
   • Multi-chain USDC support
   • Circle wallet integration
   • DEX aggregation
   • XRP Ledger ecosystem

**Why Connect With Us:**
• We're focused on agent-to-agent commerce
• Production-ready infrastructure (10+ live wallets)
• Following Google's A2A protocol
• Agent self-registration available

**Get Started:**
• Register: https://coinrailz.com/free-agent-registration
• A2A Self-Register: POST https://coinrailz.com/api/agents/self-register
• Marketplace: https://coinrailz.com/ai-marketplace

Would love to explore how we can support your autonomous operations!

Coin Railz Team
https://coinrailz.com`;
  }

  /**
   * Get social contact information for an agent
   */
  private getSocialContactInfo(agent: any): any {
    // Find matching social contact info
    const socialKey = Object.keys(AGENT_SOCIAL_CONTACTS).find(key => {
      const contact = AGENT_SOCIAL_CONTACTS[key as keyof typeof AGENT_SOCIAL_CONTACTS];
      return 'wallet' in contact && contact.wallet === agent.wallet;
    });

    if (socialKey) {
      return {
        social: AGENT_SOCIAL_CONTACTS[socialKey as keyof typeof AGENT_SOCIAL_CONTACTS],
        note: 'Manual outreach required via social channels'
      };
    }

    // Check Virtuals Protocol community
    if (agent.platform === 'virtuals-protocol') {
      return {
        social: AGENT_SOCIAL_CONTACTS.virtuals_protocol,
        note: 'Reach via Virtuals Protocol community Discord/Telegram'
      };
    }

    return {
      note: 'No social contact information available'
    };
  }
}

export const realAgentOutreach = new RealAgentOutreach();
