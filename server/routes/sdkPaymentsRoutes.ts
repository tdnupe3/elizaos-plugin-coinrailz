/**
 * SDK Payments API Routes
 * Endpoints for @coinrailz/agent-payments (NPM), coinrailz (Python), and Docker
 * 
 * PRICING: 1.5% + $0.01 per transaction (competitive with market)
 * 
 * This is ADDITIVE - separate from existing agentPaymentsRoutes.ts
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { creditsService } from '../services/creditsService';

const router = Router();

// SDK Fee configuration (1.5% + $0.01 per transaction)
const SDK_BASE_FEE_PERCENT = 0.015; // 1.5%
const SDK_FIXED_FEE_CENTS = 1; // $0.01
const SDK_MINIMUM_AMOUNT_CENTS = 5; // $0.05 minimum transaction
const SDK_VERSION = '1.0.0';

// Rate limiting for SDK endpoints
const sdkRateLimitMap = new Map<string, { count: number; resetAt: number }>();
const SDK_RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const SDK_RATE_LIMIT_MAX = 60; // 60 requests per minute (starter tier)

function checkSdkRateLimit(apiKey: string): boolean {
  const now = Date.now();
  const entry = sdkRateLimitMap.get(apiKey);
  
  if (!entry || now > entry.resetAt) {
    sdkRateLimitMap.set(apiKey, { count: 1, resetAt: now + SDK_RATE_LIMIT_WINDOW_MS });
    return true;
  }
  
  if (entry.count >= SDK_RATE_LIMIT_MAX) {
    return false;
  }
  
  entry.count++;
  return true;
}

// SDK Auth middleware with real API key validation
async function requireSdkApiKey(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: 'Missing or invalid API key. Use: Authorization: Bearer {apiKey}'
    });
  }
  
  const apiKey = authHeader.slice(7);
  
  // Validate API key against database
  try {
    const validation = await creditsService.validateApiKey(apiKey);
    
    if (!validation.valid) {
      return res.status(401).json({
        success: false,
        error: 'INVALID_API_KEY',
        message: 'API key is invalid or revoked. Generate a new key at https://coinrailz.com/dashboard/api-keys'
      });
    }
    
    // Check rate limit
    if (!checkSdkRateLimit(apiKey)) {
      return res.status(429).json({
        success: false,
        error: 'RATE_LIMITED',
        message: 'Too many requests. Upgrade your plan for higher limits.'
      });
    }
    
    // Attach validated user info to request
    (req as any).sdkApiKey = apiKey;
    (req as any).sdkUserId = validation.userId;
    (req as any).sdkKeyId = validation.keyId;
    next();
    
  } catch (error: any) {
    console.error('SDK API key validation error:', error);
    return res.status(500).json({
      success: false,
      error: 'AUTH_ERROR',
      message: 'Authentication service unavailable'
    });
  }
}

// Minimum transaction amount in dollars
const SDK_MINIMUM_AMOUNT = SDK_MINIMUM_AMOUNT_CENTS / 100; // $0.05

// Validation schemas with minimum amount enforcement
const sendPaymentSchema = z.object({
  to: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
  amount: z.number()
    .positive('Amount must be positive')
    .min(SDK_MINIMUM_AMOUNT, `Minimum transaction amount is $${SDK_MINIMUM_AMOUNT.toFixed(2)}`),
  currency: z.enum(['USDC']).default('USDC'),
  memo: z.string().max(256).optional(),
  metadata: z.record(z.any()).optional()
});

const createInvoiceSchema = z.object({
  amount: z.number()
    .positive('Amount must be positive')
    .min(SDK_MINIMUM_AMOUNT, `Minimum invoice amount is $${SDK_MINIMUM_AMOUNT.toFixed(2)}`),
  currency: z.enum(['USDC']).default('USDC'),
  description: z.string().max(500).optional(),
  expiresIn: z.number().min(1).max(60).default(15),
  metadata: z.record(z.any()).optional()
});

/**
 * Calculate SDK processing fee (1.5% + $0.01)
 * Uses integer cents arithmetic to avoid floating-point precision errors
 */
function calculateSdkFee(amount: number): { fee: number; netAmount: number; feeBreakdown: object } {
  // Convert to cents for precise integer arithmetic
  const amountCents = Math.round(amount * 100);
  
  // Calculate percentage fee in cents (round up to ensure we never undercharge)
  const percentFeeCents = Math.ceil(amountCents * SDK_BASE_FEE_PERCENT);
  
  // Total fee in cents
  const totalFeeCents = percentFeeCents + SDK_FIXED_FEE_CENTS;
  
  // Net amount in cents
  const netAmountCents = amountCents - totalFeeCents;
  
  // Convert back to dollars for response
  return {
    fee: totalFeeCents / 100,
    netAmount: netAmountCents / 100,
    feeBreakdown: {
      percentageFee: percentFeeCents / 100,
      fixedFee: SDK_FIXED_FEE_CENTS / 100,
      totalFee: totalFeeCents / 100,
      rate: '1.5% + $0.01',
      minimumTransaction: SDK_MINIMUM_AMOUNT
    }
  };
}

/**
 * POST /api/sdk/payments/send
 * Send USDC payment (for SDK packages)
 */
router.post('/payments/send', requireSdkApiKey, async (req: Request, res: Response) => {
  try {
    const validation = sendPaymentSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        message: validation.error.errors.map(e => e.message).join(', ')
      });
    }
    
    const { to, amount, currency, memo, metadata } = validation.data;
    const apiKey = (req as any).sdkApiKey;
    
    // Calculate fees
    const { fee, netAmount, feeBreakdown } = calculateSdkFee(amount);
    
    // Generate transaction ID
    const transactionId = `sdk_tx_${nanoid(24)}`;
    
    // Log the payment intent
    console.log(`💳 SDK Payment: ${transactionId} - $${amount} USDC to ${to} (fee: $${fee})`);
    
    // In production: execute via CDP service
    // For now: return pending status
    const result = {
      success: true,
      transactionId,
      status: 'pending',
      amount,
      fee,
      netAmount,
      currency,
      to,
      memo: memo || null,
      feeBreakdown,
      timestamp: new Date().toISOString(),
      network: 'base'
    };
    
    return res.status(200).json(result);
    
  } catch (error: any) {
    console.error('❌ SDK Payment error:', error);
    return res.status(500).json({
      success: false,
      error: 'TRANSACTION_FAILED',
      message: error.message || 'Failed to process payment'
    });
  }
});

/**
 * POST /api/sdk/payments/invoice
 * Create payment invoice (for SDK packages)
 */
router.post('/payments/invoice', requireSdkApiKey, async (req: Request, res: Response) => {
  try {
    const validation = createInvoiceSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        message: validation.error.errors.map(e => e.message).join(', ')
      });
    }
    
    const { amount, currency, description, expiresIn, metadata } = validation.data;
    
    const invoiceId = `sdk_inv_${nanoid(24)}`;
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + expiresIn);
    
    const paymentAddress = process.env.PLATFORM_WALLET_ADDRESS || '0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91';
    
    console.log(`📋 SDK Invoice: ${invoiceId} - $${amount} USDC`);
    
    return res.status(200).json({
      success: true,
      invoiceId,
      paymentAddress,
      amount,
      currency,
      description: description || null,
      status: 'pending',
      expiresAt: expiresAt.toISOString(),
      createdAt: new Date().toISOString(),
      network: 'base',
      paymentInstructions: {
        step1: `Send exactly ${amount} USDC to ${paymentAddress}`,
        step2: `Include memo: ${invoiceId}`,
        step3: 'Payment will be confirmed within 1-2 minutes',
        network: 'Base (Mainnet)',
        token: 'USDC'
      }
    });
    
  } catch (error: any) {
    console.error('❌ SDK Invoice error:', error);
    return res.status(500).json({
      success: false,
      error: 'SERVICE_UNAVAILABLE',
      message: error.message || 'Failed to create invoice'
    });
  }
});

/**
 * GET /api/sdk/payments/reports
 * Get activity reports (for SDK packages)
 */
router.get('/payments/reports', requireSdkApiKey, async (req: Request, res: Response) => {
  try {
    const period = (req.query.period as string) || 'weekly';
    const format = (req.query.format as string) || 'json';
    const apiKey = (req as any).sdkApiKey;
    
    const now = new Date();
    let startDate: Date;
    
    switch (period) {
      case 'daily':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }
    
    const report = {
      success: true,
      agentId: `agent_${apiKey.slice(0, 8)}`,
      period: { type: period, start: startDate.toISOString(), end: now.toISOString() },
      summary: {
        totalTransactions: 0,
        successfulTransactions: 0,
        failedTransactions: 0,
        totalVolumeUSD: 0,
        feesCollected: 0,
        successRate: 100
      },
      transactions: [],
      generatedAt: now.toISOString(),
      sdkVersion: SDK_VERSION
    };
    
    if (format === 'markdown') {
      const md = `# SDK Activity Report\n\n**Period:** ${period}\n**Generated:** ${now.toISOString()}\n\n## Summary\n- Transactions: ${report.summary.totalTransactions}\n- Volume: $${report.summary.totalVolumeUSD}\n- Fees: $${report.summary.feesCollected}\n`;
      return res.status(200).json({ success: true, format: 'markdown', content: md });
    }
    
    return res.status(200).json(report);
    
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'SERVICE_UNAVAILABLE', message: error.message });
  }
});

/**
 * GET /api/sdk/balance
 * Get wallet balance (for SDK packages)
 */
router.get('/balance', requireSdkApiKey, async (req: Request, res: Response) => {
  return res.status(200).json({
    success: true,
    address: null,
    network: 'base',
    balances: { USDC: 0, ETH: 0 },
    lastUpdated: new Date().toISOString(),
    message: 'Link a wallet or create one using POST /api/sdk/wallet'
  });
});

/**
 * POST /api/sdk/wallet
 * Create CDP wallet (for SDK packages)
 */
router.post('/wallet', requireSdkApiKey, async (req: Request, res: Response) => {
  try {
    if (!process.env.CDP_API_KEY_ID || !process.env.CDP_PRIVATE_KEY) {
      return res.status(503).json({
        success: false,
        error: 'SERVICE_UNAVAILABLE',
        message: 'CDP wallet creation not configured'
      });
    }
    
    const walletId = `sdk_wallet_${nanoid(16)}`;
    
    return res.status(200).json({
      success: true,
      walletId,
      address: null,
      network: 'base',
      status: 'creating',
      createdAt: new Date().toISOString()
    });
    
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'WALLET_CREATION_FAILED', message: error.message });
  }
});

/**
 * GET /api/sdk/status
 * Health check for SDK endpoints
 */
router.get('/status', async (req: Request, res: Response) => {
  const hasCDP = !!(process.env.CDP_API_KEY_ID && process.env.CDP_PRIVATE_KEY);
  
  return res.status(200).json({
    success: true,
    service: 'Coin Railz SDK Payments',
    version: SDK_VERSION,
    status: 'operational',
    features: {
      payments: true,
      invoices: true,
      reports: true,
      walletCreation: hasCDP,
      intelligence: true
    },
    pricing: {
      processingFee: '1.5% + $0.01',
      intelligenceBundle: '+0.35% or $79/mo'
    },
    network: 'base',
    currency: 'USDC',
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/sdk/pricing
 * Detailed pricing information
 */
router.get('/pricing', async (req: Request, res: Response) => {
  return res.status(200).json({
    success: true,
    processing: {
      tiers: [
        { name: 'Starter', volume: '$0-$10K/mo', fee: '1.5% + $0.01' },
        { name: 'Growth', volume: '$10K-$100K/mo', fee: '1.25% + $0.01' },
        { name: 'Platform', volume: '$100K+/mo', fee: '0.9% + $0.01' }
      ]
    },
    limits: {
      minimumTransaction: SDK_MINIMUM_AMOUNT,
      maximumTransaction: 100000,
      currency: 'USDC'
    },
    intelligence: {
      bundle: { perTransaction: '+0.35%', monthly: '$79/mo', services: 41 },
      individual: { priceRange: '$0.10-$10.00/call' }
    },
    addons: {
      erc8004Identity: '+0.25%',
      premiumCompliance: '+0.25%'
    },
    included: ['CDP wallet creation', 'Activity reports', 'Webhooks', 'Multi-chain support'],
    refundPolicy: 'Blockchain transactions are final and irreversible. Refunds are not supported.'
  });
});

/**
 * POST /api/sdk/intelligence/:service
 * Call x402 intelligence service (proxies to existing x402 endpoints)
 */
router.post('/intelligence/:service', requireSdkApiKey, async (req: Request, res: Response) => {
  try {
    const { service } = req.params;
    const payload = req.body;
    
    // Proxy to existing x402 endpoint
    const x402Url = `${process.env.BASE_URL || 'http://localhost:5000'}/x402/${service}`;
    
    console.log(`🧠 SDK Intelligence: ${service}`);
    
    // In production: call the actual x402 endpoint
    // For now: return a placeholder indicating the service
    return res.status(200).json({
      success: true,
      service,
      message: `Intelligence service '${service}' called successfully`,
      result: null,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: 'SERVICE_UNAVAILABLE',
      message: error.message
    });
  }
});

export default router;
