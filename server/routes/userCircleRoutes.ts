import { Router } from 'express';
import { userCircleService } from '../services/userCircleService';
import { db } from '../db';
import { users } from '../../shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

// Simple auth check middleware
const checkAuth = (req: any, res: any, next: any) => {
  if (!req.user || !req.user.id) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }
  next();
};

// Create Circle wallet for authenticated user
router.post('/wallet/create', checkAuth, async (req: any, res) => {
  try {
    const { blockchain = 'ETH' } = req.body;
    const userId = (req.user as any).id;

    if (!['ETH', 'MATIC', 'AVAX', 'ARB', 'BASE', 'BNB'].includes(blockchain)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid blockchain. Must be ETH, MATIC, AVAX, ARB, BASE, or BNB'
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
router.get('/balance', checkAuth, async (req: any, res) => {
  try {
    const userId = (req.user as any).id;
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
router.get('/wallets', checkAuth, async (req: any, res) => {
  try {
    const userId = (req.user as any).id;
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
router.post('/wallet/additional', checkAuth, async (req: any, res) => {
  try {
    const { blockchain } = req.body;
    const userId = (req.user as any).id;

    if (!blockchain || !['ETH', 'MATIC', 'AVAX', 'ARB', 'BASE', 'BNB'].includes(blockchain)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid blockchain. Must be ETH, MATIC, AVAX, ARB, BASE, or BNB'
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
    const userId = (req.user as { id?: string } | undefined)?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Authentication required' });

    if (!toAddress || !amount || !blockchain) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: toAddress, amount, blockchain'
      });
    }

    if (!['ETH', 'MATIC', 'AVAX', 'ARB', 'BASE', 'BNB'].includes(blockchain)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid blockchain. Must be ETH, MATIC, AVAX, ARB, BASE, or BNB'
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
    const userId = (req.user as { id?: string } | undefined)?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Authentication required' });
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
    const userId = (req.user as { id?: string } | undefined)?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Authentication required' });
    
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

// Execute DEX swap using Circle USDC wallet
router.post('/swap', async (req, res) => {
  try {
    const { toToken, amount, slippage, chainId } = req.body;
    const userId = (req.user as { id?: string } | undefined)?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Authentication required' });

    if (!toToken || !amount || !chainId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: toToken, amount, chainId'
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

    // Validate slippage
    const numSlippage = parseFloat(slippage || '5');
    if (isNaN(numSlippage) || numSlippage < 0 || numSlippage > 50) {
      return res.status(400).json({
        success: false,
        error: 'Invalid slippage. Must be between 0 and 50'
      });
    }

    // Validate chainId
    const validChainIds = [1, 137, 43114, 42161, 8453, 56]; // ETH, MATIC, AVAX, ARB, BASE, BNB
    if (!validChainIds.includes(chainId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid chainId. Must be one of: 1 (ETH), 137 (MATIC), 43114 (AVAX), 42161 (ARB), 8453 (BASE), 56 (BNB)'
      });
    }

    const result = await userCircleService.executeCircleWalletSwap(userId, toToken, amount, numSlippage, chainId);
    
    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error executing Circle wallet swap:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;