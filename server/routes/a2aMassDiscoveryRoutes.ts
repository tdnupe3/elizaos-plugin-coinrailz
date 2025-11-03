import { Router, Request, Response } from 'express';
import a2aMassDiscoveryService from '../services/a2aMassDiscoveryService';

const router = Router();

/**
 * POST /api/discovery/a2a/trigger
 * Trigger mass A2A protocol discovery across all target domains
 */
router.post('/trigger', async (req: Request, res: Response) => {
  try {
    console.log('🚀 A2A Discovery: Manual trigger initiated');
    
    const result = await a2aMassDiscoveryService.discoverAllAgents();
    
    res.json({
      success: true,
      message: 'A2A mass discovery completed',
      data: {
        discovered: result.discovered,
        totalChecked: result.total,
        agents: result.agents,
      },
    });
    
  } catch (error: any) {
    console.error('❌ A2A Discovery: Failed:', error);
    res.status(500).json({
      success: false,
      error: 'A2A discovery failed',
      details: error.message,
    });
  }
});

/**
 * POST /api/discovery/a2a/single
 * Discover single agent from provided URL
 */
router.post('/single', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL parameter required',
      });
    }
    
    console.log(`🔍 A2A Discovery: Checking single URL ${url}`);
    
    const agent = await a2aMassDiscoveryService.discoverSingleAgent(url);
    
    if (agent) {
      res.json({
        success: true,
        message: 'Agent discovered successfully',
        data: {
          name: agent.name,
          url: agent.url,
          protocolVersion: agent.protocolVersion,
          capabilities: agent.capabilities || [],
          skills: agent.skills,
        },
      });
    } else {
      res.json({
        success: false,
        message: 'No A2A agent found at this URL',
      });
    }
    
  } catch (error: any) {
    console.error('❌ A2A Discovery: Failed:', error);
    res.status(500).json({
      success: false,
      error: 'Agent discovery failed',
      details: error.message,
    });
  }
});

/**
 * GET /api/discovery/a2a/stats
 * Get discovery statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await a2aMassDiscoveryService.getDiscoveryStats();
    
    res.json({
      success: true,
      data: stats,
    });
    
  } catch (error: any) {
    console.error('❌ A2A Discovery: Failed to get stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get discovery stats',
      details: error.message,
    });
  }
});

/**
 * GET /api/discovery/a2a/agents
 * Get all discovered A2A agents
 */
router.get('/agents', async (req: Request, res: Response) => {
  try {
    const agents = await a2aMassDiscoveryService.getDiscoveredAgents();
    
    res.json({
      success: true,
      data: {
        total: agents.length,
        agents: agents.map(a => ({
          id: a.id,
          url: a.url,
          name: a.metadata?.name || 'Unknown',
          status: a.status,
          score: a.score,
          capabilities: a.capabilities || [],
          lastSeen: a.lastSeenAt,
          discoveredAt: a.discoveredAt,
        })),
      },
    });
    
  } catch (error: any) {
    console.error('❌ A2A Discovery: Failed to get agents:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get discovered agents',
      details: error.message,
    });
  }
});

export default router;
