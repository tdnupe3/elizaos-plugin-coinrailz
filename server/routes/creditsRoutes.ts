import express, { Express, Request, Response } from "express";
import { creditsService } from "../services/creditsService.js";
import { unifiedCreditsService } from "../services/unifiedCreditsService";
import { stripe } from '../services/stripeClient';
import { db } from "../db.js";
import { usedTransactionHashes } from "@shared/schema";
import { eq } from "drizzle-orm";
import { ethers } from "ethers";
import { handleGptPurchaseWebhook } from "./gptCreditsRoutes";


// Export webhook handler for early registration in server/index.ts
export const creditsStripeWebhookHandler = async (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("❌ STRIPE_WEBHOOK_SECRET not configured");
    return res.status(500).json({ error: "Webhook not configured" });
  }

  let event: Stripe.Event;

  try {
    // req.body is Buffer here due to express.raw in server/index.ts
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err: any) {
    console.error("❌ Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle checkout.session.completed event
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    const userId = session.metadata?.userId;
    const creditsAmount = session.metadata?.creditsAmount;

    if (!userId || !creditsAmount) {
      console.error("❌ Missing metadata in Stripe session:", session.id);
      return res.status(400).json({ error: "Invalid session metadata" });
    }

    try {
      const amount = parseFloat(creditsAmount);
      
      // Credit the user's balance
      const result = await creditsService.addCredits({
        userId,
        amount,
        paymentMethod: "stripe",
        referenceId: session.id,
        description: `Stripe payment - $${amount} credits`,
        metadata: {
          stripeSessionId: session.id,
          stripePaymentIntent: session.payment_intent,
          source: session.metadata?.source
        }
      });

      console.log(`✅ Stripe webhook: Credited $${amount} to user ${userId} (session: ${session.id})`);
      console.log(`💰 New balance: $${result.newBalance}`);

      // Handle GPT-specific purchases (generate API key for polling)
      if (session.metadata?.source === 'gpt') {
        try {
          await handleGptPurchaseWebhook(session, amount);
          console.log(`🤖 GPT webhook: API key generated for session ${session.metadata.gptSessionId}`);
        } catch (gptError: any) {
          console.error("⚠️ GPT API key generation failed (credits still added):", gptError.message);
        }
      }

    } catch (error: any) {
      console.error("❌ Error processing Stripe payment:", error);
      return res.status(500).json({ error: "Failed to credit balance" });
    }
  }

  res.json({ received: true });
};

export function registerCreditsRoutes(app: Express) {
  
  // Stripe webhook is registered in server/index.ts before express.json()
  // This registration is kept for reference but won't execute if /api/credits/stripe-webhook
  // is already registered above
  if (false) {
    app.post("/api/credits/stripe-webhook", 
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
        // req.body is Buffer here due to express.raw
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      } catch (err: any) {
        console.error("❌ Webhook signature verification failed:", err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }

      // Handle checkout.session.completed event
      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;

        const userId = session.metadata?.userId;
        const creditsAmount = session.metadata?.creditsAmount;

        if (!userId || !creditsAmount) {
          console.error("❌ Missing metadata in Stripe session:", session.id);
          return res.status(400).json({ error: "Invalid session metadata" });
        }

        try {
          const amount = parseFloat(creditsAmount);
          
          // Credit the user's balance
          const result = await creditsService.addCredits({
            userId,
            amount,
            paymentMethod: "stripe",
            referenceId: session.id,
            description: `Stripe payment - $${amount} credits`,
            metadata: {
              stripeSessionId: session.id,
              stripePaymentIntent: session.payment_intent
            }
          });

          console.log(`✅ Stripe webhook: Credited $${amount} to user ${userId} (session: ${session.id})`);
          console.log(`💰 New balance: $${result.newBalance}`);

        } catch (error: any) {
          console.error("❌ Error processing Stripe payment:", error);
          return res.status(500).json({ error: "Failed to credit balance" });
        }
      }

      res.json({ received: true });
    });
  }
  
  // Get credits balance
  app.get("/api/credits/balance", async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const balance = await creditsService.getBalance(req.user.id);
      const account = await creditsService.getOrCreateAccount(req.user.id);

      res.json({
        balance,
        autoTopUpEnabled: account.autoTopUpEnabled,
        autoTopUpThreshold: parseFloat(account.autoTopUpThreshold),
        preferredPaymentMethod: account.preferredPaymentMethod
      });
    } catch (error: any) {
      console.error("❌ Error fetching credits balance:", error);
      res.status(500).json({ error: "Failed to fetch balance" });
    }
  });

  app.get("/api/credits/unified-balance", async (req: Request, res: Response) => {
    try {
      const email = req.query.email as string;
      const apiKey = req.headers['x-api-key'] as string;

      let userId: string | undefined;

      if (req.user?.id) {
        userId = req.user.id;
      } else if (email && apiKey) {
        const validKey = await creditsService.validateApiKey(apiKey);
        if (validKey && validKey.userId === email) {
          userId = email;
        } else {
          return res.status(403).json({ error: "Invalid API key for this email" });
        }
      }

      if (!userId) {
        return res.status(401).json({ error: "Authentication required - provide session or API key" });
      }

      const unifiedBalance = await unifiedCreditsService.getBalance('user', userId);

      res.json({
        success: true,
        userId,
        balance: unifiedBalance,
        totalFormatted: `$${unifiedBalance.toFixed(2)}`,
      });
    } catch (error: any) {
      console.error("❌ Error fetching unified balance:", error);
      res.status(500).json({ error: "Failed to fetch unified balance" });
    }
  });

  // Get transaction history
  app.get("/api/credits/transactions", async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const transactions = await creditsService.getTransactionHistory(req.user.id, limit);

      res.json({ transactions });
    } catch (error: any) {
      console.error("❌ Error fetching transaction history:", error);
      res.status(500).json({ error: "Failed to fetch transactions" });
    }
  });

  // Purchase credits with Stripe
  app.post("/api/credits/purchase/stripe", async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { amount } = req.body;

    if (!amount || amount < 10) {
      return res.status(400).json({ error: "Minimum purchase is $10" });
    }

    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [{
          price_data: {
            currency: "usd",
            product_data: {
              name: "Coin Railz Credits",
              description: `$${amount} in platform credits`
            },
            unit_amount: amount * 100
          },
          quantity: 1
        }],
        mode: "payment",
        success_url: `${process.env.REPLIT_DOMAINS?.split(',')[0] || 'http://localhost:5000'}/credits?success=true`,
        cancel_url: `${process.env.REPLIT_DOMAINS?.split(',')[0] || 'http://localhost:5000'}/credits?canceled=true`,
        metadata: {
          userId: req.user.id,
          creditsAmount: amount.toString()
        }
      });

      res.json({ sessionId: session.id, url: session.url });
    } catch (error: any) {
      console.error("❌ Stripe checkout error:", error);
      res.status(500).json({ error: "Failed to create checkout session" });
    }
  });

  // Purchase credits with USDC/USDT
  app.post("/api/credits/purchase/crypto", async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { txHash, token, chain, amount } = req.body;

    if (!txHash || !token || !chain || !amount) {
      return res.status(400).json({ error: "Missing required fields: txHash, token, chain, amount" });
    }

    if (!["usdc", "usdt"].includes(token.toLowerCase())) {
      return res.status(400).json({ error: "Only USDC and USDT are accepted" });
    }

    try {
      const existingTx = await db.query.usedTransactionHashes.findFirst({
        where: eq(usedTransactionHashes.txHash, txHash)
      });

      if (existingTx) {
        return res.status(400).json({ error: "Transaction hash already used" });
      }

      const provider = new ethers.providers.JsonRpcProvider(
        chain === "base" 
          ? "https://mainnet.base.org"
          : chain === "ethereum"
          ? `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
          : `https://polygon-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
      );

      const tx = await provider.getTransaction(txHash);
      
      if (!tx || !tx.blockNumber) {
        return res.status(400).json({ error: "Transaction not found or not confirmed" });
      }

      const platformWallet = process.env.PLATFORM_WALLET_ADDRESS || "0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91";
      
      if (tx.to?.toLowerCase() !== platformWallet.toLowerCase()) {
        return res.status(400).json({ error: "Transaction not sent to platform wallet" });
      }

      await db.insert(usedTransactionHashes).values({
        txHash,
        network: chain,
        serviceName: "credits_purchase",
        amount: amount.toString(),
        paidBy: tx.from
      });

      const creditsAmount = parseFloat(amount);

      const result = await creditsService.addCredits({
        userId: req.user.id,
        amount: creditsAmount,
        paymentMethod: token.toLowerCase() as "usdc" | "usdt",
        referenceId: txHash,
        description: `Purchased ${creditsAmount} credits with ${token.toUpperCase()} on ${chain}`,
        metadata: { chain, token, txHash }
      });

      res.json({
        success: true,
        newBalance: result.newBalance,
        transactionId: result.transactionId
      });

    } catch (error: any) {
      console.error("❌ Crypto purchase error:", error);
      res.status(500).json({ error: error.message || "Failed to process crypto payment" });
    }
  });

  console.log("✅ Credits routes registered successfully");
}
