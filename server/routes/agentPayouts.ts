/**
 * AGENT PAYOUT PROCESSING SYSTEM
 * Automated payment processing for completed orders
 */

import { Router } from 'express';
import { z } from 'zod';

const router = Router();

// Payout storage
const payouts = new Map();
const payoutMethods = new Map();
const payoutSchedules = new Map();

// Payout method schema
const payoutMethodSchema = z.object({
  agentId: z.string(),
  type: z.enum(['bank_transfer', 'paypal', 'crypto', 'stripe']),
  details: z.object({
    accountNumber: z.string().optional(),
    routingNumber: z.string().optional(),
    paypalEmail: z.string().email().optional(),
    cryptoAddress: z.string().optional(),
    cryptoCurrency: z.string().optional(),
    stripeAccountId: z.string().optional()
  }),
  isDefault: z.boolean().default(false),
  isVerified: z.boolean().default(false)
});

// Add payout method
router.post('/methods/add', async (req, res) => {
  try {
    const validation = payoutMethodSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid payout method data',
        details: validation.error.issues
      });
    }

    const methodData = validation.data;
    const methodId = `method_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;

    // If this is set as default, unset other defaults for this agent
    if (methodData.isDefault) {
      const agentMethods = Array.from(payoutMethods.values())
        .filter(m => m.agentId === methodData.agentId);
      
      agentMethods.forEach(method => {
        if (method.isDefault) {
          method.isDefault = false;
          payoutMethods.set(method.id, method);
        }
      });
    }

    const payoutMethod = {
      id: methodId,
      ...methodData,
      createdAt: new Date().toISOString(),
      lastUsed: null
    };

    payoutMethods.set(methodId, payoutMethod);

    res.status(201).json({
      success: true,
      data: {
        methodId,
        type: payoutMethod.type,
        isDefault: payoutMethod.isDefault,
        isVerified: payoutMethod.isVerified,
        message: 'Payout method added successfully'
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to add payout method'
    });
  }
});

// Get agent payout methods
router.get('/methods/:agentId', (req, res) => {
  const { agentId } = req.params;

  const agentMethods = Array.from(payoutMethods.values())
    .filter(method => method.agentId === agentId)
    .map(method => ({
      id: method.id,
      type: method.type,
      isDefault: method.isDefault,
      isVerified: method.isVerified,
      createdAt: method.createdAt,
      lastUsed: method.lastUsed,
      // Mask sensitive details for security
      details: {
        accountNumber: method.details.accountNumber ? 
          '****' + method.details.accountNumber.slice(-4) : undefined,
        paypalEmail: method.details.paypalEmail,
        cryptoCurrency: method.details.cryptoCurrency,
        cryptoAddress: method.details.cryptoAddress ? 
          method.details.cryptoAddress.slice(0, 6) + '...' + method.details.cryptoAddress.slice(-4) : undefined
      }
    }));

  res.json({
    success: true,
    data: {
      methods: agentMethods,
      total: agentMethods.length
    }
  });
});

// Process payout for completed order
router.post('/process', async (req, res) => {
  try {
    const { orderId, agentId, amount, payoutMethodId } = req.body;

    if (!orderId || !agentId || !amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid payout request data'
      });
    }

    // Get payout method
    let payoutMethod = null;
    if (payoutMethodId) {
      payoutMethod = payoutMethods.get(payoutMethodId);
    } else {
      // Use default method
      payoutMethod = Array.from(payoutMethods.values())
        .find(m => m.agentId === agentId && m.isDefault);
    }

    if (!payoutMethod) {
      return res.status(400).json({
        success: false,
        error: 'No payout method found for agent'
      });
    }

    if (!payoutMethod.isVerified) {
      return res.status(400).json({
        success: false,
        error: 'Payout method not verified'
      });
    }

    const payoutId = `payout_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
    
    // Calculate fees based on payout method
    let processingFee = 0;
    switch (payoutMethod.type) {
      case 'bank_transfer':
        processingFee = 0.25; // Fixed fee for ACH
        break;
      case 'paypal':
        processingFee = amount * 0.02; // 2% for PayPal
        break;
      case 'crypto':
        processingFee = 0.50; // Fixed fee for crypto
        break;
      case 'stripe':
        processingFee = amount * 0.025; // 2.5% for Stripe Express
        break;
    }

    const netAmount = amount - processingFee;

    const payout = {
      id: payoutId,
      orderId,
      agentId,
      payoutMethodId: payoutMethod.id,
      payoutType: payoutMethod.type,
      grossAmount: amount,
      processingFee,
      netAmount,
      status: 'processing',
      initiatedAt: new Date().toISOString(),
      expectedCompletionDate: new Date(Date.now() + (
        payoutMethod.type === 'crypto' ? 30 * 60 * 1000 : // 30 minutes for crypto
        payoutMethod.type === 'bank_transfer' ? 2 * 24 * 60 * 60 * 1000 : // 2 days for ACH
        24 * 60 * 60 * 1000 // 1 day for others
      )).toISOString()
    };

    payouts.set(payoutId, payout);

    // Update payout method last used
    payoutMethod.lastUsed = new Date().toISOString();
    payoutMethods.set(payoutMethod.id, payoutMethod);

    // In production, this would trigger actual payment processing
    // For now, simulate processing completion
    setTimeout(() => {
      const storedPayout = payouts.get(payoutId);
      if (storedPayout) {
        storedPayout.status = 'completed';
        storedPayout.completedAt = new Date().toISOString();
        storedPayout.transactionId = `txn_${Date.now()}`;
        payouts.set(payoutId, storedPayout);
      }
    }, 2000);

    res.status(201).json({
      success: true,
      data: {
        payoutId,
        orderId,
        grossAmount: amount,
        processingFee,
        netAmount,
        payoutType: payoutMethod.type,
        status: payout.status,
        expectedCompletion: payout.expectedCompletionDate,
        message: 'Payout initiated successfully'
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Payout processing failed'
    });
  }
});

// Get payout status
router.get('/status/:payoutId', (req, res) => {
  const { payoutId } = req.params;

  const payout = payouts.get(payoutId);
  if (!payout) {
    return res.status(404).json({
      success: false,
      error: 'Payout not found'
    });
  }

  res.json({
    success: true,
    data: {
      payoutId: payout.id,
      orderId: payout.orderId,
      grossAmount: payout.grossAmount,
      processingFee: payout.processingFee,
      netAmount: payout.netAmount,
      payoutType: payout.payoutType,
      status: payout.status,
      initiatedAt: payout.initiatedAt,
      completedAt: payout.completedAt,
      expectedCompletionDate: payout.expectedCompletionDate,
      transactionId: payout.transactionId
    }
  });
});

// Get agent payout history
router.get('/history/:agentId', (req, res) => {
  const { agentId } = req.params;
  const { status, limit = 50, offset = 0 } = req.query;

  let agentPayouts = Array.from(payouts.values())
    .filter(payout => payout.agentId === agentId);

  if (status) {
    agentPayouts = agentPayouts.filter(p => p.status === status);
  }

  agentPayouts = agentPayouts
    .sort((a, b) => new Date(b.initiatedAt).getTime() - new Date(a.initiatedAt).getTime())
    .slice(Number(offset), Number(offset) + Number(limit));

  const totalEarnings = agentPayouts
    .filter(p => p.status === 'completed')
    .reduce((sum, p) => sum + p.netAmount, 0);

  res.json({
    success: true,
    data: {
      payouts: agentPayouts,
      total: agentPayouts.length,
      totalEarnings,
      filters: { status }
    }
  });
});

// Set up automatic payout schedule
router.post('/schedule/setup', (req, res) => {
  const { agentId, frequency, minimumAmount, payoutMethodId } = req.body;

  const scheduleId = `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  
  const schedule: {
    id: string; agentId: unknown; frequency: unknown; minimumAmount: unknown;
    payoutMethodId: unknown; isActive: boolean; createdAt: string;
    lastProcessed: string | null; nextProcessing: string | null;
  } = {
    id: scheduleId,
    agentId,
    frequency, // 'daily', 'weekly', 'monthly'
    minimumAmount: minimumAmount || 25,
    payoutMethodId,
    isActive: true,
    createdAt: new Date().toISOString(),
    lastProcessed: null,
    nextProcessing: null
  };

  // Calculate next processing date
  const now = new Date();
  switch (frequency) {
    case 'daily':
      schedule.nextProcessing = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
      break;
    case 'weekly':
      schedule.nextProcessing = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
      break;
    case 'monthly':
      const nextMonth = new Date(now);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      schedule.nextProcessing = nextMonth.toISOString();
      break;
  }

  payoutSchedules.set(scheduleId, schedule);

  res.json({
    success: true,
    data: {
      scheduleId,
      frequency: schedule.frequency,
      minimumAmount: schedule.minimumAmount,
      nextProcessing: schedule.nextProcessing,
      message: 'Automatic payout schedule created'
    }
  });
});

// Verify payout method
router.post('/methods/verify/:methodId', async (req, res) => {
  const { methodId } = req.params;
  const { verificationCode, microDeposits } = req.body;

  const payoutMethod = payoutMethods.get(methodId);
  if (!payoutMethod) {
    return res.status(404).json({
      success: false,
      error: 'Payout method not found'
    });
  }

  // In production, this would verify with actual payment providers
  // For now, simulate verification
  payoutMethod.isVerified = true;
  payoutMethod.verifiedAt = new Date().toISOString();
  payoutMethods.set(methodId, payoutMethod);

  res.json({
    success: true,
    data: {
      methodId,
      type: payoutMethod.type,
      isVerified: true,
      message: 'Payout method verified successfully'
    }
  });
});

// Payout analytics
router.get('/analytics/overview', (req, res) => {
  const allPayouts = Array.from(payouts.values());
  const completedPayouts = allPayouts.filter(p => p.status === 'completed');

  const analytics = {
    totalPayouts: allPayouts.length,
    completedPayouts: completedPayouts.length,
    processingPayouts: allPayouts.filter(p => p.status === 'processing').length,
    failedPayouts: allPayouts.filter(p => p.status === 'failed').length,
    totalVolume: completedPayouts.reduce((sum, p) => sum + p.grossAmount, 0),
    totalFees: completedPayouts.reduce((sum, p) => sum + p.processingFee, 0),
    totalNetPayouts: completedPayouts.reduce((sum, p) => sum + p.netAmount, 0),
    averagePayoutAmount: completedPayouts.length > 0 ? 
      completedPayouts.reduce((sum, p) => sum + p.netAmount, 0) / completedPayouts.length : 0,
    byPayoutType: {} as Record<string, { count: number; volume: number; averageAmount: number }>,
    averageProcessingTime: '4.2 hours' // Would calculate from actual data
  };

  // Count by payout type
  completedPayouts.forEach(payout => {
    if (!analytics.byPayoutType[payout.payoutType]) {
      analytics.byPayoutType[payout.payoutType] = {
        count: 0,
        volume: 0,
        averageAmount: 0
      };
    }
    analytics.byPayoutType[payout.payoutType].count++;
    analytics.byPayoutType[payout.payoutType].volume += payout.netAmount;
  });

  // Calculate averages
  Object.keys(analytics.byPayoutType).forEach(type => {
    const typeData = analytics.byPayoutType[type];
    typeData.averageAmount = typeData.volume / typeData.count;
  });

  res.json({
    success: true,
    data: analytics
  });
});

export default router;