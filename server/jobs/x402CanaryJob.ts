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

const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
const TOPUP_THRESHOLD_ATOMIC = BigInt(2_000_000);  // $2.00 — trigger top-up below this
const TOPUP_AMOUNT_ATOMIC     = BigInt(10_000_000); // $10.00 — funds ~200 canary runs

const USDC_ABI = [
  { name: "balanceOf", type: "function", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { name: "transfer",  type: "function", inputs: [{ name: "to", type: "address" }, { name: "value", type: "uint256" }], outputs: [{ name: "", type: "bool" }], stateMutability: "nonpayable" },
] as const;

const CANARY_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const MAX_CONSECUTIVE_FAILURES = 5;            // raised from 3 — transient RPC failures need more headroom
const CIRCUIT_AUTO_RESET_MS   = 2 * 60 * 60 * 1000; // 2h — self-heal after one missed interval
const TRANSIENT_RETRY_DELAY_MS = 90_000;       // 90s wait before single retry on transient RPC errors
const CANARY_AMOUNT_USD = "0.05";
const CANARY_SERVICE = "first-call";
const MAX_PAYMENT_MICRO = BigInt(100_000); // $0.10 max — safety margin above $0.05

const TRANSIENT_ERROR_PATTERNS = [
  "missing or invalid parameters",
  "nonce too low",
  "replacement transaction underpriced",
  "already known",
  "transaction underpriced",
  "intrinsic gas too low",
];

export class X402CanaryJob {
  private static intervalId: NodeJS.Timeout | null = null;
  private static consecutiveFailures = 0;
  private static circuitOpen = false;
  private static circuitOpenAt: Date | null = null;
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
    const msOpen = this.circuitOpenAt ? Date.now() - this.circuitOpenAt.getTime() : null;
    return {
      running: this.intervalId !== null,
      circuitOpen: this.circuitOpen,
      circuitOpenAt: this.circuitOpenAt,
      autoResetInMs: msOpen !== null ? Math.max(0, CIRCUIT_AUTO_RESET_MS - msOpen) : null,
      consecutiveFailures: this.consecutiveFailures,
      maxConsecutiveFailures: MAX_CONSECUTIVE_FAILURES,
      lastSuccessAt: this.lastSuccessAt,
    };
  }

  /**
   * Auto-top-up the canary buyer wallet from the platform wallet when USDC balance
   * drops below TOPUP_THRESHOLD_ATOMIC. Transfers TOPUP_AMOUNT_ATOMIC from EVM_PRIVATE_KEY
   * (the platform/payTo wallet) to the canary buyer wallet. Non-fatal: logs and continues
   * if the top-up fails (e.g., platform wallet also empty).
   */
  private static async topUpIfNeeded(buyerAddress: string): Promise<void> {
    try {
      const publicClient = createPublicClient({ chain: base, transport: http() });

      const balance = await publicClient.readContract({
        address: USDC_BASE,
        abi: USDC_ABI,
        functionName: "balanceOf",
        args: [buyerAddress as `0x${string}`],
      }) as bigint;

      if (balance >= TOPUP_THRESHOLD_ATOMIC) {
        console.log(`🕯️  X402CanaryJob: canary wallet balance $${(Number(balance) / 1e6).toFixed(4)} USDC — no top-up needed`);
        return;
      }

      console.warn(`🕯️  X402CanaryJob: ⚠️  canary wallet low ($${(Number(balance) / 1e6).toFixed(4)} USDC) — topping up $${(Number(TOPUP_AMOUNT_ATOMIC) / 1e6).toFixed(2)} from platform wallet`);

      const platformKey = process.env.EVM_PRIVATE_KEY;
      if (!platformKey) {
        console.warn("🕯️  X402CanaryJob: EVM_PRIVATE_KEY not set — cannot auto-top-up canary wallet");
        return;
      }

      const platformKeyHex: Hex = platformKey.startsWith("0x") ? (platformKey as Hex) : (`0x${platformKey}` as Hex);
      const platformAccount = privateKeyToAccount(platformKeyHex);
      const platformClient = createWalletClient({ account: platformAccount, chain: base, transport: http() });

      const txHash = await platformClient.writeContract({
        address: USDC_BASE,
        abi: USDC_ABI,
        functionName: "transfer",
        args: [buyerAddress as `0x${string}`, TOPUP_AMOUNT_ATOMIC],
      });

      console.log(`🕯️  X402CanaryJob: 💰 top-up sent — tx ${txHash}. Waiting for confirmation…`);
      await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 30_000 });
      console.log(`🕯️  X402CanaryJob: ✅ top-up confirmed — canary wallet now has $${(Number(balance + TOPUP_AMOUNT_ATOMIC) / 1e6).toFixed(2)} USDC`);
    } catch (err: any) {
      console.warn(`🕯️  X402CanaryJob: top-up failed (non-fatal) — ${err?.message ?? String(err)}`);
    }
  }

  private static async runCanary(isRetry = false): Promise<void> {
    if (this.circuitOpen) {
      const msOpen = this.circuitOpenAt ? Date.now() - this.circuitOpenAt.getTime() : Infinity;
      if (msOpen >= CIRCUIT_AUTO_RESET_MS) {
        console.warn(`🕯️  X402CanaryJob: circuit auto-reset after ${Math.round(msOpen / 60000)}min — retrying`);
        this.circuitOpen = false;
        this.circuitOpenAt = null;
        this.consecutiveFailures = 0;
      } else {
        const minsLeft = Math.round((CIRCUIT_AUTO_RESET_MS - msOpen) / 60000);
        console.warn(`🕯️  X402CanaryJob: circuit open — skipping (auto-reset in ~${minsLeft}min)`);
        return;
      }
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

      // Auto-top-up from platform wallet if canary wallet USDC balance is low
      await X402CanaryJob.topUpIfNeeded(account.address);

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

      // Use boundFetch (30s per leg) so every HTTP call inside the x402 handshake
      // is time-bounded. This prevents the canary from hanging indefinitely on a
      // slow/stalled RPC or server response, which was causing recordResult() to
      // never be called and leaving no DB trace.
      const PAYMENT_TIMEOUT_MS = 90_000; // 90s hard cap on the full payment round-trip
      const x402Fetch = wrapFetchWithPayment(X402CanaryJob.boundFetch(30_000), client);

      const startedAt = new Date();

      // Run the normal-path probe first (no payment, no special headers) to confirm
      // that the default 402 challenge emits CAIP-2 and is parseable by @x402/fetch 2.x.
      await X402CanaryJob.runNormalPathProbe(targetUrl);

      // Wrap the entire payment attempt in a hard timeout so a hang can never
      // prevent recordResult() from running.
      const paymentTimeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`canary payment timed out after ${PAYMENT_TIMEOUT_MS / 1000}s`)), PAYMENT_TIMEOUT_MS)
      );

      console.log(`🕯️  X402CanaryJob: [step 2/5] sending x402Fetch POST (90s hard cap)`);
      const response = await Promise.race([
        x402Fetch(targetUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: "canary-health-check", isCanary: true }),
        }),
        paymentTimeout,
      ]);
      console.log(`🕯️  X402CanaryJob: [step 3/5] x402Fetch returned status=${response.status}`);

      if (response.status !== 200) {
        const body = await response.text().catch(() => "");
        throw new Error(`Unexpected status ${response.status}: ${body.substring(0, 200)}`);
      }

      // Brief wait for the server-side DB write to complete before querying
      await new Promise((r) => setTimeout(r, 3000));

      // Retrieve the tx hash from x402_payment_intents, scoped to the canary wallet address
      // to prevent organic concurrent payments from being mis-attributed as canary proof.
      console.log(`🕯️  X402CanaryJob: [step 4/5] querying payment_intents for tx hash`);
      const cutoff = new Date(startedAt.getTime() - 5000); // 5s before we started
      const keyHexForLookup: Hex = privateKey.startsWith("0x") ? (privateKey as Hex) : (`0x${privateKey}` as Hex);
      const canaryAddress = privateKeyToAccount(keyHexForLookup).address.toLowerCase();

      const DB_TIMEOUT_MS = 10_000;
      const dbTimeout = <T>(p: Promise<T>, label: string): Promise<T> =>
        Promise.race([
          p,
          new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error(`DB operation timed out after ${DB_TIMEOUT_MS / 1000}s: ${label}`)), DB_TIMEOUT_MS)
          ),
        ]);

      const recentIntent = await dbTimeout(
        db
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
          .limit(1),
        "lookup payment_intents"
      );

      const txHash = recentIntent[0]?.txHash ?? null;
      const network = recentIntent[0]?.network ?? "base";
      const explorerUrl = txHash ? buildExplorerUrl(txHash, network) : null;
      console.log(`🕯️  X402CanaryJob: [step 5/5] calling recordResult (txHash=${txHash ?? "null"})`);

      // Guard: if the server returned 200 but no on-chain tx was found, treat as failure.
      // This prevents false-positive "succeeded" rows with null tx_hash in the DB.
      if (!txHash) {
        throw new Error(
          "Payment endpoint returned 200 but no confirmed tx_hash found in x402_payment_intents " +
          `(canary address=${canaryAddress}, cutoff=${cutoff.toISOString()}). ` +
          "Possible: server returned 200 without processing payment, or DB write raced past the 3s wait."
        );
      }

      await this.recordResult("succeeded", txHash, undefined, explorerUrl);

      this.consecutiveFailures = 0;
      this.lastSuccessAt = new Date();

      // Flush the enricher cache so the very next 402 challenge body picks up the fresh tx hash
      invalidateCanaryCache();

      console.log(`🕯️  X402CanaryJob: ✅ canary payment succeeded${txHash ? ` — tx ${txHash}` : " (tx hash pending)"}`);
      if (explorerUrl) console.log(`🕯️  X402CanaryJob: 🔗 ${explorerUrl}`);
    } catch (err: any) {
      const msg: string = err?.message ?? String(err);
      const msgLower = msg.toLowerCase();

      const isInsufficientFunds =
        msgLower.includes("insufficient") ||
        msgLower.includes("balance") ||
        msgLower.includes("funds");

      if (isInsufficientFunds) {
        console.warn(`🕯️  X402CanaryJob: ⚠️  insufficient USDC balance — skipping canary. Top up the canary wallet.`);
        await this.recordResult("skipped", undefined, "Insufficient USDC balance");
        return;
      }

      // Transient RPC error: wait 90s and retry once before counting as a failure
      const isTransient = !isRetry && TRANSIENT_ERROR_PATTERNS.some(p => msgLower.includes(p));
      if (isTransient) {
        console.warn(`🕯️  X402CanaryJob: ⚠️  transient RPC error — retrying in ${TRANSIENT_RETRY_DELAY_MS / 1000}s: ${msg.substring(0, 120)}`);
        await new Promise(r => setTimeout(r, TRANSIENT_RETRY_DELAY_MS));
        return this.runCanary(true);
      }

      this.consecutiveFailures++;
      console.error(`🕯️  X402CanaryJob: ❌ failure #${this.consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES} — ${msg}`);
      await this.recordResult("failed", undefined, msg.substring(0, 500));

      if (this.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        this.circuitOpen = true;
        this.circuitOpenAt = new Date();
        console.error(
          `🕯️  X402CanaryJob: 🔴 CIRCUIT OPEN after ${MAX_CONSECUTIVE_FAILURES} consecutive failures. ` +
          `Will auto-reset in ${CIRCUIT_AUTO_RESET_MS / 3600000}h — or call X402CanaryJob.resetCircuit() to reset now.`
        );
      }
    }
  }

  static resetCircuit() {
    this.circuitOpen = false;
    this.circuitOpenAt = null;
    this.consecutiveFailures = 0;
    console.log("🕯️  X402CanaryJob: circuit reset — will run at next scheduled interval");
  }

  static async triggerNow(): Promise<void> {
    console.log("🕯️  X402CanaryJob: manual trigger requested");
    this.circuitOpen = false;
    this.circuitOpenAt = null;
    this.consecutiveFailures = 0;
    await this.runCanary();
  }

  /**
   * Unconditionally top up the canary wallet from EVM_PRIVATE_KEY,
   * regardless of current balance. Returns a status object.
   */
  static async forceTopUp(): Promise<{ success: boolean; message: string; txHash?: string }> {
    const buyerKey = process.env.X402_BUYER_PRIVATE_KEY || process.env.PLATFORM_EOA_PRIVATE_KEY;
    if (!buyerKey) {
      return { success: false, message: "X402_BUYER_PRIVATE_KEY not set — cannot determine canary wallet address" };
    }
    const platformKey = process.env.EVM_PRIVATE_KEY;
    if (!platformKey) {
      return { success: false, message: "EVM_PRIVATE_KEY not set — no funding source available" };
    }

    try {
      const { createWalletClient, createPublicClient, http } = await import("viem");
      const { privateKeyToAccount } = await import("viem/accounts");
      const { base } = await import("viem/chains");
      type Hex = `0x${string}`;

      const buyerKeyHex: Hex = buyerKey.startsWith("0x") ? (buyerKey as Hex) : (`0x${buyerKey}` as Hex);
      const buyerAddress = privateKeyToAccount(buyerKeyHex).address;

      const platformKeyHex: Hex = platformKey.startsWith("0x") ? (platformKey as Hex) : (`0x${platformKey}` as Hex);
      const platformAccount = privateKeyToAccount(platformKeyHex);
      const platformClient = createWalletClient({ account: platformAccount, chain: base, transport: http() });
      const publicClient = createPublicClient({ chain: base, transport: http() });

      const balanceBefore = await publicClient.readContract({
        address: USDC_BASE,
        abi: USDC_ABI,
        functionName: "balanceOf",
        args: [buyerAddress],
      }) as bigint;

      // Skip transfer if canary wallet already has sufficient balance
      if (balanceBefore >= TOPUP_THRESHOLD_ATOMIC) {
        const msg = `Canary wallet already has $${(Number(balanceBefore) / 1e6).toFixed(4)} USDC (≥ $${(Number(TOPUP_THRESHOLD_ATOMIC) / 1e6).toFixed(2)} threshold) — no top-up needed`;
        console.log(`🕯️  X402CanaryJob.forceTopUp: ✅ ${msg}`);
        return { success: true, message: msg };
      }

      console.log(`🕯️  X402CanaryJob.forceTopUp: canary wallet balance $${(Number(balanceBefore) / 1e6).toFixed(4)} — sending $${(Number(TOPUP_AMOUNT_ATOMIC) / 1e6).toFixed(2)} USDC`);

      const txHash = await platformClient.writeContract({
        address: USDC_BASE,
        abi: USDC_ABI,
        functionName: "transfer",
        args: [buyerAddress, TOPUP_AMOUNT_ATOMIC],
      });

      console.log(`🕯️  X402CanaryJob.forceTopUp: tx sent ${txHash} — waiting for confirmation`);
      await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 60_000 });

      const balanceAfter = (Number(balanceBefore) + Number(TOPUP_AMOUNT_ATOMIC)) / 1e6;
      const msg = `Top-up confirmed. Canary wallet now ~$${balanceAfter.toFixed(2)} USDC. tx: ${txHash}`;
      console.log(`🕯️  X402CanaryJob.forceTopUp: ✅ ${msg}`);
      return { success: true, message: msg, txHash };
    } catch (err: any) {
      const msg = `forceTopUp failed: ${err?.message ?? String(err)}`;
      console.error(`🕯️  X402CanaryJob.forceTopUp: ❌ ${msg}`);
      return { success: false, message: msg };
    }
  }

  /**
   * Fetch wrapper that enforces a hard timeout via AbortController.
   * Signature matches globalThis.fetch so it can be passed to wrapFetchWithPayment.
   * Prevents any single fetch from hanging indefinitely inside the canary.
   */
  private static fetchWithTimeout(url: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 30_000): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
  }

  /**
   * Returns a fetch function bound to a fixed timeout — used as the transport
   * passed to wrapFetchWithPayment so every leg of the x402 handshake is time-bounded.
   */
  private static boundFetch(timeoutMs: number): typeof fetch {
    return (url: RequestInfo | URL, init?: RequestInit) =>
      X402CanaryJob.fetchWithTimeout(url, init ?? {}, timeoutMs);
  }

  /**
   * Normal-path probe: fires a raw HEAD request to the target (no payment, no special headers)
   * and validates that the 402 challenge emits CAIP-2 network format ("eip155:8453").
   * Logs a warning if "base" shorthand is detected — that would silently block @x402/fetch 2.x agents.
   * This runs on every canary cycle and costs zero USDC.
   */
  private static async runNormalPathProbe(targetUrl: string): Promise<void> {
    try {
      console.log(`🕯️  NormalPathProbe: [1/3] sending HEAD → ${targetUrl}`);
      const res = await X402CanaryJob.fetchWithTimeout(targetUrl, { method: "HEAD" }, 30_000);
      console.log(`🕯️  NormalPathProbe: [2/3] HEAD returned ${res.status}`);
      if (res.status !== 402) {
        console.warn(`🕯️  NormalPathProbe: expected 402, got ${res.status} — probe inconclusive`);
        return;
      }
      // HEAD responses have no body; re-probe with GET to read the challenge JSON
      console.log(`🕯️  NormalPathProbe: [3/3] sending GET to read 402 body`);
      const res2 = await X402CanaryJob.fetchWithTimeout(targetUrl, { method: "GET" }, 30_000);
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
    console.log(`🕯️  X402CanaryJob: recording DB result — status=${status} txHash=${txHash ?? "null"}`);
    try {
      const insertPromise = db.insert(x402CanaryPayments).values({
        txHash: txHash ?? null,
        explorerUrl: explorerUrl ?? null,
        amountUsd: CANARY_AMOUNT_USD,
        network: "base",
        service: CANARY_SERVICE,
        status,
        errorMessage: errorMessage ?? null,
      });
      // Hard 10s timeout on the insert — prevents the canary from hanging on a
      // stalled DB connection and leaving no trace.
      await Promise.race([
        insertPromise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("DB insert timed out after 10s")), 10_000)
        ),
      ]);
      console.log(`🕯️  X402CanaryJob: ✅ DB record written (status=${status})`);
    } catch (dbErr: any) {
      console.error(`🕯️  X402CanaryJob: ❌ DB write failed — ${dbErr?.message ?? String(dbErr)}`);
      console.error(`🕯️  X402CanaryJob: ❌ DB error stack: ${dbErr?.stack?.substring(0, 400)}`);
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
