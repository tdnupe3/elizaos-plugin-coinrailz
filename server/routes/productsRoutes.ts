import express, { Express, Request, Response } from "express";
import { stripe } from '../services/stripeClient';

export function registerProductsRoutes(app: Express) {
  
  // Create Stripe checkout session for product purchases
  app.post("/api/products/checkout", async (req: Request, res: Response) => {
    const { productType, priceId } = req.body;

    if (!productType) {
      return res.status(400).json({ error: "Product type is required" });
    }

    try {
      const baseUrl = process.env.REPLIT_DEPLOYMENT === '1' 
        ? 'https://coinrailz.com' 
        : 'http://localhost:5000';

      // Product configurations
      const products = {
        ai_agent_bundle: {
          launch: {
            name: "AI Agent Pro Bundle - Launch Price",
            description: "Access to all 18 x402-powered AI services. Launch price locked in forever!",
            price: 49.00,
            recurring: true
          },
          regular: {
            name: "AI Agent Pro Bundle",
            description: "Access to all 18 x402-powered AI services",
            price: 99.00,
            recurring: true
          }
        }
      };

      const tier = priceId === 'price_bundle_49' ? 'launch' : 'regular';
      const product = products.ai_agent_bundle[tier];

      if (!product) {
        return res.status(400).json({ error: "Invalid product configuration" });
      }

      // Create Stripe checkout session
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: product.recurring ? "subscription" : "payment",
        line_items: [{
          price_data: {
            currency: "usd",
            product_data: {
              name: product.name,
              description: product.description
            },
            unit_amount: Math.round(product.price * 100),
            ...(product.recurring && {
              recurring: {
                interval: "month"
              }
            })
          },
          quantity: 1
        }],
        success_url: `${baseUrl}/dashboard?purchase=success&product=${productType}`,
        cancel_url: `${baseUrl}/products/ai-agent-bundle?canceled=true`,
        metadata: {
          userId: req.user?.id || 'guest',
          productType,
          priceId,
          tier
        }
      });

      console.log(`✅ Created checkout session for ${productType} (${tier}): ${session.id}`);
      
      res.json({ 
        sessionId: session.id, 
        url: session.url 
      });

    } catch (error: any) {
      console.error("❌ Product checkout error:", error);
      res.status(500).json({ error: "Failed to create checkout session" });
    }
  });

  // Webhook handler for product purchases (will be registered in server/index.ts)
  app.post("/api/products/stripe-webhook", 
    express.raw({ type: "application/json" }),
    async (req: Request, res: Response) => {
      const sig = req.headers["stripe-signature"] as string;
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

      if (!webhookSecret) {
        console.error("❌ STRIPE_WEBHOOK_SECRET not configured");
        return res.status(500).json({ error: "Webhook not configured" });
      }

      let event: Stripe.Event;

      try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      } catch (err: any) {
        console.error("❌ Webhook signature verification failed:", err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }

      // Handle checkout.session.completed event
      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;

        const userId = session.metadata?.userId;
        const productType = session.metadata?.productType;
        const tier = session.metadata?.tier;

        console.log(`✅ Product purchase completed: ${productType} (${tier}) for user ${userId}`);
        console.log(`   Session ID: ${session.id}`);
        console.log(`   Subscription ID: ${session.subscription || 'N/A'}`);

        // TODO: Activate product access in database
        // For now, just log the successful purchase
        // In production, you would:
        // 1. Create subscription record in database
        // 2. Grant access to AI services
        // 3. Send confirmation email
        // 4. Update user's subscription tier
      }

      res.json({ received: true });
    }
  );

  console.log("✅ Products routes registered");
}
