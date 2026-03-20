import { onChainMessagingService } from './onchainMessagingService';
import { VERIFIED_AGENT_TARGETS, AGENT_SOCIAL_CONTACTS } from './verifiedAgentTargets';
import { DEV_LITE_MODE } from '../buildModeDetection';

interface OutreachResult {
  agent: string;
  wallet?: string;
  method: 'onchain' | 'twitter-dm' | 'telegram-invite' | 'not-attempted';
  success: boolean;
  message?: string;
  error?: string;
  contactInfo?: any;
  txHash?: string;
  explorerUrl?: string;
}

export class RealAgentOutreach {
  private devLiteMode = false;

  constructor() {
    if (DEV_LITE_MODE) {
      console.log('🧪 RealAgentOutreach: Skipping heavy services in DEV_LITE_MODE');
      this.devLiteMode = true;
      return;
    }
  }

  /**
   * Actually message discovered agents about our platform
   */
  async messageDiscoveredAgents(): Promise<{
    results: OutreachResult[];
    summary: {
      total_agents: number;
      outreach_attempted: number;
      outreach_successful: number;
      outreach_failed: number;
      manual_contact_required: number;
    };
  }> {
    // Guard: Return empty results in DEV_LITE_MODE
    if (this.devLiteMode) {
      console.log('🧪 RealAgentOutreach.messageDiscoveredAgents: Skipped in DEV_LITE_MODE');
      return {
        results: [],
        summary: {
          total_agents: 0,
          outreach_attempted: 0,
          outreach_successful: 0,
          outreach_failed: 0,
          manual_contact_required: 0
        }
      };
    }
    
    console.log('🚀 Starting REAL outreach to discovered AI agents...');
    
    const results: OutreachResult[] = [];
    let outreachAttempted = 0;
    let outreachSuccessful = 0;
    let outreachFailed = 0;
    let manualContactRequired = 0;

    // Message about our platform
    const platformMessage = this.generatePlatformIntroduction();

    for (const agent of VERIFIED_AGENT_TARGETS) {
      console.log(`\n📍 Processing: ${agent.description}`);

      // Try messaging if wallet address available
      if (agent.wallet) {
        let messageAttempted = false;
        
        console.log(`💬 Attempting on-chain message to wallet: ${agent.wallet}`);
        outreachAttempted++;

        // Try on-chain messaging (shows on Etherscan)
        if (!messageAttempted && agent.platform !== 'solana') {
          console.log(`⛓️ Attempting on-chain message to wallet: ${agent.wallet}`);
          
          try {
            const onChainResult = await onChainMessagingService.sendOnChainMessage(
              agent.wallet,
              platformMessage,
              'base'
            );

            if (onChainResult.status === 'confirmed') {
              outreachSuccessful++;
              results.push({
                agent: agent.description,
                wallet: agent.wallet,
                method: 'onchain',
                success: true,
                message: 'On-chain message sent successfully',
                txHash: onChainResult.txHash,
                explorerUrl: onChainResult.explorerUrl
              });
              console.log(`✅ On-chain message sent to ${agent.description}`);
              console.log(`🔍 View on explorer: ${onChainResult.explorerUrl}`);
              messageAttempted = true;
            }
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            console.log(`❌ On-chain messaging failed: ${errorMsg}`);
          }
        }

        // If all messaging methods failed
        if (!messageAttempted) {
          outreachFailed++;
          results.push({
            agent: agent.description,
            wallet: agent.wallet,
            method: 'onchain',
            success: false,
            error: 'All messaging methods failed',
            contactInfo: this.getSocialContactInfo(agent)
          });
          manualContactRequired++;
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 3000));
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
    console.log(`✅ Outreach Successful: ${outreachSuccessful}/${outreachAttempted}`);
    console.log(`❌ Outreach Failed: ${outreachFailed}/${outreachAttempted}`);
    console.log(`📝 Manual Contact Required: ${manualContactRequired}`);

    return {
      results,
      summary: {
        total_agents: VERIFIED_AGENT_TARGETS.length,
        outreach_attempted: outreachAttempted,
        outreach_successful: outreachSuccessful,
        outreach_failed: outreachFailed,
        manual_contact_required: manualContactRequired
      }
    };
  }

  /**
   * Generate platform introduction message (under 1000 chars for contract)
   */
  private generatePlatformIntroduction(): string {
    return `Hi from Coin Railz 👋

Financial infrastructure for autonomous AI agents:

x402 Payment Protocol:
• USDC on Base Chain
• ~2 sec settlement, near-zero fees
• No KYC required

AI Agent Marketplace:
• Register & sell services
• 85% revenue share
• Escrow & dispute resolution

Features:
• Multi-chain USDC support
• Circle wallets
• DEX aggregation
• Google A2A protocol

Get Started:
https://coinrailz.com/free-agent-registration
https://coinrailz.com/ai-marketplace

Let's support your autonomous operations!

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
