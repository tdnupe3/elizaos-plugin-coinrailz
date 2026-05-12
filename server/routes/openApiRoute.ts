/**
 * GET /openapi.json — OpenAPI 3.1 spec for Coin Railz agent payment services
 *
 * Serves the merged canonical spec:
 *  - All 63 x402 service paths from public/openapi-x402-services.json
 *  - Onboarding paths (trial key, checkout, auth capabilities)
 *  - MPP paths
 *  - Discovery well-known paths
 *  - securitySchemes: apiKey, bearerApiKey, x402, mpp
 *  - x-codeSamples for Python and curl
 *  - Dynamic server URL from request host (works in dev and production)
 */

import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

const router = Router();

const staticSpecPath = path.join(process.cwd(), 'public', 'openapi-x402-services.json');
let staticSpec: any = null;

function getStaticSpec() {
  if (!staticSpec) {
    try {
      staticSpec = JSON.parse(fs.readFileSync(staticSpecPath, 'utf8'));
    } catch {
      staticSpec = { paths: {}, tags: [] };
    }
  }
  return staticSpec;
}

router.get('/openapi.json', (req: Request, res: Response) => {
  const baseUrl = process.env.PUBLIC_BASE_URL || `https://${req.headers.host}`;
  const catalog = getStaticSpec();

  const onboardingAndDiscoveryPaths: Record<string, any> = {
    '/api/auth/capabilities': {
      get: {
        operationId: 'getAuthCapabilities',
        summary: 'List all supported auth and payment modes',
        description: 'Machine-readable discovery document. No auth required. Returns all paths to obtain an API key or make x402 payments.',
        security: [],
        tags: ['Onboarding'],
        responses: {
          '200': { description: 'Auth modes and onboarding paths' },
        },
        'x-codeSamples': [
          { lang: 'Python', label: 'httpx', source: `import httpx\nresp = httpx.get("${baseUrl}/api/auth/capabilities")\nprint(resp.json())` },
          { lang: 'Shell', label: 'curl', source: `curl ${baseUrl}/api/auth/capabilities` },
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
          '200': { description: 'Trial key issued — save the apiKey value immediately, shown once only' },
          '403': { description: 'Internal IP — trial reserved for external agents' },
          '429': { description: 'Trial already claimed from this IP — upgrade to paid credits' },
        },
        'x-codeSamples': [
          { lang: 'Python', label: 'httpx', source: `import httpx\nresp = httpx.get("${baseUrl}/api/m2m/credits/trial")\ndata = resp.json()\napi_key = data["apiKey"]  # Save this — shown once only` },
          { lang: 'Shell', label: 'curl', source: `curl ${baseUrl}/api/m2m/credits/trial` },
        ],
      },
    },
    '/api/m2m/credits/checkout/session': {
      post: {
        operationId: 'createCheckoutSession',
        summary: 'Create a Stripe Hosted Checkout session for purchasing credits',
        description: 'No Stripe.js required. Returns a checkoutUrl the operator opens in a browser. On payment, webhook auto-provisions credits + API key.',
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
          '200': { description: 'Checkout session created with checkoutUrl and retrievalToken' },
          '400': { description: 'Invalid amountUsd' },
        },
        'x-codeSamples': [
          { lang: 'Python', label: 'httpx', source: `import httpx\nresp = httpx.post("${baseUrl}/api/m2m/credits/checkout/session",\n    json={"amountUsd": 10})\ndata = resp.json()\nprint("Open to pay:", data["checkoutUrl"])` },
          { lang: 'Shell', label: 'curl', source: `curl -X POST ${baseUrl}/api/m2m/credits/checkout/session \\\n  -H "Content-Type: application/json" \\\n  -d '{"amountUsd":10}'` },
        ],
      },
    },
    '/api/m2m/credits/checkout/status/{sessionId}': {
      get: {
        operationId: 'getCheckoutStatus',
        summary: 'Poll for API key after Hosted Checkout payment',
        description: 'Returns the API key once after payment confirmed. Requires retrievalToken from POST /checkout/session.',
        security: [],
        tags: ['Onboarding'],
        parameters: [
          { name: 'sessionId', in: 'path', required: true, schema: { type: 'string' }, description: 'Stripe Checkout Session ID (cs_...)' },
          { name: 'token', in: 'query', required: true, schema: { type: 'string' }, description: 'retrievalToken from POST /checkout/session' },
        ],
        responses: {
          '200': { description: 'Session status and API key if ready' },
          '401': { description: 'token query param missing' },
          '403': { description: 'Invalid token' },
        },
      },
    },
    '/x402/first-call': {
      post: {
        operationId: 'firstCall',
        summary: 'Canonical first-call endpoint — $0.05 USDC or API key credits',
        description: 'Use this to validate your API key or x402 payment setup. Returns a JSON response confirming payment method and service metadata.',
        security: [{ apiKey: [] }, { bearerApiKey: [] }, { x402: [] }],
        tags: ['Discovery'],
        responses: {
          '200': { description: 'Service response with payment confirmation' },
          '402': { description: 'Payment required — body includes all payment paths' },
        },
        'x-codeSamples': [
          { lang: 'Python', label: 'httpx (API key)', source: `import httpx\nresp = httpx.post(\n    "${baseUrl}/x402/first-call",\n    headers={"X-API-KEY": "cr_live_..."},\n    json={}\n)\nprint(resp.status_code, resp.json())\nprint("Remaining credits:", resp.headers.get("x-credits-remaining"))` },
          { lang: 'Shell', label: 'curl (API key)', source: `curl -X POST ${baseUrl}/x402/first-call \\\n  -H "X-API-KEY: cr_live_..." \\\n  -H "Content-Type: application/json" \\\n  -d '{}'` },
        ],
      },
    },
    '/mpp/catalog': {
      get: {
        operationId: 'getMppCatalog',
        summary: 'MPP service catalog — flagship services with pathUSD pricing',
        security: [],
        tags: ['MPP'],
        responses: { '200': { description: 'MPP service list with amounts and endpoints' } },
      },
    },
    '/mpp/ping': {
      post: {
        operationId: 'mppPing',
        summary: 'MPP echo/discovery — $0.25 pathUSD',
        security: [{ mpp: [] }],
        tags: ['MPP'],
        responses: { '200': { description: 'Echo response with platform info' }, '402': { description: 'MPP payment challenge (WWW-Authenticate: Payment)' } },
      },
    },
    '/mpp/first-call': {
      post: {
        operationId: 'mppFirstCall',
        summary: 'MPP golden path onboarding — $0.05 pathUSD',
        security: [{ mpp: [] }],
        tags: ['MPP'],
        responses: { '200': { description: 'Onboarding success' }, '402': { description: 'MPP payment challenge' } },
      },
    },
    '/mpp/ai-inference': {
      post: {
        operationId: 'mppAiInference',
        summary: 'GPT-4o-mini inference via MPP — $0.05 pathUSD',
        security: [{ mpp: [] }],
        tags: ['MPP'],
        requestBody: {
          content: { 'application/json': { schema: { type: 'object', required: ['prompt'], properties: { prompt: { type: 'string' }, systemPrompt: { type: 'string' }, maxTokens: { type: 'integer', example: 1024 } } } } },
        },
        responses: { '200': { description: 'AI inference result' }, '402': { description: 'MPP payment challenge' } },
      },
    },
    '/mpp/gas-price-oracle': {
      post: {
        operationId: 'mppGasPriceOracle',
        summary: 'Multi-chain gas prices via MPP — $0.10 pathUSD',
        security: [{ mpp: [] }],
        tags: ['MPP'],
        responses: { '200': { description: 'Gas prices across chains' }, '402': { description: 'MPP payment challenge' } },
      },
    },
    '/mpp/token-metadata': {
      post: {
        operationId: 'mppTokenMetadata',
        summary: 'Token metadata via MPP — $0.10 pathUSD',
        security: [{ mpp: [] }],
        tags: ['MPP'],
        responses: { '200': { description: 'Token name, symbol, decimals, supply' }, '402': { description: 'MPP payment challenge' } },
      },
    },
    '/.well-known/mpp.json': {
      get: {
        operationId: 'getMppManifest',
        summary: 'MPP service manifest',
        security: [],
        tags: ['Onboarding'],
        responses: { '200': { description: 'MPP manifest with endpoints' } },
      },
    },
    '/.well-known/x402.json': {
      get: {
        operationId: 'getX402Manifest',
        summary: 'x402 discovery manifest — quickstart and service catalog',
        security: [],
        tags: ['Onboarding'],
        responses: { '200': { description: 'x402 manifest' } },
      },
    },
    '/.well-known/agent-instructions.json': {
      get: {
        operationId: 'getAgentInstructions',
        summary: 'Agent integration instructions',
        security: [],
        tags: ['Onboarding'],
        responses: { '200': { description: 'Integration guide' } },
      },
    },
  };

  const mergedPaths = {
    ...onboardingAndDiscoveryPaths,
    ...catalog.paths,
  };

  const mergedTags = [
    { name: 'Onboarding', description: 'Get an API key or checkout session — no wallet required' },
    { name: 'MPP', description: 'MPP (Machine Payments Protocol) endpoints — pathUSD via Tempo. See /.well-known/mpp.json' },
    ...(catalog.tags || []),
  ];

  const spec = {
    openapi: '3.1.0',
    info: {
      title: 'Coin Railz Agent Payment API',
      version: '3.0.0',
      description: 'Production-grade x402 micropayment infrastructure for AI agents. 63 services across 8 blockchains (7 EVM + Solana), settling in USDC. Categories: Crypto Intelligence, Trading, Market Intelligence, Prediction Markets (Kalshi/Polymarket), Satellite Intelligence (NASA/ESA), IoT & DePIN (fleet telematics, weather stations, sensor data), AI Inference (GPT-4o-mini at $0.05/call), Real Estate, Banking, and Compliance. Pricing: $0.05–$0.25 per call. Free $5 trial key at /api/m2m/credits/trial. Supports API-key prepaid credits and native x402 on-chain USDC payments.',
      contact: { email: 'support@coinrailz.com', url: 'https://coinrailz.com' },
      'x-payment-info': catalog.info?.['x-payment-info'],
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
        mpp: {
          type: 'http',
          scheme: 'payment',
          description: 'MPP (Machine Payments Protocol) credential. Authorization: Payment <base64-credential>. See /.well-known/mpp.json.',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: { error: { type: 'string' }, message: { type: 'string' } },
        },
      },
    },
    tags: mergedTags,
    paths: mergedPaths,
    externalDocs: {
      description: 'Full x402 service catalog',
      url: `${baseUrl}/x402/catalog`,
    },
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.json(spec);
});

export default router;
