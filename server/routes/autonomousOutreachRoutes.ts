/**
 * Autonomous Outreach Routes
 * 
 * API endpoints for triggering and monitoring autonomous AI agent outreach
 */

import express from 'express';
import { autonomousOutreachService } from '../services/autonomousOutreachService';
import { platformInteractionDiscovery } from '../services/platformInteractionDiscovery';
import { realAgentOutreach } from '../services/realAgentOutreach';

const router = express.Router();

/**
 * POST /api/outreach/execute
 * Execute autonomous outreach campaign
 */
router.post('/execute', async (req, res) => {
  try {
    console.log('🚀 Autonomous outreach triggered via API');
    
    const results = await autonomousOutreachService.executeOutreach();
    const stats = autonomousOutreachService.getStatistics();

    res.json({
      success: true,
      message: 'Autonomous outreach campaign completed',
      results: results,
      statistics: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error executing autonomous outreach:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/outreach/stats
 * Get outreach statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = autonomousOutreachService.getStatistics();
    res.json({
      success: true,
      statistics: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/outreach/discover
 * Run platform interaction discovery scan
 */
router.post('/discover', async (req, res) => {
  try {
    console.log('🔍 Platform interaction discovery triggered via API');
    
    const results = await platformInteractionDiscovery.runDiscoveryScan();

    res.json({
      success: true,
      message: 'Platform interaction discovery scan completed',
      results: results,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error running discovery scan:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/outreach/message-agents
 * Actually message discovered agents via XMTP wallet messaging
 */
router.post('/message-agents', async (req, res) => {
  try {
    console.log('💬 Real agent messaging triggered via API');
    
    const outreachResults = await realAgentOutreach.messageDiscoveredAgents();

    res.json({
      success: true,
      message: 'Real agent outreach completed',
      ...outreachResults,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error messaging agents:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
