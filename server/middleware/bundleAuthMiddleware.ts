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
export const SERVICE_CREDIT_COSTS: Record<string, number> = {
  // Trading Intelligence Bundle Services
  "dex-quote": 1,
  "dex-swap": 2,
  "gas-prices": 1,
  "trending-tokens": 2,
  
  // Security Bundle Services
  "smart-contract-audit": 10,
  "wallet-analysis": 5,
  "token-security": 3,
  
  // Payments Bundle Services
  "payment-routing": 2,
  "payment-status": 1,
  "invoice-generation": 1,
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
