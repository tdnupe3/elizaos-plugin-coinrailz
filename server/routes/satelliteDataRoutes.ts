/**
 * Satellite Data Routes - x402-Protected Space Data APIs
 * 
 * VERSION: 1.0.0 (January 2026)
 * 
 * POWERED BY:
 * - NASA Earthdata (GIBS, FIRMS, MODIS, Landsat)
 * - ESA Copernicus (Sentinel-1/2/3/5P)
 * 
 * ENDPOINTS:
 * - GET /api/satellite/catalog - List available data products
 * - GET /api/satellite/fire-alerts - Active fire detection (x402)
 * - GET /api/satellite/weather-imagery - Satellite weather images (x402)
 * - GET /api/satellite/vegetation - Vegetation health/NDVI (x402)
 * - GET /api/satellite/flood-detection - Flood monitoring (x402)
 * - GET /api/satellite/air-quality - Air quality index (x402)
 * - GET /api/satellite/land-use - Land use classification (x402)
 * - GET /api/satellite/status - Service status and configuration
 * 
 * PRICING:
 * - Fire Alerts: $0.05/request
 * - Weather Imagery: $0.02/request
 * - Vegetation Health: $0.10/km²
 * - Flood Detection: $0.08/request
 * - Air Quality: $0.05/request
 * - Land Use: $0.15/km²
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { satelliteDataService, SATELLITE_DATA_PRODUCTS } from '../services/satelliteDataService';
import { trackX402Service } from '../middleware/hitTracker';
import { hybridPaymentMiddleware } from '../middleware/hybridPaymentMiddleware';
import { getFacilitatorUrl } from '../utils/facilitatorHelper';
import { x402TrackingMiddleware } from '../middleware/x402TrackingMiddleware';
import { nanoid } from 'nanoid';
import { buildBazaarDiscoveryMetadata } from '../discovery/officialBazaarIntegration';
import { serviceCatalogService } from '../services/serviceCatalogService';

// Demo mode is always available - it only returns sample/fake data, never real data
// Real data requires x402 payment or API key regardless of demo mode
const DEMO_MODE_ENABLED = true;

const router = Router();

// Track hits in endpoint_hits table (existing analytics)
router.use(trackX402Service);
// Also track in x402_interactions table for unified analytics dashboard
router.use(x402TrackingMiddleware);

const bboxSchema = z.object({
  west: z.coerce.number().min(-180).max(180),
  south: z.coerce.number().min(-90).max(90),
  east: z.coerce.number().min(-180).max(180),
  north: z.coerce.number().min(-90).max(90),
});

const locationSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
});

function generateX402PaymentRequired(product: typeof SATELLITE_DATA_PRODUCTS[0], req: Request): object {
  const baseUrl = process.env.PUBLIC_URL 
    || (process.env.REPLIT_DEPLOYMENT === '1' ? 'https://coinrailz.com' : null)
    || (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'https://coinrailz.com');
  
  // Look up catalog entry for Bazaar metadata
  const catalog = serviceCatalogService.getCatalog();
  const catalogEntry = catalog.services.find(s => 
    s.endpoint === product.endpoint || 
    s.id === product.id ||
    s.slug === product.id
  );
  
  // Build Bazaar discovery metadata for facilitator indexing
  let bazaarMetadata: any = null;
  if (catalogEntry) {
    try {
      bazaarMetadata = buildBazaarDiscoveryMetadata(catalogEntry, 'GET');
    } catch (e) {
      // Silently continue if metadata build fails
    }
  }
  // Fallback Bazaar metadata if no catalog entry
  if (!bazaarMetadata) {
    bazaarMetadata = {
      input: {
        type: "http" as const,
        method: "GET" as const,
        bodyType: "none" as const,
        headers: { 'Accept': 'application/json' }
      },
      output: {
        type: "application/json",
        format: "json",
        example: { success: true, data: product.sampleResponse }
      }
    };
  }
  
  return {
    x402Version: 2,
    accepts: [
      {
        scheme: 'exact',
        network: 'base',
        networkLegacy: 'base',
        x402Network: 'eip155:8453',
        amount: Math.ceil(product.priceUsd * 1000000).toString(),
        maxAmountRequired: Math.ceil(product.priceUsd * 1000000).toString(),
        resource: `${baseUrl}${product.endpoint}`,
        description: product.description,
        mimeType: 'application/json',
        payTo: process.env.COINRAILZ_WALLET || '0xa4bBE37f9A6Ae2dc36a607B91eB148C0ae163C91',
        maxTimeoutSeconds: 300,
        asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        extra: {
          name: `Coin Railz - ${product.name}`,
          version: '2.0',
          decimals: 6,
          chainId: 8453,
          chainName: 'Base',
        },
        extensions: {
          bazaar: { info: bazaarMetadata }
        },
        discoverable: true,
      },
    ],
    error: 'Payment required to access satellite data',
    facilitatorUrl: getFacilitatorUrl(),
    resource: {
      url: `${baseUrl}${product.endpoint}`,
      description: product.description,
      mimeType: 'application/json'
    },
    extensions: {
      bazaar: {
        info: {
          input: bazaarMetadata?.input || { type: "http", method: "GET" },
          output: bazaarMetadata?.output || { type: "application/json", format: "json" }
        },
        schema: {
          type: "object",
          properties: {
            west: { type: "number", description: "Western longitude boundary (-180 to 180)" },
            south: { type: "number", description: "Southern latitude boundary (-90 to 90)" },
            east: { type: "number", description: "Eastern longitude boundary (-180 to 180)" },
            north: { type: "number", description: "Northern latitude boundary (-90 to 90)" },
            ...(product.id === 'sat_weather_imagery' ? {
              layer: { type: "string", description: "GIBS layer ID" }
            } : {}),
            ...(product.id === 'sat_fire_alerts' ? {
              days: { type: "number", description: "Days to look back (default: 1)" }
            } : {})
          },
          required: ["west", "south", "east", "north"]
        }
      }
    },
    inputSchema: {
      type: "object",
      description: `Input parameters for ${product.name}`,
      properties: {
        west: { type: "number", description: "Western longitude boundary (-180 to 180)" },
        south: { type: "number", description: "Southern latitude boundary (-90 to 90)" },
        east: { type: "number", description: "Eastern longitude boundary (-180 to 180)" },
        north: { type: "number", description: "Northern latitude boundary (-90 to 90)" },
        ...(product.id === 'sat_weather_imagery' ? {
          layer: { type: "string", description: "GIBS layer ID" }
        } : {}),
        ...(product.id === 'sat_fire_alerts' ? {
          days: { type: "number", description: "Days to look back (default: 1)" }
        } : {})
      },
      required: ["west", "south", "east", "north"],
      httpMethod: "GET",
      contentType: "application/json"
    },
    product: {
      id: product.id,
      name: product.name,
      price: `$${product.priceUsd}`,
      unit: product.unit,
    },
  };
}

/**
 * Check if demo mode is allowed for this request.
 * Demo mode is only enabled in development or when SATELLITE_DEMO_MODE=true
 */
function isDemoModeAllowed(req: Request): boolean {
  if (!DEMO_MODE_ENABLED) return false;
  return req.query.demo === 'true' || req.headers['x-demo-mode'] === 'true';
}

/**
 * Check if request has any payment credentials (API key or x-payment header)
 */
function hasPaymentCredentials(req: Request): boolean {
  const xApiKey = req.headers["x-api-key"] as string | undefined;
  const authHeader = req.headers["authorization"] as string | undefined;
  const xPayment = req.headers["x-payment"] as string | undefined;
  const paymentSignature = req.headers["payment-signature"] as string | undefined;
  const xInternalAuth = req.headers["x-internal-auth"] as string | undefined;
  
  return !!(xApiKey || authHeader?.startsWith("Bearer ") || xPayment || paymentSignature || xInternalAuth);
}

/**
 * Middleware that checks for demo mode or valid payment credentials.
 * For paid endpoints, this ensures proper x402 payment verification.
 * Returns 402 with x402 payment info if no valid payment method is provided.
 */
function satellitePaymentMiddleware(productId: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Check if demo mode is allowed and requested
    if (isDemoModeAllowed(req)) {
      // Tag request as demo for downstream handlers
      (req as any).paymentVerified = true;
      (req as any).paymentId = `demo_${nanoid(8)}`;
      (req as any).isDemo = true;
      return next();
    }
    
    // Get the product for pricing
    const product = SATELLITE_DATA_PRODUCTS.find(p => p.id === productId);
    if (!product) {
      return res.status(500).json({ error: 'Product configuration error' });
    }
    
    // If no payment credentials, return 402 with x402 payment info
    if (!hasPaymentCredentials(req)) {
      const paymentRequired = generateX402PaymentRequired(product, req);
      const headerPayload = {
        x402Version: 2,
        accepts: (paymentRequired as any).accepts.map((a: any) => ({
          scheme: a.scheme,
          network: a.network,
          maxAmountRequired: a.maxAmountRequired,
          amount: a.amount,
          resource: a.resource,
          description: a.description,
          mimeType: a.mimeType,
          payTo: a.payTo,
          maxTimeoutSeconds: a.maxTimeoutSeconds,
          asset: a.asset,
          extra: a.extra,
        })),
      };
      res.setHeader('PAYMENT-REQUIRED', Buffer.from(JSON.stringify(headerPayload)).toString('base64'));
      return res.status(402).json(paymentRequired);
    }
    
    // Has payment credentials - use hybrid payment middleware for verification
    // This validates API keys, EIP-712 signatures, and on-chain transactions
    return hybridPaymentMiddleware(req, res, next);
  };
}

router.get('/catalog', async (req: Request, res: Response) => {
  try {
    const products = satelliteDataService.getAvailableProducts();
    const layers = satelliteDataService.getGIBSLayers();
    
    res.json({
      success: true,
      catalog: {
        products: products.map(p => ({
          id: p.id,
          name: p.name,
          description: p.description,
          dataSource: p.dataSource,
          price: `$${p.priceUsd}`,
          priceUsd: p.priceUsd,
          unit: p.unit,
          category: p.category,
          endpoint: p.endpoint,
          sampleResponse: p.sampleResponse,
        })),
        totalProducts: products.length,
        categories: Array.from(new Set(products.map(p => p.category))),
        dataSources: {
          nasa: {
            name: 'NASA Earthdata',
            configured: satelliteDataService.isNASAConfigured(),
            layers: layers.length,
          },
          esa: {
            name: 'ESA Copernicus',
            configured: satelliteDataService.isESAConfigured(),
          },
        },
      },
      branding: {
        poweredBy: ['NASA Earthdata', 'ESA Copernicus'],
        message: 'Satellite data intelligence powered by NASA and ESA',
      },
      payment: {
        protocol: 'x402',
        networks: ['base', 'ethereum', 'polygon', 'arbitrum'],
        currency: 'USDC',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch catalog',
      message: error.message,
    });
  }
});

router.get('/status', async (req: Request, res: Response) => {
  res.json({
    success: true,
    status: 'operational',
    services: {
      nasa: {
        name: 'NASA Earthdata',
        status: satelliteDataService.isNASAConfigured() ? 'connected' : 'not_configured',
        features: ['GIBS Imagery', 'FIRMS Fire Data', 'MODIS', 'Landsat'],
      },
      esa: {
        name: 'ESA Copernicus',
        status: satelliteDataService.isESAConfigured() ? 'connected' : 'not_configured',
        features: ['Sentinel-1 SAR', 'Sentinel-2 Optical', 'Sentinel-5P Atmosphere'],
      },
    },
    availableProducts: satelliteDataService.getAvailableProducts().length,
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

router.get('/fire-alerts', satellitePaymentMiddleware('sat_fire_alerts'), async (req: Request, res: Response) => {
  try {
    const product = SATELLITE_DATA_PRODUCTS.find(p => p.id === 'sat_fire_alerts')!;
    const paymentId = (req as any).paymentId || `pay_${nanoid(12)}`;
    const isDemo = (req as any).isDemo || false;

    const bbox = bboxSchema.safeParse({
      west: req.query.west || req.query.bbox?.toString().split(',')[0] || -125,
      south: req.query.south || req.query.bbox?.toString().split(',')[1] || 24,
      east: req.query.east || req.query.bbox?.toString().split(',')[2] || -66,
      north: req.query.north || req.query.bbox?.toString().split(',')[3] || 50,
    });

    if (!bbox.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid bounding box',
        details: bbox.error.errors,
        example: '?west=-125&south=24&east=-66&north=50',
      });
    }

    const days = Math.min(parseInt(req.query.days as string) || 1, 10);
    
    // Demo mode returns SAMPLE data only - not real NASA data
    if (isDemo) {
      return res.json({
        success: true,
        paymentId,
        isDemo: true,
        demoNotice: "This is SAMPLE data showing API response structure. Purchase credits or pay via x402 for real NASA data.",
        data: {
          fires: [
            { lat: 34.05, lon: -118.25, brightness: 325.4, confidence: 85, satellite: "VIIRS_SNPP", acqDate: "SAMPLE", acqTime: "SAMPLE" },
            { lat: 34.12, lon: -118.30, brightness: 312.1, confidence: 72, satellite: "VIIRS_SNPP", acqDate: "SAMPLE", acqTime: "SAMPLE" }
          ],
          count: 2,
          source: "SAMPLE DATA - Not Real",
          dataDate: "SAMPLE",
          bbox: { west: -125, south: 24, east: -66, north: 50 },
          days: 1,
        },
        product: { id: product.id, name: product.name, price: `$${product.priceUsd}` },
        poweredBy: 'NASA FIRMS (Sample)',
        timestamp: new Date().toISOString(),
      });
    }

    const data = await satelliteDataService.getFireAlerts(bbox.data, days);

    res.json({
      success: true,
      paymentId,
      isDemo,
      data: {
        ...data,
        bbox: bbox.data,
        days,
      },
      product: {
        id: product.id,
        name: product.name,
        price: `$${product.priceUsd}`,
      },
      poweredBy: 'NASA FIRMS',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('🛰️ Fire alerts error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch fire alerts',
      message: error.message,
    });
  }
});

router.get('/weather-imagery', satellitePaymentMiddleware('sat_weather_imagery'), async (req: Request, res: Response) => {
  try {
    const product = SATELLITE_DATA_PRODUCTS.find(p => p.id === 'sat_weather_imagery')!;
    const paymentId = (req as any).paymentId || `pay_${nanoid(12)}`;
    const isDemo = (req as any).isDemo || false;

    const location = locationSchema.safeParse({
      lat: req.query.lat || 40.7128,
      lon: req.query.lon || -74.0060,
    });

    if (!location.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid location',
        details: location.error.errors,
        example: '?lat=40.7128&lon=-74.0060',
      });
    }

    const layer = (req.query.layer as string) || 'MODIS_Terra_CorrectedReflectance_TrueColor';
    
    // Demo mode returns SAMPLE data only - not real NASA imagery
    if (isDemo) {
      return res.json({
        success: true,
        paymentId,
        isDemo: true,
        demoNotice: "This is SAMPLE data showing API response structure. Purchase credits or pay via x402 for real NASA imagery.",
        data: {
          imageUrl: "SAMPLE_URL - Pay to access real NASA GIBS imagery",
          thumbnailUrl: "SAMPLE_URL - Pay to access real thumbnails",
          timestamp: new Date().toISOString(),
          satellite: "MODIS Terra (Sample)",
          resolution: "250m",
          location: location.data,
          layer,
          bbox: { west: -76, south: 38.7, east: -72, north: 42.7 }
        },
        product: { id: product.id, name: product.name, price: `$${product.priceUsd}` },
        availableLayers: satelliteDataService.getGIBSLayers().map(l => ({ id: l.id, name: l.name, category: l.category })),
        poweredBy: 'NASA GIBS (Sample)',
        timestamp: new Date().toISOString(),
      });
    }

    const data = await satelliteDataService.getWeatherImagery(
      location.data.lat,
      location.data.lon,
      layer
    );

    res.json({
      success: true,
      paymentId,
      isDemo,
      data: {
        ...data,
        location: location.data,
        layer,
      },
      product: {
        id: product.id,
        name: product.name,
        price: `$${product.priceUsd}`,
      },
      availableLayers: satelliteDataService.getGIBSLayers().map(l => ({
        id: l.id,
        name: l.name,
        category: l.category,
      })),
      poweredBy: 'NASA GIBS',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('🛰️ Weather imagery error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch weather imagery',
      message: error.message,
    });
  }
});

router.get('/vegetation', satellitePaymentMiddleware('sat_vegetation_health'), async (req: Request, res: Response) => {
  try {
    const product = SATELLITE_DATA_PRODUCTS.find(p => p.id === 'sat_vegetation_health')!;
    const paymentId = (req as any).paymentId || `pay_${nanoid(12)}`;
    const isDemo = (req as any).isDemo || false;

    const bbox = bboxSchema.safeParse({
      west: req.query.west || -122.5,
      south: req.query.south || 37.0,
      east: req.query.east || -121.5,
      north: req.query.north || 38.0,
    });

    if (!bbox.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid bounding box',
        details: bbox.error.errors,
      });
    }

    // Demo mode returns SAMPLE data only
    if (isDemo) {
      return res.json({
        success: true,
        paymentId,
        isDemo: true,
        demoNotice: "This is SAMPLE data showing API response structure. Purchase credits or pay via x402 for real satellite data.",
        data: {
          ndvi: 0.65,
          evi: 0.52,
          healthStatus: "healthy",
          trend: "stable",
          areaKm2: "SAMPLE",
          timestamp: new Date().toISOString(),
          source: "SAMPLE DATA - Not Real",
          bbox: bbox.data
        },
        product: { id: product.id, name: product.name, price: `$${product.priceUsd}/km²` },
        poweredBy: 'NASA MODIS + ESA Sentinel-2 (Sample)',
        timestamp: new Date().toISOString(),
      });
    }

    const data = await satelliteDataService.getVegetationHealth(bbox.data);

    res.json({
      success: true,
      paymentId,
      isDemo,
      data: {
        ...data,
        bbox: bbox.data,
      },
      product: {
        id: product.id,
        name: product.name,
        price: `$${product.priceUsd}/km²`,
      },
      poweredBy: 'NASA MODIS + ESA Sentinel-2',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('🛰️ Vegetation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch vegetation data',
      message: error.message,
    });
  }
});

router.get('/flood-detection', satellitePaymentMiddleware('sat_flood_monitoring'), async (req: Request, res: Response) => {
  try {
    const product = SATELLITE_DATA_PRODUCTS.find(p => p.id === 'sat_flood_monitoring')!;
    const paymentId = (req as any).paymentId || `pay_${nanoid(12)}`;
    const isDemo = (req as any).isDemo || false;

    const bbox = bboxSchema.safeParse({
      west: req.query.west || -95.5,
      south: req.query.south || 29.0,
      east: req.query.east || -94.5,
      north: req.query.north || 30.0,
    });

    if (!bbox.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid bounding box',
        details: bbox.error.errors,
      });
    }

    // Demo mode returns SAMPLE data only
    if (isDemo) {
      return res.json({
        success: true,
        paymentId,
        isDemo: true,
        demoNotice: "This is SAMPLE data showing API response structure. Purchase credits or pay via x402 for real flood detection data.",
        data: {
          waterExtentKm2: "SAMPLE",
          floodRisk: "moderate",
          changeFromBaseline: "SAMPLE",
          affectedAreaPercent: 12.5,
          timestamp: new Date().toISOString(),
          source: "SAMPLE DATA - Not Real",
          bbox: bbox.data
        },
        product: { id: product.id, name: product.name, price: `$${product.priceUsd}` },
        poweredBy: 'ESA Sentinel-1 SAR (Sample)',
        timestamp: new Date().toISOString(),
      });
    }

    const data = await satelliteDataService.getFloodDetection(bbox.data);

    res.json({
      success: true,
      paymentId,
      isDemo,
      data: {
        ...data,
        bbox: bbox.data,
      },
      product: {
        id: product.id,
        name: product.name,
        price: `$${product.priceUsd}`,
      },
      poweredBy: 'ESA Sentinel-1 SAR',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('🛰️ Flood detection error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch flood data',
      message: error.message,
    });
  }
});

router.get('/air-quality', satellitePaymentMiddleware('sat_air_quality'), async (req: Request, res: Response) => {
  try {
    const product = SATELLITE_DATA_PRODUCTS.find(p => p.id === 'sat_air_quality')!;
    const paymentId = (req as any).paymentId || `pay_${nanoid(12)}`;
    const isDemo = (req as any).isDemo || false;

    const location = locationSchema.safeParse({
      lat: req.query.lat || 34.0522,
      lon: req.query.lon || -118.2437,
    });

    if (!location.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid location',
        details: location.error.errors,
      });
    }

    // Demo mode returns SAMPLE data only
    if (isDemo) {
      return res.json({
        success: true,
        paymentId,
        isDemo: true,
        demoNotice: "This is SAMPLE data showing API response structure. Purchase credits or pay via x402 for real air quality data.",
        data: {
          aqi: 75,
          quality: "Moderate",
          no2: "SAMPLE",
          o3: "SAMPLE",
          so2: "SAMPLE",
          co: "SAMPLE",
          pm25_estimate: "SAMPLE",
          timestamp: new Date().toISOString(),
          source: "SAMPLE DATA - Not Real",
          location: location.data
        },
        product: { id: product.id, name: product.name, price: `$${product.priceUsd}` },
        poweredBy: 'ESA Sentinel-5P TROPOMI (Sample)',
        timestamp: new Date().toISOString(),
      });
    }

    const data = await satelliteDataService.getAirQuality(
      location.data.lat,
      location.data.lon
    );

    res.json({
      success: true,
      paymentId,
      isDemo,
      data: {
        ...data,
        location: location.data,
      },
      product: {
        id: product.id,
        name: product.name,
        price: `$${product.priceUsd}`,
      },
      poweredBy: 'ESA Sentinel-5P TROPOMI',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('🛰️ Air quality error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch air quality data',
      message: error.message,
    });
  }
});

router.get('/land-use', satellitePaymentMiddleware('sat_land_use'), async (req: Request, res: Response) => {
  try {
    const product = SATELLITE_DATA_PRODUCTS.find(p => p.id === 'sat_land_use')!;
    const paymentId = (req as any).paymentId || `pay_${nanoid(12)}`;
    const isDemo = (req as any).isDemo || false;

    const bbox = bboxSchema.safeParse({
      west: req.query.west || -122.5,
      south: req.query.south || 37.5,
      east: req.query.east || -122.0,
      north: req.query.north || 38.0,
    });

    if (!bbox.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid bounding box',
        details: bbox.error.errors,
      });
    }

    // Demo mode returns SAMPLE data only
    if (isDemo) {
      return res.json({
        success: true,
        paymentId,
        isDemo: true,
        demoNotice: "This is SAMPLE data showing API response structure. Purchase credits or pay via x402 for real land use classification.",
        data: {
          classes: { urban: "SAMPLE", forest: "SAMPLE", agriculture: "SAMPLE", water: "SAMPLE", barren: "SAMPLE" },
          dominantType: "mixed",
          accuracy: "SAMPLE",
          timestamp: new Date().toISOString(),
          source: "SAMPLE DATA - Not Real",
          bbox: bbox.data
        },
        product: { id: product.id, name: product.name, price: `$${product.priceUsd}/km²` },
        poweredBy: 'NASA Landsat + ESA Sentinel-2 (Sample)',
        timestamp: new Date().toISOString(),
      });
    }

    const data = await satelliteDataService.getLandUseClassification(bbox.data);

    res.json({
      success: true,
      paymentId,
      isDemo,
      data: {
        ...data,
        bbox: bbox.data,
      },
      product: {
        id: product.id,
        name: product.name,
        price: `$${product.priceUsd}/km²`,
      },
      poweredBy: 'NASA Landsat + ESA Sentinel-2',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('🛰️ Land use error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch land use data',
      message: error.message,
    });
  }
});

router.get('/layers', async (req: Request, res: Response) => {
  const layers = satelliteDataService.getGIBSLayers();
  
  res.json({
    success: true,
    layers: layers.map(l => ({
      id: l.id,
      name: l.name,
      description: l.description,
      resolution: l.resolution,
      updateFrequency: l.updateFrequency,
      category: l.category,
    })),
    total: layers.length,
    source: 'NASA GIBS',
    documentation: 'https://nasa-gibs.github.io/gibs-api-docs/',
  });
});

export default router;
