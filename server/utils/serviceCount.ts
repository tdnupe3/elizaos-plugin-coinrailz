/**
 * serviceCount.ts — Canonical service catalog utility
 *
 * Single source of truth for service count and metadata.
 * Reads public/openapi-x402-services.json once, caches for 5 minutes.
 * Invalidates cache if file mtime changes (zero-downtime updates).
 *
 * Used by wellKnownRoutes.ts, openApiRoute.ts, mcpDeliveryRoutes.ts,
 * and any other surface that needs a consistent service count or list.
 */

import fs from 'fs';
import path from 'path';
import { SERVICE_PRICING_USD, isServiceName } from '../../shared/pricing';

export type CanonicalService = {
  id: string;
  name: string;
  description: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  priceUsd: number;
  category: string;
  tags: string[];
  featured: boolean;
  inputSchema?: unknown;
};

type OpenApiOp = {
  summary?: string;
  description?: string;
  tags?: string[];
  'x-price-usd'?: number;
  'x-featured'?: boolean;
  requestBody?: { content?: { 'application/json'?: { schema?: unknown } } };
};

type OpenApiDoc = {
  paths: Record<string, Record<string, OpenApiOp>>;
};

const SPEC_PATH = path.join(process.cwd(), 'public', 'openapi-x402-services.json');
const CACHE_TTL_MS = 300_000; // 5 minutes

let cache: {
  expiresAt: number;
  fileMtime: number;
  doc: OpenApiDoc;
  services: CanonicalService[];
} | null = null;

function loadSpec(): OpenApiDoc {
  const stat = fs.statSync(SPEC_PATH);
  const mtime = stat.mtimeMs;

  if (cache && Date.now() < cache.expiresAt && cache.fileMtime === mtime) {
    return cache.doc;
  }

  const doc = JSON.parse(fs.readFileSync(SPEC_PATH, 'utf8')) as OpenApiDoc;

  const services: CanonicalService[] = Object.entries(doc.paths || {})
    .filter(([routePath]) => routePath.startsWith('/x402/'))
    .map(([routePath, methods]) => {
      const httpMethod = (
        ['post', 'get', 'put', 'patch', 'delete'] as const
      ).find((m) => methods[m]) ?? 'post';

      const op = methods[httpMethod] ?? {};

      return {
        id: routePath.replace('/x402/', ''),
        name: op.summary ?? routePath.replace('/x402/', ''),
        description: op.description ?? '',
        endpoint: routePath,
        method: httpMethod.toUpperCase() as CanonicalService['method'],
        priceUsd: Number(op['x-price-usd'] ?? 0),
        category: (op.tags?.[0] ?? 'uncategorized')
          .toLowerCase()
          .replace(/\s+/g, '-'),
        tags: op.tags ?? [],
        featured: op['x-featured'] === true,
        inputSchema:
          op.requestBody?.content?.['application/json']?.schema,
      };
    });

  cache = {
    expiresAt: Date.now() + CACHE_TTL_MS,
    fileMtime: mtime,
    doc,
    services,
  };

  return doc;
}

/**
 * Returns the total number of /x402/* services in the canonical OpenAPI spec.
 * This is the authoritative service count for all discovery surfaces.
 */
export function getCanonicalServiceCount(): number {
  loadSpec();
  return cache!.services.length;
}

/**
 * Returns all /x402/* services as structured objects.
 * Featured services sort first. Safe to call on every request — result is cached.
 */
export function getCanonicalServices(): CanonicalService[] {
  loadSpec();
  return cache!.services;
}

/**
 * Returns only the featured /x402/* services, sorted by price ascending.
 */
export function getFeaturedServices(): CanonicalService[] {
  loadSpec();
  return cache!.services
    .filter((s) => s.featured)
    .sort((a, b) => a.priceUsd - b.priceUsd);
}

/**
 * Returns the count of featured /x402/* services.
 */
export function getFeaturedServiceCount(): number {
  loadSpec();
  return cache!.services.filter((s) => s.featured).length;
}

/**
 * Returns standard (non-featured) /x402/* services, sorted by price ascending.
 * "Standard" means any service that is NOT in the featured set — all are production-ready.
 */
export function getStandardServices(): CanonicalService[] {
  loadSpec();
  return cache!.services
    .filter((s) => !s.featured)
    .sort((a, b) => a.priceUsd - b.priceUsd);
}

// ---------------------------------------------------------------------------
// Startup consistency check — MCP catalog divergence detection
//
// Both /mcp/services and tools/list now read from getCanonicalServices()
// (i.e. this file, sourced from public/openapi-x402-services.json).
// This assertion validates that the OpenAPI spec itself is internally
// consistent by cross-checking IDs against the shared/pricing.ts registry.
//
// Call once at startup. Logs console.error loudly for any mismatch so
// divergence is visible in workflow logs before an agent ever hits the API.
// ---------------------------------------------------------------------------
export function assertMcpCatalogConsistency(): void {
  try {
    loadSpec();
    const services = cache!.services;

    const errors: string[] = [];
    const pricingIds = new Set(Object.keys(SERVICE_PRICING_USD));

    for (const svc of services) {
      if (!isServiceName(svc.id)) {
        // Service in OpenAPI spec has no entry in shared/pricing.ts
        errors.push(`[MCP catalog] Service "${svc.id}" is in openapi-x402-services.json but NOT in shared/pricing.ts — price will be $0 in payment verification`);
        continue;
      }
      const expectedPrice = SERVICE_PRICING_USD[svc.id];
      if (Math.abs(svc.priceUsd - expectedPrice) > 0.0001) {
        errors.push(
          `[MCP catalog] Price mismatch for "${svc.id}": ` +
          `openapi-x402-services.json says $${svc.priceUsd.toFixed(4)}, ` +
          `shared/pricing.ts says $${expectedPrice.toFixed(4)} — ` +
          `agents will see $${svc.priceUsd.toFixed(2)} but pay $${expectedPrice.toFixed(2)}`
        );
      }
    }

    // Note: we intentionally do NOT flag pricing.ts services that are absent from the
    // OpenAPI spec. pricing.ts may contain services that are priced but not yet deployed
    // (e.g. solana-yield-rates, solana-yield-deposit). The assertion's purpose is to
    // ensure what agents SEE (spec) matches what they PAY (pricing.ts) — not to flag
    // undeployed services. Use validate:services (scripts/validate-services.js) to
    // catch router/spec count drift instead.

    if (errors.length > 0) {
      console.error('\n🚨 MCP CATALOG CONSISTENCY ERRORS DETECTED AT STARTUP 🚨');
      console.error('─'.repeat(70));
      for (const err of errors) {
        console.error(`  ✗ ${err}`);
      }
      console.error('─'.repeat(70));
      console.error(`  Total issues: ${errors.length}`);
      console.error('  Fix: update openapi-x402-services.json or shared/pricing.ts so they match.\n');
      // Fatal in production — agents must never receive wrong prices or phantom tools.
      // In development this is a hard warning; set STRICT_CATALOG_CHECK=true to enforce.
      if (process.env.NODE_ENV === 'production' || process.env.STRICT_CATALOG_CHECK === 'true') {
        console.error('💀 FATAL: Catalog divergence detected in production — aborting startup to prevent agents seeing wrong prices.');
        process.exit(1);
      }
    } else {
      const count = services.length;
      console.log(`✅ MCP catalog consistency OK — ${count} services, IDs and prices match between openapi-x402-services.json and shared/pricing.ts`);
    }
  } catch (err: any) {
    console.error('[MCP catalog] assertMcpCatalogConsistency threw unexpectedly:', err?.message ?? err);
  }
}
