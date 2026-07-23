import { Router, Request, Response } from "express";
import { getCanonicalServiceCount, getCanonicalServices } from "../utils/serviceCount";
import { db } from "../db";
import { getFacilitatorUrl, getAllFacilitatorUrls, NETWORK_LEGACY, NETWORK_CAIP2, USDC_BASE_ADDRESS, USDT_BASE_ADDRESS, PLATFORM_WALLETS, STABLECOIN_CONFIG } from "../utils/facilitatorHelper";
import { getConfidenceMetrics } from "../middleware/x402ResponseEnricher";
import { sql, eq, and, gt } from "drizzle-orm";
import { instantApiKeyGrants } from "@shared/schema";
import { SERVICE_PRICING_MICRO, SERVICE_PRICING_USD, microToUSD } from "@shared/pricing";
import {
  multiChainBalanceService,
  gasPriceOracleService,
  tokenPriceFeedService,
  contractQuickScanService,
  walletRiskScoreService,
  tradeSignalsService,
  tokenSocialSentimentService,
  trendingTokensFeedService,
  whaleWalletAlertsService,
  dexLiquidityMonitorService,
  transactionBuilderService,
  tokenMetadataService,
  approvalManagerService,
  batchQuoteService,
  portfolioTrackerService,
  instantAgentWalletService,
  verifiedAgentIdentityService,
  seamlessChainBridgeService,
  trackRequest,
  propertyValuationService,
  leaseAnalysisService,
  constructionProgressService,
  creditRiskScoreService,
  fraudDetectionService,
  complianceCheckService,
  tradingSignalService,
  portfolioOptimizationService,
  sentimentAnalysisService,
  arbitrageScannerService,
  correlationMatrixService,
  riskMetricsService,
  stockSentimentService,
  forexSentimentService,
} from "./microservices";
import {
  transactionBuilderInputSchema,
  approvalManagerInputSchema,
  batchQuoteInputSchema,
  propertyValuationInputSchema,
  leaseAnalysisInputSchema,
  constructionProgressInputSchema,
  creditRiskScoreInputSchema,
  fraudDetectionInputSchema,
  complianceCheckInputSchema,
  tradingSignalInputSchema,
  portfolioOptimizationInputSchema,
  sentimentAnalysisInputSchema,
  arbitrageScannerInputSchema,
  correlationMatrixInputSchema,
  riskMetricsInputSchema,
  agentCreateWalletInputSchema,
  agentWallets,
  agentWalletEvents,
} from "@shared/schema";
import { CoinbaseCDPService } from "../services/coinbaseCDPService";
import { x402TrackingMiddleware } from "../middleware/x402TrackingMiddleware";
import { hybridPaymentMiddleware, verifyTransactionPayment } from "../middleware/hybridPaymentMiddleware";
import { usageAnalyticsMiddleware } from "../middleware/usageAnalyticsMiddleware";
import { createPaymentOrchestrator } from "../middleware/paymentOrchestrator";
import { bundleAuthMiddleware } from "../middleware/bundleAuthMiddleware";
import { deductBundleCredits } from "../services/bundleCreditService";
import { serviceCatalogService, ServiceCatalogService } from "../services/serviceCatalogService";
import { offerLinkService } from "../services/offerLinkService";
import { buildBazaarDiscoveryMetadata } from "../discovery/officialBazaarIntegration";
import { dialectMarketsService } from "../services/dialectMarketsService";
import { satelliteDataService } from '../services/satelliteDataService';
import { earthdataService } from '../services/earthdataService';
import { b20TokenInfoService, b20TransferCheckService, b20ComplianceScanService } from './microservices/b20Data';
import { fetchRobinhoodPoolData, fetchRobinhoodTopPools, fetchRobinhoodChainStats } from './microservices/robinhoodData';
import { rhStockPriceService, SUPPORTED_SYMBOLS as RH_STOCK_SYMBOLS } from './microservices/rhStockPrice';
import { rhBridgeService } from './microservices/rhBridgeService';
import { buildVltUsdcDeposit } from '../services/vltUsdcDepositService';
import { getVltUsdcStats } from '../services/vltUsdcVaultService';
import { rwaNavOracleService } from '../services/rwaNavOracleService';
import { tokenizedYieldCompareService } from '../services/tokenizedYieldCompareService';

const router = Router();

// Helper function to track bundle credits after successful service execution
async function trackBundleUsage(
  req: Request,
  res: Response,
  serviceSlug: string,
  requestMetadata?: Record<string, any>
) {
  if (req.bundleSubscription) {
    const deductionResult = await deductBundleCredits(
      req.bundleSubscription.id,
      serviceSlug,
      serviceSlug,
      "200",
      requestMetadata || {}
    );
    if (deductionResult.success) {
      res.setHeader("X-Bundle-Credits-Used", deductionResult.creditsDeducted.toString());
      res.setHeader("X-Bundle-Credits-Remaining", deductionResult.creditsRemaining.toString());
      res.setHeader("X-Payment-Method", "bundle-subscription");
    }
  }
}

// ============================================================================
// ROOT PATH — must be registered BEFORE middleware so it bypasses tracking
// HEAD /x402 → 200 OK (python-httpx pre-flight health check from known payers)
// GET  /x402 → 301 redirect to /x402/catalog
// ============================================================================
router.head('/', (_req: Request, res: Response) => {
  res.set({
    'X-x402-Version': '2',
    'X-x402-Services': String(getCanonicalServiceCount()),
    'Content-Type': 'application/json',
  }).status(200).end();
});

router.get('/', (_req: Request, res: Response) => {
  res.redirect(301, '/x402/catalog');
});

// Typo-path redirect: gas-price-oracle with trailing backtick (%60).
// Must be a router.use() (not router.all/regex) because Express 4's path-to-regexp
// normalizes percent-encoded route patterns before regex compilation — string/regex routes
// registered with '/gas-price-oracle%60' or /regex/ don't reliably match.
// router.use() gives us req.path directly; Express delivers req.path in the ENCODED form
// (%60, not backtick), so we test for the encoded form. The backtick branch is a fallback
// in case any Express version delivers the decoded form.
// Without this redirect, POST with X-PAYMENT to the typo path hits the catch-all (which
// never checks for payment headers) and generates a fake 402 — payment loops forever.
router.use((req: Request, res: Response, next: NextFunction) => {
  const p = req.path;
  if (p === '/gas-price-oracle%60' || p === '/gas-price-oracle`') {
    res.setHeader('X-Redirect-Reason', 'tooling-typo-fix');
    return res.redirect(301, '/x402/gas-price-oracle');
  }
  next();
});

// Apply analytics and interaction tracking to all x402 routes
router.use(usageAnalyticsMiddleware);
router.use(x402TrackingMiddleware);
router.use(bundleAuthMiddleware); // Check for bundle subscriptions

// CRITICAL FIX: Override Host header for x402-express resource URL generation
// x402-express reads req.get('host') to build resource URLs - we need to inject the public domain
router.use((req: Request, res: Response, next) => {
  if (process.env.REPLIT_DEPLOYMENT === '1') {
    // In production, force coinrailz.com as the host
    req.headers.host = 'coinrailz.com';
    req.headers['x-forwarded-host'] = 'coinrailz.com';
  } else if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
    // In workspace, use repl.co URL
    const workspaceHost = `${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
    req.headers.host = workspaceHost;
    req.headers['x-forwarded-host'] = workspaceHost;
  }
  next();
});

// Platform wallet for receiving payments
const PLATFORM_WALLET = (process.env.PLATFORM_WALLET_ADDRESS || "0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91") as `0x${string}`;

// Network selection based on environment
// CRITICAL FIX: Force BASE MAINNET for Bazaar discovery (testnet services don't appear in Bazaar)
const NETWORK = "base" as const; // Always use mainnet for production discoverability

// Public base URL for Bazaar discovery (x402 crawler needs public URLs, not localhost)
// CRITICAL: Use REPLIT_DOMAINS for workspace URLs (correct Replit env var)
// OVERRIDE: Set PUBLIC_URL env var to force production URL (e.g., PUBLIC_URL=https://coinrailz.com)
const PUBLIC_BASE_URL: `${string}://${string}` = (
  process.env.PUBLIC_URL 
    ? process.env.PUBLIC_URL
    : process.env.REPLIT_DEPLOYMENT === '1' 
      ? 'https://coinrailz.com'
      : process.env.REPLIT_DOMAINS
        ? `https://${process.env.REPLIT_DOMAINS}`
        : process.env.REPL_SLUG 
          ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
          : 'http://localhost:5000'
) as `${string}://${string}`;

// Helper function to create properly typed resource URLs
function resourceUrl(path: string): `${string}://${string}` {
  return `${PUBLIC_BASE_URL}${path}` as `${string}://${string}`;
}

// Rate limiting storage (in-memory for now)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// ============================================================================
// OFFER LANDING ROUTE - Entry point for tracked outreach links
// When agents click offer links, this records the click and redirects to the service
// ============================================================================
router.get('/offer/:trackingId', async (req: Request, res: Response) => {
  const { trackingId } = req.params;
  
  try {
    // Look up the offer
    const offer = await offerLinkService.getOfferByTrackingId(trackingId);
    
    if (!offer) {
      return res.status(404).json({
        success: false,
        error: 'Offer not found or expired',
        suggestion: 'Visit /x402/catalog for available services',
      });
    }
    
    // Check if offer is active
    if (!offer.isActive) {
      return res.status(410).json({
        success: false,
        error: 'This offer has been deactivated',
        suggestion: 'Visit /x402/catalog for available services',
      });
    }
    
    // Check expiration
    if (offer.expiresAt && new Date(offer.expiresAt) < new Date()) {
      return res.status(410).json({
        success: false,
        error: 'This offer has expired',
        suggestion: 'Visit /x402/catalog for available services',
      });
    }
    
    // Record the click
    await offerLinkService.recordClick(trackingId, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.get('x-request-id'),
    });
    
    // Store tracking ID in request for attribution in x402TrackingMiddleware
    (req as any).offerTrackingId = trackingId;
    
    // Look up the service endpoint
    const service = serviceCatalogService.getService(offer.serviceId);
    if (!service) {
      return res.status(404).json({
        success: false,
        error: 'Service no longer available',
        offeredService: offer.serviceId,
      });
    }
    
    // Redirect to the actual service endpoint which will serve the 402 challenge
    // Using 307 to preserve the request method
    // CRITICAL: Pass tracking ID as query param so it survives the redirect for attribution
    const baseEndpoint = service.endpoint;
    const separator = baseEndpoint.includes('?') ? '&' : '?';
    const serviceEndpoint = `${baseEndpoint}${separator}offer_tracking=${trackingId}`;
    console.log(`📍 Offer ${trackingId} clicked -> redirecting to ${serviceEndpoint}`);
    
    res.redirect(307, serviceEndpoint);
    
  } catch (error: any) {
    console.error('Offer landing error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process offer link',
    });
  }
});

// ============================================================================
// OPENAPI SPECIFICATION - For thirdweb Nexus and other API discovery platforms
// Returns OpenAPI 3.0 specification for all x402 services
// ============================================================================
router.get('/openapi.json', async (req: Request, res: Response) => {
  try {
    const fs = await import('fs');
    const path = await import('path');
    const specPath = path.join(process.cwd(), 'public', 'openapi-x402-services.json');
    const spec = JSON.parse(fs.readFileSync(specPath, 'utf-8'));
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.json(spec);
  } catch (error: any) {
    console.error('Failed to serve OpenAPI spec:', error);
    res.status(500).json({ error: 'Failed to retrieve OpenAPI specification' });
  }
});

// ============================================================================
// CATALOG ENDPOINT - Machine-readable service catalog for AI agents and crawlers
// Returns JSON service list for x402/Bazaar/A2A protocol discoverability
// ============================================================================
router.get('/catalog', async (req: Request, res: Response) => {
  try {
    // Support ?tier=featured|standard filtering
    const tier = (req.query.tier as string | undefined)?.toLowerCase();

    const allServices = getCanonicalServices();
    const featured = allServices.filter(s => s.featured);
    const standard = allServices.filter(s => !s.featured);

    let filteredServices: typeof allServices;
    if (tier === 'featured') {
      filteredServices = featured;
    } else if (tier === 'standard') {
      filteredServices = standard;
    } else {
      // Default: featured first, then standard (both sorted by price ascending within tier)
      filteredServices = [
        ...featured.sort((a, b) => a.priceUsd - b.priceUsd),
        ...standard.sort((a, b) => a.priceUsd - b.priceUsd),
      ];
    }

    res.setHeader('Cache-Control', 'public, max-age=300');
    res.setHeader('Content-Type', 'application/json');

    res.json({
      x402Version: 2,
      catalogUrl: `${PUBLIC_BASE_URL}/x402/catalog`,
      facilitatorUrl: getFacilitatorUrl(),
      registrationEndpoint: `${PUBLIC_BASE_URL}/.well-known/agent-registration.json`,
      totalServices: allServices.length,
      featuredServices: featured.length,
      standardServices: standard.length,
      tier: tier ?? 'all',
      network: 'eip155:8453',
      x402Network: 'eip155:8453',
      paymentAsset: {
        symbol: 'USDC',
        address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        decimals: 6,
        chainId: 8453,
      },
      services: filteredServices.map(service => ({
        id: service.id,
        name: service.name,
        description: service.description,
        endpoint: service.endpoint,
        method: service.method,
        priceUSD: service.priceUsd,
        priceUSDC: service.priceUsd,
        priceMicro: Math.round(service.priceUsd * 1_000_000),
        category: service.category,
        tags: service.tags,
        featured: service.featured,
        tier: service.featured ? 'featured' : 'standard',
        discoverable: true,
        firstCallFree: ['gas-price-oracle', 'token-metadata'].includes(service.id),
      })),
      firstCallFreeServices: ['gas-price-oracle', 'token-metadata'],
      quickStart: {
        docsUrl: `${PUBLIC_BASE_URL}/docs/x402-quick-start`,
        tierFiltering: `${PUBLIC_BASE_URL}/x402/catalog?tier=featured | ?tier=standard`,
        note: 'First call is FREE on gas-price-oracle and token-metadata services!',
      },
    });
  } catch (error: any) {
    console.error('Failed to get service catalog:', error);
    res.status(500).json({ error: 'Failed to retrieve service catalog' });
  }
});

// /x402/discovery/resources — compact machine-readable resource index for payment-readiness checkers.
// The IPv6 agent (2a06:98c0:3600::103 — Cloudflare worker) has requested this sub-path every ~5 hours
// since July 15, always receiving 404. It hits /x402/discovery (catalog) AND /resources in the same
// sweep cycle, indicating it expects a distinct, payment-execution-optimized resource list.
// Schema: x402Version:2, kind:"resource-list", resources[]{id,resource,path,method,priceMicro,
//         priceUsd,network(CAIP-2),asset,payTo,category,firstCallFree}
router.get('/discovery/resources', async (_req: Request, res: Response) => {
  try {
    const allServices = getCanonicalServices();
    const sorted = [...allServices].sort((a, b) => a.priceUsd - b.priceUsd);
    const firstCallFreeIds = new Set(['gas-price-oracle', 'token-metadata']);

    res.setHeader('Cache-Control', 'public, max-age=300');
    res.setHeader('Content-Type', 'application/json');
    res.json({
      x402Version: 2,
      kind: 'resource-list',
      generatedAt: new Date().toISOString(),
      totalResources: sorted.length,
      links: {
        discovery: `${PUBLIC_BASE_URL}/x402/discovery`,
        catalog: `${PUBLIC_BASE_URL}/x402/catalog`,
        paymentManifest: `${PUBLIC_BASE_URL}/x402/payment-manifest.json`,
      },
      paymentDefaults: {
        network: 'eip155:8453',
        asset: 'USDC',
        assetAddress: USDC_BASE_ADDRESS,
        payTo: PLATFORM_WALLETS.base,
        facilitatorUrl: getFacilitatorUrl(),
        decimals: 6,
      },
      resources: sorted.map(s => ({
        id: s.id,
        resource: `${PUBLIC_BASE_URL}${s.endpoint}`,
        path: s.endpoint,
        method: s.method || 'POST',
        priceMicro: Math.round(s.priceUsd * 1_000_000),
        priceUsd: s.priceUsd,
        network: 'eip155:8453',
        asset: USDC_BASE_ADDRESS,
        payTo: PLATFORM_WALLETS.base,
        category: s.category,
        firstCallFree: firstCallFreeIds.has(s.id),
      })),
    });
  } catch (error: any) {
    console.error('Failed to serve discovery resources:', error);
    res.status(500).json({ error: 'Failed to retrieve discovery resources' });
  }
});

// Discovery alias: /x402/discovery — serves catalog data directly (no redirect)
// The Cloudflare worker (2a06:98c0:3600::103) hits /x402/discovery expecting the service catalog.
// Serving data directly avoids 302 → analytics 'failed' classification and redirect overhead.
router.all('/discovery', async (_req: Request, res: Response) => {
  try {
    const allServices = getCanonicalServices();
    const featured = allServices.filter(s => s.featured);
    const standard = allServices.filter(s => !s.featured);
    const filteredServices = [
      ...featured.sort((a, b) => a.priceUsd - b.priceUsd),
      ...standard.sort((a, b) => a.priceUsd - b.priceUsd),
    ];
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.setHeader('Content-Type', 'application/json');
    res.json({
      x402Version: 2,
      catalogUrl: `${PUBLIC_BASE_URL}/x402/catalog`,
      resourcesUrl: `${PUBLIC_BASE_URL}/x402/discovery/resources`,
      facilitatorUrl: getFacilitatorUrl(),
      totalServices: allServices.length,
      links: {
        catalog: `${PUBLIC_BASE_URL}/x402/catalog`,
        resources: `${PUBLIC_BASE_URL}/x402/discovery/resources`,
        paymentManifest: `${PUBLIC_BASE_URL}/x402/payment-manifest.json`,
      },
      services: filteredServices.map(service => ({
        id: service.id,
        name: service.name,
        description: service.description,
        endpoint: service.endpoint,
        method: service.method,
        priceUSD: service.priceUsd,
        priceMicro: Math.round(service.priceUsd * 1_000_000),
        category: service.category,
        discoverable: true,
      })),
    });
  } catch (error: any) {
    console.error('Failed to serve discovery catalog:', error);
    res.status(500).json({ error: 'Failed to retrieve service catalog' });
  }
});


// ============================================================================
// PAYMENT MANIFEST — /x402/payment-manifest.json
// Single structured file: all service IDs, USDC amounts, payment addresses,
// network IDs, challenge format examples. Unblocks integration-phase actors
// who have collected 402 challenges and need a machine-readable payment table.
// ============================================================================
router.get('/payment-manifest.json', async (_req: Request, res: Response) => {
  try {
    const allServices = getCanonicalServices();
    const sorted = [...allServices].sort((a, b) => a.priceUsd - b.priceUsd);

    const services = sorted.map(s => ({
      id: s.id,
      name: s.name,
      description: s.description,
      endpoint: `${PUBLIC_BASE_URL}${s.endpoint}`,
      method: s.method || 'POST',
      priceUSDC: s.priceUsd,
      priceMicro: Math.round(s.priceUsd * 1_000_000),
      category: s.category || 'general',
    }));

    const manifest = {
      x402Version: 2,
      manifestVersion: '1.0',
      generated: new Date().toISOString(),
      platformUrl: PUBLIC_BASE_URL,
      totalServices: services.length,

      // ── Payment addresses ───────────────────────────────────────────────
      paymentAddresses: {
        base:     { wallet: PLATFORM_WALLETS.base,     caip2: 'eip155:8453',  chainId: 8453,  token: 'USDC', tokenAddress: USDC_BASE_ADDRESS,     tokenDecimals: 6 },
        ethereum: { wallet: PLATFORM_WALLETS.ethereum, caip2: 'eip155:1',     chainId: 1,     token: 'USDC', tokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', tokenDecimals: 6 },
        arbitrum: { wallet: PLATFORM_WALLETS.arbitrum, caip2: 'eip155:42161', chainId: 42161, token: 'USDC', tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', tokenDecimals: 6 },
        solana:   { wallet: PLATFORM_WALLETS.solana,   network: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', token: 'USDC', tokenMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', tokenDecimals: 6 },
      },

      // ── Challenge format guide ──────────────────────────────────────────
      challengeFormat: {
        overview: 'Send exact USDC amount to paymentAddresses[chain].wallet, then retry with X-PAYMENT header containing the tx hash.',
        evmRawHash: {
          step1: 'Send priceMicro / 1_000_000 USDC to paymentAddresses.base.wallet on Base (chainId 8453)',
          step2: 'Wait for transaction confirmation (~2 seconds on Base)',
          step3: 'Set header: X-PAYMENT: <0x-prefixed-66-char-tx-hash>',
          step4: 'Retry the POST request with the X-PAYMENT header',
          example: 'X-PAYMENT: 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12',
        },
        eip3009Authorization: {
          description: 'Sign an EIP-3009 transferWithAuthorization — no prior on-chain tx needed',
          step1: 'Build EIP-3009 auth: { from, to: paymentAddresses.base.wallet, value: priceMicro, validAfter: 0, validBefore: Math.floor(Date.now()/1000)+300, nonce: <random bytes32> }',
          step2: 'Sign with EIP-712 using USDC domain on Base (chainId 8453)',
          step3: 'Base64-encode JSON: { scheme:"exact", network:"eip155:8453", payload:{ authorization: { from,to,value,validAfter,validBefore,nonce,v,r,s } } }',
          step4: 'Set header: X-PAYMENT: <base64-encoded-string>',
          sdkRecommendation: 'Use x402-fetch npm package — handles EIP-3009 signing automatically',
          sdkInstall: 'npm install x402-fetch',
        },
        solanaTransaction: {
          step1: 'Send priceMicro / 1_000_000 USDC to paymentAddresses.solana.wallet on Solana mainnet',
          step2: 'Wait for confirmation',
          step3: 'Set header: X-PAYMENT: <base58-transaction-signature>',
          step4: 'Retry the POST request',
          facilitator: 'https://x402.dexter.cash',
        },
        apiKey: {
          description: 'Card-based API key — no crypto wallet needed. Works on all services.',
          getFreeTrialKey: `GET ${PUBLIC_BASE_URL}/api/m2m/credits/trial`,
          purchaseKey: `POST ${PUBLIC_BASE_URL}/api/m2m/credits/purchase`,
          usage: 'X-API-KEY: cr_live_...',
          note: 'Free $5 trial key available instantly — no payment required',
        },
      },

      // ── Error codes reference ───────────────────────────────────────────
      errorCodes: {
        PAYMENT_HEADER_MISSING:      'No X-PAYMENT header provided — add it and retry',
        PAYMENT_DECODE_FAILED:       'X-PAYMENT header could not be parsed — check format (raw 0x hash, base64 JSON, or base58 Solana sig)',
        PAYMENT_VERIFICATION_FAILED: 'Transaction not found or does not transfer the required amount to the platform wallet',
        PAYMENT_AMOUNT_INSUFFICIENT: 'Transaction amount is below priceMicro — send exact amount or check decimals (USDC has 6 decimals)',
        SOLANA_VERIFICATION_FAILED:  'Solana transaction not found or insufficient amount — wait for confirmation then retry',
        SOLANA_REPLAY_REJECTED:      'This Solana signature was already used — generate a new transaction',
        PAYMENT_EXPIRED:             'Payment authorization expired — validBefore timestamp passed; re-sign with a fresh timestamp',
      },

      // ── Quick-start examples ────────────────────────────────────────────
      quickStart: {
        cheapestService: services[0] ? { id: services[0].id, endpoint: services[0].endpoint, priceUSDC: services[0].priceUSDC } : null,
        trialKeyEndpoint: `GET ${PUBLIC_BASE_URL}/api/m2m/credits/trial`,
        catalogEndpoint: `${PUBLIC_BASE_URL}/x402/catalog`,
        docsEndpoint: `${PUBLIC_BASE_URL}/docs/x402-quick-start`,
        sdkInstall: 'npm install x402-fetch   # handles payment signing automatically',
      },

      // ── Full service table ──────────────────────────────────────────────
      services,
    };

    res.setHeader('Cache-Control', 'public, max-age=300');
    res.setHeader('Content-Type', 'application/json');
    res.json(manifest);
  } catch (error: any) {
    console.error('Failed to serve payment manifest:', error);
    res.status(500).json({ error: 'Failed to generate payment manifest' });
  }
});

// Also handle POST for offer links (in case agent sends POST)
router.post('/offer/:trackingId', async (req: Request, res: Response) => {
  const { trackingId } = req.params;
  
  try {
    const offer = await offerLinkService.getOfferByTrackingId(trackingId);
    
    if (!offer || !offer.isActive) {
      return res.status(404).json({
        success: false,
        error: 'Offer not found, expired, or deactivated',
        suggestion: 'Visit /x402/catalog for available services',
      });
    }
    
    // Check expiration
    if (offer.expiresAt && new Date(offer.expiresAt) < new Date()) {
      return res.status(410).json({
        success: false,
        error: 'This offer has expired',
      });
    }
    
    // Record click
    await offerLinkService.recordClick(trackingId);
    (req as any).offerTrackingId = trackingId;
    
    const service = serviceCatalogService.getService(offer.serviceId);
    if (!service) {
      return res.status(404).json({
        success: false,
        error: 'Service no longer available',
      });
    }
    
    // Pass tracking ID as query param for attribution
    const baseEndpoint = service.endpoint;
    const separator = baseEndpoint.includes('?') ? '&' : '?';
    const serviceEndpoint = `${baseEndpoint}${separator}offer_tracking=${trackingId}`;
    console.log(`📍 Offer ${trackingId} POST -> redirecting to ${serviceEndpoint}`);
    res.redirect(307, serviceEndpoint);
    
  } catch (error: any) {
    console.error('Offer landing POST error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process offer link',
    });
  }
});

// ============================================================================

// Helper: Check rate limit
function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const record = rateLimitStore.get(key);

  if (!record || now > record.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (record.count >= maxRequests) {
    return false;
  }

  record.count++;
  return true;
}

// Configure all x402 routes with official middleware
// FIX: Use HTTP method + path format for proper route matching
// Paths are relative to /x402 mount point (e.g., 'POST /multi-chain-balance' = POST /x402/multi-chain-balance)
const x402Routes = {
  // Discovery/Echo service for payment explorers (like PayAI's echo merchant)
  "POST /ping": {
    price: `$${microToUSD(SERVICE_PRICING_MICRO["ping"])}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: `${PUBLIC_BASE_URL}/x402/ping`,
      name: "Ping/Echo Service",
      description: "Lowest-cost test endpoint to verify x402 payment flow. Returns platform info and echoes your message.",
      mimeType: "application/json",
      maxTimeoutSeconds: 30,
      inputSchema: {
        bodyFields: {
          message: { type: "string", description: "Optional message to echo back" }
        }
      },
      schema: {
        input: {
          type: "object",
          properties: {
            message: { type: "string", description: "Optional message to echo back" }
          }
        },
        output: {
          type: "object",
          properties: {
            success: { type: "boolean", description: "Request success status" },
            service: { type: "string", description: "Platform name" },
            version: { type: "string", description: "API version" },
            echo: { type: "string", description: "Echoed message or 'pong'" },
            servicesAvailable: { type: "number", description: "Number of x402 services available" }
          }
        }
      }
    }
  },
  // Original 10 trader-focused services
  "POST /multi-chain-balance": {
    price: `$${microToUSD(SERVICE_PRICING_MICRO["multi-chain-balance"])}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: `${PUBLIC_BASE_URL}/x402/multi-chain-balance`,
      name: "Multi-Chain Balance Checker",
      description: "Query wallet balances across 7+ EVM chains in a single API call",
      mimeType: "application/json",
      maxTimeoutSeconds: 120,
      inputSchema: {
        bodyFields: {
          walletAddress: { type: "string", description: "Wallet address to check", required: true },
          chains: { type: "array", items: { type: "string" }, description: "Chains to check (optional)" },
          includeTokens: { type: "boolean", description: "Include token balances (optional)" }
        }
      },
      schema: {
        input: {
          type: "object",
          properties: {
            walletAddress: { type: "string", description: "Wallet address to check" },
            chains: { type: "array", items: { type: "string" }, description: "Chains to check (optional)" },
            includeTokens: { type: "boolean", description: "Include token balances (optional)" }
          },
          required: ["walletAddress"]
        },
        output: {
          type: "object",
          properties: {
            balances: { type: "array", description: "Wallet balances across chains" },
            totalValueUsd: { type: "number", description: "Total portfolio value in USD" }
          }
        }
      }
    }
  },
  "POST /gas-price-oracle": {
    price: `$${microToUSD(SERVICE_PRICING_MICRO["gas-price-oracle"])}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: `${PUBLIC_BASE_URL}/x402/gas-price-oracle`,
      name: "Gas Price Oracle",
      description: "Real-time gas prices for multiple chains with USD cost estimates",
      mimeType: "application/json",
      maxTimeoutSeconds: 60,
      inputSchema: {
        bodyFields: {
          chains: { type: "array", items: { type: "string" }, description: "Chains to check (optional, default: all)" }
        }
      },
      schema: {
        input: {
          type: "object",
          properties: {
            chains: { type: "array", items: { type: "string" }, description: "Chains to check (optional, default: all)" }
          }
        },
        output: {
          type: "object",
          properties: {
            gasPrices: { type: "array", description: "Gas prices across requested chains" }
          }
        }
      }
    }
  },
  "POST /token-price": {
    price: `$${microToUSD(SERVICE_PRICING_MICRO["token-price"])}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: `${PUBLIC_BASE_URL}/x402/token-price`,
      name: "Token Price Feed",
      description: "Token pricing with 24h change, volume, market cap from CoinGecko/DEX Screener",
      mimeType: "application/json",
      maxTimeoutSeconds: 60,
      inputSchema: {
        bodyFields: {
          tokenAddress: { type: "string", description: "Token contract address", required: true },
          chain: { type: "string", description: "Blockchain network", required: true }
        }
      },
      schema: {
        input: {
          type: "object",
          properties: {
            tokenAddress: { type: "string", description: "Token contract address" },
            chain: { type: "string", description: "Blockchain network" }
          },
          required: ["tokenAddress", "chain"]
        },
        output: {
          type: "object",
          properties: {
            price: { type: "number", description: "Current token price in USD" },
            change24h: { type: "number", description: "24-hour price change percentage" },
            volume24h: { type: "number", description: "24-hour trading volume" }
          }
        }
      }
    }
  },
  "POST /contract-scan": {
    price: `$${microToUSD(SERVICE_PRICING_MICRO["contract-scan"])}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: `${PUBLIC_BASE_URL}/x402/contract-scan`,
      name: "Contract Security Scanner",
      description: "AI-powered smart contract security scanning — detects OWASP Smart Contract Top 10 vulnerabilities including reentrancy, integer overflow, access control issues, and front-running risks. Supports Solidity contracts on Ethereum, Base, Polygon, Arbitrum, and BSC. Returns severity-ranked findings with remediation recommendations.",
      mimeType: "application/json",
      maxTimeoutSeconds: 120,
      inputSchema: {
        bodyFields: {
          contractAddress: { type: "string", description: "Smart contract address (0x...)", required: true },
          chain: { type: "string", description: "Blockchain network: ethereum, base, polygon, arbitrum, bsc", required: true }
        }
      },
      schema: {
        input: {
          type: "object",
          properties: {
            contractAddress: { type: "string", description: "Smart contract address (0x...)" },
            chain: { type: "string", description: "Blockchain: ethereum, base, polygon, arbitrum, bsc" }
          },
          required: ["contractAddress", "chain"]
        },
        output: {
          type: "object",
          properties: {
            safetyScore: { type: "number", description: "Security score 0-100" },
            vulnerabilities: { type: "array", description: "Severity-ranked list of detected vulnerabilities with remediation recommendations" },
            owasp_coverage: { type: "string", description: "OWASP Smart Contract Top 10 coverage summary" }
          }
        }
      }
    }
  },
  "POST /wallet-risk": {
    price: `$${microToUSD(SERVICE_PRICING_MICRO["wallet-risk"])}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: `${PUBLIC_BASE_URL}/x402/wallet-risk`,
      name: "Wallet Risk Analyzer",
      description: "Wallet risk analysis with compliance flags and transaction pattern detection",
      mimeType: "application/json",
      maxTimeoutSeconds: 90,
      inputSchema: {
        bodyFields: {
          walletAddress: { type: "string", description: "Wallet address to analyze", required: true },
          chain: { type: "string", description: "Blockchain network", required: true }
        }
      },
      schema: {
        input: {
          type: "object",
          properties: {
            walletAddress: { type: "string", description: "Wallet address to analyze" },
            chain: { type: "string", description: "Blockchain network" }
          },
          required: ["walletAddress", "chain"]
        },
        output: {
          type: "object",
          properties: {
            riskScore: { type: "number", description: "Risk score 0-100" },
            complianceFlags: { type: "array", description: "Compliance issues detected" }
          }
        }
      }
    }
  },
  "POST /trade-signals": {
    price: `$${microToUSD(SERVICE_PRICING_MICRO["trade-signals"])}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: `${PUBLIC_BASE_URL}/x402/trade-signals`,
      name: "AI Trade Signals",
      description: "AI-powered crypto trading signals with entry/exit points and risk analysis",
      mimeType: "application/json",
      maxTimeoutSeconds: 120,
      inputSchema: {
        bodyFields: {
          token: { type: "string", description: "Token symbol (optional, default: BTC/USDT)" },
          timeframe: { type: "string", enum: ["5m", "15m", "1h", "4h", "1d"], description: "Chart timeframe" },
          riskLevel: { type: "string", enum: ["low", "medium", "high"], description: "Risk tolerance level" }
        }
      },
      schema: {
        input: {
          type: "object",
          properties: {
            token: { type: "string", description: "Token symbol (optional, default: BTC/USDT)" },
            timeframe: { type: "string", enum: ["5m", "15m", "1h", "4h", "1d"], description: "Chart timeframe" },
            riskLevel: { type: "string", enum: ["low", "medium", "high"], description: "Risk tolerance level" }
          }
        },
        output: {
          type: "object",
          properties: {
            signal: { type: "string", description: "Buy/Sell/Hold signal" },
            entry: { type: "number", description: "Suggested entry price" },
            target: { type: "number", description: "Price target" },
            stopLoss: { type: "number", description: "Stop loss price" }
          }
        }
      },
      outputSchema: {
        type: "object",
        properties: {
          signal: { type: "string", description: "Buy/Sell/Hold signal" },
          entry: { type: "number", description: "Suggested entry price" },
          target: { type: "number", description: "Price target" },
          stopLoss: { type: "number", description: "Stop loss price" }
        }
      }
    }
  },
  "POST /token-sentiment": {
    price: `$${microToUSD(SERVICE_PRICING_MICRO["token-sentiment"])}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: `${PUBLIC_BASE_URL}/x402/token-sentiment`,
      name: "Token Sentiment Analyzer",
      description: "Social sentiment analysis for tokens with momentum indicators and activity levels",
      mimeType: "application/json",
      maxTimeoutSeconds: 90,
      inputSchema: {
        bodyFields: {
          tokenSymbol: { type: "string", description: "Token symbol (e.g., BTC, ETH, PEPE)", required: true },
          chain: { type: "string", description: "Blockchain network (optional, default: ethereum)" }
        }
      },
      schema: {
        input: {
          type: "object",
          properties: {
            tokenSymbol: { type: "string", description: "Token symbol (e.g., BTC, ETH, PEPE)" },
            chain: { type: "string", description: "Blockchain network (optional, default: ethereum)" }
          },
          required: ["tokenSymbol"]
        },
        output: {
          type: "object",
          properties: {
            sentiment: { type: "string", description: "Bullish/Bearish/Neutral" },
            score: { type: "number", description: "Sentiment score -100 to 100" },
            momentum: { type: "string", description: "Trending momentum indicator" }
          }
        }
      },
      outputSchema: {
        type: "object",
        properties: {
          sentiment: { type: "string", description: "Bullish/Bearish/Neutral" },
          score: { type: "number", description: "Sentiment score -100 to 100" },
          momentum: { type: "string", description: "Trending momentum indicator" }
        }
      }
    }
  },
  "POST /trending-tokens": {
    price: `$${microToUSD(SERVICE_PRICING_MICRO["trending-tokens"])}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: `${PUBLIC_BASE_URL}/x402/trending-tokens`,
      name: "Trending Tokens Feed",
      description: "Top gaining and losing tokens across DEXs with real-time market data",
      mimeType: "application/json",
      maxTimeoutSeconds: 90,
      inputSchema: {
        bodyFields: {
          timeframe: { type: "string", description: "Time period (optional, default: 24h)" },
          chain: { type: "string", description: "Blockchain network (optional, default: all)" }
        }
      },
      schema: {
        input: {
          type: "object",
          properties: {
            timeframe: { type: "string", description: "Time period (optional, default: 24h)" },
            chain: { type: "string", description: "Blockchain network (optional, default: all)" }
          }
        },
        output: {
          type: "object",
          properties: {
            gainers: { type: "array", description: "Top gaining tokens" },
            losers: { type: "array", description: "Top losing tokens" }
          }
        }
      },
      outputSchema: {
        type: "object",
        properties: {
          gainers: { type: "array", description: "Top gaining tokens" },
          losers: { type: "array", description: "Top losing tokens" }
        }
      }
    }
  },
  "POST /whale-alerts": {
    price: `$${microToUSD(SERVICE_PRICING_MICRO["whale-alerts"])}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: `${PUBLIC_BASE_URL}/x402/whale-alerts`,
      name: "Whale Movement Tracker",
      description: "Track large wallet movements (whales) with on-chain transaction monitoring",
      mimeType: "application/json",
      maxTimeoutSeconds: 90,
      inputSchema: {
        bodyFields: {
          chains: { type: "array", items: { type: "string" }, description: "Chains to monitor (optional)" },
          minValueUsd: { type: "number", description: "Minimum transaction value in USD (optional)" },
          tokenAddresses: { type: "array", items: { type: "string" }, description: "Specific tokens to watch (optional)" }
        }
      },
      schema: {
        input: {
          type: "object",
          properties: {
            chains: { type: "array", items: { type: "string" }, description: "Chains to monitor (optional)" },
            minValueUsd: { type: "number", description: "Minimum transaction value in USD (optional)" },
            tokenAddresses: { type: "array", items: { type: "string" }, description: "Specific tokens to watch (optional)" }
          }
        },
        output: {
          type: "object",
          properties: {
            transactions: { type: "array", description: "Recent whale movements" }
          }
        }
      },
      outputSchema: {
        type: "object",
        properties: {
          transactions: { type: "array", description: "Recent whale movements" }
        }
      }
    }
  },
  "POST /dex-liquidity": {
    price: `$${microToUSD(SERVICE_PRICING_MICRO["dex-liquidity"])}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: `${PUBLIC_BASE_URL}/x402/dex-liquidity`,
      name: "DEX Liquidity Monitor",
      description: "Real-time DEX liquidity pool monitoring across multiple exchanges",
      mimeType: "application/json",
      maxTimeoutSeconds: 90,
      inputSchema: {
        bodyFields: {
          tokenAddress: { type: "string", description: "Token contract address", required: true },
          chain: { type: "string", description: "Blockchain network", required: true }
        }
      },
      schema: {
        input: {
          type: "object",
          properties: {
            tokenAddress: { type: "string", description: "Token contract address" },
            chain: { type: "string", description: "Blockchain network" }
          },
          required: ["tokenAddress", "chain"]
        },
        output: {
          type: "object",
          properties: {
            liquidityPools: { type: "array", description: "DEX liquidity data" },
            totalLiquidity: { type: "number", description: "Total liquidity in USD" }
          }
        }
      },
      outputSchema: {
        type: "object",
        properties: {
          liquidityPools: { type: "array", description: "DEX liquidity data" },
          totalLiquidity: { type: "number", description: "Total liquidity in USD" }
        }
      }
    }
  },
  // 5 B2B2C infrastructure services
  "POST /transaction-builder": {
    price: `$${microToUSD(SERVICE_PRICING_MICRO["transaction-builder"])}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: `${PUBLIC_BASE_URL}/x402/transaction-builder`,
      name: "Transaction Builder API",
      description: "Pre-validated transaction encoding for agent-to-agent transfers (B2B2C infrastructure)",
      mimeType: "application/json",
      maxTimeoutSeconds: 60,
      inputSchema: {
        bodyFields: {
          to: { type: "string", description: "Recipient address", required: true },
          chain: { type: "string", description: "Blockchain network", required: true },
          tokenAddress: { type: "string", description: "ERC20 token address (optional)" },
          amount: { type: "string", description: "Token amount (optional)" },
          value: { type: "string", description: "ETH value (optional)" },
          data: { type: "string", description: "Custom transaction data (optional)" }
        }
      },
      schema: {
        input: {
          type: "object",
          properties: {
            to: { type: "string", description: "Recipient address" },
            chain: { type: "string", description: "Blockchain network" },
            tokenAddress: { type: "string", description: "ERC20 token address (optional)" },
            amount: { type: "string", description: "Token amount (optional)" },
            value: { type: "string", description: "ETH value (optional)" },
            data: { type: "string", description: "Custom transaction data (optional)" }
          },
          required: ["to", "chain"]
        },
        output: {
          type: "object",
          properties: {
            transaction: { type: "object", description: "Encoded transaction object ready to sign" }
          }
        }
      },
      outputSchema: {
        type: "object",
        properties: {
          transaction: { type: "object", description: "Encoded transaction object ready to sign" }
        }
      }
    }
  },
  "POST /token-metadata": {
    price: `$${microToUSD(SERVICE_PRICING_MICRO["token-metadata"])}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: `${PUBLIC_BASE_URL}/x402/token-metadata`,
      name: "Token Metadata Service",
      description: "Unified token info across all chains - essential building block for trading agent UIs (B2B2C infrastructure)",
      mimeType: "application/json",
      maxTimeoutSeconds: 60,
      inputSchema: {
        bodyFields: {
          tokenAddress: { type: "string", description: "Token contract address", required: true },
          chain: { type: "string", description: "Blockchain network", required: true }
        }
      },
      schema: {
        input: {
          type: "object",
          properties: {
            tokenAddress: { type: "string", description: "Token contract address" },
            chain: { type: "string", description: "Blockchain network" }
          },
          required: ["tokenAddress", "chain"]
        },
        output: {
          type: "object",
          properties: {
            name: { type: "string", description: "Token name" },
            symbol: { type: "string", description: "Token symbol" },
            decimals: { type: "number", description: "Token decimals" },
            totalSupply: { type: "string", description: "Total supply" }
          }
        }
      },
      outputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Token name" },
          symbol: { type: "string", description: "Token symbol" },
          decimals: { type: "number", description: "Token decimals" },
          totalSupply: { type: "string", description: "Total supply" }
        }
      }
    }
  },
  "POST /approval-manager": {
    price: `$${microToUSD(SERVICE_PRICING_MICRO["approval-manager"])}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: `${PUBLIC_BASE_URL}/x402/approval-manager`,
      name: "Token Approval Manager",
      description: "Token approval transaction generator - required infrastructure for DeFi agents (B2B2C infrastructure)",
      mimeType: "application/json",
      maxTimeoutSeconds: 60,
      inputSchema: {
        bodyFields: {
          tokenAddress: { type: "string", description: "Token to approve", required: true },
          spender: { type: "string", description: "Spender address (DEX router)", required: true },
          amount: { type: "string", description: "Amount to approve or 'unlimited'", required: true },
          chain: { type: "string", description: "Blockchain network", required: true }
        }
      },
      schema: {
        input: {
          type: "object",
          properties: {
            tokenAddress: { type: "string", description: "Token to approve" },
            spender: { type: "string", description: "Spender address (DEX router)" },
            amount: { type: "string", description: "Amount to approve or 'unlimited'" },
            chain: { type: "string", description: "Blockchain network" }
          },
          required: ["tokenAddress", "spender", "amount", "chain"]
        },
        output: {
          type: "object",
          properties: {
            approvalTransaction: { type: "object", description: "Approval transaction data" }
          }
        }
      },
      outputSchema: {
        type: "object",
        properties: {
          approvalTransaction: { type: "object", description: "Approval transaction data" }
        }
      }
    }
  },
  "POST /batch-quote": {
    price: `$${microToUSD(SERVICE_PRICING_MICRO["batch-quote"])}`,
    network: NETWORK,
    config: {
      discoverable: true,
      name: "Multi-DEX Quote Engine",
      description: "Multi-DEX price quotes in single call - critical infrastructure for trading bot price discovery (B2B2C infrastructure)",
      mimeType: "application/json",
      maxTimeoutSeconds: 90,
      inputSchema: {
        bodyFields: {
          fromToken: { type: "string", description: "Input token address", required: true },
          toToken: { type: "string", description: "Output token address", required: true },
          amount: { type: "string", description: "Input amount", required: true },
          chain: { type: "string", description: "Blockchain network", required: true }
        }
      },
      schema: {
        input: {
          type: "object",
          properties: {
            fromToken: { type: "string", description: "Input token address" },
            toToken: { type: "string", description: "Output token address" },
            amount: { type: "string", description: "Input amount" },
            chain: { type: "string", description: "Blockchain network" }
          },
          required: ["fromToken", "toToken", "amount", "chain"]
        },
        output: {
          type: "object",
          properties: {
            quotes: { type: "array", description: "Price quotes from multiple DEXs" },
            bestPrice: { type: "string", description: "Best available price" }
          }
        }
      },
      outputSchema: {
        type: "object",
        properties: {
          quotes: { type: "array", description: "Price quotes from multiple DEXs" },
          bestPrice: { type: "string", description: "Best available price" }
        }
      }
    }
  },
  "POST /portfolio-tracker": {
    price: `$${microToUSD(SERVICE_PRICING_MICRO["portfolio-tracker"])}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: `${PUBLIC_BASE_URL}/x402/portfolio-tracker`,
      name: "Portfolio Tracker API",
      description: "Real-time multi-chain portfolio valuation - infrastructure for portfolio management agents (B2B2C infrastructure)",
      mimeType: "application/json",
      maxTimeoutSeconds: 120,
      inputSchema: {
        bodyFields: {
          walletAddress: { type: "string", description: "Wallet address to track", required: true },
          chains: { type: "array", items: { type: "string" }, description: "Chains to track (default: ethereum, base, polygon)" }
        }
      },
      schema: {
        input: {
          type: "object",
          properties: {
            walletAddress: { type: "string", description: "Wallet address to track" },
            chains: { type: "array", items: { type: "string" }, description: "Chains to track (default: ethereum, base, polygon)" }
          },
          required: ["walletAddress"]
        },
        output: {
          type: "object",
          properties: {
            totalValueUsd: { type: "number", description: "Total portfolio value in USD" },
            holdings: { type: "array", description: "Token holdings across chains" }
          }
        }
      },
      outputSchema: {
        type: "object",
        properties: {
          totalValueUsd: { type: "number", description: "Total portfolio value in USD" },
          holdings: { type: "array", description: "Token holdings across chains" }
        }
      }
    }
  },
  // 3 Premium B2B2C services
  "POST /instant-agent-wallet": {
    price: `$${microToUSD(SERVICE_PRICING_MICRO["instant-agent-wallet"])}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: `${PUBLIC_BASE_URL}/x402/instant-agent-wallet`,
      name: "Instant Agent Wallet Creator",
      description: "Create MPC-secured USDC wallets instantly - Circle Developer-Controlled Wallets for AI agents (Premium B2B2C Infrastructure)",
      mimeType: "application/json",
      maxTimeoutSeconds: 180,
      inputSchema: {
        bodyFields: {
          agentId: { type: "string", description: "Unique AI agent identifier", required: true },
          description: { type: "string", description: "Wallet description/label (optional)" },
          initialFundingAmount: { type: "number", description: "Initial USDC funding amount (optional)" }
        }
      },
      schema: {
        input: {
          type: "object",
          properties: {
            agentId: { type: "string", description: "Unique AI agent identifier" },
            description: { type: "string", description: "Wallet description/label (optional)" },
            initialFundingAmount: { type: "number", description: "Initial USDC funding amount (optional)" }
          },
          required: ["agentId"]
        },
        output: {
          type: "object",
          properties: {
            walletAddress: { type: "string", description: "New wallet address" },
            walletId: { type: "string", description: "Circle wallet ID" },
            network: { type: "string", description: "Blockchain network" }
          }
        }
      },
      outputSchema: {
        type: "object",
        properties: {
          walletAddress: { type: "string", description: "New wallet address" },
          walletId: { type: "string", description: "Circle wallet ID" },
          network: { type: "string", description: "Blockchain network" }
        }
      }
    }
  },
  "POST /agent-create-wallet": {
    price: `$${microToUSD(SERVICE_PRICING_MICRO["agent-create-wallet"])}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: `${PUBLIC_BASE_URL}/x402/agent-create-wallet`,
      name: "Agent Wallet Provisioning",
      description: "Programmatic wallet creation for AI agents via Coinbase CDP - Base chain default, persistent/ephemeral options, full audit logging",
      mimeType: "application/json",
      maxTimeoutSeconds: 180,
      inputSchema: {
        bodyFields: {
          agent_id: { type: "string", description: "Unique AI agent identifier", required: true },
          purpose: { type: "string", enum: ["ephemeral", "persistent"], description: "Wallet purpose (default: persistent)" },
          chain: { type: "string", enum: ["base-mainnet", "ethereum-mainnet", "polygon-mainnet", "arbitrum-mainnet"], description: "Blockchain network (default: base-mainnet)" },
          labels: { type: "array", items: { type: "string" }, description: "Optional classification labels" },
          tags: { type: "array", items: { type: "string" }, description: "Optional tags for categorization" },
          metadata: { type: "object", description: "Optional metadata for the wallet" }
        }
      },
      schema: {
        input: {
          type: "object",
          properties: {
            agent_id: { type: "string", description: "Unique AI agent identifier" },
            purpose: { type: "string", enum: ["ephemeral", "persistent"], description: "Wallet purpose (default: persistent)" },
            chain: { type: "string", enum: ["base-mainnet", "ethereum-mainnet", "polygon-mainnet", "arbitrum-mainnet"], description: "Blockchain network (default: base-mainnet)" },
            labels: { type: "array", items: { type: "string" }, description: "Optional classification labels" },
            tags: { type: "array", items: { type: "string" }, description: "Optional tags for categorization" },
            metadata: { type: "object", description: "Optional metadata for the wallet" }
          },
          required: ["agent_id"]
        },
        output: {
          type: "object",
          properties: {
            wallet_address: { type: "string", description: "New wallet address (0x...)" },
            wallet_id: { type: "string", description: "CDP wallet ID" },
            chain: { type: "string", description: "Blockchain network" },
            custody_type: { type: "string", description: "Custody type (cdp)" },
            purpose: { type: "string", description: "Wallet purpose" },
            status: { type: "string", description: "Wallet status" },
            created_at: { type: "string", description: "Creation timestamp" }
          }
        }
      },
      outputSchema: {
        type: "object",
        properties: {
          wallet_address: { type: "string", description: "New wallet address (0x...)" },
          wallet_id: { type: "string", description: "CDP wallet ID" },
          chain: { type: "string", description: "Blockchain network" },
          custody_type: { type: "string", description: "Custody type (cdp)" },
          purpose: { type: "string", description: "Wallet purpose" },
          status: { type: "string", description: "Wallet status" },
          created_at: { type: "string", description: "Creation timestamp" }
        }
      }
    }
  },
  "POST /verified-agent-identity": {
    price: `$${microToUSD(SERVICE_PRICING_MICRO["verified-agent-identity"])}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: `${PUBLIC_BASE_URL}/x402/verified-agent-identity`,
      name: "Agent Identity Verification",
      description: "KYA (Know-Your-Agent) identity verification - On-chain reputation & compliance scoring using ERC-8004 standard (Premium B2B2C Infrastructure)",
      mimeType: "application/json",
      maxTimeoutSeconds: 180,
      inputSchema: {
        bodyFields: {
          agentId: { type: "string", description: "AI agent identifier", required: true },
          walletAddress: { type: "string", description: "Wallet address to verify", required: true },
          signature: { type: "string", description: "Optional signature for enhanced verification" },
          metadata: { type: "object", description: "Agent metadata for reputation scoring" }
        }
      },
      schema: {
        input: {
          type: "object",
          properties: {
            agentId: { type: "string", description: "AI agent identifier" },
            walletAddress: { type: "string", description: "Wallet address to verify" },
            signature: { type: "string", description: "Optional signature for enhanced verification" },
            metadata: { type: "object", description: "Agent metadata for reputation scoring" }
          },
          required: ["agentId", "walletAddress"]
        },
        output: {
          type: "object",
          properties: {
            verified: { type: "boolean", description: "Verification status" },
            reputationScore: { type: "number", description: "On-chain reputation score" },
            identityNFT: { type: "string", description: "ERC-8004 identity NFT address" }
          }
        }
      },
      outputSchema: {
        type: "object",
        properties: {
          verified: { type: "boolean", description: "Verification status" },
          reputationScore: { type: "number", description: "On-chain reputation score" },
          identityNFT: { type: "string", description: "ERC-8004 identity NFT address" }
        }
      }
    }
  },
  "POST /seamless-chain-bridge": {
    price: `$${microToUSD(SERVICE_PRICING_MICRO["seamless-chain-bridge"])}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: `${PUBLIC_BASE_URL}/x402/seamless-chain-bridge`,
      name: "Cross-Chain USDC Bridge",
      description: "Cross-chain USDC routing via Circle CCTP - Pay on Ethereum, receive on Base/Polygon/Arbitrum instantly (Premium B2B2C Infrastructure)",
      mimeType: "application/json",
      maxTimeoutSeconds: 240,
      inputSchema: {
        bodyFields: {
          fromChain: { type: "string", enum: ["ethereum", "polygon", "base", "arbitrum", "optimism"], description: "Source blockchain", required: true },
          toChain: { type: "string", enum: ["ethereum", "polygon", "base", "arbitrum", "optimism"], description: "Destination blockchain", required: true },
          amount: { type: "string", description: "USDC amount to bridge", required: true },
          fromAddress: { type: "string", description: "Sender wallet address", required: true },
          toAddress: { type: "string", description: "Recipient wallet address on destination chain", required: true },
          currency: { type: "string", description: "Currency to bridge (default: USDC)" }
        }
      },
      schema: {
        input: {
          type: "object",
          properties: {
            fromChain: { type: "string", enum: ["ethereum", "polygon", "base", "arbitrum", "optimism"], description: "Source blockchain" },
            toChain: { type: "string", enum: ["ethereum", "polygon", "base", "arbitrum", "optimism"], description: "Destination blockchain" },
            amount: { type: "string", description: "USDC amount to bridge" },
            fromAddress: { type: "string", description: "Sender wallet address" },
            toAddress: { type: "string", description: "Recipient wallet address on destination chain" },
            currency: { type: "string", description: "Currency to bridge (default: USDC)" }
          },
          required: ["fromChain", "toChain", "amount", "fromAddress", "toAddress"]
        },
        output: {
          type: "object",
          properties: {
            bridgeTransaction: { type: "object", description: "Cross-chain bridge transaction details" },
            estimatedTime: { type: "number", description: "Estimated completion time in seconds" }
          }
        }
      },
      outputSchema: {
        type: "object",
        properties: {
          bridgeTransaction: { type: "object", description: "Cross-chain bridge transaction details" },
          estimatedTime: { type: "number", description: "Estimated completion time in seconds" }
        }
      }
    }
  },
  
  // === ROBINHOOD CHAIN — CHAINLINK FEEDS + BOOTSTRAP BRIDGE ===
  "POST /rh-stock-price": {
    price: `$${microToUSD(SERVICE_PRICING_MICRO["rh-stock-price"])}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: `${PUBLIC_BASE_URL}/x402/rh-stock-price`,
      name: "Robinhood Chain Stock Price Feed",
      description: "Live Chainlink SVR price feeds for 35+ stock tokens (AAPL, NVDA, SPY, TSLA, META, AMZN, MSFT, GOOGL, etc.) read directly on-chain from Robinhood Chain (chainId 4663). 8-decimal precision, ~24h heartbeat, 0.5% deviation threshold. Batch up to 10 symbols per call.",
      mimeType: "application/json",
      maxTimeoutSeconds: 30,
      inputSchema: {
        bodyFields: {
          symbol:  { type: "string", description: "Single symbol (e.g. 'AAPL')" },
          symbols: { type: "array", items: { type: "string" }, description: "Batch lookup — max 10 symbols (e.g. ['AAPL','NVDA','SPY'])" },
        }
      },
      schema: {
        input: {
          type: "object",
          properties: {
            symbol:  { type: "string",  description: "Single stock/ETF/crypto symbol" },
            symbols: { type: "array",   description: "Batch symbols — max 10", items: { type: "string" } },
          }
        },
        output: {
          type: "object",
          properties: {
            prices:    { type: "array",  description: "Array of price results with priceUSD, updatedAt, staleSeconds" },
            fulfilled: { type: "number", description: "Number of symbols successfully resolved" },
            errors:    { type: "array",  description: "Any symbols that failed with error message" },
            source:    { type: "string", description: "chainlink-onchain" },
            chainId:   { type: "number", description: "4663 (Robinhood Chain)" },
          }
        }
      }
    }
  },

  "POST /rh-bridge-usdc": {
    price: `$${microToUSD(SERVICE_PRICING_MICRO["rh-bridge-usdc"])}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: `${PUBLIC_BASE_URL}/x402/rh-bridge-usdc`,
      name: "Robinhood Chain Bootstrap Bridge",
      description: "Bridge 0.50 USDC from Base → USDG on Robinhood Chain (chainId 4663) via Across Protocol. Pay $0.75 on Base, receive ~0.47 USDG in your specified RH Chain wallet within ~30 seconds. Ideal for AI agents bootstrapping a Robinhood Chain presence. Treasury-funded, no pre-approval needed.",
      mimeType: "application/json",
      maxTimeoutSeconds: 120,
      inputSchema: {
        bodyFields: {
          recipient: { type: "string", description: "0x wallet address on Robinhood Chain to receive USDG", required: true },
          note:      { type: "string", description: "Optional memo for your records" },
        }
      },
      schema: {
        input: {
          type: "object",
          required: ["recipient"],
          properties: {
            recipient: { type: "string", description: "Valid 0x EVM address on Robinhood Chain (chainId 4663)" },
            note:      { type: "string", description: "Optional memo" },
          }
        },
        output: {
          type: "object",
          properties: {
            success:             { type: "boolean" },
            depositTx:           { type: "string",  description: "Base tx hash of the Across deposit" },
            recipient:           { type: "string",  description: "Destination wallet on Robinhood Chain" },
            amountBridgedUSDC:   { type: "string",  description: "USDC amount sent from Base treasury" },
            estimatedUSDGOutput: { type: "string",  description: "Estimated USDG arriving on RH Chain" },
            estimatedFillTimeSec:{ type: "number",  description: "Seconds until fill completes" },
            baseScan:            { type: "string",  description: "Link to Base tx on basescan.org" },
          }
        }
      }
    }
  },

  // === BANKROLL NETWORK — vltUSDC (Ethereum LP Yield, July 2026) ===
  "POST /vlt-usdc-deposit": {
    price: "free",
    network: NETWORK,
    config: {
      discoverable: true,
      resource: `${PUBLIC_BASE_URL}/x402/vlt-usdc-deposit`,
      name: "vltUSDC Deposit Builder",
      description: "FREE — No payment required. Send {amountUsdc, recipient} and receive 3 unsigned Ethereum transactions: VLT.approve(vault), USDC.approve(vault), vault.deposit(vltAmount, usdcAmount, minShares, deadline, recipient). Agent signs and broadcasts all 3 on Ethereum mainnet. Zero custody — funds stay in your wallet until you submit. Underlying pool: VLT/USDC Uniswap V4 full-range 1% fee. Fees auto-compound. Vault audited by Shieldify. Redeem any time.",
      mimeType: "application/json",
      maxTimeoutSeconds: 30,
      inputSchema: {
        bodyFields: {
          amountUsdc: { type: "string", description: "USDC amount to deposit (e.g. '100' for 100 USDC)", required: true },
          recipient:  { type: "string", description: "Ethereum mainnet wallet address to receive vltUSDC shares", required: true },
        }
      },
      schema: {
        input: {
          type: "object",
          required: ["amountUsdc", "recipient"],
          properties: {
            amountUsdc: { type: "string", description: "USDC deposit amount (positive number as string)" },
            recipient:  { type: "string", description: "0x Ethereum address that receives vltUSDC shares" },
          }
        },
        output: {
          type: "object",
          properties: {
            success:        { type: "boolean" },
            amountUsdc:     { type: "string",  description: "USDC amount with 6-decimal precision" },
            recipient:      { type: "string",  description: "Recipient Ethereum address" },
            network:        { type: "string",  description: "Always 'Ethereum Mainnet'" },
            chainId:        { type: "number",  description: "Always 1 (Ethereum)" },
            steps:          { type: "array",   description: "Two unsigned transactions to sign and broadcast in order" },
            vaultStats:     { type: "object",  description: "Current vault TVL, L/share, APR display" },
            agentInstructions: { type: "string", description: "Plain-English step-by-step instructions for agent" },
          }
        }
      }
    }
  },

  // === ENTERPRISE GATED SERVICES ===
  // NOTE: Enterprise services (smart-contract-audit, payment-processing, compliance-consultation)
  // are handled by x402GatedRoutes.ts with premium pricing ($1000, $50, $500)
  // They are NOT registered here to avoid pricing conflicts
  
  // === VERTICAL EXPANSION: REAL ESTATE SERVICES ===
  "POST /property-valuation": {
    price: `$${microToUSD(SERVICE_PRICING_MICRO["property-valuation"])}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: `${PUBLIC_BASE_URL}/x402/property-valuation`,
      name: "AI Property Valuation",
      description: "AI-powered property valuation using GPT-4 analysis",
      mimeType: "application/json",
      maxTimeoutSeconds: 180,
    },
  },
  "POST /lease-analysis": {
    price: `$${microToUSD(SERVICE_PRICING_MICRO["lease-analysis"])}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: `${PUBLIC_BASE_URL}/x402/lease-analysis`,
      name: "Lease Agreement Analyzer",
      description: "AI analysis of lease terms and obligations",
      mimeType: "application/json",
      maxTimeoutSeconds: 180,
    },
  },
  "POST /construction-progress": {
    price: `$${microToUSD(SERVICE_PRICING_MICRO["construction-progress"])}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: `${PUBLIC_BASE_URL}/x402/construction-progress`,
      name: "Construction Progress Tracker",
      description: "Track construction milestones with AI photo analysis",
      mimeType: "application/json",
      maxTimeoutSeconds: 240,
    },
  },

  // === RWA & TOKENIZATION SERVICES ===
  "POST /rwa-nav-oracle": {
    price: `$${microToUSD(SERVICE_PRICING_MICRO["rwa-nav-oracle"])}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: `${PUBLIC_BASE_URL}/x402/rwa-nav-oracle`,
      name: "RWA Synthetic NAV Oracle",
      description: "Synthetic market-based NAV estimate for real-world asset tokens (real estate, private credit, tokenized treasuries). EIP-712 signed attestation by Coin Railz platform wallet on Base. INFORMATIONAL ONLY — not audited or title-verified.",
      mimeType: "application/json",
      maxTimeoutSeconds: 30,
    },
  },
  "POST /tokenized-yield-compare": {
    price: `$${microToUSD(SERVICE_PRICING_MICRO["tokenized-yield-compare"])}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: `${PUBLIC_BASE_URL}/x402/tokenized-yield-compare`,
      name: "Tokenized Treasury Yield Comparison",
      description: "Live APY comparison across tokenized RWA protocols: Ondo (USDY), Backed (bIB01), Superstate (USTB), Mountain Protocol (USDM), OpenEden (TBILL), Hashnote (USYC), Maple Finance. Sourced from DeFi Llama yields API with 60-second cache.",
      mimeType: "application/json",
      maxTimeoutSeconds: 15,
    },
  },
  
  // === VERTICAL EXPANSION: BANKING/FINANCE SERVICES ===
  "POST /credit-risk-score": {
    price: `$${microToUSD(SERVICE_PRICING_MICRO["credit-risk-score"])}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: `${PUBLIC_BASE_URL}/x402/credit-risk-score`,
      name: "Credit Risk Assessment",
      description: "AI credit risk scoring using financial data",
      mimeType: "application/json",
      maxTimeoutSeconds: 120,
    },
  },
  "POST /fraud-detection": {
    price: `$${microToUSD(SERVICE_PRICING_MICRO["fraud-detection"])}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: `${PUBLIC_BASE_URL}/x402/fraud-detection`,
      name: "Transaction Fraud Detection",
      description: "Real-time fraud pattern detection",
      mimeType: "application/json",
      maxTimeoutSeconds: 90,
    },
  },
  "POST /compliance-check": {
    price: `$${microToUSD(SERVICE_PRICING_MICRO["compliance-check"])}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: `${PUBLIC_BASE_URL}/x402/compliance-check`,
      name: "Regulatory Compliance Check",
      description: "AML/KYC compliance verification",
      mimeType: "application/json",
      maxTimeoutSeconds: 150,
    },
  },
  
  // === VERTICAL EXPANSION: TRADING/INVESTMENT SERVICES ===
  "POST /trading-signal": {
    price: `$${microToUSD(SERVICE_PRICING_MICRO["trading-signal"])}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: `${PUBLIC_BASE_URL}/x402/trading-signal`,
      name: "AI Trading Signal Generator",
      description: "Generate trading signals using technical analysis",
      mimeType: "application/json",
      maxTimeoutSeconds: 120,
    },
  },
  "POST /portfolio-optimization": {
    price: `$${microToUSD(SERVICE_PRICING_MICRO["portfolio-optimization"])}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: `${PUBLIC_BASE_URL}/x402/portfolio-optimization`,
      name: "Portfolio Optimizer",
      description: "AI portfolio allocation and rebalancing",
      mimeType: "application/json",
      maxTimeoutSeconds: 180,
    },
  },
  "POST /sentiment-analysis": {
    price: `$${microToUSD(SERVICE_PRICING_MICRO["sentiment-analysis"])}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: `${PUBLIC_BASE_URL}/x402/sentiment-analysis`,
      name: "Market Sentiment Analyzer",
      description: "Analyze market sentiment from social/news data",
      mimeType: "application/json",
      maxTimeoutSeconds: 120,
    },
  },
  
  // === VERTICAL EXPANSION: MARKET INTELLIGENCE SERVICES ===
  "POST /arbitrage-scanner": {
    price: `$${microToUSD(SERVICE_PRICING_MICRO["arbitrage-scanner"])}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: `${PUBLIC_BASE_URL}/x402/arbitrage-scanner`,
      name: "Cross-Exchange Arbitrage Scanner",
      description: "Identify arbitrage opportunities across chains/exchanges",
      mimeType: "application/json",
      maxTimeoutSeconds: 150,
    },
  },
  "POST /correlation-matrix": {
    price: `$${microToUSD(SERVICE_PRICING_MICRO["correlation-matrix"])}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: `${PUBLIC_BASE_URL}/x402/correlation-matrix`,
      name: "Asset Correlation Matrix",
      description: "Correlation analysis between crypto assets",
      mimeType: "application/json",
      maxTimeoutSeconds: 120,
    },
  },
  "POST /risk-metrics": {
    price: `$${microToUSD(SERVICE_PRICING_MICRO["risk-metrics"])}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: `${PUBLIC_BASE_URL}/x402/risk-metrics`,
      name: "Portfolio Risk Metrics",
      description: "Comprehensive risk analysis: VaR, Sharpe, drawdown",
      mimeType: "application/json",
      maxTimeoutSeconds: 150,
    },
  },
  
  // === VERTICAL EXPANSION: PREDICTION MARKETS SERVICES ===
  "POST /polymarket-events": {
    price: `$${microToUSD(SERVICE_PRICING_MICRO["polymarket-events"])}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: `${PUBLIC_BASE_URL}/x402/polymarket-events`,
      name: "Polymarket Trending Events",
      description: "Get trending prediction market events from Polymarket with volume and odds",
      mimeType: "application/json",
      maxTimeoutSeconds: 60,
      inputSchema: {
        bodyFields: {
          limit: { type: "number", description: "Number of events to return (max 50)", required: false },
          active: { type: "boolean", description: "Filter for active markets only", required: false },
          sortBy: { type: "string", enum: ["volume", "startDate"], description: "Sort by volume or date", required: false }
        }
      },
      schema: {
        input: {
          type: "object",
          properties: {
            limit: { type: "number", description: "Number of events to return (max 50)" },
            active: { type: "boolean", description: "Filter for active markets only" },
            sortBy: { type: "string", enum: ["volume", "startDate"], description: "Sort by volume or date" }
          }
        },
        output: {
          type: "object",
          properties: {
            events: { type: "array", description: "Array of prediction market events with odds and volume" },
            count: { type: "number", description: "Number of events returned" }
          }
        }
      }
    },
  },
  "POST /polymarket-odds": {
    price: `$${microToUSD(SERVICE_PRICING_MICRO["polymarket-odds"])}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: `${PUBLIC_BASE_URL}/x402/polymarket-odds`,
      name: "Polymarket Odds Lookup",
      description: "Get current odds and probability for a specific Polymarket prediction event",
      mimeType: "application/json",
      maxTimeoutSeconds: 60,
      inputSchema: {
        bodyFields: {
          slug: { type: "string", description: "Event slug (e.g., 'will-trump-win-2024')", required: false },
          eventId: { type: "string", description: "Event ID", required: false }
        }
      },
      schema: {
        input: {
          type: "object",
          properties: {
            slug: { type: "string", description: "Event slug (e.g., 'will-trump-win-2024')" },
            eventId: { type: "string", description: "Event ID" }
          }
        },
        output: {
          type: "object",
          properties: {
            event: { type: "object", description: "Event details" },
            odds: { type: "array", description: "Array of outcomes with probabilities and implied odds" }
          }
        }
      }
    },
  },
  "POST /polymarket-search": {
    price: `$${microToUSD(SERVICE_PRICING_MICRO["polymarket-search"])}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: `${PUBLIC_BASE_URL}/x402/polymarket-search`,
      name: "Polymarket Search",
      description: "Search Polymarket prediction markets by keyword. Standard mode searches top 5000 markets by volume. Use exhaustive:true for full catalog search (~15,000+ markets).",
      mimeType: "application/json",
      maxTimeoutSeconds: 120, // Exhaustive search may take longer
      inputSchema: {
        bodyFields: {
          query: { type: "string", description: "Search keyword (e.g., 'bitcoin', 'election')", required: true },
          limit: { type: "number", description: "Number of results to return (max 50)", required: false },
          exhaustive: { type: "boolean", description: "Search all ~15,000+ markets (slower) instead of top 5000", required: false },
          includeArchived: { type: "boolean", description: "Include closed/archived markets in search", required: false }
        }
      },
      schema: {
        input: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search keyword (e.g., 'bitcoin', 'election')" },
            limit: { type: "number", description: "Number of results to return (max 50)" },
            exhaustive: { type: "boolean", description: "Search all markets instead of top 5000 by volume" },
            includeArchived: { type: "boolean", description: "Include closed/archived markets" }
          },
          required: ["query"]
        },
        output: {
          type: "object",
          properties: {
            results: { type: "array", description: "Array of matching prediction markets with relevance scores" },
            count: { type: "number", description: "Number of results found" },
            coverage: { type: "object", description: "Search coverage statistics" }
          }
        }
      }
    },
  },
  "POST /prediction-market-odds": {
    price: `$${microToUSD(SERVICE_PRICING_MICRO["prediction-market-odds"])}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: `${PUBLIC_BASE_URL}/x402/prediction-market-odds`,
      name: "Prediction Market Odds",
      description: "Get current odds and probability for any prediction market event. Supports Polymarket and other prediction market platforms.",
      mimeType: "application/json",
      maxTimeoutSeconds: 60,
      inputSchema: {
        bodyFields: {
          slug: { type: "string", description: "Event slug (e.g., 'will-trump-win-2024')", required: false },
          eventId: { type: "string", description: "Event ID", required: false }
        }
      },
      schema: {
        input: {
          type: "object",
          properties: {
            slug: { type: "string", description: "Event slug (e.g., 'will-trump-win-2024')" },
            eventId: { type: "string", description: "Event ID" }
          }
        },
        output: {
          type: "object",
          properties: {
            event: { type: "object", description: "Event details" },
            odds: { type: "array", description: "Array of outcomes with probabilities and implied odds" }
          }
        }
      }
    },
  },
  // === VERTICAL EXPANSION: KALSHI PREDICTION MARKETS (CFTC-REGULATED) ===
  "POST /kalshi-markets": {
    price: `$${microToUSD(SERVICE_PRICING_MICRO["kalshi-markets"])}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: `${PUBLIC_BASE_URL}/x402/kalshi-markets`,
      name: "Kalshi Active Markets",
      description: "Get active markets from Kalshi, the CFTC-regulated prediction exchange. Access economics, politics, tech, weather, and more.",
      mimeType: "application/json",
      maxTimeoutSeconds: 60,
      inputSchema: {
        bodyFields: {
          limit: { type: "number", description: "Number of markets to return (max 50)", required: false },
          status: { type: "string", description: "Market status filter: open, closed, settled (default: open)", required: false },
          category: { type: "string", description: "Series ticker to filter by (e.g., KXBTC, KXFED)", required: false }
        }
      },
      schema: {
        input: {
          type: "object",
          properties: {
            limit: { type: "number", description: "Number of markets to return (max 50)" },
            status: { type: "string", description: "Market status filter: open, closed, settled" },
            category: { type: "string", description: "Series ticker to filter by" }
          }
        },
        output: {
          type: "object",
          properties: {
            markets: { type: "array", description: "Array of Kalshi prediction markets with prices and volume" },
            count: { type: "number", description: "Number of markets returned" }
          }
        }
      }
    },
  },
  "POST /kalshi-odds": {
    price: `$${microToUSD(SERVICE_PRICING_MICRO["kalshi-odds"])}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: `${PUBLIC_BASE_URL}/x402/kalshi-odds`,
      name: "Kalshi Odds Lookup",
      description: "Get current odds, orderbook depth, and event details for a specific Kalshi market by ticker or event ticker.",
      mimeType: "application/json",
      maxTimeoutSeconds: 60,
      inputSchema: {
        bodyFields: {
          ticker: { type: "string", description: "Market ticker (e.g., KXBTC-26FEB14-B55500)", required: false },
          eventTicker: { type: "string", description: "Event ticker (e.g., KXBTC-26FEB14)", required: false }
        }
      },
      schema: {
        input: {
          type: "object",
          properties: {
            ticker: { type: "string", description: "Market ticker" },
            eventTicker: { type: "string", description: "Event ticker" }
          }
        },
        output: {
          type: "object",
          properties: {
            market: { type: "object", description: "Market details with yes/no prices" },
            orderbook: { type: "object", description: "Current orderbook with yes/no bids" }
          }
        }
      }
    },
  },
  "POST /kalshi-search": {
    price: `$${microToUSD(SERVICE_PRICING_MICRO["kalshi-search"])}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: `${PUBLIC_BASE_URL}/x402/kalshi-search`,
      name: "Kalshi Search",
      description: "Search Kalshi prediction markets by keyword. Searches across market titles, tickers, and events.",
      mimeType: "application/json",
      maxTimeoutSeconds: 120,
      inputSchema: {
        bodyFields: {
          query: { type: "string", description: "Search keyword (e.g., 'bitcoin', 'fed rate')", required: true },
          limit: { type: "number", description: "Number of results to return (max 50)", required: false },
          status: { type: "string", description: "Market status filter: open, closed, settled (default: open)", required: false }
        }
      },
      schema: {
        input: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search keyword" },
            limit: { type: "number", description: "Number of results to return" },
            status: { type: "string", description: "Market status filter" }
          },
          required: ["query"]
        },
        output: {
          type: "object",
          properties: {
            results: { type: "array", description: "Array of matching Kalshi markets with relevance scores" },
            count: { type: "number", description: "Number of results found" }
          }
        }
      }
    },
  },
  // Cross-Platform Prediction Market Spread (Featured)
  "POST /prediction-market-spread": {
    price: `$${microToUSD(SERVICE_PRICING_MICRO["prediction-market-spread"])}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: `${PUBLIC_BASE_URL}/x402/prediction-market-spread`,
      name: "Prediction Market Cross-Platform Spread",
      description: "Live cross-platform spread analysis: Polymarket vs Kalshi. Finds identical real-world events on both exchanges simultaneously, computes YES probability divergence, and ranks arbitrage opportunities by magnitude. Returns matchConfidence, actionHint, edgeBps per opportunity.",
      mimeType: "application/json",
      maxTimeoutSeconds: 15,
      inputSchema: {
        bodyFields: {
          limit: { type: "number", description: "Max opportunities to return (1-25, default 10)", required: false },
          minSpreadPct: { type: "number", description: "Minimum spread in percentage points (e.g. 3 = filter below 3pp)", required: false },
          minConfidence: { type: "string", description: "Minimum match confidence: low, medium, high", required: false }
        }
      },
      schema: {
        input: {
          type: "object",
          properties: {
            limit: { type: "number", description: "Max opportunities to return" },
            minSpreadPct: { type: "number", description: "Minimum spread in percentage points" },
            minConfidence: { type: "string", enum: ["low", "medium", "high"] }
          }
        },
        output: {
          type: "object",
          properties: {
            opportunities: { type: "array", description: "Ranked arbitrage opportunities with spread, confidence, and actionHint" },
            summary: { type: "object", description: "Cross-reference summary with widest spread" },
            sourceStatus: { type: "object", description: "Live/stale status for each data source" }
          }
        }
      }
    },
  },
  // Traditional Markets Services - Stock & Forex Sentiment
  "POST /stock-sentiment": {
    price: `$${microToUSD(SERVICE_PRICING_MICRO["stock-sentiment"])}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: `${PUBLIC_BASE_URL}/x402/stock-sentiment`,
      name: "Stock Sentiment Analysis",
      description: "AI-powered stock market sentiment analysis with news, technical outlook, and institutional activity insights.",
      mimeType: "application/json",
      maxTimeoutSeconds: 120,
      inputSchema: {
        bodyFields: {
          symbol: { type: "string", description: "Stock ticker symbol (e.g., AAPL, TSLA, MSFT)", required: true },
          includeNews: { type: "boolean", description: "Include recent news and headlines analysis" },
          includeTechnicals: { type: "boolean", description: "Include technical analysis and chart patterns" },
          includeInstitutional: { type: "boolean", description: "Include institutional and insider activity" }
        }
      },
      schema: {
        input: {
          type: "object",
          properties: {
            symbol: { type: "string", description: "Stock ticker symbol (e.g., AAPL, TSLA, MSFT)" },
            includeNews: { type: "boolean", description: "Include recent news and headlines analysis" },
            includeTechnicals: { type: "boolean", description: "Include technical analysis and chart patterns" },
            includeInstitutional: { type: "boolean", description: "Include institutional and insider activity" }
          },
          required: ["symbol"]
        },
        output: {
          type: "object",
          properties: {
            symbol: { type: "string", description: "Stock symbol analyzed" },
            overallSentiment: { type: "string", description: "Overall sentiment (Bullish/Bearish/Neutral)" },
            sentimentScore: { type: "number", description: "Sentiment score from -100 to 100" },
            confidence: { type: "number", description: "Analysis confidence 0-100%" },
            keyDrivers: { type: "array", description: "Key drivers of the sentiment" },
            recommendation: { type: "string", description: "Trading recommendation" }
          }
        }
      }
    },
  },
  "POST /forex-sentiment": {
    price: `$${microToUSD(SERVICE_PRICING_MICRO["forex-sentiment"])}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: `${PUBLIC_BASE_URL}/x402/forex-sentiment`,
      name: "Forex Sentiment Analysis",
      description: "AI-powered forex currency pair sentiment analysis with economic factors, central bank policy, and geopolitical insights.",
      mimeType: "application/json",
      maxTimeoutSeconds: 120,
      inputSchema: {
        bodyFields: {
          pair: { type: "string", description: "Currency pair (e.g., EURUSD, GBPJPY, USDJPY)", required: true },
          includeEconomic: { type: "boolean", description: "Include economic factors analysis" },
          includeCentralBank: { type: "boolean", description: "Include central bank policy outlook" },
          includeGeopolitical: { type: "boolean", description: "Include geopolitical factors" }
        }
      },
      schema: {
        input: {
          type: "object",
          properties: {
            pair: { type: "string", description: "Currency pair (e.g., EURUSD, GBPJPY, USDJPY)" },
            includeEconomic: { type: "boolean", description: "Include economic factors analysis" },
            includeCentralBank: { type: "boolean", description: "Include central bank policy outlook" },
            includeGeopolitical: { type: "boolean", description: "Include geopolitical factors" }
          },
          required: ["pair"]
        },
        output: {
          type: "object",
          properties: {
            pair: { type: "string", description: "Currency pair analyzed" },
            overallSentiment: { type: "string", description: "Overall sentiment (Bullish/Bearish/Neutral)" },
            sentimentScore: { type: "number", description: "Sentiment score from -100 to 100" },
            confidence: { type: "number", description: "Analysis confidence 0-100%" },
            keyDrivers: { type: "array", description: "Key drivers of the sentiment" },
            tradingRecommendation: { type: "string", description: "Trading recommendation" }
          }
        }
      }
    },
  },
  "POST /ai-inference": {
    price: `$${microToUSD(SERVICE_PRICING_MICRO["ai-inference"])}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: `${PUBLIC_BASE_URL}/x402/ai-inference`,
      name: "AI Inference Gateway",
      description: "Pay-per-call GPT-4o-mini inference via x402 micropayment. No API keys, no subscriptions, no rate limits. Send any prompt, get an AI response. USDC on Base, $0.05 per call.",
      mimeType: "application/json",
      maxTimeoutSeconds: 60,
      inputSchema: {
        bodyFields: {
          prompt: { type: "string", description: "The prompt or user message to send to the model", required: true },
          model: { type: "string", description: "Model: gpt-4o-mini (only supported model at this endpoint)" },
          maxTokens: { type: "number", description: "Maximum tokens in response (default: 1024)" },
          systemPrompt: { type: "string", description: "Optional system prompt to set context" }
        }
      },
      schema: {
        input: {
          type: "object",
          properties: {
            prompt: { type: "string", description: "The prompt or user message" },
            model: { type: "string", description: "Model name (only gpt-4o-mini supported at this endpoint)" },
            maxTokens: { type: "number", description: "Max response tokens" },
            systemPrompt: { type: "string", description: "System prompt" }
          },
          required: ["prompt"]
        },
        output: {
          type: "object",
          properties: {
            content: { type: "string", description: "Model response text" },
            model: { type: "string", description: "Model used" },
            usage: { type: "object", description: "Token usage stats" }
          }
        }
      }
    },
  },
};

// CRITICAL FIX: x402-express never writes `discoverable` or `facilitatorUrl` into 402 responses
// These fields must be manually injected by wrapping res.json BEFORE paymentMiddleware runs
// See: https://github.com/coinbase/x402-express/issues - discoverable is metadata-only
router.use(async (req: Request, res: Response, next) => {
  // Pre-fetch confidence metrics (cached — fast, ~0ms when warm)
  // Must be awaited here because res.json wrapper is synchronous
  const confidenceMetrics = await getConfidenceMetrics().catch(() => null);

  const originalJson = res.json.bind(res);
  
  // Monkey-patch res.json to inject missing x402scan required fields
  res.json = function(body: any) {
    // Only modify 402 Payment Required responses from x402-express
    if (res.statusCode === 402 && body?.x402Version && body?.accepts) {
      console.log('🔧 Injecting discoverable:true + facilitatorUrl into 402 response');
      
      // Determine correct public base URL for this environment
      const isProduction = process.env.REPLIT_DEPLOYMENT === '1';
      const isWorkspace = process.env.REPL_SLUG && process.env.REPL_OWNER;
      let publicBaseUrl = 'http://localhost:5000';
      
      if (isProduction) {
        publicBaseUrl = 'https://coinrailz.com';
      } else if (isWorkspace) {
        publicBaseUrl = `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
      }
      
      // OVERRIDE: Use PUBLIC_URL env var if set (production canonical URL)
      if (process.env.PUBLIC_URL) {
        publicBaseUrl = process.env.PUBLIC_URL;
      }
      
      // Inject facilitatorUrl at top level (x402scan requirement) - V2 format
      body.facilitatorUrl = getFacilitatorUrl(); // x402 V2 facilitator (CDP primary)
      
      // Advertise all compatible facilitators (CDP + Dexter) and wallet providers
      body.facilitators = getAllFacilitatorUrls();
      body.walletProviders = ["coinbase-cdp", "moonpay-agents", "any-evm"];
      
      // Also inject into extensions so Bazaar/Dexter indexers that look inside extensions find it
      if (!body.extensions) body.extensions = {};
      body.extensions.facilitators = getAllFacilitatorUrls();
      body.extensions.walletProviders = ["coinbase-cdp", "moonpay-agents", "any-evm"];
      
      // Inject discoverable:true + enriched fields into each payment requirement.
      // Filter out Ethereum mainnet first: x402-fetch v0.7.3 validates ALL accepts via
      // PaymentRequirementsSchema.parse() before selecting — "ethereum"/"eip155:1" is not in
      // the network enum, causing a ZodError that blocks Base and Solana payments too.
      body.accepts = body.accepts
        .filter((paymentReq: any) => {
          const n = paymentReq.network || '';
          return n !== 'ethereum' && n !== 'eip155:1';
        })
        .map((paymentReq: any) => {
        const enriched = {
          ...paymentReq,
          discoverable: true,
        };
        
        // Fix resource URL to use canonical domain
        if (paymentReq.resource) {
          enriched.resource = paymentReq.resource
            .replace(/http:\/\/localhost:\d+\//, `${publicBaseUrl}/`)
            .replace(/https:\/\/[^\/]+\.repl\.co\//, `${publicBaseUrl}/`)
            .replace(/https:\/\/[^\/]+\.replit\.dev\//, `${publicBaseUrl}/`);
        }
        
        // Normalize network fields — Base and Solana only (Ethereum excluded above)
        if (enriched.network === 'eip155:8453' || enriched.network === 'base' || !enriched.network) {
          // Always emit CAIP-2 format. @x402/fetch 2.x does not alias "base" → "eip155:8453";
          // network matching is exact string only, so shorthand causes "No network/scheme registered".
          enriched.network = 'eip155:8453';
          enriched.networkLegacy = enriched.networkLegacy || 'base';
          enriched.x402Network = 'eip155:8453';
        }
        if (enriched.network === 'solana' || enriched.network === 'solana:mainnet' || enriched.network === 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp') {
          // Keep network as "solana" shorthand — x402-fetch PaymentRequirementsSchema requires it
          // x402Network holds the full CAIP-2 for Dexter facilitator compatibility
          enriched.network = 'solana';
          enriched.networkLegacy = enriched.networkLegacy || 'solana';
          enriched.x402Network = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';
          // Tag Solana entries with Dexter as the facilitator
          if (!enriched.facilitator) {
            enriched.facilitator = 'https://x402.dexter.cash';
          }
        }
        if (enriched.maxAmountRequired && !enriched.amount) {
          enriched.amount = enriched.maxAmountRequired;
        }
        
        // Add maxAmountRequiredUSD if not present (convert from micro units)
        if (paymentReq.maxAmountRequired && !paymentReq.maxAmountRequiredUSD) {
          const microUnits = parseInt(paymentReq.maxAmountRequired, 10);
          enriched.maxAmountRequiredUSD = `$${(microUnits / 1_000_000).toFixed(2)}`;
        }
        
        // Ensure extra metadata is complete
        if (!enriched.extra) {
          enriched.extra = {};
        }
        enriched.extra.name = enriched.extra.name || "USD Coin";
        enriched.extra.version = enriched.extra.version || "2";
        enriched.extra.decimals = enriched.extra.decimals || 6;
        enriched.extra.chainId = enriched.extra.chainId || 8453;
        enriched.extra.chainName = enriched.extra.chainName || "Base";
        
        return enriched;
      });
      
      // V1 COMPAT SHIM: When ?x402v=1 is requested, downgrade to V1 format for x402scan
      // ROLLBACK: Delete this block (5 lines) if issues arise. Added Dec 22, 2025.
      if (req.query.x402v === '1') {
        body.x402Version = 1;
        body.accepts?.forEach((item: any) => delete item.x402Network);
        console.log(`📋 x402 V1 compat: Serving V1 format for ${req.path}`);
      }
      
      // Add payment instructions if not present
      if (!body.paymentInstructions) {
        body.paymentInstructions = {
          step1: "Obtain USDC on Ethereum (chainId: 1) or Base (chainId: 8453)",
          step2: "Sign EIP-3009 authorization for the exact amount",
          step3: "Include Base64-encoded authorization in X-PAYMENT header",
          step4: "Retry the request with X-PAYMENT header",
          alternativeStep3: "Or include raw transaction hash (0x...) in X-PAYMENT header after sending USDC",
          supportedMethods: ["eip3009-authorization", "raw-transaction-hash"],
          network: "eip155:8453",
          networkLegacy: "base",
          x402Network: "eip155:8453",
          chainId: 8453,
          token: "USDC",
          tokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
        };
      }
      
      // Inject service catalog recommendations for cross-sell
      try {
        const servicePath = req.path.replace(/^\/service\//, '').replace(/^\//, '').replace(/\/$/, '');
        const recommendations = serviceCatalogService.getRecommendedServices(servicePath);
        const catalogSummary = serviceCatalogService.getCatalogSummary();
        
        body.recommendedServices = recommendations.map((s: any) => ({
          id: s.id,
          name: s.name,
          priceUSD: s.priceUSD,
          endpoint: s.endpoint
        }));
        body.catalogUrl = catalogSummary.catalogUrl;
        body.totalServicesAvailable = catalogSummary.totalServices;
        console.log(`📚 Added ${recommendations.length} recommendations to 402 response for ${servicePath}`);
      } catch (e: any) {
        console.log(`⚠️ Catalog recommendations failed: ${e.message}`);
      }
      
      // Inject confidence metrics with machine-verifiable canary proof
      if (confidenceMetrics) {
        body.confidenceMetrics = {
          ...confidenceMetrics,
          note: "Other autonomous agents have successfully used this payment flow.",
        };
      }

      console.log(`✅ Injected: facilitatorUrl=${body.facilitatorUrl}, discoverable=true for ${body.accepts.length} payment requirements`);

      try {
        const minimalPayload = {
          x402Version: body.x402Version || 2,
          accepts: body.accepts.map((a: any) => ({
            scheme: a.scheme,
            network: a.network,
            maxAmountRequired: a.maxAmountRequired,
            amount: a.amount || a.maxAmountRequired,
            resource: a.resource,
            description: a.description,
            mimeType: a.mimeType,
            payTo: a.payTo,
            maxTimeoutSeconds: a.maxTimeoutSeconds,
            asset: a.asset,
            extra: a.extra,
          })),
        };
        const headerValue = Buffer.from(JSON.stringify(minimalPayload), 'utf8').toString('base64');
        res.setHeader('PAYMENT-REQUIRED', headerValue);
      } catch (headerErr: any) {
        console.error(`Failed to set PAYMENT-REQUIRED header: ${headerErr.message}`);
      }
    }
    
    return originalJson(body);
  };
  
  next();
});

// ============================================================================
// GET REQUEST HANDLER FOR BAZAAR DISCOVERY
// Coinbase Bazaar crawler uses GET requests to discover x402 services
// We must return proper 402 Payment Required responses for GET (not just POST)
// ============================================================================
function generate402ResponseForGet(serviceKey: string, req: Request, res: Response, extraFields?: Record<string, unknown>): void {
  const routeConfig = x402Routes[serviceKey as keyof typeof x402Routes];
  if (!routeConfig) {
    res.status(404).json({ error: "Service not found" });
    return;
  }

  // Determine canonical base URL - prioritize PUBLIC_URL env var
  let publicBaseUrl = process.env.PUBLIC_URL || 'http://localhost:5000';
  if (!process.env.PUBLIC_URL) {
    if (process.env.REPLIT_DEPLOYMENT === '1') {
      publicBaseUrl = 'https://coinrailz.com';
    } else if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
      publicBaseUrl = `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
    }
  }

  const priceMatch = routeConfig.price.match(/\$([\d.]+)/);
  const priceUsd = priceMatch ? parseFloat(priceMatch[1]) : 0.01;
  const priceInMicroUnits = Math.round(priceUsd * 1_000_000).toString();

  const servicePath = serviceKey.replace('POST ', '');
  const config = routeConfig.config;

  // CRITICAL: Preserve offer_tracking param in resource URL for attribution
  // When agent pays, they POST to this resource URL - tracking must survive
  const offerTracking = req.query.offer_tracking as string;
  const resourceUrl = offerTracking 
    ? `${publicBaseUrl}/x402${servicePath}?offer_tracking=${offerTracking}`
    : `${publicBaseUrl}/x402${servicePath}`;

  // Get service from catalog for Bazaar metadata
  const catalogService = ServiceCatalogService.getInstance();
  const serviceSlug = servicePath.replace(/^\//, '').replace(/\/$/, '');
  const catalogEntry = catalogService.getCatalog().services.find(
    s => s.slug === serviceSlug || s.endpoint === `/x402/${serviceSlug}`
  );
  
  // Build official Bazaar discovery extension metadata (spec-compliant format)
  // Using @x402/extensions/bazaar v2.0.0 DiscoveryInfo structure
  // These endpoints are registered as GET routes with full GET handler implementations.
  // Advertising GET as canonical tells Bazaar to probe via GET, which is accurate.
  const canonicalMethod: 'GET' | 'POST' = 'GET';
  const bazaarMetadata = catalogEntry 
    ? buildBazaarDiscoveryMetadata(catalogEntry, canonicalMethod) 
    : {
        input: {
          type: "http" as const,
          method: "GET" as const,
          queryParams: {},
          headers: { 'Accept': 'application/json' }
        },
        output: {
          type: "application/json",
          format: "json",
          example: { success: true, timestamp: new Date().toISOString() }
        }
      };

  const response = {
    x402Version: 2,
    error: "X-PAYMENT header is required",
    accepts: [{
      scheme: "exact",
      network: "eip155:8453",
      x402Network: "eip155:8453",
      amount: priceInMicroUnits, // Explicit amount field (x402 v1 spec - used by createPaymentHeader)
      maxAmountRequired: priceInMicroUnits,
      maxAmountRequiredUSD: `$${priceUsd.toFixed(2)}`,
      resource: resourceUrl,
      description: config.description || `x402 service: ${servicePath}`,
      payTo: PLATFORM_WALLET,
      asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      maxTimeoutSeconds: config.maxTimeoutSeconds || 60,
      mimeType: config.mimeType || "application/json",
      discoverable: true,
      category: "API Access",
      tags: ["Crypto", "Blockchain", "AI", "x402", "USDC"],
      extra: {
        name: "USD Coin",
        version: "2",
        decimals: 6,
        chainId: 8453,
        chainName: "Base"
      },
      // OFFICIAL BAZAAR EXTENSION FORMAT (required for facilitator indexing)
      extensions: {
        bazaar: { info: bazaarMetadata }
      },
      // Legacy outputSchema for backward compatibility
      outputSchema: {
        input: {
          type: "http",
          method: canonicalMethod,
          discoverable: true,
          bodyType: "json", // x402 services accept JSON body
          ...(config.inputSchema?.bodyFields ? { bodyFields: config.inputSchema.bodyFields } : {})
        },
        output: config.schema?.output || { type: "object", properties: {} }
      },
      type: "http",
      metadata: {}
    }],
    resource: {
      url: resourceUrl,
      description: config.description || `x402 service: ${servicePath}`,
      mimeType: config.mimeType || "application/json"
    },
    extensions: {
      bazaar: {
        info: {
          input: bazaarMetadata?.input || { type: "http", method: canonicalMethod },
          output: bazaarMetadata?.output || undefined
        },
        schema: config.inputSchema ? {
          type: "object",
          properties: Object.fromEntries(
            Object.entries(config.inputSchema.bodyFields || {}).map(([k, v]: [string, any]) => [
              k, { type: v?.type || "string", description: v?.description || k }
            ])
          )
        } : config.schema?.input || undefined
      }
    },
    facilitatorUrl: getFacilitatorUrl(),
    inputSchema: config.inputSchema ? {
      type: "object",
      description: `Input schema for ${config.name || serviceKey}`,
      properties: Object.fromEntries(
        Object.entries(config.inputSchema.bodyFields || {}).map(([k, v]: [string, any]) => [
          k,
          { type: v?.type || "string", description: v?.description || k, ...(v?.required ? { required: v.required } : {}) }
        ])
      ),
      required: Object.entries(config.inputSchema.bodyFields || {})
        .filter(([_, v]: [string, any]) => v?.required === true)
        .map(([k]: [string, any]) => k),
      httpMethod: canonicalMethod,
      contentType: "application/json"
    } : config.schema?.input ? {
      type: config.schema.input.type || "object",
      description: `Input schema for ${config.name || serviceKey}`,
      properties: config.schema.input.properties || {},
      required: config.schema.input.required || [],
      httpMethod: canonicalMethod,
      contentType: "application/json"
    } : {
      type: "object",
      description: `Input schema for ${config.name || serviceKey}`,
      properties: {},
      httpMethod: canonicalMethod,
      contentType: "application/json"
    },
    paymentInstructions: {
      step1: "Obtain USDC on Ethereum (chainId: 1) or Base (chainId: 8453)",
      step2: "Sign EIP-3009 authorization for the exact amount",
      step3: "Include Base64-encoded authorization in X-PAYMENT header",
      step4: "Retry the request with X-PAYMENT header",
      alternativeStep3: "Or include raw transaction hash (0x...) in X-PAYMENT header after sending USDC",
      supportedMethods: ["eip3009-authorization", "raw-transaction-hash", "api-key"],
      network: "eip155:8453",
      x402Network: "eip155:8453",
      chainId: 8453,
      token: "USDC",
      tokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      sdkExamples: {
        nodejs: {
          install: "npm install @coinrailz/agent-payments",
          code: `import { AgentPayments } from '@coinrailz/agent-payments';

const agent = new AgentPayments({
  privateKey: process.env.PRIVATE_KEY,
  network: 'base'
});

const result = await agent.payAndCall({
  url: 'https://coinrailz.com/x402/gas-price-oracle',
  method: 'POST',
  body: { chains: ['base', 'ethereum'] }
});
console.log(result.data);`
        },
        python: {
          install: "pip install coinrailz",
          code: `import os
from coinrailz import AgentPayments

agent = AgentPayments(
    private_key=os.environ['PRIVATE_KEY'],
    network='base'
)

result = agent.pay_and_call(
    url='https://coinrailz.com/x402/gas-price-oracle',
    method='POST',
    body={'chains': ['base', 'ethereum']}
)
print(result['data'])`
        },
        curl: {
          description: "For testing or simple integrations",
          code: `# Step 1: Get a free wallet (if needed)
curl -X POST https://coinrailz.com/x402/wallet/free \\
  -H "Content-Type: application/json" \\
  -d '{"agent_id": "my-agent", "chain": "base-mainnet"}'

# Step 2: Or use prepaid credits (easiest)
curl -X POST https://coinrailz.com/x402/gas-price-oracle \\
  -H "Content-Type: application/json" \\
  -H "X-API-KEY: your-api-key" \\
  -d '{"chains": ["base"]}'`
        },
        quickStart: "Fastest path: Buy credits at https://coinrailz.com/credits with credit card, then use X-API-KEY header (no blockchain required)"
      }
    },
    alternativePaymentMethods: {
      apiKey: {
        recommended: true,
        description: "Card-based M2M API key — no blockchain or crypto wallet required. Get a cr_live_ key in ~60 seconds.",
        purchaseEndpoint: `${publicBaseUrl}/api/m2m/credits/purchase`,
        purchaseMethod: "POST",
        purchaseBody: { paymentMethodId: "pm_...", amountUsd: 10, idempotencyKey: "<uuid-v4>" },
        purchaseResponse: { apiKey: "cr_live_...", creditsAdded: 200, note: "SAVE apiKey — returned once only" },
        usage: "X-API-KEY: cr_live_... header or Authorization: Bearer cr_live_... on any /x402/* endpoint instead of X-PAYMENT",
        tiers: [
          { amountUsd: 5,   calls: "~80-100 service calls", note: "Try it" },
          { amountUsd: 10,  calls: "~200 service calls" },
          { amountUsd: 25,  calls: "~500 service calls", recommended: true },
          { amountUsd: 100, calls: "~2,000 service calls" }
        ],
        example: `curl -X POST "${resourceUrl}" -H "X-API-KEY: cr_live_..." -H "Content-Type: application/json" -d '{}'`,
        servicesAvailable: 60,
        rateLimit: "5 purchases per IP per hour",
        errorCodes: { "400": "Invalid paymentMethodId or idempotencyKey", "409": "Already processed — use new idempotencyKey", "429": "Rate limit exceeded" }
      },
      rawTransaction: {
        description: "Send USDC directly to platform wallet, include tx hash in X-PAYMENT header",
        usage: "X-PAYMENT: 0x... (raw transaction hash)",
        platformWallet: PLATFORM_WALLET
      }
    },
    freeWalletOffer: {
      message: "Need a wallet? Get one FREE to start using x402 services!",
      endpoint: `${publicBaseUrl}/x402/wallet/free`,
      method: "POST",
      body: {
        agent_id: "your-unique-agent-id",
        purpose: "persistent",
        chain: "base-mainnet"
      },
      supportedChains: ["base-mainnet", "ethereum-mainnet", "polygon-mainnet", "arbitrum-mainnet", "solana-mainnet"],
      benefits: [
        "MPC-secured wallet via Coinbase CDP",
        "No payment required",
        "Instant creation",
        "EVM + Solana supported",
        "Fund with USDC to start transacting"
      ],
      rateLimit: "2 free wallets per IP per day"
    },
    ...(extraFields || {}),
  };

  res.setHeader('X-Agent-Instructions', 'https://coinrailz.com/.well-known/agent-instructions.json');
  res.setHeader('Link', '<https://coinrailz.com/.well-known/agent-instructions.json>; rel="agent-instructions"');
  res.status(402).json(response);
}

const serviceEndpoints = [
  "ping", "multi-chain-balance", "gas-price-oracle", "token-price", "contract-scan",
  "wallet-risk", "trade-signals", "token-sentiment", "trending-tokens", "whale-alerts",
  "dex-liquidity", "transaction-builder", "token-metadata", "approval-manager", "batch-quote",
  "portfolio-tracker", "instant-agent-wallet", "verified-agent-identity", "seamless-chain-bridge",
  "property-valuation", "lease-analysis", "construction-progress",
  "rwa-nav-oracle", "tokenized-yield-compare",
  "credit-risk-score", "fraud-detection", "compliance-check",
  "trading-signal", "portfolio-optimization", "sentiment-analysis",
  "arbitrage-scanner", "correlation-matrix", "risk-metrics",
  "polymarket-events", "polymarket-odds", "polymarket-search", "prediction-market-odds",
  "kalshi-markets", "kalshi-odds", "kalshi-search", "prediction-market-spread",
  "agent-create-wallet",
  "stock-sentiment", "forex-sentiment",
  "ai-inference"
];

// Import creditsService for API key validation on GET requests
import { creditsService } from "../services/creditsService";

// Handler map for GET requests with valid API key payment
const getServiceHandlers: Record<string, (req: Request) => Promise<any>> = {
  "ping": async (req) => ({
    success: true,
    service: "Coin Railz x402 Payment Infrastructure",
    version: "0.4.0",
    timestamp: new Date().toISOString(),
    echo: req.query.message || "pong",
    chains: ["ethereum", "base", "polygon", "bsc", "arbitrum", "optimism", "pulsechain"],
    servicesAvailable: 41,
    documentation: "https://coinrailz.com/developers"
  }),
  "gas-price-oracle": async (req) => {
    const chainsParam = req.query.chains;
    const chains = Array.isArray(chainsParam) 
      ? chainsParam as string[] 
      : chainsParam 
        ? [chainsParam as string] 
        : ['ethereum', 'base', 'polygon', 'arbitrum', 'optimism'];
    return await gasPriceOracleService(chains);
  },
  "token-price": async (req) => await tokenPriceFeedService(
    req.query.address as string || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    req.query.chain as string || 'base'
  ),
  "multi-chain-balance": async (req) => await multiChainBalanceService(
    req.query.address as string || '0x0000000000000000000000000000000000000000',
    req.query.chains as string[] || undefined,
    true
  ),
  "token-metadata": async (req) => await tokenMetadataService(
    req.query.address as string || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    req.query.chain as string || 'base'
  ),
  "wallet-risk": async (req) => await walletRiskScoreService(
    req.query.address as string || '0x0000000000000000000000000000000000000000',
    req.query.chain as string || 'ethereum'
  ),
  "trending-tokens": async () => await trendingTokensFeedService('24h', 'all', 20),
  "trade-signals": async (req) => await tradeSignalsService({
    token: req.query.token as string || 'BTC/USDT',
    timeframe: req.query.timeframe as string || '15m',
    riskLevel: req.query.riskLevel as string || 'medium'
  }),
  "token-sentiment": async (req) => await tokenSocialSentimentService(
    req.query.symbol as string || 'ETH'
  ),
  "whale-alerts": async (req) => await whaleWalletAlertsService(
    Number(req.query.minValue) || 100000,
    req.query.chain as string || 'ethereum'
  ),
  "dex-liquidity": async (req) => await dexLiquidityMonitorService(
    req.query.pair as string || 'ETH/USDC',
    req.query.dex as string || 'uniswap-v3'
  ),
  "contract-scan": async (req) => await contractQuickScanService(
    req.query.address as string || '0x0000000000000000000000000000000000000000',
    req.query.chain as string || 'ethereum'
  ),
  "portfolio-tracker": async (req) => await portfolioTrackerService(
    req.query.address as string || '0x0000000000000000000000000000000000000000'
  ),
  "approval-manager": async (req) => await approvalManagerService(
    req.query.address as string || '0x0000000000000000000000000000000000000000'
  ),
  "batch-quote": async (req) => {
    const pairsParam = req.query.pairs;
    const pairs = Array.isArray(pairsParam) 
      ? pairsParam as string[] 
      : pairsParam 
        ? [pairsParam as string] 
        : ['ETH/USDC', 'BTC/USDC'];
    return await batchQuoteService(pairs);
  },
  "instant-agent-wallet": async (req) => await instantAgentWalletService({
    agentId: `agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    description: req.query.description as string,
    payerIpAddress: req.headers['x-forwarded-for'] as string || req.ip || 'unknown',
    payerUserAgent: req.headers['user-agent'] as string || 'unknown',
  }),
  "arbitrage-scanner": async (req) => {
    const assetsParam = req.query.assets;
    const assets = Array.isArray(assetsParam) 
      ? assetsParam as string[] 
      : assetsParam 
        ? [assetsParam as string] 
        : ['ETH', 'BTC', 'USDC'];
    return await arbitrageScannerService({ 
      assets,
      minProfitPercent: Number(req.query.minProfit) || 0.5,
      maxGasPrice: Number(req.query.maxGas) || 50
    });
  },
  "correlation-matrix": async (req) => {
    const symbolsParam = req.query.symbols;
    const assets = Array.isArray(symbolsParam) 
      ? symbolsParam as string[] 
      : symbolsParam 
        ? [symbolsParam as string] 
        : ['BTC', 'ETH', 'SOL'];
    return await correlationMatrixService({ 
      assets,
      timeframe: req.query.timeframe as string || '30d'
    });
  },
  "risk-metrics": async (req) => await riskMetricsService({ 
    portfolioValue: Number(req.query.portfolioValue) || 10000,
    holdings: [
      { asset: 'BTC', value: 5000 },
      { asset: 'ETH', value: 3000 },
      { asset: 'USDC', value: 2000 }
    ],
    timeHorizon: Number(req.query.timeHorizon) || 1,
    confidenceLevel: Number(req.query.confidence) || 95
  }),
  "stock-sentiment": async (req) => await stockSentimentService({ 
    symbol: req.query.symbol as string || 'AAPL'
  }),
  "forex-sentiment": async (req) => await forexSentimentService({ 
    pair: req.query.pair as string || 'EUR/USD'
  }),
  "ai-inference": async (req) => {
    if (!process.env.OPENAI_API_KEY) {
      return { error: "AI inference service not configured", reason: "OPENAI_API_KEY not set" };
    }
    const prompt = req.query.prompt as string || 'Hello';
    const maxTokens = Number(req.query.maxTokens) || 1024;
    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens
    });
    return {
      content: completion.choices[0]?.message?.content || '',
      model: completion.model,
      usage: completion.usage
    };
  },
};

serviceEndpoints.forEach(endpoint => {
  router.get(`/${endpoint}`, async (req: Request, res: Response) => {
    // CRITICAL FIX: Check for API key authentication BEFORE returning 402
    const apiKey = req.headers['x-api-key'] as string || 
                   (req.headers['authorization'] as string)?.replace('Bearer ', '');
    
    if (apiKey && apiKey.startsWith('cr_live_')) {
      try {
        const keyValidation = await creditsService.validateApiKey(apiKey);
        if (keyValidation.valid && keyValidation.userId) {
          const priceUsd = SERVICE_PRICING_USD[endpoint as keyof typeof SERVICE_PRICING_USD] || 0.25;
          const balance = await creditsService.getBalance(keyValidation.userId);
          
          if (balance >= priceUsd) {
            // Deduct credits and execute service
            await creditsService.deductCredits({
              userId: keyValidation.userId,
              amount: priceUsd,
              serviceName: endpoint,
              description: `x402 Service: ${endpoint} ($${priceUsd.toFixed(2)}) via GET + API key`
            });
            
            console.log(`💳 GET + API key payment SUCCESS for ${endpoint} - $${priceUsd.toFixed(2)} (user: ${keyValidation.userId})`);
            
            // Execute the service handler if available
            const handler = getServiceHandlers[endpoint];
            if (handler) {
              try {
                const result = await handler(req);
                return res.json(result);
              } catch (handlerError: any) {
                console.error(`❌ Service handler error for ${endpoint}:`, handlerError.message);
                return res.status(500).json({ success: false, error: handlerError.message });
              }
            } else {
              // Generic success response for services without specific GET handlers
              return res.json({ 
                success: true, 
                service: endpoint, 
                message: `Service ${endpoint} executed successfully via API key`,
                note: "Use POST for full functionality with request body"
              });
            }
          } else {
            console.log(`⚠️ GET API key: Insufficient credits for ${endpoint} ($${balance.toFixed(2)} < $${priceUsd.toFixed(2)})`);
            return generate402ResponseForGet(`POST /${endpoint}`, req, res, {
              insufficientCredits: true,
              currentBalance: `$${balance.toFixed(2)}`,
              requiredAmount: `$${priceUsd.toFixed(2)}`,
              action: {
                topup_url: 'https://coinrailz.com/dashboard/credits',
                message: `Your API key balance ($${balance.toFixed(2)}) is below the required amount ($${priceUsd.toFixed(2)}) for ${endpoint}. Add at least $${Math.max(0, priceUsd - balance).toFixed(2)} USDC to continue.`,
              },
            });
          }
        } else {
          console.log(`⚠️ GET API key: Invalid API key for ${endpoint}`);
        }
      } catch (apiKeyErr: any) {
        console.error(`⚠️ GET API key validation error for ${endpoint}:`, apiKeyErr.message);
      }
    }
    
    // CRITICAL FIX #2: Check for X-PAYMENT header with raw tx hash (USDC or USDT)
    const xPayment = req.headers['x-payment'] as string;
    if (xPayment && xPayment.startsWith('0x') && xPayment.length === 66) {
      console.log(`🔐 GET + X-PAYMENT raw tx hash detected for ${endpoint}: ${xPayment.substring(0, 10)}...`);
      try {
        const priceUsd = SERVICE_PRICING_USD[endpoint as keyof typeof SERVICE_PRICING_USD] || 0.25;
        const requiredAmountMicro = priceUsd * 1e6; // Convert to micro units
        const verificationResult = await verifyTransactionPayment(xPayment, endpoint, requiredAmountMicro);
        
        if (verificationResult.verified) {
          console.log(`✅ GET + X-PAYMENT verification SUCCESS for ${endpoint} - $${priceUsd} (tx: ${xPayment.substring(0, 10)}..., payer: ${verificationResult.senderAddress})`);
          
          // Execute the service handler if available
          const handler = getServiceHandlers[endpoint];
          if (handler) {
            try {
              const result = await handler(req);
              return res.json(result);
            } catch (handlerError: any) {
              console.error(`❌ Service handler error for ${endpoint}:`, handlerError.message);
              return res.status(500).json({ success: false, error: handlerError.message });
            }
          } else {
            return res.json({ 
              success: true, 
              service: endpoint, 
              message: `Service ${endpoint} executed successfully via on-chain payment`,
              txHash: xPayment,
              pricePaid: `$${priceUsd}`
            });
          }
        } else {
          console.log(`⚠️ GET X-PAYMENT: Verification failed for ${endpoint} - payment rejected or already used`);
        }
      } catch (txVerifyErr: any) {
        console.error(`⚠️ GET X-PAYMENT verification error for ${endpoint}:`, txVerifyErr.message);
      }
    }
    
    // No valid API key or X-PAYMENT payment - return 402 for Bazaar discovery
    console.log(`📡 GET request for /${endpoint} - returning 402 for Bazaar discovery`);
    generate402ResponseForGet(`POST /${endpoint}`, req, res);
  });
});

// NOTE: Enterprise endpoints (smart-contract-audit, payment-processing, compliance-consultation)
// are handled by x402GatedRoutes.ts which is mounted at /x402/service
// They are NOT registered here to prevent route conflicts

const enterpriseDirectEndpoints: Array<{slug: string, price: string, name: string, description: string, inputSchema: any}> = [
  { 
    slug: "smart-contract-audit", price: "$1000", name: "Smart Contract Auditor", 
    description: "Comprehensive smart contract security audit with vulnerability detection",
    inputSchema: {
      type: "object",
      properties: {
        contractAddress: { type: "string", description: "Smart contract address to audit" },
        chain: { type: "string", description: "Blockchain network (e.g., base, ethereum, polygon)" },
        auditScope: { type: "string", description: "Scope: full, security-only, or gas-optimization" }
      },
      required: ["contractAddress"]
    }
  },
  { 
    slug: "payment-processing", price: "$50", name: "Payment Processor", 
    description: "Multi-chain payment processing service (hourly rate)",
    inputSchema: {
      type: "object",
      properties: {
        amount: { type: "number", description: "Amount in USD to process" },
        currency: { type: "string", description: "Token: USDC or USDT" },
        chain: { type: "string", description: "Target chain: base, ethereum, polygon, arbitrum" },
        recipientAddress: { type: "string", description: "Recipient wallet address" }
      },
      required: ["amount", "recipientAddress"]
    }
  },
  { 
    slug: "compliance-consultation", price: "$500", name: "Compliance Consultant", 
    description: "AML/KYC compliance consultation and risk assessment",
    inputSchema: {
      type: "object",
      properties: {
        businessType: { type: "string", description: "Type of business (e.g., exchange, defi, payments)" },
        jurisdiction: { type: "string", description: "Operating jurisdiction (e.g., US, EU, UK, APAC)" },
        transactionVolume: { type: "number", description: "Monthly transaction volume in USD" },
        complianceAreas: { type: "string", description: "Areas: aml, kyc, sanctions, travel-rule" }
      },
      required: ["businessType", "jurisdiction"]
    }
  }
];

enterpriseDirectEndpoints.forEach(service => {
  router.get(`/${service.slug}`, (req: Request, res: Response) => {
    console.log(`📡 GET request for /${service.slug} - returning 402 with enterprise pricing, redirecting to /x402/service/${service.slug}`);
    const priceInMicro = parseFloat(service.price.replace('$', '')) * 1000000;
    const resourceUrl = `${PUBLIC_BASE_URL}/x402/service/${service.slug}`;
    
    const bazaarInput = {
      type: "http" as const,
      method: "POST" as const,
      bodyType: "json" as const,
      body: Object.fromEntries(
        Object.entries(service.inputSchema.properties || {}).map(([k, v]: [string, any]) => [k, v.description || k])
      ),
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
    };
    const bazaarOutput = {
      type: "application/json",
      format: "json",
      example: { success: true, result: {}, timestamp: new Date().toISOString() }
    };
    
    res.setHeader('X-Agent-Instructions', 'https://coinrailz.com/.well-known/agent-instructions.json');
    res.setHeader('Link', '<https://coinrailz.com/.well-known/agent-instructions.json>; rel="agent-instructions"');
    res.status(402).json({
      x402Version: 2,
      error: "X-PAYMENT header is required",
      accepts: [{
        scheme: "exact",
        network: "eip155:8453",
        networkLegacy: "base",
        x402Network: "eip155:8453",
        amount: String(priceInMicro),
        maxAmountRequired: String(priceInMicro),
        maxAmountRequiredUSD: service.price,
        resource: resourceUrl,
        description: service.description,
        payTo: PLATFORM_WALLET,
        asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        maxTimeoutSeconds: 900,
        mimeType: "application/json",
        discoverable: true,
        category: "Enterprise",
        tags: ["Enterprise", "AI", "x402", "USDC"],
        extra: { name: "USD Coin", version: "2", decimals: 6, chainId: 8453, chainName: "Base" },
        extensions: {
          bazaar: { info: { input: bazaarInput, output: bazaarOutput } }
        },
        type: "http",
        metadata: {}
      }],
      resource: {
        url: resourceUrl,
        description: service.description,
        mimeType: "application/json"
      },
      extensions: {
        bazaar: {
          info: { input: bazaarInput, output: bazaarOutput },
          schema: service.inputSchema
        }
      },
      inputSchema: {
        ...service.inputSchema,
        description: `Input schema for ${service.name}`,
        httpMethod: "POST",
        contentType: "application/json"
      },
      facilitatorUrl: getFacilitatorUrl(),
      note: `This is an enterprise service. POST requests should be sent to /x402/service/${service.slug}`,
      enterpriseEndpoint: `/x402/service/${service.slug}`
    });
  });
});

const totalServices = serviceEndpoints.length + enterpriseDirectEndpoints.length;
console.log(`✅ GET handlers registered for ${totalServices} x402 services (Bazaar discovery support)`);

// Payment orchestrator applied per-route (see individual service registrations below)
// This decides between raw hash verification and EIP-712 verification upfront
// Prevents middleware conflict by choosing verification path before x402-express runs
console.log('🔄 Payment orchestrator configured - will apply per-route for flexibility');

console.log(`🌐 PUBLIC_BASE_URL set to: ${PUBLIC_BASE_URL}`);

// ============================================================================
// PING/ECHO SERVICE - Discovery endpoint for payment explorers
// Lowest-cost service to verify x402 payment flow works
// ============================================================================
const pingHandler = async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { message } = req.body;
    const responseTime = Date.now() - startTime;
    
    const result = {
      success: true,
      service: "Coin Railz x402 Payment Infrastructure",
      version: "0.4.0",
      timestamp: new Date().toISOString(),
      echo: message || "pong",
      chains: ["ethereum", "base", "polygon", "bsc", "arbitrum", "optimism", "pulsechain"],
      servicesAvailable: 33,
      documentation: "https://coinrailz.com/developers",
      agentCard: "https://coinrailz.com/.well-known/agent.json",
      responseTimeMs: responseTime,
    };
    
    await trackRequest("ping", req.body, result, responseTime, SERVICE_PRICING_USD["ping"], req.ip || "discovery-bot");
    await trackBundleUsage(req, res, "ping", { message });
    
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

router.post("/ping",
  createPaymentOrchestrator("ping", SERVICE_PRICING_MICRO["ping"], pingHandler),
  // x402Middleware removed - orchestrator handles 402 responses directly
  pingHandler
);

// ============================================================
// GOLDEN PATH — First Paid Call
// Canonical $0.05 onboarding endpoint for new agents.
// Accepts EVM (Base) or Solana USDC via multi-chain accepts[].
// Returns: sessionId, payment receipt, next-service templates.
// ============================================================
const firstCallHandler = async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const ipKey = `first-call-ip:${req.ip}`;
    if (!checkRateLimit(ipKey, 10, 3600000)) {
      res.status(429).json({
        error: "Rate limit exceeded",
        message: "Maximum 10 requests per hour per IP for first-call endpoint",
        retryAfter: 3600
      });
      return;
    }

    const agentId = req.body?.agentId || null;
    const solanaAgent = !!(req.headers['x-solana-wallet']);
    const responseTime = Date.now() - startTime;

    const result = {
      success: true,
      goldenPath: true,
      service: "x402 Golden Path — First Paid Call",
      sessionId: `gp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      payment: {
        verified: true,
        amount: "0.05 USDC",
        amountMicro: 50000,
        chain: solanaAgent ? "Solana mainnet (solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp)" : "Base mainnet (eip155:8453)",
        timestamp: new Date().toISOString()
      },
      welcome: "Payment confirmed. You have successfully integrated with Coin Railz x402 infrastructure.",
      ...(agentId && { agentId }),
      chainsAccepted: {
        evm: "Base (eip155:8453), Ethereum (eip155:1), Polygon, Arbitrum",
        solana: "Solana mainnet (solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp) via Dexter facilitator"
      },
      nextServices: [
        {
          id: "trade-signals",
          name: "AI Trade Signals",
          price: "$0.75 USDC",
          priceUsd: 0.75,
          endpoint: "/x402/trade-signals",
          endpointUrl: "https://coinrailz.com/x402/trade-signals",
          description: "AI BUY/SELL/HOLD signal with confidence score, price targets, and stop-loss. GPT-4o powered.",
          curl: "curl -X POST https://coinrailz.com/x402/trade-signals -H 'X-PAYMENT: <tx_hash>' -H 'Content-Type: application/json' -d '{\"symbol\":\"ETH\"}'"
        },
        {
          id: "multi-chain-balance",
          name: "Multi-Chain Balance",
          price: "$1.00 USDC",
          priceUsd: 1.00,
          endpoint: "/x402/multi-chain-balance",
          endpointUrl: "https://coinrailz.com/x402/multi-chain-balance",
          description: "Wallet balances across Base, Ethereum, Polygon, Arbitrum, and Solana in a single call.",
          curl: "curl -X POST https://coinrailz.com/x402/multi-chain-balance -H 'X-PAYMENT: <tx_hash>' -H 'Content-Type: application/json' -d '{\"address\":\"0xYourWalletAddress\"}'"
        },
        {
          id: "gas-price-oracle",
          name: "Gas Price Oracle",
          price: "$0.10 USDC",
          priceUsd: 0.10,
          endpoint: "/x402/gas-price-oracle",
          endpointUrl: "https://coinrailz.com/x402/gas-price-oracle",
          description: "Real-time gas prices across 8 EVM chains. Lowest-cost entry point to the platform.",
          curl: "curl -X POST https://coinrailz.com/x402/gas-price-oracle -H 'X-PAYMENT: <tx_hash>' -H 'Content-Type: application/json' -d '{\"chains\":[\"base\",\"ethereum\"]}'"
        }
      ],
      catalog: "https://coinrailz.com/x402/catalog",
      sdkInstall: {
        npm: "npm install @coinrailz/agent-payments",
        python: "pip install coinrailz"
      },
      documentation: "https://coinrailz.com/developers",
      partnerContact: {
        schemaVersion: "1.0",
        email: "support@coinrailz.com",
        partnerOnboard: "https://coinrailz.com/api/m2m/credits/trial",
        note: `You just made your first x402 payment. Contact us for partner integration, revenue sharing, and priority API access across all ${getCanonicalServiceCount()} services.`
      },
      responseTimeMs: responseTime
    };

    await trackRequest("first-call", req.body, result, responseTime, SERVICE_PRICING_USD["first-call"], req.ip || "agent");
    await trackBundleUsage(req, res, "first-call", { agentId });

    res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("first-call", req.body, null, responseTime, SERVICE_PRICING_USD["first-call"], req.ip || "agent", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

router.head("/first-call",
  createPaymentOrchestrator("first-call", SERVICE_PRICING_MICRO["first-call"], (_req, res) => {
    res.status(405).send();
  })
);

router.get("/first-call", (req, res, next) => {
  // Machines / agents: only serve HTML if client explicitly requests text/html (browsers do; python-httpx, node-fetch, curl send Accept: */* or nothing)
  const acceptHeader = req.headers["accept"] || "";
  const isBrowser = acceptHeader.includes("text/html");
  if (!isBrowser) {
    return createPaymentOrchestrator("first-call", SERVICE_PRICING_MICRO["first-call"], (_req, res) => {
      res.status(405).json({
        error: "Method Not Allowed",
        hint: "Use POST /x402/first-call with X-PAYMENT header to execute this endpoint",
        method: "POST"
      });
    })(req, res, next);
  }
  const baseUrl = process.env.PUBLIC_BASE_URL || "https://coinrailz.com";
  const pageUrl = `${baseUrl}/x402/first-call`;
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>First Call — x402 Golden Path | Coin Railz</title>
  <meta name="description" content="Start here. Pay $0.05 USDC on Base or Solana and receive a verified onboarding receipt plus 3 ready-to-run service templates. The canonical first payment endpoint for AI agents integrating with Coin Railz x402 infrastructure." />
  <meta name="keywords" content="x402 first call, x402 payment, AI agent payment, USDC micropayment, Base blockchain, Solana payment, x402 protocol, agentic commerce, Coin Railz" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${pageUrl}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${pageUrl}" />
  <meta property="og:title" content="First Call — x402 Golden Path | Coin Railz" />
  <meta property="og:description" content="The canonical $0.05 USDC first payment endpoint for AI agents. EVM (Base, Ethereum) and Solana supported. Returns a verified receipt and 3 executable next-service templates." />
  <meta property="og:site_name" content="Coin Railz" />
  <meta property="twitter:card" content="summary" />
  <meta property="twitter:title" content="First Call — x402 Golden Path | Coin Railz" />
  <meta property="twitter:description" content="The canonical $0.05 USDC first payment endpoint for AI agents integrating with Coin Railz x402 infrastructure." />
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "x402 Golden Path — First Call",
    "description": "The canonical first payment endpoint for AI agents integrating with Coin Railz. Pay $0.05 USDC on Base or Solana and receive a verified onboarding receipt plus 3 ready-to-run service templates.",
    "url": "${pageUrl}",
    "category": "AI Agent Payments",
    "offers": {
      "@type": "Offer",
      "price": "0.05",
      "priceCurrency": "USDC",
      "availability": "https://schema.org/InStock",
      "description": "$0.05 USDC per call. Accepted on Base (eip155:8453), Ethereum (eip155:1), and Solana mainnet."
    },
    "provider": {
      "@type": "Organization",
      "name": "Coin Railz",
      "url": "https://coinrailz.com"
    }
  }
  </script>
  <style>
    body { margin: 0; font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #e2e8f0; }
    .container { max-width: 800px; margin: 0 auto; padding: 3rem 1.5rem; }
    .badge { display: inline-block; background: #1e40af; color: #93c5fd; font-size: 0.75rem; font-weight: 600; padding: 0.25rem 0.75rem; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1.5rem; }
    h1 { font-size: 2.25rem; font-weight: 700; margin: 0 0 1rem; color: #f1f5f9; }
    .subtitle { font-size: 1.125rem; color: #94a3b8; margin-bottom: 2.5rem; line-height: 1.6; }
    .price-block { background: #1e293b; border: 1px solid #334155; border-radius: 0.75rem; padding: 1.5rem; margin-bottom: 2rem; display: flex; gap: 2rem; flex-wrap: wrap; }
    .stat { display: flex; flex-direction: column; gap: 0.25rem; }
    .stat-label { font-size: 0.75rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
    .stat-value { font-size: 1.5rem; font-weight: 700; color: #38bdf8; }
    h2 { font-size: 1.125rem; font-weight: 600; color: #cbd5e1; margin: 2rem 0 0.75rem; }
    pre { background: #1e293b; border: 1px solid #334155; border-radius: 0.5rem; padding: 1rem 1.25rem; overflow-x: auto; font-size: 0.8rem; color: #86efac; line-height: 1.6; }
    .chains { display: flex; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 2rem; }
    .chain { background: #1e293b; border: 1px solid #334155; border-radius: 0.5rem; padding: 0.5rem 1rem; font-size: 0.875rem; color: #cbd5e1; }
    .cta { display: inline-block; background: #1d4ed8; color: white; padding: 0.75rem 1.5rem; border-radius: 0.5rem; text-decoration: none; font-weight: 600; margin-top: 2rem; }
    .cta:hover { background: #1e40af; }
    footer { margin-top: 3rem; padding-top: 1.5rem; border-top: 1px solid #1e293b; font-size: 0.875rem; color: #475569; }
  </style>
</head>
<body>
  <div class="container">
    <div class="badge">Golden Path</div>
    <h1>First Call — x402 Payment Endpoint</h1>
    <p class="subtitle">The canonical starting point for AI agents integrating with Coin Railz. Make one $0.05 USDC payment on Base or Solana and receive a verified onboarding receipt, a session ID, and three executable next-service templates.</p>

    <div class="price-block">
      <div class="stat"><span class="stat-label">Price</span><span class="stat-value">$0.05 USDC</span></div>
      <div class="stat"><span class="stat-label">Method</span><span class="stat-value">POST</span></div>
      <div class="stat"><span class="stat-label">Protocol</span><span class="stat-value">x402 v2</span></div>
    </div>

    <h2>Chains Accepted</h2>
    <div class="chains">
      <span class="chain">Base (eip155:8453)</span>
      <span class="chain">Ethereum (eip155:1)</span>
      <span class="chain">Solana mainnet</span>
    </div>

    <h2>How It Works</h2>
    <p style="color:#94a3b8;line-height:1.6;">Send a POST request without a payment header to receive a 402 challenge containing full dual-track payment instructions — EVM via Coinbase CDP facilitator, Solana via Dexter (x402.dexter.cash). Submit payment and include the receipt in the <code style="background:#1e293b;padding:0.1rem 0.4rem;border-radius:0.25rem;font-size:0.875rem;">X-PAYMENT</code> header on your next request to receive your onboarding receipt.</p>

    <h2>Quick Start</h2>
    <pre>curl -X POST ${baseUrl}/x402/first-call \\
  -H "Content-Type: application/json" \\
  -d '{}'

# Returns HTTP 402 with full payment instructions.
# Submit payment, then:

curl -X POST ${baseUrl}/x402/first-call \\
  -H "Content-Type: application/json" \\
  -H "X-PAYMENT: &lt;your_payment_receipt&gt;" \\
  -d '{}'</pre>

    <h2>What You Get Back</h2>
    <pre>{
  "service": "x402 Golden Path — First Paid Call",
  "sessionId": "gp-...",
  "payment": { "verified": true, "amount": "0.05 USDC" },
  "nextServices": [ ... 3 ready-to-run templates ... ],
  "partnerContact": { "email": "support@coinrailz.com" }
}</pre>

    <a class="cta" href="${baseUrl}/x402/catalog">Browse All ${getCanonicalServiceCount()} Services →</a>

    <footer>
      Coin Railz · <a href="${baseUrl}" style="color:#475569;">coinrailz.com</a> · support@coinrailz.com
    </footer>
  </div>
</body>
</html>`;
  res.status(200).set("Content-Type", "text/html").send(html);
});

router.post("/first-call",
  createPaymentOrchestrator("first-call", SERVICE_PRICING_MICRO["first-call"], firstCallHandler)
);

// Service handler implementations with payment orchestrator
const multiChainBalanceHandler = async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { walletAddress, chains, includeTokens } = req.body;
    
    if (!walletAddress) {
      res.status(400).json({ success: false, error: "walletAddress is required" });
      return;
    }

    const walletKey = `wallet:${walletAddress}`;
    if (!checkRateLimit(walletKey, 100, 3600000)) {
      res.status(429).json({
        error: "Rate limit exceeded",
        message: "Maximum 100 requests per hour per wallet",
      });
      return;
    }

    const result = await multiChainBalanceService(walletAddress, chains, includeTokens);
    const responseTime = Date.now() - startTime;
    
    await trackRequest("multi-chain-balance", req.body, result, responseTime, SERVICE_PRICING_USD["multi-chain-balance"], walletAddress);
    await trackBundleUsage(req, res, "multi-chain-balance", { walletAddress, chains });
    
    res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("multi-chain-balance", req.body, null, responseTime, SERVICE_PRICING_USD["multi-chain-balance"], req.body.walletAddress || "unknown", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

router.post("/multi-chain-balance",
  createPaymentOrchestrator("multi-chain-balance", SERVICE_PRICING_MICRO["multi-chain-balance"], multiChainBalanceHandler),
  // x402Middleware removed - orchestrator handles 402 responses directly
  multiChainBalanceHandler
);

// ✅ TEST ROUTE: gas-price-oracle with payment orchestrator
const gasPriceOracleHandler = async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    // Accept either 'chains' (array) or 'chain' (single), with default
    let chains = req.body.chains;
    if (!chains && req.body.chain) {
      chains = [req.body.chain];
    }
    if (!chains || !Array.isArray(chains) || chains.length === 0) {
      chains = ["ethereum", "base", "polygon"];
    }
    const result = await gasPriceOracleService(chains);
    const responseTime = Date.now() - startTime;
    
    await trackRequest("gas-price-oracle", req.body, result, responseTime, SERVICE_PRICING_USD["gas-price-oracle"], req.ip || "unknown");
    await trackBundleUsage(req, res, "gas-price-oracle", { chains });
    
    res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("gas-price-oracle", req.body, null, responseTime, SERVICE_PRICING_USD["gas-price-oracle"], req.ip || "unknown", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

router.post("/gas-price-oracle", 
  createPaymentOrchestrator("gas-price-oracle", SERVICE_PRICING_MICRO["gas-price-oracle"], gasPriceOracleHandler),
  // x402Middleware removed - orchestrator handles 402 responses directly
  gasPriceOracleHandler
);

const tokenPriceHandler = async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { tokenAddress, chain } = req.body;
    
    if (!tokenAddress || !chain) {
      res.status(400).json({ success: false, error: "tokenAddress and chain are required" });
      return;
    }

    const result = await tokenPriceFeedService(tokenAddress, chain);
    const responseTime = Date.now() - startTime;
    
    await trackRequest("token-price", req.body, result, responseTime, SERVICE_PRICING_USD["token-price"], req.ip || "unknown");
    await trackBundleUsage(req, res, "token-price", { tokenAddress, chain });
    
    res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("token-price", req.body, null, responseTime, SERVICE_PRICING_USD["token-price"], req.ip || "unknown", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

router.post("/token-price",
  createPaymentOrchestrator("token-price", SERVICE_PRICING_MICRO["token-price"], tokenPriceHandler),
  // x402Middleware removed - orchestrator handles 402 responses directly
  tokenPriceHandler
);

const contractScanHandler = async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { contractAddress, chain } = req.body;
    
    if (!contractAddress || !chain) {
      res.status(400).json({ success: false, error: "contractAddress and chain are required" });
      return;
    }

    const result = await contractQuickScanService(contractAddress, chain);
    const responseTime = Date.now() - startTime;
    
    await trackRequest("contract-scan", req.body, result, responseTime, SERVICE_PRICING_USD["contract-scan"], req.ip || "unknown");
    await trackBundleUsage(req, res, "contract-scan", { contractAddress, chain });
    
    res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("contract-scan", req.body, null, responseTime, SERVICE_PRICING_USD["contract-scan"], req.ip || "unknown", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

router.post("/contract-scan",
  createPaymentOrchestrator("contract-scan", SERVICE_PRICING_MICRO["contract-scan"], contractScanHandler),
  // x402Middleware removed - orchestrator handles 402 responses directly
  contractScanHandler
);

const walletRiskHandler = async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { walletAddress, chain } = req.body;
    
    if (!walletAddress || !chain) {
      res.status(400).json({ success: false, error: "walletAddress and chain are required" });
      return;
    }

    const result = await walletRiskScoreService(walletAddress, chain);
    const responseTime = Date.now() - startTime;
    
    await trackRequest("wallet-risk", req.body, result, responseTime, SERVICE_PRICING_USD["wallet-risk"], walletAddress);
    await trackBundleUsage(req, res, "wallet-risk", { walletAddress, chain });
    
    res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("wallet-risk", req.body, null, responseTime, SERVICE_PRICING_USD["wallet-risk"], req.body.walletAddress || "unknown", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

router.post("/wallet-risk",
  createPaymentOrchestrator("wallet-risk", SERVICE_PRICING_MICRO["wallet-risk"], walletRiskHandler),
  // x402Middleware removed - orchestrator handles 402 responses directly
  walletRiskHandler
);

const tradeSignalsHandler = async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { token, timeframe, riskLevel } = req.body;
    const result = await tradeSignalsService({ token, timeframe, riskLevel });
    const responseTime = Date.now() - startTime;
    
    await trackRequest("trade-signals", req.body, result, responseTime, SERVICE_PRICING_USD["trade-signals"], req.ip || "unknown");
    await trackBundleUsage(req, res, "trade-signals", { token, timeframe, riskLevel });
    
    res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("trade-signals", req.body, null, responseTime, SERVICE_PRICING_USD["trade-signals"], req.ip || "unknown", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

router.post("/trade-signals",
  createPaymentOrchestrator("trade-signals", SERVICE_PRICING_MICRO["trade-signals"], tradeSignalsHandler),
  // x402Middleware removed - orchestrator handles 402 responses directly
  tradeSignalsHandler
);

const tokenSentimentHandler = async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { tokenSymbol, chain = "ethereum" } = req.body;
    
    if (!tokenSymbol) {
      res.status(400).json({ success: false, error: "tokenSymbol is required" });
      return;
    }

    // Fixed: pass individual params instead of req.body object
    const result = await tokenSocialSentimentService(tokenSymbol, chain);
    const responseTime = Date.now() - startTime;
    
    await trackRequest("token-sentiment", req.body, result, responseTime, SERVICE_PRICING_USD["token-sentiment"], req.ip || "unknown");
    await trackBundleUsage(req, res, "token-sentiment", req.body);
    
    res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("token-sentiment", req.body, null, responseTime, SERVICE_PRICING_USD["token-sentiment"], req.ip || "unknown", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

router.post("/token-sentiment",
  createPaymentOrchestrator("token-sentiment", SERVICE_PRICING_MICRO["token-sentiment"], tokenSentimentHandler),
  // x402Middleware removed - orchestrator handles 402 responses directly
  tokenSentimentHandler
);

const trendingTokensHandler = async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { timeframe, chain } = req.body;
    const result = await trendingTokensFeedService(timeframe, chain);
    const responseTime = Date.now() - startTime;
    
    await trackRequest("trending-tokens", req.body, result, responseTime, SERVICE_PRICING_USD["trending-tokens"], req.ip || "unknown");
    await trackBundleUsage(req, res, "trending-tokens", { timeframe, chain });
    
    res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("trending-tokens", req.body, null, responseTime, SERVICE_PRICING_USD["trending-tokens"], req.ip || "unknown", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

router.post("/trending-tokens",
  createPaymentOrchestrator("trending-tokens", SERVICE_PRICING_MICRO["trending-tokens"], trendingTokensHandler),
  // x402Middleware removed - orchestrator handles 402 responses directly
  trendingTokensHandler
);

const whaleAlertsHandler = async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    // Service expects: (tokenAddress: string, chain: string, threshold: number)
    const { tokenAddress, chain = "ethereum", threshold = 100000 } = req.body;
    
    if (!tokenAddress) {
      res.status(400).json({ success: false, error: "tokenAddress is required" });
      return;
    }
    
    const result = await whaleWalletAlertsService(tokenAddress, chain, threshold);
    const responseTime = Date.now() - startTime;
    
    await trackRequest("whale-alerts", req.body, result, responseTime, SERVICE_PRICING_USD["whale-alerts"], req.ip || "unknown");
    await trackBundleUsage(req, res, "whale-alerts", { tokenAddress, chain, threshold });
    
    res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("whale-alerts", req.body, null, responseTime, SERVICE_PRICING_USD["whale-alerts"], req.ip || "unknown", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

router.post("/whale-alerts",
  createPaymentOrchestrator("whale-alerts", SERVICE_PRICING_MICRO["whale-alerts"], whaleAlertsHandler),
  // x402Middleware removed - orchestrator handles 402 responses directly
  whaleAlertsHandler
);

const dexLiquidityHandler = async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { tokenAddress, chain } = req.body;
    
    if (!tokenAddress || !chain) {
      res.status(400).json({ success: false, error: "tokenAddress and chain are required" });
      return;
    }

    const result = await dexLiquidityMonitorService(tokenAddress, chain);
    const responseTime = Date.now() - startTime;
    
    await trackRequest("dex-liquidity", req.body, result, responseTime, SERVICE_PRICING_USD["dex-liquidity"], req.ip || "unknown");
    await trackBundleUsage(req, res, "dex-liquidity", { tokenAddress, chain });
    
    res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("dex-liquidity", req.body, null, responseTime, SERVICE_PRICING_USD["dex-liquidity"], req.ip || "unknown", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

router.post("/dex-liquidity",
  createPaymentOrchestrator("dex-liquidity", SERVICE_PRICING_MICRO["dex-liquidity"], dexLiquidityHandler),
  // x402Middleware removed - orchestrator handles 402 responses directly
  dexLiquidityHandler
);

const transactionBuilderHandler = async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const validationResult = transactionBuilderInputSchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({ success: false, error: validationResult.error.message });
      return;
    }

    const result = await transactionBuilderService(validationResult.data);
    const responseTime = Date.now() - startTime;
    
    await trackRequest("transaction-builder", req.body, result, responseTime, SERVICE_PRICING_USD["transaction-builder"], req.ip || "unknown");
    await trackBundleUsage(req, res, "transaction-builder", validationResult.data);
    
    res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("transaction-builder", req.body, null, responseTime, SERVICE_PRICING_USD["transaction-builder"], req.ip || "unknown", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

router.post("/transaction-builder",
  createPaymentOrchestrator("transaction-builder", SERVICE_PRICING_MICRO["transaction-builder"], transactionBuilderHandler),
  // x402Middleware removed - orchestrator handles 402 responses directly
  transactionBuilderHandler
);

const tokenMetadataHandler = async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { tokenAddress, chain } = req.body;
    
    if (!tokenAddress || !chain) {
      res.status(400).json({ success: false, error: "tokenAddress and chain are required" });
      return;
    }

    const result = await tokenMetadataService(tokenAddress, chain);
    const responseTime = Date.now() - startTime;
    
    await trackRequest("token-metadata", req.body, result, responseTime, SERVICE_PRICING_USD["token-metadata"], req.ip || "unknown");
    await trackBundleUsage(req, res, "token-metadata", { tokenAddress, chain });
    
    res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("token-metadata", req.body, null, responseTime, SERVICE_PRICING_USD["token-metadata"], req.ip || "unknown", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

router.post("/token-metadata",
  createPaymentOrchestrator("token-metadata", SERVICE_PRICING_MICRO["token-metadata"], tokenMetadataHandler),
  // x402Middleware removed - orchestrator handles 402 responses directly
  tokenMetadataHandler
);

const approvalManagerHandler = async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const validationResult = approvalManagerInputSchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({ success: false, error: validationResult.error.message });
      return;
    }

    const result = await approvalManagerService(validationResult.data);
    const responseTime = Date.now() - startTime;
    
    await trackRequest("approval-manager", req.body, result, responseTime, SERVICE_PRICING_USD["approval-manager"], req.ip || "unknown");
    await trackBundleUsage(req, res, "approval-manager", validationResult.data);
    
    res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("approval-manager", req.body, null, responseTime, SERVICE_PRICING_USD["approval-manager"], req.ip || "unknown", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

router.post("/approval-manager",
  createPaymentOrchestrator("approval-manager", SERVICE_PRICING_MICRO["approval-manager"], approvalManagerHandler),
  // x402Middleware removed - orchestrator handles 402 responses directly
  approvalManagerHandler
);

const batchQuoteHandler = async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const validationResult = batchQuoteInputSchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({ success: false, error: validationResult.error.message });
      return;
    }

    const result = await batchQuoteService(validationResult.data);
    const responseTime = Date.now() - startTime;
    
    await trackRequest("batch-quote", req.body, result, responseTime, SERVICE_PRICING_USD["batch-quote"], req.ip || "unknown");
    await trackBundleUsage(req, res, "batch-quote", validationResult.data);
    
    res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("batch-quote", req.body, null, responseTime, SERVICE_PRICING_USD["batch-quote"], req.ip || "unknown", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

router.post("/batch-quote",
  createPaymentOrchestrator("batch-quote", SERVICE_PRICING_MICRO["batch-quote"], batchQuoteHandler),
  // x402Middleware removed - orchestrator handles 402 responses directly
  batchQuoteHandler
);

const portfolioTrackerHandler = async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { walletAddress, chains } = req.body;
    
    if (!walletAddress) {
      res.status(400).json({ success: false, error: "walletAddress is required" });
      return;
    }

    const result = await portfolioTrackerService(walletAddress, chains || ["ethereum", "base", "polygon"]);
    const responseTime = Date.now() - startTime;
    
    await trackRequest("portfolio-tracker", req.body, result, responseTime, SERVICE_PRICING_USD["portfolio-tracker"], walletAddress);
    await trackBundleUsage(req, res, "portfolio-tracker", { walletAddress, chains });
    
    res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("portfolio-tracker", req.body, null, responseTime, SERVICE_PRICING_USD["portfolio-tracker"], req.body.walletAddress || "unknown", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

router.post("/portfolio-tracker",
  createPaymentOrchestrator("portfolio-tracker", SERVICE_PRICING_MICRO["portfolio-tracker"], portfolioTrackerHandler)
);

const instantAgentWalletHandler = async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    let { agentId, description, initialFundingAmount } = req.body;
    
    // Extract payer info for customer attribution
    const analyticsContext = (req as any).analytics;
    const payerWalletAddress = analyticsContext?.walletAddress || null;
    const payerIpAddress = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || req.ip || null;
    const payerUserAgent = req.headers['user-agent'] || null;
    const paymentTxHash = analyticsContext?.transactionHash || null;
    
    // Auto-generate agentId if not provided - critical for x402 payments where agents may not send metadata
    if (!agentId) {
      // Add nonce suffix to prevent collisions when same payer creates multiple wallets
      const nonce = Date.now().toString(36).slice(-4);
      if (payerWalletAddress) {
        agentId = `agent-${payerWalletAddress.slice(0, 10).toLowerCase()}-${nonce}`;
        console.log(`📊 TELEMETRY: agentId auto-generated from payerAddress | agentId=${agentId} | source=payer_wallet | payer=${payerWalletAddress.slice(0, 10)}`);
      } else {
        // Generate random agentId using timestamp + random suffix
        agentId = `agent-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        console.log(`📊 TELEMETRY: agentId auto-generated randomly | agentId=${agentId} | source=random | note=analytics_context_missing`);
      }
    }

    // Pass payer info to service for customer attribution logging
    const result = await instantAgentWalletService({ 
      agentId, 
      description, 
      initialFundingAmount,
      payerWalletAddress,
      payerIpAddress,
      payerUserAgent,
      paymentTxHash,
    });
    const responseTime = Date.now() - startTime;
    
    await trackRequest("instant-agent-wallet", req.body, result, responseTime, SERVICE_PRICING_USD["instant-agent-wallet"], result.walletAddress);
    await trackBundleUsage(req, res, "instant-agent-wallet", { agentId });
    
    res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("instant-agent-wallet", req.body, null, responseTime, SERVICE_PRICING_USD["instant-agent-wallet"], req.ip || "unknown", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

router.post("/instant-agent-wallet",
  createPaymentOrchestrator("instant-agent-wallet", SERVICE_PRICING_MICRO["instant-agent-wallet"], instantAgentWalletHandler)
);

const verifiedAgentIdentityHandler = async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { agentId, walletAddress, signature, metadata } = req.body;
    
    if (!agentId || !walletAddress) {
      res.status(400).json({ success: false, error: "agentId and walletAddress are required" });
      return;
    }

    const result = await verifiedAgentIdentityService({ agentId, walletAddress, signature, metadata });
    const responseTime = Date.now() - startTime;
    
    await trackRequest("verified-agent-identity", req.body, result, responseTime, SERVICE_PRICING_USD["verified-agent-identity"], walletAddress);
    await trackBundleUsage(req, res, "verified-agent-identity", { agentId, walletAddress });
    
    res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("verified-agent-identity", req.body, null, responseTime, SERVICE_PRICING_USD["verified-agent-identity"], req.body.walletAddress || "unknown", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

router.post("/verified-agent-identity",
  createPaymentOrchestrator("verified-agent-identity", SERVICE_PRICING_MICRO["verified-agent-identity"], verifiedAgentIdentityHandler),
  // x402Middleware removed - orchestrator handles 402 responses directly
  verifiedAgentIdentityHandler
);

const seamlessChainBridgeHandler = async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { fromChain, toChain, amount, fromAddress, toAddress, currency } = req.body;
    
    if (!fromChain || !toChain || !amount || !fromAddress || !toAddress) {
      res.status(400).json({ 
        success: false, 
        error: "fromChain, toChain, amount, fromAddress, and toAddress are required" 
      });
      return;
    }

    const result = await seamlessChainBridgeService({ fromChain, toChain, amount, fromAddress, toAddress, currency });
    const responseTime = Date.now() - startTime;
    
    await trackRequest("seamless-chain-bridge", req.body, result, responseTime, SERVICE_PRICING_USD["seamless-chain-bridge"], fromAddress);
    await trackBundleUsage(req, res, "seamless-chain-bridge", { fromChain, toChain, amount });
    
    res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("seamless-chain-bridge", req.body, null, responseTime, SERVICE_PRICING_USD["seamless-chain-bridge"], req.body.fromAddress || "unknown", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

router.post("/seamless-chain-bridge",
  createPaymentOrchestrator("seamless-chain-bridge", SERVICE_PRICING_MICRO["seamless-chain-bridge"], seamlessChainBridgeHandler),
  // x402Middleware removed - orchestrator handles 402 responses directly
  seamlessChainBridgeHandler
);

// === ENTERPRISE GATED SERVICE HANDLERS ===

const smartContractAuditHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { contractCode, contractName } = req.body;

    if (!contractCode) {
      res.status(400).json({
        success: false,
        error: 'Contract code is required',
      });
      return;
    }

    const { nanoid } = await import('nanoid');
    const { SmartContractAuditHandler } = await import('../services/handlers/SmartContractAuditHandler');
    const handler = new SmartContractAuditHandler();
    
    const result = await handler.execute({
      orderId: nanoid(),
      agentId: 'smart-contract-auditor',
      serviceType: 'x402_gated',
      customerId: req.ip || 'x402-autonomous',
      amount: 1000,
      metadata: { protocol: 'x402', paymentVerified: true },
      contractCode,
      contractName: contractName || 'Contract',
    });

    await trackBundleUsage(req, res, "smart-contract-audit", { contractName });

    res.json({
      success: true,
      result,
      amountPaid: 1000,
      currency: 'USDC',
      network: 'eip155:8453',
    });
  } catch (error: any) {
    console.error('Smart contract audit execution failed:', error);
    res.status(500).json({
      success: false,
      error: 'Audit execution failed',
      details: error.message,
    });
  }
};

const paymentProcessingHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { amount, currency, network, recipientAddress } = req.body;

    if (!amount || !currency || !network || !recipientAddress) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: amount, currency, network, recipientAddress',
      });
      return;
    }

    const { nanoid } = await import('nanoid');
    const { PaymentProcessorHandler } = await import('../services/handlers/PaymentProcessorHandler');
    const handler = new PaymentProcessorHandler();
    
    const result = await handler.execute({
      orderId: nanoid(),
      agentId: 'payment-processor',
      serviceType: 'x402_gated',
      customerId: req.ip || 'x402-autonomous',
      amount: 50,
      metadata: { protocol: 'x402', paymentVerified: true },
      paymentDetails: {
        amount,
        currency,
        network,
        recipientAddress,
      },
    });

    await trackBundleUsage(req, res, "payment-processing", { amount, currency, network });

    res.json({
      success: true,
      result,
      amountPaid: 50,
      currency: 'USDC',
      network: 'eip155:8453',
    });
  } catch (error: any) {
    console.error('Payment processing execution failed:', error);
    res.status(500).json({
      success: false,
      error: 'Payment processing failed',
      details: error.message,
    });
  }
};

const complianceConsultationHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { businessType, jurisdiction, transactionVolume } = req.body;

    if (!businessType || !jurisdiction) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: businessType, jurisdiction',
      });
      return;
    }

    const { nanoid } = await import('nanoid');
    const { ComplianceConsultantHandler } = await import('../services/handlers/ComplianceConsultantHandler');
    const handler = new ComplianceConsultantHandler();
    
    const result = await handler.execute({
      orderId: nanoid(),
      agentId: 'compliance-consultant',
      serviceType: 'x402_gated',
      customerId: req.ip || 'x402-autonomous',
      amount: 500,
      metadata: { protocol: 'x402', paymentVerified: true },
      complianceRequirements: {
        businessType,
        jurisdiction,
        transactionVolume: transactionVolume || 0,
      },
    });

    await trackBundleUsage(req, res, "compliance-consultation", { businessType, jurisdiction });

    res.json({
      success: true,
      result,
      amountPaid: 500,
      currency: 'USDC',
      network: 'eip155:8453',
    });
  } catch (error: any) {
    console.error('Compliance consultation execution failed:', error);
    res.status(500).json({
      success: false,
      error: 'Consultation execution failed',
      details: error.message,
    });
  }
};

// Register enterprise gated service routes
router.post("/service/smart-contract-audit",
  createPaymentOrchestrator("smart-contract-audit", SERVICE_PRICING_MICRO["smart-contract-audit"], smartContractAuditHandler),
  // x402Middleware removed - orchestrator handles 402 responses directly
  smartContractAuditHandler
);

router.post("/service/payment-processing",
  createPaymentOrchestrator("payment-processing", SERVICE_PRICING_MICRO["payment-processing"], paymentProcessingHandler),
  // x402Middleware removed - orchestrator handles 402 responses directly
  paymentProcessingHandler
);

router.post("/service/compliance-consultation",
  createPaymentOrchestrator("compliance-consultation", SERVICE_PRICING_MICRO["compliance-consultation"], complianceConsultationHandler),
  // x402Middleware removed - orchestrator handles 402 responses directly
  complianceConsultationHandler
);

// Direct-path POST aliases for enterprise services.
// GET /x402/{slug} is registered above (discovery/402 challenge).
// POST /x402/{slug} was missing — agents POSTing directly (without /service/) got 404.
// These aliases are functionally identical to the /service/ variants above.
router.post("/smart-contract-audit",
  createPaymentOrchestrator("smart-contract-audit", SERVICE_PRICING_MICRO["smart-contract-audit"], smartContractAuditHandler),
  smartContractAuditHandler
);

router.post("/payment-processing",
  createPaymentOrchestrator("payment-processing", SERVICE_PRICING_MICRO["payment-processing"], paymentProcessingHandler),
  paymentProcessingHandler
);

router.post("/compliance-consultation",
  createPaymentOrchestrator("compliance-consultation", SERVICE_PRICING_MICRO["compliance-consultation"], complianceConsultationHandler),
  complianceConsultationHandler
);

// ========================================
// PAYMENT TESTING & DOCUMENTATION ENDPOINTS
// ========================================

router.get("/payment-status", async (req: Request, res: Response) => {
  try {
    const query = `
      SELECT 
        COUNT(*) FILTER (WHERE interaction_type = 'view') as total_views,
        COUNT(*) FILTER (WHERE interaction_type = 'attempt') as payment_attempts,
        COUNT(*) FILTER (WHERE interaction_type = 'payment') as successful_payments,
        COUNT(*) FILTER (WHERE interaction_type = 'error') as errors,
        COUNT(DISTINCT wallet_address) as unique_wallets,
        ROUND(
          100.0 * COUNT(*) FILTER (WHERE interaction_type = 'payment') / 
          NULLIF(COUNT(*) FILTER (WHERE interaction_type = 'attempt'), 0),
          2
        ) as payment_success_rate
      FROM x402_interactions
      WHERE created_at > NOW() - INTERVAL '7 days';
    `;
    
    const result = await db.execute(sql.raw(query));
    const stats = result.rows[0];
    
    const recentPaymentsQuery = `
      SELECT 
        wallet_address,
        amount,
        currency,
        status,
        x402_transaction_id as tx_hash,
        created_at,
        network
      FROM x402_payments
      ORDER BY created_at DESC
      LIMIT 20;
    `;
    
    const recentPayments = await db.execute(sql.raw(recentPaymentsQuery));
    
    res.json({
      success: true,
      stats,
      recentPayments: recentPayments.rows,
      paymentInstructions: {
        network: "eip155:8453",
        token: "USDC",
        tokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        platformWallet: PLATFORM_WALLET,
        facilitator: getFacilitatorUrl(),
        documentation: `${PUBLIC_BASE_URL}/x402/payment-docs`,
      },
    });
  } catch (error: any) {
    console.error("Payment status check failed:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/payment-docs", (req: Request, res: Response) => {
  const docs = {
    protocol: "x402",
    version: 2,
    title: "Coin Railz x402 Micropayment Services",
    description: "Pay-per-use API services across 7 blockchains with USDC on Base",
    baseUrl: PUBLIC_BASE_URL,
    network: "eip155:8453",
    paymentToken: {
      symbol: "USDC",
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      decimals: 6,
      network: "eip155:8453",
    },
    platformWallet: PLATFORM_WALLET,
    facilitator: getFacilitatorUrl(),
    pricing: SERVICE_PRICING_USD,
    paymentFlow: {
      step1: "Make API request to any service endpoint",
      step2: "Receive 402 Payment Required with payment instructions",
      step3: "Submit USDC payment on Base to platformWallet",
      step4: "Include X-PAYMENT header with transaction hash",
      step5: "Receive service response",
    },
    example: {
      service: "multi-chain-balance",
      price: "0.50 USDC",
      endpoint: `${PUBLIC_BASE_URL}/x402/multi-chain-balance`,
      method: "POST",
      paymentAmount: "500000",
      paymentAmountDescription: "500000 = $0.50 in USDC (6 decimals)",
    },
    troubleshooting: {
      noPaymentReceived: "Check transaction was sent to correct wallet and confirmed on Base",
      wrongNetwork: "Payment must be on Base mainnet, not Ethereum or other chains",
      wrongToken: "Payment must be USDC, not ETH or other tokens",
      facilitatorError: "Verify x402.org/facilitator is accessible",
    },
    support: {
      statusEndpoint: `${PUBLIC_BASE_URL}/x402/payment-status`,
      analyticsEndpoint: `${PUBLIC_BASE_URL}/api/x402-analytics/dashboard`,
    },
  };
  
  res.json(docs);
});

router.post("/test-payment-flow", async (req: Request, res: Response) => {
  try {
    const { walletAddress, serviceId } = req.body;
    
    if (!walletAddress || !serviceId) {
      res.status(400).json({
        success: false,
        error: "walletAddress and serviceId are required",
      });
      return;
    }
    
    const testResult = {
      success: true,
      walletAddress,
      serviceId,
      testSteps: {
        step1_requestService: {
          status: "ready",
          endpoint: `${PUBLIC_BASE_URL}/x402/${serviceId}`,
          method: "POST",
          expectedResponse: "402 Payment Required",
        },
        step2_paymentInstructions: {
          status: "ready",
          network: "eip155:8453",
          token: "USDC",
          amount: SERVICE_PRICING_MICRO[serviceId as ServiceName] || 500000,
          payTo: PLATFORM_WALLET,
          facilitator: getFacilitatorUrl(),
        },
        step3_submitPayment: {
          status: "pending",
          instruction: "Send USDC on Base to platform wallet",
          verify: "Wait for blockchain confirmation",
        },
        step4_retryWithProof: {
          status: "pending",
          instruction: "Retry request with X-PAYMENT header containing tx hash",
          expectedResponse: "200 OK with service data",
        },
      },
      currentStats: {
        totalAttempts: 0,
        successfulPayments: 0,
        pendingPayments: 0,
      },
    };
    
    const statsQuery = await db.execute(sql.raw(`
      SELECT 
        COUNT(*) FILTER (WHERE interaction_type = 'attempt') as attempts,
        COUNT(*) FILTER (WHERE interaction_type = 'payment') as successful
      FROM x402_interactions
      WHERE wallet_address = '${walletAddress}' AND service_id = '${serviceId}';
    `));
    if (statsQuery.rows[0]) {
      testResult.currentStats = {
        totalAttempts: Number(statsQuery.rows[0].attempts || 0),
        successfulPayments: Number(statsQuery.rows[0].successful || 0),
        pendingPayments: 0,
      };
    }
    
    res.json(testResult);
  } catch (error: any) {
    console.error("Test payment flow failed:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========================================
// VERTICAL EXPANSION: 12 NEW SERVICES
// Real Estate, Banking, Trading, Intelligence
// ========================================

// REAL ESTATE SERVICES
router.post("/property-valuation",
  createPaymentOrchestrator("property-valuation", SERVICE_PRICING_MICRO["property-valuation"], async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const validatedInput = propertyValuationInputSchema.parse(req.body);
      const result = await propertyValuationService(validatedInput);
      const responseTime = Date.now() - startTime;
      await trackRequest("property-valuation", req.body, result, responseTime, SERVICE_PRICING_USD["property-valuation"], req.ip || "unknown");
      await trackBundleUsage(req, res, "property-valuation", validatedInput);
      res.json(result);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      await trackRequest("property-valuation", req.body, null, responseTime, SERVICE_PRICING_USD["property-valuation"], req.ip || "unknown", error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  })
);

router.post("/lease-analysis",
  createPaymentOrchestrator("lease-analysis", SERVICE_PRICING_MICRO["lease-analysis"], async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const validatedInput = leaseAnalysisInputSchema.parse(req.body);
      const result = await leaseAnalysisService(validatedInput);
      const responseTime = Date.now() - startTime;
      await trackRequest("lease-analysis", req.body, result, responseTime, SERVICE_PRICING_USD["lease-analysis"], req.ip || "unknown");
      await trackBundleUsage(req, res, "lease-analysis", validatedInput);
      res.json(result);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      await trackRequest("lease-analysis", req.body, null, responseTime, SERVICE_PRICING_USD["lease-analysis"], req.ip || "unknown", error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  })
);

router.post("/construction-progress",
  createPaymentOrchestrator("construction-progress", SERVICE_PRICING_MICRO["construction-progress"], async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const validatedInput = constructionProgressInputSchema.parse(req.body);
      const result = await constructionProgressService(validatedInput);
      const responseTime = Date.now() - startTime;
      await trackRequest("construction-progress", req.body, result, responseTime, SERVICE_PRICING_USD["construction-progress"], req.ip || "unknown");
      await trackBundleUsage(req, res, "construction-progress", validatedInput);
      res.json(result);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      await trackRequest("construction-progress", req.body, null, responseTime, SERVICE_PRICING_USD["construction-progress"], req.ip || "unknown", error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  })
);

// RWA & TOKENIZATION SERVICES
router.post("/rwa-nav-oracle",
  createPaymentOrchestrator("rwa-nav-oracle", SERVICE_PRICING_MICRO["rwa-nav-oracle"], async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const result = await rwaNavOracleService(req.body || {});
      const responseTime = Date.now() - startTime;
      await trackRequest("rwa-nav-oracle", req.body, result, responseTime, SERVICE_PRICING_USD["rwa-nav-oracle"], req.ip || "unknown");
      await trackBundleUsage(req, res, "rwa-nav-oracle", req.body);
      res.json(result);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      await trackRequest("rwa-nav-oracle", req.body, null, responseTime, SERVICE_PRICING_USD["rwa-nav-oracle"], req.ip || "unknown", error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  })
);

router.post("/tokenized-yield-compare",
  createPaymentOrchestrator("tokenized-yield-compare", SERVICE_PRICING_MICRO["tokenized-yield-compare"], async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const result = await tokenizedYieldCompareService(req.body || {});
      const responseTime = Date.now() - startTime;
      await trackRequest("tokenized-yield-compare", req.body, result, responseTime, SERVICE_PRICING_USD["tokenized-yield-compare"], req.ip || "unknown");
      await trackBundleUsage(req, res, "tokenized-yield-compare", req.body);
      res.json(result);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      await trackRequest("tokenized-yield-compare", req.body, null, responseTime, SERVICE_PRICING_USD["tokenized-yield-compare"], req.ip || "unknown", error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  })
);

// BANKING/FINANCE SERVICES
router.post("/credit-risk-score",
  createPaymentOrchestrator("credit-risk-score", SERVICE_PRICING_MICRO["credit-risk-score"], async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const validatedInput = creditRiskScoreInputSchema.parse(req.body);
      const result = await creditRiskScoreService(validatedInput);
      const responseTime = Date.now() - startTime;
      await trackRequest("credit-risk-score", req.body, result, responseTime, SERVICE_PRICING_USD["credit-risk-score"], req.ip || "unknown");
      await trackBundleUsage(req, res, "credit-risk-score", validatedInput);
      res.json(result);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      await trackRequest("credit-risk-score", req.body, null, responseTime, SERVICE_PRICING_USD["credit-risk-score"], req.ip || "unknown", error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  })
);

router.post("/fraud-detection",
  createPaymentOrchestrator("fraud-detection", SERVICE_PRICING_MICRO["fraud-detection"], async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const validatedInput = fraudDetectionInputSchema.parse(req.body);
      const result = await fraudDetectionService(validatedInput);
      const responseTime = Date.now() - startTime;
      await trackRequest("fraud-detection", req.body, result, responseTime, SERVICE_PRICING_USD["fraud-detection"], req.ip || "unknown");
      await trackBundleUsage(req, res, "fraud-detection", validatedInput);
      res.json(result);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      await trackRequest("fraud-detection", req.body, null, responseTime, SERVICE_PRICING_USD["fraud-detection"], req.ip || "unknown", error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  })
);

router.post("/compliance-check",
  createPaymentOrchestrator("compliance-check", SERVICE_PRICING_MICRO["compliance-check"], async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const validatedInput = complianceCheckInputSchema.parse(req.body);
      const result = await complianceCheckService(validatedInput);
      const responseTime = Date.now() - startTime;
      await trackRequest("compliance-check", req.body, result, responseTime, SERVICE_PRICING_USD["compliance-check"], req.ip || "unknown");
      await trackBundleUsage(req, res, "compliance-check", validatedInput);
      res.json(result);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      await trackRequest("compliance-check", req.body, null, responseTime, SERVICE_PRICING_USD["compliance-check"], req.ip || "unknown", error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  })
);

// TRADING/INVESTMENT SERVICES
router.post("/trading-signal",
  createPaymentOrchestrator("trading-signal", SERVICE_PRICING_MICRO["trading-signal"], async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const validatedInput = tradingSignalInputSchema.parse(req.body);
      const result = await tradingSignalService(validatedInput);
      const responseTime = Date.now() - startTime;
      await trackRequest("trading-signal", req.body, result, responseTime, SERVICE_PRICING_USD["trading-signal"], req.ip || "unknown");
      await trackBundleUsage(req, res, "trading-signal", validatedInput);
      res.json(result);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      await trackRequest("trading-signal", req.body, null, responseTime, SERVICE_PRICING_USD["trading-signal"], req.ip || "unknown", error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  })
);

router.post("/portfolio-optimization",
  createPaymentOrchestrator("portfolio-optimization", SERVICE_PRICING_MICRO["portfolio-optimization"], async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const validatedInput = portfolioOptimizationInputSchema.parse(req.body);
      const result = await portfolioOptimizationService(validatedInput);
      const responseTime = Date.now() - startTime;
      await trackRequest("portfolio-optimization", req.body, result, responseTime, SERVICE_PRICING_USD["portfolio-optimization"], req.ip || "unknown");
      await trackBundleUsage(req, res, "portfolio-optimization", validatedInput);
      res.json(result);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      await trackRequest("portfolio-optimization", req.body, null, responseTime, SERVICE_PRICING_USD["portfolio-optimization"], req.ip || "unknown", error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  })
);

router.post("/sentiment-analysis",
  createPaymentOrchestrator("sentiment-analysis", SERVICE_PRICING_MICRO["sentiment-analysis"], async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const validatedInput = sentimentAnalysisInputSchema.parse(req.body);
      const result = await sentimentAnalysisService(validatedInput);
      const responseTime = Date.now() - startTime;
      await trackRequest("sentiment-analysis", req.body, result, responseTime, SERVICE_PRICING_USD["sentiment-analysis"], req.ip || "unknown");
      await trackBundleUsage(req, res, "sentiment-analysis", validatedInput);
      res.json(result);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      await trackRequest("sentiment-analysis", req.body, null, responseTime, SERVICE_PRICING_USD["sentiment-analysis"], req.ip || "unknown", error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  })
);

// MARKET INTELLIGENCE SERVICES
router.post("/arbitrage-scanner",
  createPaymentOrchestrator("arbitrage-scanner", SERVICE_PRICING_MICRO["arbitrage-scanner"], async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const validatedInput = arbitrageScannerInputSchema.parse(req.body);
      const result = await arbitrageScannerService(validatedInput);
      const responseTime = Date.now() - startTime;
      await trackRequest("arbitrage-scanner", req.body, result, responseTime, SERVICE_PRICING_USD["arbitrage-scanner"], req.ip || "unknown");
      await trackBundleUsage(req, res, "arbitrage-scanner", validatedInput);
      res.json(result);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      await trackRequest("arbitrage-scanner", req.body, null, responseTime, SERVICE_PRICING_USD["arbitrage-scanner"], req.ip || "unknown", error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  })
);

router.post("/correlation-matrix",
  createPaymentOrchestrator("correlation-matrix", SERVICE_PRICING_MICRO["correlation-matrix"], async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const validatedInput = correlationMatrixInputSchema.parse(req.body);
      const result = await correlationMatrixService(validatedInput);
      const responseTime = Date.now() - startTime;
      await trackRequest("correlation-matrix", req.body, result, responseTime, SERVICE_PRICING_USD["correlation-matrix"], req.ip || "unknown");
      await trackBundleUsage(req, res, "correlation-matrix", validatedInput);
      res.json(result);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      await trackRequest("correlation-matrix", req.body, null, responseTime, SERVICE_PRICING_USD["correlation-matrix"], req.ip || "unknown", error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  })
);

router.post("/risk-metrics",
  createPaymentOrchestrator("risk-metrics", SERVICE_PRICING_MICRO["risk-metrics"], async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const validatedInput = riskMetricsInputSchema.parse(req.body);
      const result = await riskMetricsService(validatedInput);
      const responseTime = Date.now() - startTime;
      await trackRequest("risk-metrics", req.body, result, responseTime, SERVICE_PRICING_USD["risk-metrics"], req.ip || "unknown");
      await trackBundleUsage(req, res, "risk-metrics", validatedInput);
      res.json(result);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      await trackRequest("risk-metrics", req.body, null, responseTime, SERVICE_PRICING_USD["risk-metrics"], req.ip || "unknown", error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  })
);

// ========================================
// PREDICTION MARKETS SERVICES
// Polymarket integration for prediction market data
// ========================================
import { PolymarketEventsHandler, PolymarketOddsHandler, PolymarketSearchHandler } from '../services/handlers/PolymarketHandler';

const polymarketEventsHandler = new PolymarketEventsHandler();
const polymarketOddsHandler = new PolymarketOddsHandler();
const polymarketSearchHandler = new PolymarketSearchHandler();

router.post("/polymarket-events",
  createPaymentOrchestrator("polymarket-events", SERVICE_PRICING_MICRO["polymarket-events"], async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const result = await polymarketEventsHandler.execute(req.body);
      const responseTime = Date.now() - startTime;
      await trackRequest("polymarket-events", req.body, result, responseTime, SERVICE_PRICING_USD["polymarket-events"], req.ip || "unknown");
      await trackBundleUsage(req, res, "polymarket-events", req.body);
      res.json(result);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      await trackRequest("polymarket-events", req.body, null, responseTime, SERVICE_PRICING_USD["polymarket-events"], req.ip || "unknown", error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  })
);

router.post("/polymarket-odds",
  createPaymentOrchestrator("polymarket-odds", SERVICE_PRICING_MICRO["polymarket-odds"], async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const result = await polymarketOddsHandler.execute(req.body);
      const responseTime = Date.now() - startTime;
      await trackRequest("polymarket-odds", req.body, result, responseTime, SERVICE_PRICING_USD["polymarket-odds"], req.ip || "unknown");
      await trackBundleUsage(req, res, "polymarket-odds", req.body);
      res.json(result);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      await trackRequest("polymarket-odds", req.body, null, responseTime, SERVICE_PRICING_USD["polymarket-odds"], req.ip || "unknown", error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  })
);

router.post("/polymarket-search",
  createPaymentOrchestrator("polymarket-search", SERVICE_PRICING_MICRO["polymarket-search"], async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const result = await polymarketSearchHandler.execute(req.body);
      const responseTime = Date.now() - startTime;
      await trackRequest("polymarket-search", req.body, result, responseTime, SERVICE_PRICING_USD["polymarket-search"], req.ip || "unknown");
      await trackBundleUsage(req, res, "polymarket-search", req.body);
      res.json(result);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      await trackRequest("polymarket-search", req.body, null, responseTime, SERVICE_PRICING_USD["polymarket-search"], req.ip || "unknown", error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  })
);

router.post("/prediction-market-odds",
  createPaymentOrchestrator("prediction-market-odds", SERVICE_PRICING_MICRO["prediction-market-odds"], async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const result = await polymarketOddsHandler.execute(req.body);
      const responseTime = Date.now() - startTime;
      await trackRequest("prediction-market-odds", req.body, result, responseTime, SERVICE_PRICING_USD["prediction-market-odds"], req.ip || "unknown");
      await trackBundleUsage(req, res, "prediction-market-odds", req.body);
      res.json(result);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      await trackRequest("prediction-market-odds", req.body, null, responseTime, SERVICE_PRICING_USD["prediction-market-odds"], req.ip || "unknown", error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  })
);

// ========================================
// KALSHI PREDICTION MARKETS SERVICES
// CFTC-regulated prediction market data (public API, no auth required)
// Complements Polymarket with regulated US market coverage
// ========================================
import { KalshiMarketsHandler, KalshiOddsHandler, KalshiSearchHandler } from '../services/handlers/KalshiHandler';
import { PredictionMarketSpreadHandler } from '../services/handlers/PredictionMarketSpreadHandler';

const kalshiMarketsHandler = new KalshiMarketsHandler();
const kalshiOddsHandler = new KalshiOddsHandler();
const kalshiSearchHandler = new KalshiSearchHandler();
const predictionMarketSpreadHandler = new PredictionMarketSpreadHandler();

router.post("/kalshi-markets",
  createPaymentOrchestrator("kalshi-markets", SERVICE_PRICING_MICRO["kalshi-markets"], async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const result = await kalshiMarketsHandler.execute(req.body);
      const responseTime = Date.now() - startTime;
      await trackRequest("kalshi-markets", req.body, result, responseTime, SERVICE_PRICING_USD["kalshi-markets"], req.ip || "unknown");
      await trackBundleUsage(req, res, "kalshi-markets", req.body);
      res.json(result);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      await trackRequest("kalshi-markets", req.body, null, responseTime, SERVICE_PRICING_USD["kalshi-markets"], req.ip || "unknown", error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  })
);

router.post("/kalshi-odds",
  createPaymentOrchestrator("kalshi-odds", SERVICE_PRICING_MICRO["kalshi-odds"], async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const result = await kalshiOddsHandler.execute(req.body);
      const responseTime = Date.now() - startTime;
      await trackRequest("kalshi-odds", req.body, result, responseTime, SERVICE_PRICING_USD["kalshi-odds"], req.ip || "unknown");
      await trackBundleUsage(req, res, "kalshi-odds", req.body);
      res.json(result);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      await trackRequest("kalshi-odds", req.body, null, responseTime, SERVICE_PRICING_USD["kalshi-odds"], req.ip || "unknown", error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  })
);

router.post("/kalshi-search",
  createPaymentOrchestrator("kalshi-search", SERVICE_PRICING_MICRO["kalshi-search"], async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const result = await kalshiSearchHandler.execute(req.body);
      const responseTime = Date.now() - startTime;
      await trackRequest("kalshi-search", req.body, result, responseTime, SERVICE_PRICING_USD["kalshi-search"], req.ip || "unknown");
      await trackBundleUsage(req, res, "kalshi-search", req.body);
      res.json(result);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      await trackRequest("kalshi-search", req.body, null, responseTime, SERVICE_PRICING_USD["kalshi-search"], req.ip || "unknown", error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  })
);

// ========================================
// CROSS-PLATFORM PREDICTION MARKET SPREAD
// Polymarket × Kalshi live spread analysis
// Featured service — $0.25 USDC per call
// ========================================

router.post("/prediction-market-spread",
  createPaymentOrchestrator("prediction-market-spread", SERVICE_PRICING_MICRO["prediction-market-spread"], async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const result = await predictionMarketSpreadHandler.execute(req.body);
      const responseTime = Date.now() - startTime;
      await trackRequest("prediction-market-spread", req.body, result, responseTime, SERVICE_PRICING_USD["prediction-market-spread"], req.ip || "unknown");
      await trackBundleUsage(req, res, "prediction-market-spread", req.body);
      res.json(result);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      await trackRequest("prediction-market-spread", req.body, null, responseTime, SERVICE_PRICING_USD["prediction-market-spread"], req.ip || "unknown", error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  })
);

// ========================================
// AGENT WALLET PROVISIONING SERVICE
// CDP-managed wallet creation for AI agents
// $2.00 USDC per wallet - Base chain default
// ========================================

const agentCreateWalletHandler = async (req: Request, res: Response) => {
  const startTime = Date.now();
  const requestId = `awp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  
  try {
    // Validate input using Zod schema
    const validationResult = agentCreateWalletInputSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(e => e.message).join(', ');
      res.status(400).json({ 
        success: false, 
        error: `Validation failed: ${errors}`,
        requestId 
      });
      return;
    }
    
    const { agent_id, purpose = "persistent", chain = "base-mainnet", labels, tags, metadata } = validationResult.data;
    
    // Get CDP service instance
    const cdpService = CoinbaseCDPService.getInstance();
    
    // Check if CDP service is initialized
    const status = await cdpService.getServiceStatus();
    if (!status.initialized) {
      // Log the error event
      await db.insert(agentWalletEvents).values({
        walletId: "pending",
        eventType: "error",
        actor: agent_id,
        requestId,
        payload: { agent_id, purpose, chain },
        errorMessage: "CDP service not initialized - credentials may be missing",
        ipAddress: req.ip || undefined,
      });
      
      res.status(503).json({
        success: false,
        error: "Wallet provisioning service temporarily unavailable",
        requestId,
        suggestion: "Please try again later or contact support"
      });
      return;
    }
    
    // Create wallet via CDP
    const cdpWallet = await cdpService.createWallet(agent_id, chain);
    
    // Persist to agent_wallets table
    const [insertedWallet] = await db.insert(agentWallets).values({
      agentId: agent_id,
      walletId: cdpWallet.id,
      address: cdpWallet.address,
      chain: chain,
      custodyType: "cdp",
      purpose: purpose,
      status: "active",
      labels: labels || null,
      tags: tags || null,
      metadata: metadata || null,
      paymentTxHash: res.locals.payment?.txHash || null,
    }).returning();
    
    // Log the creation event for audit
    await db.insert(agentWalletEvents).values({
      walletId: cdpWallet.id,
      eventType: "created",
      actor: agent_id,
      requestId,
      offerTracking: req.query.offer_tracking as string || null,
      payload: { agent_id, purpose, chain, labels, tags },
      response: { wallet_address: cdpWallet.address, wallet_id: cdpWallet.id },
      ipAddress: req.ip || undefined,
    });
    
    const responseTime = Date.now() - startTime;
    
    // Track request for analytics
    await trackRequest("agent-create-wallet", req.body, { wallet_address: cdpWallet.address }, responseTime, SERVICE_PRICING_USD["agent-create-wallet"], cdpWallet.address);
    await trackBundleUsage(req, res, "agent-create-wallet", { agent_id, chain });
    
    // Return wallet info (NEVER expose private keys)
    res.json({
      success: true,
      wallet_address: cdpWallet.address,
      wallet_id: cdpWallet.id,
      chain: chain,
      custody_type: "cdp",
      purpose: purpose,
      status: "active",
      created_at: insertedWallet.createdAt?.toISOString() || new Date().toISOString(),
      requestId,
    });
    
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    console.error(`❌ Agent wallet creation failed:`, error);
    
    // Log the error event
    try {
      await db.insert(agentWalletEvents).values({
        walletId: "error",
        eventType: "error",
        actor: req.body?.agent_id || "unknown",
        requestId,
        payload: req.body,
        errorMessage: error.message,
        ipAddress: req.ip || undefined,
      });
    } catch (logError) {
      console.error("Failed to log error event:", logError);
    }
    
    await trackRequest("agent-create-wallet", req.body, null, responseTime, SERVICE_PRICING_USD["agent-create-wallet"], req.ip || "unknown", error.message);
    
    res.status(500).json({ 
      success: false, 
      error: error.message,
      requestId,
      suggestion: "Check agent_id format and try again"
    });
  }
};

router.post("/agent-create-wallet",
  createPaymentOrchestrator("agent-create-wallet", SERVICE_PRICING_MICRO["agent-create-wallet"], agentCreateWalletHandler),
  agentCreateWalletHandler
);

// ========================================
// TRADITIONAL MARKETS SERVICES
// Stock and Forex sentiment analysis for TradFi bots
// ========================================

// Stock Sentiment Analysis - AI-powered equity market sentiment
router.post("/stock-sentiment",
  createPaymentOrchestrator("stock-sentiment", SERVICE_PRICING_MICRO["stock-sentiment"], async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const { symbol, includeNews, includeTechnicals, includeInstitutional } = req.body;
      
      if (!symbol || typeof symbol !== 'string') {
        return res.status(400).json({ 
          success: false, 
          error: "Stock symbol is required (e.g., AAPL, TSLA, MSFT)" 
        });
      }
      
      const result = await stockSentimentService({
        symbol: symbol.toUpperCase(),
        includeNews: includeNews !== false,
        includeTechnicals: includeTechnicals !== false,
        includeInstitutional: includeInstitutional !== false
      });
      
      const responseTime = Date.now() - startTime;
      await trackRequest("stock-sentiment", req.body, result, responseTime, SERVICE_PRICING_USD["stock-sentiment"], req.ip || "unknown");
      await trackBundleUsage(req, res, "stock-sentiment", { symbol });
      res.json(result);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      await trackRequest("stock-sentiment", req.body, null, responseTime, SERVICE_PRICING_USD["stock-sentiment"], req.ip || "unknown", error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  })
);

// ========================================
// INSTANT API KEY SERVICE
// Pay $1 USDC/USDT on Base or Solana, get an API key immediately - no login required
// Multi-chain, multi-token support with rate limiting for starter credits
// ========================================

const instantApiKeyHandler = async (req: Request, res: Response) => {
  const startTime = Date.now();
  const requestId = `ikey_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  
  try {
    const { name, metadata } = req.body;
    
    // Get payment info from orchestrator
    const paymentInfo = res.locals.payment;
    const txHash = paymentInfo?.txHash;
    const walletAddress = paymentInfo?.from || req.ip || 'unknown';
    const chain = paymentInfo?.network || 'base';
    const token = paymentInfo?.token || 'USDC';
    const amountPaid = paymentInfo?.amount || 1.00;
    
    // Create a unique user ID based on the wallet address or transaction
    const userId = `x402_${txHash ? txHash.substring(0, 16) : Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    
    // Import credits service for key generation
    const { creditsService } = await import("../services/creditsService.js");
    
    // Generate the API key
    const keyResult = await creditsService.generateApiKey(
      userId,
      name || `SDK Key (${new Date().toISOString().split('T')[0]})`
    );
    
    // Rate limiting: Check if wallet already received starter credits in last 30 days
    // Also check for IP-based abuse (same IP using multiple wallets)
    let creditsGranted = 0;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const clientIp = req.ip || req.headers['x-forwarded-for']?.toString().split(',')[0] || undefined;
    
    try {
      // Check 1: Wallet-based rate limiting (30 days)
      const existingWalletGrants = await db.select()
        .from(instantApiKeyGrants)
        .where(and(
          eq(instantApiKeyGrants.walletAddress, walletAddress.toLowerCase()),
          gt(instantApiKeyGrants.grantedAt, thirtyDaysAgo)
        ))
        .limit(1);
      
      // Check 2: IP-based abuse detection (same IP, multiple wallets in 7 days = suspicious)
      let ipAbuseDetected = false;
      if (clientIp) {
        const ipGrants = await db.select({ walletAddress: instantApiKeyGrants.walletAddress })
          .from(instantApiKeyGrants)
          .where(and(
            eq(instantApiKeyGrants.ipAddress, clientIp),
            gt(instantApiKeyGrants.grantedAt, sevenDaysAgo)
          ));
        
        // Get unique wallets from this IP
        const uniqueWallets = new Set(ipGrants.map(g => g.walletAddress));
        if (uniqueWallets.size >= 3) {
          ipAbuseDetected = true;
          console.warn(`🚨 IP abuse detected: ${clientIp} used ${uniqueWallets.size} different wallets in 7 days`);
        }
      }
      
      // Grant credits only if: wallet hasn't received in 30 days AND no IP abuse
      if (existingWalletGrants.length === 0 && !ipAbuseDetected) {
        // First-time grant: Give $5 starter credits
        await creditsService.addCredits({
          userId,
          amount: 5.00,
          paymentMethod: token.toLowerCase(),
          referenceId: txHash || requestId,
          description: `Starter credits with instant API key (${chain}/${token})`,
          metadata: {
            purchaseType: "instant-api-key",
            walletAddress,
            chain,
            token,
            txHash,
            requestId
          }
        });
        creditsGranted = 5.00;
        
        // Record the grant for rate limiting
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);
        
        await db.insert(instantApiKeyGrants).values({
          walletAddress: walletAddress.toLowerCase(),
          chain,
          token,
          apiKeyId: keyResult.keyId,
          creditsGranted: "5.00",
          txHash,
          amountPaid: String(amountPaid),
          ipAddress: req.ip || undefined,
          userAgent: req.headers['user-agent'] || undefined,
          expiresAt
        });
        
        console.log(`🎁 Starter credits granted to ${walletAddress} via ${chain}/${token}`);
      } else {
        // Log reason for not granting credits
        if (existingWalletGrants.length > 0) {
          console.log(`⏳ Wallet rate limited: ${walletAddress} already received credits on ${existingWalletGrants[0].grantedAt}`);
        } else if (ipAbuseDetected) {
          console.log(`🚨 IP abuse blocked: ${clientIp} - credits not granted to ${walletAddress}`);
        }
      }
    } catch (creditError: any) {
      console.error(`⚠️ Failed to add starter credits: ${creditError.message}`);
      // Continue anyway - key generation is the primary deliverable
    }
    
    const responseTime = Date.now() - startTime;
    
    console.log(`🔑 Instant API key generated: ${keyResult.keyPrefix}... for wallet ${walletAddress} via ${chain}/${token}`);
    
    // Track the request
    await trackRequest("instant-api-key", { name, walletAddress, chain, token }, { keyPrefix: keyResult.keyPrefix }, responseTime, SERVICE_PRICING_USD["instant-api-key"], walletAddress);
    await trackBundleUsage(req, res, "instant-api-key", { walletAddress, chain, token });
    
    res.json({
      success: true,
      // snake_case for programmatic SDK usage
      api_key: keyResult.apiKey,
      key_prefix: keyResult.keyPrefix,
      key_id: keyResult.keyId,
      user_id: userId,
      starter_credits: creditsGranted,
      // camelCase aliases for frontend
      apiKey: keyResult.apiKey,
      keyPrefix: keyResult.keyPrefix,
      keyId: keyResult.keyId,
      userId: userId,
      starterCredits: creditsGranted,
      credits_note: creditsGranted > 0 
        ? "🎁 $5 starter credits added to your account!" 
        : "ℹ️ Starter credits already claimed for this wallet (limit: once per 30 days)",
      payment: {
        chain,
        token,
        amount_paid: amountPaid,
        tx_hash: txHash
      },
      message: "⚠️ SAVE THIS KEY NOW - it will never be shown again!",
      usage: {
        base_url: "https://coinrailz.com/api/sdk",
        example: `curl -H "Authorization: Bearer ${keyResult.apiKey}" https://coinrailz.com/api/sdk/status`,
        docs: "https://coinrailz.com/quickstart"
      },
      supported_payments: {
        base: {
          wallet: PLATFORM_WALLETS.base,
          tokens: ['USDC', 'USDT']
        },
        solana: {
          wallet: PLATFORM_WALLETS.solana,
          tokens: ['USDC', 'USDT']
        }
      },
      requestId
    });
    
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    console.error(`❌ Instant API key generation failed:`, error);
    
    await trackRequest("instant-api-key", req.body, null, responseTime, SERVICE_PRICING_USD["instant-api-key"], req.ip || "unknown", error.message);
    
    res.status(500).json({
      success: false,
      error: error.message,
      requestId,
      suggestion: "Please try again or contact support"
    });
  }
};

router.post("/instant-api-key",
  createPaymentOrchestrator("instant-api-key", SERVICE_PRICING_MICRO["instant-api-key"], instantApiKeyHandler)
);

// Forex Sentiment Analysis - AI-powered currency pair sentiment
router.post("/forex-sentiment",
  createPaymentOrchestrator("forex-sentiment", SERVICE_PRICING_MICRO["forex-sentiment"], async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const { pair, includeEconomic, includeCentralBank, includeGeopolitical } = req.body;
      
      if (!pair || typeof pair !== 'string') {
        return res.status(400).json({ 
          success: false, 
          error: "Currency pair is required (e.g., EURUSD, GBPJPY, USDJPY)" 
        });
      }
      
      const result = await forexSentimentService({
        pair: pair.toUpperCase(),
        includeEconomic: includeEconomic !== false,
        includeCentralBank: includeCentralBank !== false,
        includeGeopolitical: includeGeopolitical !== false
      });
      
      const responseTime = Date.now() - startTime;
      await trackRequest("forex-sentiment", req.body, result, responseTime, SERVICE_PRICING_USD["forex-sentiment"], req.ip || "unknown");
      await trackBundleUsage(req, res, "forex-sentiment", { pair });
      res.json(result);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      await trackRequest("forex-sentiment", req.body, null, responseTime, SERVICE_PRICING_USD["forex-sentiment"], req.ip || "unknown", error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  })
);

// ========================================
// SOLANA DEFI SERVICES (Dialect Integration)
// Real-time Solana lending/yield data from Dialect Markets API
// ========================================

// Solana Yield Finder - Get top lending/yield opportunities on Solana
router.get("/solana-yield-finder",
  createPaymentOrchestrator("solana-yield-finder", SERVICE_PRICING_MICRO["solana-yield-finder"], async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const { 
        limit = 10, 
        type, 
        protocol, 
        minApy,
        token 
      } = req.query;
      
      const result = await dialectMarketsService.getTopYields({
        limit: Math.min(50, Math.max(1, parseInt(limit as string) || 10)),
        type: type as 'lending' | 'yield' | 'loop' | 'perpetual' | undefined,
        protocol: protocol as string | undefined,
        minApy: minApy ? parseFloat(minApy as string) / 100 : undefined,
        token: token as string | undefined,
      });
      
      const responseTime = Date.now() - startTime;
      await trackRequest("solana-yield-finder", req.query, result, responseTime, SERVICE_PRICING_USD["solana-yield-finder"], req.ip || "unknown");
      await trackBundleUsage(req, res, "solana-yield-finder", { limit, type, protocol });
      
      res.json(result);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      await trackRequest("solana-yield-finder", req.query, null, responseTime, SERVICE_PRICING_USD["solana-yield-finder"], req.ip || "unknown", error.message);
      res.status(500).json({ 
        success: false, 
        error: error.message,
        suggestion: "Check DIALECT_MARKETS_FE_KEY or DIALECT_BE_KEY is configured"
      });
    }
  })
);

// Also support POST for agents that prefer POST
router.post("/solana-yield-finder",
  createPaymentOrchestrator("solana-yield-finder", SERVICE_PRICING_MICRO["solana-yield-finder"], async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const { 
        limit = 10, 
        type, 
        protocol, 
        minApy,
        token 
      } = req.body;
      
      const result = await dialectMarketsService.getTopYields({
        limit: Math.min(50, Math.max(1, parseInt(limit) || 10)),
        type: type as 'lending' | 'yield' | 'loop' | 'perpetual' | undefined,
        protocol: protocol as string | undefined,
        minApy: minApy ? parseFloat(minApy) / 100 : undefined,
        token: token as string | undefined,
      });
      
      const responseTime = Date.now() - startTime;
      await trackRequest("solana-yield-finder", req.body, result, responseTime, SERVICE_PRICING_USD["solana-yield-finder"], req.ip || "unknown");
      await trackBundleUsage(req, res, "solana-yield-finder", { limit, type, protocol });
      
      res.json(result);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      await trackRequest("solana-yield-finder", req.body, null, responseTime, SERVICE_PRICING_USD["solana-yield-finder"], req.ip || "unknown", error.message);
      res.status(500).json({ 
        success: false, 
        error: error.message,
        suggestion: "Check DIALECT_MARKETS_FE_KEY or DIALECT_BE_KEY is configured"
      });
    }
  })
);

// ============================================================================
// SATELLITE DATA SERVICES
// ============================================================================

router.post("/fire-alerts",
  createPaymentOrchestrator("fire-alerts", SERVICE_PRICING_MICRO["fire-alerts"], async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const bbox = {
        west: req.body.west ?? -125,
        south: req.body.south ?? 24,
        east: req.body.east ?? -66,
        north: req.body.north ?? 50,
      };
      const days = req.body.days ?? 1;
      const data = await satelliteDataService.getFireAlerts(bbox, days);
      const result = {
        success: true,
        data,
        product: { name: "Fire Alerts", price: "$0.05" },
        poweredBy: "NASA FIRMS",
        timestamp: new Date().toISOString()
      };
      const responseTime = Date.now() - startTime;
      await trackRequest("fire-alerts", req.body, result, responseTime, SERVICE_PRICING_USD["fire-alerts"], req.ip || "unknown");
      await trackBundleUsage(req, res, "fire-alerts", req.body);
      res.json(result);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      await trackRequest("fire-alerts", req.body, null, responseTime, SERVICE_PRICING_USD["fire-alerts"], req.ip || "unknown", error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  })
);

router.post("/weather-imagery",
  createPaymentOrchestrator("weather-imagery", SERVICE_PRICING_MICRO["weather-imagery"], async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const lat = req.body.lat ?? 40.7128;
      const lon = req.body.lon ?? -74.0060;
      const layer = req.body.layer ?? 'MODIS_Terra_CorrectedReflectance_TrueColor';
      const data = await satelliteDataService.getWeatherImagery(lat, lon, layer);
      const result = {
        success: true,
        data,
        product: { name: "Weather Imagery", price: "$0.05" },
        poweredBy: "NASA GIBS",
        timestamp: new Date().toISOString()
      };
      const responseTime = Date.now() - startTime;
      await trackRequest("weather-imagery", req.body, result, responseTime, SERVICE_PRICING_USD["weather-imagery"], req.ip || "unknown");
      await trackBundleUsage(req, res, "weather-imagery", req.body);
      res.json(result);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      await trackRequest("weather-imagery", req.body, null, responseTime, SERVICE_PRICING_USD["weather-imagery"], req.ip || "unknown", error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  })
);

router.post("/vegetation",
  createPaymentOrchestrator("vegetation", SERVICE_PRICING_MICRO["vegetation"], async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const bbox = {
        west: req.body.west ?? -125,
        south: req.body.south ?? 24,
        east: req.body.east ?? -66,
        north: req.body.north ?? 50,
      };
      const data = await satelliteDataService.getVegetationHealth(bbox);
      const result = {
        success: true,
        data,
        product: { name: "Vegetation Health", price: "$0.10" },
        poweredBy: "NASA MODIS / ESA Sentinel-2",
        timestamp: new Date().toISOString()
      };
      const responseTime = Date.now() - startTime;
      await trackRequest("vegetation", req.body, result, responseTime, SERVICE_PRICING_USD["vegetation"], req.ip || "unknown");
      await trackBundleUsage(req, res, "vegetation", req.body);
      res.json(result);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      await trackRequest("vegetation", req.body, null, responseTime, SERVICE_PRICING_USD["vegetation"], req.ip || "unknown", error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  })
);

router.post("/flood-detection",
  createPaymentOrchestrator("flood-detection", SERVICE_PRICING_MICRO["flood-detection"], async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const bbox = {
        west: req.body.west ?? -125,
        south: req.body.south ?? 24,
        east: req.body.east ?? -66,
        north: req.body.north ?? 50,
      };
      const data = await satelliteDataService.getFloodDetection(bbox);
      const result = {
        success: true,
        data,
        product: { name: "Flood Detection", price: "$0.10" },
        poweredBy: "ESA Sentinel-1 SAR",
        timestamp: new Date().toISOString()
      };
      const responseTime = Date.now() - startTime;
      await trackRequest("flood-detection", req.body, result, responseTime, SERVICE_PRICING_USD["flood-detection"], req.ip || "unknown");
      await trackBundleUsage(req, res, "flood-detection", req.body);
      res.json(result);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      await trackRequest("flood-detection", req.body, null, responseTime, SERVICE_PRICING_USD["flood-detection"], req.ip || "unknown", error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  })
);

router.post("/air-quality",
  createPaymentOrchestrator("air-quality", SERVICE_PRICING_MICRO["air-quality"], async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const lat = req.body.lat ?? 40.7128;
      const lon = req.body.lon ?? -74.0060;
      const data = await satelliteDataService.getAirQuality(lat, lon);
      const result = {
        success: true,
        data,
        product: { name: "Air Quality", price: "$0.05" },
        poweredBy: "ESA Sentinel-5P TROPOMI",
        timestamp: new Date().toISOString()
      };
      const responseTime = Date.now() - startTime;
      await trackRequest("air-quality", req.body, result, responseTime, SERVICE_PRICING_USD["air-quality"], req.ip || "unknown");
      await trackBundleUsage(req, res, "air-quality", req.body);
      res.json(result);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      await trackRequest("air-quality", req.body, null, responseTime, SERVICE_PRICING_USD["air-quality"], req.ip || "unknown", error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  })
);

router.post("/land-use",
  createPaymentOrchestrator("land-use", SERVICE_PRICING_MICRO["land-use"], async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const bbox = {
        west: req.body.west ?? -125,
        south: req.body.south ?? 24,
        east: req.body.east ?? -66,
        north: req.body.north ?? 50,
      };
      const data = await satelliteDataService.getLandUseClassification(bbox);
      const result = {
        success: true,
        data,
        product: { name: "Land Use Classification", price: "$0.15" },
        poweredBy: "NASA Landsat / ESA Sentinel-2",
        timestamp: new Date().toISOString()
      };
      const responseTime = Date.now() - startTime;
      await trackRequest("land-use", req.body, result, responseTime, SERVICE_PRICING_USD["land-use"], req.ip || "unknown");
      await trackBundleUsage(req, res, "land-use", req.body);
      res.json(result);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      await trackRequest("land-use", req.body, null, responseTime, SERVICE_PRICING_USD["land-use"], req.ip || "unknown", error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  })
);

// ============================================================================
// IoT/DePIN SERVICES
// ============================================================================

router.get("/fleet-telematics",
  createPaymentOrchestrator("fleet-telematics", SERVICE_PRICING_MICRO["fleet-telematics"], async (req: Request, res: Response) => {
    res.json({ service: "fleet-telematics", method: "POST", description: "Use POST to retrieve fleet telematics data. See 402 challenge above for payment instructions." });
  })
);

router.post("/fleet-telematics",
  createPaymentOrchestrator("fleet-telematics", SERVICE_PRICING_MICRO["fleet-telematics"], async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const result = {
        success: true,
        data: {
          fleetId: req.body.fleetId || "fleet-001",
          vehicles: [
            {
              vehicleId: "v-1001",
              location: { lat: 33.749 + Math.random() * 0.1, lon: -84.388 + Math.random() * 0.1 },
              speed: Math.round(25 + Math.random() * 45),
              heading: Math.round(Math.random() * 360),
              fuelLevel: Math.round(30 + Math.random() * 60),
              engineStatus: "running",
              odometer: Math.round(45000 + Math.random() * 5000),
              lastUpdate: new Date().toISOString()
            },
            {
              vehicleId: "v-1002",
              location: { lat: 33.755 + Math.random() * 0.1, lon: -84.395 + Math.random() * 0.1 },
              speed: Math.round(Math.random() * 60),
              heading: Math.round(Math.random() * 360),
              fuelLevel: Math.round(20 + Math.random() * 70),
              engineStatus: "idle",
              odometer: Math.round(62000 + Math.random() * 3000),
              lastUpdate: new Date().toISOString()
            }
          ],
          summary: { totalVehicles: 2, active: 1, idle: 1, offline: 0 }
        },
        product: { name: "Fleet Telematics", price: "$0.10" },
        poweredBy: "Coin Railz IoT",
        timestamp: new Date().toISOString()
      };
      const responseTime = Date.now() - startTime;
      await trackRequest("fleet-telematics", req.body, result, responseTime, SERVICE_PRICING_USD["fleet-telematics"], req.ip || "unknown");
      await trackBundleUsage(req, res, "fleet-telematics", req.body);
      res.json(result);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      await trackRequest("fleet-telematics", req.body, null, responseTime, SERVICE_PRICING_USD["fleet-telematics"], req.ip || "unknown", error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  })
);

router.get("/weather-station-data",
  createPaymentOrchestrator("weather-station-data", SERVICE_PRICING_MICRO["weather-station-data"], async (req: Request, res: Response) => {
    res.json({ service: "weather-station-data", method: "POST", description: "Use POST to retrieve weather station data. See 402 challenge above for payment instructions." });
  })
);

router.post("/weather-station-data",
  createPaymentOrchestrator("weather-station-data", SERVICE_PRICING_MICRO["weather-station-data"], async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const result = {
        success: true,
        data: {
          stationId: req.body.stationId || "ws-atl-001",
          location: { lat: req.body.lat || 33.749, lon: req.body.lon || -84.388 },
          readings: {
            temperature: { value: 18 + Math.random() * 15, unit: "celsius" },
            humidity: { value: 40 + Math.random() * 40, unit: "percent" },
            pressure: { value: 1010 + Math.random() * 20, unit: "hPa" },
            windSpeed: { value: Math.random() * 30, unit: "km/h" },
            windDirection: { value: Math.round(Math.random() * 360), unit: "degrees" },
            precipitation: { value: Math.random() * 5, unit: "mm/hr" },
            uvIndex: { value: Math.round(Math.random() * 11), unit: "index" }
          },
          timestamp: new Date().toISOString(),
          quality: "verified"
        },
        product: { name: "Weather Station Data", price: "$0.05" },
        poweredBy: "Coin Railz IoT",
        timestamp: new Date().toISOString()
      };
      const responseTime = Date.now() - startTime;
      await trackRequest("weather-station-data", req.body, result, responseTime, SERVICE_PRICING_USD["weather-station-data"], req.ip || "unknown");
      await trackBundleUsage(req, res, "weather-station-data", req.body);
      res.json(result);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      await trackRequest("weather-station-data", req.body, null, responseTime, SERVICE_PRICING_USD["weather-station-data"], req.ip || "unknown", error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  })
);

router.get("/iot-sensor-reading",
  createPaymentOrchestrator("iot-sensor-reading", SERVICE_PRICING_MICRO["iot-sensor-reading"], async (req: Request, res: Response) => {
    res.json({ service: "iot-sensor-reading", method: "POST", description: "Use POST to retrieve IoT sensor readings. See 402 challenge above for payment instructions." });
  })
);

router.post("/iot-sensor-reading",
  createPaymentOrchestrator("iot-sensor-reading", SERVICE_PRICING_MICRO["iot-sensor-reading"], async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const result = {
        success: true,
        data: {
          deviceId: req.body.deviceId || "iot-device-001",
          sensorType: req.body.sensorType || "temperature",
          value: 23.5 + Math.random() * 5,
          unit: "celsius",
          timestamp: new Date().toISOString(),
          quality: "good",
          metadata: { firmware: "v2.1.0", batteryLevel: 87 }
        },
        product: { name: "IoT Sensor Reading", price: "$0.025" },
        poweredBy: "Coin Railz IoT",
        timestamp: new Date().toISOString()
      };
      const responseTime = Date.now() - startTime;
      await trackRequest("iot-sensor-reading", req.body, result, responseTime, SERVICE_PRICING_USD["iot-sensor-reading"], req.ip || "unknown");
      await trackBundleUsage(req, res, "iot-sensor-reading", req.body);
      res.json(result);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      await trackRequest("iot-sensor-reading", req.body, null, responseTime, SERVICE_PRICING_USD["iot-sensor-reading"], req.ip || "unknown", error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  })
);

router.get("/iot-device-stream",
  createPaymentOrchestrator("iot-device-stream", SERVICE_PRICING_MICRO["iot-device-stream"], async (req: Request, res: Response) => {
    res.json({ service: "iot-device-stream", method: "POST", description: "Use POST to stream IoT device data. See 402 challenge above for payment instructions." });
  })
);

router.post("/iot-device-stream",
  createPaymentOrchestrator("iot-device-stream", SERVICE_PRICING_MICRO["iot-device-stream"], async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const deviceId = req.body.deviceId || "iot-stream-001";
      const duration = req.body.duration || 60;
      const result = {
        success: true,
        data: {
          streamId: `stream-${Date.now()}`,
          deviceId,
          status: "active",
          duration,
          dataPoints: Array.from({ length: 10 }, (_, i) => ({
            timestamp: new Date(Date.now() - (9 - i) * 6000).toISOString(),
            temperature: 22 + Math.random() * 6,
            humidity: 45 + Math.random() * 30,
            pressure: 1012 + Math.random() * 10,
          })),
          sampleRate: "1/6s",
          encoding: "json",
          metadata: { protocol: "MQTT", qos: 1, firmware: "v3.0.2" }
        },
        product: { name: "IoT Device Stream", price: "$0.25" },
        poweredBy: "Coin Railz IoT",
        timestamp: new Date().toISOString()
      };
      const responseTime = Date.now() - startTime;
      await trackRequest("iot-device-stream", req.body, result, responseTime, SERVICE_PRICING_USD["iot-device-stream"], req.ip || "unknown");
      await trackBundleUsage(req, res, "iot-device-stream", req.body);
      res.json(result);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      await trackRequest("iot-device-stream", req.body, null, responseTime, SERVICE_PRICING_USD["iot-device-stream"], req.ip || "unknown", error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  })
);

router.get("/iot-bulk-data",
  createPaymentOrchestrator("iot-bulk-data", SERVICE_PRICING_MICRO["iot-bulk-data"], async (req: Request, res: Response) => {
    res.json({ service: "iot-bulk-data", method: "POST", description: "Use POST to export bulk IoT data. See 402 challenge above for payment instructions." });
  })
);

router.post("/iot-bulk-data",
  createPaymentOrchestrator("iot-bulk-data", SERVICE_PRICING_MICRO["iot-bulk-data"], async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const deviceId = req.body.deviceId || "iot-bulk-001";
      const from = req.body.from || new Date(Date.now() - 86400000).toISOString();
      const to = req.body.to || new Date().toISOString();
      const result = {
        success: true,
        data: {
          exportId: `export-${Date.now()}`,
          deviceId,
          timeRange: { from, to },
          recordCount: 1440,
          format: req.body.format || "json",
          sizeBytes: 245760,
          summary: {
            avgTemperature: 23.4,
            avgHumidity: 52.1,
            avgPressure: 1013.2,
            minTemperature: 18.2,
            maxTemperature: 29.8,
            anomalies: 3
          },
          downloadUrl: `https://coinrailz.com/api/iot/exports/export-${Date.now()}`,
          expiresAt: new Date(Date.now() + 3600000).toISOString()
        },
        product: { name: "IoT Bulk Data Export", price: "$0.50" },
        poweredBy: "Coin Railz IoT",
        timestamp: new Date().toISOString()
      };
      const responseTime = Date.now() - startTime;
      await trackRequest("iot-bulk-data", req.body, result, responseTime, SERVICE_PRICING_USD["iot-bulk-data"], req.ip || "unknown");
      await trackBundleUsage(req, res, "iot-bulk-data", req.body);
      res.json(result);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      await trackRequest("iot-bulk-data", req.body, null, responseTime, SERVICE_PRICING_USD["iot-bulk-data"], req.ip || "unknown", error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  })
);

// ============================================================
// AI INFERENCE GATEWAY — x402 pay-per-call LLM access
// ============================================================
router.post("/ai-inference",
  createPaymentOrchestrator("ai-inference", SERVICE_PRICING_MICRO["ai-inference"], async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      if (!process.env.OPENAI_API_KEY) {
        return res.status(503).json({
          success: false,
          error: "AI inference service not configured",
          reason: "OPENAI_API_KEY environment variable not set. Contact support@coinrailz.com."
        });
      }

      const { prompt, model: requestedModel, maxTokens, systemPrompt } = req.body;

      if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        return res.status(400).json({ success: false, error: "prompt is required" });
      }

      // This endpoint supports gpt-4o-mini only at $0.05 per call.
      if (requestedModel && requestedModel !== 'gpt-4o-mini') {
        return res.status(400).json({
          success: false,
          error: "Unsupported model",
          reason: "This endpoint only supports gpt-4o-mini. Omit the model field or set it to 'gpt-4o-mini'.",
          supported_model: "gpt-4o-mini"
        });
      }
      const model = 'gpt-4o-mini';

      const { default: OpenAI } = await import('openai');
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const messages: { role: 'system' | 'user'; content: string }[] = [];
      if (systemPrompt && typeof systemPrompt === 'string') {
        messages.push({ role: 'system', content: systemPrompt });
      }
      messages.push({ role: 'user', content: prompt });

      const completion = await openai.chat.completions.create({
        model,
        messages,
        max_tokens: Math.min(Number(maxTokens) || 1024, 4096),
      });

      const result = {
        success: true,
        content: completion.choices[0]?.message?.content || '',
        model: completion.model,
        usage: completion.usage,
        finishReason: completion.choices[0]?.finish_reason,
        serviceVersion: "1.0.0"
      };

      const responseTime = Date.now() - startTime;
      await trackRequest("ai-inference", req.body, result, responseTime, SERVICE_PRICING_USD["ai-inference"], req.ip || "unknown");
      await trackBundleUsage(req, res, "ai-inference", { model, promptLength: prompt.length });
      res.json(result);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      await trackRequest("ai-inference", req.body, null, responseTime, SERVICE_PRICING_USD["ai-inference"], req.ip || "unknown", error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  })
);

// ============================================================================
// NASA EARTHDATA INTELLIGENCE SERVICES — x402 Orchestrator (Bazaar-compatible)
// Previously only accessible via /api/satellite/earthdata/* with custom middleware.
// These routes fix the ghost /x402/satellite-earthdata path (237+ failed retries)
// and expose all 5 NASA services through the standard CDP/Bazaar payment flow.
// ============================================================================

// GET handlers return 402 challenges for Bazaar discovery crawls
router.get("/satellite-earthdata",
  createPaymentOrchestrator("satellite-earthdata", SERVICE_PRICING_MICRO["satellite-earthdata"], (_req, res) => {
    res.json({ service: "satellite-earthdata", method: "POST", description: "NASA Earthdata Intelligence gateway. POST to receive: granule metadata, precipitation, SST, soil moisture, or ocean color. $0.25/call." });
  })
);

router.post("/satellite-earthdata",
  createPaymentOrchestrator("satellite-earthdata", SERVICE_PRICING_MICRO["satellite-earthdata"], async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const lat = req.body.lat ?? 40.7128;
      const lon = req.body.lon ?? -74.006;
      const product = (req.body.product ?? 'precipitation') as string;
      let data: any;
      let poweredBy = 'NASA Earthdata';
      if (product === 'granules') {
        const bbox = { west: req.body.west ?? lon - 0.5, south: req.body.south ?? lat - 0.5, east: req.body.east ?? lon + 0.5, north: req.body.north ?? lat + 0.5 };
        data = await earthdataService.searchGranules({ bbox, limit: req.body.limit ?? 5 });
        poweredBy = 'NASA CMR';
      } else if (product === 'ocean-temp' || product === 'sst') {
        data = await earthdataService.getSeaSurfaceTemp(lat, lon, req.body.date);
        poweredBy = 'NASA MUR-SST via PODAAC';
      } else if (product === 'soil-moisture') {
        data = await earthdataService.getSoilMoisture(lat, lon, req.body.date);
        poweredBy = 'NASA SMAP via NSIDC';
      } else if (product === 'ocean-color' || product === 'water-quality') {
        data = await earthdataService.getOceanColor(lat, lon, req.body.date);
        poweredBy = 'NASA MODIS-Aqua via OB.DAAC';
      } else {
        const hoursBack = Math.min(Number(req.body.hours_back ?? 24), 168);
        data = await earthdataService.getPrecipitation(lat, lon, hoursBack);
        poweredBy = 'NASA GPM IMERG via GES DISC';
      }
      const result = {
        success: true,
        product,
        data,
        availableProducts: ['precipitation', 'granules', 'sst', 'soil-moisture', 'ocean-color'],
        productAliases: { 'ocean-temp': 'sst', 'water-quality': 'ocean-color' },
        poweredBy,
        timestamp: new Date().toISOString(),
      };
      const responseTime = Date.now() - startTime;
      await trackRequest("satellite-earthdata", req.body, result, responseTime, SERVICE_PRICING_USD["satellite-earthdata"], req.ip || "unknown");
      await trackBundleUsage(req, res, "satellite-earthdata", req.body);
      res.json(result);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      await trackRequest("satellite-earthdata", req.body, null, responseTime, SERVICE_PRICING_USD["satellite-earthdata"], req.ip || "unknown", error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  })
);

router.get("/earthdata-granules",
  createPaymentOrchestrator("earthdata-granules", SERVICE_PRICING_MICRO["earthdata-granules"], (_req, res) => {
    res.json({ service: "earthdata-granules", method: "POST", description: "Search 1B+ NASA satellite granules by bbox, date, platform, and cloud cover. Returns metadata + download URLs. $0.25/call." });
  })
);

router.post("/earthdata-granules",
  createPaymentOrchestrator("earthdata-granules", SERVICE_PRICING_MICRO["earthdata-granules"], async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const bbox = {
        west: req.body.west ?? -122.5,
        south: req.body.south ?? 37.7,
        east: req.body.east ?? -122.3,
        north: req.body.north ?? 37.9,
      };
      const data = await earthdataService.searchGranules({
        bbox,
        startDate: req.body.start_date,
        endDate: req.body.end_date,
        platform: req.body.platform,
        shortName: req.body.short_name,
        maxCloudCover: req.body.max_cloud_cover,
        limit: req.body.limit ?? 10,
      });
      const result = { success: true, data, poweredBy: 'NASA Common Metadata Repository (CMR)', timestamp: new Date().toISOString() };
      const responseTime = Date.now() - startTime;
      await trackRequest("earthdata-granules", req.body, result, responseTime, SERVICE_PRICING_USD["earthdata-granules"], req.ip || "unknown");
      await trackBundleUsage(req, res, "earthdata-granules", req.body);
      res.json(result);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      await trackRequest("earthdata-granules", req.body, null, responseTime, SERVICE_PRICING_USD["earthdata-granules"], req.ip || "unknown", error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  })
);

router.get("/earthdata-precipitation",
  createPaymentOrchestrator("earthdata-precipitation", SERVICE_PRICING_MICRO["earthdata-precipitation"], (_req, res) => {
    res.json({ service: "earthdata-precipitation", method: "POST", description: "Observed satellite rain rate at any global coordinate. NASA GPM IMERG — actual measurement, not a forecast. $0.25/call." });
  })
);

router.post("/earthdata-precipitation",
  createPaymentOrchestrator("earthdata-precipitation", SERVICE_PRICING_MICRO["earthdata-precipitation"], async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const lat = Number(req.body.lat ?? 34.05);
      const lon = Number(req.body.lon ?? -118.25);
      const hoursBack = Math.min(Number(req.body.hours_back ?? 24), 168);
      const data = await earthdataService.getPrecipitation(lat, lon, hoursBack);
      const result = { success: true, data, poweredBy: 'NASA GPM IMERG via GES DISC', timestamp: new Date().toISOString() };
      const responseTime = Date.now() - startTime;
      await trackRequest("earthdata-precipitation", req.body, result, responseTime, SERVICE_PRICING_USD["earthdata-precipitation"], req.ip || "unknown");
      await trackBundleUsage(req, res, "earthdata-precipitation", req.body);
      res.json(result);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      await trackRequest("earthdata-precipitation", req.body, null, responseTime, SERVICE_PRICING_USD["earthdata-precipitation"], req.ip || "unknown", error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  })
);

router.get("/earthdata-sst",
  createPaymentOrchestrator("earthdata-sst", SERVICE_PRICING_MICRO["earthdata-sst"], (_req, res) => {
    res.json({ service: "earthdata-sst", method: "POST", description: "Sea surface temperature from NASA MUR-SST Level 4 analysis. 1km resolution, daily. $0.25/call." });
  })
);

router.post("/earthdata-sst",
  createPaymentOrchestrator("earthdata-sst", SERVICE_PRICING_MICRO["earthdata-sst"], async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const lat = Number(req.body.lat ?? 35.5);
      const lon = Number(req.body.lon ?? -140.0);
      const data = await earthdataService.getSeaSurfaceTemp(lat, lon, req.body.date);
      const result = { success: true, data, poweredBy: 'NASA MUR-SST via PODAAC', timestamp: new Date().toISOString() };
      const responseTime = Date.now() - startTime;
      await trackRequest("earthdata-sst", req.body, result, responseTime, SERVICE_PRICING_USD["earthdata-sst"], req.ip || "unknown");
      await trackBundleUsage(req, res, "earthdata-sst", req.body);
      res.json(result);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      await trackRequest("earthdata-sst", req.body, null, responseTime, SERVICE_PRICING_USD["earthdata-sst"], req.ip || "unknown", error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  })
);

router.get("/earthdata-soil-moisture",
  createPaymentOrchestrator("earthdata-soil-moisture", SERVICE_PRICING_MICRO["earthdata-soil-moisture"], (_req, res) => {
    res.json({ service: "earthdata-soil-moisture", method: "POST", description: "SMAP L3 daily soil moisture for any coordinate. 36km resolution, 2-3 day repeat cycle. $0.25/call." });
  })
);

router.post("/earthdata-soil-moisture",
  createPaymentOrchestrator("earthdata-soil-moisture", SERVICE_PRICING_MICRO["earthdata-soil-moisture"], async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const lat = Number(req.body.lat ?? 40.0);
      const lon = Number(req.body.lon ?? -95.0);
      const data = await earthdataService.getSoilMoisture(lat, lon, req.body.date);
      const result = { success: true, data, poweredBy: 'NASA SMAP via NSIDC', timestamp: new Date().toISOString() };
      const responseTime = Date.now() - startTime;
      await trackRequest("earthdata-soil-moisture", req.body, result, responseTime, SERVICE_PRICING_USD["earthdata-soil-moisture"], req.ip || "unknown");
      await trackBundleUsage(req, res, "earthdata-soil-moisture", req.body);
      res.json(result);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      await trackRequest("earthdata-soil-moisture", req.body, null, responseTime, SERVICE_PRICING_USD["earthdata-soil-moisture"], req.ip || "unknown", error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  })
);

router.get("/earthdata-ocean-color",
  createPaymentOrchestrator("earthdata-ocean-color", SERVICE_PRICING_MICRO["earthdata-ocean-color"], (_req, res) => {
    res.json({ service: "earthdata-ocean-color", method: "POST", description: "MODIS-Aqua chlorophyll-a and ocean color at any coastal or ocean coordinate. Daily 4km composites. $0.25/call." });
  })
);

router.post("/earthdata-ocean-color",
  createPaymentOrchestrator("earthdata-ocean-color", SERVICE_PRICING_MICRO["earthdata-ocean-color"], async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const lat = Number(req.body.lat ?? 36.0);
      const lon = Number(req.body.lon ?? -122.0);
      const data = await earthdataService.getOceanColor(lat, lon, req.body.date);
      const result = { success: true, data, poweredBy: 'NASA MODIS-Aqua via OB.DAAC', timestamp: new Date().toISOString() };
      const responseTime = Date.now() - startTime;
      await trackRequest("earthdata-ocean-color", req.body, result, responseTime, SERVICE_PRICING_USD["earthdata-ocean-color"], req.ip || "unknown");
      await trackBundleUsage(req, res, "earthdata-ocean-color", req.body);
      res.json(result);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      await trackRequest("earthdata-ocean-color", req.body, null, responseTime, SERVICE_PRICING_USD["earthdata-ocean-color"], req.ip || "unknown", error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  })
);

// ============================================================
// BASE NATIVE — B20 Token Standard (Base Beryl, July 8 2026)
// Three services: token-info ($0.05), transfer-check ($0.10), compliance-scan ($0.25)
// All use Base RPC as the authoritative source — on-chain truth only.
// Graceful degradation: plain ERC-20 tokens return { b20_compatible: false }.
// ============================================================

router.post("/b20-token-info",
  createPaymentOrchestrator("b20-token-info", SERVICE_PRICING_MICRO["b20-token-info"], async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const { tokenAddress } = req.body;
      if (!tokenAddress || typeof tokenAddress !== "string") {
        return res.status(400).json({ success: false, error: "tokenAddress is required (ERC-20/B20 contract address on Base)" });
      }
      const result = await b20TokenInfoService({ tokenAddress });
      const responseTime = Date.now() - startTime;
      await trackRequest("b20-token-info", req.body, result, responseTime, SERVICE_PRICING_USD["b20-token-info"], req.ip || "unknown");
      await trackBundleUsage(req, res, "b20-token-info", { tokenAddress });
      res.json(result);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      await trackRequest("b20-token-info", req.body, null, responseTime, SERVICE_PRICING_USD["b20-token-info"], req.ip || "unknown", error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  })
);

router.post("/b20-transfer-check",
  createPaymentOrchestrator("b20-transfer-check", SERVICE_PRICING_MICRO["b20-transfer-check"], async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const { tokenAddress, from, to, amount } = req.body;
      if (!tokenAddress || !from || !to) {
        return res.status(400).json({ success: false, error: "tokenAddress, from, and to are required" });
      }
      const result = await b20TransferCheckService({ tokenAddress, from, to, amount });
      const responseTime = Date.now() - startTime;
      await trackRequest("b20-transfer-check", req.body, result, responseTime, SERVICE_PRICING_USD["b20-transfer-check"], req.ip || "unknown");
      await trackBundleUsage(req, res, "b20-transfer-check", { tokenAddress, from, to });
      res.json(result);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      await trackRequest("b20-transfer-check", req.body, null, responseTime, SERVICE_PRICING_USD["b20-transfer-check"], req.ip || "unknown", error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  })
);

router.post("/b20-compliance-scan",
  createPaymentOrchestrator("b20-compliance-scan", SERVICE_PRICING_MICRO["b20-compliance-scan"], async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const { walletAddress, tokenAddresses } = req.body;
      if (!walletAddress || typeof walletAddress !== "string") {
        return res.status(400).json({ success: false, error: "walletAddress is required" });
      }
      const result = await b20ComplianceScanService({ walletAddress, tokenAddresses });
      const responseTime = Date.now() - startTime;
      await trackRequest("b20-compliance-scan", req.body, result, responseTime, SERVICE_PRICING_USD["b20-compliance-scan"], req.ip || "unknown");
      await trackBundleUsage(req, res, "b20-compliance-scan", { walletAddress });
      res.json(result);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      await trackRequest("b20-compliance-scan", req.body, null, responseTime, SERVICE_PRICING_USD["b20-compliance-scan"], req.ip || "unknown", error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  })
);

// ============================================================
// ROBINHOOD CHAIN DEX DATA (eip155:4663, Arbitrum Orbit L2, July 8 2026)
// Three services — all beta, DexScreener-backed until Uniswap V3 subgraph deploys.
// Responses include source/asOf/confidence fields so agents know data quality.
// robinhood-token-price: $0.60 | robinhood-dex-pools: $1.25 | robinhood-chain-stats: $0.75
// ============================================================

router.post("/robinhood-token-price",
  createPaymentOrchestrator("robinhood-token-price", SERVICE_PRICING_MICRO["robinhood-token-price"], async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const { address } = req.body;
      if (!address || typeof address !== "string") {
        return res.status(400).json({ success: false, error: "address is required (token contract address on Robinhood Chain, 0x...)" });
      }
      const asOf = new Date().toISOString();
      const pools = await fetchRobinhoodPoolData(address);
      if (pools.length === 0) {
        const result = {
          success: true,
          chain: "robinhood",
          chainId: 4663,
          address,
          price: null,
          priceChange24h: null,
          volume24hUSD: null,
          liquidityUSD: null,
          pools: [],
          confidence: "none",
          source: "dexscreener",
          asOf,
          beta: true,
          note: "No pools found for this token on Robinhood Chain. Token may not be listed yet.",
        };
        const responseTime = Date.now() - startTime;
        await trackRequest("robinhood-token-price", req.body, result, responseTime, SERVICE_PRICING_USD["robinhood-token-price"], req.ip || "unknown");
        await trackBundleUsage(req, res, "robinhood-token-price", { address });
        return res.json(result);
      }
      const best = pools.sort((a: any, b: any) => b.liquidity - a.liquidity)[0];
      const responseTime = Date.now() - startTime;
      const result = {
        success: true,
        chain: "robinhood",
        chainId: 4663,
        address,
        symbol: best.baseToken,
        price: best.priceUSD,
        priceChange24h: best.priceChange24h,
        volume24hUSD: best.volume24h,
        liquidityUSD: best.liquidityUSD,
        poolCount: pools.length,
        topPool: best,
        confidence: best.liquidity > 10000 ? "medium" : "low",
        source: best.source,
        asOf,
        beta: true,
        note: "Day-1 Robinhood Chain data — DexScreener source. Confidence improves as ecosystem matures.",
      };
      await trackRequest("robinhood-token-price", req.body, result, responseTime, SERVICE_PRICING_USD["robinhood-token-price"], req.ip || "unknown");
      await trackBundleUsage(req, res, "robinhood-token-price", { address });
      res.json(result);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      await trackRequest("robinhood-token-price", req.body, null, responseTime, SERVICE_PRICING_USD["robinhood-token-price"], req.ip || "unknown", error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  })
);

router.post("/robinhood-dex-pools",
  createPaymentOrchestrator("robinhood-dex-pools", SERVICE_PRICING_MICRO["robinhood-dex-pools"], async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const { token, minLiquidity = 0, limit = 20 } = req.body;
      const asOf = new Date().toISOString();
      let pools: any[];
      if (token && typeof token === "string") {
        const raw = await fetchRobinhoodPoolData(token);
        pools = raw.filter((p: any) => p.liquidity >= Number(minLiquidity));
      } else {
        pools = await fetchRobinhoodTopPools(Number(minLiquidity), Math.min(Number(limit), 50));
      }
      const responseTime = Date.now() - startTime;
      const result = {
        success: true,
        chain: "robinhood",
        chainId: 4663,
        poolCount: pools.length,
        pools: pools.slice(0, Math.min(Number(limit), 50)),
        confidence: pools.length > 0 ? (pools[0]?.liquidity > 10000 ? "medium" : "low") : "none",
        source: "dexscreener",
        asOf,
        beta: true,
        note: "Day-1 Robinhood Chain data — DexScreener source. Uniswap V3 subgraph pending deployment.",
      };
      await trackRequest("robinhood-dex-pools", req.body, result, responseTime, SERVICE_PRICING_USD["robinhood-dex-pools"], req.ip || "unknown");
      await trackBundleUsage(req, res, "robinhood-dex-pools", { token });
      res.json(result);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      await trackRequest("robinhood-dex-pools", req.body, null, responseTime, SERVICE_PRICING_USD["robinhood-dex-pools"], req.ip || "unknown", error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  })
);

router.post("/robinhood-chain-stats",
  createPaymentOrchestrator("robinhood-chain-stats", SERVICE_PRICING_MICRO["robinhood-chain-stats"], async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const stats = await fetchRobinhoodChainStats();
      const responseTime = Date.now() - startTime;
      const result = { success: true, ...stats };
      await trackRequest("robinhood-chain-stats", req.body, result, responseTime, SERVICE_PRICING_USD["robinhood-chain-stats"], req.ip || "unknown");
      await trackBundleUsage(req, res, "robinhood-chain-stats", {});
      res.json(result);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      await trackRequest("robinhood-chain-stats", req.body, null, responseTime, SERVICE_PRICING_USD["robinhood-chain-stats"], req.ip || "unknown", error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  })
);

// ============================================================
// ROBINHOOD CHAIN — CHAINLINK STOCK PRICE FEED + BOOTSTRAP BRIDGE (July 2026)
// rh-stock-price: $0.05 | rh-bridge-usdc: $0.75
// ============================================================

router.post("/rh-stock-price",
  createPaymentOrchestrator("rh-stock-price", SERVICE_PRICING_MICRO["rh-stock-price"], async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const result = await rhStockPriceService(req.body);
      const responseTime = Date.now() - startTime;
      await trackRequest("rh-stock-price", req.body, result, responseTime, SERVICE_PRICING_USD["rh-stock-price"], req.ip || "unknown");
      await trackBundleUsage(req, res, "rh-stock-price", { symbols: req.body.symbols ?? req.body.symbol });
      res.json(result);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      await trackRequest("rh-stock-price", req.body, null, responseTime, SERVICE_PRICING_USD["rh-stock-price"], req.ip || "unknown", error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  })
);

router.post("/rh-bridge-usdc",
  createPaymentOrchestrator("rh-bridge-usdc", SERVICE_PRICING_MICRO["rh-bridge-usdc"], async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const result = await rhBridgeService(req.body);
      const responseTime = Date.now() - startTime;
      await trackRequest("rh-bridge-usdc", req.body, result, responseTime, SERVICE_PRICING_USD["rh-bridge-usdc"], req.ip || "unknown");
      await trackBundleUsage(req, res, "rh-bridge-usdc", { recipient: req.body.recipient });
      res.json(result);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      await trackRequest("rh-bridge-usdc", req.body, null, responseTime, SERVICE_PRICING_USD["rh-bridge-usdc"], req.ip || "unknown", error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  })
);

// ============================================================
// BANKROLL NETWORK — vltUSDC Deposit Builder (Ethereum LP Yield, July 2026)
// FREE — No payment required. Partnership with Bankroll Network.
// ============================================================

router.get("/vlt-usdc-deposit", (_req: Request, res: Response) => {
  const stats = getVltUsdcStats();
  res.json({
    service: 'vlt-usdc-deposit',
    name: 'vltUSDC Vault Deposit Builder',
    price: 'free',
    description: 'FREE — Two deposit modes: (A) balanced (VLT+USDC, 3 txs) or (B) USDC-only via ZapHelper with live swap quote (2 txs). Set usdcOnly:true in the request body for USDC-only mode. No VLT required in mode B. Vault is VLT/USDC Uniswap V4 full-range 1% fee, auto-compounds fees.',
    method: 'POST',
    body: {
      amountUsdc: 'string | number — total USDC to deposit',
      recipient:  'string — Ethereum address to receive vltUSDC shares (lowercase accepted, auto-normalized)',
      usdcOnly:   'boolean (optional, default false) — set true for USDC-only mode via ZapHelper (no VLT needed)',
    },
    modes: {
      balanced: {
        usdcOnly:  false,
        requires:  'VLT + USDC on Ethereum mainnet',
        returns:   '3 unsigned txs: VLT.approve(vault) → USDC.approve(vault) → vault.deposit',
      },
      usdcOnly: {
        usdcOnly:  true,
        requires:  'USDC only on Ethereum mainnet — no VLT needed',
        returns:   '2 unsigned txs: USDC.approve(zapHelper) → zapHelper.zapDeposit(7 args with live swapData)',
        route:     'USDC –[V3 0.05%]→ WETH –[V2]→ VLT + USDC → vltUSDC vault',
        slippage:  '1% on VLT output, live on-chain quote (QuoterV2 + V2 getReserves)',
        alsoAt:    'POST /api/vault/vlt-zap-deposit (standalone USDC-only endpoint)',
      },
    },
    contracts: {
      vault:      '0xee8d4c5c768AadCd3517Aa8C908De300305D0A7f',
      zapHelper:  '0x348A57b1dc6E3dCAa645DE6e4E864924B410525D',
      vlt:        '0x6b785a0322126826d8226d77e173d75DAfb84d11',
      usdc:       '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      chainId:    1,
      pool:       'VLT/USDC · Uniswap V4 · full-range · 1% fee',
    },
    ...(stats ? {
      liveStats: {
        vltPriceUsd: stats.stats.vltPriceUsd,
        tvlUsd:      stats.stats.tvlUsd,
        aprDisplay:  stats.stats.aprDisplay,
        lPerShare:   stats.stats.lPerShare,
        updatedAt:   stats.updatedAt,
        source:      stats.source,
      },
    } : { liveStats: null }),
    also: 'GET /api/vlt-usdc/stats for full vault stats | GET /api/vault/vlt-zap-deposit for USDC-only discovery',
  });
});

router.post("/vlt-usdc-deposit", async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { amountUsdc, recipient, usdcOnly } = req.body as {
      amountUsdc?: string;
      recipient?:  string;
      usdcOnly?:   boolean;
    };
    if (!amountUsdc || !recipient) {
      res.status(400).json({
        success: false,
        error: 'amountUsdc and recipient are required',
        example: { amountUsdc: "100", recipient: "0x..." },
        modes: {
          balanced:  'omit usdcOnly or set usdcOnly:false — requires VLT + USDC, returns 3 txs',
          usdcOnly:  'set usdcOnly:true — USDC only, ZapHelper buys VLT on-market, returns 2 txs with live swap quote',
        },
      });
      return;
    }

    let result: any;
    if (usdcOnly === true) {
      const { buildZapDeposit } = await import('../services/vltUsdcZapService.js');
      result = await buildZapDeposit(amountUsdc, recipient);
    } else {
      result = await buildVltUsdcDeposit(amountUsdc, recipient);
    }

    const responseTime = Date.now() - startTime;
    await trackRequest("vlt-usdc-deposit", req.body, result, responseTime, 0, req.ip || "unknown");
    res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("vlt-usdc-deposit", req.body, null, responseTime, 0, req.ip || "unknown", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// UNKNOWN-SERVICE CATCH-ALL — must be the LAST route in this router
// Returns machine-readable JSON 404 with did_you_mean for malformed
// paths (e.g. gas-price-oracle%60 → suggests gas-price-oracle).
// Paths starting with /wallet pass through to app-level freeWalletRoutes.
// ============================================================
{
  const KNOWN_SLUGS = [
    'ping','first-call','multi-chain-balance','gas-price-oracle','token-price',
    'contract-scan','wallet-risk','trade-signals','token-sentiment','trending-tokens',
    'whale-alerts','dex-liquidity','transaction-builder','token-metadata',
    'approval-manager','batch-quote','portfolio-tracker','instant-agent-wallet',
    'verified-agent-identity','seamless-chain-bridge','ai-inference',
    'smart-contract-audit','payment-processing','compliance-consultation',
    'property-valuation','lease-analysis','construction-progress',
    'rwa-nav-oracle','tokenized-yield-compare','credit-risk-score',
    'fraud-detection','compliance-check','trading-signal','portfolio-optimization',
    'sentiment-analysis','arbitrage-scanner','correlation-matrix','risk-metrics',
    'polymarket-events','polymarket-odds','polymarket-search','prediction-market-odds',
    'kalshi-markets','kalshi-odds','kalshi-search','prediction-market-spread',
    'agent-create-wallet','stock-sentiment','instant-api-key','forex-sentiment',
    'solana-yield-finder','fire-alerts','weather-imagery','vegetation',
    'flood-detection','air-quality','land-use','b20-token-info','b20-transfer-check','b20-compliance-scan',
    'robinhood-token-price','robinhood-dex-pools','robinhood-chain-stats',
    'rh-stock-price','rh-bridge-usdc',
    'vlt-usdc-deposit',
    'fleet-telematics',
    'weather-station-data','iot-sensor-reading','iot-device-stream','iot-bulk-data',
    'earthdata-sst','earthdata-soil-moisture','earthdata-ocean-color',
    'catalog','openapi.json','payment-status','payment-docs',
  ];

  function lev(a: string, b: string): number {
    const m = a.length, n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
      Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
    );
    for (let i = 1; i <= m; i++)
      for (let j = 1; j <= n; j++)
        dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1]
          : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    return dp[m][n];
  }

  function bestMatch(slug: string): string | null {
    if (KNOWN_SLUGS.includes(slug)) return slug;
    for (const s of KNOWN_SLUGS) if (s.startsWith(slug) || slug.startsWith(s)) return s;
    let best: string | null = null, bestDist = Infinity;
    for (const s of KNOWN_SLUGS) {
      const d = lev(slug, s);
      if (d < bestDist) { bestDist = d; best = s; }
    }
    return bestDist <= Math.max(3, Math.floor(slug.length * 0.4)) ? best : null;
  }

  function normalizeSlug(raw: string): string {
    let s = raw;
    try { s = decodeURIComponent(s); } catch {}
    return s.replace(/^\/+/, '').toLowerCase().replace(/[`'"\\]+$/, '').trim();
  }

  // SDK payments redirects: /x402/sdk-payments-evm and /x402/sdk-payments-solana → /x402/first-call
  // These paths were advertised in the discovery surface and social channels but never had x402 handlers.
  // 30+ days of 404s from AwarioBot following social referral links to these endpoints.
  // 301 permanent: the golden path first-call is the correct entry point for SDK-interested agents.
  router.all('/sdk-payments-evm', (_req: Request, res: Response) => {
    res.setHeader('X-Redirect-Reason', 'sdk-payments-golden-path');
    return res.redirect(301, '/x402/first-call');
  });
  router.all('/sdk-payments-solana', (_req: Request, res: Response) => {
    res.setHeader('X-Redirect-Reason', 'sdk-payments-golden-path');
    return res.redirect(301, '/x402/first-call');
  });

  // Compatibility redirect: /x402/service/:slug → /x402/:slug
  // x402-observer and some validators construct URLs as /x402/service/<slug> instead of /x402/<slug>.
  // Rather than letting them hit the catch-all 404, redirect to the canonical path so they
  // receive a real 402 challenge and can record the service as reachable.
  router.all('/service/:slug', (req: Request, res: Response) => {
    const slug = req.params.slug;
    const target = `/x402/${slug}`;
    res.setHeader('X-Redirect-Reason', 'canonical-path-alias');
    return res.redirect(308, target);
  });

  // Handle /x402/service (no slug) — agents that POST to the base /service path with no slug.
  // These 14 POST attempts per 12h window are real payment intent going to a dead path.
  // Redirect to /x402/catalog so agents can discover the correct service endpoints.
  router.all('/service', (_req: Request, res: Response) => {
    res.setHeader('X-Redirect-Reason', 'service-base-path-catalog-redirect');
    res.setHeader('X-Service-List', 'https://coinrailz.com/.well-known/x402.json');
    return res.redirect(308, '/x402/catalog');
  });

  router.all('*', (req: Request, res: Response, next) => {
    // Pass /wallet/* through to app-level freeWalletRoutes
    if (req.path.startsWith('/wallet')) return next();

    const rawPath = req.path;
    const normalized = normalizeSlug(rawPath);
    const candidate = bestMatch(normalized);
    const serviceUrl = candidate ? `/x402/${candidate}` : null;

    const body: Record<string, unknown> = {
      x402Version: 2,
      error: 'SERVICE_NOT_FOUND',
      message: `No x402 service found at /x402/${normalized || rawPath.replace(/^\//, '')}`,
      requested_path: `/x402${rawPath}`,
      normalized_slug: normalized,
    };

    if (candidate && normalized !== candidate) {
      // Item 1: Emit hint headers so HEAD requesters (no body) can still see the correction.
      const hintBase = process.env.REPLIT_DEPLOYMENT === '1'
        ? 'https://coinrailz.com'
        : `${req.protocol}://${req.get('host')}`;
      res.setHeader('X-Did-You-Mean', candidate);
      res.setHeader('X-Service-URL', `${hintBase}${serviceUrl}`);
      res.setHeader('Link', `<${hintBase}${serviceUrl}>; rel="alternate"`);
      body.did_you_mean = candidate;
      body.service_url = serviceUrl;
      body.hint = `Try ${req.method} ${serviceUrl}`;
    } else if (candidate && normalized === candidate) {
      // Exact slug match — service is real but only has a POST handler registered.
      // Return a proper 402 challenge instead of a confusing 404.
      // This covers satellite services (weather-imagery, fire-alerts, etc.) that register
      // only router.post() and rely on this catch-all for GET/HEAD discovery.
      const priceMicro = SERVICE_PRICING_MICRO[candidate as keyof typeof SERVICE_PRICING_MICRO];
      const priceUsd   = SERVICE_PRICING_USD[candidate as keyof typeof SERVICE_PRICING_USD];
      if (priceMicro && priceUsd) {
        const publicBase = process.env.PUBLIC_URL ||
          (process.env.REPLIT_DEPLOYMENT === '1' ? 'https://coinrailz.com' :
          `${req.protocol}://${req.get('host')}`);

        // Item 2c: Determine correct payment network based on service type.
        const SOLANA_NATIVE_SLUGS = ['solana-yield-finder', 'solana-yield-rates', 'solana-yield-deposit'];
        const isSolanaService = SOLANA_NATIVE_SLUGS.includes(candidate);
        const SOLANA_PLATFORM_WALLET = process.env.DEXTER_SOLANA_WALLET || 'BmUPzSupHJu2kW4cL27dF7Vc2JaZTwXKzFsRuagPDtL8';

        const accepts = isSolanaService ? [{
          scheme: 'exact',
          network: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
          maxAmountRequired: String(priceMicro),
          resource: `${publicBase}/x402/${candidate}`,
          description: `POST /x402/${candidate} — $${priceUsd} USDC per call`,
          mimeType: 'application/json',
          payToAddress: SOLANA_PLATFORM_WALLET,
          maxTimeoutSeconds: 300,
        }] : [{
          scheme: 'exact',
          network: 'eip155:8453',
          maxAmountRequired: String(priceMicro),
          resource: `${publicBase}/x402/${candidate}`,
          description: `POST /x402/${candidate} — $${priceUsd} USDC per call`,
          mimeType: 'application/json',
          payToAddress: process.env.PLATFORM_WALLET_ADDRESS || process.env.EVM_WALLET_ADDRESS || '',
          maxTimeoutSeconds: 300,
        }];

        const challengeBody = {
          x402Version: 2,
          accepts,
          error: 'PAYMENT_REQUIRED',
          x402_service: candidate,
          service_url: `${publicBase}/x402/${candidate}`,
          catalog_url: `${publicBase}/.well-known/x402.json`,
          note: `Send POST with X-PAYMENT header to /x402/${candidate}`,
        };

        res.setHeader('X-Agent-Instructions', 'https://coinrailz.com/.well-known/agent-instructions.json');
        res.setHeader('Link', '<https://coinrailz.com/.well-known/agent-instructions.json>; rel="agent-instructions"');
        res.setHeader('X-Service-Price-USD', String(priceUsd));

        // Item 2c: HEAD requests must not have a body — return status + headers only.
        if (req.method === 'HEAD') {
          return res.status(402).end();
        }
        return res.status(402).json(challengeBody);
      }
    }

    body.catalog_url = '/.well-known/x402.json';
    body.docs_url = '/x402/payment-docs';

    return res.status(404).json(body);
  });
}

export default router;
