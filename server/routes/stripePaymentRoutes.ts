/**
 * 💳 STRIPE PAYMENT INTEGRATION
 * Real payment processing for credit purchases
 */

import express from 'express';
import { stripe } from '../services/stripeClient';
import { secureRevenueAuth } from '../middleware/secureAuthMiddleware.js';
import { FastRevenueService } from '../services/fastRevenueService.js';

const router = express.Router();

// Stripe client - graceful degradation for enterprise readiness

const revenueService = FastRevenueService.getInstance();

/**
 * 💳 Create Payment Intent for Credit Purchase
 */
router.post('/api/fast-revenue/create-payment-intent', secureRevenueAuth, async (req: any, res) => {
  if (!stripe) {
    return res.status(503).json({
      error: 'Stripe payment processing unavailable',
      message: 'STRIPE_SECRET_KEY not configured. Contact administrator.'
    });
  }
  
  try {
    const { creditAmount, tier } = req.body;
    const userId = req.userId;

    if (!creditAmount || !tier) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['creditAmount', 'tier']
      });
    }

    const pricing = {
      basic: 0.05,
      premium: 0.15,
      enterprise: 0.25
    };

    const pricePerCredit = pricing[tier as keyof typeof pricing];
    if (!pricePerCredit) {
      return res.status(400).json({
        error: 'Invalid tier',
        valid_tiers: ['basic', 'premium', 'enterprise']
      });
    }

    const totalCost = creditAmount * pricePerCredit;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(totalCost * 100), // Convert to cents
      currency: "usd",
      metadata: {
        userId,
        creditAmount: creditAmount.toString(),
        tier,
        pricePerCredit: pricePerCredit.toString()
      }
    });

    res.json({ 
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      totalCost,
      creditAmount,
      tier
    });

  } catch (error: any) {
    console.error('❌ Stripe payment intent creation failed:', error);
    res.status(500).json({ 
      error: 'Payment setup failed',
      message: error.message 
    });
  }
});

/**
 * 🔔 Stripe Webhook Handler - Process Successful Payments  
 * Exported separately for raw body parsing before express.json
 */
export const stripeWebhookHandler = async (req: any, res: any) => {
  if (!stripe) {
    return res.status(503).json({
      error: 'Stripe webhook processing unavailable',
      message: 'STRIPE_SECRET_KEY not configured. Contact administrator.'
    });
  }
  
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('💳 WARNING: STRIPE_WEBHOOK_SECRET not set - webhook verification disabled. REQUIRED for production!');
    return res.status(503).json({
      error: 'Stripe webhook verification unavailable',
      message: 'STRIPE_WEBHOOK_SECRET not configured. Contact administrator.'
    });
  }
  
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig as string, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    console.error('❌ Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      
      try {
        const { userId, creditAmount, tier, pricePerCredit } = paymentIntent.metadata;
        
        // Add credits to user account via database
        await revenueService.purchasePremiumCredits(
          userId,
          tier as any,
          parseInt(creditAmount),
          paymentIntent.id,
          parseFloat(pricePerCredit)
        );

        console.log(`✅ Payment confirmed: ${creditAmount} ${tier} credits for user ${userId}`);
        
      } catch (error) {
        console.error('❌ Failed to process confirmed payment:', error);
      }
      break;

    default:
      console.log(`🔔 Unhandled Stripe event type: ${event.type}`);
  }

  res.json({received: true});
};

export default router;