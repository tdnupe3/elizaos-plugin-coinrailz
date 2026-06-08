---
name: ElizaOS Plugin Architecture
description: elizaos-plugin-coinrailz v2.0.0 — structure, payment paths, build quirks, and publication status
---

## Plugin Location
`elizaos-plugin-coinrailz/` — the canonical, current plugin. The other dir `coinrailz-eliza-plugin/` is old/deprecated (published as `coinrailz-eliza-plugin@1.0.0` on npm with stale deps).

## Package Name
`elizaos-plugin-coinrailz` — community ElizaOS naming convention. Currently NOT published. Version 2.0.0.

## Payment Paths in X402Client
1. **API Key (primary)**: `COINRAILZ_API_KEY` env var → `Authorization: Bearer <key>`. Platform accepts both `Bearer` and `x-api-key` headers.
2. **Autonomous x402 (secondary)**: `EVM_PRIVATE_KEY` env var → `wrapFetchWithPayment(fetch, walletClient)` from `x402-fetch` v0.7.3 + viem `privateKeyToAccount` + `createWalletClient`. Uses dynamic imports to avoid loading viem when not needed.
3. **Neither set**: Returns descriptive error string pointing to coinrailz.com/credits.

## @elizaos/core Type Stub
`@elizaos/core` is NOT in root node_modules. A local stub lives at `elizaos-plugin-coinrailz/src/types/elizaos-core.d.ts`. The tsconfig uses `paths` to redirect `@elizaos/core` imports to this stub.

## Build Configuration
- `module: Node16` + `moduleResolution: node16` required — otherwise x402-fetch types (ESM .d.mts) can't be resolved
- `lib: ["ES2022", "dom"]` required — viem's ox dependency references DOM types
- `skipLibCheck: true` handles remaining transitive type noise from ox/webauthn

## Service Count
65 services — verified in compiled output (`dist/types/index.js`). Matches `shared/pricing.ts` ServiceName type exactly.

## NPM_TOKEN Status
`NPM_TOKEN` is listed as an available secret in the Replit project but has no real value set in the environment. `npm publish` will succeed once the user sets a real npm token at npmjs.com → Access Tokens → Generate New Token → Automation type.

## Post-Publish Actions
1. Submit to `elizaos/registry` GitHub repo (JSON entry PR, 2-4 day merge, faster than monorepo PR)
2. Post in ElizaOS Discord #plugins channel within 72h
3. Update SUBMISSION_GUIDE.md to reflect actual published package name

**Why:** Platform accepts both auth headers so no functional break on API key path. x402 autonomous path uses the same x402-fetch library the canary uses (v0.7.3), just from a viem WalletClient rather than x402Client wrapper.
