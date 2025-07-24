import { Router } from 'express';
import { db } from '../db';
import { users, aiMarketplaceOrders } from '@shared/schema';
import { eq, gte, lte, and, sql, desc } from 'drizzle-orm';

const router = Router();

/**
 * Business Logic Monitoring Dashboard
 * Tracks transaction rejections, profitability, and user behavior
 */
router.get('/business-logic/dashboard', async (req, res) => {
  try {
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    // For now, use simulated data until proper transaction logging is implemented
    const p2pRejections: Array<{rejectedAmount: number, reason: string, createdAt: Date}> = [];
    const marketplaceRejections: Array<{rejectedAmount: number, reason: string, createdAt: Date}> = [];
    
    // Simulated successful transactions for monitoring framework
    const successfulP2P: Array<{amount: number, fee: number, senderMethod: string, createdAt: Date}> = [];
    const successfulMarketplace: Array<{amount: number, platformFee: number, createdAt: Date}> = [];

    // Calculate profitability metrics
    const p2pProfitability = successfulP2P.map(tx => {
      const processingCost = tx.senderMethod === 'credit-card' 
        ? tx.amount * 0.029 + 0.30
        : tx.amount * 0.01;
      const netRevenue = tx.fee - processingCost;
      const margin = (netRevenue / tx.amount) * 100;
      
      return {
        transaction: tx,
        processingCost,
        netRevenue,
        margin
      };
    });

    const marketplaceProfitability = successfulMarketplace.map(order => {
      const referralCost = order.amount * 0.006; // Max 0.6% referral
      const netRevenue = order.platformFee - referralCost;
      const margin = (netRevenue / order.amount) * 100;
      
      return {
        order,
        referralCost,
        netRevenue,
        margin
      };
    });

    // Aggregated statistics
    const stats = {
      rejections: {
        p2p: {
          count: p2pRejections.length,
          totalAmount: p2pRejections.reduce((sum, r) => sum + r.rejectedAmount, 0),
          reasons: p2pRejections.reduce((acc, r) => {
            acc[r.reason] = (acc[r.reason] || 0) + 1;
            return acc;
          }, {} as Record<string, number>)
        },
        marketplace: {
          count: marketplaceRejections.length,
          totalAmount: marketplaceRejections.reduce((sum, r) => sum + r.rejectedAmount, 0),
          reasons: marketplaceRejections.reduce((acc, r) => {
            acc[r.reason] = (acc[r.reason] || 0) + 1;
            return acc;
          }, {} as Record<string, number>)
        }
      },
      profitability: {
        p2p: {
          totalTransactions: successfulP2P.length,
          totalRevenue: successfulP2P.reduce((sum, tx) => sum + tx.fee, 0),
          averageMargin: p2pProfitability.reduce((sum, p) => sum + p.margin, 0) / p2pProfitability.length,
          netRevenue: p2pProfitability.reduce((sum, p) => sum + p.netRevenue, 0)
        },
        marketplace: {
          totalOrders: successfulMarketplace.length,
          totalRevenue: successfulMarketplace.reduce((sum, order) => sum + order.platformFee, 0),
          averageMargin: marketplaceProfitability.reduce((sum, p) => sum + p.margin, 0) / marketplaceProfitability.length,
          netRevenue: marketplaceProfitability.reduce((sum, p) => sum + p.netRevenue, 0)
        }
      },
      businessLogicHealth: {
        minimumEnforcement: {
          p2pCompliance: p2pRejections.filter(r => r.rejectedAmount < 10).length,
          marketplaceCompliance: marketplaceRejections.filter(r => r.rejectedAmount < 25).length
        },
        profitabilityScore: Math.round(
          (p2pProfitability.filter(p => p.margin > 0).length / Math.max(p2pProfitability.length, 1)) * 100
        )
      }
    };

    res.json({
      success: true,
      timeRange: {
        rejections: '24 hours',
        profitability: '7 days'
      },
      stats,
      lastUpdated: new Date().toISOString(),
      businessLogicVersion: '2.0.0'
    });

  } catch (error) {
    console.error('Monitoring dashboard error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate monitoring dashboard'
    });
  }
});

/**
 * Real-time rejection tracking
 * Logs transactions rejected due to business logic rules
 */
router.post('/business-logic/log-rejection', async (req, res) => {
  try {
    const { 
      transactionType, 
      amount, 
      reason, 
      paymentMethod, 
      userId,
      metadata = {} 
    } = req.body;

    if (!transactionType || !amount || !reason) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: transactionType, amount, reason'
      });
    }

    // Log rejection to database (you can create a dedicated rejections table)
    const rejectionLog = {
      transactionType,
      amount: parseFloat(amount),
      reason,
      paymentMethod: paymentMethod || 'unknown',
      userId: userId || null,
      metadata: JSON.stringify(metadata),
      rejectedAt: new Date(),
      businessLogicVersion: '2.0.0'
    };

    // For now, we'll use console logging with structured data
    console.log('🚫 TRANSACTION REJECTED:', {
      ...rejectionLog,
      severity: amount < 10 ? 'info' : amount < 25 ? 'warning' : 'high',
      impact: amount < 10 ? 'minimum_enforcement' : 'business_logic_violation'
    });

    res.json({
      success: true,
      logged: true,
      rejectionId: `rej_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
      businessLogicCompliant: true
    });

  } catch (error) {
    console.error('Rejection logging error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to log rejection'
    });
  }
});

/**
 * Fee structure performance analytics
 */
router.get('/business-logic/fee-performance', async (req, res) => {
  try {
    const { timeRange = '7d' } = req.query;
    
    const daysBack = timeRange === '1d' ? 1 : timeRange === '7d' ? 7 : 30;
    const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

    // Analyze fee performance by payment method
    const p2pByMethod = await db
      .select({
        senderMethod: sql<string>`sender_method`,
        count: sql<number>`COUNT(*)`,
        totalAmount: sql<number>`SUM(CAST(amount AS DECIMAL))`,
        totalFees: sql<number>`SUM(CAST(fee AS DECIMAL))`,
        avgAmount: sql<number>`AVG(CAST(amount AS DECIMAL))`,
        avgFee: sql<number>`AVG(CAST(fee AS DECIMAL))`
      })
      .from(p2pTransfers)
      .where(
        and(
          eq(sql`status`, 'completed'),
          gte(sql`created_at`, startDate)
        )
      )
      .groupBy(sql`sender_method`);

    // Calculate effective fee rates and profitability
    const feeAnalysis = p2pByMethod.map(method => {
      const effectiveRate = (method.totalFees / method.totalAmount) * 100;
      
      // Estimate processing costs
      let processingCost = 0;
      if (method.senderMethod === 'credit-card') {
        processingCost = method.totalAmount * 0.029 + (method.count * 0.30);
      } else if (method.senderMethod === 'usdc') {
        processingCost = method.totalAmount * 0.005;
      } else if (method.senderMethod === 'xrp') {
        processingCost = method.count * 0.0002;
      } else {
        processingCost = method.totalAmount * 0.01;
      }

      const netRevenue = method.totalFees - processingCost;
      const netMargin = (netRevenue / method.totalAmount) * 100;

      return {
        method: method.senderMethod,
        transactions: method.count,
        volume: method.totalAmount,
        fees: method.totalFees,
        effectiveRate: Math.round(effectiveRate * 100) / 100,
        processingCost: Math.round(processingCost * 100) / 100,
        netRevenue: Math.round(netRevenue * 100) / 100,
        netMargin: Math.round(netMargin * 100) / 100,
        avgTransactionSize: Math.round(method.avgAmount * 100) / 100
      };
    });

    res.json({
      success: true,
      timeRange: `${daysBack} days`,
      feeAnalysis,
      summary: {
        totalTransactions: feeAnalysis.reduce((sum, f) => sum + f.transactions, 0),
        totalVolume: Math.round(feeAnalysis.reduce((sum, f) => sum + f.volume, 0) * 100) / 100,
        totalFees: Math.round(feeAnalysis.reduce((sum, f) => sum + f.fees, 0) * 100) / 100,
        totalNetRevenue: Math.round(feeAnalysis.reduce((sum, f) => sum + f.netRevenue, 0) * 100) / 100,
        overallMargin: Math.round(
          (feeAnalysis.reduce((sum, f) => sum + f.netRevenue, 0) / 
           feeAnalysis.reduce((sum, f) => sum + f.volume, 0)) * 100 * 100
        ) / 100
      },
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Fee performance analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate fee performance analytics'
    });
  }
});

/**
 * User behavior analysis on minimum amounts
 */
router.get('/business-logic/user-behavior', async (req, res) => {
  try {
    // This would track user behavior patterns around minimum amounts
    // For now, we'll provide a structured response that can be expanded
    
    const behaviorMetrics = {
      minimumAmountImpact: {
        description: 'Analysis of user behavior with $10/$25 minimums',
        metrics: {
          dropOffRate: 'TBD - requires user session tracking',
          conversionRate: 'TBD - requires funnel analysis',
          averageIncrease: 'TBD - compare pre/post minimum implementation'
        }
      },
      recommendedOptimizations: [
        'Implement user education about minimum amounts',
        'Add fee calculator before transaction initiation',
        'Consider promotional rates for first-time users',
        'Track user feedback on minimum amounts'
      ],
      dataCollectionNeeded: [
        'User session tracking',
        'Funnel analytics implementation',
        'A/B testing framework for minimum amounts',
        'User feedback collection system'
      ]
    };

    res.json({
      success: true,
      behaviorMetrics,
      status: 'initial_framework',
      nextSteps: 'Implement user session tracking for comprehensive analysis',
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('User behavior analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate user behavior analysis'
    });
  }
});

export default router;