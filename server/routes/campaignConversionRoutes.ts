import express from 'express';
// import secureAuthMiddleware from '../middleware/secureAuthMiddleware.js';
import { FastRevenueDatabaseService } from '../services/fastRevenueDatabaseService.js';
import { stripe } from '../services/stripeClient';
import type Stripe from 'stripe';

const router = express.Router();

// Simple test endpoint to verify campaign routes are working
router.get('/test', (req, res) => {
  console.log('✅ CAMPAIGN ROUTES TEST ENDPOINT HIT');
  res.json({ 
    success: true, 
    message: 'Campaign routes are working',
    timestamp: new Date().toISOString() 
  });
});


const fastRevenueDatabaseService = FastRevenueDatabaseService.getInstance();

interface CampaignConversion {
  id: string;
  campaign_id: string;
  campaign_type: string;
  session_id?: string;
  customer_email: string;
  customer_info: any;
  payment_intent_id?: string;
  conversion_stage: 'initiated' | 'payment_created' | 'payment_completed' | 'delivered';
  amount: number;
  metadata: any;
  created_at: Date;
  updated_at: Date;
}

/**
 * Create checkout session for campaign conversion
 * POST /api/campaigns/checkout
 */
router.post('/checkout', async (req, res) => {
  try {
    const {
      campaign_id,
      campaign_type,
      session_id,
      customer_info,
      payment_method = 'stripe', // 'stripe', 'paypal', or 'usdc'
      metadata = {}
    } = req.body;

    // Validate required fields
    if (!campaign_id || !customer_info?.email) {
      return res.status(400).json({
        error: 'Missing required fields: campaign_id, customer_info.email'
      });
    }

    // Validate payment method
    if (!['stripe', 'paypal', 'usdc'].includes(payment_method)) {
      return res.status(400).json({
        error: 'Invalid payment method. Must be "stripe", "paypal", or "usdc"'
      });
    }

    // Server-side pricing validation - NO CLIENT PRICING CONTROL
    const campaignPricing = {
      'defi-partnership': 5000,
      'infrastructure-partnership': 5000,
      'gaming-ecosystem': 5000,
      'creator-economy': 5000
    };

    const amount = campaignPricing[campaign_id as keyof typeof campaignPricing];
    if (!amount) {
      return res.status(400).json({
        error: 'Invalid campaign ID - pricing not found'
      });
    }

    let paymentData: any = {};
    let paymentIntentId: string | null = null;

    if (payment_method === 'stripe') {
      // Create Stripe payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: 'usd',
        automatic_payment_methods: {
          enabled: true,
        },
        metadata: {
          campaign_id,
          campaign_type,
          session_id: session_id || '',
          customer_email: customer_info.email,
          source: 'campaign_conversion',
          ...metadata
        },
        description: `Campaign Partnership: ${metadata.offer_name || campaign_id}`,
        receipt_email: customer_info.email,
      });

      paymentData = {
        client_secret: paymentIntent.client_secret,
        payment_intent_id: paymentIntent.id,
        payment_method: 'stripe'
      };
      paymentIntentId = paymentIntent.id;
    } else if (payment_method === 'paypal') {
      // PayPal order will be created on frontend using our PayPal routes
      paymentData = {
        payment_method: 'paypal',
        amount: amount,
        currency: 'USD',
        paypal_setup_url: '/api/paypal/setup',
        paypal_create_url: '/api/paypal/order',
        paypal_capture_url: '/api/paypal/order/{orderID}/capture'
      };
      paymentIntentId = `paypal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    } else if (payment_method === 'usdc') {
      // USDC payment setup - customer will send to our Circle wallet
      try {
        const { CircleService } = await import('../services/circleService');
        const circleService = new CircleService();
        
        // Get platform wallet for receiving USDC
        const wallets = await circleService.listWallets();
        const platformWallet = wallets?.[0]; // Use first available wallet
        
        if (!platformWallet) {
          return res.status(500).json({
            error: 'USDC payment processing unavailable - no platform wallet'
          });
        }

        paymentData = {
          payment_method: 'usdc',
          recipient_address: platformWallet.address,
          amount: amount,
          currency: 'USDC',
          blockchain: platformWallet.blockchain || 'ETH',
          instructions: 'Send USDC to the provided address. Payment will be confirmed automatically.'
        };
        paymentIntentId = `usdc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      } catch (error) {
        console.error('Circle USDC setup error:', error);
        paymentData = {
          payment_method: 'usdc',
          error: 'USDC payment temporarily unavailable',
          fallback_to: 'stripe'
        };
        paymentIntentId = `usdc_error_${Date.now()}`;
      }
    }

    // Store conversion record
    const conversionRecord: Partial<CampaignConversion> = {
      id: `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      campaign_id,
      campaign_type,
      session_id,
      customer_email: customer_info.email,
      customer_info,
      payment_intent_id: paymentIntentId || undefined,
      conversion_stage: 'payment_created',
      amount: amount, // Store in dollars (amount is already in USD)
      metadata,
      created_at: new Date(),
      updated_at: new Date()
    };

    // Store in database
    await fastRevenueDatabaseService.storeCampaignConversion(conversionRecord);

    // Track revenue metrics
    await fastRevenueDatabaseService.trackRevenueMetric({
      metric_type: 'campaign_conversion_initiated',
      value: amount,
      metadata: {
        campaign_id,
        campaign_type,
        payment_intent_id: paymentIntentId
      }
    });

    res.json({
      success: true,
      payment_data: paymentData,
      amount: amount,
      currency: 'usd',
      payment_method: payment_method,
      campaign_id,
      conversion_id: conversionRecord.id
    });

  } catch (error: any) {
    console.error('Campaign checkout error:', error);
    res.status(500).json({
      error: 'Failed to create campaign checkout',
      details: error.message
    });
  }
});

/**
 * Track campaign conversion stages
 * POST /api/campaigns/track-conversion
 */
router.post('/track-conversion', async (req, res) => {
  try {
    const {
      campaign_id,
      session_id,
      customer_email,
      conversion_stage,
      metadata = {}
    } = req.body;

    // Update conversion record
    const conversionUpdate = {
      conversion_stage,
      updated_at: new Date(),
      metadata: {
        ...metadata,
        stage_timestamp: new Date().toISOString()
      }
    };

    await fastRevenueDatabaseService.updateCampaignConversion(
      campaign_id,
      customer_email,
      conversionUpdate
    );

    // Track metrics
    await fastRevenueDatabaseService.trackRevenueMetric({
      metric_type: `campaign_${conversion_stage}`,
      value: 1,
      metadata: {
        campaign_id,
        session_id,
        customer_email
      }
    });

    res.json({
      success: true,
      message: 'Conversion tracked successfully'
    });

  } catch (error: any) {
    console.error('Conversion tracking error:', error);
    res.status(500).json({
      error: 'Failed to track conversion',
      details: error.message
    });
  }
});

/**
 * Verify payment completion and update conversion records
 * POST /api/campaigns/verify-payment
 */
router.post('/verify-payment', async (req, res) => {
  try {
    const { payment_intent_id, client_secret } = req.body;
    
    if (!payment_intent_id) {
      return res.status(400).json({
        error: 'Payment intent ID required'
      });
    }

    // Retrieve payment intent from Stripe to verify completion
    const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);
    
    if (paymentIntent.status === 'succeeded') {
      // Update conversion record to payment_completed
      await fastRevenueDatabaseService.updateCampaignConversionByPayment(
        payment_intent_id,
        {
          conversion_stage: 'payment_completed',
          completed_at: new Date(),
          updated_at: new Date()
        }
      );

      // Track final revenue confirmation
      await fastRevenueDatabaseService.trackRevenueMetric({
        metric_type: 'campaign_revenue_confirmed',
        value: paymentIntent.amount / 100, // Convert cents to dollars
        metadata: {
          campaign_id: paymentIntent.metadata.campaign_id,
          payment_intent_id: payment_intent_id,
          verification_source: 'success_page'
        }
      });

      res.json({
        success: true,
        payment_intent_id,
        amount: paymentIntent.amount / 100,
        campaign_id: paymentIntent.metadata.campaign_id,
        campaign_type: paymentIntent.metadata.campaign_type,
        delivery_time: paymentIntent.metadata.delivery_time,
        status: 'completed'
      });

      console.log(`✅ Campaign payment verified and completed: ${payment_intent_id} ($${paymentIntent.amount / 100})`);
    } else {
      res.status(400).json({
        error: 'Payment not completed',
        status: paymentIntent.status
      });
    }

  } catch (error: any) {
    console.error('Payment verification error:', error);
    res.status(500).json({
      error: 'Failed to verify payment',
      details: error.message
    });
  }
});

/**
 * Get payment intent details for checkout page
 * GET /api/campaigns/payment-intent/:paymentIntentId
 */
router.get('/payment-intent/:paymentIntentId', async (req, res) => {
  try {
    const { paymentIntentId } = req.params;
    
    // Retrieve payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (!paymentIntent || paymentIntent.status === 'canceled') {
      return res.status(404).json({
        error: 'Payment intent not found or canceled'
      });
    }

    res.json({
      id: paymentIntent.id,
      client_secret: paymentIntent.client_secret,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: paymentIntent.status,
      metadata: paymentIntent.metadata,
      description: paymentIntent.description
    });

  } catch (error: any) {
    console.error('Payment intent retrieval error:', error);
    res.status(500).json({
      error: 'Failed to retrieve payment intent',
      details: error.message
    });
  }
});

/**
 * Get campaign conversion analytics
 * GET /api/campaigns/analytics
 */
router.get('/analytics', async (req, res) => {
  try {
    const analytics = await fastRevenueDatabaseService.getCampaignAnalytics();
    
    res.json({
      success: true,
      analytics
    });

  } catch (error: any) {
    console.error('Campaign analytics error:', error);
    res.status(500).json({
      error: 'Failed to retrieve analytics',
      details: error.message
    });
  }
});

/**
 * Handle active session conversion offers
 * POST /api/campaigns/convert-session
 */
router.post('/convert-session', async (req, res) => {
  try {
    const {
      session_id,
      session_type, // 'slack', 'ibm_watson', etc.
      offer_type = 'sdk_licensing',
      target_amount = 5000
    } = req.body;

    // Create targeted conversion offer
    const conversionOffer = {
      id: `offer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      session_id,
      session_type,
      offer_type,
      amount: target_amount,
      created_at: new Date(),
      expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hours
      status: 'active'
    };

    // Store offer
    await fastRevenueDatabaseService.storeConversionOffer(conversionOffer);

    // Generate checkout URL
    const checkoutUrl = `/campaigns/checkout?session=${session_id}&offer=${conversionOffer.id}`;

    res.json({
      success: true,
      offer_id: conversionOffer.id,
      checkout_url: checkoutUrl,
      amount: target_amount,
      expires_at: conversionOffer.expires_at
    });

  } catch (error: any) {
    console.error('Session conversion error:', error);
    res.status(500).json({
      error: 'Failed to create session conversion offer',
      details: error.message
    });
  }
});

/**
 * Webhook for Stripe payment completion
 * POST /api/campaigns/stripe-webhook
 */
router.post('/stripe-webhook', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'] as string;
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        
        if (paymentIntent.metadata.source === 'campaign_conversion') {
          // Update conversion record
          await fastRevenueDatabaseService.updateCampaignConversionByPayment(
            paymentIntent.id,
            {
              conversion_stage: 'payment_completed',
              updated_at: new Date()
            }
          );

          // Track revenue
          await fastRevenueDatabaseService.trackRevenueMetric({
            metric_type: 'campaign_revenue_confirmed',
            value: paymentIntent.amount / 100, // paymentIntent.amount is in cents, convert to dollars
            metadata: {
              campaign_id: paymentIntent.metadata.campaign_id,
              payment_intent_id: paymentIntent.id
            }
          });

          console.log(`✅ Campaign payment completed: ${paymentIntent.id} ($${paymentIntent.amount / 100})`);
        }
        break;

      case 'payment_intent.payment_failed':
        const failedPayment = event.data.object as Stripe.PaymentIntent;
        
        if (failedPayment.metadata.source === 'campaign_conversion') {
          await fastRevenueDatabaseService.updateCampaignConversionByPayment(
            failedPayment.id,
            {
              conversion_stage: 'payment_failed',
              updated_at: new Date(),
              metadata: {
                failure_reason: failedPayment.last_payment_error?.message
              }
            }
          );

          console.log(`❌ Campaign payment failed: ${failedPayment.id}`);
        }
        break;
    }

    res.json({received: true});

  } catch (error: any) {
    console.error('Webhook processing error:', error);
    res.status(500).json({error: 'Webhook processing failed'});
  }
});

export default router;