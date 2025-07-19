import { Router } from "express";
import { db } from "../db";
import { users, transactions, referrals, globalAIAgents, agentServiceOrders } from "@shared/schema";
import { sql, count, sum, avg, desc, eq } from "drizzle-orm";

const router = Router();

// Platform Analytics Endpoint
router.get("/platform-stats", async (req, res) => {
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

export default router;