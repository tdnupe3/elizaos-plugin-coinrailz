/**
 * AP2 v0.1 Merchant Endpoint — Coin Railz
 *
 * Implements Google's Agent Payments Protocol (AP2) v0.1 as a merchant endpoint.
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
 * TODO (V1): Full ECDSA W3C VC proof verification per W3C Verifiable Credentials spec.
 * Current V0.1 validates structure, TTL, amount tolerance, and user_authorization presence.
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { SERVICE_CATALOG } from './a2aCoinRailzRoutes';
import { creditsService } from '../services/creditsService';

const router = Router();

const BASE_URL = process.env.PUBLIC_BASE_URL || 'https://coinrailz.com';

const PLATFORM_WALLET_BASE = '0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91';
const USDC_BASE_CONTRACT = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const PLATFORM_WALLET_SOLANA = 'BmUPzSupHJu2kW4cL27dF7Vc2JaZTwXKzFsRuagPDtL8';
const USDC_SOLANA_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const FACILITATOR_CDP = 'https://api.cdp.coinbase.com/platform/v2/x402';
const FACILITATOR_DEXTER = 'https://x402.dexter.cash';

const MANDATE_TTL_MS = 5 * 60 * 1000;
const AMOUNT_TOLERANCE = 0.20;
const CARD_MIN_AMOUNT = 1.00;
const CARD_MAX_AMOUNT = 2500.00;

const CARD_PAYMENT_METHODS = new Set([
  'CARD', 'VISA', 'MASTERCARD', 'AMEX', 'STRIPE',
  'PAYMENT_CARD', 'CREDIT_CARD', 'DEBIT_CARD'
]);

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
      };
      chain?: string;
      token?: string;
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
  res.json({
    ap2Version: '0.1',
    merchant: 'Coin Railz',
    description: 'x402 micropayment APIs for AI agents — 44 pay-per-call services on Base + Solana. Crypto analytics, trading signals, contract security, satellite data, prediction markets, and more.',
    supportedPaymentMethods: ['X402', 'CARD', 'VISA', 'MASTERCARD', 'AMEX', 'STRIPE'],
    supportedCurrencies: ['USDC', 'USD'],
    supportedChains: ['base', 'solana'],
    a2aEndpoint: `${BASE_URL}/ap2/v1/merchant`,
    serviceCatalog: `${BASE_URL}/.well-known/agent-instructions.json`,
    agentCard: `${BASE_URL}/.well-known/agent-card.json`,
    x402SpecVersion: 2,
    facilitators: [FACILITATOR_CDP, FACILITATOR_DEXTER],
    priceRange: '$0.10 – $10.00 per request',
    cardPayment: {
      note: 'Card payments purchase API credits. Min $1.00, max $2,500. Credits can be used for any service.',
      minAmount: CARD_MIN_AMOUNT,
      maxAmount: CARD_MAX_AMOUNT,
      currency: 'USD',
      processor: 'Stripe',
      tokenFormat: 'Stripe payment method (pm_xxx) or checkout URL for browser-based payment',
      checkoutUrl: `${BASE_URL}/pilots/buy`
    },
    availableServices: SERVICE_CATALOG.slice(0, 10).map(s => ({
      id: s.id,
      name: s.name,
      priceUsd: s.priceUsd,
      endpoint: s.x402Endpoint
    })),
    totalServices: SERVICE_CATALOG.length
  });
});

/**
 * POST /ap2/v1/merchant — AP2 PaymentMandate handler
 */
router.post('/ap2/v1/merchant', async (req: Request, res: Response) => {
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
              user_authorization: 'mandate-hash-or-signature'
            }
          }
        },
        cardExample: {
          kind: 'data',
          data: {
            'ap2.mandates.PaymentMandate': {
              payment_mandate_contents: {
                payment_mandate_id: 'uuid',
                payment_details_total: { amount: { currency: 'USD', value: 10.00 } },
                payment_response: {
                  method_name: 'CARD',
                  details: { token: { value: 'pm_stripe_payment_method_token' } }
                },
                timestamp: new Date().toISOString()
              },
              user_authorization: 'mandate-hash-or-signature'
            }
          }
        },
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
      { field: 'user_authorization' }
    ));
    return;
  }

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

    const stripeToken = contents.payment_response?.details?.token?.value as string | undefined;
    const userId = agentUserId(contents.merchant_agent, contents.payment_mandate_id!);

    // If a Stripe pm_ or tok_ token is provided, charge directly
    if (stripeToken && (stripeToken.startsWith('pm_') || stripeToken.startsWith('tok_'))) {
      try {
        const stripeKey = process.env.STRIPE_SECRET_KEY;
        if (!stripeKey) throw new Error('Stripe not configured');

        const Stripe = (await import('stripe')).default;
        const stripe = new Stripe(stripeKey, { apiVersion: '2024-12-18.acacia' as any });

        const paymentIntent = await stripe.paymentIntents.create({
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
                ap2Version: '0.1',
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
              ap2Version: '0.1',
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
          ap2Version: '0.1',
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
  const serviceId = contents.payment_details_id;
  const service = serviceId ? SERVICE_CATALOG.find(s => s.id === serviceId) : null;

  if (!service) {
    res.status(200).json(jsonRpcError(reqId, -32002,
      `Unknown service: "${serviceId || '(none)'}". Set payment_details_id to a valid service ID.`,
      {
        validServiceIds: SERVICE_CATALOG.map(s => s.id),
        serviceCatalog: `${BASE_URL}/.well-known/agent-instructions.json`,
        hint: 'Use GET /ap2/v1/merchant to browse available services, or use method_name CARD to purchase credits for general access.'
      }
    ));
    return;
  }

  const tolerance = service.priceUsd * AMOUNT_TOLERANCE;
  if (requestedAmount > 0 && Math.abs(requestedAmount - service.priceUsd) > tolerance) {
    res.status(200).json(jsonRpcError(reqId, -32004,
      `Amount mismatch. Mandate $${requestedAmount.toFixed(2)} vs service price $${service.priceUsd.toFixed(2)} (±${Math.round(AMOUNT_TOLERANCE * 100)}% tolerance).`,
      { expectedAmount: service.priceUsd, requestedAmount, currency: 'USD', tolerancePercent: AMOUNT_TOLERANCE * 100 }
    ));
    return;
  }

  res.status(200).json(jsonRpcResult(reqId, {
    task: {
      id: taskId,
      contextId: message.contextId,
      status: { state: 'input-required' },
      artifacts: [{
        parts: [{
          kind: 'text',
          text: [
            `x402 payment required for ${service.name} ($${service.priceUsd.toFixed(2)} USDC).`,
            ``,
            `Endpoint: ${service.x402Endpoint}`,
            ``,
            `Steps:`,
            `1. POST to the endpoint above`,
            `2. Receive HTTP 402 challenge with payment instructions`,
            `3. Pay $${service.priceUsd.toFixed(2)} USDC to payTo address on Base or Solana`,
            `4. Resubmit request with X-PAYMENT header containing payment proof`,
            `5. Receive service data`
          ].join('\n')
        }]
      }],
      metadata: {
        ap2Version: '0.1',
        paymentMethod: 'X402',
        serviceId: service.id,
        serviceName: service.name,
        serviceDescription: service.description,
        x402Endpoint: service.x402Endpoint,
        amount: service.priceUsd.toFixed(2),
        currency: 'USDC',
        x402Version: 2,
        networks: [
          {
            chain: 'base',
            caip2: 'eip155:8453',
            payTo: PLATFORM_WALLET_BASE,
            tokenContract: USDC_BASE_CONTRACT,
            facilitator: FACILITATOR_CDP
          },
          {
            chain: 'solana',
            caip2: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
            payTo: PLATFORM_WALLET_SOLANA,
            tokenMint: USDC_SOLANA_MINT,
            facilitator: FACILITATOR_DEXTER
          }
        ],
        mandateId: contents.payment_mandate_id,
        mandateAccepted: true,
        instructions: '1. POST to x402Endpoint → 2. Receive HTTP 402 challenge → 3. Pay USDC to payTo on Base or Solana → 4. Resubmit with X-PAYMENT header → 5. Receive service data'
      }
    }
  }));
});

export default router;
