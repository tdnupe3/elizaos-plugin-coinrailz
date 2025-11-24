/**
 * XMTP AGENT OUTREACH ROUTES
 * 
 * API endpoints for managing AI agent outreach campaigns with:
 * - Personalized messaging
 * - $10 free credit offers
 * - Multi-channel routing
 * 
 * Security: All routes require authentication and rate limiting
 */

import { Router } from 'express';
import { XMTPAgentOutreachService } from '../services/xmtpAgentOutreach';
import { isAuthenticated } from '../replitAuth';
import { applyRateLimit } from '../middleware/rateLimiting';

const router = Router();
const outreachService = XMTPAgentOutreachService.getInstance();

// Apply authentication to all outreach routes
router.use(isAuthenticated);

/**
 * POST /api/xmtp-outreach/campaign
 * Run a targeted outreach campaign to high-quality agents
 * 
 * Body:
 * - minQualityScore: number (default: 60)
 * - maxAgents: number (default: 50)
 * - onlyXMTP: boolean (default: false)
 * 
 * Rate limited: 5 requests per 15 minutes to prevent spam/abuse
 */
router.post('/campaign', applyRateLimit({ requests: 5, windowMs: 15 * 60 * 1000 }), async (req, res) => {
  try {
    const { minQualityScore, maxAgents, onlyXMTP } = req.body;

    const campaign = await outreachService.runOutreachCampaign({
      minQualityScore: minQualityScore || 60,
      maxAgents: maxAgents || 50,
      onlyXMTP: onlyXMTP || false,
    });

    res.json({
      success: true,
      campaign,
    });
  } catch (error) {
    console.error('❌ Campaign API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to run outreach campaign',
    });
  }
});

/**
 * GET /api/xmtp-outreach/recommendations
 * Get top agents recommended for outreach
 * 
 * Query params:
 * - limit: number (default: 20)
 */
router.get('/recommendations', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const recommendations = await outreachService.getOutreachRecommendations(limit);

    res.json({
      success: true,
      count: recommendations.length,
      agents: recommendations,
    });
  } catch (error) {
    console.error('❌ Recommendations API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get recommendations',
    });
  }
});

/**
 * GET /api/xmtp-outreach/preview/:agentId
 * Preview outreach messages for a specific agent
 */
router.get('/preview/:agentId', async (req, res) => {
  try {
    const agentId = parseInt(req.params.agentId);
    const preview = await outreachService.previewOutreachMessage(agentId);

    if (!preview) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found',
      });
    }

    res.json({
      success: true,
      preview,
    });
  } catch (error) {
    console.error('❌ Preview API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to preview message',
    });
  }
});

export default router;
