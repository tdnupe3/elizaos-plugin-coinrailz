/**
 * Agent Payments API Routes - Supporting @coinrailz/agent-payments SDK
 */
import express from 'express';
import { db } from '../db';
import { aiMarketplaceOrders, users } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';

const router = express.Router();

/**
 * COMPETITIVE SDK PRICING STRUCTURE
 * Early Adopter: 0.99% for first $500k TPV
 * Standard: 1.75% + $0.10 per transaction  
 * Volume: 1.25% at $1M+ TPV, 0.85% at $10M+ TPV
 * Enterprise: 0.4%-0.9% + monthly fees
 */
const PRICING_TIERS = {
  early_adopter: { rate: 0.0099, fixedFee: 0.05, maxTPV: 500000 }, // 0.99% + 5¢
  standard: { rate: 0.0175, fixedFee: 0.10 }, // 1.75% + 10¢
  volume_1m: { rate: 0.0125, fixedFee: 0.10, minTPV: 1000000 }, // 1.25% at $1M+
  volume_10m: { rate: 0.0085, fixedFee: 0.10, minTPV: 10000000 }, // 0.85% at $10M+
  enterprise: { rate: 0.006, fixedFee: 0.10, monthlyFee: 2000 } // 0.6% + $2k/mo
};

/**
 * Create payment for AI agent service - COMPETITIVE PRICING
 */
router.post('/agent-payments/create', async (req, res) => {
  try {
    const { amount, agentId, serviceDescription, customerWalletAddress, webhookUrl, pricingTier = 'standard' } = req.body;

    if (!amount || !agentId || !serviceDescription) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: amount, agentId, serviceDescription'
      });
    }

    const orderAmount = parseFloat(amount);
    if (orderAmount < 10) {
      return res.status(400).json({
        success: false,
        error: 'Minimum payment amount is $10'
      });
    }

    // Calculate competitive SDK fees
    const tier = PRICING_TIERS[pricingTier] || PRICING_TIERS.standard;
    const platformFee = (orderAmount * tier.rate) + tier.fixedFee;
    const netAmount = orderAmount - platformFee;
    const agentCommission = netAmount; // Agent keeps almost everything after competitive fees

    // Create order in database
    const orderId = nanoid();
    
    await db.insert(aiMarketplaceOrders).values({
      id: orderId,
      agentId,
      customerId: 'sdk-customer-' + nanoid(8), // Generate customer ID for SDK users
      amount: orderAmount.toFixed(2),
      agentCommission: agentCommission.toFixed(2),
      platformFee: platformFee.toFixed(2),
      status: 'pending',
      paymentMethod: 'usdc',
      serviceDescription,
      customerRequirements: JSON.stringify({
        customerWalletAddress,
        webhookUrl,
        createdViaSDK: true
      })
    });

    // TODO: Create Circle wallet address for payment
    // For now, return mock wallet address - implement Circle wallet creation
    const walletAddress = '0x' + nanoid(40); // Mock address

    res.json({
      success: true,
      paymentId: orderId,
      walletAddress,
      amount: orderAmount,
      platformFee: parseFloat(platformFee.toFixed(2)),
      feeRate: `${(tier.rate * 100).toFixed(2)}% + $${tier.fixedFee.toFixed(2)}`,
      netAmount: parseFloat(netAmount.toFixed(2)),
      status: 'pending',
      agentCommission: parseFloat(agentCommission.toFixed(2))
    });

  } catch (error) {
    console.error('Payment creation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Payment creation failed'
    });
  }
});

/**
 * Check payment status
 */
router.get('/agent-payments/status/:paymentId', async (req, res) => {
  try {
    const { paymentId } = req.params;
    
    const order = await db.select().from(aiMarketplaceOrders).where(eq(aiMarketplaceOrders.id, paymentId)).limit(1);
    
    if (!order.length) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }

    const orderData = order[0];
    
    res.json({
      success: true,
      paymentId: orderData.id,
      walletAddress: '0x' + nanoid(40), // Mock - implement Circle wallet lookup
      amount: parseFloat(orderData.amount),
      status: orderData.status,
      transactionHash: orderData.status === 'completed' ? '0x' + nanoid(64) : undefined
    });

  } catch (error) {
    console.error('Payment status check failed:', error);
    res.status(500).json({
      success: false,
      error: 'Status check failed'
    });
  }
});

/**
 * Get agent earnings
 */
router.get('/agent-payments/earnings/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    
    const orders = await db.select().from(aiMarketplaceOrders).where(eq(aiMarketplaceOrders.agentId, agentId));
    
    const completedOrders = orders.filter(order => order.status === 'completed');
    const totalEarnings = completedOrders.reduce((sum, order) => sum + parseFloat(order.amount), 0);
    const platformFee = completedOrders.reduce((sum, order) => sum + parseFloat(order.platformFee), 0);
    const netEarnings = completedOrders.reduce((sum, order) => sum + parseFloat(order.agentCommission), 0);
    
    res.json({
      totalEarnings,
      platformFee,
      netEarnings,
      transactionCount: completedOrders.length
    });

  } catch (error) {
    console.error('Earnings fetch failed:', error);
    res.status(500).json({
      success: false,
      error: 'Earnings fetch failed'
    });
  }
});

/**
 * Withdraw agent earnings
 */
router.post('/agent-payments/withdraw', async (req, res) => {
  try {
    const { agentId, toAddress, amount } = req.body;

    if (!agentId || !toAddress || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: agentId, toAddress, amount'
      });
    }

    // TODO: Implement actual withdrawal via Circle/CDP
    const withdrawalId = nanoid();
    
    res.json({
      success: true,
      paymentId: withdrawalId,
      walletAddress: toAddress,
      amount: parseFloat(amount),
      status: 'pending',
      transactionHash: '0x' + nanoid(64) // Mock transaction hash
    });

  } catch (error) {
    console.error('Withdrawal failed:', error);
    res.status(500).json({
      success: false,
      error: 'Withdrawal failed'
    });
  }
});

/**
 * Setup webhooks
 */
router.post('/agent-payments/webhooks', async (req, res) => {
  try {
    const { webhookUrl } = req.body;

    if (!webhookUrl) {
      return res.status(400).json({
        success: false,
        error: 'Missing webhookUrl'
      });
    }

    // TODO: Store webhook URL and implement webhook notifications
    console.log('Webhook registered:', webhookUrl);
    
    res.json({ success: true });

  } catch (error) {
    console.error('Webhook setup failed:', error);
    res.status(500).json({
      success: false,
      error: 'Webhook setup failed'
    });
  }
});

export default router;