/**
 * GET /openapi.json — OpenAPI 3.1 spec for Coin Railz agent payment services
 *
 * Serves a static-ish spec with:
 *  - securitySchemes: apiKey (X-API-KEY) and x402
 *  - Top service paths for LangChain/CrewAI/httpx tool auto-configuration
 *  - x-codeSamples for Python (httpx) and curl
 *
 * Note: uses req.headers.host to build dynamic server URL so the spec
 * always points to the correct environment (dev vs production).
 */

import { Router, Request, Response } from 'express';

const router = Router();

router.get('/openapi.json', (req: Request, res: Response) => {
  const baseUrl = process.env.PUBLIC_BASE_URL || `https://${req.headers.host}`;

  const spec = {
    openapi: '3.1.0',
    info: {
      title: 'Coin Railz Agent Payment API',
      version: '2.2.0',
      description: 'Multi-chain AI agent payment infrastructure. 60 services, 8 blockchains. Supports API-key prepaid credits and x402 on-chain USDC payments.',
      contact: { email: 'support@coinrailz.com', url: 'https://coinrailz.com' },
    },
    servers: [
      { url: baseUrl, description: 'Current environment' },
      { url: 'https://coinrailz.com', description: 'Production' },
    ],
    security: [{ apiKey: [] }],
    components: {
      securitySchemes: {
        apiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-KEY',
          description: 'Prepaid credits API key (cr_live_...). Obtain via GET /api/m2m/credits/trial (free $5) or POST /api/m2m/credits/checkout/session (paid).',
        },
        bearerApiKey: {
          type: 'http',
          scheme: 'bearer',
          description: 'Same cr_live_ key as X-API-KEY, passed as Authorization: Bearer <key>.',
        },
        x402: {
          type: 'apiKey',
          in: 'header',
          name: 'X-PAYMENT',
          description: 'x402 protocol on-chain USDC payment. Base64url-encoded signed payment payload. See /.well-known/x402.json for facilitator details.',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
        TrialKeyResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            apiKey: { type: 'string', description: 'cr_live_ key — shown once only, save immediately.' },
            credits: { type: 'number', description: 'Initial credit balance in USD.' },
            expiresIn: { type: 'string', example: '7 days' },
            usage: {
              type: 'object',
              properties: {
                header: { type: 'string', example: 'X-API-KEY' },
                example: { type: 'string' },
              },
            },
          },
        },
        CheckoutSessionResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            sessionId: { type: 'string' },
            checkoutUrl: { type: 'string', format: 'uri', description: 'Open in browser to pay.' },
            amountUsd: { type: 'number' },
            tier: { type: 'string' },
            nextStep: {
              type: 'object',
              properties: {
                statusEndpoint: { type: 'string' },
                note: { type: 'string' },
              },
            },
          },
        },
        AuthCapabilitiesResponse: {
          type: 'object',
          properties: {
            service: { type: 'string' },
            authModes: { type: 'array', items: { type: 'object' } },
            catalogUrl: { type: 'string' },
            supportedServices: { type: 'number' },
          },
        },
      },
    },
    paths: {
      '/api/auth/capabilities': {
        get: {
          operationId: 'getAuthCapabilities',
          summary: 'List all supported auth and payment modes',
          description: 'Machine-readable discovery document. No auth required. Returns all paths to obtain an API key or make x402 payments.',
          security: [],
          tags: ['Discovery'],
          responses: {
            '200': {
              description: 'Auth modes and onboarding paths',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthCapabilitiesResponse' } } },
            },
          },
          'x-codeSamples': [
            {
              lang: 'Python',
              label: 'httpx',
              source: `import httpx\nresp = httpx.get("${baseUrl}/api/auth/capabilities")\nprint(resp.json())`,
            },
            {
              lang: 'Shell',
              label: 'curl',
              source: `curl ${baseUrl}/api/auth/capabilities`,
            },
          ],
        },
      },
      '/api/m2m/credits/trial': {
        get: {
          operationId: 'getTrialKey',
          summary: 'Get a free $5 trial API key (~80-100 service calls)',
          description: 'Issues a cr_live_ API key with $5 prepaid credits. No payment, no wallet required. Rate limited: 1 per IP per 7 days.',
          security: [],
          tags: ['Onboarding'],
          responses: {
            '200': {
              description: 'Trial key issued',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/TrialKeyResponse' } } },
            },
            '403': { description: 'Internal IP address — trial reserved for external agents' },
            '429': { description: 'Trial already claimed from this IP — upgrade to paid credits' },
          },
          'x-codeSamples': [
            {
              lang: 'Python',
              label: 'httpx',
              source: `import httpx\nresp = httpx.get("${baseUrl}/api/m2m/credits/trial")\ndata = resp.json()\napi_key = data["apiKey"]  # Save this — shown once only`,
            },
            {
              lang: 'Shell',
              label: 'curl',
              source: `curl ${baseUrl}/api/m2m/credits/trial`,
            },
          ],
        },
      },
      '/api/m2m/credits/checkout/session': {
        post: {
          operationId: 'createCheckoutSession',
          summary: 'Create a Stripe Hosted Checkout session for purchasing credits',
          description: 'No Stripe.js required. Returns a checkoutUrl the operator opens in a browser. On payment, webhook auto-provisions credits + API key. Poll /api/m2m/credits/checkout/status/:sessionId for key retrieval.',
          security: [],
          tags: ['Onboarding'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['amountUsd'],
                  properties: {
                    amountUsd: { type: 'number', enum: [5, 10, 25, 100], description: 'Credit tier in USD.' },
                    email: { type: 'string', format: 'email', description: 'Optional — for Stripe receipt.' },
                    keyName: { type: 'string', description: 'Optional label for the generated API key.' },
                  },
                },
                example: { amountUsd: 10 },
              },
            },
          },
          responses: {
            '200': {
              description: 'Checkout session created',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/CheckoutSessionResponse' } } },
            },
            '400': { description: 'Invalid amountUsd' },
          },
          'x-codeSamples': [
            {
              lang: 'Python',
              label: 'httpx',
              source: `import httpx\nresp = httpx.post("${baseUrl}/api/m2m/credits/checkout/session",\n    json={"amountUsd": 10})\ndata = resp.json()\nprint("Open to pay:", data["checkoutUrl"])\nprint("Then poll:", data["nextStep"]["statusEndpoint"])`,
            },
            {
              lang: 'Shell',
              label: 'curl',
              source: `curl -X POST ${baseUrl}/api/m2m/credits/checkout/session \\\n  -H "Content-Type: application/json" \\\n  -d '{"amountUsd":10}'`,
            },
          ],
        },
      },
      '/api/m2m/credits/checkout/status/{sessionId}': {
        get: {
          operationId: 'getCheckoutStatus',
          summary: 'Poll for API key after Hosted Checkout payment',
          description: 'Returns the API key once after payment confirmed. Key shown once only.',
          security: [],
          tags: ['Onboarding'],
          parameters: [
            {
              name: 'sessionId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'Stripe Checkout Session ID (cs_...) from POST /checkout/session',
            },
          ],
          responses: {
            '200': { description: 'Session status and API key if ready' },
          },
        },
      },
      '/x402/first-call': {
        post: {
          operationId: 'firstCall',
          summary: 'Canonical first-call endpoint — $0.05 USDC or API key credits',
          description: 'Use this to validate your API key or x402 payment setup. Returns a simple JSON response confirming payment method and service metadata.',
          security: [{ apiKey: [] }, { bearerApiKey: [] }, { x402: [] }],
          tags: ['Services'],
          responses: {
            '200': { description: 'Service response' },
            '402': { description: 'Payment required — response body includes all payment paths' },
          },
          'x-codeSamples': [
            {
              lang: 'Python',
              label: 'httpx (API key)',
              source: `import httpx\nresp = httpx.post(\n    "${baseUrl}/x402/first-call",\n    headers={"X-API-KEY": "cr_live_..."},\n    json={}\n)\nprint(resp.status_code, resp.json())\n# Check headers:\nprint("Remaining credits:", resp.headers.get("x-credits-remaining"))`,
            },
            {
              lang: 'Shell',
              label: 'curl (API key)',
              source: `curl -X POST ${baseUrl}/x402/first-call \\\n  -H "X-API-KEY: cr_live_..." \\\n  -H "Content-Type: application/json" \\\n  -d '{}'`,
            },
          ],
        },
      },
      '/x402/gas-price-oracle': {
        post: {
          operationId: 'gasPriceOracle',
          summary: 'Real-time gas prices across all supported chains — $0.02',
          security: [{ apiKey: [] }, { x402: [] }],
          tags: ['Services'],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    chains: { type: 'array', items: { type: 'string' }, example: ['base', 'ethereum'] },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'Gas prices by chain' }, '402': { description: 'Payment required' } },
        },
      },
      '/x402/wallet-risk': {
        post: {
          operationId: 'walletRisk',
          summary: 'Wallet risk scoring — $0.03',
          security: [{ apiKey: [] }, { x402: [] }],
          tags: ['Services'],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['address'],
                  properties: {
                    address: { type: 'string', description: 'EVM wallet address (0x...)' },
                    chain: { type: 'string', example: 'ethereum' },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'Risk score and flags' }, '402': { description: 'Payment required' } },
        },
      },
      '/x402/trade-signals': {
        post: {
          operationId: 'tradeSignals',
          summary: 'AI-powered trade signals for a given token — $0.05',
          security: [{ apiKey: [] }, { x402: [] }],
          tags: ['Services'],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['token'],
                  properties: {
                    token: { type: 'string', example: 'ETH' },
                    chain: { type: 'string', example: 'ethereum' },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'Trade signal JSON' }, '402': { description: 'Payment required' } },
        },
      },
      '/.well-known/x402.json': {
        get: {
          operationId: 'getX402Manifest',
          summary: 'x402 discovery manifest — quickstart paths and service catalog',
          security: [],
          tags: ['Discovery'],
          responses: { '200': { description: 'x402 manifest with quickstart block' } },
        },
      },
      '/.well-known/agent-instructions.json': {
        get: {
          operationId: 'getAgentInstructions',
          summary: 'Detailed agent integration instructions',
          security: [],
          tags: ['Discovery'],
          responses: { '200': { description: 'Agent integration guide' } },
        },
      },
    },
    tags: [
      { name: 'Discovery', description: 'Unauthenticated discovery and capabilities endpoints' },
      { name: 'Onboarding', description: 'Get an API key or checkout session — no wallet required' },
      { name: 'Services', description: 'x402-gated data and payment services' },
    ],
    externalDocs: {
      description: 'Full service catalog (60 services)',
      url: `${baseUrl}/x402/catalog`,
    },
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=300'); // 5-minute cache
  res.json(spec);
});

export default router;
