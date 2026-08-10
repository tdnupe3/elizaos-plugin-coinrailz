/**
 * Unpaid POST Rate Limiter
 *
 * Soft-limits IP+UA combinations that send many unauthenticated POST requests
 * in a 15-minute window. Targets depleted wallets and persistent cataloguers
 * that cycle all services without converting, adding CPU and DB write load.
 *
 * EXEMPT: localhost/internal IPs (canary, health-check), any request carrying
 * X-API-KEY, Authorization, or X-PAYMENT — even with invalid credentials, those
 * requests are validated by upstream handlers and the actor can't spoof payment
 * without on-chain settlement. Known ecosystem scanners (x402-observer,
 * x402-healthbot) receive a 5× higher allowance rather than full exemption so
 * they still appear in rate-limit logs.
 *
 * NOT a security control — a cost/noise-reduction admission gate. Defense in
 * depth sits with x402Limiter (200 req/min) and the payment orchestrator.
 *
 * CAUTION: In-memory Map is per-process. Multi-replica deployments each maintain
 * separate counters; effective limit per actor is limit × replica_count. This is
 * acceptable for current single-replica Cloud Run deployment. If replicas scale,
 * consider promoting to Redis-backed rate limiter.
 */

import { Request, Response, NextFunction } from 'express';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const WINDOW_MS    = 15 * 60 * 1_000; // 15-minute sliding window
const SOFT_LIMIT   = 50;               // unpaid POSTs before throttling
const HIGH_LIMIT   = SOFT_LIMIT * 5;   // 250 — for known ecosystem scanners
const MAX_MAP_SIZE = 5_000;            // cardinality cap to bound memory

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
interface UnpaidRecord {
  count: number;
  windowStart: number;
}

const unpaidMap = new Map<string, UnpaidRecord>();

// Cleanup: remove expired windows, enforce cardinality cap
setInterval(() => {
  const now = Date.now();
  let oldestKey: string | null = null;
  let oldestTs  = Infinity;

  for (const [key, rec] of unpaidMap.entries()) {
    if (now - rec.windowStart > WINDOW_MS * 2) {
      unpaidMap.delete(key);
      continue;
    }
    if (rec.windowStart < oldestTs) {
      oldestTs  = rec.windowStart;
      oldestKey = key;
    }
  }

  // Overflow eviction — evict oldest remaining entry to stay under cap
  if (unpaidMap.size > MAX_MAP_SIZE && oldestKey) {
    unpaidMap.delete(oldestKey);
  }
}, 5 * 60 * 1_000);

// ---------------------------------------------------------------------------
// Known ecosystem scanner UA prefixes
// These are observability scanners, never conversion candidates.
// They receive a higher allowance instead of full exemption so they
// still appear in rate-limit metrics when they push extreme volume.
// ---------------------------------------------------------------------------
const HIGH_QUOTA_UA_PREFIXES: string[] = [
  'x402-observer/1.0',
  'x402-healthbot/1.0',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getClientIp(req: Request): string {
  // Trust X-Forwarded-For only when trust proxy is configured (app.set('trust proxy', 1))
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
    || req.ip
    || (req.socket as any)?.remoteAddress
    || 'unknown'
  );
}

function isLocalhostOrInternal(ip: string): boolean {
  return (
    ip === '127.0.0.1'
    || ip === '::1'
    || ip.startsWith('::ffff:127.')
    || ip.startsWith('10.')
    || ip === 'unknown'
  );
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
export function unpaidPostLimiter(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Only target POST requests — GET/HEAD/OPTIONS are not payment paths
  if (req.method !== 'POST') {
    next();
    return;
  }

  const ip = getClientIp(req);

  // Exempt canary, health-check, and internal proxy IPs
  if (isLocalhostOrInternal(ip)) {
    next();
    return;
  }

  // Exempt any request carrying an auth credential.
  // Valid credentials deduct credits / settle on-chain — never throttle.
  // Invalid credentials pass through to upstream validation (correct rejection path).
  if (
    req.headers['x-api-key']
    || req.headers['authorization']
    || req.headers['x-payment']
  ) {
    next();
    return;
  }

  const ua             = (req.headers['user-agent'] as string) ?? '';
  const isHighQuota    = HIGH_QUOTA_UA_PREFIXES.some(p => ua.startsWith(p));
  const effectiveLimit = isHighQuota ? HIGH_LIMIT : SOFT_LIMIT;
  const key            = `${ip}:${ua.slice(0, 80)}`;
  const now            = Date.now();

  let rec = unpaidMap.get(key);

  if (!rec || now - rec.windowStart > WINDOW_MS) {
    // Map at capacity — let the request through rather than evicting a tracked actor.
    // The next cleanup cycle will make room.
    if (unpaidMap.size >= MAX_MAP_SIZE && !rec) {
      next();
      return;
    }
    rec = { count: 0, windowStart: now };
    unpaidMap.set(key, rec);
  }

  rec.count++;

  if (rec.count > effectiveLimit) {
    const windowRemainingMs = WINDOW_MS - (now - rec.windowStart);
    const retryAfterSecs    = Math.max(1, Math.ceil(windowRemainingMs / 1_000));
    const BASE_URL          = process.env.PUBLIC_URL || 'https://coinrailz.com';

    res.setHeader('Retry-After',           String(retryAfterSecs));
    res.setHeader('X-RateLimit-Limit',     String(effectiveLimit));
    res.setHeader('X-RateLimit-Remaining', '0');
    res.setHeader('X-RateLimit-Reset',     String(Math.ceil((rec.windowStart + WINDOW_MS) / 1_000)));
    res.setHeader('Cache-Control',         'no-store');

    console.log(
      `[unpaidPostLimiter] 429 | ip=${ip} | count=${rec.count}/${effectiveLimit} | ` +
      `ua=${ua.slice(0, 60)} | retryAfterSecs=${retryAfterSecs}`,
    );

    res.status(429).json({
      error:             'rate_limit_exceeded',
      message:           `${rec.count} unauthenticated POST requests in 15 minutes — add X-API-KEY or X-PAYMENT to continue without throttling.`,
      trialKey:          `${BASE_URL}/api/m2m/credits/trial`,
      purchaseKey:       `${BASE_URL}/api/m2m/credits/checkout/session`,
      retryAfterSeconds: retryAfterSecs,
    });
    return;
  }

  next();
}

// ---------------------------------------------------------------------------
// Exported stats helper (for observability endpoint / health checks)
// ---------------------------------------------------------------------------
export function getUnpaidPostLimiterStats(): {
  trackedIps: number;
  mapSizeCap: number;
  windowMs: number;
  softLimit: number;
} {
  return {
    trackedIps: unpaidMap.size,
    mapSizeCap: MAX_MAP_SIZE,
    windowMs:   WINDOW_MS,
    softLimit:  SOFT_LIMIT,
  };
}
