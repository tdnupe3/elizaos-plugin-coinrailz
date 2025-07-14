import { Router } from 'express';
import { userCircleService } from '../services/userCircleService';
import { requireAuth } from '../middleware/requireAuth';
import { db } from '../db';
import { users } from '../../shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// Create Circle wallet for authenticated user
router.post('/wallet/create', async (req, res) => {
  try {
    const { blockchain = 'ETH' } = req.body;
    const userId = req.user.id;

    if (!['ETH', 'MATIC', 'AVAX', 'ARB'].includes(blockchain)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid blockchain. Must be ETH, MATIC, AVAX, or ARB'
      });
    }

    const result = await userCircleService.createUserCircleWallet(userId, blockchain);
    
    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error creating user Circle wallet:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get user's USDC balance
router.get('/balance', async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await userCircleService.getUserUSDCBalance(userId);
    
    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error getting user USDC balance:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get all user's Circle wallets
router.get('/wallets', async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await userCircleService.getUserCircleWallets(userId);
    
    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error getting user Circle wallets:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Create additional wallet for different blockchain
router.post('/wallet/additional', async (req, res) => {
  try {
    const { blockchain } = req.body;
    const userId = req.user.id;

    if (!blockchain || !['ETH', 'MATIC', 'AVAX', 'ARB'].includes(blockchain)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid blockchain. Must be ETH, MATIC, AVAX, or ARB'
      });
    }

    const result = await userCircleService.createAdditionalWallet(userId, blockchain);
    
    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error creating additional wallet:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Transfer USDC
router.post('/transfer', async (req, res) => {
  try {
    const { toAddress, amount, blockchain } = req.body;
    const userId = req.user.id;

    if (!toAddress || !amount || !blockchain) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: toAddress, amount, blockchain'
      });
    }

    if (!['ETH', 'MATIC', 'AVAX', 'ARB'].includes(blockchain)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid blockchain. Must be ETH, MATIC, AVAX, or ARB'
      });
    }

    // Validate amount is positive number
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid amount. Must be a positive number'
      });
    }

    const result = await userCircleService.transferUSDC(userId, toAddress, amount, blockchain);
    
    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error transferring USDC:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get user's transaction history
router.get('/transactions', async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await userCircleService.getUserTransactionHistory(userId);
    
    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error getting user transaction history:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get user's Circle wallet info
router.get('/wallet/info', async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get basic wallet info from database
    const userResult = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    
    if (userResult.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const user = userResult[0];
    
    if (!user.circleWalletId) {
      return res.json({
        success: true,
        hasWallet: false,
        message: 'No Circle wallet found for user'
      });
    }

    res.json({
      success: true,
      hasWallet: true,
      walletId: user.circleWalletId,
      walletSetId: user.circleWalletSetId,
      address: user.circleWalletAddress,
      blockchain: user.circleBlockchain,
      state: user.circleWalletState,
      accountType: user.circleAccountType,
      usdcBalance: user.usdcBalance
    });
  } catch (error) {
    console.error('Error getting user wallet info:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;