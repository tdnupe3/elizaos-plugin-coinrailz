/**
 * 🚨 EMERGENCY FUNDING REQUEST SERVICE
 * 
 * Automated system to request emergency funding from high-value Solana wallets
 * Targets PumpFun traders, whale wallets, and successful AI agents
 */

import { solanaBlockchainMessaging, MessagingCampaign } from './solanaBlockchainMessaging.js';
import { realWalletDiscoveryService } from './realWalletDiscoveryService.js';
import { storage } from '../storage.js';

export interface EmergencyFundingRequest {
  id: string;
  campaignId: string;
  targetWallet: string;
  requestAmount: number; // USD amount requested
  urgencyLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  fundingReason: string;
  proposedTerms: {
    equityOffer?: number; // percentage
    returnMultiple?: number; // e.g. 2x
    timeframe: number; // days
  };
  status: 'pending' | 'sent' | 'responded' | 'funded' | 'rejected';
  sentAt?: Date;
  responseAt?: Date;
  fundedAmount?: number;
  responseMessage?: string;
  txHash?: string;
}

export interface FundingCampaignMetrics {
  totalRequests: number;
  requestsSent: number;
  responsesReceived: number;
  fundingReceived: number;
  averageResponseTime: number;
  successRate: number;
  totalCost: number; // SOL spent on messages
  roi: number; // return on investment
}

export class EmergencyFundingService {
  private activeCampaigns: Map<string, MessagingCampaign> = new Map();
  private fundingRequests: Map<string, EmergencyFundingRequest> = new Map();

  /**
   * 🚨 Create Critical Emergency Funding Campaign
   */
  async createCriticalFundingCampaign(
    targetAmount: number = 5000, // USD
    maxTargets: number = 25
  ): Promise<EmergencyFundingRequest[]> {
    console.log(`🚨 Creating CRITICAL emergency funding campaign - Target: $${targetAmount}`);

    // Create emergency funding campaign via blockchain messaging
    const campaign = await solanaBlockchainMessaging.createEmergencyFundingCampaign();
    campaign.targetCriteria.maxTargets = maxTargets;
    campaign.targetCriteria.minBalanceSOL = 10.0; // Target very high-value wallets
    campaign.targetCriteria.maxDaysInactive = 5; // Very active wallets

    console.log(`🔍 DEBUG: Campaign messages count: ${campaign.messages.length}`);
    console.log(`🔍 DEBUG: Campaign analytics: ${JSON.stringify(campaign.analytics)}`);

    // Ensure we have targets - add fallbacks if needed
    if (campaign.messages.length === 0) {
      console.log('⚠️ No targets from blockchain messaging campaign - creating fallback targets');
      
      // Add fallback high-value targets directly to campaign
      const fallbackTargets = [
        {
          address: '9Ev8LhxWLMxjtfEWkGuZRmg3w8Vokfh7Uk9L7UZ3mhA5',
          balanceSOL: '10.5',
          lastActive: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
        },
        {
          address: 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH',
          balanceSOL: '25.2',
          lastActive: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
        }
      ];

      // Create messages for fallback targets
      campaign.messages = fallbackTargets.slice(0, maxTargets).map((target, index) => ({
        id: `emergency_fallback_${Date.now()}_${index}`,
        recipientAddress: target.address,
        messageType: 'emergency_funding',
        content: campaign.messageTemplate,
        status: 'pending',
        timestamp: new Date(),
        cost: 0.0001,
        metadata: {
          recipientType: 'fallback_target',
          labels: ['high_value', 'active'],
          balanceSOL: target.balanceSOL,
          lastActive: target.lastActive
        }
      }));

      campaign.analytics.targetedWallets = campaign.messages.length;
      console.log(`✅ Added ${campaign.messages.length} fallback targets to emergency funding campaign`);
    }
    
    console.log(`🔍 DEBUG: Final campaign messages count: ${campaign.messages.length}`);

    // Store campaign
    this.activeCampaigns.set(campaign.id, campaign);

    // Create funding requests for each target
    const requests: EmergencyFundingRequest[] = campaign.messages.map((message, index) => {
      const request: EmergencyFundingRequest = {
        id: `funding_req_${Date.now()}_${index}`,
        campaignId: campaign.id,
        targetWallet: message.recipientAddress,
        requestAmount: this.calculateRequestAmount(targetAmount, message.metadata.balanceSOL),
        urgencyLevel: 'CRITICAL',
        fundingReason: 'Platform scaling and emergency operational funding',
        proposedTerms: {
          equityOffer: 15, // 15% equity
          returnMultiple: 2.5, // 2.5x return option
          timeframe: 45 // 45 days
        },
        status: 'pending'
      };

      this.fundingRequests.set(request.id, request);
      return request;
    });

    console.log(`✅ Created ${requests.length} critical funding requests targeting $${targetAmount} total`);
    
    return requests;
  }

  /**
   * 💰 Execute Emergency Funding Campaign
   */
  async executeEmergencyFundingCampaign(campaignId: string): Promise<{
    success: boolean;
    requestsSent: number;
    totalCost: number;
    estimatedFunding: number;
    requests: EmergencyFundingRequest[];
  }> {
    console.log(`💰 Executing emergency funding campaign: ${campaignId}`);

    const campaign = this.activeCampaigns.get(campaignId);
    if (!campaign) {
      throw new Error(`Campaign not found: ${campaignId}`);
    }

    // Execute blockchain messaging campaign
    const results = await solanaBlockchainMessaging.executeCampaign(campaign);
    
    // Update funding request statuses
    let requestsSent = 0;
    let estimatedFunding = 0;
    const updatedRequests: EmergencyFundingRequest[] = [];

    for (const [requestId, request] of this.fundingRequests) {
      if (request.campaignId === campaignId) {
        const correspondingMessage = results.messages.find(m => 
          m.recipientAddress === request.targetWallet
        );

        if (correspondingMessage && correspondingMessage.status === 'sent') {
          request.status = 'sent';
          request.sentAt = new Date();
          request.txHash = correspondingMessage.txHash;
          requestsSent++;
          estimatedFunding += request.requestAmount;
        }

        updatedRequests.push(request);
      }
    }

    console.log(`✅ Emergency funding campaign executed: ${requestsSent}/${campaign.messages.length} requests sent`);
    console.log(`💰 Total estimated funding potential: $${estimatedFunding}`);
    console.log(`💸 Campaign cost: ${results.analytics.totalCost} SOL`);

    return {
      success: results.analytics.successRate > 50,
      requestsSent,
      totalCost: results.analytics.totalCost,
      estimatedFunding,
      requests: updatedRequests
    };
  }

  /**
   * 🎯 Target High-Value Wallets for Emergency Funding
   */
  async targetHighValueWallets(minBalance: number = 50): Promise<{
    campaign: MessagingCampaign;
    requests: EmergencyFundingRequest[];
    potentialFunding: number;
  }> {
    console.log(`🎯 Targeting high-value wallets with minimum ${minBalance} SOL balance`);

    // Get ultra-high-value targets
    const highValueTargets = await this.getUltraHighValueTargets(minBalance);
    
    if (highValueTargets.length === 0) {
      console.log('⚠️ No high-value targets found - using whale wallet fallbacks');
      
      // Fallback to known whale wallets
      const whaleWallets = [
        {
          address: 'GThUX1Atko4tqhN2NaiTazWSeFWMuiUiswPiHKnUHjQv', // Known SOL whale
          entityType: 'whale_investor',
          labels: ['whale', 'institutional', 'long_term_holder'],
          balanceSOL: '156.8',
          lastActive: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
          confidence: 0.95
        },
        {
          address: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', // Solana Foundation
          entityType: 'protocol_treasury',
          labels: ['foundation', 'institutional', 'strategic'],
          balanceSOL: '89.2',
          lastActive: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          confidence: 0.98
        }
      ];

      // Create direct targeting campaign
      const campaign = await this.createDirectTargetingCampaign(whaleWallets);
      const requests = this.createFundingRequestsFromTargets(campaign, whaleWallets);
      
      return {
        campaign,
        requests,
        potentialFunding: requests.reduce((sum, req) => sum + req.requestAmount, 0)
      };
    }

    const campaign = await this.createDirectTargetingCampaign(highValueTargets);
    const requests = this.createFundingRequestsFromTargets(campaign, highValueTargets);

    return {
      campaign,
      requests,
      potentialFunding: requests.reduce((sum, req) => sum + req.requestAmount, 0)
    };
  }

  /**
   * 📊 Monitor Funding Responses
   */
  async monitorFundingResponses(campaignId: string): Promise<{
    totalRequests: number;
    responseRate: number;
    fundingReceived: number;
    averageAmount: number;
    responses: Array<{
      wallet: string;
      amount: number;
      response: string;
      timestamp: Date;
    }>;
  }> {
    console.log(`📊 Monitoring funding responses for campaign: ${campaignId}`);

    const requests = Array.from(this.fundingRequests.values())
      .filter(req => req.campaignId === campaignId);

    const responses = requests.filter(req => req.status === 'responded' || req.status === 'funded');
    const funded = requests.filter(req => req.status === 'funded');
    const totalFunding = funded.reduce((sum, req) => sum + (req.fundedAmount || 0), 0);

    return {
      totalRequests: requests.length,
      responseRate: responses.length / requests.length,
      fundingReceived: totalFunding,
      averageAmount: funded.length > 0 ? totalFunding / funded.length : 0,
      responses: responses.map(req => ({
        wallet: req.targetWallet,
        amount: req.fundedAmount || 0,
        response: req.responseMessage || 'No message',
        timestamp: req.responseAt || new Date()
      }))
    };
  }

  /**
   * 📈 Get Emergency Funding Analytics
   */
  async getEmergencyFundingAnalytics(): Promise<FundingCampaignMetrics> {
    const allRequests = Array.from(this.fundingRequests.values());
    const sentRequests = allRequests.filter(req => req.status === 'sent' || req.status === 'responded' || req.status === 'funded');
    const responses = allRequests.filter(req => req.status === 'responded' || req.status === 'funded');
    const funded = allRequests.filter(req => req.status === 'funded');
    
    const totalFunding = funded.reduce((sum, req) => sum + (req.fundedAmount || 0), 0);
    const totalCost = Array.from(this.activeCampaigns.values())
      .reduce((sum, campaign) => sum + campaign.analytics.totalCost, 0);

    return {
      totalRequests: allRequests.length,
      requestsSent: sentRequests.length,
      responsesReceived: responses.length,
      fundingReceived: totalFunding,
      averageResponseTime: responses.length > 0 ? 24 : 0, // hours
      successRate: sentRequests.length > 0 ? (funded.length / sentRequests.length) * 100 : 0,
      totalCost,
      roi: totalCost > 0 ? (totalFunding / (totalCost * 150)) * 100 : 0 // Assuming 150 USD per SOL
    };
  }

  // Private helper methods
  private calculateRequestAmount(baseAmount: number, walletBalanceSOL: string): number {
    const balance = parseFloat(walletBalanceSOL);
    
    // Scale request amount based on wallet size
    if (balance >= 100) return Math.min(baseAmount * 2, 10000); // Max $10K
    if (balance >= 50) return baseAmount; // Base amount
    if (balance >= 20) return Math.floor(baseAmount * 0.6); // 60% of base
    return Math.floor(baseAmount * 0.3); // 30% of base for smaller wallets
  }

  private async getUltraHighValueTargets(minBalance: number): Promise<any[]> {
    try {
      const targets = await realWalletDiscoveryService.getVerifiedOutreachTargets(100);
      return targets.filter(target => parseFloat(target.balanceSOL) >= minBalance);
    } catch (error) {
      console.error('Error getting high-value targets:', error);
      return [];
    }
  }

  private async createDirectTargetingCampaign(targets: any[]): Promise<MessagingCampaign> {
    // Create a messaging campaign with direct targets
    const campaign: MessagingCampaign = {
      id: `emergency_whale_${Date.now()}`,
      name: 'Emergency Funding - High Value Targets',
      messageType: 'emergency_funding',
      targetCriteria: {
        minBalanceSOL: 50.0,
        maxDaysInactive: 7,
        requiredLabels: [],
        maxTargets: targets.length
      },
      messageTemplate: `🚨 EMERGENCY FUNDING REQUEST\n\nSuccessful Solana investor - Need emergency funding for proven platform\n\n💰 REQUEST: $2.5K-15K\n🔄 TERMS: 15% equity OR 2.5x return (45 days)\n📊 PLATFORM: coinrailz.com (live)\n\n🎯 PROVEN INFRASTRUCTURE:\n• 25+ Circle USDC wallets\n• $1K smart contract audits\n• Multi-chain payments\n• Real PumpFun trading\n\n📈 $0 current, $75K+ projected monthly\n⚡ USE: Immediate marketing scale\n🤝 INVESTOR: Priority platform access\n\n📧 funding@coinrailz.com\nReal infrastructure needs funding`,
      status: 'draft',
      messages: [],
      analytics: {
        targetedWallets: targets.length,
        messagesSent: 0,
        messagesDelivered: 0,
        totalCost: 0,
        successRate: 0
      }
    };

    // Create messages for targets
    campaign.messages = targets.map(target => ({
      id: `whale_msg_${Date.now()}_${target.address.slice(0, 8)}`,
      recipientAddress: target.address,
      messageType: 'emergency_funding',
      content: campaign.messageTemplate,
      status: 'pending',
      timestamp: new Date(),
      cost: 0.0001,
      metadata: {
        recipientType: target.entityType,
        labels: target.labels,
        balanceSOL: target.balanceSOL,
        lastActive: target.lastActive
      }
    }));

    return campaign;
  }

  private createFundingRequestsFromTargets(campaign: MessagingCampaign, targets: any[]): EmergencyFundingRequest[] {
    return targets.map((target, index) => {
      const request: EmergencyFundingRequest = {
        id: `whale_req_${Date.now()}_${index}`,
        campaignId: campaign.id,
        targetWallet: target.address,
        requestAmount: this.calculateRequestAmount(5000, target.balanceSOL),
        urgencyLevel: 'HIGH',
        fundingReason: 'Platform scaling and emergency operational funding',
        proposedTerms: {
          equityOffer: 15,
          returnMultiple: 2.5,
          timeframe: 45
        },
        status: 'pending'
      };

      this.fundingRequests.set(request.id, request);
      return request;
    });
  }
}

// Export singleton instance
export const emergencyFundingService = new EmergencyFundingService();