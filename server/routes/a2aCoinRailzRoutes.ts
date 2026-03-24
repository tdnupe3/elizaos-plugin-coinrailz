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

export const SERVICE_CATALOG: ServiceEntry[] = [
  {
    id: 'gas-price-oracle',
    name: 'Gas Price Oracle',
    priceUsd: 0.10,
    x402Endpoint: `${BASE_URL}/x402/gas-price-oracle`,
    description: 'Real-time gas price predictions across multiple chains',
    keywords: ['gas', 'gwei', 'fee', 'fees', 'gas price', 'transaction cost', 'ethereum gas', 'base gas', 'polygon gas', 'cheap gas', 'fast gas']
  },
  {
    id: 'token-metadata',
    name: 'Token Metadata',
    priceUsd: 0.10,
    x402Endpoint: `${BASE_URL}/x402/token-metadata`,
    description: 'Comprehensive token information including name, symbol, decimals, and contract details',
    keywords: ['token', 'metadata', 'symbol', 'decimals', 'contract', 'erc20', 'token info', 'token details', 'coin info']
  },
  {
    id: 'dex-liquidity',
    name: 'DEX Liquidity Scanner',
    priceUsd: 0.20,
    x402Endpoint: `${BASE_URL}/x402/dex-liquidity`,
    description: 'Analyze liquidity pools, depths, and trading conditions across DEXs',
    keywords: ['liquidity', 'pool', 'dex', 'uniswap', 'amm', 'swap', 'defi', 'trading pair', 'lp', 'depth', 'slippage']
  },
  {
    id: 'approval-manager',
    name: 'Token Approval Manager',
    priceUsd: 0.20,
    x402Endpoint: `${BASE_URL}/x402/approval-manager`,
    description: 'Check and manage token approvals for smart contracts',
    keywords: ['approval', 'allowance', 'approve', 'token approval', 'revoke', 'spend limit']
  },
  {
    id: 'token-price',
    name: 'Token Price Feed',
    priceUsd: 0.25,
    x402Endpoint: `${BASE_URL}/x402/token-price`,
    description: 'Real-time token prices from multiple sources',
    keywords: ['price', 'prices', 'token price', 'eth price', 'btc price', 'usdc price', 'market price', 'spot price', 'quote']
  },
  {
    id: 'token-sentiment',
    name: 'Token Sentiment Analysis',
    priceUsd: 0.25,
    x402Endpoint: `${BASE_URL}/x402/token-sentiment`,
    description: 'AI-powered sentiment analysis for tokens from social and on-chain data',
    keywords: ['sentiment', 'social', 'twitter', 'mood', 'bullish', 'bearish', 'community', 'hype', 'fud']
  },
  {
    id: 'whale-alerts',
    name: 'Whale Alerts',
    priceUsd: 0.35,
    x402Endpoint: `${BASE_URL}/x402/whale-alerts`,
    description: 'Real-time monitoring of large wallet movements and whale activity',
    keywords: ['whale', 'large transaction', 'wallet movement', 'big trade', 'large transfer', 'accumulation', 'dump']
  },
  {
    id: 'wallet-tracker',
    name: 'Wallet Tracker',
    priceUsd: 0.25,
    x402Endpoint: `${BASE_URL}/x402/wallet-tracker`,
    description: 'Track wallet portfolio holdings and transaction history',
    keywords: ['wallet', 'track', 'portfolio', 'holdings', 'balance', 'address', 'wallet history', 'transactions', 'pnl']
  },
  {
    id: 'smart-contract-audit',
    name: 'Smart Contract Audit',
    priceUsd: 10.00,
    x402Endpoint: `${BASE_URL}/x402/smart-contract-audit`,
    description: 'Comprehensive security audit with vulnerability detection',
    keywords: ['audit', 'smart contract', 'security audit', 'vulnerability', 'reentrancy', 'exploit', 'contract audit', 'solidity audit', 'bytecode', 'is this contract safe', 'verify contract', 'hack', 'decompile']
  },
  {
    id: 'contract-scanner',
    name: 'Contract Scanner',
    priceUsd: 1.00,
    x402Endpoint: `${BASE_URL}/x402/contract-scanner`,
    description: 'Deep analysis of smart contract code and security vulnerabilities',
    keywords: ['contract scan', 'scan contract', 'contract security', 'honeypot', 'rugpull', 'rug pull', 'malicious', 'rugpull detection', 'is this a scam', 'token safe', 'liquidity lock', 'ownership renounced']
  },
  {
    id: 'trading-signal',
    name: 'Trading Signal Generator',
    priceUsd: 1.00,
    x402Endpoint: `${BASE_URL}/x402/trading-signal`,
    description: 'Generate actionable trading signals with entry and exit points',
    keywords: ['signal', 'trading signal', 'buy signal', 'sell signal', 'entry', 'exit', 'trade', 'technical analysis', 'ta']
  },
  {
    id: 'sentiment-analysis',
    name: 'Market Sentiment Analysis',
    priceUsd: 0.50,
    x402Endpoint: `${BASE_URL}/x402/sentiment-analysis`,
    description: 'Analyze market sentiment from social media and news sources',
    keywords: ['market sentiment', 'news sentiment', 'fear greed', 'market mood', 'social media', 'news analysis']
  },
  {
    id: 'arbitrage-scanner',
    name: 'Arbitrage Scanner',
    priceUsd: 1.25,
    x402Endpoint: `${BASE_URL}/x402/arbitrage-scanner`,
    description: 'Detect arbitrage opportunities across exchanges and chains',
    keywords: ['arbitrage', 'arb', 'price difference', 'cross exchange', 'profit opportunity', 'spread']
  },
  {
    id: 'portfolio-optimization',
    name: 'Portfolio Optimization',
    priceUsd: 2.00,
    x402Endpoint: `${BASE_URL}/x402/portfolio-optimization`,
    description: 'AI-powered portfolio optimization and rebalancing recommendations',
    keywords: ['portfolio', 'optimize', 'rebalance', 'allocation', 'diversify', 'risk adjusted', 'sharpe']
  },
  {
    id: 'risk-metrics',
    name: 'Risk Metrics',
    priceUsd: 1.00,
    x402Endpoint: `${BASE_URL}/x402/risk-metrics`,
    description: 'Calculate VaR, Sharpe ratio, and other risk metrics',
    keywords: ['risk', 'var', 'sharpe ratio', 'volatility', 'drawdown', 'metrics', 'beta', 'alpha']
  },
  {
    id: 'polymarket-odds',
    name: 'Polymarket Odds',
    priceUsd: 0.50,
    x402Endpoint: `${BASE_URL}/x402/polymarket-odds`,
    description: 'Get current odds from Polymarket prediction markets',
    keywords: ['polymarket', 'prediction', 'odds', 'market', 'bet', 'probability', 'prediction market', 'yes no']
  },
  {
    id: 'polymarket-events',
    name: 'Polymarket Events',
    priceUsd: 0.25,
    x402Endpoint: `${BASE_URL}/x402/polymarket-events`,
    description: 'Get trending events from Polymarket',
    keywords: ['polymarket events', 'trending markets', 'open markets', 'polymarket trending']
  },
  {
    id: 'kalshi-markets',
    name: 'Kalshi Markets',
    priceUsd: 0.25,
    x402Endpoint: `${BASE_URL}/x402/kalshi-markets`,
    description: 'Get active event contracts from Kalshi prediction exchange',
    keywords: ['kalshi', 'event contract', 'prediction exchange', 'regulated prediction', 'kalshi market']
  },
  {
    id: 'stock-sentiment',
    name: 'Stock Market Sentiment',
    priceUsd: 0.40,
    x402Endpoint: `${BASE_URL}/x402/stock-sentiment`,
    description: 'AI-powered stock market sentiment analysis',
    keywords: ['stock', 'equity', 'nasdaq', 'sp500', 's&p', 'nyse', 'earnings', 'institutional', 'wall street']
  },
  {
    id: 'forex-sentiment',
    name: 'Forex Sentiment Analysis',
    priceUsd: 0.40,
    x402Endpoint: `${BASE_URL}/x402/forex-sentiment`,
    description: 'AI-powered forex sentiment with central bank policy analysis',
    keywords: ['forex', 'fx', 'currency', 'exchange rate', 'central bank', 'fed', 'ecb', 'eur usd', 'usd jpy']
  },
  {
    id: 'fraud-detection',
    name: 'Fraud Detection',
    priceUsd: 0.75,
    x402Endpoint: `${BASE_URL}/x402/fraud-detection`,
    description: 'AI-powered fraud detection for financial transactions',
    keywords: ['fraud', 'suspicious', 'scam', 'detect', 'aml', 'risk score', 'blacklist', 'sanctions', 'money laundering', 'mixer', 'sanctioned', 'ofac', 'dirty funds', 'chainalysis', 'wallet score']
  },
  {
    id: 'credit-risk-score',
    name: 'Credit Risk Score',
    priceUsd: 1.25,
    x402Endpoint: `${BASE_URL}/x402/credit-risk-score`,
    description: 'Calculate credit risk scores for wallets and entities',
    keywords: ['credit', 'credit risk', 'creditworthiness', 'loan', 'lending', 'defi credit', 'collateral']
  },
  {
    id: 'verified-agent-identity',
    name: 'Verified Agent Identity',
    priceUsd: 5.00,
    x402Endpoint: `${BASE_URL}/x402/verified-agent-identity`,
    description: 'On-chain identity verification and reputation for AI agents',
    keywords: ['agent identity', 'identity', 'verification', 'reputation', 'erc-8004', 'on-chain identity', 'did', 'agent reputation', 'trust score', 'who is this agent', 'agent trust', 'agent verified', 'blockchain identity']
  },
  {
    id: 'agent-create-wallet',
    name: 'Agent Wallet Provisioning',
    priceUsd: 2.00,
    x402Endpoint: `${BASE_URL}/x402/agent-create-wallet`,
    description: 'Create CDP-managed wallets for AI agents with instant USDC support on Base',
    keywords: ['create wallet', 'agent wallet', 'provision wallet', 'cdp wallet', 'managed wallet', 'new wallet']
  },
  {
    id: 'fire-alerts',
    name: 'Fire Alerts',
    priceUsd: 0.15,
    x402Endpoint: `${BASE_URL}/x402/fire-alerts`,
    description: 'NASA FIRMS real-time wildfire and fire detection alerts',
    keywords: ['fire', 'wildfire', 'nasa', 'firms', 'fire alert', 'satellite fire', 'burn area']
  },
  {
    id: 'weather-imagery',
    name: 'Weather Satellite Imagery',
    priceUsd: 0.20,
    x402Endpoint: `${BASE_URL}/x402/weather-imagery`,
    description: 'NASA GIBS satellite weather imagery data',
    keywords: ['weather', 'satellite', 'nasa', 'imagery', 'weather imagery', 'gibs', 'cloud cover']
  },
  {
    id: 'air-quality',
    name: 'Air Quality Data',
    priceUsd: 0.15,
    x402Endpoint: `${BASE_URL}/x402/air-quality`,
    description: 'Ground-level air quality measurements from OpenAQ',
    keywords: ['air quality', 'pollution', 'pm2.5', 'aqi', 'openaq', 'air pollution', 'co2']
  },
  {
    id: 'ping',
    name: 'x402 Discovery Ping',
    priceUsd: 0.25,
    x402Endpoint: `${BASE_URL}/x402/ping`,
    description: 'x402 discovery and testing endpoint — validate integration',
    keywords: ['ping', 'test', 'discover', 'health', 'x402 test', 'validate', 'check', 'connection test']
  },
  {
    id: 'instant-agent-wallet',
    name: 'Instant Agent Wallet',
    priceUsd: 1.00,
    x402Endpoint: `${BASE_URL}/x402/instant-agent-wallet`,
    description: 'Create managed wallets for AI agents instantly',
    keywords: ['instant wallet', 'quick wallet', 'setup wallet', 'agent onboard', 'onboarding wallet']
  },
  {
    id: 'property-valuation',
    name: 'Property Valuation',
    priceUsd: 0.75,
    x402Endpoint: `${BASE_URL}/x402/property-valuation`,
    description: 'AI-powered real estate property valuation and market analysis',
    keywords: ['property', 'real estate', 'valuation', 'house price', 'commercial property', 'appraisal', 'home value']
  }
];

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

function matchServices(text: string): ServiceEntry[] {
  const lower = text.toLowerCase();
  const scored = SERVICE_CATALOG.map(service => {
    let hits = 0;
    for (const kw of service.keywords) {
      if (kwMatches(lower, kw)) hits++;
    }
    if (lower.includes(service.id)) hits += 3;
    if (lower.includes(service.name.toLowerCase())) hits += 3;
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

const TOP_SKILLS_PREVIEW = SERVICE_CATALOG.slice(0, 6).map(s => `- ${s.name} ($${s.priceUsd.toFixed(2)}): ${s.description}`).join('\n');

/**
 * GET /a2a/v1 — Agent card summary for discovery
 */
router.get('/a2a/v1', (req: Request, res: Response) => {
  const startTime = Date.now();
  const body = {
    id: 'coinrailz-x402-agent',
    name: 'Coin Railz',
    description: 'Multi-chain x402 micropayment infrastructure for AI agents. 44+ pay-per-call API services across crypto analytics, trading signals, security audits, satellite data, prediction markets, and more.',
    version: '3.1.0',
    protocolVersion: '0.3.0',
    skillCount: SERVICE_CATALOG.length,
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

  if (intentType === 'peer_discovery_greeting' && matches.length === 0) {
    const featured = SERVICE_CATALOG.slice(0, 6);
    res.status(200).json(buildTaskResponse(taskId, [{
      parts: [{
        type: 'text',
        text: `Hello! I'm Coin Railz — multi-chain x402 payment infrastructure for AI agents.\n\nI offer ${SERVICE_CATALOG.length} pay-per-call API services. Send me a natural language query describing what you need. Examples:\n- "What's the current gas price on Base?"\n- "Get token metadata for USDC"\n- "Scan this smart contract for vulnerabilities: 0x..."\n- "Show me whale alerts"\n- "Verify agent identity"\n\nEach service costs between $0.10–$10.00 USDC, paid via x402 protocol.\n\nFull catalog: ${BASE_URL}/x402/catalog\nIntegration guide: ${BASE_URL}/.well-known/agent-instructions.json\nFree trial (no crypto needed): ${BASE_URL}/api/m2m/credits/trial`
      }]
    }], {
      matched: false,
      intentType: 'peer_discovery_greeting',
      serviceCount: SERVICE_CATALOG.length,
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
    const suggested = SERVICE_CATALOG.sort(() => 0.5 - Math.random()).slice(0, 5);
    res.status(200).json(buildTaskResponse(taskId, [{
      parts: [{
        type: 'text',
        text: `I couldn't find a specific service matching "${text}".\n\nCoin Railz offers 44+ automated API services. Here are some you might be looking for:\n${suggested.map(s => `- ${s.name}: ${s.description}`).join('\n')}\n\nTry these example queries:\n- "What's the current gas price on Base?"\n- "Is this smart contract safe: 0x..."\n- "Get whale alerts for USDC on Solana"\n- "Check my wallet portfolio: [address]"\n\nFull service catalog: ${BASE_URL}/x402/catalog\nIntegration Guide: ${BASE_URL}/.well-known/agent-instructions.json`
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
