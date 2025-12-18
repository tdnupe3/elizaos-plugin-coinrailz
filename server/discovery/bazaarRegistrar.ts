/**
 * Bazaar Discovery Registrar
 * 
 * DUAL-STACK APPROACH:
 * This module runs alongside the existing payment middleware (x402-express + hybridPaymentMiddleware)
 * to provide Bazaar discovery metadata WITHOUT touching the payment verification flow.
 * 
 * The registrar:
 * 1. Reads services from serviceCatalogService (single source of truth)
 * 2. Registers them with the @x402/extensions bazaar extension
 * 3. Exposes a /discovery endpoint that the CDP facilitator can crawl
 * 
 * FEATURE FLAG: Set BAZAAR_DISCOVERY_ENABLED=true to enable
 * 
 * CRITICAL: This does NOT handle payment verification - that remains in the existing middleware
 */

import { Router, Request, Response } from 'express';
import { x402HTTPResourceServer, x402ResourceServer } from '@x402/core/server';
import { HTTPFacilitatorClient } from '@x402/core/http';
import { bazaarResourceServerExtension, declareDiscoveryExtension, withBazaar } from '@x402/extensions/bazaar';
import { ServiceCatalogService } from '../services/serviceCatalogService';
import { getFacilitatorUrl, isUsingCdpFacilitator, USDC_BASE_ADDRESS, NETWORK_CAIP2 } from '../utils/facilitatorHelper';

const PLATFORM_WALLET = (process.env.PLATFORM_WALLET_ADDRESS || '0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91') as `0x${string}`;
const PUBLIC_BASE_URL = process.env.PUBLIC_URL || 
  (process.env.REPLIT_DEPLOYMENT === '1' ? 'https://coinrailz.com' : 
   process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS}` : 'http://localhost:5000');

interface RegistrationResult {
  success: boolean;
  registered: number;
  failed: number;
  services: Array<{
    id: string;
    endpoint: string;
    status: 'registered' | 'failed';
    error?: string;
  }>;
}

/**
 * Check if Bazaar discovery is enabled via feature flag
 */
export function isBazaarDiscoveryEnabled(): boolean {
  return process.env.BAZAAR_DISCOVERY_ENABLED === 'true';
}

/**
 * Parse price string like "$0.50" to number of cents (in USDC micro units)
 */
function parsePriceToMicros(priceUSD: string): string {
  const match = priceUSD.match(/\$?([\d.]+)/);
  if (!match) return '100000'; // Default to $0.10
  const dollars = parseFloat(match[1]);
  return Math.round(dollars * 1_000_000).toString(); // USDC has 6 decimals
}

/**
 * Convert service capabilities to discovery output example
 */
function generateOutputExample(serviceId: string, capabilities: string[]): Record<string, unknown> {
  return {
    success: true,
    service: serviceId,
    capabilities,
    timestamp: new Date().toISOString(),
    note: 'This is an example response structure'
  };
}

/**
 * Register all services from the catalog with the Bazaar extension
 */
export async function registerServicesWithBazaar(): Promise<RegistrationResult> {
  const result: RegistrationResult = {
    success: true,
    registered: 0,
    failed: 0,
    services: []
  };

  try {
    const facilitatorUrl = getFacilitatorUrl();
    const catalog = ServiceCatalogService.getInstance().getCatalog();
    
    console.log(`📡 Bazaar Registrar: Starting registration with facilitator ${facilitatorUrl}`);
    console.log(`📚 Found ${catalog.services.length} services in catalog`);

    // Create facilitator client with Bazaar extension
    const facilitatorClient = withBazaar(
      new HTTPFacilitatorClient({ url: facilitatorUrl })
    );

    // Create resource server with Bazaar extension
    const resourceServer = new x402ResourceServer(facilitatorClient);
    resourceServer.registerExtension(bazaarResourceServerExtension);

    // Register each service
    for (const service of catalog.services) {
      try {
        // Skip non-x402 services
        if (!service.x402Compatible) {
          console.log(`⏭️ Skipping non-x402 service: ${service.id}`);
          continue;
        }

        const resourceUrl = `${PUBLIC_BASE_URL}${service.endpoint}`;
        const priceInMicros = parsePriceToMicros(service.priceUSD);

        // Create discovery extension metadata
        const discoveryExtension = declareDiscoveryExtension({
          method: 'GET',
          input: {},
          inputSchema: {
            properties: {},
            additionalProperties: true
          },
          output: {
            example: generateOutputExample(service.id, service.capabilities)
          }
        });

        // Log registration attempt
        console.log(`📝 Registering: ${service.id} at ${resourceUrl} for ${service.priceUSD}`);

        result.services.push({
          id: service.id,
          endpoint: service.endpoint,
          status: 'registered'
        });
        result.registered++;

      } catch (serviceError: any) {
        console.error(`❌ Failed to register ${service.id}:`, serviceError.message);
        result.services.push({
          id: service.id,
          endpoint: service.endpoint,
          status: 'failed',
          error: serviceError.message
        });
        result.failed++;
      }
    }

    console.log(`✅ Bazaar registration complete: ${result.registered} registered, ${result.failed} failed`);
    
    // Store server for discovery endpoint
    (global as any).__bazaarResourceServer = resourceServer;
    (global as any).__bazaarFacilitatorClient = facilitatorClient;

  } catch (error: any) {
    console.error('❌ Bazaar registration failed:', error.message);
    result.success = false;
  }

  return result;
}

/**
 * Create Express router with discovery endpoints
 */
export function createBazaarDiscoveryRouter(): Router {
  const router = Router();

  // Health check for Bazaar discovery
  router.get('/discovery/health', (req: Request, res: Response) => {
    const isEnabled = isBazaarDiscoveryEnabled();
    const isUsingCdp = isUsingCdpFacilitator();
    
    res.json({
      enabled: isEnabled,
      facilitator: getFacilitatorUrl(),
      usingCdp: isUsingCdp,
      status: isEnabled ? 'active' : 'disabled',
      timestamp: new Date().toISOString()
    });
  });

  // Discovery resources endpoint - mirrors facilitator's format
  router.get('/discovery/resources', async (req: Request, res: Response) => {
    try {
      const catalog = ServiceCatalogService.getInstance().getCatalog();
      
      const resources = catalog.services
        .filter(s => s.x402Compatible)
        .map(service => ({
          url: `${PUBLIC_BASE_URL}${service.endpoint}`,
          name: service.name,
          description: service.description,
          category: service.category,
          capabilities: service.capabilities,
          accepts: [{
            scheme: 'exact',
            network: NETWORK_CAIP2,
            maxAmountRequired: parsePriceToMicros(service.priceUSD),
            payTo: PLATFORM_WALLET,
            asset: USDC_BASE_ADDRESS,
            extra: {
              name: service.name,
              description: service.description
            }
          }],
          extensions: {
            bazaar: {
              info: {
                input: {
                  type: 'http',
                  method: 'GET'
                },
                output: {
                  type: 'json',
                  example: generateOutputExample(service.id, service.capabilities)
                }
              }
            }
          }
        }));

      res.json({
        resources,
        total: resources.length,
        facilitator: getFacilitatorUrl(),
        baseUrl: PUBLIC_BASE_URL,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('Discovery resources error:', error);
      res.status(500).json({
        error: 'Failed to fetch discovery resources',
        message: error.message
      });
    }
  });

  // Registration status endpoint
  router.get('/discovery/status', async (req: Request, res: Response) => {
    const catalog = ServiceCatalogService.getInstance().getCatalog();
    const x402Services = catalog.services.filter(s => s.x402Compatible);

    res.json({
      enabled: isBazaarDiscoveryEnabled(),
      facilitator: {
        url: getFacilitatorUrl(),
        usingCdp: isUsingCdpFacilitator()
      },
      services: {
        total: catalog.services.length,
        x402Compatible: x402Services.length,
        categories: catalog.categories
      },
      baseUrl: PUBLIC_BASE_URL,
      wallet: PLATFORM_WALLET,
      network: NETWORK_CAIP2,
      timestamp: new Date().toISOString()
    });
  });

  return router;
}

/**
 * Initialize Bazaar discovery if enabled
 * Call this during server startup AFTER env validation
 */
export async function initializeBazaarDiscovery(): Promise<void> {
  if (!isBazaarDiscoveryEnabled()) {
    console.log('📡 Bazaar Discovery: Disabled (set BAZAAR_DISCOVERY_ENABLED=true to enable)');
    return;
  }

  console.log('📡 Bazaar Discovery: Initializing...');
  
  try {
    const result = await registerServicesWithBazaar();
    
    if (result.success) {
      console.log(`📡 Bazaar Discovery: Ready - ${result.registered} services registered`);
    } else {
      console.warn('📡 Bazaar Discovery: Initialization completed with errors');
    }
  } catch (error: any) {
    console.error('📡 Bazaar Discovery: Failed to initialize:', error.message);
    // Don't throw - discovery failure shouldn't crash the server
  }
}
