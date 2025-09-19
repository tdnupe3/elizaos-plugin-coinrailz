/**
 * AI AGENT PRODUCT ROUTES
 * Premium API access packages for AI agents
 */
import { Router } from 'express';
import { z } from 'zod';

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
      'Crypto payments only'
    ],
    apiEndpoints: [
      '/api/crypto/prices',
      '/api/circle/wallet/create',
      '/api/xmtp/send-message',
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
      'XMTP messaging',
      'Priority support'
    ],
    apiEndpoints: [
      '/api/crypto/prices',
      '/api/circle/wallet/*',
      '/api/xmtp/*',
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
      'Trading signals',
      'XRP operations',
      'Dedicated support',
      'Custom integrations'
    ],
    apiEndpoints: [
      '/api/crypto/*',
      '/api/circle/*',
      '/api/xmtp/*',
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
    
    // Generate API key
    const apiKey = `ai_agent_${agentId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Simulate payment processing (integrate with existing payment systems)
    const paymentResult = await processPayment(paymentMethod, product.priceUSD, walletAddress);
    
    if (paymentResult.success) {
      // Create subscription record (simplified for now)
      const subscription = {
        id: `sub_${Date.now()}`,
        agentId,
        productId,
        product: product.name,
        status: 'active',
        apiKey,
        monthlyRevenue: product.priceUSD,
        paymentMethod,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        usageStats: { requests_today: 0, requests_month: 0 }
      };
      
      console.log(`✅ Successfully created subscription for agent ${agentId}: ${product.name}`);
      
      res.json({
        success: true,
        message: 'Product purchased successfully!',
        subscription,
        apiKey,
        documentation: {
          baseUrl: 'https://coinrailz.com/api',
          authHeader: `Bearer ${apiKey}`,
          endpoints: product.apiEndpoints,
          limits: product.requestLimits
        },
        support: 'support@coinrailz.com'
      });
    } else {
      res.status(400).json({
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

// Simulate payment processing (integrate with existing systems)
async function processPayment(method: string, amount: number, walletAddress?: string) {
  console.log(`💰 Processing ${method} payment of $${amount}...`);
  
  switch (method) {
    case 'stripe':
      // Would integrate with existing Stripe system
      return { success: true, transactionId: `stripe_${Date.now()}` };
    
    case 'crypto':
      // Would integrate with existing crypto payment system
      if (!walletAddress) {
        return { success: false, error: 'Wallet address required for crypto payments' };
      }
      return { success: true, transactionId: `crypto_${Date.now()}`, walletAddress };
    
    case 'circle':
      // Would integrate with existing Circle USDC system
      return { success: true, transactionId: `circle_${Date.now()}` };
    
    case 'paypal':
      // Would integrate with existing PayPal system
      return { success: true, transactionId: `paypal_${Date.now()}` };
    
    default:
      return { success: false, error: 'Unsupported payment method' };
  }
}

export default aiAgentProductRoutes;