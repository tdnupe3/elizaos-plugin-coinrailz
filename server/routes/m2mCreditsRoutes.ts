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
import { getCanonicalServiceCount } from '../utils/serviceCount';
import { stripe } from '../services/stripeClient';
import { creditsService } from '../services/creditsService.js';
import { db, pool } from '../db.js';
import { paymentIntentTracking, apiKeys, freeCreditsClaimLog, endpointHits, sdkInstalls } from '../../shared/schema.js';
import { eq, gt, and, sql } from 'drizzle-orm';
import crypto from 'crypto';
import { emitFirstContactAsync, emitFunnelEventAsync } from '../services/funnelHelper.js';
import { provisionCreditsAndKey } from '../services/m2mProvisioningService.js';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is required for M2M credits endpoint');
}


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

// Sweep expired entries once per hour so the map does not grow indefinitely.
// Symbol.for guard prevents duplicate intervals if the module is re-evaluated (e.g. dev HMR).
const _SWEEP_KEY = Symbol.for('m2m_ip_ratelimit_sweep');
if (!(global as any)[_SWEEP_KEY]) {
  (global as any)[_SWEEP_KEY] = setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of ipPurchaseCounts.entries()) {
      if (now > record.resetAt) ipPurchaseCounts.delete(ip);
    }
  }, 24 * 60 * 60 * 1000); // runs once per day
  (global as any)[_SWEEP_KEY].unref?.(); // don't hold the event loop open if server shuts down cleanly
}

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
// POST /api/m2m/credits/checkout/session
// Create a Stripe Hosted Checkout Session — no Stripe.js or browser API required.
// Returns a checkoutUrl the operator visits once to enter their card.
// On payment success, Stripe webhook auto-provisions credits + API key.
// Poll GET /api/m2m/credits/checkout/status/:sessionId?token=<retrievalToken> to retrieve the key.
// ──────────────────────────────────────────────────────────────────────────────

router.post('/checkout/session', async (req: Request, res: Response) => {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
    || req.socket?.remoteAddress || 'unknown';

  const { amountUsd, email, keyName, autoRecharge } = req.body;
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

  // Validate autoRecharge settings if provided
  const arEnabled = autoRecharge?.enabled === true;
  const arThreshold = Number(autoRecharge?.thresholdUsd ?? 5);
  const arTopUp = Number(autoRecharge?.topUpUsd ?? amount);
  if (arEnabled && (arThreshold <= 0 || arTopUp <= 0)) {
    return res.status(400).json({ error: 'INVALID_AUTO_RECHARGE', message: 'thresholdUsd and topUpUsd must be positive numbers.' });
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
      // When autoRecharge is enabled, vault the card for future off-session charges
      ...(arEnabled ? { payment_intent_data: { setup_future_usage: 'off_session' } } : {}),
      success_url: `${baseUrl}/api/m2m/credits/checkout/status/${'{CHECKOUT_SESSION_ID}'}?paid=1`,
      cancel_url: `${baseUrl}/api/m2m/credits/checkout/cancel`,
      metadata: {
        source: 'm2m-hosted-checkout',
        amountUsd: String(amount),
        tier: ALLOWED_TIERS[amount].label,
        keyName: keyName || 'M2M API Key',
        ip,
        email: email || '',
        retrievalToken: crypto.randomBytes(16).toString('hex'),
        // Auto-recharge settings persisted for webhook to pick up
        autoRechargeEnabled: arEnabled ? 'true' : 'false',
        autoRechargeThresholdUsd: String(arThreshold),
        autoRechargeTopUpUsd: String(arTopUp),
      },
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60, // 30 minutes
    });

    console.log(`💳 Hosted checkout session created: ${session.id} | $${amount} | IP: ${ip}`);
    emitFirstContactAsync(ip, 'buy_page', '/api/m2m/credits/checkout/session');

    const retrievalToken = (session.metadata as any)?.retrievalToken as string;
    return res.status(200).json({
      success: true,
      sessionId: session.id,
      checkoutUrl: session.url,
      amountUsd: amount,
      tier: ALLOWED_TIERS[amount].label,
      expiresAt: new Date((session.expires_at) * 1000).toISOString(),
      retrievalToken,
      autoRecharge: arEnabled ? {
        enabled: true,
        thresholdUsd: arThreshold,
        topUpUsd: arTopUp,
        note: 'Card will be saved after payment. Balance auto-refills when it drops below threshold — no human needed.',
      } : {
        enabled: false,
        note: 'To enable, add autoRecharge: { enabled: true, thresholdUsd: 5, topUpUsd: 25 } to this request.',
      },
      nextStep: {
        description: 'Open checkoutUrl in any browser to complete payment. Then poll statusEndpoint with your retrievalToken to retrieve your API key.',
        statusEndpoint: `${baseUrl}/api/m2m/credits/checkout/status/${session.id}?token=${retrievalToken}`,
        note: 'Your API key will be ready within ~10 seconds of payment completion. Save the retrievalToken — it is required to retrieve your key.',
      },
    });
  } catch (err: any) {
    console.error('❌ Checkout session creation error:', err?.message);
    return res.status(500).json({ error: 'SESSION_CREATION_FAILED', message: 'Unable to create checkout session.' });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/m2m/credits/checkout/status/:sessionId?token=<retrievalToken>
// Poll after completing Hosted Checkout to retrieve your API key.
// Returns the key once. Requires sessionId + retrievalToken from POST /checkout/session.
// ──────────────────────────────────────────────────────────────────────────────

router.get('/checkout/status/:sessionId', async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const { token } = req.query;

  if (!sessionId || !sessionId.startsWith('cs_')) {
    return res.status(400).json({ error: 'INVALID_SESSION_ID', message: 'sessionId must start with cs_' });
  }
  if (!token) {
    return res.status(401).json({ error: 'TOKEN_REQUIRED', message: 'retrievalToken query param required. It was returned in the POST /checkout/session response.' });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Validate retrieval token against what was stored in Stripe metadata at creation time
    if (session.metadata?.retrievalToken !== token) {
      return res.status(403).json({ error: 'INVALID_TOKEN', message: 'retrievalToken does not match. Use the token returned from POST /checkout/session.' });
    }

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
    message: 'Checkout cancelled. Use GET /api/m2m/credits/trial for a free trial, or retry POST /api/m2m/credits/checkout/session.',
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
    description: `Multi-chain AI agent payment infrastructure — ${getCanonicalServiceCount()} services, 8 blockchains, API-key and x402 support.`,
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
            description: 'One-click checkout via Stripe — operator opens URL in browser, webhook auto-provisions key. Optional: enable auto-recharge so the card fires automatically when balance runs low.',
            method: 'POST',
            url: `${baseUrl}/api/m2m/credits/checkout/session`,
            body: { amountUsd: 10, email: 'optional@example.com', keyName: 'optional label' },
            bodyWithAutoRecharge: { amountUsd: 25, autoRecharge: { enabled: true, thresholdUsd: 5, topUpUsd: 25 } },
            curl: `curl -X POST ${baseUrl}/api/m2m/credits/checkout/session -H "Content-Type: application/json" -d '{"amountUsd":10}'`,
            curlWithAutoRecharge: `curl -X POST ${baseUrl}/api/m2m/credits/checkout/session -H "Content-Type: application/json" -d '{"amountUsd":25,"autoRecharge":{"enabled":true,"thresholdUsd":5,"topUpUsd":25}}'`,
            note: 'Returns checkoutUrl + retrievalToken. Pay in browser, then poll /api/m2m/credits/checkout/status/:sessionId?token=<retrievalToken> for your key. With autoRecharge, card is vaulted and fires automatically when balance drops below thresholdUsd.',
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
          webmcp: `${baseUrl}/.well-known/webmcp.json`,
          awi: `${baseUrl}/.well-known/awi.json`,
          mpp: `${baseUrl}/.well-known/mpp.json`,
          mcpIntegration: `${baseUrl}/.well-known/mcp-integration.json`,
          integrationGuide: `${baseUrl}/mcp-integration-guide`,
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
// Rate limited: 1 per trusted proxy-derived client IP per 7 days.
//   L1: in-memory Map (fast path, clears on restart)
//   L2: m2m_trial_reservations atomic DB gate (authoritative)
// Every hit (success, blocked, error) is logged to endpoint_hits for full
// traffic visibility including blocked retry attempts.
// Excludes internal/RFC-1918 IPs. Creates an m2m_ user and provisions a
// cr_live_ key with $5 credits and a 7-day expiry.
// ──────────────────────────────────────────────────────────────────────────────

const TRIAL_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// L1 in-memory cache — fast path, cleared on restart (DB is authoritative)
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

// Hash IP for privacy-safe storage (same approach as funnelHelper)
function hashIp(ip: string): string {
  return crypto.createHash('sha256').update(ip).digest('hex').substring(0, 16);
}

function normalizeClientIp(ip: string): string {
  return ip.startsWith('::ffff:') ? ip.substring(7) : ip;
}

function getTrialClaimKey(ip: string): string {
  const secret = process.env.TRIAL_IDENTITY_SECRET
    || process.env.SESSION_SECRET
    || process.env.ENCRYPTION_KEY;
  if (!secret) {
    throw new Error('Trial identity secret is not configured');
  }
  return crypto.createHmac('sha256', secret).update(normalizeClientIp(ip)).digest('hex');
}

async function reserveTrialClaim(ip: string): Promise<
  | { reserved: true; claimKey: string; reservationId: string; claimedAt: Date }
  | { reserved: false; claimedAt: Date }
> {
  const claimKey = getTrialClaimKey(ip);
  const reservationId = crypto.randomUUID();
  const result = await pool.query(
    `INSERT INTO m2m_trial_reservations
       (claim_key, reservation_id, ip_hash, status, claimed_at, updated_at)
     VALUES ($1, $2, $3, 'reserved', NOW(), NOW())
     ON CONFLICT (claim_key) DO UPDATE
       SET reservation_id = EXCLUDED.reservation_id,
           ip_hash = EXCLUDED.ip_hash,
           user_id = NULL,
           status = 'reserved',
           claimed_at = NOW(),
           updated_at = NOW()
       WHERE m2m_trial_reservations.claimed_at < NOW() - INTERVAL '7 days'
     RETURNING claim_key, reservation_id, claimed_at`,
    [claimKey, reservationId, hashIp(ip)],
  );

  if (result.rows.length > 0) {
    return {
      reserved: true,
      claimKey,
      reservationId,
      claimedAt: result.rows[0].claimed_at,
    };
  }

  const existing = await pool.query(
    `SELECT claimed_at FROM m2m_trial_reservations WHERE claim_key = $1`,
    [claimKey],
  );
  return {
    reserved: false,
    claimedAt: existing.rows[0]?.claimed_at ?? new Date(),
  };
}

// Write privacy-safe success telemetry. The reservation table, not this log, is authoritative.
function recordTrialClaimAsync(claimKey: string, userId: string, userAgent?: string): void {
  void db.insert(freeCreditsClaimLog).values({
    ipAddress: `hmac:${claimKey}`,
    fingerprint: claimKey,
    userId,
    sessionId: `trial_${claimKey.substring(0, 16)}`,
    userAgent: userAgent || null,
  }).catch((err: Error) => {
    console.error('⚠️ trial claim log write failed (non-blocking):', err.message);
  });
}

// Log every trial hit to endpoint_hits — fire-and-forget
function trackTrialHitAsync(ip: string, statusCode: number, userAgent?: string): void {
  void db.insert(endpointHits).values({
    endpoint: '/api/m2m/credits/trial',
    endpointType: 'trial',
    ipHash: hashIp(ip),
    userAgent: userAgent ? userAgent.substring(0, 255) : null,
    method: 'GET',
    statusCode,
  }).catch((err: Error) => {
    console.error('⚠️ trial endpoint_hit write failed (non-blocking):', err.message);
  });
}

// Record SDK adoption signal in sdk_installs — upsert keyed on ipHash, fire-and-forget
function recordSdkInstallAsync(ip: string, userAgent?: string): void {
  const ipHash = crypto.createHash('sha256').update(ip).digest('hex').substring(0, 12);
  const installId = `trial_${ipHash}`;
  const ua = userAgent || '';

  let sdkType = 'unknown';
  if (/pip\//i.test(ua) || /python/i.test(ua)) sdkType = 'python';
  else if (/\bnode\b/i.test(ua) || /node-fetch/i.test(ua)) sdkType = 'typescript-node';
  else if (/curl/i.test(ua)) sdkType = 'curl';
  else if (/httpx/i.test(ua)) sdkType = 'python-httpx';
  else if (/elizaos/i.test(ua) || /eliza/i.test(ua)) sdkType = 'elizaos-plugin';
  else if (/Go-http-client/i.test(ua)) sdkType = 'go';
  else if (/Java\//i.test(ua)) sdkType = 'java';
  else if (ua) sdkType = 'browser';

  // Extract version if UA contains coinrailz SDK version string (e.g. coinrailz-python/1.2.0)
  const versionMatch = ua.match(/coinrailz[^/]*\/(\d+\.\d+\.\d+)/i);
  const sdkVersion = versionMatch ? versionMatch[1] : 'trial';

  void db.insert(sdkInstalls).values({
    installId,
    sdkType,
    sdkVersion,
    environment: {},
    ipAddress: ip,
    userAgent: ua.substring(0, 512),
    totalRequests: 1,
    freeCallsUsed: 0,
    demoKeyIssued: false,
    convertedToPaid: false,
  }).onConflictDoUpdate({
    target: sdkInstalls.installId,
    set: {
      lastSeenAt: new Date(),
      totalRequests: sql`${sdkInstalls.totalRequests} + 1`,
      userAgent: ua.substring(0, 512),
    },
  }).catch((err: Error) => {
    console.error('⚠️ sdk_installs write failed (non-blocking):', err.message);
  });
}

router.get('/trial', async (req: Request, res: Response) => {
  // Express derives req.ip from the configured trusted proxy hop. Never parse
  // caller-controlled X-Forwarded-For directly here.
  const ip = normalizeClientIp(req.ip || req.socket?.remoteAddress || 'unknown');
  const userAgent = req.headers['user-agent'] as string | undefined;

  if (process.env.TRIALS_ENABLED === 'false') {
    trackTrialHitAsync(ip, 503, userAgent);
    return res.status(503).json({
      error: 'TRIALS_TEMPORARILY_DISABLED',
      message: 'Free trials are temporarily unavailable. Paid credit purchase remains available.',
      paidEndpoint: '/api/m2m/credits/purchase',
    });
  }

  if (isInternalIp(ip)) {
    trackTrialHitAsync(ip, 403, userAgent);
    return res.status(403).json({
      error: 'INTERNAL_IP',
      message: 'Trial keys are reserved for external agents. Use the paid M2M endpoint for internal testing.',
      paidEndpoint: '/api/m2m/credits/purchase',
    });
  }

  // UA guard: block empty/null user-agents from claiming free trials.
  // Rotating-IP scanners (e.g. Cloudflare fleet) with no UA were claiming a fresh
  // $5 trial on every new IP rotation. Legitimate agents always supply a User-Agent.
  // Feature flag: set TRIAL_REQUIRE_UA=false to disable if needed.
  const requireUA = process.env.TRIAL_REQUIRE_UA !== 'false';
  if (requireUA && (!userAgent || userAgent.trim() === '')) {
    console.log(`🚫 Trial DENIED (no UA): IP=${ip.substring(0, 15)}...`);
    trackTrialHitAsync(ip, 403, userAgent);
    return res.status(403).json({
      error: 'USER_AGENT_REQUIRED',
      message: 'A User-Agent header is required to claim a free trial. Automated scanners without a User-Agent are not eligible.',
      hint: 'Add a User-Agent header identifying your agent or application, then retry.',
      example: 'curl -A "MyAgent/1.0" https://coinrailz.com/api/m2m/credits/trial',
    });
  }

  const now = Date.now();

  // ── L1 check: in-memory Map (fast, cleared on restart) ──
  const cachedClaimedAt = trialClaimedByIp.get(ip);
  if (cachedClaimedAt && now - cachedClaimedAt < TRIAL_TTL_MS) {
    const retryAfterMs = TRIAL_TTL_MS - (now - cachedClaimedAt);
    const retryAfterDays = Math.ceil(retryAfterMs / (24 * 60 * 60 * 1000));
    const baseUrl = process.env.PUBLIC_BASE_URL || 'https://coinrailz.com';
    trackTrialHitAsync(ip, 429, userAgent);
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

  // ── L2 atomic reservation: authoritative across replicas and restarts ──
  let reservation: Awaited<ReturnType<typeof reserveTrialClaim>>;
  try {
    reservation = await reserveTrialClaim(ip);
  } catch (err: any) {
    console.error('❌ Trial reservation failed closed:', err?.message);
    trackTrialHitAsync(ip, 503, userAgent);
    return res.status(503).json({
      error: 'TRIAL_RESERVATION_UNAVAILABLE',
      message: 'Trial eligibility could not be verified. No key or credits were issued.',
      paidEndpoint: '/api/m2m/credits/purchase',
    });
  }

  if (!reservation.reserved) {
    const claimedAtMs = reservation.claimedAt.getTime();
    const retryAfterMs = TRIAL_TTL_MS - (now - claimedAtMs);
    const retryAfterDays = Math.ceil(retryAfterMs / (24 * 60 * 60 * 1000));
    const baseUrl = process.env.PUBLIC_BASE_URL || 'https://coinrailz.com';
    trialClaimedByIp.set(ip, claimedAtMs);
    trackTrialHitAsync(ip, 429, userAgent);
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

  // Reservation won; L1 is only an optimization from this point onward.
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
      paymentMethod: 'usdc',
      referenceId: `trial_${ipHash}_${now}`,
      description: `Free trial — $${TRIAL_CREDITS} credits (~80-100 service calls). IP hash: ${ipHash}`,
    });

    console.log(`🎁 Trial key provisioned: ${keyPrefix}... for IP hash ${ipHash} ($${TRIAL_CREDITS} credits)`);

    await pool.query(
      `UPDATE m2m_trial_reservations
       SET status = 'completed', user_id = $1, updated_at = NOW()
       WHERE claim_key = $2 AND reservation_id = $3`,
      [userId, reservation.claimKey, reservation.reservationId],
    );

    recordTrialClaimAsync(reservation.claimKey, userId, userAgent);
    trackTrialHitAsync(ip, 200, userAgent);
    recordSdkInstallAsync(ip, userAgent);

    emitFirstContactAsync(ip, 'direct_trial', '/api/m2m/credits/trial');
    emitFunnelEventAsync({ stage: 'trial_claimed', source: 'direct_trial', ip, apiKeyPrefix: keyPrefix, creditsAmount: TRIAL_CREDITS });

    return res.status(200).json({
      success: true,
      apiKey,
      keyPrefix,
      credits: TRIAL_CREDITS,
      currency: "USD",
      serviceCalls: `~80-100 calls across all ${getCanonicalServiceCount()} /x402/* services`,
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
    // Release only this request's reservation so a legitimate caller can retry.
    trialClaimedByIp.delete(ip);
    await pool.query(
      `DELETE FROM m2m_trial_reservations
       WHERE claim_key = $1 AND reservation_id = $2 AND status = 'reserved'`,
      [reservation.claimKey, reservation.reservationId],
    ).catch((cleanupErr: Error) => {
      console.error('⚠️ Failed to release trial reservation:', cleanupErr.message);
    });
    console.error(`❌ Trial key provisioning failed for IP hash ${ipHash}:`, err?.message);
    trackTrialHitAsync(ip, 500, userAgent);
    return res.status(500).json({
      error: 'PROVISIONING_FAILED',
      message: 'Trial key provisioning failed. Please retry in a few seconds.',
      retryable: true,
    });
  }
});

export default router;
