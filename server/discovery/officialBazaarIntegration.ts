/**
 * Official Coinbase Bazaar Integration
 * 
 * Uses the official @x402/extensions/bazaar SDK format to register services
 * with the Coinbase facilitator for proper discovery indexing.
 * 
 * Format based on @x402/extensions/bazaar v2.0.0:
 * - QueryDiscoveryInfo for GET/HEAD/DELETE methods
 * - BodyDiscoveryInfo for POST/PUT/PATCH methods
 */

import { Router, Request, Response, NextFunction } from 'express';
import { ServiceCatalogService, CatalogService } from '../services/serviceCatalogService';
import { getCdpFacilitatorUrl, USDC_BASE_ADDRESS, NETWORK_CAIP2 } from '../utils/facilitatorHelper';

const PLATFORM_WALLET = (process.env.PLATFORM_WALLET_ADDRESS || '0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91') as `0x${string}`;
const PUBLIC_BASE_URL = process.env.PUBLIC_URL || 
  (process.env.REPLIT_DEPLOYMENT === '1' ? 'https://coinrailz.com' : 
   process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS}` : 'http://localhost:5000');

interface QueryDiscoveryInfo {
  input: {
    type: "http";
    method: "GET" | "HEAD" | "DELETE";
    queryParams?: Record<string, unknown>;
    headers?: Record<string, string>;
  };
  output?: {
    type?: string;
    format?: string;
    example?: unknown;
  };
}

interface BodyDiscoveryInfo {
  input: {
    type: "http";
    method: "POST" | "PUT" | "PATCH";
    bodyType: "json" | "form-data" | "text";
    body: Record<string, unknown>;
    queryParams?: Record<string, unknown>;
    headers?: Record<string, string>;
  };
  output?: {
    type?: string;
    format?: string;
    example?: unknown;
  };
}

type BazaarDiscoveryInfo = QueryDiscoveryInfo | BodyDiscoveryInfo;

function parsePriceToMicros(priceUSD: string): number {
  const match = priceUSD.match(/\$?([\d.]+)/);
  if (!match) return 100000;
  const dollars = parseFloat(match[1]);
  return Math.round(dollars * 1_000_000);
}

function generateExampleOutput(service: CatalogService): Record<string, unknown> {
  const baseOutput: Record<string, unknown> = {
    success: true,
    timestamp: new Date().toISOString(),
    service: service.id
  };

  switch (service.category) {
    case 'Trading Intelligence':
      return { ...baseOutput, signal: 'BUY', confidence: 0.85, analysis: 'Bullish momentum detected' };
    case 'Market Intelligence':
      return { ...baseOutput, price: 3200.50, change24h: 2.5, volume: 1500000 };
    case 'Execution & Infrastructure':
      return { ...baseOutput, gasPrice: { low: 10, medium: 15, high: 25 }, chain: 'base' };
    case 'Real Estate':
      return { ...baseOutput, valuation: 450000, confidence: 0.92, comparables: 5 };
    case 'Banking/Finance':
      return { ...baseOutput, creditScore: 720, riskLevel: 'low', recommendation: 'approve' };
    case 'Prediction Markets':
      return { ...baseOutput, marketId: 'election-2024', odds: { yes: 0.55, no: 0.45 } };
    default:
      return { ...baseOutput, result: 'Service executed successfully' };
  }
}

function generateExampleBody(service: CatalogService): Record<string, unknown> {
  if (service.id.includes('balance') || service.id.includes('wallet') || service.id.includes('risk')) {
    return {
      walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f7DEAD',
      chains: ['ethereum', 'base', 'polygon']
    };
  }

  if (service.id.includes('token') || service.id.includes('price')) {
    return {
      tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      chain: 'base'
    };
  }

  if (service.id.includes('gas')) {
    return {
      chains: ['ethereum', 'base', 'polygon', 'arbitrum']
    };
  }

  if (service.id.includes('trade') || service.id.includes('signal')) {
    return {
      pair: 'ETH/USDC',
      timeframe: '1h'
    };
  }

  return {
    query: 'example query parameter'
  };
}

export function buildBazaarDiscoveryMetadata(service: CatalogService, method: 'GET' | 'POST' = 'POST'): BazaarDiscoveryInfo {
  const exampleOutput = generateExampleOutput(service);
  
  if (method === 'GET') {
    return {
      input: {
        type: "http",
        method: "GET",
        queryParams: {},
        headers: {
          'Accept': 'application/json',
          'X-API-KEY': '<your-api-key> (optional, for prepaid credits)'
        }
      },
      output: {
        type: "application/json",
        format: "json",
        example: exampleOutput
      }
    } as QueryDiscoveryInfo;
  }
  
  return {
    input: {
      type: "http",
      method: "POST",
      bodyType: "json",
      body: generateExampleBody(service),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    },
    output: {
      type: "application/json",
      format: "json",
      example: exampleOutput
    }
  } as BodyDiscoveryInfo;
}

export function generate402ResponseWithBazaar(
  service: CatalogService,
  req: Request
): Record<string, unknown> {
  const priceInMicro = parsePriceToMicros(service.priceUSD);
  const facilitatorUrl = getCdpFacilitatorUrl();
  const resourceUrl = `${PUBLIC_BASE_URL}${service.endpoint}`;

  // Use GET as canonical method: Bazaar's crawler probes via GET/HEAD, and all services
  // registered in x402MicroserviceRoutesV2 have full GET handler implementations.
  // Advertising GET as canonical aligns with how the Bazaar probe actually works.
  const canonicalMethod: 'GET' | 'POST' = 'GET';
  const bazaarMetadata = buildBazaarDiscoveryMetadata(service, canonicalMethod);

  return {
    x402Version: 2,
    accepts: [{
      scheme: 'exact',
      network: NETWORK_CAIP2,
      maxAmountRequired: String(priceInMicro),
      resource: resourceUrl,
      description: service.description,
      payTo: PLATFORM_WALLET,
      asset: USDC_BASE_ADDRESS,
      maxTimeoutSeconds: 900,
      extensions: {
        bazaar: bazaarMetadata
      }
    }],
    facilitatorUrl,
    error: 'Payment required',
    message: `This service costs ${service.priceUSD}. Pay with USDC on Base (advertised via 402 accepts[]) or Arbitrum One (backend-verified out-of-band: submit txHash with network=eip155:42161 in X-PAYMENT header).`
  };
}

export function buildAllRoutesConfig(): Record<string, { method: string; bazaarMetadata: BazaarDiscoveryInfo }> {
  const catalog = ServiceCatalogService.getInstance().getCatalog();
  const routes: Record<string, { method: string; bazaarMetadata: BazaarDiscoveryInfo }> = {};

  for (const service of catalog.services) {
    if (!service.x402Compatible) continue;
    
    routes[`POST ${service.endpoint}`] = {
      method: 'POST',
      bazaarMetadata: buildBazaarDiscoveryMetadata(service, 'POST')
    };
    
    routes[`GET ${service.endpoint}`] = {
      method: 'GET',
      bazaarMetadata: buildBazaarDiscoveryMetadata(service, 'GET')
    };
  }

  return routes;
}

export function createOfficialBazaarRouter(): Router {
  const router = Router();

  router.get('/bazaar/routes', (req: Request, res: Response) => {
    const routes = buildAllRoutesConfig();
    res.json({
      success: true,
      totalRoutes: Object.keys(routes).length,
      facilitatorUrl: getCdpFacilitatorUrl(),
      specVersion: '@x402/extensions/bazaar v2.12.0',
      routes
    });
  });

  router.get('/bazaar/service/:serviceId', (req: Request, res: Response) => {
    const { serviceId } = req.params;
    const catalog = ServiceCatalogService.getInstance().getCatalog();
    const service = catalog.services.find(s => s.id === serviceId || s.slug === serviceId);
    
    if (!service) {
      res.status(404).json({ error: 'Service not found' });
      return;
    }

    const getMetadata = buildBazaarDiscoveryMetadata(service, 'GET');
    const postMetadata = buildBazaarDiscoveryMetadata(service, 'POST');
    
    res.json({
      success: true,
      service: {
        id: service.id,
        name: service.name,
        endpoint: service.endpoint,
        price: service.priceUSD
      },
      bazaarMetadata: {
        GET: getMetadata,
        POST: postMetadata
      }
    });
  });

  router.get('/bazaar/integration-status', (req: Request, res: Response) => {
    const catalog = ServiceCatalogService.getInstance().getCatalog();
    const x402Services = catalog.services.filter(s => s.x402Compatible);
    
    res.json({
      success: true,
      status: 'active',
      integrationVersion: '2.12.0',
      sdkPackages: {
        '@x402/core': '2.12.0',
        '@x402/express': '2.12.0',
        '@x402/extensions': '2.12.0',
        '@x402/evm': '2.12.0',
        '@x402/fetch': '2.12.0',
        '@x402/svm': '2.12.0'
      },
      specCompliance: {
        format: '@x402/extensions/bazaar DiscoveryInfo',
        fields: ['input.type', 'input.method', 'input.bodyType', 'input.body', 'output.type', 'output.format', 'output.example']
      },
      facilitatorUrl: getCdpFacilitatorUrl(),
      facilitators: ["https://api.cdp.coinbase.com/platform/v2/x402", "https://dexter.cash"],
      walletProviders: ["coinbase-cdp", "moonpay-agents", "any-evm"],
      totalServices: x402Services.length,
      servicesWithBazaarMetadata: x402Services.length,
      discoveryEndpoints: {
        resources: '/api/discovery/resources',
        bazaarRoutes: '/api/bazaar/routes',
        health: '/api/discovery/health'
      },
      note: 'All 402 responses include spec-compliant extensions.bazaar metadata for facilitator indexing'
    });
  });

  router.get('/bazaar/sample-402/:serviceId', (req: Request, res: Response) => {
    const { serviceId } = req.params;
    const catalog = ServiceCatalogService.getInstance().getCatalog();
    const service = catalog.services.find(s => s.id === serviceId || s.slug === serviceId);
    
    if (!service) {
      res.status(404).json({ error: 'Service not found' });
      return;
    }

    const sample402 = generate402ResponseWithBazaar(service, req);
    res.json({
      description: 'This is a sample 402 response with spec-compliant Bazaar metadata',
      sample402Response: sample402
    });
  });

  return router;
}

export async function initializeOfficialBazaarIntegration(): Promise<void> {
  console.log('📡 Initializing Official Bazaar SDK Integration...');
  
  const routes = buildAllRoutesConfig();
  const routeCount = Object.keys(routes).length;
  
  console.log(`✅ Built ${routeCount} route configs with Bazaar discovery metadata`);
  console.log(`📡 Facilitator: ${getCdpFacilitatorUrl()}`);
  console.log(`💰 All routes include extensions.bazaar for facilitator indexing`);
  console.log('');
  console.log('🔑 How this works:');
  console.log('   1. When a client hits a gated endpoint, they get a 402 response');
  console.log('   2. The 402 response now includes extensions.bazaar metadata');
  console.log('   3. The facilitator extracts this metadata when processing payments');
  console.log('   4. Services become indexed in the Coinbase Bazaar discovery layer');
  console.log('');
  console.log('✅ Official Bazaar SDK Integration ready');
}
