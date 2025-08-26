import { Router } from 'express';
import { db } from '../db';
import { 
  limitOrders, 
  portfolioHoldings, 
  mevProtectionSettings, 
  chartSettings,
  bridgeTransactions,
  chainFeeOptimization,
  chainSelectionPreferences,
  userWatchlists,
  watchlistAssets,
  tradingPerformance,
  riskManagementSettings,
  stopLimitOrders,
  bracketOrders,
  portfolioAnalytics,
  advancedWatchlists,
  advancedWatchlistAssets,
  insertStopLimitOrderSchema,
  insertBracketOrderSchema,
  insertPortfolioAnalyticsSchema,
  insertAdvancedWatchlistSchema,
  insertAdvancedWatchlistAssetSchema
} from '@shared/schema';
import { createInsertSchema } from 'drizzle-zod';
import { eq, and, desc, sql } from 'drizzle-orm';
import { isAuthenticated } from '../replitAuth';

// Create insert schemas
const insertLimitOrderSchema = createInsertSchema(limitOrders).omit({
  id: true,
  createdAt: true,
  filledAt: true,
  cancelledAt: true
});

const insertMEVProtectionSettingsSchema = createInsertSchema(mevProtectionSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

const insertChartSettingsSchema = createInsertSchema(chartSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

const insertWatchlistSchema = createInsertSchema(userWatchlists).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

const insertRiskManagementSchema = createInsertSchema(riskManagementSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

const router = Router();

// Limit Orders Management
router.get('/limit-orders', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const orders = await db
      .select()
      .from(limitOrders)
      .where(and(
        eq(limitOrders.userId, userId),
        eq(limitOrders.status, 'active')
      ))
      .orderBy(desc(limitOrders.createdAt));

    res.json(orders);
  } catch (error) {
    console.error('Error fetching limit orders:', error);
    res.status(500).json({ message: 'Failed to fetch limit orders' });
  }
});

router.post('/limit-orders', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const validatedData = insertLimitOrderSchema.parse({
      ...req.body,
      userId
    });

    const [order] = await db
      .insert(limitOrders)
      .values(validatedData)
      .returning();

    console.log(`✅ Limit order created: ${order.fromAmount} ${order.fromAsset} → ${order.toAsset} at $${order.limitPrice}`);

    res.status(201).json(order);
  } catch (error) {
    console.error('Error creating limit order:', error);
    res.status(400).json({ 
      message: 'Failed to create limit order',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.delete('/limit-orders/:orderId', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub;
    const { orderId } = req.params;

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const [cancelledOrder] = await db
      .update(limitOrders)
      .set({ 
        status: 'cancelled',
        cancelledAt: new Date()
      })
      .where(and(
        eq(limitOrders.id, orderId),
        eq(limitOrders.userId, userId)
      ))
      .returning();

    if (!cancelledOrder) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json({ message: 'Order cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling limit order:', error);
    res.status(500).json({ message: 'Failed to cancel order' });
  }
});

// Portfolio Tracking
router.get('/portfolio', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const holdings = await db
      .select()
      .from(portfolioHoldings)
      .where(eq(portfolioHoldings.userId, userId))
      .orderBy(desc(portfolioHoldings.currentValue));

    res.json(holdings);
  } catch (error) {
    console.error('Error fetching portfolio:', error);
    res.status(500).json({ message: 'Failed to fetch portfolio' });
  }
});

router.post('/portfolio/update', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { asset, balance, currentValue, profitLoss, profitLossPercentage } = req.body;

    // Upsert portfolio holding
    const existingHolding = await db
      .select()
      .from(portfolioHoldings)
      .where(and(
        eq(portfolioHoldings.userId, userId),
        eq(portfolioHoldings.asset, asset)
      ))
      .limit(1);

    if (existingHolding.length > 0) {
      // Update existing
      const [updated] = await db
        .update(portfolioHoldings)
        .set({
          balance,
          currentValue,
          profitLoss,
          profitLossPercentage,
          lastUpdated: new Date()
        })
        .where(eq(portfolioHoldings.id, existingHolding[0].id))
        .returning();
      
      res.json(updated);
    } else {
      // Create new
      const [created] = await db
        .insert(portfolioHoldings)
        .values({
          userId,
          asset,
          network: 'ethereum', // default network
          balance,
          currentValue,
          profitLoss,
          profitLossPercentage
        })
        .returning();
      
      res.json(created);
    }
  } catch (error) {
    console.error('Error updating portfolio:', error);
    res.status(500).json({ message: 'Failed to update portfolio' });
  }
});

// MEV Protection Settings
router.get('/mev-settings', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const [settings] = await db
      .select()
      .from(mevProtectionSettings)
      .where(eq(mevProtectionSettings.userId, userId))
      .limit(1);

    // Return default settings if none exist
    const defaultSettings = {
      enabled: true,
      priorityRouting: false,
      maxSlippage: '1.0',
      frontRunProtection: true,
      sandwichProtection: true
    };

    res.json(settings || defaultSettings);
  } catch (error) {
    console.error('Error fetching MEV settings:', error);
    res.status(500).json({ message: 'Failed to fetch MEV settings' });
  }
});

router.put('/mev-settings', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const validatedData = insertMEVProtectionSettingsSchema.parse({
      ...req.body,
      userId
    });

    // Upsert MEV settings
    const existingSettings = await db
      .select()
      .from(mevProtectionSettings)
      .where(eq(mevProtectionSettings.userId, userId))
      .limit(1);

    if (existingSettings.length > 0) {
      const [updated] = await db
        .update(mevProtectionSettings)
        .set({
          ...validatedData,
          updatedAt: new Date()
        })
        .where(eq(mevProtectionSettings.id, existingSettings[0].id))
        .returning();
      
      res.json(updated);
    } else {
      const [created] = await db
        .insert(mevProtectionSettings)
        .values(validatedData)
        .returning();
      
      res.json(created);
    }
  } catch (error) {
    console.error('Error updating MEV settings:', error);
    res.status(500).json({ message: 'Failed to update MEV settings' });
  }
});

// Chart Settings
router.get('/chart-settings', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const [settings] = await db
      .select()
      .from(chartSettings)
      .where(eq(chartSettings.userId, userId))
      .limit(1);

    // Return default settings if none exist
    const defaultSettings = {
      defaultTimeframe: '1h',
      chartType: 'candlestick',
      showVolume: true,
      showIndicators: false
    };

    res.json(settings || defaultSettings);
  } catch (error) {
    console.error('Error fetching chart settings:', error);
    res.status(500).json({ message: 'Failed to fetch chart settings' });
  }
});

router.put('/chart-settings', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const validatedData = insertChartSettingsSchema.parse({
      ...req.body,
      userId
    });

    // Upsert chart settings
    const existingSettings = await db
      .select()
      .from(chartSettings)
      .where(eq(chartSettings.userId, userId))
      .limit(1);

    if (existingSettings.length > 0) {
      const [updated] = await db
        .update(chartSettings)
        .set({
          ...validatedData,
          updatedAt: new Date()
        })
        .where(eq(chartSettings.id, existingSettings[0].id))
        .returning();
      
      res.json(updated);
    } else {
      const [created] = await db
        .insert(chartSettings)
        .values(validatedData)
        .returning();
      
      res.json(created);
    }
  } catch (error) {
    console.error('Error updating chart settings:', error);
    res.status(500).json({ message: 'Failed to update chart settings' });
  }
});

// === PHASE 3: MULTI-CHAIN BRIDGE INTERFACE (3.11) ===

// Get optimal bridge route with fees
router.get('/bridge/quote', isAuthenticated, async (req: any, res) => {
  try {
    const { fromChain, toChain, asset, amount } = req.query;
    
    if (!fromChain || !toChain || !asset || !amount) {
      return res.status(400).json({ 
        error: 'Missing required parameters: fromChain, toChain, asset, amount' 
      });
    }

    // Get all available bridge options with fees
    const bridgeOptions = await db
      .select()
      .from(chainFeeOptimization)
      .where(and(
        eq(chainFeeOptimization.fromChain, fromChain as string),
        eq(chainFeeOptimization.toChain, toChain as string),
        eq(chainFeeOptimization.asset, asset as string)
      ))
      .orderBy(chainFeeOptimization.totalFee);

    // Calculate estimated fees for each bridge provider
    const quotes = bridgeOptions.map(option => ({
      provider: option.bridgeProvider,
      bridgeFee: parseFloat(option.baseFee) * parseFloat(amount as string),
      networkFee: parseFloat(option.networkFee),
      platformFee: parseFloat(option.platformFee) * parseFloat(amount as string),
      totalFee: parseFloat(option.totalFee) * parseFloat(amount as string),
      estimatedTime: option.estimatedTime,
      successRate: parseFloat(option.success_rate),
      isRecommended: option.isRecommended
    }));

    res.json({
      fromChain,
      toChain,
      asset,
      amount: parseFloat(amount as string),
      quotes: quotes.length > 0 ? quotes : [
        {
          provider: 'across',
          bridgeFee: parseFloat(amount as string) * 0.0025,
          networkFee: 15.00,
          platformFee: parseFloat(amount as string) * 0.001,
          totalFee: parseFloat(amount as string) * 0.0035 + 15.00,
          estimatedTime: 15,
          successRate: 99.2,
          isRecommended: true
        }
      ]
    });
  } catch (error) {
    console.error('Error fetching bridge quote:', error);
    res.status(500).json({ message: 'Failed to fetch bridge quote' });
  }
});

// Execute bridge transaction
router.post('/bridge/execute', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { fromChain, toChain, fromAsset, toAsset, fromAmount, bridgeProvider, quote } = req.body;

    if (!fromChain || !toChain || !fromAsset || !fromAmount || !bridgeProvider) {
      return res.status(400).json({ error: 'Missing required bridge parameters' });
    }

    // Create bridge transaction record
    const [bridgeTransaction] = await db
      .insert(bridgeTransactions)
      .values({
        userId,
        fromChain,
        toChain,
        fromAsset,
        toAsset: toAsset || fromAsset,
        fromAmount: fromAmount.toString(),
        bridgeFee: quote?.bridgeFee?.toString() || '0',
        networkFee: quote?.networkFee?.toString() || '0',
        totalFee: quote?.totalFee?.toString() || '0',
        bridgeProvider,
        estimatedTime: quote?.estimatedTime || 15,
        status: 'pending'
      })
      .returning();

    // In a real implementation, this would integrate with actual bridge protocols
    // For now, return success with transaction tracking
    res.json({
      success: true,
      transactionId: bridgeTransaction.id,
      status: 'pending',
      estimatedTime: bridgeTransaction.estimatedTime,
      message: 'Bridge transaction initiated successfully'
    });
  } catch (error) {
    console.error('Error executing bridge transaction:', error);
    res.status(500).json({ message: 'Failed to execute bridge transaction' });
  }
});

// Get bridge transaction status
router.get('/bridge/status/:transactionId', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { transactionId } = req.params;
    
    const [transaction] = await db
      .select()
      .from(bridgeTransactions)
      .where(and(
        eq(bridgeTransactions.id, parseInt(transactionId)),
        eq(bridgeTransactions.userId, userId)
      ))
      .limit(1);

    if (!transaction) {
      return res.status(404).json({ message: 'Bridge transaction not found' });
    }

    res.json(transaction);
  } catch (error) {
    console.error('Error fetching bridge status:', error);
    res.status(500).json({ message: 'Failed to fetch bridge status' });
  }
});

// === PHASE 3: CROSS-CHAIN FEE OPTIMIZATION (3.13) ===

// Get optimized fee routes for all chains
router.get('/fees/optimization', async (req, res) => {
  try {
    const { asset } = req.query;
    
    // Get latest fee optimization data
    const feeOptimizations = await db
      .select()
      .from(chainFeeOptimization)
      .where(asset ? eq(chainFeeOptimization.asset, asset as string) : undefined)
      .orderBy(chainFeeOptimization.totalFee);

    // Group by chain pairs
    const optimizedRoutes = feeOptimizations.reduce((acc, route) => {
      const key = `${route.fromChain}-${route.toChain}`;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push({
        provider: route.bridgeProvider,
        baseFee: parseFloat(route.baseFee),
        networkFee: parseFloat(route.networkFee),
        platformFee: parseFloat(route.platformFee),
        totalFee: parseFloat(route.totalFee),
        estimatedTime: route.estimatedTime,
        successRate: parseFloat(route.success_rate),
        isRecommended: route.isRecommended
      });
      return acc;
    }, {} as Record<string, any[]>);

    res.json({
      optimizedRoutes,
      lastUpdated: new Date().toISOString(),
      totalRoutes: feeOptimizations.length
    });
  } catch (error) {
    console.error('Error fetching fee optimization:', error);
    res.status(500).json({ message: 'Failed to fetch fee optimization data' });
  }
});

// === PHASE 3: CHAIN SELECTION WITH FEE DISPLAY (3.14) ===

// Get user's chain selection preferences
router.get('/chain-preferences', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const [preferences] = await db
      .select()
      .from(chainSelectionPreferences)
      .where(eq(chainSelectionPreferences.userId, userId))
      .limit(1);

    // Return default preferences if none exist
    const defaultPreferences = {
      preferredChains: ['base-mainnet', 'ethereum-mainnet'],
      autoSelectCheapest: true,
      maxAcceptableFee: 10.00,
      maxAcceptableTime: 30,
      showAdvancedOptions: false,
      feeDisplayFormat: 'usd'
    };

    res.json(preferences || defaultPreferences);
  } catch (error) {
    console.error('Error fetching chain preferences:', error);
    res.status(500).json({ message: 'Failed to fetch chain preferences' });
  }
});

// Update user's chain selection preferences
router.put('/chain-preferences', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const preferences = req.body;

    // Upsert chain selection preferences
    const existingPreferences = await db
      .select()
      .from(chainSelectionPreferences)
      .where(eq(chainSelectionPreferences.userId, userId))
      .limit(1);

    if (existingPreferences.length > 0) {
      const [updated] = await db
        .update(chainSelectionPreferences)
        .set({
          ...preferences,
          updatedAt: new Date()
        })
        .where(eq(chainSelectionPreferences.id, existingPreferences[0].id))
        .returning();
      
      res.json(updated);
    } else {
      const [created] = await db
        .insert(chainSelectionPreferences)
        .values({
          userId,
          ...preferences
        })
        .returning();
      
      res.json(created);
    }
  } catch (error) {
    console.error('Error updating chain preferences:', error);
    res.status(500).json({ message: 'Failed to update chain preferences' });
  }
});

// === ADVANCED COINBASE DEX FEATURE PARITY ===

// Stop-Limit Orders Management
router.get('/stop-limit-orders', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const orders = await db
      .select()
      .from(stopLimitOrders)
      .where(eq(stopLimitOrders.userId, userId))
      .orderBy(desc(stopLimitOrders.createdAt));

    res.json(orders);
  } catch (error) {
    console.error('Error fetching stop-limit orders:', error);
    res.status(500).json({ message: 'Failed to fetch stop-limit orders' });
  }
});

router.post('/stop-limit-orders', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const validatedData = insertStopLimitOrderSchema.parse(req.body);
    
    const [order] = await db
      .insert(stopLimitOrders)
      .values({
        ...validatedData,
        userId
      })
      .returning();

    res.status(201).json(order);
  } catch (error) {
    console.error('Error creating stop-limit order:', error);
    res.status(500).json({ message: 'Failed to create stop-limit order' });
  }
});

router.patch('/stop-limit-orders/:orderId/cancel', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { orderId } = req.params;
    
    const [updatedOrder] = await db
      .update(stopLimitOrders)
      .set({ 
        status: 'cancelled',
        cancelledAt: new Date()
      })
      .where(and(
        eq(stopLimitOrders.id, parseInt(orderId)),
        eq(stopLimitOrders.userId, userId)
      ))
      .returning();

    if (!updatedOrder) {
      return res.status(404).json({ message: 'Stop-limit order not found' });
    }

    res.json(updatedOrder);
  } catch (error) {
    console.error('Error cancelling stop-limit order:', error);
    res.status(500).json({ message: 'Failed to cancel stop-limit order' });
  }
});

// Bracket Orders (OCO) Management
router.get('/bracket-orders', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const orders = await db
      .select()
      .from(bracketOrders)
      .where(eq(bracketOrders.userId, userId))
      .orderBy(desc(bracketOrders.createdAt));

    res.json(orders);
  } catch (error) {
    console.error('Error fetching bracket orders:', error);
    res.status(500).json({ message: 'Failed to fetch bracket orders' });
  }
});

router.post('/bracket-orders', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const validatedData = insertBracketOrderSchema.parse(req.body);
    
    const [order] = await db
      .insert(bracketOrders)
      .values({
        ...validatedData,
        userId
      })
      .returning();

    res.status(201).json(order);
  } catch (error) {
    console.error('Error creating bracket order:', error);
    res.status(500).json({ message: 'Failed to create bracket order' });
  }
});

router.patch('/bracket-orders/:orderId/cancel', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { orderId } = req.params;
    
    const [updatedOrder] = await db
      .update(bracketOrders)
      .set({ 
        status: 'cancelled',
        completedAt: new Date()
      })
      .where(and(
        eq(bracketOrders.id, parseInt(orderId)),
        eq(bracketOrders.userId, userId)
      ))
      .returning();

    if (!updatedOrder) {
      return res.status(404).json({ message: 'Bracket order not found' });
    }

    res.json(updatedOrder);
  } catch (error) {
    console.error('Error cancelling bracket order:', error);
    res.status(500).json({ message: 'Failed to cancel bracket order' });
  }
});

// Portfolio Analytics
router.get('/portfolio/analytics', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days as string));

    const analytics = await db
      .select()
      .from(portfolioAnalytics)
      .where(and(
        eq(portfolioAnalytics.userId, userId),
        // Add date filter when needed
      ))
      .orderBy(desc(portfolioAnalytics.analysisDate))
      .limit(parseInt(days as string));

    // Calculate current portfolio summary
    const latestAnalytics = analytics[0];
    const portfolioSummary = {
      totalValue: latestAnalytics?.totalValue || '0',
      totalReturn: latestAnalytics?.totalReturn || '0',
      dayChange: latestAnalytics?.dayChange || '0',
      weekChange: latestAnalytics?.weekChange || '0',
      monthChange: latestAnalytics?.monthChange || '0',
      sharpeRatio: latestAnalytics?.sharpeRatio || '0',
      maxDrawdown: latestAnalytics?.maxDrawdown || '0',
      assetAllocation: latestAnalytics?.assetAllocation || {},
      historicalData: analytics
    };

    res.json(portfolioSummary);
  } catch (error) {
    console.error('Error fetching portfolio analytics:', error);
    res.status(500).json({ message: 'Failed to fetch portfolio analytics' });
  }
});

router.post('/portfolio/analytics', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const validatedData = insertPortfolioAnalyticsSchema.parse(req.body);
    
    const [analytics] = await db
      .insert(portfolioAnalytics)
      .values({
        ...validatedData,
        userId
      })
      .returning();

    res.status(201).json(analytics);
  } catch (error) {
    console.error('Error creating portfolio analytics:', error);
    res.status(500).json({ message: 'Failed to create portfolio analytics' });
  }
});

// Advanced Watchlists Management
router.get('/watchlists', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const watchlists = await db
      .select()
      .from(advancedWatchlists)
      .where(eq(advancedWatchlists.userId, userId))
      .orderBy(desc(advancedWatchlists.createdAt));

    // Get asset counts for each watchlist
    const watchlistsWithCounts = await Promise.all(
      watchlists.map(async (watchlist) => {
        const assetCount = await db
          .select({ count: sql<number>`count(*)` })
          .from(advancedWatchlistAssets)
          .where(eq(advancedWatchlistAssets.watchlistId, watchlist.id));
        
        return {
          ...watchlist,
          assetCount: assetCount[0]?.count || 0
        };
      })
    );

    res.json(watchlistsWithCounts);
  } catch (error) {
    console.error('Error fetching watchlists:', error);
    res.status(500).json({ message: 'Failed to fetch watchlists' });
  }
});

router.post('/watchlists', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const validatedData = insertAdvancedWatchlistSchema.parse(req.body);
    
    const [watchlist] = await db
      .insert(advancedWatchlists)
      .values({
        ...validatedData,
        userId
      })
      .returning();

    res.status(201).json(watchlist);
  } catch (error) {
    console.error('Error creating watchlist:', error);
    res.status(500).json({ message: 'Failed to create watchlist' });
  }
});

router.get('/watchlists/:watchlistId/assets', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { watchlistId } = req.params;

    // Verify watchlist belongs to user
    const [watchlist] = await db
      .select()
      .from(advancedWatchlists)
      .where(and(
        eq(advancedWatchlists.id, parseInt(watchlistId)),
        eq(advancedWatchlists.userId, userId)
      ))
      .limit(1);

    if (!watchlist) {
      return res.status(404).json({ message: 'Watchlist not found' });
    }

    const assets = await db
      .select()
      .from(advancedWatchlistAssets)
      .where(eq(advancedWatchlistAssets.watchlistId, parseInt(watchlistId)))
      .orderBy(advancedWatchlistAssets.sortOrder);

    res.json(assets);
  } catch (error) {
    console.error('Error fetching watchlist assets:', error);
    res.status(500).json({ message: 'Failed to fetch watchlist assets' });
  }
});

router.post('/watchlists/:watchlistId/assets', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { watchlistId } = req.params;

    // Verify watchlist belongs to user
    const [watchlist] = await db
      .select()
      .from(advancedWatchlists)
      .where(and(
        eq(advancedWatchlists.id, parseInt(watchlistId)),
        eq(advancedWatchlists.userId, userId)
      ))
      .limit(1);

    if (!watchlist) {
      return res.status(404).json({ message: 'Watchlist not found' });
    }

    const validatedData = insertAdvancedWatchlistAssetSchema.parse(req.body);
    
    const [asset] = await db
      .insert(advancedWatchlistAssets)
      .values({
        ...validatedData,
        watchlistId: parseInt(watchlistId)
      })
      .returning();

    res.status(201).json(asset);
  } catch (error) {
    console.error('Error adding asset to watchlist:', error);
    res.status(500).json({ message: 'Failed to add asset to watchlist' });
  }
});

router.delete('/watchlists/:watchlistId/assets/:assetId', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { watchlistId, assetId } = req.params;

    // Verify watchlist belongs to user
    const [watchlist] = await db
      .select()
      .from(advancedWatchlists)
      .where(and(
        eq(advancedWatchlists.id, parseInt(watchlistId)),
        eq(advancedWatchlists.userId, userId)
      ))
      .limit(1);

    if (!watchlist) {
      return res.status(404).json({ message: 'Watchlist not found' });
    }

    const [deletedAsset] = await db
      .delete(advancedWatchlistAssets)
      .where(and(
        eq(advancedWatchlistAssets.id, parseInt(assetId)),
        eq(advancedWatchlistAssets.watchlistId, parseInt(watchlistId))
      ))
      .returning();

    if (!deletedAsset) {
      return res.status(404).json({ message: 'Asset not found in watchlist' });
    }

    res.json({ message: 'Asset removed from watchlist successfully' });
  } catch (error) {
    console.error('Error removing asset from watchlist:', error);
    res.status(500).json({ message: 'Failed to remove asset from watchlist' });
  }
});

// Price Alerts for Watchlist Assets
router.post('/watchlists/assets/:assetId/alerts', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { assetId } = req.params;
    const { priceAlertHigh, priceAlertLow, volumeAlertThreshold } = req.body;

    // Verify asset belongs to user's watchlist
    const [asset] = await db
      .select()
      .from(advancedWatchlistAssets)
      .innerJoin(advancedWatchlists, eq(advancedWatchlistAssets.watchlistId, advancedWatchlists.id))
      .where(and(
        eq(advancedWatchlistAssets.id, parseInt(assetId)),
        eq(advancedWatchlists.userId, userId)
      ))
      .limit(1);

    if (!asset) {
      return res.status(404).json({ message: 'Watchlist asset not found' });
    }

    const [updatedAsset] = await db
      .update(advancedWatchlistAssets)
      .set({
        priceAlertHigh: priceAlertHigh || null,
        priceAlertLow: priceAlertLow || null,
        volumeAlertThreshold: volumeAlertThreshold || null
      })
      .where(eq(advancedWatchlistAssets.id, parseInt(assetId)))
      .returning();

    res.json(updatedAsset);
  } catch (error) {
    console.error('Error setting price alerts:', error);
    res.status(500).json({ message: 'Failed to set price alerts' });
  }
});

export default router;