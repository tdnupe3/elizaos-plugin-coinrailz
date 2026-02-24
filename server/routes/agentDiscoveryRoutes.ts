/**
 * AGENT DISCOVERY API ROUTES
 * 
 * REST API endpoints for managing the agent discovery system
 */

import { Router } from 'express';
import { agentDiscoveryService } from '../services/agentDiscoveryService';
import { isAuthenticated } from '../replitAuth';

const router = Router();

/**
 * GET /api/discovery/stats
 * Get discovery statistics and metrics
 */
router.get('/stats', isAuthenticated, async (req, res) => {
  try {
    const stats = await agentDiscoveryService.getDiscoveryStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('❌ Failed to get discovery stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve discovery statistics'
    });
  }
});

/**
 * POST /api/discovery/run
 * Manually trigger a discovery run
 */
router.post('/run', isAuthenticated, async (req, res) => {
  try {
    const {
      adapterIds,
      maxAgents = 5000,
      dryRun = false,
      priority = 'thorough'
    } = req.body;

    // Validate priority
    if (!['fast', 'thorough', 'maximum'].includes(priority)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid priority. Must be: fast, thorough, or maximum'
      });
    }

    const result = await agentDiscoveryService.runDiscovery({
      adapterIds,
      maxAgents,
      dryRun,
      priority
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('❌ Failed to run discovery:', error);
    
    if ((error as Error).message.includes('already running')) {
      return res.status(409).json({
        success: false,
        error: 'Discovery is already running. Please wait for completion.'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to run discovery'
    });
  }
});

/**
 * GET /api/discovery/agents
 * Get discovered agents by status
 */
router.get('/agents', isAuthenticated, async (req, res) => {
  try {
    const {
      status = 'new',
      limit = 100,
      offset = 0
    } = req.query;

    const agents = await agentDiscoveryService.getAgentsByStatus(
      status as string,
      parseInt(limit as string)
    );

    // Apply offset manually (simple pagination)
    const offsetNumber = parseInt(offset as string);
    const paginatedAgents = agents.slice(offsetNumber, offsetNumber + parseInt(limit as string));

    res.json({
      success: true,
      data: {
        agents: paginatedAgents,
        total: agents.length,
        hasMore: offsetNumber + paginatedAgents.length < agents.length
      }
    });
  } catch (error) {
    console.error('❌ Failed to get discovered agents:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve discovered agents'
    });
  }
});

/**
 * PUT /api/discovery/agents/:id/status
 * Update agent status (new, verified, contacted, etc.)
 */
router.put('/agents/:id/status', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'Status is required'
      });
    }

    await agentDiscoveryService.updateAgentStatus(parseInt(id), status);

    res.json({
      success: true,
      message: 'Agent status updated successfully'
    });
  } catch (error) {
    console.error('❌ Failed to update agent status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update agent status'
    });
  }
});

/**
 * POST /api/discovery/test-communication
 * Test communication with discovered agents
 */
router.post('/test-communication', isAuthenticated, async (req, res) => {
  try {
    const { agentIds, messageType = 'test' } = req.body;

    if (!agentIds || !Array.isArray(agentIds)) {
      return res.status(400).json({
        success: false,
        error: 'agentIds array is required'
      });
    }

    if (!['test', 'recruitment'].includes(messageType)) {
      return res.status(400).json({
        success: false,
        error: 'messageType must be "test" or "recruitment"'
      });
    }

    const results = await agentDiscoveryService.testCommunication(agentIds, messageType);

    res.json({
      success: true,
      data: {
        results,
        summary: {
          total: results.length,
          successful: results.filter(r => r.status === 'delivered').length,
          failed: results.filter(r => r.status === 'failed').length,
          totalCost: results.reduce((sum, r) => sum + (r.cost || 0), 0)
        }
      }
    });
  } catch (error) {
    console.error('❌ Failed to test communication:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test communication'
    });
  }
});

/**
 * GET /api/discovery/scheduler/status
 * Get scheduler status
 */
router.get('/scheduler/status', isAuthenticated, async (req, res) => {
  try {
    // This would check if the scheduler is running
    // For now, return basic status
    res.json({
      success: true,
      data: {
        running: true,
        nextRun: new Date(Date.now() + 60 * 60 * 1000), // Next hour
        frequency: 'hourly'
      }
    });
  } catch (error) {
    console.error('❌ Failed to get scheduler status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get scheduler status'
    });
  }
});

/**
 * POST /api/discovery/scheduler/start
 * Start the discovery scheduler
 */
router.post('/scheduler/start', isAuthenticated, async (req, res) => {
  try {
    agentDiscoveryService.startScheduler();
    
    res.json({
      success: true,
      message: 'Discovery scheduler started'
    });
  } catch (error) {
    console.error('❌ Failed to start scheduler:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start scheduler'
    });
  }
});

/**
 * POST /api/discovery/scheduler/stop
 * Stop the discovery scheduler
 */
router.post('/scheduler/stop', isAuthenticated, async (req, res) => {
  try {
    agentDiscoveryService.stopScheduler();
    
    res.json({
      success: true,
      message: 'Discovery scheduler stopped'
    });
  } catch (error) {
    console.error('❌ Failed to stop scheduler:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to stop scheduler'
    });
  }
});

/**
 * GET /api/discovery/adapters
 * Get information about available adapters
 */
router.get('/adapters', isAuthenticated, async (req, res) => {
  try {
    // Return adapter information
    const adapters = [
      {
        id: 'a2a-registry',
        name: 'A2A Registry Adapter',
        expectedYield: 500,
        timeout: 60000,
        rateLimit: 100,
        description: 'Discovers agents from A2A protocol registries and agent directories'
      },
      {
        id: 'onchain-lookups',
        name: 'On-chain Lookups Adapter',
        expectedYield: 2000,
        timeout: 120000,
        rateLimit: 50,
        description: 'Discovers agents via ENS domains, on-chain messaging, Farcaster/Lens protocols'
      },
      {
        id: 'social-scraper',
        name: 'Social Scraping Adapter',
        expectedYield: 1500,
        timeout: 90000,
        rateLimit: 30,
        description: 'Discovers agents through Discord/Telegram communities and social platforms'
      },
      {
        id: 'platform-adapter',
        name: 'Platform Discovery Adapter',
        expectedYield: 3000,
        timeout: 180000,
        rateLimit: 60,
        description: 'Discovers agents from marketplaces and AI service directories'
      }
    ];

    res.json({
      success: true,
      data: {
        adapters,
        totalExpectedYield: adapters.reduce((sum, a) => sum + a.expectedYield, 0)
      }
    });
  } catch (error) {
    console.error('❌ Failed to get adapter information:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get adapter information'
    });
  }
});

export default router;