/**
 * MCP Delivery Routes — Hosted Model Context Protocol server
 *
 * Exposes Coin Railz x402 services as MCP tools, enabling any
 * MCP-compatible agent runtime (Claude, OpenAI, Cursor, etc.) to
 * discover and pay for services using the existing payment rails.
 *
 * Routes:
 *   GET  /mcp/tools/list          — list all available paid tools
 *   POST /mcp/tools/call          — call a tool (requires API key or x402)
 *   POST /mcp/sessions            — create a named session (advisory, stateless)
 *
 * Payment: checks X-API-KEY or Authorization: Bearer header first,
 * then X-PAYMENT for native x402. No new business logic — thin adapter
 * that proxies to the existing /x402/* service handlers.
 *
 * Security: tool IDs are allowlisted from the canonical catalog only.
 * No arbitrary URL routing. SSRF not possible.
 *
 * Analytics: every request path is tracked via x402InteractionTracker so
 * the MCP funnel (initialize → tools/list → tools/call → payment) is
 * visible in x402_interactions alongside native /x402/* calls.
 * NOTE: Do NOT add x402TrackingMiddleware to /mcp routes — that would
 * create duplicate rows since mcpDeliveryRoutes calls the tracker directly.
 */

import { Router, Request, Response } from 'express';
import { nanoid } from 'nanoid';
import { getCanonicalServices, getCanonicalServiceCount, CanonicalService } from '../utils/serviceCount';
import {
  getFacilitatorUrl,
  USDC_BASE_ADDRESS,
} from '../utils/facilitatorHelper';
import { x402InteractionTracker } from '../services/x402InteractionTracker';

const router = Router();

// MCP protocol version we advertise
const MCP_VERSION = '2024-11-05';
const SUPPORTED_MCP_METHODS = [
  'initialize',
  'tools/list',
  'tools/call',
  'resources/list',
  'resources/read',
  'prompts/list',
  'prompts/get',
  'notifications/*',
] as const;

// ---------------------------------------------------------------------------
// Platform wallet + base URL — resolved once at module load.
// BASE_URL: PUBLIC_URL env var takes priority (set in production + staging).
// Dev fallback is localhost so recipe/trial URLs resolve in local testing.
// ---------------------------------------------------------------------------
const PLATFORM_WALLET_EVM = process.env.PLATFORM_WALLET_ADDRESS || '0xa4bBE37f9A6Ae2dc36a607B91eB148C0ae163C91';
const BASE_URL            = process.env.PUBLIC_URL ||
  (process.env.REPLIT_DEPLOYMENT === '1' ? 'https://coinrailz.com' : 'http://localhost:5000');

// ---------------------------------------------------------------------------
// Auth mode detection — distinguishes credential type for analytics
// ---------------------------------------------------------------------------
type AuthMode = 'api-key' | 'bearer' | 'x402' | 'none';

function detectAuthMode(req: Request): AuthMode {
  if (req.headers['x-api-key']) return 'api-key';
  if ((req.headers['authorization'] as string | undefined)?.startsWith('Bearer ')) return 'bearer';
  // @x402/fetch 2.x sends PAYMENT-SIGNATURE (v2) while older clients send X-PAYMENT (v1).
  // Both header names carry the same encoded payment proof — treat them identically.
  if (req.headers['x-payment'] || req.headers['payment-signature']) return 'x402';
  return 'none';
}

// ---------------------------------------------------------------------------
// Helper: resolve API key from request headers
// ---------------------------------------------------------------------------
function extractApiKey(req: Request): string | null {
  const xApiKey = req.headers['x-api-key'] as string | undefined;
  if (xApiKey) return xApiKey;

  const auth = req.headers['authorization'] as string | undefined;
  if (auth?.startsWith('Bearer ')) return auth.slice(7);

  return null;
}

// ---------------------------------------------------------------------------
// Helper: extract client IP (respects trust proxy config)
// ---------------------------------------------------------------------------
function getClientIp(req: Request): string {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
    || req.ip
    || (req.socket as any)?.remoteAddress
    || 'unknown'
  );
}

// ---------------------------------------------------------------------------
// Helper: extract payer wallet + payment amount from X-PAYMENT header.
//
// X-PAYMENT format (EVM/x402 v2):
//   base64(JSON.stringify({
//     x402Version: 2, scheme: 'exact', network: 'eip155:8453',
//     payload: { authorization: { from, to, value, ... }, signature }
//   }))
//
// Returns null on ANY failure — this is analytics attribution only.
// The upstream /x402/ service is the authoritative payment verifier.
// NEVER log the raw header value (contains signed authorization data).
// ---------------------------------------------------------------------------
interface PayerInfo {
  walletAddress: string;
  paymentAmountUsd: number;
  network: string;
}

function extractPayerFromXPayment(header: string): PayerInfo | null {
  try {
    if (!header || header.length > 4096) return null; // safety bound
    const decoded = JSON.parse(Buffer.from(header, 'base64').toString('utf8'));
    const auth = decoded?.payload?.authorization;
    if (!auth?.from || typeof auth.from !== 'string') return null;
    const valueRaw = auth.value;
    const valueMicro = typeof valueRaw === 'string' ? parseInt(valueRaw, 10)
                     : typeof valueRaw === 'number' ? valueRaw
                     : null;
    if (valueMicro === null || isNaN(valueMicro) || valueMicro < 0) return null;
    return {
      walletAddress:    auth.from,
      paymentAmountUsd: valueMicro / 1_000_000,
      network:          decoded.network ?? 'eip155:8453',
    };
  } catch {
    return null; // malformed, non-base64, or unexpected schema — silent
  }
}

// ---------------------------------------------------------------------------
// MCP Interaction Tracker — writes a row to x402_interactions for every
// significant MCP event. Fires-and-forgets (non-fatal on error).
//
// event_type conventions for MCP:
//   mcp-initialize           — client sent initialize handshake
//   mcp-tools-list           — tools/list method (GET or POST)
//   mcp-challenge-issued     — tools/call with no auth → 402
//   mcp-challenge-cache-hit  — challenge served from in-process cache
//   mcp-payment-presented    — client retried tools/call with an x402 proof
//   mcp-payment-rejected     — upstream rejected that x402 proof
//   mcp-api-key-authorized   — tools/call with API key → upstream 200
//   mcp-x402-authorized      — tools/call with X-PAYMENT → upstream 200
//   mcp-upstream-hoisted     — upstream 402 rewritten and hoisted to client
//   mcp-upstream-error       — upstream returned non-2xx (excluding 402)
//   mcp-transport-error      — fetch() to upstream threw an exception
//   mcp-invalid-request      — malformed JSON-RPC (missing method/name)
//   mcp-unknown-tool         — tools/call for a tool not in catalog
//   mcp-unknown-method       — JSON-RPC method not recognized
//   mcp-tools-list-error     — GET /mcp/tools/list threw unexpectedly
// ---------------------------------------------------------------------------
interface McpTrackParams {
  req: Request;
  serviceId: string;
  mcpMethod: string;        // JSON-RPC method or 'GET /mcp/tools/list'
  responseStatus: number;
  paid?: boolean;
  eventType: string;
  toolName?: string;
  latencyMs: number;
  requestId: string;
  authMode: AuthMode;
  upstreamStatus?: number;
  cacheAgeMs?: number;      // present on cache-hit events
  errorMessage?: string;
  walletAddress?: string;   // x402 payer — populated only when the signed proof is parseable
  paymentAmount?: number;   // USD amount — populated only when the signed proof is parseable
  paymentStage?: 'presented' | 'rejected' | 'verified-and-delivered';
}

function trackMcpEvent(p: McpTrackParams): void {
  const interactionType =
    p.paid || p.eventType === 'mcp-payment-presented' ? 'payment'
    : p.responseStatus === 402 ? 'attempt'
    : p.responseStatus >= 400  ? 'error'
    : 'view';

  x402InteractionTracker.trackInteraction({
    serviceId:    p.serviceId,
    serviceName:  p.serviceId,
    ipAddress:    getClientIp(p.req),
    userAgent:    p.req.get('user-agent'),
    requestPath:  p.req.path,
    requestMethod: p.req.method,
    responseStatus: p.responseStatus,
    paid:         p.paid ?? false,
    interactionType,
    requestId:    p.requestId,
    eventType:    p.eventType,
    x402ClientHeader: p.req.get('x-402-client') || p.req.get('x-agent-id') || undefined,
    referer:      p.req.get('referer') || p.req.get('origin') || undefined,
    latencyMs:    p.latencyMs,
    paymentReceived: p.paid ?? false,
    errorMessage: p.errorMessage,
    // x402 payer attribution — present only when a signed proof is parseable.
    walletAddress:   p.walletAddress,
    paymentAmount:   p.paymentAmount,
    metadata: {
      mcpMethod:     p.mcpMethod,
      toolName:      p.toolName,
      authMode:      p.authMode,
      // Never log credential values — only the mode.
      // Check both header names: @x402/fetch v2 sends PAYMENT-SIGNATURE, v1 sends X-PAYMENT.
      hasPaymentHeader: !!(p.req.headers['x-payment'] || p.req.headers['payment-signature']),
      mcpSessionId:  p.req.get('x-mcp-session-id') || undefined,
      transport:     'streamable-http',
      upstreamStatus: p.upstreamStatus,
       cacheAgeMs:    p.cacheAgeMs,
       paymentStage:  p.paymentStage,
    },
  }).catch(() => { /* non-fatal — tracking must never break the delivery path */ });
}

// ---------------------------------------------------------------------------
// MCP 402 Challenge Cache — per-service, TTL 90 seconds.
//
// Challenge payloads for a given service are IDENTICAL for every unauthenticated
// request (same price, same wallet, same facilitator). Caching eliminates
// redundant object construction and serialization for burst-sweeping actors.
//
// Scope: MCP routes only. /x402/* routes have their own response pipeline and
// are not covered here — do not conflate them in analytics or documentation.
//
// Cached data: body string + headers map. Request-specific fields (JSON-RPC
// `id`) are updated on each serve so they never leak across requests.
// ---------------------------------------------------------------------------
interface CachedChallenge {
  /** Pre-serialized 402 body with `id` field as placeholder "__MCP_ID__" */
  bodyTemplate: string;
  headers: Record<string, string>;
  cachedAt: number;
  serviceId: string;
}

const CHALLENGE_TTL_MS = 90 * 1_000;
const mcpChallengeCache = new Map<string, CachedChallenge>();

// Evict stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, c] of mcpChallengeCache.entries()) {
    if (now - c.cachedAt > CHALLENGE_TTL_MS * 4) mcpChallengeCache.delete(key);
  }
}, 5 * 60 * 1_000);

function getCachedChallenge(serviceId: string): CachedChallenge | null {
  const c = mcpChallengeCache.get(serviceId);
  if (!c) return null;
  if (Date.now() - c.cachedAt > CHALLENGE_TTL_MS) {
    mcpChallengeCache.delete(serviceId);
    return null;
  }
  return c;
}

function setCachedChallenge(serviceId: string, payload: object, headers: Record<string, string>): void {
  try {
    const bodyStr = JSON.stringify(payload);
    // Replace the request id value with a placeholder so we can substitute per-request
    const bodyTemplate = bodyStr.replace(/"id"\s*:\s*(?:"[^"]*"|\d+|null)/, '"id":"__MCP_ID__"');
    mcpChallengeCache.set(serviceId, { bodyTemplate, headers, cachedAt: Date.now(), serviceId });
  } catch (_) { /* non-fatal */ }
}

function serveCachedChallenge(
  res: Response,
  cached: CachedChallenge,
  reqId: unknown,
): void {
  // Substitute the per-request JSON-RPC id
  const idStr  = reqId === null || reqId === undefined ? 'null'
    : typeof reqId === 'string' ? `"${String(reqId).replace(/"/g, '\\"')}"` : String(reqId);
  const body = cached.bodyTemplate.replace('"__MCP_ID__"', idStr);

  Object.entries(cached.headers).forEach(([k, v]) => res.setHeader(k, v));
  res.setHeader('X-MCP-Challenge-Cache', 'HIT');
  res.status(402).send(body);
}

// ---------------------------------------------------------------------------
// Set standard x402 PAYMENT-REQUIRED header + auxiliary payment headers on
// MCP 402 responses so x402-aware clients can construct payment and retry
// automatically — identical header format to x402MicroserviceRoutesV2.
// Call this BEFORE res.status(402).json() — headers must precede the body.
// ---------------------------------------------------------------------------
function setMcp402Headers(
  res: Response,
  service: Pick<CanonicalService, 'priceUsd' | 'id'>,
  payload: ReturnType<typeof buildMcpX402Payload>,
): void {
  try {
    const headerPayload = { x402Version: payload.x402Version, accepts: payload.accepts };
    const headerValue = Buffer.from(JSON.stringify(headerPayload), 'utf8').toString('base64');
    res.setHeader('PAYMENT-REQUIRED',     headerValue);
    res.setHeader('X-Payment-Price',      `$${service.priceUsd.toFixed(2)} USDC`);
    res.setHeader('X-Payment-Network',    'eip155:8453 (Base mainnet)');
    res.setHeader('X-Payment-Recipe-URL', `${BASE_URL}/x402/recipes/${service.id}`);
    res.setHeader('X-Trial-Access',       `${BASE_URL}/api/m2m/credits/trial`);
  } catch (_) {
    // Non-fatal — headers are best-effort; JSON-RPC body still delivered
  }
}

// ---------------------------------------------------------------------------
// Helper: build machine-readable x402 payment payload for a service price.
// ---------------------------------------------------------------------------
function buildMcpX402Payload(
  service: Pick<CanonicalService, 'id' | 'name' | 'priceUsd'>,
  reqId: unknown,
  mcpResourceUrl: string,
) {
  const priceUsd    = service.priceUsd;
  const microAmount = Math.round(priceUsd * 1_000_000).toString();
  const facilitator = getFacilitatorUrl();
  const description = `${service.name} — $${priceUsd.toFixed(2)} USDC per call`;

  const accepts = [
    {
      scheme:               'exact',
      network:              'eip155:8453',
      maxAmountRequired:    microAmount,
      amount:               microAmount,
      maxAmountRequiredUSD: priceUsd,
      payTo:                PLATFORM_WALLET_EVM,
      asset:                USDC_BASE_ADDRESS,
      facilitator,
      resource:             mcpResourceUrl,
      description,
      mimeType:             'application/json',
      maxTimeoutSeconds:    60,
      extra: { name: 'USD Coin', version: '2', decimals: 6, chainId: 8453, chainName: 'Base' },
    },
  ];

  return {
    x402Version: 2,
    error:       'PAYMENT-SIGNATURE (x402 v2) or X-PAYMENT (x402 v1) header is required',
    accepts,
    jsonrpc:     '2.0',
    id:          reqId ?? null,
    details: {
      priceUsd,
      tool:        `coinrailz_${service.id.replace(/-/g, '_')}`,
      service:     service.id,
      trialKey:    `${BASE_URL}/api/m2m/credits/trial`,
      purchaseKey: `${BASE_URL}/api/m2m/credits/checkout/session`,
      x402:        `${BASE_URL}/.well-known/x402.json`,
      recipeUrl:   `${BASE_URL}/x402/recipes/${service.id}`,
      paymentHeaders: {
        v2: 'PAYMENT-SIGNATURE',
        v1: 'X-PAYMENT',
        note: 'Both headers carry an identical base64-encoded x402 payment envelope. Retry the identical tools/call with the signed header — no changes to arguments required.',
      },
      note: 'Sign an EIP-3009 USDC authorization off-chain (no gas) and add PAYMENT-SIGNATURE (x402 v2) or X-PAYMENT (x402 v1) header, or use X-API-KEY for prepaid credits. GET /api/m2m/credits/trial for a free $5 trial key. Full recipe with code examples: ' + `${BASE_URL}/x402/recipes/${service.id}`,
    },
  };
}

// ---------------------------------------------------------------------------
// Common parameter descriptions for auto-enriching inputSchema properties
// ---------------------------------------------------------------------------
const PARAM_DESCRIPTIONS: Record<string, string> = {
  message:        'Optional message or query string to include in the request',
  chain:          'Blockchain network identifier (e.g. "ethereum", "base", "polygon", "arbitrum", "solana")',
  chains:         'Comma-separated list of blockchain networks to query',
  tokenAddress:   'ERC-20 token contract address (0x...)',
  walletAddress:  'Wallet address to query (0x... for EVM, base58 for Solana)',
  address:        'Blockchain address to look up',
  symbol:         'Token ticker symbol (e.g. "ETH", "BTC", "USDC")',
  from:           'Source token or asset identifier',
  to:             'Destination token or asset identifier',
  amount:         'Amount in token units (as a string to avoid floating-point issues)',
  limit:          'Maximum number of results to return',
  offset:         'Pagination offset — number of records to skip',
  network:        'Blockchain network name (e.g. "mainnet", "base", "solana")',
  deviceId:       'Unique IoT device identifier registered on the platform',
  agentId:        'AI agent identifier for billing and tracking purposes',
  lat:            'Latitude coordinate in decimal degrees (e.g. 37.7749)',
  lon:            'Longitude coordinate in decimal degrees (e.g. -122.4194)',
  latitude:       'Latitude coordinate in decimal degrees',
  longitude:      'Longitude coordinate in decimal degrees',
  bbox:           'Bounding box as "minLon,minLat,maxLon,maxLat"',
  startDate:      'Start date in ISO 8601 format (YYYY-MM-DD)',
  endDate:        'End date in ISO 8601 format (YYYY-MM-DD)',
  date:           'Date in ISO 8601 format (YYYY-MM-DD)',
  model:          'LLM model identifier (e.g. "gpt-4o", "gpt-4o-mini")',
  prompt:         'Text prompt to send to the AI model',
  contractAddress:'Smart contract address (0x...)',
  txHash:         'Transaction hash to look up',
  market:         'Prediction market identifier or slug',
  ticker:         'Asset or market ticker symbol',
  interval:       'Time interval for data aggregation (e.g. "1h", "1d")',
  city:           'City name for location-based queries',
  country:        'ISO 3166-1 alpha-2 country code (e.g. "US", "GB")',
  query:          'Search query string',
  type:           'Resource or data type filter',
  format:         'Output format (e.g. "json", "csv")',
  resolution:     'Spatial or temporal resolution of the dataset',
  collection:     'Satellite or data collection identifier',
  productId:      'Data product identifier for satellite or sensor data',
};

// ---------------------------------------------------------------------------
// Quickstart tool IDs — appear in coinrailz://starter-pack and get
// quickstart:true in _meta. Chosen to be cheap, zero-setup, and broadly useful.
// ---------------------------------------------------------------------------
const QUICKSTART_TOOL_IDS = new Set([
  'ping',             // free connectivity / latency check — no payment needed
  'first-call',       // $0.05 — lowest-cost intro to x402 payment flow
  'ai-inference',     // $0.05 — general-purpose LLM inference
  'iot-sensor-reading', // $0.025 — cheapest live-data service
  'gas-price-oracle', // $0.10 — essential on-chain utility for any tx workflow
]);

// ---------------------------------------------------------------------------
// Category display-order — controls the ordering bucket for tools/list.
// Categories not in this list are placed at the end in alphabetical order.
// ---------------------------------------------------------------------------
const CATEGORY_ORDER: Record<string, number> = {
  'discovery':              0,
  'iot-&-depin':            1,
  'ai-services':            2,
  'trading-intelligence':   3,
  'satellite-intelligence': 4,
  'base-native':            5,
  'defi-&-yield':           6,
  'prediction-markets':     7,
  'execution':              8,
  'investment':             9,
  'market-intelligence':    10,
  'robinhood-chain':        11,
  'rwa-&-tokenization':     12,
  'real-estate':            13,
  'banking':                14,
  'developer-tools':        15,
  'premium':                16,
};

/**
 * Sort services for MCP tools/list:
 *  1. ping + first-call always lead (by explicit position)
 *  2. Remaining quickstart tools next
 *  3. Then all others, grouped by CATEGORY_ORDER, price ascending within category
 */
function orderServicesForMcp(services: CanonicalService[]): CanonicalService[] {
  const LEAD = ['ping', 'first-call'];

  const lead      = LEAD.map(id => services.find(s => s.id === id)).filter(Boolean) as CanonicalService[];
  const quickRest = services.filter(s => QUICKSTART_TOOL_IDS.has(s.id) && !LEAD.includes(s.id));
  const rest      = services.filter(s => !QUICKSTART_TOOL_IDS.has(s.id));

  quickRest.sort((a, b) => a.priceUsd - b.priceUsd);
  rest.sort((a, b) => {
    const catA = CATEGORY_ORDER[a.category] ?? 99;
    const catB = CATEGORY_ORDER[b.category] ?? 99;
    if (catA !== catB) return catA - catB;
    return a.priceUsd - b.priceUsd;
  });

  return [...lead, ...quickRest, ...rest];
}

// Standard MCP output schema (content array format)
const MCP_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    content: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', description: 'Content type ("text" or "json")' },
          text: { type: 'string', description: 'Response data as a JSON string' },
        },
        required: ['type', 'text'],
      },
      description: 'Array of content blocks returned by the service',
    },
  },
  required: ['content'],
} as const;

// ---------------------------------------------------------------------------
// Helper: enrich inputSchema properties with descriptions where missing
// ---------------------------------------------------------------------------
function enrichInputSchema(raw: unknown): Record<string, unknown> {
  const schema = (raw ?? { type: 'object', properties: {}, required: [] }) as Record<string, unknown>;
  const props = (schema.properties ?? {}) as Record<string, Record<string, unknown>>;

  const enriched: Record<string, Record<string, unknown>> = {};
  for (const [key, def] of Object.entries(props)) {
    enriched[key] = def.description
      ? def
      : { ...def, description: PARAM_DESCRIPTIONS[key] ?? `Value for the "${key}" parameter` };
  }

  return { ...schema, properties: enriched };
}

// ---------------------------------------------------------------------------
// Helper: convert a CanonicalService into an MCP tool definition
// ---------------------------------------------------------------------------
function serviceToMcpTool(s: CanonicalService) {
  const price = s.priceUsd > 0 ? `$${s.priceUsd.toFixed(2)} USDC` : 'free';

  return {
    name:         `coinrailz_${s.id.replace(/-/g, '_')}`,
    description:  `[${price}] ${s.name} — ${s.description}`,
    inputSchema:  enrichInputSchema(s.inputSchema),
    outputSchema: MCP_OUTPUT_SCHEMA,
    annotations: {
      audience:        ['assistant'] as string[],
      priority:        s.priceUsd === 0 ? 0.3 : s.priceUsd <= 0.10 ? 0.6 : 0.8,
      title:           s.name,
      readOnlyHint:    true,
      destructiveHint: false,
      idempotentHint:  true,
    },
    _meta: {
      category:  s.category,
      featured:  s.featured,
      quickstart: QUICKSTART_TOOL_IDS.has(s.id),
      priceUsd:  s.priceUsd,
      payment: s.priceUsd > 0
        ? {
            protocol:        'x402',
            versions:        ['1', '2'],
            headers:         { v2: 'PAYMENT-SIGNATURE', v1: 'X-PAYMENT' },
            network:         'eip155:8453',
            networkName:     'Base mainnet',
            asset:           'USDC',
            assetAddress:    '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
            amountMicroUSDC: Math.round(s.priceUsd * 1_000_000),
            retrySemantics:  'Retry the identical tools/call request with the signed payment header — arguments unchanged',
            recipeUrl:       `${BASE_URL}/x402/recipes/${s.id}`,
            trialUrl:        `${BASE_URL}/api/m2m/credits/trial`,
            apiKeyAlt:       'X-API-KEY header with prepaid credits — GET trialUrl for a free $5 key',
          }
        : { note: 'No payment required for this tool' },
    },
  };
}

// ---------------------------------------------------------------------------
// POST /mcp  — Streamable HTTP MCP transport (JSON-RPC 2.0)
// Smithery and other MCP gateways probe this endpoint for tool discovery.
// Handles: initialize, tools/list, tools/call, resources/list, prompts/list
// ---------------------------------------------------------------------------
router.post('/', async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');

  const startTime  = Date.now();
  const requestId  = nanoid(12);
  const authMode   = detectAuthMode(req);
  const mcpIp      = getClientIp(req);

  const { jsonrpc, id, method, params } = req.body ?? {};

  const mcpToolName = method === 'tools/call' ? ((params as any)?.name ?? 'unknown') : undefined;
  console.log(
    `[MCP] POST /mcp | method=${method ?? 'none'} | ip=${mcpIp}` +
    ` | ua=${(req.get('user-agent') ?? 'none').slice(0, 60)}` +
    ` | auth=${authMode}${mcpToolName ? ` | tool=${mcpToolName}` : ''}`,
  );

  // --- Validate JSON-RPC envelope ---
  if (jsonrpc !== '2.0' || !method) {
    const latencyMs = Date.now() - startTime;
    trackMcpEvent({
      req, requestId, authMode, latencyMs,
      serviceId:      'mcp-server',
      mcpMethod:      method ?? 'none',
      responseStatus: 400,
      eventType:      'mcp-invalid-request',
      errorMessage:   'Missing jsonrpc or method field',
    });
    return res.status(400).json({
      jsonrpc: '2.0',
      id: id ?? null,
      error: { code: -32600, message: 'Invalid Request' },
    });
  }

  // --- initialize ---
  if (method === 'initialize') {
    const result = {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: MCP_VERSION,
        capabilities: { tools: {}, resources: {}, prompts: {} },
        serverInfo: {
          name:        'coinrailz-mcp',
          version:     '1.1.0',
          description: `${getCanonicalServiceCount()} x402 micropayment services via USDC — crypto analytics, NASA/ESA satellite data, IoT sensors, AI inference, and prediction markets.`,
        },
      },
    };
    const latencyMs = Date.now() - startTime;
    trackMcpEvent({
      req, requestId, authMode, latencyMs,
      serviceId:      'mcp-server',
      mcpMethod:      'initialize',
      responseStatus: 200,
      eventType:      'mcp-initialize',
    });
    return res.json(result);
  }

  // --- tools/list ---
  if (method === 'tools/list') {
    const services = orderServicesForMcp(getCanonicalServices());
    const tools    = services.map(serviceToMcpTool);
    const latencyMs = Date.now() - startTime;
    trackMcpEvent({
      req, requestId, authMode, latencyMs,
      serviceId:      'mcp-server',
      mcpMethod:      'tools/list',
      responseStatus: 200,
      eventType:      'mcp-tools-list',
    });
    return res.json({ jsonrpc: '2.0', id, result: { tools } });
  }

  // --- tools/call ---
  if (method === 'tools/call') {
    const { name, arguments: args = {} } = params ?? {};

    if (!name) {
      const latencyMs = Date.now() - startTime;
      trackMcpEvent({
        req, requestId, authMode, latencyMs,
        serviceId:      'mcp-server',
        mcpMethod:      'tools/call',
        responseStatus: 400,
        eventType:      'mcp-invalid-request',
        errorMessage:   'Missing tool name in params',
      });
      return res.status(400).json({
        jsonrpc: '2.0', id,
        error: { code: -32602, message: 'Missing tool name' },
      });
    }

    const serviceId = name.replace(/^coinrailz_/, '').replace(/_/g, '-');
    const service   = getCanonicalServices().find(s => s.id === serviceId);

    if (!service) {
      const latencyMs = Date.now() - startTime;
      trackMcpEvent({
        req, requestId, authMode, latencyMs,
        serviceId:      'mcp-server',
        mcpMethod:      'tools/call',
        responseStatus: 404,
        eventType:      'mcp-unknown-tool',
        toolName:       name,
        errorMessage:   `Unknown tool: ${name}`,
      });
      return res.status(404).json({
        jsonrpc: '2.0', id,
        error: { code: -32601, message: `Unknown tool: ${name}` },
      });
    }

    const apiKey = extractApiKey(req);
    // @x402/fetch 2.x sends PAYMENT-SIGNATURE for x402Version 2; older clients send X-PAYMENT.
    // Both carry an identical encoded payment proof — accept either so v2 clients aren't gate-looped.
    const x402Header = (req.headers['x-payment'] || req.headers['payment-signature']) as string | undefined;
    const presentedPayer = (!apiKey && x402Header) ? extractPayerFromXPayment(x402Header) : null;

    if (x402Header && !apiKey) {
      trackMcpEvent({
        req, requestId, authMode, latencyMs: Date.now() - startTime,
        serviceId, toolName: name,
        mcpMethod: 'tools/call',
        responseStatus: 202,
        eventType: 'mcp-payment-presented',
        walletAddress: presentedPayer?.walletAddress,
        paymentAmount: presentedPayer?.paymentAmountUsd,
        paymentStage: 'presented',
      });
    }

    // --- 402 Challenge (no auth) ---
    if (!apiKey && !x402Header) {
      // Check cache first — avoid rebuilding identical payloads for burst actors
      const cached    = getCachedChallenge(serviceId);
      const latencyMs = Date.now() - startTime;

      if (cached) {
        const cacheAgeMs = Date.now() - cached.cachedAt;
        trackMcpEvent({
          req, requestId, authMode, latencyMs,
          serviceId, toolName: name,
          mcpMethod:      'tools/call',
          responseStatus: 402,
          eventType:      'mcp-challenge-cache-hit',
          cacheAgeMs,
        });
        // serveCachedChallenge() commits the body, so headers must be set first.
        res.setHeader('X-402-Version', '2');
        res.setHeader('X-Payment-Required', 'true');
        serveCachedChallenge(res, cached, id);
        return;
      }

      // Build fresh payload, cache it, track miss
      const mcpPayload = buildMcpX402Payload(service, id, `${BASE_URL}/mcp`);
      const headers: Record<string, string> = {};
      setMcp402Headers(res, service, mcpPayload);
      res.setHeader('X-402-Version', '2');
      res.setHeader('X-Payment-Required', 'true');

      // Capture headers for cache after setMcp402Headers has set them
      for (const h of ['PAYMENT-REQUIRED', 'X-Payment-Price', 'X-Payment-Network', 'X-Payment-Recipe-URL', 'X-Trial-Access', 'X-402-Version', 'X-Payment-Required']) {
        const v = res.getHeader(h);
        if (v) headers[h] = String(v);
      }
      headers['Content-Type'] = 'application/json';
      setCachedChallenge(serviceId, mcpPayload, headers);

      trackMcpEvent({
        req, requestId, authMode, latencyMs,
        serviceId, toolName: name,
        mcpMethod:      'tools/call',
        responseStatus: 402,
        eventType:      'mcp-challenge-issued',
      });
      return res.status(402).json(mcpPayload);
    }

    // --- Authenticated: proxy to upstream service ---
    try {
      const forwardHeaders: Record<string, string> = { 'content-type': 'application/json' };
      if (apiKey)     forwardHeaders['x-api-key'] = apiKey;
      if (x402Header) forwardHeaders['x-payment']  = x402Header;
      forwardHeaders['x-forwarded-resource'] = `${BASE_URL}/mcp`;

      const baseUrl  = `http://localhost:${process.env.PORT || 5000}`;
      const upstream = await fetch(`${baseUrl}${service.endpoint}`, {
        method:  service.method,
        headers: forwardHeaders,
        body:    service.method !== 'GET' ? JSON.stringify(args) : undefined,
      });

      const ct     = upstream.headers.get('content-type') ?? '';
      const result = ct.includes('application/json') ? await upstream.json() : { text: await upstream.text() };

      // Upstream returned 402 — hoist and rewrite resource URL
      if (upstream.status === 402) {
        const upstreamBody = result as any;
        if (upstreamBody?.x402Version === 2 && Array.isArray(upstreamBody?.accepts)) {
          const mcpUrl          = `${BASE_URL}/mcp`;
          const rewrittenAccepts = upstreamBody.accepts.map((a: any) => ({ ...a, resource: mcpUrl }));
          res.setHeader('X-402-Version', '2');
          res.setHeader('X-Payment-Required', 'true');
          try {
            const headerValue = Buffer.from(
              JSON.stringify({ x402Version: 2, accepts: rewrittenAccepts }), 'utf8',
            ).toString('base64');
            res.setHeader('PAYMENT-REQUIRED',  headerValue);
            res.setHeader('X-Payment-Price',   `$${upstreamBody.accepts[0]?.maxAmountRequired ? (parseInt(upstreamBody.accepts[0].maxAmountRequired, 10) / 1_000_000).toFixed(2) : '?'} USDC`);
            res.setHeader('X-Payment-Network', 'eip155:8453 (Base mainnet)');
          } catch (_) { /* non-fatal */ }

          const latencyMs = Date.now() - startTime;
          trackMcpEvent({
            req, requestId, authMode, latencyMs,
            serviceId, toolName: name,
            mcpMethod:      'tools/call',
            responseStatus: 402,
            eventType:      x402Header && !apiKey ? 'mcp-payment-rejected' : 'mcp-upstream-hoisted',
            upstreamStatus: 402,
            walletAddress:  presentedPayer?.walletAddress,
            paymentAmount:  presentedPayer?.paymentAmountUsd,
            paymentStage:   x402Header && !apiKey ? 'rejected' : undefined,
          });
          return res.status(402).json({
            x402Version: 2,
            accepts:     rewrittenAccepts,
            error:       upstreamBody.error ?? 'Payment required',
            jsonrpc:     '2.0',
            id:          id ?? null,
            details:     upstreamBody,
          });
        }

        // Fallback: upstream 402 without valid x402 v2 body — use canonical service price
        const fallbackPayload = buildMcpX402Payload(service, id, `${BASE_URL}/mcp`);
        setMcp402Headers(res, service, fallbackPayload);
        const latencyMs = Date.now() - startTime;
        trackMcpEvent({
          req, requestId, authMode, latencyMs,
          serviceId, toolName: name,
          mcpMethod:      'tools/call',
          responseStatus: 402,
          eventType:      x402Header && !apiKey ? 'mcp-payment-rejected' : 'mcp-upstream-error',
          upstreamStatus: 402,
          errorMessage:   'Upstream 402 without x402 v2 body',
          walletAddress:  presentedPayer?.walletAddress,
          paymentAmount:  presentedPayer?.paymentAmountUsd,
          paymentStage:   x402Header && !apiKey ? 'rejected' : undefined,
        });
        return res.status(402).json({
          jsonrpc: '2.0', id,
          error: { code: 402, message: 'x402 payment required', details: result },
        });
      }

      // Upstream returned non-200 (other than 402)
      if (!upstream.ok) {
        const latencyMs = Date.now() - startTime;
        trackMcpEvent({
          req, requestId, authMode, latencyMs,
          serviceId, toolName: name,
          mcpMethod:      'tools/call',
          responseStatus: upstream.status,
          eventType:      'mcp-upstream-error',
          upstreamStatus: upstream.status,
          errorMessage:   `Upstream ${upstream.status}`,
        });
        return res.status(upstream.status).json({
          jsonrpc: '2.0', id,
          error: { code: -32603, message: 'Upstream error', details: result },
        });
      }

      // Success — determine which credential was honored
      // API key takes precedence in the payment orchestrator when both are present
      const paymentMethod = apiKey ? 'api-key' : 'x402';
      const eventType     = apiKey ? 'mcp-api-key-authorized' : 'mcp-x402-authorized';
      const latencyMs     = Date.now() - startTime;

      // Extract payer attribution for x402 payments — analytics attribution only, non-fatal.
      // The upstream /x402/ service is the authoritative verifier; we only read the header here.
      const payer = (!apiKey && x402Header) ? extractPayerFromXPayment(x402Header) : null;

      trackMcpEvent({
        req, requestId, authMode, latencyMs,
        serviceId, toolName: name,
        mcpMethod:      'tools/call',
        responseStatus: 200,
        paid:           true,
        eventType,
        walletAddress:  payer?.walletAddress,
        paymentAmount:  payer?.paymentAmountUsd,
        paymentStage:   !apiKey ? 'verified-and-delivered' : undefined,
      });

      return res.json({
        jsonrpc: '2.0', id,
        result: { content: [{ type: 'text', text: JSON.stringify(result) }] },
      });

    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      trackMcpEvent({
        req, requestId, authMode, latencyMs,
        serviceId, toolName: name,
        mcpMethod:      'tools/call',
        responseStatus: 500,
        eventType:      'mcp-transport-error',
        errorMessage:   err?.message ?? 'fetch failed',
      });
      return res.status(500).json({
        jsonrpc: '2.0', id,
        error: { code: -32603, message: 'Internal error' },
      });
    }
  }

  // --- resources/list ---
  if (method === 'resources/list') {
    return res.json({
      jsonrpc: '2.0', id,
      result: {
        resources: [
          {
            uri:         'coinrailz://catalog',
            name:        'Coin Railz Tool Catalog',
            description: 'All available tools grouped by category with names, prices, and brief descriptions. Read this first to understand what is available before calling tools/list.',
            mimeType:    'application/json',
          },
          {
            uri:         'coinrailz://starter-pack',
            name:        'Starter Pack — Curated First Tools',
            description: `5 hand-picked tools that are cheap, zero-setup, and broadly useful for new callers. Each includes a ready-to-use tools/call example. Tools: ${[...QUICKSTART_TOOL_IDS].join(', ')}.`,
            mimeType:    'application/json',
          },
        ],
      },
    });
  }

  // --- resources/read ---
  if (method === 'resources/read') {
    const uri = (params as any)?.uri as string | undefined;

    if (uri === 'coinrailz://catalog') {
      const allServices = getCanonicalServices();
      // Build category-grouped index
      const byCategory: Record<string, Array<{ id: string; name: string; priceUsd: number; description: string; quickstart: boolean }>> = {};
      for (const s of allServices) {
        const cat = s.category;
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push({
          id:          s.id,
          name:        s.name,
          priceUsd:    s.priceUsd,
          description: s.description,
          quickstart:  QUICKSTART_TOOL_IDS.has(s.id),
        });
      }
      // Sort within each category by price
      for (const items of Object.values(byCategory)) {
        items.sort((a, b) => a.priceUsd - b.priceUsd);
      }
      const catalog = {
        provider:    'Coin Railz',
        totalTools:  allServices.length,
        note:        'Use coinrailz://starter-pack to see the 5 recommended first tools. Call tools/list for full MCP-formatted tool definitions.',
        categories:  byCategory,
      };
      return res.json({
        jsonrpc: '2.0', id,
        result: {
          contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(catalog, null, 2) }],
        },
      });
    }

    if (uri === 'coinrailz://starter-pack') {
      const allServices = getCanonicalServices();
      const starterTools = [...QUICKSTART_TOOL_IDS]
        .map(toolId => allServices.find(s => s.id === toolId))
        .filter(Boolean) as CanonicalService[];

      const pack = {
        title:       'Coin Railz Starter Pack',
        description: 'These 5 tools are the recommended starting point. Each costs $0.025–$0.10 USDC per call and covers a distinct domain. Call any of them via tools/call with the coinrailz_ prefix.',
        paymentQuickstart: {
          option1: 'GET /api/m2m/credits/trial for a free $5 API key, then add X-API-KEY header.',
          option2: 'Use x402: on tools/call 402 response, sign the EIP-3009 USDC authorization and retry with PAYMENT-SIGNATURE header.',
        },
        tools: starterTools.map(s => ({
          toolName:    `coinrailz_${s.id.replace(/-/g, '_')}`,
          serviceId:   s.id,
          priceUsd:    s.priceUsd,
          category:    s.category,
          description: s.description,
          exampleCall: {
            method:  'tools/call',
            params:  { name: `coinrailz_${s.id.replace(/-/g, '_')}`, arguments: {} },
          },
          recipeUrl: `${BASE_URL}/x402/recipes/${s.id}`,
        })),
      };
      return res.json({
        jsonrpc: '2.0', id,
        result: {
          contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(pack, null, 2) }],
        },
      });
    }

    // Unknown resource URI
    return res.status(404).json({
      jsonrpc: '2.0', id,
      error: { code: -32002, message: `Unknown resource URI: ${uri ?? '(none)'}` },
    });
  }

  // --- prompts/list ---
  if (method === 'prompts/list') {
    return res.json({
      jsonrpc: '2.0', id,
      result: {
        prompts: [
          {
            name:        'find-the-right-tool',
            description: 'Given a task description, identifies the best Coin Railz tool(s) to call and explains how to pay.',
            arguments: [
              {
                name:        'task',
                description: 'Describe what you are trying to accomplish (e.g. "get the current ETH gas price", "check if a wallet has been flagged", "query a weather station").',
                required:    true,
              },
            ],
          },
        ],
      },
    });
  }

  // --- prompts/get ---
  if (method === 'prompts/get') {
    const promptName = (params as any)?.name as string | undefined;
    const taskArg    = (params as any)?.arguments?.task as string | undefined;

    if (promptName === 'find-the-right-tool') {
      const allServices = getCanonicalServices();
      const catalogSummary = allServices
        .map(s => `- coinrailz_${s.id.replace(/-/g, '_')} [${s.category}, $${s.priceUsd.toFixed(3)}]: ${s.description}`)
        .join('\n');

      const systemText =
        `You are a routing assistant for the Coin Railz MCP server. The server exposes ${allServices.length} paid tools via x402 micropayments (USDC on Base).\n\n` +
        `PAYMENT: Every tool call requires either X-API-KEY (prepaid credits) or PAYMENT-SIGNATURE (x402 v2). ` +
        `A free $5 trial key is available at GET /api/m2m/credits/trial.\n\n` +
        `TOOL CATALOG:\n${catalogSummary}\n\n` +
        `STARTER PACK (cheapest + most useful for new callers):\n` +
        [...QUICKSTART_TOOL_IDS].map(id => {
          const s = allServices.find(x => x.id === id);
          return s ? `- coinrailz_${s.id.replace(/-/g, '_')} [$${s.priceUsd.toFixed(3)}]: ${s.description}` : '';
        }).filter(Boolean).join('\n') +
        `\n\nFor detailed payment recipes: ${BASE_URL}/x402/recipes/{serviceId}`;

      const userText = taskArg
        ? `My task: ${taskArg}\n\nWhich Coin Railz tool(s) should I call? Provide the exact tool name, a brief rationale, and the tools/call JSON-RPC payload.`
        : 'List the top 5 most relevant Coin Railz tools for my use case and show me how to call each one.';

      return res.json({
        jsonrpc: '2.0', id,
        result: {
          description: 'Find the right Coin Railz tool for a task',
          messages: [
            { role: 'user', content: { type: 'text', text: systemText + '\n\n' + userText } },
          ],
        },
      });
    }

    return res.status(404).json({
      jsonrpc: '2.0', id,
      error: { code: -32002, message: `Unknown prompt: ${promptName ?? '(none)'}` },
    });
  }

  // --- MCP notifications (one-way, no response body per spec) ---
  // Clients send these after initialize succeeds; returning 404 causes strict
  // clients to abort the session before any tool calls are attempted.
  // notifications/initialized is by far the most common; handle all notifications/*.
  //
  // Per JSON-RPC 2.0 §4: notifications MUST NOT receive a response envelope.
  // Per MCP Streamable HTTP transport: return HTTP 202 Accepted with no body.
  if (method?.startsWith('notifications/')) {
    return res.sendStatus(202);
  }

  // --- Unknown method ---
  const latencyMs = Date.now() - startTime;
  trackMcpEvent({
    req, requestId, authMode, latencyMs,
    serviceId:      'mcp-server',
    mcpMethod:      method,
    responseStatus: 404,
    eventType:      'mcp-unknown-method',
    errorMessage:   `Method not found: ${method}`,
  });
  return res.status(404).json({
    jsonrpc: '2.0', id,
    error: {
      code: -32601,
      message: `Method not found: ${method}`,
      data: {
        supportedMethods: SUPPORTED_MCP_METHODS,
        discovery: {
          transport: 'POST /mcp',
          catalog: `${BASE_URL}/mcp/services`,
          note: 'server/discover is not an MCP method. Start with initialize, then tools/list.',
        },
      },
    },
  });
});

// ---------------------------------------------------------------------------
// GET /mcp/tools/list
// No auth required — tool discovery is public (price is in description)
// ---------------------------------------------------------------------------
router.get('/tools/list', (req: Request, res: Response) => {
  const startTime = Date.now();
  const requestId = nanoid(12);

  try {
    const services = orderServicesForMcp(getCanonicalServices());
    const tools    = services.map(serviceToMcpTool);
    const latencyMs = Date.now() - startTime;

    trackMcpEvent({
      req, requestId, authMode: detectAuthMode(req), latencyMs,
      serviceId:      'mcp-server',
      mcpMethod:      'GET /mcp/tools/list',
      responseStatus: 200,
      eventType:      'mcp-tools-list',
    });

    res.json({
      jsonrpc: '2.0',
      id:      1,
      result: {
        tools,
        _meta: {
          protocol:   'MCP',
          version:    MCP_VERSION,
          provider:   'Coin Railz',
          totalTools: tools.length,
          paymentInfo: {
            apiKey:             'Add X-API-KEY: cr_live_... header (prepaid credits)',
            trial:              'GET /api/m2m/credits/trial for free $5 trial key',
            x402_v2:            'Add PAYMENT-SIGNATURE header (x402 v2) — preferred for @x402/fetch 2.x clients',
            x402_v1:            'Add X-PAYMENT header (x402 v1) — supported for legacy clients',
            x402_note:          'Both headers carry a base64-encoded EIP-3009 USDC authorization signed off-chain (no gas). Retry the identical request with the header after receiving a 402.',
            recipeBaseUrl:      `${BASE_URL}/x402/recipes/{serviceId}`,
          },
        },
      },
    });
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    trackMcpEvent({
      req, requestId, authMode: detectAuthMode(req), latencyMs,
      serviceId:      'mcp-server',
      mcpMethod:      'GET /mcp/tools/list',
      responseStatus: 500,
      eventType:      'mcp-tools-list-error',
      errorMessage:   err?.message,
    });
    res.status(500).json({
      jsonrpc: '2.0',
      id:      1,
      error:   { code: -32603, message: 'Internal error loading tools' },
    });
  }
});

// ---------------------------------------------------------------------------
// POST /mcp/tools/call
// Requires X-API-KEY, Authorization: Bearer, or X-PAYMENT header.
// Dedicated endpoint for clients that prefer a flat REST-style call over
// the streamable JSON-RPC transport at POST /mcp.
// ---------------------------------------------------------------------------
router.post('/tools/call', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const requestId = nanoid(12);
  const authMode  = detectAuthMode(req);

  const { name, arguments: args = {} } = req.body ?? {};

  if (!name || typeof name !== 'string') {
    const latencyMs = Date.now() - startTime;
    trackMcpEvent({
      req, requestId, authMode, latencyMs,
      serviceId:      'mcp-server',
      mcpMethod:      'POST /mcp/tools/call',
      responseStatus: 400,
      eventType:      'mcp-invalid-request',
      errorMessage:   'Missing or invalid tool name',
    });
    return res.status(400).json({
      jsonrpc: '2.0',
      id:      req.body?.id ?? 1,
      error:   { code: -32602, message: 'Missing or invalid tool name' },
    });
  }

  const serviceId = name.replace(/^coinrailz_/, '').replace(/_/g, '-');
  const services  = getCanonicalServices();
  const service   = services.find(s => s.id === serviceId);

  if (!service) {
    const latencyMs = Date.now() - startTime;
    trackMcpEvent({
      req, requestId, authMode, latencyMs,
      serviceId:      'mcp-server',
      mcpMethod:      'POST /mcp/tools/call',
      responseStatus: 404,
      eventType:      'mcp-unknown-tool',
      toolName:       name,
      errorMessage:   `Unknown tool: ${name}`,
    });
    return res.status(404).json({
      jsonrpc: '2.0',
      id:      req.body?.id ?? 1,
      error:   { code: -32601, message: `Unknown tool: ${name}` },
    });
  }

  const apiKey = extractApiKey(req);
  // @x402/fetch 2.x sends PAYMENT-SIGNATURE for x402Version 2; older clients send X-PAYMENT.
  // Both carry an identical encoded payment proof — accept either so v2 clients aren't gate-looped.
  const x402Header = (req.headers['x-payment'] || req.headers['payment-signature']) as string | undefined;
  const presentedPayer = (!apiKey && x402Header) ? extractPayerFromXPayment(x402Header) : null;

  if (x402Header && !apiKey) {
    trackMcpEvent({
      req, requestId, authMode, latencyMs: Date.now() - startTime,
      serviceId, toolName: name,
      mcpMethod: 'POST /mcp/tools/call',
      responseStatus: 202,
      eventType: 'mcp-payment-presented',
      walletAddress: presentedPayer?.walletAddress,
      paymentAmount: presentedPayer?.paymentAmountUsd,
      paymentStage: 'presented',
    });
  }

  // --- 402 Challenge (no auth) ---
  if (!apiKey && !x402Header) {
    const cached    = getCachedChallenge(`${serviceId}:tools-call`);
    const latencyMs = Date.now() - startTime;

    if (cached) {
      const cacheAgeMs = Date.now() - cached.cachedAt;
      trackMcpEvent({
        req, requestId, authMode, latencyMs,
        serviceId, toolName: name,
        mcpMethod:      'POST /mcp/tools/call',
        responseStatus: 402,
        eventType:      'mcp-challenge-cache-hit',
        cacheAgeMs,
      });
      // serveCachedChallenge() commits the body, so headers must be set first.
      res.setHeader('X-402-Version', '2');
      res.setHeader('X-Payment-Required', 'true');
      serveCachedChallenge(res, cached, req.body?.id ?? 1);
      return;
    }

    const mcpPayload = buildMcpX402Payload(service, req.body?.id ?? 1, `${BASE_URL}/mcp/tools/call`);
    const headers: Record<string, string> = {};
    setMcp402Headers(res, service, mcpPayload);
    res.setHeader('X-402-Version', '2');
    res.setHeader('X-Payment-Required', 'true');
    for (const h of ['PAYMENT-REQUIRED', 'X-Payment-Price', 'X-Payment-Network', 'X-Payment-Recipe-URL', 'X-Trial-Access', 'X-402-Version', 'X-Payment-Required']) {
      const v = res.getHeader(h);
      if (v) headers[h] = String(v);
    }
    headers['Content-Type'] = 'application/json';
    setCachedChallenge(`${serviceId}:tools-call`, mcpPayload, headers);

    trackMcpEvent({
      req, requestId, authMode, latencyMs,
      serviceId, toolName: name,
      mcpMethod:      'POST /mcp/tools/call',
      responseStatus: 402,
      eventType:      'mcp-challenge-issued',
    });
    return res.status(402).json(mcpPayload);
  }

  // --- Authenticated: proxy to upstream service ---
  try {
    const forwardHeaders: Record<string, string> = {
      'content-type': 'application/json',
      'accept':       'application/json',
    };
    if (apiKey)     forwardHeaders['x-api-key'] = apiKey;
    if (x402Header) forwardHeaders['x-payment']  = x402Header;
    forwardHeaders['x-forwarded-resource'] = `${BASE_URL}/mcp/tools/call`;

    const baseUrl    = `http://localhost:${process.env.PORT || 5000}`;
    const serviceUrl = `${baseUrl}${service.endpoint}`;

    const upstream = await fetch(serviceUrl, {
      method:  service.method,
      headers: forwardHeaders,
      body:    service.method !== 'GET' ? JSON.stringify(args) : undefined,
    });

    const contentType = upstream.headers.get('content-type') ?? '';
    const result: unknown = contentType.includes('application/json')
      ? await upstream.json()
      : { text: await upstream.text() };

    // Upstream 402 — hoist and rewrite resource to /mcp/tools/call
    if (upstream.status === 402) {
      const upstreamBody = result as any;
      if (upstreamBody?.x402Version === 2 && Array.isArray(upstreamBody?.accepts)) {
        const mcpUrl          = `${BASE_URL}/mcp/tools/call`;
        const rewrittenAccepts = upstreamBody.accepts.map((a: any) => ({ ...a, resource: mcpUrl }));
        res.setHeader('X-402-Version', '2');
        res.setHeader('X-Payment-Required', 'true');
        try {
          const headerValue = Buffer.from(
            JSON.stringify({ x402Version: 2, accepts: rewrittenAccepts }), 'utf8',
          ).toString('base64');
          res.setHeader('PAYMENT-REQUIRED',  headerValue);
          res.setHeader('X-Payment-Price',   `$${upstreamBody.accepts[0]?.maxAmountRequired ? (parseInt(upstreamBody.accepts[0].maxAmountRequired, 10) / 1_000_000).toFixed(2) : '?'} USDC`);
          res.setHeader('X-Payment-Network', 'eip155:8453 (Base mainnet)');
        } catch (_) { /* non-fatal */ }

        const latencyMs = Date.now() - startTime;
        trackMcpEvent({
          req, requestId, authMode, latencyMs,
          serviceId, toolName: name,
          mcpMethod:      'POST /mcp/tools/call',
          responseStatus: 402,
          eventType:      x402Header && !apiKey ? 'mcp-payment-rejected' : 'mcp-upstream-hoisted',
          upstreamStatus: 402,
          walletAddress:  presentedPayer?.walletAddress,
          paymentAmount:  presentedPayer?.paymentAmountUsd,
          paymentStage:   x402Header && !apiKey ? 'rejected' : undefined,
        });
        return res.status(402).json({
          x402Version: 2,
          accepts:     rewrittenAccepts,
          error:       upstreamBody.error ?? 'Payment required',
          jsonrpc:     '2.0',
          id:          req.body?.id ?? 1,
          details:     upstreamBody,
        });
      }

      // Fallback: upstream 402 without x402 v2 body
      const fallbackPayload = buildMcpX402Payload(service, req.body?.id ?? 1, `${BASE_URL}/mcp/tools/call`);
      setMcp402Headers(res, service, fallbackPayload);
      const latencyMs = Date.now() - startTime;
      trackMcpEvent({
        req, requestId, authMode, latencyMs,
        serviceId, toolName: name,
        mcpMethod:      'POST /mcp/tools/call',
        responseStatus: 402,
        eventType:      x402Header && !apiKey ? 'mcp-payment-rejected' : 'mcp-upstream-error',
        upstreamStatus: 402,
        errorMessage:   'Upstream 402 without x402 v2 body',
        walletAddress:  presentedPayer?.walletAddress,
        paymentAmount:  presentedPayer?.paymentAmountUsd,
        paymentStage:   x402Header && !apiKey ? 'rejected' : undefined,
      });
      return res.status(402).json({
        jsonrpc: '2.0', id: req.body?.id ?? 1,
        error: { code: 402, message: 'x402 payment required', details: result },
      });
    }

    // Upstream non-2xx (other than 402)
    if (!upstream.ok) {
      const latencyMs = Date.now() - startTime;
      trackMcpEvent({
        req, requestId, authMode, latencyMs,
        serviceId, toolName: name,
        mcpMethod:      'POST /mcp/tools/call',
        responseStatus: upstream.status,
        eventType:      'mcp-upstream-error',
        upstreamStatus: upstream.status,
        errorMessage:   `Upstream ${upstream.status}`,
      });
      return res.status(upstream.status).json({
        jsonrpc: '2.0',
        id:      req.body?.id ?? 1,
        error:   { code: -32603, message: 'Upstream service error', details: result },
      });
    }

    // Success
    const eventType = apiKey ? 'mcp-api-key-authorized' : 'mcp-x402-authorized';
    const latencyMs = Date.now() - startTime;

    // Extract payer attribution for x402 payments — analytics attribution only, non-fatal.
    const payer = (!apiKey && x402Header) ? extractPayerFromXPayment(x402Header) : null;

    trackMcpEvent({
      req, requestId, authMode, latencyMs,
      serviceId, toolName: name,
      mcpMethod:      'POST /mcp/tools/call',
      responseStatus: 200,
      paid:           true,
      eventType,
      walletAddress:  payer?.walletAddress,
      paymentAmount:  payer?.paymentAmountUsd,
      paymentStage:   !apiKey ? 'verified-and-delivered' : undefined,
    });

    // Forward billing headers so agent runtimes can track credit usage
    for (const h of ['x-credits-used', 'x-credits-remaining', 'x-recharge-url']) {
      const val = upstream.headers.get(h);
      if (val) res.setHeader(h, val);
    }

    return res.json({
      jsonrpc: '2.0',
      id:      req.body?.id ?? 1,
      result: {
        content: [{ type: 'text', text: JSON.stringify(result) }],
        _meta: { tool: name, service: service.id, priceUsd: service.priceUsd },
      },
    });

  } catch (err: any) {
    console.error('[mcp/tools/call] error:', err?.message);
    const latencyMs = Date.now() - startTime;
    trackMcpEvent({
      req, requestId, authMode, latencyMs,
      serviceId, toolName: name,
      mcpMethod:      'POST /mcp/tools/call',
      responseStatus: 500,
      eventType:      'mcp-transport-error',
      errorMessage:   err?.message ?? 'fetch failed',
    });
    return res.status(500).json({
      jsonrpc: '2.0',
      id:      req.body?.id ?? 1,
      error:   { code: -32603, message: 'Internal error calling service' },
    });
  }
});

// ---------------------------------------------------------------------------
// POST /mcp/sessions — advisory session creation (stateless)
// Returns a session token agents can include in X-MCP-Session-ID header
// for future correlation. No server-side state required.
// ---------------------------------------------------------------------------
router.post('/sessions', (req: Request, res: Response) => {
  const { agentId, budget_usd } = req.body ?? {};
  const sessionId = `mcp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  res.json({
    sessionId,
    agentId:    agentId ?? null,
    budget_usd: budget_usd ?? null,
    createdAt:  new Date().toISOString(),
    note: 'Include this sessionId as X-MCP-Session-ID on subsequent tool calls for tracing.',
    toolsUrl: '/mcp/tools/list',
    paymentInfo: {
      trialKey:    '/api/m2m/credits/trial',
      purchaseKey: '/api/m2m/credits/checkout/session',
      x402:        '/.well-known/x402.json',
    },
  });
});

export default router;
