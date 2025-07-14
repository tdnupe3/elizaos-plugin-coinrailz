/**
 * Gas Station API Routes
 * Handles USDC gas fee payment and transaction sponsorship
 */

import { Router } from 'express';
import { gasStationService } from '../services/gasStationService';
import { requireAuth } from '../middleware/authMiddleware';
import { z } from 'zod';

const router = Router();

// All gas station routes require authentication
router.use(requireAuth);

/**
 * POST /api/gas-station/estimate
 * Estimate gas fees for a transaction
 */
router.post('/estimate', async (req, res) => {
  try {
    const schema = z.object({
      blockchain: z.string().min(1),
      to: z.string().min(1),
      data: z.string().optional().default('0x'),
      value: z.string().optional().default('0')
    });

    const { blockchain, to, data, value } = schema.parse(req.body);

    const gasEstimate = await gasStationService.estimateGasFees(
      blockchain,
      to,
      data,
      value
    );

    res.json({
      success: true,
      estimate: gasEstimate
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: 'Gas estimation failed',
      message: error.message
    });
  }
});

/**
 * POST /api/gas-station/sponsor
 * Sponsor a transaction using USDC
 */
router.post('/sponsor', async (req, res) => {
  try {
    const schema = z.object({
      userWalletId: z.string().min(1),
      blockchain: z.string().min(1),
      to: z.string().min(1),
      data: z.string().optional().default('0x'),
      value: z.string().optional().default('0')
    });

    const { userWalletId, blockchain, to, data, value } = schema.parse(req.body);

    const sponsoredTx = await gasStationService.sponsorTransaction(
      userWalletId,
      blockchain,
      to,
      data,
      value
    );

    res.json({
      success: true,
      transaction: sponsoredTx
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: 'Transaction sponsorship failed',
      message: error.message
    });
  }
});

/**
 * GET /api/gas-station/stats
 * Get gas station statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await gasStationService.getGasStationStats();

    res.json({
      success: true,
      stats
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch gas station stats',
      message: error.message
    });
  }
});

/**
 * GET /api/gas-station/health
 * Check gas station health status
 */
router.get('/health', async (req, res) => {
  try {
    const health = gasStationService.getHealthStatus();

    res.json({
      success: true,
      health
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to check gas station health',
      message: error.message
    });
  }
});

/**
 * GET /api/gas-station/supported-chains
 * Get supported blockchains
 */
router.get('/supported-chains', async (req, res) => {
  try {
    const chains = ['ETH', 'MATIC', 'AVAX', 'ARB', 'BNB'];

    res.json({
      success: true,
      chains,
      details: chains.map(chain => ({
        blockchain: chain,
        supported: gasStationService.isSupported(chain),
        markup: '5%'
      }))
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch supported chains',
      message: error.message
    });
  }
});

export default router;