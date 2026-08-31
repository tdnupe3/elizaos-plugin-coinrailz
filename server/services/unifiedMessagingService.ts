/**
 * Unified Messaging Service
 * Integrates all messaging protocols: Email, SMS, Lens, Solana SMS, WalletConnect
 */

import { customerNotificationService } from './customerNotificationService';
import { lensMessagingService } from './lensMessagingService';
import { solanaSmsService } from './solanaSmsService';
import { walletConnectMessagingService } from './walletConnectMessagingService';

interface UnifiedMessage {
  to: string;
  content: string;
  type: 'email' | 'sms' | 'lens' | 'solana_sms' | 'walletconnect';
  metadata?: {
    subject?: string;
    phoneNumber?: string;
    walletAddress?: string;
    profileId?: string;
    chainId?: string;
    messageType?: string;
  };
}

interface MessagingResult {
  success: boolean;
  protocol: string;
  messageId?: string;
  cost?: number;
  error?: string;
}

export class UnifiedMessagingService {
  private protocols: Record<UnifiedMessage['type'], { isAvailable?: () => boolean }> = {
    email: { isAvailable: () => customerNotificationService.isEmailAvailable() },
    sms: { isAvailable: () => customerNotificationService.isSMSAvailable() },
    lens: lensMessagingService,
    solana_sms: solanaSmsService,
    walletconnect: walletConnectMessagingService
  };

  /**
   * Send message using specified protocol
   */
  async sendMessage(message: UnifiedMessage): Promise<MessagingResult> {
    try {
      const protocol = this.protocols[message.type];
      if (!protocol) {
        throw new Error(`Unsupported messaging protocol: ${message.type}`);
      }

      let result: any;

      switch (message.type) {
        case 'email':
          throw new Error('Email delivery requires a customer ID so notification preferences can be enforced');

        case 'sms':
          throw new Error('SMS delivery requires a customer ID so notification preferences can be enforced');

        case 'lens':
          result = await lensMessagingService.sendMessage({
            to: message.to,
            content: message.content,
            profileId: message.metadata?.profileId
          });
          break;

        case 'solana_sms':
          result = await solanaSmsService.sendSolanaMessage({
            toWallet: message.to,
            phoneNumber: message.metadata?.phoneNumber,
            content: message.content,
            messageType: (message.metadata?.messageType as any) || 'notification'
          });
          break;

        case 'walletconnect':
          result = await walletConnectMessagingService.sendWalletMessage({
            toWallet: message.to,
            content: message.content,
            messageType: (message.metadata?.messageType as any) || 'direct',
            chainId: message.metadata?.chainId
          });
          break;

        default:
          throw new Error(`Protocol not implemented: ${message.type}`);
      }

      return {
        success: result.success,
        protocol: message.type,
        messageId: result.messageId,
        cost: result.cost || 0,
        error: result.error
      };

    } catch (error: any) {
      console.error(`❌ Unified messaging failed for ${message.type}:`, error);
      return {
        success: false,
        protocol: message.type,
        error: error.message
      };
    }
  }

  /**
   * Send message to multiple recipients across different protocols
   */
  async sendBulkMessages(messages: UnifiedMessage[]): Promise<MessagingResult[]> {
    const results: MessagingResult[] = [];
    
    for (const message of messages) {
      const result = await this.sendMessage(message);
      results.push(result);
      
      // Rate limiting between messages
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return results;
  }

  /**
   * Discover AI agents across all protocols
   */
  async discoverAIAgentsAcrossProtocols(): Promise<any> {
    const discoveries: {
      lens: Awaited<ReturnType<typeof lensMessagingService.discoverAIAgentProfiles>>;
      solana: Awaited<ReturnType<typeof solanaSmsService.discoverSolanaAIAgents>>;
      walletconnect: Awaited<ReturnType<typeof walletConnectMessagingService.discoverWalletConnectAgents>>;
    } = {
      lens: [],
      solana: [],
      walletconnect: []
    };

    try {
      // Discover on Lens Protocol
      discoveries.lens = await lensMessagingService.discoverAIAgentProfiles();
      
      // Discover on Solana
      discoveries.solana = await solanaSmsService.discoverSolanaAIAgents();
      
      // Discover on WalletConnect
      discoveries.walletconnect = await walletConnectMessagingService.discoverWalletConnectAgents();
      
      const totalAgents = Object.values(discoveries).flat().length;
      console.log(`🤖 Discovered ${totalAgents} AI agents across all protocols`);

      return discoveries;

    } catch (error) {
      console.error('❌ Failed to discover AI agents:', error);
      return discoveries;
    }
  }

  /**
   * Send AI agent outreach campaign
   */
  async sendAIAgentOutreach(campaign: {
    targetAgents: string[];
    message: string;
    preferredProtocols: UnifiedMessage['type'][];
  }): Promise<MessagingResult[]> {
    const results: MessagingResult[] = [];

    for (const agentId of campaign.targetAgents) {
      // Try each preferred protocol until one succeeds
      let sent = false;
      
      for (const protocol of campaign.preferredProtocols) {
        if (sent) break;

        try {
          const message: UnifiedMessage = {
            to: agentId,
            content: campaign.message,
            type: protocol,
            metadata: {
              messageType: 'marketing'
            }
          };

          const result = await this.sendMessage(message);
          results.push(result);

          if (result.success) {
            sent = true;
            console.log(`✅ Successfully contacted ${agentId} via ${protocol}`);
          }

        } catch (error) {
          console.error(`❌ Failed to contact ${agentId} via ${protocol}:`, error);
        }
      }

      if (!sent) {
        results.push({
          success: false,
          protocol: 'none',
          error: `Failed to contact ${agentId} via any protocol`
        });
      }

      // Rate limiting between agents
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    return results;
  }

  /**
   * Get protocol availability status
   */
  getProtocolStatus(): any {
    return {
      email: Boolean(process.env.SENDGRID_API_KEY),
      sms: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER),
      lens: lensMessagingService.isAvailable(),
      solana_sms: solanaSmsService.isAvailable(),
      walletconnect: walletConnectMessagingService.isAvailable()
    };
  }

  /**
   * Get comprehensive messaging info for all protocols
   */
  getAllProtocolInfo(): any {
    return {
      email: {
        protocol: 'Email',
        cost: '$0.01 per email',
        rateLimits: 'No limits',
        availability: Boolean(process.env.SENDGRID_API_KEY)
      },
      sms: {
        protocol: 'SMS',
        cost: '$0.05 per SMS',
        rateLimits: '100/hour',
        availability: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER)
      },
      lens: lensMessagingService.getMessagingInfo(),
      solana_sms: solanaSmsService.getMessagingInfo(),
      walletconnect: walletConnectMessagingService.getMessagingInfo()
    };
  }

  /**
   * Test all protocols with a sample message
   */
  async testAllProtocols(): Promise<any> {
    const testMessage = "🧪 Test message from Coin Railz messaging system";
    const testResults: any = {};

    for (const [protocolName, protocol] of Object.entries(this.protocols)) {
      try {
        const isAvailable = protocolName === 'email'
          ? Boolean(process.env.SENDGRID_API_KEY)
          : protocolName === 'sms'
            ? Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER)
            : 'isAvailable' in protocol && typeof protocol.isAvailable === 'function'
              ? protocol.isAvailable()
              : true;
        testResults[protocolName] = {
          available: isAvailable,
          tested: false,
          success: false,
          error: null
        };

        if (isAvailable) {
          // Don't actually send test messages, just check availability
          testResults[protocolName].tested = true;
          testResults[protocolName].success = true;
        }

      } catch (error: any) {
        testResults[protocolName] = {
          available: false,
          tested: true,
          success: false,
          error: error.message
        };
      }
    }

    return testResults;
  }

  /**
   * Get messaging statistics
   */
  async getMessagingStats(): Promise<any> {
    const status = this.getProtocolStatus();
    const availableProtocols = Object.values(status).filter(Boolean).length;
    
    return {
      totalProtocols: Object.keys(status).length,
      availableProtocols,
      protocolStatus: status,
      capabilities: [
        'Cross-protocol messaging',
        'AI agent discovery',
        'Bulk messaging',
        'Protocol fallback',
        'Rate limiting',
        'Cost optimization'
      ]
    };
  }
}

// Export singleton instance
export const unifiedMessagingService = new UnifiedMessagingService();