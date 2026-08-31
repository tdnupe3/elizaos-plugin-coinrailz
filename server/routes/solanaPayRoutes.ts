/**
 * Solana Pay Routes - Payment processing API endpoints
 * ISOLATED: Completely separate from x402 EVM routes
 * 
 * Endpoints:
 * - POST /solana-pay/intents - Create payment intent
 * - GET /solana-pay/intents/:id - Get intent status
 * - POST /solana-pay/webhook - Helius webhook receiver
 * - GET /solana-pay/pricing - Get fee tiers
 * - GET /solana-pay/tokens - Get supported tokens
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { 
  solanaPaymentService, 
  heliusWebhookHandler,
  solanaDataServices,
  paymentPoller,
  SERVICE_SLUGS,
  SERVICE_PRICING,
  type HeliusEnhancedPayload,
} from '../services/payments/solanaPay/index.js';
import { trackSolanaEndpoint, trackSolanaWebhook } from '../middleware/solanaTracking.js';
import { pingDiscoveryCrawlers, getRegistryStatus } from '../services/solanaRegistryService.js';
import { coinbaseCDPService } from '../services/coinbaseCDPService.js';
import { PLATFORM_WALLETS } from '../utils/facilitatorHelper.js';
import { getCanonicalPayableNetworks } from '../config/publicDiscoveryConfig.js';

const router = Router();

const PLATFORM_WALLET = PLATFORM_WALLETS.solana;
const SOLANA_PAYMENT_NETWORK = getCanonicalPayableNetworks().find(network => network.id === 'solana')!;
const SOLANA_PAYMENT_TOKEN = SOLANA_PAYMENT_NETWORK.asset as 'USDC';

// Protocol headers middleware for Solana Actions discovery
router.use((req: Request, res: Response, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', [
    'Content-Type',
    'Authorization',
    'Accept',
    'Origin',
    'X-Requested-With',
    'x-api-key',
    'x-intent-id',
    'X-Action-Version',
    'X-Action-Identity',
    'X-Blockchain-Ids',
    'X-Action-Signature',
    'X-Client-Public-Key'
  ].join(', '));
  res.setHeader('Access-Control-Expose-Headers', [
    'X-Action-Version',
    'X-Action-Identity',
    'X-Blockchain-Ids',
    'Link'
  ].join(', '));
  res.setHeader('Access-Control-Max-Age', '86400');
  
  res.setHeader('X-Action-Version', '2.4');
  res.setHeader('X-Action-Identity', PLATFORM_WALLET);
  res.setHeader('X-Blockchain-Ids', 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp');
  res.setHeader('Link', [
    `<https://coinrailz.com/.well-known/solana-actions.json>; rel="solana-actions"`,
    `<https://coinrailz.com/.well-known/solana-pay.json>; rel="solana-pay"`
  ].join(', '));
  
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

// Apply tracking middleware to all Solana Pay routes
router.use(trackSolanaEndpoint);

// Rate limiter for intent creation - prevents spam
const intentRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 30, // Max 30 intents per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Rate limit exceeded',
    message: 'Too many payment intents created. Please wait before trying again.',
    retryAfter: 60
  },
  keyGenerator: (req) => {
    // Use X-Forwarded-For for proxied requests, fallback to IP
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
  }
});

// Stricter rate limiter for webhook endpoint - prevent abuse
const webhookRateLimiter = rateLimit({
  windowMs: 10 * 1000, // 10 second window
  max: 100, // Max 100 webhooks per 10 seconds (Helius can batch)
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Webhook rate limit exceeded' }
});

const createIntentSchema = z.object({
  amount: z.string().regex(/^\d+(\.\d+)?$/, 'Amount must be a valid number'),
  tokenSymbol: z.literal(SOLANA_PAYMENT_TOKEN),
  serviceName: z.string().min(1).max(100),
  serviceSlug: z.string().optional(),
  customerWallet: z.string().optional(),
  customerId: z.string().optional(),
  partnerId: z.string().optional(),
  isTestMode: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
});

// ============================================================================
// Solana Actions GET /intents - Returns ActionGetResponse metadata for Dialect
// This is required for Blinks to validate and unfurl the action
// ============================================================================
router.get('/intents', async (req: Request, res: Response) => {
  const baseUrl = process.env.PUBLIC_BASE_URL || 'https://coinrailz.com';
  
  // Return Solana Actions ActionGetResponse format
  return res.json({
    type: 'action',
    icon: `${baseUrl}/favicon.ico`,
    title: 'Create Payment Intent',
    description: 'Create a USDC payment intent on Solana for AI agent services.',
    label: 'Create Intent',
    links: {
      actions: [
        {
          label: 'Pay $0.25 USDC - Ping',
          href: `${baseUrl}/solana-pay/intents?amount=0.25&tokenSymbol=USDC&serviceName=solana-ping`,
          parameters: []
        },
        {
          label: 'Pay $1.00 USDC - Agent Wallet',
          href: `${baseUrl}/solana-pay/intents?amount=1.00&tokenSymbol=USDC&serviceName=instant-solana-wallet`,
          parameters: []
        },
        {
          label: 'Custom Payment',
          href: `${baseUrl}/solana-pay/intents?amount={amount}&tokenSymbol={tokenSymbol}&serviceName={serviceName}`,
          parameters: [
            {
              name: 'amount',
              label: 'Amount',
              required: true,
              type: 'text'
            },
            {
              name: 'tokenSymbol',
              label: 'Token',
              required: true,
              type: 'select',
              options: [{ label: SOLANA_PAYMENT_TOKEN, value: SOLANA_PAYMENT_TOKEN }]
            },
            {
              name: 'serviceName',
              label: 'Service',
              required: true,
              type: 'select',
              options: [
                { label: 'Discovery Ping', value: 'solana-ping' },
                { label: 'Token Price Feed', value: 'token-price-feed' },
                { label: 'Trending Tokens', value: 'trending-tokens' },
                { label: 'Whale Alerts', value: 'whale-alerts' },
                { label: 'Instant Agent Wallet', value: 'instant-solana-wallet' }
              ]
            }
          ]
        }
      ]
    }
  });
});

router.post('/intents', intentRateLimiter, async (req: Request, res: Response) => {
  try {
    if (!solanaPaymentService.isReady()) {
      await solanaPaymentService.initialize();
    }

    if (!solanaPaymentService.isReady()) {
      return res.status(503).json({
        error: 'Service unavailable',
        message: 'Solana payment service is not configured',
      });
    }

    const validation = createIntentSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation error',
        details: validation.error.errors,
      });
    }

    const intent = await solanaPaymentService.createIntent(validation.data);
    
    return res.status(201).json(intent);
  } catch (error) {
    console.error('Error creating Solana payment intent:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.get('/intents/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    if (!id || !id.startsWith('sol_intent_')) {
      return res.status(400).json({
        error: 'Invalid intent ID format',
      });
    }

    const intent = await solanaPaymentService.getIntentById(id);
    
    if (!intent) {
      return res.status(404).json({
        error: 'Intent not found',
      });
    }

    return res.json({
      intentId: intent.id,
      status: intent.status,
      amount: intent.amount,
      tokenSymbol: intent.tokenSymbol,
      serviceName: intent.serviceName,
      memoTag: intent.memoTag,
      recipientAddress: intent.recipientAddress,
      platformFee: intent.platformFee,
      txSignature: intent.txSignature,
      createdAt: intent.createdAt,
      expiresAt: intent.expiresAt,
      paidAt: intent.paidAt,
      settledAt: intent.settledAt,
    });
  } catch (error) {
    console.error('Error fetching Solana payment intent:', error);
    return res.status(500).json({
      error: 'Internal server error',
    });
  }
});

// DEBUG endpoint - NO AUTH - logs everything Helius sends to diagnose webhook issues
// Also writes to database so we can check from any environment
router.post('/webhook-debug', async (req: Request, res: Response) => {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    ip: req.ip || 'unknown',
    authHeader: req.headers['authorization'] ? 'present' : 'missing',
    bodyPreview: JSON.stringify(req.body).slice(0, 1000),
    userAgent: req.headers['user-agent'] || 'unknown'
  };
  
  console.log('🔍 WEBHOOK DEBUG HIT:', timestamp);
  console.log('   IP:', logEntry.ip);
  console.log('   Auth:', logEntry.authHeader);
  console.log('   Body:', logEntry.bodyPreview.slice(0, 500));
  
  // Write to database for cross-environment verification
  try {
    const { db } = await import('../db.js');
    const { sql } = await import('drizzle-orm');
    await db.execute(sql`
      INSERT INTO webhook_debug_log (timestamp, ip, auth_header, body_preview, user_agent)
      VALUES (${timestamp}, ${logEntry.ip}, ${logEntry.authHeader}, ${logEntry.bodyPreview}, ${logEntry.userAgent})
    `);
    console.log('✅ Webhook logged to database');
  } catch (dbError) {
    console.log('⚠️ Failed to log to database (table may not exist):', dbError);
  }
  
  // Always return 200 to Helius
  return res.status(200).json({ 
    received: true, 
    timestamp,
    message: 'Debug endpoint - webhook received successfully'
  });
});

// GET endpoint to check webhook debug logs from database
router.get('/webhook-debug-logs', async (req: Request, res: Response) => {
  try {
    const { db } = await import('../db.js');
    const { sql } = await import('drizzle-orm');
    const logs = await db.execute(sql`
      SELECT * FROM webhook_debug_log ORDER BY timestamp DESC LIMIT 20
    `);
    return res.json({ logs: logs.rows || logs });
  } catch (error) {
    return res.json({ error: 'Table may not exist yet', message: String(error) });
  }
});

router.post('/webhook', webhookRateLimiter, trackSolanaWebhook, async (req: Request, res: Response) => {
  try {
    console.log('📥 WEBHOOK REQUEST RECEIVED:', new Date().toISOString());
    console.log('   Auth header present:', !!req.headers['authorization']);
    
    // Check if webhook is properly configured (fail-closed security)
    if (!heliusWebhookHandler.isWebhookConfigured()) {
      console.error('🔒 SECURITY: Webhook rejected - HELIUS_WEBHOOK_SECRET not configured');
      return res.status(503).json({ 
        error: 'Service unavailable', 
        message: 'Webhook authentication not configured' 
      });
    }

    // Helius uses Authorization header echo pattern for webhook auth
    const authHeader = req.headers['authorization'] as string | undefined;
    
    if (!heliusWebhookHandler.verifyAuthHeader(authHeader)) {
      console.warn('🔒 SECURITY: Invalid Helius webhook authorization');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const payloads: HeliusEnhancedPayload[] = Array.isArray(req.body) ? req.body : [req.body];
    
    const results = await heliusWebhookHandler.processWebhook(payloads);
    
    const successCount = results.filter(r => r.success).length;
    console.log(`📥 Helius webhook processed: ${successCount}/${results.length} transactions`);
    
    return res.status(200).json({
      processed: results.length,
      successful: successCount,
      results,
    });
  } catch (error) {
    console.error('Error processing Helius webhook:', error);
    return res.status(500).json({
      error: 'Webhook processing failed',
    });
  }
});

router.get('/pricing', async (req: Request, res: Response) => {
  try {
    const tiers = await solanaPaymentService.listPricingTiers();
    
    return res.json({
      tiers: tiers.map(tier => ({
        name: tier.name,
        description: tier.description,
        percentageFee: `${(parseFloat(tier.percentageFee) * 100).toFixed(2)}%`,
        minimumFee: { USDC: `$${tier.minimumFeeUsdc} USDC` },
        isDefault: tier.isDefault,
      })),
      note: 'Platform fee is the greater of percentage or minimum',
    });
  } catch (error) {
    console.error('Error fetching pricing:', error);
    return res.status(500).json({
      error: 'Internal server error',
    });
  }
});

router.get('/tokens', async (req: Request, res: Response) => {
  try {
    const tokens = await solanaPaymentService.getSupportedTokens();
    
    return res.json({
      tokens: tokens.filter(token => token.symbol === SOLANA_PAYMENT_TOKEN).map(token => ({
        symbol: token.symbol,
        name: token.name,
        mint: token.mint,
        decimals: token.decimals,
      })),
    });
  } catch (error) {
    console.error('Error fetching tokens:', error);
    return res.status(500).json({
      error: 'Internal server error',
    });
  }
});

router.get('/status', async (req: Request, res: Response) => {
  const isReady = solanaPaymentService.isReady();
  const hasWebhookSecret = !!process.env.HELIUS_WEBHOOK_SECRET;
  const hasWalletKey = !!process.env.SOLANA_PRIVATE_KEY;
  
  // Determine operational status
  let status = 'not_configured';
  const warnings: string[] = [];
  
  if (isReady && hasWebhookSecret) {
    status = 'operational';
  } else if (isReady) {
    status = 'partial';
    if (!hasWebhookSecret) {
      warnings.push('HELIUS_WEBHOOK_SECRET not configured - webhooks disabled');
    }
  } else {
    if (!hasWalletKey) {
      warnings.push('SOLANA_PRIVATE_KEY not configured - service disabled');
    }
  }
  
  const pollerStatus = paymentPoller.getStatus();
  
  return res.json({
    status,
    chain: 'solana',
    network: 'mainnet-beta',
    production_ready: isReady && hasWebhookSecret,
    features: {
      intents: isReady,
      webhooks: hasWebhookSecret,
      wallet: hasWalletKey,
      tokens: [SOLANA_PAYMENT_TOKEN],
      poller: pollerStatus,
    },
    ...(warnings.length > 0 && { warnings }),
  });
});

// Poller control routes - fallback when webhooks aren't working
router.post('/poller/start', async (req: Request, res: Response) => {
  try {
    await paymentPoller.start();
    return res.json({ 
      success: true, 
      message: 'Payment poller started',
      status: paymentPoller.getStatus()
    });
  } catch (error) {
    console.error('Error starting poller:', error);
    return res.status(500).json({ error: 'Failed to start poller' });
  }
});

router.post('/poller/stop', async (req: Request, res: Response) => {
  try {
    paymentPoller.stop();
    return res.json({ 
      success: true, 
      message: 'Payment poller stopped',
      status: paymentPoller.getStatus()
    });
  } catch (error) {
    console.error('Error stopping poller:', error);
    return res.status(500).json({ error: 'Failed to stop poller' });
  }
});

router.get('/poller/status', async (req: Request, res: Response) => {
  return res.json(paymentPoller.getStatus());
});

router.get('/services', async (req: Request, res: Response) => {
  const services = solanaDataServices.getAvailableServices();
  
  return res.json({
    services,
    paymentInfo: {
      chain: 'solana',
      tokens: [SOLANA_PAYMENT_TOKEN],
      createIntentEndpoint: '/solana-pay/intents',
    },
  });
});

router.get('/catalog', async (req: Request, res: Response) => {
  const baseUrl = process.env.PUBLIC_BASE_URL || 'https://coinrailz.com';
  
  const catalog = {
    name: "Coin Railz Solana Services",
    version: "1.0.0",
    updated: new Date().toISOString(),
    network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
    description: "Payment processing and data services for Solana-native AI agents. 0.5% fees, instant webhook settlement.",
    
    platform: {
      wallet: PLATFORM_WALLET,
      fee_percentage: 0.005,
      minimum_fee_usdc: 0.25,
      payment_asset: SOLANA_PAYMENT_TOKEN
    },
    
    supported_tokens: [{
      symbol: SOLANA_PAYMENT_NETWORK.asset,
      mint: SOLANA_PAYMENT_NETWORK.assetAddress,
      decimals: SOLANA_PAYMENT_NETWORK.decimals
    }],
    
    categories: ["data", "intelligence", "infrastructure"],
    
    services: [
      {
        id: "sol-price-feed",
        name: "Token Price Feed",
        description: "Real-time Solana token prices via Jupiter/DexScreener",
        endpoint: `${baseUrl}/solana-pay/services/price/:mint`,
        method: "GET",
        price_usd: 0.10,
        price_usdc: "0.10",
        price_sol: "0.0005",
        category: "data",
        capabilities: ["price-feed", "real-time", "dex-data"],
        input: { mint: "Token mint address (for example, the USDC mint)" },
        auth: "x-intent-id header"
      },
      {
        id: "sol-trending",
        name: "Trending Tokens",
        description: "Hot tokens on Solana DEXs with volume and price data",
        endpoint: `${baseUrl}/solana-pay/services/trending`,
        method: "GET",
        price_usd: 0.25,
        price_usdc: "0.25",
        price_sol: "0.001",
        category: "data",
        capabilities: ["trending", "volume-analysis", "token-discovery"],
        auth: "x-intent-id header"
      },
      {
        id: "sol-whale-alerts",
        name: "Whale Wallet Alerts",
        description: "Track large Solana wallet movements in real-time",
        endpoint: `${baseUrl}/solana-pay/services/whale-alerts`,
        method: "GET",
        price_usd: 0.50,
        price_usdc: "0.50",
        price_sol: "0.002",
        category: "intelligence",
        capabilities: ["whale-tracking", "wallet-analysis", "alerts"],
        auth: "x-intent-id header"
      },
      {
        id: "solana-ping",
        name: "Solana Discovery Ping",
        description: "Service health and availability check for registry monitoring",
        endpoint: `${baseUrl}/solana-pay/ping`,
        method: "GET",
        price_usd: 0.25,
        price_usdc: "0.25",
        price_sol: "0.001",
        category: "infrastructure",
        capabilities: ["health-check", "discovery", "monitoring"],
        auth: "x-intent-id header"
      },
      {
        id: "instant-solana-wallet",
        name: "Instant Solana Agent Wallet",
        description: "Create production-ready Solana wallets for AI agents via Coinbase CDP. Sub-200ms signing, enterprise-grade security.",
        endpoint: `${baseUrl}/solana-pay/instant-wallet`,
        method: "POST",
        price_usd: 1.00,
        price_usdc: "1.00",
        price_sol: "0.004",
        category: "infrastructure",
        capabilities: ["wallet-creation", "cdp-integration", "enterprise-security"],
        input: { agentId: "Unique AI agent identifier", name: "Optional wallet name" },
        auth: "x-intent-id header"
      }
    ],
    
    payment_flow: {
      step_1: "POST /solana-pay/intents with amount, tokenSymbol, serviceName, serviceSlug",
      step_2: "Send exact amount to wallet address with memoTag in memo field",
      step_3: "Helius webhook auto-verifies and settles payment",
      step_4: "Access service endpoint with x-intent-id header"
    },
    
    target_audience: [
      "Solana-native AI agents",
      "Truth Terminal ecosystem",
      "pump.fun traders",
      "Jito MEV bots",
      "DeFi automation"
    ],
    
    related_endpoints: {
      well_known: `${baseUrl}/.well-known/solana.json`,
      status: `${baseUrl}/solana-pay/status`,
      create_intent: `${baseUrl}/solana-pay/intents`,
      documentation: `${baseUrl}/solana-pay`
    }
  };
  
  return res.json(catalog);
});

router.get('/services/price/:mint', async (req: Request, res: Response) => {
  try {
    const { mint } = req.params;
    const intentId = req.headers['x-intent-id'] as string;
    const startTime = Date.now();
    
    if (!intentId) {
      return res.status(402).json({
        error: 'Payment required',
        message: 'Missing x-intent-id header. Create a payment intent first.',
        pricing: SERVICE_PRICING[SERVICE_SLUGS.TOKEN_PRICE_FEED],
        createIntentEndpoint: '/solana-pay/intents',
        serviceSlug: SERVICE_SLUGS.TOKEN_PRICE_FEED,
      });
    }

    const verification = await solanaPaymentService.verifyPaidIntent(intentId);
    if (!verification.valid) {
      return res.status(402).json({
        error: 'Payment required',
        message: verification.error,
        pricing: SERVICE_PRICING[SERVICE_SLUGS.TOKEN_PRICE_FEED],
        createIntentEndpoint: '/solana-pay/intents',
        serviceSlug: SERVICE_SLUGS.TOKEN_PRICE_FEED,
      });
    }

    const result = await solanaDataServices.getTokenPrice(mint);
    
    await solanaPaymentService.recordServiceMetric(
      intentId, 
      SERVICE_SLUGS.TOKEN_PRICE_FEED, 
      result.success, 
      Date.now() - startTime
    );
    
    return res.json(result);
  } catch (error) {
    console.error('Error in price service:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

router.get('/services/sol-price', async (req: Request, res: Response) => {
  try {
    const result = await solanaDataServices.getSolPrice();
    return res.json(result);
  } catch (error) {
    console.error('Error fetching SOL price:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

router.get('/services/trending', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const intentId = req.headers['x-intent-id'] as string;
    const startTime = Date.now();
    
    if (!intentId) {
      return res.status(402).json({
        error: 'Payment required',
        message: 'Missing x-intent-id header. Create a payment intent first.',
        pricing: SERVICE_PRICING[SERVICE_SLUGS.TRENDING_TOKENS],
        createIntentEndpoint: '/solana-pay/intents',
        serviceSlug: SERVICE_SLUGS.TRENDING_TOKENS,
      });
    }

    const verification = await solanaPaymentService.verifyPaidIntent(intentId);
    if (!verification.valid) {
      return res.status(402).json({
        error: 'Payment required',
        message: verification.error,
        pricing: SERVICE_PRICING[SERVICE_SLUGS.TRENDING_TOKENS],
        createIntentEndpoint: '/solana-pay/intents',
        serviceSlug: SERVICE_SLUGS.TRENDING_TOKENS,
      });
    }

    const result = await solanaDataServices.getTrendingTokens(limit);
    
    await solanaPaymentService.recordServiceMetric(
      intentId, 
      SERVICE_SLUGS.TRENDING_TOKENS, 
      result.success, 
      Date.now() - startTime
    );
    
    return res.json(result);
  } catch (error) {
    console.error('Error in trending service:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

router.get('/services/whale-alerts', async (req: Request, res: Response) => {
  try {
    const wallet = req.query.wallet as string;
    const intentId = req.headers['x-intent-id'] as string;
    const startTime = Date.now();
    
    if (!intentId) {
      return res.status(402).json({
        error: 'Payment required',
        message: 'Missing x-intent-id header. Create a payment intent first.',
        pricing: SERVICE_PRICING[SERVICE_SLUGS.WHALE_ALERTS],
        createIntentEndpoint: '/solana-pay/intents',
        serviceSlug: SERVICE_SLUGS.WHALE_ALERTS,
      });
    }

    const verification = await solanaPaymentService.verifyPaidIntent(intentId);
    if (!verification.valid) {
      return res.status(402).json({
        error: 'Payment required',
        message: verification.error,
        pricing: SERVICE_PRICING[SERVICE_SLUGS.WHALE_ALERTS],
        createIntentEndpoint: '/solana-pay/intents',
        serviceSlug: SERVICE_SLUGS.WHALE_ALERTS,
      });
    }

    const result = await solanaDataServices.getWhaleAlerts(wallet);
    
    await solanaPaymentService.recordServiceMetric(
      intentId, 
      SERVICE_SLUGS.WHALE_ALERTS, 
      result.success, 
      Date.now() - startTime
    );
    
    return res.json(result);
  } catch (error) {
    console.error('Error in whale alerts service:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

// ============================================================================
// SOLANA ENDPOINT ANALYTICS - Monitor who/when/what for all Solana Pay hits
// ============================================================================

function validateAnalyticsAccess(req: Request, res: Response): boolean {
  const adminKey = process.env.ANALYTICS_API_KEY || process.env.ADMIN_API_KEY;
  const providedKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
  
  if (!adminKey) {
    res.status(503).json({ 
      error: 'Service unavailable', 
      message: 'Analytics API key not configured. Set ANALYTICS_API_KEY or ADMIN_API_KEY environment variable.' 
    });
    return false;
  }
  
  if (!providedKey || providedKey !== adminKey) {
    res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Valid API key required for analytics access. Use x-api-key header or Bearer token.' 
    });
    return false;
  }
  return true;
}

router.get('/analytics/interactions', async (req: Request, res: Response) => {
  if (!validateAnalyticsAccess(req, res)) return;
  
  try {
    const { db } = await import('../db.js');
    const { sql } = await import('drizzle-orm');
    
    const hours = parseInt(req.query.hours as string) || 24;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const endpoint = req.query.endpoint as string;
    const category = req.query.category as string;
    
    let query = sql`
      SELECT 
        id, endpoint, method, ip_address, user_agent, user_agent_category,
        wallet_address, status_code, response_time_ms, success,
        intent_id, service_slug, token_symbol, is_webhook, webhook_type,
        tx_signature, error_type, error_message, timestamp, metadata
      FROM solana_endpoint_interactions
      WHERE timestamp > NOW() - INTERVAL '${sql.raw(String(hours))} hours'
    `;
    
    if (endpoint) {
      query = sql`${query} AND endpoint LIKE ${'%' + endpoint + '%'}`;
    }
    if (category) {
      query = sql`${query} AND user_agent_category = ${category}`;
    }
    
    query = sql`${query} ORDER BY timestamp DESC LIMIT ${limit}`;
    
    const result = await db.execute(query);
    
    return res.json({
      success: true,
      count: (result.rows || result).length,
      timeRange: `Last ${hours} hours`,
      interactions: result.rows || result,
    });
  } catch (error) {
    console.error('Error fetching Solana analytics:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics',
    });
  }
});

router.get('/analytics/summary', async (req: Request, res: Response) => {
  if (!validateAnalyticsAccess(req, res)) return;
  
  try {
    const { db } = await import('../db.js');
    const { sql } = await import('drizzle-orm');
    
    const hours = parseInt(req.query.hours as string) || 24;
    
    const summary = await db.execute(sql`
      SELECT 
        COUNT(*) as total_requests,
        COUNT(DISTINCT ip_address) as unique_ips,
        COUNT(*) FILTER (WHERE success = true) as successful,
        COUNT(*) FILTER (WHERE success = false) as failed,
        COUNT(*) FILTER (WHERE is_webhook = true) as webhook_hits,
        COUNT(*) FILTER (WHERE user_agent_category = 'helius') as helius_hits,
        COUNT(*) FILTER (WHERE user_agent_category = 'ai_agent') as ai_agent_hits,
        COUNT(*) FILTER (WHERE user_agent_category = 'sdk') as sdk_hits,
        COUNT(*) FILTER (WHERE user_agent_category = 'browser') as browser_hits,
        AVG(response_time_ms)::integer as avg_response_ms
      FROM solana_endpoint_interactions
      WHERE timestamp > NOW() - INTERVAL '${sql.raw(String(hours))} hours'
    `);
    
    const byEndpoint = await db.execute(sql`
      SELECT 
        endpoint,
        COUNT(*) as hits,
        COUNT(*) FILTER (WHERE success = true) as successful,
        AVG(response_time_ms)::integer as avg_response_ms
      FROM solana_endpoint_interactions
      WHERE timestamp > NOW() - INTERVAL '${sql.raw(String(hours))} hours'
      GROUP BY endpoint
      ORDER BY hits DESC
    `);
    
    const byUserAgentCategory = await db.execute(sql`
      SELECT 
        user_agent_category,
        COUNT(*) as hits,
        COUNT(DISTINCT ip_address) as unique_ips
      FROM solana_endpoint_interactions
      WHERE timestamp > NOW() - INTERVAL '${sql.raw(String(hours))} hours'
      GROUP BY user_agent_category
      ORDER BY hits DESC
    `);
    
    const recentErrors = await db.execute(sql`
      SELECT 
        endpoint, status_code, error_type, error_message, 
        user_agent_category, timestamp
      FROM solana_endpoint_interactions
      WHERE timestamp > NOW() - INTERVAL '${sql.raw(String(hours))} hours'
        AND success = false
      ORDER BY timestamp DESC
      LIMIT 10
    `);
    
    return res.json({
      success: true,
      timeRange: `Last ${hours} hours`,
      summary: (summary.rows || summary)[0] || {},
      byEndpoint: byEndpoint.rows || byEndpoint,
      byUserAgentCategory: byUserAgentCategory.rows || byUserAgentCategory,
      recentErrors: recentErrors.rows || recentErrors,
    });
  } catch (error) {
    console.error('Error fetching Solana analytics summary:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics summary',
    });
  }
});

router.get('/analytics/traffic-timeline', async (req: Request, res: Response) => {
  if (!validateAnalyticsAccess(req, res)) return;
  
  try {
    const { db } = await import('../db.js');
    const { sql } = await import('drizzle-orm');
    
    const hours = parseInt(req.query.hours as string) || 24;
    
    const timeline = await db.execute(sql`
      SELECT 
        DATE_TRUNC('hour', timestamp) as hour,
        COUNT(*) as total_hits,
        COUNT(DISTINCT ip_address) as unique_ips,
        COUNT(*) FILTER (WHERE is_webhook = true) as webhooks,
        COUNT(*) FILTER (WHERE user_agent_category = 'ai_agent') as ai_agents,
        COUNT(*) FILTER (WHERE success = false) as errors
      FROM solana_endpoint_interactions
      WHERE timestamp > NOW() - INTERVAL '${sql.raw(String(hours))} hours'
      GROUP BY DATE_TRUNC('hour', timestamp)
      ORDER BY hour DESC
    `);
    
    return res.json({
      success: true,
      timeRange: `Last ${hours} hours`,
      timeline: timeline.rows || timeline,
    });
  } catch (error) {
    console.error('Error fetching traffic timeline:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch traffic timeline',
    });
  }
});

router.get('/analytics/unique-visitors', async (req: Request, res: Response) => {
  if (!validateAnalyticsAccess(req, res)) return;
  
  try {
    const { db } = await import('../db.js');
    const { sql } = await import('drizzle-orm');
    
    const hours = parseInt(req.query.hours as string) || 24;
    
    const visitors = await db.execute(sql`
      SELECT 
        ip_address,
        user_agent_category,
        COUNT(*) as total_requests,
        COUNT(DISTINCT endpoint) as endpoints_hit,
        MIN(timestamp) as first_seen,
        MAX(timestamp) as last_seen,
        ARRAY_AGG(DISTINCT endpoint) as endpoints,
        SUM(CASE WHEN success THEN 1 ELSE 0 END)::integer as successful_requests,
        ARRAY_AGG(DISTINCT wallet_address) FILTER (WHERE wallet_address IS NOT NULL) as wallets
      FROM solana_endpoint_interactions
      WHERE timestamp > NOW() - INTERVAL '${sql.raw(String(hours))} hours'
      GROUP BY ip_address, user_agent_category
      ORDER BY total_requests DESC
      LIMIT 50
    `);
    
    return res.json({
      success: true,
      timeRange: `Last ${hours} hours`,
      uniqueVisitors: visitors.rows || visitors,
    });
  } catch (error) {
    console.error('Error fetching unique visitors:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch unique visitors',
    });
  }
});

// ============================================================================
// ADMIN: Discovery Registration Management
// ============================================================================

router.post('/admin/discovery/register', async (req: Request, res: Response) => {
  if (!validateAnalyticsAccess(req, res)) return;
  
  try {
    console.log('🚀 Manual Solana discovery registration triggered');
    const results = await pingDiscoveryCrawlers();
    
    return res.json({
      success: true,
      message: 'Discovery registration completed',
      results,
      manifests: {
        solana: 'https://coinrailz.com/.well-known/solana.json',
        solanaActions: 'https://coinrailz.com/.well-known/solana-actions.json',
        solanaPay: 'https://coinrailz.com/.well-known/solana-pay.json',
        helius: 'https://coinrailz.com/.well-known/helius.json',
        openrpc: 'https://coinrailz.com/solana-openrpc.json'
      }
    });
  } catch (error) {
    console.error('Error in discovery registration:', error);
    return res.status(500).json({
      success: false,
      error: 'Discovery registration failed',
    });
  }
});

router.get('/admin/discovery/status', async (req: Request, res: Response) => {
  if (!validateAnalyticsAccess(req, res)) return;
  
  try {
    const status = getRegistryStatus();
    
    return res.json({
      success: true,
      status,
      manifests: {
        solana: '/.well-known/solana.json',
        solanaActions: '/.well-known/solana-actions.json',
        solanaPay: '/.well-known/solana-pay.json',
        helius: '/.well-known/helius.json',
        openrpc: '/public/solana-openrpc.json'
      }
    });
  } catch (error) {
    console.error('Error fetching discovery status:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch discovery status',
    });
  }
});

// ============================================================================
// INSTANT SOLANA WALLET: AI Agent Wallet Creation via CDP
// ============================================================================

const instantWalletSchema = z.object({
  agentId: z.string().min(1).max(100),
  name: z.string().min(1).max(100).optional(),
});

router.post('/instant-wallet', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const validation = instantWalletSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: validation.error.errors,
      });
    }

    const { agentId, name } = validation.data;

    // Check if CDP Solana is available
    const solanaStatus = coinbaseCDPService.getSolanaStatus();
    if (!solanaStatus.configured) {
      return res.status(503).json({
        success: false,
        error: 'Service not configured',
        message: 'Solana wallet creation requires CDP credentials. Contact support for access.',
        pricing: {
          priceUSD: '$1.00',
          description: 'Instant Solana Agent Wallet via Coinbase CDP'
        }
      });
    }

    // Create the Solana wallet
    const result = await coinbaseCDPService.createSolanaWallet({ agentId, name });

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: 'Wallet creation failed',
        message: result.error,
        agentId,
        latencyMs: Date.now() - startTime
      });
    }

    return res.status(201).json({
      success: true,
      wallet: {
        address: result.address,
        network: result.network,
        agentId: result.agentId,
        createdAt: result.createdAt
      },
      pricing: {
        priceUSD: '$1.00',
        description: 'Instant Solana Agent Wallet via Coinbase CDP'
      },
      latencyMs: Date.now() - startTime
    });

  } catch (error) {
    console.error('Error creating Solana wallet:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
      latencyMs: Date.now() - startTime
    });
  }
});

// GET endpoint for service info
router.get('/instant-wallet', async (req: Request, res: Response) => {
  const solanaStatus = coinbaseCDPService.getSolanaStatus();
  
  return res.json({
    service: 'Instant Solana Agent Wallet',
    description: 'Create production-ready Solana wallets for AI agents via Coinbase CDP. Sub-200ms signing, 225+ TPS, enterprise-grade security.',
    pricing: {
      priceUSD: '$1.00',
      currency: 'USDC'
    },
    features: [
      'Instant wallet creation via Coinbase CDP',
      'Sub-200ms transaction signing',
      '225+ TPS throughput',
      'Enterprise-grade security (AWS Nitro Enclaves)',
      'Policy controls (address allowlisting, value limits)',
      'No key management required'
    ],
    status: solanaStatus.configured ? 'available' : 'requires_configuration',
    network: 'solana-mainnet',
    method: 'POST',
    endpoint: '/solana-pay/instant-wallet',
    requestBody: {
      agentId: 'string (required) - Unique identifier for the AI agent',
      name: 'string (optional) - Human-readable wallet name'
    },
    exampleRequest: {
      agentId: 'my-trading-agent-001',
      name: 'Trading Bot Wallet'
    }
  });
});

// ============================================================================
// PAID PING: Discovery Ping Endpoint ($0.25 USDC)
// ============================================================================

const PING_PRICING = {
  priceUSD: '$0.25',
  priceUSDC: '0.25',
  priceSol: '0.001',
  amountLamports: 250000, // 0.25 USDC in micro-units (6 decimals)
  description: 'Solana Pay Discovery Ping - Service health and availability check',
  serviceSlug: 'solana-ping'
};

router.get('/ping', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const intentId = req.headers['x-intent-id'] as string;
  
  // Check for payment
  if (!intentId) {
    return res.status(402).json({
      error: 'Payment required',
      message: 'Missing x-intent-id header. Create a payment intent first.',
      pricing: PING_PRICING,
      createIntentEndpoint: '/solana-pay/intents',
      serviceSlug: PING_PRICING.serviceSlug,
      accepts: [
        {
          scheme: 'solana-pay',
          network: 'solana-mainnet',
          token: 'USDC',
          amount: PING_PRICING.priceUSDC,
          amountUSD: PING_PRICING.priceUSD,
          recipient: PLATFORM_WALLET
        }
      ]
    });
  }
  
  try {
    // Verify payment
    const verification = await solanaPaymentService.verifyPaidIntent(intentId);
    if (!verification.valid) {
      return res.status(402).json({
        error: 'Payment required',
        message: verification.error || 'Invalid or unpaid intent',
        pricing: PING_PRICING,
        createIntentEndpoint: '/solana-pay/intents',
        serviceSlug: PING_PRICING.serviceSlug
      });
    }
    
    // Validate intent is for correct service, token, and amount
    const intent = verification.intent;
    if (intent) {
      const intentAmount = parseFloat(intent.amount || '0');
      const tokenSymbol = intent.tokenSymbol?.toUpperCase();
      const serviceSlug = intent.serviceSlug;
      
      // Enforce service slug match - must be created specifically for ping
      if (serviceSlug !== PING_PRICING.serviceSlug && serviceSlug !== 'solana-ping') {
        return res.status(402).json({
          error: 'Invalid service intent',
          message: `Ping service requires intent for service slug '${PING_PRICING.serviceSlug}', received '${serviceSlug}'`,
          pricing: PING_PRICING,
          createIntentEndpoint: '/solana-pay/intents',
          serviceSlug: PING_PRICING.serviceSlug
        });
      }
      
      // Validate token and amount based on payment type
      const validTokens: string[] = [SOLANA_PAYMENT_TOKEN];
      if (!validTokens.includes(tokenSymbol || '')) {
        return res.status(402).json({
          error: 'Invalid payment token',
          message: `Ping service accepts ${SOLANA_PAYMENT_TOKEN}. Received ${tokenSymbol}`,
          pricing: PING_PRICING,
          createIntentEndpoint: '/solana-pay/intents',
          serviceSlug: PING_PRICING.serviceSlug
        });
      }
      
      // Enforce correct amount based on token type
      let expectedAmount: number;
      let tokenLabel: string;
      
      expectedAmount = 0.25;
      tokenLabel = SOLANA_PAYMENT_TOKEN;
      
      if (Math.abs(intentAmount - expectedAmount) > 0.0001) {
        return res.status(402).json({
          error: 'Incorrect payment amount',
          message: `Ping service requires exactly ${expectedAmount} ${tokenLabel}, received ${intentAmount}`,
          pricing: PING_PRICING,
          createIntentEndpoint: '/solana-pay/intents',
          serviceSlug: PING_PRICING.serviceSlug
        });
      }
    }
    
    // Payment verified - return full status
    const paymentServiceReady = solanaPaymentService.isReady();
    const cdpSolanaAvailable = !!(process.env.CDP_API_KEY_ID && process.env.CDP_PRIVATE_KEY);
    
    const status = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      latencyMs: Date.now() - startTime,
      paymentVerified: true,
      intentId,
      services: {
        solanaPayments: paymentServiceReady ? 'ready' : 'initializing',
        cdpSolanaWallet: cdpSolanaAvailable ? 'configured' : 'not_configured',
        webhookReceiver: 'ready',
        intentProcessing: paymentServiceReady ? 'ready' : 'initializing'
      },
      endpoints: {
        intents: '/solana-pay/intents',
        catalog: '/solana-pay/catalog',
        instantWallet: '/solana-pay/instant-wallet',
        webhook: '/solana-pay/webhook'
      },
      platform: {
        name: 'Coin Railz',
        version: '1.0.0',
        wallet: PLATFORM_WALLET,
        network: 'mainnet-beta'
      }
    };
    
    return res.status(200).json(status);
  } catch (error) {
    return res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      latencyMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
