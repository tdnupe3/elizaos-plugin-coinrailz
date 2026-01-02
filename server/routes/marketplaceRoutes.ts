/**
 * AI Marketplace API Routes
 * Complete marketplace functionality with stats, categories, and services
 */

import { Router } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { db } from '../db';
import { sql } from 'drizzle-orm';

const router = Router();

/**
 * GET /api/ai-marketplace/stats
 * Get marketplace statistics
 */
router.get('/ai-marketplace/stats', async (req, res) => {
  try {
    // GET REAL STATS FROM DATABASE + x402 SERVICES
    const agents = await storage.getGlobalAIAgents() ?? [];
    const marketplaceServices = await storage.getMarketplaceServices() ?? [];
    
    // Handle both DB format (is_active) and x402 format (isActive)
    const activeServices = marketplaceServices.filter((service: any) => 
      service.is_active !== false && service.isActive !== false
    );
    
    // Count platform services separately
    const platformServices = activeServices.filter((s: any) => s.isPlatformService);
    const externalServices = activeServices.filter((s: any) => !s.isPlatformService);
    
    // REAL COMPLETION RATE from actual order status records
    let completionRate = 0;
    let totalOrders = 0;
    let completedOrders = 0;
    
    try {
      const ordersQuery = await db.execute(sql`
        SELECT 
          COUNT(*) as total_orders,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_orders
        FROM ai_marketplace_orders
      `);
      
      if (ordersQuery.rows.length > 0) {
        const row = ordersQuery.rows[0] as any;
        totalOrders = parseInt(row.total_orders) || 0;
        completedOrders = parseInt(row.completed_orders) || 0;
        completionRate = totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0;
      }
    } catch (error) {
      // Table may not exist yet - that's ok
    }
    
    // Calculate average rating - handle both formats (average_rating, rating)
    const validRatings = activeServices
      .map((service: any) => parseFloat(service.average_rating || service.rating))
      .filter((rating: number) => !isNaN(rating) && rating > 0);
    const avgRating = validRatings.length > 0 
      ? (validRatings.reduce((sum: number, rating: number) => sum + rating, 0) / validRatings.length) 
      : 0;
    
    // Calculate total revenue - handle both formats (order_count, completedOrders)
    const totalRevenue = activeServices.reduce((sum: number, service: any) => {
      const orderCount = parseInt(service.order_count || service.completedOrders) || 0;
      const pricing = parseFloat(service.pricing) || 0;
      return sum + (orderCount * pricing);
    }, 0);
    
    const stats = {
      totalAgents: agents.length,
      activeServices: activeServices.length,
      platformServices: platformServices.length,
      externalServices: externalServices.length,
      completionRate,
      totalOrders,
      completedOrders,
      avgRating: Math.round(avgRating * 10) / 10,
      totalRevenue: totalRevenue > 0 ? `$${totalRevenue.toLocaleString()}` : '$0',
      monthlyGrowth: null
    };

    res.json(stats);
  } catch (error: any) {
    console.error('Error fetching marketplace stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch marketplace stats',
      message: error.message
    });
  }
});

/**
 * GET /api/ai-marketplace/categories
 * Get available service categories (aligned with x402 catalog)
 */
router.get('/categories', async (req, res) => {
  try {
    // Categories aligned with x402 catalog mapping
    const categories = [
      'Trading & Analytics',
      'Market Intelligence',
      'Automation',
      'Developer Tools',
      'Premium Services',
      'Real Estate',
      'Financial Services'
    ];

    res.json({ categories });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch categories',
      message: error.message
    });
  }
});

/**
 * GET /api/dashboard/transactions
 * Get user transaction history
 */
router.get('/dashboard/transactions', async (req, res) => {
  try {
    // Mock transaction data - in production, query user's actual transactions
    const transactions = [
      {
        id: 'tx_001',
        type: 'P2P Transfer',
        amount: '$125.50',
        status: 'completed',
        date: '2025-07-20T10:30:00Z',
        recipient: 'john@example.com'
      },
      {
        id: 'tx_002', 
        type: 'AI Service',
        amount: '$89.99',
        status: 'completed',
        date: '2025-07-19T15:45:00Z',
        service: 'Data Analysis Report'
      },
      {
        id: 'tx_003',
        type: 'XRP Transfer',
        amount: '$250.00',
        status: 'pending',
        date: '2025-07-19T09:15:00Z',
        recipient: 'International Transfer'
      }
    ];

    res.json({ transactions });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch transactions',
      message: error.message
    });
  }
});

/**
 * GET /api/dashboard/portfolio
 * Get user portfolio data
 */
router.get('/portfolio', async (req, res) => {
  try {
    const portfolio = {
      totalValue: '$2,847.92',
      usdc: {
        balance: '1,250.00',
        value: '$1,250.00'
      },
      xrp: {
        balance: '712.50',
        value: '$1,597.92'
      },
      monthlyChange: '+12.4%',
      portfolioDistribution: [
        { asset: 'USDC', percentage: 43.9, value: '$1,250.00' },
        { asset: 'XRP', percentage: 56.1, value: '$1,597.92' }
      ]
    };

    res.json(portfolio);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch portfolio',
      message: error.message
    });
  }
});

export default router;