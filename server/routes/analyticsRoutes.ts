import { Router } from "express";
import { db } from "../db";
import { users, transactions, referrals, globalAIAgents, agentServiceOrders, microserviceRequests } from "@shared/schema";
import { sql, count, sum, avg, desc, eq, gte } from "drizzle-orm";
import { getUsageStats, detectSDK } from "../middleware/usageAnalyticsMiddleware";

const router = Router();

// ADMIN ONLY - Platform Analytics Endpoint (requires admin authentication)
router.get("/admin-stats", async (req, res) => {
  // Check for admin access - you can add proper admin authentication here
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY && adminKey !== 'admin-secret-key') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  try {
    // User Statistics
    const userStats = await db
      .select({
        totalUsers: count(),
      })
      .from(users);

    // Daily signups for last 30 days
    const dailySignups = await db
      .select({
        date: sql<string>`DATE(created_at)`.as('date'),
        signups: count(),
      })
      .from(users)
      .groupBy(sql`DATE(created_at)`)
      .orderBy(desc(sql`DATE(created_at)`))
      .limit(30);

    // Transaction Statistics
    const transactionStats = await db
      .select({
        totalTransactions: count(),
        totalVolume: sum(transactions.amount),
        totalFees: sum(transactions.platformFee),
        avgTransactionSize: avg(transactions.amount),
      })
      .from(transactions);

    // Completed vs Pending Transactions
    const transactionStatusStats = await db
      .select({
        status: transactions.status,
        count: count(),
        volume: sum(transactions.amount),
      })
      .from(transactions)
      .groupBy(transactions.status);

    // Referral Statistics
    const referralStats = await db
      .select({
        totalReferrals: count(),
        totalBonuses: sum(referrals.bonusAmount),
        activeReferrers: sql<number>`COUNT(DISTINCT referrer_id)`,
      })
      .from(referrals);

    // AI Agent Statistics
    const agentStats = await db
      .select({
        totalAgents: count(),
      })
      .from(globalAIAgents);

    // Revenue breakdown by currency
    const currencyBreakdown = await db
      .select({
        currency: transactions.currency,
        totalVolume: sum(transactions.amount),
        totalFees: sum(transactions.platformFee),
        transactionCount: count(),
      })
      .from(transactions)
      .groupBy(transactions.currency);

    const analytics = {
      users: {
        total: userStats[0]?.totalUsers || 0,
        dailySignups: dailySignups,
      },
      transactions: {
        total: transactionStats[0]?.totalTransactions || 0,
        totalVolume: transactionStats[0]?.totalVolume || "0",
        totalFeesCollected: transactionStats[0]?.totalFees || "0",
        avgTransactionSize: transactionStats[0]?.avgTransactionSize || "0",
        statusBreakdown: transactionStatusStats,
        currencyBreakdown: currencyBreakdown,
      },
      referrals: {
        total: referralStats[0]?.totalReferrals || 0,
        totalBonusesPaid: referralStats[0]?.totalBonuses || "0",
        activeReferrers: referralStats[0]?.activeReferrers || 0,
      },
      aiAgents: {
        total: agentStats[0]?.totalAgents || 0,
      },
      summary: {
        totalRevenue: parseFloat(transactionStats[0]?.totalFees || "0") + parseFloat(referralStats[0]?.totalBonuses || "0"),
        platformHealth: "Operational",
        lastUpdated: new Date().toISOString(),
      },
    };

    res.json({
      success: true,
      analytics,
    });
  } catch (error) {
    console.error("Analytics error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch platform analytics",
    });
  }
});

// Revenue Analytics Endpoint
router.get("/revenue-breakdown", async (req, res) => {
  try {
    // Monthly revenue trends
    const monthlyRevenue = await db
      .select({
        month: sql<string>`DATE_TRUNC('month', created_at)`.as('month'),
        transactionFees: sum(transactions.platformFee),
        transactionVolume: sum(transactions.amount),
        transactionCount: count(),
      })
      .from(transactions)
      .groupBy(sql`DATE_TRUNC('month', created_at)`)
      .orderBy(desc(sql`DATE_TRUNC('month', created_at)`))
      .limit(12);

    // Top performing payment methods
    const paymentMethodStats = await db
      .select({
        type: transactions.transactionType,
        volume: sum(transactions.amount),
        fees: sum(transactions.platformFee),
        count: count(),
      })
      .from(transactions)
      .groupBy(transactions.transactionType)
      .orderBy(desc(sum(transactions.amount)));

    res.json({
      success: true,
      revenue: {
        monthly: monthlyRevenue,
        paymentMethods: paymentMethodStats,
        totalLifetimeRevenue: monthlyRevenue.reduce((sum, month) => 
          sum + parseFloat(month.transactionFees || "0"), 0
        ),
      },
    });
  } catch (error) {
    console.error("Revenue analytics error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch revenue analytics",
    });
  }
});

// x402 Usage Analytics - Payment method breakdown and SDK detection
router.get("/x402/usage", async (req, res) => {
  try {
    const timeframe = (req.query.timeframe as 'hour' | 'day' | 'week') || 'day';
    const stats = await getUsageStats(timeframe);
    
    res.json({
      success: true,
      timeframe,
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('❌ Error fetching x402 usage stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch usage statistics',
      message: error.message,
    });
  }
});

// x402 Recent Requests - Last N requests with SDK detection
router.get("/x402/recent-requests", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    
    const requests = await db.query.microserviceRequests.findMany({
      limit,
      orderBy: [desc(microserviceRequests.createdAt)],
    });
    
    const enrichedRequests = requests.map(r => ({
      ...r,
      sdk: detectSDK(r.userAgent || undefined),
      timestamp: r.createdAt,
    }));
    
    res.json({
      success: true,
      count: enrichedRequests.length,
      requests: enrichedRequests,
    });
  } catch (error: any) {
    console.error('❌ Error fetching recent requests:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recent requests',
      message: error.message,
    });
  }
});

// x402 Payment Breakdown - EIP-712 vs raw transaction hash comparison
router.get("/x402/payment-breakdown", async (req, res) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    const startTime = new Date();
    startTime.setHours(startTime.getHours() - hours);
    
    const requests = await db.query.microserviceRequests.findMany({
      where: gte(microserviceRequests.createdAt, startTime),
    });
    
    const breakdown = {
      total: requests.length,
      eip712: {
        count: requests.filter(r => r.paymentMethod === 'eip712').length,
        sdks: {} as Record<string, number>,
      },
      tx_hash: {
        count: requests.filter(r => r.paymentMethod === 'tx_hash').length,
        sdks: {} as Record<string, number>,
      },
      no_payment: {
        count: requests.filter(r => !r.paymentMethod).length,
        sdks: {} as Record<string, number>,
      },
    };
    
    requests.forEach(r => {
      const sdk = detectSDK(r.userAgent || undefined);
      
      if (r.paymentMethod === 'eip712') {
        breakdown.eip712.sdks[sdk] = (breakdown.eip712.sdks[sdk] || 0) + 1;
      } else if (r.paymentMethod === 'tx_hash') {
        breakdown.tx_hash.sdks[sdk] = (breakdown.tx_hash.sdks[sdk] || 0) + 1;
      } else {
        breakdown.no_payment.sdks[sdk] = (breakdown.no_payment.sdks[sdk] || 0) + 1;
      }
    });
    
    res.json({
      success: true,
      hours,
      breakdown,
      insights: {
        eip712Percentage: breakdown.total > 0 
          ? Math.round((breakdown.eip712.count / breakdown.total) * 100) 
          : 0,
        txHashPercentage: breakdown.total > 0 
          ? Math.round((breakdown.tx_hash.count / breakdown.total) * 100) 
          : 0,
        conversionRate: breakdown.total > 0 
          ? Math.round(((breakdown.eip712.count + breakdown.tx_hash.count) / breakdown.total) * 100) 
          : 0,
      },
    });
  } catch (error: any) {
    console.error('❌ Error fetching payment breakdown:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payment breakdown',
      message: error.message,
    });
  }
});

export default router;