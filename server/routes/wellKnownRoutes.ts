/**
 * WELL-KNOWN ENDPOINTS - x402 Protocol Discovery
 * 
 * These endpoints enable autonomous discovery by AI agents and x402 indexers
 * Required for Coinbase x402 indexing and organic traffic
 */

import { Router, Request, Response } from 'express';
import { SERVICE_PRICING_USD, formatUSD, ServiceName, isServiceName, getServicePriceUSD } from '@shared/pricing';
import { getFacilitatorUrl, getAllFacilitatorUrls } from '../utils/facilitatorHelper';
import { trackDiscovery } from '../middleware/hitTracker';
import { db } from '../db';
import { discoveredAgents } from '@shared/schema';
import { eq, or } from 'drizzle-orm';
import { emitFirstContactAsync } from '../services/funnelHelper.js';
import { getCanonicalServiceCount, getCanonicalServices } from '../utils/serviceCount';
import { serviceCatalogService } from '../services/serviceCatalogService';

const MPP_PROTOCOL_VERSION = "1.0";

// --- In-memory rate limiter for POST /.well-known/agent-registration.json ---
// 10 POST attempts per IP per 60 seconds. Map<ip, { count, windowStart }>
const registrationRateLimit = new Map<string, { count: number; windowStart: number }>();
const REGISTRATION_RATE_WINDOW_MS = 60_000;
const REGISTRATION_RATE_MAX = 10;

function checkRegistrationRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = registrationRateLimit.get(ip);
  if (!entry || now - entry.windowStart > REGISTRATION_RATE_WINDOW_MS) {
    registrationRateLimit.set(ip, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= REGISTRATION_RATE_MAX) return false;
  entry.count++;
  return true;
}

const router = Router();

router.use((req, res, next) => {
  if (req.path.startsWith('/.well-known')) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      || req.socket?.remoteAddress
      || 'unknown';
    emitFirstContactAsync(ip, 'well_known', req.path, req.headers['user-agent'] as string | undefined);
    return trackDiscovery(req, res, next);
  }
  next();
});

// Get base URL for the platform
const getBaseUrl = (req?: any) => {
  // Use PUBLIC_BASE_URL if set (preferred)
  if (process.env.PUBLIC_BASE_URL) {
    return process.env.PUBLIC_BASE_URL;
  }
  
  // Use request hostname if available (production)
  if (req && req.get('host')) {
    const host = req.get('host');
    
    // Only use http for localhost/127.0.0.1, otherwise ALWAYS use https
    // (req.protocol is often 'http' in production behind reverse proxy/load balancer)
    if (host.includes('localhost') || host.includes('127.0.0.1')) {
      return `http://${host}`;
    }
    
    // For all other domains (production), use HTTPS
    // Check X-Forwarded-Proto header first (standard proxy header)
    const forwardedProto = req.get('x-forwarded-proto');
    const protocol = forwardedProto || 'https';
    return `${protocol}://${host}`;
  }
  
  // Fallback based on deployment flag
  if (process.env.REPLIT_DEPLOYMENT === '1') {
    return 'https://coinrailz.com';
  }
  
  return 'http://localhost:5000';
};

/**
 * GET /.well-known/402index-verify.txt
 *
 * Domain ownership verification for 402index.io directory claim.
 * Token obtained via POST https://402index.io/api/v1/claim on 2026-05-03.
 * Claim expires in 72 hours — serves the verification_hash as plain text.
 */
router.get('/.well-known/402index-verify.txt', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Cache-Control', 'no-cache');
  res.status(200).send('b0f8986ee7662d98dcbcaf58fab5c4631e44bae50e0cd98c965b705d3b3084ed');
});

/**
 * GET /.well-known/mcp.json
 * 
 * MCP discovery manifest for NotHumanSearch and other MCP-aware indexers
 */
router.get('/.well-known/mcp.json', async (req: Request, res: Response) => {
  const baseUrl = getBaseUrl(req);
  res.status(200).json({
    mcp_version: "1.0.0",
    name: "Coin Railz MCP Server",
    description: `Multi-chain x402 USDC payment infrastructure for AI agents. Coinbase AgentKit compatible. ${getCanonicalServiceCount()} services across 9 blockchains.`,
    version: "1.0.0",
    url: baseUrl,
    endpoints: {
      tools_list: `${baseUrl}/mcp/tools/list`,
      tools_call: `${baseUrl}/mcp/tools/call`,
      services: `${baseUrl}/mcp/services`
    }
  });
});

/**
 * GET /.well-known/mcp-registry-auth  (ownership proof for modelcontextprotocol/registry)
 */
router.get('/.well-known/mcp-registry-auth', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/plain');
  res.send('v=MCPv1; k=ed25519; p=pjdKM8jUJeYMPD1AMP3TGx+L1M9sNfqQ4/zB+vPj7jE=');
});

/**
 * GET /.well-known/mcp-server.json
 * 
 * Secondary MCP discovery manifest probed by NotHumanSearch
 */
router.get('/.well-known/mcp-server.json', async (req: Request, res: Response) => {
  const baseUrl = getBaseUrl(req);
  res.status(200).json({
    name: "Coin Railz",
    description: "Multi-chain x402 USDC payment infrastructure for AI agents. Coinbase AgentKit compatible.",
    mcp_endpoint: `${baseUrl}/mcp/tools/call`,
    tools_list: `${baseUrl}/mcp/tools/list`,
    discovery_url: `${baseUrl}/.well-known/mcp.json`
  });
});

/**
 * GET /.well-known/server-card.json
 * GET /.well-known/mcp/server-card.json
 *
 * MCP Server Card (SEP-1649 / SEP-2127).
 * Probed by Claude, Cursor, Copilot, MCP registries, and ora.run validators
 * before establishing an MCP session. Served at both the short compat alias
 * and the canonical nested path defined in the spec.
 */
function buildServerCard(baseUrl: string) {
  const services = getCanonicalServices();

  const tools = services.map(s => {
    const price = s.priceUsd > 0 ? `$${s.priceUsd.toFixed(2)} USDC` : 'free';
    const inputSchema = (s.inputSchema ?? { type: 'object', properties: {}, required: [] }) as Record<string, unknown>;
    return {
      name: `coinrailz_${s.id.replace(/-/g, '_')}`,
      description: `[${price}] ${s.name} — ${s.description}. Price: ${price}`,
      inputSchema,
    };
  });

  return {
    serverInfo: {
      name: "coinrailz/x402-payment-infrastructure",
      version: "1.1.0",
    },
    title: "Coin Railz x402 Payment Infrastructure",
    description: `Production-grade x402 USDC payment infrastructure for AI agents. Coinbase AgentKit compatible. ${services.length} paid services across 9 blockchains (8 EVM + Solana). Categories: Crypto Intelligence, Trading Signals, Market Intelligence, Prediction Markets (Kalshi/Polymarket), Satellite Data (NASA Earthdata + ESA Sentinel), IoT & DePIN, AI Inference (GPT-4o-mini), Real Estate, Banking, and Compliance. Prices $0.05–$10.00 per call. Free $5 trial key at /api/m2m/credits/trial. AP2 v0.1, A2A 0.3.0, x402 v2.12 compatible.`,
    iconUrl: `${baseUrl}/attached_assets/Coin%20Railz%20Logo%20No%20BG.png`,
    documentationUrl: `${baseUrl}/mcp-integration-guide`,
    homepage: "https://coinrailz.com",
    contact: "support@coinrailz.com",
    transport: {
      type: "streamable-http",
      endpoint: `${baseUrl}/mcp`,
      listEndpoint: `${baseUrl}/mcp/tools/list`,
    },
    authentication: {
      required: false,
      note: "No auth required for tool discovery. Individual tool calls are pay-per-call via x402 USDC on Base, or prepaid credits via X-API-KEY header. Free $5 trial key: GET https://coinrailz.com/api/m2m/credits/trial",
    },
    payment: {
      href: `${baseUrl}/.well-known/x402.json`,
      rel: "payment-policy",
      rails: ["x402", "stripe"],
      settlementToken: "USDC",
      settlementChains: ["base", "solana"],
    },
    tools,
    resources: [],
    prompts: [],
  };
}

router.get('/.well-known/server-card.json', (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.status(200).json(buildServerCard(getBaseUrl(req)));
});

router.get('/.well-known/mcp/server-card.json', (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.status(200).json(buildServerCard(getBaseUrl(req)));
});

/**
 * GET /.well-known/ai-plugin.json
 * 
 * Legacy ChatGPT Plugin manifest (deprecated by OpenAI).
 * Primarily served for third-party AI indexers (NotHumanSearch, AWI-Scanner).
 * Current OpenAI discovery uses OpenAPI specs directly.
 */
router.get('/.well-known/ai-plugin.json', async (req: Request, res: Response) => {
  const baseUrl = getBaseUrl(req);
  res.status(200).json({
    schema_version: "v1",
    name_for_human: "Coin Railz Payments",
    name_for_model: "coin_railz_payments",
    description_for_human: `${getCanonicalServiceCount()}-service x402 USDC payment infrastructure for AI agents across 9 blockchains.`,
    description_for_model: `Production-grade x402 micropayment infrastructure for AI agents. ${getCanonicalServiceCount()} services across 9 blockchains (8 EVM + Solana), settling in USDC. Categories: Crypto Intelligence, Trading, Market Intelligence, Prediction Markets (Kalshi/Polymarket), Satellite Intelligence (NASA/ESA), IoT & DePIN (fleet telematics, weather stations, sensor data), AI Inference (GPT-4o-mini at $0.05/call), Real Estate, Banking, and Compliance. Pricing: $0.05–$10.00 per call. Free $5 trial key available at /api/m2m/credits/trial. Supports API-key prepaid credits and native x402 on-chain USDC payments.`,
    auth: {
      type: "none"
    },
    api: {
      type: "openapi",
      url: `${baseUrl}/openapi.json`,
      is_user_authenticated: false
    },
    logo_url: `${baseUrl}/attached_assets/Coin%20Railz%20Logo%20No%20BG.png`,
    contact_email: "support@coinrailz.com",
    legal_info_url: `${baseUrl}/legal`
  });
});

/**
 * GET /.well-known/agent.json
 * 
 * A2A v0.3 compliant agent card for Google Agent2Agent protocol
 * Enables semantic skill matching and agent-to-agent collaboration
 */
router.get('/.well-known/agent.json', async (req: Request, res: Response) => {
  const baseUrl = getBaseUrl(req);
  
  const a2aAgentCard = {
    name: "Coin Railz Multi-Chain Payment Infrastructure",
    description: `Production-grade blockchain infrastructure for AI agents. ${getCanonicalServiceCount()} x402 micropayment services across 9 chains (8 EVM + Solana) + Native Coinbase Agentic Wallet support + OWS (Open Wallet Standard) compatible + MoonPay Agents compatible + NASA Earthdata Intelligence (5 services, $0.25/call) + ESA Satellite Data + AI Inference Gateway (GPT-4o-mini, $0.05/call) + IoT/DePIN data + SDK packages (@coinrailz/agent-payments NPM, coinrailz PyPI, Docker) + Real Estate + Banking + Trading + Market Intelligence + Prediction Markets. Processing fee: 1.5% + $0.01 per transaction.`,
    version: "0.6.1",
    x402ManifestVersion: "x402-2.3",
    agentId: "coinrailz-x402-infrastructure",
    securityContact: "mailto:security@coinrailz.com",
    
    // A2A v0.3 service endpoint
    serviceUrl: `${baseUrl}/x402`,
    
    // Machine-readable onboarding instructions for AI agents
    instructions: `${baseUrl}/.well-known/agent-instructions.json`,
    agent_instructions: `${baseUrl}/.well-known/agent-instructions.json`,

    // Agent self-registration — record your wallet & capabilities before making first call
    registrationEndpoint: `${baseUrl}/.well-known/agent-registration.json`,
    
    // A2A v0.3 capabilities object (required for Google A2A compliance)
    capabilities: {
      streaming: false,
      pushNotifications: false,
      stateTransitionHistory: false
    },
    
    // Skills array with semantic descriptions for AI matching
    skills: [
      {
        id: "earthdata-granules",
        name: "NASA Earthdata Granule Search",
        description: "CMR Granule Search for 1B+ granules including Landsat, Sentinel, MODIS, and VIIRS. Part of the NASA Earthdata Intelligence suite.",
        price: "$0.25 USDC",
        amountMicroUSDC: 250000,
        chainsAccepted: ["eip155:8453"],
        category: "satellite-intelligence",
        tags: ["NASA", "Earthdata", "Satellite", "Remote Sensing"],
        inputSchema: {
          type: "object",
          properties: {
            concept_id: { type: "string", description: "NASA concept ID" },
            temporal: { type: "string", description: "Time range" },
            bounding_box: { type: "string", description: "Spatial bounding box" }
          }
        }
      },
      {
        id: "earthdata-precipitation",
        name: "GPM IMERG Precipitation Data",
        description: "Global Precipitation Measurement (GPM) IMERG point queries at 0.1° resolution. Part of the NASA Earthdata Intelligence suite.",
        price: "$0.25 USDC",
        amountMicroUSDC: 250000,
        chainsAccepted: ["eip155:8453"],
        category: "satellite-intelligence",
        tags: ["NASA", "Earthdata", "Precipitation", "Weather", "GPM"],
        inputSchema: {
          type: "object",
          properties: {
            lat: { type: "number" },
            lon: { type: "number" },
            date: { type: "string" }
          }
        }
      },
      {
        id: "earthdata-sst",
        name: "MUR Sea Surface Temperature",
        description: "Multi-scale Ultra-high Resolution (MUR) Sea Surface Temperature (SST) at 1km daily resolution. Part of the NASA Earthdata Intelligence suite. Endpoint: /x402/earthdata-sst.",
        price: "$0.25 USDC",
        amountMicroUSDC: 250000,
        chainsAccepted: ["eip155:8453"],
        category: "satellite-intelligence",
        tags: ["NASA", "Earthdata", "Ocean", "Temperature", "SST", "x402"],
        inputSchema: {
          type: "object",
          properties: {
            lat: { type: "number" },
            lon: { type: "number" },
            date: { type: "string" }
          }
        }
      },
      {
        id: "earthdata-soil-moisture",
        name: "SMAP Soil Moisture",
        description: "Soil Moisture Active Passive (SMAP) L3 soil moisture granule discovery. Part of the NASA Earthdata Intelligence suite.",
        price: "$0.25 USDC",
        amountMicroUSDC: 250000,
        chainsAccepted: ["eip155:8453"],
        category: "satellite-intelligence",
        tags: ["NASA", "Earthdata", "Soil", "Moisture", "SMAP"],
        inputSchema: {
          type: "object",
          properties: {
            lat: { type: "number" },
            lon: { type: "number" },
            date: { type: "string" }
          }
        }
      },
      {
        id: "earthdata-ocean-color",
        name: "Ocean Color & Water Quality",
        description: "MODIS Ocean Color / Chlorophyll-a (MODISA_L3m_CHL) data. Part of the NASA Earthdata Intelligence suite. Endpoint: /x402/earthdata-ocean-color.",
        price: "$0.25 USDC",
        amountMicroUSDC: 250000,
        chainsAccepted: ["eip155:8453"],
        category: "satellite-intelligence",
        tags: ["NASA", "Earthdata", "Ocean", "Chlorophyll", "Water Quality", "x402"],
        inputSchema: {
          type: "object",
          properties: {
            lat: { type: "number" },
            lon: { type: "number" },
            date: { type: "string" }
          }
        }
      },
      {
        id: "first_call",
        name: "Golden Path — First Paid Call",
        description: "START HERE. The canonical first payment for any agent integrating with Coin Railz. Pay $0.05 USDC on Base or Solana and receive a verified onboarding receipt plus executable templates for the next 3 services. Both EVM and Solana supported. Lowest price on the platform.",
        price: "$0.05 USDC",
        amountMicroUSDC: 50000,
        chainsAccepted: ["eip155:8453", "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"],
        facilitators: {
          evm: "https://api.cdp.coinbase.com/platform/v2/x402",
          solana: "https://x402.dexter.cash"
        },
        inputSchema: {
          type: "object",
          properties: {
            agentId: { type: "string", description: "Optional agent identifier for tracking" }
          }
        },
        outputSchema: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            goldenPath: { type: "boolean" },
            sessionId: { type: "string" },
            payment: { type: "object", description: "Payment receipt with chain, amount, timestamp" },
            nextServices: { type: "array", description: "3 executable next-step service templates" }
          }
        },
        cardFirstPath: {
          label: "Card (Recommended — no crypto wallet required)",
          description: "Get a cr_live_ API key via Stripe in ~60 seconds, then call any service.",
          step1: {
            action: "Purchase API key",
            endpoint: `${baseUrl}/api/m2m/credits/purchase`,
            method: "POST",
            body: { paymentMethodId: "pm_...", amountUsd: 10, idempotencyKey: "<uuid-v4>" },
            successResponse: { apiKey: "cr_live_...", creditsAdded: 200 }
          },
          step2: {
            action: "Call first-call with API key",
            curl: `curl -X POST ${baseUrl}/x402/first-call -H 'X-API-KEY: cr_live_...' -H 'Content-Type: application/json' -d '{}'`
          }
        },
        examples: [
          {
            name: "API key (card — recommended)",
            code: `curl -X POST ${baseUrl}/x402/first-call -H 'X-API-KEY: cr_live_...' -H 'Content-Type: application/json' -d '{}'`
          },
          {
            name: "curl (EVM — Base, crypto)",
            code: `curl -X POST ${baseUrl}/x402/first-call -H 'Content-Type: application/json' -H 'X-PAYMENT: <base64url-signed-x402-payload>' -d '{}'`
          },
          {
            name: "curl (Solana, crypto)",
            code: `curl -X POST ${baseUrl}/x402/first-call -H 'Content-Type: application/json' -H 'X-Solana-Wallet: <pubkey>' -H 'X-PAYMENT: <solana_payload>' -d '{}'`
          },
          {
            name: "python (httpx)",
            code: `import httpx\nresp = httpx.post('${baseUrl}/x402/first-call', headers={'X-API-KEY': 'cr_live_...'}, json={})\nprint(resp.json())`
          }
        ]
      },
      {
        id: "multi_chain_balance",
        name: "Multi-Chain Balance Checker",
        description: "Check wallet balances across 8 EVM chains in one API call. Use when user asks 'what's my balance', 'check wallet on multiple chains', 'show my assets', 'balance on Ethereum', 'balance on Base', 'balance on Robinhood Chain', or 'balance on Polygon'.",
        inputSchema: {
          type: "object",
          title: "Multi-Chain Balance Request",
          description: "Request wallet balances across multiple EVM chains",
          additionalProperties: false,
          properties: {
            walletAddress: { 
              type: "string", 
              title: "Wallet Address",
              description: "EVM wallet address (0x...)",
              pattern: "^0x[a-fA-F0-9]{40}$"
            },
            chains: { 
              type: "array", 
              title: "Target Chains",
              description: "Optional: Specific chains to check",
              items: { 
                type: "string",
                enum: ["ethereum", "base", "polygon", "bsc", "arbitrum", "optimism", "pulsechain"]
              }
            },
            includeTokens: { 
              type: "boolean", 
              title: "Include Tokens",
              description: "Include ERC-20 token balances",
              default: true
            }
          },
          required: ["walletAddress"]
        },
        outputSchema: {
          type: "object",
          title: "Multi-Chain Balance Response",
          additionalProperties: false,
          properties: {
            balances: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  chain: { type: "string", title: "Chain Name", enum: ["ethereum", "base", "polygon", "bsc", "arbitrum", "optimism", "pulsechain"] },
                  nativeBalance: { type: "string", title: "Native Balance", description: "Native token balance (ETH, MATIC, etc.)" },
                  tokens: { type: "array", title: "Token Balances" }
                }
              }
            }
          }
        },
        pricing: { amount: 0.50, currency: "USD" },
        category: "analytics"
      },
      {
        id: "gas_price_oracle",
        name: "Gas Price Oracle",
        description: "Real-time gas prices across multiple chains with USD cost estimates. Use when user asks 'how much is gas', 'current gas fees', 'gas price on Ethereum', 'gas price on Base', 'gas price on Polygon', or 'cheapest time to transact'.",
        inputSchema: {
          type: "object",
          title: "Gas Price Request",
          description: "Request gas prices for specific chains",
          additionalProperties: false,
          properties: {
            chains: { 
              type: "array", 
              title: "Target Chains",
              description: "Chains to check (default: all supported chains)",
              items: {
                type: "string",
                enum: ["ethereum", "base", "polygon", "bsc", "arbitrum", "optimism", "pulsechain"]
              }
            }
          }
        },
        outputSchema: {
          type: "object",
          title: "Gas Price Response",
          additionalProperties: false,
          properties: {
            gasPrices: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  chain: { type: "string", title: "Chain Name", enum: ["ethereum", "base", "polygon", "bsc", "arbitrum", "optimism", "pulsechain"] },
                  slow: { type: "number", title: "Slow Gas Price (gwei)" },
                  standard: { type: "number", title: "Standard Gas Price (gwei)" },
                  fast: { type: "number", title: "Fast Gas Price (gwei)" },
                  usdCost: { type: "object", title: "USD Cost Estimates" }
                }
              }
            }
          }
        },
        pricing: { amount: 0.10, currency: "USD" },
        category: "utilities"
      },
      {
        id: "token_price",
        name: "Token Price Lookup",
        description: "Get real-time token prices with 24h change, volume, and market cap from CoinGecko/DEX Screener. Use when user asks 'what's the price of', 'token value', 'price check', 'token price on Ethereum', 'token price on Base', or 'token price on Polygon'.",
        inputSchema: {
          type: "object",
          title: "Token Price Request",
          description: "Request real-time token price data",
          additionalProperties: false,
          properties: {
            tokenAddress: { 
              type: "string", 
              title: "Token Contract Address",
              description: "Token contract address",
              pattern: "^0x[a-fA-F0-9]{40}$"
            },
            chain: { 
              type: "string", 
              title: "Blockchain Network",
              description: "Blockchain network where token exists",
              enum: ["ethereum", "base", "polygon", "bsc", "arbitrum", "optimism", "pulsechain"]
            }
          },
          required: ["tokenAddress", "chain"]
        },
        outputSchema: {
          type: "object",
          title: "Token Price Response",
          additionalProperties: false,
          properties: {
            price: { type: "number", title: "Current Price USD" },
            priceChange24h: { type: "number", title: "24h Price Change %" },
            volume24h: { type: "number", title: "24h Trading Volume USD" },
            marketCap: { type: "number", title: "Market Cap USD" },
            source: { type: "string", title: "Data Source", enum: ["coingecko", "dexscreener"] }
          }
        },
        pricing: { amount: 0.25, currency: "USD" },
        category: "trading"
      },
      {
        id: "wallet_risk_analysis",
        name: "Wallet Risk Assessment",
        description: "Analyze wallet for suspicious activity, scam exposure, and security risks. Use when user asks 'is this wallet safe', 'check wallet security', 'wallet reputation', 'wallet risk on Ethereum', 'wallet risk on Base', or 'is this address safe'.",
        inputSchema: {
          type: "object",
          title: "Wallet Risk Analysis Request",
          description: "Request security analysis for a wallet address",
          additionalProperties: false,
          properties: {
            walletAddress: { 
              type: "string", 
              title: "Wallet Address",
              description: "Wallet address to analyze",
              pattern: "^0x[a-fA-F0-9]{40}$"
            },
            chain: { 
              type: "string", 
              title: "Blockchain Network",
              description: "Blockchain network",
              enum: ["ethereum", "base", "polygon", "bsc", "arbitrum", "optimism", "pulsechain"]
            }
          },
          required: ["walletAddress", "chain"]
        },
        outputSchema: {
          type: "object",
          title: "Wallet Risk Assessment Response",
          additionalProperties: false,
          properties: {
            riskScore: { type: "number", title: "Risk Score", description: "0-100 (0=safe, 100=high risk)", minimum: 0, maximum: 100 },
            flags: { type: "array", title: "Risk Flags", items: { type: "string" } },
            scamExposure: { type: "boolean", title: "Scam Exposure Detected" },
            recommendations: { type: "array", title: "Security Recommendations", items: { type: "string" } }
          }
        },
        pricing: { amount: 0.75, currency: "USD" },
        category: "security"
      },
      {
        id: "trade_signals",
        name: "AI Trading Signals",
        description: "Generate trading signals based on technical analysis and on-chain data. Use when user asks 'should I buy/sell', 'trading recommendation', 'market opportunity', 'trade signal for token on Ethereum', 'trade signal for token on Base', or 'should I buy this token'.",
        inputSchema: {
          type: "object",
          title: "Trade Signal Request",
          description: "Request AI-powered trading signals",
          additionalProperties: false,
          properties: {
            tokenAddress: { 
              type: "string", 
              title: "Token Address",
              description: "Token to analyze",
              pattern: "^0x[a-fA-F0-9]{40}$"
            },
            chain: { 
              type: "string",
              title: "Blockchain Network",
              enum: ["ethereum", "base", "polygon", "bsc", "arbitrum", "optimism", "pulsechain"]
            },
            timeframe: { 
              type: "string", 
              title: "Analysis Timeframe",
              description: "Chart timeframe for analysis",
              enum: ["1h", "4h", "1d", "1w"]
            }
          },
          required: ["tokenAddress", "chain"]
        },
        outputSchema: {
          type: "object",
          title: "Trade Signal Response",
          additionalProperties: false,
          properties: {
            signal: { type: "string", title: "Signal", enum: ["buy", "sell", "hold"] },
            confidence: { type: "number", title: "Confidence Score", minimum: 0, maximum: 1 },
            indicators: { type: "object", title: "Technical Indicators" },
            reasoning: { type: "string", title: "Analysis Reasoning" }
          }
        },
        pricing: { amount: 0.20, currency: "USD" },
        category: "trading"
      },
      {
        id: "smart_contract_scan",
        name: "Smart Contract Security Scan",
        description: "Basic security scan of smart contracts with vulnerability detection. Use when user asks 'is this contract safe', 'check contract security', 'audit contract', 'scan contract on Ethereum', 'scan contract on Base', or 'contract vulnerabilities'.",
        inputSchema: {
          type: "object",
          title: "Smart Contract Scan Request",
          description: "Request security scan for a smart contract",
          additionalProperties: false,
          properties: {
            contractAddress: { 
              type: "string", 
              title: "Contract Address",
              description: "Contract address to scan",
              pattern: "^0x[a-fA-F0-9]{40}$"
            },
            chain: { 
              type: "string",
              title: "Blockchain Network",
              enum: ["ethereum", "base", "polygon", "bsc", "arbitrum", "optimism", "pulsechain"]
            }
          },
          required: ["contractAddress", "chain"]
        },
        outputSchema: {
          type: "object",
          title: "Contract Security Scan Response",
          additionalProperties: false,
          properties: {
            safetyScore: { type: "number", title: "Safety Score", minimum: 0, maximum: 100 },
            vulnerabilities: { type: "array", title: "Detected Vulnerabilities", items: { type: "string" } },
            contractType: { type: "string", title: "Contract Type" },
            verified: { type: "boolean", title: "Source Code Verified" }
          }
        },
        pricing: { amount: 1.00, currency: "USD" },
        category: "security"
      },
      {
        id: "token_sentiment",
        name: "Token Sentiment Analysis",
        description: "Social sentiment analysis from Twitter/Reddit for tokens. Use when user asks 'what people say about', 'token sentiment', 'community opinion', 'sentiment on Ethereum', 'sentiment on Base', or 'social buzz'.",
        inputSchema: {
          type: "object",
          title: "Token Sentiment Request",
          description: "Request social sentiment analysis for a token",
          additionalProperties: false,
          properties: {
            tokenAddress: { 
              type: "string",
              title: "Token Address",
              pattern: "^0x[a-fA-F0-9]{40}$"
            },
            chain: { 
              type: "string",
              title: "Blockchain Network",
              enum: ["ethereum", "base", "polygon", "bsc", "arbitrum", "optimism", "pulsechain"]
            }
          },
          required: ["tokenAddress", "chain"]
        },
        outputSchema: {
          type: "object",
          title: "Token Sentiment Response",
          additionalProperties: false,
          properties: {
            sentiment: { type: "string", title: "Overall Sentiment", enum: ["positive", "neutral", "negative"] },
            score: { type: "number", title: "Sentiment Score", minimum: -1, maximum: 1 },
            mentions24h: { type: "number", title: "Social Mentions (24h)" },
            trending: { type: "boolean", title: "Is Trending" }
          }
        },
        pricing: { amount: 0.30, currency: "USD" },
        category: "analytics"
      },
      {
        id: "trending_tokens",
        name: "Trending Tokens Discovery",
        description: "Find trending tokens by volume, price movement, or social activity. Use when user asks 'what's trending', 'hot tokens', 'new opportunities', 'trending on Ethereum', 'trending on Base', or 'trending on Polygon'.",
        inputSchema: {
          type: "object",
          title: "Trending Tokens Request",
          description: "Request trending tokens by specific metrics",
          additionalProperties: false,
          properties: {
            chain: { 
              type: "string",
              title: "Blockchain Network",
              enum: ["ethereum", "base", "polygon", "bsc", "arbitrum", "optimism", "pulsechain"]
            },
            metric: { 
              type: "string", 
              title: "Sorting Metric",
              enum: ["volume", "price_change", "social"], 
              description: "Metric to sort trending tokens by"
            },
            limit: { 
              type: "number", 
              title: "Result Limit",
              description: "Number of results to return (default: 10)",
              minimum: 1,
              maximum: 100,
              default: 10
            }
          }
        },
        outputSchema: {
          type: "object",
          title: "Trending Tokens Response",
          additionalProperties: false,
          properties: {
            tokens: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  address: { type: "string", title: "Token Address" },
                  name: { type: "string", title: "Token Name" },
                  price: { type: "number", title: "Current Price USD" },
                  change24h: { type: "number", title: "24h Price Change %" },
                  volume24h: { type: "number", title: "24h Volume USD" }
                }
              }
            }
          }
        },
        pricing: { amount: 0.40, currency: "USD" },
        category: "trading"
      },
      {
        id: "whale_alerts",
        name: "Whale Movement Tracker",
        description: "Track large wallet movements and whale activity in real-time. Use when user asks 'whale movements', 'large transfers', 'big wallet activity', 'whale alerts on Ethereum', 'whale alerts on Base', or 'large transactions'.",
        inputSchema: {
          type: "object",
          title: "Whale Tracker Request",
          description: "Request whale movement tracking",
          additionalProperties: false,
          properties: {
            tokenAddress: { 
              type: "string", 
              title: "Token Address",
              description: "Token to monitor (optional - leave empty for all tokens)",
              pattern: "^0x[a-fA-F0-9]{40}$"
            },
            chain: { 
              type: "string",
              title: "Blockchain Network",
              enum: ["ethereum", "base", "polygon", "bsc", "arbitrum", "optimism", "pulsechain"]
            },
            minAmount: { 
              type: "number", 
              title: "Minimum USD Value",
              description: "Minimum transaction value in USD to track",
              minimum: 0
            }
          },
          required: ["chain"]
        },
        outputSchema: {
          type: "object",
          title: "Whale Movements Response",
          additionalProperties: false,
          properties: {
            movements: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  from: { type: "string", title: "Sender Address" },
                  to: { type: "string", title: "Recipient Address" },
                  amount: { type: "string", title: "Amount" },
                  usdValue: { type: "number", title: "USD Value" },
                  timestamp: { type: "number", title: "Timestamp (Unix)" }
                }
              }
            }
          }
        },
        pricing: { amount: 0.30, currency: "USD" },
        category: "analytics"
      },
      {
        id: "dex_liquidity",
        name: "DEX Liquidity Scanner",
        description: "Analyze liquidity pools across DEXs with APY and impermanent loss calculations. Use when user asks 'liquidity pool info', 'best APY', 'LP opportunity', 'liquidity on Ethereum', 'liquidity on Base', or 'pool analysis'.",
        inputSchema: {
          type: "object",
          title: "DEX Liquidity Request",
          description: "Request liquidity pool analysis",
          additionalProperties: false,
          properties: {
            tokenPair: { 
              type: "string", 
              title: "Token Pair",
              description: "Trading pair to analyze (e.g., 'ETH/USDC', 'WBTC/ETH')"
            },
            chain: { 
              type: "string",
              title: "Blockchain Network",
              enum: ["ethereum", "base", "polygon", "bsc", "arbitrum", "optimism", "pulsechain"]
            },
            dex: { 
              type: "string", 
              title: "DEX Platform",
              description: "Specific DEX to query (e.g., 'uniswap', 'sushiswap') or 'all'"
            }
          },
          required: ["tokenPair", "chain"]
        },
        outputSchema: {
          type: "object",
          title: "DEX Liquidity Response",
          additionalProperties: false,
          properties: {
            pools: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  dex: { type: "string", title: "DEX Name" },
                  liquidity: { type: "number", title: "Total Liquidity USD" },
                  apy: { type: "number", title: "APY %" },
                  volume24h: { type: "number", title: "24h Volume USD" },
                  impermanentLoss: { type: "number", title: "Estimated IL %" }
                }
              }
            }
          }
        },
        pricing: { amount: 0.35, currency: "USD" },
        category: "defi"
      },
      {
        id: "transaction_builder",
        name: "Transaction Builder",
        description: "Build optimized transactions with gas estimation. Use when user asks 'create transaction', 'prepare swap', 'build tx', 'build transaction on Ethereum', 'build transaction on Base', or 'prepare transfer'.",
        inputSchema: {
          type: "object",
          title: "Transaction Builder Request",
          description: "Request transaction construction with gas estimates",
          additionalProperties: false,
          properties: {
            from: { 
              type: "string", 
              title: "Sender Address",
              pattern: "^0x[a-fA-F0-9]{40}$"
            },
            to: { 
              type: "string", 
              title: "Recipient Address",
              pattern: "^0x[a-fA-F0-9]{40}$"
            },
            value: { 
              type: "string", 
              title: "Value (wei)",
              description: "Transaction value in wei"
            },
            data: { 
              type: "string", 
              title: "Transaction Data",
              description: "Optional contract call data (0x...)"
            },
            chain: { 
              type: "string",
              title: "Blockchain Network",
              enum: ["ethereum", "base", "polygon", "bsc", "arbitrum", "optimism", "pulsechain"]
            }
          },
          required: ["from", "to", "chain"]
        },
        outputSchema: {
          type: "object",
          title: "Transaction Builder Response",
          additionalProperties: false,
          properties: {
            transaction: { type: "object", title: "Transaction Object" },
            gasEstimate: { type: "number", title: "Gas Estimate" },
            gasCostUSD: { type: "number", title: "Estimated Gas Cost USD" }
          }
        },
        pricing: { amount: 0.15, currency: "USD" },
        category: "utilities"
      },
      {
        id: "token_metadata",
        name: "Token Metadata Fetcher",
        description: "Get comprehensive token information (name, symbol, decimals, total supply, holders). Use when user asks 'token info', 'token details', 'what is this token', 'token info on Ethereum', or 'token info on Base'.",
        inputSchema: {
          type: "object",
          title: "Token Metadata Request",
          description: "Request comprehensive token information",
          additionalProperties: false,
          properties: {
            tokenAddress: { 
              type: "string",
              title: "Token Address",
              pattern: "^0x[a-fA-F0-9]{40}$"
            },
            chain: { 
              type: "string",
              title: "Blockchain Network",
              enum: ["ethereum", "base", "polygon", "bsc", "arbitrum", "optimism", "pulsechain"]
            }
          },
          required: ["tokenAddress", "chain"]
        },
        outputSchema: {
          type: "object",
          title: "Token Metadata Response",
          additionalProperties: false,
          properties: {
            name: { type: "string", title: "Token Name" },
            symbol: { type: "string", title: "Token Symbol" },
            decimals: { type: "number", title: "Token Decimals" },
            totalSupply: { type: "string", title: "Total Supply" },
            holders: { type: "number", title: "Holder Count" },
            verified: { type: "boolean", title: "Contract Verified" }
          }
        },
        pricing: { amount: 0.10, currency: "USD" },
        category: "utilities"
      },
      {
        id: "approval_manager",
        name: "Token Approval Manager",
        description: "Check and revoke token approvals for security. Use when user asks 'check approvals', 'revoke permissions', 'wallet security audit', 'check approvals on Ethereum', 'check approvals on Base', or 'security check'.",
        inputSchema: {
          type: "object",
          title: "Approval Manager Request",
          description: "Request token approval security audit",
          additionalProperties: false,
          properties: {
            walletAddress: { 
              type: "string",
              title: "Wallet Address",
              pattern: "^0x[a-fA-F0-9]{40}$"
            },
            chain: { 
              type: "string",
              title: "Blockchain Network",
              enum: ["ethereum", "base", "polygon", "bsc", "arbitrum", "optimism", "pulsechain"]
            }
          },
          required: ["walletAddress", "chain"]
        },
        outputSchema: {
          type: "object",
          title: "Approval Manager Response",
          additionalProperties: false,
          properties: {
            approvals: {
              type: "array",
              title: "Active Approvals",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  token: { type: "string", title: "Token Address" },
                  spender: { type: "string", title: "Spender Address" },
                  amount: { type: "string", title: "Approved Amount" },
                  riskLevel: { type: "string", title: "Risk Level", enum: ["low", "medium", "high"] }
                }
              }
            },
            revokeTransactions: { type: "array", title: "Revoke Transaction Data" }
          }
        },
        pricing: { amount: 0.50, currency: "USD" },
        category: "security"
      },
      {
        id: "batch_price_quote",
        name: "Batch DEX Quote",
        description: "Get best swap prices across all DEX aggregators. Use when user asks 'best swap price', 'compare DEX prices', 'cheapest route', 'best price on Ethereum', 'best price on Base', or 'swap quote'.",
        inputSchema: {
          type: "object",
          title: "Batch DEX Quote Request",
          description: "Request best swap prices across DEX aggregators",
          additionalProperties: false,
          properties: {
            tokenIn: { 
              type: "string",
              title: "Input Token Address",
              pattern: "^0x[a-fA-F0-9]{40}$"
            },
            tokenOut: { 
              type: "string",
              title: "Output Token Address",
              pattern: "^0x[a-fA-F0-9]{40}$"
            },
            amount: { 
              type: "string",
              title: "Input Amount",
              description: "Amount to swap (in token decimals)"
            },
            chain: { 
              type: "string",
              title: "Blockchain Network",
              enum: ["ethereum", "base", "polygon", "bsc", "arbitrum", "optimism", "pulsechain"]
            }
          },
          required: ["tokenIn", "tokenOut", "amount", "chain"]
        },
        outputSchema: {
          type: "object",
          title: "Batch DEX Quote Response",
          additionalProperties: false,
          properties: {
            quotes: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  dex: { type: "string", title: "DEX Name" },
                  amountOut: { type: "string", title: "Output Amount" },
                  priceImpact: { type: "number", title: "Price Impact %" },
                  gasEstimate: { type: "number", title: "Gas Estimate" }
                }
              }
            },
            bestQuote: { type: "object", title: "Best Quote" }
          }
        },
        pricing: { amount: 0.25, currency: "USD" },
        category: "trading"
      },
      {
        id: "portfolio_tracker",
        name: "Portfolio Analytics",
        description: "Complete portfolio analysis with P&L, allocation, and performance metrics. Use when user asks 'portfolio value', 'my holdings', 'investment performance', 'portfolio on Ethereum', 'portfolio on Base', or 'how am I doing'.",
        inputSchema: {
          type: "object",
          title: "Portfolio Analytics Request",
          description: "Request comprehensive portfolio analysis",
          additionalProperties: false,
          properties: {
            walletAddress: { 
              type: "string",
              title: "Wallet Address",
              pattern: "^0x[a-fA-F0-9]{40}$"
            },
            chains: { 
              type: "array", 
              title: "Target Chains",
              items: { 
                type: "string",
                enum: ["ethereum", "base", "polygon", "bsc", "arbitrum", "optimism", "pulsechain"]
              }
            }
          },
          required: ["walletAddress"]
        },
        outputSchema: {
          type: "object",
          title: "Portfolio Analytics Response",
          additionalProperties: false,
          properties: {
            totalValueUSD: { type: "number", title: "Total Portfolio Value USD" },
            profitLoss: { type: "number", title: "Total P&L USD" },
            allocation: { type: "array", title: "Asset Allocation" },
            topHoldings: { type: "array", title: "Top Holdings" },
            performance30d: { type: "number", title: "30-Day Performance %" }
          }
        },
        pricing: { amount: 0.50, currency: "USD" },
        category: "analytics"
      },
      {
        id: "instant_agent_wallet",
        name: "Instant Agent Wallet Creation",
        description: "Create a new wallet for AI agent with USDC funding. Use when agent needs 'create wallet', 'agent wallet', 'autonomous wallet', 'new wallet on Base', or 'setup wallet'.",
        inputSchema: {
          type: "object",
          title: "Agent Wallet Creation Request",
          description: "Request new wallet creation for AI agent",
          additionalProperties: false,
          properties: {
            fundingAmount: { 
              type: "number", 
              title: "Initial Funding Amount",
              description: "Initial USDC amount to fund wallet",
              minimum: 0
            },
            chain: { 
              type: "string", 
              title: "Blockchain Network",
              description: "Preferred chain (default: base)",
              enum: ["base", "ethereum", "polygon", "arbitrum", "optimism"],
              default: "base"
            }
          }
        },
        outputSchema: {
          type: "object",
          title: "Agent Wallet Creation Response",
          additionalProperties: false,
          properties: {
            walletAddress: { type: "string", title: "Wallet Address" },
            privateKeyEncrypted: { type: "string", title: "Encrypted Private Key" },
            balance: { type: "number", title: "Initial Balance USDC" },
            chain: { type: "string", title: "Blockchain Network" }
          }
        },
        pricing: { amount: 2.00, currency: "USD" },
        category: "utilities"
      },
      {
        id: "verified_agent_identity",
        name: "Agent Identity Verification",
        description: "Verify AI agent identity on-chain using ERC-8004. Use when agent needs 'verify identity', 'agent reputation', 'on-chain proof', 'prove identity', or 'verify on Base'.",
        inputSchema: {
          type: "object",
          title: "Agent Identity Verification Request",
          description: "Request on-chain identity verification for AI agent",
          additionalProperties: false,
          properties: {
            agentId: { 
              type: "string",
              title: "Agent Identifier",
              description: "Unique identifier for the AI agent"
            },
            metadata: { 
              type: "object", 
              title: "Agent Metadata",
              description: "Agent metadata to store on-chain (optional)"
            }
          },
          required: ["agentId"]
        },
        outputSchema: {
          type: "object",
          title: "Agent Identity Verification Response",
          additionalProperties: false,
          properties: {
            identityAddress: { type: "string", title: "Identity Contract Address" },
            verified: { type: "boolean", title: "Verification Status" },
            reputationScore: { type: "number", title: "On-Chain Reputation Score" },
            transactionHash: { type: "string", title: "Transaction Hash" }
          }
        },
        pricing: { amount: 5.00, currency: "USD" },
        category: "utilities"
      },
      {
        id: "cross_chain_bridge",
        name: "Cross-Chain Bridge Monitor",
        description: "Track bridge transactions and get best bridge rates. Use when user asks 'bridge tokens', 'move assets', 'cross-chain transfer', 'bridge from Ethereum to Base', 'bridge from Polygon to Arbitrum', or 'transfer between chains'.",
        inputSchema: {
          type: "object",
          title: "Cross-Chain Bridge Request",
          description: "Request bridge options for cross-chain transfers",
          additionalProperties: false,
          properties: {
            tokenAddress: { 
              type: "string",
              title: "Token Address",
              description: "Token to bridge (optional - leave empty for native token)",
              pattern: "^0x[a-fA-F0-9]{40}$"
            },
            fromChain: { 
              type: "string",
              title: "Source Chain",
              enum: ["ethereum", "base", "polygon", "bsc", "arbitrum", "optimism", "pulsechain"]
            },
            toChain: { 
              type: "string",
              title: "Destination Chain",
              enum: ["ethereum", "base", "polygon", "bsc", "arbitrum", "optimism", "pulsechain"]
            },
            amount: { 
              type: "string",
              title: "Amount to Bridge",
              description: "Amount to bridge (optional)"
            }
          },
          required: ["fromChain", "toChain"]
        },
        outputSchema: {
          type: "object",
          title: "Cross-Chain Bridge Response",
          additionalProperties: false,
          properties: {
            bridges: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  name: { type: "string", title: "Bridge Name" },
                  fee: { type: "number", title: "Bridge Fee %" },
                  estimatedTime: { type: "string", title: "Estimated Time" },
                  security: { type: "string", title: "Security Rating", enum: ["high", "medium", "low"] }
                }
              }
            },
            recommended: { type: "object", title: "Recommended Bridge" }
          }
        },
        pricing: { amount: 0.40, currency: "USD" },
        category: "utilities"
      },
      {
        id: "payment_processing",
        name: "Payment Processing Service",
        description: "Process Stripe, PayPal, and crypto payments with instant settlement. Use when user asks 'process payment', 'accept payment', 'settle transaction', or 'handle checkout'.",
        inputSchema: {
          type: "object",
          title: "Payment Processing Request",
          description: "Process a payment transaction",
          additionalProperties: false,
          properties: {
            amount: { 
              type: "number",
              title: "Payment Amount",
              description: "Amount to process"
            },
            currency: { 
              type: "string",
              title: "Currency",
              enum: ["USD", "EUR", "USDC", "USDT"]
            },
            paymentMethod: { 
              type: "string",
              title: "Payment Method",
              enum: ["stripe", "paypal", "crypto"]
            },
            metadata: { 
              type: "object",
              title: "Payment Metadata",
              description: "Optional payment metadata"
            }
          },
          required: ["amount", "currency", "paymentMethod"]
        },
        outputSchema: {
          type: "object",
          title: "Payment Processing Response",
          additionalProperties: false,
          properties: {
            transactionId: { type: "string", title: "Transaction ID" },
            status: { type: "string", title: "Payment Status", enum: ["pending", "completed", "failed"] },
            settlementTime: { type: "string", title: "Settlement Time Estimate" }
          }
        },
        pricing: { amount: 0.50, currency: "USD" },
        category: "payments"
      },
      {
        id: "compliance_consultation",
        name: "Compliance Consultation Service",
        description: "AI-powered KYC/AML compliance guidance and regulatory analysis. Use when user asks 'check compliance', 'KYC requirements', 'AML rules', or 'regulatory guidance'.",
        inputSchema: {
          type: "object",
          title: "Compliance Consultation Request",
          description: "Request compliance guidance",
          additionalProperties: false,
          properties: {
            jurisdiction: { 
              type: "string",
              title: "Jurisdiction",
              description: "Target jurisdiction (e.g., 'USA', 'EU', 'Singapore')"
            },
            transactionType: { 
              type: "string",
              title: "Transaction Type",
              description: "Type of transaction requiring compliance check"
            },
            amount: { 
              type: "number",
              title: "Transaction Amount",
              description: "Optional transaction amount for thresholds"
            }
          },
          required: ["jurisdiction", "transactionType"]
        },
        outputSchema: {
          type: "object",
          title: "Compliance Consultation Response",
          additionalProperties: false,
          properties: {
            compliant: { type: "boolean", title: "Compliance Status" },
            requirements: { type: "array", title: "Required Actions" },
            riskLevel: { type: "string", title: "Risk Assessment", enum: ["low", "medium", "high"] },
            recommendations: { type: "array", title: "Compliance Recommendations" }
          }
        },
        pricing: { amount: 5.00, currency: "USD" },
        category: "compliance"
      },
      {
        id: "smart_contract_audit",
        name: "Smart Contract Security Audit",
        description: "Deep security audit using Slither static analysis and vulnerability detection. Use when user asks 'audit contract', 'security review', 'check vulnerabilities', or 'analyze smart contract'.",
        inputSchema: {
          type: "object",
          title: "Smart Contract Audit Request",
          description: "Request comprehensive contract security audit",
          additionalProperties: false,
          properties: {
            contractAddress: { 
              type: "string",
              title: "Contract Address",
              description: "Smart contract address to audit",
              pattern: "^0x[a-fA-F0-9]{40}$"
            },
            chain: { 
              type: "string",
              title: "Blockchain Network",
              enum: ["ethereum", "base", "polygon", "bsc", "arbitrum", "optimism", "pulsechain"]
            },
            auditDepth: { 
              type: "string",
              title: "Audit Depth",
              enum: ["basic", "comprehensive", "expert"],
              default: "comprehensive"
            }
          },
          required: ["contractAddress", "chain"]
        },
        outputSchema: {
          type: "object",
          title: "Smart Contract Audit Response",
          additionalProperties: false,
          properties: {
            overallScore: { type: "number", title: "Security Score (0-100)" },
            vulnerabilities: { type: "array", title: "Detected Vulnerabilities" },
            gasOptimizations: { type: "array", title: "Gas Optimization Suggestions" },
            codeQuality: { type: "string", title: "Code Quality Assessment" },
            recommendation: { type: "string", title: "Final Recommendation", enum: ["safe", "caution", "dangerous"] }
          }
        },
        pricing: { amount: 10.00, currency: "USD" },
        category: "security"
      },
      // REAL ESTATE VERTICAL (3 services)
      {
        id: "property_valuation",
        name: "AI Property Valuation",
        description: "AI-powered property valuation using GPT-4 analysis. Use when user asks 'value my property', 'property appraisal', 'real estate value', 'home worth', or 'estimate property value'.",
        inputSchema: {
          type: "object",
          title: "Property Valuation Request",
          properties: {
            address: { type: "string", title: "Property Address" },
            propertyType: { type: "string", enum: ["residential", "commercial", "industrial", "land"], title: "Property Type" },
            squareFeet: { type: "number", title: "Square Footage" },
            bedrooms: { type: "number", title: "Bedrooms (optional)" },
            bathrooms: { type: "number", title: "Bathrooms (optional)" },
            yearBuilt: { type: "number", title: "Year Built (optional)" }
          },
          required: ["address", "propertyType", "squareFeet"]
        },
        outputSchema: {
          type: "object",
          properties: {
            estimatedValue: { type: "number", title: "Estimated Value (USD)" },
            confidenceScore: { type: "number", title: "Confidence (0-100)" },
            comparables: { type: "array", title: "Comparable Properties" },
            marketAnalysis: { type: "string", title: "Market Analysis" }
          }
        },
        pricing: { amount: SERVICE_PRICING_USD["property-valuation"], currency: "USD" },
        category: "real_estate"
      },
      {
        id: "lease_analysis",
        name: "Lease Agreement Analyzer",
        description: "AI analysis of lease terms and obligations. Use when user asks 'review lease', 'analyze rental agreement', 'lease terms review', or 'check lease contract'.",
        inputSchema: {
          type: "object",
          properties: {
            leaseText: { type: "string", title: "Lease Agreement Text" },
            analysisType: { type: "string", enum: ["comprehensive", "key-terms", "risks-only"], default: "comprehensive" }
          },
          required: ["leaseText"]
        },
        outputSchema: {
          type: "object",
          properties: {
            keyTerms: { type: "object", title: "Key Terms Summary" },
            redFlags: { type: "array", title: "Potential Issues" },
            obligations: { type: "object", title: "Tenant/Landlord Obligations" },
            recommendation: { type: "string", title: "AI Recommendation" }
          }
        },
        pricing: { amount: SERVICE_PRICING_USD["lease-analysis"], currency: "USD" },
        category: "real_estate"
      },
      {
        id: "construction_progress",
        name: "Construction Progress Tracker",
        description: "Track construction milestones with AI photo analysis. Use when user asks 'analyze construction photos', 'track building progress', 'construction status', or 'verify construction work'.",
        inputSchema: {
          type: "object",
          properties: {
            projectName: { type: "string", title: "Project Name" },
            phase: { type: "string", enum: ["foundation", "framing", "exterior", "interior", "finishing"], title: "Current Phase" },
            photos: { type: "array", items: { type: "string" }, title: "Photo URLs or Base64" },
            expectedCompletion: { type: "string", format: "date", title: "Expected Completion Date" }
          },
          required: ["projectName", "phase", "photos"]
        },
        outputSchema: {
          type: "object",
          properties: {
            completionEstimate: { type: "number", title: "% Complete" },
            milestones: { type: "array", title: "Completed Milestones" },
            issues: { type: "array", title: "Identified Issues" },
            progressReport: { type: "string", title: "AI Progress Report" }
          }
        },
        pricing: { amount: SERVICE_PRICING_USD["construction-progress"], currency: "USD" },
        category: "real_estate"
      },
      // BANKING/FINANCE VERTICAL (3 services)
      {
        id: "credit_risk_score",
        name: "Credit Risk Assessment",
        description: "AI credit risk scoring using financial data. Use when user asks 'credit risk', 'assess creditworthiness', 'loan risk analysis', or 'credit score evaluation'.",
        inputSchema: {
          type: "object",
          properties: {
            financialData: { type: "object", title: "Financial Information" },
            loanAmount: { type: "number", title: "Requested Loan Amount" },
            purpose: { type: "string", enum: ["personal", "business", "mortgage", "auto"], title: "Loan Purpose" }
          },
          required: ["financialData", "loanAmount"]
        },
        outputSchema: {
          type: "object",
          properties: {
            creditScore: { type: "number", title: "Risk Score (0-100)" },
            riskCategory: { type: "string", enum: ["low", "medium", "high"], title: "Risk Level" },
            factors: { type: "array", title: "Key Risk Factors" },
            recommendation: { type: "string", title: "Lending Recommendation" }
          }
        },
        pricing: { amount: SERVICE_PRICING_USD["credit-risk-score"], currency: "USD" },
        category: "banking"
      },
      {
        id: "fraud_detection",
        name: "Transaction Fraud Detection",
        description: "Real-time fraud pattern detection. Use when user asks 'check fraud', 'suspicious transaction', 'fraud analysis', or 'verify transaction'.",
        inputSchema: {
          type: "object",
          properties: {
            transaction: { type: "object", title: "Transaction Details" },
            userHistory: { type: "array", items: { type: "object" }, title: "Historical Transactions (optional)" }
          },
          required: ["transaction"]
        },
        outputSchema: {
          type: "object",
          properties: {
            fraudScore: { type: "number", title: "Fraud Risk (0-100)" },
            alerts: { type: "array", title: "Red Flags" },
            recommendation: { type: "string", enum: ["approve", "review", "decline"], title: "Action" }
          }
        },
        pricing: { amount: SERVICE_PRICING_USD["fraud-detection"], currency: "USD" },
        category: "banking"
      },
      {
        id: "compliance_check",
        name: "Regulatory Compliance Check",
        description: "AML/KYC compliance verification. Use when user asks 'compliance check', 'AML verification', 'KYC analysis', or 'regulatory review'.",
        inputSchema: {
          type: "object",
          properties: {
            entityData: { type: "object", title: "Entity Information" },
            checkTypes: { type: "array", items: { type: "string", enum: ["aml", "kyc", "sanctions", "pep"] }, title: "Compliance Checks" }
          },
          required: ["entityData", "checkTypes"]
        },
        outputSchema: {
          type: "object",
          properties: {
            complianceStatus: { type: "string", enum: ["pass", "review", "fail"], title: "Overall Status" },
            findings: { type: "array", title: "Compliance Findings" },
            riskLevel: { type: "string", enum: ["low", "medium", "high"], title: "Risk Level" }
          }
        },
        pricing: { amount: SERVICE_PRICING_USD["compliance-check"], currency: "USD" },
        category: "banking"
      },
      // TRADING/INVESTMENT VERTICAL (3 services)
      {
        id: "trading_signal",
        name: "AI Trading Signal Generator",
        description: "Generate trading signals using technical analysis. Use when user asks 'trading signal', 'should I buy/sell', 'trading recommendation', or 'market signal'.",
        inputSchema: {
          type: "object",
          properties: {
            symbol: { type: "string", title: "Token/Stock Symbol" },
            timeframe: { type: "string", enum: ["1h", "4h", "1d", "1w"], default: "1d", title: "Analysis Timeframe" },
            strategy: { type: "string", enum: ["momentum", "mean-reversion", "breakout", "trend-following"], default: "momentum" }
          },
          required: ["symbol"]
        },
        outputSchema: {
          type: "object",
          properties: {
            signal: { type: "string", enum: ["strong-buy", "buy", "hold", "sell", "strong-sell"], title: "Trading Signal" },
            confidence: { type: "number", title: "Confidence (0-100)" },
            entryPrice: { type: "number", title: "Suggested Entry" },
            targets: { type: "array", items: { type: "number" }, title: "Price Targets" },
            stopLoss: { type: "number", title: "Stop Loss" }
          }
        },
        pricing: { amount: SERVICE_PRICING_USD["trading-signal"], currency: "USD" },
        category: "trading"
      },
      {
        id: "portfolio_optimization",
        name: "Portfolio Optimizer",
        description: "AI portfolio allocation and rebalancing. Use when user asks 'optimize portfolio', 'rebalance assets', 'portfolio allocation', or 'diversification strategy'.",
        inputSchema: {
          type: "object",
          properties: {
            currentHoldings: { type: "array", items: { type: "object" }, title: "Current Holdings" },
            riskTolerance: { type: "string", enum: ["conservative", "moderate", "aggressive"], default: "moderate" },
            investmentGoal: { type: "string", title: "Investment Goal (optional)" }
          },
          required: ["currentHoldings", "riskTolerance"]
        },
        outputSchema: {
          type: "object",
          properties: {
            recommendations: { type: "array", title: "Rebalancing Recommendations" },
            targetAllocation: { type: "object", title: "Target Allocation %" },
            expectedReturn: { type: "number", title: "Expected Annual Return %" },
            riskMetrics: { type: "object", title: "Risk Analysis" }
          }
        },
        pricing: { amount: SERVICE_PRICING_USD["portfolio-optimization"], currency: "USD" },
        category: "trading"
      },
      {
        id: "sentiment_analysis",
        name: "Market Sentiment Analyzer",
        description: "Analyze market sentiment from social/news data. Use when user asks 'market sentiment', 'social sentiment', 'crypto news analysis', or 'sentiment score'.",
        inputSchema: {
          type: "object",
          properties: {
            symbol: { type: "string", title: "Asset Symbol" },
            sources: { type: "array", items: { type: "string", enum: ["twitter", "reddit", "news", "telegram"] }, default: ["twitter", "reddit"] }
          },
          required: ["symbol"]
        },
        outputSchema: {
          type: "object",
          properties: {
            sentimentScore: { type: "number", title: "Sentiment (-100 to +100)" },
            trend: { type: "string", enum: ["bullish", "neutral", "bearish"], title: "Overall Trend" },
            keyMentions: { type: "array", title: "Top Mentions" },
            volumeChange: { type: "number", title: "Mention Volume Change %" }
          }
        },
        pricing: { amount: SERVICE_PRICING_USD["sentiment-analysis"], currency: "USD" },
        category: "trading"
      },
      // MARKET INTELLIGENCE VERTICAL (3 services)
      {
        id: "arbitrage_scanner",
        name: "Cross-Exchange Arbitrage Scanner",
        description: "Identify arbitrage opportunities across chains/exchanges. Use when user asks 'arbitrage opportunities', 'price differences', 'cross-exchange arbitrage', or 'profit opportunities'.",
        inputSchema: {
          type: "object",
          properties: {
            tokens: { type: "array", items: { type: "string" }, title: "Tokens to Scan" },
            minProfit: { type: "number", default: 0.5, title: "Min Profit % Threshold" },
            chains: { type: "array", items: { type: "string" }, title: "Chains to Compare (optional)" }
          },
          required: ["tokens"]
        },
        outputSchema: {
          type: "object",
          properties: {
            opportunities: { type: "array", title: "Arbitrage Opportunities" },
            topOpportunity: { type: "object", title: "Best Opportunity" },
            totalOpportunities: { type: "number", title: "Total Found" }
          }
        },
        pricing: { amount: SERVICE_PRICING_USD["arbitrage-scanner"], currency: "USD" },
        category: "intelligence"
      },
      {
        id: "correlation_matrix",
        name: "Asset Correlation Matrix",
        description: "Correlation analysis between crypto assets. Use when user asks 'correlation analysis', 'asset correlation', 'price relationship', or 'correlated tokens'.",
        inputSchema: {
          type: "object",
          properties: {
            assets: { type: "array", items: { type: "string" }, title: "Assets to Analyze" },
            timeframe: { type: "string", enum: ["7d", "30d", "90d", "1y"], default: "30d", title: "Analysis Period" }
          },
          required: ["assets"]
        },
        outputSchema: {
          type: "object",
          properties: {
            correlationMatrix: { type: "object", title: "Correlation Matrix" },
            strongCorrelations: { type: "array", title: "Strong Correlations (>0.7)" },
            diversificationScore: { type: "number", title: "Portfolio Diversification Score" }
          }
        },
        pricing: { amount: SERVICE_PRICING_USD["correlation-matrix"], currency: "USD" },
        category: "intelligence"
      },
      {
        id: "risk_metrics",
        name: "Portfolio Risk Metrics",
        description: "Comprehensive risk analysis: VaR, Sharpe, drawdown. Use when user asks 'portfolio risk', 'risk metrics', 'value at risk', 'volatility analysis', or 'risk assessment'.",
        inputSchema: {
          type: "object",
          properties: {
            portfolio: { type: "array", items: { type: "object" }, title: "Portfolio Holdings" },
            timeHorizon: { type: "string", enum: ["1m", "3m", "6m", "1y"], default: "1m", title: "Time Horizon" }
          },
          required: ["portfolio"]
        },
        outputSchema: {
          type: "object",
          properties: {
            valueAtRisk: { type: "number", title: "Value at Risk (95%)" },
            sharpeRatio: { type: "number", title: "Sharpe Ratio" },
            maxDrawdown: { type: "number", title: "Max Drawdown %" },
            volatility: { type: "number", title: "Annualized Volatility %" },
            riskGrade: { type: "string", enum: ["A", "B", "C", "D", "F"], title: "Overall Risk Grade" }
          }
        },
        pricing: { amount: SERVICE_PRICING_USD["risk-metrics"], currency: "USD" },
        category: "intelligence"
      },
      // TRADITIONAL MARKETS VERTICAL (2 services)
      {
        id: "stock_sentiment",
        name: "Stock Market Sentiment Analysis",
        description: "AI-powered stock market sentiment analysis with news sentiment, technical indicators, and institutional activity. Use when user asks 'stock sentiment', 'market sentiment', 'stock news analysis', 'equity sentiment', or 'stock market outlook'.",
        inputSchema: {
          type: "object",
          title: "Stock Sentiment Request",
          description: "Request stock market sentiment analysis",
          additionalProperties: false,
          properties: {
            symbol: { 
              type: "string", 
              title: "Stock Symbol",
              description: "Stock ticker symbol (e.g., AAPL, GOOGL, MSFT)"
            }
          },
          required: ["symbol"]
        },
        outputSchema: {
          type: "object",
          title: "Stock Sentiment Response",
          additionalProperties: false,
          properties: {
            symbol: { type: "string", title: "Stock Symbol" },
            overallSentiment: { type: "string", enum: ["bullish", "bearish", "neutral"], title: "Overall Sentiment" },
            sentimentScore: { type: "number", title: "Sentiment Score (-1 to 1)" },
            newsAnalysis: { type: "object", title: "News Sentiment Analysis" },
            technicalIndicators: { type: "object", title: "Technical Indicators" },
            recommendation: { type: "string", title: "AI Recommendation" }
          }
        },
        pricing: { amount: SERVICE_PRICING_USD["stock-sentiment"], currency: "USD" },
        category: "traditional-markets"
      },
      {
        id: "forex_sentiment",
        name: "Forex Sentiment Analysis",
        description: "AI-powered forex/currency sentiment analysis with central bank policy, economic indicators, and cross-rate analysis. Use when user asks 'forex sentiment', 'currency outlook', 'FX analysis', 'exchange rate sentiment', or 'currency pair analysis'.",
        inputSchema: {
          type: "object",
          title: "Forex Sentiment Request",
          description: "Request forex market sentiment analysis",
          additionalProperties: false,
          properties: {
            pair: { 
              type: "string", 
              title: "Currency Pair",
              description: "Forex pair (e.g., EUR/USD, GBP/JPY, USD/CHF)"
            }
          },
          required: ["pair"]
        },
        outputSchema: {
          type: "object",
          title: "Forex Sentiment Response",
          additionalProperties: false,
          properties: {
            pair: { type: "string", title: "Currency Pair" },
            overallSentiment: { type: "string", enum: ["bullish", "bearish", "neutral"], title: "Overall Sentiment" },
            sentimentScore: { type: "number", title: "Sentiment Score (-1 to 1)" },
            centralBankAnalysis: { type: "object", title: "Central Bank Policy Analysis" },
            economicIndicators: { type: "object", title: "Economic Indicators" },
            recommendation: { type: "string", title: "AI Recommendation" }
          }
        },
        pricing: { amount: SERVICE_PRICING_USD["forex-sentiment"], currency: "USD" },
        category: "traditional-markets"
      },
      // Satellite Data Services (6 services) - NASA Earthdata + ESA Copernicus
      {
        id: "fire_alerts",
        name: "Fire Alert Detection",
        description: "Real-time active fire detection from NASA FIRMS satellite data. Use when user asks 'active fires', 'fire hotspots', 'wildfire detection', 'FIRMS data', or 'fire alerts near me'.",
        inputSchema: {
          type: "object",
          title: "Fire Alert Request",
          additionalProperties: false,
          properties: {
            lat: { type: "number", title: "Latitude", description: "Latitude coordinate" },
            lon: { type: "number", title: "Longitude", description: "Longitude coordinate" },
            radius: { type: "number", title: "Search Radius (km)", description: "Search radius in kilometers" }
          },
          required: ["lat", "lon"]
        },
        outputSchema: {
          type: "object",
          title: "Fire Alert Response",
          additionalProperties: false,
          properties: {
            fires: { type: "array", title: "Active Fires" },
            count: { type: "number", title: "Fire Count" },
            source: { type: "string", title: "Data Source" }
          }
        },
        pricing: { amount: SERVICE_PRICING_USD["fire-alerts"], currency: "USD" },
        category: "satellite-data"
      },
      {
        id: "weather_imagery",
        name: "Satellite Weather Imagery",
        description: "High-resolution weather satellite imagery from NASA GIBS. Use when user asks 'satellite weather', 'cloud cover', 'weather imagery', 'GIBS data', or 'atmospheric conditions'.",
        inputSchema: {
          type: "object",
          title: "Weather Imagery Request",
          additionalProperties: false,
          properties: {
            lat: { type: "number", title: "Latitude" },
            lon: { type: "number", title: "Longitude" },
            layer: { type: "string", title: "Imagery Layer", description: "Specific layer type" }
          },
          required: ["lat", "lon"]
        },
        outputSchema: {
          type: "object",
          title: "Weather Imagery Response",
          additionalProperties: false,
          properties: {
            imagery: { type: "object", title: "Imagery Data" },
            timestamp: { type: "string", title: "Data Timestamp" },
            source: { type: "string", title: "Data Source" }
          }
        },
        pricing: { amount: SERVICE_PRICING_USD["weather-imagery"], currency: "USD" },
        category: "satellite-data"
      },
      {
        id: "vegetation_health",
        name: "Vegetation Health Analysis",
        description: "NDVI vegetation health indices from NASA MODIS and ESA Sentinel-2. Use when user asks 'vegetation health', 'NDVI', 'crop monitoring', 'forest health', or 'agriculture satellite data'.",
        inputSchema: {
          type: "object",
          title: "Vegetation Health Request",
          additionalProperties: false,
          properties: {
            lat: { type: "number", title: "Latitude" },
            lon: { type: "number", title: "Longitude" },
            area_km2: { type: "number", title: "Area (km²)", description: "Area in square kilometers" }
          },
          required: ["lat", "lon"]
        },
        outputSchema: {
          type: "object",
          title: "Vegetation Health Response",
          additionalProperties: false,
          properties: {
            ndvi: { type: "number", title: "NDVI Value" },
            healthStatus: { type: "string", title: "Health Status" },
            source: { type: "string", title: "Data Source" }
          }
        },
        pricing: { amount: SERVICE_PRICING_USD["vegetation"], currency: "USD" },
        category: "satellite-data"
      },
      {
        id: "flood_detection",
        name: "Flood Detection",
        description: "ESA Sentinel-1 SAR-based flood and water body detection. Use when user asks 'flood monitoring', 'flood detection', 'water extent', 'flood mapping', or 'disaster response satellite'.",
        inputSchema: {
          type: "object",
          title: "Flood Detection Request",
          additionalProperties: false,
          properties: {
            lat: { type: "number", title: "Latitude" },
            lon: { type: "number", title: "Longitude" },
            radius: { type: "number", title: "Detection Radius (km)" }
          },
          required: ["lat", "lon"]
        },
        outputSchema: {
          type: "object",
          title: "Flood Detection Response",
          additionalProperties: false,
          properties: {
            floodExtent: { type: "object", title: "Flood Extent Data" },
            riskLevel: { type: "string", title: "Risk Level" },
            source: { type: "string", title: "Data Source" }
          }
        },
        pricing: { amount: SERVICE_PRICING_USD["flood-detection"], currency: "USD" },
        category: "satellite-data"
      },
      {
        id: "air_quality",
        name: "Air Quality Analysis",
        description: "ESA Sentinel-5P TROPOMI air quality data including NO2, SO2, CO, and aerosols. Use when user asks 'air quality', 'pollution levels', 'air pollution satellite', 'TROPOMI data', or 'atmospheric quality'.",
        inputSchema: {
          type: "object",
          title: "Air Quality Request",
          additionalProperties: false,
          properties: {
            lat: { type: "number", title: "Latitude" },
            lon: { type: "number", title: "Longitude" },
            pollutant: { type: "string", title: "Pollutant Type", description: "Specific pollutant (NO2, SO2, CO, etc.)" }
          },
          required: ["lat", "lon"]
        },
        outputSchema: {
          type: "object",
          title: "Air Quality Response",
          additionalProperties: false,
          properties: {
            aqi: { type: "number", title: "Air Quality Index" },
            pollutants: { type: "object", title: "Pollutant Levels" },
            source: { type: "string", title: "Data Source" }
          }
        },
        pricing: { amount: SERVICE_PRICING_USD["air-quality"], currency: "USD" },
        category: "satellite-data"
      },
      {
        id: "land_use",
        name: "Land Use Classification",
        description: "NASA Landsat + ESA Sentinel-2 land use classification. Use when user asks 'land use', 'land classification', 'urban detection', 'forest cover', or 'land cover satellite'.",
        inputSchema: {
          type: "object",
          title: "Land Use Request",
          additionalProperties: false,
          properties: {
            lat: { type: "number", title: "Latitude" },
            lon: { type: "number", title: "Longitude" },
            area_km2: { type: "number", title: "Area (km²)" }
          },
          required: ["lat", "lon"]
        },
        outputSchema: {
          type: "object",
          title: "Land Use Response",
          additionalProperties: false,
          properties: {
            classification: { type: "object", title: "Land Classification" },
            landTypes: { type: "array", title: "Land Types" },
            source: { type: "string", title: "Data Source" }
          }
        },
        pricing: { amount: SERVICE_PRICING_USD["land-use"], currency: "USD" },
        category: "satellite-data"
      },
      {
        id: "kalshi_markets",
        name: "Kalshi Prediction Markets",
        description: "Get active markets from Kalshi, the CFTC-regulated prediction exchange. Use when user asks 'prediction markets', 'Kalshi markets', 'what events can I bet on', 'CFTC regulated markets', or 'election markets'.",
        inputSchema: {
          type: "object",
          title: "Kalshi Markets Request",
          description: "Request active prediction markets from Kalshi",
          additionalProperties: false,
          properties: {
            limit: { type: "number", title: "Result Limit", description: "Number of markets to return (max 50)", minimum: 1, maximum: 50, default: 10 },
            status: { type: "string", title: "Market Status", enum: ["open", "closed", "settled"], default: "open" },
            category: { type: "string", title: "Category", description: "Filter by series ticker (e.g., 'KXBTC' for Bitcoin)" }
          }
        },
        outputSchema: {
          type: "object",
          title: "Kalshi Markets Response",
          additionalProperties: false,
          properties: {
            markets: { type: "array", title: "Active Markets", items: { type: "object", properties: { ticker: { type: "string" }, title: { type: "string" }, yesPrice: { type: "number" }, noPrice: { type: "number" }, volume: { type: "number" } } } }
          }
        },
        pricing: { amount: 0.25, currency: "USD" },
        category: "prediction-markets"
      },
      {
        id: "kalshi_odds",
        name: "Kalshi Odds Lookup",
        description: "Get current odds, orderbook depth, and event details for a specific Kalshi market. Use when user asks 'Kalshi odds', 'prediction odds', 'market probability', 'event odds', or 'orderbook depth'.",
        inputSchema: {
          type: "object",
          title: "Kalshi Odds Request",
          description: "Request odds for a specific Kalshi market or event",
          additionalProperties: false,
          properties: {
            ticker: { type: "string", title: "Market Ticker", description: "Kalshi market ticker (e.g., 'KXBTC-26FEB14-B55500')" },
            eventTicker: { type: "string", title: "Event Ticker", description: "Kalshi event ticker (e.g., 'KXBTC-26FEB14')" }
          }
        },
        outputSchema: {
          type: "object",
          title: "Kalshi Odds Response",
          additionalProperties: false,
          properties: {
            market: { type: "object", title: "Market Details" },
            orderbook: { type: "object", title: "Orderbook Depth" }
          }
        },
        pricing: { amount: 0.50, currency: "USD" },
        category: "prediction-markets"
      },
      {
        id: "kalshi_search",
        name: "Kalshi Market Search",
        description: "Search Kalshi prediction markets by keyword with relevance scoring. Use when user asks 'search predictions', 'find Kalshi market', 'prediction about bitcoin', 'search election markets', or 'find prediction market'.",
        inputSchema: {
          type: "object",
          title: "Kalshi Search Request",
          description: "Search Kalshi markets by keyword",
          additionalProperties: false,
          properties: {
            query: { type: "string", title: "Search Query", description: "Keywords to search for" },
            limit: { type: "number", title: "Result Limit", minimum: 1, maximum: 20, default: 10 },
            status: { type: "string", title: "Market Status", enum: ["open", "closed", "settled"], default: "open" }
          },
          required: ["query"]
        },
        outputSchema: {
          type: "object",
          title: "Kalshi Search Response",
          additionalProperties: false,
          properties: {
            results: { type: "array", title: "Matching Markets", items: { type: "object", properties: { ticker: { type: "string" }, title: { type: "string" }, relevanceScore: { type: "number" } } } }
          }
        },
        pricing: { amount: 0.25, currency: "USD" },
        category: "prediction-markets"
      },
      // Polymarket Services
      {
        id: "polymarket_events",
        name: "Polymarket Events",
        description: "Browse active Polymarket prediction market events with volume and liquidity. Use when user asks 'Polymarket events', 'active prediction markets', 'Polymarket listings', or 'open prediction markets'.",
        inputSchema: {
          type: "object",
          title: "Polymarket Events Request",
          additionalProperties: false,
          properties: {
            limit: { type: "number", title: "Result Limit", minimum: 1, maximum: 50, default: 20 },
            active: { type: "boolean", title: "Active Only", default: true }
          }
        },
        outputSchema: {
          type: "object",
          title: "Polymarket Events Response",
          additionalProperties: false,
          properties: {
            events: { type: "array", title: "Events", items: { type: "object", properties: { slug: { type: "string" }, title: { type: "string" }, volume24h: { type: "number" } } } }
          }
        },
        pricing: { amount: 0.10, currency: "USD" },
        category: "prediction-markets"
      },
      {
        id: "polymarket_odds",
        name: "Polymarket Odds",
        description: "Real-time odds and orderbook for a specific Polymarket market. Use when user asks 'Polymarket odds', 'Polymarket probability', 'Polymarket prices', or 'prediction market odds'.",
        inputSchema: {
          type: "object",
          title: "Polymarket Odds Request",
          additionalProperties: false,
          properties: {
            marketSlug: { type: "string", title: "Market Slug" }
          },
          required: ["marketSlug"]
        },
        outputSchema: {
          type: "object",
          title: "Polymarket Odds Response",
          additionalProperties: false,
          properties: {
            market: { type: "object", title: "Market Details" },
            outcomes: { type: "array", title: "Outcomes with Prices", items: { type: "object", properties: { outcome: { type: "string" }, price: { type: "number" } } } }
          }
        },
        pricing: { amount: 0.25, currency: "USD" },
        category: "prediction-markets"
      },
      {
        id: "polymarket_search",
        name: "Polymarket Market Search",
        description: "Search Polymarket prediction markets by keyword. Use when user asks 'search Polymarket', 'find Polymarket market', 'Polymarket bitcoin', or 'Polymarket election'.",
        inputSchema: {
          type: "object",
          title: "Polymarket Search Request",
          additionalProperties: false,
          properties: {
            query: { type: "string", title: "Search Query" },
            limit: { type: "number", title: "Result Limit", minimum: 1, maximum: 20, default: 10 }
          },
          required: ["query"]
        },
        outputSchema: {
          type: "object",
          title: "Polymarket Search Response",
          additionalProperties: false,
          properties: {
            results: { type: "array", items: { type: "object", properties: { slug: { type: "string" }, title: { type: "string" }, volume: { type: "number" } } } }
          }
        },
        pricing: { amount: 0.25, currency: "USD" },
        category: "prediction-markets"
      },
      // AI & Inference Services
      {
        id: "ai_inference",
        name: "AI Inference Gateway",
        description: "Pay-per-call LLM inference via GPT-4o-mini and GPT-4o. Use when user asks 'AI inference', 'LLM call', 'GPT-4o', 'cheap AI API', or 'pay-per-call AI'. $0.05 per request — lowest cost AI gateway.",
        inputSchema: {
          type: "object",
          title: "AI Inference Request",
          additionalProperties: false,
          properties: {
            prompt: { type: "string", title: "User Prompt" },
            model: { type: "string", title: "Model", enum: ["gpt-4o-mini", "gpt-4o"], default: "gpt-4o-mini" },
            maxTokens: { type: "number", title: "Max Tokens", minimum: 1, maximum: 4096, default: 512 }
          },
          required: ["prompt"]
        },
        outputSchema: {
          type: "object",
          title: "AI Inference Response",
          additionalProperties: false,
          properties: {
            response: { type: "string", title: "Model Response" },
            model: { type: "string", title: "Model Used" },
            tokensUsed: { type: "number", title: "Tokens Consumed" }
          }
        },
        pricing: { amount: 0.05, currency: "USD" },
        category: "ai"
      },
      // IoT & DePIN Services
      {
        id: "iot_sensor_reading",
        name: "IoT Sensor Reading",
        description: "Retrieve real-time sensor data from registered IoT devices. Use when user asks 'IoT sensor data', 'device reading', 'sensor telemetry', or 'device data'. Part of the DePIN payment infrastructure.",
        inputSchema: {
          type: "object",
          title: "IoT Sensor Request",
          additionalProperties: false,
          properties: {
            deviceId: { type: "string", title: "Device ID" },
            sensorType: { type: "string", title: "Sensor Type", description: "e.g., temperature, humidity, pressure" }
          },
          required: ["deviceId"]
        },
        outputSchema: {
          type: "object",
          title: "IoT Sensor Response",
          additionalProperties: false,
          properties: {
            deviceId: { type: "string" },
            readings: { type: "array", items: { type: "object", properties: { sensor: { type: "string" }, value: { type: "number" }, unit: { type: "string" }, timestamp: { type: "number" } } } }
          }
        },
        pricing: { amount: 0.05, currency: "USD" },
        category: "iot-depin"
      },
      {
        id: "iot_device_stream",
        name: "IoT Device Stream",
        description: "Stream time-series data from IoT devices over a specified window. Use when user asks 'device stream', 'IoT time series', 'sensor history', or 'device data stream'.",
        inputSchema: {
          type: "object",
          title: "IoT Stream Request",
          additionalProperties: false,
          properties: {
            deviceId: { type: "string", title: "Device ID" },
            from: { type: "number", title: "Start Timestamp (Unix)" },
            to: { type: "number", title: "End Timestamp (Unix)" }
          },
          required: ["deviceId"]
        },
        outputSchema: {
          type: "object",
          title: "IoT Stream Response",
          additionalProperties: false,
          properties: {
            deviceId: { type: "string" },
            dataPoints: { type: "array", items: { type: "object", properties: { timestamp: { type: "number" }, value: { type: "number" } } } }
          }
        },
        pricing: { amount: 0.10, currency: "USD" },
        category: "iot-depin"
      },
      {
        id: "iot_bulk_data",
        name: "IoT Bulk Data Export",
        description: "Export bulk sensor data from multiple IoT devices in a single call. Use when user asks 'IoT bulk data', 'batch device data', 'export sensor data', or 'fleet data export'.",
        inputSchema: {
          type: "object",
          title: "IoT Bulk Data Request",
          additionalProperties: false,
          properties: {
            deviceIds: { type: "array", items: { type: "string" }, title: "Device IDs" },
            from: { type: "number", title: "Start Timestamp (Unix)" },
            to: { type: "number", title: "End Timestamp (Unix)" }
          },
          required: ["deviceIds"]
        },
        outputSchema: {
          type: "object",
          title: "IoT Bulk Data Response",
          additionalProperties: false,
          properties: {
            devices: { type: "array", items: { type: "object", properties: { deviceId: { type: "string" }, readings: { type: "array" } } } }
          }
        },
        pricing: { amount: 0.25, currency: "USD" },
        category: "iot-depin"
      },
      {
        id: "fleet_telematics",
        name: "Fleet Telematics",
        description: "Real-time fleet telematics data including GPS, speed, fuel, and diagnostics for vehicle fleets. Use when user asks 'fleet telematics', 'vehicle tracking', 'GPS fleet', or 'fleet diagnostics'.",
        inputSchema: {
          type: "object",
          title: "Fleet Telematics Request",
          additionalProperties: false,
          properties: {
            fleetId: { type: "string", title: "Fleet ID" },
            vehicleId: { type: "string", title: "Vehicle ID (optional)" }
          },
          required: ["fleetId"]
        },
        outputSchema: {
          type: "object",
          title: "Fleet Telematics Response",
          additionalProperties: false,
          properties: {
            vehicles: { type: "array", items: { type: "object", properties: { id: { type: "string" }, lat: { type: "number" }, lon: { type: "number" }, speed_kmh: { type: "number" }, fuel_pct: { type: "number" } } } }
          }
        },
        pricing: { amount: 0.10, currency: "USD" },
        category: "iot-depin"
      },
      {
        id: "weather_station_data",
        name: "Weather Station Data",
        description: "Ground-truth weather observations from IoT weather stations. Use when user asks 'weather station', 'ground weather data', 'IoT weather', or 'local weather observation'.",
        inputSchema: {
          type: "object",
          title: "Weather Station Request",
          additionalProperties: false,
          properties: {
            stationId: { type: "string", title: "Station ID" },
            lat: { type: "number", title: "Latitude (for nearest-station lookup)" },
            lon: { type: "number", title: "Longitude (for nearest-station lookup)" }
          }
        },
        outputSchema: {
          type: "object",
          title: "Weather Station Response",
          additionalProperties: false,
          properties: {
            stationId: { type: "string" },
            temperature_c: { type: "number" },
            humidity_pct: { type: "number" },
            pressure_hpa: { type: "number" },
            wind_speed_ms: { type: "number" },
            timestamp: { type: "number" }
          }
        },
        pricing: { amount: 0.05, currency: "USD" },
        category: "iot-depin"
      },
      // SDK & Wallet Services
      {
        id: "sdk_payments_evm",
        name: "EVM Agent Payments SDK",
        description: "Download and configure the @coinrailz/agent-payments NPM package for EVM chains. Enables x402 payments in Node.js, Python, and browser environments. Use when user asks 'EVM SDK', 'x402 SDK', or 'agent payments package'.",
        inputSchema: { type: "object", additionalProperties: false, properties: { framework: { type: "string", enum: ["nodejs", "python", "browser"], default: "nodejs" } } },
        outputSchema: { type: "object", additionalProperties: false, properties: { installCommand: { type: "string" }, quickstart: { type: "string" }, docsUrl: { type: "string" } } },
        pricing: { amount: 0.00, currency: "USD" },
        category: "sdk"
      },
      {
        id: "sdk_payments_solana",
        name: "Solana Agent Payments SDK",
        description: "Download and configure the @coinrailz/agent-payments-solana NPM package for Solana. Use when user asks 'Solana SDK', 'Solana x402', or 'Solana agent payments'.",
        inputSchema: { type: "object", additionalProperties: false, properties: { framework: { type: "string", enum: ["nodejs", "python"], default: "nodejs" } } },
        outputSchema: { type: "object", additionalProperties: false, properties: { installCommand: { type: "string" }, quickstart: { type: "string" }, docsUrl: { type: "string" } } },
        pricing: { amount: 0.00, currency: "USD" },
        category: "sdk"
      },
      {
        id: "seamless_chain_bridge",
        name: "Seamless Cross-Chain Bridge",
        description: "Route a token transfer across chains using DEX aggregation and bridging. Use when user asks 'bridge tokens', 'cross-chain transfer', 'move ETH to Base', or 'chain bridge'.",
        inputSchema: {
          type: "object",
          title: "Bridge Request",
          additionalProperties: false,
          properties: {
            fromChain: { type: "string", title: "Source Chain" },
            toChain: { type: "string", title: "Destination Chain" },
            token: { type: "string", title: "Token Symbol or Address" },
            amount: { type: "string", title: "Amount" },
            recipient: { type: "string", title: "Recipient Address" }
          },
          required: ["fromChain", "toChain", "token", "amount", "recipient"]
        },
        outputSchema: {
          type: "object",
          additionalProperties: false,
          properties: {
            bridgeTxHash: { type: "string" },
            estimatedArrival: { type: "number" },
            bridgeFee: { type: "string" }
          }
        },
        pricing: { amount: 0.50, currency: "USD" },
        category: "defi"
      },
      {
        id: "agent_create_wallet",
        name: "Agent Wallet Creation",
        description: "Provision a new non-custodial wallet for an AI agent via Coinbase CDP. Returns wallet address and export format. Use when user asks 'create wallet', 'agent wallet', or 'provision wallet'.",
        inputSchema: {
          type: "object",
          additionalProperties: false,
          properties: {
            agentId: { type: "string", title: "Agent ID" },
            chain: { type: "string", title: "Chain", enum: ["base", "ethereum", "solana"], default: "base" }
          }
        },
        outputSchema: {
          type: "object",
          additionalProperties: false,
          properties: {
            walletAddress: { type: "string" },
            chain: { type: "string" },
            createdAt: { type: "number" }
          }
        },
        pricing: { amount: 0.00, currency: "USD" },
        category: "wallet"
      },
      {
        id: "solana_yield_finder",
        name: "Solana Yield Finder",
        description: "Discover top yield opportunities on Solana including staking, liquid staking, and DeFi protocols. Use when user asks 'Solana yield', 'Solana staking APY', 'best SOL yield', or 'Solana DeFi returns'.",
        inputSchema: {
          type: "object",
          additionalProperties: false,
          properties: {
            minApy: { type: "number", title: "Minimum APY %", default: 0 },
            protocol: { type: "string", title: "Protocol (optional)", description: "e.g., marinade, jito, raydium" }
          }
        },
        outputSchema: {
          type: "object",
          additionalProperties: false,
          properties: {
            opportunities: { type: "array", items: { type: "object", properties: { protocol: { type: "string" }, apy: { type: "number" }, tvl: { type: "number" }, risk: { type: "string" } } } }
          }
        },
        pricing: { amount: 0.10, currency: "USD" },
        category: "solana"
      },
      {
        id: "ping",
        name: "Echo / Ping",
        description: "Health check and latency test endpoint. Returns echo of input with server timestamp. Use as the cheapest first call to verify connectivity. $0.05.",
        inputSchema: {
          type: "object",
          additionalProperties: false,
          properties: {
            message: { type: "string", title: "Message to echo", default: "ping" }
          }
        },
        outputSchema: {
          type: "object",
          additionalProperties: false,
          properties: {
            echo: { type: "string" },
            serverTimestamp: { type: "number" },
            latencyMs: { type: "number" }
          }
        },
        pricing: { amount: 0.05, currency: "USD" },
        category: "utilities"
      },
      // USDC Yield Vault — non-custodial ERC-4626, auto-routes to highest APY on Base
      {
        id: "base-usdc-yield-vault",
        name: "USDC Yield Vault (Base) — ERC-4626",
        description: "Deposit USDC and earn auto-optimized yield on Base. ERC-4626 vault auto-routes to the highest APY protocol (currently Aave v3, 3.18% gross / 2.70% net after 15% performance fee). 0.5% entry fee, 0% exit fee. Rebalances every 24h. Non-custodial — emergencyWithdraw() always works regardless of vault state. Vault: 0xb7697bf34f1566dd3d19792e12c366e396816736",
        tags: ["yield", "usdc", "defi", "base", "erc4626", "aave", "morpho", "compound", "vault", "interest"],
        vault: {
          address:    (process.env.YIELD_VAULT_ADDRESS ?? 'deploying-soon'),
          standard:   "ERC-4626",
          shareToken: "crUSDC",
          chainId:    8453,
          asset:      "USDC",
          assetAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          basescan:   `https://basescan.org/address/${process.env.YIELD_VAULT_ADDRESS ?? 'deploying-soon'}`
        },
        endpoints: {
          rates:     `${baseUrl}/api/yield/rates`,
          stats:     `${baseUrl}/api/yield/stats`,
          depositTx: `${baseUrl}/api/yield/deposit-tx?preset=100&recipient={wallet}`,
          permitTx:  `${baseUrl}/api/yield/deposit-tx?mode=permit&preset=100&recipient={wallet}`,
          redeemTx:  `${baseUrl}/api/yield/redeem-tx?wallet={wallet}`,
          position:  `${baseUrl}/api/yield/position/{wallet}`,
          contract:  `${baseUrl}/api/yield/contract`,
          manifest:  `${baseUrl}/api/yield/manifest`,
          portal:    `${baseUrl}/yield-portal`
        },
        agentkit: {
          package: "coinrailz-agentkit",
          install: "npm install coinrailz-agentkit",
          usage:   "new CoinRailzYieldActionProvider() — drop into AgentKit.from({ actionProviders: [...] })",
          actions: ["coinrailz_yield_deposit","coinrailz_yield_deposit_permit","coinrailz_yield_redeem","coinrailz_yield_check_position","coinrailz_yield_get_rates","coinrailz_yield_get_contract_info"],
          npmUrl:  "https://www.npmjs.com/package/coinrailz-agentkit"
        },
        howToDeposit: [
          "PATH A — Coinbase AgentKit (recommended, 0 blockchain code): npm install coinrailz-agentkit → add new CoinRailzYieldActionProvider() to AgentKit.from(). Your agent can now deposit, redeem, and check positions via natural language. 6 actions available.",
          "PATH B — REST pre-built calldata (any HTTP agent): 1. GET /api/yield/deposit-tx?preset=100&recipient=0xYOUR_WALLET (returns 2 ready-to-sign transactions). 2. Broadcast tx[0] (USDC approve). 3. Wait confirmed. 4. Broadcast tx[1] (ERC-4626 deposit). Receive crUSDC yield-bearing shares.",
          "PATH C — Permit 1-tx (saves ~50% gas, needs signTypedData): GET /api/yield/deposit-tx?mode=permit&preset=100&recipient=0xYOUR_WALLET → sign EIP-712 typed data → call depositWithPermit in 1 on-chain tx.",
          "WITHDRAW (1 tx, 0% exit fee): GET /api/yield/redeem-tx?wallet=0xYOUR_WALLET → broadcast the single step tx. Receive USDC principal + accrued yield.",
          "CHECK: GET /api/yield/position/0xYOUR_WALLET → live shares, USD value, net yield earned, protocol allocation breakdown."
        ],
        inputModes: ["application/json"],
        outputModes: ["application/json"],
        pricing: { amount: 0, currency: "USD", note: "Free to query. Entry fee 0.5% on deposit, 15% performance fee on yield only. No API key required." },
        category: "yield"
      }
    ],
    
    // Error schemas for A2A v0.3 compliance
    errors: {
      PaymentRequired: {
        code: "PAYMENT_REQUIRED",
        httpStatus: 402,
        description: "x402 payment required to access this service",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            error: { type: "string", title: "Error Message" },
            code: { type: "string", title: "Error Code" },
            price_usd: { type: "number", title: "Service Price USD" },
            payment_address: { type: "string", title: "Payment Wallet Address" },
            network: { type: "string", title: "Payment Network", enum: ["base", "ethereum", "polygon", "arbitrum", "optimism"] },
            currency: { type: "string", title: "Payment Currency", enum: ["USDC", "USDT"] }
          },
          required: ["error", "code", "price_usd", "payment_address", "network", "currency"]
        }
      },
      InvalidRequest: {
        code: "INVALID_REQUEST",
        httpStatus: 400,
        description: "Request validation failed",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            error: { type: "string", title: "Error Message" },
            code: { type: "string", title: "Error Code" },
            details: { 
              type: "array", 
              title: "Validation Errors",
              items: {
                type: "object",
                properties: {
                  field: { type: "string" },
                  message: { type: "string" }
                }
              }
            }
          },
          required: ["error", "code"]
        }
      },
      ServiceError: {
        code: "SERVICE_ERROR",
        httpStatus: 500,
        description: "Internal service error",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            error: { type: "string", title: "Error Message" },
            code: { type: "string", title: "Error Code" },
            requestId: { type: "string", title: "Request ID for support" }
          },
          required: ["error", "code"]
        }
      },
      RateLimitExceeded: {
        code: "RATE_LIMIT_EXCEEDED",
        httpStatus: 429,
        description: "Rate limit exceeded",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            error: { type: "string", title: "Error Message" },
            code: { type: "string", title: "Error Code" },
            retryAfter: { type: "number", title: "Retry After (seconds)" }
          },
          required: ["error", "code", "retryAfter"]
        }
      }
    },
    
    // Authentication (OpenAPI-style)
    authentication: {
      type: "custom",
      scheme: "x402",
      description: "x402 protocol: Send USDC payment on Base, include txHash in X-PAYMENT header",
      headerName: "X-PAYMENT",
      paymentNetworks: ["base", "ethereum", "polygon", "arbitrum", "optimism"],
      acceptedCurrencies: ["USDC", "USDT"]
    },
    
    // Supported transports
    transports: ["REST", "x402"],
    
    // Modalities
    modalities: ["text", "data"],
    
    // Protocol info
    protocolVersion: "0.3.0",
    a2aCompliant: true,
    x402Compliant: true,
    
    // Endpoints
    endpoints: {
      openapi: `${baseUrl}/openapi.json`,
      serviceManifest: `${baseUrl}/.well-known/service-manifest.json`,
      pricing: `${baseUrl}/.well-known/pricing.json`,
      documentation: `${baseUrl}/developers`,
      marketplace: `${baseUrl}/marketplace`
    },

    discoveryManifests: {
      x402: `${baseUrl}/.well-known/x402.json`,
      agentCard: `${baseUrl}/.well-known/agent-card.json`,
      agentInstructions: `${baseUrl}/.well-known/agent-instructions.json`,
      webmcp: `${baseUrl}/.well-known/webmcp.json`,
      awi: `${baseUrl}/.well-known/awi.json`,
      mpp: `${baseUrl}/.well-known/mpp.json`,
      mcpServices: `${baseUrl}/mcp/services`,
      mcpIntegration: `${baseUrl}/.well-known/mcp-integration.json`,
      integrationGuide: `${baseUrl}/mcp-integration-guide`,
      openapi: `${baseUrl}/openapi.json`,
      yieldPortal: `${baseUrl}/api/yield/manifest`,
    },
    
    // Rate limiting metadata (A2A v0.3 optional field)
    rateLimits: {
      requestsPerMinute: 60,
      requestsPerHour: 1000,
      burstLimit: 10
    },
    
    // Platform metadata
    platform: {
      name: "Coin Railz",
      url: baseUrl,
      type: "payment_infrastructure",
      chains: ["ethereum", "base", "polygon", "bsc", "arbitrum", "optimism", "pulsechain"],
      positioning: "Multi-Chain Payment Infrastructure for Crypto Communities",
      supportedProtocols: ["x402", "A2A", "WebMCP", "AWI", "MPP", "AP2", "OpenAPI"]
    }
  };
  
  res.status(200).json(a2aAgentCard);
});

/**
 * GET /.well-known/agent-instructions.json
 * 
 * Machine-readable onboarding instructions for AI agents
 * Explains how to create wallets, fund them, and purchase services
 * This endpoint helps agents understand the complete business flow
 */
router.get('/.well-known/agent-instructions.json', async (req: Request, res: Response) => {
  const baseUrl = getBaseUrl(req);
  
  const instructions = {
    title: "How to Do Business with Coin Railz",
    version: "1.0.0",
    lastUpdated: "2026-03-17",
    summary: "Step-by-step guide for AI agents to purchase blockchain analytics and trading services via x402 micropayments or prepaid credits.",

    recommended_next_step: {
      action: "claim_free_trial",
      description: `Get a FREE $5 trial API key instantly — no payment, no crypto wallet, no account. Works on all ${getCanonicalServiceCount()} services. 1 per IP per 7 days.`,
      endpoint: `${baseUrl}/api/m2m/credits/trial`,
      method: "GET",
      headers: { "Accept": "application/json" },
      successResponse: { apiKey: "cr_live_...", credits: 5, expiresIn: "7 days", note: "SAVE apiKey — returned once only" },
      usageHeaders: {
        primary: "X-API-KEY: cr_live_...",
        alternative: "Authorization: Bearer cr_live_..."
      },
      expected_time: "instant",
      next_step_after_trial: `POST ${baseUrl}/api/m2m/credits/purchase to purchase a paid plan ($5/$10/$25/$100)`
    },

    quickStart: {
      description: "Three paths to get started — free trial (fastest), card payment, or on-chain USDC",
      recommendedPath: "freeTrial",
      paths: {
        freeTrial: {
          label: "Free Trial (Fastest — no payment, no crypto)",
          steps: [
            {
              step: 1,
              action: "Claim your free trial API key",
              endpoint: `${baseUrl}/api/m2m/credits/trial`,
              method: "GET",
              headers: { "Accept": "application/json" },
              rateLimit: "1 per IP per 7 days",
              successResponse: { apiKey: "cr_live_...", credits: 5, expiresIn: "7 days" },
              warning: "SAVE the apiKey — shown once only"
            },
            {
              step: 2,
              action: "Call any service with your trial key",
              description: "Pass the key as X-API-KEY header on any /x402/* endpoint. $5 in credits (~80-100 calls).",
              curlExample: `curl -X POST ${baseUrl}/x402/gas-price-oracle -H 'X-API-KEY: cr_live_...' -H 'Content-Type: application/json' -d '{}'`,
              catalogUrl: `${baseUrl}/x402/catalog`
            }
          ]
        },
        cardPayment: {
          label: "Card Payment (Recommended — no crypto required)",
          steps: [
            {
              step: 1,
              action: "Create a Stripe PaymentMethod",
              description: "Use Stripe.js or the Stripe API to tokenize a card. Returns a pm_... PaymentMethod ID.",
              stripeDocsUrl: "https://stripe.com/docs/api/payment_methods/create"
            },
            {
              step: 2,
              action: "Purchase credits and get your API key",
              endpoint: `${baseUrl}/api/m2m/credits/purchase`,
              method: "POST",
              body: { paymentMethodId: "pm_...", amountUsd: 10, idempotencyKey: "<uuid-v4-string>" },
              idempotencyNote: "Unique string per purchase (min 8 chars, UUID v4 recommended). Reuse safely on network retry.",
              tiers: [
                { amountUsd: 5,   calls: "~80-100 service calls", note: "Try it — no commitment" },
                { amountUsd: 10,  calls: "~200 service calls" },
                { amountUsd: 25,  calls: "~500 service calls", recommended: true },
                { amountUsd: 100, calls: "~2,000 service calls" }
              ],
              successResponse: { apiKey: "cr_live_...", keyPrefix: "cr_live", creditsAdded: 200, newBalance: 200 },
              errorCodes: {
                "400": "Invalid paymentMethodId (must start with pm_) or idempotencyKey too short",
                "409": "Purchase already processed for this idempotencyKey — use a new key for a new purchase",
                "429": "Rate limit: 5 purchases per IP per hour — retry after 1 hour"
              },
              warning: "SAVE the apiKey from the response — shown once only"
            },
            {
              step: 3,
              action: "Call any service with your API key",
              description: "Pass the key as X-API-KEY header on any /x402/* endpoint. Credits deducted per call.",
              curlExample: `curl -X POST ${baseUrl}/x402/gas-price-oracle -H 'X-API-KEY: cr_live_...' -H 'Content-Type: application/json' -d '{"chains":["base"]}'`,
              catalogUrl: `${baseUrl}/x402/catalog`
            }
          ]
        },
        onChainUsdc: {
          label: "On-Chain USDC via x402 (crypto-native)",
          steps: [
            {
              step: 1,
              action: "Get a Wallet",
              description: "Create a free agent wallet or use your own EVM wallet with USDC on Base",
              endpoint: `${baseUrl}/x402/wallet/free`,
              method: "POST",
              example: { agentId: "your-agent-id", purpose: "payments" }
            },
            {
              step: 2,
              action: "Fund with USDC",
              description: "Send USDC to your wallet on Base mainnet (Chain ID 8453)",
              network: "Base Mainnet",
              chainId: 8453,
              token: {
                symbol: "USDC",
                address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
                decimals: 6
              },
              bridges: [
                { name: "Base Bridge", url: "https://bridge.base.org" },
                { name: "Across Protocol", url: "https://app.across.to" },
                { name: "Stargate", url: "https://stargate.finance" }
              ]
            },
            {
              step: 3,
              action: "Make Your First Paid Call",
              description: "Start with the Golden Path endpoint — $0.05 USDC, lowest price on platform. Receive 402, pay via facilitator, retry with X-PAYMENT header.",
              facilitator: {
                evm: "https://api.cdp.coinbase.com/platform/v2/x402",
                solana: "https://x402.dexter.cash"
              },
              goldenPathEndpoint: `${baseUrl}/x402/first-call`,
              price: "$0.05 USDC",
              chainsAccepted: ["Base (eip155:8453)", "Solana mainnet"],
              curlExample: `curl -X POST ${baseUrl}/x402/first-call -H 'Content-Type: application/json' -H 'X-PAYMENT: <tx_hash>' -d '{}'`,
              pythonExample: `import httpx\nresp = httpx.post('${baseUrl}/x402/first-call', headers={'X-PAYMENT': tx_hash}, json={})\nprint(resp.json())`
            }
          ]
        }
      }
    },

    goldenPath: {
      description: "START HERE. The canonical first payment endpoint for any new agent integrating with Coin Railz.",
      endpoint: `${baseUrl}/x402/first-call`,
      method: "POST",
      price: "$0.05 USDC",
      amountMicroUSDC: 50000,
      chainsAccepted: ["Base (eip155:8453)", "Solana mainnet (solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp)"],
      onSuccess: "Returns sessionId, payment receipt, and 3 next-service templates with executable curl examples"
    },
    
    walletOptions: {
      description: "Three ways to get a wallet for payments",
      options: [
        {
          id: "free-wallet",
          name: "Free Agent Wallet",
          description: "Instant wallet creation via Coinbase CDP - no cost, ready in seconds",
          endpoint: `${baseUrl}/x402/wallet/free`,
          method: "POST",
          cost: "Free",
          features: ["Instant creation", "CDP-managed", "Base mainnet ready"]
        },
        {
          id: "instant-agent-wallet",
          name: "Premium Agent Wallet",
          description: "Enhanced wallet with additional features via x402 payment",
          endpoint: `${baseUrl}/x402/instant-agent-wallet`,
          method: "POST",
          cost: "$1.00 USDC",
          features: ["Priority support", "Analytics dashboard", "Multi-chain ready"]
        },
        {
          id: "self-custody",
          name: "Self-Custody Wallet",
          description: "Use any existing EVM wallet (MetaMask, Rainbow, etc.)",
          requirements: ["EVM wallet with Base network support", "USDC on Base mainnet"],
          cost: "Free (you manage keys)"
        }
      ]
    },
    
    paymentMethods: {
      description: "Multiple ways to pay for services",
      methods: [
        {
          id: "x402",
          name: "x402 Micropayments",
          description: "Pay-per-call USDC payments via HTTP 402 protocol",
          howItWorks: [
            "1. Make request to any service endpoint",
            "2. Receive 402 Payment Required response with payment details",
            "3. Sign and submit USDC payment via facilitator",
            "4. Retry request with X-PAYMENT header containing tx hash",
            "5. Receive service response"
          ],
          facilitator: "https://api.cdp.coinbase.com/platform/v2/x402",
          platformWallet: "0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91",
          network: "eip155:8453",
          token: "USDC"
        },
        {
          id: "credits",
          name: "Prepaid Credits",
          description: "Buy credits in bulk for discounted access",
          endpoint: `${baseUrl}/api/credits`,
          dashboard: `${baseUrl}/credits`,
          benefits: ["Volume discounts", "No per-transaction signing", "Usage tracking"]
        },
        {
          id: "sdk",
          name: "SDK Integration",
          description: "Use our SDK packages for seamless payment handling",
          packages: {
            npm: "@coinrailz/agent-payments",
            npmSolana: "@coinrailz/agent-payments-solana",
            python: "coinrailz",
            pythonSolana: "coinrailz-solana",
            docker: "tdnupe3/agent-payments"
          },
          documentation: `${baseUrl}/docs/sdk`
        }
      ]
    },
    
    pricing: {
      description: "Service pricing ranges from $0.05 to $10.00 USDC per call",
      pricingTiers: [
        { tier: "Basic", range: "$0.05 - $0.25", examples: ["ping", "gas-price-oracle", "fire-alerts", "kalshi-markets", "kalshi-search"] },
        { tier: "Standard", range: "$0.25 - $1.00", examples: ["multi-chain-balance", "wallet-risk", "trade-signals", "kalshi-odds"] },
        { tier: "Premium", range: "$1.00 - $5.00", examples: ["instant-agent-wallet", "verified-agent-identity"] },
        { tier: "Enterprise", range: "$5.00 - $10.00", examples: ["smart-contract-audit", "compliance-consultation"] }
      ],
      fullCatalog: `${baseUrl}/x402/catalog`,
      paymentDocs: `${baseUrl}/x402/payment-docs`
    },
    
    troubleshooting: {
      commonIssues: [
        {
          issue: "402 Payment Required but payment not recognized",
          solutions: [
            "Verify transaction was sent to correct wallet: 0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91",
            "Confirm transaction is on Base mainnet (not Ethereum or other chains)",
            "Ensure payment is in USDC (not ETH or other tokens)",
            "Wait for transaction confirmation (1-2 blocks)"
          ]
        },
        {
          issue: "Insufficient funds error",
          solutions: [
            "Bridge USDC to Base via bridge.base.org or across.to",
            "Minimum recommended balance: $5 USDC for testing",
            "Consider buying prepaid credits for bulk usage"
          ]
        },
        {
          issue: "Wallet creation failed",
          solutions: [
            "Use unique agentId for each wallet request",
            "Check /x402/wallet/free endpoint is accessible",
            "Contact support if issue persists"
          ]
        }
      ],
      support: {
        statusEndpoint: `${baseUrl}/x402/payment-status`,
        documentation: `${baseUrl}/x402/payment-docs`,
        contact: "support@coinrailz.com"
      }
    },
    
    codeExamples: {
      summary: "Copy-paste ready code. Fastest start: free trial key — no wallet, no crypto, instant.",

      python_free_trial: {
        language: "python",
        runtime: "pip install httpx",
        description: "Recommended — free $5 trial key, works in 2 steps, no crypto required",
        code: [
          "import httpx",
          "",
          "# Step 1: get your free trial API key (one per IP per 7 days)",
          `resp = httpx.get('${baseUrl}/api/m2m/credits/trial')`,
          "api_key = resp.json()['apiKey']  # save this — shown once only",
          "",
          "# Step 2: call any service with your key",
          `result = httpx.post('${baseUrl}/x402/gas-price-oracle',`,
          "    headers={'X-API-KEY': api_key},",
          "    json={'chains': ['base', 'ethereum']})",
          "print(result.json())"
        ].join("\n")
      },

      nodejs_free_trial: {
        language: "javascript",
        runtime: "node (built-in fetch, Node 18+)",
        description: "Recommended — free $5 trial key, no crypto required",
        code: [
          "// Step 1: get your free trial API key",
          `const trialResp = await fetch('${baseUrl}/api/m2m/credits/trial');`,
          "const { apiKey } = await trialResp.json(); // save this — shown once only",
          "",
          "// Step 2: call any service",
          `const result = await fetch('${baseUrl}/x402/gas-price-oracle', {`,
          "  method: 'POST',",
          "  headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },",
          "  body: JSON.stringify({ chains: ['base', 'ethereum'] })",
          "});",
          "console.log(await result.json());"
        ].join("\n")
      },

      python_x402_native: {
        language: "python",
        runtime: "pip install x402 httpx",
        description: "Native x402 on-chain USDC payments — pay per call, no API key needed",
        code: [
          "from x402.client import with_payment_handler",
          "import httpx",
          "",
          "# Your EVM private key with USDC on Base mainnet",
          "PRIVATE_KEY = '0xYOUR_PRIVATE_KEY'",
          "",
          "# Wrap httpx client with automatic 402 payment handling",
          "client = httpx.Client()",
          "with_payment_handler(client, wallet_private_key=PRIVATE_KEY)",
          "",
          "# Now calls automatically pay the 402 challenge and retry",
          `resp = client.post('${baseUrl}/x402/gas-price-oracle', json={'chains': ['base']})`,
          "print(resp.json())  # $0.10 USDC deducted automatically"
        ].join("\n")
      },

      nodejs_x402_native: {
        language: "javascript",
        runtime: "npm install x402 viem",
        description: "Native x402 on-chain USDC payments — pay per call, no API key needed",
        code: [
          "import { wrapFetch } from 'x402/client';",
          "import { privateKeyToAccount } from 'viem/accounts';",
          "",
          "// Your EVM private key with USDC on Base mainnet",
          "const account = privateKeyToAccount('0xYOUR_PRIVATE_KEY');",
          "",
          "// Wrap fetch with automatic 402 payment handling",
          "const fetch402 = wrapFetch(fetch, account);",
          "",
          "// Calls automatically pay the 402 challenge and retry",
          `const resp = await fetch402('${baseUrl}/x402/gas-price-oracle', {`,
          "  method: 'POST',",
          "  headers: { 'Content-Type': 'application/json' },",
          "  body: JSON.stringify({ chains: ['base'] })",
          "});",
          "console.log(await resp.json());  // $0.10 USDC deducted automatically"
        ].join("\n")
      },

      manual_x402_flow: {
        language: "python",
        runtime: "pip install httpx",
        description: "Manual x402 flow — understand what happens under the hood",
        code: [
          "import httpx, json",
          "",
          `ENDPOINT = '${baseUrl}/x402/gas-price-oracle'`,
          "FACILITATOR = 'https://api.cdp.coinbase.com/platform/v2/x402'",
          "",
          "# Step 1: probe — expect 402",
          "resp = httpx.post(ENDPOINT, json={})",
          "assert resp.status_code == 402",
          "payment_req = resp.json()",
          "# payment_req['accepts'] contains: scheme, network, maxAmountRequired, payTo, asset",
          "",
          "# Step 2: sign payment via CDP facilitator (requires CDP API key)",
          "pay_resp = httpx.post(f'{FACILITATOR}/pay', json={",
          "    'paymentRequirements': payment_req['accepts'],",
          "    'wallet': {'privateKey': '0xYOUR_KEY'}",
          "})",
          "x_payment = pay_resp.json()['payment']",
          "",
          "# Step 3: retry with X-PAYMENT header",
          "final = httpx.post(ENDPOINT, headers={'X-PAYMENT': x_payment}, json={})",
          "print(final.json())"
        ].join("\n")
      },

      curl_free_trial: {
        language: "bash",
        description: "One-liner shell test — get trial key and make first call",
        code: [
          `# Get free trial key`,
          `API_KEY=$(curl -s ${baseUrl}/api/m2m/credits/trial | python3 -c "import sys,json; print(json.load(sys.stdin)['apiKey'])")`,
          "",
          `# Call any service`,
          `curl -s -X POST ${baseUrl}/x402/gas-price-oracle \\`,
          `  -H "X-API-KEY: $API_KEY" \\`,
          `  -H "Content-Type: application/json" \\`,
          `  -d '{"chains":["base"]}' | python3 -m json.tool`
        ].join("\n")
      }
    },

    links: {
      agentRegistration: `${baseUrl}/.well-known/agent-registration.json`,
      serviceCatalog: `${baseUrl}/x402/catalog`,
      paymentDocs: `${baseUrl}/x402/payment-docs`,
      agentCard: `${baseUrl}/.well-known/agent.json`,
      agentCardA2A: `${baseUrl}/.well-known/agent-card.json`,
      x402Manifest: `${baseUrl}/.well-known/x402.json`,
      webmcpManifest: `${baseUrl}/.well-known/webmcp.json`,
      awiManifest: `${baseUrl}/.well-known/awi.json`,
      mppManifest: `${baseUrl}/.well-known/mpp.json`,
      mcpIntegrationManifest: `${baseUrl}/.well-known/mcp-integration.json`,
      mcpIntegrationGuide: `${baseUrl}/mcp-integration-guide`,
      apiDiscovery: `${baseUrl}/api/discovery/resources`,
      mcpServices: `${baseUrl}/mcp/services`,
      freeWallet: `${baseUrl}/x402/wallet/free`,
      credits: `${baseUrl}/credits`,
      documentation: `${baseUrl}/docs`,
      openapi: `${baseUrl}/openapi.json`
    }
  };
  
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.status(200).json(instructions);
});

/**
 * GET /.well-known/agent-card.json
 * 
 * A2A Protocol v0.3.0 compliant agent card for registry submission
 * Main platform agent card - describes Coin Railz as a service provider
 * Discoverable by ChatGPT, Google AI, x402 indexers, A2A Registry, and other A2A platforms
 * 
 * UPDATED: Jul 8 2026 - Now includes all 72 x402 services with correct pricing
 */
router.get('/.well-known/agent-card.json', async (req: Request, res: Response) => {
  const baseUrl = getBaseUrl(req);
  
  // A2A Protocol v0.3.0 compliant agent card
  const svcCount = getCanonicalServiceCount();
  const agentCard = {
    protocolVersion: "0.3.0",
    name: "Coin Railz",
    description: `Multi-chain x402 micropayment infrastructure for AI agents. ${svcCount} pay-per-call API services for crypto analytics, trading signals, security audits, satellite data (NASA Earthdata Intelligence + ESA), real estate, banking, market intelligence, prediction markets, IoT/DePIN data, and AI inference. Native Coinbase Agentic Wallet compatible. OWS (Open Wallet Standard) compatible. Pay with USDC on Ethereum or Base - prices from $0.05 to $10.00 per request.`,
    url: `${baseUrl}/a2a/v1`,
    version: "3.1.0",
    instructions: `${baseUrl}/.well-known/agent-instructions.json`,
    payment_manifest: `${baseUrl}/x402/payment-manifest.json`,

    capabilities: {
      streaming: false,
      pushNotifications: false,
      stateTransitionHistory: true,
      x402Payments: true,
      serviceCategories: ["Execution", "Treasury Management", "Market Intelligence", "Prediction Markets", "Satellite Intelligence", "IoT & DePIN", "AI Inference", "Real Estate", "Identity"],
      x402: {
        protocolVersion: "2.12.0",
        facilitatorUrl: "https://api.cdp.coinbase.com/platform/v2/x402",
        payTo: "0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91",
        paymentNetwork: "eip155:8453",
        paymentToken: {
          symbol: "USDC",
          address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          decimals: 6
        }
      }
    },

    iconUrl: "https://coinrailz.com/favicon.ico",
    preferredTransport: "HTTP+JSON",

    registrationEndpoint: `${baseUrl}/.well-known/agent-registration.json`,

    agenticWallet: {
      compatible: true,
      sdkVersion: "0.10.3",
      walletProvisioningEndpoint: `${baseUrl}/x402/wallet/free`,
      paidWalletEndpoint: `${baseUrl}/x402/instant-agent-wallet`,
      supportedSkills: ["search-for-service", "pay-for-service", "monetize-service"],
      onboardingFlow: "instant",
      cli: "npx awal"
    },

    ap2: {
      version: "0.1",
      endpoint: `${baseUrl}/ap2/v1/merchant`,
      supportedPaymentMethods: ["X402", "CARD", "VISA", "MASTERCARD", "AMEX", "STRIPE"],
      supportedCurrencies: ["USDC", "USD"],
      supportedChains: ["base", "solana"],
      cardPayment: {
        processor: "Stripe",
        minAmount: 1.00,
        maxAmount: 2500.00,
        note: "Card payments (CARD/VISA/MASTERCARD/AMEX/STRIPE) purchase API credits. Include Stripe pm_ token for automated payment, or use checkoutUrl for browser-based payment.",
        checkoutUrl: `${baseUrl}/pilots/buy`
      },
      description: "AP2 v0.1 merchant endpoint — accepts PaymentMandate VDCs for x402 crypto (per-call) or card payments via Stripe (credits-based)"
    },

    mpp: {
      version: MPP_PROTOCOL_VERSION,
      manifest: `${baseUrl}/.well-known/mpp.json`,
      catalog: `${baseUrl}/mpp/catalog`,
      challengeScheme: "WWW-Authenticate: Payment challenge=<base64>",
      credentialScheme: "Authorization: Payment <base64-credential>",
      settlementCurrency: "pathUSD",
      settlementNetwork: "Tempo",
      endpoints: [
        { id: "ping", url: `${baseUrl}/mpp/ping`, amount: "0.25", description: "Echo/discovery" },
        { id: "first-call", url: `${baseUrl}/mpp/first-call`, amount: "0.05", description: "Golden path onboarding" },
        { id: "ai-inference", url: `${baseUrl}/mpp/ai-inference`, amount: "0.05", description: "GPT-4o-mini inference" },
        { id: "gas-price-oracle", url: `${baseUrl}/mpp/gas-price-oracle`, amount: "0.10", description: "Multi-chain gas prices" },
        { id: "token-metadata", url: `${baseUrl}/mpp/token-metadata`, amount: "0.10", description: "Token metadata" },
      ],
      spec: "https://mpp.dev",
      tempoWallet: "https://wallet.tempo.xyz",
    },

    skills: [
      // NASA Earthdata Intelligence Services ($0.25) — Physical Asset Verification at Global Scale
      {
        id: "earthdata-granules",
        name: "NASA Earthdata Granule Search",
        description: "CMR Granule Search across 1B+ satellite scenes: Landsat, Sentinel, MODIS, VIIRS. Essential for RWA monitoring, supply chain asset audit, and environmental compliance. $0.25 per request. Endpoint: /api/satellite/earthdata/granules",
        tags: ["NASA", "Earthdata", "satellite", "remote-sensing", "RWA", "ESG", "compliance", "supply-chain", "x402", "satellite-intelligence"],
        inputModes: ["application/json"],
        outputModes: ["application/json"],
        examples: [{
          name: "Landsat scene search",
          description: "Find recent Landsat-8 scenes over a bounding box for agricultural yield verification",
          input: { shortName: "LANDSAT_OT_C2_L2", temporal: "2026-01-01,2026-03-01", bounding_box: "-120,35,-115,40" },
          output: { granules: [{ id: "LC08_L2SP_042034_20260115", cloud_cover: 12, download_url: "https://..." }] }
        }]
      },
      {
        id: "earthdata-precipitation",
        name: "GPM IMERG Precipitation",
        description: "Global Precipitation Measurement (GPM) IMERG point queries at 0.1° resolution. Agricultural yield verification, flood risk modeling, and supply chain weather disruption analysis. $0.25 per request. Endpoint: /api/satellite/earthdata/precipitation",
        tags: ["NASA", "Earthdata", "precipitation", "weather", "GPM", "agriculture", "RWA", "ESG", "flood-risk", "satellite-intelligence"],
        inputModes: ["application/json"],
        outputModes: ["application/json"],
        examples: [{
          name: "Precipitation query",
          description: "Query rainfall at a specific point for crop insurance verification",
          input: { lat: 37.5, lon: -120.5, date: "2026-03-01" },
          output: { precipitation_mm: 42.3, source: "GPM IMERG Final Run", resolution_deg: 0.1 }
        }]
      },
      {
        id: "earthdata-sst",
        name: "MUR Sea Surface Temperature",
        description: "Multi-scale Ultra-high Resolution (MUR) Sea Surface Temperature at 1km daily resolution. Maritime logistics risk assessment, aquaculture monitoring, carbon credit verification. Endpoint: /x402/earthdata-sst. $0.25 per request.",
        tags: ["NASA", "Earthdata", "SST", "ocean", "temperature", "maritime", "supply-chain", "RWA", "carbon-credits", "aquaculture", "satellite-intelligence", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"],
        examples: [{
          name: "Sea surface temperature",
          description: "Get SST at a coordinate for shipping route risk assessment",
          input: { lat: 35.0, lon: -140.0, date: "2026-03-15" },
          output: { sst_celsius: 18.4, source: "MUR", resolution_km: 1 }
        }]
      },
      {
        id: "earthdata-soil-moisture",
        name: "SMAP Soil Moisture",
        description: "NASA SMAP L3 soil moisture granule discovery. Agricultural yield verification, drought monitoring, and supply chain transparency for commodity markets. $0.25 per request. Endpoint: /x402/earthdata-soil-moisture",
        tags: ["NASA", "Earthdata", "SMAP", "soil", "moisture", "agriculture", "ESG", "drought", "commodity", "RWA", "satellite-intelligence", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"],
        examples: [{
          name: "Soil moisture check",
          description: "Retrieve soil moisture for a farmland coordinate for crop yield modeling",
          input: { lat: 40.0, lon: -100.0, date: "2026-03-01" },
          output: { soil_moisture_m3m3: 0.28, source: "SMAP SPL3SMP", pass: "ascending" }
        }]
      },
      {
        id: "earthdata-ocean-color",
        name: "Ocean Color & Water Quality",
        description: "MODIS Ocean Color / Chlorophyll-a (MODISA_L3m_CHL) data. Carbon credit verification, marine ecosystem health monitoring, and ESG reporting for coastal industries. Endpoint: /x402/earthdata-ocean-color. $0.25 per request.",
        tags: ["NASA", "Earthdata", "ocean", "chlorophyll", "water-quality", "ESG", "carbon-credits", "marine", "RWA", "coastal", "satellite-intelligence", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"],
        examples: [{
          name: "Chlorophyll-a measurement",
          description: "Measure ocean chlorophyll concentration for carbon credit verification",
          input: { lat: 36.5, lon: -122.0, date: "2026-03-01" },
          output: { chlorophyll_mgl: 2.14, source: "MODIS-Aqua L3m", quality_flag: "good" }
        }]
      },
      {
        id: "satellite-earthdata",
        name: "NASA Earthdata Intelligence Gateway",
        description: "Unified NASA Earthdata bundled gateway. Single endpoint for all 5 products: precipitation (GPM IMERG), granule search, SST (MUR), soil moisture (SMAP), and ocean color (MODIS). Pass product= field to select. Endpoint: /x402/satellite-earthdata. $0.25 per request.",
        tags: ["NASA", "Earthdata", "satellite", "precipitation", "SST", "soil-moisture", "ocean-color", "granules", "bundled", "satellite-intelligence", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"],
        examples: [{
          name: "Bundled precipitation query",
          description: "Get precipitation data using the unified gateway with product field",
          input: { product: "precipitation", lat: 40.0, lon: -74.0 },
          output: { product: "precipitation", data: { precipitation_mm_hr: 2.4 }, source: "GPM IMERG" }
        }]
      },
      // Trading Intelligence Services ($0.10-$0.75)
      {
        id: "gas-price-oracle",
        name: "Gas Price Oracle",
        description: "Real-time gas price predictions across multiple chains. $0.10 per request.",
        tags: ["utilities", "gas", "ethereum", "multi-chain", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"],
        examples: [{
          name: "Ethereum gas prices",
          description: "Get current gas prices on Ethereum with USD cost estimates",
          input: { chains: ["ethereum"] },
          output: { gasPrices: [{ chain: "ethereum", slow: 12, standard: 15, fast: 22, usdCostEstimate: "$0.45" }] }
        }]
      },
      {
        id: "token-metadata",
        name: "Token Metadata",
        description: "Comprehensive token information including name, symbol, decimals, and contract details. $0.10 per request.",
        tags: ["tokens", "metadata", "crypto", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"],
        examples: [{
          name: "USDC token info",
          description: "Get metadata for USDC stablecoin on Base",
          input: { tokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", chain: "base" },
          output: { name: "USD Coin", symbol: "USDC", decimals: 6, totalSupply: "1000000000" }
        }]
      },
      {
        id: "dex-liquidity",
        name: "DEX Liquidity Scanner",
        description: "Analyze liquidity pools, depths, and trading conditions across DEXs. $0.20 per request.",
        tags: ["defi", "liquidity", "dex", "trading", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"],
        examples: [{
          name: "ETH/USDC liquidity on Base",
          description: "Analyze liquidity for ETH/USDC trading pair across DEXs on Base",
          input: { tokenPair: "ETH/USDC", chain: "base", dex: "all" },
          output: { pools: [{ dex: "uniswap-v3", liquidity: 45000000, apy: 8.2, volume24h: 12000000 }] }
        }]
      },
      {
        id: "approval-manager",
        name: "Token Approval Manager",
        description: "Check and manage token approvals for smart contracts. $0.20 per request.",
        tags: ["security", "approvals", "tokens", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "token-price",
        name: "Token Price Feed",
        description: "Real-time token prices from multiple sources. $0.25 per request.",
        tags: ["prices", "tokens", "data", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "token-sentiment",
        name: "Token Sentiment Analysis",
        description: "AI-powered sentiment analysis for tokens from social and on-chain data. $0.25 per request.",
        tags: ["sentiment", "ai", "analytics", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "transaction-builder",
        name: "Transaction Builder",
        description: "Build optimized blockchain transactions with gas estimation. $0.30 per request.",
        tags: ["transactions", "utilities", "blockchain", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "whale-alerts",
        name: "Whale Alerts",
        description: "Real-time monitoring of large wallet movements and whale activity. $0.35 per request.",
        tags: ["whales", "monitoring", "alerts", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "batch-quote",
        name: "Batch Quote Service",
        description: "Get multiple swap quotes in a single request. $0.40 per request.",
        tags: ["trading", "quotes", "batch", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "multi-chain-balance",
        name: "Multi-Chain Balance",
        description: "Check wallet balances across all supported chains in one call. $0.50 per request.",
        tags: ["wallets", "balances", "multi-chain", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "trending-tokens",
        name: "Trending Tokens",
        description: "Discover trending and hot tokens based on volume and social activity. $0.50 per request.",
        tags: ["trending", "tokens", "discovery", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "portfolio-tracker",
        name: "Portfolio Tracker",
        description: "Complete portfolio breakdown with P&L and allocation insights. $0.50 per request.",
        tags: ["portfolio", "tracking", "analytics", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "wallet-risk",
        name: "Wallet Risk Analysis",
        description: "Evaluate wallet risk levels and suspicious activity patterns. $0.50 per request.",
        tags: ["security", "risk", "wallets", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "trade-signals",
        name: "Trade Signals",
        description: "AI-powered trading signals based on technical analysis and on-chain data. $0.75 per request.",
        tags: ["trading", "signals", "ai", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      // Execution & Infrastructure Services ($0.50-$2.00)
      {
        id: "payment-processing",
        name: "Payment Processing",
        description: "Process crypto payments across 7 blockchains. $0.50 per request.",
        tags: ["payments", "crypto", "infrastructure", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "contract-scan",
        name: "Contract Scanner",
        description: "Deep analysis of smart contract code and security vulnerabilities. $1.00 per request.",
        tags: ["security", "smart-contracts", "auditing", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "instant-agent-wallet",
        name: "Instant Agent Wallet",
        description: "Create managed wallets for AI agents instantly. $1.00 per request.",
        tags: ["wallets", "agents", "infrastructure", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "seamless-chain-bridge",
        name: "Cross-Chain Bridge",
        description: "Bridge assets seamlessly across supported chains. $2.00 per request.",
        tags: ["bridges", "cross-chain", "infrastructure", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      // Premium Services ($5.00-$10.00)
      {
        id: "verified-agent-identity",
        name: "Verified Agent Identity",
        description: "On-chain identity verification and reputation for AI agents. $5.00 per request.",
        tags: ["identity", "verification", "agents", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "compliance-consultation",
        name: "Compliance Consultation",
        description: "AI-powered compliance analysis for crypto operations. $5.00 per request.",
        tags: ["compliance", "legal", "consulting", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "smart-contract-audit",
        name: "Smart Contract Audit",
        description: "Comprehensive security audit with vulnerability detection. $10.00 per request.",
        tags: ["security", "auditing", "smart-contracts", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      // Real Estate Vertical ($0.75-$1.50)
      {
        id: "property-valuation",
        name: "Property Valuation",
        description: "AI-powered real estate property valuation and market analysis. $0.75 per request.",
        tags: ["real-estate", "valuation", "ai", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "lease-analysis",
        name: "Lease Analysis",
        description: "Analyze commercial and residential lease terms and conditions. $1.00 per request.",
        tags: ["real-estate", "leases", "analysis", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "construction-progress",
        name: "Construction Progress",
        description: "Track and analyze construction project progress and milestones. $1.50 per request.",
        tags: ["real-estate", "construction", "tracking", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      // Banking/Finance Vertical ($0.75-$1.75)
      {
        id: "fraud-detection",
        name: "Fraud Detection",
        description: "AI-powered fraud detection for financial transactions. $0.75 per request.",
        tags: ["banking", "fraud", "security", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "credit-risk-score",
        name: "Credit Risk Score",
        description: "Calculate credit risk scores for wallets and entities. $1.25 per request.",
        tags: ["banking", "credit", "risk", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "compliance-check",
        name: "Compliance Check",
        description: "Verify regulatory compliance for transactions and entities. $1.75 per request.",
        tags: ["banking", "compliance", "regulatory", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      // Trading/Investment Vertical ($0.50-$2.00)
      {
        id: "sentiment-analysis",
        name: "Market Sentiment Analysis",
        description: "Analyze market sentiment from social media and news sources. $0.50 per request.",
        tags: ["trading", "sentiment", "ai", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "trading-signal",
        name: "Trading Signal Generator",
        description: "Generate actionable trading signals with entry and exit points. $1.00 per request.",
        tags: ["trading", "signals", "investment", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "portfolio-optimization",
        name: "Portfolio Optimization",
        description: "AI-powered portfolio optimization and rebalancing recommendations. $2.00 per request.",
        tags: ["trading", "portfolio", "optimization", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      // Market Intelligence Vertical ($0.75-$1.25)
      {
        id: "correlation-matrix",
        name: "Correlation Matrix",
        description: "Generate asset correlation matrices for portfolio analysis. $0.75 per request.",
        tags: ["market-intelligence", "correlation", "analytics", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "risk-metrics",
        name: "Risk Metrics",
        description: "Calculate VaR, Sharpe ratio, and other risk metrics. $1.00 per request.",
        tags: ["market-intelligence", "risk", "metrics", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "arbitrage-scanner",
        name: "Arbitrage Scanner",
        description: "Detect arbitrage opportunities across exchanges and chains. $1.25 per request.",
        tags: ["market-intelligence", "arbitrage", "trading", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      // Traditional Markets Services ($0.40 each)
      {
        id: "stock-sentiment",
        name: "Stock Market Sentiment",
        description: "AI-powered stock market sentiment analysis with news, technicals, and institutional activity. $0.40 per request.",
        tags: ["traditional-markets", "stocks", "sentiment", "equities", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "forex-sentiment",
        name: "Forex Sentiment Analysis",
        description: "AI-powered forex sentiment analysis with central bank policy and economic indicators. $0.40 per request.",
        tags: ["traditional-markets", "forex", "sentiment", "currency", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      // Discovery & Testing
      {
        id: "ping",
        name: "x402 Discovery Ping",
        description: "x402 discovery and testing endpoint - returns 402 Payment Required challenge. $0.25 per request.",
        tags: ["discovery", "testing", "health-check", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"],
        examples: [{
          name: "Discovery ping",
          description: "Test x402 payment flow — returns 402 challenge to validate integration",
          input: {},
          output: { message: "Payment required", price: "$0.25 USDC", facilitator: "https://x402.dexter.cash" }
        }]
      },
      // Agent Infrastructure
      {
        id: "agent-create-wallet",
        name: "Agent Wallet Provisioning",
        description: "Create CDP-managed wallets for AI agents with instant USDC support on Base. $2.00 per request.",
        tags: ["infrastructure", "wallets", "agents", "cdp", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      // Prediction Markets (4 services)
      {
        id: "polymarket-odds",
        name: "Polymarket Odds",
        description: "Get current odds from Polymarket prediction markets. $0.50 per request.",
        tags: ["prediction-markets", "polymarket", "odds", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"],
        examples: [{
          name: "Election prediction market odds",
          description: "Get current odds for active prediction market events on Polymarket",
          input: { query: "US election" },
          output: { markets: [{ title: "Example Market", yesPrice: 0.65, noPrice: 0.35, volume: 250000 }] }
        }]
      },
      {
        id: "polymarket-events",
        name: "Polymarket Events",
        description: "Get trending events from Polymarket. $0.25 per request.",
        tags: ["prediction-markets", "polymarket", "events", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "polymarket-search",
        name: "Polymarket Search",
        description: "Search Polymarket prediction markets. $0.25 per request.",
        tags: ["prediction-markets", "polymarket", "search", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "kalshi-markets",
        name: "Kalshi Markets",
        description: "Get active markets from Kalshi (CFTC-regulated prediction exchange). $0.25 per request.",
        tags: ["prediction-markets", "kalshi", "regulated", "cftc", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "kalshi-odds",
        name: "Kalshi Odds",
        description: "Get current odds and orderbook for specific Kalshi markets. $0.50 per request.",
        tags: ["prediction-markets", "kalshi", "odds", "orderbook", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "kalshi-search",
        name: "Kalshi Search",
        description: "Search Kalshi prediction markets by keyword. $0.25 per request.",
        tags: ["prediction-markets", "kalshi", "search", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "prediction-market-odds",
        name: "Prediction Market Odds",
        description: "Get current odds and probability for any prediction market event. $0.50 per request.",
        tags: ["prediction-markets", "odds", "probability", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      // SDK Payment Services (2)
      {
        id: "sdk-payments-evm",
        name: "SDK Payment Processing (EVM)",
        description: "Non-custodial USDC payment processing for AI agents via @coinrailz/agent-payments NPM or coinrailz PyPI. Supports Base, Ethereum, Polygon, Arbitrum, BSC, Optimism. Processing fee: 1.5% + $0.01. Use when agent needs to 'send payment', 'pay for service', 'transfer USDC', or 'process payment on Base/Ethereum'.",
        tags: ["sdk", "payments", "usdc", "evm", "base", "multi-chain", "agent-payments"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "sdk-payments-solana",
        name: "SDK Payment Processing (Solana)",
        description: "Non-custodial SOL/USDC payment processing for AI agents via @coinrailz/agent-payments-solana NPM or coinrailz-solana PyPI. Processing fee: 1.5% + $0.01. Use when agent needs to 'send SOL', 'pay on Solana', 'transfer USDC on Solana', or 'process Solana payment'.",
        tags: ["sdk", "payments", "sol", "usdc", "solana", "agent-payments"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      // Golden path onboarding
      {
        id: "first-call",
        name: "First Call — x402 Onboarding",
        description: "Golden path onboarding endpoint. $0.05 USDC. First x402 payment for any agent — returns platform overview, supported chains, and next steps. Ideal first interaction for any AI agent integrating with Coin Railz.",
        tags: ["onboarding", "discovery", "x402", "first-call"],
        inputModes: ["application/json"],
        outputModes: ["application/json"],
        examples: [{
          name: "Agent first payment",
          description: "Pay $0.05 USDC to receive full platform capabilities and service catalog",
          input: {},
          output: { message: "Welcome to Coin Railz", services: getCanonicalServiceCount(), chains: 8 }
        }]
      },
      // AI Inference Gateway
      {
        id: "ai-inference",
        name: "AI Inference Gateway",
        description: "Pay-per-call LLM endpoint supporting GPT-4o, GPT-4o-mini, and GPT-3.5-turbo via USDC on Base. $0.05 per request. Use when agent needs AI completions without an OpenAI API key.",
        tags: ["ai", "inference", "llm", "gpt", "openai", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      // Base USDC Yield Vault
      {
        id: "base-usdc-yield-vault",
        name: "USDC Yield Vault (Base) — ERC-4626 Auto-Routing Yield",
        description: "Deposit USDC and earn auto-optimized yield on Base. ERC-4626 vault auto-routes to highest APY across Aave v3, Compound v3, and Morpho Blue. 0.5% entry, 15% performance fee on yield only, 0% exit fee. Rebalances every 24h. Non-custodial, emergencyWithdraw() always works.",
        tags: ["yield", "usdc", "defi", "base", "erc4626", "aave", "morpho", "compound", "vault", "interest"],
        vault: {
          address:    (process.env.YIELD_VAULT_ADDRESS ?? 'deploying-soon'),
          standard:   "ERC-4626",
          shareToken: "crUSDC",
          chainId:    8453,
          asset:      "USDC",
          assetAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          basescan:   `https://basescan.org/address/${process.env.YIELD_VAULT_ADDRESS ?? 'deploying-soon'}`
        },
        agentkit: {
          recommended: true,
          package: "coinrailz-agentkit",
          install: "npm install coinrailz-agentkit",
          usage:   "new CoinRailzYieldActionProvider() — add to AgentKit.from({ actionProviders: [...] })",
          npmUrl:  "https://www.npmjs.com/package/coinrailz-agentkit",
          actions: ["coinrailz_yield_deposit","coinrailz_yield_deposit_permit","coinrailz_yield_redeem","coinrailz_yield_check_position","coinrailz_yield_get_rates","coinrailz_yield_get_contract_info"]
        },
        howToDeposit: [
          "PATH A — AgentKit (recommended, 0 blockchain code): npm install coinrailz-agentkit → new CoinRailzYieldActionProvider() → AgentKit.from(). 6 actions available, natural language.",
          "PATH B — REST pre-built calldata: GET /api/yield/deposit-tx?preset=100&recipient=0xWALLET → broadcast tx[0] (USDC approve) → broadcast tx[1] (ERC-4626 deposit). No ABI needed.",
          "PATH C — Permit 1-tx: GET /api/yield/deposit-tx?mode=permit&preset=100&recipient=0xWALLET → sign EIP-712 typed data → 1 on-chain tx via depositWithPermit (~50% less gas).",
          "WITHDRAW: GET /api/yield/redeem-tx?wallet=0xWALLET → broadcast 1 tx, 0% exit fee, receive USDC.",
          "TRACK: GET /api/yield/position/0xWALLET → live shares, USD value, yield earned, protocol allocation."
        ],
        endpoints: {
          rates:     `${baseUrl}/api/yield/rates`,
          stats:     `${baseUrl}/api/yield/stats`,
          depositTx: `${baseUrl}/api/yield/deposit-tx?preset=100&recipient={wallet}`,
          permitTx:  `${baseUrl}/api/yield/deposit-tx?mode=permit&preset=100&recipient={wallet}`,
          redeemTx:  `${baseUrl}/api/yield/redeem-tx?wallet={wallet}`,
          position:  `${baseUrl}/api/yield/position/{wallet}`,
          contract:  `${baseUrl}/api/yield/contract`,
          manifest:  `${baseUrl}/api/yield/manifest`,
          portal:    `${baseUrl}/yield-portal`
        },
        inputModes: ["application/json"],
        outputModes: ["application/json"],
        pricing: { amount: 0, currency: "USD", note: "Free to query. Entry fee 0.5% on deposit, 15% performance fee on yield only. No API key required." },
        examples: [{
          name: "Check current APY",
          description: "Get live rates from all three protocols and current net APY",
          input: {},
          output: { bestProtocol: "Morpho Blue", bestAPY: 4.96, netAPY: 4.22 }
        }]
      },
      // Solana
      {
        id: "solana-yield-finder",
        name: "Solana Yield Finder",
        description: "Discover top yield opportunities across Solana DeFi protocols. $0.05 per request.",
        tags: ["solana", "yield", "defi", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "solana-usdc-yield-portal",
        name: "Solana USDC Yield Portal (Kamino)",
        description: "Non-custodial USDC yield on Solana via Kamino Lending. Build unsigned VersionedTx deposit/withdraw, read live APY, and check position value. Free position reads. $0.05 rates, $0.10 deposit-tx.",
        tags: ["solana", "yield", "kamino", "usdc", "non-custodial", "defi"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      // Satellite & weather data services
      {
        id: "fire-alerts",
        name: "Fire Alerts (NASA FIRMS)",
        description: "Real-time wildfire and active fire detection from NASA FIRMS satellite data. $0.05 per request.",
        tags: ["satellite", "fire", "nasa", "weather", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "weather-imagery",
        name: "Weather Imagery (NASA GIBS)",
        description: "Satellite weather imagery and atmospheric data from NASA GIBS. $0.05 per request.",
        tags: ["satellite", "weather", "imagery", "nasa", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "vegetation",
        name: "Vegetation Index",
        description: "NDVI vegetation health index and land cover analysis from satellite imagery. $0.10 per request.",
        tags: ["satellite", "vegetation", "ndvi", "land", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "flood-detection",
        name: "Flood Detection",
        description: "Satellite-based flood extent mapping and inundation detection. $0.10 per request.",
        tags: ["satellite", "flood", "disaster", "esa", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "air-quality",
        name: "Air Quality Index",
        description: "Ground-level air quality measurements and AQI from global sensor networks via OpenAQ. $0.05 per request.",
        tags: ["air-quality", "aqi", "environment", "sensors", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "land-use",
        name: "Land Use Classification",
        description: "ESA WorldCover land use and land cover classification from satellite data. $0.15 per request.",
        tags: ["satellite", "land-use", "esa", "worldcover", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      // IoT & DePIN services
      {
        id: "fleet-telematics",
        name: "Fleet Telematics Data",
        description: "IoT fleet vehicle telematics — GPS, speed, fuel, diagnostics via x402 agent-to-device payments. $0.25 per request.",
        tags: ["iot", "fleet", "telematics", "depin", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "weather-station-data",
        name: "Weather Station Data",
        description: "Live weather readings from IoT ground stations — temperature, humidity, pressure. $0.10 per request.",
        tags: ["iot", "weather", "sensors", "depin", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "iot-sensor-reading",
        name: "IoT Sensor Reading",
        description: "Single IoT sensor data read via agent-to-device x402 micropayment. $0.05 per request.",
        tags: ["iot", "sensors", "depin", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "iot-device-stream",
        name: "IoT Device Stream",
        description: "Streaming IoT device data feed via x402 per-event micropayments. $0.15 per request.",
        tags: ["iot", "streaming", "depin", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "iot-bulk-data",
        name: "IoT Bulk Data Export",
        description: "Bulk historical IoT sensor data export for AI training and analytics. $0.50 per request.",
        tags: ["iot", "bulk", "data", "depin", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "b20-token-info",
        name: "B20 Token Info",
        description: "ERC-20 metadata plus B20 Native Token Standard compliance fields (freeze state, compliance mode, transfer memo requirement) for any token on Base mainnet. Activated post-Beryl hardfork. $0.05 per request.",
        tags: ["b20", "base", "compliance", "token", "beryl", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "b20-transfer-check",
        name: "B20 Transfer Check",
        description: "Simulate whether a B20 token transfer will succeed given current freeze/blocklist/allowlist state on Base mainnet. Returns blockers and warnings. On-chain truth only. $0.10 per request.",
        tags: ["b20", "base", "compliance", "transfer", "beryl", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "b20-compliance-scan",
        name: "B20 Compliance Scan",
        description: "Deep compliance scan of a wallet across multiple B20 token issuers on Base mainnet. Returns per-token freeze/blocklist status, frozen-until timestamps, and overall risk level. $0.25 per request.",
        tags: ["b20", "base", "compliance", "scan", "beryl", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "robinhood-token-price",
        name: "Robinhood Chain Token Price",
        description: "Real-time token price on Robinhood Chain sourced from the highest-liquidity DEX pool. Returns best price, 24h change, volume, liquidity, pool breakdown, and confidence score. $0.60 per request.",
        tags: ["robinhood", "dex", "price", "trading", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "robinhood-dex-pools",
        name: "Robinhood Chain DEX Pools",
        description: "Top DEX liquidity pools on Robinhood Chain, optionally filtered by token. Returns fee tier, 24h volume, TVL, price, and pair details — ideal for routing and arbitrage agents. $1.25 per request.",
        tags: ["robinhood", "dex", "liquidity", "pools", "trading", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "robinhood-chain-stats",
        name: "Robinhood Chain Stats",
        description: "Live chain-wide statistics for Robinhood Chain: block number, gas price in Gwei, total DEX pools, 24h trading volume, total liquidity, and top tokens by volume. $0.75 per request.",
        tags: ["robinhood", "chain", "stats", "analytics", "defi", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "vlt-usdc-deposit",
        name: "vltUSDC Vault Deposit Calldata",
        description: "FREE — Unsigned ERC-4626 approve + deposit calldata for the Bankroll Network vltUSDC vault on Ethereum mainnet. No payment required. Send {amountUsdc, recipient}, get back 2 unsigned Ethereum transactions. Vault zaps USDC into VLT/WETH LP and mints vltUSDC shares.",
        tags: ["defi", "yield", "vault", "bankroll", "vlt", "usdc", "ethereum", "erc4626", "x402", "free"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "vlt-usdc-withdraw",
        name: "vltUSDC Vault Withdraw Calldata",
        description: "FREE — Unsigned vault.redeem calldata for exiting the Bankroll Network vltUSDC vault on Ethereum mainnet. No payment required. Send {shares, recipient}, get back 1 unsigned Ethereum transaction with live slippage floors for VLT + USDC output.",
        tags: ["defi", "yield", "vault", "bankroll", "vlt", "usdc", "ethereum", "withdraw", "redeem", "x402", "free"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      }
    ],
    
    defaultInputModes: ["application/json", "text/plain"],
    defaultOutputModes: ["application/json"],

    provider: {
      organization: "Coin Railz",
      url: "https://coinrailz.com"
    },

    documentationUrl: `${baseUrl}/.well-known/agent-instructions.json`,
    homepageUrl: baseUrl,
    author: "Coin Railz",
    wellKnownURI: `${baseUrl}/.well-known/agent-card.json`,
    homepage: baseUrl,
    
    registryTags: [
      "crypto",
      "blockchain",
      "defi",
      "payments",
      "x402",
      "micropayments",
      "trading",
      "security",
      "analytics",
      "multi-chain",
      "usdc",
      "base",
      "solana",
      "ai-agents",
      "sdk",
      "agent-payments",
      "real-estate",
      "banking",
      "market-intelligence",
      "agentic-wallet",
      "coinbase",
      "cdp",
      "satellite-data",
      "iot",
      "nasa",
      "esa"
    ],
    
    // Platform trust signals for AI agent decision-making
    // These are optional, machine-readable indicators of platform reliability
    platformSignals: {
      verifiedPayments: true,           // Real x402 payments processed and verified
      repeatAgentsObserved: true,       // Returning agents making multiple payments
      paymentRails: ["x402-USDC", "stripe", "sdk-payments", "agentic-wallet"],  // Available payment methods
      totalServicesAvailable: getCanonicalServiceCount(),
      agenticWalletCompatible: true,    // Native Coinbase Agentic Wallet support
      networksSupported: ["eip155:8453", "eip155:1", "eip155:137", "eip155:56", "eip155:42161", "eip155:10", "eip155:4663", "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"],   // Primary blockchain networks (CAIP-2 format)
      networkSupported: "eip155:8453",   // Primary blockchain network (CAIP-2 format) - kept for backwards compatibility
      paymentAsset: "USDC",              // Primary payment token
      sdkPackages: {
        npm: "@coinrailz/agent-payments",
        npmSolana: "@coinrailz/agent-payments-solana",
        python: "coinrailz",
        pythonSolana: "coinrailz-solana",
        docker: "tdnupe3/agent-payments"
      },
      processingFee: "1.5% + $0.01",
      discoveryProtocols: ["x402", "A2A", "WebMCP", "AWI", "MPP", "OpenAPI"],
      discoveryManifests: {
        x402: `${baseUrl}/.well-known/x402.json`,
        agentCard: `${baseUrl}/.well-known/agent-card.json`,
        webmcp: `${baseUrl}/.well-known/webmcp.json`,
        awi: `${baseUrl}/.well-known/awi.json`,
        mpp: `${baseUrl}/.well-known/mpp.json`,
        openapi: `${baseUrl}/openapi.json`,
        mcpServices: `${baseUrl}/mcp/services`,
        integrationGuide: `${baseUrl}/mcp-integration-guide`
      }
    }
  };
  
  res.status(200).json(agentCard);
});

/**
 * GET /.well-known/service-manifest.json
 * 
 * Complete list of all x402 services offered by Coin Railz
 */
router.get('/.well-known/service-manifest.json', async (req: Request, res: Response) => {
  const baseUrl = getBaseUrl(req);
  const { getCanonicalServices } = await import('../utils/serviceCount');
  const canonicalServices = getCanonicalServices();

  const services = canonicalServices.map(s => ({
    id: s.id,
    name: s.name,
    description: s.description,
    endpoint: `${baseUrl}${s.endpoint}`,
    price_usd: s.priceUsd,
    category: s.category,
    method: s.method,
  }));

  const manifest = {
    platform: "Coin Railz",
    version: "2.1.0",
    total_services: services.length,
    services,
    discoveryManifests: {
      x402: `${baseUrl}/.well-known/x402.json`,
      agentCard: `${baseUrl}/.well-known/agent-card.json`,
      webmcp: `${baseUrl}/.well-known/webmcp.json`,
      awi: `${baseUrl}/.well-known/awi.json`,
      mpp: `${baseUrl}/.well-known/mpp.json`,
      mcpServices: `${baseUrl}/mcp/services`,
      integrationGuide: `${baseUrl}/mcp-integration-guide`,
      openapi: `${baseUrl}/openapi.json`
    }
  };

  res.status(200).json(manifest);
});

/**
 * GET /.well-known/payment-methods.json
 * 
 * Detailed payment methods and wallet information
 */
router.get('/.well-known/payment-methods.json', async (req: Request, res: Response) => {
  const baseUrl = getBaseUrl(req);
  const paymentMethods = {
    platform: "Coin Railz",
    version: "2.0.0",
    
    crypto: {
      enabled: true,
      wallet_address: process.env.PLATFORM_WALLET_ADDRESS || "0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91",
      
      networks: [
        {
          chain: "base",
          chain_id: 8453,
          tokens: ["USDC", "USDT", "ETH", "DAI"],
          preferred: true
        },
        {
          chain: "ethereum",
          chain_id: 1,
          tokens: ["USDC", "USDT", "ETH", "DAI", "WBTC"]
        },
        {
          chain: "polygon",
          chain_id: 137,
          tokens: ["USDC", "USDT", "MATIC", "DAI"]
        },
        {
          chain: "arbitrum",
          chain_id: 42161,
          tokens: ["USDC", "USDT", "ETH", "DAI"]
        },
        {
          chain: "optimism",
          chain_id: 10,
          tokens: ["USDC", "USDT", "ETH", "DAI"]
        }
      ],
      
      stablecoins: ["USDC", "USDT", "DAI"],
      preferred_token: "USDC"
    },
    
    x402: {
      enabled: true,
      protocol_version: "2.0.0",
      facilitator: "x402.org",
      settlement_network: "eip155:8453",
      minimum_payment: 0.10
    },
    
    solana: {
      enabled: true,
      wallet_address: process.env.SOLANA_PUBLIC_KEY || "Hgby7VEo6vaPayM1G7kkjTqMAo4aCARoXA3ftWKz1m4k",
      network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
      tokens: ["SOL", "USDC", "USDT"],
      preferred_token: "USDC",
      fee_percentage: 0.005,
      minimum_payment: 0.10,
      payment_flow: "intent-based",
      memo_format: "CRPAY-[A-Z0-9]{8}",
      webhook_settlement: true,
      catalog_url: "/solana-pay/catalog",
      documentation_url: "/solana-pay"
    },
    
    fiat: {
      stripe: {
        enabled: true,
        methods: ["card", "bank_transfer"],
        currencies: ["USD"]
      },
      prepaid_credits: {
        enabled: true,
        minimum_purchase: 10.00,
        bonus_tiers: []
      }
    },
    discovery: {
      protocols: ["x402", "A2A", "WebMCP", "AWI", "MPP", "AP2"],
      manifests: {
        x402: `${baseUrl}/.well-known/x402.json`,
        webmcp: `${baseUrl}/.well-known/webmcp.json`,
        awi: `${baseUrl}/.well-known/awi.json`,
        mpp: `${baseUrl}/.well-known/mpp.json`,
        agentCard: `${baseUrl}/.well-known/agent-card.json`,
        mcpServices: `${baseUrl}/mcp/services`,
        openapi: `${baseUrl}/openapi.json`
      },
      integrationGuide: `${baseUrl}/mcp-integration-guide`,
      trialKey: `${baseUrl}/api/m2m/credits/trial`
    },
    quickstart: {
      summary: "Fastest path to first payment: send a POST to /x402/first-call with an x402 payment header on Base.",
      first_call: {
        endpoint: `${baseUrl}/x402/first-call`,
        method: "POST",
        price_usdc: 0.05,
        network: "eip155:8453",
        token: "USDC",
        token_address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        facilitator_url: "https://api.cdp.coinbase.com/platform/v2/x402",
        pay_to: "0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91",
        description: "Canonical $0.05 USDC onboarding call — returns platform overview and available services"
      },
      free_trial: {
        endpoint: `${baseUrl}/api/m2m/credits/trial`,
        method: "GET",
        description: "Get a free API key with trial credits — no payment required to start"
      },
      full_catalog: `${baseUrl}/.well-known/x402.json`
    }
  };
  
  res.status(200).json(paymentMethods);
});

/**
 * GET /.well-known/x402.json
 * 
 * x402 protocol discovery endpoint for Coinbase Bazaar and other x402 indexers
 * Lists all available x402 micropayment services with correct endpoint paths
 */
router.get('/.well-known/x402.json', async (req: Request, res: Response) => {
  const baseUrl = getBaseUrl(req);
  
  const x402Manifest = {
    name: "Coin Railz",
    homepage: "https://coinrailz.com",
    contact: "support@coinrailz.com",
    description: "AI agent marketplace with x402 autonomous payment endpoints, native Coinbase Agentic Wallet support, A2A 2.0 discovery, SDK packages (@coinrailz/agent-payments NPM, coinrailz PyPI, Docker), satellite data APIs (NASA/ESA), and multi-chain support across 9 networks (8 EVM + Solana). Processing fee: 1.5% + $0.01 per transaction.",
    version: "x402-2.12",
    specVersion: "2.12.0",
    x402Version: 2,
    facilitatorUrl: getFacilitatorUrl(),
    payTo: "0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91",
    facilitator: "https://api.cdp.coinbase.com/platform/v2/x402",
    service_count: getCanonicalServiceCount(),
    updated: new Date().toISOString().split('T')[0] + 'T00:00:00Z',
    instructions: `${baseUrl}/.well-known/agent-instructions.json`,
    agent_instructions: `${baseUrl}/.well-known/agent-instructions.json`,
    payment_manifest: `${baseUrl}/x402/payment-manifest.json`,
    registrationEndpoint: `${baseUrl}/.well-known/agent-registration.json`,
    quickstart: {
      summary: "Three paths to start using Coin Railz services. Fastest: free trial key in one GET request.",
      path_1_free_trial: {
        description: "Get $5 free credits (no card, no wallet) — ~80-100 service calls",
        step_1: `GET ${baseUrl}/api/m2m/credits/trial`,
        step_2: "Response contains your cr_live_ API key",
        step_3: `POST ${baseUrl}/x402/first-call  →  Header: X-API-KEY: cr_live_...`,
        curl_example: `curl ${baseUrl}/api/m2m/credits/trial`
      },
      path_2_card: {
        description: "Buy credits with a Stripe card (~60 seconds)",
        endpoint: `POST ${baseUrl}/api/m2m/credits/purchase`,
        body: { paymentMethodId: "pm_...", amount: 10 },
        response: "cr_live_ API key + credits balance"
      },
      path_3_onchain: {
        description: "Pay per-call with on-chain USDC (EVM or Solana)",
        recommended_first_service: `POST ${baseUrl}/x402/first-call`,
        price_usd: 0.05,
        payment_header: "X-PAYMENT: <base64url-encoded x402 signed payload>",
        facilitators: ["https://api.cdp.coinbase.com/platform/v2/x402", "https://x402.dexter.cash"]
      }
    },
    sdk: {
      npm: "@coinrailz/agent-payments",
      npmSolana: "@coinrailz/agent-payments-solana",
      python: "coinrailz",
      pythonSolana: "coinrailz-solana",
      docker: "tdnupe3/agent-payments",
      processingFee: "1.5% + $0.01"
    },
    networks: ["eip155:8453", "eip155:1", "eip155:137", "eip155:56", "eip155:42161", "eip155:10", "eip155:4663", "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"],
    walletProviders: ["coinbase-cdp", "moonpay-agents", "any-evm"],
    categories: ["Execution", "Treasury Management", "Market Intelligence", "Prediction Markets", "Satellite Intelligence", "IoT & DePIN", "AI Inference", "Real Estate", "RWA & Tokenization", "Identity"],
    facilitators: [
      "https://api.cdp.coinbase.com/platform/v2/x402",
      "https://x402.dexter.cash"
    ],
    endpoints: (() => {
      const allServices = getCanonicalServices();
      const featured = allServices.filter(s => s.featured);
      const rest = allServices.filter(s => !s.featured);
      return [...featured, ...rest].map(s => ({
        path: s.endpoint,
        methods: [s.method],
        price_usd: s.priceUsd,
        auth: 'x402',
        name: s.name,
        description: s.description,
        status: 'healthy',
        category: s.category,
        featured: s.featured,
      }));
    })(),
    x402: {
      protocol_version: "2.0.0",
      facilitator: getFacilitatorUrl(),
      facilitators: getAllFacilitatorUrls(),
      payment_network: "eip155:8453",
      payment_token: {
        symbol: "USDC",
        address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        decimals: 6
      },
      platform_wallet: process.env.PLATFORM_WALLET_ADDRESS || "0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91",
      agenticWalletCompatible: true,
      agenticWalletVersion: "0.10.3",
      walletProvisioning: {
        freeEndpoint: `${baseUrl}/x402/wallet/free`,
        paidEndpoint: `${baseUrl}/x402/instant-agent-wallet`,
        supportedSkills: ["search-for-service", "pay-for-service", "monetize-service"]
      }
    },
    a2a: {
      protocol_version: "2.0.0",
      agent_directory: `${baseUrl}/api/agents/directory`,
      discovery_enabled: true,
      agent_card: `${baseUrl}/.well-known/agent-card.json`
    },
    webmcp: {
      manifest: `${baseUrl}/.well-known/webmcp.json`,
      protocol_version: "1.0",
      server_type: "http",
      service_list: `${baseUrl}/mcp/services`,
      checkout: `${baseUrl}/api/mcp/payments/checkout`
    },
    awi: {
      manifest: `${baseUrl}/.well-known/awi.json`,
      protocol_version: "1.0"
    },
    commerce: {
      total_services: getCanonicalServiceCount(),
      categories: ["discovery", "trader-focused", "security", "infrastructure", "premium-infrastructure", "payments", "real-estate", "rwa-tokenization", "banking", "trading", "intelligence", "prediction-markets", "traditional-markets", "satellite-data", "ai-inference", "iot", "yield"],
      platform_commission: 15,
      minimum_payment: 0.10,
      maximum_payment: 10000
    },
    yieldVault: {
      description: "AI Agent Yield Portal — non-custodial USDC yield vault. Auto-routes to highest APY across Aave v3, Compound v3, Morpho Blue on Base. 0.5% entry fee + 15% performance fee on yield only. 0% exit fee.",
      standard: "ERC-4626",
      vault: (process.env.YIELD_VAULT_ADDRESS ?? 'deploying-soon'),
      network: "base",
      chainId: 8453,
      asset: "USDC",
      shareToken: "crUSDC",
      entryFeePct: 0.5,
      performanceFeePct: 15,
      exitFeePct: 0,
      minHarvestUsd: 5,
      agentkit: {
        package: "coinrailz-agentkit",
        install: "npm install coinrailz-agentkit",
        npmUrl:  "https://www.npmjs.com/package/coinrailz-agentkit"
      },
      routes: {
        rates:     `${baseUrl}/api/yield/rates`,
        stats:     `${baseUrl}/api/yield/stats`,
        depositTx: `${baseUrl}/api/yield/deposit-tx?preset=100&recipient={wallet}`,
        permitTx:  `${baseUrl}/api/yield/deposit-tx?mode=permit&preset=100&recipient={wallet}`,
        redeemTx:  `${baseUrl}/api/yield/redeem-tx?wallet={wallet}`,
        position:  `${baseUrl}/api/yield/position/{wallet}`,
        contract:  `${baseUrl}/api/yield/contract`,
        manifest:  `${baseUrl}/api/yield/manifest`,
        portal:    `${baseUrl}/yield-portal`,
      },
    },
    blockchain: {
      supported_chains: ["ethereum", "base", "polygon", "bsc", "arbitrum", "optimism", "pulsechain", "robinhood"],
      supported_tokens: ["USDC", "USDT", "ETH", "DAI"],
      primary_chain: "base"
    }
  };
  
  res.status(200).json(x402Manifest);
});

/**
 * GET /.well-known/pricing.json
 * 
 * Detailed pricing information for all services
 */
router.get('/.well-known/pricing.json', async (req: Request, res: Response) => {
  const baseUrl = getBaseUrl(req);

  const categories: Record<string, Array<{ id: string; name: string; endpoint: string; price_usd: number; currency: string; network: string }>> = {
    "discovery": [],
    "trading_intelligence": [],
    "execution_infrastructure": [],
    "premium": [],
    "real_estate": [],
    "banking_finance": [],
    "trading_investment": [],
    "market_intelligence": [],
    "prediction_markets": [],
    "traditional_markets": [],
    "solana_defi": [],
    "satellite_data": [],
    "nasa_earthdata": [],
    "iot_depin": [],
    "ai_inference": [],
    "uncategorized": [],
  };

  const serviceCategories: Record<string, keyof typeof categories> = {
    "ping": "discovery",
    "first-call": "discovery",
    "gas-price-oracle": "trading_intelligence",
    "token-metadata": "trading_intelligence",
    "dex-liquidity": "trading_intelligence",
    "approval-manager": "trading_intelligence",
    "token-price": "trading_intelligence",
    "token-sentiment": "trading_intelligence",
    "transaction-builder": "trading_intelligence",
    "whale-alerts": "trading_intelligence",
    "batch-quote": "trading_intelligence",
    "multi-chain-balance": "trading_intelligence",
    "trending-tokens": "trading_intelligence",
    "portfolio-tracker": "trading_intelligence",
    "wallet-risk": "trading_intelligence",
    "trade-signals": "trading_intelligence",
    "payment-processing": "execution_infrastructure",
    "contract-scan": "execution_infrastructure",
    "instant-agent-wallet": "execution_infrastructure",
    "instant-api-key": "execution_infrastructure",
    "agent-create-wallet": "execution_infrastructure",
    "seamless-chain-bridge": "execution_infrastructure",
    "verified-agent-identity": "premium",
    "compliance-consultation": "premium",
    "smart-contract-audit": "premium",
    "property-valuation": "real_estate",
    "lease-analysis": "real_estate",
    "construction-progress": "real_estate",
    "fraud-detection": "banking_finance",
    "credit-risk-score": "banking_finance",
    "compliance-check": "banking_finance",
    "sentiment-analysis": "trading_investment",
    "trading-signal": "trading_investment",
    "portfolio-optimization": "trading_investment",
    "correlation-matrix": "market_intelligence",
    "risk-metrics": "market_intelligence",
    "arbitrage-scanner": "market_intelligence",
    "polymarket-events": "prediction_markets",
    "polymarket-odds": "prediction_markets",
    "polymarket-search": "prediction_markets",
    "prediction-market-odds": "prediction_markets",
    "kalshi-markets": "prediction_markets",
    "kalshi-odds": "prediction_markets",
    "kalshi-search": "prediction_markets",
    "stock-sentiment": "traditional_markets",
    "forex-sentiment": "traditional_markets",
    "solana-yield-finder": "solana_defi",
    "fire-alerts": "satellite_data",
    "weather-imagery": "satellite_data",
    "vegetation": "satellite_data",
    "flood-detection": "satellite_data",
    "air-quality": "satellite_data",
    "land-use": "satellite_data",
    "satellite-earthdata": "nasa_earthdata",
    "earthdata-granules": "nasa_earthdata",
    "earthdata-precipitation": "nasa_earthdata",
    "earthdata-sst": "nasa_earthdata",
    "earthdata-soil-moisture": "nasa_earthdata",
    "earthdata-ocean-color": "nasa_earthdata",
    "fleet-telematics": "iot_depin",
    "weather-station-data": "iot_depin",
    "iot-sensor-reading": "iot_depin",
    "iot-device-stream": "iot_depin",
    "iot-bulk-data": "iot_depin",
    "ai-inference": "ai_inference",
  };

  for (const [serviceId, price] of Object.entries(SERVICE_PRICING_USD)) {
    const cat = serviceCategories[serviceId] ?? "uncategorized";
    categories[cat].push({
      id: serviceId,
      name: serviceId.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      endpoint: `${baseUrl}/x402/${serviceId}`,
      price_usd: price,
      currency: "USDC",
      network: "base (eip155:8453)",
    });
  }

  const totalServices = Object.values(categories).reduce((sum, arr) => sum + arr.length, 0);

  const pricing = {
    platform: "Coin Railz",
    description: "Universal x402 payment infrastructure for the AI agent economy. Pay-per-call USDC micropayments on Base. No API keys, no subscriptions required.",
    version: "3.0.0",
    updated: new Date().toISOString().split('T')[0],
    total_services: totalServices,
    payment: {
      protocol: "x402",
      currency: "USDC",
      primary_network: "Base (eip155:8453)",
      also_accepted: ["Solana mainnet (solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp)"],
      facilitator: "https://api.cdp.coinbase.com/platform/v2/x402",
      how_to_pay: "Send POST to any /x402/* endpoint. Receive HTTP 402 with payment requirements. Submit USDC payment on Base. Include X-PAYMENT header on retry.",
      onboarding_endpoint: `${baseUrl}/x402/first-call`,
      onboarding_price_usd: 0.05,
    },
    api_key_path: {
      description: "Prefer API keys? Purchase credits via Stripe and get an API key for header-based auth.",
      purchase_url: `${baseUrl}/pricing`,
      header: "X-API-Key",
    },
    services_by_category: categories,
    platform_fees: {
      dex_swap_pct: 1.5,
      p2p_transfer_pct: 3.5,
      iot_d2d_transfer_pct: 2.0,
      description: "DEX aggregation: 1.5% per swap. P2P routing: 3.5–6.5% tiered. IoT D2D: 2% + $0.02 flat."
    },
    iot_credits: {
      description: "IoT/DePIN devices may also use pre-purchased credits (Stripe, PayPal, or on-chain USDC).",
      packs: [
        { name: "Starter", price_usd: 25.00, credits: 5000, per_credit_usd: 0.005 },
        { name: "Growth", price_usd: 100.00, credits: 25000, per_credit_usd: 0.004 },
        { name: "Enterprise", price_usd: 500.00, credits: 200000, per_credit_usd: 0.0025 },
      ]
    },
    links: {
      catalog: `${baseUrl}/x402/catalog`,
      docs: `${baseUrl}/x402/payment-docs`,
      agent_card: `${baseUrl}/.well-known/agent-card.json`,
      x402_manifest: `${baseUrl}/.well-known/x402.json`,
      openapi: `${baseUrl}/openapi.json`,
    }
  };

  res.status(200).json(pricing);
});

/**
 * GET /.well-known/solana.json
 * 
 * Solana payment processor discovery endpoint for Solana-native AI agents
 * Completely isolated from x402 EVM infrastructure
 */
router.get('/.well-known/solana.json', async (req: Request, res: Response) => {
  const baseUrl = getBaseUrl(req);
  
  const solanaManifest = {
    name: "Coin Railz Solana Payment Processor",
    homepage: "https://coinrailz.com/solana-pay",
    contact: "support@coinrailz.com",
    description: "Payment processing as a service for Solana-native AI agents. 0.5% fees, instant webhook settlement, SOL/USDC/USDT support. Built for Truth Terminal, pump.fun traders, and Jito MEV bots.",
    version: "1.0.0",
    network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
    
    wallet: {
      address: process.env.SOLANA_PUBLIC_KEY || "Hgby7VEo6vaPayM1G7kkjTqMAo4aCARoXA3ftWKz1m4k",
      type: "platform_wallet"
    },
    
    tokens: [
      {
        symbol: "SOL",
        mint: "native",
        decimals: 9,
        name: "Solana"
      },
      {
        symbol: "USDC",
        mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        decimals: 6,
        name: "USD Coin"
      },
      {
        symbol: "USDT",
        mint: "Es9vMFrzaCERmnn4Xw4Jp9Dzk1XjCK8dygBBhPokv9wg",
        decimals: 6,
        name: "Tether USD"
      }
    ],
    
    payment_flow: {
      type: "intent-based",
      memo_format: "CRPAY-[A-Z0-9]{8}",
      settlement: "webhook",
      steps: [
        "1. POST /solana-pay/intents to create payment intent",
        "2. Send payment to wallet with memo tag from response",
        "3. Helius webhook auto-settles on chain confirmation",
        "4. Access service with x-intent-id header"
      ]
    },
    
    fees: {
      percentage: 0.005,
      minimum_sol: 0.001,
      minimum_usdc: 0.25,
      description: "0.5% fee with minimum thresholds per token"
    },
    
    endpoints: {
      catalog: `${baseUrl}/solana-pay/catalog`,
      create_intent: `${baseUrl}/solana-pay/intents`,
      check_intent: `${baseUrl}/solana-pay/intents/:intentId`,
      services_list: `${baseUrl}/solana-pay/services`,
      status: `${baseUrl}/solana-pay/status`
    },
    
    services: [
      {
        id: "sol-price-feed",
        name: "Token Price Feed",
        description: "Real-time Solana token prices via Jupiter/DexScreener",
        endpoint: `${baseUrl}/solana-pay/services/price/:mint`,
        price_usdc: 0.10,
        price_sol: 0.0005,
        category: "data"
      },
      {
        id: "sol-trending",
        name: "Trending Tokens",
        description: "Hot tokens on Solana DEXs with volume and price data",
        endpoint: `${baseUrl}/solana-pay/services/trending`,
        price_usdc: 0.25,
        price_sol: 0.001,
        category: "data"
      },
      {
        id: "sol-whale-alerts",
        name: "Whale Wallet Alerts",
        description: "Track large Solana wallet movements in real-time",
        endpoint: `${baseUrl}/solana-pay/services/whale-alerts`,
        price_usdc: 0.50,
        price_sol: 0.002,
        category: "intelligence"
      }
    ],
    
    target_users: [
      "Solana-native AI agents",
      "Truth Terminal ecosystem",
      "pump.fun traders",
      "Jito MEV bots",
      "DeFi automation"
    ],
    
    metadata: {
      created: "2025-12-22",
      updated: new Date().toISOString().split('T')[0],
      isolated_from_evm: true
    }
  };
  
  res.status(200).json(solanaManifest);
});

/**
 * GET /.well-known/solana-actions.json
 * 
 * Helius Actions Directory manifest - Required for automated indexing by:
 * - Helius Actions Directory crawler
 * - Blink index (Dialect)
 * - Phantom/Solflare discovery feeds
 * - Backpack wallet discovery
 */
router.get('/.well-known/solana-actions.json', async (req: Request, res: Response) => {
  const baseUrl = getBaseUrl(req);
  const platformWallet = process.env.SOLANA_PUBLIC_KEY || "Hgby7VEo6vaPayM1G7kkjTqMAo4aCARoXA3ftWKz1m4k";
  
  const solanaActionsManifest = {
    name: "Coin Railz Payment Actions",
    description: "Solana Actions for AI agent payments and data services. Create payment intents, check token prices, get trending tokens, and whale alerts.",
    icon: `${baseUrl}/logo.jpg`,
    blockchain: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
    version: "2.4",
    
    rules: [
      {
        pathPattern: "/solana-pay/intents",
        apiPath: "/solana-pay/intents"
      },
      {
        pathPattern: "/solana-pay/services/**",
        apiPath: "/solana-pay/services/**"
      },
      {
        pathPattern: "/solana-pay/catalog",
        apiPath: "/solana-pay/catalog"
      },
      {
        pathPattern: "/solana-pay/instant-wallet",
        apiPath: "/solana-pay/instant-wallet"
      },
      {
        pathPattern: "/solana-pay/ping",
        apiPath: "/solana-pay/ping"
      }
    ],
    
    actions: [
      {
        id: "create-payment-intent",
        name: "Create Payment Intent",
        description: "Create a Solana payment intent for service access",
        href: `${baseUrl}/solana-pay/intents`,
        method: "POST",
        parameters: {
          amount: { type: "string", required: true, description: "Payment amount" },
          tokenSymbol: { type: "string", required: true, enum: ["SOL", "USDC", "USDT"] },
          serviceName: { type: "string", required: true, description: "Service to pay for" }
        },
        recipient: platformWallet
      },
      {
        id: "token-price-feed",
        name: "Token Price Feed",
        description: "Get real-time Solana token prices via Jupiter/DexScreener",
        href: `${baseUrl}/solana-pay/services/price/{mint}`,
        method: "GET",
        parameters: {
          mint: { type: "string", required: true, description: "Token mint address" }
        },
        pricing: { amount: 0.10, currency: "USDC" }
      },
      {
        id: "trending-tokens",
        name: "Trending Tokens",
        description: "Hot tokens on Solana DEXs with volume and price data",
        href: `${baseUrl}/solana-pay/services/trending`,
        method: "GET",
        parameters: {},
        pricing: { amount: 0.25, currency: "USDC" }
      },
      {
        id: "whale-alerts",
        name: "Whale Wallet Alerts",
        description: "Track large Solana wallet movements in real-time",
        href: `${baseUrl}/solana-pay/services/whale-alerts`,
        method: "GET",
        parameters: {
          wallet: { type: "string", required: false, description: "Wallet to monitor" }
        },
        pricing: { amount: 0.50, currency: "USDC" }
      },
      {
        id: "instant-solana-wallet",
        name: "Instant Solana Agent Wallet",
        description: "Create production-ready Solana wallets for AI agents via Coinbase CDP. Sub-200ms signing, 225+ TPS, enterprise-grade security.",
        href: `${baseUrl}/solana-pay/instant-wallet`,
        method: "POST",
        parameters: {
          agentId: { type: "string", required: true, description: "Unique identifier for the AI agent" },
          name: { type: "string", required: false, description: "Human-readable wallet name" }
        },
        pricing: { amount: 1.00, currency: "USDC" },
        features: [
          "Coinbase CDP Server Wallets",
          "Sub-200ms transaction signing",
          "225+ TPS throughput",
          "AWS Nitro Enclave security",
          "Policy controls"
        ]
      },
      {
        id: "solana-ping",
        name: "Solana Discovery Ping",
        description: "Service health and availability check for registry monitoring. Returns platform status, available services, and endpoint information.",
        href: `${baseUrl}/solana-pay/ping`,
        method: "GET",
        parameters: {},
        pricing: { amount: 0.25, currency: "USDC" },
        headers: {
          "x-intent-id": { type: "string", required: true, description: "Valid paid intent ID" }
        }
      }
    ],
    
    identity: {
      wallet: platformWallet,
      network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"
    },
    
    metadata: {
      version: "1.0.0",
      created: "2025-12-23",
      updated: new Date().toISOString().split('T')[0],
      contact: "support@coinrailz.com",
      documentation: `${baseUrl}/.well-known/solana.json`,
      openrpc: `${baseUrl}/solana-openrpc.json`
    }
  };
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('X-Action-Version', '1.0.0');
  res.status(200).json(solanaActionsManifest);
});

/**
 * GET /.well-known/solana-pay.json
 * 
 * Solana Pay merchant directory manifest - Required for:
 * - Solana Pay Directory (api.solanapay.com)
 * - Payment processor discovery
 * - Merchant aggregator indexing
 */
router.get('/.well-known/solana-pay.json', async (req: Request, res: Response) => {
  const baseUrl = getBaseUrl(req);
  const platformWallet = process.env.SOLANA_PUBLIC_KEY || "Hgby7VEo6vaPayM1G7kkjTqMAo4aCARoXA3ftWKz1m4k";
  
  const solanaPayManifest = {
    schema_version: "1.0.0",
    
    merchant: {
      name: "Coin Railz",
      description: "Multi-chain payment infrastructure for AI agents. Accept SOL, USDC, USDT payments with automatic webhook settlement.",
      logo: `${baseUrl}/logo.jpg`,
      website: "https://coinrailz.com",
      support_email: "support@coinrailz.com",
      category: "payment_processor"
    },
    
    payment_config: {
      recipient_wallet: platformWallet,
      network: "mainnet-beta",
      cluster: "mainnet",
      
      accepted_tokens: [
        {
          symbol: "SOL",
          mint: "native",
          decimals: 9,
          minimum: 0.001
        },
        {
          symbol: "USDC",
          mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
          decimals: 6,
          minimum: 0.25
        },
        {
          symbol: "USDT",
          mint: "Es9vMFrzaCERmnn4Xw4Jp9Dzk1XjCK8dygBBhPokv9wg",
          decimals: 6,
          minimum: 0.25
        }
      ],
      
      memo_required: true,
      memo_format: "CRPAY-[A-Z0-9]{8}",
      
      webhook: {
        url: `${baseUrl}/solana-pay/webhook`,
        events: ["payment.received", "payment.confirmed", "payment.finalized"]
      }
    },
    
    fees: {
      type: "percentage",
      rate: 0.005,
      description: "0.5% processing fee with minimums per token"
    },
    
    api_endpoints: {
      create_intent: {
        method: "POST",
        url: `${baseUrl}/solana-pay/intents`,
        description: "Create a new payment intent"
      },
      check_status: {
        method: "GET",
        url: `${baseUrl}/solana-pay/intents/{intentId}`,
        description: "Check payment intent status"
      },
      catalog: {
        method: "GET",
        url: `${baseUrl}/solana-pay/catalog`,
        description: "List available paid services"
      },
      pricing: {
        method: "GET",
        url: `${baseUrl}/solana-pay/pricing`,
        description: "Get current fee tiers"
      }
    },
    
    capabilities: [
      "intent_based_payments",
      "webhook_notifications",
      "memo_matching",
      "multi_token_support",
      "automatic_settlement"
    ],
    
    integration: {
      type: "api",
      documentation: `${baseUrl}/.well-known/solana.json`,
      openrpc_spec: `${baseUrl}/solana-openrpc.json`,
      sdk_available: false
    },
    
    metadata: {
      created: "2025-12-23",
      updated: new Date().toISOString().split('T')[0],
      version: "1.0.0"
    }
  };
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.status(200).json(solanaPayManifest);
});

/**
 * GET /.well-known/helius.json
 * 
 * Helius webhook configuration manifest
 * Documents webhook handshake for Helius integration
 */
router.get('/.well-known/helius.json', async (req: Request, res: Response) => {
  const baseUrl = getBaseUrl(req);
  
  const heliusManifest = {
    name: "Coin Railz Helius Integration",
    description: "Helius webhook receiver for Solana payment settlement",
    version: "1.0.0",
    
    webhook: {
      endpoint: `${baseUrl}/solana-pay/webhook`,
      auth_type: "authorization_header_echo",
      events_subscribed: [
        "TRANSFER",
        "TOKEN_TRANSFER"
      ],
      
      transaction_types: [
        "enhanced"
      ],
      
      addresses_monitored: [
        process.env.SOLANA_PUBLIC_KEY || "Hgby7VEo6vaPayM1G7kkjTqMAo4aCARoXA3ftWKz1m4k"
      ]
    },
    
    settlement: {
      confirmation_level: "confirmed",
      memo_matching: true,
      memo_format: "CRPAY-[A-Z0-9]{8}"
    },
    
    status_endpoint: `${baseUrl}/solana-pay/status`,
    documentation: `${baseUrl}/.well-known/solana.json`
  };
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json(heliusManifest);
});

/**
 * GET /solana-openrpc.json
 * 
 * OpenRPC specification for Solana Pay API - serves directly without Vite processing
 */
router.get('/solana-openrpc.json', async (req: Request, res: Response) => {
  const baseUrl = getBaseUrl(req);
  const platformWallet = process.env.SOLANA_PUBLIC_KEY || "Hgby7VEo6vaPayM1G7kkjTqMAo4aCARoXA3ftWKz1m4k";
  
  const openrpcSpec = {
    openrpc: "1.2.6",
    info: {
      title: "Coin Railz Solana Pay API",
      description: "Payment processing API for Solana-native AI agents. Create payment intents, check status, and access paid data services using SOL, USDC, or USDT.",
      version: "1.0.0",
      contact: {
        name: "Coin Railz Support",
        email: "support@coinrailz.com",
        url: "https://coinrailz.com"
      }
    },
    servers: [
      {
        name: "Production",
        url: `${baseUrl}/solana-pay`
      }
    ],
    methods: [
      {
        name: "createPaymentIntent",
        summary: "Create a new payment intent",
        description: "Creates a payment intent that returns a memo tag. Customer sends payment with this memo to complete the transaction.",
        tags: [{name: "payments"}],
        params: [
          { name: "amount", required: true, schema: { type: "string" } },
          { name: "tokenSymbol", required: true, schema: { type: "string", enum: ["SOL", "USDC", "USDT"] } },
          { name: "serviceName", required: true, schema: { type: "string" } }
        ],
        result: {
          name: "PaymentIntent",
          schema: {
            type: "object",
            properties: {
              id: { type: "string" },
              memoTag: { type: "string" },
              amount: { type: "string" },
              recipientAddress: { type: "string" },
              status: { type: "string" }
            }
          }
        }
      },
      {
        name: "getIntentStatus",
        summary: "Check payment intent status",
        tags: [{name: "payments"}],
        params: [
          { name: "intentId", required: true, schema: { type: "string" } }
        ],
        result: {
          name: "IntentStatus",
          schema: {
            type: "object",
            properties: {
              intentId: { type: "string" },
              status: { type: "string" },
              txSignature: { type: "string" }
            }
          }
        }
      },
      {
        name: "getCatalog",
        summary: "List available services",
        tags: [{name: "discovery"}],
        params: [],
        result: {
          name: "ServiceCatalog",
          schema: {
            type: "object",
            properties: {
              services: { type: "array" }
            }
          }
        }
      }
    ],
    components: {
      schemas: {
        PaymentIntent: {
          type: "object",
          properties: {
            id: { type: "string" },
            memoTag: { type: "string" },
            amount: { type: "string" },
            tokenSymbol: { type: "string" },
            status: { type: "string" }
          }
        }
      }
    }
  };
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json(openrpcSpec);
});

/**
 * GET /.well-known/agent-registration.json
 *
 * Machine-readable registration discovery document for AI agent frameworks.
 * 39+ unique IPs probed this path in 12h (returning 404). This endpoint
 * converts those framework-level probes into registration intent.
 *
 * Returns the registration schema, payment capabilities, and examples.
 * Side-effect free — no DB writes on GET.
 */
router.get('/.well-known/agent-registration.json', (req: Request, res: Response) => {
  const baseUrl = getBaseUrl(req);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=300');

  res.status(200).json({
    specVersion: 'coinrailz-agent-registration/1.0',
    description: `Register your AI agent with Coin Railz to access ${getCanonicalServiceCount()} x402 micropayment services across 9 chains.`,

    service: {
      name: 'Coin Railz',
      tagline: 'Multi-chain payment infrastructure for the AI agent economy',
      baseUrl,
      catalogUrl: `${baseUrl}/x402/catalog`,
      agentCardUrl: `${baseUrl}/.well-known/agent-card.json`,
      documentationUrl: `${baseUrl}/.well-known/agent-instructions.json`,
      firstCallUrl: `${baseUrl}/x402/first-call`,
      environment: 'production',
    },

    registration: {
      method: 'POST',
      endpoint: `${baseUrl}/.well-known/agent-registration.json`,
      contentType: 'application/json',
      requiredFields: ['agentName', 'walletAddress'],
      optionalFields: ['agentId', 'capabilities', 'callbackUrl', 'contactEmail', 'metadata'],
      maxPayloadBytes: 16384,
      idempotencyKey: 'walletAddress',
      rateLimit: '10 registrations per IP per minute',
    },

    identitySchema: {
      agentName: {
        type: 'string',
        minLength: 2,
        maxLength: 80,
        description: 'Human-readable display name for your agent',
      },
      agentId: {
        type: 'string',
        pattern: '^[a-zA-Z0-9._:-]{1,120}$',
        description: 'Optional stable machine identifier (e.g. my-agent:v1.2)',
      },
      walletAddress: {
        type: 'string',
        description: 'EVM (0x...) or Solana (base58) wallet that will make payments',
      },
      capabilities: {
        type: 'array',
        items: { type: 'string', maxLength: 64 },
        maxItems: 50,
        description: 'List of capabilities your agent provides (e.g. ["trading", "data-retrieval"])',
      },
      callbackUrl: {
        type: 'string',
        format: 'uri',
        pattern: '^https://',
        description: 'HTTPS URL where we can send service updates (stored only, not fetched)',
      },
      contactEmail: {
        type: 'string',
        format: 'email',
        description: 'Optional contact email for onboarding support',
      },
      metadata: {
        type: 'object',
        properties: {
          framework: { type: 'string', description: 'e.g. bun, elizaos, agentkit, custom' },
          frameworkVersion: { type: 'string' },
          description: { type: 'string', maxLength: 500 },
        },
      },
    },

    payments: {
      protocol: 'x402',
      x402Version: 2,
      supportedChains: [
        { id: 'eip155:8453', name: 'Base', token: 'USDC', contractAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
        { id: 'eip155:1', name: 'Ethereum', token: 'USDC', contractAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
        { id: 'eip155:137', name: 'Polygon', token: 'USDC', contractAddress: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' },
        { id: 'eip155:42161', name: 'Arbitrum', token: 'USDC', contractAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' },
        process.env.ROBINHOOD_CHAIN_CCTP_ENABLED === 'true'
          ? { id: 'eip155:4663', name: 'Robinhood Chain', token: 'USDC', contractAddress: process.env.USDC_ROBINHOOD_ADDRESS || '', cctpDomain: process.env.CCTP_DOMAIN_ROBINHOOD ? parseInt(process.env.CCTP_DOMAIN_ROBINHOOD, 10) : undefined }
          : { id: 'eip155:4663', name: 'Robinhood Chain', token: 'USDC', contractAddress: null, status: 'pending_cctp', note: 'Awaiting Circle CCTP domain assignment for eip155:4663. Set ROBINHOOD_CHAIN_CCTP_ENABLED=true + USDC_ROBINHOOD_ADDRESS to activate.' },
        { id: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', name: 'Solana', token: 'USDC', contractAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' },
      ],
      facilitators: {
        evm: 'https://api.cdp.coinbase.com/platform/v2/x402',
        solana: 'https://x402.dexter.cash',
      },
      pricingModel: {
        type: 'per-call',
        range: '$0.05 — $10.00 per request',
        processingFee: '1.5% + $0.01',
        lowestPrice: '$0.05 (first-call golden path)',
      },
      alternativePaymentMethods: ['credits', 'api-key', 'stripe-card'],
    },

    challengeFlow: {
      description: 'Standard x402 HTTP 402 challenge-response. Send a POST with no payment header to receive the challenge, then attach X-PAYMENT with your signed tx hash and resend.',
      steps: [
        { step: 1, action: 'POST to any /x402/* endpoint without X-PAYMENT header' },
        { step: 2, action: 'Receive HTTP 402 with payment requirements in JSON body' },
        { step: 3, action: 'Broadcast USDC transfer to the specified payTo address on-chain' },
        { step: 4, action: 'Resend original POST with X-PAYMENT: <tx_hash> header' },
        { step: 5, action: 'Receive HTTP 200 with service response' },
      ],
      sdks: {
        npm: '@coinrailz/agent-payments',
        python: 'coinrailz',
        docs: `${baseUrl}/.well-known/agent-instructions.json`,
      },
    },
    cardPaymentPath: {
      description: `EASIER ALTERNATIVE — No crypto required. One POST call with a Stripe card → receive API key → use on all ${getCanonicalServiceCount()} services instantly.`,
      endpoint: `${baseUrl}/api/m2m/credits/purchase`,
      method: 'POST',
      steps: [
        { step: 1, action: 'Create a Stripe PaymentMethod via Stripe.js or the Stripe API (pm_...)' },
        { step: 2, action: `POST to ${baseUrl}/api/m2m/credits/purchase with { paymentMethodId, amountUsd, idempotencyKey }` },
        { step: 3, action: 'Receive { apiKey: "cr_live_..." } — SAVE THIS KEY, shown once only' },
        { step: 4, action: 'Use key on any /x402/* endpoint: -H "X-API-KEY: cr_live_..."' },
      ],
      tiers: [
        { amountUsd: 5,   label: 'Intro',   calls: '~80-100 service calls', note: 'Try it — no commitment' },
        { amountUsd: 10,  label: 'Starter', calls: '~200 service calls' },
        { amountUsd: 25,  label: 'Growth',  calls: '~500 service calls', recommended: true },
        { amountUsd: 100, label: 'Pro',     calls: '~2,000 service calls' },
      ],
      statusCheckEndpoint: `${baseUrl}/api/m2m/credits/purchase/:paymentIntentId`,
    },

    support: {
      contactUrl: 'https://coinrailz.com/contact',
      docsUrl: `${baseUrl}/.well-known/agent-instructions.json`,
      firstCallEndpoint: `${baseUrl}/x402/first-call`,
      catalogEndpoint: `${baseUrl}/x402/catalog`,
    },

    examples: {
      registerRequest: {
        method: 'POST',
        url: `${baseUrl}/.well-known/agent-registration.json`,
        headers: { 'Content-Type': 'application/json' },
        body: {
          agentName: 'My AI Trading Agent',
          walletAddress: '0xYOUR_WALLET_ADDRESS',
          capabilities: ['trading', 'market-analysis'],
          metadata: { framework: 'bun', frameworkVersion: '1.3.9' },
        },
      },
      registerResponse: {
        status: 201,
        body: {
          registrationId: 'uuid',
          status: 'accepted',
          next: {
            firstCallEndpoint: `${baseUrl}/x402/first-call`,
            catalogUrl: `${baseUrl}/x402/catalog`,
            docsUrl: `${baseUrl}/.well-known/agent-instructions.json`,
            recommendedFundingToken: 'USDC',
            supportedChains: ['Base', 'Ethereum', 'Polygon', 'Arbitrum', 'Robinhood Chain', 'Solana'],
          },
        },
      },
      challengeExample: {
        step1: `curl -X POST ${baseUrl}/x402/gas-price-oracle -H 'Content-Type: application/json' -d '{"chains":["base"]}'`,
        step2: 'Receive 402 with payment requirements',
        step3: `curl -X POST ${baseUrl}/x402/gas-price-oracle -H 'Content-Type: application/json' -H 'X-PAYMENT: <base64url-signed-x402-payload>' -d '{"chains":["base"]}'`,
        step3_crypto_note: "X-PAYMENT value is a base64url-encoded signed x402 authorization — generated by a Coinbase CDP facilitator or x402-compatible client library. Raw transaction hashes are not valid x402 payment headers.",
        step3_card_alternative: {
          label: "Easier alternative — no crypto signing required",
          step1: `curl -X POST ${baseUrl}/api/m2m/credits/purchase -H 'Content-Type: application/json' -d '{"paymentMethodId":"pm_...","amountUsd":10,"idempotencyKey":"<uuid-v4>"}'`,
          step2: "Save the cr_live_... apiKey from the response",
          step3: `curl -X POST ${baseUrl}/x402/gas-price-oracle -H 'X-API-KEY: cr_live_...' -H 'Content-Type: application/json' -d '{"chains":["base"]}'`
        }
      },
    },
  });
});

/**
 * POST /.well-known/agent-registration.json
 *
 * Accepts agent self-registration. Writes to discovered_agents table with
 * source='self-registration'. Idempotent on walletAddress.
 *
 * Security:
 * - Per-IP rate limit: 10 requests/60s
 * - Body capped at 16KB (enforced by express json middleware upstream)
 * - callbackUrl stored only — never server-side fetched (SSRF prevention)
 * - walletAddress format validated (EVM 0x or Solana base58)
 * - Duplicate suppression on walletAddress (409 with existing registrationId)
 */
router.post('/.well-known/agent-registration.json', async (req: Request, res: Response) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
    || req.socket?.remoteAddress
    || 'unknown';

  if (!checkRegistrationRateLimit(ip)) {
    return res.status(429).json({
      error: 'RATE_LIMITED',
      message: 'Too many registration attempts. Maximum 10 per minute per IP.',
      retryAfterSeconds: 60,
    });
  }

  const body = req.body || {};

  // Required field validation
  const agentName = typeof body.agentName === 'string' ? body.agentName.trim() : '';
  const walletAddress = typeof body.walletAddress === 'string' ? body.walletAddress.trim() : '';

  if (!agentName || agentName.length < 2 || agentName.length > 80) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      field: 'agentName',
      message: 'agentName is required and must be 2–80 characters.',
    });
  }

  if (!walletAddress) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      field: 'walletAddress',
      message: 'walletAddress is required (EVM 0x... or Solana base58).',
    });
  }

  // Wallet format validation: EVM (0x + 40 hex chars) or Solana (base58, 32-44 chars)
  const isEvmWallet = /^0x[0-9a-fA-F]{40}$/.test(walletAddress);
  const isSolanaWallet = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(walletAddress);
  if (!isEvmWallet && !isSolanaWallet) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      field: 'walletAddress',
      message: 'walletAddress must be a valid EVM address (0x...) or Solana base58 address.',
    });
  }

  // Optional fields — sanitised
  const agentId = typeof body.agentId === 'string'
    ? body.agentId.trim().substring(0, 120) : null;
  const capabilities = Array.isArray(body.capabilities)
    ? body.capabilities.slice(0, 50).map((c: any) => String(c).substring(0, 64))
    : [];
  const callbackUrl = typeof body.callbackUrl === 'string'
    && body.callbackUrl.startsWith('https://')
    ? body.callbackUrl.trim().substring(0, 500) : null;
  const contactEmail = typeof body.contactEmail === 'string'
    ? body.contactEmail.trim().substring(0, 254) : null;
  const metadata = typeof body.metadata === 'object' && body.metadata !== null
    ? body.metadata : {};

  // Build a chain-aware canonical key for the discovered_agents.url unique index.
  // EVM addresses are case-insensitive (lowercase). Solana base58 is case-sensitive (preserve exact).
  const registrationUrl = isEvmWallet
    ? `self-registration:evm:${walletAddress.toLowerCase()}`
    : `self-registration:solana:${walletAddress}`;

  const baseUrl = getBaseUrl(req);

  // Shared 201 next-steps payload — included in both first registration and 409 idempotent replay
  const buildNext = (regId: string, regStatus: string) => ({
    registrationId: regId,
    status: regStatus,
    firstCallEndpoint: `${baseUrl}/x402/first-call`,
    catalogUrl: `${baseUrl}/x402/catalog`,
    docsUrl: `${baseUrl}/.well-known/agent-instructions.json`,
    agentCardUrl: `${baseUrl}/.well-known/agent-card.json`,
    recommendedFundingToken: 'USDC',
    recommendedChain: isEvmWallet ? 'Base (eip155:8453)' : 'Solana (mainnet-beta)',
    // RECOMMENDED: card purchase → instant API key — no crypto required, works in ~60 seconds
    cardPaymentPath: {
      label: 'RECOMMENDED — Get started in ~60 seconds, no crypto required',
      description: `Purchase credits with a card and get an API key in one call. Key works on all ${getCanonicalServiceCount()} /x402/* services immediately.`,
      endpoint: `${baseUrl}/api/m2m/credits/purchase`,
      method: 'POST',
      tiers: [
        { amountUsd: 5,   label: 'Intro',   calls: '~80-100 service calls', note: 'Try it — no commitment' },
        { amountUsd: 10,  label: 'Starter', calls: '~200 service calls' },
        { amountUsd: 25,  label: 'Growth',  calls: '~500 service calls', recommended: true },
        { amountUsd: 100, label: 'Pro',     calls: '~2,000 service calls' },
      ],
      requiredFields: ['paymentMethodId', 'amountUsd', 'idempotencyKey'],
      exampleRequest: {
        paymentMethodId: 'pm_...',
        amountUsd: 10,
        idempotencyKey: 'your-unique-uuid-v4',
        email: 'agent@yourdomain.com',
      },
      onSuccess: 'Returns { apiKey, keyPrefix, creditsAdded, newBalance } — save the apiKey immediately',
      apiKeyUsage: 'Pass as X-API-KEY header on any /x402/* request. Credits deducted per call.',
      statusCheckEndpoint: `${baseUrl}/api/m2m/credits/purchase/:paymentIntentId`,
    },
    // ADVANCED ALTERNATIVE: on-chain USDC via x402 protocol (requires funded crypto wallet)
    challengeFlow: {
      label: 'Advanced — On-chain USDC payment via x402 (crypto wallet required)',
      minimumPayment: '$0.05 USDC on Base or Ethereum',
      step1: {
        description: 'Send POST without X-PAYMENT to receive the 402 challenge (gives you payTo address and exact amount)',
        curl: `curl -X POST ${baseUrl}/x402/first-call -H 'Content-Type: application/json' -d '{}'`,
        expectedResponse: 'HTTP 402 with JSON body containing payTo, amount, chain, and facilitatorUrl',
      },
      step2: {
        description: 'Broadcast USDC transfer on-chain, then resend with X-PAYMENT header',
        curl: `curl -X POST ${baseUrl}/x402/first-call -H 'Content-Type: application/json' -H 'X-PAYMENT: <your_tx_hash>' -d '{}'`,
        expectedResponse: 'HTTP 200 with onboarding receipt and next-service templates',
      },
    },
  });

  const buildLinks = () => ({
    agentCard: `${baseUrl}/.well-known/agent-card.json`,
    instructions: `${baseUrl}/.well-known/agent-instructions.json`,
    catalog: `${baseUrl}/x402/catalog`,
    support: 'https://coinrailz.com/contact',
  });

  try {
    // Atomic insert-first idempotency: attempt insert and catch unique constraint violation
    // instead of SELECT-then-INSERT (which has a race condition under concurrency).
    const [inserted] = await db
      .insert(discoveredAgents)
      .values({
        url: registrationUrl,
        source: 'self-registration',
        wallet: walletAddress,
        status: 'new',
        capabilities: capabilities.length > 0 ? capabilities : null,
        metadata: {
          agentName,
          agentId: agentId || undefined,
          callbackUrl: callbackUrl || undefined,
          contactEmail: contactEmail || undefined,
          framework: metadata.framework || undefined,
          frameworkVersion: metadata.frameworkVersion || undefined,
          description: typeof metadata.description === 'string'
            ? metadata.description.substring(0, 500) : undefined,
          registeredVia: '/.well-known/agent-registration.json',
          registeredAt: new Date().toISOString(),
          registrantIp: ip,
          userAgent: (req.headers['user-agent'] || '').substring(0, 200),
        },
      })
      .onConflictDoNothing()
      .returning({ id: discoveredAgents.id });

    if (!inserted) {
      // Unique constraint fired — fetch the existing record and return 409
      const [existing] = await db
        .select({ id: discoveredAgents.id, status: discoveredAgents.status })
        .from(discoveredAgents)
        .where(eq(discoveredAgents.url, registrationUrl))
        .limit(1);

      const existingId = existing ? String(existing.id) : 'unknown';
      const existingStatus = existing?.status || 'new';

      return res.status(409).json({
        error: 'ALREADY_REGISTERED',
        message: 'This wallet address is already registered. Your existing registration is still active.',
        next: buildNext(existingId, existingStatus),
        links: buildLinks(),
      });
    }

    console.log(`✅ Agent self-registration: ${agentName} | wallet: ${walletAddress.substring(0, 10)}... | chain: ${isEvmWallet ? 'evm' : 'solana'} | ip: ${ip} | id: ${inserted.id}`);

    return res.status(201).json({
      message: `Welcome, ${agentName}. Your agent is registered. Follow the challengeFlow below to make your first payment.`,
      next: buildNext(String(inserted.id), 'new'),
      links: buildLinks(),
    });
  } catch (err: any) {
    console.error('❌ Agent registration error:', err?.message || err);
    return res.status(500).json({
      error: 'REGISTRATION_FAILED',
      message: 'Registration could not be saved. Please try again.',
    });
  }
});

/**
 * Canonical redirect: /.well-known/x402 (without .json) -> /.well-known/x402.json
 * Some distributed actors monitor this path without the extension.
 * Permanent 301 so crawlers and cached clients update their bookmarks.
 */
router.get('/.well-known/x402', (req: Request, res: Response) => {
  res.redirect(301, '/.well-known/x402.json');
});

router.head('/.well-known/x402', (req: Request, res: Response) => {
  res.redirect(301, '/.well-known/x402.json');
});

/**
 * GET /.well-known/mpp.json — MPP (Machine Payments Protocol) service manifest
 *
 * Consumed by:
 *   - mpp-registry-cross-protocol-sync (already crawling as of March 20, 2026)
 *   - mppx CLI discovery
 *   - Tempo wallet service finder
 *   - Any MPP-native agent calling GET /.well-known/mpp.json
 *
 * Spec: https://mpp.dev
 */
router.get('/.well-known/mpp.json', (req: Request, res: Response) => {
  const baseUrl = getBaseUrl(req);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.json({
    schema: "https://mpp.dev/schema/service-manifest.json",
    schemaVersion: MPP_PROTOCOL_VERSION,
    provider: {
      name: "Coin Railz",
      url: baseUrl,
      description: `Multi-chain AI agent payment infrastructure. ${getCanonicalServiceCount()} services across 9 blockchains. Pay with pathUSD via Tempo or USDC via x402.`,
      contact: "support@coinrailz.com",
    },
    protocol: "mpp",
    protocolVersion: MPP_PROTOCOL_VERSION,
    catalogUrl: `${baseUrl}/mpp/catalog`,
    challengeScheme: "WWW-Authenticate: Payment challenge=<base64-challenge-json>",
    credentialScheme: "Authorization: Payment <base64-credential-json>",
    settlementCurrency: "pathUSD",
    settlementNetwork: "Tempo",
    tempoRecipient: process.env.PLATFORM_WALLET_ADDRESS || "0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91",
    services: [
      {
        id: "ping",
        name: "Ping / Echo",
        url: `${baseUrl}/mpp/ping`,
        method: "POST",
        amount: "0.25",
        currency: "pathUSD",
        description: "Lowest-cost discovery endpoint. Verify MPP payment flow.",
        tags: ["discovery", "echo", "test"],
      },
      {
        id: "first-call",
        name: "First Paid Call (Golden Path)",
        url: `${baseUrl}/mpp/first-call`,
        method: "POST",
        amount: "0.05",
        currency: "pathUSD",
        description: "Canonical $0.05 onboarding endpoint for new agents.",
        tags: ["onboarding", "golden-path"],
      },
      {
        id: "ai-inference",
        name: "AI Inference (GPT-4o-mini)",
        url: `${baseUrl}/mpp/ai-inference`,
        method: "POST",
        amount: "0.05",
        currency: "pathUSD",
        description: "GPT-4o-mini inference. $0.05 per call.",
        tags: ["ai", "llm", "inference", "openai"],
        inputSchema: {
          type: "object",
          properties: {
            prompt: { type: "string", description: "User prompt" },
            systemPrompt: { type: "string", description: "System prompt (optional)" },
            maxTokens: { type: "integer", description: "Max tokens (default 1024, max 4096)" },
          },
          required: ["prompt"],
        },
      },
      {
        id: "gas-price-oracle",
        name: "Gas Price Oracle",
        url: `${baseUrl}/mpp/gas-price-oracle`,
        method: "POST",
        amount: "0.10",
        currency: "pathUSD",
        description: "Real-time gas prices for Ethereum, Base, Polygon, BSC, Arbitrum, Optimism.",
        tags: ["gas", "ethereum", "multi-chain", "defi"],
        inputSchema: {
          type: "object",
          properties: {
            chains: { type: "array", items: { type: "string" }, description: "Chains to check (default: ethereum, base, polygon)" },
          },
        },
      },
      {
        id: "token-metadata",
        name: "Token Metadata",
        url: `${baseUrl}/mpp/token-metadata`,
        method: "POST",
        amount: "0.10",
        currency: "pathUSD",
        description: "Token name, symbol, decimals, and contract info across chains.",
        tags: ["tokens", "metadata", "crypto"],
        inputSchema: {
          type: "object",
          properties: {
            tokenAddress: { type: "string", description: "Token contract address" },
            chain: { type: "string", description: "Blockchain (ethereum, base, polygon, etc.)" },
          },
          required: ["tokenAddress", "chain"],
        },
      },
    ],
    crossProtocolAlternatives: {
      x402: {
        description: "Pay with USDC on Base or Ethereum via x402 (Coinbase Bazaar compatible)",
        manifest: `${baseUrl}/.well-known/x402.json`,
        catalog: `${baseUrl}/x402/catalog`,
      },
      apiKey: {
        description: "Prepaid credits via API key. Free $5 trial, no crypto required.",
        trial: `${baseUrl}/api/m2m/credits/trial`,
        purchase: `${baseUrl}/api/m2m/credits/checkout/session`,
      },
    },
    agentCard: `${baseUrl}/.well-known/agent-card.json`,
    openapi: `${baseUrl}/openapi.json`,
    updatedAt: new Date().toISOString(),
  });
});

/**
 * GET /.well-known/webmcp.json
 *
 * Web Model Context Protocol (WebMCP) manifest.
 * Describes Coin Railz as an HTTP-accessible MCP server, allowing LLM clients
 * (Claude, Cursor, GPT, etc.) and MCP crawlers to discover and connect to
 * Coin Railz services via the MCP tool-call protocol over HTTPS.
 *
 * Consumers: AWI-Crawler/1.0, MCP client auto-configuration, IDE plugins.
 */
router.get('/.well-known/webmcp.json', (req: Request, res: Response) => {
  const baseUrl = getBaseUrl(req);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.json({
    schema: "https://webmcp.dev/schema/manifest.json",
    schemaVersion: "1.0",
    name: "Coin Railz x402 Payment Infrastructure",
    description: `Production-grade multi-chain payment infrastructure for AI agents and MCP servers. ${getCanonicalServiceCount()} services across 9 blockchains. Pay-per-call via USDC/x402 or prepaid API-key credits. Includes USDC Yield Vault (ERC-4626 on Base, auto-routing across Aave v3/Compound v3/Morpho Blue), NASA Earthdata Intelligence, AI Inference, IoT/DePIN, Prediction Markets, and more. No account required for trial.`,
    version: "1.0.0",
    provider: {
      name: "Coin Railz",
      url: baseUrl,
      contact: "support@coinrailz.com",
    },
    mcpServers: {
      coinrailz: {
        type: "http",
        url: `${baseUrl}/mcp`,
        description: `MCP JSON-RPC 2.0 transport. Handles initialize, tools/list, tools/call for ${getCanonicalServiceCount()} paid services. Pay-per-call via USDC/x402 or prepaid API-key credits.`,
        authentication: {
          modes: ["x-api-key", "x402"],
          trialKey: {
            description: "Free $5 trial API key — instant, no crypto, no account",
            endpoint: `${baseUrl}/api/m2m/credits/trial`,
            method: "GET",
            header: "X-API-KEY: cr_live_...",
          },
          x402: {
            description: "On-chain USDC payment via x402 protocol (EIP-7615). Supported chains: Base, Ethereum, Polygon, Arbitrum, Solana.",
            challengeHeader: "WWW-Authenticate",
            paymentHeader: "X-Payment",
            facilitators: ["cdp.coinbase.com", "dexter.cash"],
          },
        },
        capabilities: {
          toolDiscovery: true,
          paidToolExecution: true,
          freeTrialAvailable: true,
          streamingSupported: false,
        },
        endpoints: {
          serviceList: `${baseUrl}/mcp/services`,
          checkout: `${baseUrl}/api/mcp/payments/checkout`,
          services: `${baseUrl}/api/mcp/payments/services`,
          health: `${baseUrl}/api/mcp/payments/health`,
          trial: `${baseUrl}/api/m2m/credits/trial`,
          purchase: `${baseUrl}/api/m2m/credits/checkout/session`,
        },
      },
    },
    protocols: ["x402", "MCP", "WebMCP", "A2A", "MPP"],
    openapi: `${baseUrl}/openapi.json`,
    agentCard: `${baseUrl}/.well-known/agent-card.json`,
    integrationGuide: `${baseUrl}/mcp-integration-guide`,
    updatedAt: new Date().toISOString(),
  });
});

/**
 * GET /.well-known/awi.json
 *
 * Agent Web Interface (AWI) manifest.
 * Describes Coin Railz identity, capabilities, interaction endpoints, and
 * payment onboarding for AWI-aware agent registries and crawlers.
 *
 * Consumers: AWI-Crawler/1.0, agent registries, emerging AWI-native frameworks.
 */
router.get('/.well-known/awi.json', (req: Request, res: Response) => {
  const baseUrl = getBaseUrl(req);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.json({
    schema: "https://awi.dev/schema/v1",
    version: "1.0",
    id: "coinrailz-x402-infrastructure",
    name: "Coin Railz",
    canonicalUrl: baseUrl,
    description: `Universal payment rail for the AI agent economy. ${getCanonicalServiceCount()} pay-per-call services across 9 blockchains (8 EVM + Solana): financial data, satellite intelligence (NASA Earthdata), AI inference, DeFi analytics, IoT/DePIN, prediction markets, and more. Includes USDC Yield Vault (ERC-4626 on Base, auto-routing across Aave v3/Compound v3/Morpho Blue) — earn yield on idle USDC with no lockup. Settles in USDC. API-key credits path requires no crypto wallet.`,
    version_platform: "2.3.0",
    protocols: ["x402", "WebMCP", "A2A", "MPP", "OpenAPI"],
    capabilities: [
      {
        id: "ai-inference",
        name: "AI Inference (GPT-4o-mini)",
        description: "Pay-per-call LLM inference. $0.05/call.",
        endpoint: `${baseUrl}/x402/ai-inference`,
        price: "$0.05 USDC",
      },
      {
        id: "first-call",
        name: "First Paid Call (Golden Path)",
        description: "Canonical $0.05 onboarding endpoint for new agents. Start here.",
        endpoint: `${baseUrl}/x402/first-call`,
        price: "$0.05 USDC",
      },
      {
        id: "satellite-earthdata",
        name: "NASA Earthdata Intelligence Gateway",
        description: "NASA Earthdata gateway: precipitation, granule search, SST, soil moisture, ocean color. Pass ?product= to select. $0.25/call.",
        endpoint: `${baseUrl}/x402/satellite-earthdata`,
        price: "$0.25 USDC",
      },
      {
        id: "earthdata-granules",
        name: "NASA CMR Granule Search",
        description: "Search 1B+ NASA satellite granules by bbox, date, platform, and cloud cover. Returns metadata + download URLs. $0.25/call.",
        endpoint: `${baseUrl}/x402/earthdata-granules`,
        price: "$0.25 USDC",
      },
      {
        id: "earthdata-precipitation",
        name: "NASA GPM Precipitation",
        description: "Observed satellite rain rate at any global coordinate. GPM IMERG — actual measurement, not a forecast. $0.25/call.",
        endpoint: `${baseUrl}/x402/earthdata-precipitation`,
        price: "$0.25 USDC",
      },
      {
        id: "earthdata-sst",
        name: "NASA MUR Sea Surface Temperature",
        description: "Sea surface temperature from NASA MUR-SST Level 4 analysis. 1km resolution, daily. $0.25/call.",
        endpoint: `${baseUrl}/x402/earthdata-sst`,
        price: "$0.25 USDC",
      },
      {
        id: "earthdata-soil-moisture",
        name: "NASA SMAP Soil Moisture",
        description: "SMAP L3 daily soil moisture for any coordinate. 36km resolution, 2-3 day repeat cycle. $0.25/call.",
        endpoint: `${baseUrl}/x402/earthdata-soil-moisture`,
        price: "$0.25 USDC",
      },
      {
        id: "earthdata-ocean-color",
        name: "NASA MODIS Ocean Color",
        description: "MODIS-Aqua chlorophyll-a and ocean color at any coastal or ocean coordinate. Daily 4km composites. $0.25/call.",
        endpoint: `${baseUrl}/x402/earthdata-ocean-color`,
        price: "$0.25 USDC",
      },
      {
        id: "gas-price-oracle",
        name: "Gas Price Oracle",
        description: "Real-time gas prices across 6 EVM chains.",
        endpoint: `${baseUrl}/x402/gas-price-oracle`,
        price: "$0.10 USDC",
      },
      {
        id: "base-usdc-yield-vault",
        name: "USDC Yield Vault (Base) — ERC-4626 Auto-Routing Yield",
        description: "Non-custodial USDC yield vault on Base. Auto-routes to highest APY across Aave v3, Compound v3, and Morpho Blue. No lockup. 0.5% entry, 15% performance fee on yield only, 0% exit fee. AgentKit: npm install coinrailz-agentkit. Deposit endpoint: /api/yield/deposit-tx",
        endpoint: `${baseUrl}/api/yield/manifest`,
        price: "0.5% entry fee",
        vaultAddress: (process.env.YIELD_VAULT_ADDRESS ?? 'deploying-soon'),
        shareToken: "crUSDC",
        standard: "ERC-4626",
        chainId: 8453,
      },
      {
        id: "robinhood-token-price",
        name: "Robinhood Chain Token Price",
        description: "Real-time token price on Robinhood Chain from the highest-liquidity DEX pool. Best price, 24h change, pool breakdown. $0.60/call.",
        endpoint: `${baseUrl}/x402/robinhood-token-price`,
        price: "$0.60 USDC",
      },
      {
        id: "robinhood-dex-pools",
        name: "Robinhood Chain DEX Pools",
        description: "Top DEX liquidity pools on Robinhood Chain. Fee tier, 24h volume, TVL, price. Ideal for routing and arbitrage agents. $1.25/call.",
        endpoint: `${baseUrl}/x402/robinhood-dex-pools`,
        price: "$1.25 USDC",
      },
      {
        id: "robinhood-chain-stats",
        name: "Robinhood Chain Stats",
        description: "Live chain-wide stats: block, gas price, total DEX pools, 24h volume, liquidity, top tokens. $0.75/call.",
        endpoint: `${baseUrl}/x402/robinhood-chain-stats`,
        price: "$0.75 USDC",
      },
      {
        id: "fleet-telematics",
        name: "Fleet Telematics",
        description: "Real-time GPS, fuel, speed, and diagnostics for IoT-connected vehicle fleets. $0.10/call.",
        endpoint: `${baseUrl}/x402/fleet-telematics`,
        price: "$0.10 USDC",
      },
      {
        id: "iot-sensor-reading",
        name: "IoT Sensor Reading",
        description: "Single-sensor telemetry from registered IoT devices: temperature, humidity, pressure, CO2, motion. $0.05/call.",
        endpoint: `${baseUrl}/x402/iot-sensor-reading`,
        price: "$0.05 USDC",
      },
      {
        id: "iot-bulk-data",
        name: "IoT Bulk Data Export",
        description: "Historical bulk export of sensor readings with time-range filtering across device fleets. $0.25/call.",
        endpoint: `${baseUrl}/x402/iot-bulk-data`,
        price: "$0.25 USDC",
      },
      {
        id: "rwa-nav-oracle",
        name: "RWA Synthetic NAV Oracle",
        description: "Synthetic market-based NAV estimate for RWA tokens (real estate, private credit, tokenized treasuries). EIP-712 signed attestation on Base. Informational only. $0.50/call.",
        endpoint: `${baseUrl}/x402/rwa-nav-oracle`,
        price: "$0.50 USDC",
      },
      {
        id: "tokenized-yield-compare",
        name: "Tokenized Treasury Yield Comparison",
        description: "Live APY comparison across tokenized RWA protocols: Ondo (USDY), Backed (bIB01), Superstate (USTB), Mountain Protocol (USDM), OpenEden (TBILL), Hashnote (USYC), Maple Finance. DeFi Llama sourced. $0.25/call.",
        endpoint: `${baseUrl}/x402/tokenized-yield-compare`,
        price: "$0.25 USDC",
      },
      {
        id: "vlt-usdc-deposit",
        name: "vltUSDC Vault Deposit (Bankroll Network)",
        description: "FREE — Unsigned ERC-4626 calldata for the Bankroll Network vltUSDC vault on Ethereum. No payment required. Send {amountUsdc, recipient}, vault zaps USDC into VLT/WETH LP, mints vltUSDC shares. Builder Pattern — zero custody.",
        endpoint: `${baseUrl}/x402/vlt-usdc-deposit`,
        price: "free",
      },
      {
        id: "vlt-usdc-withdraw",
        name: "vltUSDC Vault Withdraw (Bankroll Network)",
        description: "FREE — Unsigned vault.redeem calldata for exiting the Bankroll Network vltUSDC vault on Ethereum. Send {shares, recipient}, receive 1 unsigned tx with live slippage floors for VLT + USDC output. Completes the deposit→earn→withdraw lifecycle.",
        endpoint: `${baseUrl}/x402/vlt-usdc-withdraw`,
        price: "free",
      },
      {
        id: "catalog",
        name: "Full Service Catalog",
        description: `${getCanonicalServiceCount()} services with pricing, schemas, and endpoints.`,
        endpoint: `${baseUrl}/x402/catalog`,
        price: "free",
      },
    ],
    interactionEndpoints: {
      a2a: `${baseUrl}/a2a/v1/message/send`,
      checkout: `${baseUrl}/api/mcp/payments/checkout`,
      serviceList: `${baseUrl}/mcp/services`,
    },
    authentication: {
      modes: ["X-API-Key", "x402", "Bearer"],
      onboarding: {
        fastest: {
          label: "Free $5 trial key — instant, no crypto",
          endpoint: `${baseUrl}/api/m2m/credits/trial`,
          method: "GET",
        },
        card: {
          label: "Stripe hosted checkout — pay by card",
          endpoint: `${baseUrl}/api/m2m/credits/checkout/session`,
          method: "POST",
        },
        onChain: {
          label: "x402 USDC on Base or Ethereum",
          spec: "https://x402.org",
          facilitators: ["cdp.coinbase.com", "dexter.cash"],
        },
      },
    },
    pricing: {
      model: "pay-per-call",
      settlementCurrency: "USDC",
      settlementChains: ["Base", "Ethereum", "Polygon", "Arbitrum", "Solana"],
      processingFee: "1.5% + $0.01/tx",
      range: "$0.05–$10.00 per call",
      freeTrial: "$5 USDC equivalent, no payment required",
    },
    discovery: {
      x402Manifest: `${baseUrl}/.well-known/x402.json`,
      agentCard: `${baseUrl}/.well-known/agent-card.json`,
      openapi: `${baseUrl}/openapi.json`,
      mppManifest: `${baseUrl}/.well-known/mpp.json`,
      webmcp: `${baseUrl}/.well-known/webmcp.json`,
    },
    integrationGuide: `${baseUrl}/mcp-integration-guide`,
    updatedAt: new Date().toISOString(),
  });
});

/**
 * GET /.well-known/mcp-integration.json
 *
 * Machine-readable MCP developer integration guide.
 * Targeted at developers building MCP servers or agent frameworks that wrap
 * Coin Railz services. Explains both payment paths with copy-paste examples.
 */
router.get('/.well-known/mcp-integration.json', (req: Request, res: Response) => {
  const baseUrl = getBaseUrl(req);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.json({
    title: "Coin Railz MCP Integration Guide",
    version: "1.0.0",
    audience: "Developers building MCP servers, LLM agent frameworks, or tool plugins that call Coin Railz services.",
    summary: "If you are building an MCP wrapper for Coin Railz and are stuck at the payment step: skip on-chain complexity entirely. Use Path A (API key credits) to get paid access in under 60 seconds.",
    paths: {
      pathA: {
        label: "Path A — API Key Credits (Fastest, no crypto required)",
        steps: [
          {
            step: 1,
            action: "Get your free trial key",
            method: "GET",
            endpoint: `${baseUrl}/api/m2m/credits/trial`,
            curl: `curl ${baseUrl}/api/m2m/credits/trial`,
            response: { apiKey: "cr_live_...", credits: 5, expiresIn: "7 days" },
            note: "SAVE the apiKey — returned once only. $5 credit, good for ~80–100 calls.",
          },
          {
            step: 2,
            action: "Call any service with your key",
            method: "POST",
            endpoint: `${baseUrl}/x402/{serviceId}`,
            curl: `curl -X POST ${baseUrl}/x402/gas-price-oracle -H 'X-API-KEY: cr_live_...' -H 'Content-Type: application/json' -d '{}'`,
            billingHeaders: {
              "X-Credits-Used": "credits deducted for this call",
              "X-Credits-Remaining": "your remaining balance",
              "X-Recharge-Url": "link to buy more credits",
            },
          },
          {
            step: 3,
            action: "Buy more credits when trial runs out",
            method: "POST",
            endpoint: `${baseUrl}/api/m2m/credits/checkout/session`,
            curl: `curl -X POST ${baseUrl}/api/m2m/credits/checkout/session -H 'Content-Type: application/json' -d '{"amount": 10}'`,
            note: "Returns a Stripe hosted checkout URL. Complete in browser. API key is auto-provisioned within ~60s of payment.",
          },
        ],
      },
      pathB: {
        label: "Path B — Native x402 On-Chain USDC (for crypto-native agents)",
        description: "Standard x402 protocol (EIP-7615). Call endpoint → receive 402 challenge → construct payment header → retry with payment.",
        steps: [
          {
            step: 1,
            action: "Call any x402 endpoint — receive 402 challenge",
            curl: `curl -X POST ${baseUrl}/x402/gas-price-oracle -H 'Content-Type: application/json' -d '{}'`,
            response402: { status: 402, headers: { "WWW-Authenticate": "Payment ..." } },
          },
          {
            step: 2,
            action: "Parse challenge, construct X-Payment header",
            note: "Use the x402 SDK: https://github.com/coinbase/x402 or Dexter at https://dexter.cash",
            sdks: {
              typescript: "npm install x402",
              python: "pip install x402",
            },
          },
          {
            step: 3,
            action: "Retry with payment header",
            curl: `curl -X POST ${baseUrl}/x402/gas-price-oracle -H 'Content-Type: application/json' -H 'X-Payment: <base64-payload>' -d '{}'`,
            facilitators: ["cdp.coinbase.com", "dexter.cash"],
          },
        ],
      },
    },
    serviceDiscovery: {
      catalog: `${baseUrl}/x402/catalog`,
      mcpServices: `${baseUrl}/mcp/services`,
      openapi: `${baseUrl}/openapi.json`,
    },
    mcpServiceMap: serviceCatalogService.getCatalog().services.map(s => ({
      mcpTool: s.id.replace(/-/g, '_'),
      serviceId: s.id,
      endpoint: `${baseUrl}${s.endpoint}`,
      priceUsd: getServicePriceUSD(s.id as ServiceName) || 0.25,
      method: "POST",
      inputSchema: (serviceCatalogService.getCatalog() as any).skills?.find((sk: any) => sk.id === s.id)?.inputSchema || { type: "object", properties: {} }
    })),
    support: {
      email: "support@coinrailz.com",
      humanGuide: `${baseUrl}/mcp-integration-guide`,
    },
  });
});

/**
 * GET /.well-known/agent-directory.json
 *
 * OASF-compatible agent directory listing all hosted agents on this platform.
 * Consumed by:
 *   - AgenstryBot/0.3.0 (+https://agenstry.com/bot) — has probed this path twice
 *   - Any OASF/AgentDirectory-aware crawler
 *
 * Spec: https://oasf.agentprotocol.xyz
 */
router.get('/.well-known/agent-directory.json', (req: Request, res: Response) => {
  const baseUrl = getBaseUrl(req);
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({
    schema: 'https://oasf.agentprotocol.xyz/schema/agent-directory/v1',
    schemaVersion: '1.0',
    platform: {
      name: 'Coin Railz',
      url: baseUrl,
      description: `Multi-chain AI agent payment infrastructure. ${getCanonicalServiceCount()} x402 micropayment services across 9 blockchains (8 EVM + Solana), settling in USDC.`,
      contact: 'support@coinrailz.com',
      agentCard: `${baseUrl}/.well-known/agent.json`,
      x402Manifest: `${baseUrl}/.well-known/x402.json`,
      serviceManifest: `${baseUrl}/.well-known/x402-services.json`,
    },
    agents: [
      {
        id: 'coinrailz-payment-infrastructure',
        name: 'Coin Railz Multi-Chain Payment Infrastructure',
        description: `Production-grade x402 USDC payment infrastructure for AI agents. ${getCanonicalServiceCount()} micropayment services across 9 blockchains (Base, Ethereum, Polygon, Arbitrum, Optimism, BSC, Avalanche, Robinhood Chain + Solana). Categories: Crypto Intelligence, Trading, Market Intelligence, Prediction Markets (Kalshi/Polymarket), Satellite Intelligence (NASA/ESA), IoT/DePIN, AI Inference, Real Estate, Banking, Compliance.`,
        url: baseUrl,
        endpoint: `${baseUrl}/a2a/v1/message/send`,
        agentCard: `${baseUrl}/.well-known/agent.json`,
        protocol: 'a2a',
        version: '0.3',
        type: 'infrastructure',
        capabilities: [
          'x402_payments',
          'multi_chain_usdc',
          'agent_wallet_creation',
          'ai_inference_gateway',
          'satellite_data',
          'iot_depin_data',
          'prediction_markets',
          'defi_intelligence',
          'compliance',
          'sdk_evm',
          'sdk_solana',
        ],
        pricing: {
          model: 'pay-per-call',
          currency: 'USDC',
          range: '$0.05–$2.00 per call',
          trialKey: `${baseUrl}/api/m2m/credits/trial`,
        },
        networks: ['base', 'ethereum', 'polygon', 'arbitrum', 'optimism', 'bsc', 'avalanche', 'solana'],
        settlementCurrency: 'USDC',
        status: 'active',
      },
      {
        id: 'coinrailz-payment-processor',
        name: 'Coin Railz Payment Processor',
        description: 'USDC payment processing with Coinbase CDP integration. Instant settlements, x402 protocol support, multi-chain payments. Handles Base + Solana x402 challenges and Stripe card payments.',
        url: baseUrl,
        endpoint: `${baseUrl}/x402/first-call`,
        protocol: 'x402',
        type: 'service',
        capabilities: ['payment_processing', 'usdc_transfers', 'x402_payments', 'multi_chain', 'instant_settlement'],
        pricing: { model: 'pay-per-call', price: 0.05, currency: 'USDC' },
        status: 'active',
      },
      {
        id: 'coinrailz-compliance-consultant',
        name: 'Coin Railz Compliance Consultant',
        description: 'Regulatory compliance guidance for crypto and fintech. KYC/AML requirements, licensing analysis, securities law review. $0.50/call via x402 USDC on Base.',
        url: baseUrl,
        endpoint: `${baseUrl}/x402/compliance-consultation`,
        protocol: 'x402',
        type: 'service',
        capabilities: ['regulatory_compliance', 'kyc_aml', 'licensing_analysis', 'securities_law', 'risk_assessment'],
        pricing: { model: 'pay-per-call', price: 0.50, currency: 'USDC' },
        status: 'active',
      },
      {
        id: 'coinrailz-smart-contract-auditor',
        name: 'Coin Railz Smart Contract Auditor',
        description: 'Professional Solidity smart contract security audits using static analysis. Vulnerability detection, gas optimization, and security scoring. $1.00/call via x402 USDC on Base.',
        url: baseUrl,
        endpoint: `${baseUrl}/x402/smart-contract-audit`,
        protocol: 'x402',
        type: 'service',
        capabilities: ['smart_contract_audit', 'security_analysis', 'vulnerability_detection', 'gas_optimization'],
        pricing: { model: 'pay-per-call', price: 1.00, currency: 'USDC' },
        status: 'active',
      },
      {
        id: 'coinrailz-ai-inference-gateway',
        name: 'Coin Railz AI Inference Gateway',
        description: 'Pay-per-call LLM endpoint supporting GPT-4o, GPT-4o-mini, and GPT-3.5-turbo via USDC on Base. Use when agent needs AI completions without an OpenAI API key.',
        url: baseUrl,
        endpoint: `${baseUrl}/x402/ai-inference`,
        protocol: 'x402',
        type: 'service',
        capabilities: ['llm_inference', 'gpt4o', 'gpt4o_mini', 'gpt35_turbo', 'usdc_payments'],
        pricing: { model: 'pay-per-call', price: 0.05, currency: 'USDC' },
        status: 'active',
      },
    ],
    registrationEndpoint: `${baseUrl}/api/agent/register`,
    a2aEndpoint: `${baseUrl}/a2a/v1/message/send`,
    total: 5,
    updated: new Date().toISOString(),
  });
});

/**
 * GET /.well-known/x402-services.json
 *
 * ARI (Autonomous Resource Indexer) v2 per-service catalog.
 * ari-indexer/2.0 has polled this path every 15 minutes since May 27, 2026
 * (50+ consecutive 404s). Returns a flat service list in ARI v2 format.
 */
router.get('/.well-known/x402-services.json', (req: Request, res: Response) => {
  const baseUrl = getBaseUrl(req);
  const catalog = serviceCatalogService.getCatalog();
  const x402Services = catalog.services.filter(s => s.x402Compatible);

  res.setHeader('Cache-Control', 'public, max-age=300');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json({
    version: '2.0',
    protocol: 'x402',
    specVersion: '2.12.0',
    platform: {
      name: 'Coin Railz',
      url: baseUrl,
      payTo: '0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91',
      facilitator: 'https://api.cdp.coinbase.com/platform/v2/x402',
      trialKey: `${baseUrl}/api/m2m/credits/trial`,
      contact: 'support@coinrailz.com',
    },
    services: x402Services.map(s => ({
      id: s.id,
      name: s.name,
      endpoint: s.endpoint,
      url: `${baseUrl}${s.endpoint}`,
      price: getServicePriceUSD(s.id as ServiceName) || 0.10,
      currency: 'USDC',
      network: 'base',
      network_caip2: s.network || 'eip155:8453',
      category: s.category,
      description: s.description,
      auth: 'x402',
      methods: ['POST'],
      capabilities: s.capabilities,
    })),
    total: x402Services.length,
    updated: new Date().toISOString(),
  });
});

/**
 * GET /.well-known/x402/discovery/resources
 *
 * Bazaar-format resource discovery at the well-known namespace path.
 * Cloudflare-infrastructure entities (172.70.x.x, 172.71.x.x) probe this
 * on every full-catalog sweep. Mirrors /api/discovery/resources content.
 */
router.get('/.well-known/x402/discovery/resources', (req: Request, res: Response) => {
  const baseUrl = getBaseUrl(req);
  const catalog = serviceCatalogService.getCatalog();
  const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
  const PLATFORM_WALLET = '0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91';
  const PRIMARY_FACILITATOR = 'https://api.cdp.coinbase.com/platform/v2/x402';

  const resources = catalog.services
    .filter(s => s.x402Compatible)
    .map(s => {
      const priceUsd = getServicePriceUSD(s.id as ServiceName) || 0.10;
      return {
        id: s.id,
        url: `${baseUrl}${s.endpoint}`,
        name: s.name,
        description: s.description,
        category: s.category,
        capabilities: s.capabilities,
        accepts: [{
          scheme: 'exact',
          network: s.network || 'eip155:8453',
          maxAmountRequired: String(Math.round(priceUsd * 1_000_000)),
          payTo: PLATFORM_WALLET,
          asset: USDC_BASE,
        }],
      };
    });

  res.setHeader('Cache-Control', 'public, max-age=300');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json({
    resources,
    total: resources.length,
    facilitator: PRIMARY_FACILITATOR,
    facilitators: [PRIMARY_FACILITATOR, 'https://x402.dexter.cash'],
    baseUrl,
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /.well-known/api-catalog
 *
 * ScoutScore-Scanner OpenAPI-compatible catalog pointer.
 * ScoutScore-Scanner has polled this path since May 21, 2026 (10+ attempts).
 * Returns catalog metadata and a pointer to /openapi.json.
 */
router.get('/.well-known/api-catalog', (req: Request, res: Response) => {
  const baseUrl = getBaseUrl(req);
  const catalog = serviceCatalogService.getCatalog();
  const categories = [...new Set(catalog.services.map(s => s.category))];

  res.setHeader('Cache-Control', 'public, max-age=300');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json({
    catalog_version: '1.0',
    platform: 'Coin Railz',
    description: 'Multi-chain x402 USDC micropayment infrastructure for AI agents. Pay-per-call across 9 blockchains with no accounts required.',
    openapi: `${baseUrl}/openapi.json`,
    services_total: catalog.services.length,
    x402_services: catalog.services.filter(s => s.x402Compatible).length,
    categories,
    pricing_range: { min_usd: 0.05, max_usd: 0.50, currency: 'USDC' },
    networks: ['base', 'ethereum', 'polygon', 'arbitrum', 'optimism', 'bsc', 'solana'],
    trial_key: `${baseUrl}/api/m2m/credits/trial`,
    discovery: {
      x402_manifest: `${baseUrl}/.well-known/x402.json`,
      x402_services: `${baseUrl}/.well-known/x402-services.json`,
      openapi: `${baseUrl}/openapi.json`,
      agent_card: `${baseUrl}/.well-known/agent-card.json`,
      discovery_resources: `${baseUrl}/.well-known/x402/discovery/resources`,
    },
    contact: 'support@coinrailz.com',
    updated: new Date().toISOString(),
  });
});

/**
 * GET /.well-known/autopay-guide.json
 *
 * Machine-readable Auto-Pay Helper for AI agents that received an HTTP 402 challenge
 * and need to understand how to complete a payment programmatically.
 *
 * No trial credits mentioned — pure x402 payment flow documentation.
 * Consumers: Any agent framework, payment-aware crawler, or developer building
 *   autonomous agents that need to close the discovery→payment loop.
 */
router.get('/.well-known/autopay-guide.json', (req: Request, res: Response) => {
  const baseUrl = getBaseUrl(req);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.json({
    title: "Coin Railz Auto-Pay Guide",
    version: "1.0.0",
    protocol: "x402",
    specVersion: "2",
    audience: "AI agents and autonomous frameworks that received an HTTP 402 Payment Required and need to complete the payment programmatically.",
    summary: "You received a 402. Here is exactly how to pay it and retry your request.",

    step_by_step: [
      {
        step: 1,
        action: "Read the 402 challenge body",
        description: "The 402 response contains a JSON body with payment requirements. Parse it.",
        fields: {
          "x402Version": "Must be 2",
          "accepts[].network": "Payment network — 'base' (EVM) or 'solana'",
          "accepts[].asset": "Token — USDC contract address",
          "accepts[].maxAmountRequired": "Amount in atomic units (USDC has 6 decimals — 50000 = $0.05)",
          "accepts[].payTo": "Destination wallet address",
          "accepts[].extra.facilitatorUrl": "The facilitator that verifies the payment"
        },
        example_402_body: {
          x402Version: 2,
          accepts: [{
            network: "base",
            asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            maxAmountRequired: "50000",
            payTo: "0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91",
            extra: {
              facilitatorUrl: "https://api.cdp.coinbase.com/platform/v2/x402",
              name: "USDC"
            }
          }]
        }
      },
      {
        step: 2,
        action: "Construct the payment using a facilitator",
        description: "Use a facilitator SDK to sign and submit the payment. The facilitator handles USDC transfer and returns a signed payment proof.",
        facilitators: {
          cdp: {
            name: "Coinbase CDP (primary)",
            url: "https://api.cdp.coinbase.com/platform/v2/x402",
            sdk: "npm install @coinbase/cdp-sdk",
            chains: ["base", "ethereum", "polygon", "arbitrum"],
            docs: "https://docs.cdp.coinbase.com"
          },
          dexter: {
            name: "Dexter (fallback)",
            url: "https://x402.dexter.cash",
            chains: ["base", "solana"],
            docs: "https://dexter.cash/docs"
          }
        },
        typescript_example: "import { fetchWithPayment } from 'x402-fetch';\nconst response = await fetchWithPayment(\n  endpoint,\n  { method: 'POST', body: JSON.stringify(payload) },\n  wallet\n);\nconst data = await response.json();",
        python_example: "from x402 import paid_fetch\nresponse = paid_fetch(endpoint, method='POST', wallet=your_wallet)",
        sdks: {
          typescript: "npm install x402-fetch",
          python: "pip install x402",
          coinbase_agentkit: "npm install @coinbase/agentkit"
        }
      },
      {
        step: 3,
        action: "Build the X-Payment header",
        description: "The facilitator returns a base64-encoded payment proof. Include it as the X-Payment header on your retry.",
        header_name: "X-Payment",
        header_format: "Base64-encoded JSON: { x402Version: 2, scheme: 'exact', network: '...', payload: { ... } }",
        note: "Most SDK wrappers (x402-fetch, agentkit) do steps 2 and 3 automatically."
      },
      {
        step: 4,
        action: "Retry the original request with X-Payment header",
        description: "Resend the exact same request with the X-Payment header added. The server verifies on-chain and returns your data.",
        success_response: "HTTP 200 with your data",
        failure_responses: {
          "402": "Payment invalid or expired — re-fetch the challenge and try again",
          "400": "Malformed X-Payment header",
          "500": "Server error — retry once"
        }
      }
    ],

    networks: {
      base: {
        caip2: "eip155:8453",
        asset: "USDC",
        contractAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        payTo: "0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91",
        facilitatorUrl: "https://api.cdp.coinbase.com/platform/v2/x402",
        minAmount: "$0.05 USDC"
      },
      solana: {
        caip2: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
        asset: "USDC",
        tokenMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        payTo: "BmUPzSupHJu2kW4cL27dF7Vc2JaZTwXKzFsRuagPDtL8",
        facilitatorUrl: "https://x402.dexter.cash",
        minAmount: "$0.05 USDC"
      }
    },

    first_payment_endpoint: {
      description: "Canonical onboarding endpoint — cheapest call ($0.05) to verify your payment setup works end-to-end.",
      url: `${baseUrl}/x402/first-call`,
      method: "POST",
      price: "$0.05 USDC",
      networks: ["base", "solana"],
      expected_response: { success: true, message: "First call completed successfully." }
    },

    service_catalog: `${baseUrl}/x402/catalog`,
    full_manifest: `${baseUrl}/.well-known/x402.json`,
    openapi: `${baseUrl}/openapi.json`,
    a2a_interaction: `${baseUrl}/a2a/v1/message/send`,
    agent_card: `${baseUrl}/.well-known/agent-card.json`,
  });
});

/**
 * Catch-all: unknown /.well-known/* paths return 404
 * Prevents PHP exploit probes and unknown paths from falling through
 * to the Vite frontend, which would return 200 with index.html.
 * All legitimate well-known paths are explicitly defined above.
 */
router.all('/.well-known/*', (req: Request, res: Response) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  res.status(404).json({
    error: 'Not Found',
    message: `${req.path} is not a recognised discovery document on this platform.`,
    knownPaths: [
      '/.well-known/agent.json',
      '/.well-known/agent-card.json',
      '/.well-known/agent-directory.json',
      '/.well-known/agent-instructions.json',
      '/.well-known/agent-registration.json',
      '/.well-known/x402.json',
      '/.well-known/x402-services.json',
      '/.well-known/x402/discovery/resources',
      '/.well-known/api-catalog',
      '/.well-known/mpp.json',
      '/.well-known/webmcp.json',
      '/.well-known/awi.json',
      '/.well-known/mcp-integration.json',
      '/.well-known/mcp-server.json',
      '/.well-known/mcp.json',
      '/.well-known/server-card.json',
      '/.well-known/mcp/server-card.json',
      '/.well-known/ai-plugin.json',
      '/.well-known/service-manifest.json',
      '/.well-known/payment-methods.json',
      '/.well-known/pricing.json',
      '/.well-known/solana.json',
      '/.well-known/solana-actions.json',
      '/.well-known/solana-pay.json',
      '/.well-known/helius.json',
      '/.well-known/autopay-guide.json',
      '/.well-known/mcp-registry-auth',
    ],
  });
});

export default router;
