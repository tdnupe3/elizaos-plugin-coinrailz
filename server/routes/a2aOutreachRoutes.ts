import { Router, Request, Response, NextFunction } from 'express';
import { a2aOutreachService } from '../services/a2aOutreachService';
import { z } from 'zod';

const router = Router();

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const key = req.headers['x-admin-key'] as string | undefined;
  if (key && key === process.env.ADMIN_KEY) return next();
  return res.status(401).json({ error: 'Admin authentication required. Pass X-Admin-Key header.' });
}

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
router.post('/outreach/campaign', requireAdmin, async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      limit: z.number().min(1).max(100).optional().default(50),
      dryRun: z.boolean().optional().default(false),
      campaignId: z.string().optional(),
      highValueOnly: z.boolean().optional().default(false),
      verifiedReachableOnly: z.boolean().optional().default(false)
    });

    const params = schema.parse(req.body);

    console.log(`🚀 Starting A2A outreach campaign: limit=${params.limit}, dryRun=${params.dryRun}, highValueOnly=${params.highValueOnly}`);

    const result = await a2aOutreachService.runOutreachCampaign({
      limit: params.limit,
      dryRun: params.dryRun,
      campaignId: params.campaignId,
      highValueOnly: params.highValueOnly,
      verifiedReachableOnly: params.verifiedReachableOnly
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
 * GET /api/a2a/outreach/search
 * Capability-based agent search - find agents by skills, capabilities, or tags
 * This enables reverse discovery: finding agents the same way they find us
 */
router.get('/outreach/search', async (req: Request, res: Response) => {
  try {
    const capabilities = (req.query.capabilities as string)?.split(',').map(s => s.trim().toLowerCase()) || [];
    const skills = (req.query.skills as string)?.split(',').map(s => s.trim().toLowerCase()) || [];
    const tags = (req.query.tags as string)?.split(',').map(s => s.trim().toLowerCase()) || [];
    const query = (req.query.q as string)?.toLowerCase();
    const limit = parseInt(req.query.limit as string) || 50;
    const acceptsTasksOnly = req.query.acceptsTasks === 'true';

    console.log(`🔍 Capability-based agent search: capabilities=${capabilities.join(',')}, skills=${skills.join(',')}, tags=${tags.join(',')}, query=${query}`);

    const searchTerms = [...capabilities, ...skills, ...tags];
    if (query) searchTerms.push(query);

    const result = await a2aOutreachService.searchAgentsByCapability({
      searchTerms,
      limit,
      acceptsTasksOnly
    });

    res.json({
      success: true,
      searchCriteria: {
        capabilities,
        skills,
        tags,
        query,
        acceptsTasksOnly
      },
      count: result.agents.length,
      agents: result.agents.map(a => ({
        id: a.id,
        url: a.url,
        name: (a.metadata as any)?.name || a.url,
        description: (a.metadata as any)?.description,
        capabilities: a.capabilities,
        skills: (a.metadata as any)?.skills || [],
        matchScore: a.matchScore,
        acceptsTasks: a.acceptsTasks,
        status: a.status,
        lastVerifiedAt: a.lastVerifiedAt
      })),
      suggestion: result.agents.length === 0 
        ? 'Try broader search terms like "payments", "commerce", "trading", "finance", or sync from registries first'
        : undefined
    });

  } catch (error: any) {
    console.error('Capability search error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to search agents'
    });
  }
});

/**
 * GET /api/a2a/outreach/bazaar-agents
 * Get agents discovered from Coinbase Bazaar (x402 indexed agents)
 * These are REAL paying agents - highest value targets
 */
router.get('/outreach/bazaar-agents', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const capabilities = (req.query.capabilities as string)?.split(',').map(s => s.trim().toLowerCase()) || [];

    console.log(`🏪 Fetching Bazaar-indexed agents (limit: ${limit})`);

    const result = await a2aOutreachService.getBazaarAgents({ limit, capabilities });

    res.json({
      success: true,
      source: 'Coinbase Bazaar (api.cdp.coinbase.com)',
      description: 'Real x402 indexed agents with proven payment activity',
      count: result.agents.length,
      uniqueDomains: result.uniqueDomains,
      agents: result.agents.map(a => ({
        domain: a.domain,
        resource: a.resource,
        payTo: a.payTo,
        network: a.network,
        asset: a.asset,
        description: a.description,
        hasAgentCard: a.hasAgentCard,
        agentCardUrl: a.agentCardUrl
      }))
    });

  } catch (error: any) {
    console.error('Bazaar agents error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get Bazaar agents'
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

/**
 * GET /api/a2a/outreach/high-value
 * Get agents sorted by priority, with accurate isHighValue flag per agent
 */
router.get('/outreach/high-value', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const agents = await a2aOutreachService.getHighValueAgents(limit);
    
    const highValueOnly = agents.filter(a => a.isHighValue);

    res.json({
      success: true,
      count: agents.length,
      highValueCount: highValueOnly.length,
      description: 'Agents sorted by priority - high-value developer platforms first',
      agents: agents.map(a => ({
        id: a.id,
        url: a.url,
        name: (a.metadata as any)?.name || a.url,
        provider: (a.metadata as any)?.provider?.organization,
        capabilities: a.capabilities,
        status: a.status,
        score: a.score,
        lastContactAt: a.lastContactAt,
        isHighValue: a.isHighValue // Accurate per-agent flag
      }))
    });

  } catch (error: any) {
    console.error('High-value agents error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get high-value agents'
    });
  }
});

/**
 * POST /api/a2a/outreach/verify-reachability
 * Probe agents' .well-known endpoints to verify reachability before outreach
 */
router.post('/outreach/verify-reachability', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.body.limit) || 20;
    const highValueOnly = req.body.highValueOnly === true;

    console.log(`🔍 Starting reachability verification (limit: ${limit}, highValueOnly: ${highValueOnly})`);

    const result = await a2aOutreachService.verifyAgentReachability({ limit, highValueOnly });

    res.json({
      success: true,
      summary: {
        total: result.total,
        reachable: result.reachable,
        unreachable: result.unreachable,
        unknown: result.unknown,
        reachabilityRate: result.total > 0 ? 
          `${Math.round((result.reachable / result.total) * 100)}%` : '0%'
      },
      results: result.results,
      errors: result.errors.length > 0 ? result.errors : undefined
    });

  } catch (error: any) {
    console.error('Reachability verification error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to verify reachability'
    });
  }
});

/**
 * POST /api/a2a/outreach/sync-registry
 * Sync agents from official a2aregistry.org
 */
router.post('/outreach/sync-registry', async (_req: Request, res: Response) => {
  try {
    console.log('🔄 Starting a2aregistry.org sync...');
    const result = await a2aOutreachService.syncFromA2ARegistry();

    res.json({
      success: true,
      message: `Synced ${result.total} agents from a2aregistry.org`,
      stats: {
        total: result.total,
        added: result.added,
        updated: result.updated,
        errors: result.errors.length
      },
      errors: result.errors.length > 0 ? result.errors.slice(0, 5) : undefined
    });

  } catch (error: any) {
    console.error('Registry sync error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to sync registry'
    });
  }
});

/**
 * GET /api/a2a/outreach/discovery-summary
 * Get dynamic summary of A2A discovery ecosystem (computed from DB)
 */
router.get('/outreach/discovery-summary', async (_req: Request, res: Response) => {
  try {
    const stats = await a2aOutreachService.getDiscoveryStats();
    const highValueAgents = await a2aOutreachService.getHighValueAgents(20);
    
    // Get actual high-value agent details
    const trueHighValue = highValueAgents.filter(a => a.isHighValue);

    res.json({
      success: true,
      ecosystemStatus: {
        message: 'A2A Protocol launched April 2025 - ecosystem is still growing',
        publicAgentsTotal: stats.totalAgents,
        highValueTargets: stats.highValueCount,
        lifieHubAgents: stats.lifieHubCount,
        otherAgents: stats.otherCount,
        recommendation: stats.highValueCount > 0 
          ? `Focus on ${stats.highValueCount} high-value developer platforms for highest conversion potential`
          : 'Sync from a2aregistry.org to find high-value targets'
      },
      sources: {
        total: stats.totalAgents,
        breakdown: {
          highValuePlatforms: stats.highValueCount,
          lifieHubDirectory: stats.lifieHubCount,
          other: stats.otherCount
        }
      },
      highValueAgents: trueHighValue.slice(0, 10).map(a => ({
        name: (a.metadata as any)?.name || a.url,
        url: a.url,
        provider: (a.metadata as any)?.provider?.organization,
        score: a.score
      }))
    });

  } catch (error: any) {
    console.error('Discovery summary error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get discovery summary'
    });
  }
});

export default router;
