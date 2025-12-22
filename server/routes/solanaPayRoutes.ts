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
  tokenSymbol: z.enum(['SOL', 'USDC']),
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
      tokens: ['SOL', 'USDC'],
      createIntentEndpoint: '/solana-pay/intents',
    },
  });
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
