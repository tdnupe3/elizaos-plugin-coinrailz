import { Router } from 'express';

const router = Router();

/**
 * POST /api/referrals/generate
 * Generate referral link for users
 */
router.post('/generate', (req, res) => {
  try {
    const { userId, type = 'marketplace' } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    const referralCode = `${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const referralLink = `https://coinrailz.com/ref/${referralCode}`;
    
    res.json({
      success: true,
      referralCode,
      referralLink,
      type,
      commissionRate: '0.5%',
      maxCommission: '$15 per transaction'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Referral generation failed'
    });
  }
});

/**
 * GET /api/referrals/commissions/:userId
 * Get commission tracking for user
 */
router.get('/commissions/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    
    res.json({
      success: true,
      userId,
      totalCommissions: '125.50',
      pendingCommissions: '45.25',
      paidCommissions: '80.25',
      referralCount: 12,
      conversionRate: '8.5%',
      lastPayment: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Commission tracking failed'
    });
  }
});

/**
 * POST /api/referrals/calculate-payout
 * Calculate referral payout for transaction
 */
router.post('/calculate-payout', (req, res) => {
  try {
    const { transactionAmount, referralTier = 'standard' } = req.body;
    
    if (!transactionAmount) {
      return res.status(400).json({
        success: false,
        error: 'Transaction amount is required'
      });
    }

    const amount = parseFloat(transactionAmount);
    const rates: { [key: string]: number } = {
      standard: 0.005, // 0.5%
      premium: 0.0075, // 0.75%
      enterprise: 0.01 // 1.0%
    };
    
    const rate = rates[referralTier] || rates.standard;
    const payout = Math.min(amount * rate, 15); // Cap at $15
    
    res.json({
      success: true,
      transactionAmount: amount,
      referralTier,
      commissionRate: (rate * 100).toFixed(2) + '%',
      amount: payout.toFixed(2),
      maxCap: '15.00'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Payout calculation failed'
    });
  }
});

/**
 * GET /api/referrals/structure
 * Get referral commission structure
 */
router.get('/structure', (req, res) => {
  res.json({
    success: true,
    commissionRates: {
      tier1: 0.003, // 0.3%
      tier2: 0.004, // 0.4% 
      tier3: 0.006  // 0.6%
    },
    description: 'Tiered referral commission structure',
    maxCommission: 15, // $15 maximum per transaction
    minTransaction: 10 // $10 minimum for referral eligibility
  });
});

export default router;