import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { globalAgentNetwork } from "./services/globalAgentNetworkService";
import { FeeCalculator } from "./services/feeCalculator";
import { setupProductionAuth, requireAuth } from "./productionAuth";
import { z } from "zod";
import { db } from "./db";

// Initialize services
let stripe: any;
try {
  const stripeModule = await import('stripe');
  stripe = new stripeModule.default(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
    apiVersion: '2023-10-16'
  });
} catch (error) {
  console.log('Stripe not configured');
}

export function registerRoutes(app: Express): Server {
  const server = createServer(app);

  // Setup production authentication
  setupProductionAuth(app);

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'Coin Railz',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    });
  });

  // Root endpoint
  app.get('/', (req, res) => {
    res.json({
      message: 'Coin Railz API',
      status: 'operational',
      version: '1.0.0'
    });
  });

  // Payment Intent Creation
  app.post('/api/create-payment-intent', requireAuth, async (req: any, res) => {
    try {
      const { amount, recipientEmail } = req.body;

      if (!amount || !recipientEmail) {
        return res.status(400).json({
          success: false,
          message: 'Amount and recipient email are required'
        });
      }

      const baseAmount = parseFloat(amount);
      const fee = baseAmount * 0.08; // 8% fee
      const totalAmount = Math.round((baseAmount + fee) * 100); // Convert to cents

      const paymentIntent = await stripe.paymentIntents.create({
        amount: totalAmount,
        currency: 'usd',
        metadata: {
          recipientEmail,
          originalAmount: baseAmount.toString(),
          fee: fee.toString()
        }
      });

      res.json({
        clientSecret: paymentIntent.client_secret,
        amount: baseAmount,
        fee: fee,
        total: baseAmount + fee
      });
    } catch (error: any) {
      console.error('Payment intent creation error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create payment intent'
      });
    }
  });

  // AI Agent Payment Intent
  app.post('/api/agents/create-payment-intent', requireAuth, async (req: any, res) => {
    try {
      const { amount, agentId, serviceType } = req.body;

      if (!amount || !agentId) {
        return res.status(400).json({
          success: false,
          message: 'Amount and agent ID are required'
        });
      }

      const baseAmount = parseFloat(amount);
      const platformFee = baseAmount * 0.15; // 15% platform fee
      const totalAmount = Math.round((baseAmount + platformFee) * 100);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: totalAmount,
        currency: 'usd',
        metadata: {
          agentId,
          serviceType: serviceType || 'ai_service',
          originalAmount: baseAmount.toString(),
          platformFee: platformFee.toString()
        }
      });

      res.json({
        clientSecret: paymentIntent.client_secret,
        amount: baseAmount,
        platformFee: platformFee,
        total: baseAmount + platformFee
      });
    } catch (error: any) {
      console.error('AI agent payment intent error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create AI agent payment intent'
      });
    }
  });

  // Fee calculation endpoint
  app.post('/api/calculate-fees', async (req, res) => {
    try {
      const { amount, type = 'send_money', currency = 'USD' } = req.body;

      if (!amount || isNaN(parseFloat(amount))) {
        return res.status(400).json({
          success: false,
          message: 'Valid amount is required'
        });
      }

      const baseAmount = parseFloat(amount);
      let feeCalculation;

      switch (type) {
        case 'send_money':
          const fee = baseAmount * 0.01; // 1% fee
          feeCalculation = {
            originalAmount: baseAmount,
            platformFee: fee,
            totalFee: fee,
            totalAmount: baseAmount + fee,
            netAmount: baseAmount,
            feeBreakdown: {
              platformFee: fee,
              processingFee: 0,
              convenienceFee: 0
            }
          };
          break;
        default:
          const defaultFee = baseAmount * 0.01;
          feeCalculation = {
            originalAmount: baseAmount,
            platformFee: defaultFee,
            totalFee: defaultFee,
            totalAmount: baseAmount + defaultFee,
            netAmount: baseAmount,
            feeBreakdown: {
              platformFee: defaultFee,
              processingFee: 0,
              convenienceFee: 0
            }
          };
      }

      res.json({
        success: true,
        calculation: feeCalculation,
        type,
        currency,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('Fee calculation error:', error);
      res.status(500).json({
        success: false,
        message: 'Fee calculation failed: ' + error.message
      });
    }
  });

  // Revenue tracking endpoint
  app.get('/api/revenue/summary', async (req, res) => {
    try {
      // Mock revenue data for testing
      const summary = {
        platform: {
          totalTransactions: 342,
          totalVolume: 15842.50,
          totalFees: 1582.45,
          averageTransactionSize: 46.37
        },
        agents: {
          activeAgents: 4,
          totalAgentRevenue: 4250.00
        },
        calculated: {
          platformProfit: 1345.08, // 85% profit margin
          agentCommissions: 237.37, // 15% to agents
          profitMargin: '85%',
          revenueGrowth: '12.5% month-over-month'
        },
        timestamp: new Date().toISOString()
      };

      res.json({
        success: true,
        revenue: summary
      });
    } catch (error: any) {
      console.error('Revenue summary error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate revenue summary: ' + error.message
      });
    }
  });

  // AI Agent Registration
  app.post('/api/ai-agents/register', async (req, res) => {
    try {
      const { name, capabilities, walletAddress, walletNetwork } = req.body;

      if (!name || !capabilities) {
        return res.status(400).json({
          error: 'Name and capabilities required'
        });
      }

      const agent = await storage.createGlobalAIAgent({
        id: `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        agentName: name,
        capabilities: Array.isArray(capabilities) ? capabilities : [capabilities],
        primaryWalletAddress: walletAddress || 'demo_wallet',
        walletNetwork: walletNetwork || 'ethereum',
        membershipTier: 'basic',
        commissionRate: 0.5,
        isActive: true,
        lastActiveAt: new Date(),
        createdAt: new Date()
      });

      res.json({
        success: true,
        agent,
        membershipTier: 'basic',
        commissionRate: '0.5%',
        message: 'AI agent registered successfully'
      });
    } catch (error: any) {
      console.error('AI agent registration error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to register AI agent: ' + error.message
      });
    }
  });

  // XRP wallet info
  app.get('/api/xrp/wallet-info', (req, res) => {
    res.json({
      address: 'rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', // Masked for security
      balance: '15.98',
      currency: 'XRP',
      usdValue: '$34.20',
      status: 'active',
      network: 'mainnet'
    });
  });

  // DEX aggregator quote
  app.get('/api/dex/quote', (req, res) => {
    const { fromToken = 'USDC', toToken = 'ETH', amount = '1000' } = req.query;
    
    res.json({
      success: true,
      fromToken,
      toToken,
      fromAmount: amount,
      toAmount: '0.284',
      exchangeRate: '0.000284',
      sources: ['Uniswap V3', 'Curve Finance', '1inch'],
      estimatedGas: '0.0021 ETH',
      priceImpact: '0.12%',
      timestamp: new Date().toISOString()
    });
  });

  return server;
}