import express from 'express';
import { erc8004Discovery } from '../services/erc8004AgentDiscovery';
import { db } from '../db';
import { discoveredAgents } from '../../shared/schema';
import { eq } from 'drizzle-orm';

const router = express.Router();

router.post('/api/discovery/erc8004/trigger', async (req, res) => {
  try {
    console.log('🚀 Manual ERC-8004 discovery triggered via API');
    
    const result = await erc8004Discovery.discoverAllRegisteredAgents();
    
    res.json({
      success: true,
      message: 'ERC-8004 agent discovery completed',
      data: {
        newAgents: result.discovered,
        totalRegistrations: result.total,
        agents: result.agents
      }
    });
    
  } catch (error) {
    console.error('❌ Error in ERC-8004 discovery:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to discover agents from ERC-8004 registry',
      details: (error as Error).message
    });
  }
});

router.get('/api/discovery/erc8004/stats', async (req, res) => {
  try {
    const stats = await erc8004Discovery.getDiscoveryStats();
    
    res.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    console.error('❌ Error getting ERC-8004 stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get discovery stats',
      details: (error as Error).message
    });
  }
});

router.get('/api/discovery/erc8004/agents', async (req, res) => {
  try {
    const agents = await db.select()
      .from(discoveredAgents)
      .where(eq(discoveredAgents.source, 'erc8004'));
    
    res.json({
      success: true,
      count: agents.length,
      data: agents
    });
    
  } catch (error) {
    console.error('❌ Error fetching ERC-8004 agents:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch discovered agents',
      details: (error as Error).message
    });
  }
});

export default router;
