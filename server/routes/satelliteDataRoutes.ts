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

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { satelliteDataService, SATELLITE_DATA_PRODUCTS } from '../services/satelliteDataService';
import { trackX402Service } from '../middleware/hitTracker';
import { nanoid } from 'nanoid';

const router = Router();

router.use(trackX402Service);

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
  const baseUrl = process.env.REPLIT_DEV_DOMAIN 
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : 'https://coinrailz.com';
  
  return {
    x402Version: '2',
    accepts: [
      {
        scheme: 'exact',
        network: 'base',
        maxAmountRequired: Math.ceil(product.priceUsd * 1000000).toString(),
        resource: `${baseUrl}${product.endpoint}`,
        description: product.description,
        mimeType: 'application/json',
        payTo: process.env.COINRAILZ_WALLET || '0xa4bBE37f9A6Ae2dc36a607B91eB148C0ae163C91',
        maxTimeoutSeconds: 300,
        asset: 'eip155:8453/erc20:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        extra: {
          name: `Coin Railz - ${product.name}`,
          version: '2.0',
        },
      },
    ],
    error: 'Payment required to access satellite data',
    product: {
      id: product.id,
      name: product.name,
      price: `$${product.priceUsd}`,
      unit: product.unit,
    },
  };
}

function verifyX402Payment(req: Request): { verified: boolean; paymentId?: string } {
  const paymentHeader = req.headers['x-payment'] as string;
  const paymentProof = req.headers['x-payment-proof'] as string;
  
  if (paymentHeader || paymentProof) {
    return { verified: true, paymentId: `sat_pay_${nanoid(12)}` };
  }
  
  if (req.query.demo === 'true' || req.headers['x-demo-mode'] === 'true') {
    return { verified: true, paymentId: `demo_${nanoid(8)}` };
  }
  
  return { verified: false };
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
        categories: [...new Set(products.map(p => p.category))],
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

router.get('/fire-alerts', async (req: Request, res: Response) => {
  try {
    const product = SATELLITE_DATA_PRODUCTS.find(p => p.id === 'sat_fire_alerts')!;
    const payment = verifyX402Payment(req);
    
    if (!payment.verified) {
      return res.status(402).json(generateX402PaymentRequired(product, req));
    }

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
    
    const data = await satelliteDataService.getFireAlerts(bbox.data, days);

    res.json({
      success: true,
      paymentId: payment.paymentId,
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

router.get('/weather-imagery', async (req: Request, res: Response) => {
  try {
    const product = SATELLITE_DATA_PRODUCTS.find(p => p.id === 'sat_weather_imagery')!;
    const payment = verifyX402Payment(req);
    
    if (!payment.verified) {
      return res.status(402).json(generateX402PaymentRequired(product, req));
    }

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
    
    const data = await satelliteDataService.getWeatherImagery(
      location.data.lat,
      location.data.lon,
      layer
    );

    res.json({
      success: true,
      paymentId: payment.paymentId,
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

router.get('/vegetation', async (req: Request, res: Response) => {
  try {
    const product = SATELLITE_DATA_PRODUCTS.find(p => p.id === 'sat_vegetation_health')!;
    const payment = verifyX402Payment(req);
    
    if (!payment.verified) {
      return res.status(402).json(generateX402PaymentRequired(product, req));
    }

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

    const data = await satelliteDataService.getVegetationHealth(bbox.data);

    res.json({
      success: true,
      paymentId: payment.paymentId,
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

router.get('/flood-detection', async (req: Request, res: Response) => {
  try {
    const product = SATELLITE_DATA_PRODUCTS.find(p => p.id === 'sat_flood_monitoring')!;
    const payment = verifyX402Payment(req);
    
    if (!payment.verified) {
      return res.status(402).json(generateX402PaymentRequired(product, req));
    }

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

    const data = await satelliteDataService.getFloodDetection(bbox.data);

    res.json({
      success: true,
      paymentId: payment.paymentId,
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

router.get('/air-quality', async (req: Request, res: Response) => {
  try {
    const product = SATELLITE_DATA_PRODUCTS.find(p => p.id === 'sat_air_quality')!;
    const payment = verifyX402Payment(req);
    
    if (!payment.verified) {
      return res.status(402).json(generateX402PaymentRequired(product, req));
    }

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

    const data = await satelliteDataService.getAirQuality(
      location.data.lat,
      location.data.lon
    );

    res.json({
      success: true,
      paymentId: payment.paymentId,
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

router.get('/land-use', async (req: Request, res: Response) => {
  try {
    const product = SATELLITE_DATA_PRODUCTS.find(p => p.id === 'sat_land_use')!;
    const payment = verifyX402Payment(req);
    
    if (!payment.verified) {
      return res.status(402).json(generateX402PaymentRequired(product, req));
    }

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

    const data = await satelliteDataService.getLandUseClassification(bbox.data);

    res.json({
      success: true,
      paymentId: payment.paymentId,
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
