import { Router, Request, Response } from 'express';
import { a2aOutreachService } from '../services/a2aOutreachService';
import { z } from 'zod';

const router = Router();

/**
 * A2A OUTREACH ROUTES
 * 
 * API endpoints for managing A2A protocol-based outreach campaigns
 * for B2B revenue generation via MCP Payments Kit integration proposals
 */

/**
 * POST /api/a2a/outreach/campaign
 * Start a new A2A outreach campaign
 */
router.post('/outreach/campaign', async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      limit: z.number().min(1).max(100).optional().default(50),
      dryRun: z.boolean().optional().default(false),
      campaignId: z.string().optional()
    });

    const params = schema.parse(req.body);

    console.log(`🚀 Starting A2A outreach campaign: limit=${params.limit}, dryRun=${params.dryRun}`);

    const result = await a2aOutreachService.runOutreachCampaign({
      limit: params.limit,
      dryRun: params.dryRun,
      campaignId: params.campaignId
    });

    res.json({
      success: true,
      campaignId: result.campaignId,
      stats: result.stats,
      results: result.results.slice(0, 10), // Return first 10 for preview
      message: params.dryRun 
        ? `Dry run complete: would send to ${result.stats.total} agents`
        : `Campaign started: ${result.stats.sent} tasks sent, ${result.stats.errors} errors`
    });

  } catch (error: any) {
    console.error('A2A outreach campaign error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Campaign failed'
    });
  }
});

/**
 * GET /api/a2a/outreach/stats
 * Get outreach campaign statistics
 */
router.get('/outreach/stats', async (req: Request, res: Response) => {
  try {
    const campaignId = req.query.campaignId as string | undefined;
    const stats = await a2aOutreachService.getCampaignStats(campaignId);

    res.json({
      success: true,
      stats,
      campaignId: campaignId || 'all'
    });

  } catch (error: any) {
    console.error('A2A outreach stats error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get stats'
    });
  }
});

/**
 * GET /api/a2a/outreach/pipeline
 * Get sales pipeline data from outreach responses
 */
router.get('/outreach/pipeline', async (req: Request, res: Response) => {
  try {
    const pipeline = await a2aOutreachService.getPipelineData();

    res.json({
      success: true,
      pipeline: {
        interested: {
          count: pipeline.interested.length,
          agents: pipeline.interested.map(m => ({
            agentId: m.outreach.agentId,
            agentUrl: m.agent?.url,
            agentName: (m.agent?.metadata as any)?.name || m.agent?.url,
            respondedAt: m.outreach.responseAt
          }))
        },
        needsInfo: {
          count: pipeline.needsInfo.length,
          agents: pipeline.needsInfo.map(m => ({
            agentId: m.outreach.agentId,
            agentUrl: m.agent?.url,
            agentName: (m.agent?.metadata as any)?.name || m.agent?.url,
            respondedAt: m.outreach.responseAt
          }))
        },
        pending: {
          count: pipeline.pending.length
        },
        declined: {
          count: pipeline.declined.length
        }
      },
      summary: {
        totalContacted: pipeline.interested.length + pipeline.needsInfo.length + pipeline.pending.length + pipeline.declined.length,
        responseRate: pipeline.pending.length > 0 
          ? ((pipeline.interested.length + pipeline.needsInfo.length + pipeline.declined.length) / 
             (pipeline.interested.length + pipeline.needsInfo.length + pipeline.pending.length + pipeline.declined.length) * 100).toFixed(1)
          : 0,
        conversionRate: (pipeline.interested.length + pipeline.needsInfo.length + pipeline.pending.length + pipeline.declined.length) > 0
          ? (pipeline.interested.length / 
             (pipeline.interested.length + pipeline.needsInfo.length + pipeline.pending.length + pipeline.declined.length) * 100).toFixed(1)
          : 0
      }
    });

  } catch (error: any) {
    console.error('A2A pipeline error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get pipeline'
    });
  }
});

/**
 * GET /api/a2a/outreach/agents
 * Get verified A2A agents ready for outreach
 */
router.get('/outreach/agents', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const agents = await a2aOutreachService.getVerifiedAgentsForOutreach(limit);

    res.json({
      success: true,
      count: agents.length,
      agents: agents.map(a => ({
        id: a.id,
        url: a.url,
        name: (a.metadata as any)?.name || a.url,
        capabilities: a.capabilities,
        status: a.status,
        score: a.score,
        lastContactAt: a.lastContactAt
      }))
    });

  } catch (error: any) {
    console.error('A2A agents list error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get agents'
    });
  }
});

/**
 * POST /api/a2a/responses
 * Webhook endpoint for receiving A2A task responses (push notifications)
 * Must be authenticated via the A2A_WEBHOOK_SECRET token
 */
router.post('/responses', async (req: Request, res: Response) => {
  try {
    // Validate webhook token
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '') || req.query.token;
    const expectedToken = process.env.A2A_WEBHOOK_SECRET;

    if (!expectedToken) {
      console.error('A2A_WEBHOOK_SECRET not configured');
      return res.status(500).json({ error: 'Webhook not configured' });
    }

    if (token !== expectedToken) {
      console.warn('⚠️ A2A webhook: Invalid token received');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Validate request body
    const responseSchema = z.object({
      id: z.string().optional(),
      taskId: z.string().optional(),
      contextId: z.string().optional(),
      status: z.object({
        state: z.string()
      }).optional(),
      artifacts: z.array(z.any()).optional(),
      kind: z.string().optional()
    }).passthrough();

    const responseData = responseSchema.parse(req.body);

    console.log(`📬 A2A webhook received: taskId=${responseData.id || responseData.taskId}, status=${responseData.status?.state}`);

    // Process the response
    const result = await a2aOutreachService.processResponse(responseData);

    if (result.success) {
      console.log(`✅ A2A response processed: agent=${result.agentId}, intent=${result.intent}`);
    }

    res.json({
      success: result.success,
      processed: result.success,
      intent: result.intent
    });

  } catch (error: any) {
    console.error('A2A webhook error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Invalid webhook payload'
    });
  }
});

/**
 * GET /api/a2a/outreach/health
 * Health check for A2A outreach system
 */
router.get('/outreach/health', async (_req: Request, res: Response) => {
  const webhookConfigured = !!process.env.A2A_WEBHOOK_SECRET;
  
  res.json({
    success: true,
    status: 'operational',
    webhookConfigured,
    timestamp: new Date().toISOString()
  });
});

export default router;
