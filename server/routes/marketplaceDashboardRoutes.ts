import { Router } from 'express';
import { storage } from '../storage';
import { sql } from 'drizzle-orm';
import { db } from '../db';

const router = Router();

// Get marketplace dashboard statistics
router.get('/marketplace/dashboard/stats', async (req, res) => {
  try {
    // Get order statistics
    const orderStats = await db.execute(sql`
      SELECT 
        COUNT(*) as total_orders,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_orders,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_orders,
        COUNT(CASE WHEN status IN ('paid', 'in_progress') THEN 1 END) as active_orders,
        COALESCE(SUM(amount), 0) as total_revenue,
        COALESCE(AVG(amount), 0) as avg_order_value
      FROM marketplace_orders
    `);

    const stats = orderStats.rows[0] as Record<string, unknown> | undefined;
    const stringValue = (value: unknown): string =>
      typeof value === 'string' || typeof value === 'number' ? String(value) : '0';
    
    res.json({
      success: true,
      data: {
        totalOrders: parseInt(stringValue(stats?.total_orders)) || 0,
        activeOrders: parseInt(stringValue(stats?.active_orders)) || 0,
        completedOrders: parseInt(stringValue(stats?.completed_orders)) || 0,
        pendingOrders: parseInt(stringValue(stats?.pending_orders)) || 0,
        totalRevenue: parseFloat(stringValue(stats?.total_revenue)) || 0,
        avgOrderValue: parseFloat(stringValue(stats?.avg_order_value)) || 0,
        customerSatisfaction: 4.8 // This would come from a ratings system
      }
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch dashboard statistics' 
    });
  }
});

// Get recent orders for dashboard
router.get('/marketplace/dashboard/recent-orders', async (req, res) => {
  try {
    const recentOrders = await db.execute(sql`
      SELECT 
        id,
        user_id as customer_name,
        service_type as service_name,
        amount,
        status,
        created_at
      FROM marketplace_orders 
      ORDER BY created_at DESC 
      LIMIT 10
    `);

    const formattedOrders = recentOrders.rows.map((order: any) => ({
      id: order.id,
      customerName: order.customer_name || 'Customer',
      serviceName: order.service_name || 'AI Service',
      amount: parseFloat(order.amount) || 0,
      status: order.status || 'pending',
      createdAt: order.created_at
    }));

    res.json({
      success: true,
      orders: formattedOrders
    });
  } catch (error) {
    console.error('Recent orders error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch recent orders' 
    });
  }
});

// Get order analytics
router.get('/marketplace/dashboard/analytics', async (req, res) => {
  try {
    // Revenue by month
    const revenueByMonth = await db.execute(sql`
      SELECT 
        DATE_TRUNC('month', created_at) as month,
        SUM(amount) as revenue,
        COUNT(*) as order_count
      FROM marketplace_orders 
      WHERE created_at >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY month DESC
    `);

    // Service type performance
    const servicePerformance = await db.execute(sql`
      SELECT 
        service_type,
        COUNT(*) as order_count,
        SUM(amount) as total_revenue,
        AVG(amount) as avg_revenue
      FROM marketplace_orders 
      GROUP BY service_type
      ORDER BY total_revenue DESC
    `);

    res.json({
      success: true,
      analytics: {
        revenueByMonth: revenueByMonth.rows,
        servicePerformance: servicePerformance.rows
      }
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch analytics' 
    });
  }
});

export default router;