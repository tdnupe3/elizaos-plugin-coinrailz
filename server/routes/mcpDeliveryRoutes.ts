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
  if (req.headers['x-payment']) return 'x402';
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
  walletAddress?: string;   // x402 payer — populated on mcp-x402-authorized events only
  paymentAmount?: number;   // USD amount — populated on mcp-x402-authorized events only
}

function trackMcpEvent(p: McpTrackParams): void {
  const interactionType =
    p.paid                    ? 'payment'
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
    // x402 payer attribution — only present on mcp-x402-authorized events
    walletAddress:   p.walletAddress,
    paymentAmount:   p.paymentAmount,
    metadata: {
      mcpMethod:     p.mcpMethod,
      toolName:      p.toolName,
      authMode:      p.authMode,
      // Never log credential values — only the mode
      hasPaymentHeader: !!(p.req.headers['x-payment']),
      mcpSessionId:  p.req.get('x-mcp-session-id') || undefined,
      transport:     'streamable-http',
      upstreamStatus: p.upstreamStatus,
      cacheAgeMs:    p.cacheAgeMs,
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
    error:       'X-PAYMENT header is required',
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
      note: 'Add X-PAYMENT header (x402 on-chain USDC) or X-API-KEY header (prepaid credits) and retry. GET /api/m2m/credits/trial for a free $5 trial key.',
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
    const services = getCanonicalServices();
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

    const apiKey     = extractApiKey(req);
    const x402Header = req.headers['x-payment'] as string | undefined;

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
        serveCachedChallenge(res, cached, id);
        res.setHeader('X-402-Version', '2');
        res.setHeader('X-Payment-Required', 'true');
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
            eventType:      'mcp-upstream-hoisted',
            upstreamStatus: 402,
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
          eventType:      'mcp-upstream-error',
          upstreamStatus: 402,
          errorMessage:   'Upstream 402 without x402 v2 body',
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

  // --- resources/list, prompts/list (capability stubs) ---
  if (method === 'resources/list' || method === 'prompts/list') {
    return res.json({
      jsonrpc: '2.0', id,
      result: { [method.split('/')[0]]: [] },
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
    error: { code: -32601, message: `Method not found: ${method}` },
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
    const services = getCanonicalServices();
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
            apiKey: 'Add X-API-KEY: cr_live_... header (prepaid credits)',
            trial:  'GET /api/m2m/credits/trial for free $5 trial key',
            x402:   'Add X-PAYMENT header for native on-chain USDC payments',
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

  const apiKey     = extractApiKey(req);
  const x402Header = req.headers['x-payment'] as string | undefined;

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
      serveCachedChallenge(res, cached, req.body?.id ?? 1);
      res.setHeader('X-402-Version', '2');
      res.setHeader('X-Payment-Required', 'true');
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
          eventType:      'mcp-upstream-hoisted',
          upstreamStatus: 402,
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
        eventType:      'mcp-upstream-error',
        upstreamStatus: 402,
        errorMessage:   'Upstream 402 without x402 v2 body',
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
