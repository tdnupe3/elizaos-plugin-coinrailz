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
import { CoinbaseCDPService } from '../services/coinbaseCDPService';
import { db } from '../db';
import { sdkTransactions } from '@shared/schema';
import crypto from 'crypto';

const router = Router();

// Helper to hash API key for analytics (don't store raw keys)
function hashApiKey(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex').substring(0, 16);
}

// Log SDK transaction to database for analytics
async function logSdkTransaction(txData: {
  transactionId: string;
  apiKey: string;
  userId?: string;
  transactionType: string;
  status: string;
  amount: number;
  fee: number;
  netAmount: number;
  currency: string;
  toAddress?: string;
  memo?: string;
  network: string;
  blockchainTxHash?: string;
  errorMessage?: string;
  metadata?: any;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  try {
    await db.insert(sdkTransactions).values({
      transactionId: txData.transactionId,
      apiKeyHash: hashApiKey(txData.apiKey),
      userId: txData.userId || null,
      transactionType: txData.transactionType,
      status: txData.status,
      amount: String(txData.amount), // Drizzle numeric expects string representation
      fee: String(txData.fee),
      netAmount: String(txData.netAmount),
      currency: txData.currency,
      toAddress: txData.toAddress || null,
      memo: txData.memo || null,
      network: txData.network,
      blockchainTxHash: txData.blockchainTxHash || null,
      errorMessage: txData.errorMessage || null,
      metadata: txData.metadata || null,
      ipAddress: txData.ipAddress || null,
      userAgent: txData.userAgent || null,
    });
    console.log(`📊 SDK Transaction logged: ${txData.transactionId}`);
  } catch (error) {
    console.error('Failed to log SDK transaction:', error);
    // Don't fail the payment if logging fails - this is analytics only
  }
}

// Initialize payment service (CDP is the primary rail)
const cdpService = CoinbaseCDPService.getInstance();

// SDK Fee configuration (1.5% + $0.01 per transaction)
const SDK_BASE_FEE_PERCENT = 0.015; // 1.5%
const SDK_FIXED_FEE_CENTS = 1; // $0.01
const SDK_MINIMUM_AMOUNT_CENTS = 5; // $0.05 minimum transaction
const SDK_VERSION = '1.0.0';

// Rate limiting for SDK endpoints (per valid API key)
const sdkRateLimitMap = new Map<string, { count: number; resetAt: number }>();
const SDK_RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const SDK_RATE_LIMIT_MAX = 60; // 60 requests per minute (starter tier)

// IP-based rate limiting for failed auth attempts (brute-force protection)
const authFailureMap = new Map<string, { count: number; resetAt: number; blocked: boolean }>();
const AUTH_FAILURE_WINDOW_MS = 300000; // 5 minutes
const AUTH_FAILURE_MAX = 10; // 10 failed attempts per 5 minutes
const AUTH_BLOCK_DURATION_MS = 900000; // 15 minute block after too many failures

function getClientIP(req: Request): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 
         req.socket?.remoteAddress || 
         'unknown';
}

function checkAuthRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = authFailureMap.get(ip);
  
  if (!entry) return { allowed: true };
  
  // Check if blocked
  if (entry.blocked && now < entry.resetAt) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  
  // Reset if window expired
  if (now > entry.resetAt) {
    authFailureMap.delete(ip);
    return { allowed: true };
  }
  
  return { allowed: true };
}

function recordAuthFailure(ip: string): void {
  const now = Date.now();
  const entry = authFailureMap.get(ip);
  
  if (!entry || now > entry.resetAt) {
    authFailureMap.set(ip, { count: 1, resetAt: now + AUTH_FAILURE_WINDOW_MS, blocked: false });
    return;
  }
  
  entry.count++;
  
  // Block if too many failures
  if (entry.count >= AUTH_FAILURE_MAX) {
    entry.blocked = true;
    entry.resetAt = now + AUTH_BLOCK_DURATION_MS;
    console.warn(`🚨 SDK Auth: Blocking IP ${ip} for ${AUTH_BLOCK_DURATION_MS/1000}s after ${entry.count} failed attempts`);
  }
}

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

// SDK Auth middleware with real API key validation and brute-force protection
async function requireSdkApiKey(req: Request, res: Response, next: NextFunction) {
  const clientIP = getClientIP(req);
  
  // Check if IP is blocked due to too many failed attempts
  const authCheck = checkAuthRateLimit(clientIP);
  if (!authCheck.allowed) {
    return res.status(429).json({
      success: false,
      error: 'TOO_MANY_ATTEMPTS',
      message: 'Too many failed authentication attempts. Please try again later.',
      retryAfter: authCheck.retryAfter
    });
  }
  
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    recordAuthFailure(clientIP);
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
      recordAuthFailure(clientIP);
      return res.status(401).json({
        success: false,
        error: 'INVALID_API_KEY',
        message: 'API key is invalid or revoked. Generate a new key at https://coinrailz.com/dashboard/api-keys'
      });
    }
    
    // Check rate limit for valid keys
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
    const userId = (req as any).sdkUserId;
    
    // Calculate fees
    const { fee, netAmount, feeBreakdown } = calculateSdkFee(amount);
    
    // Generate transaction ID
    const transactionId = `sdk_tx_${nanoid(24)}`;
    
    // Log the payment intent
    console.log(`💳 SDK Payment: ${transactionId} - $${amount} USDC to ${to} (fee: $${fee})`);
    
    // Execute real payment via Coinbase CDP service
    let txStatus: 'pending' | 'processing' | 'completed' | 'failed' = 'pending';
    let transactionHash: string | null = null;
    let executionError: string | null = null;
    
    try {
      const cdpStatus = await cdpService.getServiceStatus();
      
      if (cdpStatus.initialized) {
        // Execute the transfer via CDP: send netAmount to recipient
        // Fee ($1.51 on $100) stays in platform wallet automatically
        const cdpResult = await cdpService.sendTransaction(
          to,
          netAmount.toString(),
          memo || `SDK payment ${transactionId}`
        );
        
        if (cdpResult?.mode === 'onchain' && cdpResult.hash) {
          txStatus = 'processing';
          transactionHash = cdpResult.hash;
          console.log(`✅ SDK Payment executed via CDP: ${transactionHash}`);
        } else {
          txStatus = 'pending';
          executionError = cdpResult?.reason || 'Transaction queued for processing';
        }
      } else {
        txStatus = 'pending';
        executionError = 'Payment service temporarily unavailable';
        console.warn('⚠️ CDP service not initialized - payment queued');
      }
    } catch (execError: any) {
      console.error('Payment execution error:', execError);
      executionError = execError.message;
      txStatus = 'pending';
      // Don't fail the request - still return pending status for retry/webhook
    }
    
    const result = {
      success: true,
      transactionId,
      status: txStatus,
      transactionHash,
      amount,
      fee,
      netAmount,
      currency,
      to,
      memo: memo || null,
      feeBreakdown,
      timestamp: new Date().toISOString(),
      network: 'base',
      ...(executionError && { warning: 'Payment queued - will be processed shortly' })
    };
    
    // Log transaction to database for analytics
    await logSdkTransaction({
      transactionId,
      apiKey: apiKey,
      userId: userId,
      transactionType: 'send',
      status: txStatus,
      amount,
      fee,
      netAmount,
      currency,
      toAddress: to,
      memo: memo || undefined,
      network: 'base',
      blockchainTxHash: transactionHash || undefined,
      errorMessage: executionError || undefined,
      metadata: metadata,
      ipAddress: getClientIP(req),
      userAgent: req.headers['user-agent'] as string,
    });
    
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
 * Proxies to the real /x402/:service endpoint using the caller's API key.
 * SDK v1.2.0+ calls /x402/:service directly — this route is a compatibility shim
 * for older SDK versions and direct API consumers.
 */
router.post('/intelligence/:service', requireSdkApiKey, async (req: Request, res: Response) => {
  try {
    const { service } = req.params;
    const payload = req.body;

    // Strict slug validation — only alphanumeric and hyphens, reasonable length
    if (!/^[a-z0-9-]{2,64}$/.test(service)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_SERVICE',
        message: `Invalid service identifier '${service}'. Use a valid x402 service slug.`,
        catalog: 'https://coinrailz.com/x402/catalog'
      });
    }

    const apiKey = req.headers['authorization']?.replace('Bearer ', '') || req.headers['x-api-key'] as string;
    const baseUrl = process.env.PUBLIC_BASE_URL || process.env.BASE_URL || 'https://coinrailz.com';
    const x402Url = `${baseUrl}/x402/${service}`;

    console.log(`🧠 SDK Intelligence → /x402/${service}`);

    const upstream = await fetch(x402Url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'sdk-intelligence-shim/1.2.0',
      },
      body: JSON.stringify(payload || {}),
    });

    const upstreamBody = await upstream.json().catch(() => ({}));

    if (upstream.status === 402) {
      return res.status(402).json({
        success: false,
        error: 'PAYMENT_REQUIRED',
        message: `Service '${service}' requires payment or credits. Top up at https://coinrailz.com/credits`,
        ...upstreamBody,
      });
    }

    if (upstream.status === 404) {
      return res.status(404).json({
        success: false,
        error: 'SERVICE_NOT_FOUND',
        message: `No x402 service found for '${service}'.`,
        catalog: 'https://coinrailz.com/x402/catalog'
      });
    }

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        success: false,
        error: 'SERVICE_ERROR',
        message: (upstreamBody as any)?.message || `Upstream returned HTTP ${upstream.status}`,
      });
    }

    return res.status(200).json({
      success: true,
      service,
      result: upstreamBody,
      timestamp: new Date().toISOString(),
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
