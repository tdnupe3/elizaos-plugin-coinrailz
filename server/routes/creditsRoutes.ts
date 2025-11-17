import { Express, Request, Response } from "express";
import { creditsService } from "../services/creditsService.js";
import Stripe from "stripe";
import { db } from "../db.js";
import { usedTransactionHashes } from "@shared/schema";
import { eq } from "drizzle-orm";
import { ethers } from "ethers";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export function registerCreditsRoutes(app: Express) {
  
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

  // Stripe webhook for payment success
  app.post("/api/credits/webhook/stripe", async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature'];

    if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
      return res.status(400).send('Webhook signature missing');
    }

    try {
      const event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const creditsAmount = parseFloat(session.metadata?.creditsAmount || '0');

        if (userId && creditsAmount > 0) {
          await creditsService.addCredits({
            userId,
            amount: creditsAmount,
            paymentMethod: "stripe",
            referenceId: session.id,
            description: `Purchased ${creditsAmount} credits via Stripe`,
            metadata: { sessionId: session.id, paymentIntentId: session.payment_intent }
          });

          console.log(`✅ Stripe payment processed: User ${userId} +$${creditsAmount}`);
        }
      }

      res.json({ received: true });
    } catch (error: any) {
      console.error('❌ Stripe webhook error:', error);
      res.status(400).send(`Webhook Error: ${error.message}`);
    }
  });

  console.log("✅ Credits routes registered successfully");
}
