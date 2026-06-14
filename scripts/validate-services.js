#!/usr/bin/env node
/**
 * validate-services.js
 *
 * CI-style validation: counts real x402 service routes registered in
 * server/routes/x402MicroserviceRoutesV2.ts and compares them to the
 * canonical entries in public/openapi-x402-services.json.
 *
 * Run:  node scripts/validate-services.js
 * Or:   npm run validate:services
 *
 * Exit 0 = in sync. Exit 1 = drift detected (counts or set differ).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const ROUTER_FILE = path.join(ROOT, 'server/routes/x402MicroserviceRoutesV2.ts');
const SPEC_FILE = path.join(ROOT, 'public/openapi-x402-services.json');

// ── Utility routes that are intentionally NOT in the openapi service catalog ──
const UTILITY_PATH_EXACT = new Set([
  '/openapi.json',
  '/catalog',
  '/payment-status',
  '/payment-docs',
  '/test-payment-flow',
  '/ping',         // internal health check, not a billable service (overridden below)
]);

// Re-include ping because it IS in the spec as a real service
// (see /x402/ping). We remove it from utility exclusion.
UTILITY_PATH_EXACT.delete('/ping');

// Paths starting with these prefixes are non-service utility endpoints
const UTILITY_PREFIXES = ['/offer/', '/service/'];

// ── 1. Parse the router file ─────────────────────────────────────────────────
const src = fs.readFileSync(ROUTER_FILE, 'utf8');

/**
 * Extract the string-literal array `const <name> = [ ... ]` from source.
 * Returns an array of the string values.
 */
function extractStringArray(source, varName) {
  const start = source.indexOf(`const ${varName} = [`);
  if (start === -1) return [];
  const arrStart = source.indexOf('[', start);
  let depth = 0, i = arrStart;
  while (i < source.length) {
    if (source[i] === '[') depth++;
    else if (source[i] === ']') { depth--; if (depth === 0) break; }
    i++;
  }
  const arrText = source.slice(arrStart + 1, i);
  return [...arrText.matchAll(/["']([^"']+)["']/g)].map(m => m[1]);
}

/**
 * Extract slug values from `enterpriseDirectEndpoints` array literal.
 * Each entry looks like: { slug: "smart-contract-audit", ... }
 */
function extractEnterpriseSlugs(source) {
  const start = source.indexOf('const enterpriseDirectEndpoints');
  if (start === -1) return [];
  const arrStart = source.indexOf('[', start);
  let depth = 0, i = arrStart;
  while (i < source.length) {
    if (source[i] === '[') depth++;
    else if (source[i] === ']') { depth--; if (depth === 0) break; }
    i++;
  }
  const block = source.slice(arrStart, i + 1);
  return [...block.matchAll(/slug:\s*["']([^"']+)["']/g)].map(m => m[1]);
}

/**
 * Extract static router.METHOD("literal-path", ...) registrations.
 * Skips template literals, dynamic segments (:param), and utility paths.
 */
function extractStaticRouterPaths(source) {
  const paths = new Set();
  // Match router.get|post|put|patch|delete("some/path", ...)
  // Excludes template literals (backticks) — we handle those via the arrays above
  const re = /router\.(get|post|put|patch|delete)\(\s*["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    const p = m[2];
    if (p.includes(':')) continue;                                // dynamic segment
    if (UTILITY_PATH_EXACT.has(p)) continue;                     // exact utility match
    if (UTILITY_PREFIXES.some(prefix => p.startsWith(prefix))) continue; // utility prefix
    paths.add(p);
  }
  return paths;
}

// Gather all service paths from the router file
const serviceEndpoints = extractStringArray(src, 'serviceEndpoints');     // ["ping", "multi-chain-balance", ...]
const enterpriseSlugs = extractEnterpriseSlugs(src);                      // ["smart-contract-audit", ...]
const staticPaths = extractStaticRouterPaths(src);                        // Set of "/first-call", "/air-quality", ...

// Build the unified router slug set (strip leading slash)
const routerSlugs = new Set();

for (const slug of serviceEndpoints) routerSlugs.add(slug);
for (const slug of enterpriseSlugs) routerSlugs.add(slug);
for (const p of staticPaths) routerSlugs.add(p.replace(/^\//, ''));

// ── 2. Parse the openapi spec ────────────────────────────────────────────────
const spec = JSON.parse(fs.readFileSync(SPEC_FILE, 'utf8'));
const specSlugs = new Set(
  Object.keys(spec.paths || {})
    .filter(p => p.startsWith('/x402/'))
    .map(p => p.slice('/x402/'.length))
);

// ── 3. Compare ───────────────────────────────────────────────────────────────
const inRouterNotSpec = [...routerSlugs].filter(s => !specSlugs.has(s)).sort();
const inSpecNotRouter = [...specSlugs].filter(s => !routerSlugs.has(s)).sort();

console.log('──────────────────────────────────────────────');
console.log('  Coin Railz — x402 Service Validation');
console.log('──────────────────────────────────────────────');
console.log(`  Router routes detected : ${routerSlugs.size}`);
console.log(`  Spec services (openapi) : ${specSlugs.size}`);
console.log('──────────────────────────────────────────────');

let exitCode = 0;

if (inRouterNotSpec.length > 0) {
  exitCode = 1;
  console.error('\n❌  Routes in router but MISSING from openapi spec:');
  inRouterNotSpec.forEach(s => console.error(`       /x402/${s}`));
  console.error('\n   → Add these to public/openapi-x402-services.json or remove them from the router.');
}

if (inSpecNotRouter.length > 0) {
  exitCode = 1;
  console.error('\n❌  Services in openapi spec but NOT registered in router:');
  inSpecNotRouter.forEach(s => console.error(`       /x402/${s}`));
  console.error('\n   → Register these routes in server/routes/x402MicroserviceRoutesV2.ts or remove them from the spec.');
}

if (routerSlugs.size !== specSlugs.size) {
  exitCode = 1;
  console.error(`\n❌  Count mismatch: router=${routerSlugs.size}, spec=${specSlugs.size}`);
}

if (exitCode === 0) {
  console.log('\n✅  Router and openapi spec are in sync!');
  console.log(`    ${specSlugs.size} x402 services registered and documented.\n`);
} else {
  console.error('\n   Fix the drift above before deploying.\n');
}

process.exit(exitCode);
