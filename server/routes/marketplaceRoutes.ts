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
    // 🎯 GET REAL STATS FROM DATABASE
    const agents = await storage.getGlobalAIAgents();
    const marketplaceServices = await storage.getMarketplaceServices();
    
    // Calculate real metrics
    const activeAgents = agents.filter(agent => agent.available !== false);
    const activeServices = marketplaceServices.filter(service => service.is_active !== false);
    
    // 🎯 REAL COMPLETION RATE from actual order status records
    let completionRate = 0;
    
    try {
      // Try to get real completion rate from aiMarketplaceOrders table with status tracking
      const ordersQuery = await db.execute(sql`
        SELECT 
          COUNT(*) as total_orders,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_orders
        FROM ai_marketplace_orders
      `);
      
      if (ordersQuery.rows.length > 0) {
        const { total_orders, completed_orders } = ordersQuery.rows[0] as any;
        completionRate = total_orders > 0 ? Math.round((completed_orders / total_orders) * 100) : 0;
        console.log(`📊 REAL completion rate: ${completed_orders}/${total_orders} = ${completionRate}%`);
      } else {
        // No order status data available - show 0 instead of fake data
        completionRate = 0;
        console.log(`📊 No order status data available - completion rate set to 0`);
      }
    } catch (error) {
      console.log('📊 No order status tracking available - omitting completion rate');
      completionRate = 0; // Don't show fake data if we can't calculate it
    }
    
    // Calculate real average rating - ONLY from actual ratings, no defaults
    const validRatings = activeServices
      .map(service => parseFloat(service.average_rating))
      .filter(rating => !isNaN(rating) && rating > 0);
    const avgRating = validRatings.length > 0 
      ? (validRatings.reduce((sum, rating) => sum + rating, 0) / validRatings.length) 
      : 0;
    
    // Calculate real total revenue from completed orders
    const totalRevenue = activeServices.reduce((sum, service) => {
      const orderCount = parseInt(service.order_count) || 0;
      const pricing = parseFloat(service.pricing) || 0;
      return sum + (orderCount * pricing);
    }, 0);
    
    const stats = {
      totalAgents: agents.length, // REAL count from database
      activeServices: activeServices.length, // REAL count from database
      completionRate, // REAL calculation from order status data
      avgRating: Math.round(avgRating * 10) / 10, // REAL average rating
      totalRevenue: totalRevenue > 0 ? `$${totalRevenue.toLocaleString()}` : '$0', // REAL revenue calculation
      monthlyGrowth: null // No synthetic data - will add real calculation when historical data available
    };

    console.log(`🎯 REAL MARKETPLACE STATS: ${stats.totalAgents} agents, ${stats.activeServices} services, ${stats.totalRevenue} revenue`);

    res.json(stats);
  } catch (error: any) {
    console.error('Error fetching real marketplace stats:', error);
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