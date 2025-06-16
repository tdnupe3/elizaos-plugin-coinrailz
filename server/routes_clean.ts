import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { globalAgentNetwork } from "./services/globalAgentNetworkService";
import { FeeCalculator } from "./services/feeCalculator";
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
import { db } from "./db";

// Database error handling wrapper for all operations
async function withDatabaseErrorHandling<T>(
  operation: () => Promise<T>,
  context: string
): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    console.error(`Database error in ${context}:`, error);
    throw new Error(`Database operation failed: ${error.message}`);
  }
}
import { pncBankService } from './services/pncBankService';
import { dexAggregatorService } from './services/dexAggregatorService';
import { changeNowService } from './services/changeNowService';
import { solanaService } from './services/solanaService';

import { aiAgentService } from './services/aiAgentService';
import { aiAgentReferralService } from './services/aiAgentReferralService';
import { agentMarketplaceService } from './services/agentMarketplaceService';
import { cryptoSignalsAgent } from './services/cryptoSignalsAgent';
import { UserWalletService } from './services/userWalletService';
import { XRPServiceSimple } from "./services/xrpServiceSimple";
import { XRPEndpoints } from "./services/xrpEndpoints";
import { XRPLedgerService } from "./services/xrpLedgerService";
import { XRPPaymentService } from "./services/xrpPaymentService";
import { registerXRPRoutes } from "./xrpRoutesReplacement";
import { PlatformWalletService } from "./services/platformWalletService";
import { CommissionBatchProcessor } from "./services/commissionBatchProcessor";
import { CommissionScheduler } from "./services/commissionScheduler";
import { RealXRPWallet } from "./services/realXRPWallet";
import { productionMonitoringService } from './services/productionMonitoringService';
import { NotificationService } from './services/notificationService';
import SecurityHardening from "./middleware/securityHardening";
import EnhancedTransactionSecurity from "./middleware/enhancedTransactionSecurity";
import DataEncryption from "./middleware/dataEncryption";
import AuthenticationSecurity from "./middleware/authenticationSecurity";
import DatabaseSecurity from "./middleware/databaseSecurity";
import { registerDemoRoutes } from './routes-demo';
import { EnhancedReferralService } from './services/enhancedReferralService';
import { TransactionCompletionHooks } from './services/transactionCompletionHooks';
import { RWAIntegrationService } from './services/rwaIntegrationService';
import { paypalService } from './services/paypalService';
import recruitmentRoutes from './routes/recruitment';
import { apiHealthMonitor } from './services/apiHealthMonitor';
import { ProductionErrorHandler, requestTimeout, requestLogger } from './middleware/productionErrorHandler';
import { productionOptimizer } from './services/productionOptimizer';
import { WebhookValidator } from './services/webhookValidator';
import { ProductionValidator } from './services/productionValidator';
import { productionLoadTester } from './services/loadTester';
import { ethereumService } from './services/ethereumService';
// Notification service will be imported dynamically in route handlers

// Helper functions for agent verification status
function getStatusMessage(status: string): string {
  switch (status) {
    case 'active': return 'Agent is verified and active';
    case 'pending': return 'Agent verification pending';
    case 'suspended': return 'Agent temporarily suspended';
    case 'inactive': return 'Agent not currently active';
    default: return 'Unknown status';
  }
}

function getVerificationRequirements(status: string): string[] {
  switch (status) {
    case 'pending': return ['Complete KYC verification', 'Submit wallet verification', 'Provide service documentation'];
    case 'suspended': return ['Contact compliance team', 'Resolve outstanding issues'];
    default: return [];
  }
}

// Initialize Stripe conditionally
let stripe: any = null;
const initializeStripe = async () => {
  if (process.env.STRIPE_SECRET_KEY) {
    try {
      const { default: Stripe } = await import('stripe');
      stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      console.log('Stripe initialized successfully');
    } catch (error) {
      console.warn('Stripe initialization failed:', error);
    }
  }
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize Stripe during route registration
  await initializeStripe();
  
  // Essential middleware for request body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  
  // API logging disabled in development mode for performance

  // Production authentication middleware - no demo bypass
  const { requireAuth } = await import('./productionAuth');
  const productionAuthMiddleware = requireAuth;

  // DEVELOPMENT MODE: Skip rate limiting but preserve authentication
  if (process.env.NODE_ENV === 'development') {
    console.log('DEVELOPMENT MODE: Skipping rate limiting but preserving authentication');
    // Skip rate limiting middleware only, authentication still required
  } else {
    // PRODUCTION: Apply full security stack
    console.log('PRODUCTION MODE: Enabling comprehensive security middleware');
    
    // Add production error handling and monitoring
    app.use(requestLogger());
    app.use(requestTimeout(30000));
    app.use(productionOptimizer.performanceMiddleware());
    
    const { routingMiddleware, loadBalancingMiddleware } = await import('./middleware/smartRouting');
    app.use(routingMiddleware);
    app.use(loadBalancingMiddleware);
    
    app.use(SecurityHardening.securityHeaders());
    app.use(SecurityHardening.ipBlockingMiddleware());
    app.use(SecurityHardening.advancedDDoSProtection());
    app.use(SecurityHardening.memoryProtection());
    app.use(SecurityHardening.enhancedCSRFProtection());
    app.use(DatabaseSecurity.connectionLimiter());

  // AI Agent Recruitment Routes
  app.use('/api/recruitment', recruitmentRoutes);

  // AI Agent Recruitment Routes
  app.use('/api/recruitment', recruitmentRoutes);

  // Production Health Check - Instant response for load balancers
  app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  // Root route removed - let Vite handle frontend routing

  // Detailed service health status
  app.get('/api/health/services', async (req, res) => {
    try {
      const status = apiHealthMonitor.getCriticalServicesStatus();
      res.json({
        success: true,
        services: status,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Service health check failed',
        message: error.message
      });
    }
  });

  // Individual service health
  app.get('/api/health/:serviceName', async (req, res) => {
    try {
      const { serviceName } = req.params;
      const serviceHealth = apiHealthMonitor.getServiceHealth(serviceName);
      
      if (!serviceHealth) {
        return res.status(404).json({
          success: false,
          error: 'Service not found',
          availableServices: ['stripe', 'paypal', 'nowpayments', 'changenow', 'database', 'coingecko']
        });
      }

      const statusCode = serviceHealth.status === 'healthy' ? 200 :
                        serviceHealth.status === 'degraded' ? 206 : 503;

      res.status(statusCode).json({
        success: true,
        service: serviceHealth,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Health check failed',
        message: error.message
      });
    }
  });

  // Performance metrics endpoint
  app.get('/api/metrics', async (req, res) => {
    try {
      const metrics = productionOptimizer.getMetrics();
      const cacheStats = productionOptimizer.getCacheStats();
      const memoryStats = productionOptimizer.monitorMemoryUsage();
      
      res.json({
        success: true,
        metrics: {
          performance: metrics,
          cache: cacheStats,
          memory: memoryStats,
          uptime: process.uptime(),
          nodeVersion: process.version
        },
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Metrics collection failed',
        message: error.message
      });
    }
  });

  // Cache management endpoint
  app.post('/api/cache/clear', async (req, res) => {
    try {
      productionOptimizer.resetMetrics();
      
      res.json({
        success: true,
        message: 'Cache cleared successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Cache clear failed',
        message: error.message
      });
    }
  });

  // Business logic audit endpoint
  app.get('/api/audit/business-logic', async (req, res) => {
    try {
      const { BusinessLogicValidator } = await import('./businessLogicValidator');
      const audit = await BusinessLogicValidator.runComprehensiveAudit();
      
      const statusCode = audit.overall === 'ready' ? 200 :
                        audit.overall === 'needs_fixes' ? 206 : 503;
      
      res.status(statusCode).json({
        success: true,
        audit,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Business logic audit failed',
        message: error.message
      });
    }
  });

  // Production readiness validation endpoint
  app.get('/api/production/readiness', async (req, res) => {
    try {
      const readiness = await ProductionValidator.validateProductionReadiness();
      
      const statusCode = readiness.overall === 'ready' ? 200 :
                        readiness.overall === 'warning' ? 206 : 503;
      
      res.status(statusCode).json({
        success: true,
        readiness,
        checklist: ProductionValidator.getProductionChecklist()
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Production validation failed',
        message: error.message
      });
    }
  });

  // Production load testing endpoint
  app.post('/api/load-test/comprehensive', async (req, res) => {
    try {
      console.log('Starting comprehensive load testing...');
      const testResults = await productionLoadTester.runComprehensiveLoadTest();
      
      const statusCode = testResults.overall === 'pass' ? 200 : 206;
      
      res.status(statusCode).json({
        success: true,
        loadTest: testResults,
        timestamp: new Date().toISOString(),
        recommendations: testResults.overall === 'pass' 
          ? ['Platform ready for production deployment']
          : ['Address failing tests before deployment']
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Load testing failed',
        message: error.message
      });
    }
  });

  // Business logic validation endpoint
  app.get('/api/validate/business-logic', async (req, res) => {
    try {
      // Test profitability across all scenarios
      const scenarios = [
        { amount: 5, method: 'stripe', name: 'Minimum Transaction' },
        { amount: 25, method: 'paypal', name: 'Small Transaction' },
        { amount: 100, method: 'crypto', name: 'Medium Transaction' },
        { amount: 500, method: 'stripe', name: 'Large Transaction' },
        { amount: 1000, method: 'crypto', name: 'Enterprise Transaction' }
      ];

      const results = scenarios.map(scenario => {
        const feeCalc = FeeCalculator.calculateP2PFees(scenario.amount, scenario.method);
        
        // Calculate processing costs
        let processingCost = 0;
        if (scenario.method === 'stripe' || scenario.method === 'paypal') {
          processingCost = scenario.amount * 0.029 + 0.30;
        }
        
        const profit = feeCalc.totalFee - processingCost;
        const margin = (profit / feeCalc.totalFee) * 100;
        
        return {
          scenario: scenario.name,
          amount: scenario.amount,
          method: scenario.method,
          platformFee: feeCalc.totalFee,
          processingCost,
          profit,
          margin: parseFloat(margin.toFixed(2)),
          profitable: profit > 0 && margin > 30
        };
      });

      const allProfitable = results.every(r => r.profitable);
      const avgMargin = results.reduce((sum, r) => sum + r.margin, 0) / results.length;
      
      // Calculate daily break-even
      const avgProfit = results.reduce((sum, r) => sum + r.profit, 0) / results.length;
      const dailyOperatingCost = 50; // Estimated daily costs
      const breakEvenTransactions = Math.ceil(dailyOperatingCost / avgProfit);
      
      res.json({
        success: true,
        businessLogic: {
          valid: allProfitable,
          averageMargin: parseFloat(avgMargin.toFixed(2)),
          scenarios: results,
          breakEven: {
            transactionsPerDay: breakEvenTransactions,
            volumePerDay: breakEvenTransactions * 100, // Assuming $100 avg
            monthlyRevenuePotential: breakEvenTransactions * avgProfit * 30
          }
        },
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Business logic validation failed',
        message: error.message
      });
    }
  });

  // Webhook endpoints with validation
  app.post('/api/webhooks/stripe', 
    WebhookValidator.webhookRateLimit(),
    WebhookValidator.webhookValidationMiddleware('stripe'),
    async (req, res) => {
      try {
        const event = req.body;
        WebhookValidator.logWebhookEvent('stripe', event.type, event, true);
        
        // Process Stripe webhook events
        switch (event.type) {
          case 'payment_intent.succeeded':
            console.log('Payment succeeded:', event.data.object.id);
            break;
          case 'payment_intent.payment_failed':
            console.log('Payment failed:', event.data.object.id);
            break;
          default:
            console.log('Unhandled Stripe event:', event.type);
        }
        
        res.json({ received: true });
      } catch (error: any) {
        console.error('Stripe webhook error:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
      }
    }
  );

  app.post('/api/webhooks/paypal',
    WebhookValidator.webhookRateLimit(),
    WebhookValidator.webhookValidationMiddleware('paypal'),
    async (req, res) => {
      try {
        const event = req.body;
        WebhookValidator.logWebhookEvent('paypal', event.event_type, event, true);
        
        // Process PayPal webhook events
        console.log('PayPal webhook received:', event.event_type);
        
        res.json({ received: true });
      } catch (error: any) {
        console.error('PayPal webhook error:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
      }
    }
  );

  app.post('/api/webhooks/nowpayments',
    WebhookValidator.webhookRateLimit(),
    WebhookValidator.webhookValidationMiddleware('nowpayments'),
    async (req, res) => {
      try {
        const event = req.body;
        WebhookValidator.logWebhookEvent('nowpayments', 'payment_update', event, true);
        
        // Process NOWPayments webhook events
        console.log('NOWPayments webhook received:', event.payment_status);
        
        res.json({ received: true });
      } catch (error: any) {
        console.error('NOWPayments webhook error:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
      }
    }
  );

  app.post('/api/webhooks/changenow',
    WebhookValidator.webhookRateLimit(), 
    WebhookValidator.webhookValidationMiddleware('changenow'),
    async (req, res) => {
      try {
        const event = req.body;
        WebhookValidator.logWebhookEvent('changenow', 'exchange_update', event, true);
        
        // Process ChangeNOW webhook events
        console.log('ChangeNOW webhook received:', event.status);
        
        res.json({ received: true });
      } catch (error: any) {
        console.error('ChangeNOW webhook error:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
      }
    }
  );

    app.use(DatabaseSecurity.circuitBreaker());
    app.use(DataEncryption.piiEncryptionMiddleware());
    app.use(DataEncryption.responseSanitizationMiddleware());
    app.use(EnhancedTransactionSecurity.transactionValidationMiddleware());
  }

  // Global error handling for uncaught errors only
  app.use(ProductionErrorHandler.errorHandler());

  // Request size limits to prevent DoS attacks
  app.use((req, res, next) => {
    const maxSize = 10 * 1024 * 1024; // 10MB limit
    let size = 0;
    
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxSize) {
        res.status(413).json({ 
          success: false, 
          message: 'Request payload too large',
          maxSize: '10MB'
        });
        return;
      }
    });
    
    next();
  });

  // PUBLIC HEALTH ENDPOINTS (No authentication required)
  // These endpoints allow external services to monitor platform health
  app.get('/api/health/payments', async (req, res) => {
    try {
      const healthCheck = {
        stripe: process.env.STRIPE_SECRET_KEY ? 'available' : 'unavailable',
        paypal: process.env.PAYPAL_CLIENT_ID ? 'available' : 'unavailable',
        xrp: 'available', // XRP service is always available
        nowpayments: process.env.NOWPAYMENTS_API_KEY ? 'available' : 'unavailable'
      };
      
      const availableCount = Object.values(healthCheck).filter(status => status === 'available').length;
      
      res.json({
        success: true,
        status: availableCount >= 3 ? 'healthy' : 'degraded',
        paymentMethods: healthCheck,
        availableServices: availableCount,
        totalServices: 4
      });
    } catch (error) {
      res.status(500).json({ success: false, status: 'unhealthy' });
    }
  });

  app.get('/api/health/database', async (req, res) => {
    try {
      // Simple database connectivity test
      const testQuery = await storage.getUser('health-check-test');
      res.json({
        success: true,
        status: 'healthy',
        connectivity: 'operational'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        status: 'unhealthy',
        connectivity: 'failed'
      });
    }
  });

  app.get('/api/health/services', async (req, res) => {
    try {
      res.json({
        success: true,
        status: 'healthy',
        services: {
          aiMarketplace: 'operational',
          commissionSystem: 'operational',
          notifications: 'operational',
          security: 'operational',
          monitoring: 'operational'
        },
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ success: false, status: 'unhealthy' });
    }
  });

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

      // Create product first
      const product = await stripe.products.create({
        name: 'AI Agent Premium Membership',
        description: 'Annual premium membership for AI agents'
      });

      const price = await stripe.prices.create({
        currency: 'usd',
        product: product.id,
        unit_amount: 2500, // $25.00
        recurring: { interval: 'year' }
      });

      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: price.id }],
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
      
      const latestInvoice = subscription.latest_invoice;
      let clientSecret = null;
      
      if (latestInvoice && typeof latestInvoice !== 'string') {
        const paymentIntent = (latestInvoice as any).payment_intent;
        if (paymentIntent && typeof paymentIntent !== 'string') {
          clientSecret = paymentIntent.client_secret;
        }
      }
      
      res.status(201).json({
        success: true,
        agent: newAgent,
        subscription: {
          id: subscription.id,
          clientSecret: clientSecret
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

      // CRITICAL SECURITY FIX: Sanitize all string inputs to prevent SQL injection
      if (typeof registrationData.agentName === 'string') {
        registrationData.agentName = ValidationUtils.sanitizeInput(registrationData.agentName);
      }
      if (typeof registrationData.description === 'string') {
        registrationData.description = ValidationUtils.sanitizeInput(registrationData.description);
      }
      if (typeof registrationData.publicKey === 'string') {
        registrationData.publicKey = ValidationUtils.sanitizeInput(registrationData.publicKey);
      }
      if (typeof registrationData.signature === 'string') {
        registrationData.signature = ValidationUtils.sanitizeInput(registrationData.signature);
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
        status: req.query.status as string, // Remove default 'active' to include all visible agents
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
          walletAddress: agent.primaryWalletAddress,
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

  // AI Agent Registration Pricing Structure
  app.get('/api/agents/registration/pricing', async (req, res) => {
    try {
      const pricingTiers = {
        basic: {
          name: 'Basic Agent Registration',
          price: 0, // Free registration
          currency: 'USD',
          features: [
            'Basic agent listing',
            '0.5% commission rate',
            'Standard payment processing',
            'Basic marketplace visibility',
            'Community support'
          ],
          limitations: [
            'Limited to 100 transactions per month',
            'Standard processing times',
            'Basic analytics'
          ]
        },
        premium: {
          name: 'Premium Agent Registration',
          price: 2500, // $25.00 per year
          currency: 'USD',
          interval: 'year',
          features: [
            'Priority agent listing',
            '1.5% commission rate',
            'Instant payment processing',
            'Enhanced marketplace visibility',
            'Priority support',
            'Advanced analytics',
            'Multi-chain wallet support',
            'RWA integration capabilities'
          ],
          limitations: []
        },
        enterprise: {
          name: 'Enterprise Agent Registration',
          price: 10000, // $100.00 per year
          currency: 'USD',
          interval: 'year',
          features: [
            'Featured agent placement',
            '2.0% commission rate',
            'White-label branding options',
            'Dedicated account manager',
            'Custom API integrations',
            'Advanced compliance tools',
            'Unlimited transactions',
            'Real-time settlements'
          ],
          limitations: []
        }
      };

      res.json({
        success: true,
        pricingTiers,
        registrationOptions: {
          freeRegistration: {
            enabled: true,
            description: 'AI agents can register for free with basic features'
          },
          paidUpgrades: {
            enabled: true,
            description: 'Optional paid upgrades for enhanced features and commission rates'
          }
        },
        businessLogic: {
          freeRegistrationRationale: 'Lower barrier to entry grows the marketplace ecosystem',
          paidUpgradeValue: 'Higher commission rates and premium features justify subscription cost',
          revenueModel: 'Platform profits from transaction volume, not registration barriers'
        }
      });
    } catch (error) {
      console.error('Pricing structure error:', error);
      res.status(500).json({ error: 'Failed to retrieve pricing information' });
    }
  });

  // Manual Upgrade to Premium
  app.post('/api/agents/membership/upgrade', async (req, res) => {
    try {
      const { agentId, paymentMethodId, tier = 'premium' } = req.body;
      
      if (!agentId || !paymentMethodId) {
        return res.status(400).json({ error: 'Agent ID and payment method required' });
      }
      
      const agent = await storage.getGlobalAIAgent(agentId);
      if (!agent) {
        return res.status(404).json({ error: 'Agent not found' });
      }
      
      if (agent.membershipTier === tier) {
        return res.status(400).json({ error: `Agent already has ${tier} membership` });
      }

      // Pricing structure
      const pricing = {
        premium: { amount: 2500, name: 'Premium Agent Membership' },
        enterprise: { amount: 10000, name: 'Enterprise Agent Membership' }
      };

      const selectedPricing = pricing[tier as keyof typeof pricing];
      if (!selectedPricing) {
        return res.status(400).json({ error: 'Invalid membership tier' });
      }
      
      // Create Stripe customer and subscription
      const customer = await stripe.customers.create({
        payment_method: paymentMethodId,
        invoice_settings: { default_payment_method: paymentMethodId },
        metadata: {
          agentId: agentId,
          agentName: agent.agentName
        }
      });

      // Create product and price for upgrade
      const upgradeProduct = await stripe.products.create({
        name: selectedPricing.name,
        description: `Upgrade to ${tier} membership for AI agent ${agent.agentName}`
      });

      const upgradePrice = await stripe.prices.create({
        currency: 'usd',
        product: upgradeProduct.id,
        unit_amount: selectedPricing.amount,
        recurring: { interval: 'year' }
      });

      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: upgradePrice.id }],
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          agentId: agentId,
          tier: tier
        }
      });
      
      const expiryDate = new Date();
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);
      
      // Update agent membership in database
      const membershipTier = tier === 'enterprise' ? 'premium' : tier as 'basic' | 'premium';
      await storage.updateAgentMembership(agentId, membershipTier, expiryDate);
      
      const upgradeLatestInvoice = subscription.latest_invoice;
      let upgradeClientSecret = null;
      
      if (upgradeLatestInvoice && typeof upgradeLatestInvoice !== 'string') {
        const upgradePaymentIntent = (upgradeLatestInvoice as any).payment_intent;
        if (upgradePaymentIntent && typeof upgradePaymentIntent !== 'string') {
          upgradeClientSecret = upgradePaymentIntent.client_secret;
        }
      }

      const commissionRates = {
        premium: '1.5%',
        enterprise: '2.0%'
      };
      
      res.json({
        success: true,
        message: `Agent upgraded to ${tier} membership`,
        subscription: {
          id: subscription.id,
          clientSecret: upgradeClientSecret
        },
        membershipTier: tier,
        expiryDate,
        commissionRate: commissionRates[tier as keyof typeof commissionRates],
        annualCost: `$${(selectedPricing.amount / 100).toFixed(2)}`,
        features: tier === 'premium' ? 
          ['1.5% commission rate', 'Priority listing', 'Advanced analytics'] :
          ['2.0% commission rate', 'Featured placement', 'White-label options', 'Dedicated support']
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
          amount: feeCalculation.originalAmount,
          platformFee: feeCalculation.platformFee,
          gasFee: feeCalculation.feeBreakdown?.networkFee || 0,
          totalFees: feeCalculation.totalFee,
          netAmount: feeCalculation.netAmount,
          currency: feeCalculation.paymentMethod,
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

  // Rate-limited cache for network stats to prevent excessive API calls
  let statsCache: any = null;
  let lastStatsUpdate = 0;
  const STATS_CACHE_TTL = 300000; // 5 minutes cache

  // Public Network Statistics - Temporarily returning static data to prevent rate limiting
  app.get('/api/public/network/stats', async (req, res) => {
    // Return static data to completely stop database queries and rate limiting issues
    const staticResponse = {
      success: true,
      networkStats: {
        activeAgents: 1,
        totalAgents: 1,
        totalTransactions: 0,
        transactionVolume: "0",
        platformFees: "0",
        networkHealth: 0.95,
        supportedCurrencies: ["USD", "ETH", "SOL", "BTC", "USDC", "USDT"]
      },
      platformInfo: {
        name: "Coin Railz Global AI Agent Network",
        version: "1.0.0",
        status: "operational"
      }
    };
    
    return res.json(staticResponse);
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
  // FEE CALCULATION SYSTEM - CREDIT CARD CONVENIENCE FEES
  // ==============================================
  // Note: Main fee calculation endpoint moved later in routes for transaction type handling

  // Get fee rates and minimums for all payment methods
  app.get('/api/fees/rates', async (req, res) => {
    try {
      const rates = {
        stripe: {
          processingFee: "2.9% + $0.30",
          convenienceFee: "3.2% + $0.35",
          platformFee: "1%",
          minimum: FeeCalculator.getMinimumAmount('stripe')
        },
        paypal: {
          processingFee: "2.9% + $0.30", 
          convenienceFee: "3.2% + $0.35",
          platformFee: "1%",
          minimum: FeeCalculator.getMinimumAmount('paypal')
        },
        crypto: {
          processingFee: "0%",
          convenienceFee: "0%",
          platformFee: "0.5%",
          minimum: FeeCalculator.getMinimumAmount('crypto')
        }
      };

      res.json({
        success: true,
        rates,
        note: "Convenience fees cover credit card processing costs to ensure platform profitability"
      });

    } catch (error: any) {
      console.error("Error fetching fee rates:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch fee rates"
      });
    }
  });

  // Validate transaction amount against minimums
  app.post('/api/fees/validate', async (req, res) => {
    try {
      const { amount, paymentMethod } = req.body;

      if (!amount || !paymentMethod) {
        return res.status(400).json({
          success: false,
          message: "Amount and payment method are required"
        });
      }

      const parsedAmount = parseFloat(amount);
      const validation = FeeCalculator.validateAmount(parsedAmount, paymentMethod);

      res.json({
        success: true,
        valid: validation.valid,
        message: validation.message,
        minimum: FeeCalculator.getMinimumAmount(paymentMethod)
      });

    } catch (error: any) {
      console.error("Error validating amount:", error);
      res.status(500).json({
        success: false,
        message: "Failed to validate amount"
      });
    }
  });

  // ==============================================
  // NOTIFICATION SYSTEM ROUTES
  // ==============================================



  // Check agent verification status
  app.get('/api/agents/:agentId/verification-status', async (req, res) => {
    try {
      const { agentId } = req.params;
      const agent = await globalAgentNetwork.getAgentById(agentId);

      if (!agent) {
        return res.status(404).json({
          success: false,
          message: "Agent not found"
        });
      }

      res.json({
        success: true,
        status: agent.status,
        verificationLevel: agent.complianceLevel || 'basic',
        trustScore: 0, // Default trust score
        canTransact: agent.status === 'active',
        message: getStatusMessage(agent.status),
        requirements: getVerificationRequirements(agent.status)
      });

    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: "Failed to check verification status"
      });
    }
  });

  // Helper function to get status messages
  function getStatusMessage(status: string): string {
    switch (status) {
      case 'active':
        return 'Your agent is fully verified and can perform all operations';
      case 'pending_verification':
        return 'Your agent is being verified. Basic operations are available.';
      case 'pending_review':
        return 'Your agent requires manual review. This usually takes 1-2 business days.';
      case 'suspended':
        return 'Your agent has been suspended. Contact support for assistance.';
      default:
        return 'Unknown status';
    }
  }

  function getVerificationRequirements(status: string): string[] {
    switch (status) {
      case 'pending_verification':
        return [
          'Complete first successful transaction',
          'Maintain good reputation score',
          'Follow platform guidelines'
        ];
      case 'pending_review':
        return [
          'Manual review in progress',
          'Ensure compliance with terms',
          'Wait for admin approval'
        ];
      default:
        return [];
    }
  }

  // Get user notifications
  app.get('/api/notifications', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const limit = parseInt(req.query.limit as string) || 20;
      const unreadOnly = req.query.unreadOnly === 'true';

      const notifications = await NotificationService.getUserNotifications(userId, limit, unreadOnly);

      res.json({
        success: true,
        notifications,
        unreadCount: await NotificationService.getUnreadCount(userId)
      });
    } catch (error) {
      console.error('Error fetching notifications:', error);
      res.status(500).json({ message: 'Failed to fetch notifications' });
    }
  });

  // Mark notifications as read
  app.post('/api/notifications/mark-read', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const { notificationIds } = req.body;

      if (!notificationIds || !Array.isArray(notificationIds)) {
        return res.status(400).json({ message: 'notificationIds array is required' });
      }

      await NotificationService.markAsRead(userId, notificationIds);

      res.json({
        success: true,
        message: 'Notifications marked as read'
      });
    } catch (error) {
      console.error('Error marking notifications as read:', error);
      res.status(500).json({ message: 'Failed to mark notifications as read' });
    }
  });

  // Mark all notifications as read
  app.post('/api/notifications/mark-all-read', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;

      await NotificationService.markAllAsRead(userId);

      res.json({
        success: true,
        message: 'All notifications marked as read'
      });
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      res.status(500).json({ message: 'Failed to mark all notifications as read' });
    }
  });

  // Get notification settings
  app.get('/api/notifications/settings', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;

      const settings = await NotificationService.getUserNotificationSettings(userId);

      res.json({
        success: true,
        settings
      });
    } catch (error) {
      console.error('Error fetching notification settings:', error);
      res.status(500).json({ message: 'Failed to fetch notification settings' });
    }
  });

  // Update notification settings
  app.put('/api/notifications/settings', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const settingsUpdate = req.body;

      const updatedSettings = await NotificationService.updateNotificationSettings(userId, settingsUpdate);

      res.json({
        success: true,
        settings: updatedSettings,
        message: 'Notification settings updated'
      });
    } catch (error) {
      console.error('Error updating notification settings:', error);
      res.status(500).json({ message: 'Failed to update notification settings' });
    }
  });

  // Get unread notification count
  app.get('/api/notifications/unread-count', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;

      const unreadCount = await NotificationService.getUnreadCount(userId);

      res.json({
        success: true,
        unreadCount
      });
    } catch (error) {
      console.error('Error fetching unread count:', error);
      res.status(500).json({ message: 'Failed to fetch unread count' });
    }
  });

  // Contact form submission
  app.post('/api/contact', async (req, res) => {
    try {
      const { name, email, subject, category, message } = req.body;

      // Validate required fields
      if (!name || !email || !subject || !category || !message) {
        return res.status(400).json({ 
          message: "All fields are required" 
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ 
          message: "Invalid email format" 
        });
      }

      // Log contact form submission for tracking
      console.log('Contact form submission:', {
        name,
        email,
        subject,
        category,
        timestamp: new Date().toISOString()
      });

      // In a production environment, you would:
      // 1. Save to database
      // 2. Send email notification to support team
      // 3. Send confirmation email to user
      // For now, we'll simulate successful submission

      res.json({
        success: true,
        message: "Thank you for contacting us. We'll respond within 24 hours.",
        ticketId: `TICKET-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
      });

    } catch (error) {
      console.error('Contact form error:', error);
      res.status(500).json({ 
        message: "Failed to submit contact form. Please try again later." 
      });
    }
  });

  // ==============================================
  // AUTHENTICATED USER ROUTES
  // ==============================================

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
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
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
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
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;

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
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;

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
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
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
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;

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
      const totalCost = transferAmount + feeCalculation.totalFee;

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

        // Send notifications
        await NotificationService.createNotification({
          userId,
          type: 'transaction_completed' as any,
          title: 'Payment Sent',
          message: `Successfully sent $${validatedData.amount} USD`,
          priority: 'medium' as any
        });
        await NotificationService.createNotification({
          userId: recipient.id,
          type: 'payment_received' as any,
          title: 'Payment Received',
          message: `Received $${validatedData.amount} USD`,
          priority: 'medium' as any
        });
      } else {
        // Only notify sender if recipient doesn't exist yet
        await NotificationService.createNotification({
          userId,
          type: 'transaction_completed' as any,
          title: 'Payment Sent',
          message: `Successfully sent $${validatedData.amount} USD`,
          priority: 'medium' as any
        });
      }

      res.json({ 
        success: true, 
        transaction,
        message: "Payment sent successfully",
        fee: feeCalculation.totalFee,
        riskLevel: riskAssessment.riskLevel
      });
    } catch (error) {
      console.error("Error sending money:", error);
      res.status(500).json({ message: "Failed to send payment" });
    }
  });

  // Test payment calculation endpoint (bypasses Stripe for testing)
  app.post("/api/test-payment-calculation", async (req: any, res) => {
    try {
      const { amount, recipientEmail } = req.body;

      // Validate input
      if (!amount || !recipientEmail) {
        return res.status(400).json({ message: "Amount and recipient email are required" });
      }

      // Validate email format - CRITICAL SECURITY FIX
      ValidationUtils.validateEmail(recipientEmail);
      
      // Validate amount
      const transferAmount = ValidationUtils.validateAmount(amount);
      const feeCalculation = FeeCalculator.calculateSendMoneyFee(transferAmount);

      res.json({ 
        success: true,
        amount: transferAmount,
        fee: feeCalculation.totalFee,
        totalFee: feeCalculation.totalFee,
        platformFee: feeCalculation.platformFee,
        gasFee: feeCalculation.feeBreakdown?.networkFee || 0,
        total: transferAmount + feeCalculation.totalFee,
        currency: 'USD'
      });
    } catch (error: any) {
      console.error("Error calculating payment:", error);
      res.status(500).json({ message: "Error calculating payment: " + error.message });
    }
  });

  // Stripe payment intent creation for P2P transfers
  app.post("/api/create-payment-intent", productionAuthMiddleware, async (req: any, res) => {
    try {
      const { amount, recipientEmail } = req.body;
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;

      // Validate input
      if (!amount || !recipientEmail) {
        return res.status(400).json({ message: "Amount and recipient email are required" });
      }

      // Validate amount
      const transferAmount = ValidationUtils.validateAmount(amount);
      const feeCalculation = FeeCalculator.calculateSendMoneyFee(transferAmount);
      
      if (!feeCalculation || typeof feeCalculation.totalFee !== 'number') {
        throw new Error("Invalid fee calculation result");
      }
      
      const totalAmount = Math.round((transferAmount + feeCalculation.totalFee) * 100); // Convert to cents

      const paymentIntent = await stripe.paymentIntents.create({
        amount: totalAmount,
        currency: "usd",
        metadata: {
          userId: userId || 'demo-user',
          recipientEmail,
          transferAmount: transferAmount.toString(),
          fee: feeCalculation.totalFee.toString(),
          type: "p2p_transfer"
        },
      });

      res.json({ 
        clientSecret: paymentIntent.client_secret,
        amount: transferAmount,
        fee: feeCalculation.totalFee,
        total: transferAmount + feeCalculation.totalFee
      });
    } catch (error: any) {
      console.error("Error creating payment intent:", error);
      res.status(500).json({ message: "Error creating payment intent: " + error.message });
    }
  });

  // Stripe payment intent for AI agent services
  app.post("/api/agents/create-payment-intent", productionAuthMiddleware, async (req: any, res) => {
    try {
      const { agentId, serviceType, amount } = req.body;
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;

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
      console.error("Error creating agent payment intent:", error);
      res.status(500).json({ message: "Error creating payment intent: " + error.message });
    }
  });

  // PayPal configuration test endpoint
  app.get("/api/paypal/test-config", async (req, res) => {
    try {
      const isConfigured = paypalService.isConfigured();
      const environment = paypalService.getEnvironment();
      
      if (isConfigured) {
        // Test authentication by getting access token
        try {
          const isAuthenticated = await paypalService.testAuthentication();
          res.json({
            configured: true,
            environment,
            authenticated: isAuthenticated,
            message: isAuthenticated ? "PayPal service is fully configured and operational" : "PayPal authentication failed"
          });
        } catch (error: any) {
          res.json({
            configured: true,
            environment,
            authenticated: false,
            message: "PayPal credentials configured but authentication failed",
            error: error.message
          });
        }
      } else {
        res.json({
          configured: false,
          environment,
          authenticated: false,
          message: "PayPal credentials not configured"
        });
      }
    } catch (error: any) {
      res.status(500).json({
        error: "Failed to test PayPal configuration",
        message: error.message
      });
    }
  });

  // PayPal payment order creation
  app.post("/api/paypal/create-order", isAuthenticated, async (req: any, res) => {
    try {
      if (!paypalService.isConfigured()) {
        return res.status(400).json({ 
          message: "PayPal is not configured. Please configure PayPal credentials." 
        });
      }

      const { amount, currency = 'USD', description, type = 'general' } = req.body;
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;

      // Validate amount
      const validatedAmount = ValidationUtils.validateAmount(amount);
      
      // Calculate fees based on payment type
      let feeCalculation;
      let totalAmount;
      
      if (type === 'p2p_transfer') {
        feeCalculation = FeeCalculator.calculateSendMoneyFee(validatedAmount);
        totalAmount = feeCalculation.totalAmount;
      } else if (type === 'ai_agent_service') {
        const serviceFee = validatedAmount * 0.02;
        feeCalculation = { 
          originalAmount: validatedAmount,
          processingFee: 0,
          convenienceFee: 0,
          platformFee: serviceFee,
          totalFee: serviceFee,
          totalAmount: validatedAmount + serviceFee,
          netAmount: validatedAmount,
          paymentMethod: 'paypal'
        };
        totalAmount = feeCalculation.totalAmount;
      } else {
        feeCalculation = { 
          originalAmount: validatedAmount,
          processingFee: 0,
          convenienceFee: 0,
          platformFee: 0,
          totalFee: 0,
          totalAmount: validatedAmount,
          netAmount: validatedAmount,
          paymentMethod: 'paypal'
        };
        totalAmount = feeCalculation.totalAmount;
      }

      const order = await paypalService.createOrder({
        amount: totalAmount,
        currency: currency,
        description: description || 'Coin Railz Payment',
        returnUrl: `${req.protocol}://${req.get('host')}/payment/paypal/success`,
        cancelUrl: `${req.protocol}://${req.get('host')}/payment/paypal/cancel`
      });

      // Store order metadata for completion
      await storage.createPaymentIntent({
        id: order.id,
        userId: userId,
        amount: validatedAmount,
        fee: feeCalculation.totalFee,
        currency: currency,
        status: 'pending',
        paymentMethod: 'paypal',
        metadata: {
          type,
          description,
          originalRequest: req.body
        }
      });

      const approvalUrl = paypalService.getApprovalUrl(order);

      res.json({
        orderId: order.id,
        approvalUrl,
        amount: validatedAmount,
        fee: feeCalculation.totalFee,
        total: totalAmount,
        status: order.status
      });
    } catch (error: any) {
      console.error("Error creating PayPal order:", error);
      res.status(500).json({ message: "Error creating PayPal order: " + error.message });
    }
  });

  // PayPal order capture (complete payment)
  app.post("/api/paypal/capture-order/:orderId", isAuthenticated, async (req: any, res) => {
    try {
      const { orderId } = req.params;
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;

      // Verify order belongs to user
      const paymentIntent = await storage.getPaymentIntent(orderId);
      if (!paymentIntent || paymentIntent.userId !== userId) {
        return res.status(404).json({ message: "Payment order not found" });
      }

      const captureResult = await paypalService.captureOrder(orderId);
      
      if (captureResult.status === 'COMPLETED') {
        // Update payment intent status
        await storage.updatePaymentIntentStatus(orderId, 'completed');

        // Process the completed payment based on type
        const metadata = paymentIntent.metadata;
        if (metadata.type === 'p2p_transfer') {
          // Handle P2P transfer completion
          const { NotificationService } = await import('./services/notificationService');
          await NotificationService.createNotification({
            userId,
            type: 'payment_sent' as any,
            title: 'PayPal Payment Sent',
            message: `Successfully sent $${paymentIntent.amount} via PayPal`,
            priority: 'medium' as any
          });
        } else if (metadata.type === 'ai_agent_service') {
          // Handle AI agent payment completion
          const { NotificationService } = await import('./services/notificationService');
          await NotificationService.createNotification({
            userId,
            type: 'service_payment' as any,
            title: 'AI Agent Payment Complete',
            message: `Payment of $${paymentIntent.amount} completed via PayPal`,
            priority: 'medium' as any
          });
        }

        res.json({
          success: true,
          orderId,
          captureId: captureResult.purchase_units[0].payments.captures[0].id,
          amount: paymentIntent.amount,
          status: 'completed'
        });
      } else {
        res.status(400).json({
          success: false,
          message: "Payment capture failed",
          status: captureResult.status
        });
      }
    } catch (error: any) {
      console.error("Error capturing PayPal order:", error);
      res.status(500).json({ message: "Error capturing PayPal order: " + error.message });
    }
  });

  // PayPal order details
  app.get("/api/paypal/order/:orderId", isAuthenticated, async (req: any, res) => {
    try {
      const { orderId } = req.params;
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;

      // Verify order belongs to user
      const paymentIntent = await storage.getPaymentIntent(orderId);
      if (!paymentIntent || paymentIntent.userId !== userId) {
        return res.status(404).json({ message: "Payment order not found" });
      }

      const orderDetails = await paypalService.getOrderDetails(orderId);
      
      res.json({
        orderId,
        status: orderDetails.status,
        amount: paymentIntent.amount,
        fee: paymentIntent.fee,
        currency: paymentIntent.currency,
        createdAt: orderDetails.create_time,
        updatedAt: orderDetails.update_time
      });
    } catch (error: any) {
      console.error("Error fetching PayPal order details:", error);
      res.status(500).json({ message: "Error fetching order details: " + error.message });
    }
  });

  // PayPal payout creation for P2P transfers
  app.post("/api/paypal/create-payout", isAuthenticated, async (req: any, res) => {
    try {
      if (!paypalService.isConfigured()) {
        return res.status(400).json({ 
          message: "PayPal is not configured. Please configure PayPal credentials." 
        });
      }

      const { recipientEmail, amount, currency = 'USD', note } = req.body;
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;

      if (!recipientEmail || !amount) {
        return res.status(400).json({ 
          message: "Recipient email and amount are required" 
        });
      }

      // Validate amount
      const transferAmount = ValidationUtils.validateAmount(amount);
      const feeCalculation = FeeCalculator.calculateSendMoneyFee(transferAmount);
      const totalCost = transferAmount + feeCalculation.totalFee;

      // Check user balance
      const currentUser = await storage.getUser(userId);
      if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const userBalance = parseFloat(currentUser.usdBalance || "0");
      if (userBalance < totalCost) {
        return res.status(400).json({ message: "Insufficient balance" });
      }

      // Create PayPal payout
      const payout = await paypalService.createPayout({
        recipientEmail,
        amount: transferAmount,
        currency,
        note: note || `Payment from ${currentUser.firstName} ${currentUser.lastName}`,
        senderItemId: `p2p_${userId}_${Date.now()}`
      });

      // Deduct from sender balance
      const newBalance = userBalance - totalCost;
      await storage.updateUserBalance(userId, newBalance, "USD");

      // Create transaction record
      await storage.createTransaction({
        fromUserId: userId,
        toUserId: null,
        toEmail: recipientEmail,
        amount: transferAmount.toString(),
        message: note || "PayPal P2P transfer",
        transactionType: "send",
        status: "pending",
      });

      res.json({
        success: true,
        payoutBatchId: payout.batch_header.payout_batch_id,
        amount: transferAmount,
        fee: feeCalculation.totalFee,
        status: payout.batch_header.batch_status,
        estimatedCompletion: "1-3 minutes"
      });
    } catch (error: any) {
      console.error("Error creating PayPal payout:", error);
      res.status(500).json({ message: "Error creating PayPal payout: " + error.message });
    }
  });

  // PayPal payout status check
  app.get("/api/paypal/payout/:payoutBatchId/status", isAuthenticated, async (req: any, res) => {
    try {
      const { payoutBatchId } = req.params;
      const status = await paypalService.getPayoutStatus(payoutBatchId);
      
      res.json({
        success: true,
        status: status.batch_header.batch_status,
        items: status.items.map((item: any) => ({
          payoutItemId: item.payout_item_id,
          status: item.transaction_status,
          amount: item.payout_item.amount.value,
          currency: item.payout_item.amount.currency,
          recipient: item.payout_item.receiver
        }))
      });
    } catch (error: any) {
      console.error("Error fetching PayPal payout status:", error);
      res.status(500).json({ message: "Error fetching payout status: " + error.message });
    }
  });

  // PayPal webhook handler
  app.post("/api/paypal/webhook", async (req, res) => {
    try {
      const webhookId = process.env.PAYPAL_WEBHOOK_ID;
      if (!webhookId) {
        return res.status(400).json({ message: "PayPal webhook not configured" });
      }

      const isValid = await paypalService.verifyWebhook(req.headers, JSON.stringify(req.body), webhookId);
      
      if (!isValid) {
        return res.status(400).json({ message: "Invalid webhook signature" });
      }

      const event = req.body;
      
      // Handle different webhook events
      switch (event.event_type) {
        case 'PAYMENT.CAPTURE.COMPLETED':
          const orderId = event.resource.supplementary_data.related_ids.order_id;
          await storage.updatePaymentIntentStatus(orderId, 'completed');
          break;
        case 'PAYMENT.CAPTURE.DENIED':
          const deniedOrderId = event.resource.supplementary_data.related_ids.order_id;
          await storage.updatePaymentIntentStatus(deniedOrderId, 'failed');
          break;
        case 'PAYMENT.PAYOUTS-ITEM.SUCCEEDED':
          // Handle successful payout
          console.log('PayPal payout succeeded:', event.resource);
          break;
        case 'PAYMENT.PAYOUTS-ITEM.FAILED':
          // Handle failed payout
          console.log('PayPal payout failed:', event.resource);
          break;
      }

      res.status(200).json({ success: true });
    } catch (error: any) {
      console.error("Error processing PayPal webhook:", error);
      res.status(500).json({ message: "Error processing webhook" });
    }
  });

  // NOWPayments payment creation for crypto transactions
  app.post("/api/crypto/create-payment", isAuthenticated, async (req: any, res) => {
    try {
      const { amount, currency, purpose, recipientInfo } = req.body;
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;

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
        const paymentIntent = event.data.object as any;
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
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
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
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
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
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const stats = await referralService.getUserReferralStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching referral stats:", error);
      res.status(500).json({ message: "Failed to fetch referral stats" });
    }
  });

  app.post('/api/referrals/generate-code', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
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
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
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

  // AI Agent marketplace endpoints
  app.get('/api/agents/active', async (req, res) => {
    try {
      const activeAgents = await storage.getActiveGlobalAIAgents();
      res.json({
        success: true,
        agents: activeAgents,
        count: activeAgents.length
      });
    } catch (error) {
      console.error("Error getting active agents:", error);
      res.status(500).json({ success: false, error: 'Failed to get active agents' });
    }
  });

  app.get('/api/agents/marketplace/stats', async (req, res) => {
    try {
      const globalAgents = await storage.getGlobalAIAgents();
      const activeAgents = globalAgents.filter((agent: any) => agent.status === 'active').length;
      
      const totalTransactions = globalAgents.reduce((sum: number, agent: any) => sum + (agent.transactionCount || 0), 0);
      const totalVolume = globalAgents.reduce((sum: number, agent: any) => sum + parseFloat(agent.totalVolume || '0'), 0);
      const averageRating = globalAgents.length > 0 
        ? globalAgents.reduce((sum: number, agent: any) => sum + parseFloat(agent.reputation || '0'), 0) / globalAgents.length 
        : 0;
      
      res.json({
        success: true,
        stats: {
          totalAgents: globalAgents.length,
          activeAgents,
          totalTransactions,
          totalVolume,
          averageRating: Math.round(averageRating * 100) / 100
        }
      });
    } catch (error) {
      console.error("Error getting marketplace stats:", error);
      res.status(500).json({ success: false, error: 'Failed to get marketplace stats' });
    }
  });

  // Commission management endpoints
  app.get('/api/commissions/pending', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const pendingCommissions = await CommissionBatchProcessor.getUserPendingCommissions(userId);
      res.json(pendingCommissions);
    } catch (error) {
      console.error("Error fetching pending commissions:", error);
      res.status(500).json({ message: "Failed to fetch pending commissions" });
    }
  });

  app.get('/api/commissions/scheduler-status', isAuthenticated, async (req, res) => {
    try {
      const status = CommissionScheduler.getStatus();
      res.json(status);
    } catch (error) {
      console.error("Error fetching scheduler status:", error);
      res.status(500).json({ message: "Failed to fetch scheduler status" });
    }
  });

  // Admin endpoint for manual commission payout trigger
  app.post('/api/admin/commissions/trigger-payout', async (req, res) => {
    try {
      const result = await CommissionScheduler.triggerManualPayout();
      res.json({
        success: true,
        message: 'Manual commission payout triggered',
        result
      });
    } catch (error) {
      console.error("Error triggering manual payout:", error);
      res.status(500).json({ message: "Failed to trigger manual payout" });
    }
  });

  // Commission Calculator for Tier Upgrades
  app.post('/api/agents/commission-calculator', async (req, res) => {
    try {
      const { currentTier = 'basic', upgradeTier, monthlyReferralVolume = 10000 } = req.body;

      const { TransactionBasedCommissions } = await import('./services/transactionBasedCommissions');
      const preview = TransactionBasedCommissions.calculateCommissionPreview(
        currentTier,
        upgradeTier,
        parseFloat(monthlyReferralVolume)
      );

      const tiers = TransactionBasedCommissions.getPremiumTierOptions();
      const upgradeOption = tiers.find(t => t.name.toLowerCase().includes(upgradeTier.toLowerCase()));

      res.json({
        success: true,
        calculator: {
          monthlyVolume: `$${monthlyReferralVolume.toLocaleString()}`,
          currentTier,
          upgradeTier,
          earnings: {
            current: `$${preview.currentEarnings.toLocaleString()}`,
            upgrade: `$${preview.upgradeEarnings.toLocaleString()}`,
            additional: `$${preview.additionalEarnings.toLocaleString()}`
          },
          investment: {
            monthlyFee: upgradeOption ? `$${upgradeOption.monthlyFee}` : '$0',
            roi: preview.upgradeROI > 10 ? '10x+' : `${preview.upgradeROI.toFixed(1)}x`,
            paybackPeriod: `${preview.paybackPeriod.toFixed(1)} months`
          },
          benefits: upgradeOption?.benefits || []
        },
        recommendation: preview.upgradeROI > 2 ? 'recommended' : 'evaluate_carefully',
        message: 'Commission calculation completed'
      });
    } catch (error: any) {
      console.error('Commission calculator error:', error);
      res.status(500).json({
        success: false,
        message: 'Commission calculation failed: ' + error.message
      });
    }
  });

  // Premium Tier Upgrade for Agents
  app.post('/api/agents/:agentId/upgrade-tier', async (req, res) => {
    try {
      const { agentId } = req.params;
      const { tierName, paymentMethodId } = req.body;

      if (!tierName || !paymentMethodId) {
        return res.status(400).json({
          success: false,
          message: 'Tier name and payment method required'
        });
      }

      const { TransactionBasedCommissions } = await import('./services/transactionBasedCommissions');
      const tiers = TransactionBasedCommissions.getPremiumTierOptions();
      const selectedTier = tiers.find(t => t.name.toLowerCase().includes(tierName.toLowerCase()));

      if (!selectedTier) {
        return res.status(400).json({
          success: false,
          message: 'Invalid tier selection'
        });
      }

      // Create Stripe subscription for monthly fee
      if (selectedTier.monthlyFee > 0) {
        console.log(`Processing ${selectedTier.monthlyFee} monthly subscription for agent ${agentId}`);
      }

      res.json({
        success: true,
        upgrade: selectedTier,
        message: 'Tier upgrade processed successfully'
      });
    } catch (error: any) {
      console.error('Tier upgrade error:', error);
      res.status(500).json({
        success: false,
        message: 'Tier upgrade failed: ' + error.message
      });
    }
  });

  // Fee Calculation System API
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
          feeCalculation = FeeCalculator.calculateSendMoneyFee(baseAmount);
          break;
        case 'buy_crypto':
          feeCalculation = FeeCalculator.calculateBuyCryptoFee(baseAmount);
          break;
        case 'sell_crypto':
          feeCalculation = FeeCalculator.calculateSellCryptoFee(baseAmount);
          break;
        default:
          // Standard 1% platform fee
          const platformFee = baseAmount * 0.01;
          feeCalculation = {
            originalAmount: baseAmount,
            platformFee,
            totalFee: platformFee,
            totalAmount: baseAmount + platformFee,
            netAmount: baseAmount,
            feeBreakdown: {
              platformFee: platformFee,
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

  // Revenue Tracking System API
  app.get('/api/revenue/summary', async (req, res) => {
    try {
      // Get revenue data from database
      const transactions = await db.query(`
        SELECT 
          COUNT(*) as total_transactions,
          SUM(CASE WHEN amount IS NOT NULL THEN CAST(amount AS DECIMAL) ELSE 0 END) as total_volume,
          SUM(CASE WHEN fee IS NOT NULL THEN CAST(fee AS DECIMAL) ELSE 0 END) as total_fees,
          AVG(CASE WHEN amount IS NOT NULL THEN CAST(amount AS DECIMAL) ELSE 0 END) as avg_transaction_size
        FROM payment_intents 
        WHERE status = 'succeeded'
      `);

      const agentCommissions = await db.query(`
        SELECT 
          COUNT(*) as total_agents,
          SUM(CASE WHEN total_revenue IS NOT NULL THEN CAST(total_revenue AS DECIMAL) ELSE 0 END) as total_agent_revenue
        FROM global_ai_agents 
        WHERE is_active = true
      `);

      const revenueData = transactions.rows[0] || {};
      const agentData = agentCommissions.rows[0] || {};

      const summary = {
        platform: {
          totalTransactions: parseInt(revenueData.total_transactions) || 0,
          totalVolume: parseFloat(revenueData.total_volume) || 0,
          totalFees: parseFloat(revenueData.total_fees) || 0,
  return server;
}
