/**
 * Stripe Payment Routes
 * Handles credit/debit card payment processing for P2P transfers
 */

import { Router } from 'express';
import { stripeService } from '../services/stripeService';

const router = Router();

// Test Stripe connection
router.get('/test', async (req, res) => {
  try {
    const isConnected = await stripeService.testAuthentication();
    res.json({
      success: true,
      connected: isConnected,
      configured: stripeService.isConfigured()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to test Stripe connection'
    });
  }
});

// Get Stripe publishable key for frontend
router.get('/config', (req, res) => {
  try {
    res.json({
      publishableKey: stripeService.getPublishableKey(),
      configured: stripeService.isConfigured()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get Stripe configuration'
    });
  }
});

// Create payment intent for P2P transfer
router.post('/create-payment-intent', async (req, res) => {
  try {
    const { amount, currency = 'usd', description, metadata } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid amount is required'
      });
    }

    // Convert dollars to cents
    const amountInCents = Math.round(amount * 100);

    const paymentIntent = await stripeService.createPaymentIntent({
      amount: amountInCents,
      currency,
      description: description || 'P2P Transfer via Coin Railz',
      metadata: {
        service: 'p2p-transfer',
        platform: 'coinrailz',
        ...metadata
      }
    });

    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    console.error('Failed to create payment intent:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create payment intent'
    });
  }
});

// Confirm payment intent
router.post('/confirm-payment', async (req, res) => {
  try {
    const { paymentIntentId } = req.body;

    if (!paymentIntentId) {
      return res.status(400).json({
        success: false,
        error: 'Payment intent ID is required'
      });
    }

    const paymentIntent = await stripeService.retrievePaymentIntent(paymentIntentId);

    res.json({
      success: true,
      status: paymentIntent.status,
      paymentIntent: {
        id: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency
      }
    });
  } catch (error) {
    console.error('Failed to confirm payment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to confirm payment'
    });
  }
});

// Cancel payment intent
router.post('/cancel-payment', async (req, res) => {
  try {
    const { paymentIntentId } = req.body;

    if (!paymentIntentId) {
      return res.status(400).json({
        success: false,
        error: 'Payment intent ID is required'
      });
    }

    const paymentIntent = await stripeService.cancelPaymentIntent(paymentIntentId);

    res.json({
      success: true,
      status: paymentIntent.status,
      message: 'Payment cancelled successfully'
    });
  } catch (error) {
    console.error('Failed to cancel payment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel payment'
    });
  }
});

// Get account information
router.get('/account', async (req, res) => {
  try {
    const account = await stripeService.getAccountInfo();
    
    res.json({
      success: true,
      account: {
        id: account.id,
        country: account.country,
        currency: account.default_currency,
        businessType: account.business_type
      }
    });
  } catch (error) {
    console.error('Failed to get account info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get account information'
    });
  }
});

export default router;