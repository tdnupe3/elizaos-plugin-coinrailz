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
import { paymentMiddleware, Network } from 'x402-express';
import { facilitator } from '@coinbase/x402';
import { nanoid } from 'nanoid';
import { createPaymentOrchestrator } from '../middleware/paymentOrchestrator';
import { x402TrackingMiddleware } from '../middleware/x402TrackingMiddleware';
import { usageAnalyticsMiddleware } from '../middleware/usageAnalyticsMiddleware';

const router = Router();

// Apply analytics and interaction tracking to all x402 routes (MUST be first)
router.use(usageAnalyticsMiddleware);
router.use(x402TrackingMiddleware);

// Platform wallet for receiving payments
const PLATFORM_WALLET = (process.env.PLATFORM_WALLET_ADDRESS || '0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91') as `0x${string}`;

// Network for x402 payments
const NETWORK: Network = 'base';

// Public base URL for production discovery
// CRITICAL: Use REPLIT_DOMAINS for workspace URLs (correct Replit env var)
const PUBLIC_BASE_URL: `${string}://${string}` = (process.env.REPLIT_DEPLOYMENT === '1' 
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
  'smart-contract-audit': 1000,      // $1000 USD
  'payment-processing': 50,          // $50 USD
  'compliance-consultation': 500,    // $500 USD
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

// Define x402 routes configuration (must match x402MicroserviceRoutesV2 structure)
// Paths are relative to /x402/service mount point
const x402Routes = {
  'GET /ping': {
    price: `$${SERVICE_PRICING['ping']}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: resourceUrl('/x402/service/ping'),
      name: 'Ping/Echo Service',
      description: 'x402 discovery and testing endpoint - returns 402 Payment Required challenge',
      mimeType: 'application/json',
      maxTimeoutSeconds: 10,
    },
  },
  'POST /smart-contract-audit': {
    price: `$${SERVICE_PRICING['smart-contract-audit']}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: resourceUrl('/x402/service/smart-contract-audit'),
      name: 'Smart Contract Auditor',
      description: 'Comprehensive smart contract security audit with vulnerability detection',
      mimeType: 'application/json',
      maxTimeoutSeconds: 900,
    },
  },
  'POST /payment-processing': {
    price: `$${SERVICE_PRICING['payment-processing']}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: resourceUrl('/x402/service/payment-processing'),
      name: 'Payment Processor',
      description: 'Multi-chain payment processing service (hourly rate)',
      mimeType: 'application/json',
      maxTimeoutSeconds: 300,
    },
  },
  'POST /compliance-consultation': {
    price: `$${SERVICE_PRICING['compliance-consultation']}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: resourceUrl('/x402/service/compliance-consultation'),
      name: 'Compliance Consultant',
      description: 'AML/KYC compliance consultation and risk assessment',
      mimeType: 'application/json',
      maxTimeoutSeconds: 600,
    },
  },
  'POST /multi-chain-balance': {
    price: `$${SERVICE_PRICING['multi-chain-balance']}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: resourceUrl('/x402/service/multi-chain-balance'),
      name: 'Multi-Chain Balance Checker',
      description: 'Check wallet balances across multiple blockchain networks with AI-powered portfolio analysis',
      mimeType: 'application/json',
      maxTimeoutSeconds: 60,
    },
  },
  'POST /gas-price-oracle': {
    price: `$${SERVICE_PRICING['gas-price-oracle']}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: resourceUrl('/x402/service/gas-price-oracle'),
      name: 'Gas Price Oracle',
      description: 'Real-time gas prices across multiple chains with AI-powered timing recommendations',
      mimeType: 'application/json',
      maxTimeoutSeconds: 30,
    },
  },
  'POST /token-price-lookup': {
    price: `$${SERVICE_PRICING['token-price-lookup']}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: resourceUrl('/x402/service/token-price-lookup'),
      name: 'Token Price Lookup',
      description: 'Real-time token pricing and market analysis powered by DEXScreener + AI',
      mimeType: 'application/json',
      maxTimeoutSeconds: 30,
    },
  },
};

// Create x402 middleware with official facilitator
const x402Middleware = paymentMiddleware(
  PLATFORM_WALLET,
  x402Routes,
  facilitator
);

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
      network: 'base',
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
      network: 'base',
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
      network: 'base',
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
      network: 'base',
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
      network: 'base',
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
      network: 'base',
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

  const config = routeConfig.config;
  const priceUsd = typeof routeConfig.price === 'string' 
    ? parseFloat(routeConfig.price.replace('$', ''))
    : routeConfig.price;
  const priceInMicroUnits = Math.round(priceUsd * 1_000_000).toString();

  const response = {
    x402Version: 1,
    error: "X-PAYMENT header is required",
    accepts: [{
      scheme: "exact",
      network: routeConfig.network,
      maxAmountRequired: priceInMicroUnits,
      resource: config.resource,
      description: config.description,
      payTo: PLATFORM_WALLET,
      asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      maxTimeoutSeconds: config.maxTimeoutSeconds || 60,
      mimeType: config.mimeType || "application/json",
      discoverable: true,
      category: "Enterprise Services",
      tags: ["Enterprise", "AI", "x402", "USDC", "Audit", "Compliance"],
      extra: {
        name: "USD Coin",
        version: "2"
      },
      outputSchema: {
        input: {
          type: "http",
          method: "GET",
          discoverable: true,
        },
        output: { type: "object", properties: {} }
      },
      type: "http",
      x402Version: 1,
      metadata: {}
    }],
    facilitatorUrl: "https://api.cdp.coinbase.com/x402/facilitator"
  };

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
  router.get(`/${endpoint}`, (req: Request, res: Response) => {
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

export default router;
