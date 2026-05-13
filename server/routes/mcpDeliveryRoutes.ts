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
import { getCanonicalServices, CanonicalService } from '../utils/serviceCount';

const router = Router();

// MCP protocol version we advertise
const MCP_VERSION = '2024-11-05';

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
// Helper: convert a CanonicalService into an MCP tool definition
// ---------------------------------------------------------------------------
function serviceToMcpTool(s: CanonicalService) {
  const inputSchema = s.inputSchema ?? {
    type: 'object',
    properties: {},
    required: [],
  };

  return {
    name: `coinrailz_${s.id.replace(/-/g, '_')}`,
    description: `[${s.priceUsd > 0 ? `$${s.priceUsd.toFixed(2)} USDC` : 'free'}] ${s.name} — ${s.description}`,
    inputSchema,
    annotations: {
      provider:  'Coin Railz',
      serviceId: s.id,
      endpoint:  s.endpoint,
      priceUsd:  s.priceUsd,
      category:  s.category,
      paymentMethods: ['X-API-KEY', 'Authorization: Bearer', 'X-PAYMENT (x402)'],
    },
  };
}

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
    return res.status(402).json({
      jsonrpc: '2.0',
      id:      req.body?.id ?? 1,
      error: {
        code:    402,
        message: 'Payment required. Add X-API-KEY (prepaid credits) or X-PAYMENT (x402 on-chain).',
        details: {
          trialKey:    '/api/m2m/credits/trial',
          purchaseKey: '/api/m2m/credits/checkout/session',
          x402:        '/.well-known/x402.json',
          priceUsd:    service.priceUsd,
        },
      },
    });
  }

  try {
    // Build headers to forward to the underlying /x402/* handler
    const forwardHeaders: Record<string, string> = {
      'content-type': 'application/json',
      'accept':       'application/json',
    };

    if (apiKey)     forwardHeaders['x-api-key']  = apiKey;
    if (x402Header) forwardHeaders['x-payment']  = x402Header;

    // Proxy to the internal service handler
    const baseUrl = `http://localhost:${process.env.PORT || 5000}`;
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
