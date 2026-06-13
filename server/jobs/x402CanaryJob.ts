/**
 * x402 Canary Payment Job
 *
 * Runs every 6 hours (production only) and makes a real $0.05 USDC payment
 * against /x402/first-call using the platform's own wallet.
 *
 * PURPOSE:
 *   Every 402 challenge body includes a `confidenceMetrics.lastVerifiedPayment`
 *   field with a real on-chain tx hash + Basescan URL. Any agent evaluating the
 *   challenge can independently verify settlement actually works — no trust required.
 *
 * SAFETY:
 *   - Production / REPLIT_DEPLOYMENT only. Never fires in dev or DEV_LITE_MODE.
 *   - Circuit breaker: stops after 3 consecutive failures, requires restart to reset.
 *   - Insufficient USDC → graceful skip (logs warning, records 'skipped', no crash).
 *   - Canary payments tagged isCanary:true in metadata; excluded from organic analytics.
 *   - Uses global tx-hash replay protection (usedTransactionHashes unique index on txHash).
 */

import { createWalletClient, createPublicClient, http, Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { db } from "../db";
import { x402CanaryPayments, x402PaymentIntents } from "@shared/schema";
import { desc, eq, and, gte, sql } from "drizzle-orm";
import { invalidateCanaryCache } from "../middleware/x402ResponseEnricher";

const CANARY_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const MAX_CONSECUTIVE_FAILURES = 3;
const CANARY_AMOUNT_USD = "0.05";
const CANARY_SERVICE = "first-call";
const MAX_PAYMENT_MICRO = BigInt(100_000); // $0.10 max — safety margin above $0.05

export class X402CanaryJob {
  private static intervalId: NodeJS.Timeout | null = null;
  private static consecutiveFailures = 0;
  private static circuitOpen = false;
  private static lastSuccessAt: Date | null = null;

  static start(intervalMs: number = CANARY_INTERVAL_MS) {
    const isProduction = process.env.REPLIT_DEPLOYMENT === "1" || process.env.NODE_ENV === "production";
    const isDevLite = process.env.DEV_LITE_MODE === "true";

    if (!isProduction || isDevLite) {
      console.log("🕯️  X402CanaryJob: skipped (dev/non-production environment)");
      return;
    }

    if (this.intervalId) {
      console.log("🕯️  X402CanaryJob: already running");
      return;
    }

    const privateKey = process.env.X402_BUYER_PRIVATE_KEY || process.env.PLATFORM_EOA_PRIVATE_KEY;
    if (!privateKey) {
      console.error("❌ X402CanaryJob: no wallet key available (X402_BUYER_PRIVATE_KEY / PLATFORM_EOA_PRIVATE_KEY). Canary disabled.");
      return;
    }

    console.log(`🕯️  X402CanaryJob: starting — interval ${intervalMs / 3600000}h, circuit breaker at ${MAX_CONSECUTIVE_FAILURES} failures`);

    // Run immediately on startup (after brief delay so server is fully ready), then on interval
    setTimeout(() => this.runCanary(), 30_000);

    this.intervalId = setInterval(() => this.runCanary(), intervalMs);
    this.intervalId.unref?.();
  }

  static stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  static getStatus() {
    return {
      running: this.intervalId !== null,
      circuitOpen: this.circuitOpen,
      consecutiveFailures: this.consecutiveFailures,
      lastSuccessAt: this.lastSuccessAt,
    };
  }

  private static async runCanary(): Promise<void> {
    if (this.circuitOpen) {
      console.warn("🕯️  X402CanaryJob: circuit open — skipping run. Restart server to reset.");
      return;
    }

    const privateKey = process.env.X402_BUYER_PRIVATE_KEY || process.env.PLATFORM_EOA_PRIVATE_KEY;
    if (!privateKey) {
      await this.recordResult("skipped", undefined, "No wallet key available");
      return;
    }

    const baseUrl = process.env.PUBLIC_URL || "https://coinrailz.com";
    const targetUrl = `${baseUrl}/x402/first-call`;

    console.log(`🕯️  X402CanaryJob: firing canary payment → ${targetUrl}`);

    try {
      const keyHex: Hex = privateKey.startsWith("0x") ? (privateKey as Hex) : (`0x${privateKey}` as Hex);
      const account = privateKeyToAccount(keyHex);

      const walletClient = createWalletClient({
        account,
        chain: base,
        transport: http(),
      });

      // @x402/fetch 2.x — 2-arg API: wrapFetchWithPayment(fetch, x402Client)
      // Payment cap enforced via registerPolicy (replaces old 3rd-arg MAX_PAYMENT_MICRO)
      //
      // IMPORTANT: toClientEvmSigner(walletClient) reads signer.address directly, but
      // viem WalletClient stores the address at account.address, not .address.
      // That causes ExactEvmScheme to receive address=undefined and throw
      // "Address 'undefined' is invalid". Construct ClientEvmSigner manually.
      //
      // We also compose a publicClient so ExactEvmScheme has readContract,
      // estimateFeesPerGas, etc. for optional Permit2 extension paths.
      const publicClient = createPublicClient({ chain: base, transport: http() });
      const evmSigner = {
        address: account.address,
        signTypedData: (args: any) => walletClient.signTypedData(args),
        readContract: (args: any) => publicClient.readContract(args),
        estimateFeesPerGas: () => publicClient.estimateFeesPerGas(),
        getTransactionCount: (args: any) => publicClient.getTransactionCount(args),
      };
      const client = new x402Client()
        .register('eip155:8453', new ExactEvmScheme(evmSigner))
        .registerPolicy((_version, reqs) =>
          reqs.filter(r => {
            try { return BigInt(r.maxAmountRequired) <= MAX_PAYMENT_MICRO; }
            catch { return false; }
          })
        );

      const x402Fetch = wrapFetchWithPayment(fetch, client);

      const startedAt = new Date();

      // Run the normal-path probe first (no payment, no special headers) to confirm
      // that the default 402 challenge emits CAIP-2 and is parseable by @x402/fetch 2.x.
      await X402CanaryJob.runNormalPathProbe(targetUrl);

      const response = await x402Fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: "canary-health-check", isCanary: true }),
      });

      if (response.status !== 200) {
        const body = await response.text().catch(() => "");
        throw new Error(`Unexpected status ${response.status}: ${body.substring(0, 200)}`);
      }

      // Brief wait for the server-side DB write to complete before querying
      await new Promise((r) => setTimeout(r, 3000));

      // Retrieve the tx hash from x402_payment_intents, scoped to the canary wallet address
      // to prevent organic concurrent payments from being mis-attributed as canary proof.
      const cutoff = new Date(startedAt.getTime() - 5000); // 5s before we started
      const keyHexForLookup: Hex = privateKey.startsWith("0x") ? (privateKey as Hex) : (`0x${privateKey}` as Hex);
      const canaryAddress = privateKeyToAccount(keyHexForLookup).address.toLowerCase();

      const recentIntent = await db
        .select({ txHash: x402PaymentIntents.txHash, network: x402PaymentIntents.network })
        .from(x402PaymentIntents)
        .where(
          and(
            eq(x402PaymentIntents.status, "SUCCEEDED"),
            eq(x402PaymentIntents.serviceName, CANARY_SERVICE),
            gte(x402PaymentIntents.createdAt, cutoff),
            sql`lower(${x402PaymentIntents.payer}) = ${canaryAddress}`
          )
        )
        .orderBy(desc(x402PaymentIntents.createdAt))
        .limit(1);

      const txHash = recentIntent[0]?.txHash ?? null;
      const network = recentIntent[0]?.network ?? "base";
      const explorerUrl = txHash ? buildExplorerUrl(txHash, network) : null;

      await this.recordResult("succeeded", txHash, undefined, explorerUrl);

      this.consecutiveFailures = 0;
      this.lastSuccessAt = new Date();

      // Flush the enricher cache so the very next 402 challenge body picks up the fresh tx hash
      invalidateCanaryCache();

      console.log(`🕯️  X402CanaryJob: ✅ canary payment succeeded${txHash ? ` — tx ${txHash}` : " (tx hash pending)"}`);
      if (explorerUrl) console.log(`🕯️  X402CanaryJob: 🔗 ${explorerUrl}`);
    } catch (err: any) {
      const msg: string = err?.message ?? String(err);
      this.consecutiveFailures++;

      const isInsufficientFunds =
        msg.toLowerCase().includes("insufficient") ||
        msg.toLowerCase().includes("balance") ||
        msg.toLowerCase().includes("funds");

      if (isInsufficientFunds) {
        console.warn(`🕯️  X402CanaryJob: ⚠️  insufficient USDC balance — skipping canary. Top up the canary wallet.`);
        await this.recordResult("skipped", undefined, "Insufficient USDC balance");
        // Don't count insufficient funds toward circuit breaker — it's an ops issue not a code failure
        this.consecutiveFailures = Math.max(0, this.consecutiveFailures - 1);
        return;
      }

      console.error(`🕯️  X402CanaryJob: ❌ failure #${this.consecutiveFailures} — ${msg}`);
      await this.recordResult("failed", undefined, msg.substring(0, 500));

      if (this.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        this.circuitOpen = true;
        console.error(
          `🕯️  X402CanaryJob: 🔴 CIRCUIT OPEN after ${MAX_CONSECUTIVE_FAILURES} consecutive failures. ` +
          `Canary suspended. Restart server or call X402CanaryJob.resetCircuit() to resume.`
        );
      }
    }
  }

  static resetCircuit() {
    this.circuitOpen = false;
    this.consecutiveFailures = 0;
    console.log("🕯️  X402CanaryJob: circuit reset — will run at next scheduled interval");
  }

  static async triggerNow(): Promise<void> {
    console.log("🕯️  X402CanaryJob: manual trigger requested");
    this.circuitOpen = false;
    this.consecutiveFailures = 0;
    await this.runCanary();
  }

  /**
   * Normal-path probe: fires a raw HEAD request to the target (no payment, no special headers)
   * and validates that the 402 challenge emits CAIP-2 network format ("eip155:8453").
   * Logs a warning if "base" shorthand is detected — that would silently block @x402/fetch 2.x agents.
   * This runs on every canary cycle and costs zero USDC.
   */
  private static async runNormalPathProbe(targetUrl: string): Promise<void> {
    try {
      const res = await fetch(targetUrl, { method: "HEAD" });
      if (res.status !== 402) {
        console.warn(`🕯️  NormalPathProbe: expected 402, got ${res.status} — probe inconclusive`);
        return;
      }
      // HEAD responses have no body; re-probe with GET to read the challenge JSON
      const res2 = await fetch(targetUrl, { method: "GET" });
      const text = await res2.text().catch(() => "");
      let network: string | undefined;
      try {
        const json = JSON.parse(text);
        network = json?.accepts?.[0]?.network ?? json?.network;
      } catch {
        console.warn(`🕯️  NormalPathProbe: could not parse 402 body — probe inconclusive`);
        return;
      }

      if (!network) {
        console.warn(`🕯️  NormalPathProbe: ⚠️  no network field in 402 challenge`);
      } else if (network === "eip155:8453") {
        console.log(`🕯️  NormalPathProbe: ✅ network="${network}" — CAIP-2 correct, @x402/fetch 2.x will parse`);
      } else {
        console.error(
          `🕯️  NormalPathProbe: ❌ network="${network}" — shorthand detected on default path. ` +
          `@x402/fetch 2.x agents CANNOT pay (no alias map). Fix: emit "eip155:8453" in 402 challenge.`
        );
      }
    } catch (err: any) {
      console.warn(`🕯️  NormalPathProbe: probe error (non-fatal) — ${err?.message}`);
    }
  }

  private static async recordResult(
    status: "succeeded" | "failed" | "skipped",
    txHash?: string | null,
    errorMessage?: string,
    explorerUrl?: string | null
  ): Promise<void> {
    try {
      await db.insert(x402CanaryPayments).values({
        txHash: txHash ?? null,
        explorerUrl: explorerUrl ?? null,
        amountUsd: CANARY_AMOUNT_USD,
        network: "base",
        service: CANARY_SERVICE,
        status,
        errorMessage: errorMessage ?? null,
      });
    } catch (dbErr: any) {
      console.error("🕯️  X402CanaryJob: failed to record result to DB (non-fatal):", dbErr.message);
    }
  }
}

function buildExplorerUrl(txHash: string, network: string): string {
  if (network.includes("solana")) {
    return `https://solscan.io/tx/${txHash}`;
  }
  if (network === "eip155:42161" || network === "arbitrum") {
    return `https://arbiscan.io/tx/${txHash}`;
  }
  if (network === "eip155:137" || network === "polygon") {
    return `https://polygonscan.com/tx/${txHash}`;
  }
  // Default: Base (most canary payments will be here)
  return `https://basescan.org/tx/${txHash}`;
}
