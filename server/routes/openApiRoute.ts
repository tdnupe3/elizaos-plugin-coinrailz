/**
 * GET /openapi.json — OpenAPI 3.1 spec for Coin Railz agent payment services
 *
 * Serves the merged canonical spec:
 *  - All 65 x402 service paths from public/openapi-x402-services.json
 *  - Onboarding paths (trial key, checkout, auth capabilities)
 *  - MPP paths
 *  - Discovery well-known paths
 *  - securitySchemes: apiKey, bearerApiKey, x402, mpp
 *  - x-codeSamples for Python and curl
 *  - Dynamic server URL from request host (works in dev and production)
 */

import { Router, Request, Response } from 'express';
import { getCanonicalServiceCount } from '../utils/serviceCount';
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
    '/api/yield/manifest': {
      get: {
        operationId: 'getYieldManifest',
        summary: 'USDC Yield Vault manifest — ERC-4626 auto-routing yield on Base',
        description: 'Full agent integration guide for the non-custodial USDC yield vault. Returns current APY, agentkit quickstart, REST paths (deposit-tx, redeem-tx, position), fees, and security properties. No auth required.',
        security: [],
        tags: ['Yield'],
        responses: { '200': { description: 'Vault manifest with agentkit quickstart and REST integration paths' } },
        'x-codeSamples': [
          { lang: 'Shell', label: 'curl', source: `curl ${baseUrl}/api/yield/manifest` },
        ],
      },
    },
    '/api/yield/rates': {
      get: {
        operationId: 'getYieldRates',
        summary: 'Live APY from Aave v3, Compound v3, and Morpho Blue on Base',
        description: 'Returns current gross APY and net APY for all three protocols. Cached 60s. Response includes Link header pointing to manifest and X-Agent-Tip for agentkit integration.',
        security: [],
        tags: ['Yield'],
        responses: { '200': { description: 'Live rates per protocol and current best APY' } },
      },
    },
    '/api/yield/stats': {
      get: {
        operationId: 'getYieldStats',
        summary: 'Vault TVL, active protocol, rebalance status, and fee structure',
        description: 'Returns vault address, TVL in USDC, price-per-share (crUSDC), fee structure, and time until next rebalance.',
        security: [],
        tags: ['Yield'],
        responses: { '200': { description: 'Vault statistics and routing status' } },
      },
    },
    '/api/yield/deposit-tx': {
      get: {
        operationId: 'getDepositTx',
        summary: 'Pre-built deposit calldata — standard (2 txs) or permit (1 tx)',
        description: 'Returns ready-to-sign transactions. Default: 2 txs (USDC approve + ERC-4626 deposit). Use ?mode=permit for 1-tx EIP-2612 permit path (~50% less gas). Use ?preset=100 for a USD preset OR ?amount=150 for a custom dollar amount. Requires ?recipient=0xYOUR_WALLET.',
        security: [],
        tags: ['Yield'],
        parameters: [
          { name: 'preset', in: 'query', schema: { type: 'integer', enum: [10, 50, 100, 250, 1000] }, description: 'USD preset amount (pick one: preset OR amount)' },
          { name: 'amount', in: 'query', schema: { type: 'number' }, description: 'Custom USD amount (pick one: preset OR amount). Example: 150 for $150' },
          { name: 'recipient', in: 'query', required: true, schema: { type: 'string' }, description: 'Recipient wallet address (0x...)' },
          { name: 'mode', in: 'query', schema: { type: 'string', enum: ['standard', 'permit'] }, description: 'standard = 2 txs (USDC approve + ERC-4626 deposit), permit = 1 tx via EIP-2612 (~50% less gas)' },
        ],
        responses: { '200': { description: 'Pre-built transaction steps ready to sign and broadcast' } },
        'x-codeSamples': [
          { lang: 'Shell', label: 'curl', source: `curl "${baseUrl}/api/yield/deposit-tx?preset=100&recipient=0xYOUR_WALLET"` },
        ],
      },
    },
    '/api/yield/redeem-tx': {
      get: {
        operationId: 'getRedeemTx',
        summary: 'Pre-built redeem calldata — burns crUSDC shares, returns USDC (1 tx, 0% exit fee)',
        description: 'Returns a single ready-to-sign transaction to redeem all crUSDC shares. No approval needed. 0% exit fee. Requires ?wallet=0xYOUR_WALLET.',
        security: [],
        tags: ['Yield'],
        parameters: [
          { name: 'wallet', in: 'query', required: true, schema: { type: 'string' }, description: 'Wallet holding crUSDC shares' },
        ],
        responses: { '200': { description: 'Single redeem transaction step' } },
      },
    },
    '/api/yield/position/{wallet}': {
      get: {
        operationId: 'getYieldPosition',
        summary: 'Live position for a wallet — shares, USD value, yield earned',
        description: 'Returns crUSDC shares held, current USD value, estimated yield, net yield (after performance fee), and redeem_hint (ready-to-sign withdraw tx). If position is zero, includes next_action hints.',
        security: [],
        tags: ['Yield'],
        parameters: [{ name: 'wallet', in: 'path', required: true, schema: { type: 'string' }, description: 'EVM wallet address (0x...)' }],
        responses: { '200': { description: 'Position data with optional next_action hints when no position exists' } },
        'x-codeSamples': [
          { lang: 'Shell', label: 'curl', source: `curl "${baseUrl}/api/yield/position/0xYOUR_WALLET"` },
        ],
      },
    },
    '/api/yield/contract': {
      get: {
        operationId: 'getYieldContract',
        summary: 'Vault ABI, addresses, audit status, and integration guide',
        description: 'Returns vault and USDC contract addresses, full ERC-4626 ABI, permit helper contract, fee structure, and integration guide. Use deposit-tx endpoint instead of calling the ABI directly — it pre-builds the calldata.',
        security: [],
        tags: ['Yield'],
        responses: { '200': { description: 'Contract info, ABI, and agent integration guide' } },
      },
    },
    '/api/solana-yield/manifest': {
      get: {
        operationId: 'getSolanaYieldManifest',
        summary: 'Solana USDC Yield Portal — full agent integration guide',
        description: 'Machine-readable manifest for the non-custodial Solana USDC yield portal. Returns current APY, step-by-step deposit flow, bridge instructions for EVM agents, idempotency guidance, and signing code snippet. No auth required.',
        security: [],
        tags: ['Solana Yield'],
        responses: { '200': { description: 'Manifest with agent_instructions, cross_chain_note, and comparison' } },
        'x-codeSamples': [
          { lang: 'Shell', label: 'curl', source: `curl ${baseUrl}/api/solana-yield/manifest` },
        ],
      },
    },
    '/api/solana-yield/rates': {
      get: {
        operationId: 'getSolanaYieldRates',
        summary: 'Live USDC APY on Kamino Lending (Solana)',
        description: 'Returns current USDC APY from Kamino Lending on Solana. Sourced from DeFiLlama with on-chain TVL/utilization. Includes comparison with Base/Aave. Free endpoint, no auth required.',
        security: [],
        tags: ['Solana Yield'],
        responses: { '200': { description: 'APY, TVL, utilization, and protocol comparison' } },
        'x-codeSamples': [
          { lang: 'Shell', label: 'curl', source: `curl ${baseUrl}/api/solana-yield/rates` },
        ],
      },
    },
    '/api/solana-yield/stats': {
      get: {
        operationId: 'getSolanaYieldStats',
        summary: 'Kamino reserve health — TVL, liquidity, utilization',
        description: 'Returns Kamino USDC reserve TVL, available liquidity, utilization percentage, and reserve address. Useful for checking if withdrawals are likely to succeed before submitting.',
        security: [],
        tags: ['Solana Yield'],
        responses: { '200': { description: 'Reserve health metrics' } },
      },
    },
    '/api/solana-yield/deposit-tx': {
      post: {
        operationId: 'buildSolanaDepositTx',
        summary: 'Build unsigned Solana deposit transaction bundle',
        description: 'Returns a bundle of 1-2 unsigned Solana VersionedTransactions (fee tx + deposit tx). Agent signs and submits both. Non-custodial — Coin Railz never holds funds. Min $5 USDC. Optionally pass idempotency_key to prevent duplicate fee charges on retry.',
        security: [],
        tags: ['Solana Yield'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['wallet', 'amount_usdc'],
                properties: {
                  wallet: { type: 'string', description: "Agent's Solana wallet public key (base58)" },
                  amount_usdc: { type: 'number', description: 'USDC amount in dollars. Min 5. Example: 10 for $10 USDC.' },
                  amount_raw: { type: 'string', description: 'Alternative: USDC amount in raw lamports (6 decimals). Min 5000000. Overrides amount_usdc if provided.' },
                  idempotency_key: { type: 'string', description: 'Optional. Unique key (UUID) to prevent duplicate fee charges if you retry. Same key+wallet+amount within 120s returns 409.' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Transaction bundle with base64-encoded transactions and bundle_expires_at' },
          '409': { description: 'Duplicate idempotency_key — a pending intent already exists for this wallet/amount/key' },
        },
        'x-codeSamples': [
          { lang: 'Shell', label: 'curl', source: `curl -X POST ${baseUrl}/api/solana-yield/deposit-tx -H 'Content-Type: application/json' -d '{"wallet":"YOUR_SOLANA_PUBKEY","amount_usdc":10,"idempotency_key":"uuid-here"}'` },
        ],
      },
    },
    '/api/solana-yield/confirm': {
      post: {
        operationId: 'confirmSolanaDeposit',
        summary: 'Confirm deposit after on-chain submission',
        description: 'Call after submitting the deposit transaction bundle. Verifies the transaction confirmed on-chain and that the claiming wallet was a signer. Stores confirmed position or pending_verification (keeper reconciles within 60 min if RPC unavailable).',
        security: [],
        tags: ['Solana Yield'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['wallet', 'txSignature'],
                properties: {
                  wallet: { type: 'string', description: "Agent's Solana wallet public key" },
                  txSignature: { type: 'string', description: 'Base58 transaction signature of the confirmed deposit tx' },
                  amountUsdcRaw: { type: 'string', description: 'Optional: raw USDC lamports deposited — used for position tracking' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Confirmation result with onChainVerified and verificationStatus (confirmed | pending_verification)' },
          '400': { description: 'Invalid signature format or transaction failed on-chain' },
          '403': { description: 'Wallet is not a signer in the provided transaction' },
        },
        'x-codeSamples': [
          { lang: 'Shell', label: 'curl', source: `curl -X POST ${baseUrl}/api/solana-yield/confirm -H 'Content-Type: application/json' -d '{"wallet":"YOUR_PUBKEY","txSignature":"TX_SIG_HERE"}'` },
        ],
      },
    },
    '/api/solana-yield/position/{wallet}': {
      get: {
        operationId: 'getSolanaYieldPosition',
        summary: "Agent's live USDC position in Kamino Lending",
        description: 'Returns collateral balance, current USDC value, estimated yield earned, and position status. Free endpoint, no auth required.',
        security: [],
        tags: ['Solana Yield'],
        parameters: [{ name: 'wallet', in: 'path', required: true, schema: { type: 'string' }, description: 'Solana wallet public key (base58)' }],
        responses: { '200': { description: 'Position data or empty position with next_action hints' } },
        'x-codeSamples': [
          { lang: 'Shell', label: 'curl', source: `curl ${baseUrl}/api/solana-yield/position/YOUR_SOLANA_PUBKEY` },
        ],
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
    { name: 'Yield', description: 'Non-custodial USDC yield vault — ERC-4626 auto-routing across Aave v3, Compound v3, and Morpho Blue on Base. No lockup, 0% exit fee.' },
    { name: 'Solana Yield', description: 'Non-custodial USDC yield portal on Solana — deposits into Kamino Lending. Agent signs and submits transactions; Coin Railz never holds funds.' },
    ...(catalog.tags || []),
  ];

  const spec = {
    openapi: '3.1.0',
    info: {
      title: 'Coin Railz Agent Payment API',
      version: '3.0.0',
      description: `Production-grade x402 micropayment infrastructure for AI agents. ${getCanonicalServiceCount()} services across 9 blockchains (8 EVM + Solana), settling in USDC. Categories: Crypto Intelligence, Trading, Market Intelligence, Prediction Markets (Kalshi/Polymarket), Satellite Intelligence (NASA/ESA), IoT & DePIN (fleet telematics, weather stations, sensor data), AI Inference (GPT-4o-mini at $0.05/call), Real Estate, Banking, and Compliance. Pricing: $0.05–$10.00 per call. Free $5 trial key at /api/m2m/credits/trial. Supports API-key prepaid credits and native x402 on-chain USDC payments.`,
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
