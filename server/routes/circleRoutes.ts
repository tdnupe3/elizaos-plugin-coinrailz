/**
 * Circle USDC Integration API Routes
 * Implements comprehensive Circle Developer-Controlled Wallets endpoints
 */

import express from 'express';
import CircleService from '../services/circleService.js';
import { z } from 'zod';

const router = express.Router();
const circleService = new CircleService();

// Request validation schemas
const createWalletSetSchema = z.object({
  name: z.string().min(1).max(100).optional()
});

const createWalletSchema = z.object({
  walletSetId: z.string().min(1),
  blockchain: z.enum(['ETH', 'MATIC', 'AVAX', 'ARB']).optional(),
  accountType: z.enum(['SCA', 'EOA']).optional()
});

const createTransferSchema = z.object({
  walletId: z.string().min(1),
  destinationAddress: z.string().min(1),
  amount: z.string().min(1),
  tokenId: z.string().min(1).optional()
});

const registerEntitySecretSchema = z.object({
  entitySecret: z.string().min(64).max(64) // 32 bytes in hex = 64 characters
});

/**
 * GET /api/circle/health
 * Get Circle service health status
 */
router.get('/health', async (req, res) => {
  try {
    const healthStatus = circleService.getHealthStatus();
    res.json({
      success: true,
      service: 'Circle USDC Integration',
      status: healthStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to get health status',
      message: error.message
    });
  }
});

/**
 * POST /api/circle/entity-secret/register
 * Register entity secret with Circle
 */
router.post('/entity-secret/register', async (req, res) => {
  try {
    const { entitySecret } = registerEntitySecretSchema.parse(req.body);
    
    const result = await circleService.registerEntitySecret(entitySecret);
    
    res.json({
      success: true,
      message: 'Entity secret registered successfully',
      recoveryFile: result.recoveryFile
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: 'Failed to register entity secret',
      message: error.message
    });
  }
});

/**
 * GET /api/circle/entity-secret/generate
 * Generate a new entity secret
 */
router.get('/entity-secret/generate', (req, res) => {
  try {
    const entitySecret = CircleService.generateEntitySecret();
    
    res.json({
      success: true,
      entitySecret: entitySecret,
      note: 'Store this secret securely - it cannot be recovered if lost'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to generate entity secret',
      message: error.message
    });
  }
});

/**
 * GET /api/circle/public-key
 * Get Circle's public key for entity secret encryption
 */
router.get('/public-key', async (req, res) => {
  try {
    const publicKey = await circleService.getPublicKey();
    
    res.json({
      success: true,
      publicKey: publicKey
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: 'Failed to get public key',
      message: error.message
    });
  }
});

/**
 * POST /api/circle/wallet-set/create
 * Create a new wallet set
 */
router.post('/wallet-set/create', async (req, res) => {
  try {
    const { name } = createWalletSetSchema.parse(req.body);
    
    const walletSet = await circleService.createWalletSet(name);
    
    res.json({
      success: true,
      walletSet: walletSet
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: 'Failed to create wallet set',
      message: error.message
    });
  }
});

/**
 * POST /api/circle/wallet/create
 * Create a new wallet within a wallet set
 */
router.post('/wallet/create', async (req, res) => {
  try {
    const { walletSetId, blockchain, accountType } = createWalletSchema.parse(req.body);
    
    const wallet = await circleService.createWallet(
      walletSetId,
      blockchain || 'ETH',
      accountType || 'SCA'
    );
    
    res.json({
      success: true,
      wallet: wallet
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: 'Failed to create wallet',
      message: error.message
    });
  }
});

/**
 * GET /api/circle/wallet/:walletId
 * Get wallet details
 */
router.get('/wallet/:walletId', async (req, res) => {
  try {
    const { walletId } = req.params;
    
    const wallet = await circleService.getWallet(walletId);
    
    res.json({
      success: true,
      wallet: wallet
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: 'Failed to get wallet',
      message: error.message
    });
  }
});

/**
 * GET /api/circle/wallet/:walletId/balance
 * Get wallet balance
 */
router.get('/wallet/:walletId/balance', async (req, res) => {
  try {
    const { walletId } = req.params;
    
    const balances = await circleService.getWalletBalance(walletId);
    
    res.json({
      success: true,
      balances: balances
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: 'Failed to get wallet balance',
      message: error.message
    });
  }
});

/**
 * GET /api/circle/wallet-set/:walletSetId/wallets
 * List all wallets in a wallet set
 */
router.get('/wallet-set/:walletSetId/wallets', async (req, res) => {
  try {
    const { walletSetId } = req.params;
    
    const wallets = await circleService.listWallets(walletSetId);
    
    res.json({
      success: true,
      wallets: wallets
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: 'Failed to list wallets',
      message: error.message
    });
  }
});

/**
 * POST /api/circle/transfer
 * Create a USDC transfer transaction
 */
router.post('/transfer', async (req, res) => {
  try {
    const { walletId, destinationAddress, amount, tokenId } = createTransferSchema.parse(req.body);
    
    const transaction = await circleService.createTransfer(
      walletId,
      destinationAddress,
      amount,
      tokenId || 'USDC'
    );
    
    res.json({
      success: true,
      transaction: transaction
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: 'Failed to create transfer',
      message: error.message
    });
  }
});

/**
 * GET /api/circle/transaction/:transactionId
 * Get transaction details
 */
router.get('/transaction/:transactionId', async (req, res) => {
  try {
    const { transactionId } = req.params;
    
    const transaction = await circleService.getTransaction(transactionId);
    
    res.json({
      success: true,
      transaction: transaction
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: 'Failed to get transaction',
      message: error.message
    });
  }
});

/**
 * GET /api/circle/wallet/:walletId/transactions
 * List transactions for a wallet
 */
router.get('/wallet/:walletId/transactions', async (req, res) => {
  try {
    const { walletId } = req.params;
    
    const transactions = await circleService.listTransactions(walletId);
    
    res.json({
      success: true,
      transactions: transactions
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: 'Failed to list transactions',
      message: error.message
    });
  }
});

/**
 * GET /api/circle/supported-blockchains
 * Get supported blockchains
 */
router.get('/supported-blockchains', async (req, res) => {
  try {
    const blockchains = await circleService.getSupportedBlockchains();
    
    res.json({
      success: true,
      blockchains: blockchains
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to get supported blockchains',
      message: error.message
    });
  }
});

/**
 * GET /api/circle/supported-tokens
 * Get supported tokens
 */
router.get('/supported-tokens', async (req, res) => {
  try {
    const tokens = await circleService.getSupportedTokens();
    
    res.json({
      success: true,
      tokens: tokens
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to get supported tokens',
      message: error.message
    });
  }
});

/**
 * POST /api/circle/usdc/payment
 * Process USDC payment (for AI marketplace, P2P transfers, etc.)
 */
router.post('/usdc/payment', async (req, res) => {
  try {
    const { walletId, destinationAddress, amount, purpose } = req.body;
    
    // Validate required fields
    if (!walletId || !destinationAddress || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: walletId, destinationAddress, amount'
      });
    }
    
    // Create USDC transfer
    const transaction = await circleService.createTransfer(
      walletId,
      destinationAddress,
      amount,
      'USDC'
    );
    
    res.json({
      success: true,
      transaction: transaction,
      purpose: purpose || 'USDC Payment',
      message: 'USDC payment initiated successfully'
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: 'Failed to process USDC payment',
      message: error.message
    });
  }
});

export default router;