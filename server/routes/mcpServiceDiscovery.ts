import { Router, Request, Response } from "express";
import { getCanonicalServices, getCanonicalServiceCount } from "../utils/serviceCount";

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
// SOURCE: getCanonicalServices() from serviceCount.ts (same source as tools/list)
// This guarantees /mcp/services and tools/list always serve identical IDs and prices.
router.get("/mcp/services", async (req: Request, res: Response) => {
  try {
    const baseUrl = getBaseUrl();
    const canonicalServices = getCanonicalServices();

    // Transform canonical OpenAPI-sourced services to MCP discovery format.
    // Using the same getCanonicalServices() root as tools/list ensures zero drift.
    const services = canonicalServices.map(entry => ({
      id: entry.id,
      name: entry.name,
      description: entry.description,
      category: entry.category,
      pricing: {
        model: "pay-per-use",
        amount: entry.priceUsd,
        currency: "USD"
      },
      // CANONICAL ENDPOINT: /x402/{serviceId} (verified working in production)
      endpoint: `${baseUrl}${entry.endpoint}`,
      protocol: "x402",
      inputSchema: entry.inputSchema ?? {},
      // Tags from the OpenAPI spec serve as capabilities
      capabilities: entry.tags,
      featured: entry.featured,
      paymentOptions: ["x402-crypto", "stripe-fiat"],
    }));

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

    const serviceCount = getCanonicalServiceCount();

    // MCP-compatible response format
    res.json({
      protocol: "x402",
      version: 2,
      provider: {
        name: "Coin Railz",
        description: `Universal payment infrastructure for AI agents — ${serviceCount} x402 micropayment services spanning crypto analytics, DeFi, satellite data (NASA/ESA), IoT/DePIN, AI inference, and prediction markets. Crypto (x402), Fiat (Stripe), and FREE wallet provisioning for autonomous agents.`,
        url: baseUrl,
        facilitator: "https://facilitator.cdp.coinbase.com",
        cloudflareGateway: "https://coinrailz-x402-gateway.coinrailz.workers.dev",
        mcpPaymentsKit: {
          version: "1.2.0",
          description: "Single-call checkout endpoint for AI agents - Stripe-first with x402 fallback. Credit refund on fulfillment failure.",
          checkoutEndpoint: `${baseUrl}/api/mcp/payments/checkout`,
          servicesEndpoint: `${baseUrl}/api/mcp/payments/services`,
          healthEndpoint: `${baseUrl}/api/mcp/payments/health`,
          supportedMethods: ["stripe", "x402"],
          testModeSupported: true,
          idempotencySupported: true,
          fulfillmentGuarantee: "credit_refund_on_failure"
        }
      },
      services: services,
      totalServices: services.length,
      categories: categoryCounts,
      paymentMethods: ["x402-erc20-usdc", "stripe-fiat"],
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
    'sdk-payments': 'SDK Payments',
    'satellite-intelligence': 'Satellite Intelligence',
    'iot-depin': 'IoT & DePIN',
    'ai-services': 'AI Services',
    'rwa-tokenization': 'RWA & Tokenization',
  };
  return names[id] || id;
}

// Service detail endpoint (MCP-compatible) — sourced from canonical OpenAPI spec
router.get("/mcp/services/:serviceId", async (req: Request, res: Response) => {
  try {
    const { serviceId } = req.params;
    const baseUrl = getBaseUrl();

    const canonicalServices = getCanonicalServices();
    const service = canonicalServices.find(s => s.id === serviceId);

    if (!service) {
      return res.status(404).json({ error: "Service not found", serviceId });
    }

    res.json({
      id: service.id,
      name: service.name,
      description: service.description,
      category: service.category,
      endpoint: `${baseUrl}${service.endpoint}`,
      protocol: "x402",
      pricing: {
        model: "pay-per-use",
        amount: service.priceUsd,
        currency: "USD"
      },
      facilitator: "https://facilitator.cdp.coinbase.com",
      paymentToken: {
        network: "base",
        address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        symbol: "USDC",
        decimals: 6
      },
      inputSchema: service.inputSchema ?? {},
      capabilities: service.tags,
      featured: service.featured,
    });
  } catch (error: any) {
    console.error('MCP service detail error:', error);
    res.status(500).json({ error: "Failed to retrieve service details", message: error.message });
  }
});

export default router;
