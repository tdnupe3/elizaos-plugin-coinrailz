import { Router } from 'express';
import { solanaOutreachService } from '../services/solanaOutreachService';

const router = Router();

/**
 * 🌟 POST /api/solana-outreach/execute-campaign
 * Execute Solana ecosystem outreach campaign
 */
router.post('/execute-campaign', async (req, res) => {
  try {
    console.log('🚀 Starting Solana outreach campaign execution...');
    
    const campaignResults = await solanaOutreachService.executeSolanaOutreachCampaign();
    
    res.json({
      success: true,
      message: 'Solana outreach campaign executed successfully',
      campaign: {
        blockchain: 'Solana',
        network: process.env.NODE_ENV === 'production' ? 'Mainnet' : 'Devnet',
        costPerMessage: '~$0.00025',
        deliveryMethod: 'On-chain memo + micro-transfer'
      },
      results: campaignResults,
      summary: {
        totalTargets: campaignResults.totalTargets,
        successRate: `${Math.round((campaignResults.successfulSends / campaignResults.totalTargets) * 100)}%`,
        totalCost: `${campaignResults.totalCost.toFixed(6)} SOL`,
        estimatedUSDCost: `~$${(campaignResults.totalCost * 150).toFixed(2)}`,
        ecosystemsCovered: [
          'Solana Native',
          'DeFi Protocols', 
          'NFT/Gaming',
          'DAOs',
          'Developer Tools'
        ]
      }
    });
  } catch (error: any) {
    console.error('❌ Solana outreach campaign failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to execute Solana outreach campaign',
      details: error.message
    });
  }
});

/**
 * 🎯 GET /api/solana-outreach/campaign-preview  
 * Preview campaign targets and messaging
 */
router.get('/campaign-preview', async (req, res) => {
  try {
    res.json({
      success: true,
      campaignOverview: {
        blockchain: 'Solana',
        messagingMethod: 'Transaction memo field',
        costPerMessage: '~$0.00025 (0.000001 SOL + network fees)',
        targetEcosystems: [
          'Major DeFi protocols (Jupiter, Orca, Raydium)',
          'NFT marketplaces (Magic Eden)',
          'Gaming projects (Star Atlas)', 
          'DAOs (MonkeDAO)',
          'Infrastructure (Solana Labs)'
        ],
        messageContent: {
          serviceOffering: '$2K-$200K AI Agent SDK licensing',
          discountPricing: '0.5 SOL (~$75) vs $5K traditional',
          contactInfo: 'support@coinrailz.com, @coinrailz',
          deliveryGuarantee: '24-48 hours blockchain-verified'
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false, 
      error: 'Failed to generate campaign preview',
      details: error.message
    });
  }
});

export { router as solanaOutreachRoutes };