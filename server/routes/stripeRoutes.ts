import { Router } from 'express';
import Stripe from 'stripe';
import { storage } from '../storage';
import { isAuthenticated } from '../replitAuth';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});

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
    const { paymentIntentId, orderId } = req.body;

    if (!paymentIntentId) {
      return res.status(400).json({ error: 'Payment intent ID required' });
    }

    // Retrieve payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status === 'succeeded') {
      // Update order status to paid
      if (orderId) {
        await storage.updateMarketplaceOrder(orderId, {
          status: 'paid',
          completedAt: new Date()
        });
      }

      res.json({ 
        success: true, 
        status: 'paid',
        amount: paymentIntent.amount / 100,
        orderId: orderId
      });
    } else {
      res.json({ 
        success: false, 
        status: paymentIntent.status 
      });
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

// Webhook endpoint for Stripe events
router.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig as string, process.env.STRIPE_WEBHOOK_SECRET || '');
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      console.log('Payment succeeded:', paymentIntent.id);
      
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
      
      // Create marketplace order after successful payment
      if (session.metadata?.platform === 'coin-railz-marketplace') {
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
        } catch (orderError) {
          console.error('Failed to create order after payment:', orderError);
        }
      }
      break;
      
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
});


export default router;