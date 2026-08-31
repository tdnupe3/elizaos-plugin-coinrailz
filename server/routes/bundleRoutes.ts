import { Router, Request, Response, NextFunction } from "express";
import express from "express";
import { SERVICE_BUNDLES, getBundlesForService, getServicesInBundle, calculateBundleSavings } from "../config/serviceBundles";
import { stripe } from '../services/stripeClient';
import { db } from "../db";
import { serviceBundleSubscriptions, serviceBundleUsage } from "../../shared/schema";
import { eq, and, desc } from "drizzle-orm";
import crypto from "crypto";
import type Stripe from "stripe";

const router = Router();

// Initialize Stripe

// GET /api/bundles/service/:serviceSlug - Get bundles that include a specific service
// CRITICAL: This route MUST be registered BEFORE the generic /:bundleId route
router.get("/service/:serviceSlug", (req, res) => {
  const { serviceSlug } = req.params;
  const bundles = getBundlesForService(serviceSlug);
  
  if (bundles.length === 0) {
    return res.status(404).json({ error: "Service not found in any bundle" });
  }

  res.json({ bundles });
});

// GET /api/bundles - List all service bundles
router.get("/", (req, res) => {
  res.json({
    bundles: SERVICE_BUNDLES.map(bundle => ({
      ...bundle,
      savings: {
        starter: calculateBundleSavings(bundle.id, 'starter'),
        professional: calculateBundleSavings(bundle.id, 'professional'),
        enterprise: calculateBundleSavings(bundle.id, 'enterprise')
      }
    }))
  });
});

// GET /api/bundles/:bundleId - Get details for a specific bundle
// CRITICAL: This route must be AFTER /service/:serviceSlug to avoid conflicts
router.get("/:bundleId", (req, res) => {
  const { bundleId } = req.params;
  const bundle = SERVICE_BUNDLES.find(b => b.id === bundleId);
  
  if (!bundle) {
    return res.status(404).json({ error: "Bundle not found" });
  }

  const services = getServicesInBundle(bundleId);
  const savings = {
    starter: calculateBundleSavings(bundleId, 'starter'),
    professional: calculateBundleSavings(bundleId, 'professional'),
    enterprise: calculateBundleSavings(bundleId, 'enterprise')
  };

  res.json({
    ...bundle,
    services,
    savings
  });
});

// POST /api/bundles/checkout - Create Stripe checkout session
router.post("/checkout", async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ error: "Stripe is not configured" });
  }

  const { bundleId, tier } = req.body;

  const bundle = SERVICE_BUNDLES.find(b => b.id === bundleId);
  if (!bundle) {
    return res.status(404).json({ error: "Bundle not found" });
  }

  const tierKey = tier as 'starter' | 'professional' | 'enterprise';
  if (!bundle.pricingTiers[tierKey]) {
    return res.status(400).json({ error: "Invalid tier" });
  }

  const pricing = bundle.pricingTiers[tierKey];

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${bundle.name} - ${tier.charAt(0).toUpperCase() + tier.slice(1)}`,
              description: bundle.description,
              metadata: {
                bundleId,
                tier,
                credits: pricing.creditsPerMonth.toString(),
              },
            },
            unit_amount: Math.round(pricing.monthlyUsd * 100), // Convert to cents
            recurring: {
              interval: "month",
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.REPLIT_DEPLOYMENT === '1' 
        ? 'https://coinrailz.com'
        : `https://${process.env.REPLIT_DOMAINS || 'localhost:5000'}`}/bundles/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.REPLIT_DEPLOYMENT === '1' 
        ? 'https://coinrailz.com'
        : `https://${process.env.REPLIT_DOMAINS || 'localhost:5000'}`}/bundles`,
      metadata: {
        bundleId,
        tier,
        credits: pricing.creditsPerMonth.toString(),
      },
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

// POST /api/bundles/webhook - Stripe webhook handler
// CRITICAL: This route MUST receive raw body for signature verification
// It's mounted in server/index.ts BEFORE express.json() middleware
export async function bundleStripeWebhookHandler(req: Request, res: Response) {
    if (!stripe) {
      return res.status(500).json({ error: "Stripe is not configured" });
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('❌ STRIPE_WEBHOOK_SECRET not configured — rejecting webhook');
      return res.status(500).json({ error: 'Webhook not configured' });
    }

    const sig = req.headers['stripe-signature'];
    if (!sig) {
      return res.status(400).json({ error: 'Missing stripe-signature header' });
    }

    let event: Stripe.Event;

    try {
      // req.body is a Buffer here because of express.raw()
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        webhookSecret
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return res.status(400).json({ error: 'Webhook signature verification failed' });
    }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      
      // Create subscription in database
      const bundleId = session.metadata?.bundleId;
      const tier = session.metadata?.tier;
      const credits = parseInt(session.metadata?.credits || '0');
      
      if (bundleId && tier && credits) {
        const bundle = SERVICE_BUNDLES.find(b => b.id === bundleId);
        if (bundle) {
          const pricing = bundle.pricingTiers[tier as 'starter' | 'professional' | 'enterprise'];
          
          // Generate API key for the subscription
          const apiKey = `sb_${crypto.randomBytes(32).toString('hex')}`;
          const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');
          
          const currentPeriodEnd = new Date();
          currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);
          
          await db.insert(serviceBundleSubscriptions).values({
            bundleId,
            tier,
            subscriberId: session.customer as string || session.client_reference_id || 'unknown',
            subscriberType: 'user',
            status: 'active',
            creditsTotal: credits,
            creditsUsed: 0,
            creditsRemaining: credits,
            monthlyPrice: pricing.monthlyUsd.toString(),
            paymentMethod: 'stripe',
            stripeSubscriptionId: session.subscription as string,
            stripeCustomerId: session.customer as string,
            currentPeriodEnd,
            nextBillingDate: currentPeriodEnd,
            email: session.customer_details?.email || null,
            apiKeyHash: hashedKey, // Store hashed key in dedicated column
            metadata: {
              rawApiKey: apiKey, // Store temporarily for first display to user
            },
          });
          
          console.log(`✅ Created bundle subscription: ${bundleId} ${tier} for ${session.customer}`);
        }
      }
      break;
    }

    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      
      // Update subscription status in database
      // This will be implemented when we add subscription management
      console.log(`📊 Subscription ${event.type}:`, subscription.id);
      break;
    }
  }

  res.json({ received: true });
}

// Note: The webhook route is mounted in server/index.ts before JSON parsing middleware
// router.post("/webhook") is not used - see bundleStripeWebhookHandler export above

// GET /api/subscriptions/me - Get current user's bundle subscriptions
router.get("/subscriptions/me", async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const callerId: string = (req.user as any).id || (req.user as any).claims?.sub || '';
  if (!callerId) {
    return res.status(401).json({ error: "Unable to identify caller" });
  }

  try {
    const rawSubs = await db
      .select()
      .from(serviceBundleSubscriptions)
      .where(eq(serviceBundleSubscriptions.subscriberId, callerId))
      .orderBy(desc(serviceBundleSubscriptions.createdAt));

    const enrichedSubscriptions = rawSubs.map(sub => {
      const bundle = SERVICE_BUNDLES.find(b => b.id === sub.bundleId);
      return {
        ...sub,
        apiKeyHash: undefined, // never expose key material
        bundleName: bundle?.name || sub.bundleId,
      };
    });

    res.json({ subscriptions: enrichedSubscriptions });
  } catch (error) {
    console.error("Get subscriptions error:", error);
    res.status(500).json({ error: "Failed to fetch subscriptions" });
  }
});

// GET /api/subscriptions/usage/:subscriptionId - Get usage history for a subscription
router.get("/subscriptions/usage/:subscriptionId", async (req, res) => {
  const subscriptionId = parseInt(req.params.subscriptionId);

  if (isNaN(subscriptionId)) {
    return res.status(400).json({ error: "Invalid subscription ID" });
  }

  try {
    const usage = await db
      .select()
      .from(serviceBundleUsage)
      .where(eq(serviceBundleUsage.subscriptionId, subscriptionId))
      .orderBy(desc(serviceBundleUsage.timestamp))
      .limit(100);

    res.json({ usage });
  } catch (error) {
    console.error("Get usage error:", error);
    res.status(500).json({ error: "Failed to fetch usage history" });
  }
});

export default router;
