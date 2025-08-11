/**
 * DeFi Wallet Routes - Web3 Wallet Connection & Management
 * Enterprise-grade DeFi wallet integration for Coin Railz
 */

import express from 'express';
import { DeFiWalletService } from '../services/defiWalletService';
import { isAuthenticated } from '../replitAuth';

const router = express.Router();
const defiWalletService = DeFiWalletService.getInstance();

/**
 * GET /api/defi/networks
 * Get supported networks for DeFi wallet connections
 */
router.get('/networks', isAuthenticated, async (req, res) => {
  try {
    const networks = defiWalletService.getSupportedNetworks();
    res.json({
      success: true,
      networks
    });
  } catch (error) {
    console.error('Failed to get supported networks:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve supported networks'
    });
  }
});

/**
 * POST /api/defi/wallet/connect
 * Connect a DeFi wallet to user account
 */
router.post('/wallet/connect', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const { address, chainId, walletType, signature, message } = req.body;

    if (!address || !chainId || !walletType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: address, chainId, walletType'
      });
    }

    const connection = {
      address,
      chainId: parseInt(chainId),
      walletType,
      signature,
      message
    };

    const defiWallet = await defiWalletService.connectWallet(userId, connection);
    
    res.json({
      success: true,
      wallet: defiWallet,
      message: 'DeFi wallet connected successfully'
    });

  } catch (error: any) {
    console.error('Failed to connect DeFi wallet:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to connect DeFi wallet'
    });
  }
});

/**
 * POST /api/defi/wallet/verify
 * Verify wallet ownership without connecting
 */
router.post('/wallet/verify', isAuthenticated, async (req, res) => {
  try {
    const { address, message, signature, walletType } = req.body;

    if (!address || !message || !signature || !walletType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields for verification'
      });
    }

    const isValid = await defiWalletService.verifyWalletSignature(
      address, 
      message, 
      signature, 
      walletType
    );

    res.json({
      success: true,
      isValid,
      message: isValid ? 'Wallet signature verified' : 'Invalid wallet signature'
    });

  } catch (error) {
    console.error('Failed to verify wallet signature:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify wallet signature'
    });
  }
});

/**
 * GET /api/defi/wallet/:address/balance
 * Get balance for connected DeFi wallet
 */
router.get('/wallet/:address/balance', isAuthenticated, async (req, res) => {
  try {
    const { address } = req.params;
    const { chainId } = req.query;

    if (!chainId) {
      return res.status(400).json({
        success: false,
        error: 'Chain ID is required'
      });
    }

    const balance = await defiWalletService.getWalletBalance(
      address, 
      parseInt(chainId as string)
    );

    res.json({
      success: true,
      balance
    });

  } catch (error) {
    console.error('Failed to get wallet balance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve wallet balance'
    });
  }
});

/**
 * GET /api/defi/wallet/:address/transactions
 * Get transaction history for connected DeFi wallet
 */
router.get('/wallet/:address/transactions', isAuthenticated, async (req, res) => {
  try {
    const { address } = req.params;
    const { chainId, limit } = req.query;

    if (!chainId) {
      return res.status(400).json({
        success: false,
        error: 'Chain ID is required'
      });
    }

    const transactions = await defiWalletService.getTransactionHistory(
      address,
      parseInt(chainId as string),
      limit ? parseInt(limit as string) : 10
    );

    res.json({
      success: true,
      transactions
    });

  } catch (error) {
    console.error('Failed to get transaction history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve transaction history'
    });
  }
});

/**
 * POST /api/defi/wallet/disconnect
 * Disconnect DeFi wallet from user account
 */
router.post('/wallet/disconnect', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub;
    const { walletId } = req.body;

    if (!walletId) {
      return res.status(400).json({
        success: false,
        error: 'Wallet ID is required'
      });
    }

    const success = await defiWalletService.disconnectWallet(userId, walletId);

    res.json({
      success,
      message: success ? 'Wallet disconnected successfully' : 'Failed to disconnect wallet'
    });

  } catch (error) {
    console.error('Failed to disconnect wallet:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to disconnect wallet'
    });
  }
});

/**
 * POST /api/defi/wallet/generate-message
 * Generate signature message for wallet connection
 */
router.post('/wallet/generate-message', isAuthenticated, async (req, res) => {
  try {
    const { address } = req.body;

    if (!address) {
      return res.status(400).json({
        success: false,
        error: 'Wallet address is required'
      });
    }

    const timestamp = Date.now();
    const message = defiWalletService.generateConnectionMessage(address, timestamp);

    res.json({
      success: true,
      message,
      timestamp
    });

  } catch (error) {
    console.error('Failed to generate connection message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate connection message'
    });
  }
});

export default router;