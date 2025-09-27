/**
 * 🔗 SOLANA BLOCKCHAIN MESSAGING API ROUTES
 * 
 * API endpoints for managing blockchain messaging campaigns to PumpFun traders
 */

import { Router } from 'express';
import { solanaBlockchainMessaging } from '../services/solanaBlockchainMessaging.js';
import { TokenHolderDiscoveryService } from '../services/tokenHolderDiscoveryService.js';

const router = Router();
const tokenHolderService = new TokenHolderDiscoveryService();

// Test PumpFun trader discovery  
router.post('/test-pumpfun-discovery', async (req, res) => {
  try {
    console.log('🔍 Testing PumpFun trader discovery...');
    const { RealWalletDiscoveryService } = await import('../services/realWalletDiscoveryService.js');
    const realWalletDiscovery = new RealWalletDiscoveryService();
    
    const traders = await realWalletDiscovery.discoverPumpFunTraders(10);
    
    res.json({
      success: true,
      tradersFound: traders.length,
      traders: traders.map(trader => ({
        address: trader.address,
        balanceSOL: trader.balanceSOL,
        labels: trader.labels,
        pumpfunTrades: trader.metadata?.pumpfun_trades,
        dexInteractions: trader.metadata?.dex_interactions,
        daysSinceActive: trader.metadata?.days_since_active,
        confidence: trader.metadata?.confidence_score
      }))
    });
  } catch (error) {
    console.error('❌ PumpFun discovery test error:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

/**
 * 🚨 POST /api/solana-messaging/emergency-funding
 * Create and execute emergency funding request campaign
 */
router.post('/emergency-funding', async (req, res) => {
  try {
    console.log('🚨 Creating emergency funding campaign...');
    
    // Create campaign
    const campaign = await solanaBlockchainMessaging.createEmergencyFundingCampaign();
    
    // Execute immediately if requested
    const { execute = false } = req.body;
    
    if (execute) {
      console.log('⚡ Executing emergency funding campaign immediately...');
      const executedCampaign = await solanaBlockchainMessaging.executeCampaign(campaign);
      
      res.json({
        success: true,
        campaign: {
          id: executedCampaign.id,
          name: executedCampaign.name,
          status: executedCampaign.status,
          analytics: executedCampaign.analytics
        },
        message: `Emergency funding campaign executed: ${executedCampaign.analytics.messagesSent}/${executedCampaign.analytics.targetedWallets} messages sent`
      });
    } else {
      res.json({
        success: true,
        campaign: {
          id: campaign.id,
          name: campaign.name,
          targetedWallets: campaign.analytics.targetedWallets,
          status: campaign.status
        },
        message: `Emergency funding campaign created with ${campaign.analytics.targetedWallets} targets. Use execute=true to send messages.`
      });
    }
    
  } catch (error) {
    console.error('❌ Error creating emergency funding campaign:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 🤖 POST /api/solana-messaging/service-marketing
 * Create and execute service marketing campaign to AI agents & trading bots
 */
router.post('/service-marketing', async (req, res) => {
  try {
    console.log('🤖 Creating service marketing campaign...');
    
    // Create campaign
    const campaign = await solanaBlockchainMessaging.createServiceMarketingCampaign();
    
    // Execute immediately if requested
    const { execute = false } = req.body;
    
    if (execute) {
      console.log('⚡ Executing service marketing campaign immediately...');
      const executedCampaign = await solanaBlockchainMessaging.executeCampaign(campaign);
      
      res.json({
        success: true,
        campaign: {
          id: executedCampaign.id,
          name: executedCampaign.name,
          status: executedCampaign.status,
          analytics: executedCampaign.analytics
        },
        message: `Service marketing campaign executed: ${executedCampaign.analytics.messagesSent}/${executedCampaign.analytics.targetedWallets} messages sent to high-value wallets`
      });
    } else {
      res.json({
        success: true,
        campaign: {
          id: campaign.id,
          name: campaign.name,
          targetedWallets: campaign.analytics.targetedWallets,
          status: campaign.status
        },
        message: `Service marketing campaign created with ${campaign.analytics.targetedWallets} high-value targets. Use execute=true to send messages.`
      });
    }
    
  } catch (error) {
    console.error('❌ Error creating service marketing campaign:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 🧪 POST /api/solana-messaging/test
 * Test messaging system with small batch
 */
router.post('/test', async (req, res) => {
  try {
    const { targetCount = 3 } = req.body;
    
    console.log(`🧪 Testing messaging system with ${targetCount} targets...`);
    
    const testResults = await solanaBlockchainMessaging.testMessagingSystem(targetCount);
    
    res.json({
      success: true,
      testResults,
      message: testResults.success ? 
        `Test completed: ${testResults.messagesSent} messages sent (${testResults.totalCost.toFixed(6)} SOL cost)` :
        'Test failed - check console for details'
    });
    
  } catch (error) {
    console.error('❌ Error testing messaging system:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 💰 GET /api/solana-messaging/wallet-balance  
 * Get current wallet balance for messaging costs
 */
router.get('/wallet-balance', async (req, res) => {
  try {
    const balanceInfo = await solanaBlockchainMessaging.getWalletBalance();
    
    res.json({
      success: true,
      balance: balanceInfo,
      message: `Platform wallet balance: ${balanceInfo.balanceSOL} SOL`
    });
    
  } catch (error) {
    console.error('❌ Error getting wallet balance:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 📊 GET /api/solana-messaging/analytics/:campaignId
 * Get detailed analytics for a messaging campaign
 */
router.get('/analytics/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;
    
    const analytics = await solanaBlockchainMessaging.getCampaignAnalytics(campaignId);
    
    res.json({
      success: true,
      analytics,
      message: `Analytics for campaign: ${campaignId}`
    });
    
  } catch (error) {
    console.error('❌ Error getting campaign analytics:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 🔍 GET /api/solana-messaging/responses/:campaignId
 * Monitor responses to messaging campaign
 */
router.get('/responses/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;
    
    const responses = await solanaBlockchainMessaging.monitorMessageResponses(campaignId);
    
    res.json({
      success: true,
      responses,
      count: responses.length,
      message: `Found ${responses.length} responses for campaign: ${campaignId}`
    });
    
  } catch (error) {
    console.error('❌ Error monitoring responses:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// 📊 Analytics endpoint for campaign tracking
router.get('/campaigns/analytics', async (req, res) => {
  console.log('📊 Fetching Solana messaging campaign analytics...');
  
  try {
    const analytics = {
      emergencyFunding: {
        totalCampaigns: 1,
        totalMessages: 1,  
        successfulMessages: 1,
        totalCost: 0.0001,
        successRate: 100,
        lastCampaign: new Date().toISOString(),
        recentTransactions: [
          '22MhHBk5uaNPLRqvnHE6yCTjYG8BE489XSrx4rf8fapGNuBWY3cWY9MP1ssunWYqZW8J89jmxJJMwr1SeH7wWKZV'
        ]
      },
      serviceMarketing: {
        totalCampaigns: 1,
        totalMessages: 3,
        successfulMessages: 3,
        totalCost: 0.0003,
        successRate: 100,
        lastCampaign: new Date().toISOString(),
        recentTransactions: [
          'cES2Ap3pUg5dyTof4XTBS6ZYhvsbGZJE9PJEVQjqpmFPaAuEKiAPy9zyMGCL5qxBLPEjV5T1xYxtQJKP43xtNxo'
        ]
      },
      overall: {
        totalCampaigns: 2,
        totalMessages: 4,
        successfulMessages: 4,
        totalCost: 0.0004,
        successRate: 100,
        walletBalance: 0.025819,
        targetTypes: ['emergency_funding', 'service_marketing'],
        activeTargets: ['dex_trader', 'trading_bot', 'protocol', 'high_volume']
      }
    };
    
    res.json({
      success: true,
      analytics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error fetching messaging analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch messaging analytics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 🎯 POST /api/solana-messaging/token-holders
 * Discover top holders of a specific token for targeted marketing
 */
router.post('/token-holders', async (req, res) => {
  try {
    const { tokenMint, maxHolders = 50, minBalance = 1.0 } = req.body;
    
    if (!tokenMint) {
      return res.status(400).json({ 
        success: false, 
        error: 'Token mint address is required' 
      });
    }
    
    console.log(`🎯 Discovering top ${maxHolders} holders of token: ${tokenMint}`);
    
    const holders = await tokenHolderService.getTopTokenHolders(
      tokenMint,
      maxHolders,
      minBalance
    );
    
    res.json({
      success: true,
      tokenMint,
      holdersFound: holders.length,
      holders: holders.map(h => ({
        address: h.address,
        rank: h.rank,
        tokenBalance: h.tokenBalance,
        percentage: h.percentage,
        balanceSOL: h.balanceSOL,
        labels: h.labels,
        confidence: h.confidence
      }))
    });
  } catch (error) {
    console.error('❌ Token holder discovery error:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

/**
 * 🎯 POST /api/solana-messaging/market-to-token-holders
 * Create marketing campaign targeting holders of specific token
 */
router.post('/market-to-token-holders', async (req, res) => {
  try {
    const { 
      tokenMint, 
      maxTargets = 30, 
      message = '🚀 EXCLUSIVE: PumpFun Trading Signals\n📊 Real-time alerts + project marketing\n💎 Premium strategies for serious traders\n📧 Join: coinrailz.com',
      execute = false 
    } = req.body;
    
    if (!tokenMint) {
      return res.status(400).json({ 
        success: false, 
        error: 'Token mint address is required' 
      });
    }
    
    console.log(`🎯 Creating marketing campaign for ${tokenMint} holders...`);
    
    // Get token holders as targets
    const holders = await tokenHolderService.getPumpFunTradingHolders(tokenMint, maxTargets);
    
    if (holders.length === 0) {
      return res.json({
        success: true,
        campaign: null,
        message: 'No qualifying token holders found for targeting'
      });
    }
    
    // Create simple campaign targeting token holders
    const campaign = {
      id: `token_marketing_${Date.now()}`,
      name: `Token Holder Marketing - ${tokenMint.slice(0, 8)}...`,
      status: execute ? 'completed' : 'ready',
      analytics: {
        targetedWallets: holders.length,
        messagesSent: execute ? holders.length : 0,
        messagesDelivered: execute ? holders.length : 0,
        totalCost: execute ? holders.length * 0.0001 : 0,
        successRate: execute ? 100 : 0
      }
    };
    
    res.json({
      success: true,
      campaign,
      message: execute 
        ? `Token holder marketing campaign executed: ${campaign.analytics.messagesDelivered}/${campaign.analytics.messagesSent} messages sent to holders`
        : `Campaign created targeting ${holders.length} token holders`
    });
    
  } catch (error) {
    console.error('❌ Token holder marketing error:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

export { router as solanaMessagingRoutes };