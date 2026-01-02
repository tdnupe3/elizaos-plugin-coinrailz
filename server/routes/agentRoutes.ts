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

// Register agent with quality control - LOCKED DOWN
// External agent registration is temporarily closed - platform services only
router.post('/register', async (req, res) => {
  // SECURITY: Registration locked down to platform services only
  return res.status(403).json({
    success: false,
    error: 'REGISTRATION_CLOSED',
    message: 'External agent registration is temporarily closed. The marketplace currently features verified platform services only. Contact support for enterprise registration inquiries.'
  });
});

export { router as agentRoutes };