import { Router } from 'express';
import { P2PTransferService } from '../services/p2pTransferService';
import { db } from '../db';
import { p2pTransfers } from '@shared/schema';

const router = Router();

// P2P service status endpoint
router.get('/status', async (req, res) => {
  try {
    res.json({
      success: true,
      status: 'active',
      service: 'p2p-transfers',
      minimumAmount: 10,
      supportedMethods: ['usdc', 'credit-card', 'paypal', 'crypto'],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('P2P status check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check P2P status'
    });
  }
});

// BUSINESS LOGIC CONSTANTS - Unified across all endpoints
const BUSINESS_LOGIC = {
  minimumAmounts: {
    standard: 10,      // $10 minimum for standard transactions
    usdc: 10,          // $10 minimum even for USDC (sustainable operations)
    xrp: 10            // $10 minimum for XRP transactions
  },
  maximumAmounts: {
    'credit-card': 10000,
    'paypal': 10000,
    'usdc': 50000,
    'crypto': 25000,
    'xrp': 50000
  },
  fees: {
    usdc: {
      platformRate: 0.0075,    // 0.75% platform fee
      minimumFee: 1.00,        // $1.00 minimum
      processingRate: 0.005    // 0.5% processing
    },
    standard: {
      platformRate: 0.035,     // 3.5% platform fee
      minimumFee: 7.50,        // $7.50 minimum
      creditCardRate: 0.029,   // 2.9% credit card processing
      otherRate: 0.01          // 1% other processing
    },
    xrp: {
      platformRate: 0.005,     // 0.5% platform fee
      minimumFee: 0.50,        // $0.50 minimum
      referralBuffer: 0.002    // 0.2% buffer for referral costs
    }
  }
};

/**
 * Validate transaction amount with unified business logic
 */
function validateTransactionAmount(amount: number, method: string): { valid: boolean; error?: string } {
  const transferAmount = parseFloat(amount.toString());
  
  if (isNaN(transferAmount) || transferAmount <= 0) {
    return { valid: false, error: 'Invalid transaction amount' };
  }

  // Unified $10 minimum across all methods for profitability
  if (transferAmount < BUSINESS_LOGIC.minimumAmounts.standard) {
    return { 
      valid: false, 
      error: `Minimum transfer amount is $${BUSINESS_LOGIC.minimumAmounts.standard} to ensure profitable operations` 
    };
  }

  // Maximum limits for AML compliance
  const maxAmount = BUSINESS_LOGIC.maximumAmounts[method as keyof typeof BUSINESS_LOGIC.maximumAmounts] || 10000;
  if (transferAmount > maxAmount) {
    return { 
      valid: false, 
      error: `Maximum transfer amount for ${method} is $${maxAmount.toLocaleString()}` 
    };
  }

  return { valid: true };
}

/**
 * Calculate fees with unified business logic
 */
function calculateFees(amount: number, senderMethod: string, recipientMethod: string) {
  const isUSDCTransaction = senderMethod === 'usdc' || recipientMethod === 'usdc';
  const isXRPTransaction = senderMethod === 'xrp' || recipientMethod === 'xrp';
  
  let fee: number;
  let processingFee: number;
  let estimatedDelivery: string;
  
  if (isUSDCTransaction) {
    // USDC fees with referral cost coverage
    fee = Math.max(amount * BUSINESS_LOGIC.fees.usdc.platformRate, BUSINESS_LOGIC.fees.usdc.minimumFee);
    processingFee = amount * BUSINESS_LOGIC.fees.usdc.processingRate;
    estimatedDelivery = '3-5 seconds';
  } else if (isXRPTransaction) {
    // XRP fees with referral buffer
    const baseRate = BUSINESS_LOGIC.fees.xrp.platformRate + BUSINESS_LOGIC.fees.xrp.referralBuffer;
    fee = Math.max(amount * baseRate, BUSINESS_LOGIC.fees.xrp.minimumFee);
    processingFee = 0.0002; // Network fee in USD
    estimatedDelivery = '3-5 seconds';
  } else {
    // Standard fees with referral cost coverage
    fee = Math.max(amount * BUSINESS_LOGIC.fees.standard.platformRate, BUSINESS_LOGIC.fees.standard.minimumFee);
    processingFee = senderMethod === 'credit-card' 
      ? amount * BUSINESS_LOGIC.fees.standard.creditCardRate + 0.30
      : amount * BUSINESS_LOGIC.fees.standard.otherRate;
    estimatedDelivery = '5-15 minutes';
  }

  return {
    fee: Math.round(fee * 100) / 100,
    processingFee: Math.round(processingFee * 100) / 100,
    estimatedDelivery
  };
}

/**
 * POST /api/p2p/quote
 * Generate P2P transfer quote with unified business logic
 */
router.post('/quote', async (req, res) => {
  try {
    const { amount, fromMethod, toMethod, fromPlatform, toPlatform } = req.body;
    
    // Support both parameter naming conventions
    const senderMethod = fromMethod || fromPlatform;
    const recipientMethod = toMethod || toPlatform;
    
    if (!amount || !senderMethod || !recipientMethod) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: amount, fromMethod, toMethod'
      });
    }

    // Validate transaction amount
    const validation = validateTransactionAmount(amount, senderMethod);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.error
      });
    }

    const transferAmount = parseFloat(amount);
    const { fee, processingFee, estimatedDelivery } = calculateFees(transferAmount, senderMethod, recipientMethod);
    const quoteId = `quote_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
    
    res.json({
      success: true,
      quoteId,
      amount: transferAmount,
      fee,
      processingFee,
      totalFee: fee + processingFee,
      fromMethod: senderMethod,
      toMethod: recipientMethod,
      estimatedDelivery,
      validUntil: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      businessLogic: {
        minimumAmount: BUSINESS_LOGIC.minimumAmounts.standard,
        maximumAmount: BUSINESS_LOGIC.maximumAmounts[senderMethod as keyof typeof BUSINESS_LOGIC.maximumAmounts],
        profitabilityEnsured: true
      }
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
 * Unified P2P transfer endpoint with business logic compliance
 */
router.post('/transfer', async (req, res) => {
  try {
    const { 
      recipient, amount, senderMethod, recipientMethod,
      fromMethod, toMethod, fromPlatform, toPlatform, note 
    } = req.body;
    
    // Support all parameter naming conventions
    const finalSenderMethod = senderMethod || fromMethod || fromPlatform;
    const finalRecipientMethod = recipientMethod || toMethod || toPlatform;
    
    if (!recipient || !amount || !finalSenderMethod || !finalRecipientMethod) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: recipient, amount, senderMethod, recipientMethod'
      });
    }

    // Validate transaction amount
    const validation = validateTransactionAmount(amount, finalSenderMethod);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.error
      });
    }

    const transferAmount = parseFloat(amount);
    const { fee, processingFee, estimatedDelivery } = calculateFees(transferAmount, finalSenderMethod, finalRecipientMethod);
    const transferId = `p2p_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
    
    // Persist to database for revenue tracking
    console.log('🔍 DEBUG: About to insert P2P transfer to database:', transferId);
    const transfers = await db.insert(p2pTransfers).values({
      transferId,
      recipient,
      amount: transferAmount.toString(),
      fee: fee.toString(),
      processingFee: processingFee.toString(),
      totalFee: (fee + processingFee).toString(),
      senderMethod: finalSenderMethod,
      recipientMethod: finalRecipientMethod,
      status: 'initiated',
      note: note || null,
      userId: (req as any).session?.user?.id || null,
    }).returning();
    
    console.log('✅ DEBUG: P2P transfer inserted, returned:', transfers.length, 'rows');
    const transfer = transfers[0];
    
    res.json({
      success: true,
      transferId: transfer.transferId,
      amount: transferAmount,
      fee,
      processingFee,
      totalFee: fee + processingFee,
      senderMethod: finalSenderMethod,
      recipientMethod: finalRecipientMethod,
      status: transfer.status,
      estimatedDelivery,
      note: note || '',
      compliance: {
        minimumEnforced: true,
        maximumEnforced: true,
        profitabilityValidated: true,
        referralCostsCovered: true
      }
    });
  } catch (error) {
    console.error('❌ DEBUG: P2P transfer failed:', error);
    res.status(500).json({
      success: false,
      error: 'Transfer initiation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/p2p/initiate
 * Legacy endpoint - redirects to unified transfer logic
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

    // Validate transaction amount
    const validation = validateTransactionAmount(amount, senderMethod);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.error
      });
    }

    // Use P2P transfer service with profitable rates
    const result = await P2PTransferService.initiateTransfer({
      recipientPlatform: recipientMethod,
      recipientIdentifier: recipient,
      amount: parseFloat(amount),
      senderMethod,
      message: undefined
    });

    res.json({
      ...result,
      success: result.success,
      businessLogicCompliant: true
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Transfer initiation failed'
    });
  }
});

/**
 * GET /api/p2p/business-logic
 * Expose business logic constants for frontend validation
 */
router.get('/business-logic', async (req, res) => {
  res.json({
    success: true,
    businessLogic: BUSINESS_LOGIC,
    lastUpdated: '2025-07-24',
    version: '2.0.0'
  });
});

export default router;