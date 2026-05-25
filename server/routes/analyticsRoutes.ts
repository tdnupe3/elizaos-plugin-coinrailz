import { Router } from "express";
import { db } from "../db";
import { users, transactions, referrals, globalAIAgents, agentServiceOrders, microserviceRequests, x402CanaryPayments } from "@shared/schema";
import { sql, count, sum, avg, desc, eq, gte } from "drizzle-orm";
import { getUsageStats, detectSDK } from "../middleware/usageAnalyticsMiddleware";
import { createPublicClient, http, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import { X402CanaryJob } from "../jobs/x402CanaryJob";

const router = Router();

// ─── Canary Wallet Balance Check ─────────────────────────────────────────────
const USDC_BASE_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
const LOW_BALANCE_THRESHOLD_USD = 2.0;
const BALANCE_ABI = [
  {
    name: "balanceOf",
    type: "function",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

let _balanceCache: { balance: number; address: string; checkedAt: number } | null = null;
const BALANCE_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

async function getCanaryWalletBalance(): Promise<{
  address: string;
  usdcBalance: number;
  isLow: boolean;
  alert: string | null;
  checkedAt: string;
  error?: string;
}> {
  // Return cache if fresh
  if (_balanceCache && Date.now() - _balanceCache.checkedAt < BALANCE_CACHE_TTL_MS) {
    const balance = _balanceCache.balance;
    const isLow = balance < LOW_BALANCE_THRESHOLD_USD;
    return {
      address: _balanceCache.address,
      usdcBalance: balance,
      isLow,
      alert: isLow
        ? `⚠️ Canary wallet USDC balance ($${balance.toFixed(2)}) is below the $${LOW_BALANCE_THRESHOLD_USD} threshold — top up to keep canary payments running`
        : null,
      checkedAt: new Date(_balanceCache.checkedAt).toISOString(),
    };
  }

  const privateKey = process.env.PLATFORM_EOA_PRIVATE_KEY || process.env.EVM_PRIVATE_KEY;
  if (!privateKey) {
    return {
      address: "unknown",
      usdcBalance: 0,
      isLow: true,
      alert: "⚠️ No canary wallet key configured (PLATFORM_EOA_PRIVATE_KEY / EVM_PRIVATE_KEY missing)",
      checkedAt: new Date().toISOString(),
      error: "No wallet key",
    };
  }

  try {
    const normalizedKey = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
    const account = privateKeyToAccount(normalizedKey as `0x${string}`);
    const BASE_RPC = process.env.BASE_RPC_URL || "https://mainnet.base.org";
    const client = createPublicClient({ chain: base, transport: http(BASE_RPC) });

    const raw = await client.readContract({
      address: USDC_BASE_ADDRESS,
      abi: BALANCE_ABI,
      functionName: "balanceOf",
      args: [account.address],
    });

    const balance = parseFloat(formatUnits(raw as bigint, 6));
    _balanceCache = { balance, address: account.address, checkedAt: Date.now() };

    const isLow = balance < LOW_BALANCE_THRESHOLD_USD;
    return {
      address: account.address,
      usdcBalance: balance,
      isLow,
      alert: isLow
        ? `⚠️ Canary wallet USDC balance ($${balance.toFixed(2)}) is below the $${LOW_BALANCE_THRESHOLD_USD} threshold — top up to keep canary payments running`
        : null,
      checkedAt: new Date().toISOString(),
    };
  } catch (err: any) {
    return {
      address: "unknown",
      usdcBalance: 0,
      isLow: true,
      alert: "⚠️ Could not read canary wallet balance (RPC error)",
      checkedAt: new Date().toISOString(),
      error: err?.message ?? String(err),
    };
  }
}
// ─────────────────────────────────────────────────────────────────────────────

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

    // Add canary wallet health — warns if USDC balance < $2
    const walletHealth = await getCanaryWalletBalance();
    (analytics as any).canaryWallet = {
      usdcBalance: walletHealth.usdcBalance,
      isLow: walletHealth.isLow,
      alert: walletHealth.alert,
      address: walletHealth.address,
      explorerUrl: walletHealth.address !== "unknown"
        ? `https://basescan.org/address/${walletHealth.address}`
        : null,
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

// Gateway Analytics - Track traffic from Cloudflare, Farcaster, MCP, etc
router.get("/x402/gateway-breakdown", async (req, res) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    const startTime = new Date();
    startTime.setHours(startTime.getHours() - hours);
    
    const requests = await db.query.microserviceRequests.findMany({
      where: gte(microserviceRequests.createdAt, startTime),
    });
    
    const gatewayStats = {
      total: requests.length,
      byGateway: {} as Record<string, {
        count: number;
        paymentAttempts: number;
        successfulPayments: number;
        services: Record<string, number>;
        conversionRate: number;
      }>,
      topServices: {} as Record<string, number>,
      conversionFunnel: {
        totalRequests: 0,
        paymentAttempts: 0,
        successfulPayments: 0,
        overallConversionRate: 0,
      },
    };
    
    requests.forEach(r => {
      const gateway = (r as any).sourceGateway || 'direct';
      
      if (!gatewayStats.byGateway[gateway]) {
        gatewayStats.byGateway[gateway] = {
          count: 0,
          paymentAttempts: 0,
          successfulPayments: 0,
          services: {},
          conversionRate: 0,
        };
      }
      
      const gw = gatewayStats.byGateway[gateway];
      gw.count++;
      
      if (r.paymentAttempted) {
        gw.paymentAttempts++;
        gatewayStats.conversionFunnel.paymentAttempts++;
      }
      
      if (r.paymentMethod) {
        gw.successfulPayments++;
        gatewayStats.conversionFunnel.successfulPayments++;
      }
      
      gw.services[r.serviceId] = (gw.services[r.serviceId] || 0) + 1;
      gatewayStats.topServices[r.serviceId] = (gatewayStats.topServices[r.serviceId] || 0) + 1;
    });
    
    gatewayStats.conversionFunnel.totalRequests = requests.length;
    gatewayStats.conversionFunnel.overallConversionRate = requests.length > 0
      ? Math.round((gatewayStats.conversionFunnel.successfulPayments / requests.length) * 100)
      : 0;
    
    Object.keys(gatewayStats.byGateway).forEach(gw => {
      const stats = gatewayStats.byGateway[gw];
      stats.conversionRate = stats.count > 0
        ? Math.round((stats.successfulPayments / stats.count) * 100)
        : 0;
    });
    
    res.json({
      success: true,
      hours,
      timestamp: new Date().toISOString(),
      gatewayStats,
      insights: {
        cloudflareTraffic: gatewayStats.byGateway['cloudflare-coinrailz']?.count || 0,
        farcasterTraffic: gatewayStats.byGateway['farcaster-frame']?.count || 0,
        mcpTraffic: gatewayStats.byGateway['mcp']?.count || 0,
        directTraffic: gatewayStats.byGateway['direct']?.count || 0,
        topGateway: Object.entries(gatewayStats.byGateway)
          .sort((a, b) => b[1].count - a[1].count)[0]?.[0] || 'none',
      },
    });
  } catch (error: any) {
    console.error('❌ Error fetching gateway breakdown:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch gateway breakdown',
      message: error.message,
    });
  }
});

// IoT/M2M Traffic Analysis - Track machine-to-machine patterns
router.get("/x402/iot-analysis", async (req, res) => {
  try {
    const hours = parseInt(req.query.hours as string) || 168; // Default 1 week for IoT patterns
    const startTime = new Date();
    startTime.setHours(startTime.getHours() - hours);
    
    const requests = await db.query.microserviceRequests.findMany({
      where: gte(microserviceRequests.createdAt, startTime),
    });
    
    const iotIndicators = {
      automatedUserAgents: ['curl', 'python', 'node-fetch', 'axios', 'go-http', 'java', 'rust'],
      machinePatterns: 0,
      humanPatterns: 0,
      highFrequencyClients: {} as Record<string, number>,
      repeatClients: 0,
      uniqueClients: new Set<string>(),
    };
    
    const clientRequestCounts = new Map<string, number>();
    
    requests.forEach(r => {
      const clientId = r.clientIp || 'unknown';
      iotIndicators.uniqueClients.add(clientId);
      
      const count = (clientRequestCounts.get(clientId) || 0) + 1;
      clientRequestCounts.set(clientId, count);
      
      const ua = (r.userAgent || '').toLowerCase();
      const isMachine = iotIndicators.automatedUserAgents.some(agent => ua.includes(agent)) 
        || !ua.includes('mozilla');
      
      if (isMachine) {
        iotIndicators.machinePatterns++;
      } else {
        iotIndicators.humanPatterns++;
      }
    });
    
    clientRequestCounts.forEach((count, clientId) => {
      if (count > 10) {
        iotIndicators.highFrequencyClients[clientId] = count;
        iotIndicators.repeatClients++;
      }
    });
    
    res.json({
      success: true,
      hours,
      timestamp: new Date().toISOString(),
      iotAnalysis: {
        totalRequests: requests.length,
        machineTraffic: iotIndicators.machinePatterns,
        humanTraffic: iotIndicators.humanPatterns,
        machinePercentage: requests.length > 0 
          ? Math.round((iotIndicators.machinePatterns / requests.length) * 100) 
          : 0,
        uniqueClients: iotIndicators.uniqueClients.size,
        repeatClients: iotIndicators.repeatClients,
        highFrequencyClients: Object.keys(iotIndicators.highFrequencyClients).length,
      },
      m2mReadiness: {
        score: Math.min(100, Math.round(
          (iotIndicators.machinePatterns / Math.max(1, requests.length)) * 50 +
          (iotIndicators.repeatClients / Math.max(1, iotIndicators.uniqueClients.size)) * 50
        )),
        indicators: {
          automatedTraffic: iotIndicators.machinePatterns > iotIndicators.humanPatterns,
          repeatUsage: iotIndicators.repeatClients > 5,
          highVolume: requests.length > 100,
        },
      },
    });
  } catch (error: any) {
    console.error('❌ Error fetching IoT analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch IoT analysis',
      message: error.message,
    });
  }
});

// ─── Canary Status — single endpoint for "how is the platform doing?" queries ──
// Combines: live USDC balance, canary job health, last 5 run records.
// Alert fires if balance < $2 so you know before the canary starts failing.
router.get("/x402/canary-status", async (req, res) => {
  try {
    const [walletHealth, recentRuns] = await Promise.all([
      getCanaryWalletBalance(),
      db.query.x402CanaryPayments.findMany({
        orderBy: [desc(x402CanaryPayments.createdAt)],
        limit: 5,
      }),
    ]);

    const jobStatus = X402CanaryJob.getStatus();
    const lastSuccess = recentRuns.find((r) => r.status === "succeeded");

    res.json({
      success: true,
      checkedAt: new Date().toISOString(),
      walletHealth: {
        address: walletHealth.address,
        usdcBalance: walletHealth.usdcBalance,
        lowBalanceThresholdUsd: LOW_BALANCE_THRESHOLD_USD,
        isLow: walletHealth.isLow,
        alert: walletHealth.alert,
        explorerUrl: walletHealth.address !== "unknown"
          ? `https://basescan.org/address/${walletHealth.address}`
          : null,
      },
      canaryJob: {
        running: jobStatus.running,
        circuitOpen: jobStatus.circuitOpen,
        consecutiveFailures: jobStatus.consecutiveFailures,
        lastSuccessAt: jobStatus.lastSuccessAt,
        intervalHours: 6,
      },
      lastVerifiedPayment: lastSuccess
        ? {
            txHash: lastSuccess.txHash,
            explorerUrl: lastSuccess.explorerUrl,
            amountUsd: lastSuccess.amountUsd,
            network: lastSuccess.network,
            at: lastSuccess.createdAt,
          }
        : null,
      recentRuns: recentRuns.map((r) => ({
        id: r.id,
        status: r.status,
        txHash: r.txHash,
        explorerUrl: r.explorerUrl,
        amountUsd: r.amountUsd,
        errorMessage: r.errorMessage,
        at: r.createdAt,
      })),
    });
  } catch (err: any) {
    console.error("❌ canary-status error:", err);
    res.status(500).json({ success: false, error: err?.message ?? String(err) });
  }
});
// ─────────────────────────────────────────────────────────────────────────────

export default router;