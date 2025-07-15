/**
 * AI Agent Routes with Quality Control Integration
 * Implements agent management with performance tracking
 */

import { Router } from 'express';
import { agentQualityControl } from '../services/agentQualityControl';
import { aiAgentCircuitBreaker } from '../services/circuitBreaker';
// import { agentRegistrationSchema, validateSchema } from '../middleware/inputValidation'; // Disabled - missing file
import { isAuthenticated } from '../replitAuth';
import { storage } from '../storage';

const router = Router();

// Get agent performance metrics
router.get('/agent/:agentId/metrics', isAuthenticated, async (req, res) => {
  try {
    const { agentId } = req.params;
    
    const metrics = await aiAgentCircuitBreaker.execute(async () => {
      return await agentQualityControl.getAgentPerformanceMetrics(agentId);
    });

    if (!metrics) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    res.json({ success: true, metrics });
  } catch (error) {
    console.error('Failed to get agent metrics:', error);
    res.status(500).json({ error: 'Failed to retrieve agent metrics' });
  }
});

// Rate agent performance
router.post('/order/:orderId/rate', isAuthenticated, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { rating, feedback } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    await agentQualityControl.rateAgentPerformance(orderId, rating, feedback);
    
    res.json({ 
      success: true, 
      message: 'Agent performance rated successfully' 
    });
  } catch (error) {
    console.error('Failed to rate agent:', error);
    res.status(500).json({ error: 'Failed to rate agent performance' });
  }
});

// Verify service delivery
router.post('/order/:orderId/verify', isAuthenticated, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { deliveryProof } = req.body;

    if (!deliveryProof) {
      return res.status(400).json({ error: 'Delivery proof is required' });
    }

    const verified = await agentQualityControl.verifyServiceDelivery(orderId, deliveryProof);
    
    res.json({ 
      success: true, 
      verified,
      message: verified ? 'Service delivery verified' : 'Verification failed'
    });
  } catch (error) {
    console.error('Failed to verify delivery:', error);
    res.status(500).json({ error: 'Failed to verify service delivery' });
  }
});

// Get quality report
router.get('/quality-report', isAuthenticated, async (req, res) => {
  try {
    const report = await agentQualityControl.createQualityReport();
    res.json({ success: true, report });
  } catch (error) {
    console.error('Failed to create quality report:', error);
    res.status(500).json({ error: 'Failed to create quality report' });
  }
});

// Register agent with quality control
router.post('/register', async (req, res) => {
  try {
    const { name, description, capabilities, contactEmail } = req.body;
    
    const agentId = `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const agent = await storage.createGlobalAIAgent({
      id: agentId,
      agentName: name,
      description,
      capabilities: Array.isArray(capabilities) ? capabilities : [capabilities],
      primaryWalletAddress: `demo_wallet_${agentId}`,
      walletNetwork: 'ethereum',
      publicKey: `pk_${Math.random().toString(36).substr(2, 16)}`,
      signature: `sig_${Math.random().toString(36).substr(2, 24)}`,
      status: 'active',
      reputation: '5.0',
      totalTransactions: 0,
      totalVolume: '0.00',
      membershipTier: 'basic',
      isActive: true,
      hasCompletedFirstTransaction: false,
      annualRevenue: '0.00',
      referralCount: 0,
      referralRewards: '0.00',
      isHumanRegistered: true,
      contactEmail,
      averageRating: 0,
      totalRatings: 0
    });

    res.status(201).json({
      success: true,
      agent,
      agentId,
      message: 'AI agent registered with quality control enabled'
    });
  } catch (error) {
    console.error('Agent registration failed:', error);
    res.status(500).json({ 
      error: 'Failed to register agent',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as agentRoutes };