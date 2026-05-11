/**
 * Circle USDC Integration API Routes
 * Implements comprehensive Circle Developer-Controlled Wallets endpoints
 *
 * SECURITY: All wallet management, transfer, and entity-secret routes require
 * admin authentication via X-Admin-Key header. Public routes (health, supported
 * tokens/blockchains) are open for discovery purposes only.
 */

import express, { Request, Response, NextFunction } from 'express';
import { CircleService } from '../services/circleService';
import { z } from 'zod';
import crypto from 'crypto';

const router = express.Router();
const circleService = new CircleService();

// --- Admin auth middleware ---
const ADMIN_API_KEY_HASH = process.env.ADMIN_API_KEY
  ? crypto.createHash('sha256').update(process.env.ADMIN_API_KEY).digest('hex')
  : null;

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-admin-key'] as string;
  const internalSecret = req.headers['x-internal-secret'] as string;

  if (process.env.INTERNAL_SERVICE_SECRET && internalSecret === process.env.INTERNAL_SERVICE_SECRET) {
    return next();
  }

  if (apiKey && ADMIN_API_KEY_HASH) {
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    if (keyHash === ADMIN_API_KEY_HASH) {
      return next();
    }
  }

  return res.status(401).json({
    success: false,
    error: 'Unauthorized',
    hint: 'Admin API key required via X-Admin-Key header',
  });
}

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
 * Public — returns service health status only
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
 * GET /api/circle/supported-blockchains
 * Public — informational only
 */
router.get('/supported-blockchains', async (req, res) => {
  try {
    const blockchains = await circleService.getSupportedBlockchains();
    res.json({ success: true, blockchains });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Failed to get supported blockchains', message: error.message });
  }
});

/**
 * GET /api/circle/supported-tokens
 * Public — informational only
 */
router.get('/supported-tokens', async (req, res) => {
  try {
    const tokens = await circleService.getSupportedTokens();
    res.json({ success: true, tokens });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Failed to get supported tokens', message: error.message });
  }
});

/**
 * GET /api/circle/public-key
 * Public — Circle's public key for entity secret encryption (not sensitive)
 */
router.get('/public-key', async (req, res) => {
  try {
    const publicKey = await circleService.getPublicKey();
    res.json({ success: true, publicKey });
  } catch (error: any) {
    res.status(400).json({ success: false, error: 'Failed to get public key', message: error.message });
  }
});

// ============================================================
// ALL ROUTES BELOW REQUIRE ADMIN AUTH
// ============================================================

/**
 * POST /api/circle/entity-secret/register
 * Admin only — registers entity secret with Circle
 */
router.post('/entity-secret/register', requireAdmin, async (req, res) => {
  try {
    const { entitySecret } = registerEntitySecretSchema.parse(req.body);
    const result = await circleService.registerEntitySecret(entitySecret);
    res.json({
      success: true,
      message: 'Entity secret registered successfully',
      recoveryFile: result.recoveryFile
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: 'Failed to register entity secret', message: error.message });
  }
});

/**
 * GET /api/circle/entity-secret/generate
 * Admin only — generates a new entity secret
 */
router.get('/entity-secret/generate', requireAdmin, async (req, res) => {
  try {
    const result = await CircleService.generateEntitySecret();
    res.json({
      success: true,
      entitySecret: result.entitySecret || 'Generated via Circle Console',
      note: 'Store this secret securely - it cannot be recovered if lost'
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Failed to generate entity secret', message: error.message });
  }
});

/**
 * POST /api/circle/wallet-set/create
 * Admin only — creates a new wallet set
 */
router.post('/wallet-set/create', requireAdmin, async (req, res) => {
  try {
    const { name } = createWalletSetSchema.parse(req.body);
    const walletSet = await circleService.createWalletSet({ name });
    res.json({ success: true, walletSet });
  } catch (error: any) {
    res.status(400).json({ success: false, error: 'Failed to create wallet set', message: error.message });
  }
});

/**
 * POST /api/circle/wallet/create
 * Admin only — creates a new wallet within a wallet set
 */
router.post('/wallet/create', requireAdmin, async (req, res) => {
  try {
    const { walletSetId, blockchain, accountType } = createWalletSchema.parse(req.body);
    const wallet = await circleService.createWallet({
      walletSetId: walletSetId || undefined,
      blockchain: blockchain || 'ETH',
      accountType: accountType || 'SCA'
    });
    res.json({ success: true, wallet });
  } catch (error: any) {
    res.status(400).json({ success: false, error: 'Failed to create wallet', message: error.message });
  }
});

/**
 * GET /api/circle/wallet/:walletId
 * Admin only — get wallet details
 */
router.get('/wallet/:walletId', requireAdmin, async (req, res) => {
  try {
    const { walletId } = req.params;
    const wallet = await circleService.getWallet({ walletId });
    res.json({ success: true, wallet });
  } catch (error: any) {
    res.status(400).json({ success: false, error: 'Failed to get wallet', message: error.message });
  }
});

/**
 * GET /api/circle/wallet/:walletId/balance
 * Admin only — get wallet balance
 */
router.get('/wallet/:walletId/balance', requireAdmin, async (req, res) => {
  try {
    const { walletId } = req.params;
    const balances = await circleService.getWalletBalance(walletId);
    res.json({ success: true, balances });
  } catch (error: any) {
    res.status(400).json({ success: false, error: 'Failed to get wallet balance', message: error.message });
  }
});

/**
 * GET /api/circle/wallet-set/:walletSetId/wallets
 * Admin only — list all wallets in a wallet set
 */
router.get('/wallet-set/:walletSetId/wallets', requireAdmin, async (req, res) => {
  try {
    const wallets = await circleService.listWallets();
    res.json({ success: true, wallets });
  } catch (error: any) {
    res.status(400).json({ success: false, error: 'Failed to list wallets', message: error.message });
  }
});

/**
 * POST /api/circle/transfer
 * Admin only — creates a USDC transfer transaction
 */
router.post('/transfer', requireAdmin, async (req, res) => {
  try {
    const { walletId, destinationAddress, amount, tokenId } = createTransferSchema.parse(req.body);
    const transaction = await circleService.createTransfer({
      walletId,
      destinationAddress,
      amount,
      tokenId: tokenId || 'USDC'
    });
    res.json({ success: true, transaction });
  } catch (error: any) {
    res.status(400).json({ success: false, error: 'Failed to create transfer', message: error.message });
  }
});

/**
 * GET /api/circle/transaction/:transactionId
 * Admin only — get transaction details
 */
router.get('/transaction/:transactionId', requireAdmin, async (req, res) => {
  try {
    const { transactionId } = req.params;
    const transaction = await circleService.getTransaction({ transactionId });
    res.json({ success: true, transaction });
  } catch (error: any) {
    res.status(400).json({ success: false, error: 'Failed to get transaction', message: error.message });
  }
});

/**
 * GET /api/circle/wallet/:walletId/transactions
 * Admin only — list transactions for a wallet
 */
router.get('/wallet/:walletId/transactions', requireAdmin, async (req, res) => {
  try {
    const { walletId } = req.params;
    const transactions = await circleService.listTransactions({ walletId });
    res.json({ success: true, transactions });
  } catch (error: any) {
    res.status(400).json({ success: false, error: 'Failed to list transactions', message: error.message });
  }
});

/**
 * POST /api/circle/usdc/payment
 * Admin only — processes USDC payment from a Circle developer wallet
 */
router.post('/usdc/payment', requireAdmin, async (req, res) => {
  try {
    const { walletId, destinationAddress, amount, purpose } = req.body;
    if (!walletId || !destinationAddress || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: walletId, destinationAddress, amount'
      });
    }
    const transaction = await circleService.createTransfer({
      walletId,
      destinationAddress,
      amount,
      tokenId: 'USDC'
    });
    res.json({
      success: true,
      transaction,
      purpose: purpose || 'USDC Payment',
      message: 'USDC payment initiated successfully'
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: 'Failed to process USDC payment', message: error.message });
  }
});

/**
 * GET /api/circle/investigate-transaction/:txHash
 * Admin only — investigate a transaction hash across all wallets
 */
router.get('/investigate-transaction/:txHash', requireAdmin, async (req, res) => {
  try {
    const { txHash } = req.params;
    console.log(`🔍 Investigating transaction: ${txHash}`);

    const investigation: any = {
      txHash,
      timestamp: new Date().toISOString(),
      walletSets: [],
      findings: []
    };

    const walletSets = await circleService.listWalletSets();
    console.log(`Found ${walletSets.length} wallet sets`);

    for (const walletSet of walletSets) {
      const walletSetInfo: any = { id: walletSet.id, name: walletSet.name, wallets: [] };
      const wallets = await circleService.listWallets();
      console.log(`Wallet set ${walletSet.name} has ${wallets?.data?.wallets?.length || 0} wallets`);

      for (const wallet of wallets) {
        const walletInfo: any = {
          id: wallet.id,
          address: wallet.address,
          blockchain: wallet.blockchain,
          state: wallet.state,
          usdcBalance: '0.00000000',
          transactions: [],
          matchingTransaction: null
        };

        try {
          const balances = await circleService.getWalletBalance(wallet.id);
          walletInfo.usdcBalance = balances.find((b: any) => b.tokenId === 'USDC')?.amount || '0.00000000';
          const transactionResponse = await circleService.listTransactions({ walletId: wallet.id });
          const transactions = transactionResponse?.data?.transactions || [];
          walletInfo.transactions = transactions.map((tx: any) => ({
            id: tx.id, type: tx.transactionType, amount: tx.amount,
            tokenId: tx.tokenId, state: tx.state, txHash: tx.txHash, createDate: tx.createDate
          }));
          const matchingTx = transactions.find((tx: any) => tx.txHash === txHash);
          if (matchingTx) {
            walletInfo.matchingTransaction = matchingTx;
            investigation.findings.push({
              type: 'TRANSACTION_FOUND', walletId: wallet.id, address: wallet.address,
              transaction: matchingTx, message: `Found matching transaction in wallet ${wallet.address}`
            });
            console.log(`🎯 Found matching transaction in wallet ${wallet.address}`);
          }
        } catch (error: any) {
          investigation.findings.push({
            type: 'ERROR', walletId: wallet.id, address: wallet.address,
            error: error.message, message: `Error checking wallet ${wallet.address}: ${error.message}`
          });
        }

        walletSetInfo.wallets.push(walletInfo);
      }
      investigation.walletSets.push(walletSetInfo);
    }

    res.json({ success: true, investigation });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Failed to investigate transaction', message: error.message });
  }
});

/**
 * GET /api/circle/test-connection
 * Admin only — tests Circle API connection
 */
router.get('/test-connection', requireAdmin, async (req, res) => {
  try {
    const { circleClient } = await import('../services/circleClient');
    const isConnected = await circleClient.testConnection();
    if (isConnected) {
      const wallets = await circleClient.listWallets();
      res.json({
        success: true, connected: true,
        message: 'Circle API connection successful',
        walletsCount: wallets.data?.wallets?.length || 0,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false, connected: false,
        message: 'Circle API connection failed',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error: any) {
    console.error('Circle connection test failed:', error);
    res.status(500).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
  }
});

/**
 * GET /api/circle/simple-balance/:walletId
 * Admin only — check Circle balance with simplified client
 */
router.get('/simple-balance/:walletId', requireAdmin, async (req, res) => {
  try {
    const { walletId } = req.params;
    console.log(`🔍 Checking Circle balance for wallet: ${walletId}`);
    const { circleClient } = await import('../services/circleClient');
    const data = await circleClient.getWalletBalance(walletId);
    const balances = data.data?.balances || [];
    const usdcBalance = balances.find((b: any) => b.currency === 'USD')?.amount || '0';
    res.json({
      success: true, walletId, usdcBalance,
      allBalances: balances, raw: data, timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Circle API check failed:', error);
    res.status(500).json({ success: false, error: error.message, walletId: req.params.walletId, timestamp: new Date().toISOString() });
  }
});

/**
 * GET /api/circle/wallet-sets
 * Admin only — list all wallet sets
 */
router.get('/wallet-sets', requireAdmin, async (req, res) => {
  try {
    const walletSets = await circleService.listWalletSets();
    const serializedWalletSets = JSON.parse(JSON.stringify(walletSets || []));
    res.json({ success: true, walletSets: serializedWalletSets, count: serializedWalletSets.length, message: 'Wallet sets retrieved successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Failed to list wallet sets', message: error.message || 'Unknown error' });
  }
});

/**
 * GET /api/circle/wallets
 * Admin only — list all wallets
 */
router.get('/wallets', requireAdmin, async (req, res) => {
  try {
    const wallets = await circleService.listWallets();
    const serializedWallets = JSON.parse(JSON.stringify(wallets || []));
    res.json({ success: true, wallets: serializedWallets, count: serializedWallets.length, message: 'Wallets retrieved successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Failed to list wallets', message: error.message || 'Unknown error' });
  }
});

export default router;
