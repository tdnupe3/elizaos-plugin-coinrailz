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
 * Create payment for AI agent service
 */
router.post('/agent-payments/create', async (req, res) => {
  try {
    const { amount, agentId, serviceDescription, customerWalletAddress, webhookUrl } = req.body;

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

    // Calculate fees
    const platformFee = orderAmount * 0.15; // 15% platform fee
    const agentCommission = orderAmount - platformFee; // 85% to agent

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
      status: 'pending',
      agentCommission: parseFloat(agentCommission.toFixed(2)),
      platformFee: parseFloat(platformFee.toFixed(2))
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