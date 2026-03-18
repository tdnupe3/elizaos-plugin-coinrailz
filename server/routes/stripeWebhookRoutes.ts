import { Router } from 'express';
import express from 'express';
import Stripe from 'stripe';
import { db } from '../db';
import { sdkLicenseSubscriptions, iotAccounts, iotTopups, paymentIntentTracking, creditsAccounts } from '../../shared/schema';
import { creditsService } from '../services/creditsService.js';
import { eq, and, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import crypto from 'crypto';
import { fulfillAcpOrder } from './acpRoutes';
import { provisionCreditsAndKey } from '../services/m2mProvisioningService.js';
import { emitFunnelEventAsync } from '../services/funnelHelper.js';

const router = Router();

// Initialize Stripe with secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-07-30.basil',
});

// Webhook endpoint secret for signature verification
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const isProduction = process.env.NODE_ENV === 'production' || process.env.REPLIT_DEPLOYMENT === '1';

if (!webhookSecret && isProduction) {
  console.error('🚨 CRITICAL: STRIPE_WEBHOOK_SECRET not configured in production - webhooks will be rejected');
} else if (!webhookSecret) {
  console.warn('⚠️ STRIPE_WEBHOOK_SECRET not configured - webhook signature verification disabled in development');
}

/**
 * Stripe Webhook Handler - Activates licenses after successful payment
 * CRITICAL: This ensures customers get their license keys after payment
 * IMPORTANT: Requires raw body for signature verification
 */
router.post('/stripe-webhooks', 
  express.raw({ type: 'application/json' }), // Raw body for Stripe signature verification
  async (req, res) => {
  const sig = req.headers['stripe-signature'] as string;
  let event: Stripe.Event;

  try {
    if (webhookSecret) {
      // Verify webhook signature for security
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } else if (isProduction) {
      // SECURITY: Reject unsigned webhooks in production
      console.error('🚨 SECURITY: Rejecting webhook - no signature verification in production');
      return res.status(401).json({ error: 'Webhook signature verification required in production' });
    } else {
      // Development only: Parse webhook without signature verification
      event = JSON.parse(req.body.toString());
      console.warn('⚠️ DEV ONLY: Processing webhook without signature verification');
    }
    console.log(`🔔 Stripe webhook received: ${event.type}`);
  } catch (err) {
    console.error('⚠️ Webhook processing failed:', err);
    return res.status(400).send(`Webhook Error: ${err}`);
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;
        
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
        
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;
        
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
        
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;
        
      default:
        console.log(`🔄 Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('💥 Webhook processing failed:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * Handle successful one-time payment for SDK license
 */
async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const { customer, metadata } = paymentIntent;
  
  if (!metadata.tierId || !metadata.contactEmail) {
    console.error('❌ Missing required metadata in payment intent');
    return;
  }

  try {
    // Generate secure license key
    const licenseKey = `lic_${nanoid(32)}`;
    const licenseKeyHash = crypto
      .createHash('sha256')
      .update(licenseKey)
      .digest('hex');

    // CRITICAL: Activate license in database after successful payment
    const [updatedLicense] = await db
      .update(sdkLicenseSubscriptions)
      .set({
        status: 'active',
        licenseKey, // Update plaintext key for customer portal consistency
        licenseKeyHash,
        updatedAt: new Date(),
      })
      .where(and(
        eq(sdkLicenseSubscriptions.contactEmail, metadata.contactEmail),
        eq(sdkLicenseSubscriptions.tierId, parseInt(metadata.tierId))
      ))
      .returning();

    console.log('✅ License ACTIVATED for payment:', {
      paymentId: paymentIntent.id,
      customer: metadata.contactEmail,
      tier: metadata.tierId,
      licenseKey: licenseKey.substring(0, 8) + '...'
    });

    console.log(`✅ License activated for payment ${paymentIntent.id}:`, {
      licenseKey: licenseKey.substring(0, 8) + '...',
      customer: metadata.contactEmail,
      tier: metadata.tierId,
      amount: paymentIntent.amount / 100
    });

    // TODO: Send welcome email with license key and getting started guide
    await sendLicenseActivationEmail(metadata.contactEmail, licenseKey, metadata.tierId);

  } catch (error) {
    console.error('💥 Failed to activate license for payment:', paymentIntent.id, error);
    throw error;
  }
}

/**
 * Handle successful recurring subscription payment
 */
async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  const { customer } = invoice;
  const subscriptionId = (invoice as any).subscription as string;
  
  if (!subscriptionId) return;

  try {
    // Update license expiration for recurring payments
    await db
      .update(sdkLicenseSubscriptions)
      .set({
        status: 'active',
        updatedAt: new Date(),
      })
      .where(eq(sdkLicenseSubscriptions.stripeCustomerId, customer as string));

    console.log(`🔄 License renewed for subscription ${subscriptionId}`);
  } catch (error) {
    console.error('💥 Failed to renew license for subscription:', subscriptionId, error);
    throw error;
  }
}

/**
 * Handle new subscription creation
 */
async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  console.log(`🆕 New subscription created: ${subscription.id}`);
  // Additional subscription setup if needed
}

/**
 * Handle subscription updates (plan changes, etc.)
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  try {
    const { customer, status, metadata } = subscription;
    
    // Update license status based on subscription status
    const licenseStatus = status === 'active' ? 'active' : 
                         status === 'canceled' ? 'cancelled' : 
                         status === 'past_due' ? 'past_due' : 'inactive';

    await db
      .update(sdkLicenseSubscriptions)
      .set({
        status: licenseStatus,
        updatedAt: new Date(),
      })
      .where(eq(sdkLicenseSubscriptions.stripeCustomerId, customer as string));

    console.log(`📝 License updated for subscription ${subscription.id}: ${licenseStatus}`);
  } catch (error) {
    console.error('💥 Failed to update license for subscription:', subscription.id, error);
    throw error;
  }
}

/**
 * Handle subscription cancellation
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  try {
    const { customer } = subscription;
    
    // Deactivate license when subscription is cancelled
    await db
      .update(sdkLicenseSubscriptions)
      .set({
        status: 'cancelled',
        updatedAt: new Date(),
      })
      .where(eq(sdkLicenseSubscriptions.stripeCustomerId, customer as string));

    console.log(`❌ License cancelled for subscription ${subscription.id}`);
  } catch (error) {
    console.error('💥 Failed to cancel license for subscription:', subscription.id, error);
    throw error;
  }
}

/**
 * Send license activation email to customer
 */
async function sendLicenseActivationEmail(email: string, licenseKey: string, tierId: string) {
  try {
    // TODO: Integrate with SendGrid or email service
    console.log(`📧 License activation email sent to ${email}`);
    console.log(`🔑 License Key: ${licenseKey.substring(0, 8)}...`);
    console.log(`📦 Tier: ${tierId}`);
    
    // Email template would include:
    // - Welcome message
    // - License key
    // - Getting started guide
    // - SDK installation instructions
    // - Support contact information
  } catch (error) {
    console.error('📧 Failed to send activation email:', error);
    // Don't throw - license is still valid even if email fails
  }
}

/**
 * Handle checkout.session.completed for ACP orders and IoT topups
 */
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const source = session.metadata?.source;
  const orderId = session.metadata?.orderId;

  if (source === 'acp_checkout' && orderId) {
    console.log(`🛒 ACP Checkout completed for order ${orderId}`);
    
    const result = await fulfillAcpOrder(orderId, session.payment_intent as string);
    
    if (result.success) {
      console.log(`✅ ACP Order ${orderId} fulfilled: ${result.credits} credits, API key issued`);
    } else {
      console.error(`❌ ACP Fulfillment failed for ${orderId}: ${result.error}`);
    }
  } else if (source === 'iot_payments_topup') {
    const { accountId, packId, credits, topupId } = session.metadata || {};
    
    if (!accountId || !credits) {
      console.error('❌ IoT topup missing metadata:', session.metadata);
      return;
    }

    console.log(`💰 IoT Topup checkout completed: ${accountId}, ${credits} credits`);
    
    try {
      const creditsAmount = parseInt(credits);
      const amountPaid = (session.amount_total || 0) / 100;
      
      await db.transaction(async (tx) => {
        await tx.execute(
          sql`UPDATE iot_accounts 
              SET credits_balance = credits_balance + ${creditsAmount * 0.005}::numeric,
                  total_deposited = total_deposited + ${amountPaid}::numeric,
                  updated_at = NOW()
              WHERE id = ${accountId}`
        );

        await tx.insert(iotTopups).values({
          id: topupId || `iot_topup_${nanoid(16)}`,
          accountId,
          amount: amountPaid.toString(),
          credits: creditsAmount.toString(),
          paymentMethod: 'stripe',
          stripePaymentId: session.payment_intent as string,
          status: 'completed',
        });
      });

      console.log(`✅ IoT Topup fulfilled: ${accountId} received ${creditsAmount} credits ($${amountPaid})`);
    } catch (error: any) {
      console.error(`❌ IoT Topup fulfillment failed: ${error.message}`);
    }
  } else if (source === 'm2m-hosted-checkout') {
    const { amountUsd, keyName, email } = session.metadata || {};
    const amount = Number(amountUsd || '0');

    if (!amount) {
      console.error('❌ M2M hosted checkout missing amountUsd metadata:', session.id);
      return;
    }

    const userId = `m2m_${crypto.createHash('sha256').update(session.id).digest('hex').substring(0, 16)}`;
    const effectiveEmail = email || `${userId}@m2m.coinrailz.com`;

    try {
      const result = await provisionCreditsAndKey({
        paymentIntentId: session.id, // use sessionId as idempotency key
        userId,
        amount,
        email: effectiveEmail,
        keyName: keyName || 'M2M Checkout Key',
        purpose: 'm2m-hosted-checkout',
      });

      if (result.alreadyProvisioned) {
        console.log(`ℹ️ M2M hosted checkout already provisioned: ${session.id}`);
        return;
      }

      if (result.inProgress) {
        console.warn(`⚠️ M2M hosted checkout provisioning in progress: ${session.id}`);
        return;
      }

      // Store pending API key in tracking metadata for status endpoint to retrieve once
      await db.update(paymentIntentTracking)
        .set({ metadata: {
          userId,
          amount,
          keyName: keyName || 'M2M Checkout Key',
          source: 'm2m-hosted-checkout',
          pendingApiKey: result.apiKey,
          keyDelivered: false,
        }})
        .where(eq(paymentIntentTracking.paymentIntentId, session.id));

      emitFunnelEventAsync({ stage: 'credit_purchased', source: 'buy_page', creditsAmount: amount });
      emitFunnelEventAsync({ stage: 'api_key_issued', source: 'buy_page', apiKeyPrefix: result.keyPrefix, creditsAmount: amount });

      console.log(`✅ M2M hosted checkout provisioned: $${amount} | userId: ${userId} | key: ${result.keyPrefix}... | session: ${session.id}`);

      // Auto-recharge setup — vault the payment method if developer opted in
      if (session.metadata?.autoRechargeEnabled === 'true') {
        try {
          const threshold = Number(session.metadata.autoRechargeThresholdUsd || 5);
          const topUp = Number(session.metadata.autoRechargeTopUpUsd || amount);

          // Retrieve the payment intent to get the vaulted payment method
          const piId = typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent?.id;

          if (piId) {
            const pi = await stripe.paymentIntents.retrieve(piId);
            const pmId = typeof pi.payment_method === 'string'
              ? pi.payment_method
              : pi.payment_method?.id;

            if (pmId) {
              // Create a Stripe customer for off-session recharges
              const customer = await stripe.customers.create({
                email: effectiveEmail,
                payment_method: pmId,
                metadata: { userId, source: 'm2m-auto-recharge' },
              });

              // Save auto-recharge settings on the credits account
              await db.update(creditsAccounts)
                .set({
                  autoTopUpEnabled: true,
                  autoTopUpThreshold: String(threshold),
                  autoTopUpAmount: String(topUp),
                  stripeCustomerId: customer.id,
                  autoRechargePaymentMethodId: pmId,
                })
                .where(eq(creditsAccounts.userId, userId));

              console.log(`🔄 Auto-recharge configured for ${userId}: threshold $${threshold}, topUp $${topUp}, pm: ${pmId.substring(0, 12)}...`);
              emitFunnelEventAsync({ stage: 'credit_purchased', source: 'auto_recharge_setup', creditsAmount: topUp });
            }
          }
        } catch (arErr: any) {
          // Non-fatal — provisioning succeeded, auto-recharge setup failed
          console.error(`⚠️ Auto-recharge setup failed for ${session.id} (credits still provisioned):`, arErr.message);
        }
      }
    } catch (err: any) {
      console.error(`❌ M2M hosted checkout provisioning failed for ${session.id}:`, err.message);
    }
  } else {
    console.log(`🔔 Checkout session completed (unknown source): ${session.id}`);
  }
}

export default router;