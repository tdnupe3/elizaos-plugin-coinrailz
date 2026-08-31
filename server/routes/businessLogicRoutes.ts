/**
 * Business Logic Validation Routes
 * Endpoints for testing and validating improved business logic
 */

import { Router } from 'express';
import { BusinessLogicValidator } from '../services/businessLogicValidator';
import { FeeCalculator } from '../services/feeCalculator';

const router = Router();

/**
 * Validate referral commission sustainability
 */
router.post('/validate-commission', async (req, res) => {
  try {
    const { transactionAmount, proposedCommission, monthlyTotal = 0 } = req.body;
    
    if (!transactionAmount || !proposedCommission) {
      return res.status(400).json({
        error: 'Missing required fields: transactionAmount, proposedCommission'
      });
    }
    
    // Calculate platform fee for this transaction
    const p2pFees = FeeCalculator.calculateP2PFees(transactionAmount);
    
    const validation = FeeCalculator.validateReferralCommission(
      proposedCommission,
      transactionAmount,
      p2pFees.platformFee,
      monthlyTotal
    );
    
    res.json({
      success: true,
      sustainable: validation.valid,
      adjustedCommission: validation.adjustedCommission,
      reasons: validation.reasons,
      commissionRate: (validation.adjustedCommission / transactionAmount * 100).toFixed(2) + '%'
    });
    
  } catch (error: any) {
    res.status(500).json({
      error: error.message || 'Commission validation failed'
    });
  }
});

/**
 * Calculate marketplace fees with new tiered structure
 */
router.post('/marketplace/fee-calculation', async (req, res) => {
  try {
    const { amount } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({
        error: 'Invalid amount provided'
      });
    }
    
    const fees = FeeCalculator.calculateMarketplaceFees(amount, 'standard');
    
    // Determine tier name based on amount
    let tier = 'Basic';
    if (amount >= 1000) tier = 'Enterprise';
    else if (amount >= 300) tier = 'Premium';
    else if (amount >= 100) tier = 'Standard';
    
    res.json({
      success: true,
      amount,
      platformFee: fees.platformFee,
      agentPayout: fees.netAmount,
      tier,
      feePercentage: (fees.platformFee / amount * 100).toFixed(1) + '%',
      agentPercentage: (fees.netAmount / amount * 100).toFixed(1) + '%',
      description: fees.feeBreakdown?.description
    });
    
  } catch (error: any) {
    res.status(400).json({
      error: error.message || 'Marketplace fee calculation failed'
    });
  }
});

/**
 * Comprehensive transaction validation
 */
router.post('/validate-transaction', async (req, res) => {
  try {
    const {
      amount,
      transactionType,
      paymentMethod,
      referralCommission,
      monthlyReferralTotal
    } = req.body;
    
    if (!amount || !transactionType) {
      return res.status(400).json({
        error: 'Missing required fields: amount, transactionType'
      });
    }
    
    const validation = BusinessLogicValidator.validateTransaction({
      amount,
      transactionType,
      paymentMethod,
      referralCommission,
      monthlyReferralTotal
    });
    
    res.json({
      success: true,
      validation
    });
    
  } catch (error: any) {
    res.status(500).json({
      error: error.message || 'Transaction validation failed'
    });
  }
});

/**
 * Platform health analysis
 */
router.get('/platform-health', async (req, res) => {
  try {
    // This would typically pull from database
    // For now, providing sample analysis structure
    const sampleMetrics = {
      totalRevenue: 274.75,
      totalReferralCommissions: 37.50,
      averageProfitMargin: 0.098,
      transactionVolume: 2800
    };
    
    const health = BusinessLogicValidator.validatePlatformHealth(sampleMetrics);
    
    res.json({
      success: true,
      health,
      metrics: sampleMetrics,
      recommendations: BusinessLogicValidator.generateOptimizationRecommendations()
    });
    
  } catch (error: any) {
    res.status(500).json({
      error: error.message || 'Platform health analysis failed'
    });
  }
});

/**
 * Calculate P2P fees with new standardized structure
 */
router.post('/p2p/standardized-fees', async (req, res) => {
  try {
    const { amount, paymentMethod = 'stripe' } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({
        error: 'Invalid amount provided'
      });
    }
    
    const fees = FeeCalculator.calculateP2PFees(amount, paymentMethod);
    
    // Determine tier
    let tier = 'Small';
    if (amount >= 1000) tier = 'Enterprise';
    else if (amount >= 200) tier = 'Large';
    else if (amount >= 50) tier = 'Medium';
    
    res.json({
      success: true,
      amount,
      platformFee: fees.platformFee,
      processingFee: fees.processingFee,
      totalFee: fees.totalFee,
      tier,
      feePercentage: (fees.platformFee / amount * 100).toFixed(1) + '%',
      description: fees.feeBreakdown?.description
    });
    
  } catch (error: any) {
    res.status(400).json({
      error: error.message || 'P2P fee calculation failed'
    });
  }
});

/**
 * Get business logic improvement summary
 */
router.get('/improvements-summary', async (req, res) => {
  try {
    res.json({
      success: true,
      improvements: {
        xrpFees: {
          description: 'Simplified XRP fees to 0.5% across all transactions',
          impact: 'Competitive pricing while maintaining profitability',
          previousStructure: 'Complex tiered fees (0.75%-1.5%)',
          newStructure: 'Simple 0.5% + $0.25 minimum'
        },
        p2pStandardization: {
          description: 'Standardized P2P transfer fee structure',
          impact: 'Consistent pricing eliminating 600% fee variance',
          previousRange: '1%-8.5% (highly inconsistent)',
          newStructure: 'Tiered: 3.5%-6.5% based on amount'
        },
        minimumEnforcement: {
          description: 'Enforced minimum transaction amounts',
          impact: 'Eliminates unprofitable micro-transactions',
          minimums: {
            p2p: '$25',
            marketplace: '$50',
            xrp: '$10',
            crypto: '$15'
          }
        },
        referralCaps: {
          description: 'Implemented referral commission sustainability limits',
          impact: 'Prevents commission cost explosion',
          limits: {
            maxRate: '0.6% per transaction',
            monthlyCapPerUser: '$500',
            maxPlatformPercent: '5% of total revenue'
          }
        },
        marketplaceTiers: {
          description: 'Replaced flat 15% marketplace fee with tiered structure',
          impact: 'Optimized revenue based on transaction size',
          newTiers: {
            basic: '20% (under $100)',
            standard: '17.5% ($100-$300)',
            premium: '15% ($300-$1000)',
            enterprise: '12.5% ($1000+)'
          }
        },
        profitMargins: {
          description: 'Implemented minimum 2% profit margin validation',
          impact: 'Ensures sustainability after all costs',
          validation: 'Real-time profit checking before transaction approval'
        }
      },
      expectedImpact: {
        revenueConsistency: '+50-70% improvement',
        overallMargins: '15-20% vs current 9.8%',
        referralSustainability: 'Capped at sustainable levels',
        xrpRevenue: 'Significant opportunity with competitive rates',
        marketplaceOptimization: 'Revenue maximization through smart tiering'
      }
    });
    
  } catch (error: any) {
    res.status(500).json({
      error: error.message || 'Failed to generate improvements summary'
    });
  }
});

export { router as businessLogicRoutes };