/**
 * SDK TELEMETRY & DEMO KEY ROUTES
 * Track SDK installations and provide trial access to increase conversion
 * 
 * Endpoints:
 * - POST /api/sdk/telemetry - Track SDK usage
 * - POST /api/sdk/demo-key - Get trial API key
 * - GET /api/sdk/free-services - List free-tier services
 */

import { Router, Request, Response } from 'express';
import { db } from '../db.js';
import { sdkInstalls, sdkDemoKeys, sdkTelemetryInputSchema, sdkDemoKeyRequestSchema } from '@shared/schema.js';
import { eq, sql } from 'drizzle-orm';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';

const router = Router();

const FREE_TIER_SERVICES = [
  'gas-price-oracle',
  'token-metadata'
];

const telemetryLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many telemetry requests' }
});

const demoKeyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Too many demo key requests. Try again in an hour.' }
});

router.post('/telemetry', telemetryLimiter, async (req: Request, res: Response) => {
  try {
    const parsed = sdkTelemetryInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid telemetry data',
        details: parsed.error.issues
      });
    }

    const { installId, sdkType, sdkVersion, event, environment } = parsed.data;
    const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip;
    const userAgent = req.headers['user-agent'] || '';

    const existing = await db.select().from(sdkInstalls)
      .where(eq(sdkInstalls.installId, installId))
      .limit(1);

    if (existing.length > 0) {
      await db.update(sdkInstalls)
        .set({
          lastSeenAt: new Date(),
          totalRequests: sql`${sdkInstalls.totalRequests} + 1`,
          sdkVersion: sdkVersion,
        })
        .where(eq(sdkInstalls.installId, installId));
    } else {
      await db.insert(sdkInstalls).values({
        installId,
        sdkType,
        sdkVersion,
        environment: environment || {},
        ipAddress,
        userAgent,
        totalRequests: 1,
      });
    }

    res.json({
      success: true,
      message: 'Telemetry recorded',
      free_services: FREE_TIER_SERVICES,
      quick_start: {
        free_tier: 'These services are free: gas-price-oracle, token-metadata',
        get_demo_key: 'POST /api/sdk/demo-key to get a trial API key with $5 credits',
        buy_credits: 'https://coinrailz.com/credits'
      }
    });
  } catch (error) {
    console.error('SDK telemetry error:', error);
    res.status(500).json({ error: 'Failed to record telemetry' });
  }
});

router.post('/demo-key', demoKeyLimiter, async (req: Request, res: Response) => {
  try {
    const parsed = sdkDemoKeyRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: parsed.error.issues,
        required: { installId: 'string (8-64 chars)', sdkType: 'python-mcp | typescript | a2a-js' }
      });
    }

    const { installId, sdkType } = parsed.data;
    const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip;

    const existingKey = await db.select().from(sdkDemoKeys)
      .where(eq(sdkDemoKeys.installId, installId))
      .limit(1);

    if (existingKey.length > 0) {
      const key = existingKey[0];
      const isExpired = new Date(key.expiresAt) <= new Date();
      
      if (key.status === 'active' && !isExpired) {
        return res.json({
          success: true,
          api_key: key.apiKey,
          credits_remaining: key.creditsRemaining,
          expires_at: key.expiresAt,
          status: 'existing',
          usage: {
            header: 'X-API-KEY: ' + key.apiKey,
            env_var: `COINRAILZ_API_KEY=${key.apiKey}`,
            documentation: 'https://coinrailz.com/docs/sdk'
          }
        });
      }
      
      if (isExpired || key.status !== 'active') {
        const newApiKey = 'demo_' + crypto.randomBytes(24).toString('hex');
        const newExpiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
        
        await db.update(sdkDemoKeys)
          .set({
            apiKey: newApiKey,
            expiresAt: newExpiresAt,
            creditsRemaining: 500,
            status: 'active',
            ipAddress,
          })
          .where(eq(sdkDemoKeys.installId, installId));
        
        return res.json({
          success: true,
          api_key: newApiKey,
          credits_remaining: 500,
          expires_at: newExpiresAt.toISOString(),
          status: 'renewed',
          usage: {
            header: 'X-API-KEY: ' + newApiKey,
            env_var: `COINRAILZ_API_KEY=${newApiKey}`,
            documentation: 'https://coinrailz.com/docs/sdk'
          },
          next_steps: {
            test: 'Try calling /x402/gas-price-oracle with your new API key',
            upgrade: 'https://coinrailz.com/credits to buy more credits',
            support: 'support@coinrailz.com'
          }
        });
      }
    }

    const apiKey = 'demo_' + crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

    await db.insert(sdkDemoKeys).values({
      installId,
      apiKey,
      expiresAt,
      creditsRemaining: 500,
      status: 'active',
      ipAddress,
    });

    await db.update(sdkInstalls)
      .set({ demoKeyIssued: true })
      .where(eq(sdkInstalls.installId, installId));

    res.json({
      success: true,
      api_key: apiKey,
      credits_remaining: 500,
      expires_at: expiresAt.toISOString(),
      status: 'new',
      usage: {
        header: 'X-API-KEY: ' + apiKey,
        env_var: `COINRAILZ_API_KEY=${apiKey}`,
        documentation: 'https://coinrailz.com/docs/sdk'
      },
      next_steps: {
        test: 'Try calling /x402/gas-price-oracle with your new API key',
        upgrade: 'https://coinrailz.com/credits to buy more credits',
        support: 'support@coinrailz.com'
      }
    });
  } catch (error) {
    console.error('Demo key generation error:', error);
    res.status(500).json({ error: 'Failed to generate demo key' });
  }
});

router.get('/free-services', async (_req: Request, res: Response) => {
  res.json({
    success: true,
    free_services: FREE_TIER_SERVICES.map(service => ({
      name: service,
      url: `https://coinrailz.com/x402/${service}`,
      description: service === 'gas-price-oracle' 
        ? 'Real-time gas prices across 6 EVM chains'
        : 'Token metadata (name, symbol, decimals, supply)'
    })),
    trial_offer: {
      demo_key: 'POST /api/sdk/demo-key for $5 trial credits (72 hour expiry)',
      full_access: 'https://coinrailz.com/credits'
    }
  });
});

router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const totalInstalls = await db.select({ count: sql<number>`count(*)` }).from(sdkInstalls);
    const byType = await db.select({
      sdkType: sdkInstalls.sdkType,
      count: sql<number>`count(*)`
    }).from(sdkInstalls).groupBy(sdkInstalls.sdkType);
    const converted = await db.select({ count: sql<number>`count(*)` })
      .from(sdkInstalls).where(eq(sdkInstalls.convertedToPaid, true));
    const demoKeysIssued = await db.select({ count: sql<number>`count(*)` }).from(sdkDemoKeys);

    res.json({
      success: true,
      stats: {
        total_installs: Number(totalInstalls[0]?.count || 0),
        by_sdk_type: byType.reduce((acc, row) => ({ ...acc, [row.sdkType]: Number(row.count) }), {}),
        converted_to_paid: Number(converted[0]?.count || 0),
        demo_keys_issued: Number(demoKeysIssued[0]?.count || 0),
        conversion_rate: totalInstalls[0]?.count 
          ? ((Number(converted[0]?.count || 0) / Number(totalInstalls[0].count)) * 100).toFixed(2) + '%'
          : '0%'
      }
    });
  } catch (error) {
    console.error('SDK stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

export default router;
