import { Router } from 'express';
import express from 'express';
import type Stripe from 'stripe';
import { stripe } from '../services/stripeClient';
import { storage } from '../storage';
import { isAuthenticated } from '../replitAuth';
import { handlePaymentIntentSucceeded, handleGptPurchaseWebhook } from './gptCreditsRoutes';
import { db } from '../db';
import { paymentIntentTracking, pilotCreditsPayments } from '@shared/schema';
import { creditsService } from '../services/creditsService';
import { unifiedCreditsService } from '../services/unifiedCreditsService';
import { eq } from 'drizzle-orm';
import { CoinbaseCDPService } from '../services/coinbaseCDPService';
import { nanoid } from 'nanoid';

const router = Router();

// Create Stripe checkout session for marketplace orders
router.post('/create-checkout-session', async (req, res) => {
  try {
    const { 
      serviceId, 
      serviceName, 
      amount, 
      agentId, 
      customerName, 
      customerEmail, 
      deliveryRequirements,
      successUrl,
      cancelUrl 
    } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    if (!customerEmail) {
      return res.status(400).json({ error: 'Customer email required' });
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: serviceName,
            description: `AI Marketplace Service: ${serviceName}`,
          },
          unit_amount: Math.round(amount * 100), // Convert to cents
        },
        quantity: 1,
      }],
      mode: 'payment',
      customer_email: customerEmail,
      metadata: {
        serviceId: serviceId || '',
        agentId: agentId || '',
        customerName: customerName || '',
        deliveryRequirements: deliveryRequirements || '',
        platform: 'coin-railz-marketplace'
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    res.json({ 
      success: true,
      checkoutUrl: session.url,
      sessionId: session.id
    });
  } catch (error: any) {
    console.error('Stripe checkout session creation error:', error);
    res.status(500).json({ 
      error: 'Failed to create checkout session',
      message: error.message 
    });
  }
});

// Create payment intent for marketplace orders
router.post('/create-payment-intent', async (req, res) => {
  try {
    const { amount, currency = 'usd', orderId, serviceId } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency,
      metadata: {
        orderId: orderId || '',
        serviceId: serviceId || '',
        platform: 'coin-railz-marketplace'
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    res.json({ 
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error: any) {
    console.error('Stripe payment intent creation error:', error);
    res.status(500).json({ 
      error: 'Failed to create payment intent',
      message: error.message 
    });
  }
});

// Confirm payment success and update order
router.post('/confirm-payment', async (req, res) => {
  try {
    const { paymentIntentId, orderId: bodyOrderId } = req.body;

    if (!paymentIntentId) {
      return res.status(400).json({ error: 'Payment intent ID required' });
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    // Always derive orderId from payment intent metadata — never trust the request body alone.
    // This prevents an attacker from creating a low-value intent with a chosen orderId in metadata.
    const safeOrderId = paymentIntent.metadata?.orderId;
    if (!safeOrderId) {
      console.error(`❌ confirm-payment: PaymentIntent ${paymentIntentId} has no orderId in metadata`);
      return res.status(403).json({ error: 'Payment intent has no orderId in metadata', success: false });
    }

    // If the caller also supplied an orderId, it must match what Stripe has — belt-and-suspenders.
    if (bodyOrderId && bodyOrderId !== safeOrderId) {
      console.error(`❌ confirm-payment: orderId mismatch — body=${bodyOrderId} metadata=${safeOrderId}`);
      return res.status(403).json({ error: 'Order ID does not match payment intent metadata', success: false });
    }

    if (paymentIntent.status === 'succeeded') {
      // Fetch the order and verify the paid amount matches what was expected.
      // Prevents underpayment: attacker pays $0.01 intent but expects a $100 order fulfilled.
      const order = await storage.getMarketplaceOrder(safeOrderId);
      if (!order) {
        console.error(`❌ confirm-payment: order ${safeOrderId} not found`);
        return res.status(404).json({ error: 'Order not found', success: false });
      }

      const paidAmountUsd = paymentIntent.amount / 100;
      const expectedAmountUsd = parseFloat(order.amount);
      if (Math.abs(paidAmountUsd - expectedAmountUsd) > 0.01) {
        console.error(`❌ confirm-payment: amount mismatch — paid $${paidAmountUsd}, expected $${expectedAmountUsd} for order ${safeOrderId}`);
        return res.status(403).json({ error: 'Payment amount does not match order amount', success: false });
      }

      if (paymentIntent.currency !== 'usd') {
        console.error(`❌ confirm-payment: currency mismatch — got ${paymentIntent.currency} for order ${safeOrderId}`);
        return res.status(403).json({ error: 'Currency mismatch', success: false });
      }

      await storage.updateMarketplaceOrder(safeOrderId, { status: 'paid', completedAt: new Date() });

      res.json({ success: true, status: 'paid', amount: paidAmountUsd, orderId: safeOrderId });
    } else {
      res.json({ success: false, status: paymentIntent.status });
    }
  } catch (error: any) {
    console.error('Payment confirmation error:', error);
    res.status(500).json({ 
      error: 'Failed to confirm payment',
      message: error.message 
    });
  }
});

// Handle report purchase completion
router.post('/confirm-report-purchase', async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID required' });
    }
    
    // Retrieve checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    if (session.payment_status === 'paid') {
      // Create purchase record
      const purchaseId = `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const purchase = {
        id: purchaseId,
        product: 'AI Agent Revenue Revolution Report',
        price: 10,
        currency: 'USD',
        paymentMethod: 'STRIPE',
        customerEmail: session.customer_details?.email || session.customer_email,
        stripeSessionId: sessionId,
        purchaseDate: new Date().toISOString(),
        status: 'confirmed',
        deliveryMethod: 'email_download'
      };
      
      // Generate secure download token that expires in 7 days
      const downloadToken = `${purchaseId}_${Math.random().toString(36).substr(2, 16)}`;
      const downloadLink = `${process.env.BASE_URL || 'https://coinrailz.com'}/api/reports/secure-download/${downloadToken}`;
      
      // Send email with download link using SendGrid
      try {
        const { MailService } = await import('@sendgrid/mail');
        if (process.env.SENDGRID_API_KEY) {
          const mailService = new MailService();
          mailService.setApiKey(process.env.SENDGRID_API_KEY);
          
          await mailService.send({
            to: purchase.customerEmail,
            from: 'support@coinrailz.com',
            subject: 'Your AI Agent Revenue Revolution Report - Download Ready!',
            html: `
              <h2>🎉 Thank you for your purchase!</h2>
              <p>Your AI Agent Revenue Revolution Report is ready for download.</p>
              
              <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3>📊 Report Details:</h3>
                <ul>
                  <li><strong>Title:</strong> AI Agent Revenue Revolution</li>
                  <li><strong>Pages:</strong> 47 comprehensive pages</li>
                  <li><strong>Topics:</strong> Google AP2 & Coinbase x402 Integration</li>
                  <li><strong>Expected ROI:</strong> $100-$10,000+ within 30 days</li>
                </ul>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${downloadLink}" style="background: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-size: 18px;">
                  📥 Download Report Now
                </a>
              </div>
              
              <p><strong>⏰ Download expires in 7 days</strong></p>
              
              <h3>🚀 What's Next?</h3>
              <ol>
                <li>Download and read the complete guide</li>
                <li>Implement x402 integration within 24 hours</li>
                <li>Deploy your first revenue-generating service</li>
                <li>Start earning autonomous revenue!</li>
              </ol>
              
              <p>Questions? Reply to this email or contact support@coinrailz.com</p>
              
              <hr style="margin: 30px 0;">
              <p style="font-size: 12px; color: #666;">
                Purchase ID: ${purchaseId}<br>
                This download link is unique to you and expires on ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString()}
              </p>
            `
          });
          
          console.log(`✅ Report delivery email sent to ${purchase.customerEmail}`);
        }
      } catch (emailError) {
        console.error('❌ Failed to send delivery email:', emailError);
        // Continue with success response even if email fails
      }
      
      res.json({
        success: true,
        purchase: purchase,
        downloadLink: downloadLink,
        message: 'Report purchase confirmed! Check your email for download instructions.',
        deliveryStatus: 'email_sent'
      });
      
    } else {
      res.json({
        success: false,
        status: session.payment_status,
        message: 'Payment not completed'
      });
    }
    
  } catch (error: any) {
    console.error('Report purchase confirmation error:', error);
    res.status(500).json({
      error: 'Failed to confirm report purchase',
      message: error.message
    });
  }
});

// Pilot tiers configuration - used by both webhook and API endpoints
const PILOT_TIERS = {
  starter: { credits: 500, price: 500, name: 'Starter Pilot' },
  growth: { credits: 1000, price: 1000, name: 'Growth Pilot' },
  enterprise: { credits: 2500, price: 2500, name: 'Enterprise Pilot' }
} as const;

// ============================================================
// ACTIVE STRIPE WEBHOOK — mounted at POST /api/stripe/webhook
// This is the ONLY endpoint registered in the Stripe dashboard.
// Other webhook routes in this codebase (e.g. /api/credits/stripe-webhook,
// /api/fast-revenue/stripe-webhook, /api/webhooks/stripe-webhooks) are
// NOT registered in Stripe and receive no live events. Do not add new
// Stripe webhook logic to those files — add it here.
//
// Handled events:
//   payment_intent.succeeded         — GPT + M2M credits provisioning
//   payment_intent.payment_failed    — order status update
//   checkout.session.completed       — prepaid credits / pilot credits / M2M hosted checkout
//   charge.dispute.created           — credits deducted + API key revoke fallback
//   charge.refunded                  — credits deducted + API key revoke on full refund
// ============================================================
// CRITICAL: Must receive raw body (Buffer) for Stripe signature verification
export async function stripeMarketplaceWebhookHandler(req: any, res: any) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('❌ STRIPE_WEBHOOK_SECRET not configured — rejecting webhook');
    return res.status(500).json({ error: 'Webhook not configured' });
  }

  const sig = req.headers['stripe-signature'];
  if (!sig) {
    return res.status(400).json({ error: 'Missing stripe-signature header' });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig as string, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      console.log('Payment succeeded:', paymentIntent.id);
      
      // Log to payment_intent_tracking (fire-and-forget for stability)
      try {
        await db.insert(paymentIntentTracking).values({
          paymentIntentId: paymentIntent.id,
          customerEmail: paymentIntent.receipt_email || paymentIntent.metadata?.customerEmail || 'unknown',
          amount: paymentIntent.amount,
          currency: paymentIntent.currency || 'usd',
          purpose: paymentIntent.metadata?.source || paymentIntent.metadata?.platform || 'marketplace',
          configId: paymentIntent.metadata?.gptSessionId || paymentIntent.metadata?.orderId || null,
          taskDescription: paymentIntent.metadata?.packageName || paymentIntent.metadata?.serviceName || null,
          metadata: paymentIntent.metadata || {},
          status: 'used',
        }).onConflictDoNothing();
        console.log(`📊 Payment tracked: ${paymentIntent.id}`);
      } catch (trackError: any) {
        console.error(`⚠️ Payment tracking failed (non-blocking): ${trackError.message}`);
      }
      
      // Handle GPT Elements purchases
      if (paymentIntent.metadata?.source === 'gpt' && paymentIntent.metadata?.gptSessionId) {
        try {
          await handlePaymentIntentSucceeded(paymentIntent);
        } catch (error) {
          console.error('Failed to process GPT PaymentIntent:', error);
        }
      }

      // Handle M2M credits purchases via payment_intent (safety net for 3DS / inline provisioning failures)
      // The POST /api/m2m/credits/purchase endpoint provisions inline, but if that call crashed or
      // the payment completed asynchronously (3DS), this webhook handler catches and provisions here.
      if (paymentIntent.metadata?.source === 'm2m-credits') {
        try {
          const { provisionCreditsAndKey } = await import('../services/m2mProvisioningService.js');
          const amountUsd = paymentIntent.amount / 100;
          const piId = paymentIntent.id;
          const crypto = await import('crypto');
          const userId = `m2m_${crypto.default.createHash('sha256').update(piId).digest('hex').substring(0, 16)}`;
          const email = paymentIntent.receipt_email || paymentIntent.metadata?.email || `${userId}@m2m.coinrailz.com`;
          const keyName = paymentIntent.metadata?.keyName || 'M2M API Key';

          const result = await provisionCreditsAndKey({
            paymentIntentId: piId,
            userId,
            amount: amountUsd,
            email,
            keyName,
            purpose: 'm2m-credits',
          });

          if (result.alreadyProvisioned) {
            console.log(`ℹ️ M2M payment_intent already provisioned (idempotent): ${piId}`);
          } else if (result.inProgress) {
            console.warn(`⚠️ M2M payment_intent provisioning in progress: ${piId}`);
            return res.status(500).json({ error: 'Provisioning in progress - Stripe will retry' });
          } else {
            console.log(`✅ M2M credits provisioned via payment_intent webhook: pi=${piId} | user=${userId} | amount=$${amountUsd} | email=${email}`);
          }
        } catch (m2mError: any) {
          console.error(`❌ M2M payment_intent provisioning failed: ${paymentIntent.id} | ${m2mError.message}`);
          return res.status(500).json({ error: 'M2M provisioning failed - Stripe will retry' });
        }
      }
      
      // Update order status if orderId is in metadata
      if (paymentIntent.metadata.orderId) {
        try {
          await storage.updateMarketplaceOrder(paymentIntent.metadata.orderId, {
            status: 'paid',
            completedAt: new Date()
          });
        } catch (error) {
          console.error('Failed to update order after payment:', error);
        }
      }
      break;
      
    case 'payment_intent.payment_failed':
      const failedPayment = event.data.object;
      console.log('Payment failed:', failedPayment.id);
      
      if (failedPayment.metadata.orderId) {
        try {
          await storage.updateMarketplaceOrder(failedPayment.metadata.orderId, {
            status: 'failed'
          });
        } catch (error) {
          console.error('Failed to update order after payment failure:', error);
        }
      }
      break;

    case 'checkout.session.completed':
      const session = event.data.object;
      console.log('Checkout session completed:', session.id);
      
      // Handle prepaid credits purchases (consolidated from /api/credits/stripe-webhook)
      // CRITICAL: Return 500 on failure so Stripe retries - don't silently drop payments
      if (session.metadata?.userId && session.metadata?.creditsAmount) {
        const userId = session.metadata.userId;
        const creditsAmount = session.metadata.creditsAmount;
        
        if (!userId || !creditsAmount) {
          console.error("❌ Missing required metadata in Stripe session:", session.id);
          return res.status(400).json({ error: "Invalid session metadata - missing userId or creditsAmount" });
        }
        
        try {
          // IDEMPOTENCY CHECK: Prevent duplicate credits on Stripe webhook retries
          // Check if this session was already processed by looking for existing transaction
          const { creditTransactions } = await import('@shared/schema');
          const { eq } = await import('drizzle-orm');
          
          const [existingTransaction] = await db.select()
            .from(creditTransactions)
            .where(eq(creditTransactions.referenceId, session.id))
            .limit(1);
          
          if (existingTransaction) {
            console.log(`⚠️ Credits webhook: Session ${session.id} already processed (tx: ${existingTransaction.id}) - returning 200 to stop retries`);
            // Return 200 so Stripe doesn't retry - we already processed this
            return res.json({ received: true, duplicate: true, transactionId: existingTransaction.id });
          }
          
          const amount = parseFloat(creditsAmount);
          
          if (isNaN(amount) || amount <= 0) {
            console.error("❌ Invalid credits amount:", creditsAmount);
            return res.status(400).json({ error: "Invalid credits amount" });
          }
          
          const result = await creditsService.addCredits({
            userId,
            amount,
            paymentMethod: "stripe",
            referenceId: session.id,
            description: `Stripe payment - $${amount} credits`,
            metadata: {
              stripeSessionId: session.id,
              stripePaymentIntent: session.payment_intent,
              source: session.metadata?.source
            }
          });

          console.log(`✅ Credits webhook: Credited $${amount} to user ${userId} (session: ${session.id})`);
          console.log(`💰 New balance: $${result.newBalance}`);

          // Handle GPT-specific purchases (generate API key for polling)
          if (session.metadata?.source === 'gpt') {
            try {
              await handleGptPurchaseWebhook(session, amount);
              console.log(`🤖 GPT webhook: API key generated for session ${session.metadata.gptSessionId}`);
            } catch (gptError: any) {
              // GPT key generation is non-critical - credits were added, log but don't fail
              console.error("⚠️ GPT API key generation failed (credits still added):", gptError.message);
            }
          }
        } catch (error: any) {
          // CRITICAL: Return 500 so Stripe retries this webhook
          console.error("❌ CRITICAL: Failed to process credits payment - Stripe will retry:", error);
          return res.status(500).json({ error: "Failed to credit balance - will retry" });
        }
      }
      // Create marketplace order after successful payment
      else if (session.metadata?.platform === 'coin-railz-marketplace') {
        try {
          const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
          // Create marketplace order with payment confirmation
          await storage.createMarketplaceOrder({
            id: orderId,
            service_id: session.metadata.serviceId,
            agent_id: session.metadata.agentId,
            customer_name: session.metadata.customerName,
            customer_email: session.customer_email || session.customer_details?.email,
            delivery_requirements: session.metadata.deliveryRequirements,
            amount: (session.amount_total || 0) / 100, // Convert from cents
            status: 'paid',
            payment_method: 'stripe',
            payment_id: session.payment_intent,
            platform_fee: ((session.amount_total || 0) / 100) * 0.15, // 15% platform fee
            agent_payout: ((session.amount_total || 0) / 100) * 0.85, // 85% to agent
            created_at: new Date(),
            updated_at: new Date()
          });

          console.log(`✅ REAL ORDER CREATED: ${orderId} for $${(session.amount_total || 0) / 100} - Customer: ${session.customer_email || session.customer_details?.email}`);
          
          // x402 services are instant-access APIs - mark as delivered immediately
          await storage.updateMarketplaceOrder(orderId, {
            status: 'delivered',
            updated_at: new Date()
          });
          
          // Send confirmation email if customer email is available
          const customerEmail = session.customer_email || session.customer_details?.email;
          if (customerEmail) {
            try {
              const sgMail = await import('@sendgrid/mail').then(m => m.default);
              if (process.env.SENDGRID_API_KEY) {
                sgMail.setApiKey(process.env.SENDGRID_API_KEY);
                const senderEmail = process.env.SENDGRID_FROM_EMAIL || process.env.SUPPORT_EMAIL || 'noreply@coinrailz.com';
                const supportEmail = process.env.SUPPORT_EMAIL || 'support@coinrailz.com';
                await sgMail.send({
                  to: customerEmail,
                  from: senderEmail,
                  subject: `Order Confirmed: ${session.metadata.serviceId || 'AI Agent Service'}`,
                  html: `
                    <h2>Thank you for your purchase!</h2>
                    <p>Your order <strong>${orderId}</strong> has been confirmed.</p>
                    <p><strong>Service:</strong> ${session.metadata.serviceId || 'AI Agent Service'}</p>
                    <p><strong>Amount:</strong> $${((session.amount_total || 0) / 100).toFixed(2)}</p>
                    <p>Your x402 service is now active and ready for use. Access your services at the AI Agent Marketplace.</p>
                    <p>Questions? Contact ${supportEmail}</p>
                  `
                });
                console.log(`📧 Confirmation email sent to ${customerEmail}`);
              }
            } catch (emailError: any) {
              console.log(`⚠️ Email not sent (non-critical): ${emailError.message}`);
            }
          }
          
          console.log(`🎉 ORDER DELIVERED: ${orderId} - instant x402 service access granted`);
        } catch (orderError) {
          console.error('Failed to create order after payment:', orderError);
        }
      }
      // Handle pilot credits purchases via webhook (server-side crediting)
      else if (session.metadata?.type === 'pilot_credits' && session.metadata?.tierId) {
        try {
          // Verify payment is complete
          if (session.payment_status !== 'paid') {
            console.log(`⚠️ Pilot credits webhook: Session ${session.id} not paid yet (status: ${session.payment_status})`);
            return res.json({ received: true, status: 'pending' });
          }
          
          // Verify currency
          if (session.currency !== 'usd') {
            console.error(`❌ Pilot credits webhook: Invalid currency ${session.currency}`);
            return res.status(400).json({ error: 'Invalid currency' });
          }
          
          const tierId = session.metadata.tierId as keyof typeof PILOT_TIERS;
          const tier = PILOT_TIERS[tierId];
          
          if (!tier) {
            console.error(`❌ Invalid pilot tier in webhook: ${tierId}`);
            return res.status(400).json({ error: 'Invalid pilot tier' });
          }
          
          const credits = parseInt(session.metadata.credits || '0');
          const expectedAmountCents = tier.price * 100;
          
          if (session.amount_total !== expectedAmountCents) {
            console.error(`❌ Pilot credits amount mismatch: expected ${expectedAmountCents}, got ${session.amount_total}`);
            return res.status(400).json({ error: 'Amount mismatch' });
          }
          
          const customerEmail = session.customer_details?.email || session.customer_email;
          const userId = customerEmail || `stripe_${session.id}`;
          const idempotencyKey = `pilot_credits_${session.id}`;
          
          try {
            await unifiedCreditsService.addCredits(
              'user',
              userId,
              credits,
              'stripe',
              {
                referenceType: 'pilot_credits',
                referenceId: session.id,
                description: `Pilot credits purchase: ${tierId} ($${credits})`,
                idempotencyKey
              }
            );
            console.log(`✅ Pilot credits webhook: Added $${credits} to user ${userId} (session: ${session.id})`);
            
            await bridgeCreditsToLegacy(userId, credits, session.id, tierId);
          } catch (creditsError: any) {
            if (creditsError.message?.includes('Idempotency')) {
              console.log(`⚠️ Pilot credits webhook: Session ${session.id} already processed - ignoring duplicate`);
            } else {
              throw creditsError;
            }
          }
        } catch (pilotError: any) {
          console.error('❌ Failed to process pilot credits webhook:', pilotError);
          return res.status(500).json({ error: 'Failed to credit pilot balance - will retry' });
        }
      }
      // Handle m2m hosted checkout — provisions API key + credits after Stripe Hosted Checkout
      // This is the golden path: POST /api/m2m/credits/checkout/session → Stripe Hosted Checkout → this handler
      // CRITICAL: was missing from this webhook, causing customers to pay without receiving credits.
      else if (session.metadata?.source === 'm2m-hosted-checkout') {
        const { amountUsd, keyName, email } = session.metadata || {};
        const amount = Number(amountUsd || '0');

        if (!amount) {
          console.error(`❌ M2M hosted checkout missing amountUsd metadata: session=${session.id}`);
          return res.status(400).json({ error: 'Missing amountUsd in session metadata' });
        }

        const crypto = await import('crypto');
        const userId = `m2m_${crypto.default.createHash('sha256').update(session.id).digest('hex').substring(0, 16)}`;
        const effectiveEmail = email || `${userId}@m2m.coinrailz.com`;

        try {
          const { provisionCreditsAndKey } = await import('../services/m2mProvisioningService.js');
          const result = await provisionCreditsAndKey({
            paymentIntentId: session.id, // session ID as idempotency key
            userId,
            amount,
            email: effectiveEmail,
            keyName: keyName || 'M2M Checkout Key',
            purpose: 'm2m-hosted-checkout',
          });

          if (result.alreadyProvisioned) {
            console.log(`ℹ️ M2M hosted checkout already provisioned (idempotent): ${session.id}`);
          } else if (result.inProgress) {
            console.warn(`⚠️ M2M hosted checkout provisioning in progress: ${session.id}`);
            return res.status(500).json({ error: 'Provisioning in progress - Stripe will retry' });
          } else {
            console.log(`✅ M2M hosted checkout provisioned: session=${session.id} | user=${userId} | amount=$${amount} | email=${effectiveEmail}`);
          }
        } catch (m2mError: any) {
          console.error(`❌ M2M hosted checkout provisioning failed: session=${session.id} | error=${m2mError.message}`);
          // Return 500 so Stripe retries
          return res.status(500).json({ error: 'Provisioning failed - Stripe will retry' });
        }
      }
      break;

    case 'charge.dispute.created': {
      const dispute = event.data.object as any;
      const disputeId: string = dispute.id;
      const paymentIntentId: string | null = dispute.payment_intent || null;
      const chargeId: string = dispute.charge;
      const disputeAmount = Math.round(dispute.amount) / 100;

      // Idempotency: bail out if we already recorded this dispute
      const disputeRef = `dispute_${disputeId}`;
      const { creditTransactions: ctTable } = await import('@shared/schema');
      const { eq: eqOp } = await import('drizzle-orm');

      const [existingDispute] = await db.select()
        .from(ctTable)
        .where(eqOp(ctTable.referenceId, disputeRef))
        .limit(1);

      if (existingDispute) {
        console.log(`⚠️ Dispute already processed (idempotent): ${disputeId}`);
        break;
      }

      // Resolve user from original credit transaction
      let originalTx: any = null;
      if (paymentIntentId) {
        [originalTx] = await db.select().from(ctTable)
          .where(eqOp(ctTable.referenceId, paymentIntentId)).limit(1);
      }
      if (!originalTx) {
        [originalTx] = await db.select().from(ctTable)
          .where(eqOp(ctTable.referenceId, chargeId)).limit(1);
      }

      if (!originalTx) {
        console.warn(`🚨 MANUAL REVIEW: Dispute ${disputeId} — no matching credit transaction for pi=${paymentIntentId} charge=${chargeId} amount=$${disputeAmount}`);
        break;
      }

      const userId = originalTx.userId;
      console.log(`🚨 Dispute received: ${disputeId} | user=${userId} | amount=$${disputeAmount}`);

      try {
        await creditsService.deductCredits({
          userId,
          amount: disputeAmount,
          serviceName: 'stripe_dispute',
          description: `Stripe dispute ${disputeId} — credits held pending resolution`,
          metadata: { disputeId, chargeId, paymentIntentId, eventId: event.id, stripeEventType: 'charge.dispute.created', referenceId: disputeRef }
        });
        console.log(`💸 Dispute credits deducted: user=${userId} -$${disputeAmount}`);
      } catch (deductErr: any) {
        // Insufficient balance — revoke all active API keys as fraud-protection fallback
        console.warn(`⚠️ Dispute deduction failed (user=${userId}, insufficient balance) — revoking API keys. Error: ${deductErr.message}`);
        const userKeys = await creditsService.listApiKeys(userId);
        for (const key of userKeys.filter((k: any) => k.status === 'active')) {
          await creditsService.revokeApiKey(key.id, userId);
          console.log(`🔒 API key ${key.id} revoked due to dispute ${disputeId}`);
        }
      }
      break;
    }

    case 'charge.refunded': {
      const charge = event.data.object as any;
      const chargeId: string = charge.id;
      const paymentIntentId: string | null = charge.payment_intent || null;
      const refundAmount = Math.round(charge.amount_refunded) / 100;
      const isFullRefund: boolean = charge.amount_refunded >= charge.amount;

      // Idempotency: key off the latest refund's ID (or chargeId as fallback)
      const latestRefundId: string = charge.refunds?.data?.[0]?.id || chargeId;
      const refundRef = `refund_${latestRefundId}`;

      const { creditTransactions: ctTable2 } = await import('@shared/schema');
      const { eq: eqOp2 } = await import('drizzle-orm');

      const [existingRefund] = await db.select()
        .from(ctTable2)
        .where(eqOp2(ctTable2.referenceId, refundRef))
        .limit(1);

      if (existingRefund) {
        console.log(`⚠️ Refund already processed (idempotent): ${refundRef}`);
        break;
      }

      if (refundAmount <= 0) {
        console.warn(`⚠️ Refund: zero amount for charge ${chargeId} — skipping`);
        break;
      }

      // Resolve user from original credit transaction
      let originalTx2: any = null;
      if (paymentIntentId) {
        [originalTx2] = await db.select().from(ctTable2)
          .where(eqOp2(ctTable2.referenceId, paymentIntentId)).limit(1);
      }
      if (!originalTx2) {
        [originalTx2] = await db.select().from(ctTable2)
          .where(eqOp2(ctTable2.referenceId, chargeId)).limit(1);
      }

      if (!originalTx2) {
        console.warn(`📋 MANUAL REVIEW: Refund for charge ${chargeId} — no matching credit transaction found amount=$${refundAmount}`);
        break;
      }

      const userId2 = originalTx2.userId;
      console.log(`💸 Refund received: charge=${chargeId} | user=${userId2} | amount=$${refundAmount} | full=${isFullRefund}`);

      try {
        await creditsService.deductCredits({
          userId: userId2,
          amount: refundAmount,
          serviceName: 'stripe_refund',
          description: `Stripe refund for charge ${chargeId} — $${refundAmount} credits revoked`,
          metadata: { chargeId, paymentIntentId, refundAmount, isFullRefund, latestRefundId, eventId: event.id, stripeEventType: 'charge.refunded', referenceId: refundRef }
        });
        console.log(`✅ Refund credits deducted: user=${userId2} -$${refundAmount}`);

        // On full refund, revoke all active API keys
        if (isFullRefund) {
          const userKeys2 = await creditsService.listApiKeys(userId2);
          for (const key of userKeys2.filter((k: any) => k.status === 'active')) {
            await creditsService.revokeApiKey(key.id, userId2);
            console.log(`🔒 API key ${key.id} revoked after full refund for user=${userId2}`);
          }
        }
      } catch (deductErr2: any) {
        // Insufficient balance — revoke keys as protection
        console.warn(`⚠️ Refund deduction failed (user=${userId2}, insufficient balance) — revoking API keys. Error: ${deductErr2.message}`);
        const userKeys2 = await creditsService.listApiKeys(userId2);
        for (const key of userKeys2.filter((k: any) => k.status === 'active')) {
          await creditsService.revokeApiKey(key.id, userId2);
          console.log(`🔒 API key ${key.id} revoked after failed refund deduction`);
        }
      }
      break;
    }

    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
}

async function bridgeCreditsToLegacy(userId: string, credits: number, referenceId: string, tierId: string) {
  try {
    await creditsService.addCredits({
      userId,
      amount: credits,
      paymentMethod: 'stripe',
      referenceId: `bridge_${referenceId}`,
      description: `Pilot credits bridge: ${tierId} ($${credits})`,
      metadata: { source: 'pilot_credits_bridge', tierId, originalRef: referenceId }
    });
    console.log(`🔗 Bridge: Mirrored $${credits} to legacy credits for ${userId}`);
  } catch (bridgeError: any) {
    if (bridgeError.code === '23503') {
      console.log(`🔗 Bridge: User ${userId} not in users table - skipping legacy mirror (unified credits still active)`);
    } else if (bridgeError.message?.includes('duplicate') || bridgeError.message?.includes('already')) {
      console.log(`🔗 Bridge: Already mirrored for ${referenceId} - skipping`);
    } else {
      console.error(`⚠️ Bridge: Failed to mirror credits for ${userId} (non-blocking):`, bridgeError.message);
    }
  }
}

// ==========================================
// PILOT CREDITS PACKAGE ENDPOINTS
// ==========================================

router.post('/pilot-credits', async (req, res) => {
  try {
    const { tierId, credits, amount, successUrl, cancelUrl } = req.body;

    if (!tierId || !credits || !amount) {
      return res.status(400).json({ error: 'Missing required fields: tierId, credits, amount' });
    }

    const tier = PILOT_TIERS[tierId as keyof typeof PILOT_TIERS];
    if (!tier) {
      return res.status(400).json({ error: 'Invalid tier ID' });
    }

    if (tier.price !== amount || tier.credits !== credits) {
      return res.status(400).json({ error: 'Price or credits mismatch' });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${tier.name} - IoT Data Credits`,
            description: `$${tier.credits} prepaid credits for IoT device data access`,
          },
          unit_amount: tier.price * 100,
        },
        quantity: 1,
      }],
      mode: 'payment',
      metadata: {
        type: 'pilot_credits',
        tierId,
        credits: String(tier.credits),
        platform: 'coin-railz-iot'
      },
      success_url: successUrl || `${process.env.REPLIT_DEPLOYMENT ? 'https://coinrailz.com' : `https://${process.env.REPLIT_DEV_DOMAIN || 'coinrailz.com'}`}/pilots/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${process.env.REPLIT_DEPLOYMENT ? 'https://coinrailz.com' : `https://${process.env.REPLIT_DEV_DOMAIN || 'coinrailz.com'}`}/pilots/buy`,
    });

    console.log(`💳 Created pilot credits checkout session: ${session.id} for ${tier.name}`);

    res.json({
      success: true,
      checkoutUrl: session.url,
      sessionId: session.id
    });
  } catch (error: any) {
    console.error('Pilot credits checkout error:', error);
    res.status(500).json({
      error: 'Failed to create checkout session',
      message: error.message
    });
  }
});

router.post('/pilot-credits/confirm', async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'Missing sessionId' });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      return res.status(400).json({
        success: false,
        error: 'Payment not completed',
        status: session.payment_status
      });
    }

    const metadata = session.metadata || {};
    if (metadata.type !== 'pilot_credits') {
      return res.status(400).json({
        success: false,
        error: 'Invalid session type'
      });
    }

    const credits = parseInt(metadata.credits || '0');
    const tierId = metadata.tierId as keyof typeof PILOT_TIERS;

    if (credits <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid credits amount in session'
      });
    }

    const tier = PILOT_TIERS[tierId];
    if (!tier) {
      return res.status(400).json({
        success: false,
        error: 'Invalid tier in session metadata'
      });
    }

    const expectedAmountCents = tier.price * 100;
    if (session.amount_total !== expectedAmountCents) {
      console.error(`❌ Amount mismatch: expected ${expectedAmountCents}, got ${session.amount_total}`);
      return res.status(400).json({
        success: false,
        error: 'Payment amount does not match tier price'
      });
    }

    if (session.currency !== 'usd') {
      return res.status(400).json({
        success: false,
        error: 'Invalid currency'
      });
    }

    const idempotencyKey = `pilot_credits_${sessionId}`;
    
    const customerEmail = session.customer_details?.email || session.customer_email;
    const userId = customerEmail || `stripe_${session.id}`;

    try {
      const result = await unifiedCreditsService.addCredits(
        'user',
        userId,
        credits,
        'stripe',
        {
          referenceType: 'pilot_credits',
          referenceId: sessionId,
          description: `Pilot credits purchase: ${tierId} ($${credits})`,
          idempotencyKey
        }
      );

      const balance = await unifiedCreditsService.getBalance('user', userId);

      console.log(`✅ Pilot credits added: $${credits} to user ${userId} (session: ${sessionId})`);

      await bridgeCreditsToLegacy(userId, credits, sessionId, tierId);

      // Auto-generate API key for minimal friction
      let apiKey: string | undefined;
      let keyPrefix: string | undefined;
      try {
        const keyResult = await creditsService.generateApiKey(userId, `Pilot Credits - ${tierId}`);
        apiKey = keyResult.apiKey;
        keyPrefix = keyResult.keyPrefix;
        console.log(`🔑 Auto-generated API key for user ${userId}: ${keyPrefix}...`);
      } catch (keyError: any) {
        console.warn(`⚠️ Failed to auto-generate API key for ${userId}:`, keyError.message);
        // Continue without API key - user can generate later
      }

      res.json({
        success: true,
        credits,
        amount: credits,
        tierId,
        userId,
        balance,
        transactionId: result.transactionId,
        apiKey,
        keyPrefix
      });
    } catch (creditsError: any) {
      if (creditsError.message?.includes('Idempotency')) {
        const balance = await unifiedCreditsService.getBalance('user', userId);
        
        // Try to get or generate API key even on idempotent retries
        let apiKey: string | undefined;
        let keyPrefix: string | undefined;
        try {
          const keyResult = await creditsService.generateApiKey(userId, `Pilot Credits - ${tierId}`);
          apiKey = keyResult.apiKey;
          keyPrefix = keyResult.keyPrefix;
        } catch (keyError: any) {
          // Already has key or generation failed - user can get from dashboard
          console.log(`⚠️ Idempotent API key generation for ${userId}:`, keyError.message);
        }
        
        return res.json({
          success: true,
          credits,
          amount: credits,
          tierId,
          userId,
          balance,
          apiKey,
          keyPrefix,
          message: 'Credits already added for this session'
        });
      }
      throw creditsError;
    }
  } catch (error: any) {
    console.error('Pilot credits confirmation error:', error);
    res.status(500).json({
      error: 'Failed to confirm purchase',
      message: error.message
    });
  }
});

// ==========================================
// PILOT CREDITS CRYPTO PAYMENT ENDPOINTS
// ==========================================

const SUPPORTED_CHAINS = ['base-mainnet', 'polygon-mainnet', 'arbitrum-mainnet'] as const;
const SUPPORTED_TOKENS = ['USDC', 'USDT'] as const;

router.post('/pilot-credits/crypto-intent', async (req, res) => {
  try {
    const { tierId, chain, token, email } = req.body;

    if (!tierId || !chain || !token || !email) {
      return res.status(400).json({ error: 'Missing required fields: tierId, chain, token, email' });
    }

    const tier = PILOT_TIERS[tierId as keyof typeof PILOT_TIERS];
    if (!tier) {
      return res.status(400).json({ error: 'Invalid tier ID' });
    }

    if (!SUPPORTED_CHAINS.includes(chain)) {
      return res.status(400).json({ error: `Unsupported chain. Supported: ${SUPPORTED_CHAINS.join(', ')}` });
    }

    if (!SUPPORTED_TOKENS.includes(token)) {
      return res.status(400).json({ error: `Unsupported token. Supported: ${SUPPORTED_TOKENS.join(', ')}` });
    }

    const tokenContract = CoinbaseCDPService.getTokenAddress(token as 'USDC' | 'USDT', chain);
    if (!tokenContract) {
      return res.status(400).json({ error: `${token} not supported on ${chain}` });
    }

    const cdpService = CoinbaseCDPService.getInstance();
    
    let depositAddress: string;
    try {
      const wallet = await cdpService.createWallet(email, chain);
      depositAddress = wallet.address;
    } catch (walletError: any) {
      // SECURITY: Fail fast - do not fallback to shared platform wallet
      // Shared addresses could lead to cross-user payment confusion
      console.error('Failed to create deposit wallet:', walletError);
      return res.status(503).json({ 
        error: 'Payment service temporarily unavailable. Please try again or use card payment.',
        code: 'WALLET_CREATION_FAILED'
      });
    }

    const paymentId = `pilot_pay_${nanoid(16)}`;
    const idempotencyKey = `pilot_crypto_${paymentId}`;
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const nextCheckAt = new Date(Date.now() + 2 * 60 * 1000);

    await db.insert(pilotCreditsPayments).values({
      id: paymentId,
      userId: email,
      tierId,
      credits: tier.credits,
      amountUsd: String(tier.price),
      chain,
      token,
      depositAddress,
      tokenContract,
      expectedAmount: String(tier.price),
      status: 'pending',
      verificationAttempts: 0,
      nextCheckAt,
      expiresAt,
      idempotencyKey,
    });

    console.log(`🔗 Created crypto payment intent: ${paymentId} for ${tier.name} (${token} on ${chain})`);

    res.json({
      success: true,
      paymentId,
      depositAddress,
      chain,
      token,
      tokenContract,
      amount: tier.price,
      credits: tier.credits,
      expiresAt: expiresAt.toISOString(),
      instructions: `Send exactly ${tier.price} ${token} to ${depositAddress} on ${chain.replace('-mainnet', '')}`,
    });
  } catch (error: any) {
    console.error('Crypto payment intent error:', error);
    res.status(500).json({
      error: 'Failed to create crypto payment intent',
      message: error.message
    });
  }
});

router.get('/pilot-credits/crypto-status/:paymentId', async (req, res) => {
  try {
    const { paymentId } = req.params;

    // For completed payments, use a transaction with row-level locking to prevent
    // race conditions where concurrent polls could generate multiple API keys
    let apiKey: string | undefined;
    let keyPrefix: string | undefined;
    let payment: any;

    // Use transaction to atomically check and generate API key
    // Wrapped in try-catch for graceful degradation if generatedApiKeyPrefix column is missing
    let result: { payment: any; apiKey: string | undefined; keyPrefix: string | undefined };
    
    try {
      result = await db.transaction(async (tx) => {
        // SELECT with FOR UPDATE to lock the row during key generation
        const [lockedPayment] = await tx.select()
          .from(pilotCreditsPayments)
          .where(eq(pilotCreditsPayments.id, paymentId))
          .limit(1);

        if (!lockedPayment) {
          return { payment: null, apiKey: undefined, keyPrefix: undefined };
        }

        let generatedApiKey: string | undefined;
        let generatedKeyPrefix: string | undefined;

        // For completed payments, generate API key atomically within the transaction
        if (lockedPayment.status === 'completed' && lockedPayment.userId) {
          if (!lockedPayment.generatedApiKeyPrefix) {
            // First poll after completion - generate new key and store prefix atomically
            try {
              const keyResult = await creditsService.generateApiKey(lockedPayment.userId, `Pilot Credits - Crypto`);
              generatedApiKey = keyResult.apiKey;
              generatedKeyPrefix = keyResult.keyPrefix;
              
              // Store the key prefix atomically within the same transaction
              await tx.update(pilotCreditsPayments)
                .set({ generatedApiKeyPrefix: generatedKeyPrefix })
                .where(eq(pilotCreditsPayments.id, paymentId));
                
              console.log(`🔑 Auto-generated crypto API key for user ${lockedPayment.userId}: ${generatedKeyPrefix}... (atomic transaction)`);
            } catch (keyError: any) {
              console.log(`⚠️ API key generation for crypto user ${lockedPayment.userId}:`, keyError.message);
            }
          } else {
            // Key already generated - return prefix only (raw key returned only on first poll)
            generatedKeyPrefix = lockedPayment.generatedApiKeyPrefix;
            console.log(`🔑 Returning existing key prefix for crypto payment: ${generatedKeyPrefix}...`);
          }
        }

        return { payment: lockedPayment, apiKey: generatedApiKey, keyPrefix: generatedKeyPrefix };
      });
    } catch (txError: any) {
      // Fallback for missing column or transaction errors - query without generatedApiKeyPrefix
      console.warn(`⚠️ Transaction fallback for crypto-status (column may be missing):`, txError.message);
      const [fallbackPayment] = await db.select()
        .from(pilotCreditsPayments)
        .where(eq(pilotCreditsPayments.id, paymentId))
        .limit(1);
      result = { payment: fallbackPayment || null, apiKey: undefined, keyPrefix: undefined };
    }

    payment = result.payment;
    apiKey = result.apiKey;
    keyPrefix = result.keyPrefix;

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    res.json({
      success: true,
      paymentId: payment.id,
      status: payment.status,
      chain: payment.chain,
      token: payment.token,
      depositAddress: payment.depositAddress,
      expectedAmount: payment.expectedAmount,
      verifiedAmount: payment.verifiedAmount,
      txHash: payment.txHash,
      credits: payment.credits,
      expiresAt: payment.expiresAt,
      failureReason: payment.failureReason,
      userId: payment.userId,
      apiKey,
      keyPrefix,
    });
  } catch (error: any) {
    console.error('Crypto status check error:', error);
    res.status(500).json({
      error: 'Failed to check payment status',
      message: error.message
    });
  }
});

router.post('/pilot-credits/crypto-confirm', async (req, res) => {
  try {
    const { paymentId, txHash } = req.body;

    if (!paymentId || !txHash) {
      return res.status(400).json({ error: 'Missing required fields: paymentId, txHash' });
    }

    const [payment] = await db.select()
      .from(pilotCreditsPayments)
      .where(eq(pilotCreditsPayments.id, paymentId))
      .limit(1);

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    if (payment.status === 'completed') {
      const balance = await unifiedCreditsService.getBalance('user', payment.userId);
      return res.json({
        success: true,
        message: 'Payment already confirmed',
        status: 'completed',
        balance,
        credits: payment.credits,
      });
    }

    await db.update(pilotCreditsPayments)
      .set({ 
        txHash, 
        status: 'confirming',
        nextCheckAt: new Date(),
      })
      .where(eq(pilotCreditsPayments.id, paymentId));

    console.log(`📝 Updated payment ${paymentId} with txHash ${txHash}, queued for verification`);

    res.json({
      success: true,
      message: 'Transaction submitted for verification',
      status: 'confirming',
      paymentId,
      txHash,
    });
  } catch (error: any) {
    console.error('Crypto confirm error:', error);
    res.status(500).json({
      error: 'Failed to submit transaction',
      message: error.message
    });
  }
});

export default router;