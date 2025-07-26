import express from 'express';
import { coinflipService } from '../services/coinflipService';
import { requireAuth } from '../middleware/authMiddleware';

const router = express.Router();

/**
 * Get quote for USD to USDC conversion
 */
router.post('/quote/buy', requireAuth, async (req, res) => {
  try {
    const { usdAmount } = req.body;
    
    if (!usdAmount || usdAmount <= 0) {
      return res.status(400).json({ error: 'Valid USD amount required' });
    }

    const quote = await coinflipService.getUSDCBuyQuote(parseFloat(usdAmount));
    res.json({ success: true, quote });
  } catch (error) {
    console.error('Buy quote error:', error);
    res.status(500).json({ 
      error: 'Failed to get buy quote',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get quote for USDC to USD conversion
 */
router.post('/quote/sell', requireAuth, async (req, res) => {
  try {
    const { usdcAmount } = req.body;
    
    if (!usdcAmount || usdcAmount <= 0) {
      return res.status(400).json({ error: 'Valid USDC amount required' });
    }

    const quote = await coinflipService.getUSDCSellQuote(parseFloat(usdcAmount));
    res.json({ success: true, quote });
  } catch (error) {
    console.error('Sell quote error:', error);
    res.status(500).json({ 
      error: 'Failed to get sell quote',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Execute USD to USDC purchase order
 */
router.post('/order/buy', requireAuth, async (req, res) => {
  try {
    const { quoteId, bankAccountId, walletAddress } = req.body;
    
    if (!quoteId || !bankAccountId || !walletAddress) {
      return res.status(400).json({ error: 'Quote ID, bank account ID, and wallet address required' });
    }

    const transaction = await coinflipService.executeBuyOrder(quoteId, bankAccountId, walletAddress);
    res.json({ success: true, transaction });
  } catch (error) {
    console.error('Buy order error:', error);
    res.status(500).json({ 
      error: 'Failed to execute buy order',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Execute USDC to USD sale order
 */
router.post('/order/sell', requireAuth, async (req, res) => {
  try {
    const { quoteId, walletAddress, bankAccountId } = req.body;
    
    if (!quoteId || !walletAddress || !bankAccountId) {
      return res.status(400).json({ error: 'Quote ID, wallet address, and bank account ID required' });
    }

    const transaction = await coinflipService.executeSellOrder(quoteId, walletAddress, bankAccountId);
    res.json({ success: true, transaction });
  } catch (error) {
    console.error('Sell order error:', error);
    res.status(500).json({ 
      error: 'Failed to execute sell order',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get transaction status
 */
router.get('/transaction/:transactionId', requireAuth, async (req, res) => {
  try {
    const { transactionId } = req.params;
    const transaction = await coinflipService.getTransactionStatus(transactionId);
    res.json({ success: true, transaction });
  } catch (error) {
    console.error('Transaction status error:', error);
    res.status(500).json({ 
      error: 'Failed to get transaction status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get supported payment methods
 */
router.get('/payment-methods', async (req, res) => {
  try {
    const methods = await coinflipService.getSupportedPaymentMethods();
    res.json({ success: true, paymentMethods: methods });
  } catch (error) {
    console.error('Payment methods error:', error);
    res.status(500).json({ 
      error: 'Failed to get payment methods',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Health check
 */
router.get('/health', async (req, res) => {
  try {
    const health = await coinflipService.healthCheck();
    res.json({ success: true, service: 'CoinFlip On/Off Ramp', ...health });
  } catch (error) {
    console.error('CoinFlip health check error:', error);
    res.status(500).json({ 
      error: 'CoinFlip service health check failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;