/**
 * Payment Routes for AI Marketplace
 * Comprehensive payment processing with multiple methods
 */

import { Router } from 'express';
import { z } from 'zod';
import { paymentProcessor } from '../services/paymentProcessor';
import { isAuthenticated } from '../replitAuth';
import { storage } from '../storage';
import Stripe from 'stripe';
// PayPal integration using existing server functions
import { Request, Response } from 'express';

const router = Router();

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-07-30.basil",
});

// Payment method schema
const createPaymentSchema = z.object({
  orderId: z.string().min(1),
  amount: z.number().min(0.01),
  currency: z.string().default('USD'),
  paymentMethod: z.enum(['stripe', 'paypal', 'circle_usdc', 'crypto']),
  agentId: z.string().min(1),
  metadata: z.any().optional()
});

/**
 * Create payment intent for any supported method
 */
router.post('/create-payment', isAuthenticated, async (req: any, res) => {
  try {
    const paymentData = createPaymentSchema.parse(req.body);
    const customerId = req.user?.claims?.sub;

    if (!customerId) {
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication required' 
      });
    }

    const paymentRequest = {
      ...paymentData,
      customerId
    };

    const result = await paymentProcessor.processPayment(paymentRequest);

    res.json({
      success: result.success,
      paymentId: result.paymentId,
      clientSecret: result.clientSecret,
      paypalOrderId: result.paypalOrderId,
      amount: result.amount,
      platformFee: result.platformFee,
      agentPayout: result.agentPayout,
      status: result.status,
      error: result.error
    });

  } catch (error: any) {
    console.error('Create payment error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid payment data',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Payment creation failed'
    });
  }
});

/**
 * Stripe-specific routes
 */
router.post('/stripe/create-payment-intent', isAuthenticated, async (req: any, res) => {
  try {
    const { amount, orderId, agentId } = req.body;
    const customerId = req.user?.claims?.sub;

    const result = await paymentProcessor.processPayment({
      orderId,
      amount,
      currency: 'USD',
      paymentMethod: 'stripe',
      customerId,
      agentId
    });

    res.json({
      success: result.success,
      clientSecret: result.clientSecret,
      paymentId: result.paymentId,
      platformFee: result.platformFee,
      agentPayout: result.agentPayout
    });

  } catch (error: any) {
    console.error('Stripe payment error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Stripe payment failed' 
    });
  }
});

/**
 * PayPal-specific routes
 */
router.get('/paypal/setup', async (req, res) => {
  // PayPal setup using environment variables
  try {
    if (!process.env.PAYPAL_CLIENT_ID) {
      return res.status(500).json({ error: 'PayPal not configured' });
    }
    
    res.json({
      clientId: process.env.PAYPAL_CLIENT_ID,
      environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox'
    });
  } catch (error: any) {
    res.status(500).json({ error: 'PayPal setup failed' });
  }
});

router.post('/paypal/create-order', isAuthenticated, async (req: any, res) => {
  try {
    const { amount, orderId, agentId } = req.body;
    const customerId = req.user?.claims?.sub;

    const result = await paymentProcessor.processPayment({
      orderId,
      amount,
      currency: 'USD',
      paymentMethod: 'paypal',
      customerId,
      agentId
    });

    // Return PayPal order details for frontend processing
    res.json({
      success: result.success,
      paypalOrderId: result.paypalOrderId,
      amount: result.amount,
      platformFee: result.platformFee,
      agentPayout: result.agentPayout
    });

  } catch (error: any) {
    console.error('PayPal order creation error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'PayPal order creation failed' 
    });
  }
});

router.post('/paypal/capture/:orderID', isAuthenticated, async (req: any, res) => {
  try {
    // Complete the payment in our system
    const paymentId = req.params.orderID;
    const result = await paymentProcessor.completePayment(paymentId);

    res.json({
      success: result.success,
      message: 'PayPal payment captured and agent payout processed',
      agentPayoutId: result.agentPayoutId
    });

  } catch (error: any) {
    console.error('PayPal capture error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'PayPal capture failed' 
    });
  }
});

/**
 * Circle USDC payment routes
 */
router.post('/circle/create-payment', isAuthenticated, async (req: any, res) => {
  try {
    const { amount, orderId, agentId } = req.body;
    const customerId = req.user?.claims?.sub;

    const result = await paymentProcessor.processPayment({
      orderId,
      amount,
      currency: 'USDC',
      paymentMethod: 'circle_usdc',
      customerId,
      agentId
    });

    res.json({
      success: result.success,
      paymentId: result.paymentId,
      amount: result.amount,
      platformFee: result.platformFee,
      agentPayout: result.agentPayout,
      instructions: 'Transfer USDC to the provided wallet address'
    });

  } catch (error: any) {
    console.error('Circle USDC payment error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Circle USDC payment failed' 
    });
  }
});

/**
 * Crypto payment routes
 */
router.post('/crypto/create-payment', isAuthenticated, async (req: any, res) => {
  try {
    const { amount, orderId, agentId, currency = 'ETH' } = req.body;
    const customerId = req.user?.claims?.sub;

    const result = await paymentProcessor.processPayment({
      orderId,
      amount,
      currency,
      paymentMethod: 'crypto',
      customerId,
      agentId
    });

    res.json({
      success: result.success,
      paymentId: result.paymentId,
      amount: result.amount,
      currency,
      platformFee: result.platformFee,
      agentPayout: result.agentPayout,
      instructions: 'Connect your wallet and confirm the transaction'
    });

  } catch (error: any) {
    console.error('Crypto payment error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Crypto payment failed' 
    });
  }
});

/**
 * Complete payment (webhook or manual confirmation)
 */
router.post('/complete-payment/:paymentId', isAuthenticated, async (req: any, res) => {
  try {
    const { paymentId } = req.params;
    
    const result = await paymentProcessor.completePayment(paymentId);

    res.json({
      success: result.success,
      message: 'Payment completed and agent payout processed',
      agentPayoutId: result.agentPayoutId,
      error: result.error
    });

  } catch (error: any) {
    console.error('Complete payment error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Payment completion failed' 
    });
  }
});

/**
 * Agent earnings and payout routes
 */
router.get('/agent/earnings', isAuthenticated, async (req: any, res) => {
  try {
    const agentId = req.user?.claims?.sub;
    
    if (!agentId) {
      return res.status(401).json({ 
        success: false, 
        error: 'Agent authentication required' 
      });
    }

    const earnings = await paymentProcessor.getAgentEarnings(agentId);

    res.json({
      success: true,
      earnings
    });

  } catch (error: any) {
    console.error('Get agent earnings error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to get earnings' 
    });
  }
});

/**
 * Payment methods info endpoint
 */
router.get('/methods', async (req, res) => {
  res.json({
    success: true,
    methods: [
      {
        id: 'stripe',
        name: 'Credit/Debit Card',
        description: 'Pay with credit or debit card via Stripe',
        fees: '2.9% + $0.30',
        processingTime: 'Instant',
        supported: true
      },
      {
        id: 'paypal',
        name: 'PayPal',
        description: 'Pay with your PayPal account',
        fees: '2.9% + $0.30',
        processingTime: 'Instant',
        supported: true
      },
      {
        id: 'circle_usdc',
        name: 'USDC',
        description: 'Pay with USD Coin (USDC)',
        fees: '1.0%',
        processingTime: '1-2 minutes',
        supported: true
      },
      {
        id: 'crypto',
        name: 'Cryptocurrency',
        description: 'Pay with ETH, BTC, or other crypto',
        fees: 'Network gas fees only',
        processingTime: '5-15 minutes',
        supported: true
      }
    ],
    platformFee: '15%',
    agentPayout: '85%'
  });
});

/**
 * Stripe webhook for payment confirmations
 */
router.post('/stripe/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig!, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    console.error('Stripe webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        await paymentProcessor.completePayment(paymentIntent.id);
        break;

      case 'payment_intent.payment_failed':
        const failedPayment = event.data.object;
        await storage.updatePaymentIntentStatus(failedPayment.id, 'failed');
        break;

      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
  } catch (error: any) {
    console.error('Stripe webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default router;