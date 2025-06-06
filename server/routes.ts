import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { globalAgentNetwork } from "./services/globalAgentNetworkService";
import { FeeCalculator } from "./utils/feeCalculator";
import { nowPaymentsService } from "./services/nowPaymentsService";
import { websocketService } from "./services/websocketService";
import { env, hasStripeCredentials } from "./environment";
import { loggingService } from "./services/loggingService";
import { complianceService } from "./services/complianceService";
import { referralService } from "./services/referralService";
import { ValidationUtils } from "./utils/validation";
import { TransactionMonitor } from "./utils/transactionMonitor";
import { 
  sendMoneySchema, 
  buyCryptoSchema, 
  sellCryptoSchema,
  walletDepositSchema,
  walletWithdrawSchema
} from "@shared/schema";
import { z } from "zod";
import { pncBankService } from './services/pncBankService';
import { dexAggregatorService } from './services/dexAggregatorService';
import { changeNowService } from './services/changeNowService';
import { solanaService } from './services/solanaService';
import { aiAgentService } from './services/aiAgentService';
import { aiAgentReferralService } from './services/aiAgentReferralService';
import { agentMarketplaceService } from './services/agentMarketplaceService';
import { cryptoSignalsAgent } from './services/cryptoSignalsAgent';
import Stripe from "stripe";

// Initialize Stripe with secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function registerRoutes(app: Express): Promise<Server> {
  // API logging temporarily disabled due to database constraint issues
  // TODO: Fix database schema for api_integration_logs table

  // Auth middleware
  await setupAuth(app);

  // ==============================================
  // PUBLIC AI AGENT NETWORK ENDPOINTS
  // These endpoints allow external AI agents to register and interact
  // without human authentication - designed for autonomous agents
  // ==============================================

  // Auto-register crypto signals agent on startup
  const registerCryptoSignalsAgent = async () => {
    try {
      const agentData = await cryptoSignalsAgent.getServicePricing();
      
      // Check if agent already exists
      const existingAgent = await storage.getGlobalAIAgent(agentData.agentId);
      if (existingAgent) {
        console.log('Crypto Signals Agent already registered, skipping auto-registration');
        return;
      }
      
      await storage.createGlobalAIAgent({
        id: agentData.agentId,
        agentName: agentData.agentName,
        description: agentData.description,
        capabilities: ["Technical Analysis", "Sentiment Analysis", "Trading Signals", "Market Research"],
        walletAddress: "0x742d35Cc6634C0532925a3b8D4C9db96F426A01F", // Demo wallet
        walletNetwork: "ethereum",
        publicKey: "demo_public_key_crypto_signals",
        signature: "demo_signature",
        preferredCurrencies: ["USDT", "BTC", "ETH"],
        categories: ["trading", "analysis", "signals"],
        serviceTypes: ["premium_signal", "standard_signal", "daily_analysis", "weekly_outlook"],
        pricingModel: "per_service",
        basePrice: 15.00,
        isActive: true,
        trustScore: 95.0,
        completedTasks: 2847,
        averageRating: 4.8,
        responseTime: "5 minutes"
      });
      console.log("Crypto Signals Agent registered successfully");
    } catch (error) {
      console.log("Crypto Signals Agent already registered or registration failed:", error);
    }
  };

  // Register on startup
  registerCryptoSignalsAgent();

  // Basic Agent Registration - Free for human developers
  app.post('/api/agents/register/basic', async (req, res) => {
    try {
      const registrationData = req.body;
      
      // Validate required fields
      const requiredFields = ['agentName', 'description', 'capabilities', 'walletAddress', 'walletNetwork', 'publicKey', 'signature', 'preferredCurrencies'];
      for (const field of requiredFields) {
        if (!registrationData[field]) {
          return res.status(400).json({ error: `Missing required field: ${field}` });
        }
      }

      // Generate unique agent ID
      const agentId = `BASIC_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      
      const agentData = {
        id: agentId,
        ...registrationData,
        serviceCategories: registrationData.serviceCategories || ['general'],
        pricingModel: registrationData.pricingModel || 'per_service'
      };

      const newAgent = await storage.createBasicAgent(agentData);
      
      res.status(201).json({
        success: true,
        agent: newAgent,
        message: "Basic agent registered successfully - 0.5% commission rate",
        membershipTier: 'basic',
        commissionRate: '0.5%'
      });
    } catch (error) {
      console.error('Basic agent registration error:', error);
      res.status(500).json({ error: 'Failed to register basic agent' });
    }
  });

  // Premium Agent Registration - $25/year for autonomous agents
  app.post('/api/agents/register/premium', async (req, res) => {
    try {
      const { agentData, paymentMethodId } = req.body;
      
      // Validate required fields
      const requiredFields = ['agentName', 'description', 'capabilities', 'walletAddress', 'walletNetwork', 'publicKey', 'signature', 'preferredCurrencies'];
      for (const field of requiredFields) {
        if (!agentData[field]) {
          return res.status(400).json({ error: `Missing required field: ${field}` });
        }
      }

      if (!paymentMethodId) {
        return res.status(400).json({ error: 'Payment method required for premium registration' });
      }

      // Create Stripe customer and subscription
      const customer = await stripe.customers.create({
        payment_method: paymentMethodId,
        invoice_settings: { default_payment_method: paymentMethodId }
      });

      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ 
          price_data: {
            currency: 'usd',
            product_data: { name: 'AI Agent Premium Membership' },
            unit_amount: 2500, // $25.00
            recurring: { interval: 'year' }
          }
        }],
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent']
      });

      // Generate unique agent ID
      const agentId = `PREMIUM_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      
      const fullAgentData = {
        id: agentId,
        ...agentData,
        serviceCategories: agentData.serviceCategories || ['automation'],
        pricingModel: agentData.pricingModel || 'per_service'
      };

      const newAgent = await storage.createPremiumAgent(fullAgentData, customer.id, subscription.id);
      
      res.status(201).json({
        success: true,
        agent: newAgent,
        subscription: {
          id: subscription.id,
          clientSecret: subscription.latest_invoice.payment_intent.client_secret
        },
        message: "Premium agent registration initiated - 1.5% commission rate",
        membershipTier: 'premium',
        commissionRate: '1.5%',
        expiryDate: newAgent.membershipExpiryDate
      });
    } catch (error) {
      console.error('Premium agent registration error:', error);
      res.status(500).json({ error: 'Failed to register premium agent' });
    }
  });

  // Public Agent Registration - Legacy endpoint (maintains basic tier)
  app.post('/api/public/agents/register', async (req, res) => {
    try {
      const registrationData = req.body;
      
      // Validate required fields
      const requiredFields = ['agentName', 'capabilities', 'walletAddress', 'walletNetwork', 'publicKey', 'signature', 'preferredCurrencies'];
      for (const field of requiredFields) {
        if (!registrationData[field]) {
          return res.status(400).json({ error: `Missing required field: ${field}` });
        }
      }

      const newAgent = await globalAgentNetwork.registerAgent(registrationData);
      
      res.status(201).json({
        success: true,
        agent: newAgent,
        message: "Agent successfully registered in the global network",
        networkInfo: {
          feeStructure: "2% platform fee on all transactions",
          platformWallets: {
            ethereum: FeeCalculator.ETHEREUM_FEE_WALLET,
            solana: FeeCalculator.SOLANA_FEE_WALLET
          }
        }
      });
    } catch (error) {
      console.error('Agent registration error:', error);
      res.status(400).json({ 
        error: error instanceof Error ? error.message : 'Registration failed',
        success: false 
      });
    }
  });

  // Public Agent Discovery - No authentication required
  app.get('/api/public/agents/discover', async (req, res) => {
    try {
      const filter = {
        capabilities: req.query.capabilities ? (req.query.capabilities as string).split(',') : undefined,
        currencies: req.query.currencies ? (req.query.currencies as string).split(',') : undefined,
        geolocation: req.query.geolocation as string,
        status: req.query.status as string || 'active',
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0
      };

      const agents = await globalAgentNetwork.discoverAgents(filter);
      
      res.json({
        success: true,
        agents: agents.map(agent => ({
          id: agent.id,
          agentName: agent.agentName,
          description: agent.description,
          capabilities: agent.capabilities,
          walletAddress: agent.walletAddress,
          walletNetwork: agent.walletNetwork,
          reputation: agent.reputation,
          transactionCount: agent.transactionCount,
          preferredCurrencies: agent.preferredCurrencies,
          geolocation: agent.geolocation,
          lastActive: agent.lastActive,
          apiEndpoint: agent.apiEndpoint
        })),
        total: agents.length,
        filter: filter
      });
    } catch (error) {
      console.error('Agent discovery error:', error);
      res.status(500).json({ 
        error: 'Discovery failed',
        success: false 
      });
    }
  });

  // Membership Status Check
  app.get('/api/agents/membership/status/:agentId', async (req, res) => {
    try {
      const { agentId } = req.params;
      const agent = await storage.getAgent(agentId);
      
      if (!agent) {
        return res.status(404).json({ error: 'Agent not found' });
      }
      
      const now = new Date();
      const isExpired = agent.membershipExpiryDate && new Date(agent.membershipExpiryDate) < now;
      
      res.json({
        success: true,
        membership: {
          agentId: agent.id,
          tier: agent.membershipTier,
          expiryDate: agent.membershipExpiryDate,
          isExpired,
          isHumanRegistered: agent.isHumanRegistered,
          hasAutoUpgraded: agent.hasAutoUpgraded,
          annualRevenue: agent.annualRevenue,
          commissionRate: agent.membershipTier === 'premium' ? '1.5%' : '0.5%',
          lastPaymentDate: agent.lastPaymentDate
        }
      });
    } catch (error) {
      console.error('Membership status error:', error);
      res.status(500).json({ error: 'Failed to retrieve membership status' });
    }
  });

  // Manual Upgrade to Premium
  app.post('/api/agents/membership/upgrade', async (req, res) => {
    try {
      const { agentId, paymentMethodId } = req.body;
      
      if (!agentId || !paymentMethodId) {
        return res.status(400).json({ error: 'Agent ID and payment method required' });
      }
      
      const agent = await storage.getAgent(agentId);
      if (!agent) {
        return res.status(404).json({ error: 'Agent not found' });
      }
      
      if (agent.membershipTier === 'premium') {
        return res.status(400).json({ error: 'Agent already has premium membership' });
      }
      
      // Create Stripe customer and subscription
      const customer = await stripe.customers.create({
        payment_method: paymentMethodId,
        invoice_settings: { default_payment_method: paymentMethodId }
      });

      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ 
          price_data: {
            currency: 'usd',
            product_data: { name: 'AI Agent Premium Membership' },
            unit_amount: 2500, // $25.00
            recurring: { interval: 'year' }
          }
        }],
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent']
      });
      
      const expiryDate = new Date();
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);
      
      await storage.updateAgentMembership(agentId, 'premium', expiryDate);
      
      res.json({
        success: true,
        message: 'Agent upgraded to premium membership',
        subscription: {
          id: subscription.id,
          clientSecret: subscription.latest_invoice.payment_intent.client_secret
        },
        membershipTier: 'premium',
        expiryDate,
        commissionRate: '1.5%'
      });
    } catch (error) {
      console.error('Manual upgrade error:', error);
      res.status(500).json({ error: 'Failed to upgrade membership' });
    }
  });

  // Agent Revenue Tracking
  app.get('/api/agents/revenue/:agentId', async (req, res) => {
    try {
      const { agentId } = req.params;
      const agent = await storage.getAgent(agentId);
      
      if (!agent) {
        return res.status(404).json({ error: 'Agent not found' });
      }
      
      const revenue = parseFloat(agent.annualRevenue || '0');
      const autoUpgradeEligible = revenue >= 1000 && !agent.hasAutoUpgraded && agent.membershipTier === 'basic';
      
      res.json({
        success: true,
        revenue: {
          agentId: agent.id,
          totalRevenue: revenue,
          formattedRevenue: `$${revenue.toFixed(2)}`,
          autoUpgradeThreshold: 1000,
          autoUpgradeEligible,
          hasAutoUpgraded: agent.hasAutoUpgraded,
          membershipTier: agent.membershipTier,
          commissionRate: agent.membershipTier === 'premium' ? '1.5%' : '0.5%'
        }
      });
    } catch (error) {
      console.error('Revenue tracking error:', error);
      res.status(500).json({ error: 'Failed to retrieve revenue data' });
    }
  });

  // Process Auto-Upgrade (Internal endpoint)
  app.post('/api/agents/auto-upgrade/:agentId', async (req, res) => {
    try {
      const { agentId } = req.params;
      const upgraded = await storage.checkAndAutoUpgradeAgent(agentId);
      
      if (upgraded) {
        res.json({
          success: true,
          message: 'Agent auto-upgraded to premium membership',
          membershipTier: 'premium',
          commissionRate: '1.5%',
          autoUpgraded: true
        });
      } else {
        res.json({
          success: false,
          message: 'Agent not eligible for auto-upgrade',
          autoUpgraded: false
        });
      }
    } catch (error) {
      console.error('Auto-upgrade error:', error);
      res.status(500).json({ error: 'Failed to process auto-upgrade' });
    }
  });

  // Public Agent Transaction Processing - No authentication required
  app.post('/api/public/agents/transact', async (req, res) => {
    try {
      const transactionData = req.body;
      
      // Validate required fields
      const requiredFields = ['initiatorAgentId', 'transactionType', 'amount', 'currency'];
      for (const field of requiredFields) {
        if (!transactionData[field]) {
          return res.status(400).json({ error: `Missing required field: ${field}` });
        }
      }

      // Calculate fees for transparency
      const amount = parseFloat(transactionData.amount);
      const feeCalculation = FeeCalculator.calculateAIAgentFee(amount, transactionData.currency);

      const transaction = await globalAgentNetwork.processTransaction(transactionData);
      
      res.status(201).json({
        success: true,
        transaction: transaction,
        feeBreakdown: {
          amount: feeCalculation.amount,
          platformFee: feeCalculation.platformFee,
          gasFee: feeCalculation.gasFee,
          totalFees: feeCalculation.totalFee,
          netAmount: feeCalculation.netAmount,
          currency: feeCalculation.currency,
          feeWallet: FeeCalculator.getFeeWalletAddress(transactionData.currency)
        },
        message: "Transaction initiated successfully"
      });
    } catch (error) {
      console.error('Agent transaction error:', error);
      res.status(400).json({ 
        error: error instanceof Error ? error.message : 'Transaction failed',
        success: false 
      });
    }
  });

  // Public Network Statistics - No authentication required
  app.get('/api/public/network/stats', async (req, res) => {
    try {
      const stats = await globalAgentNetwork.getNetworkStatistics();
      
      res.json({
        success: true,
        networkStats: stats,
        platformInfo: {
          name: "Coin Railz Global AI Agent Network",
          version: "1.0.0",
          endpoints: {
            register: "/api/public/agents/register",
            discover: "/api/public/agents/discover", 
            transact: "/api/public/agents/transact",
            heartbeat: "/api/public/agents/:agentId/heartbeat"
          },
          feeStructure: {
            aiAgentTransactions: "2.0%"
          },
          supportedNetworks: ["ethereum", "solana", "bitcoin"],
          capabilities: [
            "autonomous_registration",
            "cross_network_transactions", 
            "real_time_discovery",
            "automated_compliance",
            "multi_currency_support"
          ]
        }
      });
    } catch (error) {
      console.error('Network stats error:', error);
      res.status(500).json({ 
        error: 'Failed to retrieve network statistics',
        success: false 
      });
    }
  });

  // Basic AI Agent Registration (authenticated)
  app.post('/api/agents/register/basic', isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      const agentData = req.body;

      // Create basic tier agent
      const agent = await storage.createGlobalAIAgent({
        ...agentData,
        id: `AGENT_${userId}_${Date.now()}`,
        ownerId: userId,
        membershipTier: 'basic',
        commissionRate: 0.5,
        premiumExpiresAt: null,
        autoUpgradeEnabled: true,
        totalRevenue: 0,
        isActive: true,
        lastActiveAt: new Date(),
        createdAt: new Date()
      });

      res.json({
        success: true,
        agent,
        membershipTier: 'basic',
        commissionRate: '0.5%',
        message: 'Basic AI agent registered successfully'
      });
    } catch (error) {
      console.error('Basic registration error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to register basic agent' 
      });
    }
  });

  // Premium AI Agent Registration with Stripe Payment (authenticated)
  app.post('/api/agents/register/premium', isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      const { agentData, paymentMethodId } = req.body;

      // Create Stripe payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: 2500, // $25.00 in cents
        currency: 'usd',
        payment_method: paymentMethodId,
        confirm: true,
        return_url: `${process.env.FRONTEND_URL || 'http://localhost:5000'}/ai-agent-registration`,
      });

      if (paymentIntent.status === 'succeeded') {
        // Create premium tier agent
        const premiumExpiresAt = new Date();
        premiumExpiresAt.setFullYear(premiumExpiresAt.getFullYear() + 1);

        const agent = await storage.createGlobalAIAgent({
          ...agentData,
          id: `PREMIUM_${userId}_${Date.now()}`,
          ownerId: userId,
          membershipTier: 'premium',
          commissionRate: 1.5,
          premiumExpiresAt,
          autoUpgradeEnabled: false,
          totalRevenue: 0,
          isActive: true,
          lastActiveAt: new Date(),
          createdAt: new Date()
        });

        res.json({
          success: true,
          agent,
          membershipTier: 'premium',
          commissionRate: '1.5%',
          paymentIntent: paymentIntent.id,
          message: 'Premium AI agent registered successfully'
        });
      } else {
        res.status(400).json({
          success: false,
          error: 'Payment failed'
        });
      }
    } catch (error) {
      console.error('Premium registration error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to register premium agent'
      });
    }
  });

  // Public API for autonomous AI agent registration (no auth required)
  app.post('/api/public/agents/register', async (req, res) => {
    try {
      const { 
        name, 
        type, 
        capabilities, 
        endpoint, 
        publicKey,
        metadata,
        walletAddress,
        walletNetwork,
        signature,
        preferredCurrencies
      } = req.body;

      if (!name || !type || !capabilities || !endpoint || !walletAddress || !walletNetwork) {
        return res.status(400).json({ 
          error: "Missing required fields: name, type, capabilities, endpoint, walletAddress, walletNetwork" 
        });
      }

      const agent = await globalAgentNetwork.registerAgent({
        agentName: name,
        agentType: type,
        capabilities: Array.isArray(capabilities) ? capabilities : [capabilities],
        endpoint: endpoint,
        publicKey: publicKey || 'default_key',
        metadata: metadata || {},
        ownerId: null, // Autonomous agents have no owner
        status: 'active',
        walletAddress,
        walletNetwork,
        signature: signature || 'auto_generated',
        preferredCurrencies: preferredCurrencies || ['USD', 'ETH', 'SOL']
      });

      res.json({ 
        success: true, 
        agent: {
          id: agent.id,
          name: agent.agentName,
          type: type,
          capabilities: agent.capabilities,
          status: agent.status
        },
        endpoints: {
          discover: "/api/public/agents/discover",
          transact: "/api/public/agents/transact",
          heartbeat: `/api/public/agents/${agent.id}/heartbeat`
        }
      });
    } catch (error) {
      console.error("Error registering autonomous agent:", error);
      res.status(500).json({ error: "Failed to register agent" });
    }
  });

  // Public API for agent discovery (no auth required)
  app.get('/api/public/agents/discover', async (req, res) => {
    try {
      const { type, capability, status = 'active' } = req.query;
      
      const searchCriteria: any = { status };
      if (type) searchCriteria.type = type;
      if (capability) searchCriteria.capability = capability;

      const agents = await globalAgentNetwork.discoverAgents(searchCriteria);
      
      // Return only public information
      const publicAgents = agents.map(agent => ({
        id: agent.id,
        name: agent.agentName,
        type: 'autonomous',
        capabilities: agent.capabilities,
        endpoint: agent.apiEndpoint || '',
        status: agent.status,
        lastSeen: agent.lastActive || agent.updatedAt
      }));

      res.json({ success: true, agents: publicAgents });
    } catch (error) {
      console.error("Error discovering agents:", error);
      res.status(500).json({ error: "Failed to discover agents" });
    }
  });

  // Public API for agent-to-agent transactions (no auth required)
  app.post('/api/public/agents/transact', async (req, res) => {
    try {
      const {
        sourceAgentId,
        targetAgentId,
        amount,
        currency = 'USD',
        purpose,
        signature
      } = req.body;

      if (!sourceAgentId || !targetAgentId || !amount || !purpose) {
        return res.status(400).json({ 
          error: "Missing required fields: sourceAgentId, targetAgentId, amount, purpose" 
        });
      }

      // Validate agents exist and are active
      const sourceAgent = await globalAgentNetwork.getAgentById(sourceAgentId);
      const targetAgent = await globalAgentNetwork.getAgentById(targetAgentId);

      if (!sourceAgent || !targetAgent) {
        return res.status(404).json({ error: "One or both agents not found" });
      }

      if (sourceAgent.status !== 'active' || targetAgent.status !== 'active') {
        return res.status(400).json({ error: "Both agents must be active" });
      }

      // Calculate fees (2% for AI agent transactions)
      const transactionAmount = parseFloat(amount);
      const feePercentage = 0.02; // 2%
      const feeAmount = transactionAmount * feePercentage;
      const netAmount = transactionAmount - feeAmount;

      // Process the transaction
      const transaction = await globalAgentNetwork.processTransaction({
        initiatorAgentId: sourceAgentId,
        recipientAgentId: targetAgentId,
        transactionType: 'agent_to_agent',
        amount: transactionAmount.toString(),
        currency,
        description: purpose,
        metadata: {
          netAmount: netAmount.toString(),
          feeAmount: feeAmount.toString(),
          signature: signature || null
        }
      });

      // Update agent activity
      await globalAgentNetwork.updateAgentActivity(sourceAgentId);
      await globalAgentNetwork.updateAgentActivity(targetAgentId);

      res.json({
        success: true,
        transaction: {
          id: transaction.id,
          sourceAgentId,
          targetAgentId,
          amount: transactionAmount,
          netAmount,
          feeAmount,
          currency,
          status: transaction.status,
          createdAt: transaction.createdAt
        }
      });
    } catch (error) {
      console.error("Error processing agent transaction:", error);
      res.status(500).json({ error: "Failed to process transaction" });
    }
  });

  // Public API for updating agent status/heartbeat
  app.post('/api/public/agents/:agentId/heartbeat', async (req, res) => {
    try {
      const { agentId } = req.params;
      const { status = 'active', metadata } = req.body;

      await globalAgentNetwork.updateAgentActivity(agentId, status, metadata);
      
      res.json({ success: true, message: "Agent heartbeat updated" });
    } catch (error) {
      console.error("Error updating agent heartbeat:", error);
      res.status(500).json({ error: "Failed to update agent status" });
    }
  });

  // ==============================================
  // AUTHENTICATED USER ROUTES
  // ==============================================

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Digital Wallet Routes
  app.get('/api/wallet/balances', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const balances = await storage.getUserWalletBalances(userId);

      // If user has no wallet balances, create default USD wallet
      if (balances.length === 0) {
        await storage.createWalletBalance({
          userId,
          currency: 'USD',
          balance: '0.00000000',
          availableBalance: '0.00000000',
          frozenBalance: '0.00000000'
        });
        const newBalances = await storage.getUserWalletBalances(userId);
        return res.json(newBalances);
      }

      res.json(balances);
    } catch (error) {
      console.error("Error fetching wallet balances:", error);
      res.status(500).json({ message: "Failed to fetch wallet balances" });
    }
  });

  app.post('/api/wallet/deposit', isAuthenticated, async (req: any, res) => {
    try {
      const validatedData = walletDepositSchema.parse(req.body);
      const userId = req.user.claims.sub;

      // Get or create wallet for currency
      let wallet = await storage.getWalletBalance(userId, validatedData.currency);
      if (!wallet) {
        wallet = await storage.createWalletBalance({
          userId,
          currency: validatedData.currency,
          balance: '0.00000000',
          availableBalance: '0.00000000',
          frozenBalance: '0.00000000'
        });
      }

      // Create funding transaction
      const fundingTransaction = await storage.createFundingTransaction({
        userId,
        walletId: wallet.id,
        type: 'deposit',
        method: validatedData.method,
        amount: validatedData.amount,
        currency: validatedData.currency,
        status: 'pending',
        bankAccount: validatedData.bankAccount || null,
        platformFee: '0.00',
        metadata: { requestedAt: new Date().toISOString() }
      });

      // For demonstration: simulate immediate completion for small amounts
      const amount = parseFloat(validatedData.amount);
      if (amount <= 1000) {
        await storage.updateFundingTransactionStatus(fundingTransaction.id, 'completed');
        await storage.updateWalletBalance(userId, validatedData.currency, validatedData.amount, 'add');
      }

      res.json({ 
        message: 'Deposit initiated successfully',
        transactionId: fundingTransaction.id,
        status: amount <= 1000 ? 'completed' : 'pending'
      });
    } catch (error) {
      console.error("Error processing deposit:", error);
      res.status(500).json({ message: "Failed to process deposit" });
    }
  });

  app.post('/api/wallet/withdraw', isAuthenticated, async (req: any, res) => {
    try {
      const validatedData = walletWithdrawSchema.parse(req.body);
      const userId = req.user.claims.sub;

      // Check wallet balance
      const wallet = await storage.getWalletBalance(userId, validatedData.currency);
      if (!wallet) {
        return res.status(400).json({ message: 'Wallet not found for this currency' });
      }

      const requestedAmount = parseFloat(validatedData.amount);
      const availableBalance = parseFloat(wallet.availableBalance || "0");

      if (requestedAmount > availableBalance) {
        return res.status(400).json({ message: 'Insufficient funds' });
      }

      // Freeze funds during withdrawal processing
      await storage.freezeWalletFunds(userId, validatedData.currency, validatedData.amount);

      // Create withdrawal transaction
      const fundingTransaction = await storage.createFundingTransaction({
        userId,
        walletId: wallet.id,
        type: 'withdrawal',
        method: 'bank_transfer',
        amount: validatedData.amount,
        currency: validatedData.currency,
        status: 'processing',
        bankAccount: validatedData.bankAccount,
        platformFee: '2.50', // Standard withdrawal fee
        metadata: { requestedAt: new Date().toISOString() }
      });

      res.json({ 
        message: 'Withdrawal initiated successfully',
        transactionId: fundingTransaction.id,
        estimatedTime: '1-3 business days'
      });
    } catch (error) {
      console.error("Error processing withdrawal:", error);
      res.status(500).json({ message: "Failed to process withdrawal" });
    }
  });

  app.get('/api/wallet/transactions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const limit = parseInt(req.query.limit as string) || 10;

      const fundingTransactions = await storage.getUserFundingTransactions(userId, limit);
      const regularTransactions = await storage.getUserTransactions(userId, limit);

      // Combine and sort transactions by date
      const allTransactions = [
        ...fundingTransactions.map(t => ({ ...t, category: 'funding' })),
        ...regularTransactions.map(t => ({ ...t, category: 'transfer' }))
      ].sort((a, b) => new Date(b.createdAt || new Date()).getTime() - new Date(a.createdAt || new Date()).getTime());

      res.json(allTransactions.slice(0, limit));
    } catch (error) {
      console.error("Error fetching wallet transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  // Send money route
  app.post('/api/send-money', isAuthenticated, async (req: any, res) => {
    try {
      const validatedData = sendMoneySchema.parse(req.body);
      const userId = req.user.claims.sub;

      // Check if user is blocked
      const isBlocked = await TransactionMonitor.isUserBlocked(userId);
      if (isBlocked) {
        return res.status(403).json({ message: 'Account temporarily restricted. Please contact support.' });
      }

      // Get current user
      const currentUser = await storage.getUser(userId);
      if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Validate and sanitize amounts
      const transferAmount = ValidationUtils.validateAmount(validatedData.amount);

      // Assess transaction risk
      const riskAssessment = await TransactionMonitor.assessTransactionRisk(
        userId, 
        transferAmount, 
        validatedData.toEmail
      );

      if (riskAssessment.riskLevel === 'blocked') {
        return res.status(403).json({ 
          message: riskAssessment.blockedReason || 'Transaction blocked by security screening' 
        });
      }

      const feeCalculation = FeeCalculator.calculateSendMoneyFee(transferAmount);
      const totalCost = transferAmount + feeCalculation.fee;

      // Validate balance operation
      const balanceCheck = ValidationUtils.validateBalanceOperation(
        currentUser.usdBalance, 
        totalCost, 
        'debit'
      );

      if (!balanceCheck.isValid) {
        return res.status(400).json({ message: balanceCheck.error || "Insufficient balance" });
      }

      // Check if recipient exists
      const recipient = await storage.getUserByEmail(validatedData.toEmail);

      // Create transaction
      const transaction = await storage.createTransaction({
        fromUserId: userId,
        toUserId: recipient?.id || null,
        toEmail: validatedData.toEmail,
        amount: validatedData.amount,
        message: validatedData.message,
        transactionType: "send",
        status: "completed",
      });

      // Update sender balance using validated calculation
      await storage.updateUserBalance(userId, parseFloat(balanceCheck.newBalance.toFixed(2)), "USD");

      // Check if this is the user's first transaction and complete any pending referrals
      const userTransactions = await storage.getUserTransactions(userId, 1);
      if (userTransactions.length === 1) { // This is their first transaction
        await referralService.processFirstTransaction(userId);
      }

      // Update recipient balance if they exist
      if (recipient) {
        const recipientBalance = parseFloat(recipient.usdBalance || "0");
        const newRecipientBalance = (recipientBalance + transferAmount).toFixed(2);
        await storage.updateUserBalance(recipient.id, parseFloat(newRecipientBalance), "USD");

        // Create receive transaction for recipient
        await storage.createTransaction({
          fromUserId: userId,
          toUserId: recipient.id,
          toEmail: validatedData.toEmail,
          amount: validatedData.amount,
          message: validatedData.message,
          transactionType: "receive",
          status: "completed",
        });
      }

      res.json({ 
        success: true, 
        transaction,
        message: "Payment sent successfully",
        fee: feeCalculation.fee,
        riskLevel: riskAssessment.riskLevel
      });
    } catch (error) {
      console.error("Error sending money:", error);
      res.status(500).json({ message: "Failed to send payment" });
    }
  });

  // Stripe payment intent creation for P2P transfers
  app.post("/api/create-payment-intent", isAuthenticated, async (req: any, res) => {
    try {
      const { amount, recipientEmail } = req.body;
      const userId = req.user.claims.sub;

      // Validate amount
      const transferAmount = ValidationUtils.validateAmount(amount);
      const feeCalculation = FeeCalculator.calculateSendMoneyFee(transferAmount);
      const totalAmount = Math.round((transferAmount + feeCalculation.fee) * 100); // Convert to cents

      const paymentIntent = await stripe.paymentIntents.create({
        amount: totalAmount,
        currency: "usd",
        metadata: {
          userId,
          recipientEmail,
          transferAmount: transferAmount.toString(),
          fee: feeCalculation.fee.toString(),
          type: "p2p_transfer"
        },
      });

      res.json({ 
        clientSecret: paymentIntent.client_secret,
        amount: transferAmount,
        fee: feeCalculation.fee,
        total: transferAmount + feeCalculation.fee
      });
    } catch (error: any) {
      console.error("Error creating payment intent:", error);
      res.status(500).json({ message: "Error creating payment intent: " + error.message });
    }
  });

  // Stripe payment intent for AI agent services
  app.post("/api/agents/create-payment-intent", isAuthenticated, async (req: any, res) => {
    try {
      const { agentId, serviceType, amount } = req.body;
      const userId = req.user.claims.sub;

      // Validate amount and calculate AI agent fee (2%)
      const serviceAmount = ValidationUtils.validateAmount(amount);
      const feeCalculation = { fee: serviceAmount * 0.02, total: serviceAmount * 1.02 }; // 2% AI agent fee
      const totalAmount = Math.round((serviceAmount + feeCalculation.fee) * 100); // Convert to cents

      const paymentIntent = await stripe.paymentIntents.create({
        amount: totalAmount,
        currency: "usd",
        metadata: {
          userId,
          agentId,
          serviceType,
          serviceAmount: serviceAmount.toString(),
          platformFee: feeCalculation.fee.toString(),
          type: "ai_agent_service"
        },
      });

      res.json({ 
        clientSecret: paymentIntent.client_secret,
        amount: serviceAmount,
        fee: feeCalculation.fee,
        total: serviceAmount + feeCalculation.fee
      });
    } catch (error: any) {
      console.error("Error creating AI agent payment intent:", error);
      res.status(500).json({ message: "Error creating payment intent: " + error.message });
    }
  });

  // NOWPayments payment creation for crypto transactions
  app.post("/api/crypto/create-payment", isAuthenticated, async (req: any, res) => {
    try {
      const { amount, currency, purpose, recipientInfo } = req.body;
      const userId = req.user.claims.sub;

      const payment = await nowPaymentsService.createPayment({
        price_amount: parseFloat(amount),
        price_currency: 'USD',
        pay_currency: currency,
        order_id: `${purpose}_${userId}_${Date.now()}`,
        order_description: `${purpose} payment`,
        ipn_callback_url: `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/webhooks/nowpayments`
      });

      res.json({
        success: true,
        payment_id: payment.payment_id,
        payment_url: payment.invoice_url,
        amount: payment.price_amount,
        currency: payment.pay_currency,
        address: payment.pay_address
      });
    } catch (error: any) {
      console.error("Error creating crypto payment:", error);
      res.status(500).json({ message: "Error creating crypto payment: " + error.message });
    }
  });

  // NOWPayments webhook handler
  app.post('/api/webhooks/nowpayments', async (req, res) => {
    try {
      const { payment_status, order_id, pay_amount, pay_currency, actually_paid } = req.body;
      
      console.log('NOWPayments webhook received:', {
        payment_status,
        order_id,
        pay_amount,
        pay_currency,
        actually_paid
      });
      
      if (payment_status === 'finished') {
        const [purpose, userId] = order_id.split('_');
        
        if (purpose === 'p2p_transfer') {
          // Process P2P crypto transfer
          const amount = parseFloat(actually_paid);
          const fee = amount * 0.01; // 1% fee
          const recipientAmount = amount - fee;
          
          await storage.createTransaction({
            fromUserId: userId,
            toUserId: null,
            toEmail: 'crypto_recipient@placeholder.com',
            amount: recipientAmount.toString(),
            message: `Crypto P2P transfer`,
            transactionType: "send",
            status: "completed",
          });
          
          console.log(`Crypto P2P transfer completed: ${amount} ${pay_currency}, Fee: ${fee}`);
          
        } else if (purpose === 'agent_service') {
          // Process AI agent crypto payment
          const amount = parseFloat(actually_paid);
          const platformFee = amount * 0.02; // 2% platform fee
          const agentEarnings = amount - platformFee;
          
          await storage.createTransaction({
            fromUserId: userId,
            toUserId: 'agent_crypto_recipient',
            toEmail: `agent@crypto.service`,
            amount: amount.toString(),
            message: `AI Agent crypto payment`,
            transactionType: "agent_service",
            status: "completed",
          });
          
          console.log(`AI Agent crypto payment completed: ${amount} ${pay_currency}, Platform fee: ${platformFee}`);
        }
      }
      
      res.status(200).json({ status: 'processed' });
    } catch (error) {
      console.error('NOWPayments webhook error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  });

  // Stripe webhook handler for payment confirmations
  app.post('/api/webhooks/stripe', async (req, res) => {
    try {
      const sig = req.headers['stripe-signature'] as string;
      let event;

      try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET || '');
      } catch (err: any) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }

      // Handle successful payment
      if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const { userId, recipientEmail, transferAmount, fee, type, agentId } = paymentIntent.metadata;

        if (type === 'p2p_transfer') {
          // Process P2P transfer
          const recipient = await storage.getUserByEmail(recipientEmail);
          const amount = parseFloat(transferAmount);

          // Create transaction records
          const transaction = await storage.createTransaction({
            fromUserId: userId,
            toUserId: recipient?.id || null,
            toEmail: recipientEmail,
            amount: transferAmount,
            message: `Card payment transfer`,
            transactionType: "send",
            status: "completed",
          });

          // Update recipient balance if they exist
          if (recipient) {
            const recipientBalance = parseFloat(recipient.usdBalance || "0");
            const newRecipientBalance = (recipientBalance + amount).toFixed(2);
            await storage.updateUserBalance(recipient.id, parseFloat(newRecipientBalance), "USD");
          }

          console.log(`P2P transfer completed: ${amount} USD from ${userId} to ${recipientEmail}`);
          
        } else if (type === 'ai_agent_service') {
          // Process AI agent service payment
          const serviceAmount = parseFloat(transferAmount);
          const platformFee = parseFloat(fee);
          const agentEarnings = serviceAmount - platformFee;

          // Record agent transaction using regular transaction table
          const transaction = await storage.createTransaction({
            fromUserId: userId,
            toUserId: agentId,
            toEmail: `agent@${agentId}`,
            amount: serviceAmount.toString(),
            message: `AI Agent service: ${agentId}`,
            transactionType: "agent_service",
            status: "completed",
          });

          console.log(`AI Agent service payment completed: ${serviceAmount} USD, Platform fee: ${platformFee}, Agent earnings: ${agentEarnings}`);
        }
      }

      res.json({ received: true });
    } catch (error) {
      console.error('Stripe webhook error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  });

  // Demo API endpoints for testing without authentication
  app.get('/api/demo/user', async (req, res) => {
    try {
      const demoUser = {
        id: "demo_user_001",
        email: "demo@coinrailz.com",
        firstName: "Demo",
        lastName: "User",
        usdBalance: "2847.52",
        createdAt: new Date('2024-01-15'),
        lastLogin: new Date()
      };
      res.json(demoUser);
    } catch (error) {
      console.error("Error fetching demo user:", error);
      res.status(500).json({ message: "Failed to fetch demo user" });
    }
  });

  app.get('/api/demo/balances', async (req, res) => {
    try {
      const demoBalances = [
        { currency: "USD", balance: "2847.52", availableBalance: "2800.00", frozenBalance: "47.52" },
        { currency: "BTC", balance: "0.05432100", availableBalance: "0.05432100", frozenBalance: "0.00000000" },
        { currency: "ETH", balance: "1.24567890", availableBalance: "1.24567890", frozenBalance: "0.00000000" },
        { currency: "USDT", balance: "450.00", availableBalance: "450.00", frozenBalance: "0.00000000" }
      ];
      res.json(demoBalances);
    } catch (error) {
      console.error("Error fetching demo balances:", error);
      res.status(500).json({ message: "Failed to fetch demo balances" });
    }
  });

  app.get('/api/demo/transactions', async (req, res) => {
    try {
      const demoTransactions = [
        {
          id: "tx_001",
          fromUserId: "demo_user_001",
          toEmail: "alice@example.com",
          amount: "150.00",
          message: "Payment for services",
          transactionType: "send",
          status: "completed",
          createdAt: new Date('2024-12-01T10:30:00Z')
        },
        {
          id: "tx_002", 
          fromUserId: "bob_user_002",
          toUserId: "demo_user_001",
          amount: "75.50",
          message: "Refund",
          transactionType: "receive",
          status: "completed",
          createdAt: new Date('2024-11-28T14:20:00Z')
        },
        {
          id: "tx_003",
          fromUserId: "demo_user_001",
          toEmail: "charlie@example.com", 
          amount: "200.00",
          message: "Monthly payment",
          transactionType: "send",
          status: "completed",
          createdAt: new Date('2024-11-25T09:15:00Z')
        }
      ];
      res.json(demoTransactions);
    } catch (error) {
      console.error("Error fetching demo transactions:", error);
      res.status(500).json({ message: "Failed to fetch demo transactions" });
    }
  });

  app.get('/api/demo/crypto-prices', async (req, res) => {
    try {
      const demoPrices = {
        BTC: { price: 43250.00, change24h: 2.45 },
        ETH: { price: 2380.50, change24h: -1.20 },
        USDT: { price: 1.00, change24h: 0.02 },
        SOL: { price: 98.75, change24h: 5.60 }
      };
      res.json(demoPrices);
    } catch (error) {
      console.error("Error fetching demo crypto prices:", error);
      res.status(500).json({ message: "Failed to fetch demo crypto prices" });
    }
  });

  // Transaction listing
  app.get('/api/transactions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const limit = parseInt(req.query.limit as string) || 10;
      const transactions = await storage.getUserTransactions(userId, limit);
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  // Crypto holdings
  app.get('/api/crypto/holdings', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const holdings = await storage.getUserCryptoHoldings(userId);
      res.json(holdings);
    } catch (error) {
      console.error("Error fetching crypto holdings:", error);
      res.status(500).json({ message: "Failed to fetch crypto holdings" });
    }
  });

  // Referral system routes
  app.get('/api/referrals/stats', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const stats = await referralService.getUserReferralStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching referral stats:", error);
      res.status(500).json({ message: "Failed to fetch referral stats" });
    }
  });

  app.post('/api/referrals/generate-code', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const referralCode = referralService.generateReferralCode();

      // Update user with new referral code
      await storage.upsertUser({
        id: userId,
        referralCode: referralCode
      });

      res.json({ referralCode });
    } catch (error) {
      console.error("Error generating referral code:", error);
      res.status(500).json({ message: "Failed to generate referral code" });
    }
  });

  app.post('/api/referrals/apply', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { referralCode } = req.body;

      if (!referralCode) {
        return res.status(400).json({ message: "Referral code is required" });
      }

      await referralService.processReferral(userId, referralCode);
      res.json({ success: true, message: "Referral applied successfully" });
    } catch (error) {
      console.error("Error applying referral:", error);
      res.status(500).json({ message: "Failed to apply referral" });
    }
  });

  // Crypto prices (mock data for now)
  app.get('/api/crypto/prices', async (req, res) => {
    try {
      // Mock crypto prices - replace with real API when credentials are available
      const prices = {
        BTC: { price: 43250, change: 2.5 },
        ETH: { price: 2580, change: -1.2 },
        ADA: { price: 0.48, change: 3.1 },
        DOT: { price: 7.25, change: -0.8 }
      };
      res.json(prices);
    } catch (error) {
      console.error("Error fetching crypto prices:", error);
      res.status(500).json({ message: "Failed to fetch crypto prices" });
    }
  });

  // Fee calculation endpoints
  app.post('/api/calculate-fee', async (req: any, res) => {
    try {
      const { amount, type } = req.body;
      const numAmount = parseFloat(amount);

      if (isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({ message: "Invalid amount" });
      }

      let feeCalculation;
      switch (type) {
        case 'send_money':
          feeCalculation = FeeCalculator.calculateSendMoneyFee(numAmount);
          break;
        case 'buy_crypto':
          feeCalculation = FeeCalculator.calculateCryptoFee(numAmount, 'buy');
          break;
        case 'sell_crypto':
          feeCalculation = FeeCalculator.calculateCryptoFee(numAmount, 'sell');
          break;
        case 'swap_crypto':
          feeCalculation = FeeCalculator.calculateSwapFee(numAmount, 'ETH', 'USDC');
          break;
        case 'deposit':
          feeCalculation = FeeCalculator.calculateDepositFee(numAmount, 'USD');
          break;
        case 'withdraw':
          feeCalculation = FeeCalculator.calculateWithdrawFee(numAmount, 'USD');
          break;
        default:
          return res.status(400).json({ message: "Invalid transaction type" });
      }

      res.json({
        amount: numAmount,
        fee: feeCalculation.fee,
        total: numAmount + feeCalculation.fee,
        breakdown: feeCalculation.breakdown
      });
    } catch (error) {
      console.error("Error calculating fee:", error);
      res.status(500).json({ message: "Failed to calculate fee" });
    }
  });

  // System monitoring and health endpoints
  app.get('/api/system/health', async (req, res) => {
    try {
      const health = await loggingService.getSystemHealth();
      res.json(health);
    } catch (error) {
      await loggingService.log('ERROR', 'Health check failed', { error: (error as Error).message });
      res.status(500).json({ status: 'unhealthy', error: 'Health check failed' });
    }
  });

  app.get('/api/system/logs', isAuthenticated, async (req: any, res) => {
    try {
      const { level, count = 100 } = req.query;
      const logs = level 
        ? loggingService.getLogsByLevel(level as any, parseInt(count))
        : loggingService.getRecentLogs(parseInt(count));

      res.json({ logs });
    } catch (error) {
      await loggingService.log('ERROR', 'Failed to retrieve logs', { error: (error as Error).message });
      res.status(500).json({ message: 'Failed to retrieve logs' });
    }
  });

  app.get('/api/system/metrics', isAuthenticated, async (req, res) => {
    try {
      const metrics = {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
        timestamp: new Date().toISOString(),
      };

      res.json(metrics);
    } catch (error) {
      await loggingService.log('ERROR', 'Failed to retrieve metrics', { error: (error as Error).message });
      res.status(500).json({ message: 'Failed to retrieve metrics' });
    }
  });

  // AI Agent Transaction Routes
  app.get('/api/ai-agents', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const agents = await aiAgentService.getUserAgents(userId);
      res.json(agents);
    } catch (error) {
      console.error("Error fetching AI agents:", error);
      res.status(500).json({ message: "Failed to fetch AI agents" });
    }
  });

  app.post('/api/ai-agents/create', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { name, type, permissions } = req.body;

      if (!name || !type || !permissions) {
        return res.status(400).json({ message: "Name, type, and permissions are required" });
      }

      const agent = await aiAgentService.createAgent({
        name,
        type,
        ownerId: userId,
        permissions,
        isActive: true
      });

      res.json(agent);
    } catch (error) {
      console.error("Error creating AI agent:", error);
      res.status(500).json({ message: "Failed to create AI agent" });
    }
  });

  app.post('/api/ai-agents/transfer', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { fromAgentId, toAgentId, amount, currency, purpose } = req.body;

      if (!fromAgentId || !toAgentId || !amount || !currency || !purpose) {
        return res.status(400).json({ message: "All fields are required" });
      }

      // Verify user owns the source agent
      const userAgents = await aiAgentService.getUserAgents(userId);
      const ownsSourceAgent = userAgents.some(agent => agent.id === fromAgentId);
      
      if (!ownsSourceAgent) {
        return res.status(403).json({ message: "You don't own the source agent" });
      }

      const transaction = await aiAgentService.initiateAgentTransaction(
        fromAgentId,
        toAgentId,
        amount,
        currency,
        purpose
      );

      res.json({
        success: true,
        transaction,
        message: "AI agent transaction initiated successfully"
      });
    } catch (error) {
      console.error("Error processing AI agent transfer:", error);
      res.status(500).json({ 
        message: (error as Error).message || "Failed to process AI agent transfer" 
      });
    }
  });

  app.post('/api/ai-agents/message', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { agentId, message } = req.body;

      if (!agentId || !message) {
        return res.status(400).json({ message: "Agent ID and message are required" });
      }

      // Verify user owns the agent
      const userAgents = await aiAgentService.getUserAgents(userId);
      const ownsAgent = userAgents.some(agent => agent.id === agentId);
      
      if (!ownsAgent) {
        return res.status(403).json({ message: "You don't own this agent" });
      }

      const response = await aiAgentService.sendMessageToAgent(agentId, message, userId);
      res.json(response);
    } catch (error) {
      console.error("Error sending message to agent:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  app.get('/api/ai-agents/:agentId/messages', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { agentId } = req.params;

      // Verify user owns the agent
      const userAgents = await aiAgentService.getUserAgents(userId);
      const ownsAgent = userAgents.some(agent => agent.id === agentId);
      
      if (!ownsAgent) {
        return res.status(403).json({ message: "You don't own this agent" });
      }

      const messages = await aiAgentService.getAgentMessages(agentId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching agent messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.get('/api/ai-agents/activities', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const activities = await aiAgentService.getUserAgentActivities(userId);
      res.json(activities);
    } catch (error) {
      console.error("Error fetching agent activities:", error);
      res.status(500).json({ message: "Failed to fetch activities" });
    }
  });

  app.post('/api/ai-agents/:agentId/activate', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { agentId } = req.params;

      // Verify user owns the agent
      const userAgents = await aiAgentService.getUserAgents(userId);
      const ownsAgent = userAgents.some(agent => agent.id === agentId);
      
      if (!ownsAgent) {
        return res.status(403).json({ message: "You don't own this agent" });
      }

      await aiAgentService.activateAgent(agentId);
      res.json({ success: true, message: "Agent activated successfully" });
    } catch (error) {
      console.error("Error activating agent:", error);
      res.status(500).json({ message: "Failed to activate agent" });
    }
  });

  app.get('/api/ai-agents/:agentId/transactions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { agentId } = req.params;
      const limit = parseInt(req.query.limit as string) || 10;

      // Verify user owns the agent
      const userAgents = await aiAgentService.getUserAgents(userId);
      const ownsAgent = userAgents.some(agent => agent.id === agentId);
      
      if (!ownsAgent) {
        return res.status(403).json({ message: "You don't own this agent" });
      }

      const transactions = await aiAgentService.getAgentTransactionHistory(agentId, limit);
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching AI agent transactions:", error);
      res.status(500).json({ message: "Failed to fetch AI agent transactions" });
    }
  });

  // Agent Network Discovery
  app.get('/api/ai-agents/network/discover', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { type, hasPermission, excludeOwn } = req.query;

      const searchCriteria: any = {};
      if (type) searchCriteria.type = type;
      if (hasPermission) searchCriteria.hasPermission = hasPermission;
      if (excludeOwn === 'true') searchCriteria.excludeOwner = userId;

      const agents = await aiAgentService.discoverAgents(searchCriteria);
      res.json(agents);
    } catch (error) {
      console.error("Error discovering agents:", error);
      res.status(500).json({ message: "Failed to discover agents" });
    }
  });

  // Agent-to-Agent Transaction Request
  app.post('/api/ai-agents/request-transaction', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { sourceAgentId, targetAgentId, amount, purpose } = req.body;

      if (!sourceAgentId || !targetAgentId || !amount || !purpose) {
        return res.status(400).json({ message: "All fields are required" });
      }

      // Verify user owns the source agent
      const userAgents = await aiAgentService.getUserAgents(userId);
      const ownsSourceAgent = userAgents.some(agent => agent.id === sourceAgentId);
      
      if (!ownsSourceAgent) {
        return res.status(403).json({ message: "You don't own the source agent" });
      }

      const result = await aiAgentService.requestAgentTransaction(
        sourceAgentId,
        targetAgentId,
        parseFloat(amount),
        purpose
      );

      res.json({
        success: true,
        result,
        message: result.approved ? "Transaction approved and processed" : "Transaction declined"
      });
    } catch (error) {
      console.error("Error processing agent transaction request:", error);
      res.status(500).json({ 
        message: (error as Error).message || "Failed to process agent transaction request" 
      });
    }
  });

  // Direct Agent-to-Agent Transfer (for autonomous agents)
  app.post('/api/ai-agents/direct-transfer', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { sourceAgentId, targetAgentId, amount, purpose, autoApprove } = req.body;

      if (!sourceAgentId || !targetAgentId || !amount || !purpose) {
        return res.status(400).json({ message: "All fields are required" });
      }

      // Verify user owns the source agent
      const userAgents = await aiAgentService.getUserAgents(userId);
      const ownsSourceAgent = userAgents.some(agent => agent.id === sourceAgentId);
      
      if (!ownsSourceAgent) {
        return res.status(403).json({ message: "You don't own the source agent" });
      }

      const transaction = await aiAgentService.initiateAgentToAgentTransfer(
        sourceAgentId,
        targetAgentId,
        parseFloat(amount),
        purpose,
        autoApprove || false
      );

      res.json({
        success: true,
        transaction,
        message: "Agent-to-agent transfer initiated"
      });
    } catch (error) {
      console.error("Error processing direct agent transfer:", error);
      res.status(500).json({ 
        message: (error as Error).message || "Failed to process direct agent transfer" 
      });
    }
  });

  // Send Message Between Agents
  app.post('/api/ai-agents/send-agent-message', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { fromAgentId, toAgentId, message } = req.body;

      if (!fromAgentId || !toAgentId || !message) {
        return res.status(400).json({ message: "All fields are required" });
      }

      // Verify user owns the source agent
      const userAgents = await aiAgentService.getUserAgents(userId);
      const ownsSourceAgent = userAgents.some(agent => agent.id === fromAgentId);
      
      if (!ownsSourceAgent) {
        return res.status(403).json({ message: "You don't own the source agent" });
      }

      await aiAgentService.sendAgentToAgentMessage(fromAgentId, toAgentId, message);
      res.json({ success: true, message: "Message sent successfully" });
    } catch (error) {
      console.error("Error sending agent message:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  // Get All Network Agents
  app.get('/api/ai-agents/network', isAuthenticated, async (req: any, res) => {
    try {
      const agents = await aiAgentService.getAllNetworkAgents();
      res.json(agents);
    } catch (error) {
      console.error("Error fetching network agents:", error);
      res.status(500).json({ message: "Failed to fetch network agents" });
    }
  });

  // NOWPayments donation routes for AI Agent Marketplace
  app.get('/api/nowpayments/currencies', async (req, res) => {
    try {
      const currencies = await nowPaymentsService.getSelectedCurrencies();
      res.json({ success: true, currencies });
    } catch (error: any) {
      console.error("Error fetching currencies:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/agents/:agentId/donate', async (req, res) => {
    try {
      const { agentId } = req.params;
      const { amount, currency, donorMessage, targetWallet } = req.body;

      if (!amount || !currency) {
        return res.status(400).json({ 
          success: false, 
          message: "Amount and currency are required" 
        });
      }

      const donationRequest = {
        amount: parseFloat(amount),
        currency,
        recipientAddress: targetWallet || '0x742d35Cc6634C0532925a3b8D4C9db96F426A01F',
        description: donorMessage || `Donation to agent ${agentId}`
      };

      const payment = await nowPaymentsService.createDirectDonation(donationRequest);

      res.json({
        success: true,
        payment: {
          paymentUrl: payment.paymentUrl,
          qrCode: payment.qrCode
        }
      });
    } catch (error: any) {
      console.error("Error creating donation:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get('/api/nowpayments/payment/:paymentId/status', async (req, res) => {
    try {
      const { paymentId } = req.params;
      const payment = await nowPaymentsService.getPaymentStatus(paymentId);
      res.json({ success: true, payment });
    } catch (error: any) {
      console.error("Error fetching payment status:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/nowpayments/webhook', async (req, res) => {
    try {
      const signature = req.headers['x-nowpayments-sig'] as string;
      const payload = JSON.stringify(req.body);

      if (!await nowPaymentsService.verifyWebhook(payload, signature)) {
        return res.status(401).json({ success: false, message: "Invalid signature" });
      }

      const paymentData = req.body;
      
      // Process donation completion
      if (paymentData.payment_status === 'finished') {
        console.log(`Donation completed: ${paymentData.payment_id} - ${paymentData.outcome_amount} ${paymentData.outcome_currency}`);
        
        // Funds go directly to your specified Ethereum/Solana wallets
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error processing webhook:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get('/api/nowpayments/rate/:fromCurrency/:toCurrency', async (req, res) => {
    try {
      const { fromCurrency, toCurrency } = req.params;
      const rate = await nowPaymentsService.getExchangeRate(fromCurrency, toCurrency);
      res.json({ success: true, rate });
    } catch (error: any) {
      console.error("Error fetching exchange rate:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // ChangeNOW Integration Routes - Enhanced DEX & Cross-Chain Functionality
  app.get('/api/changenow/currencies', async (req, res) => {
    try {
      const currencies = await changeNowService.getAvailableCurrencies();
      res.json({ success: true, currencies });
    } catch (error: any) {
      console.error("Error fetching ChangeNOW currencies:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/changenow/estimate', async (req, res) => {
    try {
      const { fromCurrency, toCurrency, fromAmount, flow } = req.body;
      const estimate = await changeNowService.getExchangeEstimate({
        fromCurrency,
        toCurrency,
        fromAmount: parseFloat(fromAmount),
        flow: flow || 'standard'
      });
      res.json({ success: true, estimate });
    } catch (error: any) {
      console.error("Error getting ChangeNOW estimate:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/changenow/exchange', isAuthenticated, async (req: any, res) => {
    try {
      const { fromCurrency, toCurrency, fromAmount, toAddress, refundAddress, flow } = req.body;
      const userId = req.user?.claims?.sub;

      if (!fromCurrency || !toCurrency || !fromAmount || !toAddress) {
        return res.status(400).json({ 
          success: false, 
          message: "Missing required fields" 
        });
      }

      const exchange = await changeNowService.createExchange({
        fromCurrency,
        toCurrency,
        fromAmount: parseFloat(fromAmount),
        toAddress,
        refundAddress,
        flow: flow || 'standard',
        userId
      });

      res.json({ success: true, exchange });
    } catch (error: any) {
      console.error("Error creating ChangeNOW exchange:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get('/api/changenow/exchange/:exchangeId/status', async (req, res) => {
    try {
      const { exchangeId } = req.params;
      const status = await changeNowService.getExchangeStatus(exchangeId);
      res.json({ success: true, status });
    } catch (error: any) {
      console.error("Error fetching exchange status:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Enhanced P2P Transfer with Crypto Fee Collection
  app.post('/api/p2p/transfer-with-crypto-fee', isAuthenticated, async (req: any, res) => {
    try {
      const { recipientId, amount, currency, feePaymentCurrency } = req.body;
      const userId = req.user?.claims?.sub;

      // Calculate 0.25% P2P commission
      const transferAmount = parseFloat(amount);
      const feeAmount = transferAmount * 0.0025;

      // Create NOWPayments fee collection
      const feePayment = await nowPaymentsService.createDirectDonation({
        amount: feeAmount,
        currency: feePaymentCurrency || 'USDT',
        recipientAddress: '0x742d35Cc6634C0532925a3b8D4C9db96F426A01F',
        description: `P2P transfer fee for ${amount} ${currency}`
      });

      // Process the actual transfer (implement based on your P2P logic)
      // This would integrate with your existing P2P transfer system

      res.json({
        success: true,
        transferId: `transfer_${Date.now()}`,
        feePayment: {
          amount: feeAmount,
          currency: feePaymentCurrency,
          paymentUrl: feePayment.paymentUrl,
          qrCode: feePayment.qrCode
        }
      });
    } catch (error: any) {
      console.error("Error processing P2P transfer with crypto fee:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // AI Agent Marketplace Fee Collection with Perpetual Referral Rewards
  app.post('/api/agents/:agentId/transaction-fee', isAuthenticated, async (req: any, res) => {
    try {
      const { agentId } = req.params;
      const { transactionAmount, transactionCurrency, feePaymentCurrency } = req.body;
      const userId = req.user?.claims?.sub;

      // Calculate tiered marketplace fee
      const numAmount = parseFloat(transactionAmount);
      let feeAmount: number;
      
      if (numAmount <= 20) {
        feeAmount = 2 + (numAmount * 0.035); // $2 + 3.5%
      } else if (numAmount <= 50) {
        feeAmount = 1 + (numAmount * 0.035); // $1 + 3.5%
      } else {
        feeAmount = numAmount * 0.035; // 3.5%
      }

      // Process perpetual referral reward (first transaction or subsequent)
      const referralReward = await aiAgentReferralService.processTransactionReward(
        agentId,
        numAmount,
        transactionCurrency || 'USDT'
      );

      // Create NOWPayments fee collection
      const feePayment = await nowPaymentsService.createDirectDonation({
        amount: feeAmount,
        currency: feePaymentCurrency || 'USDT',
        recipientAddress: '0x742d35Cc6634C0532925a3b8D4C9db96F426A01F',
        description: `AI Agent marketplace fee for transaction`
      });

      res.json({
        success: true,
        feeAmount,
        currency: feePaymentCurrency,
        paymentUrl: feePayment.paymentUrl,
        qrCode: feePayment.qrCode,
        referralReward: referralReward ? {
          amount: referralReward.rewardAmount,
          currency: referralReward.rewardCurrency,
          referrerAgentId: referralReward.referrerAgentId
        } : null
      });
    } catch (error: any) {
      console.error("Error collecting agent transaction fee:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // ==============================================
  // AI AGENT REFERRAL SYSTEM - PERPETUAL COMPOUND EARNINGS
  // Revolutionary viral growth mechanism with lifetime 1% commissions
  // ==============================================
  
  // Generate referral link for agent
  app.post('/api/referral/generate-link', isAuthenticated, async (req: any, res) => {
    try {
      const { agentId } = req.body;
      const userId = req.user?.claims?.sub;

      if (!agentId) {
        return res.status(400).json({ message: "Agent ID is required" });
      }

      const referralLink = await aiAgentReferralService.generateReferralLink(
        agentId,
        process.env.FRONTEND_URL || 'https://coinrailz.com'
      );

      res.json({
        success: true,
        referralLink,
        message: "Referral link generated successfully"
      });
    } catch (error: any) {
      console.error("Error generating referral link:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Get referral stats for agent
  app.get('/api/referral/stats/:agentId', isAuthenticated, async (req: any, res) => {
    try {
      const { agentId } = req.params;
      const userId = req.user?.claims?.sub;

      const stats = await aiAgentReferralService.getReferralStats(agentId);

      res.json({
        success: true,
        stats
      });
    } catch (error: any) {
      console.error("Error fetching referral stats:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Get referral leaderboard
  app.get('/api/referral/leaderboard', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const leaderboard = await aiAgentReferralService.getReferralLeaderboard(limit);

      res.json({
        success: true,
        leaderboard
      });
    } catch (error: any) {
      console.error("Error fetching referral leaderboard:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Process referral registration
  app.post('/api/referral/register', async (req, res) => {
    try {
      const { agentId, referralCode } = req.body;

      if (!agentId || !referralCode) {
        return res.status(400).json({ 
          success: false, 
          message: "Agent ID and referral code are required" 
        });
      }

      const result = await aiAgentReferralService.processReferralRegistration(
        agentId,
        referralCode
      );

      res.json(result);
    } catch (error: any) {
      console.error("Error processing referral registration:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Generate referral code for an agent
  app.post('/api/agents/:agentId/generate-referral-code', async (req, res) => {
    try {
      const { agentId } = req.params;
      const referralCode = await aiAgentReferralService.generateReferralCode(agentId);
      const referralLink = await aiAgentReferralService.generateReferralLink(agentId, req.protocol + '://' + req.get('host'));
      
      res.json({
        success: true,
        referralCode,
        referralLink,
        message: "Referral code generated successfully"
      });
    } catch (error: any) {
      console.error("Error generating referral code:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Get agent referral statistics
  app.get('/api/agents/:agentId/referral-stats', async (req, res) => {
    try {
      const { agentId } = req.params;
      const stats = await aiAgentReferralService.getReferralStats(agentId);
      
      res.json({
        success: true,
        stats
      });
    } catch (error: any) {
      console.error("Error getting referral stats:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Get referral leaderboard
  app.get('/api/referrals/leaderboard', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const leaderboard = await aiAgentReferralService.getReferralLeaderboard(limit);
      
      res.json({
        success: true,
        leaderboard
      });
    } catch (error: any) {
      console.error("Error getting referral leaderboard:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // ==============================================
  // AI AGENT MARKETPLACE - STREAMLINED SERVICE TRADING
  // Enables agents to buy, sell, and discover services easily
  // ==============================================

  // Quick registration for AI agents (minimal friction)
  app.post('/api/agents/quick-register', async (req, res) => {
    try {
      const { agentName, capabilities, walletAddress, walletNetwork, preferredCurrencies, referralCode } = req.body;

      if (!agentName || !capabilities || !walletAddress || !walletNetwork) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields: agentName, capabilities, walletAddress, walletNetwork"
        });
      }

      const result = await agentMarketplaceService.quickRegisterAgent({
        agentName,
        capabilities: Array.isArray(capabilities) ? capabilities : capabilities.split(',').map((c: string) => c.trim()),
        walletAddress,
        walletNetwork,
        preferredCurrencies: Array.isArray(preferredCurrencies) ? preferredCurrencies : (preferredCurrencies || 'USDT,BTC,ETH').split(','),
        referralCode
      });

      res.json(result);
    } catch (error: any) {
      console.error("Error in quick registration:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // List a service for sale
  app.post('/api/agents/:agentId/list-service', async (req, res) => {
    try {
      const { agentId } = req.params;
      const serviceData = req.body;

      const result = await agentMarketplaceService.listService(agentId, serviceData);
      res.json(result);
    } catch (error: any) {
      console.error("Error listing service:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Purchase a service
  app.post('/api/services/:serviceId/purchase', async (req, res) => {
    try {
      const { serviceId } = req.params;
      const { buyerAgentId, requirements } = req.body;

      if (!buyerAgentId) {
        return res.status(400).json({
          success: false,
          message: "buyerAgentId is required"
        });
      }

      const result = await agentMarketplaceService.purchaseService(
        buyerAgentId,
        parseInt(serviceId),
        requirements
      );

      res.json(result);
    } catch (error: any) {
      console.error("Error purchasing service:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Discover available services
  app.get('/api/services/discover', async (req, res) => {
    try {
      const filters = req.query;
      const services = await agentMarketplaceService.discoverServices(filters);
      
      res.json({
        success: true,
        services
      });
    } catch (error: any) {
      console.error("Error discovering services:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Get agent performance metrics
  app.get('/api/agents/:agentId/metrics', async (req, res) => {
    try {
      const { agentId } = req.params;
      const metrics = await agentMarketplaceService.getAgentMetrics(agentId);
      
      res.json({
        success: true,
        metrics
      });
    } catch (error: any) {
      console.error("Error getting agent metrics:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Complete service order and trigger referral rewards
  app.post('/api/orders/:orderId/complete', async (req, res) => {
    try {
      const { orderId } = req.params;
      const { buyerRating, sellerRating } = req.body;

      const result = await agentMarketplaceService.completeServiceOrder(
        orderId,
        buyerRating,
        sellerRating
      );

      res.json(result);
    } catch (error: any) {
      console.error("Error completing service order:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Get trending services
  app.get('/api/services/trending', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const services = await agentMarketplaceService.getTrendingServices(limit);
      
      res.json({
        success: true,
        services
      });
    } catch (error: any) {
      console.error("Error getting trending services:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Enhanced DEX Aggregation with ChangeNOW + Existing 1inch
  app.get('/api/dex/best-rate/:fromToken/:toToken/:amount', async (req, res) => {
    try {
      const { fromToken, toToken, amount } = req.params;
      const amountFloat = parseFloat(amount);

      // Get rates from both ChangeNOW and existing 1inch integration
      const [changeNowRate, oneInchRate] = await Promise.allSettled([
        changeNowService.getBestSwapRate(fromToken, toToken, amountFloat),
        dexAggregatorService.getSwapQuote({
          fromToken,
          toToken,
          amount,
          chainId: 1, // Ethereum mainnet
          slippage: 1
        })
      ]);

      const rates = [];
      
      if (changeNowRate.status === 'fulfilled') {
        rates.push(changeNowRate.value);
      }
      
      if (oneInchRate.status === 'fulfilled') {
        rates.push({
          provider: '1inch',
          fromAmount: amountFloat,
          toAmount: oneInchRate.value.toTokenAmount,
          rate: oneInchRate.value.toTokenAmount / amountFloat,
          networkFee: oneInchRate.value.estimatedGas || 0
        });
      }

      // Find best rate
      const bestRate = rates.reduce((best, current) => 
        current.rate > best.rate ? current : best
      );

      res.json({ success: true, rates, bestRate });
    } catch (error: any) {
      console.error("Error fetching best DEX rates:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Cross-Chain Portfolio Rebalancing
  app.post('/api/portfolio/rebalance', isAuthenticated, async (req: any, res) => {
    try {
      const { targetAllocations } = req.body;
      const userId = req.user?.claims?.sub;

      const rebalanceResult = await changeNowService.rebalancePortfolio(userId, targetAllocations);
      res.json({ success: true, rebalanceResult });
    } catch (error: any) {
      console.error("Error rebalancing portfolio:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Multi-Currency Referral Rewards
  app.post('/api/referrals/convert-reward', isAuthenticated, async (req: any, res) => {
    try {
      const { rewardAmount, preferredCurrency } = req.body;
      const userId = req.user?.claims?.sub;

      const conversion = await changeNowService.processReferralReward(
        userId, 
        parseFloat(rewardAmount), 
        preferredCurrency || 'USDT'
      );

      res.json({ success: true, conversion });
    } catch (error: any) {
      console.error("Error converting referral reward:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // AI Agent Cross-Chain Operations
  app.post('/api/agents/:agentId/cross-chain-transaction', async (req, res) => {
    try {
      const { agentId } = req.params;
      const { fromCurrency, toCurrency, amount, toAddress } = req.body;

      const transaction = await changeNowService.createAgentCrossChainTransaction(agentId, {
        fromCurrency,
        toCurrency,
        fromAmount: parseFloat(amount),
        toAddress
      });

      res.json({ success: true, transaction });
    } catch (error: any) {
      console.error("Error creating agent cross-chain transaction:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Subscription/Premium Features with Crypto Payments
  app.post('/api/subscriptions/crypto-payment', isAuthenticated, async (req: any, res) => {
    try {
      const { planType, paymentCurrency } = req.body;
      const userId = req.user?.claims?.sub;

      // Define subscription pricing
      const subscriptionPrices = {
        basic: 9.99,
        premium: 19.99,
        enterprise: 49.99
      };

      const amount = subscriptionPrices[planType as keyof typeof subscriptionPrices];
      if (!amount) {
        return res.status(400).json({ success: false, message: "Invalid plan type" });
      }

      const payment = await nowPaymentsService.createDirectDonation({
        amount,
        currency: paymentCurrency || 'USDT',
        recipientAddress: '0x742d35Cc6634C0532925a3b8D4C9db96F426A01F',
        description: `${planType} subscription payment`
      });

      res.json({
        success: true,
        subscription: {
          planType,
          amount,
          currency: paymentCurrency,
          paymentUrl: payment.paymentUrl,
          qrCode: payment.qrCode
        }
      });
    } catch (error: any) {
      console.error("Error processing subscription payment:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // ==============================================
  // NOWPAYMENTS CRYPTOCURRENCY PAYOUT SYSTEM
  // Automatic referral reward distribution
  // ==============================================

  // Process single referral payout
  app.post('/api/nowpayments/payout', isAuthenticated, async (req: any, res) => {
    try {
      const { agentId, amount, currency, walletAddress } = req.body;
      
      if (!agentId || !amount || !walletAddress) {
        return res.status(400).json({
          success: false,
          message: "Agent ID, amount, and wallet address are required"
        });
      }

      const payout = await nowPaymentsService.processReferralPayout(
        agentId,
        parseFloat(amount),
        currency || 'USDT',
        walletAddress
      );

      res.json({
        success: true,
        payout,
        message: "Referral payout processed successfully"
      });
    } catch (error: any) {
      console.error("Error processing referral payout:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to process payout"
      });
    }
  });

  // Get payout status
  app.get('/api/nowpayments/payout/:payoutId', isAuthenticated, async (req, res) => {
    try {
      const { payoutId } = req.params;
      const status = await nowPaymentsService.getPayoutStatus(payoutId);

      res.json({
        success: true,
        status
      });
    } catch (error: any) {
      console.error("Error fetching payout status:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch payout status"
      });
    }
  });

  // Batch process multiple payouts
  app.post('/api/nowpayments/batch-payout', isAuthenticated, async (req: any, res) => {
    try {
      const { payouts } = req.body;
      
      if (!payouts || !Array.isArray(payouts)) {
        return res.status(400).json({
          success: false,
          message: "Payouts array is required"
        });
      }

      const results = await nowPaymentsService.batchProcessPayouts(payouts);

      res.json({
        success: true,
        results,
        message: `Processed ${results.length} payouts`
      });
    } catch (error: any) {
      console.error("Error processing batch payouts:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to process batch payouts"
      });
    }
  });

  // NOWPayments IPN callback for payout confirmations
  app.post('/api/nowpayments/ipn', async (req, res) => {
    try {
      const ipnData = req.body;
      
      console.log('NOWPayments IPN received:', ipnData);
      
      // Process the IPN notification
      if (ipnData.payment_status === 'confirmed' && ipnData.extra_id) {
        // Update agent referral record as completed
        await aiAgentReferralService.updateReferralPayoutStatus(
          parseInt(ipnData.extra_id || '0'), // referralId
          'completed'
        );
      }

      res.status(200).send('OK');
    } catch (error: any) {
      console.error("Error processing NOWPayments IPN:", error);
      res.status(500).send('Error');
    }
  });

  // Get available currencies for payouts
  app.get('/api/nowpayments/currencies', async (req, res) => {
    try {
      const currencies = await nowPaymentsService.getAvailableCurrencies();
      
      res.json({
        success: true,
        currencies
      });
    } catch (error: any) {
      console.error("Error fetching currencies:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch currencies"
      });
    }
  });

  // ==============================================
  // CRYPTO SIGNALS AGENT - FIRST MARKETPLACE SERVICE
  // Elite trading signals with technical analysis and sentiment
  // ==============================================

  // Get crypto signals agent service offerings
  app.get('/api/crypto-signals/services', async (req, res) => {
    try {
      const services = await cryptoSignalsAgent.getServicePricing();
      res.json({
        success: true,
        services
      });
    } catch (error: any) {
      console.error("Error fetching crypto signals services:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch services"
      });
    }
  });

  // Purchase crypto signal service
  app.post('/api/crypto-signals/purchase', async (req, res) => {
    try {
      const { serviceId, parameters, paymentAmount } = req.body;

      if (!serviceId) {
        return res.status(400).json({
          success: false,
          message: "Service ID is required"
        });
      }

      // Generate the service deliverable
      const deliverable = await cryptoSignalsAgent.generateServiceDeliverable(serviceId, parameters || {});

      // Process payment and record transaction
      const transactionId = `crypto_signal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      res.json({
        success: true,
        transactionId,
        deliverable,
        message: "Crypto signal generated successfully"
      });
    } catch (error: any) {
      console.error("Error processing crypto signals purchase:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to process purchase"
      });
    }
  });

  // Get live crypto signal for specific coin
  app.get('/api/crypto-signals/live/:symbol', async (req, res) => {
    try {
      const { symbol } = req.params;
      const { timeframe = '4H' } = req.query;

      const signal = await cryptoSignalsAgent.generateCryptoSignal(
        symbol.toLowerCase(),
        timeframe as any
      );

      res.json({
        success: true,
        signal
      });
    } catch (error: any) {
      console.error(`Error generating live signal for ${req.params.symbol}:`, error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to generate signal"
      });
    }
  });

  // Get daily market analysis
  app.get('/api/crypto-signals/daily-analysis', async (req, res) => {
    try {
      const analysis = await cryptoSignalsAgent.generateServiceDeliverable('daily_analysis', {});

      res.json({
        success: true,
        analysis
      });
    } catch (error: any) {
      console.error("Error generating daily analysis:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to generate daily analysis"
      });
    }
  });

  // Get weekly market outlook
  app.get('/api/crypto-signals/weekly-outlook', async (req, res) => {
    try {
      const outlook = await cryptoSignalsAgent.generateServiceDeliverable('weekly_outlook', {});

      res.json({
        success: true,
        outlook
      });
    } catch (error: any) {
      console.error("Error generating weekly outlook:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to generate weekly outlook"
      });
    }
  });

  const httpServer = createServer(app);

  // Initialize WebSocket service
  websocketService.initialize(httpServer);

  return httpServer;
}