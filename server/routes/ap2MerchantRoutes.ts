/**
 * AP2 v0.2 Merchant Endpoint — Coin Railz
 *
 * Implements Google's Agent Payments Protocol (AP2) v0.2 as a merchant endpoint.
 * Transport: A2A JSON-RPC 2.0 (distinct from our HTTP+JSON A2A endpoint at /a2a/v1)
 * Spec: https://ap2-protocol.org/specification/
 *
 * Supported payment methods:
 *   X402  — USDC on Base or Solana (crypto micropayments, per-call)
 *   CARD  — Visa, Mastercard, Amex via Stripe (purchases credits for ongoing API access)
 *   VISA, MASTERCARD, AMEX, STRIPE, PAYMENT_CARD — aliases for CARD
 *
 * Card payment flow:
 *   1. Agent submits PaymentMandate with method_name = CARD and a Stripe pm_ token
 *   2. We charge via Stripe, add credits to agent's account, generate API key
 *   3. Agent uses API key (X-Internal-User-ID or api-key header) to call any x402 service
 *   4. Credits are deducted per call (existing hybrid payment middleware handles this)
 *   If no Stripe token: return checkout URL for human-present card entry.
 *
 * x402 payment flow:
 *   1. Agent submits PaymentMandate with method_name = X402
 *   2. We return x402 payment instructions (endpoint, wallet, chain, facilitator)
 *   3. Agent pays on-chain, resubmits with X-PAYMENT header
 *
 * Mandate Authorization (V0.1):
 *   user_authorization = "sha256:" + SHA-256(mandate_id|timestamp|amount|currency|method|service_id)
 *   This proves the agent constructed the mandate and ties the auth to specific fields.
 *   Replay protection: each payment_mandate_id is accepted only once within its TTL window.
 *
 * V1 upgrade path: replace mandate hash with full ECDSA W3C VC proof once AP2 ecosystem matures.
 */

import { Router, Request, Response } from 'express';
import { stripe as _stripeFactory } from '../services/stripeClient';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { serviceCatalogService } from '../services/serviceCatalogService';
import { getCanonicalServiceCount } from '../utils/serviceCount';
import { creditsService } from '../services/creditsService';
import { db } from '../db';
import { a2aInteractions } from '../../shared/schema';
import { getCanonicalPayableNetworks, PUBLIC_DISCOVERY_VERSIONS } from '../config/publicDiscoveryConfig';

function trackAP2Hit(req: Request, opts: {
  requestId?: string;
  matched: boolean;
  resourceId?: string;
  queryText?: string;
  statusCode: number;
  responseTimeMs: number;
}) {
  const clientIP = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress;
  db.insert(a2aInteractions).values({
    requestId: opts.requestId,
    endpoint: req.originalUrl.split('?')[0],
    protocol: 'ap2',
    queryText: opts.queryText?.slice(0, 2000),
    matched: opts.matched,
    resourceId: opts.resourceId,
    statusCode: opts.statusCode,
    responseTimeMs: opts.responseTimeMs,
    ipAddress: clientIP?.slice(0, 100),
    userAgent: req.headers['user-agent']?.slice(0, 1000),
    walletAddress: (req.headers['x-wallet-address'] || req.headers['x-payer-address']) as string | undefined,
    trackingId: (req.headers['x-tracking-id']) as string | undefined,
  }).catch(() => {});
}

const router = Router();

const BASE_URL = process.env.PUBLIC_BASE_URL || 'https://coinrailz.com';

/**
 * Helper to convert ServiceCatalogEntry to the format needed by AP2 availableServices
 */
function toAp2Service(entry: any) {
  return {
    id: entry.id,
    name: entry.name,
    priceUsd: parseFloat(entry.priceUSD.replace('$', '')) || 0.25,
    endpoint: `${BASE_URL}${entry.endpoint}`
  };
}

const MANDATE_TTL_MS = 5 * 60 * 1000;
const AMOUNT_TOLERANCE = 0.20;
const CARD_MIN_AMOUNT = 1.00;
const CARD_MAX_AMOUNT = 2500.00;

const CARD_PAYMENT_METHODS = new Set([
  'CARD', 'VISA', 'MASTERCARD', 'AMEX', 'STRIPE',
  'PAYMENT_CARD', 'CREDIT_CARD', 'DEBIT_CARD'
]);

// ─── Mandate Authorization ────────────────────────────────────────────────────
// Replay protection: track used mandate IDs within the TTL window.
// Key = payment_mandate_id, Value = timestamp when first accepted.
const usedMandateIds = new Map<string, number>();

function cleanupUsedMandates(): void {
  const cutoff = Date.now() - MANDATE_TTL_MS * 2;
  for (const [id, usedAt] of usedMandateIds.entries()) {
    if (usedAt < cutoff) usedMandateIds.delete(id);
  }
}

/**
 * Compute the canonical mandate hash that agents must provide in user_authorization.
 *
 * Format: "sha256:" + hex(SHA-256(mandate_id|timestamp|amount_value|currency|method|service_id))
 *
 * Agents compute this with:
 *   const canonical = [mandate_id, timestamp, amount_value, currency, method_name, service_id || ''].join('|');
 *   const user_authorization = 'sha256:' + crypto.createHash('sha256').update(canonical).digest('hex');
 */
function computeMandateHash(contents: AP2PaymentMandateContents): string {
  const canonical = [
    contents.payment_mandate_id || '',
    contents.timestamp || '',
    String(contents.payment_details_total?.amount?.value ?? ''),
    contents.payment_details_total?.amount?.currency || '',
    contents.payment_response?.method_name || '',
    contents.payment_details_id || ''
  ].join('|');
  return 'sha256:' + crypto.createHash('sha256').update(canonical).digest('hex');
}

/**
 * Verify that user_authorization is the correct SHA-256 hash of the mandate contents.
 * Uses timing-safe comparison to prevent timing attacks.
 */
function verifyMandateAuthorization(contents: AP2PaymentMandateContents, userAuthorization: string): boolean {
  const expected = computeMandateHash(contents);
  if (userAuthorization.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(
      Buffer.from(userAuthorization, 'utf8'),
      Buffer.from(expected, 'utf8')
    );
  } catch {
    return false;
  }
}

interface AP2PaymentMandateContents {
  payment_mandate_id?: string;
  payment_details_id?: string;
  payment_details_total?: {
    label?: string;
    amount?: {
      currency?: string;
      value?: number;
    };
    refund_period?: number;
  };
  payment_response?: {
    request_id?: string;
    method_name?: string;
    details?: {
      token?: {
        value?: string;
        url?: string;
      } | string;
      chain?: string;
      [key: string]: unknown;
    };
    shipping_address?: Record<string, unknown>;
  };
  merchant_agent?: string;
  timestamp?: string;
}

interface AP2PaymentMandate {
  payment_mandate_contents?: AP2PaymentMandateContents;
  user_authorization?: string;
}

interface AP2MessagePart {
  kind: 'text' | 'data';
  text?: string;
  data?: Record<string, unknown>;
}

interface AP2Message {
  contextId?: string;
  kind?: string;
  messageId?: string;
  parts?: AP2MessagePart[];
  role?: string;
  taskId?: string;
}

function jsonRpcError(id: string | number | null, code: number, message: string, data?: unknown) {
  return {
    id,
    jsonrpc: '2.0',
    error: { code, message, ...(data !== undefined ? { data } : {}) }
  };
}

function jsonRpcResult(id: string | number | null, result: unknown) {
  return { id, jsonrpc: '2.0', result };
}

function extractPaymentMandate(parts: AP2MessagePart[]): AP2PaymentMandate | null {
  for (const part of parts) {
    if (part.kind === 'data' && part.data) {
      const mandate = part.data['ap2.mandates.PaymentMandate'] as AP2PaymentMandate | undefined;
      if (mandate) return mandate;
    }
  }
  return null;
}

function agentUserId(merchantAgent: string | undefined, mandateId: string): string {
  const seed = merchantAgent || mandateId;
  return `ap2_${crypto.createHash('sha256').update(seed).digest('hex').slice(0, 20)}`;
}

/**
 * GET /ap2/v1/merchant — AP2 merchant discovery card
 */
router.get('/ap2/v1/merchant', (_req: Request, res: Response) => {
  const catalog = serviceCatalogService.getCatalog();
  const payableNetworks = getCanonicalPayableNetworks();
  res.json({
    ap2Version: '0.2',
    merchant: 'Coin Railz',
    description: `x402 micropayment APIs for AI agents — ${getCanonicalServiceCount()} pay-per-call services on canonical USDC rails. Crypto analytics, trading signals, contract security, satellite data, prediction markets, and more.`,
    supportedPaymentMethods: ['X402', 'CARD', 'VISA', 'MASTERCARD', 'AMEX', 'STRIPE'],
    supportedCurrencies: ['USDC', 'USD'],
    supportedChains: payableNetworks.map(network => network.id),
    a2aEndpoint: `${BASE_URL}/ap2/v1/merchant`,
    serviceCatalog: `${BASE_URL}/.well-known/agent-instructions.json`,
    agentCard: `${BASE_URL}/.well-known/agent-card.json`,
    webmcpManifest: `${BASE_URL}/.well-known/webmcp.json`,
    awiManifest: `${BASE_URL}/.well-known/awi.json`,
    mppManifest: `${BASE_URL}/.well-known/mpp.json`,
    integrationGuide: `${BASE_URL}/mcp-integration-guide`,
    x402SpecVersion: 2,
    facilitators: [...new Set(
      payableNetworks
        .map(network => network.facilitator)
        .filter((facilitator): facilitator is string => Boolean(facilitator)),
    )],
    priceRange: '$0.05–$10.00 per call',
    mandateAuthorization: {
      format: 'sha256:<hex>',
      algorithm: 'SHA-256',
      canonical: 'payment_mandate_id + "|" + timestamp + "|" + amount_value + "|" + currency + "|" + method_name + "|" + service_id',
      note: 'Compute: const canonical = [mandate_id, timestamp, String(amount), currency, method, service_id||""].join("|"); user_authorization = "sha256:" + crypto.createHash("sha256").update(canonical).digest("hex");',
      replayProtection: 'Each payment_mandate_id is accepted exactly once within its TTL window.'
    },
    cardPayment: {
      note: 'Card payments purchase API credits. Min $1.00, max $2,500. Credits can be used for any service.',
      minAmount: CARD_MIN_AMOUNT,
      maxAmount: CARD_MAX_AMOUNT,
      currency: 'USD',
      processor: 'Stripe',
      tokenFormat: 'Stripe payment method (pm_xxx) or checkout URL for browser-based payment',
      checkoutUrl: `${BASE_URL}/pilots/buy`
    },
    availableServices: catalog.services.slice(0, 10).map(toAp2Service),
    totalServices: getCanonicalServiceCount()
  });
});

/**
 * POST /ap2/v1/merchant — AP2 PaymentMandate handler
 */
router.post('/ap2/v1/merchant', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const body = req.body || {};
  const reqId = body.id ?? null;

  if (body.jsonrpc !== '2.0') {
    res.status(400).json(jsonRpcError(reqId, -32600, 'Invalid request: jsonrpc must be "2.0"'));
    return;
  }

  if (body.method !== 'message/send') {
    res.status(400).json(jsonRpcError(reqId, -32601, `Method not found: "${body.method}". Use "message/send".`));
    return;
  }

  const message: AP2Message = body.params?.message || {};
  const parts: AP2MessagePart[] = message.parts || [];
  const taskId = message.taskId || uuidv4();

  const mandate = extractPaymentMandate(parts);
  if (!mandate) {
    res.status(200).json(jsonRpcError(reqId, -32600,
      'Missing ap2.mandates.PaymentMandate in message parts.',
      {
        supportedMethods: ['X402', 'CARD', 'VISA', 'MASTERCARD', 'AMEX', 'STRIPE'],
        x402Example: {
          kind: 'data',
          data: {
            'ap2.mandates.PaymentMandate': {
              payment_mandate_contents: {
                payment_mandate_id: 'uuid',
                payment_details_id: 'gas-price-oracle',
                payment_details_total: { amount: { currency: 'USD', value: 0.10 } },
                payment_response: { method_name: 'X402' },
                timestamp: new Date().toISOString()
              },
              user_authorization: computeMandateHash({
                payment_mandate_id: 'your-uuid-here',
                timestamp: new Date().toISOString(),
                payment_details_total: { amount: { value: 0.10, currency: 'USD' } },
                payment_response: { method_name: 'X402' },
                payment_details_id: 'gas-price-oracle'
              })
            }
          }
        },
        cardExample: {
          kind: 'data',
          data: {
            'ap2.mandates.PaymentMandate': {
              payment_mandate_contents: {
                payment_mandate_id: 'your-uuid-here',
                payment_details_total: { amount: { currency: 'USD', value: 10.00 } },
                payment_response: {
                  method_name: 'CARD',
                  details: { token: { value: 'pm_stripe_payment_method_token' } }
                },
                timestamp: new Date().toISOString()
              },
              user_authorization: computeMandateHash({
                payment_mandate_id: 'your-uuid-here',
                payment_details_total: { amount: { value: 10.00, currency: 'USD' } },
                payment_response: { method_name: 'CARD' },
                timestamp: new Date().toISOString()
              })
            }
          }
        },
        authorizationNote: 'user_authorization = "sha256:" + SHA-256(mandate_id + "|" + timestamp + "|" + amount_value + "|" + currency + "|" + method_name + "|" + service_id). Use exact field values joined with pipe characters.',
        serviceCatalog: `${BASE_URL}/.well-known/agent-instructions.json`
      }
    ));
    return;
  }

  const contents = mandate.payment_mandate_contents;

  if (!contents?.payment_mandate_id || !contents?.payment_details_total?.amount || !contents?.timestamp) {
    res.status(200).json(jsonRpcError(reqId, -32600,
      'Malformed PaymentMandate: missing required fields.',
      { required: ['payment_mandate_contents.payment_mandate_id', 'payment_mandate_contents.payment_details_total.amount', 'payment_mandate_contents.timestamp'] }
    ));
    return;
  }

  const mandateAge = Date.now() - new Date(contents.timestamp).getTime();
  if (isNaN(mandateAge) || mandateAge > MANDATE_TTL_MS) {
    res.status(200).json(jsonRpcError(reqId, -32001,
      `Mandate expired (${Math.round(mandateAge / 1000)}s old, max ${MANDATE_TTL_MS / 1000}s). Generate a fresh mandate.`,
      { maxAgeSeconds: MANDATE_TTL_MS / 1000, receivedTimestamp: contents.timestamp }
    ));
    return;
  }

  if (!mandate.user_authorization) {
    res.status(200).json(jsonRpcError(reqId, -32600,
      'Missing user_authorization in PaymentMandate.',
      {
        field: 'user_authorization',
        format: 'sha256:<hex>',
        howToCompute: 'sha256(mandate_id + "|" + timestamp + "|" + amount_value + "|" + currency + "|" + method_name + "|" + service_id)',
        example: `sha256:${computeMandateHash({
          payment_mandate_id: 'your-uuid-here',
          timestamp: new Date().toISOString(),
          payment_details_total: { amount: { value: 0.10, currency: 'USD' } },
          payment_response: { method_name: 'X402' },
          payment_details_id: 'gas-price-oracle'
        }).slice(7)}`
      }
    ));
    return;
  }

  if (!verifyMandateAuthorization(contents, mandate.user_authorization)) {
    res.status(200).json(jsonRpcError(reqId, -32601,
      'Invalid user_authorization: hash does not match mandate contents.',
      {
        format: 'sha256:<hex>',
        howToCompute: 'Set user_authorization = "sha256:" + SHA-256(mandate_id + "|" + timestamp + "|" + amount_value + "|" + currency + "|" + method_name + "|" + service_id)',
        note: 'Use the exact field values from payment_mandate_contents, joined with "|" in that order.'
      }
    ));
    return;
  }

  cleanupUsedMandates();
  const mandateId = contents.payment_mandate_id!;
  if (usedMandateIds.has(mandateId)) {
    res.status(200).json(jsonRpcError(reqId, -32602,
      'Mandate already used. Each payment_mandate_id can only be accepted once.',
      {
        mandateId,
        hint: 'Generate a new mandate with a fresh payment_mandate_id (UUID) and current timestamp.'
      }
    ));
    return;
  }
  usedMandateIds.set(mandateId, Date.now());

  const methodName = (contents.payment_response?.method_name || 'X402').toUpperCase();
  const isCardPayment = CARD_PAYMENT_METHODS.has(methodName);
  const isX402Payment = methodName === 'X402';

  if (!isCardPayment && !isX402Payment) {
    res.status(200).json(jsonRpcError(reqId, -32003,
      `Payment method "${methodName}" not supported.`,
      {
        supportedMethods: ['X402', 'CARD', 'VISA', 'MASTERCARD', 'AMEX', 'STRIPE'],
        note: 'Use X402 for per-call crypto payments (USDC on Base/Solana), or CARD/VISA/MASTERCARD/AMEX/STRIPE to purchase credits with a card via Stripe.'
      }
    ));
    return;
  }

  const requestedAmount = contents.payment_details_total.amount?.value ?? 0;

  // ─── CARD PAYMENT PATH ────────────────────────────────────────────────────
  if (isCardPayment) {
    if (requestedAmount < CARD_MIN_AMOUNT || requestedAmount > CARD_MAX_AMOUNT) {
      res.status(200).json(jsonRpcError(reqId, -32004,
        `Card payment amount $${requestedAmount.toFixed(2)} out of range. Min: $${CARD_MIN_AMOUNT.toFixed(2)}, Max: $${CARD_MAX_AMOUNT.toFixed(2)}.`,
        { minAmount: CARD_MIN_AMOUNT, maxAmount: CARD_MAX_AMOUNT, requestedAmount }
      ));
      return;
    }

    const token = contents.payment_response?.details?.token;
    const stripeToken = typeof token === 'string' ? token : token?.value;
    const userId = agentUserId(contents.merchant_agent, contents.payment_mandate_id!);

    // If a Stripe pm_ or tok_ token is provided, charge directly
    if (stripeToken && (stripeToken.startsWith('pm_') || stripeToken.startsWith('tok_'))) {
      try {
        const stripeKey = process.env.STRIPE_SECRET_KEY;
        if (!stripeKey) throw new Error('Stripe not configured');

        const paymentIntent = await _stripeFactory.paymentIntents.create({
          amount: Math.round(requestedAmount * 100),
          currency: 'usd',
          payment_method: stripeToken.startsWith('pm_') ? stripeToken : undefined,
          confirm: stripeToken.startsWith('pm_'),
          metadata: {
            source: 'ap2',
            mandate_id: contents.payment_mandate_id!,
            agent_id: userId,
            method: methodName
          }
        }, {
          idempotencyKey: `ap2_${contents.payment_mandate_id}`
        });

        if (paymentIntent.status === 'succeeded') {
          await creditsService.addCredits({
            userId,
            amount: requestedAmount,
            paymentMethod: 'stripe',
            referenceId: paymentIntent.id,
            description: `AP2 ${methodName} payment — mandate ${contents.payment_mandate_id}`
          });

          const { apiKey } = await creditsService.generateApiKey(userId, `AP2 Agent — ${methodName}`);
          const balance = await creditsService.getBalance(userId);

          res.status(200).json(jsonRpcResult(reqId, {
            task: {
              id: taskId,
              contextId: message.contextId,
              status: { state: 'completed' },
              artifacts: [{
                parts: [{
                  kind: 'text',
                  text: [
                    `Payment successful. $${requestedAmount.toFixed(2)} USD charged via ${methodName}.`,
                    `Credits added: $${requestedAmount.toFixed(2)}`,
                    `Account balance: $${balance?.toFixed(2) || requestedAmount.toFixed(2)}`,
                    ``,
                    `API Key: ${apiKey}`,
                    ``,
                    `Use this key to call any Coin Railz x402 service:`,
                    `  Header: X-Internal-User-ID: <your-api-key>`,
                    `  Or:     api-key: <your-api-key>`,
                    ``,
                    `Service catalog: ${BASE_URL}/.well-known/agent-instructions.json`
                  ].join('\n')
                }]
              }],
              metadata: {
                ap2Version: '0.2',
                paymentMethod: methodName,
                status: 'completed',
                creditsAdded: requestedAmount,
                creditsBalance: balance ?? requestedAmount,
                currency: 'USD',
                apiKey,
                apiKeyUsage: {
                  header: 'X-Internal-User-ID',
                  alternateHeader: 'api-key',
                  note: 'Include in requests to any Coin Railz x402 service endpoint'
                },
                serviceCatalog: `${BASE_URL}/.well-known/agent-instructions.json`,
                stripePaymentIntentId: paymentIntent.id,
                mandateId: contents.payment_mandate_id,
                agentUserId: userId
              }
            }
          }));
          return;
        }

        // Payment intent not yet succeeded (requires action, etc.)
        res.status(200).json(jsonRpcResult(reqId, {
          task: {
            id: taskId,
            contextId: message.contextId,
            status: { state: 'input-required' },
            artifacts: [{
              parts: [{
                kind: 'text',
                text: `Card payment requires additional authentication. Complete at: ${BASE_URL}/pilots/buy`
              }]
            }],
            metadata: {
              ap2Version: '0.2',
              paymentMethod: methodName,
              stripePaymentIntentId: paymentIntent.id,
              stripeStatus: paymentIntent.status,
              checkoutUrl: `${BASE_URL}/pilots/buy?amount=${requestedAmount}&source=ap2&mandate=${contents.payment_mandate_id}&agent=${encodeURIComponent(userId)}`,
              note: 'Payment requires additional authentication (3DS etc). Use checkoutUrl for browser-based completion.'
            }
          }
        }));
        return;

      } catch (stripeErr: any) {
        console.error('❌ AP2 Stripe charge failed:', stripeErr.message);
        res.status(200).json(jsonRpcError(reqId, -32005,
          `Card payment processing failed: ${stripeErr.message}`,
          {
            fallbackCheckoutUrl: `${BASE_URL}/pilots/buy?amount=${requestedAmount}&source=ap2&mandate=${contents.payment_mandate_id}`,
            note: 'Use fallbackCheckoutUrl to complete payment via browser. Or retry with a valid Stripe payment method token (pm_xxx).'
          }
        ));
        return;
      }
    }

    // No Stripe token or non-Stripe token — return checkout URL for human-present completion
    res.status(200).json(jsonRpcResult(reqId, {
      task: {
        id: taskId,
        contextId: message.contextId,
        status: { state: 'input-required' },
        artifacts: [{
          parts: [{
            kind: 'text',
            text: [
              `Card payment required. Complete purchase at:`,
              `${BASE_URL}/pilots/buy?amount=${requestedAmount}&source=ap2&mandate=${contents.payment_mandate_id}&agent=${encodeURIComponent(userId)}`,
              ``,
              `After payment, your API key will be emailed. Credits are available immediately.`,
              ``,
              `For fully automated (no browser) card payment, provide a Stripe payment method token`,
              `(pm_xxx) in payment_response.details.token.value.`
            ].join('\n')
          }]
        }],
        metadata: {
          ap2Version: '0.2',
          paymentMethod: methodName,
          checkoutUrl: `${BASE_URL}/pilots/buy?amount=${requestedAmount}&source=ap2&mandate=${contents.payment_mandate_id}&agent=${encodeURIComponent(userId)}`,
          amount: requestedAmount,
          currency: 'USD',
          mandateId: contents.payment_mandate_id,
          agentUserId: userId,
          note: 'Provide a Stripe pm_ token in payment_response.details.token.value for fully automated payment without browser redirect.'
        }
      }
    }));
    return;
  }

  // ─── X402 PAYMENT PATH ────────────────────────────────────────────────────
  if (isX402Payment) {
    const serviceId = contents.payment_details_id;
    const catalog = serviceCatalogService.getCatalog();
    const service = serviceId ? catalog.services.find(s => s.id === serviceId) : null;

    if (!service) {
      res.status(200).json(jsonRpcError(reqId, -32002,
        `Unknown service: "${serviceId || '(none)'}". Set payment_details_id to a valid service ID.`,
        {
          validServiceIds: catalog.services.map(s => s.id),
          serviceCatalog: `${BASE_URL}/.well-known/agent-instructions.json`,
          hint: 'Use GET /ap2/v1/merchant to browse available services, or use method_name CARD to purchase credits for general access.'
        }
      ));
      trackAP2Hit(req, { requestId: taskId, matched: false, queryText: serviceId || undefined, statusCode: 200, responseTimeMs: Date.now() - startTime });
      return;
    }

    const servicePrice = parseFloat(service.priceUSD.replace('$', '')) || 0.25;
    const tolerance = servicePrice * AMOUNT_TOLERANCE;
    if (requestedAmount > 0 && Math.abs(requestedAmount - servicePrice) > tolerance) {
      res.status(200).json(jsonRpcError(reqId, -32004,
        `Amount mismatch. Mandate $${requestedAmount.toFixed(2)} vs service price $${servicePrice.toFixed(2)} (±${Math.round(AMOUNT_TOLERANCE * 100)}% tolerance).`,
        { expectedAmount: servicePrice, requestedAmount, currency: 'USD', tolerancePercent: AMOUNT_TOLERANCE * 100 }
      ));
      return;
    }

    const chain = contents.payment_response?.details?.chain || 'base';
    const isSolana = chain.toLowerCase() === 'solana';

    res.status(200).json(jsonRpcResult(reqId, {
      task: {
        id: taskId,
        contextId: message.contextId,
        status: { state: 'input-required' },
        artifacts: [{
          parts: [{
            kind: 'text',
            text: [
              `x402 payment required for ${service.name} ($${servicePrice.toFixed(2)} USDC).`,
              ``,
              `Endpoint: ${BASE_URL}${service.endpoint}`,
              ``,
              `Steps:`,
              `1. POST to the endpoint above`,
              `2. Receive HTTP 402 challenge with payment instructions`,
              `3. Pay $${servicePrice.toFixed(2)} USDC to payTo address on Base or Solana`,
              `4. Resubmit request with X-PAYMENT header containing payment proof`,
              `5. Receive service data`
            ].join('\n')
          }]
        }],
        metadata: {
          ap2Version: '0.2',
          paymentMethod: 'X402',
          serviceId: service.id,
          serviceName: service.name,
          serviceDescription: service.description,
          x402Endpoint: `${BASE_URL}${service.endpoint}`,
          amount: servicePrice.toFixed(2),
          currency: 'USDC',
          x402Version: PUBLIC_DISCOVERY_VERSIONS.x402Protocol,
          networks: getCanonicalPayableNetworks()
            .filter(network => network.id === 'base' || network.id === 'solana')
            .map(network => ({
              chain: network.id,
              caip2: network.caip2,
              payTo: network.recipient,
              ...(network.id === 'solana'
                ? { tokenMint: network.assetAddress }
                : { tokenContract: network.assetAddress }),
              facilitator: network.facilitator,
            })),
          mandateId: contents.payment_mandate_id,
          mandateAccepted: true,
          instructions: '1. POST to x402Endpoint → 2. Receive HTTP 402 challenge → 3. Pay USDC to payTo on Base or Solana → 4. Resubmit with X-PAYMENT header → 5. Receive service data'
        }
      }
    }));
    trackAP2Hit(req, { requestId: taskId, matched: true, resourceId: service.id, queryText: service.id, statusCode: 200, responseTimeMs: Date.now() - startTime });
  }
});

export default router;
