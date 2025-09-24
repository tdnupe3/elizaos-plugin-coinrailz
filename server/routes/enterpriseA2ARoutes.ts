/**
 * 🏢 ENTERPRISE A2A API ROUTES - IMMEDIATE REVENUE GENERATOR
 * 
 * Revenue-generating API endpoints for enterprise A2A integrations
 * Based on ChatGPT's suggestion for vendor-agnostic adapter
 * 
 * PRICING: $0.05 per A2A call + setup fees
 */

import { Router } from 'express';
import enterpriseA2AAdapter, { EnterpriseConfig, A2ATask } from '../adapters/enterpriseA2AAdapter.js';

const router = Router();

/**
 * 💰 POST /api/enterprise-a2a/plugin-config
 * Allow teams to plug in their enterprise tenant configurations
 * REVENUE: $100 setup fee per enterprise integration
 */
router.post('/plugin-config', async (req, res) => {
  try {
    const { configId, config }: { configId: string; config: EnterpriseConfig } = req.body;
    
    if (!configId || !config) {
      return res.status(400).json({
        success: false,
        error: 'configId and config are required'
      });
    }

    console.log(`🏢 Enterprise config setup for: ${config.platform} (${configId})`);
    
    const success = await enterpriseA2AAdapter.pluginEnterpriseConfig(configId, config);
    
    if (success) {
      res.json({
        success: true,
        message: `${config.platform} integration configured successfully`,
        configId,
        platform: config.platform,
        setupFee: 100, // $100 setup fee
        perCallRate: 0.05 // $0.05 per call
      });
    } else {
      res.status(400).json({
        success: false,
        error: `Failed to configure ${config.platform} integration`
      });
    }
    
  } catch (error: any) {
    console.error('❌ Enterprise config setup failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 💰 POST /api/enterprise-a2a/execute
 * Execute billable A2A task on enterprise agent
 * REVENUE: $0.05 per successful call
 */
router.post('/execute', async (req, res) => {
  try {
    const { configId, task }: { configId: string; task: A2ATask } = req.body;
    
    if (!configId || !task) {
      return res.status(400).json({
        success: false,
        error: 'configId and task are required'
      });
    }

    console.log(`💰 Executing billable A2A task: ${task.method} on ${configId}`);
    
    const result = await enterpriseA2AAdapter.executeTask(configId, task);
    
    // Track revenue for successful calls
    if (result.success && result.billableUnits) {
      console.log(`💰 Generated revenue: $${(result.billableUnits * 0.05).toFixed(2)}`);
    }
    
    res.json({
      ...result,
      billing: result.billableUnits ? {
        units: result.billableUnits,
        rate: 0.05,
        charge: result.billableUnits * 0.05
      } : undefined
    });
    
  } catch (error: any) {
    console.error('❌ A2A task execution failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      platform: 'unknown',
      executionTime: 0
    });
  }
});

/**
 * 💰 POST /api/enterprise-a2a/batch-execute
 * Execute multiple A2A tasks in batch for enterprise customers
 * REVENUE: $0.05 per successful call, volume discounts available
 */
router.post('/batch-execute', async (req, res) => {
  try {
    const { tasks }: { tasks: Array<{ configId: string; task: A2ATask }> } = req.body;
    
    if (!tasks || !Array.isArray(tasks)) {
      return res.status(400).json({
        success: false,
        error: 'tasks array is required'
      });
    }

    console.log(`🚀 Executing batch of ${tasks.length} enterprise A2A tasks`);
    
    const results = await enterpriseA2AAdapter.executeBatch(tasks);
    const billing = enterpriseA2AAdapter.calculateBilling(results);
    
    console.log(`💰 Batch revenue generated: $${billing.estimatedRevenue.toFixed(2)}`);
    
    res.json({
      success: true,
      results,
      billing: {
        totalCalls: billing.totalCalls,
        successfulCalls: billing.successfulCalls,
        billableUnits: billing.billableUnits,
        revenue: billing.estimatedRevenue,
        breakdown: billing.breakdown,
        perCallRate: 0.05
      }
    });
    
  } catch (error: any) {
    console.error('❌ Batch execution failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 📊 GET /api/enterprise-a2a/status
 * Get status of all enterprise integrations
 */
router.get('/status', async (req, res) => {
  try {
    const status = enterpriseA2AAdapter.getIntegrationStatus();
    
    res.json({
      success: true,
      integrations: status,
      totalIntegrations: status.length,
      activeIntegrations: status.filter(s => s.status === 'connected').length,
      expiredIntegrations: status.filter(s => s.status === 'expired').length
    });
    
  } catch (error: any) {
    console.error('❌ Status check failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 🧹 POST /api/enterprise-a2a/cleanup
 * Cleanup expired connections
 */
router.post('/cleanup', async (req, res) => {
  try {
    const cleaned = enterpriseA2AAdapter.cleanupExpiredConnections();
    
    res.json({
      success: true,
      message: `Cleaned up ${cleaned} expired connections`,
      cleanedConnections: cleaned
    });
    
  } catch (error: any) {
    console.error('❌ Cleanup failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 🎯 POST /api/enterprise-a2a/discover
 * Discover capabilities of an A2A agent endpoint
 * Free discovery for potential customers
 */
router.post('/discover', async (req, res) => {
  try {
    const { agentHost, bearerToken }: { agentHost: string; bearerToken?: string } = req.body;
    
    if (!agentHost) {
      return res.status(400).json({
        success: false,
        error: 'agentHost is required'
      });
    }

    console.log(`🔍 Discovering A2A capabilities at: ${agentHost}`);
    
    // Import the discovery client
    const { default: a2aDiscoveryClient } = await import('../services/a2aDiscoveryClient.js');
    const agentCard = await a2aDiscoveryClient.discoverAgent(agentHost, bearerToken);
    
    if (agentCard) {
      res.json({
        success: true,
        agent: {
          name: agentCard.agent.name,
          description: agentCard.agent.description,
          version: agentCard.agent.version,
          capabilities: agentCard.agent.capabilities,
          endpoints: Object.keys(agentCard.agent.endpoints),
          authRequired: !!agentCard.agent.auth
        }
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'No A2A agent found at the specified host'
      });
    }
    
  } catch (error: any) {
    console.error('❌ Agent discovery failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;