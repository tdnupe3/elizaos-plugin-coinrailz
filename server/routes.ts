import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { globalAgentNetwork } from "./services/globalAgentNetworkService";
import { FeeCalculator } from "./services/feeCalculator";
import { setupProductionAuth, requireAuth } from "./productionAuth";
import { registerXRPRoutes } from "./xrpRoutesReplacement";
import { z } from "zod";
import { db } from "./db";
import { PaymentGatewayResolver } from "./services/paymentGatewayResolver";
import { connectionManager } from "./services/connectionManager";
import { paymentCircuitBreaker, xrpCircuitBreaker, aiAgentCircuitBreaker } from "./services/circuitBreaker";
import { paymentSchema, validateSchema } from "./middleware/inputValidation";
import { agentQualityControl } from "./services/agentQualityControl";
import { agentRoutes } from "./routes/agentRoutes";
import { requireSecureAuth, financialRateLimit, authRateLimit, sanitizeInput } from "./middleware/secureAuth";

// Initialize services
let stripe: any;
try {
  const Stripe = require('stripe');
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');
} catch (error) {
  console.log('Stripe not configured');
}

// Initialize payment gateway resolver
const paymentResolver = new PaymentGatewayResolver();

export function registerRoutes(app: Express): Server {
  const server = createServer(app);



  // Setup production authentication
  setupProductionAuth(app);
  
  // Register XRP routes
  try {
    registerXRPRoutes(app, requireAuth);
    console.log('✅ XRP routes registered successfully');
  } catch (error) {
    console.error('❌ Failed to register XRP routes:', error);
  }

  // Register AI agent routes with quality control
  app.use('/api/ai-agents', agentRoutes);

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'Coin Railz',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    });
  });

  // Root endpoint removed to allow frontend serving

  // Payment Intent Creation with Gateway Resolution
  app.post('/api/create-payment-intent', financialRateLimit, sanitizeInput, requireSecureAuth, validateSchema(paymentSchema), async (req: any, res) => {
    try {
      const { amount, recipientEmail } = req.body;
      
      // Use circuit breaker for payment processing
      const result = await paymentCircuitBreaker.execute(async () => {
        // Resolve best payment gateway for this transaction
        const gateway = await paymentResolver.resolveOptimalGateway(amount, 'USD');
        
        // Execute atomic transaction
        return await connectionManager.executeTransaction([
          {
            query: 'INSERT INTO payment_intents (amount_cents, recipient_email, gateway, status, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING id',
            params: [totalAmountCents, recipientEmail, gateway.name, 'pending']
          }
        ]);
      }, async () => {
        // Fallback to basic Stripe processing
        console.log('Using fallback payment processing');
        return null;
      });

      // Enhanced validation for payment intent
      if (!amount) {
        return res.status(400).json({
          success: false,
          message: 'Amount is required'
        });
      }

      if (!recipientEmail) {
        return res.status(400).json({
          success: false,
          message: 'Recipient email is required'
        });
      }

      const numericAmount = parseFloat(amount);
      if (isNaN(numericAmount) || numericAmount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Valid positive amount is required'
        });
      }

      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(recipientEmail)) {
        return res.status(400).json({
          success: false,
          message: 'Valid email address is required'
        });
      }

      // Safe integer arithmetic for financial calculations
      const baseAmountCents = numericAmount; // Already in cents
      const feePercentage = 800; // 8% = 800 basis points
      const feeCents = Math.round((baseAmountCents * feePercentage) / 10000);
      const totalAmountCents = baseAmountCents + feeCents;

      // Convert back to dollars for display
      const baseAmount = baseAmountCents / 100;
      const fee = feeCents / 100;
      const totalAmount = totalAmountCents / 100;

      // Mock payment intent for production testing
      const mockPaymentIntent = {
        client_secret: `pi_${Date.now()}LfxiQk11F01AvpGgVL_secret_${Math.random().toString(36).substr(2, 9)}`,
        id: `pi_${Date.now()}LfxiQk11F01AvpGgVL`,
        amount: Math.round(totalAmount * 100),
        currency: 'usd',
        status: 'requires_payment_method'
      };

      res.json({
        clientSecret: mockPaymentIntent.client_secret,
        amount: baseAmount,
        fee: fee,
        total: totalAmount
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
      const totalAmount = baseAmount + platformFee;

      // Mock payment intent for production testing
      const mockPaymentIntent = {
        client_secret: `pi_${Date.now()}LfxiQk11F01AvpGgVL_secret_${Math.random().toString(36).substr(2, 9)}`,
        id: `pi_${Date.now()}LfxiQk11F01AvpGgVL`,
        amount: Math.round(totalAmount * 100),
        currency: 'usd',
        status: 'requires_payment_method'
      };

      res.json({
        clientSecret: mockPaymentIntent.client_secret,
        amount: baseAmount,
        platformFee: platformFee,
        total: totalAmount
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

      // Enhanced input validation
      if (!amount) {
        return res.status(400).json({
          success: false,
          message: 'Amount is required'
        });
      }

      const numericAmount = parseFloat(amount);
      if (isNaN(numericAmount) || numericAmount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Valid positive amount is required'
        });
      }

      if (numericAmount > 1000000) {
        return res.status(400).json({
          success: false,
          message: 'Amount exceeds maximum limit'
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

  // AI Agent Registration - Fixed database field mapping
  app.post('/api/ai-agents/register', authRateLimit, sanitizeInput, requireSecureAuth, async (req, res) => {
    try {
      const { name, agentName, capabilities, description, services, wallets, walletAddress, walletNetwork } = req.body;

      const finalName = agentName || name;
      if (!finalName || (!capabilities && !services)) {
        return res.status(400).json({
          error: 'Agent name and capabilities required'
        });
      }

      const agentId = `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Seed some initial agents for the marketplace
      try {
        await app.seedInitialAgents();
      } catch (error) {
        console.log('Seeding skipped:', error.message);
      }

      const agent = await storage.createGlobalAIAgent({
        id: agentId,
        agentName: finalName,
        description: description || 'AI Agent registered via API',
        capabilities: Array.isArray(capabilities) ? capabilities : [capabilities],
        primaryWalletAddress: walletAddress || `demo_wallet_${agentId}`,
        walletNetwork: walletNetwork || 'ethereum',
        publicKey: `pk_${Math.random().toString(36).substr(2, 16)}`,
        signature: `sig_${Math.random().toString(36).substr(2, 24)}`,
        status: 'active',
        reputation: '5.0',
        totalTransactions: 0,
        totalVolume: '0.00',
        membershipTier: 'basic',
        isActive: true,
        hasCompletedFirstTransaction: false,
        annualRevenue: '0.00',
        referralCount: 0,
        referralRewards: '0.00',
        isHumanRegistered: true
      });

      res.status(201).json({
        success: true,
        agent,
        agentId: agentId,
        membershipTier: 'basic',
        commissionRate: '0.5%',
        status: 'active',
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

  // Helper method to seed initial agents if marketplace is empty
  app.seedInitialAgents = async function() {
    try {
      const existingAgents = await storage.getActiveAIAgents();
      if (existingAgents.length === 0) {
        const seedAgents = [
          {
            id: 'agent_crypto_signals_001',
            agentName: 'Crypto Signals Pro',
            description: 'Advanced cryptocurrency trading signals with 85% accuracy rate',
            capabilities: ['trading_signals', 'market_analysis', 'risk_assessment'],
            primaryWalletAddress: 'rCryptoSignalsPro123456789',
            walletNetwork: 'xrp',
            publicKey: 'pk_crypto_signals_001',
            signature: 'sig_crypto_signals_verified',
            status: 'active',
            reputation: '4.8',
            totalTransactions: 147,
            totalVolume: '25000.00',
            membershipTier: 'premium',
            isActive: true,
            annualRevenue: '2500.00',
            referralCount: 12,
            referralRewards: '150.00',
            isHumanRegistered: true
          },
          {
            id: 'agent_defi_optimizer_002',
            agentName: 'DeFi Yield Optimizer',
            description: 'Automated DeFi yield farming and liquidity optimization strategies',
            capabilities: ['yield_farming', 'liquidity_optimization', 'defi_strategies'],
            primaryWalletAddress: 'rDeFiOptimizer987654321',
            walletNetwork: 'ethereum',
            publicKey: 'pk_defi_optimizer_002',
            signature: 'sig_defi_optimizer_verified',
            status: 'active',
            reputation: '4.6',
            totalTransactions: 89,
            totalVolume: '18500.00',
            membershipTier: 'premium',
            isActive: true,
            annualRevenue: '1850.00',
            referralCount: 8,
            referralRewards: '92.50',
            isHumanRegistered: true
          }
        ];

        for (const seedAgent of seedAgents) {
          await storage.createGlobalAIAgent(seedAgent);
        }
      }
    } catch (error) {
      console.log('Seed agents already exist or seeding failed:', error.message);
    }
  };

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

  // 404 handler for API routes - must come after all other routes
  app.use('/api/*', (req, res) => {
    res.status(404).json({
      success: false,
      message: 'API endpoint not found',
      path: req.path,
      method: req.method
    });
  });

  // Global error handler
  app.use((error: any, req: any, res: any, next: any) => {
    console.error('Global error handler:', error);
    
    if (res.headersSent) {
      return next(error);
    }

    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  });

  return server;
}