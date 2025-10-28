/**
 * x402 Protocol Payment Routes
 * HTTP 402-based autonomous AI agent payments
 */

import express from 'express';
import { x402PaymentService } from '../services/x402PaymentService';
import { db } from '../db';
import { aiMarketplaceOrders, globalAIAgents } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

const router = express.Router();

/**
 * POST /api/x402/create-payment
 * Create x402 payment for AI agent autonomous payment
 */
router.post('/create-payment', async (req, res) => {
  try {
    const { amount, agentId, serviceDescription, orderId, network, currency, metadata } = req.body;

    // Validate required fields
    if (!amount || !agentId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: amount, agentId',
      });
    }

    // Create x402 payment
    const paymentResult = await x402PaymentService.createPaymentRequest({
      amount: parseFloat(amount),
      agentId,
      serviceDescription: serviceDescription || 'AI Agent Service Payment',
      orderId,
      network: network || 'base',
      currency: currency || 'USDC',
      metadata,
    });

    if (!paymentResult.success) {
      return res.status(400).json(paymentResult);
    }

    // Return x402 payment details
    res.json(paymentResult);
  } catch (error: any) {
    console.error('x402 payment creation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Payment creation failed',
    });
  }
});

/**
 * POST /api/x402/verify
 * Verify x402 payment completion with payment proof
 */
router.post('/verify', async (req, res) => {
  try {
    const { paymentId, paymentProof } = req.body;

    if (!paymentId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: paymentId',
      });
    }

    // Verify payment
    const verificationResult = await x402PaymentService.verifyPayment(paymentId, paymentProof);

    res.json(verificationResult);
  } catch (error: any) {
    console.error('x402 payment verification failed:', error);
    res.status(500).json({
      success: false,
      error: 'Payment verification failed',
    });
  }
});

/**
 * GET /api/x402/payment/:id/status
 * Get x402 payment status
 */
router.get('/payment/:id/status', async (req, res) => {
  try {
    const { id } = req.params;

    const statusResult = await x402PaymentService.getPaymentStatus(id);

    if (!statusResult.success && statusResult.error === 'Payment not found') {
      return res.status(404).json(statusResult);
    }

    res.json(statusResult);
  } catch (error: any) {
    console.error('x402 payment status fetch failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payment status',
    });
  }
});

/**
 * GET /api/x402/analytics
 * Get x402 payment analytics for platform
 */
router.get('/analytics', async (req, res) => {
  try {
    const analytics = await x402PaymentService.getAnalytics();
    
    res.json({
      success: true,
      data: analytics,
    });
  } catch (error: any) {
    console.error('x402 analytics fetch failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics',
    });
  }
});

/**
 * POST /api/x402/agent-service-payment
 * Integrated endpoint: Create marketplace order + x402 payment in one call
 */
router.post('/agent-service-payment', async (req, res) => {
  try {
    const { amount, agentId, serviceDescription, network, currency } = req.body;

    if (!amount || !agentId || !serviceDescription) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: amount, agentId, serviceDescription',
      });
    }

    const orderAmount = parseFloat(amount);

    // Ensure agent exists (auto-register if needed)
    const existingAgent = await db
      .select()
      .from(globalAIAgents)
      .where(eq(globalAIAgents.id, agentId))
      .limit(1);

    if (!existingAgent.length) {
      await db.insert(globalAIAgents).values({
        id: agentId,
        agentName: `x402 Agent: ${agentId}`,
        description: 'AI agent registered via x402 protocol',
        capabilities: ['Autonomous Payments', 'x402 Integration'],
        primaryWalletAddress: '0x' + nanoid(40),
        publicKey: 'X402_' + nanoid(32),
        signature: 'X402_AUTO_REGISTERED',
        status: 'active',
        reputation: '0.0',
        preferredCurrencies: ['USDC'],
      });
      console.log(`✅ Auto-registered x402 agent: ${agentId}`);
    }

    // Create marketplace order
    const orderId = nanoid();
    const agentCommission = orderAmount * 0.85; // 85% to agent
    const platformFee = orderAmount * 0.15; // 15% platform fee

    await db.insert(aiMarketplaceOrders).values({
      id: orderId,
      agentId,
      customerId: 'x402-autonomous', // x402 payments are autonomous
      amount: orderAmount.toFixed(2),
      agentCommission: agentCommission.toFixed(2),
      platformFee: platformFee.toFixed(2),
      status: 'pending',
      paymentMethod: 'x402',
      serviceDescription,
      customerRequirements: JSON.stringify({
        protocol: 'x402',
        autonomous: true,
        createdAt: new Date().toISOString(),
      }),
    });

    // Create x402 payment
    const paymentResult = await x402PaymentService.createPaymentRequest({
      amount: orderAmount,
      agentId,
      serviceDescription,
      orderId,
      network: network || 'base',
      currency: currency || 'USDC',
      metadata: {
        marketplaceOrder: true,
        orderCreated: new Date().toISOString(),
      },
    });

    if (!paymentResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Failed to create x402 payment',
        details: paymentResult.error,
      });
    }

    res.json({
      success: true,
      orderId,
      payment: paymentResult,
      agentCommission: parseFloat(agentCommission.toFixed(2)),
      platformFee: parseFloat(platformFee.toFixed(2)),
    });
  } catch (error: any) {
    console.error('x402 agent service payment failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create agent service payment',
    });
  }
});

export default router;
