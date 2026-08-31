import { Router } from 'express';

const router = Router();

/**
 * USDC Off-Ramp API Routes
 * Converts USDC to fiat currency through various methods
 */

/**
 * Get available off-ramp methods
 */
router.get('/methods', async (req, res) => {
  try {
    // In production, this would check user's location and eligibility
    const methods = [
      {
        id: 'bank-deposit',
        name: 'Bank Deposit (ACH)',
        description: 'Direct deposit to your bank account',
        fee: '0.5% + $1.00',
        processingTime: '1-2 business days',
        minAmount: 25,
        maxAmount: 25000,
        available: true,
        popular: true
      },
      {
        id: 'debit-card',
        name: 'Instant Debit Card',
        description: 'Instant cash to your debit card',
        fee: '1.5% + $2.50',
        processingTime: '30 seconds',
        minAmount: 10,
        maxAmount: 2500,
        available: true,
        instant: true
      },
      {
        id: 'cash-pickup',
        name: 'Cash Pickup',
        description: 'Pick up cash at 50,000+ locations',
        fee: '2.0% + $5.00',
        processingTime: '15 minutes',
        minAmount: 20,
        maxAmount: 2000,
        available: true
      },
      {
        id: 'gift-cards',
        name: 'Gift Cards',
        description: 'Amazon, Walmart, Target, and 200+ retailers',
        fee: '1.0% bonus',
        processingTime: 'Instant',
        minAmount: 5,
        maxAmount: 500,
        available: true,
        bonus: true
      }
    ];

    res.json({
      success: true,
      methods,
      supportedCountries: ['US', 'CA', 'UK', 'EU'],
      compliance: {
        kycRequired: false,
        dailyLimit: 3000,
        monthlyLimit: 25000
      }
    });

  } catch (error: any) {
    res.status(500).json({
      error: error.message || 'Failed to fetch off-ramp methods'
    });
  }
});

/**
 * Get quote for off-ramp conversion
 */
router.post('/quote', async (req, res) => {
  try {
    const { amount, method } = req.body;

    if (!amount || !method) {
      return res.status(400).json({
        error: 'Amount and method are required'
      });
    }

    // Calculate fees based on method
    let fees = 0;
    let processingTime = '';
    let networkFee = 0.25; // USDC network fee

    switch (method) {
      case 'bank-deposit':
        fees = amount * 0.005 + 1.00; // 0.5% + $1.00
        processingTime = '1-2 business days';
        break;
      case 'debit-card':
        fees = amount * 0.015 + 2.50; // 1.5% + $2.50
        processingTime = '30 seconds';
        break;
      case 'cash-pickup':
        fees = amount * 0.02 + 5.00; // 2.0% + $5.00
        processingTime = '15 minutes';
        break;
      case 'gift-cards':
        fees = amount * -0.01; // 1% bonus
        processingTime = 'Instant';
        networkFee = 0; // No network fee for gift cards
        break;
      default:
        return res.status(400).json({
          error: 'Invalid off-ramp method'
        });
    }

    const totalFees = fees + networkFee;
    const netAmount = amount - totalFees;
    const exchangeRate = 1.00; // USDC is 1:1 with USD

    res.json({
      success: true,
      quote: {
        inputAmount: amount,
        inputCurrency: 'USDC',
        outputAmount: netAmount,
        outputCurrency: 'USD',
        exchangeRate,
        fees: {
          platformFee: fees,
          networkFee,
          totalFees
        },
        processingTime,
        quoteId: 'quote_' + Date.now(),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes
        method
      }
    });

  } catch (error: any) {
    res.status(500).json({
      error: error.message || 'Failed to generate quote'
    });
  }
});

/**
 * Execute off-ramp conversion
 */
router.post('/execute', async (req, res) => {
  try {
    const { quoteId, amount, method, details } = req.body;
    const userId = (req.user as { id?: string } | undefined)?.id;

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required'
      });
    }

    if (!quoteId || !amount || !method) {
      return res.status(400).json({
        error: 'Quote ID, amount, and method are required'
      });
    }

    // In production, this would:
    // 1. Validate the quote hasn't expired
    // 2. Check user's USDC balance
    // 3. Initiate the off-ramp through Circle's APIs
    // 4. Process payment to the selected method
    // 5. Update user's balance and transaction history

    // Simulate processing delay
    const transactionId = 'off_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    let estimatedCompletion;
    switch (method) {
      case 'debit-card':
        estimatedCompletion = new Date(Date.now() + 30 * 1000); // 30 seconds
        break;
      case 'gift-cards':
        estimatedCompletion = new Date(); // Instant
        break;
      case 'cash-pickup':
        estimatedCompletion = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
        break;
      case 'bank-deposit':
        estimatedCompletion = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // 2 days
        break;
      default:
        estimatedCompletion = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    }

    res.json({
      success: true,
      transaction: {
        id: transactionId,
        status: 'processing',
        amount,
        method,
        estimatedCompletion: estimatedCompletion.toISOString(),
        trackingUrl: `/api/usdc/off-ramp/track/${transactionId}`,
        details: {
          ...details,
          confirmationCode: Math.random().toString(36).substr(2, 8).toUpperCase()
        }
      }
    });

  } catch (error: any) {
    res.status(500).json({
      error: error.message || 'Failed to execute off-ramp'
    });
  }
});

/**
 * Track off-ramp transaction status
 */
router.get('/track/:transactionId', async (req, res) => {
  try {
    const { transactionId } = req.params;

    // In production, this would query the actual transaction status
    // from Circle's APIs and payment processor APIs
    
    const transaction = {
      id: transactionId,
      status: 'completed', // processing, completed, failed
      amount: 250.00,
      method: 'debit-card',
      createdAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(), // 2 minutes ago
      completedAt: new Date(Date.now() - 30 * 1000).toISOString(), // 30 seconds ago
      confirmationCode: 'AC7B9K2L',
      timeline: [
        {
          status: 'initiated',
          timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
          message: 'Off-ramp transaction initiated'
        },
        {
          status: 'processing',
          timestamp: new Date(Date.now() - 90 * 1000).toISOString(),
          message: 'USDC conversion in progress'
        },
        {
          status: 'completed',
          timestamp: new Date(Date.now() - 30 * 1000).toISOString(),
          message: 'Funds delivered successfully'
        }
      ]
    };

    res.json({
      success: true,
      transaction
    });

  } catch (error: any) {
    res.status(500).json({
      error: error.message || 'Failed to track transaction'
    });
  }
});

/**
 * Get user's off-ramp history
 */
router.get('/history', async (req, res) => {
  try {
    const userId = (req.user as { id?: string } | undefined)?.id;

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required'
      });
    }

    // In production, this would query user's actual off-ramp history
    const history = [
      {
        id: 'off_1737555555555_abc123',
        amount: 150.00,
        method: 'debit-card',
        status: 'completed',
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
        netReceived: 145.75,
        confirmationCode: 'XY9Z4P3M'
      },
      {
        id: 'off_1737444444444_def456',
        amount: 75.00,
        method: 'gift-cards',
        status: 'completed',
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
        netReceived: 75.75, // 1% bonus
        giftCard: 'Amazon'
      }
    ];

    res.json({
      success: true,
      history,
      totalVolume: history.reduce((sum, tx) => sum + tx.amount, 0),
      totalSaved: history.reduce((sum, tx) => sum + (tx.netReceived - tx.amount), 0)
    });

  } catch (error: any) {
    res.status(500).json({
      error: error.message || 'Failed to fetch off-ramp history'
    });
  }
});

export { router as usdcOffRampRoutes };