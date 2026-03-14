/**
 * M2M CREDITS PURCHASE — Machine-to-Machine card payment → API key provisioning
 *
 * POST /api/m2m/credits/purchase
 *   No session required. Agent operator POSTs a Stripe paymentMethodId + credit tier.
 *   Server confirms the PaymentIntent, adds credits, generates cr_live_ API key.
 *   Returns apiKey once — caller must save it.
 *
 * GET /api/m2m/credits/purchase/:paymentIntentId?cs=<clientSecret>
 *   Status check / key retrieval after 3DS.
 *   Requires the Stripe clientSecret (returned in the 202 response) as proof of ownership.
 *   Only the original POST caller has the clientSecret — prevents PI-ID probing.
 *
 * Security controls:
 *   - Strict allowlist for amountUsd (10 / 25 / 100 only)
 *   - idempotencyKey passed through to Stripe — duplicate calls are safe at Stripe level
 *   - Two-phase provisioning: status='pending' → 'used', crash-safe with 2-min recovery
 *   - GET requires clientSecret proof + PI metadata validation (source=m2m-credits)
 *   - 5 purchases per IP per hour rate limit (in-memory, acceptable for single-instance v1)
 *   - Keys generated once and never stored in plaintext (bcrypt hashed)
 */

import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { creditsService } from '../services/creditsService.js';
import { db } from '../db.js';
import { paymentIntentTracking, creditTransactions } from '../../shared/schema.js';
import { eq, and } from 'drizzle-orm';
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
  5:   { label: 'Intro',   description: '~80-100 service calls — ideal for first test run' },
  10:  { label: 'Starter', description: '~200 service calls at avg pricing' },
  25:  { label: 'Growth',  description: '~500 service calls, best for recurring agents' },
  100: { label: 'Pro',     description: '~2,000 service calls, high-volume operations' },
};

// Simple in-memory rate limiter: 5 purchases per IP per hour
// Acceptable for v1 single-instance. Move to Redis for multi-instance/production scale.
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
      message: 'idempotencyKey is required (min 8 chars). Generate a UUID v4 and reuse it on retries.',
      example: crypto.randomUUID(),
    });
  }

  try {
    // Create and immediately confirm the PaymentIntent server-side.
    // off_session: true tells Stripe this is an unattended charge (no browser present).
    // Stripe returns requires_action if 3DS is needed for this card.
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
        message: 'This card requires 3D Secure authentication. Complete the action using the clientSecret via Stripe.js, then call the statusEndpoint with your clientSecret to retrieve your API key.',
        nextStep: {
          description: 'After completing 3DS via Stripe.js, pass your clientSecret as the ?cs= query param to retrieve your key.',
          statusEndpoint: `/api/m2m/credits/purchase/${piId}`,
          statusNote: 'Add ?cs=<your_clientSecret_from_above> to the status endpoint URL to prove ownership.',
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
    });

    if (result.inProgress) {
      return res.status(409).json({
        error: 'PROVISIONING_IN_PROGRESS',
        message: 'A previous provisioning attempt is in progress. Retry in 30 seconds.',
        retryAfter: 30,
      });
    }

    if (result.alreadyProvisioned) {
      return res.status(200).json({
        success: true,
        alreadyProvisioned: true,
        message: 'This payment has already been provisioned. Your API key was returned in the original response.',
        paymentIntentId: piId,
        creditsAdded: amount,
        note: 'API keys are shown once only and never stored in plaintext. Use the status endpoint with your clientSecret if you need to verify provision status.',
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
 * GET /api/m2m/credits/purchase/:paymentIntentId?cs=<clientSecret>
 *
 * Status check / key retrieval after 3DS authentication.
 *
 * SECURITY: Requires the Stripe clientSecret (?cs= query param) as proof of ownership.
 * The clientSecret is only returned to the original POST caller in the 202 response.
 * This prevents PI-ID probing attacks where a third party tries to retrieve keys
 * by guessing or observing PaymentIntent IDs.
 *
 * Also validates that the PI is a genuine m2m-credits purchase (source metadata check).
 */
router.get('/purchase/:paymentIntentId', async (req: Request, res: Response) => {
  const { paymentIntentId } = req.params;
  const clientSecret = req.query.cs as string;

  if (!paymentIntentId || !paymentIntentId.startsWith('pi_')) {
    return res.status(400).json({
      error: 'INVALID_PAYMENT_INTENT_ID',
      message: 'paymentIntentId must start with pi_',
    });
  }

  // Require clientSecret proof of ownership
  if (!clientSecret || typeof clientSecret !== 'string') {
    return res.status(401).json({
      error: 'CLIENT_SECRET_REQUIRED',
      message: 'Include ?cs=<clientSecret> to verify ownership of this payment. The clientSecret was returned in the original 202 response.',
    });
  }

  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    // Verify clientSecret matches — proves caller was the original requester
    if (paymentIntent.client_secret !== clientSecret) {
      return res.status(403).json({
        error: 'INVALID_CLIENT_SECRET',
        message: 'clientSecret does not match this PaymentIntent. Only the original requester can check status.',
      });
    }

    // Validate this is an m2m-credits payment — prevents credits minting from unrelated Stripe PIs
    if (paymentIntent.metadata?.source !== 'm2m-credits') {
      return res.status(403).json({
        error: 'NOT_M2M_CREDITS_PAYMENT',
        message: 'This PaymentIntent was not created via the M2M credits purchase endpoint.',
      });
    }

    // Validate amount is in allowed tiers
    const amountUsd = paymentIntent.amount / 100;
    if (!ALLOWED_TIERS[amountUsd]) {
      return res.status(403).json({
        error: 'INVALID_AMOUNT_ON_RECORD',
        message: `PaymentIntent amount ($${amountUsd}) is not a valid M2M credit tier.`,
      });
    }

    // Check if already provisioned
    const existing = await db.query.paymentIntentTracking.findFirst({
      where: eq(paymentIntentTracking.paymentIntentId, paymentIntentId),
    });

    if (existing && existing.purpose === 'm2m-credits' && existing.status === 'used') {
      return res.status(200).json({
        success: true,
        alreadyProvisioned: true,
        paymentIntentId,
        status: paymentIntent.status,
        creditsAdded: amountUsd,
        message: 'Credits already provisioned. Your API key was returned in the original response.',
        note: 'API keys cannot be retrieved after initial issuance. Contact support if the key was lost.',
      });
    }

    if (paymentIntent.status !== 'succeeded') {
      return res.status(200).json({
        success: false,
        paymentIntentId,
        status: paymentIntent.status,
        message: paymentIntent.status === 'requires_action'
          ? 'Payment still requires 3DS action. Complete authentication via Stripe.js first.'
          : `Payment status: ${paymentIntent.status}. Credits not yet provisioned.`,
      });
    }

    // PI succeeded and not yet provisioned (or pending from a previous crashed attempt) — provision now
    const meta = paymentIntent.metadata || {};
    const userId = m2mUserIdFromPaymentIntent(paymentIntentId);
    const keyName = meta.keyName || 'M2M API Key';
    const email = paymentIntent.receipt_email || `${userId}@m2m.coinrailz.com`;

    const result = await provisionCreditsAndKey({
      paymentIntentId,
      userId,
      amount: amountUsd,
      email,
      keyName,
    });

    if (result.inProgress) {
      return res.status(409).json({
        error: 'PROVISIONING_IN_PROGRESS',
        message: 'A previous provisioning attempt is in progress. Retry in 30 seconds.',
        retryAfter: 30,
      });
    }

    if (result.alreadyProvisioned) {
      return res.status(200).json({
        success: true,
        alreadyProvisioned: true,
        paymentIntentId,
        message: 'Credits already provisioned.',
        note: 'API keys cannot be retrieved after initial issuance.',
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
 * Crash-safe provisioning: add credits + generate API key with two-phase status tracking.
 *
 * Phase 1: Insert tracking row with status='pending' (locks the provisioning slot)
 * Phase 2: Do the work (addCredits + generateApiKey)
 * Phase 3: Update tracking row to status='used'
 *
 * On retry:
 *   - status='used': fully provisioned → return alreadyProvisioned
 *   - status='pending' AND < 2 minutes old: in-flight → return inProgress (caller retries)
 *   - status='pending' AND > 2 minutes old: assumed crash → delete and reattempt
 */
async function provisionCreditsAndKey(params: {
  paymentIntentId: string;
  userId: string;
  amount: number;
  email: string;
  keyName: string;
}): Promise<{
  alreadyProvisioned?: boolean;
  inProgress?: boolean;
  apiKey?: string;
  keyPrefix?: string;
  keyId?: string;
  newBalance?: number;
  transactionId?: number;
}> {
  const { paymentIntentId, userId, amount, email, keyName } = params;
  const CRASH_RECOVERY_MS = 2 * 60 * 1000; // 2 minutes

  // Check for an existing tracking row before attempting insert
  const existing = await db.query.paymentIntentTracking.findFirst({
    where: eq(paymentIntentTracking.paymentIntentId, paymentIntentId),
  });

  if (existing && existing.purpose === 'm2m-credits') {
    if (existing.status === 'used') {
      return { alreadyProvisioned: true };
    }
    if (existing.status === 'pending') {
      const age = Date.now() - (existing.usedAt?.getTime() || existing.createdAt?.getTime() || 0);
      if (age < CRASH_RECOVERY_MS) {
        // Another request is actively provisioning — tell caller to retry
        return { inProgress: true };
      }
      // Previous attempt is stale (crashed) — delete and reattempt
      console.warn(`⚠️ M2M provisioning recovery: stale pending row for ${paymentIntentId} (${Math.round(age / 1000)}s old), retrying`);
      await db.delete(paymentIntentTracking)
        .where(and(
          eq(paymentIntentTracking.paymentIntentId, paymentIntentId),
          eq(paymentIntentTracking.purpose, 'm2m-credits')
        ));
    }
  }

  // Phase 1: Acquire provisioning lock with status='pending'
  try {
    await db.insert(paymentIntentTracking).values({
      paymentIntentId,
      customerEmail: email,
      amount: Math.round(amount * 100),
      currency: 'usd',
      purpose: 'm2m-credits',
      taskDescription: `M2M Credits — $${amount}`,
      metadata: { userId, amount, keyName, source: 'm2m-credits' },
      status: 'pending',
    });
  } catch (insertErr: any) {
    // Concurrent request beat us to the insert — they're handling it
    if (insertErr?.code === '23505' || insertErr?.message?.includes('unique')) {
      return { inProgress: true };
    }
    throw insertErr;
  }

  // Phase 2: Provision credits and API key — idempotent on crash recovery
  try {
    // Check if credits were already added (covers partial-failure: addCredits succeeded but crash before generateApiKey)
    const existingCredit = await db.query.creditTransactions.findFirst({
      where: eq(creditTransactions.referenceId, paymentIntentId),
    });

    let creditResult: { newBalance: number; transactionId: number };

    if (existingCredit) {
      // Credits already added — skip to key generation (crash recovery after addCredits succeeded)
      console.warn(`⚠️ M2M crash recovery: credits already exist for ${paymentIntentId}, skipping addCredits`);
      const balance = await creditsService.getBalance(userId);
      creditResult = { newBalance: balance, transactionId: existingCredit.id };
    } else {
      creditResult = await creditsService.addCredits({
        userId,
        amount,
        paymentMethod: 'stripe-m2m',
        referenceId: paymentIntentId,
        description: `M2M card purchase — $${amount} via Stripe`,
        metadata: { source: 'm2m-credits', paymentIntentId, email },
      });
    }

    const keyResult = await creditsService.generateApiKey(userId, keyName);

    // Phase 3: Mark provisioning complete
    await db.update(paymentIntentTracking)
      .set({ status: 'used' })
      .where(eq(paymentIntentTracking.paymentIntentId, paymentIntentId));

    return {
      apiKey: keyResult.apiKey,
      keyPrefix: keyResult.keyPrefix,
      keyId: keyResult.keyId,
      newBalance: creditResult.newBalance,
      transactionId: creditResult.transactionId,
    };

  } catch (workErr: any) {
    // Work failed after locking — log prominently for manual recovery if needed
    console.error(`❌ M2M provisioning work failed for ${paymentIntentId}:`, workErr?.message);
    // Leave status='pending' — the 2-minute recovery window will allow retry
    throw workErr;
  }
}

export default router;
