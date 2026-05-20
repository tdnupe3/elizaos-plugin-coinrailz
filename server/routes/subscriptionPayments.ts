import express from 'express';
import { stripe } from '../services/stripeClient';
import { db } from '../db';
import { subscriptions, subscriptionPlans } from '../../shared/schema';
import { eq } from 'drizzle-orm';

const router = express.Router();

/**
 * 💳 CREATE SUBSCRIPTION CHECKOUT SESSION FOR CRYPTOJOINER PRO
 */
router.post('/create-subscription', async (req, res) => {
  try {
    const { plan } = req.body; // 'monthly' or 'yearly'
    
    // CryptoJoiner Pro pricing
    const pricing = {
      monthly: {
        price: 4900, // $49 in cents
        name: 'CryptoJoiner Pro - Monthly',
        planId: 'crypto_joiner_pro_monthly'
      },
      yearly: {
        price: 49000, // $490 in cents  
        name: 'CryptoJoiner Pro - Yearly (2 months FREE)',
        planId: 'crypto_joiner_pro_yearly'
      }
    };

    if (!pricing[plan]) {
      return res.status(400).json({
        success: false,
        error: 'Invalid plan - must be monthly or yearly'
      });
    }

    const priceData = pricing[plan];

    // Create or get subscription plan in database
    const existingPlan = await db.select().from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, priceData.planId))
      .limit(1);

    if (existingPlan.length === 0) {
      // Create the subscription plan
      await db.insert(subscriptionPlans).values({
        id: priceData.planId,
        name: priceData.name,
        monthlyPrice: plan === 'monthly' ? '49.00' : '40.83', // yearly = $490/12
        yearlyPrice: '490.00',
        yearlyDiscount: plan === 'yearly' ? 17 : 0, // 17% discount for yearly
        tradingFeeReduction: 0,
        crossChainFeeReduction: 0,
        aiMarketplaceCredits: '0.00',
        features: ['unlimited_group_joining', 'anti_ban_protection', 'session_management', 'progress_tracking'],
        isActive: true
      });
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: priceData.name,
              description: plan === 'yearly' 
                ? 'Join unlimited crypto Telegram groups automatically. Yearly plan includes 2 months FREE!'
                : 'Join unlimited crypto Telegram groups automatically. Professional-grade automation.'
            },
            recurring: {
              interval: plan === 'yearly' ? 'year' : 'month'
            },
            unit_amount: priceData.price,
          },
          quantity: 1,
        },
      ],
      success_url: `${req.protocol}://${req.get('host')}/subscription-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.protocol}://${req.get('host')}/crypto-joiner-pro`,
      metadata: {
        plan: plan,
        service: 'crypto_joiner_pro',
        planId: priceData.planId,
        userId: req.user?.id || 'anonymous'
      },
      customer_email: req.user?.email || undefined,
    });

    res.json({
      success: true,
      checkout_url: session.url,
      session_id: session.id
    });

  } catch (error: any) {
    console.error('Subscription creation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 🔄 STRIPE WEBHOOK FOR SUBSCRIPTION EVENTS
 */
router.post('/webhook', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig!, process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test');
  } catch (err: any) {
    console.log(`⚠️  Webhook signature verification failed.`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object as Stripe.Checkout.Session;
      
      // Get subscription details
      if (session.subscription) {
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
        
        // Store subscription in database
        try {
          const currentPeriodStart = new Date(subscription.current_period_start * 1000);
          const currentPeriodEnd = new Date(subscription.current_period_end * 1000);
          
          await db.insert(subscriptions).values({
            userId: session.metadata?.userId || 'anonymous',
            planId: session.metadata?.planId || 'crypto_joiner_pro_monthly',
            status: subscription.status,
            currentPeriodStart,
            currentPeriodEnd,
            stripeSubscriptionId: subscription.id,
            stripeCustomerId: subscription.customer as string,
            isYearly: session.metadata?.plan === 'yearly',
            lastPaymentAmount: (subscription.items.data[0]?.price.unit_amount || 0) / 100,
            lastPaymentDate: new Date(),
            nextBillingDate: currentPeriodEnd,
          });

          console.log('✅ CryptoJoiner Pro subscription created:', subscription.id);
        } catch (dbError) {
          console.error('❌ Database error storing subscription:', dbError);
        }
      }
      break;

    case 'invoice.payment_succeeded':
      const invoice = event.data.object as Stripe.Invoice;
      console.log('💰 CryptoJoiner Pro payment succeeded:', invoice.id);
      
      // Update subscription payment date
      if (invoice.subscription) {
        try {
          await db.update(subscriptions)
            .set({ 
              lastPaymentDate: new Date(),
              lastPaymentAmount: (invoice.amount_paid || 0) / 100
            })
            .where(eq(subscriptions.stripeSubscriptionId, invoice.subscription as string));
        } catch (dbError) {
          console.error('❌ Error updating payment date:', dbError);
        }
      }
      break;

    case 'customer.subscription.deleted':
      const deletedSub = event.data.object as Stripe.Subscription;
      
      // Update subscription status in database
      try {
        await db.update(subscriptions)
          .set({ status: 'cancelled' })
          .where(eq(subscriptions.stripeSubscriptionId, deletedSub.id));
        
        console.log('🗑️ CryptoJoiner Pro subscription canceled:', deletedSub.id);
      } catch (dbError) {
        console.error('❌ Database error updating subscription:', dbError);
      }
      break;

    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({received: true});
});

/**
 * 📊 GET USER SUBSCRIPTION STATUS
 */
router.get('/status', async (req, res) => {
  try {
    if (!req.user) {
      return res.json({ success: true, subscription: null });
    }

    // Get user's active CryptoJoiner Pro subscription
    const userSubs = await db.select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, req.user.id))
      .orderBy(subscriptions.currentPeriodEnd)
      .limit(1);

    const subscription = userSubs[0] || null;

    res.json({
      success: true,
      subscription: subscription ? {
        id: subscription.id,
        planId: subscription.planId,
        status: subscription.status,
        currentPeriodEnd: subscription.currentPeriodEnd,
        isYearly: subscription.isYearly,
        lastPaymentAmount: subscription.lastPaymentAmount
      } : null
    });

  } catch (error: any) {
    console.error('Error fetching subscription status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * ❌ CANCEL SUBSCRIPTION
 */
router.post('/cancel', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Get user's active subscription
    const userSubs = await db.select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, req.user.id))
      .limit(1);

    if (userSubs.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No active subscription found'
      });
    }

    const subscription = userSubs[0];

    // Cancel the Stripe subscription
    if (subscription.stripeSubscriptionId) {
      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: true
      });

      // Update local database
      await db.update(subscriptions)
        .set({ cancelAtPeriodEnd: true })
        .where(eq(subscriptions.id, subscription.id));
    }

    res.json({
      success: true,
      message: 'Subscription will be canceled at the end of the current billing period'
    });

  } catch (error: any) {
    console.error('Error canceling subscription:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;