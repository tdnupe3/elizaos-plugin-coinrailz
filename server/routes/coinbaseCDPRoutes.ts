/**
 * Coinbase CDP (Developer Platform) API Routes
 * Handles wallet creation, balance monitoring, and transactions
 */

import { Router } from 'express';
import { coinbaseCDPService } from '../services/coinbaseCDPService';
import { coinbaseOAuthService } from '../services/coinbaseOAuthService';
import { isAuthenticated } from '../replitAuth';

const router = Router();

// Create CDP wallet for authenticated user
router.post('/wallet/create', isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as any)?.claims?.sub;
    const { network = 'base-mainnet' } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const wallet = await coinbaseCDPService.createWallet(userId, network);
    
    res.json({
      success: true,
      wallet: {
        id: wallet.id,
        address: wallet.address,
        network: wallet.network,
        status: 'active',
        created_at: wallet.created_at
      },
      message: 'CDP wallet created successfully'
    });
  } catch (error) {
    console.error('CDP wallet creation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create CDP wallet'
    });
  }
});

// Get wallet balances
router.get('/wallet/:walletId/balances', isAuthenticated, async (req, res) => {
  try {
    const { walletId } = req.params;
    
    if (!walletId) {
      return res.status(400).json({
        success: false,
        error: 'Wallet ID required'
      });
    }

    const balances = await coinbaseCDPService.getWalletBalances(walletId);
    
    res.json({
      success: true,
      balances,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('CDP balance retrieval error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve wallet balances'
    });
  }
});

// Send transaction
router.post('/wallet/:walletId/send', isAuthenticated, async (req, res) => {
  try {
    const { walletId } = req.params;
    const { toAddress, amount, currency = 'ETH' } = req.body;
    
    if (!walletId || !toAddress || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Wallet ID, recipient address, and amount required'
      });
    }

    const transaction = await coinbaseCDPService.sendTransaction(
      walletId,
      toAddress,
      amount,
      currency
    );
    
    res.json({
      success: true,
      transaction: {
        id: transaction.id,
        type: transaction.type,
        amount: transaction.amount,
        currency: transaction.currency,
        to_address: transaction.to_address,
        status: transaction.status,
        created_at: transaction.created_at
      },
      message: 'Transaction initiated successfully'
    });
  } catch (error) {
    console.error('CDP transaction error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send transaction'
    });
  }
});

// Get transaction history
router.get('/wallet/:walletId/transactions', isAuthenticated, async (req, res) => {
  try {
    const { walletId } = req.params;
    
    if (!walletId) {
      return res.status(400).json({
        success: false,
        error: 'Wallet ID required'
      });
    }

    const transactions = await coinbaseCDPService.getTransactionHistory(walletId);
    
    res.json({
      success: true,
      transactions,
      count: transactions.length
    });
  } catch (error) {
    console.error('CDP transaction history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve transaction history'
    });
  }
});

// Get supported networks
router.get('/networks', async (req, res) => {
  try {
    const networks = await coinbaseCDPService.getSupportedNetworks();
    
    res.json({
      success: true,
      networks
    });
  } catch (error) {
    console.error('CDP networks error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve supported networks'
    });
  }
});

// Get supported assets for a network
router.get('/networks/:network/assets', async (req, res) => {
  try {
    const { network } = req.params;
    const assets = await coinbaseCDPService.getSupportedAssets(network);
    
    res.json({
      success: true,
      network,
      assets
    });
  } catch (error) {
    console.error('CDP assets error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve supported assets'
    });
  }
});

// OAuth Routes
// Start OAuth flow
router.get('/oauth/authorize', isAuthenticated, (req, res) => {
  try {
    const userId = (req.user as any)?.claims?.sub;
    const state = `${userId}_${Date.now()}`;
    const authUrl = coinbaseOAuthService.getAuthorizationUrl(state);
    
    res.json({
      success: true,
      authorization_url: authUrl,
      state
    });
  } catch (error) {
    console.error('CDP OAuth authorization error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate authorization URL'
    });
  }
});

// OAuth callback handler
router.get('/oauth/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!code || typeof code !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Authorization code required'
      });
    }

    const tokens = await coinbaseOAuthService.exchangeCodeForToken(code);
    const userProfile = await coinbaseOAuthService.getUserProfile(tokens.access_token);
    
    // Here you would typically store the tokens in the database
    // For now, return the success response
    res.json({
      success: true,
      message: 'OAuth authorization successful',
      user: {
        id: userProfile.id,
        name: userProfile.name,
        email: userProfile.email
      },
      expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    });
  } catch (error) {
    console.error('CDP OAuth callback error:', error);
    res.status(500).json({
      success: false,
      error: 'OAuth authorization failed'
    });
  }
});

// Get user's Coinbase accounts
router.get('/oauth/accounts', isAuthenticated, async (req, res) => {
  try {
    // In a real implementation, you would fetch the stored access token from the database
    // For now, return a mock response to demonstrate the structure
    res.json({
      success: true,
      accounts: [
        {
          id: "primary",
          name: "ETH Wallet",
          type: "wallet",
          currency: "ETH",
          balance: "0.5234",
          primary: true
        },
        {
          id: "usdc_wallet", 
          name: "USD Coin",
          type: "wallet",
          currency: "USDC",
          balance: "1250.00",
          primary: false
        }
      ],
      message: 'Access token required for live data'
    });
  } catch (error) {
    console.error('CDP OAuth accounts error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve Coinbase accounts'
    });
  }
});

// CDP service health check
router.get('/health', (req, res) => {
  try {
    res.json({
      success: true,
      service: 'Coinbase CDP Integration',
      status: 'operational',
      features: [
        'Wallet Creation',
        'Balance Monitoring', 
        'Transaction Management',
        'OAuth Integration',
        'Multi-Network Support'
      ],
      supported_networks: [
        'base-mainnet',
        'ethereum-mainnet',
        'polygon-mainnet',
        'arbitrum-mainnet'
      ],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('CDP health check error:', error);
    res.status(500).json({
      success: false,
      error: 'CDP service health check failed'
    });
  }
});

export default router;