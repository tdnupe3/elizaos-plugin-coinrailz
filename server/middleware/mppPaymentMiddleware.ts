/**
 * MPP (Machine Payments Protocol) Payment Middleware
 *
 * Implements the MPP challenge/credential flow as specified at https://mpp.dev
 * Protocol: HTTP 402 with RFC 7807 Problem Details + WWW-Authenticate: Payment challenge
 *
 * IMPLEMENTATION STATUS (as of March 2026):
 * - Phase 1 (LIVE): Correct MPP 402 challenge format, discovery manifests, monitoring
 * - Phase 2 (PENDING): Full Tempo on-chain credential verification
 *   - Blocked by: mppx v0.4.9 requires Express 5+; this project uses Express 4.21.2
 *   - Unblocked when: mppx releases Express 4 compatible version OR we upgrade to Express 5
 *   - When ready: replace verifyTempoCredential() stub with mppx.verify() call
 *
 * The mppMonitorService.ts will alert when mppx releases a new version.
 *
 * Payment flow:
 * 1. Client → POST /mpp/ping (no credential)
 * 2. Server → 402 + WWW-Authenticate: Payment challenge="<base64>" (this middleware)
 * 3. Client → fulfills payment via Tempo pathUSD wallet
 * 4. Client → POST /mpp/ping + Authorization: Payment <credential>
 * 5. Server → parses credential, logs for monitoring, informs agent of pending verification
 * 6. Agent falls back to API-key credits path (clear instructions in 402 body)
 */

import { Request, Response, NextFunction } from "express";
import { nanoid } from "nanoid";
import { SERVICE_PRICING_USD } from "@shared/pricing";

const PLATFORM_WALLET = process.env.PLATFORM_WALLET_ADDRESS || "0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91";
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || "https://coinrailz.com";

const MPP_PROTOCOL_VERSION = "1.0";

const TEMPO_PATH_USD_ADDRESS = "0x20c0000000000000000000000000000000000000";

export interface MppChallengeMethod {
  type: string;
  currency: string;
  amount: string;
  recipient: string;
  network?: string;
}

function buildMppChallenge(serviceName: string, amountUsd: number, challengeId: string): {
  header: string;
  body: Record<string, unknown>;
} {
  const methods: MppChallengeMethod[] = [
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
    detail: `This service requires a micropayment of $${amountUsd.toFixed(2)} pathUSD via the Machine Payments Protocol.`,
    challengeId,
    methods,
    resource: `${PUBLIC_BASE_URL}/mpp/${serviceName}`,
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

/**
 * Phase 2 stub: Full Tempo on-chain credential verification.
 *
 * When mppx gains Express 4 support:
 *   import { Mppx, tempo } from 'mppx/server';
 *   const mppx = Mppx.create({ methods: [tempo({ currency: TEMPO_PATH_USD_ADDRESS, recipient: PLATFORM_WALLET })] });
 *   const result = await mppx.verify(credential);
 *   return result.verified;
 *
 * Until then, returns false so the agent receives clear guidance.
 */
async function verifyTempoCredential(
  _credential: ReturnType<typeof parseCredential>,
  _serviceName: string,
  _amountUsd: number
): Promise<{ verified: false; reason: string }> {
  return {
    verified: false,
    reason:
      "Tempo on-chain verification pending mppx Express 4 compatibility. " +
      "mppx v0.4.9 requires Express >=5; this platform runs Express 4. " +
      "Monitor: GET /api/admin/mpp-monitor for version updates.",
  };
}

/**
 * Factory: createMppPaymentMiddleware(serviceName, amountUsd)
 *
 * Returns an Express middleware that:
 * - Returns HTTP 402 + WWW-Authenticate: Payment challenge when no credential is present
 * - Parses and logs the credential when present
 * - Informs the agent of the verification status and alternative payment paths
 * - Calls next() only when a verified payment credential is confirmed (Phase 2)
 *
 * Current behavior in Phase 1:
 * - No credential → correct MPP 402 challenge (agent can read the challenge and pay via Tempo)
 * - Credential present → credential logged, agent informed of pending Tempo RPC verification
 *   and offered API-key or x402 as alternatives
 *
 * This is honest: we never silently accept unverified payments.
 */
export function createMppPaymentMiddleware(serviceName: string, amountUsd: number) {
  return async function mppPaymentMiddleware(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers["authorization"] as string | undefined;
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "unknown";
    const ua = req.headers["user-agent"] || "unknown";

    const isMppCredential = authHeader?.startsWith("Payment ");

    if (!isMppCredential) {
      const challengeId = `mpp_${nanoid(12)}`;
      const { header, body } = buildMppChallenge(serviceName, amountUsd, challengeId);

      console.log(`[MPP] 402 challenge issued for ${serviceName} | ip=${ip} | ua=${ua.slice(0, 60)} | challengeId=${challengeId}`);

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
      `[MPP] Credential received for ${serviceName} | ip=${ip} | ua=${ua.slice(0, 60)} | ` +
      `type=${credential?.type || "unknown"} | hasHash=${!!credential?.hash} | hasTx=${!!credential?.transaction}`
    );

    const verificationResult = await verifyTempoCredential(credential, serviceName, amountUsd);

    const challengeId = credential?.challengeId || `mpp_${nanoid(12)}`;
    const { header, body } = buildMppChallenge(serviceName, amountUsd, challengeId);

    res.setHeader("WWW-Authenticate", header);
    res.setHeader("Content-Type", "application/problem+json");
    res.setHeader("X-MPP-Protocol", MPP_PROTOCOL_VERSION);
    res.setHeader("Access-Control-Allow-Origin", "*");

    return res.status(402).json({
      ...body,
      title: "Payment Credential Received — Verification Pending",
      detail: verificationResult.reason,
      credentialReceived: true,
      credentialType: credential?.type || "unknown",
      upgradeNotice:
        "Full Tempo on-chain verification will be enabled automatically when the mppx library " +
        "releases Express 4 compatibility. Track at: GET /api/admin/mpp-monitor",
    });
  };
}

export { MPP_PROTOCOL_VERSION, TEMPO_PATH_USD_ADDRESS, PLATFORM_WALLET as MPP_PLATFORM_WALLET };
