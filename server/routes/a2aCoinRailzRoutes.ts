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
import { getCanonicalServiceCount } from '../utils/serviceCount';
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

type A2AIntentType = 'peer_discovery_greeting' | 'peer_offer_clawpay_v1' | 'peer_offer_x402' | 'ownership_claim_verify' | 'service_query' | 'no_text' | 'unknown';

function classifyA2AIntent(text: string): A2AIntentType {
  if (!text) return 'no_text';
  const t = text.trim();
  if (/^CLAWPAY_V1\s/i.test(t)) return 'peer_offer_clawpay_v1';
  // Peer agent advertising their own x402 service (contains pricing + payment terms)
  // Catches messages like "0.10 USDC/query via x402" or "49 USDC/month" with a service pitch
  if (
    (/\bUSdc\b|\bUSDC\b/i.test(t)) &&
    (/\/query\b|\/month\b|per (call|request|query)\b/i.test(t)) &&
    (/\b(x402|free trial|paid:|integrate|mcp|api)\b/i.test(t))
  ) return 'peer_offer_x402';
  // solved.earth + any registry claim/ownership verification probe
  if (
    /\baccept\b/i.test(t) ||
    /\bclaim\b/i.test(t) ||
    /solved\.earth/i.test(t) ||
    /\bverif(y|ication)\b.*\b(owner|claim|agent)\b/i.test(t) ||
    /\bprove\b.*\bownership\b/i.test(t) ||
    /\bconfirm\b.*\bownership\b/i.test(t) ||
    /\bagent.*owner\b/i.test(t) ||
    /\b(ownership|proprietor)\b/i.test(t)
  ) return 'ownership_claim_verify';
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

// Stop words that are too generic to be meaningful match signals
const STOP_WORDS = new Set([
  'the','and','for','any','all','are','not','can','you','this','that','with',
  'have','has','from','its','use','get','set','run','via','per','see','how',
  'pay','our','your','new','but','was','had','they','their','them','will',
  'out','one','two','her','his','him','may','way','who','yet','did','its',
  'what','when','where','which','who','why','both','each','few','more','most',
  'other','some','such','than','then','these','they','this','those','very',
  'just','also','into','here','been','only','same','want','make','sure',
  'ready','need','could','would','should','about','there','deploy','deployed',
]);

// Semantic patterns: high-confidence query intent → target service(s)
// Applied BEFORE keyword scoring to prevent generic word frequency from dominating
const SEMANTIC_PATTERNS: Array<{ pattern: RegExp; services: string[]; boost: number }> = [
  // Smart contract security / audit — order-independent: security keyword anywhere near contract keyword
  {
    pattern: /\b(solidity|smart contract)\b.*\b(vulnerabilit|security|audit|scan|safe|exploit|reentrancy|overflow|access control|cve|nvd)\b/i,
    services: ['contract-scan', 'smart-contract-audit'],
    boost: 25
  },
  {
    pattern: /\b(vulnerabilit|security.{0,20}scan|security.{0,20}audit|exploit|reentrancy|overflow|cve|nvd)\b.*\b(contract|solidity|evm|mainnet|deploy)\b/i,
    services: ['contract-scan', 'smart-contract-audit'],
    boost: 25
  },
  // Reverse order: security/CVE/NVD first, then smart contract mention anywhere in message
  {
    pattern: /\b(cve|nvd|vulnerabilit|security scanning|security scan|web3 security)\b/i,
    services: ['contract-scan', 'smart-contract-audit'],
    boost: 22
  },
  {
    pattern: /\b(scan|audit|check|review)\b.{0,60}\b(contract|solidity|smart contract|evm)\b/i,
    services: ['contract-scan', 'smart-contract-audit'],
    boost: 15
  },
  {
    pattern: /\b(contract|solidity|smart contract|evm)\b.{0,60}\b(scan|audit|check|review|secur)\b/i,
    services: ['contract-scan', 'smart-contract-audit'],
    boost: 15
  },
  // Gas price
  {
    pattern: /\b(gas price|gas fee|gas cost|gwei|current gas)\b/i,
    services: ['gas-price-oracle'],
    boost: 20
  },
  // Whale / large transfers
  {
    pattern: /\b(whale alert|large transfer|large tx|whale movement|whale wallet)\b/i,
    services: ['whale-alerts'],
    boost: 20
  },
  // Agent identity / verification
  {
    pattern: /\b(verify|verif(y|ication)).{0,20}\b(agent|identity|wallet|address)\b/i,
    services: ['verified-agent-identity'],
    boost: 20
  },
  {
    pattern: /\b(agent identity|on-chain identity|erc-8004|agent.*register|register.*agent)\b/i,
    services: ['verified-agent-identity'],
    boost: 20
  },
  // Portfolio / wallet balance
  {
    pattern: /\b(portfolio|wallet balance|my wallet|my portfolio|holdings|total value)\b/i,
    services: ['portfolio-tracker', 'multi-chain-balance'],
    boost: 15
  },
  // DEX / liquidity / swap routing
  {
    pattern: /\b(dex|liquidity|swap route|best (price|rate|swap)|slippage|uniswap|curve|balancer)\b/i,
    services: ['dex-liquidity', 'arbitrage-scanner'],
    boost: 15
  },
  // Prediction markets
  {
    pattern: /\b(polymarket|kalshi|prediction market|event market|bet(ting)?|odds)\b/i,
    services: ['polymarket-events', 'polymarket-search'],
    boost: 20
  },
  // Satellite / NASA / ESA
  {
    pattern: /\b(satellite|nasa|esa|earthdata|ndvi|land cover|imagery|remote sensing|copernicus)\b/i,
    services: ['satellite-earthdata', 'satellite-weather-imagery', 'satellite-data-bundle'],
    boost: 20
  },
  // AI inference
  {
    pattern: /\b(ai inference|llm|gpt|language model|ai model|run (ai|inference)|prompt)\b/i,
    services: ['ai-inference'],
    boost: 20
  },
  // Compliance / regulatory
  {
    pattern: /\b(compliance|regulatory|kyc|aml|sanctions|ofac|regulatory risk)\b/i,
    services: ['compliance-check', 'compliance-consultation'],
    boost: 15
  },
  // Trading signals
  {
    pattern: /\b(trading signal|buy signal|sell signal|entry point|exit point|trade recommendation)\b/i,
    services: ['trading-signal', 'trade-signals'],
    boost: 20
  },
  // Token sentiment
  {
    pattern: /\b(token sentiment|market sentiment|social sentiment|twitter sentiment|fear.{0,10}greed)\b/i,
    services: ['token-sentiment', 'sentiment-analysis'],
    boost: 20
  },
  // Risk / credit
  {
    pattern: /\b(credit risk|risk score|default risk|defi risk|protocol risk)\b/i,
    services: ['credit-risk-score'],
    boost: 20
  },
  // First call / onboarding
  {
    pattern: /\b(first (call|payment)|onboard(ing)?|getting started|first x402|try.*payment)\b/i,
    services: ['first-call'],
    boost: 20
  },
  // B20 token transfer / send — must match BEFORE general B20 catch-all
  {
    pattern: /\bB20\b.{0,60}\b(transfer|send|move|can i (transfer|send)|sending)\b/i,
    services: ['b20-transfer-check'],
    boost: 30
  },
  {
    pattern: /\b(transfer|send|move)\b.{0,60}\bB20\b/i,
    services: ['b20-transfer-check'],
    boost: 30
  },
  {
    pattern: /\b(check|can i|simulate|verify|test).{0,30}\b(transfer|send).{0,30}\bB20\b/i,
    services: ['b20-transfer-check'],
    boost: 30
  },
  // B20 compliance / freeze / blocklist / allowlist
  {
    pattern: /\bB20\b.{0,60}\b(freeze|frozen|blocklist|block(ed)?|allowlist|allowed|compliance|restricted|sanction|regulatory)\b/i,
    services: ['b20-compliance-scan'],
    boost: 28
  },
  {
    pattern: /\b(freeze|blocklist|allowlist|compliance|sanction).{0,60}\bB20\b/i,
    services: ['b20-compliance-scan'],
    boost: 28
  },
  // B20 token info / metadata / price
  {
    pattern: /\bB20\b.{0,60}\b(info|metadata|supply|decimals|symbol|price|market|cap|holders)\b/i,
    services: ['b20-token-info'],
    boost: 25
  },
  // B20 general catch-all — low boost, fires only if no specific pattern matched higher
  {
    pattern: /\bB20\b/i,
    services: ['b20-token-info', 'b20-transfer-check'],
    boost: 10
  },
  // Robinhood Chain stock / price feeds
  {
    pattern: /\b(robinhood chain|rh chain|eip155:4663|rh-stock|chainlink.*(stock|equity|price feed))\b/i,
    services: ['rh-stock-price', 'rh-bridge-usdc'],
    boost: 25
  },
  {
    pattern: /\b(stock price|equity price|share price|aapl|nvda|spy|tsla|msft|googl|amzn|meta).{0,40}\b(chain|on-chain|chainlink|robinhood)\b/i,
    services: ['rh-stock-price'],
    boost: 25
  },
  // Robinhood Chain bridge / USDC bridging
  {
    pattern: /\b(bridge|cross-chain|base to robinhood|usdc.*robinhood|usdg)\b/i,
    services: ['rh-bridge-usdc'],
    boost: 25
  },
  // Crypto asset price queries — handles natural-language variants:
  // "How much is 1 BTC", "bitcoin price today", "what is ETH worth",
  // "what's the price of bitcoin", "BTC/USD quote", etc.
  {
    pattern: /\b(how much is|price of|value of|current price of|what is|what'?s|how much does).{0,25}\b(bitcoin|btc|ethereum|eth|solana|sol|bnb|matic|polygon|xrp|ripple|crypto)\b/i,
    services: ['rh-stock-price'],
    boost: 30
  },
  {
    pattern: /\b(bitcoin|btc|ethereum|eth|solana|sol|bnb|xrp|matic)\b.{0,25}\b(price|today|usd|worth|value|cost|rate|quote|now)\b/i,
    services: ['rh-stock-price'],
    boost: 30
  },
  // Seeded from confirmed miss: "How much is bitcoin today", "one bitcoin" variants
  {
    pattern: /\b(bitcoin|btc|ethereum|eth|solana|sol)\b.{0,10}\b(up|down|market|cap|24h)\b/i,
    services: ['rh-stock-price'],
    boost: 25
  },
];

function kwMatches(text: string, kw: string): boolean {
  // Skip stop words — they create false score inflation
  if (STOP_WORDS.has(kw.toLowerCase())) return false;
  // Skip very short or purely punctuation tokens
  if (kw.length <= 2 || /^[^a-z0-9]+$/i.test(kw)) return false;
  if (kw.length <= 4) {
    return new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text);
  }
  return text.toLowerCase().includes(kw.toLowerCase());
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
  // Normalise number words → digits so "one bitcoin" matches the same as "1 bitcoin"
  const normalizedText = text
    .replace(/\bone\b/gi, '1')
    .replace(/\btwo\b/gi, '2')
    .replace(/\bthree\b/gi, '3')
    .replace(/\bfive\b/gi, '5')
    .replace(/\bten\b/gi, '10');
  const lower = normalizedText.toLowerCase();

  // Build semantic boost map from high-confidence intent patterns
  // These fire before keyword scoring to prevent stop-word noise from winning
  const semanticBoosts = new Map<string, number>();
  for (const { pattern, services, boost } of SEMANTIC_PATTERNS) {
    if (pattern.test(normalizedText)) {
      for (const svcId of services) {
        semanticBoosts.set(svcId, (semanticBoosts.get(svcId) ?? 0) + boost);
      }
    }
  }

  // Use the canonical serviceCatalogService which has 60+ services
  const fullCatalog = serviceCatalogService.getCatalog().services;
  
  const scored = fullCatalog.map(entry => {
    // Start with any semantic boost for this service
    let hits = semanticBoosts.get(entry.id) ?? 0;
    
    // Build keyword list — description split into tokens, capabilities as-is
    const kws = [
      ...(entry.capabilities || []),
      entry.id,
      entry.name.toLowerCase(),
      entry.category.toLowerCase(),
      ...entry.description.toLowerCase().split(/\s+/)
    ].filter(k => k.length > 2 && !STOP_WORDS.has(k.toLowerCase()));

    for (const kw of kws) {
      if (kwMatches(lower, kw)) hits++;
    }

    // Exact ID or name match gets an additional boost (against normalizedText)
    if (lower.includes(entry.id)) hits += 5;
    if (lower.includes(entry.name.toLowerCase())) hits += 5;
    
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
 * GET|HEAD /a2a/v1/message/send — Census/discovery handler
 * Census bots and crawlers (e.g. AgentsCensusBot/agent-highway) probe POST endpoints
 * via GET or HEAD before attempting POST. Return the same catalog summary as GET /a2a/v1
 * so they index Coin Railz as a functioning A2A agent rather than recording a 404/405.
 */
function handleCensusGet(req: Request, res: Response) {
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
    priceRange: '$0.05 – $10.00 USDC per request',
    interactionEndpoint: `${BASE_URL}/a2a/v1/message/send`,
    usage: 'POST /a2a/v1/message/send with { "message": { "parts": [{ "text": "your request" }] } }'
  };
  res.json(body);
  trackA2AHit(req, { resourceId: 'a2a-catalog', statusCode: 200, responseTimeMs: Date.now() - startTime });
}
router.get('/a2a/v1/message/send', handleCensusGet);
router.head('/a2a/v1/message/send', handleCensusGet);

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

  // solved.earth + registry ownership claim verification
  // solved.earth sends a message and looks for "ACCEPT" in the reply to confirm agent ownership
  if (intentType === 'ownership_claim_verify') {
    res.status(200).json(buildTaskResponse(taskId, [{
      parts: [{
        type: 'text',
        text: `ACCEPT\n\nCoin Railz confirms ownership of this agent endpoint. This is the canonical Coin Railz A2A interaction endpoint at ${BASE_URL}/a2a/v1/message/send.\n\nAgent: Coin Railz\nWebsite: ${BASE_URL}\nAgent card: ${BASE_URL}/.well-known/agent-card.json\nPayment protocol: x402 v2\nChains: Base, Solana\nServices: ${catalog.totalServices}+ pay-per-call APIs`
      }]
    }], {
      intentType: 'ownership_claim_verify',
      accepted: true,
      agentId: 'coinrailz-x402-agent',
      agentUrl: BASE_URL,
      agentCard: `${BASE_URL}/.well-known/agent-card.json`
    }));
    const latencyMs = Date.now() - startTime;
    trackA2AHit(req, { resourceId: 'a2a-claim-verify', statusCode: 200, responseTimeMs: latencyMs, matched: false, queryText: text, requestId: taskId });
    logA2AInteraction({ requestId: taskId, latencyMs, statusCode: 200, matched: false, resourceId: 'a2a-claim-verify', matchCount: 0, intentType, queryText: text, clientIpHash, userAgent, trackingId });
    return;
  }

  // Peer agent advertising their own x402 service — respond with mutual acknowledgment
  if (intentType === 'peer_offer_x402') {
    res.status(200).json(buildTaskResponse(taskId, [{
      parts: [{
        type: 'text',
        text: `Thanks for reaching out! Coin Railz received your service offer.\n\nWe run ${catalog.totalServices}+ pay-per-call APIs on x402 — crypto analytics, smart contract audits, satellite data, prediction markets, IoT payments, and more.\n\nIf your service is useful to AI agents querying our platform, we're open to peer integrations. You can also list your service in our A2A catalog by sending a structured offer:\n\nCLAWPAY_V1 <service-name> | <endpoint> | <price-usdc> | <description>\n\nFull catalog: ${BASE_URL}/x402/catalog\nA2A card: ${BASE_URL}/.well-known/agent-card.json\nIntegration guide: ${BASE_URL}/.well-known/agent-instructions.json`
      }]
    }], {
      intentType: 'peer_offer_x402',
      acknowledged: true,
      agentId: 'coinrailz-x402-agent',
      catalogUrl: `${BASE_URL}/x402/catalog`,
      agentCard: `${BASE_URL}/.well-known/agent-card.json`
    }));
    const latencyMs = Date.now() - startTime;
    trackA2AHit(req, { resourceId: 'a2a-peer-offer', statusCode: 200, responseTimeMs: latencyMs, matched: false, queryText: text, requestId: taskId });
    logA2AInteraction({ requestId: taskId, latencyMs, statusCode: 200, matched: false, resourceId: 'a2a-peer-offer', matchCount: 0, intentType, queryText: text, clientIpHash, userAgent, trackingId });
    return;
  }

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
      note: `No wallet required. Returns a $5 credit API key instantly. Works on all ${getCanonicalServiceCount()} services.`,
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
