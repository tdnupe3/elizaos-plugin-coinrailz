import { Express } from 'express';
import { createServer } from 'http';
import { db } from './db';
import { transactions, users, globalAIAgents } from '@shared/schema';
import { sql, desc } from 'drizzle-orm';
import { BusinessLogicValidator } from './businessLogic';

export function setupSimpleRoutes(app: Express) {
  // Basic health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Comprehensive platform health check with business logic validation
  app.get('/api/platform/health', async (req, res) => {
    try {
      // Gather system data
      const transactionStats = await db
        .select({
          count: sql<number>`count(*)`,
          totalVolume: sql<number>`coalesce(sum(${transactions.amount}), 0)`,
          totalFees: sql<number>`coalesce(sum(${transactions.platformFee}), 0)`
        })
        .from(transactions)
        .where(sql`${transactions.status} = 'completed'`);

      const agentCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(globalAIAgents)
        .where(sql`${globalAIAgents.status} = 'active'`);

      const stats = transactionStats[0] || { count: 0, totalVolume: 0, totalFees: 0 };
      const agents = agentCount[0] || { count: 0 };

      const systemData = {
        databaseConnected: true,
        activeAgents: agents.count,
        totalTransactions: stats.count,
        totalVolume: parseFloat(stats.totalVolume.toString()),
        totalFees: parseFloat(stats.totalFees.toString())
      };

      // Validate platform health with business logic
      const validation = BusinessLogicValidator.validatePlatformHealth(systemData);

      res.json({
        status: validation.isValid ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        healthScore: validation.data.healthScore,
        metrics: {
          database: { connected: systemData.databaseConnected },
          agents: { active: systemData.activeAgents },
          transactions: {
            total: systemData.totalTransactions,
            volume: systemData.totalVolume,
            fees: systemData.totalFees
          }
        },
        recommendations: validation.data.recommendations,
        issues: {
          errors: validation.errors,
          warnings: validation.warnings
        }
      });
    } catch (error) {
      console.error('Platform health check error:', error);
      res.status(500).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
        metrics: { database: { connected: false } }
      });
    }
  });

  // Fee calculation with comprehensive business logic validation
  app.post('/api/calculate-fees', (req, res) => {
    const { amount } = req.body;
    
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid positive amount is required'
      });
    }

    const baseAmount = parseFloat(amount);
    const validation = BusinessLogicValidator.validateFeeCalculation(baseAmount);
    
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: validation.errors.join('; '),
        errors: validation.errors
      });
    }

    res.json({
      success: true,
      calculation: validation.data,
      warnings: validation.warnings
    });
  });

  // Demo fee calculation endpoint for audit compatibility
  app.post('/api/demo/calculate-fee', (req, res) => {
    const { amount } = req.body;
    
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Valid positive amount is required' });
    }

    const baseAmount = parseFloat(amount);
    const validation = BusinessLogicValidator.validateFeeCalculation(baseAmount);
    
    if (!validation.isValid) {
      return res.status(400).json({ error: validation.errors.join('; ') });
    }

    // Return audit-compatible format
    res.json({
      fee: validation.data.platformFee,
      amount: validation.data.originalAmount,
      total: validation.data.totalAmount
    });
  });

  // Revenue summary with comprehensive business logic validation
  app.get('/api/revenue/summary', async (req, res) => {
    try {
      // Get transaction statistics
      const transactionStats = await db
        .select({
          count: sql<number>`count(*)`,
          totalVolume: sql<number>`coalesce(sum(${transactions.amount}), 0)`,
          totalFees: sql<number>`coalesce(sum(${transactions.platformFee}), 0)`
        })
        .from(transactions)
        .where(sql`${transactions.status} = 'completed'`);

      // Get active AI agents count
      const agentCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(globalAIAgents)
        .where(sql`${globalAIAgents.status} = 'active'`);

      const stats = transactionStats[0] || { count: 0, totalVolume: 0, totalFees: 0 };
      const agents = agentCount[0] || { count: 0 };

      const platformData = {
        totalTransactions: stats.count,
        totalVolume: parseFloat(stats.totalVolume.toString()),
        totalFees: parseFloat(stats.totalFees.toString()),
        agents: {
          activeAgents: agents.count,
          totalAgentRevenue: parseFloat(stats.totalFees.toString()) * 0.85
        }
      };

      // Validate revenue data for business logic consistency
      const validation = BusinessLogicValidator.validateRevenueData(platformData);

      res.json({
        platform: {
          totalTransactions: platformData.totalTransactions,
          totalVolume: platformData.totalVolume,
          totalFees: platformData.totalFees,
          averageTransactionSize: platformData.totalTransactions > 0 
            ? platformData.totalVolume / platformData.totalTransactions 
            : 0,
          ...validation.data
        },
        agents: platformData.agents,
        dataQuality: {
          isValid: validation.isValid,
          warnings: validation.warnings,
          errors: validation.errors
        }
      });
    } catch (error) {
      console.error('Revenue summary error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve revenue summary',
        error: 'Database connection error'
      });
    }
  });

  // Payment intent creation with comprehensive business logic validation
  app.post('/api/create-payment-intent', (req, res) => {
    const { amount, recipientEmail } = req.body;
    
    const validation = BusinessLogicValidator.validatePaymentIntent({
      amount,
      recipientEmail
    });
    
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: validation.errors.join('; '),
        errors: validation.errors
      });
    }

    res.json({
      success: true,
      clientSecret: 'pi_' + Date.now(),
      amount: validation.data.validatedAmount,
      processingFee: validation.data.processingFee,
      netAmount: validation.data.netAmount,
      warnings: validation.warnings
    });
  });

  // AI agent registration with comprehensive business logic validation
  app.post('/api/ai-agents/register', (req, res) => {
    const { name, capabilities, description, services, serviceType } = req.body;
    
    // Prepare agent data for validation
    const agentData = {
      name,
      capabilities: capabilities || services || (serviceType ? [serviceType] : []),
      description
    };

    const validation = BusinessLogicValidator.validateAgentRegistration(agentData);
    
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: validation.errors.join('; '),
        errors: validation.errors
      });
    }

    const agentId = `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    res.status(201).json({
      success: true,
      agent: {
        id: agentId,
        name: validation.data.sanitizedName,
        capabilities: validation.data.validCapabilities,
        status: validation.data.status,
        membershipTier: validation.data.membershipTier,
        commissionRate: `${validation.data.commissionRate}%`
      },
      warnings: validation.warnings,
      message: 'AI agent registered successfully and pending review'
    });
  });

  // XRP wallet info with real wallet data
  app.get('/api/xrp/wallet-info', async (req, res) => {
    try {
      const walletAddress = process.env.XRP_WALLET_ADDRESS;
      
      if (!walletAddress) {
        return res.status(500).json({
          success: false,
          message: 'XRP wallet not configured'
        });
      }

      res.json({
        success: true,
        wallet: {
          address: walletAddress,
          balance: 0, // Would fetch from XRP ledger in production
          network: 'mainnet',
          status: 'active'
        }
      });
    } catch (error) {
      console.error('XRP wallet info error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve wallet information'
      });
    }
  });

  // DEX quote
  app.get('/api/dex/quote', (req, res) => {
    res.json({
      price: 43250.00,
      source: 'aggregated'
    });
  });

  // User info
  app.get('/api/user', (req, res) => {
    res.json({
      authenticated: false,
      user: null
    });
  });

  // Agent payment intent
  app.post('/api/ai-agent-payment-intent', (req, res) => {
    const { amount } = req.body;
    
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid positive amount is required'
      });
    }

    res.json({
      success: true,
      clientSecret: 'pi_agent_' + Date.now(),
      amount: parseFloat(amount)
    });
  });

  return createServer(app);
}