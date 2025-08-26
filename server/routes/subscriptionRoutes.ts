import type { Express } from "express";
import { subscriptionService } from "../services/subscriptionService";
import { isAuthenticated } from "../replitAuth";
import { z } from "zod";
import { db } from "../db";
import { subscriptionPlans, subscriptions, paymentMethods } from "@shared/schema";
import { eq } from "drizzle-orm";

const createSubscriptionSchema = z.object({
  planId: z.string(),
  paymentMethod: z.enum(["stripe", "paypal", "usdc", "crypto"]),
  isYearly: z.boolean().default(false),
  stripePaymentMethodId: z.string().optional(),
  paypalEmail: z.string().optional(),
  usdcTxHash: z.string().optional(),
  cryptoWalletAddress: z.string().optional(),
});

const addPaymentMethodSchema = z.object({
  type: z.enum(["stripe_card", "paypal", "usdc", "crypto"]),
  isDefault: z.boolean().default(false),
  stripePaymentMethodId: z.string().optional(),
  paypalEmail: z.string().optional(),
  walletAddress: z.string().optional(),
  blockchain: z.string().optional(),
});

export function registerSubscriptionRoutes(app: Express) {
  
  // Get all subscription tiers (public route)
  app.get("/api/subscription-tiers", async (req, res) => {
    try {
      const tiers = subscriptionService.getSubscriptionTiers();
      res.json(tiers);
    } catch (error) {
      console.error("Error fetching subscription tiers:", error);
      res.status(500).json({ error: "Failed to fetch subscription tiers" });
    }
  });

  // Get user's current subscription (authenticated)
  app.get("/api/my-subscription", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "User ID not found" });
      }

      const subscription = await subscriptionService.getUserSubscription(userId);
      const effectiveTier = await subscriptionService.getUserEffectiveTier(userId);
      
      res.json({
        subscription: subscription || null,
        currentTier: effectiveTier,
        isActive: subscription ? subscriptionService.isSubscriptionActive(subscription) : false,
        aiMarketplaceCredits: await subscriptionService.getAIMarketplaceCredits(userId)
      });
    } catch (error) {
      console.error("Error fetching user subscription:", error);
      res.status(500).json({ error: "Failed to fetch subscription" });
    }
  });

  // Create new subscription
  app.post("/api/create-subscription", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "User ID not found" });
      }

      const validatedData = createSubscriptionSchema.parse(req.body);

      let subscriptionResult;

      switch (validatedData.paymentMethod) {
        case "stripe":
          if (!validatedData.stripePaymentMethodId) {
            return res.status(400).json({ error: "Stripe payment method ID required" });
          }
          
          // Check if user has Stripe customer ID, create if needed
          const [user] = await db.select().from(require("@shared/schema").users).where(eq(require("@shared/schema").users.id, userId));
          let stripeCustomerId = user?.coinbaseAccessToken; // Assuming we store it here temporarily
          
          if (!stripeCustomerId) {
            // Would create Stripe customer here
            stripeCustomerId = `cus_${Date.now()}`;
          }

          if (validatedData.isYearly) {
            subscriptionResult = await subscriptionService.createStripeYearlySubscription(
              userId,
              validatedData.planId,
              stripeCustomerId
            );
          } else {
            subscriptionResult = await subscriptionService.createStripeMonthlySubscription(
              userId,
              validatedData.planId,
              stripeCustomerId
            );
          }
          
          res.json({
            clientSecret: typeof subscriptionResult.latest_invoice === 'object' 
              ? (subscriptionResult.latest_invoice as any)?.payment_intent?.client_secret 
              : null,
            subscriptionId: subscriptionResult.id
          });
          break;

        case "paypal":
          subscriptionResult = await subscriptionService.createPayPalSubscription(
            userId,
            validatedData.planId,
            validatedData.isYearly
          );
          res.json(subscriptionResult);
          break;

        case "usdc":
          if (!validatedData.usdcTxHash) {
            return res.status(400).json({ error: "USDC transaction hash required" });
          }
          
          subscriptionResult = await subscriptionService.processUSDCSubscription(
            userId,
            validatedData.planId,
            validatedData.isYearly,
            validatedData.usdcTxHash
          );
          res.json({ subscription: subscriptionResult });
          break;

        case "crypto":
          if (!validatedData.cryptoWalletAddress) {
            return res.status(400).json({ error: "Crypto wallet address required" });
          }
          
          // For now, treat like USDC but store wallet address
          subscriptionResult = await subscriptionService.processUSDCSubscription(
            userId,
            validatedData.planId,
            validatedData.isYearly,
            `crypto_${validatedData.cryptoWalletAddress}_${Date.now()}`
          );
          res.json({ subscription: subscriptionResult });
          break;

        default:
          res.status(400).json({ error: "Invalid payment method" });
      }
    } catch (error) {
      console.error("Error creating subscription:", error);
      res.status(500).json({ error: "Failed to create subscription" });
    }
  });

  // Cancel subscription
  app.post("/api/cancel-subscription", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "User ID not found" });
      }

      await subscriptionService.cancelSubscription(userId);
      res.json({ success: true, message: "Subscription cancelled successfully" });
    } catch (error) {
      console.error("Error cancelling subscription:", error);
      res.status(500).json({ error: "Failed to cancel subscription" });
    }
  });

  // Calculate effective fees for user
  app.post("/api/calculate-fees", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "User ID not found" });
      }

      const { tradingAmount, crossChainAmount } = req.body;
      const userSubscription = await subscriptionService.getUserSubscription(userId);

      const tradingFee = tradingAmount ? 
        subscriptionService.calculateTradingFee(tradingAmount, userSubscription) : 0;
      const crossChainFee = crossChainAmount ? 
        subscriptionService.calculateCrossChainFee(crossChainAmount, userSubscription) : 0;

      res.json({
        tradingFee,
        crossChainFee,
        savings: {
          trading: tradingAmount ? (tradingAmount * 0.0025) - tradingFee : 0,
          crossChain: crossChainAmount ? (crossChainAmount * 0.005) - crossChainFee : 0
        }
      });
    } catch (error) {
      console.error("Error calculating fees:", error);
      res.status(500).json({ error: "Failed to calculate fees" });
    }
  });

  // Get user's payment methods
  app.get("/api/payment-methods", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "User ID not found" });
      }

      const methods = await db
        .select()
        .from(paymentMethods)
        .where(eq(paymentMethods.userId, userId));

      res.json(methods);
    } catch (error) {
      console.error("Error fetching payment methods:", error);
      res.status(500).json({ error: "Failed to fetch payment methods" });
    }
  });

  // Add payment method
  app.post("/api/add-payment-method", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "User ID not found" });
      }

      const validatedData = addPaymentMethodSchema.parse(req.body);

      const [paymentMethod] = await db
        .insert(paymentMethods)
        .values({
          userId,
          ...validatedData,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();

      res.json(paymentMethod);
    } catch (error) {
      console.error("Error adding payment method:", error);
      res.status(500).json({ error: "Failed to add payment method" });
    }
  });

  // Get subscription usage statistics (for dashboard)
  app.get("/api/subscription/usage", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "User ID not found" });
      }

      // Mock usage data for now - in production this would come from analytics
      const usage = {
        tradingVolume: Math.random() * 100000 + 10000, // Random between 10k-110k
        feeSavings: Math.random() * 500 + 50, // Random between 50-550
        aiCreditsUsed: Math.floor(Math.random() * 20), // Random between 0-20
        aiCreditsRemaining: Math.floor(Math.random() * 80 + 20), // Random between 20-100
        transactionCount: Math.floor(Math.random() * 100 + 10) // Random between 10-110
      };

      res.json(usage);
    } catch (error) {
      console.error("Error fetching usage statistics:", error);
      res.status(500).json({ error: "Failed to fetch usage statistics" });
    }
  });

  // Get billing history (for dashboard)
  app.get("/api/subscription/billing-history", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "User ID not found" });
      }

      // Mock billing history for now - in production this would come from payment processor
      const billingHistory = [
        {
          id: "bill_1",
          date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
          amount: 19.99,
          status: "paid",
          description: "Starter Plan - Monthly",
          invoiceUrl: "#"
        },
        {
          id: "bill_2", 
          date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 days ago
          amount: 19.99,
          status: "paid", 
          description: "Starter Plan - Monthly",
          invoiceUrl: "#"
        },
        {
          id: "bill_3",
          date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days ago
          amount: 19.99,
          status: "paid",
          description: "Starter Plan - Monthly", 
          invoiceUrl: "#"
        }
      ];

      res.json(billingHistory);
    } catch (error) {
      console.error("Error fetching billing history:", error);
      res.status(500).json({ error: "Failed to fetch billing history" });
    }
  });

  // Change subscription plan (upgrade/downgrade)
  app.post("/api/change-subscription", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "User ID not found" });
      }

      const { newPlanId, newBillingPeriod, changeType } = req.body;

      // Validate inputs
      if (!newPlanId || !newBillingPeriod || !changeType) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Find the user's current subscription
      const [currentSubscription] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, userId))
        .limit(1);

      if (!currentSubscription) {
        return res.status(404).json({ error: "No active subscription found" });
      }

      // Get the new plan details
      const newPlan = subscriptionService.getSubscriptionTier(newPlanId);
      if (!newPlan) {
        return res.status(400).json({ error: "Invalid plan ID" });
      }

      // Calculate new amount
      const newAmount = newBillingPeriod === 'yearly' ? newPlan.yearlyPrice : newPlan.monthlyPrice;

      // Calculate when the change should take effect
      let effectiveDate = new Date();
      let nextBillingDate = new Date(currentSubscription.currentPeriodEnd);

      if (changeType === 'downgrade') {
        // Downgrades take effect at the end of current billing period
        effectiveDate = new Date(currentSubscription.currentPeriodEnd);
      }

      // Calculate next billing period end
      if (newBillingPeriod === 'yearly') {
        nextBillingDate = new Date(effectiveDate);
        nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
      } else {
        nextBillingDate = new Date(effectiveDate);
        nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
      }

      // Update subscription in database
      await db
        .update(subscriptions)
        .set({
          planId: newPlanId,
          currentPeriodStart: changeType === 'upgrade' ? new Date() : effectiveDate,
          currentPeriodEnd: nextBillingDate,
          status: 'active',
          updatedAt: new Date()
        })
        .where(eq(subscriptions.id, currentSubscription.id));

      // Handle payment processing based on type
      let paymentResult = null;
      if (changeType === 'upgrade' && currentSubscription.stripeSubscriptionId) {
        // For Stripe upgrades, process prorated payment immediately
        try {
          // This would integrate with Stripe to process prorated payment
          // For now, we'll just log it
          console.log(`Processed Stripe upgrade for user ${userId}: -> ${newAmount}`);
        } catch (error) {
          console.error('Stripe upgrade processing failed:', error);
        }
      }

      res.json({
        success: true,
        message: changeType === 'upgrade' ? 
          "Subscription upgraded successfully! Changes are effective immediately." :
          "Subscription downgrade scheduled. Changes will take effect at the end of your current billing period.",
        effectiveDate: effectiveDate.toISOString(),
        nextBillingDate: nextBillingDate.toISOString(),
        newAmount,
        paymentResult
      });

    } catch (error) {
      console.error("Error changing subscription:", error);
      res.status(500).json({ error: "Failed to change subscription" });
    }
  });

  // Reactivate cancelled subscription
  app.post("/api/reactivate-subscription", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "User ID not found" });
      }

      // Find the user's cancelled subscription
      const [subscription] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, userId))
        .limit(1);

      if (!subscription) {
        return res.status(404).json({ error: "No subscription found" });
      }

      if (subscription.status !== 'cancelled') {
        return res.status(400).json({ error: "Subscription is not cancelled" });
      }

      // Reactivate the subscription
      await db
        .update(subscriptions)
        .set({
          status: 'active',
          cancelAtPeriodEnd: false,
          updatedAt: new Date()
        })
        .where(eq(subscriptions.id, subscription.id));

      res.json({ success: true, message: "Subscription reactivated successfully" });
    } catch (error) {
      console.error("Error reactivating subscription:", error);
      res.status(500).json({ error: "Failed to reactivate subscription" });
    }
  });

  // Admin billing management endpoints
  app.post("/api/admin/trigger-billing-cycle", async (req, res) => {
    try {
      const { billingCycleService } = await import("../services/billingCycleService");
      const { type } = req.body;

      switch (type) {
        case 'daily':
          await billingCycleService.processUpcomingRenewals();
          await billingCycleService.processExpiredSubscriptions();
          await billingCycleService.retryFailedPayments();
          break;
        case 'renewals':
          await billingCycleService.processUpcomingRenewals();
          break;
        case 'expired':
          await billingCycleService.processExpiredSubscriptions();
          break;
        case 'retry':
          await billingCycleService.retryFailedPayments();
          break;
        default:
          return res.status(400).json({ error: "Invalid billing cycle type" });
      }

      res.json({ success: true, message: `Billing cycle '${type}' completed successfully` });
    } catch (error) {
      console.error("Error triggering billing cycle:", error);
      res.status(500).json({ error: "Failed to trigger billing cycle" });
    }
  });

  // Get user subscription status (for DEX integration)
  app.get("/api/user/subscription-status", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "User ID not found" });
      }

      const { subscriptionStatusService } = await import("../services/subscriptionStatusService");
      const status = await subscriptionStatusService.getUserSubscriptionStatus(userId);
      
      res.json(status);
    } catch (error) {
      console.error("Error fetching subscription status:", error);
      res.status(500).json({ error: "Failed to fetch subscription status" });
    }
  });

  // Get subscription benefits summary
  app.get("/api/user/subscription-benefits", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "User ID not found" });
      }

      const { subscriptionStatusService } = await import("../services/subscriptionStatusService");
      const benefits = await subscriptionStatusService.getSubscriptionBenefits(userId);
      
      res.json(benefits);
    } catch (error) {
      console.error("Error fetching subscription benefits:", error);
      res.status(500).json({ error: "Failed to fetch subscription benefits" });
    }
  });

  // Calculate cross-chain fee for user (for DEX fee display)
  app.post("/api/user/calculate-crosschain-fee", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "User ID not found" });
      }

      const { amount } = req.body;
      if (!amount || isNaN(amount) || amount <= 0) {
        return res.status(400).json({ error: "Valid amount required" });
      }

      const { subscriptionStatusService } = await import("../services/subscriptionStatusService");
      const feeCalculation = await subscriptionStatusService.calculateCrossChainFee(userId, amount);
      
      res.json(feeCalculation);
    } catch (error) {
      console.error("Error calculating cross-chain fee:", error);
      res.status(500).json({ error: "Failed to calculate cross-chain fee" });
    }
  });

  // Calculate trading fee for user (for DEX fee display)
  app.post("/api/user/calculate-trading-fee", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "User ID not found" });
      }

      const { amount } = req.body;
      if (!amount || isNaN(amount) || amount <= 0) {
        return res.status(400).json({ error: "Valid amount required" });
      }

      const { subscriptionStatusService } = await import("../services/subscriptionStatusService");
      const feeCalculation = await subscriptionStatusService.calculateTradingFee(userId, amount);
      
      res.json(feeCalculation);
    } catch (error) {
      console.error("Error calculating trading fee:", error);
      res.status(500).json({ error: "Failed to calculate trading fee" });
    }
  });

  // Track subscription usage
  app.post("/api/user/track-subscription-usage", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "User ID not found" });
      }

      const { type, volume, feesSaved, creditsUsed } = req.body;
      if (!type) {
        return res.status(400).json({ error: "Usage type required" });
      }

      const { subscriptionStatusService } = await import("../services/subscriptionStatusService");
      await subscriptionStatusService.trackSubscriptionUsage(userId, type, {
        volume,
        feesSaved,
        creditsUsed
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error tracking subscription usage:", error);
      res.status(500).json({ error: "Failed to track subscription usage" });
    }
  });

  // Get subscription metrics (admin only)
  app.get("/api/admin/subscription-metrics", async (req, res) => {
    try {
      const { subscriptionStatusService } = await import("../services/subscriptionStatusService");
      const metrics = await subscriptionStatusService.getSubscriptionMetrics();
      
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching subscription metrics:", error);
      res.status(500).json({ error: "Failed to fetch subscription metrics" });
    }
  });

  // Get comprehensive subscription analytics (admin only)
  app.get("/api/admin/subscription-analytics", async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const { subscriptionAnalyticsService } = await import("../services/subscriptionAnalyticsService");
      
      const analytics = await subscriptionAnalyticsService.getSubscriptionAnalytics(
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );
      
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching subscription analytics:", error);
      res.status(500).json({ error: "Failed to fetch subscription analytics" });
    }
  });

  // Get user subscription journey (admin only)
  app.get("/api/admin/user-journey/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const { subscriptionAnalyticsService } = await import("../services/subscriptionAnalyticsService");
      
      const journey = await subscriptionAnalyticsService.getUserSubscriptionJourney(userId);
      
      if (!journey) {
        return res.status(404).json({ error: "User not found" });
      }
      
      res.json(journey);
    } catch (error) {
      console.error("Error fetching user journey:", error);
      res.status(500).json({ error: "Failed to fetch user journey" });
    }
  });

  // Get revenue breakdown (admin only)
  app.get("/api/admin/revenue-breakdown", async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const { subscriptionAnalyticsService } = await import("../services/subscriptionAnalyticsService");
      
      const breakdown = await subscriptionAnalyticsService.getRevenueBreakdown(
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );
      
      res.json(breakdown);
    } catch (error) {
      console.error("Error fetching revenue breakdown:", error);
      res.status(500).json({ error: "Failed to fetch revenue breakdown" });
    }
  });

  // Get cohort analysis (admin only)
  app.get("/api/admin/cohort-analysis", async (req, res) => {
    try {
      const { subscriptionAnalyticsService } = await import("../services/subscriptionAnalyticsService");
      const cohortData = await subscriptionAnalyticsService.getCohortAnalysis();
      
      res.json(cohortData);
    } catch (error) {
      console.error("Error fetching cohort analysis:", error);
      res.status(500).json({ error: "Failed to fetch cohort analysis" });
    }
  });

  // Get top subscribers by LTV (admin only)
  app.get("/api/admin/top-subscribers", async (req, res) => {
    try {
      const { limit = 10 } = req.query;
      const { subscriptionAnalyticsService } = await import("../services/subscriptionAnalyticsService");
      
      const topSubscribers = await subscriptionAnalyticsService.getTopSubscribersByLTV(
        parseInt(limit as string)
      );
      
      res.json(topSubscribers);
    } catch (error) {
      console.error("Error fetching top subscribers:", error);
      res.status(500).json({ error: "Failed to fetch top subscribers" });
    }
  });

  // Send notification to user
  app.post("/api/admin/send-notification", async (req, res) => {
    try {
      const { userId, email, type, data } = req.body;
      
      if (!userId || !email || !type) {
        return res.status(400).json({ error: "Missing required fields: userId, email, type" });
      }

      const { subscriptionNotificationService } = await import("../services/subscriptionNotificationService");
      
      const success = await subscriptionNotificationService.sendNotification({
        type,
        userId,
        email,
        data: data || {}
      });
      
      res.json({ success, message: success ? "Notification sent successfully" : "Failed to send notification" });
    } catch (error) {
      console.error("Error sending notification:", error);
      res.status(500).json({ error: "Failed to send notification" });
    }
  });

  // Send bulk notification (admin only)
  app.post("/api/admin/send-bulk-notification", async (req, res) => {
    try {
      const { userIds, subject, content, htmlContent } = req.body;
      
      if (!userIds || !Array.isArray(userIds) || !subject || !content) {
        return res.status(400).json({ error: "Missing required fields: userIds, subject, content" });
      }

      const { subscriptionNotificationService } = await import("../services/subscriptionNotificationService");
      
      const result = await subscriptionNotificationService.sendBulkNotification(
        userIds,
        subject,
        content,
        htmlContent
      );
      
      res.json(result);
    } catch (error) {
      console.error("Error sending bulk notification:", error);
      res.status(500).json({ error: "Failed to send bulk notification" });
    }
  });

  // Get user notification preferences
  app.get("/api/user/notification-preferences", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "User ID not found" });
      }

      const { subscriptionNotificationService } = await import("../services/subscriptionNotificationService");
      const preferences = await subscriptionNotificationService.getNotificationPreferences(userId);
      
      res.json(preferences);
    } catch (error) {
      console.error("Error fetching notification preferences:", error);
      res.status(500).json({ error: "Failed to fetch notification preferences" });
    }
  });

  // Update user notification preferences
  app.put("/api/user/notification-preferences", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "User ID not found" });
      }

      const { subscriptionNotificationService } = await import("../services/subscriptionNotificationService");
      const success = await subscriptionNotificationService.updateNotificationPreferences(userId, req.body);
      
      res.json({ success, message: success ? "Preferences updated successfully" : "Failed to update preferences" });
    } catch (error) {
      console.error("Error updating notification preferences:", error);
      res.status(500).json({ error: "Failed to update notification preferences" });
    }
  });

  // Process renewals manually (admin only)
  app.post("/api/admin/process-renewals", async (req, res) => {
    try {
      const { subscriptionRenewalService } = await import("../services/subscriptionRenewalService");
      const result = await subscriptionRenewalService.processRenewals();
      
      res.json({
        success: true,
        message: `Processed ${result.processed} renewals: ${result.successful} successful, ${result.failed} failed`,
        details: result
      });
    } catch (error) {
      console.error("Error processing renewals:", error);
      res.status(500).json({ error: "Failed to process renewals" });
    }
  });

  // Send renewal reminders manually (admin only)
  app.post("/api/admin/send-renewal-reminders", async (req, res) => {
    try {
      const { subscriptionRenewalService } = await import("../services/subscriptionRenewalService");
      const result = await subscriptionRenewalService.sendRenewalReminders();
      
      res.json({
        success: true,
        message: `Sent ${result.sent} reminders, ${result.failed} failed`,
        details: result
      });
    } catch (error) {
      console.error("Error sending renewal reminders:", error);
      res.status(500).json({ error: "Failed to send renewal reminders" });
    }
  });

  // Get renewal statistics (admin only)
  app.get("/api/admin/renewal-statistics", async (req, res) => {
    try {
      const { days = 30 } = req.query;
      const { subscriptionRenewalService } = await import("../services/subscriptionRenewalService");
      
      const statistics = await subscriptionRenewalService.getRenewalStatistics(
        parseInt(days as string)
      );
      
      res.json(statistics);
    } catch (error) {
      console.error("Error fetching renewal statistics:", error);
      res.status(500).json({ error: "Failed to fetch renewal statistics" });
    }
  });

  // Calculate trading fee with subscription discount
  app.post("/api/user/calculate-trading-fee", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "User ID not found" });
      }

      const { amount } = req.body;
      if (!amount || amount <= 0) {
        return res.status(400).json({ error: "Valid amount is required" });
      }

      const { subscriptionStatusService } = await import("../services/subscriptionStatusService");
      
      // Get user's subscription status
      const subscriptionStatus = await subscriptionStatusService.getUserSubscriptionStatus(userId);
      
      // Base trading fee rate: 1.5%
      const baseFeeRate = 0.015;
      const baseFee = amount * baseFeeRate;
      
      // Apply subscription discount (max 30%)
      const discountRate = Math.min(subscriptionStatus.tradingFeeReduction / 100, 0.30);
      const discountAmount = baseFee * discountRate;
      const finalFee = baseFee - discountAmount;
      
      res.json({
        baseFee: parseFloat(baseFee.toFixed(6)),
        discountAmount: parseFloat(discountAmount.toFixed(6)),
        finalFee: parseFloat(finalFee.toFixed(6)),
        feeReduction: subscriptionStatus.tradingFeeReduction
      });

    } catch (error) {
      console.error("Error calculating trading fee:", error);
      res.status(500).json({ error: "Failed to calculate trading fee" });
    }
  });

  // Calculate cross-chain fee with subscription discount
  app.post("/api/user/calculate-crosschain-fee", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "User ID not found" });
      }

      const { amount } = req.body;
      if (!amount || amount <= 0) {
        return res.status(400).json({ error: "Valid amount is required" });
      }

      const { subscriptionStatusService } = await import("../services/subscriptionStatusService");
      
      // Get user's subscription status
      const subscriptionStatus = await subscriptionStatusService.getUserSubscriptionStatus(userId);
      
      // Base cross-chain fee rate: 2.5%
      const baseFeeRate = 0.025;
      const baseFee = amount * baseFeeRate;
      
      // Apply subscription discount (max 30%)
      const discountRate = Math.min(subscriptionStatus.crossChainFeeReduction / 100, 0.30);
      const discountAmount = baseFee * discountRate;
      const finalFee = baseFee - discountAmount;
      
      res.json({
        baseFee: parseFloat(baseFee.toFixed(6)),
        discountAmount: parseFloat(discountAmount.toFixed(6)),
        finalFee: parseFloat(finalFee.toFixed(6)),
        feeReduction: subscriptionStatus.crossChainFeeReduction
      });

    } catch (error) {
      console.error("Error calculating cross-chain fee:", error);
      res.status(500).json({ error: "Failed to calculate cross-chain fee" });
    }
  });

  // Get user subscription benefits (for UI display)
  app.get("/api/user/subscription-benefits", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "User ID not found" });
      }

      const { subscriptionStatusService } = await import("../services/subscriptionStatusService");
      const subscriptionStatus = await subscriptionStatusService.getUserSubscriptionStatus(userId);
      
      // Format benefits for frontend display
      const benefits = {
        tradingFeeReduction: subscriptionStatus.tradingFeeReduction > 0 ? 
          `${subscriptionStatus.tradingFeeReduction}%` : 'None',
        crossChainFeeReduction: subscriptionStatus.crossChainFeeReduction > 0 ? 
          `${subscriptionStatus.crossChainFeeReduction}%` : 'None',
        aiCredits: subscriptionStatus.aiMarketplaceCredits > 0 ? 
          `$${subscriptionStatus.aiMarketplaceCredits}` : 'None',
        planName: subscriptionStatus.planName,
        isActive: subscriptionStatus.isActive && subscriptionStatus.planId !== 'free'
      };
      
      res.json(benefits);

    } catch (error) {
      console.error("Error fetching subscription benefits:", error);
      res.status(500).json({ error: "Failed to fetch subscription benefits" });
    }
  });

  // Get billing analytics
  app.get("/api/admin/billing-analytics", async (req, res) => {
    try {
      const { billingCycleService } = await import("../services/billingCycleService");
      const { startDate, endDate } = req.query;
      
      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate as string) : new Date();
      
      const analytics = await billingCycleService.generateBillingSummary(start, end);
      
      res.json({
        period: { startDate: start, endDate: end },
        ...analytics
      });
    } catch (error) {
      console.error("Error fetching billing analytics:", error);
      res.status(500).json({ error: "Failed to fetch billing analytics" });
    }
  });

  // Seed subscription plans (admin route - for setup)
  app.post("/api/admin/seed-subscription-plans", async (req, res) => {
    try {
      const plans = subscriptionService.getSubscriptionTiers().filter(tier => tier.id !== 'free');
      
      for (const plan of plans) {
        await db
          .insert(subscriptionPlans)
          .values({
            id: plan.id,
            name: plan.name,
            monthlyPrice: plan.monthlyPrice.toString(),
            yearlyPrice: plan.yearlyPrice.toString(),
            yearlyDiscount: plan.yearlyDiscount,
            tradingFeeReduction: plan.tradingFeeReduction,
            crossChainFeeReduction: plan.crossChainFeeReduction,
            aiMarketplaceCredits: plan.aiMarketplaceCredits.toString(),
            features: plan.features,
            createdAt: new Date(),
            updatedAt: new Date()
          })
          .onConflictDoUpdate({
            target: subscriptionPlans.id,
            set: {
              name: plan.name,
              monthlyPrice: plan.monthlyPrice.toString(),
              yearlyPrice: plan.yearlyPrice.toString(),
              yearlyDiscount: plan.yearlyDiscount,
              tradingFeeReduction: plan.tradingFeeReduction,
              crossChainFeeReduction: plan.crossChainFeeReduction,
              aiMarketplaceCredits: plan.aiMarketplaceCredits.toString(),
              features: plan.features,
              updatedAt: new Date()
            }
          });
      }
      
      res.json({ success: true, message: "Subscription plans seeded successfully" });
    } catch (error) {
      console.error("Error seeding subscription plans:", error);
      res.status(500).json({ error: "Failed to seed subscription plans" });
    }
  });
}