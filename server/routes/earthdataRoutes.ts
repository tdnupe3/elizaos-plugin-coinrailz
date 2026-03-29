/**
 * NASA Earthdata Intelligence Routes — x402-Protected
 *
 * All endpoints: $0.25/call · API key credits or x402 on-chain USDC
 *
 * Routes:
 *   GET  /api/satellite/earthdata/catalog       — product catalog (free)
 *   POST /api/satellite/earthdata/granules      — CMR granule search
 *   POST /api/satellite/earthdata/precipitation — GPM IMERG observed rain rate
 *   POST /api/satellite/earthdata/ocean-temp    — MUR-SST sea surface temperature
 *   POST /api/satellite/earthdata/soil-moisture — SMAP L3 soil moisture
 *   POST /api/satellite/earthdata/water-quality — MODIS-Aqua chlorophyll-a
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { earthdataService } from '../services/earthdataService.js';
import { hybridPaymentMiddleware } from '../middleware/hybridPaymentMiddleware.js';
import { trackX402Service } from '../middleware/hitTracker.js';
import { nanoid } from 'nanoid';
import { getFacilitatorUrl } from '../utils/facilitatorHelper.js';

const router = Router();
router.use(trackX402Service);

const PRICE_USD = 0.25;
const PRICE_USDC_UNITS = Math.ceil(PRICE_USD * 1_000_000).toString(); // 6-decimal USDC on Base

// ─── Schemas ────────────────────────────────────────────────────────────────

const latLonSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
});

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional();

const bboxSchema = z.object({
  west:  z.coerce.number().min(-180).max(180),
  south: z.coerce.number().min(-90).max(90),
  east:  z.coerce.number().min(-180).max(180),
  north: z.coerce.number().min(-90).max(90),
});

const granuleSearchSchema = z.object({
  west:          z.coerce.number().min(-180).max(180),
  south:         z.coerce.number().min(-90).max(90),
  east:          z.coerce.number().min(-180).max(180),
  north:         z.coerce.number().min(-90).max(90),
  start_date:    z.string().optional(),
  end_date:      z.string().optional(),
  platform:      z.string().optional(),
  short_name:    z.string().optional(),
  max_cloud_cover: z.coerce.number().min(0).max(100).optional(),
  limit:         z.coerce.number().min(1).max(50).optional(),
});

// ─── Payment helpers ──────────────────────────────────────────────────────────

function buildX402Challenge(req: Request, serviceId: string, name: string, description: string) {
  const baseUrl = process.env.PUBLIC_BASE_URL
    || (process.env.REPLIT_DEPLOYMENT === '1' ? 'https://coinrailz.com' : null)
    || (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'https://coinrailz.com');

  const resource = `${baseUrl}/api/satellite/earthdata/${serviceId}`;

  return {
    x402Version: 2,
    accepts: [
      {
        scheme: 'exact',
        network: 'eip155:8453',
        networkLegacy: 'base',
        x402Network: 'eip155:8453',
        amount: PRICE_USDC_UNITS,
        maxAmountRequired: PRICE_USDC_UNITS,
        resource,
        description,
        mimeType: 'application/json',
        payTo: process.env.COINRAILZ_WALLET || '0xa4bBE37f9A6Ae2dc36a607B91eB148C0ae163C91',
        maxTimeoutSeconds: 300,
        asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        extra: { name: `Coin Railz — ${name}`, version: '2.0', decimals: 6, chainId: 8453, chainName: 'Base' },
      },
    ],
    error: 'Payment required',
    facilitatorUrl: getFacilitatorUrl(),
    resource: { url: resource, description, mimeType: 'application/json' },
    non_x402: {
      checkoutUrl: `${baseUrl}/api/m2m/credits/checkout/session`,
      trialUrl: `${baseUrl}/api/m2m/credits/trial`,
      capabilitiesUrl: `${baseUrl}/api/auth/capabilities`,
      note: 'No wallet required. GET trial URL for a free $5 key, or POST checkoutUrl to pay by card.',
    },
    product: {
      id: serviceId,
      name,
      price: `$${PRICE_USD}`,
      priceUsd: PRICE_USD,
      unit: 'request',
      poweredBy: 'NASA Earthdata',
    },
  };
}

function hasPaymentCredentials(req: Request): boolean {
  const key = req.headers['x-api-key'] as string | undefined;
  const auth = req.headers['authorization'] as string | undefined;
  const payment = req.headers['x-payment'] as string | undefined;
  return !!(key || auth?.startsWith('Bearer ') || payment);
}

function earthdataPaymentMiddleware(serviceId: string, name: string, description: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!hasPaymentCredentials(req)) {
      const challenge = buildX402Challenge(req, serviceId, name, description);
      res.setHeader('PAYMENT-REQUIRED', Buffer.from(JSON.stringify({
        x402Version: 2,
        accepts: challenge.accepts,
      })).toString('base64'));
      return res.status(402).json(challenge);
    }
    return hybridPaymentMiddleware(req, res, next);
  };
}

// ─── GET /catalog (free) ─────────────────────────────────────────────────────

router.get('/catalog', (_req: Request, res: Response) => {
  res.json({
    success: true,
    catalog: {
      name: 'NASA Earthdata Intelligence',
      description: 'Authenticated NASA satellite data products — point queries and granule discovery. All data sourced directly from NASA EOSDIS via Bearer token authentication.',
      priceUsd: PRICE_USD,
      currency: 'USDC on Base (x402) or API-key credits',
      dataUpdatedNote: 'NASA Earthdata token authentication required. All data from real NASA APIs — no synthetic data.',
      products: [
        {
          id: 'granules',
          name: 'CMR Granule Search',
          endpoint: '/api/satellite/earthdata/granules',
          method: 'POST',
          description: 'Search 1B+ NASA satellite granules by bounding box, date range, platform, and cloud cover. Returns granule metadata + direct download URLs for raw imagery bands.',
          datasource: 'NASA Common Metadata Repository (CMR)',
          updateFrequency: 'Near-realtime (minutes after acquisition)',
          cacheWindow: '1 hour',
          priceUsd: PRICE_USD,
          params: {
            required: ['west', 'south', 'east', 'north'],
            optional: ['start_date', 'end_date', 'platform', 'short_name', 'max_cloud_cover', 'limit'],
          },
          platforms: ['Landsat-8', 'Landsat-9', 'Sentinel-2A', 'Sentinel-2B', 'MODIS Terra', 'MODIS Aqua', 'VIIRS NPP', 'ASTER'],
          useCases: ['imagery discovery', 'change detection', 'cloud-free scene selection', 'time-series analysis'],
          exampleRequest: { west: -122.5, south: 37.7, east: -122.3, north: 37.9, max_cloud_cover: 10, limit: 5 },
        },
        {
          id: 'precipitation',
          name: 'GPM Precipitation Oracle',
          endpoint: '/api/satellite/earthdata/precipitation',
          method: 'POST',
          description: 'Observed satellite rain rate at any global coordinate from NASA\'s Global Precipitation Measurement (GPM) IMERG dataset. This is measured precipitation, not a forecast. 0.1° resolution (~10km), updates every 30 minutes.',
          datasource: 'GPM IMERG Daily Late Run V07 (GES DISC)',
          updateFrequency: 'Every 30 minutes (4-hr NRT latency)',
          cacheWindow: '30 minutes',
          priceUsd: PRICE_USD,
          params: {
            required: ['lat', 'lon'],
            optional: ['hours_back'],
          },
          useCases: ['agriculture irrigation decisions', 'flood insurance triggers', 'logistics routing', 'drought monitoring', 'historical rainfall verification'],
          exampleRequest: { lat: 34.05, lon: -118.25, hours_back: 24 },
        },
        {
          id: 'ocean-temp',
          name: 'Maritime SST Oracle',
          endpoint: '/api/satellite/earthdata/ocean-temp',
          method: 'POST',
          description: 'Sea surface temperature at any ocean coordinate from NASA\'s Multi-scale Ultra-high Resolution SST (MUR-SST) Level 4 analysis. 1km resolution, daily composites.',
          datasource: 'MUR-JPL-L4-GLOB-v4.1 (PODAAC)',
          updateFrequency: 'Daily',
          cacheWindow: '12 hours',
          priceUsd: PRICE_USD,
          params: {
            required: ['lat', 'lon'],
            optional: ['date'],
          },
          useCases: ['shipping route optimization', 'fishing fleet guidance', 'blue carbon monitoring', 'ocean warming compliance', 'aquaculture management'],
          exampleRequest: { lat: 35.5, lon: -140.0 },
        },
        {
          id: 'soil-moisture',
          name: 'SMAP Soil Moisture',
          endpoint: '/api/satellite/earthdata/soil-moisture',
          method: 'POST',
          description: 'Soil moisture measurements from NASA\'s SMAP (Soil Moisture Active Passive) satellite. L3 daily global composites at 36km resolution. Includes granule identification and download URL for full point extraction.',
          datasource: 'SMAP L3 Radiometer Global Daily SPL3SMP (NSIDC)',
          updateFrequency: '2-3 day repeat cycle',
          cacheWindow: '24 hours',
          priceUsd: PRICE_USD,
          params: {
            required: ['lat', 'lon'],
            optional: ['date'],
          },
          useCases: ['precision agriculture', 'drought early warning', 'flood prediction', 'wildfire risk assessment', 'irrigation management'],
          exampleRequest: { lat: 40.0, lon: -95.0 },
        },
        {
          id: 'water-quality',
          name: 'Ocean Color / Water Quality',
          endpoint: '/api/satellite/earthdata/water-quality',
          method: 'POST',
          description: 'Chlorophyll-a concentration and water quality indicators from MODIS-Aqua Level-3 mapped ocean color data. 4km resolution daily composites. Identifies algal blooms and turbidity conditions.',
          datasource: 'MODIS-Aqua L3m Chlorophyll Daily 4km MODISA_L3m_CHL (OB.DAAC)',
          updateFrequency: 'Daily',
          cacheWindow: '12 hours',
          priceUsd: PRICE_USD,
          params: {
            required: ['lat', 'lon'],
            optional: ['date'],
          },
          useCases: ['aquaculture monitoring', 'DePIN water sensor verification', 'algal bloom alerts', 'fishery management', 'environmental compliance'],
          exampleRequest: { lat: 36.0, lon: -122.0 },
        },
      ],
    },
    auth: {
      methods: ['API key (X-API-KEY header)', 'x402 on-chain USDC (X-PAYMENT header)'],
      trialKey: '/api/m2m/credits/trial',
      checkout: '/api/m2m/credits/checkout/session',
      capabilities: '/api/auth/capabilities',
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── POST /granules ───────────────────────────────────────────────────────────

router.post('/granules',
  earthdataPaymentMiddleware('granules', 'CMR Granule Search', 'Search 1B+ NASA satellite granules by bbox, date, platform, and cloud cover. Returns metadata + download URLs.'),
  async (req: Request, res: Response) => {
    const paymentId = (req as any).paymentId ?? `pay_${nanoid(12)}`;

    const parsed = granuleSearchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request parameters',
        details: parsed.error.errors,
        example: { west: -122.5, south: 37.7, east: -122.3, north: 37.9, max_cloud_cover: 10, limit: 5 },
      });
    }

    const p = parsed.data;
    const result = await earthdataService.searchGranules({
      bbox: { west: p.west, south: p.south, east: p.east, north: p.north },
      startDate: p.start_date,
      endDate: p.end_date,
      platform: p.platform,
      shortName: p.short_name,
      maxCloudCover: p.max_cloud_cover,
      limit: p.limit,
    });

    return res.json({
      success: true,
      paymentId,
      priceUsd: PRICE_USD,
      data: result,
      poweredBy: 'NASA Common Metadata Repository (CMR)',
      timestamp: new Date().toISOString(),
    });
  }
);

// ─── POST /precipitation ──────────────────────────────────────────────────────

router.post('/precipitation',
  earthdataPaymentMiddleware('precipitation', 'GPM Precipitation Oracle', 'Observed satellite rain rate at any global coordinate. GPM IMERG — actual measurement, not a forecast.'),
  async (req: Request, res: Response) => {
    const paymentId = (req as any).paymentId ?? `pay_${nanoid(12)}`;

    const locParsed = latLonSchema.safeParse(req.body);
    if (!locParsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request parameters',
        details: locParsed.error.errors,
        example: { lat: 34.05, lon: -118.25, hours_back: 24 },
      });
    }

    const hoursBack = Math.min(Number(req.body.hours_back ?? 24), 168);
    const result = await earthdataService.getPrecipitation(locParsed.data.lat, locParsed.data.lon, hoursBack);

    return res.json({
      success: true,
      paymentId,
      priceUsd: PRICE_USD,
      data: result,
      poweredBy: 'NASA GPM IMERG via GES DISC',
      timestamp: new Date().toISOString(),
    });
  }
);

// ─── POST /ocean-temp ────────────────────────────────────────────────────────

router.post('/ocean-temp',
  earthdataPaymentMiddleware('ocean-temp', 'Maritime SST Oracle', 'Sea surface temperature at any ocean coordinate from NASA MUR-SST Level 4 analysis. 1km resolution, daily.'),
  async (req: Request, res: Response) => {
    const paymentId = (req as any).paymentId ?? `pay_${nanoid(12)}`;

    const locParsed = latLonSchema.safeParse(req.body);
    if (!locParsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request parameters',
        details: locParsed.error.errors,
        example: { lat: 35.5, lon: -140.0 },
      });
    }

    const date = dateSchema.safeParse(req.body.date);
    const result = await earthdataService.getSeaSurfaceTemp(
      locParsed.data.lat, locParsed.data.lon,
      date.success ? date.data : undefined
    );

    return res.json({
      success: true,
      paymentId,
      priceUsd: PRICE_USD,
      data: result,
      poweredBy: 'NASA MUR-SST via PODAAC',
      timestamp: new Date().toISOString(),
    });
  }
);

// ─── POST /soil-moisture ─────────────────────────────────────────────────────

router.post('/soil-moisture',
  earthdataPaymentMiddleware('soil-moisture', 'SMAP Soil Moisture', 'SMAP L3 daily soil moisture for any coordinate. 36km resolution, 2-3 day repeat cycle.'),
  async (req: Request, res: Response) => {
    const paymentId = (req as any).paymentId ?? `pay_${nanoid(12)}`;

    const locParsed = latLonSchema.safeParse(req.body);
    if (!locParsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request parameters',
        details: locParsed.error.errors,
        example: { lat: 40.0, lon: -95.0 },
      });
    }

    const date = dateSchema.safeParse(req.body.date);
    const result = await earthdataService.getSoilMoisture(
      locParsed.data.lat, locParsed.data.lon,
      date.success ? date.data : undefined
    );

    return res.json({
      success: true,
      paymentId,
      priceUsd: PRICE_USD,
      data: result,
      poweredBy: 'NASA SMAP via NSIDC',
      timestamp: new Date().toISOString(),
    });
  }
);

// ─── POST /water-quality ─────────────────────────────────────────────────────

router.post('/water-quality',
  earthdataPaymentMiddleware('water-quality', 'Ocean Color / Water Quality', 'MODIS-Aqua chlorophyll-a and turbidity indicators at any coastal or ocean coordinate. Daily 4km composites.'),
  async (req: Request, res: Response) => {
    const paymentId = (req as any).paymentId ?? `pay_${nanoid(12)}`;

    const locParsed = latLonSchema.safeParse(req.body);
    if (!locParsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request parameters',
        details: locParsed.error.errors,
        example: { lat: 36.0, lon: -122.0 },
      });
    }

    const date = dateSchema.safeParse(req.body.date);
    const result = await earthdataService.getOceanColor(
      locParsed.data.lat, locParsed.data.lon,
      date.success ? date.data : undefined
    );

    return res.json({
      success: true,
      paymentId,
      priceUsd: PRICE_USD,
      data: result,
      poweredBy: 'NASA MODIS-Aqua via OB.DAAC',
      timestamp: new Date().toISOString(),
    });
  }
);

// ─── Aliases & Method Gating ──────────────────────────────────────────────────

// Method-agnostic gating for paid endpoints to ensure GET requests from crawlers 
// receive a 402 challenge instead of falling through to the React SPA catch-all.
const paidEndpoints = [
  { id: 'granules', name: 'CMR Granule Search', desc: 'Search 1B+ NASA satellite granules by bbox, date, platform, and cloud cover.', paths: ['/granules'] },
  { id: 'precipitation', name: 'GPM Precipitation Oracle', desc: 'Observed satellite rain rate at any global coordinate. GPM IMERG — actual measurement.', paths: ['/precipitation'] },
  { id: 'ocean-temp', name: 'Maritime SST Oracle', desc: 'Sea surface temperature at any ocean coordinate from NASA MUR-SST Level 4 analysis.', paths: ['/ocean-temp', '/sst'] },
  { id: 'soil-moisture', name: 'SMAP Soil Moisture', desc: 'SMAP L3 daily soil moisture for any coordinate. 36km resolution.', paths: ['/soil-moisture'] },
  { id: 'water-quality', name: 'Ocean Color / Water Quality', desc: 'MODIS-Aqua chlorophyll-a and turbidity indicators. Daily 4km composites.', paths: ['/water-quality', '/ocean-color'] },
];

paidEndpoints.forEach(ep => {
  ep.paths.forEach(path => {
    // Return 402 for GET requests to these endpoints
    router.get(path, earthdataPaymentMiddleware(ep.id, ep.name, ep.desc), (req, res) => {
      // If they have credentials, tell them to use POST
      res.status(405).json({
        success: false,
        error: 'Method Not Allowed',
        message: `This endpoint requires a POST request with parameters. You are authorized, but please use POST.`,
      });
    });

    // Handle POST aliases (like /sst -> /ocean-temp)
    if (path !== `/${ep.id}`) {
      router.post(path, (req, res, next) => {
        // Redirect or forward to the canonical POST handler
        req.url = `/${ep.id}`;
        (router as any).handle(req, res, next);
      });
    }
  });
});

export default router;
