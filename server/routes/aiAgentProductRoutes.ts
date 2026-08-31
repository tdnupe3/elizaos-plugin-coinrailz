/**
 * AI AGENT PRODUCT ROUTES
 * Premium API access packages for AI agents
 * REAL PAYMENT PROCESSING - Stripe integration
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { stripe } from '../services/stripeClient';
import express from 'express';
import { db } from '../db';
import { aiAgentSubscriptions, aiMarketplaceOrders } from '@shared/schema';
import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { createHash } from 'crypto';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}

export const aiAgentProductRoutes = Router();

// Product catalog based on market research
const API_PRODUCTS = [
  {
    id: 'starter',
    name: 'Starter Credits Package',
    description: 'Prepaid API credits - perfect for testing agents, no monthly commitment',
    priceUSD: 9.99,
    billingCycle: 'prepaid-credits',
    features: [
      '$9.99 prepaid credits (40 API calls)',
      '$0.25 per API request',
      'No monthly commitment',
      'Credits never expire',
      'Enterprise-grade APIs',
      'Circle USDC wallet creation',
      'Real-time crypto data',
      'Multi-protocol messaging (on-chain, Lens, Solana SMS, WalletConnect)',
      'Crypto payments only'
    ],
    apiEndpoints: [
      '/api/crypto/prices',
      '/api/circle/wallet/create',
      '/api/messaging/send',
      '/api/messaging/lens/send',
      '/api/messaging/solana-sms/send',
      '/api/messaging/walletconnect/send',
      '/api/market/data'
    ],
    requestLimits: {
      daily: 1000,
      monthly: 30000
    },
    targetAudience: 'ai_agents',
    category: 'api_access'
  },
  {
    id: 'professional',
    name: 'Pro Credits Package',
    description: 'High-value credit bundle with better unit economics for scaling agents',
    priceUSD: 49.99,
    billingCycle: 'prepaid-credits',
    features: [
      '$49.99 prepaid credits (250+ API calls)',
      '$0.20 per API request (better rate)',
      'Credits never expire',
      'Premium operations included',
      'DEX aggregation',
      'Circle wallet management',
      'On-chain messaging',
      'Lens Protocol messaging',
      'Solana SMS messaging',
      'WalletConnect v2 messaging',
      'Unified messaging API',
      'Priority support'
    ],
    apiEndpoints: [
      '/api/crypto/prices',
      '/api/circle/wallet/*',
      '/api/messaging/on-chain/*',
      '/api/messaging/lens/*',
      '/api/messaging/solana-sms/*',
      '/api/messaging/walletconnect/*',
      '/api/messaging/unified/*',
      '/api/dex/aggregate',
      '/api/p2p/transfer',
      '/api/trading/signals'
    ],
    requestLimits: {
      daily: 5000,
      monthly: 150000
    },
    targetAudience: 'ai_agents',
    category: 'api_access'
  },
  {
    id: 'enterprise',
    name: 'Enterprise Credits Package',
    description: 'Maximum value prepaid credits for high-volume institutional agents',
    priceUSD: 199.99,
    billingCycle: 'prepaid-credits',
    features: [
      '$199.99 prepaid credits (1,300+ API calls)',
      '$0.15 per API request (best rate)',
      'Credits never expire',
      'All premium features included',
      'Unlimited daily usage',
      'Complete messaging suite (5 protocols)',
      'AI agent discovery across protocols',
      'Bulk messaging capabilities',
      'Trading signals',
      'XRP operations',
      'Dedicated support',
      'Custom integrations'
    ],
    apiEndpoints: [
      '/api/crypto/*',
      '/api/circle/*',
      '/api/messaging/*',
      '/api/dex/*',
      '/api/p2p/*',
      '/api/xrp/*',
      '/api/webhooks/*'
    ],
    requestLimits: {
      daily: 'unlimited',
      monthly: 'unlimited'
    },
    targetAudience: 'ai_agents',
    category: 'api_access'
  }
];

// Get all products
aiAgentProductRoutes.get('/products', async (req, res) => {
  try {
    console.log('🛍️ AI agent requesting product catalog...');
    
    res.json({
      success: true,
      products: API_PRODUCTS,
      totalProducts: API_PRODUCTS.length,
      priceRange: '$9.99-199.99 prepaid credits',
      targetAudience: 'AI agents and automated systems'
    });
  } catch (error) {
    console.error('Product catalog error:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Get specific product details
aiAgentProductRoutes.get('/products/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const product = API_PRODUCTS.find(p => p.id === productId);
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    res.json({
      success: true,
      product,
      paymentOptions: [
        'Stripe (Credit/Debit Cards)',
        'Circle USDC',
        'Crypto (ETH, Bitcoin, Solana)',
        'PayPal'
      ]
    });
  } catch (error) {
    console.error('Product details error:', error);
    res.status(500).json({ error: 'Failed to fetch product details' });
  }
});

// Purchase product (initiate subscription)
const purchaseSchema = z.object({
  productId: z.string(),
  agentId: z.string(),
  paymentMethod: z.enum(['stripe', 'crypto', 'circle', 'paypal']),
  walletAddress: z.string().optional(),
  email: z.string().email().optional()
});

aiAgentProductRoutes.post('/purchase', async (req, res) => {
  try {
    console.log('💳 AI agent initiating product purchase...');
    
    const validation = purchaseSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid purchase data',
        details: validation.error.issues
      });
    }
    
    const { productId, agentId, paymentMethod, walletAddress, email } = validation.data;
    
    // Find product
    const product = API_PRODUCTS.find(p => p.id === productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    // Create pending order in database FIRST (before payment)
    const orderId = nanoid();
    const pendingOrder = {
      id: orderId,
      agentId,
      // Product packages are configuration rather than rows in ai_agent_products.
      // Store their stable identifier in the order description.
      customerId: agentId,
      serviceType: 'api_access',
      serviceDescription: product.id,
      amount: product.priceUSD.toString(),
      paymentMethod,
      status: 'pending' as const,
      customerRequirements: JSON.stringify({ walletAddress: walletAddress || null, email: email || null }),
      createdAt: new Date()
    };
    
    // Save pending order to database
    await db.insert(aiMarketplaceOrders).values(pendingOrder);
    console.log(`📝 Created pending order ${orderId} for agent ${agentId}`);
    
    // Process payment (NO API key issued until payment confirmed)
    const paymentResult = await processPayment(paymentMethod, product.priceUSD, productId, agentId, walletAddress);
    
    if (paymentResult.requiresAction) {
      // Payment needs user action (Stripe checkout, crypto transfer, etc.)
      res.json({
        success: false,
        requiresAction: true,
        orderId,
        message: 'Complete payment to activate API access',
        paymentDetails: {
          method: paymentMethod,
          amount: product.priceUSD,
          currency: 'USD',
          clientSecret: paymentResult.clientSecret,
          paymentIntentId: paymentResult.paymentIntentId,
          cryptoAddress: paymentResult.cryptoAddress,
          circlePaymentLink: paymentResult.circlePaymentLink,
          paypalOrderId: paymentResult.paypalOrderId
        },
        statusUrl: `/api/ai-products/order/${orderId}/status`,
        product: {
          name: product.name,
          description: product.description,
          features: product.features
        }
      });
    } else if (paymentResult.success) {
      // Immediate success (shouldn't happen with real payments)
      const apiKey = await activateSubscription(orderId, agentId, productId, product, paymentResult.transactionId ?? '');
      
      res.json({
        success: true,
        message: 'Product purchased successfully!',
        orderId,
        apiKey,
        documentation: {
          baseUrl: 'https://coinrailz.com/api',
          authHeader: `Bearer ${apiKey}`,
          endpoints: product.apiEndpoints,
          limits: product.requestLimits
        }
      });
    } else {
      // Payment failed immediately
      await db.update(aiMarketplaceOrders)
        .set({ status: 'failed', updatedAt: new Date() })
        .where(eq(aiMarketplaceOrders.id, orderId));
        
      res.status(400).json({
        success: false,
        orderId,
        error: 'Payment failed',
        details: paymentResult.error
      });
    }
    
  } catch (error) {
    console.error('Purchase error:', error);
    res.status(500).json({ error: 'Purchase failed' });
  }
});

// Check subscription status
aiAgentProductRoutes.get('/subscription/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    
    // This would query the database in production
    // For now, simulate active subscription
    res.json({
      success: true,
      subscription: {
        status: 'active',
        product: 'Professional API Package',
        renewalDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(),
        usageThisMonth: {
          requests: 45230,
          limit: 150000,
          percentUsed: 30.15
        }
      }
    });
  } catch (error) {
    console.error('Subscription status error:', error);
    res.status(500).json({ error: 'Failed to fetch subscription status' });
  }
});

// REAL PAYMENT PROCESSING - Stripe integration
async function processPayment(method: string, amount: number, productId: string, agentId: string, walletAddress?: string) {
  console.log(`💰 Processing REAL ${method} payment of $${amount}...`);
  
  switch (method) {
    case 'stripe':
      try {
        // Create real Stripe payment intent
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(amount * 100), // Convert to cents
          currency: "usd",
          metadata: {
            productId,
            agentId,
            type: 'ai_agent_api_access'
          }
        });
        
        return { 
          success: false, // Will be true after webhook confirmation
          requiresAction: true,
          clientSecret: paymentIntent.client_secret,
          paymentIntentId: paymentIntent.id,
          transactionId: `stripe_${paymentIntent.id}`
        };
      } catch (error) {
        console.error('Stripe payment failed:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Stripe payment failed' };
      }
    
    case 'crypto':
      // For now, return pending - would integrate with existing crypto system
      if (!walletAddress) {
        return { success: false, error: 'Wallet address required for crypto payments' };
      }
      return { 
        success: false, 
        requiresAction: true,
        cryptoAddress: '0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91', // Your platform wallet
        amount: amount,
        currency: 'USDC',
        transactionId: `crypto_pending_${Date.now()}`,
        walletAddress 
      };
    
    case 'circle':
      // Pending - would integrate with existing Circle system
      return { 
        success: false,
        requiresAction: true,
        circlePaymentLink: `https://pay.circle.com/checkout?amount=${amount}&productId=${productId}`,
        transactionId: `circle_pending_${Date.now()}`
      };
    
    case 'paypal':
      // Will be handled by PayPal checkout component
      return { 
        success: false,
        requiresAction: true,
        paypalOrderId: `paypal_${Date.now()}`,
        transactionId: `paypal_pending_${Date.now()}`
      };
    
    default:
      return { success: false, error: 'Unsupported payment method' };
  }
}

// Activate subscription after payment confirmation
async function activateSubscription(orderId: string, agentId: string, productId: string, product: any, transactionId: string) {
  // Generate API key only after payment confirmed
  const apiKey = `ai_agent_${agentId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Update order status
  await db.update(aiMarketplaceOrders)
    .set({ 
      status: 'completed',
      updatedAt: new Date()
    })
    .where(eq(aiMarketplaceOrders.id, orderId));
  
  // Create active subscription
  const subscription = {
    agentId,
    productId: API_PRODUCTS.findIndex((candidate) => candidate.id === productId) + 1,
    status: 'active' as const,
    paymentMethod: 'stripe',
    paymentAddress: null,
    monthlyRevenue: product.priceUSD.toString(),
    apiKeyHash: createHash('sha256').update(apiKey).digest('hex'),
    startDate: new Date(),
    endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year for prepaid credits
    createdAt: new Date()
  };
  
  await db.insert(aiAgentSubscriptions).values(subscription);
  console.log(`✅ PAYMENT CONFIRMED: Activated subscription for agent ${agentId}`);
  
  return apiKey;
}

// Stripe webhook handler — exported so appMain.ts can mount it PRE-JSON for raw body integrity
export async function aiAgentStripeWebhookHandler(req: Request, res: Response) {
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
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    console.log('✅ Stripe webhook signature verified:', event.type);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid webhook signature';
    console.error('❌ Webhook signature verification failed:', message);
    return res.status(400).send(`Webhook Error: ${message}`);
  }

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    const { productId, agentId } = paymentIntent.metadata;

    console.log(`🎉 STRIPE PAYMENT CONFIRMED: ${paymentIntent.id} for agent ${agentId}`);
    console.log(`💰 Amount: $${(paymentIntent.amount / 100).toFixed(2)}, Product: ${productId}`);

    try {
      const orders = await db.select()
        .from(aiMarketplaceOrders)
        .where(and(
          eq(aiMarketplaceOrders.agentId, agentId),
          eq(aiMarketplaceOrders.serviceDescription, productId),
          eq(aiMarketplaceOrders.status, 'pending'),
        ))
        .limit(1);

      if (orders.length > 0) {
        const order = orders[0];
        const product = API_PRODUCTS.find(p => p.id === productId);
        if (product) {
          const apiKey = await activateSubscription(order.id, agentId, productId, product, paymentIntent.id);
          console.log(`✅ PAYMENT VERIFIED & SUBSCRIPTION ACTIVATED: API key ${apiKey} issued for agent ${agentId}`);
          console.log(`📊 Revenue: $${product.priceUSD} collected successfully`);
        } else {
          console.error(`❌ Product ${productId} not found in catalog`);
        }
      } else {
        console.error(`❌ No pending order found for agent ${agentId}, product ${productId}`);
      }
    } catch (error) {
      console.error('💥 CRITICAL: Failed to activate subscription after confirmed payment:', error);
    }
  } else {
    console.log(`📨 Stripe webhook event: ${event.type}`);
  }

  res.json({ received: true });
}

// Order status endpoint
aiAgentProductRoutes.get('/order/:orderId/status', async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const order = await db.select()
      .from(aiMarketplaceOrders)
      .where(eq(aiMarketplaceOrders.id, orderId))
      .limit(1);
    
    if (order.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    const orderData = order[0];
    
    // If completed, also get subscription details
    let subscription = null;
    if (orderData.status === 'completed') {
      const sub = await db.select()
        .from(aiAgentSubscriptions)
        .where(eq(aiAgentSubscriptions.agentId, orderData.agentId))
        .limit(1);
      subscription = sub[0] || null;
    }
    
    res.json({
      success: true,
      order: {
        id: orderData.id,
        status: orderData.status,
        productName: orderData.serviceDescription,
        amount: orderData.amount,
        currency: 'USD',
        paymentMethod: orderData.paymentMethod,
        createdAt: orderData.createdAt
      },
      subscription,
      apiKey: null
    });
    
  } catch (error) {
    console.error('Order status error:', error);
    res.status(500).json({ error: 'Failed to fetch order status' });
  }
});

// Create Stripe Payment Link for agent checkout
aiAgentProductRoutes.post('/create-payment-link', async (req, res) => {
  try {
    const { productId, agentId } = req.body;
    
    const product = API_PRODUCTS.find(p => p.id === productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    // Create Stripe Payment Link for instant checkout
    const paymentLink = await stripe.paymentLinks.create({
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: product.name,
              description: `${product.description} - Instant API access for AI Agent ${agentId}`
            },
            unit_amount: Math.round(product.priceUSD * 100)
          },
          quantity: 1
        }
      ],
      metadata: {
        productId,
        agentId,
        type: 'ai_agent_api_access'
      },
      after_completion: {
        type: 'redirect',
        redirect: {
          url: `https://coinrailz.com/api/ai-products/order/success?agent=${agentId}&product=${productId}`
        }
      }
    });
    
    console.log(`🔗 Payment link created for agent ${agentId}: ${paymentLink.url}`);
    
    res.json({
      success: true,
      paymentUrl: paymentLink.url,
      product: {
        name: product.name,
        price: product.priceUSD,
        description: product.description
      }
    });
    
  } catch (error) {
    console.error('Payment link creation failed:', error);
    res.status(500).json({ error: 'Failed to create payment link' });
  }
});

export default aiAgentProductRoutes;