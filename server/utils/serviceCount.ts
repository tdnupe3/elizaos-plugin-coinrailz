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
