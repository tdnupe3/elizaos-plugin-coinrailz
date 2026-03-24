/**
 * MPP Ecosystem Monitoring Service
 *
 * Responsibilities:
 * 1. Track mpp-registry, mppx, and Tempo crawlers hitting our endpoints
 * 2. Poll npm weekly for mppx version changes — alerts when a new version drops
 * 3. Expose monitoring data via GET /api/admin/mpp-monitor
 *
 * Why this matters:
 * - mppx v0.4.9 is incompatible with Express 4.x (requires Express 5+)
 * - The moment mppx releases an Express 4 compatible version, we upgrade
 * - This service makes sure we catch that release within 24 hours
 *
 * Crawler UAs tracked:
 * - mpp-registry-cross-protocol-sync/2.0 (already seen 16× on March 20)
 * - mppx/* (agents using the mppx CLI)
 * - Tempo/* (Tempo wallet agents)
 * - mpp/* (generic MPP crawlers)
 */

import { db } from "../db";
import { endpointHits } from "@shared/schema";
import { sql, gte } from "drizzle-orm";

const MPPX_NPM_REGISTRY_URL = "https://registry.npmjs.org/mppx/latest";
const INSTALLED_MPPX_VERSION = "not-installed";
const MONITOR_INTERVAL_MS = 24 * 60 * 60 * 1000;

const MPP_CRAWLER_UA_PATTERNS = [
  "mpp-registry",
  "mpp-registry-cross-protocol-sync",
  "mppx",
  "tempo-wallet",
  "Tempo/",
  "mpp/",
  "PaymentCrawler",
  "mpp.dev",
];

export interface MppVersionInfo {
  installed: string;
  latest: string | null;
  isOutdated: boolean;
  latestCheckedAt: string;
  expressCompatibilityNote: string;
}

export interface MppCrawlerHit {
  endpoint: string;
  userAgent: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
}

export interface MppMonitorReport {
  version: MppVersionInfo;
  crawlerActivity: {
    totalHits24h: number;
    uniqueUserAgents: number;
    hits: MppCrawlerHit[];
  };
  status: "healthy" | "upgrade-available" | "error";
  lastCheckedAt: string;
}

let cachedVersionInfo: MppVersionInfo | null = null;
let lastVersionCheck = 0;

export async function checkMppxVersion(): Promise<MppVersionInfo> {
  try {
    const response = await fetch(MPPX_NPM_REGISTRY_URL, {
      headers: { "User-Agent": "coinrailz-mpp-monitor/1.0" },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      throw new Error(`npm registry returned ${response.status}`);
    }

    const data = await response.json() as { version?: string };
    const latest = data.version || null;
    const isOutdated = latest !== null && latest !== INSTALLED_MPPX_VERSION;

    const info: MppVersionInfo = {
      installed: INSTALLED_MPPX_VERSION,
      latest,
      isOutdated,
      latestCheckedAt: new Date().toISOString(),
      expressCompatibilityNote:
        INSTALLED_MPPX_VERSION === "not-installed"
          ? `mppx@${latest || "unknown"} not installed. v0.4.9 requires Express >=5; project uses Express 4.21.2. ` +
            "Install when Express 5 compatible version is released."
          : isOutdated
          ? `Update available: ${INSTALLED_MPPX_VERSION} → ${latest}. Review changelog for Express 4 compatibility.`
          : "mppx is up to date.",
    };

    if (isOutdated || INSTALLED_MPPX_VERSION === "not-installed") {
      console.log(
        `[MPP Monitor] ⚠️  mppx version check: installed=${INSTALLED_MPPX_VERSION}, latest=${latest}. ` +
        `${info.expressCompatibilityNote}`
      );
    } else {
      console.log(`[MPP Monitor] ✅ mppx up to date: v${latest}`);
    }

    cachedVersionInfo = info;
    lastVersionCheck = Date.now();
    return info;
  } catch (error: any) {
    const fallback: MppVersionInfo = {
      installed: INSTALLED_MPPX_VERSION,
      latest: null,
      isOutdated: false,
      latestCheckedAt: new Date().toISOString(),
      expressCompatibilityNote: `Version check failed: ${error.message}. Will retry in 24h.`,
    };
    cachedVersionInfo = fallback;
    return fallback;
  }
}

export async function getMppCrawlerActivity(hours = 24): Promise<MppMonitorReport["crawlerActivity"]> {
  try {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const uaPatternConditions = MPP_CRAWLER_UA_PATTERNS.map(
      (pattern) => sql`LOWER(${endpointHits.userAgent}) LIKE LOWER(${"%" + pattern + "%"})`
    );

    const combinedCondition = sql`(${sql.join(uaPatternConditions, sql` OR `)})`;

    const rows = await db
      .select({
        endpoint: endpointHits.endpoint,
        userAgent: endpointHits.userAgent,
        createdAt: endpointHits.createdAt,
      })
      .from(endpointHits)
      .where(sql`${endpointHits.createdAt} >= ${since} AND ${combinedCondition}`)
      .limit(500);

    if (rows.length === 0) {
      return { totalHits24h: 0, uniqueUserAgents: 0, hits: [] };
    }

    const grouped = new Map<string, { endpoint: string; userAgent: string; count: number; firstSeen: Date; lastSeen: Date }>();

    for (const row of rows) {
      const key = `${row.userAgent || "unknown"}::${row.endpoint}`;
      const existing = grouped.get(key);
      const ts = row.createdAt || new Date();

      if (existing) {
        existing.count++;
        if (ts < existing.firstSeen) existing.firstSeen = ts;
        if (ts > existing.lastSeen) existing.lastSeen = ts;
      } else {
        grouped.set(key, {
          endpoint: row.endpoint,
          userAgent: row.userAgent || "unknown",
          count: 1,
          firstSeen: ts,
          lastSeen: ts,
        });
      }
    }

    const hits: MppCrawlerHit[] = Array.from(grouped.values())
      .sort((a, b) => b.count - a.count)
      .map((g) => ({
        endpoint: g.endpoint,
        userAgent: g.userAgent,
        count: g.count,
        firstSeen: g.firstSeen.toISOString(),
        lastSeen: g.lastSeen.toISOString(),
      }));

    const uniqueUAs = new Set(hits.map((h) => h.userAgent)).size;

    return {
      totalHits24h: rows.length,
      uniqueUserAgents: uniqueUAs,
      hits,
    };
  } catch (error: any) {
    console.error("[MPP Monitor] Error querying crawler activity:", error.message);
    return { totalHits24h: 0, uniqueUserAgents: 0, hits: [] };
  }
}

export async function getMppMonitorReport(): Promise<MppMonitorReport> {
  const now = Date.now();
  const needsVersionCheck = !cachedVersionInfo || now - lastVersionCheck > 60 * 60 * 1000;

  const [version, crawlerActivity] = await Promise.all([
    needsVersionCheck ? checkMppxVersion() : Promise.resolve(cachedVersionInfo!),
    getMppCrawlerActivity(24),
  ]);

  const status: MppMonitorReport["status"] =
    version.latest === null
      ? "error"
      : version.isOutdated || version.installed === "not-installed"
      ? "upgrade-available"
      : "healthy";

  return {
    version,
    crawlerActivity,
    status,
    lastCheckedAt: new Date().toISOString(),
  };
}

let monitorInterval: ReturnType<typeof setInterval> | null = null;

export function initMppMonitor(): void {
  console.log("[MPP Monitor] Initializing MPP ecosystem monitor...");

  checkMppxVersion().catch((err) =>
    console.error("[MPP Monitor] Initial version check failed:", err.message)
  );

  if (monitorInterval) clearInterval(monitorInterval);
  monitorInterval = setInterval(() => {
    checkMppxVersion().catch((err) =>
      console.error("[MPP Monitor] Scheduled version check failed:", err.message)
    );
  }, MONITOR_INTERVAL_MS);

  console.log("[MPP Monitor] ✅ Running. Version checks every 24h. Crawler activity queryable via GET /api/admin/mpp-monitor");
}
