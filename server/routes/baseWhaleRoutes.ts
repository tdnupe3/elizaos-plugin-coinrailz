/**
 * 🐋 BASE WHALE TARGETING ROUTES
 * API endpoints for discovering and targeting Base whales with 1+ ETH
 */

import { Router } from 'express';
import { baseWhaleTargetingService } from '../services/baseWhaleTargetingService';

const router = Router();

/**
 * 🚀 POST /api/base-whales/launch-whale-campaign
 * Launch Base whale targeting campaign (1+ ETH holders, sorted by balance)
 */
router.post('/launch-whale-campaign', async (req, res) => {
  try {
    console.log('🐋 LAUNCHING BASE WHALE TARGETING CAMPAIGN...');
    console.log('🎯 Targeting all Base wallets with 1+ ETH, starting from biggest whales');
    
    const result = await baseWhaleTargetingService.executeWhaleTargeting();
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.message || 'Base whale campaign failed'
      });
    }

    res.json({
      success: true,
      message: 'Base whale targeting campaign executed successfully',
      analytics: {
        whalesDiscovered: result.whalesDiscovered,
        messagesAttempted: result.messagesAttempted,
        successfulMessages: result.successfulMessages,
        totalCostETH: result.totalCost,
        totalCostUSD: (result.totalCost * 2800).toFixed(4),
        platformWallet: '0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91',
        network: 'Base Chain',
        whaleBreakdown: result.analytics,
        impossible_to_block: true,
        permanent_blockchain_storage: true,
        costEfficiency: 'Much cheaper than Solana whale targeting'
      },
      whaleTargets: result.results,
      advantages: [
        'Impossible to block or filter',
        'Permanently stored on Base blockchain', 
        'Much cheaper than Solana (~$0.28 vs $0.305)',
        'Targets verified high-ETH Base wallets',
        'Premium trading platform + funding requests',
        'Sorted by balance (biggest whales first)',
        'Real-time ETH balance verification'
      ]
    });

  } catch (error) {
    console.error('❌ Base whale campaign failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to execute Base whale campaign',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 🔍 GET /api/base-whales/discover
 * Discover Base whales without sending messages (discovery only)
 */
router.get('/discover', async (req, res) => {
  try {
    console.log('🔍 DISCOVERING BASE WHALES (DISCOVERY ONLY)...');
    
    const whales = await baseWhaleTargetingService.discoverBaseWhales();
    
    res.json({
      success: true,
      message: `Discovered ${whales.length} Base whales with 1+ ETH`,
      whalesFound: whales.length,
      whaleBreakdown: {
        megaWhales: whales.filter(w => w.category === 'mega_whale').length,
        majorWhales: whales.filter(w => w.category === 'major_whale').length,
        mediumWhales: whales.filter(w => w.category === 'medium_whale').length,
        activeWhales: whales.filter(w => w.category === 'active_whale').length
      },
      totalValueETH: whales.reduce((sum, w) => sum + parseFloat(w.ethBalance), 0),
      whales: whales.map(w => ({
        address: w.address,
        ethBalance: w.ethBalance,
        category: w.category,
        priority: w.priority,
        estimatedValue: w.estimatedValue
      }))
    });

  } catch (error) {
    console.error('❌ Base whale discovery failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to discover Base whales',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 📊 GET /api/base-whales/stats
 * Get Base whale targeting statistics and campaign status
 */
router.get('/stats', async (req, res) => {
  try {
    res.json({
      success: true,
      serviceInfo: {
        name: 'Base Whale Targeting Service',
        description: 'Targets Base wallets with 1+ ETH, sorted by balance (highest first)',
        network: 'Base Chain Mainnet',
        minimumBalance: '1 ETH',
        targetingStrategy: 'Biggest whales first',
        messageCost: '~$0.28 per message (much cheaper than Solana)',
        messageContent: 'Premium trading platform + SOL funding requests'
      },
      categories: {
        'mega_whale': '100+ ETH ($280K+ value)',
        'major_whale': '10+ ETH ($28K+ value)', 
        'medium_whale': '5+ ETH ($14K+ value)',
        'active_whale': '1+ ETH ($2.8K+ value)'
      },
      advantages: [
        'Real-time ETH balance verification',
        'Blockchain-verified message delivery',
        'Much more cost-effective than Solana',
        'Targets verified high-value wallets',
        'Impossible to block or filter',
        'Permanently stored on blockchain'
      ]
    });

  } catch (error) {
    console.error('❌ Failed to get Base whale stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get statistics'
    });
  }
});

export default router;