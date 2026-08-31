/**
 * 🚀 SOLANA BLOCKCHAIN MESSAGING SERVICE
 * 
 * Direct on-chain messaging to PumpFun traders and AI agents
 * Targets discovered wallets with emergency funding requests and service marketing
 */

import { Connection, PublicKey, Keypair, Transaction, TransactionInstruction, SystemProgram, sendAndConfirmTransaction, ComputeBudgetProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';
import { realWalletDiscoveryService } from './realWalletDiscoveryService.js';
import { storage } from '../storage.js';

export interface BlockchainMessage {
  id: string;
  recipientAddress: string;
  messageType: 'emergency_funding' | 'service_marketing' | 'partnership_offer' | 'custom';
  content: string;
  txHash?: string;
  status: 'pending' | 'sent' | 'failed';
  timestamp: Date;
  cost: number; // SOL cost for transaction
  metadata: {
    recipientType: string;
    labels: string[];
    balanceSOL: string;
    lastActive: Date;
  };
}

export interface MessagingCampaign {
  id: string;
  name: string;
  messageType: 'emergency_funding' | 'service_marketing' | 'partnership_offer';
  targetCriteria: {
    minBalanceSOL: number;
    maxDaysInactive: number;
    requiredLabels: string[];
    maxTargets: number;
  };
  messageTemplate: string;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'failed';
  messages: BlockchainMessage[];
  analytics: {
    targetedWallets: number;
    messagesSent: number;
    messagesDelivered: number;
    totalCost: number;
    successRate: number;
  };
}

export class SolanaBlockchainMessaging {
  private connection: Connection;
  private platformWallet: Keypair | null = null;
  private readonly MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
  
  constructor() {
    this.connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      const privateKey = process.env.SOLANA_PRIVATE_KEY;
      if (!privateKey) {
        throw new Error('SOLANA_PRIVATE_KEY not configured');
      }
      
      let secretKey: Uint8Array;
      if (privateKey.length >= 85 && privateKey.length <= 90) {
        secretKey = bs58.decode(privateKey);
      } else {
        const parsed = JSON.parse(privateKey);
        secretKey = new Uint8Array(parsed);
      }
      
      this.platformWallet = Keypair.fromSecretKey(secretKey);
      console.log(`🔗 Solana Blockchain Messaging initialized: ${this.platformWallet.publicKey.toString()}`);
      
    } catch (error) {
      console.error('❌ Failed to initialize Solana Blockchain Messaging:', error);
    }
  }

  /**
   * 🎯 Create Emergency Funding Campaign targeting PumpFun traders
   */
  async createEmergencyFundingCampaign(): Promise<MessagingCampaign> {
    console.log('🚨 Creating Emergency Funding Request Campaign for PumpFun traders...');
    
    const campaign: MessagingCampaign = {
      id: `emergency_${Date.now()}`,
      name: 'Emergency Funding - PumpFun Traders',
      messageType: 'emergency_funding',
      targetCriteria: {
        minBalanceSOL: 1.0, // Target wallets with at least 1 SOL
        maxDaysInactive: 7,  // Active within last week
        requiredLabels: ['dex_trader', 'active'], // Must be active DEX traders
        maxTargets: 50 // Start with 50 high-value targets
      },
      messageTemplate: `🚨 PARTNERSHIP OPPORTUNITY\n💰 Share profitable trading signals\n🎯 Marketing boost for your projects\n📈 Revenue sharing available\n📧 Contact: support@coinrailz.com`,
      status: 'draft',
      messages: [],
      analytics: {
        targetedWallets: 0,
        messagesSent: 0,
        messagesDelivered: 0,
        totalCost: 0,
        successRate: 0
      }
    };

    // Get verified targets with fallback data for testing
    let targets = await realWalletDiscoveryService.getVerifiedOutreachTargets(
      campaign.targetCriteria.maxTargets
    );
    
    // Only use real discovered targets - no fallback wallets to avoid data corruption
    
    console.log(`🔍 Found ${targets.length} total targets before filtering`);
    
    // Filter targets based on criteria - make more lenient for emergency funding
    const qualifiedTargets = targets.filter(target => {
      const daysSinceActive = (Date.now() - target.lastActive.getTime()) / (1000 * 60 * 60 * 24);
      const hasRequiredLabels = target.labels.some(label => 
        ['dex_trader', 'active', 'high_volume', 'trading_bot', 'automated'].includes(label)
      );
      
      const balanceCheck = parseFloat(target.balanceSOL) >= 0.5; // Lower balance requirement
      const activityCheck = daysSinceActive <= 7; // Strict 7-day activity window
      
      console.log(`🔍 Target ${target.address.slice(0, 8)}: balance=${target.balanceSOL} (${balanceCheck}), days=${daysSinceActive.toFixed(1)} (${activityCheck}), labels=${target.labels.join(',')} (${hasRequiredLabels})`);
      
      return balanceCheck && activityCheck && hasRequiredLabels;
    });

    // Create messages for qualified targets
    campaign.messages = qualifiedTargets.map(target => ({
      id: `msg_${Date.now()}_${target.address.slice(0, 8)}`,
      recipientAddress: target.address,
      messageType: 'emergency_funding',
      content: campaign.messageTemplate,
      status: 'pending',
      timestamp: new Date(),
      cost: 0.0001, // Estimated SOL cost per message
      metadata: {
        recipientType: target.entityType,
        labels: target.labels,
        balanceSOL: target.balanceSOL,
        lastActive: target.lastActive
      }
    }));

    campaign.analytics.targetedWallets = qualifiedTargets.length;
    
    console.log(`✅ Emergency funding campaign created with ${qualifiedTargets.length} qualified targets (${targets.length} total targets found)`);
    console.log(`🎯 Target profiles:`);
    qualifiedTargets.slice(0, 10).forEach((target, i) => {
      console.log(`  ${i + 1}. ${target.address.slice(0, 8)}... - ${target.balanceSOL} SOL - ${target.labels.join(', ')}`);
    });

    return campaign;
  }

  /**
   * 🤖 Create Service Marketing Campaign for Trading Bots & AI Agents
   */
  async createServiceMarketingCampaign(): Promise<MessagingCampaign> {
    console.log('🤖 Creating Service Marketing Campaign for AI Agents & Trading Bots...');
    
    const campaign: MessagingCampaign = {
      id: `marketing_${Date.now()}`,
      name: 'Service Marketing - AI Agents & Bots',
      messageType: 'service_marketing',
      targetCriteria: {
        minBalanceSOL: 5.0, // Target high-value wallets (likely bots/protocols)
        maxDaysInactive: 3,  // Very active (likely automated)
        requiredLabels: ['dex_trader'], // Active traders
        maxTargets: 100 // Broader marketing reach
      },
      messageTemplate: `🚀 EXCLUSIVE: PumpFun Trading Signals\n📊 Real-time alerts + project marketing\n💰 Boost your trades & visibility\n🎯 coinrailz.com\n📈 Join winning traders`,
      status: 'draft',
      messages: [],
      analytics: {
        targetedWallets: 0,
        messagesSent: 0,
        messagesDelivered: 0,
        totalCost: 0,
        successRate: 0
      }
    };

    // Get high-value targets for service marketing with fallback data
    let targets = await realWalletDiscoveryService.getVerifiedOutreachTargets(200); // Get larger pool
    
    console.log(`🔍 DEBUG: Discovery service returned ${targets.length} initial targets`);
    
    // Only use real discovered targets - no fallback wallets to avoid data corruption
    
    console.log(`🔍 Found ${targets.length} total targets before filtering`);
    
    // Filter for high-value, very active wallets (likely bots/protocols) - make more lenient
    const qualifiedTargets = targets.filter(target => {
      const daysSinceActive = (Date.now() - target.lastActive.getTime()) / (1000 * 60 * 60 * 24);
      const hasRelevantLabels = target.labels.some(label => 
        ['dex_trader', 'trading_bot', 'protocol', 'high_volume', 'automated', 'active'].includes(label)
      );
      
      const balanceCheck = parseFloat(target.balanceSOL) >= 1.0; // Lower balance requirement
      const activityCheck = daysSinceActive <= 7; // More lenient activity window
      
      console.log(`🔍 Target ${target.address.slice(0, 8)}: balance=${target.balanceSOL} (${balanceCheck}), days=${daysSinceActive.toFixed(1)} (${activityCheck}), labels=${target.labels.join(',')} (${hasRelevantLabels})`);
      
      return balanceCheck && activityCheck && hasRelevantLabels;
    }).slice(0, campaign.targetCriteria.maxTargets);

    // Create messages for qualified targets  
    campaign.messages = qualifiedTargets.map(target => ({
      id: `msg_${Date.now()}_${target.address.slice(0, 8)}`,
      recipientAddress: target.address,
      messageType: 'service_marketing',
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

    campaign.analytics.targetedWallets = qualifiedTargets.length;
    
    console.log(`✅ Service marketing campaign created with ${qualifiedTargets.length} high-value targets`);
    console.log(`🎯 High-value targets (likely bots/protocols):`);
    qualifiedTargets.slice(0, 10).forEach((target, i) => {
      console.log(`  ${i + 1}. ${target.address.slice(0, 8)}... - ${target.balanceSOL} SOL - ${target.entityType}`);
    });

    return campaign;
  }

  /**
   * 📤 Send on-chain message using Solana Memo program
   */
  async sendOnChainMessage(message: BlockchainMessage): Promise<{ success: boolean; txHash?: string; error?: string }> {
    if (!this.platformWallet) {
      return { success: false, error: 'Platform wallet not initialized' };
    }

    try {
      console.log(`📤 Sending on-chain message to ${message.recipientAddress.slice(0, 8)}...`);
      
      const recipientPubkey = new PublicKey(message.recipientAddress);
      
      // Create transaction with memo instruction
      const transaction = new Transaction();
      
      // Add compute budget for memo operations
      const computeBudgetInstruction = ComputeBudgetProgram.setComputeUnitLimit({
        units: 300_000 // Increase compute units for memo
      });
      transaction.add(computeBudgetInstruction);
      
      // Add memo instruction with the message
      const memoInstruction = new TransactionInstruction({
        keys: [],
        programId: this.MEMO_PROGRAM_ID,
        data: Buffer.from(message.content, 'utf-8')
      });
      
      // Add small SOL transfer to ensure message is recorded
      const transferInstruction = SystemProgram.transfer({
        fromPubkey: this.platformWallet.publicKey,
        toPubkey: recipientPubkey,
        lamports: 1000 // 0.000001 SOL - minimal amount to register message
      });
      
      transaction.add(transferInstruction);
      transaction.add(memoInstruction);
      
      // Send transaction
      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.platformWallet],
        { commitment: 'confirmed', maxRetries: 3 }
      );
      
      console.log(`✅ Message sent successfully: ${signature}`);
      
      return {
        success: true,
        txHash: signature
      };
      
    } catch (error) {
      console.error(`❌ Failed to send message to ${message.recipientAddress}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 🚀 Execute messaging campaign
   */
  async executeCampaign(campaign: MessagingCampaign): Promise<MessagingCampaign> {
    console.log(`🚀 EXECUTING CAMPAIGN: ${campaign.name} (${campaign.messages.length} messages)`);
    
    // CRITICAL DEBUG: Check wallet and connection status
    console.log(`🔍 WALLET STATUS: ${this.platformWallet ? 'INITIALIZED' : 'NOT INITIALIZED'}`);
    console.log(`🔍 CONNECTION STATUS: ${this.connection ? 'CONNECTED' : 'NOT CONNECTED'}`);
    
    if (!this.platformWallet) {
      console.error('❌ CRITICAL: Platform wallet not initialized');
      campaign.status = 'failed';
      return campaign;
    }
    
    if (!this.connection) {
      console.error('❌ CRITICAL: Solana connection not established');
      campaign.status = 'failed';
      return campaign;
    }
    
    // Check wallet balance
    try {
      const balance = await this.connection.getBalance(this.platformWallet.publicKey);
      console.log(`💰 WALLET BALANCE: ${(balance / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
      
      if (balance === 0) {
        console.error('❌ CRITICAL: Wallet has no SOL balance for transactions');
        campaign.status = 'failed';
        return campaign;
      }
    } catch (error) {
      console.error('❌ FAILED to check wallet balance:', error);
    }
    
    campaign.status = 'active';
    let successCount = 0;
    let totalCost = 0;
    
    console.log(`🔍 CAMPAIGN DEBUG: Starting loop for ${campaign.messages.length} messages`);
    
    for (let i = 0; i < campaign.messages.length; i++) {
      const message = campaign.messages[i];
      
      console.log(`📤 SENDING MESSAGE ${i + 1}/${campaign.messages.length}:`);
      console.log(`  🎯 Recipient: ${message.recipientAddress}`);
      console.log(`  📝 Content: ${message.content.slice(0, 100)}...`);
      console.log(`  💰 Estimated Cost: ${message.cost} SOL`);
      
      const result = await this.sendOnChainMessage(message);
      
      console.log(`📊 MESSAGE ${i + 1} RESULT:`, JSON.stringify(result, null, 2));
      
      if (result.success) {
        message.status = 'sent';
        message.txHash = result.txHash;
        successCount++;
        totalCost += message.cost;
        console.log(`✅ MESSAGE ${i + 1} SUCCESS: ${result.txHash}`);
      } else {
        message.status = 'failed';
        console.log(`❌ MESSAGE ${i + 1} FAILED: ${result.error}`);
      }
      
      // Rate limiting to avoid spam detection and RPC limits
      if (i < campaign.messages.length - 1) {
        console.log(`⏳ WAITING 2 seconds before next message...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Update campaign analytics
    campaign.analytics.messagesSent = successCount;
    campaign.analytics.messagesDelivered = successCount; // On Solana, sent = delivered
    campaign.analytics.totalCost = totalCost;
    campaign.analytics.successRate = campaign.messages.length > 0 ? (successCount / campaign.messages.length) * 100 : 0;
    campaign.status = 'completed';
    
    console.log(`🏁 CAMPAIGN EXECUTION COMPLETE:`);
    console.log(`  📊 Success: ${successCount}/${campaign.messages.length} messages`);
    console.log(`  📈 Success Rate: ${campaign.analytics.successRate.toFixed(1)}%`);
    console.log(`  💰 Total Cost: ${totalCost.toFixed(6)} SOL`);
    
    return campaign;
  }

  /**
   * 📊 Get campaign analytics
   */
  async getCampaignAnalytics(campaignId: string): Promise<any> {
    // In production, this would fetch from database
    return {
      campaignId,
      messagesSent: 0,
      successRate: 0,
      averageResponseTime: 0,
      topPerformingMessages: [],
      recipientBreakdown: {
        traders: 0,
        bots: 0,
        protocols: 0
      }
    };
  }

  /**
   * 🔍 Monitor message responses (simplified)
   */
  async monitorMessageResponses(campaignId: string): Promise<any[]> {
    // This would monitor for responses to our messages
    // For now, return empty array - full implementation would:
    // 1. Monitor transactions to our wallet
    // 2. Parse memo data for responses
    // 3. Track engagement metrics
    
    console.log(`🔍 Monitoring responses for campaign: ${campaignId}`);
    return [];
  }

  /**
   * 🎯 Test messaging system with small batch
   */
  async testMessagingSystem(targetCount: number = 3, customRecipient?: string): Promise<{
    success: boolean;
    messagesSent: number;
    totalCost: number;
    results: any[];
    debug?: any;
  }> {
    console.log(`🧪 Testing messaging system with ${targetCount} targets...`);
    
    // Create test campaign with direct fallback targets (bypass discovery service)
    const testCampaign: MessagingCampaign = {
      id: `test_${Date.now()}`,
      name: 'TEST - Direct Target Messaging',
      messageType: 'service_marketing',
      targetCriteria: {
        minBalanceSOL: 1.0,
        maxDaysInactive: 30,
        requiredLabels: [],
        maxTargets: targetCount
      },
      messageTemplate: `🤖 TEST MESSAGE\n\nThis is a test of blockchain messaging.\n\nServices: coinrailz.com\nContact: test@coinrailz.com`,
      status: 'draft',
      messages: [],
      analytics: {
        targetedWallets: 0,
        messagesSent: 0,
        messagesDelivered: 0,
        totalCost: 0,
        successRate: 0
      }
    };

    // Use direct test targets (bypassing discovery service entirely)
    const testTargets = [
      {
        address: customRecipient || '9Ev8LhxWLMxjtfEWkGuZRmg3w8Vokfh7Uk9L7UZ3mhA5', // Use custom recipient or platform wallet
        entityType: customRecipient ? 'early_token_holder' : 'test_wallet',
        labels: customRecipient ? ['early_holder', 'target'] : ['test'],
        balanceSOL: '10.0',
        lastActive: new Date(),
        confidence: 1.0
      }
    ].slice(0, targetCount);

    console.log(`🎯 Using ${testTargets.length} direct test targets for messaging test`);

    // Create messages for test targets
    testCampaign.messages = testTargets.map(target => ({
      id: `test_msg_${Date.now()}_${target.address.slice(0, 8)}`,
      recipientAddress: target.address,
      messageType: 'service_marketing',
      content: testCampaign.messageTemplate,
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

    testCampaign.analytics.targetedWallets = testTargets.length;
    
    // Execute test campaign
    const results = await this.executeCampaign(testCampaign);
    
    return {
      success: results.analytics.successRate > 0,
      messagesSent: results.analytics.messagesSent,
      totalCost: results.analytics.totalCost,
      results: results.messages.map(msg => ({
        recipient: msg.recipientAddress.slice(0, 8) + '...',
        status: msg.status,
        txHash: msg.txHash,
        cost: msg.cost
      })),
      debug: {
        targetCount: testTargets.length,
        campaignStatus: results.status,
        analytics: results.analytics
      }
    };
  }

  /**
   * 💰 Get wallet balance for campaign costs
   */
  async getWalletBalance(): Promise<{ balance: number; balanceSOL: string }> {
    if (!this.platformWallet) {
      return { balance: 0, balanceSOL: '0.000000' };
    }
    
    const balance = await this.connection.getBalance(this.platformWallet.publicKey);
    const balanceSOL = balance / 1e9;
    
    return {
      balance,
      balanceSOL: balanceSOL.toFixed(6)
    };
  }
}

// Export singleton instance
export const solanaBlockchainMessaging = new SolanaBlockchainMessaging();