import { Router } from "express";
import { db } from "../db";
import { sql, eq, and } from "drizzle-orm";
import { users, tradingFees } from "../../shared/schema.js";
import { isAuthenticated } from "../replitAuth.js";

const router = Router();

// Update user balance after onramp funding
router.post('/update-balance', isAuthenticated, async (req, res) => {
  try {
    const { amount, method, transactionId } = req.body;
    const userId = (req as any).user?.claims?.sub;

    if (!userId || !amount || parseFloat(amount) <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid parameters'
      });
    }

    // Update user USDC balance
    await db.update(users)
      .set({ 
        usdcBalance: sql`COALESCE(${users.usdcBalance}, 0) + ${parseFloat(amount)}` 
      })
      .where(eq(users.id, userId));

    // Record the funding transaction
    const transactionData = {
      userId,
      userAddress: `onramp-${userId}`,
      fromToken: method === 'card' ? 'USD' : 'USD',
      toToken: 'USDC',
      amount: amount,
      platformFee: (parseFloat(amount) * 0.025).toString(), // 2.5% onramp fee
      transactionHash: transactionId || `onramp-${Date.now()}`,
      revenue: (parseFloat(amount) * 0.025).toString(),
      status: 'completed' as const,
      chainId: 1
    };

    await db.insert(tradingFees).values(transactionData);

    console.log(`✅ Balance Updated: $${amount} added to user ${userId.slice(0,8)}...`);
    console.log(`💰 Onramp Revenue: $${transactionData.revenue}`);

    res.json({
      success: true,
      newBalance: parseFloat(amount),
      revenue: parseFloat(transactionData.revenue)
    });

  } catch (error) {
    console.error('Balance update error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update balance'
    });
  }
});

// Get user's current balance and transaction history
router.get('/dashboard-data', isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).user?.claims?.sub;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    // Get user balance
    const [userBalance] = await db.select({
      usdcBalance: users.usdcBalance,
      totalReferrals: users.totalReferrals,
      referralBonus: users.referralBonus
    }).from(users).where(eq(users.id, userId));

    // Get transaction history
    const transactions = await db.select({
      id: tradingFees.id,
      fromToken: tradingFees.fromToken,
      toToken: tradingFees.toToken,
      amount: tradingFees.amount,
      platformFee: tradingFees.platformFee,
      status: tradingFees.status,
      createdAt: tradingFees.createdAt,
      transactionHash: tradingFees.transactionHash
    }).from(tradingFees)
      .where(eq(tradingFees.userId, userId))
      .orderBy(sql`${tradingFees.createdAt} DESC`)
      .limit(20);

    // Calculate stats
    const totalTransactions = transactions.length;
    const monthlyVolume = transactions.reduce((sum, tx) => sum + parseFloat(tx.amount || '0'), 0);
    const totalRevenue = transactions.reduce((sum, tx) => sum + parseFloat(tx.platformFee || '0'), 0);

    res.json({
      success: true,
      balance: parseFloat(userBalance?.usdcBalance || '0'),
      totalTransactions,
      monthlyVolume,
      totalRevenue,
      activeAgents: 0, // Will be implemented with AI marketplace integration
      referralEarnings: parseFloat(userBalance?.referralBonus || '0'),
      transactions: transactions.map(tx => ({
        id: tx.transactionHash,
        type: tx.fromToken === 'USD' ? 'onramp' : 'dex',
        amount: parseFloat(tx.amount || '0'),
        currency: tx.toToken,
        status: tx.status,
        timestamp: tx.createdAt?.toISOString() || new Date().toISOString(),
        description: `${tx.fromToken} → ${tx.toToken}`
      }))
    });

  } catch (error) {
    console.error('Dashboard data error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard data'
    });
  }
});

// Record trading fee when DEX swap is executed
router.post('/record-trading-fee', async (req, res) => {
  try {
    const { 
      userAddress, 
      fromToken, 
      toToken, 
      amount, 
      platformFee, 
      transactionHash, 
      chainId = 1 
    } = req.body;

    if (!userAddress || !amount || !platformFee) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters'
      });
    }

    // Find user by wallet address or create anonymous record
    let userId = 'anonymous';
    try {
      const [user] = await db.select({ id: users.id })
        .from(users)
        .where(eq(users.ethereumWallet, userAddress))
        .limit(1);
      if (user) userId = user.id;
    } catch (error) {
      // User not found, use anonymous
    }

    // Record the trading fee
    await db.insert(tradingFees).values({
      userId,
      userAddress,
      fromToken,
      toToken,
      amount: amount.toString(),
      platformFee: platformFee.toString(),
      transactionHash: transactionHash || `dex-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      revenue: platformFee.toString(),
      status: 'completed',
      chainId
    });

    console.log(`💰 DEX Revenue Recorded: $${platformFee} from ${userAddress.slice(0,8)}...`);

    res.json({
      success: true,
      revenue: parseFloat(platformFee),
      recorded: true
    });

  } catch (error) {
    console.error('Trading fee record error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record trading fee'
    });
  }
});

export default router;