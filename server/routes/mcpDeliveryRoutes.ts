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
 */

import { Router, Request, Response } from 'express';
import { getCanonicalServices, getCanonicalServiceCount, CanonicalService } from '../utils/serviceCount';
import {
  getFacilitatorUrl,
  getDexterFacilitatorUrl,
  USDC_BASE_ADDRESS,
  USDT_BASE_ADDRESS,
  USDC_SOLANA_MINT,
} from '../utils/facilitatorHelper';

const router = Router();

// MCP protocol version we advertise
const MCP_VERSION = '2024-11-05';

// ---------------------------------------------------------------------------
// Platform wallet constants — must match paymentOrchestrator.ts exactly
// ---------------------------------------------------------------------------
const PLATFORM_WALLET_EVM    = process.env.PLATFORM_WALLET_ADDRESS || '0xa4bBE37f9A6Ae2dc36a607B91eB148C0ae163C91';
// IMPORTANT: BmUP… is the active Solana wallet; Hgby… (PLATFORM_WALLETS.solana) is legacy.
// Uses DEXTER_SOLANA_WALLET env var as source of truth, same as paymentOrchestrator.ts.
const PLATFORM_WALLET_SOLANA = process.env.DEXTER_SOLANA_WALLET || 'BmUPzSupHJu2kW4cL27dF7Vc2JaZTwXKzFsRuagPDtL8';
const BASE_URL               = process.env.PUBLIC_URL ||
  (process.env.REPLIT_DEPLOYMENT === '1' ? 'https://coinrailz.com' : 'https://coinrailz.com');

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
// Set standard x402 PAYMENT-REQUIRED header + auxiliary payment headers on
// MCP 402 responses so x402-aware clients can construct payment and retry
// automatically — identical header format to x402MicroserviceRoutesV2.
// Call this BEFORE res.status(402).json() — headers must precede the body.
//
// Takes the pre-built payload from buildMcpX402Payload so that the
// PAYMENT-REQUIRED header encodes EXACTLY the same accepts[] array and amounts
// as the JSON body — no separate construction, no Math.round vs Math.ceil drift.
// ---------------------------------------------------------------------------
function setMcp402Headers(
  res: Response,
  service: CanonicalService,
  payload: ReturnType<typeof buildMcpX402Payload>,
): void {
  try {
    // Encode the canonical payload's accepts[] into the PAYMENT-REQUIRED header.
    // This guarantees body and header are byte-identical in payTo/amounts/facilitators.
    const headerPayload = { x402Version: payload.x402Version, accepts: payload.accepts };
    const headerValue = Buffer.from(JSON.stringify(headerPayload), 'utf8').toString('base64');
    res.setHeader('PAYMENT-REQUIRED',      headerValue);
    res.setHeader('X-Payment-Price',       `$${service.priceUsd.toFixed(2)} USDC`);
    res.setHeader('X-Payment-Network',     'eip155:8453 (Base mainnet)');
    res.setHeader('X-Payment-Recipe-URL',  `${BASE_URL}/x402/recipes/${service.id}`);
    res.setHeader('X-Trial-Access',        `${BASE_URL}/api/m2m/credits/trial`);
  } catch (_) {
    // Non-fatal — headers are best-effort; JSON-RPC body still delivered
  }
}

// ---------------------------------------------------------------------------
// Helper: build machine-readable x402 payment payload for a service price.
// Mirrors the accepts[] shape from paymentOrchestrator.ts so x402-aware MCP
// clients (x402-fetch, Cloudflare Agents SDK, CDP SDK) can auto-pay and retry.
//
// mcpResourceUrl: the full public URL the agent called (e.g. BASE_URL+"/mcp"
// or BASE_URL+"/mcp/tools/call"). x402 clients bind payment to this URL and
// retry it — it must NOT be the internal /x402/... backend endpoint.
// ---------------------------------------------------------------------------
function buildMcpX402Payload(service: CanonicalService, reqId: unknown, mcpResourceUrl: string) {
  const priceUsd    = service.priceUsd;
  // USDC / USDT use 6 decimals; multiply by 10^6 to get micro-units.
  const microAmount = Math.ceil(priceUsd * 1_000_000).toString();
  const facilitator = getFacilitatorUrl();
  const resource    = mcpResourceUrl;   // the MCP endpoint, not the internal /x402/... backend
  const description = `${service.name} — ${service.description} ($${priceUsd.toFixed(2)} USDC)`;

  const accepts = [
    // Base Chain — USDC (primary, preferred)
    {
      scheme:               'exact',
      network:              'base',
      x402Network:          'eip155:8453',
      maxAmountRequired:    microAmount,
      maxAmountRequiredUSD: priceUsd,
      payTo:                PLATFORM_WALLET_EVM,
      asset:                USDC_BASE_ADDRESS,
      facilitator,
      resource,
      description,
      mimeType:             'application/json',
      maxTimeoutSeconds:    60,
      extra: { name: 'USD Coin', version: '2', decimals: 6, chainId: 8453, chainName: 'Base' },
    },
    // Base Chain — USDT
    {
      scheme:               'exact',
      network:              'base',
      x402Network:          'eip155:8453',
      maxAmountRequired:    microAmount,
      maxAmountRequiredUSD: priceUsd,
      payTo:                PLATFORM_WALLET_EVM,
      asset:                USDT_BASE_ADDRESS,
      facilitator,
      resource,
      description,
      mimeType:             'application/json',
      maxTimeoutSeconds:    60,
      extra: { name: 'Tether USD', version: '1', decimals: 6, chainId: 8453, chainName: 'Base' },
    },
    // Solana — USDC
    // Dexter is the dominant Solana + Base facilitator (~50% of daily x402 volume)
    {
      scheme:               'exact',
      network:              'solana',
      x402Network:          'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
      maxAmountRequired:    microAmount,
      maxAmountRequiredUSD: priceUsd,
      payTo:                PLATFORM_WALLET_SOLANA,
      asset:                USDC_SOLANA_MINT,
      facilitator:          getDexterFacilitatorUrl(),
      resource,
      description,
      mimeType:             'application/json',
      maxTimeoutSeconds:    60,
      extra: { name: 'USD Coin', version: '1', decimals: 6, chainId: '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', chainName: 'Solana' },
    },
  ];

  return {
    // x402 machine-readable fields — x402-fetch / CF Agents SDK / CDP SDK read these
    x402Version: 2,
    error:       'X-PAYMENT header is required',
    accepts,
    // JSON-RPC 2.0 envelope — preserved for MCP clients that inspect the RPC layer
    jsonrpc:     '2.0',
    id:          reqId ?? null,
    // Human-readable details — preserved for debugging and non-x402 clients
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
  const price   = s.priceUsd > 0 ? `$${s.priceUsd.toFixed(2)} USDC` : 'free';

  return {
    name:         `coinrailz_${s.id.replace(/-/g, '_')}`,
    description:  `[${price}] ${s.name} — ${s.description}`,
    inputSchema:  enrichInputSchema(s.inputSchema),
    outputSchema: MCP_OUTPUT_SCHEMA,
    annotations: {
      audience: ['assistant'] as string[],
      priority: s.priceUsd === 0 ? 0.3 : s.priceUsd <= 0.10 ? 0.6 : 0.8,
      title:    s.name,
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

  const { jsonrpc, id, method, params } = req.body ?? {};

  // Analytics — log every MCP probe: method, client fingerprint, auth mode (never credential values)
  const mcpIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
    || req.ip
    || (req.socket as any)?.remoteAddress
    || 'unknown';
  const mcpAuthMode = req.headers['x-api-key'] ? 'api-key'
    : req.headers['authorization'] ? 'bearer'
    : 'none';
  const mcpToolName = method === 'tools/call' ? ((params as any)?.name ?? 'unknown') : undefined;
  console.log(
    `[MCP] POST /mcp | method=${method ?? 'none'} | ip=${mcpIp}` +
    ` | ua=${(req.get('user-agent') ?? 'none').slice(0, 60)}` +
    ` | auth=${mcpAuthMode}${mcpToolName ? ` | tool=${mcpToolName}` : ''}`
  );

  if (jsonrpc !== '2.0' || !method) {
    return res.status(400).json({
      jsonrpc: '2.0',
      id: id ?? null,
      error: { code: -32600, message: 'Invalid Request' },
    });
  }

  if (method === 'initialize') {
    return res.json({
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: MCP_VERSION,
        capabilities: { tools: {}, resources: {}, prompts: {} },
        serverInfo: {
          name: 'coinrailz-mcp',
          version: '1.1.0',
          description: `${getCanonicalServiceCount()} x402 micropayment services via USDC — crypto analytics, NASA/ESA satellite data, IoT sensors, AI inference, and prediction markets.`,
        },
      },
    });
  }

  if (method === 'tools/list') {
    const services = getCanonicalServices();
    const tools = services.map(serviceToMcpTool);
    return res.json({
      jsonrpc: '2.0',
      id,
      result: { tools },
    });
  }

  if (method === 'tools/call') {
    const { name, arguments: args = {} } = params ?? {};
    if (!name) {
      return res.status(400).json({
        jsonrpc: '2.0', id,
        error: { code: -32602, message: 'Missing tool name' },
      });
    }

    const serviceId = name.replace(/^coinrailz_/, '').replace(/_/g, '-');
    const service   = getCanonicalServices().find(s => s.id === serviceId);

    if (!service) {
      return res.status(404).json({
        jsonrpc: '2.0', id,
        error: { code: -32601, message: `Unknown tool: ${name}` },
      });
    }

    const apiKey     = extractApiKey(req);
    const x402Header = req.headers['x-payment'] as string | undefined;

    if (!apiKey && !x402Header) {
      // Build the canonical payload once — headers and body are both derived from it,
      // guaranteeing identical accepts[], amounts, and facilitators.
      // resource = /mcp so x402 clients retry this endpoint (not the internal /x402/...).
      const mcpPayload = buildMcpX402Payload(service, id, `${BASE_URL}/mcp`);
      setMcp402Headers(res, service, mcpPayload);   // PAYMENT-REQUIRED base64 + auxiliary headers
      res.setHeader('X-402-Version', '2');
      res.setHeader('X-Payment-Required', 'true');
      return res.status(402).json(mcpPayload);
    }

    try {
      const forwardHeaders: Record<string, string> = { 'content-type': 'application/json' };
      if (apiKey)     forwardHeaders['x-api-key'] = apiKey;
      if (x402Header) forwardHeaders['x-payment']  = x402Header;
      // Forward the original MCP resource URL so the orchestrator can log it for tracing.
      forwardHeaders['x-forwarded-resource'] = `${BASE_URL}/mcp`;

      const baseUrl    = `http://localhost:${process.env.PORT || 5000}`;
      const upstream   = await fetch(`${baseUrl}${service.endpoint}`, {
        method:  service.method,
        headers: forwardHeaders,
        body:    service.method !== 'GET' ? JSON.stringify(args) : undefined,
      });

      const ct = upstream.headers.get('content-type') ?? '';
      const result = ct.includes('application/json') ? await upstream.json() : { text: await upstream.text() };

      if (upstream.status === 402) {
        const upstreamBody = result as any;
        // If the upstream service returned a well-formed x402 v2 challenge,
        // hoist x402Version, accepts, and error to the top level so x402-fetch
        // and the Cloudflare Agents SDK can read them and auto-retry.
        if (upstreamBody?.x402Version === 2 && Array.isArray(upstreamBody?.accepts)) {
          res.setHeader('X-402-Version', '2');
          res.setHeader('X-Payment-Required', 'true');
          try {
            const headerPayload = { x402Version: upstreamBody.x402Version, accepts: upstreamBody.accepts };
            const headerValue = Buffer.from(JSON.stringify(headerPayload), 'utf8').toString('base64');
            res.setHeader('PAYMENT-REQUIRED', headerValue);
          } catch (_) { /* non-fatal */ }
          return res.status(402).json({
            // x402 machine-readable fields at the top level — x402-fetch / CF Agents SDK read these
            x402Version: upstreamBody.x402Version,
            accepts:     upstreamBody.accepts,
            error:       upstreamBody.error ?? 'Payment required',
            // JSON-RPC envelope preserved for MCP clients
            jsonrpc:     '2.0',
            id:          id ?? null,
            // Human-readable details preserved for debugging
            details:     upstreamBody,
          });
        }
        // Fallback: upstream returned 402 but without a valid x402 v2 body
        return res.status(402).json({
          jsonrpc: '2.0', id,
          error: { code: 402, message: 'x402 payment required', details: result },
        });
      }

      if (!upstream.ok) {
        return res.status(upstream.status).json({
          jsonrpc: '2.0', id,
          error: { code: -32603, message: 'Upstream error', details: result },
        });
      }

      return res.json({
        jsonrpc: '2.0', id,
        result: { content: [{ type: 'text', text: JSON.stringify(result) }] },
      });
    } catch (err: any) {
      return res.status(500).json({
        jsonrpc: '2.0', id,
        error: { code: -32603, message: 'Internal error' },
      });
    }
  }

  if (method === 'resources/list' || method === 'prompts/list') {
    return res.json({ jsonrpc: '2.0', id, result: { [method.split('/')[0]]: [] } });
  }

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
  try {
    const services = getCanonicalServices();
    const tools = services.map(serviceToMcpTool);

    res.json({
      jsonrpc: '2.0',
      id:      1,
      result: {
        tools,
        _meta: {
          protocol:      'MCP',
          version:       MCP_VERSION,
          provider:      'Coin Railz',
          totalTools:    tools.length,
          paymentInfo: {
            apiKey: 'Add X-API-KEY: cr_live_... header (prepaid credits)',
            trial:  'GET /api/m2m/credits/trial for free $5 trial key',
            x402:   'Add X-PAYMENT header for native on-chain USDC payments',
          },
        },
      },
    });
  } catch (err: any) {
    res.status(500).json({
      jsonrpc: '2.0',
      id:      1,
      error:   { code: -32603, message: 'Internal error loading tools' },
    });
  }
});

// ---------------------------------------------------------------------------
// POST /mcp/tools/call
// Requires X-API-KEY, Authorization: Bearer, or X-PAYMENT header
// ---------------------------------------------------------------------------
router.post('/tools/call', async (req: Request, res: Response) => {
  const { name, arguments: args = {} } = req.body ?? {};

  if (!name || typeof name !== 'string') {
    return res.status(400).json({
      jsonrpc: '2.0',
      id:      req.body?.id ?? 1,
      error:   { code: -32602, message: 'Missing or invalid tool name' },
    });
  }

  // Map MCP tool name back to service ID
  const serviceId = name.replace(/^coinrailz_/, '').replace(/_/g, '-');
  const services  = getCanonicalServices();
  const service   = services.find(s => s.id === serviceId);

  if (!service) {
    return res.status(404).json({
      jsonrpc: '2.0',
      id:      req.body?.id ?? 1,
      error:   { code: -32601, message: `Unknown tool: ${name}` },
    });
  }

  // Auth check — must have API key or x402 payment header
  const apiKey     = extractApiKey(req);
  const x402Header = req.headers['x-payment'] as string | undefined;

  if (!apiKey && !x402Header) {
    // Build the canonical payload once — headers and body are both derived from it,
    // guaranteeing identical accepts[], amounts, and facilitators.
    // resource = /mcp/tools/call so x402 clients retry this endpoint (not the internal /x402/...).
    const mcpPayload = buildMcpX402Payload(service, req.body?.id ?? 1, `${BASE_URL}/mcp/tools/call`);
    setMcp402Headers(res, service, mcpPayload);   // PAYMENT-REQUIRED base64 + auxiliary headers
    res.setHeader('X-402-Version', '2');
    res.setHeader('X-Payment-Required', 'true');
    return res.status(402).json(mcpPayload);
  }

  try {
    // Build headers to forward to the underlying /x402/* handler
    const forwardHeaders: Record<string, string> = {
      'content-type': 'application/json',
      'accept':       'application/json',
    };

    if (apiKey)     forwardHeaders['x-api-key']  = apiKey;
    if (x402Header) forwardHeaders['x-payment']  = x402Header;
    // Forward the original MCP resource URL so the orchestrator can log it for tracing.
    forwardHeaders['x-forwarded-resource'] = `${BASE_URL}/mcp/tools/call`;

    // Proxy to the internal service handler
    const baseUrl    = `http://localhost:${process.env.PORT || 5000}`;
    const serviceUrl = `${baseUrl}${service.endpoint}`;

    const upstream = await fetch(serviceUrl, {
      method:  service.method,
      headers: forwardHeaders,
      body:    service.method !== 'GET' ? JSON.stringify(args) : undefined,
    });

    const contentType = upstream.headers.get('content-type') ?? '';
    let result: unknown;

    if (contentType.includes('application/json')) {
      result = await upstream.json();
    } else {
      result = { text: await upstream.text() };
    }

    if (upstream.status === 402) {
      const upstreamBody = result as any;
      // If the upstream service returned a well-formed x402 v2 challenge,
      // hoist x402Version, accepts, and error to the top level so x402-fetch
      // and the Cloudflare Agents SDK can read them and auto-retry.
      if (upstreamBody?.x402Version === 2 && Array.isArray(upstreamBody?.accepts)) {
        res.setHeader('X-402-Version', '2');
        res.setHeader('X-Payment-Required', 'true');
        try {
          const headerPayload = { x402Version: upstreamBody.x402Version, accepts: upstreamBody.accepts };
          const headerValue = Buffer.from(JSON.stringify(headerPayload), 'utf8').toString('base64');
          res.setHeader('PAYMENT-REQUIRED', headerValue);
        } catch (_) { /* non-fatal */ }
        return res.status(402).json({
          // x402 machine-readable fields at the top level — x402-fetch / CF Agents SDK read these
          x402Version: upstreamBody.x402Version,
          accepts:     upstreamBody.accepts,
          error:       upstreamBody.error ?? 'Payment required',
          // JSON-RPC envelope preserved for MCP clients
          jsonrpc:     '2.0',
          id:          req.body?.id ?? 1,
          // Human-readable details preserved for debugging
          details:     upstreamBody,
        });
      }
      // Fallback: upstream returned 402 but without a valid x402 v2 body
      return res.status(402).json({
        jsonrpc: '2.0',
        id:      req.body?.id ?? 1,
        error:   { code: 402, message: 'x402 payment required', details: result },
      });
    }

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        jsonrpc: '2.0',
        id:      req.body?.id ?? 1,
        error:   { code: -32603, message: 'Upstream service error', details: result },
      });
    }

    // Forward billing headers so agent runtimes can track credit usage
    const billingHeaders = [
      'x-credits-used', 'x-credits-remaining', 'x-recharge-url',
    ];
    billingHeaders.forEach(h => {
      const val = upstream.headers.get(h);
      if (val) res.setHeader(h, val);
    });

    return res.json({
      jsonrpc: '2.0',
      id:      req.body?.id ?? 1,
      result: {
        content: [{ type: 'text', text: JSON.stringify(result) }],
        _meta: {
          tool:     name,
          service:  service.id,
          priceUsd: service.priceUsd,
        },
      },
    });

  } catch (err: any) {
    console.error('[mcp/tools/call] error:', err?.message);
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
