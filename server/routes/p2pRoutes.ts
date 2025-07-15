import { Router } from 'express';
import { P2PTransferService } from '../services/p2pTransferService';

const router = Router();

/**
 * POST /api/p2p/quote
 * Generate P2P transfer quote with fee calculation
 */
router.post('/quote', async (req, res) => {
  try {
    const { 
      amount, 
      fromMethod, 
      toMethod,
      fromPlatform, 
      toPlatform
    } = req.body;
    
    // Support both parameter naming conventions
    const senderMethod = fromMethod || fromPlatform;
    const recipientMethod = toMethod || toPlatform;
    
    if (!amount || !senderMethod || !recipientMethod) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: amount, fromMethod, toMethod'
      });
    }

    const transferAmount = parseFloat(amount);
    if (isNaN(transferAmount) || transferAmount < 1) {
      return res.status(400).json({
        success: false,
        error: 'Minimum transfer amount is $1'
      });
    }

    // Calculate fees based on USDC usage (updated to account for referral costs)
    let fee, processingFee, estimatedDelivery;
    
    if (senderMethod === 'usdc' || recipientMethod === 'usdc') {
      // USDC fees (increased to cover referral costs)
      fee = Math.max(transferAmount * 0.005, 1.00); // 0.5% with $1.00 minimum
      processingFee = transferAmount * 0.0075; // 0.75% platform fee
      estimatedDelivery = '3-5 seconds';
    } else {
      // Standard fees (increased to cover referral costs)
      fee = Math.max(transferAmount * 0.035, 7.50); // 3.5% with $7.50 minimum
      processingFee = senderMethod === 'credit-card' ? transferAmount * 0.029 : transferAmount * 0.01;
      estimatedDelivery = '5-15 minutes';
    }

    const quoteId = `quote_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
    
    res.json({
      success: true,
      quoteId,
      amount: transferAmount,
      fee: fee,
      processingFee: processingFee,
      totalFee: fee + processingFee,
      fromMethod: senderMethod,
      toMethod: recipientMethod,
      estimatedDelivery,
      validUntil: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes
      message: senderMethod === 'usdc' || recipientMethod === 'usdc' 
        ? 'USDC transfer quote - ultra-low fees!' 
        : 'P2P transfer quote generated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Quote generation failed'
    });
  }
});

/**
 * POST /api/p2p/transfer
 * Simplified P2P transfer endpoint for audit compatibility
 */
router.post('/transfer', async (req, res) => {
  try {
    const { 
      recipient, 
      amount, 
      senderMethod, 
      recipientMethod,
      fromMethod,
      toMethod,
      fromPlatform,
      toPlatform,
      note 
    } = req.body;
    
    // Support both parameter naming conventions
    const finalSenderMethod = senderMethod || fromMethod || fromPlatform;
    const finalRecipientMethod = recipientMethod || toMethod || toPlatform;
    
    if (!recipient || !amount || !finalSenderMethod || !finalRecipientMethod) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: recipient, amount, senderMethod, recipientMethod'
      });
    }

    const transferAmount = parseFloat(amount);
    if (isNaN(transferAmount) || transferAmount < 1) {
      return res.status(400).json({
        success: false,
        error: 'Minimum transfer amount is $1'
      });
    }

    // Calculate fees based on USDC usage (updated to account for referral costs)
    let fee, processingFee, estimatedDelivery;
    
    if (finalSenderMethod === 'usdc' || finalRecipientMethod === 'usdc') {
      // USDC fees (increased to cover referral costs)
      fee = Math.max(transferAmount * 0.005, 1.00); // 0.5% with $1.00 minimum
      processingFee = transferAmount * 0.0075; // 0.75% platform fee
      estimatedDelivery = '3-5 seconds';
    } else {
      // Standard fees (increased to cover referral costs)
      fee = Math.max(transferAmount * 0.035, 7.50); // 3.5% with $7.50 minimum
      processingFee = finalSenderMethod === 'credit-card' ? transferAmount * 0.029 : transferAmount * 0.01;
      estimatedDelivery = '5-15 minutes';
    }

    const transferId = `p2p_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
    
    res.json({
      success: true,
      transferId,
      amount: transferAmount,
      fee: fee,
      processingFee: processingFee,
      totalFee: fee + processingFee,
      senderMethod: finalSenderMethod,
      recipientMethod: finalRecipientMethod,
      status: 'initiated',
      estimatedDelivery,
      note: note || '',
      message: finalSenderMethod === 'usdc' || finalRecipientMethod === 'usdc' 
        ? 'USDC transfer initiated - ultra-low fees!' 
        : 'P2P transfer initiated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Transfer initiation failed'
    });
  }
});

/**
 * POST /api/p2p/initiate
 * Initiate a P2P transfer with profitable fee structure
 */
router.post('/initiate', async (req, res) => {
  try {
    const { recipient, amount, senderMethod, recipientMethod } = req.body;
    
    if (!recipient || !amount || !senderMethod || !recipientMethod) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: recipient, amount, senderMethod, recipientMethod'
      });
    }

    const transferAmount = parseFloat(amount);
    if (isNaN(transferAmount) || transferAmount < 5) {
      return res.status(400).json({
        success: false,
        error: 'Minimum transfer amount is $5'
      });
    }

    // P2P transfer service with profitable rates
    const transferService = new P2PTransferService();
    const result = await transferService.initiateTransfer({
      recipient,
      amount: transferAmount,
      senderMethod,
      recipientMethod
    });

    res.json({
      success: true,
      transferId: result.transferId,
      amount: result.amount,
      fee: result.fee,
      totalAmount: result.totalAmount,
      status: result.status,
      estimatedDelivery: result.estimatedDelivery,
      profitMargin: result.profitMargin
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Transfer initiation failed'
    });
  }
});

/**
 * POST /api/p2p/calculate-fee
 * Calculate P2P transfer fee with cross-platform support
 */
router.post('/calculate-fee', async (req, res) => {
  try {
    const { amount, fromPlatform, toPlatform } = req.body;
    
    if (!amount || !fromPlatform || !toPlatform) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: amount, fromPlatform, toPlatform'
      });
    }

    const transferAmount = parseFloat(amount);
    if (isNaN(transferAmount) || transferAmount < 1) {
      return res.status(400).json({
        success: false,
        error: 'Minimum transfer amount is $1'
      });
    }

    // Calculate fees with cross-platform support
    let baseFee, platformFee, processingFee;
    
    if (fromPlatform === 'usdc' || toPlatform === 'usdc') {
      baseFee = Math.max(transferAmount * 0.005, 1.00); // 0.5% with $1.00 minimum
      platformFee = transferAmount * 0.0075; // 0.75% platform fee
      processingFee = 0; // No additional processing for USDC
    } else {
      baseFee = Math.max(transferAmount * 0.035, 7.50); // 3.5% with $7.50 minimum
      platformFee = transferAmount * 0.01; // 1% platform fee
      processingFee = fromPlatform === 'credit-card' ? transferAmount * 0.029 : transferAmount * 0.005;
    }

    const totalFee = baseFee + platformFee + processingFee;
    
    res.json({
      success: true,
      amount: transferAmount,
      fees: {
        base: baseFee,
        platform: platformFee,
        processing: processingFee,
        total: totalFee
      },
      totalAmount: transferAmount + totalFee,
      fromPlatform,
      toPlatform,
      savings: fromPlatform === 'usdc' || toPlatform === 'usdc' ? 
        `${((1 - (totalFee / (transferAmount * 0.05))) * 100).toFixed(1)}% savings vs traditional methods` : 
        'Consider USDC for ultra-low fees'
    });
  } catch (error) {
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

    // Mock transfer status for demonstration
    const mockStatus = {
      transferId,
      status: 'completed',
      amount: 1000,
      fee: 12.50,
      senderMethod: 'paypal',
      recipientMethod: 'crypto',
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      estimatedDelivery: '5-15 minutes',
      actualDelivery: '8 minutes'
    };

    res.json({
      success: true,
      transfer: mockStatus
    });
  } catch (error) {
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
router.get('/supported-platforms', async (req, res) => {
  try {
    const supportedPlatforms = {
      senderMethods: [
        { id: 'paypal', name: 'PayPal', fee: '2.9% + $0.30', available: true },
        { id: 'credit-card', name: 'Credit Card', fee: '2.9% + $0.30', available: true },
        { id: 'usdc', name: 'USDC', fee: '0.5% + $1.00', available: true, recommended: true },
        { id: 'crypto', name: 'Crypto', fee: '1.5% + $2.50', available: true },
        { id: 'bank-transfer', name: 'Bank Transfer', fee: '1.0% + $5.00', available: false }
      ],
      recipientMethods: [
        { id: 'paypal', name: 'PayPal', available: true },
        { id: 'crypto', name: 'Crypto Wallet', available: true },
        { id: 'usdc', name: 'USDC', available: true, recommended: true },
        { id: 'bank-transfer', name: 'Bank Transfer', available: false },
        { id: 'mobile-money', name: 'Mobile Money', available: false }
      ]
    };

    res.json({
      success: true,
      platforms: supportedPlatforms
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Platform list retrieval failed'
    });
  }
});

/**
 * POST /api/p2p/cross-border
 * Cross-border P2P transfer endpoint
 */
router.post('/cross-border', async (req, res) => {
  try {
    const { recipient, amount, senderCountry, recipientCountry, senderMethod, recipientMethod } = req.body;
    
    if (!recipient || !amount || !senderCountry || !recipientCountry || !senderMethod || !recipientMethod) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields for cross-border transfer'
      });
    }

    const transferAmount = parseFloat(amount);
    if (isNaN(transferAmount) || transferAmount < 10) {
      return res.status(400).json({
        success: false,
        error: 'Minimum cross-border transfer amount is $10'
      });
    }

    // Cross-border fee calculation
    const baseFee = Math.max(transferAmount * 0.025, 15.00); // 2.5% with $15 minimum
    const crossBorderFee = Math.max(transferAmount * 0.015, 5.00); // Additional 1.5% for cross-border
    const totalFee = baseFee + crossBorderFee;

    const transferId = `xb_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
    
    res.json({
      success: true,
      transferId,
      amount: transferAmount,
      baseFee,
      crossBorderFee,
      totalFee,
      senderCountry,
      recipientCountry,
      senderMethod,
      recipientMethod,
      status: 'initiated',
      estimatedDelivery: '1-3 business days',
      exchangeRate: 1.0, // USD to USD for demo
      message: 'Cross-border transfer initiated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Cross-border transfer initiation failed'
    });
  }
});

/**
 * GET /api/referrals/structure
 * Get referral commission structure (for audit purposes)
 */
router.get('/referrals/structure', async (req, res) => {
  try {
    const referralStructure = {
      tiers: [
        { name: 'Bronze', minReferrals: 0, commission: 0.003, bonus: 0.001 },
        { name: 'Silver', minReferrals: 10, commission: 0.004, bonus: 0.001 },
        { name: 'Gold', minReferrals: 25, commission: 0.005, bonus: 0.001 },
        { name: 'Platinum', minReferrals: 50, commission: 0.006, bonus: 0.001 }
      ],
      maximumCommission: 0.006, // 0.6% maximum
      minimumTransaction: 50.00, // $50 minimum for referral eligibility
      maximumCap: 15.00, // $15 maximum referral commission per transaction
      payoutSchedule: 'Monthly',
      payoutMethods: ['PayPal', 'Bank Transfer', 'Crypto']
    };

    res.json({
      success: true,
      referralStructure
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Referral structure retrieval failed'
    });
  }
});

export default router;