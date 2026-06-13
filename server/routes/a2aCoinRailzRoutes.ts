/**
 * A2A v1 INTERACTION ENDPOINT — Coin Railz
 * 
 * Turns A2A discovery into A2A-interactive (revenue-capable) status.
 * Agents that find us via /.well-known/agent-card.json can POST here
 * to discover matching x402 services and receive payment instructions.
 * 
 * Transport: HTTP+JSON (not JSON-RPC)
 * Format: A2A task response schema
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { db } from '../db';
import { endpointHits, a2aInteractions } from '../../shared/schema';
import { serviceCatalogService } from '../services/serviceCatalogService';

const router = Router();

function hashIP(ip: string | undefined): string | undefined {
  if (!ip) return undefined;
  return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

type A2AIntentType = 'peer_discovery_greeting' | 'peer_offer_clawpay_v1' | 'service_query' | 'no_text' | 'unknown';

function classifyA2AIntent(text: string): A2AIntentType {
  if (!text) return 'no_text';
  const t = text.trim();
  if (/^CLAWPAY_V1\s/i.test(t)) return 'peer_offer_clawpay_v1';
  if (/\bhello[,.]?\s+i am\b/i.test(t) && /\bwhat services\b/i.test(t)) return 'peer_discovery_greeting';
  if (/\bwhat (services|can you|do you)\b/i.test(t) || /\bhello[,.]?\s+i am\b/i.test(t)) return 'peer_discovery_greeting';
  if (/^(hello|hi|hey|greetings|howdy|ping|test|yo)[.!?]?\s*$/i.test(t)) return 'peer_discovery_greeting';
  // Agent self-introduction: "Hello from [AgentName/Org]" — probing, not requesting a service
  if (/^hello\s+from\b/i.test(t)) return 'peer_discovery_greeting';
  // Explicit probe / smoke-test patterns — connectivity checks, not service requests
  if (/\bsmoke[\s-]?test\b/i.test(t)) return 'peer_discovery_greeting';
  if (/\breply\s+brief/i.test(t)) return 'peer_discovery_greeting';
  // Capability probe patterns used by agent frameworks (e.g. arbor-a2a-probe)
  if (/\bcapability\s+probe\b/i.test(t)) return 'peer_discovery_greeting';
  if (t.length > 0) return 'service_query';
  return 'unknown';
}

function logA2AInteraction(opts: {
  requestId: string;
  latencyMs: number;
  statusCode: number;
  matched: boolean;
  resourceId: string;
  matchCount: number;
  intentType: A2AIntentType;
  queryText: string;
  clientIpHash: string | undefined;
  userAgent: string | undefined;
  trackingId?: string;
}) {
  const queryPreview = opts.queryText.slice(0, 200).replace(/\s+/g, ' ');
  const queryHash = crypto.createHash('sha256').update(opts.queryText).digest('hex').slice(0, 8);
  const uaShort = (opts.userAgent || 'unknown').slice(0, 60);
  console.log(JSON.stringify({
    event: 'a2a.message.processed',
    requestId: opts.requestId,
    ts: new Date().toISOString(),
    latencyMs: opts.latencyMs,
    statusCode: opts.statusCode,
    matched: opts.matched,
    resourceId: opts.resourceId,
    matchCount: opts.matchCount,
    intentType: opts.intentType,
    queryPreview,
    queryLen: opts.queryText.length,
    queryHash,
    clientIpHash: opts.clientIpHash,
    uaShort,
    ...(opts.trackingId ? { trackingId: opts.trackingId } : {}),
  }));
}

function trackA2AHit(req: Request, opts: {
  resourceId: string;
  statusCode: number;
  responseTimeMs: number;
  matched?: boolean;
  queryText?: string;
  requestId?: string;
}) {
  const clientIP = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress;
  const walletAddress = (req.headers['x-wallet-address'] || req.headers['x-payer-address']) as string | undefined;
  const trackingId = (req.headers['x-tracking-id'] || req.query.tracking) as string | undefined;

  db.insert(endpointHits).values({
    endpoint: req.originalUrl.split('?')[0],
    endpointType: 'a2a' as any,
    resourceId: opts.resourceId,
    ipHash: hashIP(clientIP),
    userAgent: req.headers['user-agent']?.slice(0, 500),
    walletAddress,
    method: req.method,
    statusCode: opts.statusCode,
    responseTimeMs: opts.responseTimeMs,
    trackingId,
  }).catch(() => {});

  db.insert(a2aInteractions).values({
    requestId: opts.requestId,
    endpoint: req.originalUrl.split('?')[0],
    protocol: 'a2a',
    queryText: opts.queryText?.slice(0, 2000),
    matched: opts.matched ?? false,
    resourceId: opts.resourceId,
    statusCode: opts.statusCode,
    responseTimeMs: opts.responseTimeMs,
    ipAddress: clientIP?.slice(0, 100),
    userAgent: req.headers['user-agent']?.slice(0, 1000),
    walletAddress,
    trackingId,
  }).catch(() => {});
}

interface ServiceEntry {
  id: string;
  name: string;
  priceUsd: number;
  x402Endpoint: string;
  description: string;
  keywords: string[];
}

const BASE_URL = process.env.PUBLIC_BASE_URL || 'https://coinrailz.com';

function buildTaskResponse(taskId: string, artifacts: Array<{ parts: Array<{ type: string; text: string }> }>, metadata: Record<string, unknown>) {
  return {
    id: taskId,
    status: { state: 'completed' },
    artifacts,
    metadata
  };
}

function kwMatches(text: string, kw: string): boolean {
  if (kw.length <= 3) {
    return new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text);
  }
  return text.includes(kw);
}

/**
 * Helper to convert ServiceCatalogEntry to ServiceEntry for the router
 */
function toServiceEntry(entry: any): ServiceEntry {
  return {
    id: entry.id,
    name: entry.name,
    priceUsd: parseFloat(entry.priceUSD.replace('$', '')) || 0.25,
    x402Endpoint: `${BASE_URL}${entry.endpoint}`,
    description: entry.description,
    keywords: entry.capabilities || []
  };
}

function matchServices(text: string): ServiceEntry[] {
  const lower = text.toLowerCase();
  
  // Use the canonical serviceCatalogService which has 60+ services
  const fullCatalog = serviceCatalogService.getCatalog().services;
  
  const scored = fullCatalog.map(entry => {
    let hits = 0;
    
    // Convert ServiceCatalogEntry to a temporary keywords list for matching
    const kws = [
      ...(entry.capabilities || []),
      entry.id,
      entry.name.toLowerCase(),
      entry.category.toLowerCase(),
      ...entry.description.toLowerCase().split(/\s+/)
    ].filter(k => k.length > 2);

    for (const kw of kws) {
      if (kwMatches(lower, kw)) hits++;
    }
    
    // Exact matches on ID or Name get massive boost
    if (lower.includes(entry.id)) hits += 5;
    if (lower.includes(entry.name.toLowerCase())) hits += 5;
    
    // Map back to ServiceEntry for the existing router logic
    const service = toServiceEntry(entry);

    return { service, hits };
  }).filter(s => s.hits > 0).sort((a, b) => b.hits - a.hits);

  return scored.map(s => s.service);
}

function formatServiceText(s: ServiceEntry): string {
  return [
    `Service: ${s.name}`,
    `Price: $${s.priceUsd.toFixed(2)} USDC per request`,
    `Endpoint: ${s.x402Endpoint}`,
    `Payment: POST to the endpoint — it will return an HTTP 402 with payment instructions (x402 protocol). Pay the challenge, resend the request, receive the data.`
  ].join('\n');
}

/**
 * GET /a2a/v1 — Agent card summary for discovery
 */
router.get('/a2a/v1', (req: Request, res: Response) => {
  const startTime = Date.now();
  const catalog = serviceCatalogService.getCatalog();
  const body = {
    id: 'coinrailz-x402-agent',
    name: 'Coin Railz',
    description: `Multi-chain x402 micropayment infrastructure for AI agents. ${catalog.totalServices}+ pay-per-call API services across crypto analytics, trading signals, security audits, satellite data, prediction markets, and more.`,
    version: '3.1.0',
    protocolVersion: '0.3.0',
    skillCount: catalog.totalServices,
    documentationUrl: `${BASE_URL}/.well-known/agent-instructions.json`,
    agentCard: `${BASE_URL}/.well-known/agent-card.json`,
    paymentProtocol: 'x402',
    supportedChains: ['ethereum', 'base', 'polygon', 'arbitrum', 'solana'],
    priceRange: '$0.10 – $10.00 USDC per request',
    interactionEndpoint: `${BASE_URL}/a2a/v1/message/send`,
    usage: 'POST /a2a/v1/message/send with { "message": { "parts": [{ "text": "your request" }] } }'
  };
  res.json(body);
  trackA2AHit(req, { resourceId: 'a2a-catalog', statusCode: 200, responseTimeMs: Date.now() - startTime });
});

/**
 * POST /a2a/v1 — Alias for /a2a/v1/message/send (some clients omit the sub-path)
 */
router.post('/a2a/v1', handleMessageSend);

/**
 * POST /a2a/v1/message/send — Main A2A interaction handler
 * Accept natural language request → match x402 service → return task response with payment instructions
 */
router.post('/a2a/v1/message/send', handleMessageSend);

function handleMessageSend(req: Request, res: Response) {
  const startTime = Date.now();
  const taskId = uuidv4();
  const clientIP = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress;
  const clientIpHash = hashIP(clientIP);
  const trackingId = (req.headers['x-tracking-id'] || req.query.tracking) as string | undefined;
  const userAgent = req.headers['user-agent'];

  const body = req.body || {};
  const message = body.message || body.params?.message || {};
  const parts: Array<{ type?: string; text?: string }> = message.parts || [];
  const text = parts.map((p: any) => p.text || '').join(' ').trim() || (body.text || '');

  if (!text) {
    res.status(400).json({
      id: taskId,
      status: { state: 'failed', message: 'Request must include a query message.' },
      artifacts: [],
      metadata: {
        hint: 'Send a JSON body with the following structure:',
        expectedSchema: {
          message: {
            parts: [
              { type: 'text', text: 'string (your request)' }
            ]
          }
        },
        examplePayload: {
          message: {
            parts: [
              { type: 'text', text: 'I need to verify an agent identity' }
            ]
          }
        },
        alternateFormat: {
          text: 'I need to verify an agent identity'
        },
        documentationUrl: `${BASE_URL}/.well-known/agent-instructions.json`
      }
    });
    const latencyMs = Date.now() - startTime;
    trackA2AHit(req, { resourceId: 'a2a-no-text', statusCode: 400, responseTimeMs: latencyMs, matched: false, requestId: taskId });
    logA2AInteraction({ requestId: taskId, latencyMs, statusCode: 400, matched: false, resourceId: 'a2a-no-text', matchCount: 0, intentType: 'no_text', queryText: '', clientIpHash, userAgent, trackingId });
    return;
  }

  const intentType = classifyA2AIntent(text);
  const matches = matchServices(text);
  const catalog = serviceCatalogService.getCatalog();

  if (intentType === 'peer_discovery_greeting' && matches.length === 0) {
    const featured = catalog.services
      .filter(s => ['satellite-data', 'iot-depin', 'nasa-earthdata', 'ai-inference', 'trading-intelligence'].includes(s.category))
      .sort(() => 0.5 - Math.random())
      .slice(0, 6)
      .map(toServiceEntry);

    res.status(200).json(buildTaskResponse(taskId, [{
      parts: [{
        type: 'text',
        text: `Hello! I'm Coin Railz — multi-chain x402 payment infrastructure for AI agents.\n\nI offer ${catalog.totalServices}+ pay-per-call API services across crypto analytics, IoT, satellite data, NASA Earthdata, and AI inference. Send me a natural language query describing what you need. Examples:\n- "What's the current gas price on Base?"\n- "Get NASA satellite imagery for coordinates 34, -118"\n- "Fetch fleet telematics for vehicle ID 99"\n- "Run AI inference on this prompt: [text]"\n- "Verify agent identity"\n\nEach service costs between $0.10–$10.00 USDC, paid via x402 protocol.\n\nFull catalog: ${BASE_URL}/x402/catalog\nIntegration guide: ${BASE_URL}/.well-known/agent-instructions.json\nFree trial (no crypto needed): ${BASE_URL}/api/m2m/credits/trial`
      }]
    }], {
      matched: false,
      intentType: 'peer_discovery_greeting',
      serviceCount: catalog.totalServices,
      catalogUrl: `${BASE_URL}/x402/catalog`,
      trialUrl: `${BASE_URL}/api/m2m/credits/trial`,
      instructionsUrl: `${BASE_URL}/.well-known/agent-instructions.json`,
      featured: featured.map(s => ({ id: s.id, name: s.name, priceUsd: s.priceUsd, endpoint: s.x402Endpoint }))
    }));
    const latencyMs = Date.now() - startTime;
    trackA2AHit(req, { resourceId: 'a2a-greeting', statusCode: 200, responseTimeMs: latencyMs, matched: false, queryText: text, requestId: taskId });
    logA2AInteraction({ requestId: taskId, latencyMs, statusCode: 200, matched: false, resourceId: 'a2a-greeting', matchCount: 0, intentType, queryText: text, clientIpHash, userAgent, trackingId });
    return;
  }

  if (matches.length === 0) {
    const suggested = [...catalog.services].sort(() => 0.5 - Math.random()).slice(0, 5).map(toServiceEntry);
    res.status(200).json(buildTaskResponse(taskId, [{
      parts: [{
        type: 'text',
        text: `I couldn't find a specific service matching "${text}".\n\nCoin Railz offers ${catalog.totalServices}+ automated API services. Here are some you might be looking for:\n${suggested.map(s => `- ${s.name}: ${s.description}`).join('\n')}\n\nTry these example queries:\n- "What's the current gas price on Base?"\n- "Is this smart contract safe: 0x..."\n- "Get whale alerts for USDC on Solana"\n- "Check my wallet portfolio: [address]"\n\nFull service catalog: ${BASE_URL}/x402/catalog\nIntegration Guide: ${BASE_URL}/.well-known/agent-instructions.json`
      }]
    }], {
      matched: false,
      status: "no_match_found",
      suggestions: suggested.map(s => ({ 
        id: s.id, 
        name: s.name, 
        description: s.description,
        endpoint: s.x402Endpoint,
        priceUsd: s.priceUsd,
        exampleQuery: s.keywords[0] ? `I need ${s.keywords[0]}` : undefined
      })),
      catalogUrl: `${BASE_URL}/x402/catalog`,
      documentationUrl: `${BASE_URL}/.well-known/agent-instructions.json`
    }));
    const latencyMs = Date.now() - startTime;
    trackA2AHit(req, { resourceId: 'a2a-no-match', statusCode: 200, responseTimeMs: latencyMs, matched: false, queryText: text, requestId: taskId });
    logA2AInteraction({ requestId: taskId, latencyMs, statusCode: 200, matched: false, resourceId: 'a2a-no-match', matchCount: 0, intentType, queryText: text, clientIpHash, userAgent, trackingId });
    return;
  }

  const top = matches[0];

  const responseText = matches.length === 1
    ? formatServiceText(top)
    : `${formatServiceText(top)}\n\nAlternate matches:\n${matches.slice(1, 4).map(s => `- ${s.name} ($${s.priceUsd.toFixed(2)}): ${s.x402Endpoint}`).join('\n')}`;

  res.status(200).json(buildTaskResponse(taskId, [{
    parts: [{ type: 'text', text: responseText }]
  }], {
    matched: true,
    serviceId: top.id,
    priceUsd: top.priceUsd,
    x402Endpoint: top.x402Endpoint,
    paymentProtocol: 'x402',
    freeTrial: {
      url: `${BASE_URL}/api/m2m/credits/trial`,
      method: 'GET',
      note: 'No wallet required. Returns a $5 credit API key instantly. Works on all 63 services.',
      creditsUsd: 5,
      callsEstimate: '80-100 calls at standard pricing',
      curl: `curl ${BASE_URL}/api/m2m/credits/trial`
    },
    alternateMatches: matches.slice(1, 4).map(s => ({ id: s.id, name: s.name, priceUsd: s.priceUsd, x402Endpoint: s.x402Endpoint })),
    paymentRequest: {
      protocol: 'x402',
      version: 2,
      endpoint: top.x402Endpoint,
      method: 'POST',
      amount: top.priceUsd.toFixed(2),
      currency: 'USDC',
      networks: [
        {
          chain: 'base',
          caip2: 'eip155:8453',
          payTo: '0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91',
          tokenContract: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
          facilitator: 'https://api.cdp.coinbase.com/platform/v2/x402'
        },
        {
          chain: 'solana',
          caip2: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
          payTo: 'BmUPzSupHJu2kW4cL27dF7Vc2JaZTwXKzFsRuagPDtL8',
          tokenMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          facilitator: 'https://x402.dexter.cash'
        }
      ],
      flow: '1. POST to endpoint 2. Receive HTTP 402 challenge 3. Pay amount to payTo wallet 4. Resubmit with X-PAYMENT header containing payment proof 5. Receive data response'
    },
    actions: [{
      type: 'http',
      method: 'POST',
      url: top.x402Endpoint,
      description: 'Submit your request. Handle HTTP 402 by paying the x402 challenge, then resubmit with X-PAYMENT header.',
      headers: {
        'Content-Type': 'application/json',
        'X-PAYMENT': '<payment-proof-from-facilitator>'
      }
    }]
  }));
  const latencyMs = Date.now() - startTime;
  trackA2AHit(req, { resourceId: top.id, statusCode: 200, responseTimeMs: latencyMs, matched: true, queryText: text, requestId: taskId });
  logA2AInteraction({ requestId: taskId, latencyMs, statusCode: 200, matched: true, resourceId: top.id, matchCount: matches.length, intentType, queryText: text, clientIpHash, userAgent, trackingId });
}

export default router;
