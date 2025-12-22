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
import { 
  solanaPaymentService, 
  heliusWebhookHandler,
  solanaDataServices,
  SERVICE_SLUGS,
  SERVICE_PRICING,
  type HeliusEnhancedPayload,
} from '../services/payments/solanaPay/index.js';

const router = Router();

const createIntentSchema = z.object({
  amount: z.string().regex(/^\d+(\.\d+)?$/, 'Amount must be a valid number'),
  tokenSymbol: z.enum(['SOL', 'USDC', 'USDT']),
  serviceName: z.string().min(1).max(100),
  serviceSlug: z.string().optional(),
  customerWallet: z.string().optional(),
  customerId: z.string().optional(),
  partnerId: z.string().optional(),
  isTestMode: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
});

router.post('/intents', async (req: Request, res: Response) => {
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

router.post('/webhook', async (req: Request, res: Response) => {
  try {
    // Helius uses Authorization header echo pattern for webhook auth
    const authHeader = req.headers['authorization'] as string | undefined;
    
    if (!heliusWebhookHandler.verifyAuthHeader(authHeader)) {
      console.warn('⚠️ Invalid Helius webhook authorization');
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
        minimumFee: {
          SOL: `${tier.minimumFeeSol} SOL`,
          USDC: `$${tier.minimumFeeUsdc} USDC`,
        },
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
      tokens: tokens.map(token => ({
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
  
  return res.json({
    status: isReady ? 'operational' : 'not_configured',
    chain: 'solana',
    network: 'mainnet-beta',
    features: {
      intents: true,
      webhooks: !!process.env.HELIUS_WEBHOOK_SECRET,
      tokens: ['SOL', 'USDC'],
    },
  });
});

router.get('/services', async (req: Request, res: Response) => {
  const services = solanaDataServices.getAvailableServices();
  
  return res.json({
    services,
    paymentInfo: {
      chain: 'solana',
      tokens: ['SOL', 'USDC', 'USDT'],
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
    network: "solana:mainnet",
    description: "Payment processing and data services for Solana-native AI agents. 0.5% fees, instant webhook settlement.",
    
    platform: {
      wallet: process.env.SOLANA_PUBLIC_KEY || "Hgby7VEo6vaPayM1G7kkjTqMAo4aCARoXA3ftWKz1m4k",
      fee_percentage: 0.005,
      minimum_fee_usdc: 0.25,
      minimum_fee_sol: 0.001
    },
    
    supported_tokens: [
      { symbol: "SOL", mint: "native", decimals: 9 },
      { symbol: "USDC", mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6 },
      { symbol: "USDT", mint: "Es9vMFrzaCERmnn4Xw4Jp9Dzk1XjCK8dygBBhPokv9wg", decimals: 6 }
    ],
    
    categories: ["data", "intelligence"],
    
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
        input: { mint: "Token mint address (e.g., SOL, USDC mint)" },
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

export default router;
