import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { ipBlocklist } from '../../shared/schema';

let blockedIpCache = new Set<string>();
let lastRefresh = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // refresh every 5 minutes

export async function refreshBlocklistCache(): Promise<void> {
  try {
    const entries = await db.select({ ipAddress: ipBlocklist.ipAddress }).from(ipBlocklist);
    blockedIpCache = new Set(entries.map(e => e.ipAddress));
    lastRefresh = Date.now();
    console.log(`✅ IP blocklist cache refreshed: ${blockedIpCache.size} blocked IPs`);
  } catch (e: any) {
    console.warn('⚠️  IP blocklist cache refresh failed:', e.message);
  }
}

export function ipBlocklistMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Refresh cache if stale
  if (Date.now() - lastRefresh > CACHE_TTL_MS) {
    refreshBlocklistCache(); // fire-and-forget; stale cache still protects during refresh
  }

  const raw = req.get('x-forwarded-for')?.split(',')[0] || req.ip || (req.connection as any)?.remoteAddress || '';
  const ip = raw.trim().replace('::ffff:', '');

  if (blockedIpCache.has(ip)) {
    res.status(403).end();
    return;
  }
  next();
}
