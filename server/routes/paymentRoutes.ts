/**
 * Payment Processing Routes
 * Handles Stripe, PayPal, and USDC payments for marketplace orders
 */

import { Router } from 'express';
import { PaymentIntegrationService } from '../services/paymentIntegration';
import { isAuthenticated } from '../replitAuth';
import { z } from 'zod';

const router = Router();

/**
 * Create payment intent for marketplace order
 */
router.post('/create-payment-intent', isAuthenticated, async (req: any, res) => {
  try {
    const schema = z.object({
      orderId: z.string().min(1),
      amount: z.number().positive(),
      currency: z.string().default('USD'),
      paymentMethod: z.enum(['stripe', 'paypal', 'usdc']).default('stripe'),
      description: z.string().optional()
    });

    const validatedData = schema.parse(req.body);
    const customerId = req.user?.claims?.sub;

    if (!customerId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const result = await PaymentIntegrationService.createEscrowPayment({
      orderId: validatedData.orderId,
      customerId,
      agentId: 'pending', // Will be updated when order is fully created
      amount: validatedData.amount,
      currency: validatedData.currency,
      paymentMethod: validatedData.paymentMethod,
      description: validatedData.description || 'AI Marketplace Service'
    });

    if (result.success) {
      res.json({
        success: true,
        clientSecret: result.clientSecret,
        paymentIntentId: result.paymentIntent?.id
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to create payment intent'
      });
    }
  } catch (error: any) {
    console.error('Payment intent creation error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Payment intent creation failed' 
    });
  }
});

/**
 * Confirm payment and update order status
 */
router.post('/confirm-payment', isAuthenticated, async (req: any, res) => {
  try {
    const schema = z.object({
      orderId: z.string().min(1),
      paymentIntentId: z.string().min(1)
    });

    const validatedData = schema.parse(req.body);
    const customerId = req.user?.claims?.sub;

    if (!customerId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    // Find the order and update payment status
    const allOrders = (global as any).orders || [];
    const orderIndex = allOrders.findIndex((order: any) => 
      order.orderId === validatedData.orderId && order.customerId === customerId
    );

    if (orderIndex === -1) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    // Update order status to active (payment confirmed)
    allOrders[orderIndex].status = 'active';
    allOrders[orderIndex].paymentIntentId = validatedData.paymentIntentId;
    allOrders[orderIndex].paymentConfirmedAt = new Date().toISOString();
    allOrders[orderIndex].updatedAt = new Date().toISOString();

    res.json({
      success: true,
      order: allOrders[orderIndex],
      message: 'Payment confirmed successfully'
    });
  } catch (error: any) {
    console.error('Payment confirmation error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Payment confirmation failed' 
    });
  }
});

/**
 * Get payment status for an order
 */
router.get('/payment-status/:orderId', isAuthenticated, async (req: any, res) => {
  try {
    const { orderId } = req.params;
    const customerId = req.user?.claims?.sub;

    if (!customerId || !orderId) {
      return res.status(400).json({ success: false, error: 'Missing required parameters' });
    }

    const paymentStatus = await PaymentIntegrationService.getPaymentStatus(orderId);

    res.json({
      success: true,
      orderId,
      paymentStatus
    });
  } catch (error: any) {
    console.error('Payment status check error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Payment status check failed' 
    });
  }
});

/**
 * Handle Stripe webhook events
 */
router.post('/stripe-webhook', async (req, res) => {
  try {
    // In production, verify the webhook signature
    const event = req.body;

    switch (event.type) {
      case 'payment_intent.succeeded':
        console.log('Payment succeeded:', event.data.object.id);
        // Update order status in database
        break;
      case 'payment_intent.payment_failed':
        console.log('Payment failed:', event.data.object.id);
        // Handle payment failure
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).json({ error: 'Webhook handling failed' });
  }
});

/**
 * Create PayPal order
 */
router.post('/paypal/create-order', isAuthenticated, async (req: any, res) => {
  try {
    const schema = z.object({
      orderId: z.string().min(1),
      amount: z.number().positive(),
      currency: z.string().default('USD')
    });

    const validatedData = schema.parse(req.body);
    const customerId = req.user?.claims?.sub;

    if (!customerId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const result = await PaymentIntegrationService.createPayPalOrder({
      orderId: validatedData.orderId,
      customerId,
      agentId: 'pending',
      amount: validatedData.amount,
      currency: validatedData.currency,
      paymentMethod: 'paypal',
      description: 'AI Marketplace Service'
    });

    if (result.success) {
      res.json({
        success: true,
        paypalOrderId: result.orderId
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to create PayPal order'
      });
    }
  } catch (error: any) {
    console.error('PayPal order creation error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'PayPal order creation failed' 
    });
  }
});

/**
 * Process USDC payment
 */
router.post('/usdc/process-payment', isAuthenticated, async (req: any, res) => {
  try {
    const schema = z.object({
      orderId: z.string().min(1),
      amount: z.number().positive(),
      walletAddress: z.string().min(1)
    });

    const validatedData = schema.parse(req.body);
    const customerId = req.user?.claims?.sub;

    if (!customerId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const result = await PaymentIntegrationService.processUSDCPayment({
      orderId: validatedData.orderId,
      customerId,
      agentId: 'pending',
      amount: validatedData.amount,
      currency: 'USDC',
      paymentMethod: 'usdc',
      description: 'AI Marketplace Service'
    });

    if (result.success) {
      res.json({
        success: true,
        transactionId: result.transactionId
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to process USDC payment'
      });
    }
  } catch (error: any) {
    console.error('USDC payment error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'USDC payment failed' 
    });
  }
});

export { router as paymentRoutes };