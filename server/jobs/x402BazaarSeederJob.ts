/**
 * x402 Bazaar Seeder Job
 *
 * Rotates through all x402 services and makes a real facilitated payment to each,
 * triggering indexing in the CDP Bazaar / Amazon Bedrock AgentCore discovery layer.
 *
 * HOW BAZAAR INDEXING WORKS:
 *   When a service receives a payment routed via the CDP facilitator
 *   (api.cdp.coinbase.com/platform/v2/x402), the facilitator records the
 *   {payTo, resource} pair in its index. That index feeds the CDP Bazaar,
 *   the Bazaar MCP server, and Amazon Bedrock AgentCore's discovery layer.
 *
 *   The canary job pays only for "first-call". This seeder cycles through
 *   ALL seedable services so every route appears in Bazaar search.
 *
 * NETWORK SCOPE — EVM ONLY:
 *   This job uses ExactEvmScheme on Base. Services that emit a Solana-only
 *   402 challenge (solana-yield-finder, solana-yield-rates, solana-yield-deposit)
 *   are explicitly excluded from SEEDABLE_SERVICES. They require a separate
 *   Solana-capable seeder using ExactSvmScheme + a Solana wallet.
 *
 * SUCCESS CRITERION — PAYMENT INTENT, NOT HTTP 200:
 *   Many services require service-specific request bodies and may return 4xx if
 *   the seed payload is missing required fields. However, the CDP facilitator
 *   verifies and records the payment BEFORE the handler runs. Bazaar indexing
 *   is triggered by that facilitator settlement, not by the handler's HTTP status.
 *
 *   After each x402Fetch attempt, the seeder waits 3s and queries
 *   x402PaymentIntents for a SUCCEEDED record from the seeder wallet to that
 *   service. If a payment intent is found, the service is considered seeded —
 *   regardless of the HTTP response from the handler.
 *
 * ROTATION STATE — DURABLE:
 *   At the start of each run, the seeder queries x402_payment_intents to find
 *   which services our canary wallet has already paid for successfully. It then
 *   picks the first unseeded service from SEEDABLE_SERVICES. This means restarts
 *   never reset progress — the DB is the source of truth.
 *
 * PRICING:
 *   Service prices are derived from SERVICE_PRICING_MICRO in shared/pricing.ts
 *   (the canonical source) rather than hardcoded, so new services are automatically
 *   included and price changes propagate without touching this file.
 *
 * SAFETY:
 *   - Production-only (REPLIT_DEPLOYMENT=1 or NODE_ENV=production).
 *   - Skips $0-priced and Solana-only services.
 *   - Skips services priced ≥ MAX_SEED_PRICE_MICRO (too expensive to auto-seed).
 *   - Circuit breaker: 5 consecutive failures → pauses 4h before resuming.
 */

import { createWalletClient, createPublicClient, http, Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { db } from "../db";
import { x402PaymentIntents } from "@shared/schema";
import { eq, and, gte, desc, sql } from "drizzle-orm";
import { SERVICE_PRICING_MICRO } from "../../shared/pricing";

// ─── Constants ───────────────────────────────────────────────────────────────

/** Skip services priced at or above this threshold (too expensive to auto-seed).
 *  $2.00 = 2,000,000 micro-USDC. Services at exactly this price are excluded. */
export const MAX_SEED_PRICE_MICRO = 2_000_000;

/**
 * Services that emit a Solana-only 402 challenge (network: solana:5eykt4...).
 * The EVM-only seeder cannot pay these — they require ExactSvmScheme + Solana wallet.
 * Source: SOLANA_NATIVE_SLUGS in x402MicroserviceRoutesV2.ts.
 */
export const SOLANA_ONLY_SLUGS = new Set([
  "solana-yield-finder",
  "solana-yield-rates",
  "solana-yield-deposit",
]);

/** How long between seeder runs during the initial pass (one service per cycle) */
const SEEDER_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 hours

/** Circuit breaker: pause after this many consecutive failures */
const MAX_CONSECUTIVE_FAILURES = 5;

/** How long the circuit stays open before auto-resetting */
const CIRCUIT_AUTO_RESET_MS = 4 * 60 * 60 * 1000; // 4 hours

/** Hard timeout for the full payment round-trip per service */
const PAYMENT_TIMEOUT_MS = 120_000; // 2 minutes

/** Per-leg fetch timeout inside the x402 handshake */
const FETCH_TIMEOUT_MS = 30_000;

/** After x402Fetch returns, wait this long for DB write to settle before querying */
const INTENT_SETTLE_MS = 3_000;

/** Look back this far when querying payment intents for proof of seeding */
const INTENT_LOOKBACK_MS = 5_000;

// ─── Seedable service list (derived from canonical pricing) ───────────────────

export interface SeedableService {
  slug: string;
  priceUsd: number;
  /** Price in USDC microdollars (6-decimal precision) */
  priceMicro: bigint;
}

/**
 * Build the seedable service list from the canonical pricing table.
 *
 * Excludes:
 *   - $0-priced services (not payable)
 *   - Services priced ≥ MAX_SEED_PRICE_MICRO (too expensive to auto-seed)
 *   - Solana-only services (EVM seeder cannot pay them)
 *
 * Sorted cheapest-first so the most accessible services get indexed first.
 * Computed from SERVICE_PRICING_MICRO, so new services added to pricing.ts
 * are automatically included on next deploy.
 */
export function buildSeedableServices(): SeedableService[] {
  return Object.entries(SERVICE_PRICING_MICRO)
    .filter(([slug, priceMicro]) =>
      priceMicro > 0 &&
      priceMicro < MAX_SEED_PRICE_MICRO &&
      !SOLANA_ONLY_SLUGS.has(slug)
    )
    .map(([slug, priceMicro]) => ({
      slug,
      priceUsd: priceMicro / 1_000_000,
      priceMicro: BigInt(priceMicro),
    }))
    .sort((a, b) => a.priceUsd - b.priceUsd || a.slug.localeCompare(b.slug));
}

export const SEEDABLE_SERVICES: SeedableService[] = buildSeedableServices();

// ─── Job class ────────────────────────────────────────────────────────────────

export class X402BazaarSeederJob {
  private static intervalId: NodeJS.Timeout | null = null;
  private static consecutiveFailures = 0;
  private static circuitOpen = false;
  private static circuitOpenAt: Date | null = null;
  /** In-memory counter — not durable, resets on restart. Display only. */
  private static passesCompleted = 0;
  private static totalSeededThisSession = 0;
  private static lastRunAt: Date | null = null;
  private static lastSeededSlug: string | null = null;
  private static isRunning = false;

  // ─── Public API ────────────────────────────────────────────────────────────

  static start(intervalMs: number = SEEDER_INTERVAL_MS) {
    const isProduction = process.env.REPLIT_DEPLOYMENT === "1" || process.env.NODE_ENV === "production";
    const isDevLite = process.env.DEV_LITE_MODE === "true";

    if (!isProduction || isDevLite) {
      console.log("🪄  X402BazaarSeederJob: skipped (dev/non-production environment)");
      return;
    }

    if (this.intervalId) {
      console.log("🪄  X402BazaarSeederJob: already running");
      return;
    }

    const privateKey = process.env.X402_BUYER_PRIVATE_KEY || process.env.PLATFORM_EOA_PRIVATE_KEY;
    if (!privateKey) {
      console.error("❌ X402BazaarSeederJob: no wallet key (X402_BUYER_PRIVATE_KEY / PLATFORM_EOA_PRIVATE_KEY). Seeder disabled.");
      return;
    }

    console.log(
      `🪄  X402BazaarSeederJob: starting — ${SEEDABLE_SERVICES.length} seedable services ` +
      `(${SOLANA_ONLY_SLUGS.size} Solana-only excluded), ` +
      `interval=${intervalMs / 3_600_000}h, max_price=${MAX_SEED_PRICE_MICRO / 1_000_000} USDC`
    );

    // First run after 60s so the server is fully booted
    setTimeout(() => this.runSeeder(), 60_000);
    this.intervalId = setInterval(() => this.runSeeder(), intervalMs);
    this.intervalId.unref?.();
  }

  static stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  static async triggerNow(slugOverride?: string): Promise<void> {
    console.log("🪄  X402BazaarSeederJob: manual trigger" + (slugOverride ? ` (slug=${slugOverride})` : ""));
    this.circuitOpen = false;
    this.circuitOpenAt = null;
    this.consecutiveFailures = 0;
    await this.runSeeder(slugOverride);
  }

  static getStatus() {
    const msOpen = this.circuitOpenAt ? Date.now() - this.circuitOpenAt.getTime() : null;
    return {
      running: this.intervalId !== null,
      circuitOpen: this.circuitOpen,
      circuitOpenAt: this.circuitOpenAt,
      autoResetInMs: msOpen !== null ? Math.max(0, CIRCUIT_AUTO_RESET_MS - msOpen) : null,
      consecutiveFailures: this.consecutiveFailures,
      maxConsecutiveFailures: MAX_CONSECUTIVE_FAILURES,
      passesCompleted: this.passesCompleted,
      totalSeededThisSession: this.totalSeededThisSession,
      totalServices: SEEDABLE_SERVICES.length,
      solanaOnlyExcluded: SOLANA_ONLY_SLUGS.size,
      lastRunAt: this.lastRunAt,
      lastSeededSlug: this.lastSeededSlug,
      maxSeedPriceUsd: MAX_SEED_PRICE_MICRO / 1_000_000,
      intervalMs: SEEDER_INTERVAL_MS,
    };
  }

  /**
   * Query the CDP Bazaar API and return which of our services appear by our wallet.
   * Useful to verify indexing status after seeding.
   */
  static async queryBazaarIndex(): Promise<{ indexedSlugs: string[]; totalInBazaar: number; rawCount: number }> {
    const PLATFORM_WALLET = process.env.PLATFORM_WALLET_ADDRESS || "0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91";
    const BASE_URL = process.env.PUBLIC_URL || "https://coinrailz.com";
    const endpoint = `https://api.cdp.coinbase.com/platform/v2/x402/discovery/resources?payTo=${PLATFORM_WALLET}&limit=100`;

    try {
      const res = await fetch(endpoint, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) {
        return { indexedSlugs: [], totalInBazaar: 0, rawCount: 0 };
      }
      const data = await res.json() as { items?: Array<{ resource?: string }>; pagination?: { total?: number } };
      const items = data.items ?? [];
      const total = data.pagination?.total ?? items.length;

      // Extract slugs from URLs matching our domain
      const indexedSlugs: string[] = [];
      for (const item of items) {
        const url = item.resource ?? "";
        if (url.includes(BASE_URL) || url.includes("coinrailz.com")) {
          const match = url.match(/\/x402\/([a-z0-9-]+)/);
          if (match) indexedSlugs.push(match[1]);
        }
      }

      return { indexedSlugs, totalInBazaar: total, rawCount: items.length };
    } catch (err: any) {
      console.warn(`🪄  X402BazaarSeederJob: Bazaar query failed — ${err?.message}`);
      return { indexedSlugs: [], totalInBazaar: 0, rawCount: 0 };
    }
  }

  /**
   * Query the local DB to find which services have already received
   * a successful payment from the seeder/canary wallet.
   *
   * This is the DURABLE source of rotation state — survives restarts.
   * Uses the wallet address derived from the configured private key.
   */
  static async getSeededSlugs(): Promise<Set<string>> {
    const privateKey = process.env.X402_BUYER_PRIVATE_KEY || process.env.PLATFORM_EOA_PRIVATE_KEY;
    if (!privateKey) return new Set();

    try {
      const keyHex: Hex = privateKey.startsWith("0x") ? (privateKey as Hex) : (`0x${privateKey}` as Hex);
      const walletAddress = privateKeyToAccount(keyHex).address.toLowerCase();

      const rows = await db
        .select({ serviceName: x402PaymentIntents.serviceName })
        .from(x402PaymentIntents)
        .where(
          and(
            eq(x402PaymentIntents.status, "SUCCEEDED"),
            sql`lower(${x402PaymentIntents.payer}) = ${walletAddress}`
          )
        );

      return new Set(rows.map(r => r.serviceName));
    } catch (err: any) {
      console.warn(`🪄  X402BazaarSeederJob: DB query for seeded slugs failed — ${err?.message}`);
      return new Set();
    }
  }

  // ─── Core run loop ──────────────────────────────────────────────────────────

  private static async runSeeder(slugOverride?: string): Promise<void> {
    if (this.isRunning) {
      console.log("🪄  X402BazaarSeederJob: previous run still in progress — skipping");
      return;
    }

    // Circuit breaker check
    if (this.circuitOpen && !slugOverride) {
      const msOpen = this.circuitOpenAt ? Date.now() - this.circuitOpenAt.getTime() : Infinity;
      if (msOpen >= CIRCUIT_AUTO_RESET_MS) {
        console.warn(`🪄  X402BazaarSeederJob: circuit auto-reset after ${Math.round(msOpen / 60000)}min`);
        this.circuitOpen = false;
        this.circuitOpenAt = null;
        this.consecutiveFailures = 0;
      } else {
        const minsLeft = Math.round((CIRCUIT_AUTO_RESET_MS - msOpen) / 60000);
        console.warn(`🪄  X402BazaarSeederJob: circuit open — skipping (auto-reset in ~${minsLeft}min)`);
        return;
      }
    }

    const privateKey = process.env.X402_BUYER_PRIVATE_KEY || process.env.PLATFORM_EOA_PRIVATE_KEY;
    if (!privateKey) {
      console.error("🪄  X402BazaarSeederJob: no wallet key available — seeder disabled");
      return;
    }

    // ── Determine which service to seed ──────────────────────────────────────
    let target: SeedableService | undefined;

    if (slugOverride) {
      target = SEEDABLE_SERVICES.find(s => s.slug === slugOverride);
      if (!target) {
        const canonicalPrice = SERVICE_PRICING_MICRO[slugOverride as keyof typeof SERVICE_PRICING_MICRO];
        const isSolanaOnly = SOLANA_ONLY_SLUGS.has(slugOverride);
        console.warn(
          `🪄  X402BazaarSeederJob: slug "${slugOverride}" not in seedable list. ` +
          `canonical_price=${canonicalPrice ?? "unknown"} solana_only=${isSolanaOnly}`
        );
        return;
      }
    } else {
      // Query DB to find which services have already been seeded.
      // This is the DURABLE rotation state — correct after any restart.
      const seededSlugs = await this.getSeededSlugs();

      // Pick the first unseeded service in cheapest-first order
      target = SEEDABLE_SERVICES.find(s => !seededSlugs.has(s.slug));

      if (!target) {
        // All services seeded — complete pass, start over
        this.passesCompleted++;
        console.log(
          `🪄  X402BazaarSeederJob: 🎉 full pass #${this.passesCompleted} complete — ` +
          `all ${SEEDABLE_SERVICES.length} services have been seeded. Cycling for refresh.`
        );
        // On refresh passes, pick the first service (cheapest, good for freshness)
        target = SEEDABLE_SERVICES[0];
      }
    }

    if (!target) {
      console.warn("🪄  X402BazaarSeederJob: no target service — skipping");
      return;
    }

    const baseUrl = process.env.PUBLIC_URL || "https://coinrailz.com";
    const targetUrl = `${baseUrl}/x402/${target.slug}`;

    console.log(`🪄  X402BazaarSeederJob: seeding ${target.slug} ($${target.priceUsd}) → ${targetUrl}`);

    this.isRunning = true;
    this.lastRunAt = new Date();

    try {
      const keyHex: Hex = privateKey.startsWith("0x") ? (privateKey as Hex) : (`0x${privateKey}` as Hex);
      const account = privateKeyToAccount(keyHex);

      const publicClient = createPublicClient({ chain: base, transport: http() });
      const walletClient = createWalletClient({ account, chain: base, transport: http() });

      const evmSigner = {
        address: account.address,
        signTypedData: (args: any) => walletClient.signTypedData(args),
        readContract: (args: any) => publicClient.readContract(args),
        estimateFeesPerGas: () => publicClient.estimateFeesPerGas(),
        getTransactionCount: (args: any) => publicClient.getTransactionCount(args),
      };

      // Per-service payment cap: service price + 20% buffer (in microdollars).
      // 20% (not 10%) because on-chain fee calculations can slightly exceed the exact
      // canonical price. For approval-manager ($0.20): 200,000 + 40,000 = 240,000 cap,
      // which comfortably covers the canonical 200,000 requirement.
      const maxPaymentMicro = target.priceMicro + (target.priceMicro / BigInt(5));

      const client = new x402Client()
        .register("eip155:8453", new ExactEvmScheme(evmSigner))
        .registerPolicy((_version, reqs) =>
          reqs.filter(r => {
            try {
              // V2 uses "amount"; V1 uses "maxAmountRequired". Support both to be
              // compatible with any x402 version our server may emit.
              const amountStr = (r as any).amount ?? (r as any).maxAmountRequired;
              return BigInt(amountStr) <= maxPaymentMicro;
            } catch { return false; }
          })
        );

      const x402Fetch = wrapFetchWithPayment(X402BazaarSeederJob.boundFetch(FETCH_TIMEOUT_MS), client);

      const startedAt = new Date();

      // Hard timeout on the full payment round-trip
      const paymentTimeout = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`seed payment timed out after ${PAYMENT_TIMEOUT_MS / 1000}s`)),
          PAYMENT_TIMEOUT_MS
        )
      );

      // Make the x402 payment. The CDP facilitator verifies and records the payment
      // BEFORE the service handler runs. Bazaar indexing is triggered by that
      // facilitator settlement — so we check the payment intent, not the HTTP status.
      let fetchResponse: Response | null = null;
      try {
        fetchResponse = await Promise.race([
          x402Fetch(targetUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isBazaarSeed: true, service: target.slug }),
          }),
          paymentTimeout,
        ]);
        console.log(`🪄  X402BazaarSeederJob: x402Fetch returned status=${fetchResponse.status} for ${target.slug}`);
      } catch (fetchErr: any) {
        // Re-throw to outer catch — payment couldn't even be attempted
        throw fetchErr;
      }

      // ── Success criterion: check payment intent, not HTTP status ──────────
      // The CDP facilitator records the payment when it verifies it, which triggers
      // Bazaar indexing. The service handler may still return non-200 (e.g., missing
      // required fields in the seed payload) but the payment is already settled.
      await new Promise(r => setTimeout(r, INTENT_SETTLE_MS));

      const cutoff = new Date(startedAt.getTime() - INTENT_LOOKBACK_MS);
      const walletAddress = account.address.toLowerCase();

      const intentRows = await db
        .select({ txHash: x402PaymentIntents.txHash, serviceName: x402PaymentIntents.serviceName })
        .from(x402PaymentIntents)
        .where(
          and(
            eq(x402PaymentIntents.status, "SUCCEEDED"),
            eq(x402PaymentIntents.serviceName, target.slug),
            gte(x402PaymentIntents.createdAt, cutoff),
            sql`lower(${x402PaymentIntents.payer}) = ${walletAddress}`
          )
        )
        .orderBy(desc(x402PaymentIntents.createdAt))
        .limit(1);

      const intentFound = intentRows.length > 0;
      const txHash = intentRows[0]?.txHash ?? null;

      if (!intentFound) {
        // No payment intent found — payment did not go through the facilitator.
        // This means the x402 handshake failed entirely (e.g., policy rejected the offer,
        // insufficient balance, or the service isn't accepting the EVM network).
        throw new Error(
          `Payment did not settle: no SUCCEEDED intent found for ${target.slug} ` +
          `from wallet ${walletAddress} after ${INTENT_SETTLE_MS / 1000}s ` +
          `(HTTP status was ${fetchResponse?.status ?? "unknown"}). ` +
          `The service may not accept EVM payments or the wallet has insufficient USDC.`
        );
      }

      // Success — payment settled with the CDP facilitator
      this.consecutiveFailures = 0;
      this.totalSeededThisSession++;
      this.lastSeededSlug = target.slug;

      console.log(
        `🪄  X402BazaarSeederJob: ✅ seeded ${target.slug} — tx ${txHash ?? "pending"} ` +
        `HTTP_status=${fetchResponse?.status ?? "unknown"} session_total=${this.totalSeededThisSession}`
      );
    } catch (err: any) {
      const msg: string = err?.message ?? String(err);
      const msgLower = msg.toLowerCase();

      const isInsufficientFunds =
        msgLower.includes("insufficient") ||
        msgLower.includes("balance") ||
        msgLower.includes("funds");

      if (isInsufficientFunds) {
        // Low balance is not a circuit-breaker failure — just log and skip
        console.warn(`🪄  X402BazaarSeederJob: ⚠️  insufficient USDC — skipping ${target.slug}. Top up the canary wallet.`);
      } else {
        this.consecutiveFailures++;
        console.error(
          `🪄  X402BazaarSeederJob: ❌ failure #${this.consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES} ` +
          `for ${target.slug} — ${msg.substring(0, 300)}`
        );

        if (this.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          this.circuitOpen = true;
          this.circuitOpenAt = new Date();
          console.error(
            `🪄  X402BazaarSeederJob: 🔴 CIRCUIT OPEN after ${MAX_CONSECUTIVE_FAILURES} failures. ` +
            `Auto-reset in ${CIRCUIT_AUTO_RESET_MS / 3_600_000}h.`
          );
        }
      }
    } finally {
      this.isRunning = false;
    }
  }

  // ─── Fetch helpers ──────────────────────────────────────────────────────────

  private static fetchWithTimeout(url: RequestInfo | URL, init: RequestInit = {}, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
  }

  private static boundFetch(timeoutMs: number): typeof fetch {
    return (url: RequestInfo | URL, init?: RequestInit) =>
      X402BazaarSeederJob.fetchWithTimeout(url, init ?? {}, timeoutMs);
  }
}
