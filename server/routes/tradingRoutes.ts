import { Router } from 'express';
import { db } from '../db';
import { 
  limitOrders, 
  portfolioHoldings, 
  mevProtectionSettings, 
  chartSettings
} from '@shared/schema';
import { createInsertSchema } from 'drizzle-zod';
import { eq, and, desc } from 'drizzle-orm';
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

    console.log(`✅ Limit order created: ${order.amount} ${order.fromAsset} → ${order.toAsset} at $${order.limitPrice}`);

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
      .orderBy(desc(portfolioHoldings.usdValue));

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

export default router;