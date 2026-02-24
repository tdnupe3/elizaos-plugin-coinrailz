import { Router } from 'express';
import { x402ActiveAgentOutreach } from '../services/x402ActiveAgentOutreach';
import { offerLinkService } from '../services/offerLinkService';

const router = Router();

/**
 * POST /api/x402-outreach/execute
 * Execute targeted outreach to active x402 AI agents
 */
router.post('/execute', async (req, res) => {
  try {
    console.log('🚀 Starting x402 active agent outreach campaign...');
    
    const results = await x402ActiveAgentOutreach.executeTargetedOutreach();
    
    res.json({
      success: true,
      campaign: 'x402_active_agent_outreach',
      results: {
        walletsTargeted: results.walletsTargeted,
        messagesSent: results.messagesSent,
        successRate: results.walletsTargeted > 0 
          ? `${Math.round((results.messagesSent / results.walletsTargeted) * 100)}%`
          : '0%',
        cost: '$0.00 (FREE on-chain messaging)',
      },
      message: `Sent x402 service offers to ${results.messagesSent} active AI agents via wallet messaging`,
      nextSteps: [
        'Monitor responses via /api/x402-outreach/monitor',
        'Check x402 service endpoints for incoming payments',
        'Review outreach logs in database'
      ]
    });
    
  } catch (error: any) {
    console.error('❌ x402 outreach failed:', error);
    res.status(500).json({
      success: false,
      error: 'Outreach execution failed',
      details: error.message
    });
  }
});

/**
 * GET /api/x402-outreach/monitor
 * Monitor for responses from x402 agents
 */
router.get('/monitor', async (req, res) => {
  try {
    const timeoutMinutes = parseInt(req.query.timeout as string) || 30;
    
    console.log(`👂 Monitoring x402 agent responses for ${timeoutMinutes} minutes...`);
    
    const responses = await x402ActiveAgentOutreach.monitorResponses(timeoutMinutes);
    
    res.json({
      success: true,
      responsesReceived: responses.length,
      responses: responses.map(r => ({
        from: r.senderAddress,
        content: r.content,
        timestamp: r.timestamp,
        conversationId: r.conversationId
      })),
      message: `Received ${responses.length} responses from x402 AI agents`
    });
    
  } catch (error: any) {
    console.error('❌ Response monitoring failed:', error);
    res.status(500).json({
      success: false,
      error: 'Response monitoring failed',
      details: error.message
    });
  }
});

/**
 * GET /api/x402-outreach/discover
 * Discover active x402 wallets without sending messages
 */
router.get('/discover', async (req, res) => {
  try {
    console.log('🔍 Discovering active x402 wallets...');
    
    const wallets = await x402ActiveAgentOutreach.discoverActiveX402Wallets();
    
    res.json({
      success: true,
      walletsFound: wallets.length,
      wallets: wallets,
      message: `Discovered ${wallets.length} active x402 AI agent wallets`
    });
    
  } catch (error: any) {
    console.error('❌ Wallet discovery failed:', error);
    res.status(500).json({
      success: false,
      error: 'Wallet discovery failed',
      details: error.message
    });
  }
});

/**
 * POST /api/x402-outreach/execute-tracked
 * Execute outreach with personalized tracked offer links
 * Each agent gets a unique URL so we can attribute conversions
 */
router.post('/execute-tracked', async (req, res) => {
  try {
    const { campaignId, serviceId } = req.body;
    
    console.log('🚀 Starting tracked x402 outreach campaign...');
    console.log(`   Campaign: ${campaignId || 'tracked-outreach'}`);
    console.log(`   Service: ${serviceId || 'ping'}`);
    
    const results = await x402ActiveAgentOutreach.executeTrackedOutreach(
      campaignId || 'tracked-outreach',
      serviceId || 'ping'
    );
    
    res.json({
      success: true,
      campaign: 'x402_tracked_outreach',
      results: {
        walletsTargeted: results.walletsTargeted,
        messagesSent: results.messagesSent,
        offerLinksGenerated: results.offerLinks.length,
        successRate: results.walletsTargeted > 0 
          ? `${Math.round((results.messagesSent / results.walletsTargeted) * 100)}%`
          : '0%',
      },
      offerLinks: results.offerLinks,
      message: `Created ${results.offerLinks.length} unique offer links for attribution tracking`,
      nextSteps: [
        'Monitor offer link clicks at /api/outreach/offers/stats',
        'View individual offer performance at /api/outreach/offers/:trackingId',
        'Check x402 interactions with offer_tracking_id for attribution'
      ]
    });
    
  } catch (error: any) {
    console.error('❌ Tracked outreach failed:', error);
    res.status(500).json({
      success: false,
      error: 'Tracked outreach execution failed',
      details: error.message
    });
  }
});

/**
 * POST /api/x402-outreach/generate-offer
 * Generate a single personalized offer link for manual outreach
 */
router.post('/generate-offer', async (req, res) => {
  try {
    const { targetAgentUrl, campaignId, serviceId } = req.body;
    
    if (!targetAgentUrl) {
      return res.status(400).json({
        success: false,
        error: 'targetAgentUrl is required'
      });
    }
    
    const personalized = await x402ActiveAgentOutreach.generatePersonalizedOutreach(
      targetAgentUrl,
      campaignId || 'manual-outreach',
      serviceId || 'ping'
    );
    
    res.json({
      success: true,
      message: personalized.message,
      offerLink: personalized.offerLink,
      trackingId: personalized.trackingId,
      usage: {
        instruction: 'Send this message to the target agent. The offer link will track clicks and conversions.',
        monitorAt: `/api/outreach/offers/${personalized.trackingId}`
      }
    });
    
  } catch (error: any) {
    console.error('❌ Generate offer failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate personalized offer',
      details: error.message
    });
  }
});

export default router;
