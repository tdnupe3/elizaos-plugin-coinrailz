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

  // XRP Ecosystem Hub route - must be registered early to intercept before Vite
  app.get('/xrp-ecosystem', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>XRP Ecosystem Dashboard - Coin Railz</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: linear-gradient(135deg, #f0f8ff 0%, #e6f3ff 100%); min-height: 100vh; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 40px; }
        .header h1 { color: #1e40af; font-size: 2.5rem; margin-bottom: 16px; font-weight: 700; }
        .header p { color: #6b7280; font-size: 1.25rem; margin-bottom: 16px; line-height: 1.6; }
        .status { color: #059669; font-weight: 600; font-size: 1rem; }
        .services { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 24px; margin-top: 40px; }
        .service { background: white; border-radius: 12px; padding: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); transition: all 0.3s ease; border: 1px solid #e5e7eb; }
        .service:hover { transform: translateY(-4px); box-shadow: 0 8px 24px rgba(0,0,0,0.15); }
        .service h3 { color: #1e40af; margin-bottom: 12px; font-size: 1.25rem; font-weight: 600; }
        .service p { color: #6b7280; margin-bottom: 20px; line-height: 1.5; }
        .btn { background: #3b82f6; color: white; padding: 12px 24px; border: none; border-radius: 8px; text-decoration: none; display: inline-block; font-weight: 600; transition: background 0.2s; }
        .btn:hover { background: #2563eb; }
        .btn-secondary { background: #6b7280; }
        .btn-secondary:hover { background: #4b5563; }
        .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>XRP Ecosystem Dashboard</h1>
            <p>Revolutionary financial services powered by XRP Ledger technology.<br>Experience ultra-fast settlements, minimal fees, and enterprise-grade security.</p>
            <div class="status">Live XRP Rate: $0.5000 USD | Platform Status: Operational</div>
        </div>
        
        <div class="services">
            <div class="service">
                <h3>Cross-Border Payments</h3>
                <p>Send money globally in 3-5 seconds with ultra-low fees (~$0.0002). Perfect for international business and remittances.</p>
                <a href="/xrp-cross-border-payments" class="btn">Access Service</a>
            </div>
            
            <div class="service">
                <h3>Liquidity Provision</h3>
                <p>Provide liquidity and earn competitive rewards on XRP transactions. Automated market making with low impermanent loss.</p>
                <a href="/xrp-liquidity-provision" class="btn">Access Service</a>
            </div>
            
            <div class="service">
                <h3>Wallet Management</h3>
                <p>Enterprise-grade XRP wallet management with multi-signature security and hardware wallet integration.</p>
                <a href="/xrp-wallet-management" class="btn">Access Service</a>
            </div>
            
            <div class="service">
                <h3>Compliance Tools</h3>
                <p>AML monitoring and regulatory compliance for XRP transactions. Real-time risk analysis and reporting.</p>
                <a href="/xrp-compliance-tools" class="btn">Access Service</a>
            </div>
            
            <div class="service">
                <h3>Instant Settlements</h3>
                <p>Real-time payment processing with immediate finality. No chargebacks, immediate liquidity access.</p>
                <a href="/xrp-instant-settlements" class="btn">Access Service</a>
            </div>
            
            <div class="service">
                <h3>Escrow Services</h3>
                <p>Secure transactions with automated escrow and dispute resolution. Smart contract security with built-in conditions.</p>
                <a href="/xrp-escrow-services" class="btn">Access Service</a>
            </div>
        </div>
        
        <div class="footer">
            <a href="/main-menu" class="btn btn-secondary">Back to Main Menu</a>
        </div>
    </div>
</body>
</html>
    `);
  });

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
  app.post('/api/create-payment-intent', requireAuth, validateSchema(paymentSchema), async (req: any, res) => {
    try {
      const { amount, recipientEmail } = req.body;
      
      // Use circuit breaker for payment processing
      const result = await paymentCircuitBreaker.execute(async () => {
        // Resolve best payment gateway for this transaction
        const gateway = await paymentResolver.resolveOptimalGateway(amount, 'USD');
        
        // Execute atomic transaction
        return await connectionManager.executeTransaction([
          {
            query: 'INSERT INTO payment_intents (amount, recipient_email, gateway, status) VALUES ($1, $2, $3, $4) RETURNING id',
            params: [amount, recipientEmail, gateway.name, 'pending']
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

      const baseAmount = parseFloat(amount);
      const fee = baseAmount * 0.08; // 8% fee
      const totalAmount = baseAmount + fee;

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
  app.post('/api/ai-agents/register', async (req, res) => {
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