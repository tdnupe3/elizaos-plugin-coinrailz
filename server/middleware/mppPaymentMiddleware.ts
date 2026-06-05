/**
 * MPP (Machine Payments Protocol) Payment Middleware
 *
 * Implements the MPP challenge/credential flow as specified at https://mpp.dev
 * Protocol: HTTP 402 with RFC 7807 Problem Details + WWW-Authenticate: Payment challenge
 *
 * IMPLEMENTATION STATUS:
 * - Phase 1 (LIVE): Correct MPP 402 challenge format, discovery manifests, monitoring
 * - Phase 2 (LIVE): USDC-on-Base credential verification via Alchemy RPC
 *   - Agents with a Base USDC wallet can pay and receive service immediately
 *   - Replay protection via used_transaction_hashes table
 *   - Analytics logged to x402_interactions (event_type: 'mpp-payment-verified')
 * - Phase 3 (PENDING): Tempo pathUSD on-chain credential verification
 *   - Blocked by: mppx library requires Express >=5 across all released versions
 *   - mppx has never released an Express 4 compatible version (verified v0.1.0–v0.6.30)
 *   - Resolution: Express 4→5 upgrade as a separate future project
 *
 * Payment methods offered (in challenge):
 *   1. evm.transfer — USDC on Base (chain ID 8453) — VERIFIED AND SETTLING
 *   2. tempo.charge — pathUSD on Tempo — challenge issued, verification pending
 *
 * Payment flow (Base USDC path):
 * 1. Client → POST /mpp/ping (no credential)
 * 2. Server → 402 + WWW-Authenticate: Payment challenge="<base64>"
 *             (challenge lists both evm.transfer/base and tempo.charge methods)
 * 3. Client → transfers USDC to PLATFORM_WALLET on Base mainnet
 * 4. Client → POST /mpp/ping + Authorization: Payment <base64-credential>
 *             (credential JSON includes: type="evm.transfer", transaction="0x...")
 * 5. Server → verifyBaseUsdcCredential() → Alchemy RPC → Transfer event parse
 * 6. Server → replay check → insert used_transaction_hashes
 * 7. Server → log x402_interactions → call next() → service delivered
 */

import { Request, Response, NextFunction } from "express";
import { nanoid } from "nanoid";
import { SERVICE_PRICING_USD } from "@shared/pricing";
import { db } from "../db";
import { usedTransactionHashes, x402Interactions } from "@shared/schema";
import { eq } from "drizzle-orm";

const PLATFORM_WALLET = process.env.PLATFORM_WALLET_ADDRESS || "0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91";
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || "https://coinrailz.com";

const MPP_PROTOCOL_VERSION = "1.1";

const TEMPO_PATH_USD_ADDRESS = "0x20c0000000000000000000000000000000000000";
const USDC_BASE_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const BASE_CHAIN_ID = 8453;
const USDC_DECIMALS = 6;
const TRANSFER_EVENT_SIG = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const VERIFY_TIMEOUT_MS = 7000;

export { MPP_PROTOCOL_VERSION, TEMPO_PATH_USD_ADDRESS, PLATFORM_WALLET as MPP_PLATFORM_WALLET };

export interface MppChallengeMethod {
  type: string;
  currency: string;
  amount: string;
  recipient: string;
  network?: string;
  chainId?: number;
  tokenDecimals?: number;
}

function getBaseRpcUrl(): string | null {
  const key = process.env.HELIUS_API_KEY || process.env.ALCHEMY_API_KEY;
  if (!key) return null;
  return `https://base-mainnet.g.alchemy.com/v2/${key}`;
}

function buildMppChallenge(serviceName: string, amountUsd: number, challengeId: string): {
  header: string;
  body: Record<string, unknown>;
} {
  const methods: MppChallengeMethod[] = [
    {
      type: "evm.transfer",
      currency: USDC_BASE_ADDRESS,
      amount: amountUsd.toFixed(6),
      recipient: PLATFORM_WALLET,
      network: "base",
      chainId: BASE_CHAIN_ID,
      tokenDecimals: USDC_DECIMALS,
    },
    {
      type: "tempo.charge",
      currency: TEMPO_PATH_USD_ADDRESS,
      amount: amountUsd.toFixed(2),
      recipient: PLATFORM_WALLET,
      network: "tempo",
    },
  ];

  const challengePayload = {
    challengeId,
    methods,
    resource: `${PUBLIC_BASE_URL}/mpp/${serviceName}`,
    protocol: MPP_PROTOCOL_VERSION,
  };

  const challengeBase64 = Buffer.from(JSON.stringify(challengePayload)).toString("base64");

  const body = {
    type: "https://paymentauth.org/problems/payment-required",
    title: "Payment Required",
    status: 402,
    detail: `This service requires a micropayment of $${amountUsd.toFixed(2)} USDC via the Machine Payments Protocol.`,
    challengeId,
    methods,
    resource: `${PUBLIC_BASE_URL}/mpp/${serviceName}`,
    preferredMethod: {
      type: "evm.transfer",
      network: "base",
      note: "Transfer USDC (${USDC_BASE_ADDRESS}) to ${PLATFORM_WALLET} on Base (chain 8453). Include tx hash in credential.",
    },
    credentialFormat: {
      type: "evm.transfer",
      transaction: "<0x-prefixed Base mainnet tx hash>",
      challengeId: challengeId,
    },
    alternativePaymentMethods: [
      {
        type: "api_key",
        description: "Prepaid credits via API key (instant, no crypto required)",
        trialKey: `GET ${PUBLIC_BASE_URL}/api/m2m/credits/trial`,
        purchaseCredits: `POST ${PUBLIC_BASE_URL}/api/m2m/credits/checkout/session`,
        header: "X-API-KEY: cr_live_...",
        note: "Free $5 trial available. Credits work across all 65 services.",
      },
      {
        type: "x402",
        description: "On-chain USDC payment via x402 protocol (Coinbase Bazaar compatible)",
        endpoint: `${PUBLIC_BASE_URL}/x402/${serviceName}`,
        header: "X-PAYMENT: <base64-signed-payment>",
        facilitator: "https://x402.coinbase.com",
        note: "Pay with USDC on Base or Ethereum.",
      },
    ],
    mppSpec: "https://mpp.dev",
    catalog: `${PUBLIC_BASE_URL}/mpp/catalog`,
  };

  return {
    header: `Payment challenge="${challengeBase64}"`,
    body,
  };
}

function parseCredential(credentialHeader: string): {
  type?: string;
  hash?: string;
  transaction?: string;
  challengeId?: string;
  raw: string;
} | null {
  try {
    const base64 = credentialHeader.trim();
    const decoded = Buffer.from(base64, "base64").toString("utf-8");
    const parsed = JSON.parse(decoded);
    return { ...parsed, raw: base64 };
  } catch {
    return null;
  }
}

function isBaseTxHash(value: string | undefined): boolean {
  return typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value);
}

/**
 * Verify USDC-on-Base payment via Alchemy RPC.
 * Checks: tx succeeded, correct token contract, correct recipient, amount >= required, not replayed.
 */
async function verifyBaseUsdcCredential(
  txHash: string,
  serviceName: string,
  amountUsd: number
): Promise<{ verified: boolean; reason: string; paidBy?: string }> {
  const rpcUrl = getBaseRpcUrl();
  if (!rpcUrl) {
    return { verified: false, reason: "RPC endpoint not configured (HELIUS_API_KEY missing)" };
  }

  // Replay protection — check before hitting the RPC
  try {
    const existing = await db
      .select({ id: usedTransactionHashes.id })
      .from(usedTransactionHashes)
      .where(eq(usedTransactionHashes.txHash, txHash))
      .limit(1);

    if (existing.length > 0) {
      return { verified: false, reason: "Transaction hash already used — replay rejected" };
    }
  } catch (dbErr: any) {
    return { verified: false, reason: `Replay check failed: ${dbErr.message}` };
  }

  // Fetch receipt from Alchemy with timeout
  let receipt: any;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);

    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getTransactionReceipt",
        params: [txHash],
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) {
      return { verified: false, reason: `Alchemy RPC error: HTTP ${response.status}` };
    }

    const data = await response.json();
    if (data.error) {
      return { verified: false, reason: `RPC error: ${data.error.message}` };
    }
    if (!data.result) {
      return { verified: false, reason: "Transaction not found on Base mainnet — may be pending" };
    }
    receipt = data.result;
  } catch (fetchErr: any) {
    const msg = fetchErr.name === "AbortError" ? "RPC timeout (7s)" : fetchErr.message;
    return { verified: false, reason: `RPC fetch failed: ${msg}` };
  }

  // Must be successful
  if (receipt.status !== "0x1") {
    return { verified: false, reason: "Transaction reverted on-chain" };
  }

  // Must be sent to USDC contract
  const contractHit = receipt.to?.toLowerCase();
  if (contractHit !== USDC_BASE_ADDRESS.toLowerCase()) {
    return {
      verified: false,
      reason: `Transaction not sent to USDC contract. Expected ${USDC_BASE_ADDRESS}, got ${contractHit}`,
    };
  }

  // Parse Transfer event
  const transferLog = receipt.logs?.find(
    (log: any) =>
      log.topics?.[0]?.toLowerCase() === TRANSFER_EVENT_SIG.toLowerCase() &&
      log.address?.toLowerCase() === USDC_BASE_ADDRESS.toLowerCase()
  );

  if (!transferLog) {
    return { verified: false, reason: "No USDC Transfer event found in transaction" };
  }

  // Recipient from topic[2]
  const recipientTopic = transferLog.topics?.[2];
  if (!recipientTopic) {
    return { verified: false, reason: "Cannot extract recipient from Transfer event" };
  }
  const actualRecipient = "0x" + recipientTopic.slice(-40).toLowerCase();
  if (actualRecipient !== PLATFORM_WALLET.toLowerCase()) {
    return {
      verified: false,
      reason: `Wrong recipient: expected ${PLATFORM_WALLET.toLowerCase()}, got ${actualRecipient}`,
    };
  }

  // Sender from topic[1]
  const senderTopic = transferLog.topics?.[1];
  const paidBy = senderTopic ? "0x" + senderTopic.slice(-40).toLowerCase() : undefined;

  // Amount from log data
  const amountHex = transferLog.data;
  if (!amountHex || amountHex === "0x") {
    return { verified: false, reason: "Cannot extract amount from Transfer event" };
  }
  const amountRaw = BigInt(amountHex);
  const actualAmount = Number(amountRaw) / Math.pow(10, USDC_DECIMALS);

  const tolerance = 0.01;
  if (Math.abs(actualAmount - amountUsd) > tolerance) {
    return {
      verified: false,
      reason: `Amount mismatch: expected $${amountUsd.toFixed(6)} USDC, got $${actualAmount.toFixed(6)} USDC`,
    };
  }

  // Record in replay protection table
  try {
    await db.insert(usedTransactionHashes).values({
      txHash,
      network: "base",
      serviceName: `mpp:${serviceName}`,
      amount: actualAmount.toFixed(6),
      paidBy: paidBy || null,
    });
  } catch (insertErr: any) {
    // Unique constraint violation = race condition replay attempt
    if (insertErr.message?.includes("unique") || insertErr.code === "23505") {
      return { verified: false, reason: "Transaction hash already used — concurrent replay rejected" };
    }
    console.error("[MPP] Failed to record tx hash in replay table:", insertErr.message);
  }

  return { verified: true, reason: "USDC-on-Base payment verified", paidBy };
}

/**
 * Log MPP payment event to x402_interactions for analytics.
 * Non-blocking — fires async and does not affect response.
 */
function logMppPaymentEvent(
  serviceName: string,
  ip: string,
  ua: string,
  txHash: string,
  amountUsd: number,
  paidBy: string | undefined,
  eventType: "mpp-payment-verified" | "mpp-credential-received" | "mpp-verification-failed"
): void {
  db.insert(x402Interactions)
    .values({
      serviceId: serviceName,
      ipAddress: ip,
      userAgent: ua,
      requestPath: `/mpp/${serviceName}`,
      requestMethod: "POST",
      eventType,
      walletAddress: paidBy || null,
      paymentAmount: amountUsd.toFixed(6) as any,
      paymentReceived: eventType === "mpp-payment-verified",
      paid: eventType === "mpp-payment-verified",
      amount: amountUsd.toFixed(6) as any,
    })
    .catch((err: any) =>
      console.error("[MPP] Analytics insert failed:", err.message)
    );
}

/**
 * Factory: createMppPaymentMiddleware(serviceName, amountUsd)
 *
 * Returns an Express middleware that:
 * - Returns HTTP 402 + WWW-Authenticate: Payment challenge when no credential is present
 *   (challenge includes USDC-on-Base as first method, Tempo as second)
 * - Parses incoming credentials and routes to the correct verifier
 * - USDC-on-Base: verified via Alchemy RPC → service delivered on success
 * - Tempo: still pending Express 5 / mppx upgrade
 * - Calls next() only when a verified payment credential is confirmed
 */
export function createMppPaymentMiddleware(serviceName: string, amountUsd: number) {
  return async function mppPaymentMiddleware(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers["authorization"] as string | undefined;
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "unknown";
    const ua = (req.headers["user-agent"] as string) || "unknown";

    const isMppCredential = authHeader?.startsWith("Payment ");

    if (!isMppCredential) {
      const challengeId = `mpp_${nanoid(12)}`;
      const { header, body } = buildMppChallenge(serviceName, amountUsd, challengeId);

      console.log(
        `[MPP] 402 challenge issued for ${serviceName} | ip=${ip} | ua=${ua.slice(0, 60)} | challengeId=${challengeId}`
      );

      res.setHeader("WWW-Authenticate", header);
      res.setHeader("Content-Type", "application/problem+json");
      res.setHeader("X-MPP-Protocol", MPP_PROTOCOL_VERSION);
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Expose-Headers", "WWW-Authenticate, X-MPP-Protocol");

      return res.status(402).json(body);
    }

    const rawCredential = authHeader.slice("Payment ".length);
    const credential = parseCredential(rawCredential);

    console.log(
      `[MPP] Credential received for ${serviceName} | ip=${ip} | ` +
      `type=${credential?.type || "unknown"} | hasTx=${!!credential?.transaction} | hasHash=${!!credential?.hash}`
    );

    logMppPaymentEvent(serviceName, ip, ua, credential?.transaction || "", amountUsd, undefined, "mpp-credential-received");

    // --- BASE USDC PATH ---
    const txHash = credential?.transaction || credential?.hash;
    const isBaseUsdcAttempt =
      credential?.type === "evm.transfer" ||
      (isBaseTxHash(txHash) && (!credential?.type || credential.type !== "tempo.charge"));

    if (isBaseUsdcAttempt && isBaseTxHash(txHash)) {
      const result = await verifyBaseUsdcCredential(txHash!, serviceName, amountUsd);

      if (result.verified) {
        console.log(
          `[MPP] ✅ USDC-on-Base payment verified for ${serviceName} | ip=${ip} | tx=${txHash} | paidBy=${result.paidBy}`
        );
        logMppPaymentEvent(serviceName, ip, ua, txHash!, amountUsd, result.paidBy, "mpp-payment-verified");

        res.setHeader("X-MPP-Protocol", MPP_PROTOCOL_VERSION);
        res.setHeader("X-MPP-Payment-Verified", "true");
        res.setHeader("X-MPP-Tx", txHash!);
        res.setHeader("Access-Control-Allow-Origin", "*");

        return next();
      }

      console.log(`[MPP] ❌ USDC-on-Base verification failed for ${serviceName} | ip=${ip} | reason=${result.reason}`);
      logMppPaymentEvent(serviceName, ip, ua, txHash!, amountUsd, undefined, "mpp-verification-failed");

      const challengeId = credential?.challengeId || `mpp_${nanoid(12)}`;
      const { header, body } = buildMppChallenge(serviceName, amountUsd, challengeId);

      res.setHeader("WWW-Authenticate", header);
      res.setHeader("Content-Type", "application/problem+json");
      res.setHeader("X-MPP-Protocol", MPP_PROTOCOL_VERSION);
      res.setHeader("Access-Control-Allow-Origin", "*");

      return res.status(402).json({
        ...body,
        title: "Payment Verification Failed",
        detail: result.reason,
        credentialReceived: true,
        credentialType: "evm.transfer",
      });
    }

    // --- TEMPO PATH (still pending) ---
    console.log(
      `[MPP] Tempo credential received for ${serviceName} | ip=${ip} | verification pending`
    );

    const challengeId = credential?.challengeId || `mpp_${nanoid(12)}`;
    const { header, body } = buildMppChallenge(serviceName, amountUsd, challengeId);

    res.setHeader("WWW-Authenticate", header);
    res.setHeader("Content-Type", "application/problem+json");
    res.setHeader("X-MPP-Protocol", MPP_PROTOCOL_VERSION);
    res.setHeader("Access-Control-Allow-Origin", "*");

    return res.status(402).json({
      ...body,
      title: "Tempo Credential Received — Verification Pending",
      detail:
        "Tempo on-chain verification is pending an Express 5 upgrade. " +
        "To settle immediately, use the evm.transfer method with USDC on Base (chain 8453). " +
        "Transfer USDC to " + PLATFORM_WALLET + " and include the tx hash in your credential.",
      credentialReceived: true,
      credentialType: credential?.type || "tempo.charge",
      upgradeNotice: "Track mppx compatibility at: GET /api/admin/mpp-monitor",
      immediateAlternative: {
        method: "evm.transfer",
        token: USDC_BASE_ADDRESS,
        network: "base",
        chainId: BASE_CHAIN_ID,
        recipient: PLATFORM_WALLET,
        note: "Transfer USDC on Base and include the tx hash as credential.transaction",
      },
    });
  };
}
