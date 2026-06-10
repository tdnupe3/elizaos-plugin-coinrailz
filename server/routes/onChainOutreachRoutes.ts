import { Router, Request, Response, NextFunction } from 'express';
import { onChainX402Outreach } from '../services/onChainX402Outreach';

const router = Router();

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const key = req.headers['x-admin-key'] as string | undefined;
  if (key && key === process.env.ADMIN_KEY) return next();
  return res.status(401).json({ error: 'Admin authentication required. Pass X-Admin-Key header.' });
}

/**
 * POST /api/onchain-outreach/execute
 * Execute on-chain outreach to active x402 AI agents
 */
router.post('/execute', requireAdmin, async (req, res) => {
  try {
    const { targetWallets, batchSize } = req.body;
    
    console.log('🚀 Executing on-chain x402 agent outreach...');
    
    const results = await onChainX402Outreach.executeMassOutreach(
      targetWallets,
      batchSize || 10
    );
    
    res.json({
      success: true,
      campaign: 'on_chain_x402_outreach',
      network: 'Base',
      results: {
        walletsTargeted: results.totalTargeted,
        messagesSent: results.successfulSends,
        failed: results.failedSends,
        successRate: results.totalTargeted > 0 
          ? `${Math.round((results.successfulSends / results.totalTargeted) * 100)}%`
          : '0%',
        totalCost: results.totalCost,
        costPerMessage: results.successfulSends > 0
          ? `$${(parseFloat(results.totalCost.replace('$', '')) / results.successfulSends).toFixed(4)}`
          : '$0.00'
      },
      transactions: results.transactions.slice(0, 10),
      message: `Sent on-chain messages to ${results.successfulSends} active x402 AI agents on Base`,
      nextSteps: [
        'Monitor x402 service endpoints for incoming payment requests',
        'Check wallet for USDC payments',
        'View full transaction list in outreach_logs table'
      ]
    });
    
  } catch (error: any) {
    console.error('❌ On-chain outreach failed:', error);
    res.status(500).json({
      success: false,
      error: 'On-chain outreach execution failed',
      details: error.message
    });
  }
});

/**
 * GET /api/onchain-outreach/discover
 * Discover active x402 wallets from Base chain activity
 */
router.get('/discover', requireAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    
    console.log(`🔍 Discovering active x402 wallets (limit: ${limit})...`);
    
    const wallets = await onChainX402Outreach.discoverActiveX402Wallets(limit);
    
    res.json({
      success: true,
      walletsFound: wallets.length,
      wallets: wallets,
      network: 'Base',
      criteria: 'Wallets making 3+ USDC micropayments (<$10 avg) in last 1000 blocks',
      message: `Discovered ${wallets.length} active x402 agent wallets on Base chain`,
      estimatedCost: `$${(wallets.length * 0.01).toFixed(2)} to message all`
    });
    
  } catch (error: any) {
    console.error('❌ Wallet discovery failed:', error);
    res.status(500).json({
      success: false,
      error: 'Wallet discovery failed',
      details: error.message
    });
  }
});

/**
 * POST /api/onchain-outreach/send-to-wallet
 * Send message to a specific wallet address
 */
router.post('/send-to-wallet', requireAdmin, async (req, res) => {
  try {
    const { walletAddress } = req.body;
    
    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        error: 'walletAddress is required'
      });
    }
    
    console.log(`📤 Sending on-chain message to ${walletAddress}...`);
    
    const result = await onChainX402Outreach.sendOnChainMessage(walletAddress);
    
    if (result.success) {
      res.json({
        success: true,
        wallet: walletAddress,
        txHash: result.txHash,
        network: 'Base',
        cost: result.cost,
        message: `On-chain message sent successfully`,
        explorerUrl: `https://basescan.org/tx/${result.txHash}`
      });
    } else {
      res.status(500).json({
        success: false,
        wallet: walletAddress,
        error: result.error
      });
    }
    
  } catch (error: any) {
    console.error('❌ Message send failed:', error);
    res.status(500).json({
      success: false,
      error: 'Message send failed',
      details: error.message
    });
  }
});

export default router;
