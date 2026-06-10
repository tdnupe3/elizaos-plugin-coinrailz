/**
 * Hit Tracker Middleware
 * 
 * Tracks all hits to x402 and IoT endpoints for analytics.
 * Captures user agent, wallet address (if available), and timing.
 */

import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { endpointHits } from '../../shared/schema';
import { sql } from 'drizzle-orm';
import crypto from 'crypto';

interface HitTrackerOptions {
  endpointType: 'x402' | 'iot' | 'catalog' | 'service' | 'discovery' | 'yield';
  extractResourceId?: (req: Request) => string | undefined;
}

function hashIP(ip: string | undefined): string | undefined {
  if (!ip) return undefined;
  return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

function extractWalletAddress(req: Request): string | undefined {
  const candidate = (
    req.headers['x-wallet-address'] as string ||
    req.headers['x-payer-address'] as string ||
    (req.params as Record<string, string>)?.wallet ||
    req.query.wallet as string ||
    req.query.recipient as string ||
    req.query.depositor as string ||
    undefined
  );
  if (!candidate) return undefined;
  return /^0x[0-9a-fA-F]{40}$/.test(candidate) ? candidate.toLowerCase() : undefined;
}

function extractTrackingId(req: Request): string | undefined {
  return (
    req.headers['x-tracking-id'] as string ||
    req.query.tracking as string ||
    req.query.x as string ||
    undefined
  );
}

export function createHitTracker(options: HitTrackerOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    res.on('finish', async () => {
      try {
        const responseTime = Date.now() - startTime;
        const clientIP = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress;
        
        await db.insert(endpointHits).values({
          endpoint: req.originalUrl.split('?')[0],
          endpointType: options.endpointType,
          resourceId: options.extractResourceId?.(req),
          ipHash: hashIP(clientIP),
          userAgent: req.headers['user-agent']?.slice(0, 500),
          referer: (req.headers['referer'] || req.headers['referrer'])?.toString().slice(0, 500),
          walletAddress: extractWalletAddress(req),
          method: req.method,
          statusCode: res.statusCode,
          responseTimeMs: responseTime,
          trackingId: extractTrackingId(req),
        });
      } catch (error) {
        console.error('[HitTracker] Failed to log hit:', error);
      }
    });
    
    next();
  };
}

export const trackX402Catalog = createHitTracker({
  endpointType: 'catalog',
});

export const trackX402Service = createHitTracker({
  endpointType: 'x402',
  extractResourceId: (req) => req.params.serviceName || req.path.split('/').pop(),
});

export const trackIoTEndpoint = createHitTracker({
  endpointType: 'iot',
  extractResourceId: (req) => req.params.deviceId || req.params.productId,
});

export const trackDiscovery = createHitTracker({
  endpointType: 'discovery',
  extractResourceId: (req) => {
    const path = req.path;
    if (path.includes('agent-instructions.json')) return 'agent-instructions.json';
    if (path.includes('agent-card.json')) return 'agent-card.json';
    if (path.includes('agent.json')) return 'agent.json';
    if (path.includes('x402.json')) return 'x402.json';
    return path.split('/').pop();
  },
});

export const trackYieldPortal = createHitTracker({
  endpointType: 'yield',
  extractResourceId: (req) => {
    const path = req.originalUrl.split('?')[0];
    if (path.includes('/position/')) return 'position';
    if (path.includes('/deposit-tx')) return 'deposit-tx';
    if (path.includes('/rates')) return 'rates';
    if (path.includes('/stats')) return 'stats';
    if (path.includes('/contract')) return 'contract';
    if (path.includes('/manifest') || path.includes('yield-portal.json')) return 'manifest';
    return 'other';
  },
});

export async function getHitStats(options?: {
  endpointType?: string;
  since?: Date;
  limit?: number;
}): Promise<{
  totalHits: number;
  uniqueVisitors: number;
  topEndpoints: { endpoint: string; hits: number }[];
  topUserAgents: { userAgent: string; hits: number }[];
}> {
  const since = options?.since || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const lim = options?.limit || 10;
  
  const totalResult = await db.execute(sql`
    SELECT COUNT(*) as count FROM endpoint_hits WHERE created_at >= ${since}
  `);
  
  const uniqueResult = await db.execute(sql`
    SELECT COUNT(DISTINCT ip_hash) as count FROM endpoint_hits WHERE created_at >= ${since}
  `);
  
  const endpointsResult = await db.execute(sql`
    SELECT endpoint, COUNT(*) as hits FROM endpoint_hits 
    WHERE created_at >= ${since}
    GROUP BY endpoint ORDER BY hits DESC LIMIT ${lim}
  `);
  
  const agentsResult = await db.execute(sql`
    SELECT user_agent, COUNT(*) as hits FROM endpoint_hits 
    WHERE created_at >= ${since} AND user_agent IS NOT NULL
    GROUP BY user_agent ORDER BY hits DESC LIMIT ${lim}
  `);

  return {
    totalHits: parseInt((totalResult.rows[0] as any)?.count || '0'),
    uniqueVisitors: parseInt((uniqueResult.rows[0] as any)?.count || '0'),
    topEndpoints: endpointsResult.rows.map((r: any) => ({
      endpoint: r.endpoint,
      hits: parseInt(r.hits),
    })),
    topUserAgents: agentsResult.rows.map((r: any) => ({
      userAgent: r.user_agent,
      hits: parseInt(r.hits),
    })),
  };
}
