import { XMTPMessagingService } from './xmtpMessagingService';
import { onChainMessagingService } from './onchainMessagingService';
import { VERIFIED_AGENT_TARGETS, AGENT_SOCIAL_CONTACTS } from './verifiedAgentTargets';
import { Client, GatewayIntentBits } from 'discord.js';

interface OutreachResult {
  agent: string;
  wallet?: string;
  method: 'xmtp' | 'onchain' | 'discord' | 'twitter-dm' | 'telegram-invite' | 'not-attempted';
  success: boolean;
  message?: string;
  error?: string;
  contactInfo?: any;
  txHash?: string;
  explorerUrl?: string;
}

export class RealAgentOutreach {
  private xmtpService: XMTPMessagingService;
  private discordClient: Client | null = null;
  private discordReady = false;

  constructor() {
    this.xmtpService = new XMTPMessagingService();
    this.initializeDiscord();
  }

  /**
   * Initialize Discord bot
   */
  private async initializeDiscord() {
    try {
      if (!process.env.DISCORD_BOT_TOKEN) {
        console.log('⚠️ Discord bot token not configured');
        return;
      }

      this.discordClient = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.DirectMessages,
        ],
      });

      this.discordClient.once('ready', () => {
        console.log(`✅ Discord bot ready: ${this.discordClient?.user?.tag}`);
        this.discordReady = true;
      });

      await this.discordClient.login(process.env.DISCORD_BOT_TOKEN);
    } catch (error) {
      console.error('❌ Discord bot initialization failed:', error);
      this.discordClient = null;
    }
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

      // Try messaging if wallet address available
      if (agent.wallet) {
        let messageAttempted = false;
        
        // PRIORITY 1: Try XMTP first (free, fast)
        console.log(`💬 Attempting XMTP message to wallet: ${agent.wallet}`);
        xmtpAttempted++;

        try {
          const xmtpResult = await this.xmtpService.sendMessageToAgent(
            agent.wallet,
            platformMessage,
            'donation'
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
            messageAttempted = true;
          }
        } catch (error) {
          console.log(`⚠️ XMTP failed, trying on-chain messaging...`);
        }

        // PRIORITY 2: Try on-chain messaging if XMTP failed (shows on Etherscan)
        if (!messageAttempted && agent.platform !== 'solana') {
          console.log(`⛓️ Attempting on-chain message to wallet: ${agent.wallet}`);
          
          try {
            const onChainResult = await onChainMessagingService.sendOnChainMessage(
              agent.wallet,
              platformMessage,
              'base'
            );

            if (onChainResult.status === 'confirmed') {
              xmtpSuccessful++; // Count as successful outreach
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
          xmtpFailed++;
          results.push({
            agent: agent.description,
            wallet: agent.wallet,
            method: 'xmtp',
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
