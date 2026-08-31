/**
 * x402-Gated Service Endpoints - Official x402-express Implementation
 * 
 * Uses official paymentMiddleware + facilitator pattern for x402scan/Bazaar compliance
 * Matches the working pattern from x402MicroserviceRoutesV2.ts
 * 
 * Features:
 * ✅ Official x402-express paymentMiddleware with Coinbase facilitator
 * ✅ Payment orchestrator for hybrid payment verification
 * ✅ Compliant with x402scan and Coinbase Bazaar requirements
 * ✅ Production-ready resource URLs
 */

import { Router, Request, Response } from 'express';
import { paymentMiddleware, x402ResourceServer } from '@x402/express';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import { HTTPFacilitatorClient } from '@x402/core/server';
import { nanoid } from 'nanoid';
import { createPaymentOrchestrator } from '../middleware/paymentOrchestrator';
import { getFacilitatorUrl } from '../utils/facilitatorHelper';
import { x402TrackingMiddleware } from '../middleware/x402TrackingMiddleware';
import { usageAnalyticsMiddleware } from '../middleware/usageAnalyticsMiddleware';
import { x402ResponseEnricher } from '../middleware/x402ResponseEnricher';
import { SERVICE_PRICING_USD, SERVICE_PRICING_MICRO, ServiceName, formatUSD } from '@shared/pricing';
import { markPaymentIntentSucceeded } from '../middleware/hybridPaymentMiddleware';

const router = Router();

// Apply analytics and interaction tracking to all x402 routes (MUST be first)
router.use(usageAnalyticsMiddleware);
router.use(x402TrackingMiddleware);

// Apply 402 response enricher BEFORE x402 middleware
// This wraps res.json to add canonical URLs, maxAmountRequiredUSD, paymentInstructions
// SAFE: Only modifies 402 responses, doesn't touch verification logic
router.use(x402ResponseEnricher());

// Platform wallet for receiving payments
const PLATFORM_WALLET = (process.env.PLATFORM_WALLET_ADDRESS || '0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91') as `0x${string}`;

// Network for x402 payments (CAIP-2 format required by @x402/express 2.x)
const NETWORK = 'eip155:8453' as const;

// Public base URL for production discovery
// OVERRIDE: Set PUBLIC_URL env var to force production URL (e.g., PUBLIC_URL=https://coinrailz.com)
const PUBLIC_BASE_URL: `${string}://${string}` = (
  process.env.PUBLIC_URL
    ? process.env.PUBLIC_URL as `${string}://${string}`
    : process.env.REPLIT_DEPLOYMENT === '1' 
      ? 'https://coinrailz.com'
      : process.env.REPLIT_DOMAINS
        ? `https://${process.env.REPLIT_DOMAINS}`
        : process.env.REPL_SLUG 
          ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
          : 'http://localhost:5000') as `${string}://${string}`;

// Helper function to create properly typed resource URLs
function resourceUrl(path: string): `${string}://${string}` {
  return `${PUBLIC_BASE_URL}${path}` as `${string}://${string}`;
}

// Service pricing (in USD for x402-express, converted internally)
const SERVICE_PRICING = {
  'ping': 0.25,                      // $0.25 USD - industry standard discovery endpoint
  'smart-contract-audit': 10.00,     // $10.00 USD - Enterprise Premium
  'payment-processing': 0.50,        // $0.50 USD - Enterprise Rate
  'compliance-consultation': 5.00,   // $5.00 USD
  'multi-chain-balance': 0.50,       // $0.50 USD
  'gas-price-oracle': 0.10,          // $0.10 USD
  'token-price-lookup': 0.25,        // $0.25 USD
};

// CRITICAL: Host header override for x402-express resource URL generation
router.use((req: Request, res: Response, next) => {
  if (process.env.REPLIT_DEPLOYMENT === '1') {
    req.headers.host = 'coinrailz.com';
    req.headers['x-forwarded-host'] = 'coinrailz.com';
    req.headers['x-forwarded-proto'] = 'https';
  } else if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
    const workspaceHost = `${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
    req.headers.host = workspaceHost;
    req.headers['x-forwarded-host'] = workspaceHost;
    req.headers['x-forwarded-proto'] = 'https';
  }
  next();
});

// Define x402 routes configuration — new @x402/express 2.x RouteConfig format
// Each route: { accepts: PaymentOption, description, resource, mimeType }
const x402Routes = {
  'GET /ping': {
    accepts: { scheme: 'exact', price: `$${SERVICE_PRICING['ping']}`, network: NETWORK, payTo: PLATFORM_WALLET, maxTimeoutSeconds: 10 },
    description: 'x402 discovery and testing endpoint - returns 402 Payment Required challenge',
    resource: resourceUrl('/x402/service/ping'),
    mimeType: 'application/json',
  },
  'POST /smart-contract-audit': {
    accepts: { scheme: 'exact', price: `$${SERVICE_PRICING['smart-contract-audit']}`, network: NETWORK, payTo: PLATFORM_WALLET, maxTimeoutSeconds: 900 },
    description: 'Comprehensive smart contract security audit with vulnerability detection',
    resource: resourceUrl('/x402/smart-contract-audit'),
    mimeType: 'application/json',
  },
  'POST /payment-processing': {
    accepts: { scheme: 'exact', price: `$${SERVICE_PRICING['payment-processing']}`, network: NETWORK, payTo: PLATFORM_WALLET, maxTimeoutSeconds: 300 },
    description: 'Multi-chain payment processing service (hourly rate)',
    resource: resourceUrl('/x402/payment-processing'),
    mimeType: 'application/json',
  },
  'POST /compliance-consultation': {
    accepts: { scheme: 'exact', price: `$${SERVICE_PRICING['compliance-consultation']}`, network: NETWORK, payTo: PLATFORM_WALLET, maxTimeoutSeconds: 600 },
    description: 'AML/KYC compliance consultation and risk assessment',
    resource: resourceUrl('/x402/compliance-consultation'),
    mimeType: 'application/json',
  },
  'POST /multi-chain-balance': {
    accepts: { scheme: 'exact', price: `$${SERVICE_PRICING['multi-chain-balance']}`, network: NETWORK, payTo: PLATFORM_WALLET, maxTimeoutSeconds: 60 },
    description: 'Check wallet balances across multiple blockchain networks with AI-powered portfolio analysis',
    resource: resourceUrl('/x402/multi-chain-balance'),
    mimeType: 'application/json',
  },
  'POST /gas-price-oracle': {
    accepts: { scheme: 'exact', price: `$${SERVICE_PRICING['gas-price-oracle']}`, network: NETWORK, payTo: PLATFORM_WALLET, maxTimeoutSeconds: 30 },
    description: 'Real-time gas prices across multiple chains with AI-powered timing recommendations',
    resource: resourceUrl('/x402/gas-price-oracle'),
    mimeType: 'application/json',
  },
  'POST /token-price-lookup': {
    accepts: { scheme: 'exact', price: `$${SERVICE_PRICING['token-price-lookup']}`, network: NETWORK, payTo: PLATFORM_WALLET, maxTimeoutSeconds: 30 },
    description: 'Real-time token pricing and market analysis powered by DEXScreener + AI',
    resource: resourceUrl('/x402/token-price-lookup'),
    mimeType: 'application/json',
  },
};

// Create x402 resource server with Coinbase CDP facilitator + EVM scheme
const facilitatorClient = new HTTPFacilitatorClient({ url: getFacilitatorUrl() });
const resourceServer = new x402ResourceServer(facilitatorClient)
  .register(NETWORK, new ExactEvmScheme());

// Create x402 middleware — syncFacilitatorOnStart:false avoids startup delay
const x402Middleware = paymentMiddleware(x402Routes, resourceServer, undefined, undefined, false);

// Service Handlers

const smartContractAuditHandler = async (req: Request, res: Response) => {
  try {
    const { contractCode, contractName } = req.body;

    if (!contractCode) {
      return res.status(400).json({
        success: false,
        error: 'Contract code is required',
      });
    }

    const { SmartContractAuditHandler } = await import('../services/handlers/SmartContractAuditHandler');
    const handler = new SmartContractAuditHandler();
    
    const result = await handler.execute({
      orderId: nanoid(),
      agentId: 'smart-contract-auditor',
      serviceType: 'x402_gated',
      customerId: req.ip || 'x402-autonomous',
      amount: SERVICE_PRICING['smart-contract-audit'],
      metadata: { protocol: 'x402', paymentVerified: true },
      contractCode,
      contractName: contractName || 'Contract',
    });

    res.json({
      success: true,
      result,
      amountPaid: SERVICE_PRICING['smart-contract-audit'],
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

const paymentProcessingHandler = async (req: Request, res: Response) => {
  try {
    const { amount, currency, network, recipientAddress } = req.body;

    if (!amount || !currency || !network || !recipientAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: amount, currency, network, recipientAddress',
      });
    }

    const { PaymentProcessorHandler } = await import('../services/handlers/PaymentProcessorHandler');
    const handler = new PaymentProcessorHandler();
    
    const result = await handler.execute({
      orderId: nanoid(),
      agentId: 'payment-processor',
      serviceType: 'x402_gated',
      customerId: req.ip || 'x402-autonomous',
      amount: SERVICE_PRICING['payment-processing'],
      metadata: { protocol: 'x402', paymentVerified: true },
      paymentDetails: {
        amount,
        currency,
        network,
        recipientAddress,
      },
    });

    res.json({
      success: true,
      result,
      amountPaid: SERVICE_PRICING['payment-processing'],
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

const complianceConsultationHandler = async (req: Request, res: Response) => {
  try {
    const { businessType, jurisdiction, transactionVolume } = req.body;

    if (!businessType || !jurisdiction) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: businessType, jurisdiction',
      });
    }

    const { ComplianceConsultantHandler } = await import('../services/handlers/ComplianceConsultantHandler');
    const handler = new ComplianceConsultantHandler();
    
    const result = await handler.execute({
      orderId: nanoid(),
      agentId: 'compliance-consultant',
      serviceType: 'x402_gated',
      customerId: req.ip || 'x402-autonomous',
      amount: SERVICE_PRICING['compliance-consultation'],
      metadata: { protocol: 'x402', paymentVerified: true },
      complianceRequirements: {
        businessType,
        jurisdiction,
        transactionVolume: transactionVolume || 0,
      },
    });

    res.json({
      success: true,
      result,
      amountPaid: SERVICE_PRICING['compliance-consultation'],
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

const multiChainBalanceHandler = async (req: Request, res: Response) => {
  try {
    const { walletAddress, chains } = req.body;

    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: walletAddress',
      });
    }

    const { MultiChainBalanceHandler } = await import('../services/handlers/MultiChainBalanceHandler');
    const handler = new MultiChainBalanceHandler();
    
    const result = await handler.execute({
      orderId: nanoid(),
      agentId: 'multi-chain-balance-checker',
      serviceType: 'x402_gated',
      customerId: req.ip || 'x402-autonomous',
      amount: SERVICE_PRICING['multi-chain-balance'],
      metadata: { protocol: 'x402', paymentVerified: true },
      walletAddress,
      chains: chains || ['ethereum', 'base', 'polygon', 'arbitrum', 'optimism'],
    });

    res.json({
      success: true,
      result,
      amountPaid: SERVICE_PRICING['multi-chain-balance'],
      currency: 'USDC',
      network: 'eip155:8453',
    });
  } catch (error: any) {
    console.error('Multi-chain balance check execution failed:', error);
    res.status(500).json({
      success: false,
      error: 'Balance check execution failed',
      details: error.message,
    });
  }
};

const gasPriceOracleHandler = async (req: Request, res: Response) => {
  try {
    const { chains } = req.body;

    const { GasPriceOracleHandler } = await import('../services/handlers/GasPriceOracleHandler');
    const handler = new GasPriceOracleHandler();
    
    const result = await handler.execute({
      orderId: nanoid(),
      agentId: 'gas-price-oracle',
      serviceType: 'x402_gated',
      customerId: req.ip || 'x402-autonomous',
      amount: SERVICE_PRICING['gas-price-oracle'],
      metadata: { protocol: 'x402', paymentVerified: true },
      chains: chains || ['ethereum', 'base', 'polygon', 'arbitrum', 'optimism'],
    });

    res.json({
      success: true,
      result,
      amountPaid: SERVICE_PRICING['gas-price-oracle'],
      currency: 'USDC',
      network: 'eip155:8453',
    });
  } catch (error: any) {
    console.error('Gas price oracle execution failed:', error);
    res.status(500).json({
      success: false,
      error: 'Gas price oracle execution failed',
      details: error.message,
    });
  }
};

const tokenPriceLookupHandler = async (req: Request, res: Response) => {
  try {
    const { tokenAddress, chain } = req.body;

    if (!tokenAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: tokenAddress',
      });
    }

    const { TokenPriceLookupHandler } = await import('../services/handlers/TokenPriceLookupHandler');
    const handler = new TokenPriceLookupHandler();
    
    const result = await handler.execute({
      orderId: nanoid(),
      agentId: 'token-price-lookup',
      serviceType: 'x402_gated',
      customerId: req.ip || 'x402-autonomous',
      amount: SERVICE_PRICING['token-price-lookup'],
      metadata: { protocol: 'x402', paymentVerified: true },
      tokenAddress,
      chain: chain || 'ethereum',
    });

    res.json({
      success: true,
      result,
      amountPaid: SERVICE_PRICING['token-price-lookup'],
      currency: 'USDC',
      network: 'eip155:8453',
    });
  } catch (error: any) {
    console.error('Token price lookup execution failed:', error);
    res.status(500).json({
      success: false,
      error: 'Token price lookup execution failed',
      details: error.message,
    });
  }
};

// ============================================================================
// GET REQUEST HANDLER FOR BAZAAR DISCOVERY
// Coinbase Bazaar crawler uses GET requests to discover x402 services
// We must return proper 402 Payment Required responses for GET (not just POST)
// ============================================================================
function generate402ResponseForGet(serviceKey: string, req: Request, res: Response): void {
  const routeConfig = x402Routes[serviceKey as keyof typeof x402Routes];
  if (!routeConfig) {
    res.status(404).json({ error: "Service not found" });
    return;
  }

  const config = routeConfig;
  const priceUsd = parseFloat(routeConfig.accepts.price.replace('$', ''));
  const priceInMicroUnits = Math.round(priceUsd * 1_000_000).toString();

  // Build official Bazaar discovery extension metadata (spec-compliant format)
  // Using @x402/extensions/bazaar v2.0.0 DiscoveryInfo structure
  // CRITICAL: Use canonical method (POST) NOT req.method
  // Discovery crawlers probe POST services with GET - we must still advertise POST
  const bazaarMetadata = {
    input: {
      type: "http" as const,
      method: "POST" as const,
      bodyType: "json" as const,
      body: { contractAddress: "0x...", chainId: 8453 },
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
    },
    output: {
      type: "application/json",
      format: "json",
      example: { success: true, result: "Service executed successfully", timestamp: new Date().toISOString() }
    }
  };

  const response = {
    x402Version: 2,
    error: "X-PAYMENT header is required",
    accepts: [{
      scheme: "exact",
      network: "base", // Legacy format for x402-fetch v0.7.3 compatibility
      x402Network: "eip155:8453", // V2 CAIP-2 format for spec compliance
      maxAmountRequired: priceInMicroUnits,
      resource: config.resource,
      description: config.description,
      payTo: PLATFORM_WALLET,
      asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      maxTimeoutSeconds: config.accepts.maxTimeoutSeconds || 60,
      mimeType: config.mimeType || "application/json",
      discoverable: true,
      category: "Enterprise Services",
      tags: ["Enterprise", "AI", "x402", "USDC", "Audit", "Compliance"],
      extra: {
        name: "USD Coin",
        version: "2"
      },
      // OFFICIAL BAZAAR EXTENSION FORMAT (required for facilitator indexing)
      extensions: {
        bazaar: { info: bazaarMetadata }
      },
      outputSchema: {
        input: {
          type: "http",
          method: "POST", // Canonical method for enterprise services
          bodyType: "json",
          discoverable: true,
        },
        output: { type: "object", properties: {} }
      },
      type: "http",
      metadata: {}
    }],
    facilitatorUrl: getFacilitatorUrl()
  };

  res.setHeader('X-Agent-Instructions', 'https://coinrailz.com/.well-known/agent-instructions.json');
  res.setHeader('Link', '<https://coinrailz.com/.well-known/agent-instructions.json>; rel="agent-instructions"');
  res.status(402).json(response);
}

// GET handlers for Bazaar discovery (must be before POST handlers)
const gatedServiceEndpoints = [
  'ping',
  'smart-contract-audit',
  'payment-processing',
  'compliance-consultation',
  'multi-chain-balance',
  'gas-price-oracle',
  'token-price-lookup'
];

gatedServiceEndpoints.forEach(endpoint => {
  router.get(`/${endpoint}`, async (req: Request, res: Response) => {
    // CRITICAL: Check if payment was already verified by hybridPaymentMiddleware (USDC/USDT tx hash or API key)
    if ((req as any).paymentAlreadyVerified) {
      console.log(`✅ Payment already verified for /service/${endpoint} - executing service`);
      
      // For ping endpoint, return success immediately (it's a discovery/test service)
      if (endpoint === 'ping') {
        // Mark payment intent as SUCCEEDED before returning response
        const xPayment = req.headers['x-payment'] as string | undefined;
        if (xPayment) {
          // Extract txHash from X-PAYMENT header (raw hash or Base64 JSON)
          let txHash = xPayment.trim();
          try {
            const decoded = Buffer.from(xPayment, 'base64').toString('utf-8');
            const parsed = JSON.parse(decoded);
            if (parsed.txHash) txHash = parsed.txHash;
          } catch { /* Use raw value */ }
          
          // Mark intent as SUCCEEDED asynchronously (don't block response)
          markPaymentIntentSucceeded(txHash, 'ping').catch(err => {
            console.error('Failed to mark payment intent as succeeded:', err);
          });
        }
        
        return res.json({
          success: true,
          service: 'ping',
          message: 'x402 payment verified successfully',
          timestamp: new Date().toISOString(),
          platform: 'Coin Railz',
          paymentMethod: 'hybrid', // Could be USDC, USDT, API key, or EIP-712
          x402Version: 2,
        });
      }
      
      // For other endpoints, they typically use POST - redirect to POST handler
      console.log(`🔄 Verified payment for GET /${endpoint} - but this endpoint typically uses POST`);
      return res.json({
        success: false,
        error: 'Method not allowed',
        message: `${endpoint} requires POST method. GET is only for discovery.`,
        correctMethod: 'POST',
        endpoint: `/x402/${endpoint}`,
      });
    }
    
    console.log(`📡 GET request for /service/${endpoint} - returning 402 for Bazaar discovery`);
    // ping uses GET, others use POST
    const routeKey = endpoint === 'ping' ? `GET /${endpoint}` : `POST /${endpoint}`;
    generate402ResponseForGet(routeKey, req, res);
  });
});

console.log(`✅ GET handlers registered for ${gatedServiceEndpoints.length} x402 gated enterprise services`);

// Register routes with payment orchestrator + x402 middleware
// Paths are relative to /x402/service mount point in server/index.ts
router.post('/smart-contract-audit',
  x402Middleware,
  smartContractAuditHandler
);

router.post('/payment-processing',
  x402Middleware,
  paymentProcessingHandler
);

router.post('/compliance-consultation',
  x402Middleware,
  complianceConsultationHandler
);

router.post('/multi-chain-balance',
  x402Middleware,
  multiChainBalanceHandler
);

router.post('/gas-price-oracle',
  x402Middleware,
  gasPriceOracleHandler
);

router.post('/token-price-lookup',
  x402Middleware,
  tokenPriceLookupHandler
);

// ============================================================================
// DYNAMIC CATCH-ALL HANDLER FOR ALL x402 SERVICES
// This ensures ALL 69 services work at /x402/service/<slug> URL pattern
// Services are defined in shared/pricing.ts as the single source of truth
// ============================================================================

// Service descriptions for dynamic 402 responses
const SERVICE_DESCRIPTIONS: Record<string, string> = {
  'ping': 'x402 discovery and testing endpoint - returns 402 Payment Required challenge',
  'gas-price-oracle': 'Real-time gas prices across multiple chains with AI-powered timing recommendations',
  'token-metadata': 'Unified token info across all chains - essential for trading agent UIs',
  'dex-liquidity': 'Real-time DEX liquidity pool monitoring across multiple exchanges',
  'approval-manager': 'Token approval transaction generator - required for DeFi agents',
  'token-price': 'Token pricing with 24h change, volume, market cap',
  'token-sentiment': 'Social sentiment analysis for tokens with momentum indicators',
  'transaction-builder': 'Pre-validated transaction encoding for agent-to-agent transfers',
  'whale-alerts': 'Track large wallet movements with on-chain monitoring',
  'batch-quote': 'Multi-DEX price quotes in single call',
  'multi-chain-balance': 'Query wallet balances across 7+ EVM chains in a single API call',
  'trending-tokens': 'Top gaining and losing tokens across DEXs',
  'portfolio-tracker': 'Real-time multi-chain portfolio valuation',
  'wallet-risk': 'Wallet risk analysis with compliance flags',
  'trade-signals': 'AI-powered crypto trading signals with entry/exit points',
  'payment-processing': 'Multi-chain payment processing service',
  'contract-scan': 'Basic smart contract security scan with safety score',
  'instant-agent-wallet': 'Create MPC-secured USDC wallets instantly via Circle CDP',
  'agent-create-wallet': 'Agent Wallet Provisioning via Coinbase CDP',
  'seamless-chain-bridge': 'Cross-chain USDC routing via Circle CCTP',
  'verified-agent-identity': 'KYA identity verification with on-chain reputation',
  'compliance-consultation': 'AML/KYC compliance consultation and risk assessment',
  'smart-contract-audit': 'Comprehensive smart contract security audit',
  'property-valuation': 'AI-powered real estate property valuation',
  'lease-analysis': 'Commercial lease analysis and optimization',
  'construction-progress': 'Construction project progress tracking',
  'credit-risk-score': 'Credit risk scoring and analysis',
  'fraud-detection': 'Transaction fraud detection and prevention',
  'compliance-check': 'Regulatory compliance verification',
  'trading-signal': 'Advanced trading signal generation',
  'portfolio-optimization': 'Portfolio optimization recommendations',
  'sentiment-analysis': 'Market sentiment analysis',
  'arbitrage-scanner': 'Cross-exchange arbitrage opportunity scanner',
  'correlation-matrix': 'Asset correlation matrix analysis',
  'risk-metrics': 'Portfolio risk metrics calculation',
  'polymarket-events': 'Trending prediction market events',
  'polymarket-odds': 'Current odds for prediction markets',
  'polymarket-search': 'Search prediction markets',
  'prediction-market-odds': 'Generic prediction market odds lookup',
  'kalshi-markets': 'Active Kalshi prediction markets (CFTC-regulated)',
  'kalshi-odds': 'Current odds for specific Kalshi market',
  'kalshi-search': 'Search Kalshi prediction markets',
  'stock-sentiment': 'AI-powered stock market sentiment analysis with news, technicals, and institutional activity',
  'forex-sentiment': 'AI-powered forex currency pair sentiment analysis with economic and central bank insights',
};

// All services from the centralized pricing (single source of truth)
const ALL_SERVICE_SLUGS = Object.keys(SERVICE_PRICING_USD) as ServiceName[];

// Generate dynamic 402 response for any service
function generateDynamic402Response(serviceSlug: string, req: Request, res: Response): void {
  const priceUsd = SERVICE_PRICING_USD[serviceSlug as ServiceName];
  const priceMicro = SERVICE_PRICING_MICRO[serviceSlug as ServiceName];
  
  if (!priceUsd || !priceMicro) {
    res.status(404).json({ 
      error: 'Service not found',
      availableServices: ALL_SERVICE_SLUGS,
      catalogUrl: `${PUBLIC_BASE_URL}/x402/catalog`,
    });
    return;
  }

  const description = SERVICE_DESCRIPTIONS[serviceSlug] || `${serviceSlug} x402 micropayment service`;
  
  const response = {
    x402Version: 2,
    error: "X-PAYMENT header is required",
    accepts: [{
      scheme: "exact",
      network: "base", // Legacy format for x402-fetch v0.7.3 compatibility
      x402Network: "eip155:8453", // V2 CAIP-2 format for spec compliance
      maxAmountRequired: priceMicro.toString(),
      maxAmountRequiredUSD: `$${priceUsd.toFixed(2)}`,
      resource: resourceUrl(`/x402/service/${serviceSlug}`),
      description: description,
      payTo: PLATFORM_WALLET,
      asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      maxTimeoutSeconds: 120,
      mimeType: "application/json",
      discoverable: true,
      category: "API Access",
      tags: ["Crypto", "Blockchain", "AI", "x402", "USDC"],
      extra: {
        name: "USD Coin",
        version: "2",
        decimals: 6,
        chainId: 8453,
        chainName: "Base",
      },
      outputSchema: {
        input: { type: "http", method: "GET", discoverable: true },
        output: { type: "object", properties: {} }
      },
      type: "http",
      metadata: {}
    }],
    facilitatorUrl: getFacilitatorUrl(),
    paymentInstructions: {
      step1: "Obtain USDC on Ethereum (chainId: 1) or Base (chainId: 8453)",
      step2: "Sign EIP-3009 authorization for the exact amount",
      step3: "Include Base64-encoded authorization in X-PAYMENT header",
      step4: "Retry the request with X-PAYMENT header",
      alternativeStep3: "Or include raw transaction hash (0x...) in X-PAYMENT header after sending USDC",
      supportedMethods: ["eip3009-authorization", "raw-transaction-hash"],
      network: "base", // Legacy format for x402-fetch compatibility
      x402Network: "eip155:8453", // V2 CAIP-2 format for spec compliance
      chainId: 8453,
      token: "USDC",
      tokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    },
    recommendedServices: [
      { id: "ping", name: "x402 Discovery Ping", priceUSD: formatUSD(SERVICE_PRICING_USD['ping']), endpoint: "/x402/ping" },
      { id: "trade-signals", name: "AI Trade Signals", priceUSD: formatUSD(SERVICE_PRICING_USD['trade-signals']), endpoint: "/x402/trade-signals" },
      { id: "wallet-risk", name: "Wallet Risk Analysis", priceUSD: formatUSD(SERVICE_PRICING_USD['wallet-risk']), endpoint: "/x402/wallet-risk" },
      { id: "instant-agent-wallet", name: "Agent Wallet Creation", priceUSD: formatUSD(SERVICE_PRICING_USD['instant-agent-wallet']), endpoint: "/x402/instant-agent-wallet" },
    ],
    catalogUrl: `${PUBLIC_BASE_URL}/x402/catalog`,
    totalServicesAvailable: ALL_SERVICE_SLUGS.length,
  };

  res.setHeader('X-Agent-Instructions', 'https://coinrailz.com/.well-known/agent-instructions.json');
  res.setHeader('Link', '<https://coinrailz.com/.well-known/agent-instructions.json>; rel="agent-instructions"');
  res.status(402).json(response);
}

// ============================================================================
// CATCH-ALL ROUTE: Handle ALL service slugs dynamically
// This MUST be registered AFTER explicit handlers to allow overrides
// ============================================================================
router.get('/:serviceSlug', (req: Request, res: Response) => {
  const { serviceSlug } = req.params;
  
  // Skip if already handled by explicit routes above
  if (gatedServiceEndpoints.includes(serviceSlug)) {
    return; // Let the explicit handler above deal with it
  }
  
  console.log(`📡 Dynamic GET for /x402/service/${serviceSlug} - generating 402 response`);
  generateDynamic402Response(serviceSlug, req, res);
});

router.post('/:serviceSlug', (req: Request, res: Response) => {
  const { serviceSlug } = req.params;
  
  // Skip if already handled by explicit routes above
  if (gatedServiceEndpoints.includes(serviceSlug)) {
    return; // Let the explicit handler above deal with it
  }
  
  // For POST requests without payment, return 402
  // The actual service execution happens at /x402/<slug> (primary routes)
  const paymentHeader = req.headers['x-payment'] || req.headers['x-payment-proof'];
  
  if (!paymentHeader) {
    console.log(`📡 Dynamic POST for /x402/service/${serviceSlug} - returning 402 (no payment)`);
    generateDynamic402Response(serviceSlug, req, res);
    return;
  }
  
  // If payment is provided, redirect to the primary endpoint
  // This maintains a single execution path for services
  console.log(`🔄 Redirecting /x402/service/${serviceSlug} to /x402/${serviceSlug}`);
  res.redirect(307, `/x402/${serviceSlug}`);
});

console.log(`✅ Dynamic catch-all registered for ${ALL_SERVICE_SLUGS.length} x402 services at /x402/service/*`);

export default router;
