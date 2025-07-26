import express from 'express';
import { enhancedPlaidService } from '../services/enhancedPlaidService';
import { requireAuth } from '../middleware/authMiddleware';

const router = express.Router();

/**
 * Create Link Token for bank account connection
 */
router.post('/link/create-token', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id || 'user_' + Date.now();
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const result = await enhancedPlaidService.createLinkToken(userId);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Create link token error:', error);
    res.status(500).json({ 
      error: 'Failed to create link token',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Exchange public token for access token
 */
router.post('/link/exchange-token', requireAuth, async (req, res) => {
  try {
    const { publicToken } = req.body;
    if (!publicToken) {
      return res.status(400).json({ error: 'Public token required' });
    }

    const result = await enhancedPlaidService.exchangePublicToken(publicToken);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Exchange token error:', error);
    res.status(500).json({ 
      error: 'Failed to exchange token',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get user's linked bank accounts
 */
router.get('/accounts', requireAuth, async (req, res) => {
  try {
    const { accessToken } = req.query;
    if (!accessToken) {
      return res.status(400).json({ error: 'Access token required' });
    }

    const accounts = await enhancedPlaidService.getBankAccounts(accessToken as string);
    res.json({ success: true, accounts });
  } catch (error) {
    console.error('Get accounts error:', error);
    res.status(500).json({ 
      error: 'Failed to get accounts',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Perform KYC verification
 */
router.post('/kyc/verify', requireAuth, async (req, res) => {
  try {
    const { accessToken } = req.body;
    const userEmail = (req as any).user?.email || 'user@example.com';
    
    if (!accessToken || !userEmail) {
      return res.status(400).json({ error: 'Access token and user email required' });
    }

    const kycResult = await enhancedPlaidService.performKYC(accessToken, userEmail);
    res.json({ success: true, kyc: kycResult });
  } catch (error) {
    console.error('KYC verification error:', error);
    res.status(500).json({ 
      error: 'Failed to perform KYC',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Initiate ACH transfer from user bank to platform
 */
router.post('/transfer/deposit', requireAuth, async (req, res) => {
  try {
    const { accessToken, accountId, amount, description } = req.body;
    
    if (!accessToken || !accountId || !amount) {
      return res.status(400).json({ error: 'Access token, account ID, and amount required' });
    }

    const transfer = await enhancedPlaidService.initiateACHDebit(
      accessToken, 
      accountId, 
      parseFloat(amount), 
      description || 'Coin Railz deposit'
    );
    
    res.json({ success: true, transfer });
  } catch (error) {
    console.error('ACH deposit error:', error);
    res.status(500).json({ 
      error: 'Failed to initiate deposit',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Initiate ACH transfer from platform to user bank
 */
router.post('/transfer/withdrawal', requireAuth, async (req, res) => {
  try {
    const { accessToken, accountId, amount, description } = req.body;
    
    if (!accessToken || !accountId || !amount) {
      return res.status(400).json({ error: 'Access token, account ID, and amount required' });
    }

    const transfer = await enhancedPlaidService.initiateACHCredit(
      accessToken, 
      accountId, 
      parseFloat(amount), 
      description || 'Coin Railz withdrawal'
    );
    
    res.json({ success: true, transfer });
  } catch (error) {
    console.error('ACH withdrawal error:', error);
    res.status(500).json({ 
      error: 'Failed to initiate withdrawal',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Check transfer status
 */
router.get('/transfer/status/:transferId', requireAuth, async (req, res) => {
  try {
    const { transferId } = req.params;
    const transfer = await enhancedPlaidService.getTransferStatus(transferId);
    res.json({ success: true, transfer });
  } catch (error) {
    console.error('Transfer status error:', error);
    res.status(500).json({ 
      error: 'Failed to get transfer status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get account balance
 */
router.get('/account/balance', requireAuth, async (req, res) => {
  try {
    const { accessToken, accountId } = req.query;
    
    if (!accessToken || !accountId) {
      return res.status(400).json({ error: 'Access token and account ID required' });
    }

    const balance = await enhancedPlaidService.getAccountBalance(
      accessToken as string, 
      accountId as string
    );
    
    res.json({ success: true, balance });
  } catch (error) {
    console.error('Account balance error:', error);
    res.status(500).json({ 
      error: 'Failed to get account balance',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Verify account ownership
 */
router.post('/account/verify', requireAuth, async (req, res) => {
  try {
    const { accessToken, accountId } = req.body;
    
    if (!accessToken || !accountId) {
      return res.status(400).json({ error: 'Access token and account ID required' });
    }

    const verification = await enhancedPlaidService.verifyAccountOwnership(accessToken, accountId);
    res.json({ success: true, verification });
  } catch (error) {
    console.error('Account verification error:', error);
    res.status(500).json({ 
      error: 'Failed to verify account',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Health check
 */
router.get('/health', async (req, res) => {
  try {
    const health = await enhancedPlaidService.healthCheck();
    res.json({ success: true, service: 'Plaid Banking Integration', ...health });
  } catch (error) {
    console.error('Plaid health check error:', error);
    res.status(500).json({ 
      error: 'Plaid service health check failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;