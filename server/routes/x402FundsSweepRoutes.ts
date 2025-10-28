/**
 * x402 Funds Sweep API Routes
 * Manual and automated funds collection from payment wallets
 * PROTECTED: Admin authentication required
 */

import express from 'express';
import { x402FundsSweepService } from '../services/x402FundsSweepService';
import { requireAuth } from '../middleware/authMiddleware';

const router = express.Router();

// Admin authentication middleware - works with JWT auth
const requireAdmin = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  // requireAuth middleware already checked authentication
  // Now verify the user has admin permissions
  const user = req.user as any;
  
  if (!user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
    });
  }
  
  // Check if user is admin
  // Option 1: Check against admin emails list
  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(e => e);
  
  // Option 2: Check for admin role
  const isAdmin = adminEmails.includes(user.email) || user.role === 'admin' || user.tier === 'admin';
  
  if (!isAdmin) {
    return res.status(403).json({
      success: false,
      error: 'Admin access required',
      message: 'Only administrators can access funds sweep endpoints',
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
