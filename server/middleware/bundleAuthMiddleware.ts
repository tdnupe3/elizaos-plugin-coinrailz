import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { serviceBundleSubscriptions } from "../../shared/schema";
import { eq, and, gte } from "drizzle-orm";
import crypto from "crypto";

export interface BundleSubscriptionInfo {
  id: number;
  bundleId: string;
  tier: string;
  creditsRemaining: number;
  status: string;
}

// Extend Express Request to include bundle subscription info
declare global {
  namespace Express {
    interface Request {
      bundleSubscription?: BundleSubscriptionInfo;
    }
  }
}

export async function bundleAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Check for bundle API key in Authorization header
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith("Bearer sb_")) {
    // No bundle API key - allow request to proceed (will use pay-per-call pricing)
    return next();
  }

  const apiKey = authHeader.replace("Bearer ", "");
  
  // Hash the provided API key
  const hashedKey = crypto.createHash("sha256").update(apiKey).digest("hex");

  try {
    // Look up subscription by hashed API key
    const subscription = await db
      .select()
      .from(serviceBundleSubscriptions)
      .where(
        and(
          eq(serviceBundleSubscriptions.apiKeyHash, hashedKey),
          eq(serviceBundleSubscriptions.status, "active"),
          gte(serviceBundleSubscriptions.creditsRemaining, 1)
        )
      )
      .limit(1);

    if (subscription.length === 0) {
      return res.status(401).json({
        error: "Invalid or expired bundle subscription",
        code: "INVALID_BUNDLE_KEY",
      });
    }

    const sub = subscription[0];

    // Check if subscription has expired
    if (sub.currentPeriodEnd && new Date() > sub.currentPeriodEnd) {
      return res.status(402).json({
        error: "Bundle subscription expired",
        code: "SUBSCRIPTION_EXPIRED",
        details: {
          expiresAt: sub.currentPeriodEnd,
        },
      });
    }

    // Check if credits are exhausted
    if (sub.creditsRemaining <= 0) {
      return res.status(402).json({
        error: "Bundle credits exhausted",
        code: "CREDITS_EXHAUSTED",
        details: {
          creditsUsed: sub.creditsUsed,
          creditsTotal: sub.creditsTotal,
          nextBillingDate: sub.nextBillingDate,
        },
      });
    }

    // Attach subscription info to request
    req.bundleSubscription = {
      id: sub.id,
      bundleId: sub.bundleId,
      tier: sub.tier,
      creditsRemaining: sub.creditsRemaining,
      status: sub.status,
    };

    next();
  } catch (error) {
    console.error("Bundle auth middleware error:", error);
    return res.status(500).json({
      error: "Failed to verify bundle subscription",
    });
  }
}

// Service cost mapping (in credits)
// Based on Professional tier pricing ($0.165/credit) aligned with pay-per-call USDC costs
export const SERVICE_CREDIT_COSTS: Record<string, number> = {
  // Trading Intelligence Bundle Services (1-5 credits, avg $0.30/call)
  "gas-price-oracle": 1,        // $0.10 → 1 credit
  "token-metadata": 1,           // $0.10 → 1 credit
  "dex-liquidity": 1,            // $0.20 → 1 credit
  "token-price": 2,              // $0.25 → 2 credits
  "token-sentiment": 2,          // $0.25 → 2 credits
  "transaction-builder": 2,      // $0.30 → 2 credits
  "whale-alerts": 2,             // $0.35 → 2 credits
  "batch-quote": 2,              // $0.40 → 2 credits
  "trending-tokens": 3,          // $0.50 → 3 credits
  "multi-chain-balance": 3,      // $0.50 → 3 credits
  "portfolio-tracker": 3,        // $0.50 → 3 credits
  "trade-signals": 5,            // $0.75 → 5 credits
  
  // Security & Compliance Bundle Services (3-61 credits, avg $1.50/call)
  "approval-manager": 1,         // $0.20 → 1 credit
  "wallet-risk": 3,              // $0.50 → 3 credits
  "contract-scan": 6,            // $1.00 → 6 credits
  "compliance-consultation": 30, // $5.00 → 30 credits
  "smart-contract-audit": 61,    // $10.00 → 61 credits
  
  // Payments & Execution Bundle Services (3-30 credits, avg $1.20/call)
  "payment-processing": 3,       // $0.50 → 3 credits
  "instant-agent-wallet": 6,     // $1.00 → 6 credits
  "seamless-chain-bridge": 12,   // $2.00 → 12 credits
  "verified-agent-identity": 30, // $5.00 → 30 credits
};

export function getServiceCreditCost(serviceSlug: string, endpoint: string): number {
  // Try exact endpoint match first
  const exactKey = `${serviceSlug}-${endpoint}`;
  if (SERVICE_CREDIT_COSTS[exactKey]) {
    return SERVICE_CREDIT_COSTS[exactKey];
  }
  
  // Try service slug match
  if (SERVICE_CREDIT_COSTS[serviceSlug]) {
    return SERVICE_CREDIT_COSTS[serviceSlug];
  }
  
  // Default cost
  return 1;
}
