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

/**
 * GET /api/circle/investigate-transaction/:txHash
 * Investigate specific transaction hash across all wallets
 */
router.get('/investigate-transaction/:txHash', async (req, res) => {
  try {
    const { txHash } = req.params;
    console.log(`🔍 Investigating transaction: ${txHash}`);
    
    const investigation = {
      txHash: txHash,
      timestamp: new Date().toISOString(),
      walletSets: [],
      findings: []
    };
    
    // Get all wallet sets
    const walletSets = await circleService.listWalletSets();
    console.log(`Found ${walletSets.length} wallet sets`);
    
    for (const walletSet of walletSets) {
      const walletSetInfo = {
        id: walletSet.id,
        name: walletSet.name,
        wallets: []
      };
      
      // Get wallets in this set
      const wallets = await circleService.listWallets(walletSet.id);
      console.log(`Wallet set ${walletSet.name} has ${wallets.length} wallets`);
      
      for (const wallet of wallets) {
        const walletInfo = {
          id: wallet.id,
          address: wallet.address,
          blockchain: wallet.blockchain,
          state: wallet.state,
          usdcBalance: '0.00000000',
          transactions: [],
          matchingTransaction: null
        };
        
        try {
          // Get balance
          const balances = await circleService.getWalletBalance(wallet.id);
          const usdcBalance = balances.find(b => b.tokenId === 'USDC')?.amount || '0.00000000';
          walletInfo.usdcBalance = usdcBalance;
          
          // Get recent transactions
          const transactions = await circleService.listTransactions(wallet.id, 20);
          walletInfo.transactions = transactions.map(tx => ({
            id: tx.id,
            type: tx.transactionType,
            amount: tx.amount,
            tokenId: tx.tokenId,
            state: tx.state,
            txHash: tx.txHash,
            createDate: tx.createDate
          }));
          
          // Check for matching transaction
          const matchingTx = transactions.find(tx => tx.txHash === txHash);
          if (matchingTx) {
            walletInfo.matchingTransaction = matchingTx;
            investigation.findings.push({
              type: 'TRANSACTION_FOUND',
              walletId: wallet.id,
              address: wallet.address,
              transaction: matchingTx,
              message: `Found matching transaction in wallet ${wallet.address}`
            });
            console.log(`🎯 Found matching transaction in wallet ${wallet.address}`);
          }
          
        } catch (error: any) {
          investigation.findings.push({
            type: 'ERROR',
            walletId: wallet.id,
            address: wallet.address,
            error: error.message,
            message: `Error checking wallet ${wallet.address}: ${error.message}`
          });
        }
        
        walletSetInfo.wallets.push(walletInfo);
      }
      
      investigation.walletSets.push(walletSetInfo);
    }
    
    res.json({
      success: true,
      investigation: investigation
    });
    
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to investigate transaction',
      message: error.message
    });
  }
});

export default router;