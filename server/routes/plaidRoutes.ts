import { Router } from 'express';
import { plaidService } from '../services/plaidService';
// Import existing auth middleware
import { requireAuth } from '../middleware/requireAuth';

const router = Router();

// Create link token for Plaid Link
router.post('/create-link-token', requireAuth, async (req, res) => {
  try {
    if (!plaidService.isReady()) {
      return res.status(503).json({ 
        error: 'Bank linking temporarily unavailable - Plaid configuration pending' 
      });
    }

    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const linkToken = await plaidService.createLinkToken(userId.toString());
    res.json(linkToken);
  } catch (error) {
    console.error('Error creating link token:', error);
    res.status(500).json({ error: 'Failed to create link token' });
  }
});

// Exchange public token for access token
router.post('/exchange-token', requireAuth, async (req, res) => {
  try {
    if (!plaidService.isReady()) {
      return res.status(503).json({ 
        error: 'Bank linking temporarily unavailable' 
      });
    }

    const { public_token } = req.body;
    if (!public_token) {
      return res.status(400).json({ error: 'Public token required' });
    }

    const result = await plaidService.exchangePublicToken(public_token);
    
    // TODO: Store access token securely in database associated with user
    // For now, return the tokens (in production, only return success status)
    res.json({
      success: true,
      item_id: result.itemId,
      // Note: In production, don't return access_token to client
      access_token: result.accessToken
    });
  } catch (error) {
    console.error('Error exchanging token:', error);
    res.status(500).json({ error: 'Failed to exchange token' });
  }
});

// Get connected bank account balances
router.get('/accounts', requireAuth, async (req, res) => {
  try {
    if (!plaidService.isReady()) {
      return res.status(503).json({ 
        error: 'Bank account access temporarily unavailable' 
      });
    }

    // TODO: Retrieve user's stored access token from database
    const accessToken = req.headers['x-access-token'] as string;
    if (!accessToken) {
      return res.status(400).json({ error: 'Bank account not connected' });
    }

    const accounts = await plaidService.getAccountBalances(accessToken);
    res.json({ accounts });
  } catch (error) {
    console.error('Error getting accounts:', error);
    res.status(500).json({ error: 'Failed to retrieve accounts' });
  }
});

// Initiate ACH transfer from bank account
router.post('/transfer', requireAuth, async (req, res) => {
  try {
    if (!plaidService.isReady()) {
      return res.status(503).json({ 
        error: 'Bank transfers temporarily unavailable' 
      });
    }

    const { account_id, amount } = req.body;
    if (!account_id || !amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid account ID and amount required' });
    }

    // TODO: Retrieve user's stored access token from database
    const accessToken = req.headers['x-access-token'] as string;
    if (!accessToken) {
      return res.status(400).json({ error: 'Bank account not connected' });
    }

    const transfer = await plaidService.initiateACHTransfer(accessToken, account_id, amount);
    
    // TODO: Store transfer record in database
    // TODO: Update user's USD balance once transfer completes
    
    res.json({
      success: true,
      transfer_id: transfer.transferId,
      status: transfer.status,
      estimated_settlement: transfer.estimatedSettlement
    });
  } catch (error) {
    console.error('Error initiating transfer:', error);
    res.status(500).json({ error: 'Failed to initiate transfer' });
  }
});

// Get Plaid service status
router.get('/status', async (req, res) => {
  res.json({
    configured: plaidService.isReady(),
    environment: process.env.PLAID_ENV || 'sandbox',
    products: ['Auth', 'Transactions'],
    message: plaidService.isReady() 
      ? 'Bank linking service operational' 
      : 'Bank linking service requires configuration'
  });
});

export default router;