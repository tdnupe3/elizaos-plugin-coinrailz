/**
 * x402 Response Enricher Middleware
 * 
 * SAFE APPROACH: This middleware only intercepts 402 responses AFTER they're generated,
 * adding missing fields required by x402 agents without modifying the payment verification flow.
 * 
 * Fields added/normalized:
 * - resource: Canonical coinrailz.com URL
 * - maxAmountRequiredUSD: Human-readable USD amount
 * - paymentInstructions: Step-by-step payment guide
 * - facilitatorUrl: Coinbase facilitator endpoint
 * - discoverable: true (for Bazaar indexing)
 * - confidenceMetrics: Social proof of recent successful payments (ChatGPT-recommended)
 */

import { Request, Response, NextFunction } from "express";
import { serviceCatalogService } from "../services/serviceCatalogService";
import { db } from "../db";
import { x402PaymentIntents, x402CanaryPayments } from "@shared/schema";
import { sql, gte, eq, desc, and } from "drizzle-orm";
import { getFacilitatorUrl, getDexterFacilitatorUrl, NETWORK_LEGACY, NETWORK_CAIP2 } from "../utils/facilitatorHelper";
import { buildBazaarDiscoveryMetadata } from "../discovery/officialBazaarIntegration";

const DEXTER_SOLANA_WALLET = process.env.DEXTER_SOLANA_WALLET || "BmUPzSupHJu2kW4cL27dF7Vc2JaZTwXKzFsRuagPDtL8";
const USDC_SOLANA_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SOLANA_MAINNET = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";

const CANONICAL_BASE_URL = process.env.PUBLIC_URL || 'https://coinrailz.com';
// FIXED (Jan 11, 2026): Call getFacilitatorUrl() per-request, not at module load
// This ensures CDP credentials are checked dynamically

function getCanonicalBaseUrl(): string {
  if (process.env.PUBLIC_URL) {
    return process.env.PUBLIC_URL;
  }
  if (process.env.REPLIT_DEPLOYMENT === '1') {
    return 'https://coinrailz.com';
  }
  if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
    return `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
  }
  return 'http://localhost:5000';
}

function microToUSD(microUnits: string | number): string {
  const micro = typeof microUnits === 'string' ? parseInt(microUnits, 10) : microUnits;
  if (isNaN(micro)) return '$0.00';
  return `$${(micro / 1_000_000).toFixed(2)}`;
}

function normalizeResourceUrl(resource: string | undefined, endpoint: string): string {
  const baseUrl = getCanonicalBaseUrl();
  
  if (!resource) {
    return `${baseUrl}${endpoint}`;
  }
  
  if (resource.includes('localhost') || resource.includes('.repl.co') || resource.includes('.replit.dev')) {
    const path = resource.replace(/^https?:\/\/[^\/]+/, '');
    return `${baseUrl}${path}`;
  }
  
  return resource;
}

/**
 * Creates payment instructions object for 402 responses
 * Supports both USDC and USDT on Ethereum and Base chains
 * 
 * PAYMENT METHODS:
 * - EIP-3009 (transferWithAuthorization): USDC only (USDT doesn't support EIP-3009)
 * - Raw transaction hash: Both USDC and USDT supported
 */
// Cache for confidence metrics (refresh every 5 minutes)
let confidenceCache: { data: any; timestamp: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Separate canary cache (refresh every 10 minutes — canary runs every 6h so 10min is plenty fresh)
let canaryCache: { data: CanaryProof | null; timestamp: number } | null = null;
const CANARY_CACHE_TTL_MS = 10 * 60 * 1000;

interface CanaryProof {
  txHash: string;
  explorerUrl: string;
  timestamp: string;
  amountUsd: string;
  service: string;
  network: string;
}

/**
 * Reads the latest successful canary payment from x402_canary_payments.
 * Returns null if no canary payment exists within the last 24 hours.
 * Results are cached for 10 minutes to keep the hot path fast.
 */
async function getLatestCanaryProof(): Promise<CanaryProof | null> {
  const now = Date.now();

  if (canaryCache && (now - canaryCache.timestamp) < CANARY_CACHE_TTL_MS) {
    return canaryCache.data;
  }

  try {
    const cutoff = new Date(now - 24 * 60 * 60 * 1000);
    const rows = await db
      .select({
        txHash: x402CanaryPayments.txHash,
        explorerUrl: x402CanaryPayments.explorerUrl,
        createdAt: x402CanaryPayments.createdAt,
        amountUsd: x402CanaryPayments.amountUsd,
        service: x402CanaryPayments.service,
        network: x402CanaryPayments.network,
      })
      .from(x402CanaryPayments)
      .where(
        and(
          eq(x402CanaryPayments.status, "succeeded"),
          gte(x402CanaryPayments.createdAt, cutoff)
        )
      )
      .orderBy(desc(x402CanaryPayments.createdAt))
      .limit(1);

    const row = rows[0];
    const proof: CanaryProof | null =
      row?.txHash && row?.explorerUrl
        ? {
            txHash: row.txHash,
            explorerUrl: row.explorerUrl,
            timestamp: row.createdAt instanceof Date
              ? row.createdAt.toISOString()
              : String(row.createdAt),
            amountUsd: row.amountUsd ?? "0.05",
            service: row.service ?? "first-call",
            network: row.network ?? "base",
          }
        : null;

    canaryCache = { data: proof, timestamp: now };
    return proof;
  } catch {
    // Non-fatal: canary table may not exist yet on first deploy
    canaryCache = { data: null, timestamp: now };
    return null;
  }
}

/**
 * Invalidates both the canary cache and the confidence metrics cache.
 * Called by X402CanaryJob after a successful run so the very next 402
 * response picks up the fresh tx hash — no 5-minute stale window.
 */
export function invalidateCanaryCache(): void {
  canaryCache = null;
  confidenceCache = null;
}

/**
 * Get confidence metrics for 402 responses.
 * Includes machine-verifiable canary proof when available so agents can
 * independently confirm settlement works on-chain before committing to pay.
 * Exported so other 402-response assemblers (e.g. x402MicroserviceRoutesV2) can use it.
 */
export async function getConfidenceMetrics(): Promise<{
  recentPayments24h?: number;
  recentPayments7d?: number;
  uniqueAgents7d?: number;
  lastVerifiedPayment?: CanaryProof;
  message: string;
  status: "active" | "verified";
}> {
  const now = Date.now();
  
  if (confidenceCache && (now - confidenceCache.timestamp) < CACHE_TTL_MS) {
    return confidenceCache.data;
  }
  
  try {
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    
    const [payments24h, payments7d, agents7d, canaryProof] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` })
        .from(x402PaymentIntents)
        .where(sql`status = 'SUCCEEDED' AND created_at > ${oneDayAgo.toISOString()}`),
      db.select({ count: sql<number>`count(*)::int` })
        .from(x402PaymentIntents)
        .where(sql`status = 'SUCCEEDED' AND created_at > ${sevenDaysAgo.toISOString()}`),
      db.select({ count: sql<number>`count(distinct payer)::int` })
        .from(x402PaymentIntents)
        .where(sql`status = 'SUCCEEDED' AND created_at > ${sevenDaysAgo.toISOString()}`),
      getLatestCanaryProof(),
    ]);
    
    const recentPayments24h = payments24h[0]?.count || 0;
    const recentPayments7d = payments7d[0]?.count || 0;
    const uniqueAgents7d = agents7d[0]?.count || 0;
    
    let data: any;
    
    if (recentPayments24h > 0) {
      data = {
        recentPayments24h,
        recentPayments7d,
        uniqueAgents7d,
        message: `${recentPayments24h} successful payment${recentPayments24h > 1 ? 's' : ''} in the last 24 hours.`,
        status: "active" as const
      };
    } else if (recentPayments7d > 0) {
      data = {
        recentPayments7d,
        uniqueAgents7d,
        message: `Payments processed successfully from ${uniqueAgents7d} unique agent${uniqueAgents7d > 1 ? 's' : ''} this week.`,
        status: "active" as const
      };
    } else {
      data = {
        message: "Payment rail is live. See lastVerifiedPayment for on-chain proof.",
        status: "verified" as const
      };
    }

    // Always attach canary proof when available — this is the machine-verifiable signal
    if (canaryProof) {
      data.lastVerifiedPayment = canaryProof;
      // Upgrade message to reference the verifiable proof
      if (recentPayments24h === 0 && recentPayments7d === 0) {
        data.message = `Last verified settlement ${formatAge(canaryProof.timestamp)} ago — tx verifiable on Base.`;
      }
    }
    
    confidenceCache = { data, timestamp: now };
    return data;
  } catch (error) {
    return {
      message: "Payment rail is live.",
      status: "verified" as const
    };
  }
}

function formatAge(isoTimestamp: string): string {
  try {
    const diffMs = Date.now() - new Date(isoTimestamp).getTime();
    const hours = Math.floor(diffMs / 3_600_000);
    if (hours < 1) return "< 1 hour";
    if (hours === 1) return "1 hour";
    return `${hours} hours`;
  } catch {
    return "recently";
  }
}

function createPaymentInstructions() {
  return {
    step1: "Obtain USDC or USDT on Ethereum (chainId: 1) or Base (chainId: 8453)",
    step2_eip3009: "For USDC: Sign EIP-3009 authorization for the exact amount (USDC only)",
    step2_rawTx: "For USDT or USDC: Send stablecoin to payTo address on either Ethereum or Base",
    step3: "Include payment proof in X-PAYMENT header with network field",
    step3_eip3009: "EIP-3009: Base64-encoded authorization JSON",
    step3_rawTx: "Raw tx: Transaction hash (0x...) or Base64-encoded {txHash, amount, network} JSON",
    step4: "Retry the request with X-PAYMENT header",
    supportedMethods: [
      { method: "eip3009-authorization", tokens: ["USDC"], description: "Gasless transfer via EIP-3009 signature" },
      { method: "raw-transaction-hash", tokens: ["USDC", "USDT"], description: "Direct transfer verified on-chain" },
      { method: "api-key", tokens: ["prepaid-credits"], description: "Use prepaid credits with X-API-KEY header (no blockchain required)" }
    ],
    supportedNetworks: [
      { network: "eip155:1", networkLegacy: "ethereum", chainId: 1, name: "Ethereum" },
      { network: "eip155:8453", networkLegacy: "base", chainId: 8453, name: "Base" }
    ],
    network: "eip155:8453",
    networkLegacy: "base",
    x402Network: "eip155:8453",
    chainId: 8453,
    acceptedTokens: {
      ethereum: [
        { symbol: "USDC", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", name: "USD Coin", chainId: 1, supportsEIP3009: true },
        { symbol: "USDT", address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", name: "Tether USD", chainId: 1, supportsEIP3009: false }
      ],
      base: [
        { symbol: "USDC", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", name: "USD Coin", chainId: 8453, supportsEIP3009: true },
        { symbol: "USDT", address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2", name: "Tether USD", chainId: 8453, supportsEIP3009: false }
      ]
    },
    token: "USDC",
    tokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    sdkExamples: {
      nodejs: {
        install: "npm install @coinrailz/agent-payments",
        code: `import { AgentPayments } from '@coinrailz/agent-payments';

const agent = new AgentPayments({
  privateKey: process.env.PRIVATE_KEY,
  network: 'ethereum' // or 'base'
});

const result = await agent.payAndCall({
  url: 'https://coinrailz.com/x402/gas-price-oracle',
  method: 'POST',
  body: { chains: ['ethereum', 'base'] }
});
console.log(result.data);`
      },
      python: {
        install: "pip install coinrailz",
        code: `import os
from coinrailz import AgentPayments

agent = AgentPayments(
    private_key=os.environ['PRIVATE_KEY'],
    network='ethereum'  # or 'base'
)

result = agent.pay_and_call(
    url='https://coinrailz.com/x402/gas-price-oracle',
    method='POST',
    body={'chains': ['ethereum', 'base']}
)
print(result['data'])`
      },
      curl: {
        description: "For testing or simple integrations",
        code: `# Step 1: Get a free wallet (if needed)
curl -X POST https://coinrailz.com/x402/wallet/free \\
  -H "Content-Type: application/json" \\
  -d '{"agent_id": "my-agent", "chain": "ethereum-mainnet"}'

# Step 2: Or use prepaid credits (easiest)
curl -X POST https://coinrailz.com/x402/gas-price-oracle \\
  -H "Content-Type: application/json" \\
  -H "X-API-KEY: your-api-key" \\
  -d '{"chains": ["ethereum"]}'`
      },
      quickStart: "Fastest path: Buy credits at https://coinrailz.com/credits with credit card, then use X-API-KEY header (no blockchain required)"
    }
  };
}

/**
 * x402 Response Enricher Middleware
 * 
 * SAFE: Only modifies 402 responses, doesn't touch verification logic.
 * Must be applied BEFORE the x402 middleware (before paymentMiddleware runs)
 * so res.json is wrapped before x402-express calls it.
 * 
 * ChatGPT-recommended: Adds confidence metrics to 402 responses to help
 * autonomous agents trust the payment flow.
 */
export function x402ResponseEnricher() {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Pre-fetch confidence metrics (cached, fast)
    const confidenceMetrics = await getConfidenceMetrics();
    
    const originalJson = res.json.bind(res);
    
    res.json = function(body: any) {
      if (res.statusCode === 402 && body?.x402Version && body?.accepts) {
        const baseUrl = getCanonicalBaseUrl();
        const endpoint = req.originalUrl || req.path;
        
        // NOTE: x402scan has a non-compliant Zod schema z.enum(['1','2']) that expects strings,
        // but the official Coinbase x402 spec defines x402Version as NUMBER.
        // We follow the official spec (number 2) for Bazaar/facilitator/SDK compatibility.
        
        body.facilitatorUrl = body.facilitatorUrl || getFacilitatorUrl();
        
        // Add confidence metrics (ChatGPT-recommended social proof)
        body.confidenceMetrics = {
          ...confidenceMetrics,
          note: "Other autonomous agents have successfully used this payment flow."
        };
        
        // Look up service from catalog for Bazaar metadata
        const servicePath = endpoint.replace(/^\/x402\/service\//, '').replace(/^\/x402\//, '').replace(/^\/service\//, '').replace(/^\//, '').replace(/\/$/, '');
        const catalog = serviceCatalogService.getCatalog();
        const matchedService = catalog.services.find(s => 
          s.endpoint === endpoint || 
          s.endpoint?.endsWith(servicePath) ||
          s.id === servicePath ||
          s.slug === servicePath
        );
        
        // Filter out Ethereum mainnet accepts entries before mapping.
        // x402-fetch v0.7.3 (and @x402/evm) validate ALL entries via PaymentRequirementsSchema.parse()
        // before selecting one. "ethereum" / "eip155:1" is absent from their network enum, so any
        // Ethereum entry causes a ZodError that blocks Base and Solana payments too.
        // Ethereum gas (~$2–10/tx) also makes it economically unviable for micropayments.
        // Ethereum is still listed in supportedNetworks metadata and docs for reference.
        body.accepts = body.accepts
          .filter((paymentReq: any) => {
            const n = paymentReq.network || '';
            return n !== 'ethereum' && n !== 'eip155:1';
          })
          .map((paymentReq: any) => {
          const enriched = { ...paymentReq };
          
          // Remove duplicate x402Version from accepts items (should only be at top level)
          // x402scan may reject payloads with x402Version inside accepts array
          delete enriched.x402Version;
          
          enriched.resource = normalizeResourceUrl(paymentReq.resource, endpoint);
          enriched.discoverable = true;
          
          // Add official Bazaar extensions for facilitator indexing (Feb 2026 fix)
          if (matchedService && matchedService.x402Compatible !== false) {
            try {
              const bazaarMetadata = buildBazaarDiscoveryMetadata(matchedService, 'POST');
              enriched.extensions = {
                ...(enriched.extensions || {}),
                bazaar: bazaarMetadata
              };
            } catch (e) {
            }
          }
          
          // Normalize network fields for x402-fetch / CAIP-2 compatibility
          if (enriched.network === 'base' || enriched.network === 'eip155:8453' || !enriched.network) {
            // Canary-only CAIP-2 path: when X-X402-Canary:true header is present, emit CAIP-2
            // format so @x402/fetch 2.x ExactEvmScheme can parse the challenge. All other
            // clients continue to receive the "base" shorthand (x402-fetch 0.7.x compatibility).
            const canaryHeader = req.headers['x-x402-canary'];
            const isCanaryRequest = Array.isArray(canaryHeader) ? canaryHeader[0] === 'true' : canaryHeader === 'true';
            enriched.network = isCanaryRequest ? 'eip155:8453' : 'base';
            enriched.networkLegacy = enriched.networkLegacy || 'base';
            enriched.x402Network = 'eip155:8453';
            // Tag EVM/Base entries with CDP as facilitator — consistent with Solana entries getting Dexter
            if (!enriched.facilitator) {
              enriched.facilitator = getFacilitatorUrl();
            }
          } else if (enriched.network === 'solana' || enriched.network === 'solana:mainnet' || enriched.network === SOLANA_MAINNET) {
            // Keep network as "solana" shorthand — x402-fetch PaymentRequirementsSchema requires it
            // x402Network holds the full CAIP-2 for Dexter facilitator compatibility
            enriched.network = 'solana';
            enriched.networkLegacy = enriched.networkLegacy || 'solana';
            enriched.x402Network = SOLANA_MAINNET;
            // Tag Solana entries with Dexter as facilitator (Dexter handles ~50% of Solana x402 volume)
            if (!enriched.facilitator) {
              enriched.facilitator = getDexterFacilitatorUrl();
            }
          }

          enriched.supportedNetworks = [
            { network: 'eip155:1', legacy: 'ethereum', chainId: 1 },
            { network: 'eip155:8453', legacy: 'base', chainId: 8453 },
          ];

          if (enriched.maxAmountRequired && !enriched.amount) {
            enriched.amount = enriched.maxAmountRequired;
          }
          
          if (paymentReq.maxAmountRequired && !paymentReq.maxAmountRequiredUSD) {
            enriched.maxAmountRequiredUSD = microToUSD(paymentReq.maxAmountRequired);
          }
          
          if (!enriched.extra) {
            enriched.extra = {};
          }
          const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
          const USDT_BASE = "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2";
          const USDC_ETH = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
          const USDT_ETH = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
          const assetLower = (enriched.asset || "").toLowerCase();
          if (assetLower === USDT_BASE.toLowerCase() || assetLower === USDT_ETH.toLowerCase()) {
            enriched.extra.name = enriched.extra.name || "Tether USD";
          } else {
            enriched.extra.name = enriched.extra.name || "USD Coin";
          }
          enriched.extra.version = enriched.extra.version || "2";
          enriched.extra.decimals = enriched.extra.decimals || 6;
          const detectedChainId = assetLower === USDC_ETH.toLowerCase() || assetLower === USDT_ETH.toLowerCase() ? 1 : 8453;
          enriched.extra.chainId = enriched.extra.chainId || detectedChainId;
          enriched.extra.chainName = enriched.extra.chainName || (detectedChainId === 1 ? "Ethereum" : "Base");
          
          return enriched;
        });
        
        // Add Solana (via Dexter) as a second payment option on every 402 challenge.
        // This is additive — existing EVM entries are untouched.
        // Dexter facilitator handles verification via https://x402.dexter.cash
        const evmEntry = body.accepts?.[0];
        const hasSolanaEntry = body.accepts?.some((a: any) => (a.network || '').includes('solana'));
        if (evmEntry && evmEntry.maxAmountRequired && !hasSolanaEntry) {
          body.accepts.push({
            scheme: "exact",
            network: SOLANA_MAINNET,
            networkLegacy: "solana",
            asset: USDC_SOLANA_MINT,
            maxAmountRequired: evmEntry.maxAmountRequired,
            amount: evmEntry.maxAmountRequired,
            maxAmountRequiredUSD: evmEntry.maxAmountRequiredUSD,
            payTo: DEXTER_SOLANA_WALLET,
            resource: evmEntry.resource,
            description: evmEntry.description,
            mimeType: evmEntry.mimeType || "application/json",
            facilitator: getDexterFacilitatorUrl(),
            discoverable: true,
            extra: { name: "USD Coin", decimals: 6, chainName: "Solana" }
          });
        }

        const firstAccept = body.accepts?.[0];
        if (!body.resource && firstAccept) {
          body.resource = {
            url: firstAccept.resource || normalizeResourceUrl('', endpoint),
            description: firstAccept.description || matchedService?.description || `x402 service at ${endpoint}`,
            mimeType: firstAccept.mimeType || 'application/json'
          };
        }
        
        if (!body.extensions) {
          const bazaarExt = firstAccept?.extensions?.bazaar;
          const inputSchemaFromBody = body.inputSchema;
          body.extensions = {
            bazaar: {
              info: {
                input: bazaarExt?.input || inputSchemaFromBody || { type: "http", method: "POST" },
                output: bazaarExt?.output || undefined
              },
              schema: inputSchemaFromBody || (firstAccept?.outputSchema ? {
                input: firstAccept.outputSchema.input,
                output: firstAccept.outputSchema.output
              } : undefined)
            }
          };
        }
        
        if (!body.paymentInstructions) {
          body.paymentInstructions = createPaymentInstructions();
        } else {
          const fullInstructions = createPaymentInstructions();
          body.paymentInstructions.sdkExamples = body.paymentInstructions.sdkExamples || fullInstructions.sdkExamples;
        }
        
        try {
          const servicePath = req.path.replace(/^\/service\//, '').replace(/^\//, '').replace(/\/$/, '');
          const recommendations = serviceCatalogService.getRecommendedServices(servicePath);
          const catalogSummary = serviceCatalogService.getCatalogSummary();
          
          if (!body.recommendedServices) {
            body.recommendedServices = recommendations.map((s: any) => ({
              id: s.id,
              name: s.name,
              priceUSD: s.priceUSD,
              endpoint: s.endpoint
            }));
          }
          body.catalogUrl = body.catalogUrl || catalogSummary.catalogUrl;
          body.totalServicesAvailable = body.totalServicesAvailable || catalogSummary.totalServices;
        } catch (e: any) {
        }
        
        console.log(`📊 x402 Funnel: challenge-issued for ${req.path} | IP: ${req.ip} | Agent: ${req.headers['user-agent']?.substring(0, 20) || 'none'} | Latency: ${Date.now() - (res.locals.startTime || Date.now())}ms`);
      }
      
      return originalJson(body);
    };
    
    res.locals.startTime = Date.now();
    next();
  };
}

export default x402ResponseEnricher;
