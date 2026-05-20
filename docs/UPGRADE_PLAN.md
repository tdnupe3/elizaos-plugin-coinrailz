# Coin Railz — Dependency Upgrade Master Plan

**Created:** May 20, 2026  
**Baseline Commit:** `edef511` — "Add support for Arbitrum and Arbitrum Sepolia networks"  
**Baseline Health:** `/x402/ping` ✅ | `/health` ✅ | `/.well-known/agent-card.json` ✅

---

## Hard Constraints (Never Violate)

- ❌ **vite** — FORBIDDEN. Replit environment depends on exact setup.
- ❌ **zod 4** — Blocked until `drizzle-zod` + `x402` packages confirm zod v4 support.
- ❌ **Big-bang upgrades** — Every wave gets its own commit and health check before proceeding.
- ✅ **Canary test** required after every wave: `/x402/ping`, `/health`, `/.well-known/agent-card.json`

---

## Progress Legend

| Symbol | Meaning |
|---|---|
| ⏳ | Not started |
| 🔄 | In progress |
| ✅ | Complete |
| ❌ | Blocked / skipped |

---

## Wave A1 — Frontend Core (Forms + Routing)

**Status:** ✅ Complete — May 20, 2026  
**Risk:** Low  
**Business Impact:** Zero — no payment paths, no discoverability  
**Commit after:** Yes

| Package | From | To | Files Affected |
|---|---|---|---|
| `react-hook-form` | 7.55.0 | 7.76.0 | ~5 form components |
| `@hookform/resolvers` | 3.10.0 | 5.2.2 | ~5 form components |
| `wouter` | 3.3.5 | 3.9.0 | ~113 client files (routing) |

**Verification steps:**
- [ ] `npm install` completes without errors
- [ ] TypeScript build passes (`npx tsc --noEmit`)
- [ ] App starts and serves frontend
- [ ] `/x402/ping` → 402 ✅
- [ ] `/health` → 200 ✅
- [ ] `/.well-known/agent-card.json` → 200 ✅
- [ ] Navigate 3+ pages in the UI — no broken routes

**Commit message:** `chore: upgrade react-hook-form, hookform/resolvers, wouter`

---

## Wave A2 — Frontend Icons

**Status:** ✅ Complete — May 20, 2026 (pre-fixed Github icon removal from lucide-react; moved to @/lib/minimal-icons-clean)  
**Risk:** Low-Medium (icon renames possible in 0.x → 1.x jump)  
**Business Impact:** Zero  
**Commit after:** Yes

| Package | From | To | Files Affected |
|---|---|---|---|
| `lucide-react` | 0.539.0 | 1.16.0 | ~66 frontend files |

**Verification steps:**
- [ ] `npm install` completes without errors
- [ ] TypeScript build passes — fix any icon name errors that surface
- [ ] App starts, all pages render without broken icon imports
- [ ] `/x402/ping` → 402 ✅
- [ ] `/health` → 200 ✅

**Commit message:** `chore: upgrade lucide-react to v1 (fix any icon renames)`

---

## Wave A3 — CDP Wallet SDK

**Status:** ✅ Complete — May 20, 2026 (bonus: removed `as any` Solana cast, now properly typed)  
**Risk:** Medium (touches live wallet creation + payment paths)  
**Business Impact:** Medium — CDP is used for wallet provisioning and USDC transfers  
**Commit after:** Yes

| Package | From | To | Files Affected |
|---|---|---|---|
| `@coinbase/cdp-sdk` | 1.40.1 | 1.49.2 | 5 server files |

**Files to review:**
- `server/services/coinbaseCDPService.ts`
- `server/services/x402PaymentService.ts`
- `server/simpleRoutes.ts`
- `server/scripts/findCdpWallet.ts`
- `server/scripts/checkCdpBalances.ts`

**Verification steps:**
- [ ] `npm install` completes without errors
- [ ] TypeScript build passes
- [ ] App starts
- [ ] `/x402/ping` → 402 ✅
- [ ] `/health` → 200 ✅
- [ ] CDP wallet endpoint responds (canary test)
- [ ] No errors in server logs related to CDP

**Commit message:** `chore: upgrade @coinbase/cdp-sdk 1.40 → 1.49`

---

## Wave B — Service Libraries

**Status:** ⏳ Not started  
**Risk:** Low-Medium (isolated to individual service files)  
**Business Impact:** Low  
**Commit after:** Yes (one commit per package or one combined)

| Package | From | To | Files Affected |
|---|---|---|---|
| `@circle-fin/developer-controlled-wallets` | 8.4.0 | 10.3.1 | `circleService.ts` |
| `@circle-fin/smart-contract-platform` | 8.4.0 | 10.3.1 | `circleService.ts` |
| `@circle-fin/user-controlled-wallets` | 8.4.0 | 10.3.1 | `circleService.ts` |
| `nodemailer` | 7.0.6 | 8.0.7 | email service |
| `multer` | 2.0.1 | 2.1.1 | file uploads |
| `winston` | 3.17.0 | 3.19.0 | logging (minor) |
| `nanoid` | 5.1.5 | 5.1.11 | ID generation (minor) |

**Verification steps:**
- [ ] `npm install` completes without errors
- [ ] TypeScript build passes
- [ ] App starts
- [ ] `/x402/ping` → 402 ✅
- [ ] `/health` → 200 ✅

**Commit message:** `chore: upgrade service libraries (circle-fin, nodemailer, multer, winston, nanoid)`

---

## Wave C — Payment Layer

**Status:** ⏳ Not started  
**Risk:** High — direct payment processing impact  
**Business Impact:** HIGH — Stripe is primary fiat payment path  
**Commit after:** Yes — one commit per package  
**Requires:** Live webhook replay + canary payment test before/after

| Package | From | To | Files Affected | Key Breaking Change |
|---|---|---|---|---|
| `stripe` | 18.5.0 | 22.1.1 | 23 server files | `new Stripe()` required (was callable as function) |
| `openai` | 5.8.2 | 6.38.0 | ~10 server files | Client instantiation + streaming API changes |
| `@paypal/paypal-server-sdk` | 1.1.0 | 2.3.0 | ~40 files (mostly strings; real SDK in `paypalService.ts`) | API surface changes |

**Stripe breaking changes to fix:**
- Replace `Stripe(key)` with `new Stripe(key)` across all 23 files
- `Stripe.errors.StripeError` → `Stripe.ErrorType`
- `Stripe.StripeContext` → `Stripe.StripeContextType`
- Webhook construction method signature updated

**Verification steps (per package):**
- [ ] TypeScript build passes
- [ ] App starts
- [ ] Stripe webhook endpoint responds correctly
- [ ] `/api/stripe/webhook` → processes test event
- [ ] `/x402/ping` → 402 ✅
- [ ] `/health` → 200 ✅

**Commit message (per package):**
- `chore: upgrade stripe 18 → 22 (fix breaking API changes)`
- `chore: upgrade openai 5 → 6`
- `chore: upgrade @paypal/paypal-server-sdk 1 → 2`

---

## Wave D — x402 Protocol Layer

**Status:** ⏳ BLOCKED — waiting for coinbase/x402 PR to merge  
**Risk:** Critical — revenue-critical payment path  
**Business Impact:** HIGH — Arbitrum becomes first-class x402 network after this  
**Trigger:** coinbase/x402 PR merged + new version published to npm

| Package | From | To | Files Affected |
|---|---|---|---|
| `x402` | 0.7.3 | 1.x+ | 1 route file |
| `x402-express` | 0.7.1 | 1.x+ | 2 route files |
| `x402-fetch` | 0.7.3 | 1.x+ | 6 test scripts |
| `@coinbase/x402` | 0.7.1 | 2.1.0 | 2 route files + 1 frontend page |

**All four packages must be upgraded together in one shot.**

**Verification steps:**
- [ ] TypeScript build passes
- [ ] App starts
- [ ] `/x402/ping` → 402 with correct `x402Version` ✅
- [ ] x402scan.com still indexes all 65 services
- [ ] Coinbase Bazaar still discovers endpoints
- [ ] Live test payment succeeds on Base
- [ ] Live test payment succeeds on Arbitrum (if PR merged)

**Commit message:** `feat: upgrade x402 protocol packages to v1+ (add Arbitrum to accepts[])`

---

## Wave E — Infrastructure (Future Sprint)

**Status:** ⏳ DEFERRED — dedicated sprint required  
**Risk:** Very High — touches entire codebase  
**Prerequisite:** All previous waves complete + drizzle-zod zod v4 compatibility confirmed

| Package | From | To | Blocker |
|---|---|---|---|
| `zod` | 3.25.76 | 4.4.3 | drizzle-zod + x402 peer deps on zod 3 |
| `react` + `react-dom` | 18.3.1 | 19.2.6 | Low ROI for payment platform; high surface area (271 files) |
| `tailwindcss` | 3.4.17 | 4.3.0 | Config format completely changed |
| `typescript` | 5.6.3 | 6.0.3 | Compiler breaking changes across entire codebase |

---

## Skipped / Never Touch

| Package | Reason |
|---|---|
| `vite` | FORBIDDEN — Replit environment constraint |
| `wagmi` | Zero actual usage in production code |
| `plaid` | Not a live revenue path, not worth regression risk |
| `@a2a-js/sdk` | Adds new peer dependencies; move to post-Wave B review |

---

## Canary Health Check (Run After Every Wave)

```bash
curl https://coinrailz.com/x402/ping        # expect: 402
curl https://coinrailz.com/health            # expect: 200
curl https://coinrailz.com/.well-known/agent-card.json  # expect: 200
curl https://coinrailz.com/x402.json        # expect: 200
```

---

## Wave Completion Log

| Wave | Date | Commit | Status |
|---|---|---|---|
| Baseline | May 20, 2026 | `edef511` | ✅ Locked |
| A1 | May 20, 2026 | react-hook-form 7.76, @hookform/resolvers 5.2, wouter 3.9 | ✅ Complete |
| A2 | May 20, 2026 | lucide-react 1.16 (pre-fixed Github icon) | ✅ Complete |
| A3 | May 20, 2026 | @coinbase/cdp-sdk 1.49.2 (+ removed as-any Solana cast) | ✅ Complete |
| B | — | — | ⏳ Next |
| C | — | — | ⏳ |
| D | — | — | ⏳ Blocked (waiting for coinbase/x402 PR) |
| E | — | — | ⏳ Deferred |
