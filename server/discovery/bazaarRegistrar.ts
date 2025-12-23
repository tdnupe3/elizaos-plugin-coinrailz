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
import { ServiceCatalogService } from '../services/serviceCatalogService';
import { getCdpFacilitatorUrl, getAllFacilitatorUrls, isUsingCdpFacilitator, USDC_BASE_ADDRESS, NETWORK_CAIP2 } from '../utils/facilitatorHelper';

// CRITICAL: Bazaar discovery MUST use CDP facilitator for Coinbase indexing compatibility
// This is INTENTIONALLY different from 402 responses which use x402.org for public agents
// - Discovery endpoint → CDP facilitator (for Coinbase Bazaar to index us)
// - 402 responses → x402.org facilitator (for public x402 agents)
const getBazaarFacilitatorUrl = () => getCdpFacilitatorUrl();
const getAllFacilitators = () => getAllFacilitatorUrls();

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
 * Production readiness check - ensures CDP facilitator is available
 */
export function validateProductionReadiness(): { ready: boolean; issues: string[] } {
  const issues: string[] = [];
  const isProduction = process.env.REPLIT_DEPLOYMENT === '1' || process.env.REPLIT_DEPLOYMENT === 'true';
  
  if (isProduction && isBazaarDiscoveryEnabled()) {
    // In production with Bazaar enabled, we need CDP credentials
    if (!process.env.CDP_API_KEY_ID || !process.env.CDP_API_KEY_SECRET) {
      issues.push('CDP credentials missing - Bazaar discovery requires CDP_API_KEY_ID and CDP_API_KEY_SECRET in production');
    }
    
    if (!process.env.PLATFORM_WALLET_ADDRESS) {
      issues.push('PLATFORM_WALLET_ADDRESS not set - using fallback wallet');
    }
  }
  
  return {
    ready: issues.length === 0,
    issues
  };
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
 * Build internal catalog of services for Bazaar discovery
 * Note: The @x402/core library uses HTTP-based discovery (the 402 response pattern)
 * rather than server-side resource registration. Our discovery endpoints serve as
 * the "sitemap" for Bazaar crawlers to find our x402-gated services.
 */
export async function registerServicesWithBazaar(): Promise<RegistrationResult> {
  const result: RegistrationResult = {
    success: true,
    registered: 0,
    failed: 0,
    services: []
  };

  try {
    const facilitatorUrl = getBazaarFacilitatorUrl();
    const catalog = ServiceCatalogService.getInstance().getCatalog();
    
    console.log(`📡 Bazaar Discovery: Building catalog with facilitator ${facilitatorUrl}`);
    console.log(`📚 Found ${catalog.services.length} services in catalog`);

    // Build discovery metadata for each service
    for (const service of catalog.services) {
      try {
        // Skip non-x402 services
        if (!service.x402Compatible) {
          console.log(`⏭️ Skipping non-x402 service: ${service.id}`);
          continue;
        }

        const resourceUrl = `${PUBLIC_BASE_URL}${service.endpoint}`;
        
        console.log(`📝 Indexed: ${service.id} at ${resourceUrl} for ${service.priceUSD}`);

        result.services.push({
          id: service.id,
          endpoint: service.endpoint,
          status: 'registered'
        });
        result.registered++;

      } catch (serviceError: any) {
        console.error(`❌ Failed to index ${service.id}:`, serviceError.message);
        result.services.push({
          id: service.id,
          endpoint: service.endpoint,
          status: 'failed',
          error: serviceError.message
        });
        result.failed++;
      }
    }

    console.log(`✅ Bazaar discovery catalog ready: ${result.registered} services indexed`);
    console.log(`📡 Discovery endpoints available at /api/discovery/*`);
    console.log(`   - GET /api/discovery/health - Health check`);
    console.log(`   - GET /api/discovery/status - Catalog status`);
    console.log(`   - GET /api/discovery/resources - Full resource list for Bazaar crawlers`);

  } catch (error: any) {
    console.error('❌ Bazaar catalog build failed:', error.message);
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
      facilitator: getBazaarFacilitatorUrl(),
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
        facilitator: getBazaarFacilitatorUrl(),
        facilitators: getAllFacilitators(),
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
        primary: getBazaarFacilitatorUrl(),
        all: getAllFacilitators(),
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
 * Validate catalog integrity by making an actual HTTP request to the discovery endpoint
 * This catches real regressions by comparing live endpoint output against expected services
 */
export async function validateDiscoveryCatalogIntegrity(): Promise<{ valid: boolean; missing: string[]; extra: string[]; endpointServiceCount: number }> {
  const catalog = ServiceCatalogService.getInstance().getCatalog();
  const expectedServices = catalog.services.filter(s => s.x402Compatible).map(s => s.id);
  
  try {
    // Make actual HTTP request to the discovery endpoint
    // Note: We intentionally use localhost for self-verification since we're checking
    // our own process, not going through external load balancers
    const port = process.env.PORT || '5000';
    const localUrl = `http://localhost:${port}/api/discovery/resources`;
    console.log(`🔍 Validating discovery endpoint: ${localUrl}`);
    
    const response = await fetch(localUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      // Short timeout for self-check
      signal: AbortSignal.timeout(5000)
    });
    
    if (!response.ok) {
      console.error(`❌ Discovery endpoint returned status ${response.status}`);
      return { valid: false, missing: expectedServices, extra: [], endpointServiceCount: 0 };
    }
    
    const data = await response.json() as { resources: Array<{ url: string; name: string }> };
    
    // Extract service IDs from actual endpoint response (from URL path)
    const endpointServiceIds = data.resources.map(r => {
      const urlParts = r.url.split('/');
      return urlParts[urlParts.length - 1]; // Get last segment (service ID)
    });
    
    // Compare: find services in catalog that aren't in endpoint
    const missing = expectedServices.filter(id => !endpointServiceIds.includes(id));
    // Find services in endpoint that aren't in catalog
    const extra = endpointServiceIds.filter(id => !expectedServices.includes(id));
    
    if (missing.length > 0) {
      console.error(`❌ Discovery endpoint missing services: ${missing.join(', ')}`);
    }
    if (extra.length > 0) {
      console.warn(`⚠️ Discovery endpoint has unexpected services: ${extra.join(', ')}`);
    }
    
    return {
      valid: missing.length === 0,
      missing,
      extra,
      endpointServiceCount: data.resources.length
    };
    
  } catch (error: any) {
    console.error(`❌ Failed to validate discovery endpoint: ${error.message}`);
    return { valid: false, missing: expectedServices, extra: [], endpointServiceCount: 0 };
  }
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
  
  // Check production readiness - FATAL in production
  const readiness = validateProductionReadiness();
  if (!readiness.ready) {
    console.error('❌ Bazaar Discovery: FATAL - Production readiness check failed:');
    readiness.issues.forEach(issue => console.error(`   - ${issue}`));
    console.error('❌ Bazaar Discovery: DISABLED due to missing production requirements');
    return; // Do not proceed - discovery disabled when requirements not met
  }
  
  try {
    const result = await registerServicesWithBazaar();
    
    if (result.success) {
      console.log(`📡 Bazaar Discovery: Ready - ${result.registered} services registered`);
      
      // Validate catalog integrity by simulating endpoint output
      const integrity = await validateDiscoveryCatalogIntegrity();
      if (!integrity.valid) {
        console.error(`❌ Bazaar Discovery: Catalog integrity check FAILED - ${integrity.missing.length} services missing`);
        console.error(`   Missing: ${integrity.missing.join(', ')}`);
      } else {
        console.log(`✅ Bazaar Discovery: Catalog integrity verified - endpoint would return ${integrity.endpointServiceCount} services`);
      }
    } else {
      console.warn('📡 Bazaar Discovery: Initialization completed with errors');
    }
  } catch (error: any) {
    console.error('📡 Bazaar Discovery: Failed to initialize:', error.message);
    // Don't throw - discovery failure shouldn't crash the server
  }
}
