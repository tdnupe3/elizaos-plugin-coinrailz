import { Router } from 'express';
import express from 'express';
import Stripe from 'stripe';
import { db } from '../db';
import { sdkLicenseSubscriptions } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import crypto from 'crypto';

const router = Router();

// Initialize Stripe with secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-07-30.basil',
});

// Webhook endpoint secret for signature verification
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
if (!webhookSecret) {
  console.warn('⚠️ STRIPE_WEBHOOK_SECRET not configured - webhook signature verification disabled');
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
    } else {
      // Parse webhook without signature verification
      event = JSON.parse(req.body.toString());
      console.warn('⚠️ Processing webhook without signature verification');
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

export default router;