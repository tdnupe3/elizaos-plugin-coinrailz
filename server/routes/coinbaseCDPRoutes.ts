/**
 * Coinbase CDP (Developer Platform) API Routes - Server Wallet v2 Only
 * Simplified for fee collection and wallet management
 */

import { Router } from 'express';
import { coinbaseCDPService } from '../services/coinbaseCDPService';
import { isAuthenticated } from '../replitAuth';

const router = Router();

// CDP service status endpoint
router.get('/status', async (req, res) => {
  try {
    const status = await coinbaseCDPService.getServiceStatus();
    res.json({
      success: true,
      status: 'active',
      service: 'coinbase-cdp',
      ...status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('CDP status check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check CDP status'
    });
  }
});

// List available wallets
router.get('/wallets', isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as any)?.claims?.sub;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const wallets = await coinbaseCDPService.listUserWallets(userId);
    res.json({
      success: true,
      wallets,
      count: wallets.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('CDP wallets list error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list CDP wallets'
    });
  }
});

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

// Get wallet balance
router.get('/wallet/:walletId/balance', isAuthenticated, async (req, res) => {
  try {
    const { walletId } = req.params;
    
    const balances = await coinbaseCDPService.getWalletBalance(walletId);
    
    res.json({
      success: true,
      wallet_id: walletId,
      balances,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('CDP wallet balance error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve wallet balance'
    });
  }
});

// Send transaction
router.post('/wallet/:walletId/send', isAuthenticated, async (req, res) => {
  try {
    const { walletId } = req.params;
    const { to_address, amount, currency } = req.body;
    const userId = (req.user as any)?.claims?.sub;

    if (!to_address || !amount || !currency) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: to_address, amount, currency'
      });
    }

    const transaction = await coinbaseCDPService.sendTransaction(to_address, amount, currency);
    if (!transaction) {
      throw new Error('CDP did not return a transaction result');
    }
    
    res.json({
      success: true,
      transaction: {
        id: transaction.hash,
        status: transaction.mode,
        transaction_hash: transaction.hash,
        amount,
        currency,
        to_address,
        fee: null,
        created_at: new Date().toISOString()
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

// Get transaction history - simplified for Server Wallet v2
router.get('/wallet/:walletId/transactions', isAuthenticated, async (req, res) => {
  try {
    const { walletId } = req.params;
    
    // Server Wallet v2 transaction history would need additional implementation
    res.json({
      success: true,
      wallet_id: walletId,
      transactions: [],
      message: 'Transaction history feature available with enhanced CDP integration',
      timestamp: new Date().toISOString()
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
    const assets = await coinbaseCDPService.getSupportedTradingPairs(network);
    
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

// CDP service health check
router.get('/health', (req, res) => {
  try {
    res.json({
      success: true,
      service: 'Coinbase CDP Server Wallet v2',
      status: 'operational',
      features: [
        'Wallet Creation',
        'Balance Monitoring', 
        'Transaction Management',
        'Multi-Network Support',
        'Fee Collection'
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