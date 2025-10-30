import { Router } from 'express';
import { x402ActiveAgentOutreach } from '../services/x402ActiveAgentOutreach';

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
        cost: '$0.00 (FREE XMTP messaging)',
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

export default router;
