/**
 * STRIPE PAYMENT INTEGRATION
 * Complete Stripe payment processing for AI marketplace orders
 */

import { Router } from 'express';
import { stripe } from '../services/stripeClient';
import { z } from 'zod';
import { db } from '../db';
import { serviceOrders } from '../../shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

async function initializeStripe() {
  return stripe;
}

// Payment intent creation schema
const createPaymentIntentSchema = z.object({
  amount: z.number().min(1, 'Amount must be greater than 0'),
  orderId: z.string().min(1, 'Order ID required'),
  serviceId: z.string().optional(),
  currency: z.string().default('usd')
});

// Create payment intent for order
router.post('/api/stripe/create-payment-intent', async (req, res) => {
  try {
    const stripeInstance = await initializeStripe();
    
    if (!stripeInstance) {
      return res.status(500).json({
        success: false,
        error: 'Payment processing unavailable',
        message: 'Stripe is not configured'
      });
    }

    const validatedData = createPaymentIntentSchema.parse(req.body);

    // Create payment intent with Stripe
    const paymentIntent = await stripeInstance.paymentIntents.create({
      amount: Math.round(validatedData.amount * 100), // Convert to cents
      currency: validatedData.currency,
      metadata: {
        orderId: validatedData.orderId,
        serviceId: validatedData.serviceId || 'marketplace_service'
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    console.log('Payment intent created:', paymentIntent.id);

    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: validatedData.amount
    });

  } catch (error: any) {
    console.error('Stripe payment intent creation error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid payment data',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'Payment setup failed',
      message: error.message || 'Unable to create payment intent'
    });
  }
});

// Confirm payment success and update order
router.post('/api/stripe/confirm-payment', async (req, res) => {
  try {
    const { paymentIntentId, orderId } = req.body;
    
    const stripeInstance = await initializeStripe();
    if (!stripeInstance) {
      return res.status(500).json({
        success: false,
        error: 'Payment verification unavailable'
      });
    }

    // Retrieve payment intent from Stripe
    const paymentIntent = await stripeInstance.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status === 'succeeded') {
      // Update order status in database
      await db.update(serviceOrders)
        .set({ 
          status: 'payment_confirmed',
          paymentTransactionId: paymentIntentId,
          updatedAt: new Date()
        })
        .where(eq(serviceOrders.orderId, orderId));

      console.log('Payment confirmed for order:', orderId);

      res.json({
        success: true,
        message: 'Payment confirmed successfully',
        orderId: orderId,
        paymentStatus: 'succeeded'
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Payment not completed',
        paymentStatus: paymentIntent.status
      });
    }

  } catch (error: any) {
    console.error('Payment confirmation error:', error);
    res.status(500).json({
      success: false,
      error: 'Payment verification failed',
      message: error.message
    });
  }
});

// Webhook for Stripe events
router.post('/api/stripe/webhook', async (req, res) => {
  try {
    const stripeInstance = await initializeStripe();
    if (!stripeInstance) {
      return res.status(500).send('Stripe not configured');
    }

    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripeInstance.webhooks.constructEvent(
        req.body, 
        sig, 
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err: any) {
      console.log('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle payment success
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object;
      const orderId = paymentIntent.metadata.orderId;

      if (orderId) {
        // Update order status
        await db.update(serviceOrders)
          .set({ 
            status: 'payment_confirmed',
            paymentTransactionId: paymentIntent.id,
            updatedAt: new Date()
          })
          .where(eq(serviceOrders.orderId, orderId));

        console.log('Webhook: Payment confirmed for order:', orderId);
      }
    }

    res.json({ received: true });

  } catch (error: any) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default router;