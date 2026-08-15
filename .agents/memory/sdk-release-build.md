---
name: SDK release must build from source
description: scripts/release-sdks.mjs now builds before publish; coinrailz SDK has vltUsdcWithdraw()
---

# SDK release must build from source

## The rule
`scripts/release-sdks.mjs` must always run `npm run build` for each package before calling `npm publish`. Never publish from a pre-existing dist/ that may be stale.

**Why:** dist/ is git-ignored (not committed) but explicitly included in package.json `files` fields for coinrailz and @coinrailz/agent-payments. Publishing from a dirty working tree with stale dist/ ships stale TypeScript declarations (.d.ts files) that contradict runtime behavior — causes compile errors for downstream developers.

**How to apply:**
- The script runs `execSync('npm run build', { cwd: pkg.dir })` before each `npm publish`
- `--ignore-scripts` is kept on the publish call to skip lifecycle double-build (we just built explicitly)
- Applies to all 3 packages: coinrailz, @coinrailz/agent-payments, elizaos-plugin-coinrailz

## SDK method parity (as of Aug 2026)
- `vltUsdcWithdraw(params: { shares, recipient })` — calls `vlt-usdc-withdraw` (1-tx plain redeem, delivers VLT+USDC pro-rata)
- `vltUsdcZapWithdraw(params: { shares, recipient })` — calls `vlt-usdc-zap-withdraw` (3-tx USDC-only exit)
Both are FREE services. Plugin catalog and SDK wrapper are now in sync.
