---
name: SDK publish infrastructure
description: How to build and publish the three Coin Railz npm packages; current versions; publish command
---

## Packages and current versions
- `coinrailz` @ 1.2.0 — generic client SDK at `sdk/typescript/coinrailz-sdk/`
- `@coinrailz/agent-payments` @ 1.2.0 — agent payments SDK at `packages/agent-payments-npm/`
- `elizaos-plugin-coinrailz` @ **2.4.0** — ElizaOS plugin at `elizaos-plugin-coinrailz/`

## Publish command
```bash
# All three:
node scripts/release-sdks.mjs

# One only (avoids 403 on already-published versions):
node scripts/release-sdks.mjs elizaos-plugin-coinrailz
```

**Why:** `npm publish` via bash is blocked (process.env issues). The .mjs script handles auth via NPM_TOKEN Replit secret. `--ignore-scripts` is set, so `dist/` must be built manually before publishing (`npm run build` in the package dir).

## Plugin-specific publish checklist
1. `npm run build` inside `elizaos-plugin-coinrailz/` — compiles to `dist/`
2. `npx tsc --noEmit` — verify clean compile
3. `node scripts/release-sdks.mjs elizaos-plugin-coinrailz`

## intelligence() call path
`intelligence()` in the coinrailz SDK calls `/x402/{service}` directly (not `/api/sdk/intelligence` shim). The coinrailz and agent-payments SDKs are generic — no per-service list. Only the elizaos-plugin has `COIN_RAILZ_SERVICES`.

**Why:** Discovered when fixing SDK drift. coinrailz SDK uses `call(service, payload)` dynamically; only elizaos-plugin validates against a static list.

**How to apply:** When adding new x402 services, only the elizaos-plugin needs updating (types/index.ts COIN_RAILZ_SERVICES). The other two SDKs don't need version bumps unless their own code changes.
