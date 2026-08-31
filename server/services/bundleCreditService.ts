import { db } from "../db";
import { serviceBundleSubscriptions, serviceBundleUsage } from "../../shared/schema";
import { eq } from "drizzle-orm";
import { getServiceCreditCost } from "../middleware/bundleAuthMiddleware";

export interface CreditDeductionResult {
  success: boolean;
  creditsDeducted: number;
  creditsRemaining: number;
  error?: string;
}

export async function deductBundleCredits(
  subscriptionId: number,
  serviceSlug: string,
  endpoint: string,
  responseStatus: string,
  requestMetadata?: Record<string, any>
): Promise<CreditDeductionResult> {
  try {
    // Get the credit cost for this service
    const creditCost = getServiceCreditCost(serviceSlug, endpoint);

    // Get current subscription
    const [subscription] = await db
      .select()
      .from(serviceBundleSubscriptions)
      .where(eq(serviceBundleSubscriptions.id, subscriptionId))
      .limit(1);

    if (!subscription) {
      return {
        success: false,
        creditsDeducted: 0,
        creditsRemaining: 0,
        error: "Subscription not found",
      };
    }

    // Check if sufficient credits
    if (subscription.creditsRemaining < creditCost) {
      return {
        success: false,
        creditsDeducted: 0,
        creditsRemaining: subscription.creditsRemaining,
        error: "Insufficient credits",
      };
    }

    // Update subscription credits in a transaction
    const newCreditsUsed = subscription.creditsUsed + creditCost;
    const newCreditsRemaining = subscription.creditsRemaining - creditCost;

    await db
      .update(serviceBundleSubscriptions)
      .set({
        creditsUsed: newCreditsUsed,
        creditsRemaining: newCreditsRemaining,
        updatedAt: new Date(),
      })
      .where(eq(serviceBundleSubscriptions.id, subscriptionId));

    // Log the usage
    await db.insert(serviceBundleUsage).values({
      subscriptionId,
      serviceSlug,
      creditsCharged: creditCost,
      responseStatus: responseStatus ? parseInt(responseStatus) : null,
    });

    return {
      success: true,
      creditsDeducted: creditCost,
      creditsRemaining: newCreditsRemaining,
    };
  } catch (error) {
    console.error("Credit deduction error:", error);
    return {
      success: false,
      creditsDeducted: 0,
      creditsRemaining: 0,
      error: "Failed to deduct credits",
    };
  }
}

export async function getSubscriptionUsage(subscriptionId: number) {
  try {
    const usage = await db
      .select()
      .from(serviceBundleUsage)
      .where(eq(serviceBundleUsage.subscriptionId, subscriptionId))
      .orderBy(serviceBundleUsage.timestamp);

    return usage;
  } catch (error) {
    console.error("Get subscription usage error:", error);
    return [];
  }
}
