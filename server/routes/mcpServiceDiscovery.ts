import { Router, Request, Response } from "express";
import { ServiceCatalogService } from "../services/serviceCatalogService";
import { SERVICE_PRICING_USD, isServiceName, ServiceName } from "../../shared/pricing";

const router = Router();

// Helper to get production-ready base URL
function getBaseUrl(): string {
  // Production deployment always uses coinrailz.com
  if (process.env.REPLIT_DEPLOYMENT === '1') {
    return 'https://coinrailz.com';
  }
  // Development fallback
  return process.env.PUBLIC_BASE_URL || 'http://localhost:5000';
}

// MCP-compatible service discovery endpoint for AI agents
// Based on Model Context Protocol specification for service discovery
// NOW USES: ServiceCatalogService for authoritative 44-service list
router.get("/mcp/services", async (req: Request, res: Response) => {
  try {
    const baseUrl = getBaseUrl();
    const catalogService = ServiceCatalogService.getInstance();
    const fullCatalog = catalogService.getCatalog();

    // Transform catalog entries to MCP format
    // Filter to only x402-compatible services
    const services = fullCatalog.services
      .filter(entry => entry.x402Compatible)
      .map(entry => {
        // Get price from canonical source
        const priceValue = isServiceName(entry.id) 
          ? SERVICE_PRICING_USD[entry.id as ServiceName]
          : 0;

        return {
          id: entry.id,
          name: entry.name,
          description: entry.description,
          category: entry.category,
          pricing: {
            model: "pay-per-use",
            amount: priceValue,
            currency: "USD"
          },
          // CANONICAL ENDPOINT: /x402/{serviceId} (verified working in production)
          endpoint: `${baseUrl}${entry.endpoint}`,
          protocol: "x402",
          inputSchema: getInputSchema(entry.id),
          capabilities: entry.capabilities,
          network: entry.network,
          stripeCompatible: entry.stripeCompatible,
          paymentOptions: ["x402-crypto", "stripe-fiat"] // credits removed until implemented
        };
      });

    // Group by category for convenience
    const categoryGroups = services.reduce((acc, service) => {
      const cat = service.category;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(service);
      return acc;
    }, {} as Record<string, typeof services>);

    const categoryCounts = Object.entries(categoryGroups).map(([id, svcs]) => ({
      id,
      name: formatCategoryName(id),
      count: svcs.length
    }));

    // MCP-compatible response format
    res.json({
      protocol: "x402",
      version: 2,
      provider: {
        name: "Coin Railz",
        description: "Universal payment infrastructure for AI agents - Crypto (x402), Fiat (Stripe), Credits, and FREE wallet provisioning for autonomous agents",
        url: baseUrl,
        facilitator: "https://facilitator.cdp.coinbase.com",
        cloudflareGateway: "https://coinrailz-x402-gateway.coinrailz.workers.dev",
        mcpPaymentsKit: {
          version: "1.2.0",
          description: "Single-call checkout endpoint for AI agents - Stripe-first with x402 fallback. Credit refund on fulfillment failure.",
          checkoutEndpoint: `${baseUrl}/api/mcp/payments/checkout`,
          servicesEndpoint: `${baseUrl}/api/mcp/payments/services`,
          healthEndpoint: `${baseUrl}/api/mcp/payments/health`,
          supportedMethods: ["stripe", "x402"], // credits coming soon
          testModeSupported: true,
          idempotencySupported: true,
          fulfillmentGuarantee: "credit_refund_on_failure"
        }
      },
      services: services,
      totalServices: services.length,
      categories: categoryCounts,
      paymentMethods: ["x402-erc20-usdc", "stripe-fiat"], // credits removed until implemented
      paymentCapabilities: {
        crypto: { protocol: "x402", networks: ["base", "ethereum", "polygon", "arbitrum", "optimism", "bnb", "solana"], token: "USDC" },
        fiat: { provider: "stripe", methods: ["card", "bank"] },
        credits: { enabled: false, description: "Pre-purchased credit bundles (coming soon)" },
        walletProvisioning: { description: "FREE instant wallet creation for AI agents", endpoint: "/api/agent-wallet/create" }
      },
      supportedNetworks: ["base", "base-sepolia", "ethereum", "polygon", "arbitrum", "optimism", "bnb", "solana"],
      documentation: `${baseUrl}/docs/x402`,
      catalogUrl: `${baseUrl}/api/x402/catalog`,
      discoveryManifests: {
        webmcp: `${baseUrl}/.well-known/webmcp.json`,
        awi: `${baseUrl}/.well-known/awi.json`,
        x402: `${baseUrl}/.well-known/x402.json`,
        agentCard: `${baseUrl}/.well-known/agent-card.json`,
        mpp: `${baseUrl}/.well-known/mpp.json`,
        openapi: `${baseUrl}/openapi.json`,
        integrationGuide: `${baseUrl}/mcp-integration-guide`,
        mcpIntegration: `${baseUrl}/.well-known/mcp-integration.json`
      }
    });
  } catch (error: any) {
    console.error('MCP service discovery error:', error);
    res.status(500).json({ error: "Failed to retrieve service directory", message: error.message });
  }
});

// Helper: Format category name for display
function formatCategoryName(id: string): string {
  const names: Record<string, string> = {
    'discovery': 'Discovery & Testing',
    'trading-intelligence': 'Trading Intelligence',
    'execution': 'Execution & Infrastructure',
    'premium': 'Premium Enterprise',
    'real-estate': 'Real Estate',
    'banking': 'Banking & Finance',
    'trading': 'Trading & Investment',
    'market-intelligence': 'Market Intelligence',
    'prediction-markets': 'Prediction Markets',
    'traditional-markets': 'Traditional Markets',
    'solana-defi': 'Solana DeFi',
    'sdk-payments': 'SDK Payments'
  };
  return names[id] || id;
}

// Helper: Get input schema for a service (simplified for MCP)
function getInputSchema(serviceId: string): Record<string, any> {
  const schemas: Record<string, Record<string, any>> = {
    'multi-chain-balance': {
      walletAddress: { type: "string", required: true, description: "Wallet address to check" },
      chains: { type: "array", required: false, description: "Chains to check (default: all)" }
    },
    'gas-price-oracle': {
      chains: { type: "array", required: false, description: "Chains to check (default: all)" }
    },
    'token-price': {
      tokenAddress: { type: "string", required: true },
      chain: { type: "string", required: true }
    },
    'contract-scan': {
      contractAddress: { type: "string", required: true },
      chain: { type: "string", required: true }
    },
    'wallet-risk': {
      walletAddress: { type: "string", required: true },
      chain: { type: "string", required: true }
    },
    'trade-signals': {
      token: { type: "string", required: false, default: "BTC/USDT" },
      timeframe: { type: "string", required: false, default: "15m" }
    },
    'trending-tokens': {
      timeframe: { type: "string", required: false, default: "24h" },
      chain: { type: "string", required: false }
    },
    'whale-alerts': {
      chains: { type: "array", required: false },
      minValueUsd: { type: "number", required: false }
    },
    'instant-agent-wallet': {
      agentId: { type: "string", required: true },
      description: { type: "string", required: false }
    },
    'verified-agent-identity': {
      agentId: { type: "string", required: true },
      walletAddress: { type: "string", required: true }
    },
    'seamless-chain-bridge': {
      fromChain: { type: "string", required: true },
      toChain: { type: "string", required: true },
      amount: { type: "string", required: true }
    },
    'solana-yield-finder': {
      asset: { type: "string", required: false, description: "Token symbol (SOL, USDC, etc.)" },
      minApy: { type: "number", required: false, description: "Minimum APY filter" }
    }
  };
  return schemas[serviceId] || {};
}

// Service detail endpoint (MCP-compatible)
router.get("/mcp/services/:serviceId", async (req: Request, res: Response) => {
  try {
    const { serviceId } = req.params;
    const baseUrl = getBaseUrl();
    
    // Get service from catalog
    const catalogService = ServiceCatalogService.getInstance();
    const fullCatalog = catalogService.getCatalog();
    const service = fullCatalog.services.find(s => s.id === serviceId);
    
    if (!service) {
      return res.status(404).json({ error: "Service not found", serviceId });
    }

    // Get price from canonical source
    const priceValue = isServiceName(serviceId) 
      ? SERVICE_PRICING_USD[serviceId as ServiceName]
      : 0;

    res.json({
      id: serviceId,
      name: service.name,
      description: service.description,
      category: service.category,
      endpoint: `${baseUrl}${service.endpoint}`,
      protocol: "x402",
      pricing: {
        model: "pay-per-use",
        amount: priceValue,
        currency: "USD"
      },
      facilitator: "https://facilitator.cdp.coinbase.com",
      paymentToken: {
        network: "base",
        address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        symbol: "USDC",
        decimals: 6
      },
      inputSchema: getInputSchema(serviceId),
      capabilities: service.capabilities,
      x402Compatible: service.x402Compatible,
      stripeCompatible: service.stripeCompatible
    });
  } catch (error: any) {
    console.error('MCP service detail error:', error);
    res.status(500).json({ error: "Failed to retrieve service details", message: error.message });
  }
});

export default router;
