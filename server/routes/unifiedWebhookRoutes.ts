/**
 * 🔄 UNIFIED WEBHOOK ROUTES
 * Handles webhooks from ALL payment methods and triggers product delivery
 * CRITICAL: Ensures every payment triggers product delivery regardless of method
 */

import { Router } from 'express';
import express from 'express';
import { unifiedWebhooks } from '../services/unifiedPaymentWebhooks.js';

const router = Router();

/**
 * 💳 STRIPE WEBHOOK HANDLER
 */
router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    console.log('💳 Stripe webhook received');
    
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      console.log('⚠️ Stripe webhook secret not configured - processing anyway');
    }
    
    // Parse the event (simplified for now)
    let event;
    try {
      // In production, verify the signature here
      event = JSON.parse(req.body.toString());
    } catch (err) {
      console.error('❌ Failed to parse Stripe webhook:', err);
      return res.status(400).send('Invalid JSON');
    }
    
    await unifiedWebhooks.handleStripeWebhook(event);
    res.status(200).json({ received: true, method: 'stripe' });
    
  } catch (error) {
    console.error('❌ Stripe webhook processing failed:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * 💙 PAYPAL WEBHOOK HANDLER  
 */
router.post('/paypal', express.json(), async (req, res) => {
  try {
    console.log('💙 PayPal webhook received');
    
    await unifiedWebhooks.handlePayPalWebhook(req.body);
    res.status(200).json({ received: true, method: 'paypal' });
    
  } catch (error) {
    console.error('❌ PayPal webhook processing failed:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * 🔵 CIRCLE/USDC WEBHOOK HANDLER
 */
router.post('/circle', express.json(), async (req, res) => {
  try {
    console.log('🔵 Circle webhook received');
    
    await unifiedWebhooks.handleCircleWebhook(req.body);
    res.status(200).json({ received: true, method: 'circle' });
    
  } catch (error) {
    console.error('❌ Circle webhook processing failed:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * ⛓️ CRYPTO PAYMENT CONFIRMATION
 */
router.post('/crypto', express.json(), async (req, res) => {
  try {
    console.log('⛓️ Crypto payment confirmation received');
    
    await unifiedWebhooks.handleCryptoPayment(req.body);
    res.status(200).json({ received: true, method: 'crypto' });
    
  } catch (error) {
    console.error('❌ Crypto payment processing failed:', error);
    res.status(500).json({ error: 'Payment processing failed' });
  }
});

/**
 * 🌊 XRP PAYMENT CONFIRMATION
 */
router.post('/xrp', express.json(), async (req, res) => {
  try {
    console.log('🌊 XRP payment confirmation received');
    
    await unifiedWebhooks.handleXRPPayment(req.body);
    res.status(200).json({ received: true, method: 'xrp' });
    
  } catch (error) {
    console.error('❌ XRP payment processing failed:', error);
    res.status(500).json({ error: 'Payment processing failed' });
  }
});

/**
 * 🔍 WEBHOOK TEST ENDPOINT
 */
router.post('/test', express.json(), async (req, res) => {
  try {
    console.log('🧪 Test webhook received:', req.body);
    
    // Test the unified webhook system
    const testPayment = {
      paymentMethod: 'test',
      paymentId: 'test_' + Date.now(),
      amount: '9.99',
      currency: 'USD',
      agentId: req.body.agentId || 'test_agent',
      productId: parseInt(req.body.productId) || 1
    };
    
    await unifiedWebhooks['processSuccessfulPayment'](testPayment);
    
    res.json({ 
      success: true, 
      message: 'Test webhook processed successfully',
      testPayment 
    });
    
  } catch (error) {
    console.error('❌ Test webhook failed:', error);
    res.status(500).json({ error: 'Test failed' });
  }
});

/**
 * 📊 WEBHOOK STATUS ENDPOINT
 */
router.get('/status', (req, res) => {
  res.json({
    success: true,
    service: 'Unified Payment Webhooks',
    supported_methods: [
      'stripe',
      'paypal', 
      'circle_usdc',
      'crypto_ethereum',
      'crypto_bitcoin',
      'crypto_solana',
      'crypto_bnb',
      'crypto_base',
      'xrp'
    ],
    endpoints: {
      stripe: '/api/webhooks/stripe',
      paypal: '/api/webhooks/paypal',
      circle: '/api/webhooks/circle',
      crypto: '/api/webhooks/crypto',
      xrp: '/api/webhooks/xrp',
      test: '/api/webhooks/test'
    },
    timestamp: new Date().toISOString()
  });
});

export default router;