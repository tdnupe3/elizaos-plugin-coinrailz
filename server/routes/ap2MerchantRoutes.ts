/**
 * AP2 v0.1 Merchant Endpoint — Coin Railz
 *
 * Implements Google's Agent Payments Protocol (AP2) v0.1 as a merchant endpoint.
 * Transport: A2A JSON-RPC 2.0 (distinct from our HTTP+JSON A2A endpoint at /a2a/v1)
 * Spec: https://ap2-protocol.org/specification/
 *
 * Accepts ap2.mandates.PaymentMandate VDC data parts, validates the mandate,
 * and returns x402 payment instructions. The existing x402 middleware handles
 * payment confirmation after the agent pays.
 *
 * Payment method supported: X402 (USDC on Base or Solana)
 * x402 was officially merged into AP2 reference implementation Dec 2025 (PR #121)
 *
 * TODO (V1): Implement full ECDSA W3C VC proof verification per W3C Verifiable
 * Credentials spec. Current V0.1 validates structure, TTL, amount, and presence
 * of user_authorization — sufficient for initial AP2 compatibility.
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { SERVICE_CATALOG } from './a2aCoinRailzRoutes';

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
    details?: Record<string, unknown>;
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

/**
 * GET /ap2/v1/merchant — AP2 merchant discovery card
 * Agents discover our AP2 capabilities here before initiating payment
 */
router.get('/ap2/v1/merchant', (req: Request, res: Response) => {
  res.json({
    ap2Version: '0.1',
    merchant: 'Coin Railz',
    description: 'x402 micropayment APIs for AI agents — 44 pay-per-call services on Base + Solana. Crypto analytics, trading signals, contract security, satellite data, prediction markets, and more.',
    supportedPaymentMethods: ['X402'],
    supportedCurrencies: ['USDC'],
    supportedChains: ['base', 'solana'],
    a2aEndpoint: `${BASE_URL}/ap2/v1/merchant`,
    serviceCatalog: `${BASE_URL}/.well-known/agent-instructions.json`,
    agentCard: `${BASE_URL}/.well-known/agent-card.json`,
    x402SpecVersion: 2,
    facilitators: [FACILITATOR_CDP, FACILITATOR_DEXTER],
    priceRange: '$0.10 – $10.00 USDC per request',
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
 * Accepts A2A JSON-RPC 2.0 messages with ap2.mandates.PaymentMandate data parts
 */
router.post('/ap2/v1/merchant', (req: Request, res: Response) => {
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

  const mandate = extractPaymentMandate(parts);
  if (!mandate) {
    res.status(200).json(jsonRpcError(reqId, -32600,
      'Missing ap2.mandates.PaymentMandate in message parts. Include a data part with key "ap2.mandates.PaymentMandate".',
      {
        expectedStructure: {
          kind: 'data',
          data: {
            'ap2.mandates.PaymentMandate': {
              payment_mandate_contents: {
                payment_mandate_id: 'uuid',
                payment_details_id: 'service-id (e.g. gas-price-oracle)',
                payment_details_total: { amount: { currency: 'USD', value: 0.10 } },
                payment_response: { method_name: 'X402' },
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
      'Malformed PaymentMandate: missing required fields (payment_mandate_id, payment_details_total.amount, timestamp)',
      { required: ['payment_mandate_contents.payment_mandate_id', 'payment_mandate_contents.payment_details_total.amount', 'payment_mandate_contents.timestamp'] }
    ));
    return;
  }

  const mandateAge = Date.now() - new Date(contents.timestamp).getTime();
  if (isNaN(mandateAge) || mandateAge > MANDATE_TTL_MS) {
    res.status(200).json(jsonRpcError(reqId, -32001,
      `Mandate expired. Timestamp is ${Math.round(mandateAge / 1000)}s old (max ${MANDATE_TTL_MS / 1000}s). Generate a fresh mandate.`,
      { maxAgeSeconds: MANDATE_TTL_MS / 1000, receivedTimestamp: contents.timestamp }
    ));
    return;
  }

  const methodName = contents.payment_response?.method_name?.toUpperCase();
  if (methodName && methodName !== 'X402') {
    res.status(200).json(jsonRpcError(reqId, -32003,
      `Payment method "${methodName}" not supported. Only X402 is accepted.`,
      { supportedMethods: ['X402'], note: 'Set payment_response.method_name to "X402". x402 is an official AP2 payment method (merged Dec 2025, PR #121).' }
    ));
    return;
  }

  if (!mandate.user_authorization) {
    res.status(200).json(jsonRpcError(reqId, -32600,
      'Missing user_authorization in PaymentMandate. Include mandate hash or signature.',
      { field: 'user_authorization' }
    ));
    return;
  }

  const serviceId = contents.payment_details_id;
  const service = serviceId
    ? SERVICE_CATALOG.find(s => s.id === serviceId)
    : null;

  if (!service) {
    res.status(200).json(jsonRpcError(reqId, -32002,
      `Unknown service: "${serviceId || '(none)'}". Set payment_details_id to a valid service ID.`,
      {
        validServiceIds: SERVICE_CATALOG.map(s => s.id),
        serviceCatalog: `${BASE_URL}/.well-known/agent-instructions.json`,
        hint: 'Use GET /ap2/v1/merchant to browse available services'
      }
    ));
    return;
  }

  const requestedAmount = contents.payment_details_total.amount?.value ?? 0;
  const tolerance = service.priceUsd * AMOUNT_TOLERANCE;
  if (requestedAmount > 0 && Math.abs(requestedAmount - service.priceUsd) > tolerance) {
    res.status(200).json(jsonRpcError(reqId, -32004,
      `Amount mismatch. Mandate amount $${requestedAmount.toFixed(2)} differs from service price $${service.priceUsd.toFixed(2)} by more than ${Math.round(AMOUNT_TOLERANCE * 100)}%.`,
      { expectedAmount: service.priceUsd, requestedAmount, currency: 'USD', tolerancePercent: AMOUNT_TOLERANCE * 100 }
    ));
    return;
  }

  const taskId = message.taskId || uuidv4();

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
        instructions: [
          '1. POST to x402Endpoint',
          '2. Receive HTTP 402 challenge',
          '3. Pay USDC amount to payTo address on any supported chain',
          '4. Resubmit request with X-PAYMENT header containing payment proof',
          '5. Receive service data'
        ].join(' → ')
      }
    }
  }));
});

export default router;
