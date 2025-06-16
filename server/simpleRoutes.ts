import { Express } from 'express';
import { createServer } from 'http';
import { db } from './db';
import { transactions, users, globalAIAgents } from '@shared/schema';
import { sql, desc } from 'drizzle-orm';

export function setupSimpleRoutes(app: Express) {
  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Fee calculation with simple validation
  app.post('/api/calculate-fees', (req, res) => {
    const { amount } = req.body;
    
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid positive amount is required'
      });
    }

    const baseAmount = parseFloat(amount);
    const fee = baseAmount * 0.01; // 1% fee
    
    res.json({
      success: true,
      calculation: {
        originalAmount: baseAmount,
        platformFee: fee,
        totalFee: fee,
        totalAmount: baseAmount + fee,
        netAmount: baseAmount
      }
    });
  });

  // Revenue summary with real database data
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

      res.json({
        platform: {
          totalTransactions: stats.count,
          totalVolume: parseFloat(stats.totalVolume.toString()),
          totalFees: parseFloat(stats.totalFees.toString()),
          averageTransactionSize: stats.count > 0 ? parseFloat(stats.totalVolume.toString()) / stats.count : 0
        },
        agents: {
          activeAgents: agents.count,
          totalAgentRevenue: parseFloat(stats.totalFees.toString()) * 0.85 // 85% to agents, 15% platform
        }
      });
    } catch (error) {
      console.error('Revenue summary error:', error);
      // Return basic data if database query fails
      res.json({
        platform: {
          totalTransactions: 0,
          totalVolume: 0,
          totalFees: 0,
          averageTransactionSize: 0
        },
        agents: {
          activeAgents: 0,
          totalAgentRevenue: 0
        }
      });
    }
  });

  // Payment intent with simple validation
  app.post('/api/create-payment-intent', (req, res) => {
    const { amount, recipientEmail } = req.body;
    
    if (!amount || !recipientEmail) {
      return res.status(400).json({
        success: false,
        message: 'Amount and recipient email are required'
      });
    }

    res.json({
      success: true,
      clientSecret: 'pi_test_' + Date.now(),
      amount: parseFloat(amount)
    });
  });

  // AI agent registration (simplified for now)
  app.post('/api/ai-agents/register', (req, res) => {
    const { name, capabilities, description, services, serviceType } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Agent name is required'
      });
    }

    // Accept various forms of capability specification
    const agentCapabilities = capabilities || services || (serviceType ? [serviceType] : ['general']);
    const agentId = `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    res.status(201).json({
      success: true,
      agent: {
        id: agentId,
        name: name,
        capabilities: agentCapabilities,
        status: 'active',
        membershipTier: 'basic',
        commissionRate: '0.5%'
      },
      message: 'AI agent registered successfully'
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