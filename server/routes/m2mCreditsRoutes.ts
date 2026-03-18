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
import { paymentIntentTracking, apiKeys } from '../../shared/schema.js';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { emitFirstContactAsync, emitFunnelEventAsync } from '../services/funnelHelper.js';
import { provisionCreditsAndKey } from '../services/m2mProvisioningService.js';

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

    emitFirstContactAsync(ip, 'direct_purchase', '/api/m2m/credits/purchase');
    emitFunnelEventAsync({ stage: 'credit_purchased', source: 'direct_purchase', ip, creditsAmount: amount });
    emitFunnelEventAsync({ stage: 'api_key_issued', source: 'direct_purchase', ip, apiKeyPrefix: result.keyPrefix, creditsAmount: amount });

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

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/m2m/checkout/session
// Create a Stripe Hosted Checkout Session — no Stripe.js or browser API required.
// Returns a checkoutUrl the operator visits once to enter their card.
// On payment success, Stripe webhook auto-provisions credits + API key.
// Poll GET /api/m2m/checkout/status/:sessionId to retrieve the key.
// ──────────────────────────────────────────────────────────────────────────────

router.post('/checkout/session', async (req: Request, res: Response) => {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
    || req.socket?.remoteAddress || 'unknown';

  const { amountUsd, email, keyName } = req.body;
  const amount = Number(amountUsd);

  if (!ALLOWED_TIERS[amount]) {
    return res.status(400).json({
      error: 'INVALID_AMOUNT',
      message: `amountUsd must be one of: ${Object.keys(ALLOWED_TIERS).join(', ')}`,
      tiers: Object.entries(ALLOWED_TIERS).map(([usd, info]) => ({
        amountUsd: Number(usd), tier: info.label, description: info.description,
      })),
    });
  }

  const baseUrl = process.env.PUBLIC_BASE_URL
    || `https://${req.headers.host}`;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Coin Railz M2M Credits — ${ALLOWED_TIERS[amount].label}`,
            description: ALLOWED_TIERS[amount].description,
          },
          unit_amount: amount * 100,
        },
        quantity: 1,
      }],
      customer_email: email || undefined,
      success_url: `${baseUrl}/api/m2m/checkout/status/${'{CHECKOUT_SESSION_ID}'}?paid=1`,
      cancel_url: `${baseUrl}/api/m2m/checkout/cancel`,
      metadata: {
        source: 'm2m-hosted-checkout',
        amountUsd: String(amount),
        tier: ALLOWED_TIERS[amount].label,
        keyName: keyName || 'M2M API Key',
        ip,
        email: email || '',
      },
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60, // 30 minutes
    });

    console.log(`💳 Hosted checkout session created: ${session.id} | $${amount} | IP: ${ip}`);
    emitFirstContactAsync(ip, 'buy_page', '/api/m2m/checkout/session');

    return res.status(200).json({
      success: true,
      sessionId: session.id,
      checkoutUrl: session.url,
      amountUsd: amount,
      tier: ALLOWED_TIERS[amount].label,
      expiresAt: new Date((session.expires_at) * 1000).toISOString(),
      nextStep: {
        description: 'Open checkoutUrl in any browser to complete payment. Then poll statusEndpoint to retrieve your API key.',
        statusEndpoint: `${baseUrl}/api/m2m/checkout/status/${session.id}`,
        note: 'Your API key will be ready within ~10 seconds of payment completion.',
      },
    });
  } catch (err: any) {
    console.error('❌ Checkout session creation error:', err?.message);
    return res.status(500).json({ error: 'SESSION_CREATION_FAILED', message: 'Unable to create checkout session.' });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/m2m/checkout/status/:sessionId
// Poll after completing Hosted Checkout to retrieve your API key.
// Returns the key once. Requires the sessionId from POST /checkout/session.
// ──────────────────────────────────────────────────────────────────────────────

router.get('/checkout/status/:sessionId', async (req: Request, res: Response) => {
  const { sessionId } = req.params;

  if (!sessionId || !sessionId.startsWith('cs_')) {
    return res.status(400).json({ error: 'INVALID_SESSION_ID', message: 'sessionId must start with cs_' });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      return res.status(200).json({
        success: false,
        sessionId,
        paymentStatus: session.payment_status,
        message: 'Payment not yet completed. Complete the checkout then poll again.',
        checkoutUrl: session.url,
      });
    }

    // Check provisioning status in our DB
    const tracking = await db.query.paymentIntentTracking.findFirst({
      where: eq(paymentIntentTracking.paymentIntentId, sessionId),
    });

    if (!tracking || tracking.status !== 'used') {
      return res.status(200).json({
        success: false,
        sessionId,
        paymentStatus: 'paid',
        message: 'Payment confirmed. API key provisioning in progress — retry in 5 seconds.',
        retryAfterSeconds: 5,
      });
    }

    // Key already retrieved
    const meta = tracking.metadata as any;
    if (meta?.keyDelivered) {
      return res.status(200).json({
        success: true,
        sessionId,
        alreadyDelivered: true,
        message: 'API key was already retrieved. Keys are shown once only.',
      });
    }

    // First retrieval — return key and mark as delivered
    if (!meta?.pendingApiKey) {
      return res.status(200).json({
        success: true,
        sessionId,
        message: 'Provisioned but key not stored in this session (may have been direct webhook). Contact support if you did not receive your key.',
      });
    }

    // Deliver the key and mark as delivered
    await db.update(paymentIntentTracking)
      .set({ metadata: { ...meta, pendingApiKey: null, keyDelivered: true, keyDeliveredAt: new Date().toISOString() } })
      .where(eq(paymentIntentTracking.paymentIntentId, sessionId));

    return res.status(200).json({
      success: true,
      apiKey: meta.pendingApiKey,
      keyPrefix: (meta.pendingApiKey as string).substring(0, 12) + '...',
      creditsAdded: Number(session.metadata?.amountUsd || 0),
      tier: session.metadata?.tier,
      warning: 'SAVE THIS API KEY — it will not be shown again.',
      usage: {
        header: 'X-API-KEY',
        example: `curl -H "X-API-KEY: ${meta.pendingApiKey}" https://coinrailz.com/x402/first-call`,
        catalogUrl: 'https://coinrailz.com/x402/catalog',
      },
    });

  } catch (err: any) {
    console.error('❌ Checkout status error:', err?.message);
    return res.status(500).json({ error: 'STATUS_CHECK_FAILED', message: 'Unable to retrieve session status.' });
  }
});

router.get('/checkout/cancel', (_req: Request, res: Response) => {
  res.status(200).json({
    message: 'Checkout cancelled. Use GET /api/m2m/credits/trial for a free trial, or retry POST /api/m2m/checkout/session.',
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/auth/capabilities
// Machine-readable list of all supported auth and payment modes.
// No authentication required. Safe for unauthenticated discovery.
// ──────────────────────────────────────────────────────────────────────────────

router.get('/capabilities', (req: Request, res: Response) => {
  const baseUrl = process.env.PUBLIC_BASE_URL || `https://${req.headers.host}`;

  res.status(200).json({
    service: 'Coin Railz',
    description: 'Multi-chain AI agent payment infrastructure — 60 services, 8 blockchains, API-key and x402 support.',
    authModes: [
      {
        mode: 'api_key',
        header: 'X-API-KEY',
        alternativeHeader: 'Authorization: Bearer <key>',
        description: 'Prepaid credits — fastest path. Works with any HTTP client. No wallet required.',
        obtain: {
          free_trial: {
            description: '$5 free credits (~80-100 calls), no payment required',
            method: 'GET',
            url: `${baseUrl}/api/m2m/credits/trial`,
            curl: `curl ${baseUrl}/api/m2m/credits/trial`,
          },
          hosted_checkout: {
            description: 'One-click checkout via Stripe — operator opens URL in browser, webhook auto-provisions key',
            method: 'POST',
            url: `${baseUrl}/api/m2m/checkout/session`,
            body: { amountUsd: 10, email: 'optional@example.com', keyName: 'optional label' },
            curl: `curl -X POST ${baseUrl}/api/m2m/checkout/session -H "Content-Type: application/json" -d '{"amountUsd":10}'`,
            note: 'Returns checkoutUrl. Pay in browser, then poll /api/m2m/checkout/status/:sessionId for your key.',
          },
          direct_card: {
            description: 'Programmatic card charge via Stripe PaymentMethod (requires pre-built pm_...)',
            method: 'POST',
            url: `${baseUrl}/api/m2m/credits/purchase`,
            body: { paymentMethodId: 'pm_...', amountUsd: 10, idempotencyKey: 'uuid-v4' },
            note: 'Requires a Stripe PaymentMethod ID — use Stripe.js or Stripe CLI to create one.',
          },
        },
        tiers: Object.entries(ALLOWED_TIERS).map(([usd, info]) => ({
          amountUsd: Number(usd), label: info.label, description: info.description,
        })),
        firstCall: {
          description: 'After obtaining a key, call any /x402/* service',
          curl: `curl -X POST ${baseUrl}/x402/first-call -H "X-API-KEY: cr_live_..." -H "Content-Type: application/json" -d '{}'`,
          price_usd: 0.05,
        },
      },
      {
        mode: 'x402_onchain',
        header: 'X-PAYMENT',
        description: 'On-chain USDC per-call payments using HTTP 402 protocol. No API key required.',
        supportedChains: ['base', 'ethereum', 'polygon', 'arbitrum', 'solana'],
        facilitators: [
          'https://api.cdp.coinbase.com/platform/v2/x402',
          'https://x402.dexter.cash',
        ],
        discoveryDocs: {
          manifest: `${baseUrl}/.well-known/x402.json`,
          instructions: `${baseUrl}/.well-known/agent-instructions.json`,
          agentCard: `${baseUrl}/.well-known/agent-card.json`,
        },
        firstCall: {
          url: `${baseUrl}/x402/first-call`,
          price_usd: 0.05,
          note: 'Send HTTP request. Receive 402 challenge. Use a CDP or Dexter wallet to sign and retry.',
        },
      },
    ],
    catalogUrl: `${baseUrl}/x402/catalog`,
    supportedServices: 60,
    docsUrl: `${baseUrl}/.well-known/agent-instructions.json`,
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/m2m/trial
// Free $5 trial API key — no payment, no crypto wallet required.
// Rate limited: 1 per IP per 7 days (in-memory, single-instance v1).
// Excludes internal/RFC-1918 IPs. Creates an m2m_ user and provisions a
// cr_live_ key with $5 credits and a 7-day expiry.
// ──────────────────────────────────────────────────────────────────────────────

const TRIAL_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const trialClaimedByIp = new Map<string, number>(); // ip → claimedAt timestamp

function isInternalIp(ip: string): boolean {
  return (
    ip === '127.0.0.1' || ip === '::1' ||
    ip.startsWith('10.') ||
    ip.startsWith('172.16.') || ip.startsWith('172.17.') ||
    ip.startsWith('172.18.') || ip.startsWith('172.19.') ||
    ip.startsWith('172.2') || ip.startsWith('172.3') ||
    ip.startsWith('192.168.')
  );
}

router.get('/trial', async (req: Request, res: Response) => {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
    || req.socket?.remoteAddress
    || 'unknown';

  if (isInternalIp(ip)) {
    return res.status(403).json({
      error: 'INTERNAL_IP',
      message: 'Trial keys are reserved for external agents. Use the paid M2M endpoint for internal testing.',
      paidEndpoint: '/api/m2m/credits/purchase',
    });
  }

  const now = Date.now();
  const claimedAt = trialClaimedByIp.get(ip);
  if (claimedAt && now - claimedAt < TRIAL_TTL_MS) {
    const retryAfterMs = TRIAL_TTL_MS - (now - claimedAt);
    const retryAfterDays = Math.ceil(retryAfterMs / (24 * 60 * 60 * 1000));
    const baseUrl = process.env.PUBLIC_BASE_URL || 'https://coinrailz.com';
    return res.status(429).json({
      error: 'TRIAL_ALREADY_CLAIMED',
      message: `Trial key already issued to this IP. Available again in ${retryAfterDays} day(s).`,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
      upgrade: {
        description: 'Purchase credits — no wait, same API key pattern',
        hostedCheckout: {
          description: 'No Stripe.js needed — open URL in any browser, key delivered via webhook',
          method: 'POST',
          url: `${baseUrl}/api/m2m/credits/checkout/session`,
          body: { amountUsd: 10 },
          curl: `curl -X POST ${baseUrl}/api/m2m/credits/checkout/session -H "Content-Type: application/json" -d '{"amountUsd":10}'`,
        },
        directCard: `${baseUrl}/api/m2m/credits/purchase`,
      },
    });
  }

  // Mark as claimed immediately (before DB ops — prevents duplicate provisioning on concurrent requests)
  trialClaimedByIp.set(ip, now);

  const ipHash = crypto.createHash('sha256').update(ip).digest('hex').substring(0, 12);
  const userId = `m2m_trial_${ipHash}`;
  const TRIAL_CREDITS = 5.00;

  try {
    // generateApiKey auto-creates the m2m_ user — must run BEFORE addCredits (FK: creditsAccounts.userId → users.id)
    const { apiKey, keyPrefix, keyId } = await creditsService.generateApiKey(userId, 'Free Trial Key');

    // Set expiry on the key
    await db.update(apiKeys)
      .set({ expiresAt: new Date(now + TRIAL_TTL_MS) })
      .where(eq(apiKeys.id, keyId));

    // Now add credits (user exists, creditsAccounts FK is satisfied)
    await creditsService.addCredits({
      userId,
      amount: TRIAL_CREDITS,
      paymentMethod: 'trial',
      referenceId: `trial_${ipHash}_${now}`,
      description: `Free trial — $${TRIAL_CREDITS} credits (~80-100 service calls). IP hash: ${ipHash}`,
    });

    console.log(`🎁 Trial key provisioned: ${keyPrefix}... for IP hash ${ipHash} ($${TRIAL_CREDITS} credits)`);

    emitFirstContactAsync(ip, 'direct_trial', '/api/m2m/credits/trial');
    emitFunnelEventAsync({ stage: 'trial_claimed', source: 'direct_trial', ip, apiKeyPrefix: keyPrefix, creditsAmount: TRIAL_CREDITS });

    return res.status(200).json({
      success: true,
      apiKey,
      keyPrefix,
      credits: TRIAL_CREDITS,
      currency: "USD",
      serviceCalls: "~80-100 calls across all 60 /x402/* services",
      expiresIn: "7 days",
      usage: {
        header: "X-API-KEY",
        example: `curl -H "X-API-KEY: ${apiKey}" https://coinrailz.com/x402/gas-price-oracle`,
        alternativeHeader: "Authorization: Bearer <key>"
      },
      upgradeAt: "/api/m2m/credits/purchase",
      note: "SAVE this key — it is returned once only and cannot be retrieved again.",
    });
  } catch (err: any) {
    // Undo the rate-limit claim so the agent can retry
    trialClaimedByIp.delete(ip);
    console.error(`❌ Trial key provisioning failed for IP hash ${ipHash}:`, err?.message);
    return res.status(500).json({
      error: 'PROVISIONING_FAILED',
      message: 'Trial key provisioning failed. Please retry in a few seconds.',
      retryable: true,
    });
  }
});

export default router;
