/**
 * x402 Funds Sweep API Routes
 * Manual and automated funds collection from payment wallets
 * PROTECTED: Admin authentication required
 */

import express from 'express';
import { x402FundsSweepService } from '../services/x402FundsSweepService';
import { requireAuth } from '../middleware/authMiddleware';

const router = express.Router();

// Admin authentication middleware
const requireAdmin = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
    });
  }

  const user = req.user as any;
  
  // Check if user is admin (you can customize this logic)
  // For now, require specific admin email or role
  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim());
  
  if (!adminEmails.includes(user.email) && user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Admin access required',
    });
  }

  next();
};

// Apply authentication to all routes
router.use(requireAuth);
router.use(requireAdmin);

/**
 * GET /api/x402-sweep/status
 * Get current sweep status and statistics
 */
router.get('/status', async (req, res) => {
  try {
    const status = await x402FundsSweepService.getSweepStatus();
    
    res.json({
      success: true,
      ...status,
    });
  } catch (error: any) {
    console.error('Failed to get sweep status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get sweep status',
      details: error.message,
    });
  }
});

/**
 * POST /api/x402-sweep/run
 * Manually trigger funds sweep
 */
router.post('/run', async (req, res) => {
  try {
    console.log('🔄 Manual x402 funds sweep triggered');
    
    const result = await x402FundsSweepService.sweepCompletedPayments();
    
    res.json({
      message: `Swept ${result.swept} payments, ${result.failed} failed`,
      ...result,
    });
  } catch (error: any) {
    console.error('Manual sweep failed:', error);
    res.status(500).json({
      success: false,
      error: 'Manual sweep failed',
      details: error.message,
    });
  }
});

export default router;
