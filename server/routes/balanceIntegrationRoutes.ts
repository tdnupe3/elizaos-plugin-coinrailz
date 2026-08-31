import { Router } from "express";
import { db } from "../db";
import { sql, eq, and } from "drizzle-orm";
import { users, tradingFees } from "../../shared/schema";
import { isAuthenticated } from "../replitAuth.js";

const router = Router();

// Update user balance after onramp funding (allow guest access for testing)  
router.post('/update-balance', async (req, res) => {
  try {
    const { amount, method, transactionId } = req.body;
    const userId = (req as any).user?.claims?.sub || 'guest';

    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid amount specified'
      });
    }

    // Update user USDC balance (skip for guest users)
    if (userId !== 'guest') {
      try {
        await db.update(users)
          .set({ 
            usdcBalance: sql`COALESCE(${users.usdcBalance}, 0) + ${parseFloat(amount)}` 
          })
          .where(eq(users.id, userId));
      } catch (error) {
        console.warn(`Could not update balance for user ${userId}:`, error);
      }
    }

    // Record the funding transaction
    const transactionData = {
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

// Get user's current balance and transaction history (allow guest access for testing)
router.get('/dashboard-data', async (req, res) => {
  try {
    const userId = (req as any).user?.claims?.sub || 'guest';

    // For authenticated demo users, show their actual data
    if (userId === 'guest') {
      // Get all platform transactions for guest testing
      const allTransactions = await db.select({
        id: tradingFees.id,
        fromToken: tradingFees.fromToken,
        toToken: tradingFees.toToken,
        amount: tradingFees.amount,
        platformFee: tradingFees.platformFee,
        status: tradingFees.status,
        createdAt: tradingFees.createdAt,
        transactionHash: tradingFees.transactionHash
      }).from(tradingFees)
        .orderBy(sql`${tradingFees.createdAt} DESC`)
        .limit(20);

      const totalTransactions = allTransactions.length;
      const monthlyVolume = allTransactions.reduce((sum, tx) => sum + parseFloat(tx.amount || '0'), 0);
      const totalRevenue = allTransactions.reduce((sum, tx) => sum + parseFloat(tx.platformFee || '0'), 0);

      return res.json({
        success: true,
        balance: totalRevenue,
        totalTransactions,
        monthlyVolume,
        totalRevenue,
        activeAgents: 0,
        referralEarnings: 0,
        transactions: allTransactions.map(tx => ({
          id: tx.transactionHash,
          type: tx.fromToken === 'USD' ? 'onramp' : 'dex',
          amount: parseFloat(tx.amount || '0'),
          fee: parseFloat(tx.platformFee || '0'),
          status: tx.status,
          timestamp: tx.createdAt,
          description: `${tx.fromToken} → ${tx.toToken}`
        }))
      });
    }

    // Get user balance
    const [userBalance] = await db.select({
      usdcBalance: users.usdcBalance,
      totalReferrals: users.totalReferrals,
      referralBonus: users.referralBonus
    }).from(users).where(eq(users.id, userId));

    // Get transaction history for this specific user
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
      .where(eq(tradingFees.userAddress, userId))
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

    // CRITICAL: Collect actual fees to Circle wallet
    let feeCollected = false;
    let coinRailzWalletAddress = null;
    
    try {
      // Get Circle service for fee collection
      const { CircleService } = await import('../services/circleService');
      const circleService = new CircleService();
      
      // Determine currency for proper wallet routing
      const feeCurrency = toToken === 'XRP' ? 'XRP' : 
                         (toToken === 'BTC' || toToken === 'ETH') ? toToken : 'USDC';
      
      // Get appropriate Coin Railz wallet for fee collection
      const mainWallet = await circleService.getMainWallet(feeCurrency);
      if (mainWallet) {
        coinRailzWalletAddress = mainWallet.address;
        
        // Collect fee to appropriate Coin Railz wallet (Circle/CDP/XRP)
        feeCollected = await circleService.collectFee({
          source: userAddress,
          destination: mainWallet.address,
          amount: platformFee,
          currency: feeCurrency,
          memo: `DEX trading fee - ${fromToken}→${toToken}`
        });
        
        if (feeCollected) {
          console.log(`💰 FEE COLLECTED: $${platformFee} ${feeCurrency} → ${mainWallet.id} from ${userAddress.slice(0,8)}...`);
        }
      }
    } catch (error) {
      console.error('Fee collection error:', error);
      // Continue even if fee collection fails - record in database for manual processing
    }

    res.json({
      success: true,
      revenue: parseFloat(platformFee),
      recorded: true,
      feeCollected,
      coinRailzWallet: coinRailzWalletAddress?.slice(0,8) + '...' || 'Not configured'
    });

  } catch (error) {
    console.error('Trading fee record error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record trading fee'
    });
  }
});

// Record trading fees from DEX swaps (for revenue tracking)
router.post('/record-trading-fee', async (req, res) => {
  try {
    const { userAddress, fromToken, toToken, amount, platformFee, transactionHash } = req.body;
    const userId = (req as any).user?.claims?.sub || null;

    if (!userAddress || !fromToken || !toToken || !amount || !platformFee) {
      return res.status(400).json({
        success: false,
        error: 'Missing required trading fee data'
      });
    }

    // Record the trading fee transaction
    const tradingFeeData = {
      userAddress: userAddress,
      fromToken: fromToken,
      toToken: toToken,
      amount: amount.toString(),
      platformFee: platformFee.toString(),
      transactionHash: transactionHash || `swap-${Date.now()}`,
      revenue: platformFee.toString(),
      status: 'completed' as const,
      chainId: 1
    };

    await db.insert(tradingFees).values(tradingFeeData);

    console.log(`💰 Trading Fee Recorded: $${platformFee} from ${fromToken}→${toToken} swap`);
    console.log(`📊 Revenue generated and persisted to database`);

    res.json({
      success: true,
      feeRecorded: parseFloat(platformFee.toString()),
      transactionHash: tradingFeeData.transactionHash
    });

  } catch (error) {
    console.error('Trading fee recording error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record trading fee'
    });
  }
});

export default router;