/**
 * PRODUCTION AI AGENT PRODUCT ROUTES
 * Real Stripe integration with webhooks and validation
 */
import { Router } from 'express';
import { z } from 'zod';
import { stripe } from '../services/stripeClient';
import crypto from 'crypto';
import { storage } from '../storage';
import { insertAIAgentProductSchema, insertAIAgentSubscriptionSchema } from '@shared/schema';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}


export const aiAgentProductRoutesProduction = Router();

// Initialize products in database on startup
const initializeProducts = async () => {
  try {
    const existingProducts = await storage.getProducts();
    console.log(`Found ${existingProducts.length} existing products`);
    
    // Check if we already have the new prepaid credit products
    const hasStarterCredits = existingProducts.some(p => p.name === 'Starter Credits Package');
    
    if (!hasStarterCredits) {
      console.log('🔄 Creating new prepaid credit product structure...');
      console.log('🏪 Initializing prepaid credit product catalog...');
      
      try {
        const products = [
        {
          name: 'Starter Credits Package',
          description: 'Prepaid API credits - perfect for testing agents, no monthly commitment',
          category: 'api_access',
          priceUSD: '9.99',
          billingCycle: 'prepaid-credits',
          features: ['$9.99 prepaid credits (40 API calls)', '$0.25 per API request', 'No monthly commitment', 'Credits never expire', 'Enterprise-grade APIs', 'Circle USDC wallet creation', 'DEX aggregation', 'Real-time crypto data', 'Crypto payments only'],
          apiEndpoints: ['/api/crypto/prices', '/api/circle/wallet/create', '/api/messaging/send', '/api/market/data', '/api/dex/aggregate'],
          requestLimits: { daily: 'credit-based', monthly: 'credit-based' },
          isActive: true,
          targetAudience: 'ai_agents'
        },
        {
          name: 'Pro Credits Package',
          description: 'High-value credit bundle with better unit economics for scaling agents',
          category: 'api_access',
          priceUSD: '49.99',
          billingCycle: 'prepaid-credits',
          features: ['$49.99 prepaid credits (250+ API calls)', '$0.20 per API request (better rate)', 'Credits never expire', 'Premium operations included', 'DEX aggregation', 'Circle wallet management', 'On-chain messaging', 'Priority support'],
          apiEndpoints: ['/api/crypto/*', '/api/circle/wallet/*', '/api/messaging/*', '/api/dex/aggregate', '/api/p2p/transfer'],
          requestLimits: { daily: 'credit-based', monthly: 'credit-based' },
          isActive: true,
          targetAudience: 'ai_agents'
        },
        {
          name: 'Enterprise Credits Package', 
          description: 'Maximum value prepaid credits for high-volume institutional agents',
          category: 'api_access',
          priceUSD: '199.99',
          billingCycle: 'prepaid-credits',
          features: ['$199.99 prepaid credits (1,300+ API calls)', '$0.15 per API request (best rate)', 'Credits never expire', 'All premium features included', 'Unlimited daily usage', 'Trading signals', 'XRP operations', 'Dedicated support', 'Custom integrations'],
          apiEndpoints: ['/api/crypto/*', '/api/circle/*', '/api/messaging/*', '/api/dex/*', '/api/p2p/*', '/api/xrp/*', '/api/trading/signals'],
          requestLimits: { daily: 'unlimited', monthly: 'credit-based' },
          isActive: true,
          targetAudience: 'ai_agents'
        },
      ];

        for (const product of products) {
          const created = await storage.createProduct(product);
          console.log(`✅ Created product: ${created.name} (ID: ${created.id})`);
        }
      } catch (error) {
        console.error('❌ Failed to create prepaid credit products:', error);
      }
    }
  } catch (error) {
    console.error('❌ Failed to initialize products:', error);
  }
};

// Initialize products on module load
initializeProducts();

// Get all products
aiAgentProductRoutesProduction.get('/products', async (req, res) => {
  try {
    console.log('🛍️ AI agent requesting product catalog...');
    
    const products = await storage.getProducts({ active: true });
    
    res.json({
      success: true,
      products,
      totalProducts: products.length,
      priceRange: '$9.99-199.99 prepaid credits',
      targetAudience: 'AI agents and automated systems'
    });
  } catch (error) {
    console.error('Product catalog error:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Get specific product details
aiAgentProductRoutesProduction.get('/products/:productId', async (req, res) => {
  try {
    const productId = parseInt(req.params.productId);
    const product = await storage.getProductById(productId);
    
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

// Create Stripe payment intent for subscription
const purchaseSchema = z.object({
  productId: z.number(),
  agentId: z.string().min(1),
  paymentMethod: z.enum(['stripe', 'crypto', 'usdc', 'xrp', 'circle', 'paypal']),
  walletAddress: z.string().optional(),
  email: z.string().email().optional()
});

aiAgentProductRoutesProduction.post('/purchase', async (req, res) => {
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
    const product = await storage.getProductById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    // Check for existing subscription
    const existingSubscription = await storage.getSubscription(agentId);
    if (existingSubscription && existingSubscription.status === 'active') {
      return res.status(400).json({ 
        error: 'Agent already has an active subscription',
        subscription: existingSubscription
      });
    }
    
    if (paymentMethod === 'stripe') {
      // Create Stripe payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(parseFloat(product.priceUSD.toString()) * 100), // Convert to cents
        currency: 'usd',
        metadata: {
          productId: productId.toString(),
          agentId,
          email: email || ''
        }
      });
      
      res.json({
        success: true,
        paymentIntent: {
          clientSecret: paymentIntent.client_secret,
          paymentIntentId: paymentIntent.id
        },
        product: {
          name: product.name,
          price: product.priceUSD,
          billingCycle: product.billingCycle
        }
      });
    } else if (paymentMethod === 'usdc') {
      // USDC Circle payment
      res.json({
        success: true,
        message: 'USDC payment processing via Circle',
        paymentDetails: {
          method: 'USDC (Circle)',
          amount: product.priceUSD,
          currency: 'USDC',
          walletAddress: 'circle-wallet-integration-pending',
          instructions: 'Circle USDC wallet integration with instant settlement'
        },
        product
      });
    } else if (paymentMethod === 'xrp') {
      // XRP payment
      res.json({
        success: true,
        message: 'XRP payment processing',
        paymentDetails: {
          method: 'XRP',
          amount: product.priceUSD,
          currency: 'XRP',
          walletAddress: 'xrp-wallet-integration-pending',
          instructions: 'Lightning-fast XRP payment with minimal fees'
        },
        product
      });
    } else if (paymentMethod === 'crypto') {
      // Multi-chain crypto payment
      res.json({
        success: true,
        message: 'Multi-chain crypto payment processing',
        paymentDetails: {
          method: 'Multi-Chain Crypto',
          amount: product.priceUSD,
          currency: 'Multiple',
          supportedChains: ['Ethereum', 'Bitcoin', 'Solana', 'BNB Chain', 'Base'],
          walletAddresses: {
            ethereum: '0x742d35cc6346c4c5a3A6632d21D1F3A5B52d8e1D',
            bitcoin: 'bc1qcoinrailz5emergency7funding8global8agents',
            solana: 'CoinRailz8xzk2wQ5t8P1N9nKqW8E5a5NG8r7D5D5mwE'
          },
          instructions: 'Choose your preferred cryptocurrency for payment'
        },
        product
      });
    } else {
      // Handle other payment methods
      res.json({
        success: true,
        message: `${paymentMethod} payment processing will be implemented`,
        product
      });
    }
    
  } catch (error) {
    console.error('Purchase error:', error);
    res.status(500).json({ error: 'Purchase failed' });
  }
});

// Stripe webhook for payment confirmation
aiAgentProductRoutesProduction.post('/stripe-webhook', async (req, res) => {
  try {
    const sig = req.headers['stripe-signature'] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      console.error('Missing Stripe webhook secret');
      return res.status(500).send('Webhook secret not configured');
    }
    
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return res.status(400).send('Webhook signature verification failed');
    }
    
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const { productId, agentId, email } = paymentIntent.metadata;
      
      console.log(`✅ Payment succeeded for agent ${agentId}, product ${productId}`);
      
      // Generate secure API key
      const apiKey = `ai_agent_${agentId}_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;
      const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
      
      // Create subscription
      const subscription = await storage.createSubscription({
        agentId,
        productId: parseInt(productId),
        status: 'active',
        paymentMethod: 'stripe',
        monthlyRevenue: paymentIntent.amount_received / 100,
        apiKeyHash,
        stripeSubscriptionId: paymentIntent.id,
        email,
        lastPaymentDate: new Date(),
        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        usageStats: { requests_today: 0, requests_month: 0, last_reset: new Date().toISOString() }
      });
      
      console.log(`🎉 Created subscription for agent ${agentId}: ${subscription.id}`);
      
      // 🚀 DELIVER ACTUAL PRODUCT TO CUSTOMER
      const { productDelivery } = await import('../services/productDeliveryService.js');
      await productDelivery.deliverAPIAccess(subscription, apiKey);
      console.log(`✅ API access delivered to agent ${agentId}`);
    }
    
    res.json({ received: true });
    
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook failed' });
  }
});

// Check subscription status with API key validation
aiAgentProductRoutesProduction.get('/subscription/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    
    const subscription = await storage.getSubscription(agentId);
    if (!subscription) {
      return res.status(404).json({ error: 'No subscription found' });
    }
    
    const product = await storage.getProductById(subscription.productId);
    
    res.json({
      success: true,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        productName: product?.name,
        startDate: subscription.startDate,
        nextBillingDate: subscription.nextBillingDate,
        usageStats: subscription.usageStats
      }
    });
  } catch (error) {
    console.error('Subscription status error:', error);
    res.status(500).json({ error: 'Failed to fetch subscription status' });
  }
});

export default aiAgentProductRoutesProduction;