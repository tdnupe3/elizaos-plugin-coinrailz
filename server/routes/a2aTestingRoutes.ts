/**
 * A2A PROTOCOL TESTING ROUTES
 * API endpoints for smoke testing and telemetry analysis
 */

import { Router } from 'express';
import { A2AProtocolService } from '../services/a2aProtocolService.js';

const router = Router();

/**
 * POST /api/a2a/smoke-test
 * Run smoke tests against known Google A2A compliant agents
 */
router.post('/smoke-test', async (req, res) => {
  try {
    console.log('🧪 A2A Smoke test initiated via API...');
    
    const a2aService = new A2AProtocolService();
    const smokeTestResults = await a2aService.smokeTestCompliantAgents();
    
    res.json({ 
      success: true, 
      message: 'A2A smoke test completed',
      ...smokeTestResults
    });
  } catch (error) {
    console.error('❌ Smoke test error:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/a2a/telemetry-analysis  
 * Analyze failure telemetry and provide backoff tuning recommendations
 */
router.get('/telemetry-analysis', async (req, res) => {
  try {
    console.log('📊 A2A Telemetry analysis initiated via API...');
    
    const a2aService = new A2AProtocolService();
    const telemetryAnalysis = await a2aService.analyzeTelemetryAndTuneBackoff();
    
    res.json({ 
      success: true, 
      message: 'Telemetry analysis completed',
      analysis: telemetryAnalysis
    });
  } catch (error) {
    console.error('❌ Telemetry analysis error:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/a2a/emergency-campaign
 * Execute emergency fundraising campaign with smart retry prioritization
 */
router.post('/emergency-campaign', async (req, res) => {
  try {
    console.log('🚨 A2A Emergency campaign initiated via API...');
    
    const { targetAddresses, urgencyLevel } = req.body;
    const a2aService = new A2AProtocolService();
    
    const results = await a2aService.executeEmergencyFundraisingCampaign(
      targetAddresses || [], 
      urgencyLevel || 'critical'
    );
    
    res.json({ 
      success: true, 
      message: 'Emergency fundraising campaign initiated with smart retry prioritization',
      results 
    });
  } catch (error) {
    console.error('❌ Emergency campaign error:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;