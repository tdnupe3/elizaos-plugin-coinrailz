import { Router } from 'express';
import { P2PTransferService } from '../services/p2pTransferService';

const router = Router();

/**
 * POST /api/p2p/initiate
 * Initiate a P2P transfer with profitable fee structure
 */
router.post('/initiate', async (req, res) => {
  try {
    const {
      senderMethod,
      recipientPlatform,
      recipientIdentifier,
      amount,
      message,
      paymentIntentId
    } = req.body;

    // Validate required fields
    if (!senderMethod || !recipientPlatform || !recipientIdentifier || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: senderMethod, recipientPlatform, recipientIdentifier, amount'
      });
    }

    // Validate amount
    const transferAmount = parseFloat(amount);
    if (isNaN(transferAmount) || transferAmount < 2.50) {
      return res.status(400).json({
        success: false,
        error: 'Minimum transfer amount is $2.50'
      });
    }

    // Process transfer
    const result = await P2PTransferService.initiateTransfer({
      senderMethod,
      recipientPlatform,
      recipientIdentifier,
      amount: transferAmount,
      message,
      paymentIntentId
    });

    if (result.success) {
      res.json({
        success: true,
        transferId: result.transferId,
        amount: transferAmount,
        fee: result.fee,
        total: result.total,
        estimatedDelivery: result.estimatedDelivery,
        message: 'Transfer initiated successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        fee: result.fee,
        total: result.total
      });
    }

  } catch (error) {
    console.error('P2P initiate error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/p2p/calculate-fee
 * Calculate P2P transfer fee
 */
router.post('/calculate-fee', async (req, res) => {
  try {
    const { amount, senderMethod } = req.body;

    if (!amount) {
      return res.status(400).json({
        success: false,
        error: 'Amount is required'
      });
    }

    const transferAmount = parseFloat(amount);
    if (isNaN(transferAmount) || transferAmount < 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid amount'
      });
    }

    const fee = P2PTransferService.calculateP2PFee(transferAmount, senderMethod || 'stripe');
    const total = transferAmount + fee;

    res.json({
      success: true,
      amount: transferAmount,
      fee: fee,
      total: total,
      feeStructure: {
        description: transferAmount < 25 ? 'Small transfer (3.5% + $2.00)' :
                    transferAmount < 50 ? 'Medium transfer (3.2% + $1.10)' :
                    'Large transfer (3.2% + $0.35)',
        processingCostCovered: true,
        profitMargin: transferAmount < 25 ? '74.9%' :
                     transferAmount < 50 ? '46.1%' : '9.9%'
      }
    });

  } catch (error) {
    console.error('P2P fee calculation error:', error);
    res.status(500).json({
      success: false,
      error: 'Fee calculation failed'
    });
  }
});

/**
 * GET /api/p2p/status/:transferId
 * Get transfer status
 */
router.get('/status/:transferId', async (req, res) => {
  try {
    const { transferId } = req.params;

    if (!transferId) {
      return res.status(400).json({
        success: false,
        error: 'Transfer ID is required'
      });
    }

    const status = await P2PTransferService.getTransferStatus(transferId);

    res.json({
      success: true,
      transferId,
      ...status
    });

  } catch (error) {
    console.error('P2P status error:', error);
    res.status(500).json({
      success: false,
      error: 'Status check failed'
    });
  }
});

/**
 * GET /api/p2p/supported-platforms
 * Get list of supported platforms
 */
router.get('/supported-platforms', (req, res) => {
  res.json({
    success: true,
    platforms: {
      senders: [
        { id: 'paypal', name: 'PayPal', available: true, processingFee: '2.9% + $0.30' },
        { id: 'credit', name: 'Credit Card', available: true, processingFee: '2.9% + $0.30' },
        { id: 'debit', name: 'Debit Card', available: true, processingFee: '2.9% + $0.30' },
        { id: 'crypto', name: 'Cryptocurrency', available: true, processingFee: '~$0.001' },
        { id: 'coinrailz', name: 'Coin Railz Balance', available: true, processingFee: '$0' },
        { id: 'bank', name: 'Bank Account', available: false, processingFee: 'Coming Soon' }
      ],
      recipients: [
        { id: 'paypal', name: 'PayPal', available: true, deliveryTime: 'Instant' },
        { id: 'crypto', name: 'Crypto Wallet', available: true, deliveryTime: '5-15 minutes' },
        { id: 'coinrailz', name: 'Coin Railz User', available: true, deliveryTime: 'Instant' },
        { id: 'zelle', name: 'Zelle', available: false, deliveryTime: 'Coming Soon' },
        { id: 'venmo', name: 'Venmo', available: false, deliveryTime: 'Coming Soon' },
        { id: 'cashapp', name: 'Cash App', available: false, deliveryTime: 'Coming Soon' },
        { id: 'bank', name: 'Bank Transfer', available: false, deliveryTime: 'Coming Soon' }
      ]
    }
  });
});

export default router;