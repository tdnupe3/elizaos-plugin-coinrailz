/**
 * M2M CREDITS PURCHASE — Machine-to-Machine card payment → API key provisioning
 *
 * POST /api/m2m/credits/purchase
 *   No session required. Agent operator POSTs a Stripe paymentMethodId + credit tier.
 *   Server confirms the PaymentIntent, adds credits, generates cr_live_ API key.
 *   Returns apiKey once — caller must save it.
 *
 * GET /api/m2m/credits/purchase/:paymentIntentId
 *   Status check for payments that required 3DS action.
 *   Returns { status, provisioned } — re-provisions if payment succeeded after action.
 *
 * Security controls:
 *   - Strict allowlist for amountUsd (10 / 25 / 100 only)
 *   - idempotencyKey passed through to Stripe — duplicate calls are safe
 *   - paymentIntentId unique constraint in DB prevents double-crediting
 *   - 5 purchases per IP per hour rate limit
 *   - Keys generated once and never stored in plaintext
 */

import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { creditsService } from '../services/creditsService.js';
import { db } from '../db.js';
import { paymentIntentTracking } from '../../shared/schema.js';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is required for M2M credits endpoint');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16' as any,
});

const router = Router();

// Allowed credit pack tiers (USD)
const ALLOWED_TIERS: Record<number, { label: string; description: string }> = {
  10:  { label: 'Starter', description: '~200 service calls at avg pricing' },
  25:  { label: 'Growth',  description: '~500 service calls, best for recurring agents' },
  100: { label: 'Pro',     description: '~2,000 service calls, high-volume operations' },
};

// Simple in-memory rate limiter: 5 purchases per IP per hour
const ipPurchaseCounts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = ipPurchaseCounts.get(ip);
  if (!record || now > record.resetAt) {
    ipPurchaseCounts.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return true;
  }
  if (record.count >= 5) return false;
  record.count++;
  return true;
}

// Derive a stable userId from a paymentIntentId so re-provisioning (after 3DS) finds the same account
function m2mUserIdFromPaymentIntent(paymentIntentId: string): string {
  const hash = crypto.createHash('sha256').update(paymentIntentId).digest('hex').substring(0, 16);
  return `m2m_${hash}`;
}

/**
 * POST /api/m2m/credits/purchase
 *
 * Body:
 *   paymentMethodId  string   Stripe PaymentMethod ID (pm_...) — pre-collected via Stripe.js
 *   amountUsd        number   Must be 10, 25, or 100
 *   idempotencyKey   string   Caller-generated UUID — safe to retry on network failure
 *   email            string?  Optional — for Stripe receipt and account association
 *   keyName          string?  Optional label for the generated API key
 */
router.post('/purchase', async (req: Request, res: Response) => {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
    || req.socket?.remoteAddress
    || 'unknown';

  if (!checkRateLimit(ip)) {
    return res.status(429).json({
      error: 'RATE_LIMITED',
      message: 'Maximum 5 credit purchases per hour per IP. Please wait before retrying.',
      retryAfter: 3600,
    });
  }

  const { paymentMethodId, amountUsd, idempotencyKey, email, keyName } = req.body;

  // Validate required fields
  if (!paymentMethodId || typeof paymentMethodId !== 'string' || !paymentMethodId.startsWith('pm_')) {
    return res.status(400).json({
      error: 'INVALID_PAYMENT_METHOD',
      message: 'paymentMethodId must be a valid Stripe PaymentMethod ID (starts with pm_).',
      howToGet: 'Create a PaymentMethod via Stripe.js or the Stripe API before calling this endpoint.',
      stripeDocsUrl: 'https://stripe.com/docs/api/payment_methods/create',
    });
  }

  const amount = Number(amountUsd);
  if (!ALLOWED_TIERS[amount]) {
    return res.status(400).json({
      error: 'INVALID_AMOUNT',
      message: `amountUsd must be one of: ${Object.keys(ALLOWED_TIERS).join(', ')}`,
      tiers: Object.entries(ALLOWED_TIERS).map(([usd, info]) => ({
        amountUsd: Number(usd),
        tier: info.label,
        description: info.description,
      })),
    });
  }

  if (!idempotencyKey || typeof idempotencyKey !== 'string' || idempotencyKey.length < 8) {
    return res.status(400).json({
      error: 'MISSING_IDEMPOTENCY_KEY',
      message: 'idempotencyKey is required. Generate a UUID v4 and reuse it on retries.',
      example: crypto.randomUUID(),
    });
  }

  try {
    // Create and immediately confirm the PaymentIntent server-side.
    // off_session: true tells Stripe this is an unattended charge (no browser present).
    // Stripe will return requires_action if 3DS is needed.
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: amount * 100, // cents
        currency: 'usd',
        payment_method: paymentMethodId,
        confirm: true,
        off_session: true,
        receipt_email: email || undefined,
        metadata: {
          source: 'm2m-credits',
          amountUsd: String(amount),
          tier: ALLOWED_TIERS[amount].label,
          ip,
          keyName: keyName || 'M2M API Key',
        },
        description: `Coin Railz M2M Credits — ${ALLOWED_TIERS[amount].label} ($${amount})`,
      },
      { idempotencyKey }
    );

    const piId = paymentIntent.id;
    const userId = m2mUserIdFromPaymentIntent(piId);

    // Handle 3DS / additional action required — cannot auto-complete without browser
    if (paymentIntent.status === 'requires_action' || paymentIntent.status === 'requires_confirmation') {
      console.log(`⚠️ M2M purchase requires 3DS action: ${piId}`);
      return res.status(202).json({
        success: false,
        requiresAction: true,
        paymentIntentId: piId,
        clientSecret: paymentIntent.client_secret,
        message: 'This card requires 3D Secure authentication. Complete the action using the clientSecret, then call GET /api/m2m/credits/purchase/:paymentIntentId to retrieve your API key.',
        nextStep: {
          description: 'Confirm the PaymentIntent using Stripe.js or the Stripe API with the clientSecret, then poll the status endpoint.',
          statusEndpoint: `/api/m2m/credits/purchase/${piId}`,
          stripeConfirmUrl: 'https://stripe.com/docs/payments/3d-secure',
        },
      });
    }

    if (paymentIntent.status !== 'succeeded') {
      console.log(`❌ M2M purchase failed — status: ${paymentIntent.status} | PI: ${piId}`);
      return res.status(402).json({
        error: 'PAYMENT_FAILED',
        message: `Payment did not succeed. Status: ${paymentIntent.status}`,
        paymentIntentId: piId,
        suggestion: 'Verify the payment method is valid and has sufficient funds.',
      });
    }

    // Payment succeeded — provision credits and API key
    const result = await provisionCreditsAndKey({
      paymentIntentId: piId,
      userId,
      amount,
      email: email || `${userId}@m2m.coinrailz.com`,
      keyName: keyName || 'M2M API Key',
      ip,
    });

    if (result.alreadyProvisioned) {
      return res.status(200).json({
        success: true,
        alreadyProvisioned: true,
        message: 'This payment has already been provisioned. Your API key was returned in the original response.',
        paymentIntentId: piId,
        creditsAdded: amount,
        note: 'Save your API key from the first successful response — it is never stored in plaintext and cannot be retrieved.',
      });
    }

    console.log(`✅ M2M credits purchased: $${amount} | userId: ${userId} | key: ${result.keyPrefix}... | IP: ${ip}`);

    return res.status(200).json({
      success: true,
      paymentIntentId: piId,
      apiKey: result.apiKey,
      keyPrefix: result.keyPrefix,
      keyId: result.keyId,
      creditsAdded: amount,
      newBalance: result.newBalance,
      transactionId: result.transactionId,
      tier: ALLOWED_TIERS[amount].label,
      warning: 'SAVE THIS API KEY — it will not be shown again.',
      usage: {
        header: 'X-API-KEY',
        example: `curl -X POST https://coinrailz.com/x402/gas-price-oracle -H "X-API-KEY: ${result.apiKey}" -H "Content-Type: application/json" -d '{"chains":["base"]}'`,
        note: 'Include this key on every request to any /x402/* service. Credits are deducted per call at the published per-service price.',
        catalogUrl: 'https://coinrailz.com/x402/catalog',
        supportedServices: 60,
      },
    });

  } catch (err: any) {
    // Stripe card errors (declined, insufficient funds, etc.) — surface clearly
    if (err?.type === 'StripeCardError') {
      return res.status(402).json({
        error: 'CARD_DECLINED',
        message: err.message,
        declineCode: err.decline_code,
        suggestion: 'Try a different card or payment method.',
      });
    }

    console.error('❌ M2M credits purchase error:', err?.message || err);
    return res.status(500).json({
      error: 'PURCHASE_FAILED',
      message: 'An internal error occurred processing your purchase. Please retry.',
    });
  }
});

/**
 * GET /api/m2m/credits/purchase/:paymentIntentId
 *
 * Status check / key retrieval after 3DS.
 * If the PI has already been provisioned, returns confirmation only (key not re-sent).
 * If the PI succeeded but wasn't provisioned yet, provisions now and returns the key.
 */
router.get('/purchase/:paymentIntentId', async (req: Request, res: Response) => {
  const { paymentIntentId } = req.params;

  if (!paymentIntentId || !paymentIntentId.startsWith('pi_')) {
    return res.status(400).json({ error: 'INVALID_PAYMENT_INTENT_ID' });
  }

  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    // Check if already provisioned
    const existing = await db.query.paymentIntentTracking.findFirst({
      where: eq(paymentIntentTracking.paymentIntentId, paymentIntentId),
    });

    if (existing && existing.purpose === 'm2m-credits') {
      return res.status(200).json({
        success: true,
        alreadyProvisioned: true,
        paymentIntentId,
        status: paymentIntent.status,
        creditsAdded: (paymentIntent.amount / 100),
        message: 'Credits already provisioned for this payment. Your API key was returned in the original response.',
        note: 'API keys cannot be retrieved after initial issuance. Generate a new purchase if the key was lost.',
      });
    }

    if (paymentIntent.status !== 'succeeded') {
      return res.status(200).json({
        success: false,
        paymentIntentId,
        status: paymentIntent.status,
        message: paymentIntent.status === 'requires_action'
          ? 'Payment still requires 3DS action. Complete authentication via Stripe.js.'
          : `Payment status: ${paymentIntent.status}. Credits not provisioned.`,
      });
    }

    // PI succeeded but not yet provisioned — provision now
    const meta = paymentIntent.metadata || {};
    const amountUsd = Number(meta.amountUsd) || (paymentIntent.amount / 100);
    const userId = m2mUserIdFromPaymentIntent(paymentIntentId);
    const keyName = meta.keyName || 'M2M API Key';

    const result = await provisionCreditsAndKey({
      paymentIntentId,
      userId,
      amount: amountUsd,
      email: paymentIntent.receipt_email || `${userId}@m2m.coinrailz.com`,
      keyName,
      ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 'unknown',
    });

    if (result.alreadyProvisioned) {
      return res.status(200).json({
        success: true,
        alreadyProvisioned: true,
        paymentIntentId,
        message: 'Credits already provisioned.',
      });
    }

    return res.status(200).json({
      success: true,
      paymentIntentId,
      apiKey: result.apiKey,
      keyPrefix: result.keyPrefix,
      keyId: result.keyId,
      creditsAdded: amountUsd,
      newBalance: result.newBalance,
      transactionId: result.transactionId,
      warning: 'SAVE THIS API KEY — it will not be shown again.',
      usage: {
        header: 'X-API-KEY',
        example: `curl -X POST https://coinrailz.com/x402/gas-price-oracle -H "X-API-KEY: ${result.apiKey}" -H "Content-Type: application/json" -d '{"chains":["base"]}'`,
        catalogUrl: 'https://coinrailz.com/x402/catalog',
      },
    });

  } catch (err: any) {
    console.error('❌ M2M status check error:', err?.message || err);
    return res.status(500).json({ error: 'STATUS_CHECK_FAILED', message: 'Unable to retrieve payment status.' });
  }
});

/**
 * Shared provisioning logic: add credits + generate API key, with idempotency guard.
 * Uses paymentIntentTracking table's unique(paymentIntentId) constraint as the dedup lock.
 */
async function provisionCreditsAndKey(params: {
  paymentIntentId: string;
  userId: string;
  amount: number;
  email: string;
  keyName: string;
  ip: string;
}): Promise<{
  alreadyProvisioned: boolean;
  apiKey?: string;
  keyPrefix?: string;
  keyId?: string;
  newBalance?: number;
  transactionId?: number;
}> {
  const { paymentIntentId, userId, amount, email, keyName } = params;

  // Step 1: Record the payment intent — unique constraint prevents double-execution
  try {
    await db.insert(paymentIntentTracking).values({
      paymentIntentId,
      customerEmail: email,
      amount: Math.round(amount * 100),
      currency: 'usd',
      purpose: 'm2m-credits',
      taskDescription: `M2M Credits — $${amount}`,
      metadata: { userId, amount, keyName, source: 'm2m-credits' },
      status: 'used',
    });
  } catch (insertErr: any) {
    // Unique constraint violation = already provisioned
    if (insertErr?.code === '23505' || insertErr?.message?.includes('unique')) {
      return { alreadyProvisioned: true };
    }
    throw insertErr;
  }

  // Step 2: Add credits to account
  const creditResult = await creditsService.addCredits({
    userId,
    amount,
    paymentMethod: 'stripe-m2m',
    referenceId: paymentIntentId,
    description: `M2M card purchase — $${amount} via Stripe`,
    metadata: { source: 'm2m-credits', paymentIntentId, email },
  });

  // Step 3: Generate API key
  const keyResult = await creditsService.generateApiKey(userId, keyName);

  return {
    alreadyProvisioned: false,
    apiKey: keyResult.apiKey,
    keyPrefix: keyResult.keyPrefix,
    keyId: keyResult.keyId,
    newBalance: creditResult.newBalance,
    transactionId: creditResult.transactionId,
  };
}

export default router;
