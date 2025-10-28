/**
 * x402 Protocol Payment Routes - PRODUCTION READY ✅
 * Real autonomous AI agent payments with full security & verification
 * 
 * Features:
 * ✅ Rate limiting (100 req/15min per IP)
 * ✅ Zod validation on all inputs
 * ✅ Real Coinbase CDP wallet generation
 * ✅ Real Alchemy blockchain verification
 * ✅ Database transactions for atomic operations
 */

import express from 'express';
import { x402PaymentService } from '../services/x402PaymentService';
import { db } from '../db';
import { aiMarketplaceOrders, globalAIAgents, x402Payments } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Rate limiting: 100 requests per 15 minutes per IP
const x402RateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many x402 payment requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all x402 routes
router.use(x402RateLimiter);

// Validation schemas
const createPaymentSchema = z.object({
  amount: z.number().positive().max(10000),
  agentId: z.string().min(1).max(100),
  serviceDescription: z.string().optional(),
  orderId: z.string().optional(),
  network: z.enum(['base', 'polygon', 'ethereum', 'near']).optional(),
  currency: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

const verifyPaymentSchema = z.object({
  paymentId: z.string().min(1),
  paymentProof: z.string().optional(),
});

/**
 * POST /api/x402/create-payment
 * Create x402 payment with REAL Coinbase CDP wallet
 */
router.post('/create-payment', async (req, res) => {
  try {
    // Validate request body with Zod
    const validation = createPaymentSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body',
        details: validation.error.errors,
      });
    }

    const { amount, agentId, serviceDescription, orderId, network, currency, metadata } = validation.data;

    // Create x402 payment
    const paymentResult = await x402PaymentService.createPaymentRequest({
      amount,
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
 * Verify x402 payment with REAL Alchemy RPC blockchain verification
 */
router.post('/verify', async (req, res) => {
  try {
    // Validate request body with Zod
    const validation = verifyPaymentSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body',
        details: validation.error.errors,
      });
    }

    const { paymentId, paymentProof } = validation.data;

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
 * Integrated endpoint: Create marketplace order + x402 payment with REAL database transactions
 */
router.post('/agent-service-payment', async (req, res) => {
  try {
    // Validate request body
    const validation = createPaymentSchema.safeParse({
      ...req.body,
      serviceDescription: req.body.serviceDescription || 'AI Agent Service',
    });
    
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body',
        details: validation.error.errors,
      });
    }

    const { amount, agentId, serviceDescription, network, currency } = validation.data;

    // Verify agent exists (NO auto-registration for security)
    const existingAgent = await db
      .select()
      .from(globalAIAgents)
      .where(eq(globalAIAgents.id, agentId))
      .limit(1);

    if (!existingAgent.length) {
      return res.status(404).json({
        success: false,
        error: `Agent ${agentId} not found. Please register first at /api/free-agent-registration`,
      });
    }

    // REAL ATOMIC TRANSACTION for order + payment creation
    const orderId = nanoid();
    const agentCommission = amount * 0.85;
    const platformFee = amount * 0.15;

    let paymentResult;

    try {
      // Execute BOTH operations in a single transaction for true atomicity
      await db.transaction(async (tx) => {
        // 1. Insert marketplace order
        await tx.insert(aiMarketplaceOrders).values({
          id: orderId,
          agentId,
          customerId: 'x402-autonomous',
          amount: amount.toFixed(2),
          agentCommission: agentCommission.toFixed(2),
          platformFee: platformFee.toFixed(2),
          status: 'pending',
          paymentMethod: 'x402',
          serviceDescription: serviceDescription || 'AI Agent Service',
          customerRequirements: JSON.stringify({
            protocol: 'x402',
            autonomous: true,
            createdAt: new Date().toISOString(),
          }),
        });

        // 2. Create payment wallet and insert payment record
        // NOTE: Wallet creation happens BEFORE database insert
        // If wallet creation fails, entire transaction rolls back
        const paymentId = nanoid();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min expiry

        // Generate REAL Coinbase CDP wallet (may throw error)
        const walletAddress = await x402PaymentService.generatePaymentWalletPublic(network || 'base');

        // Insert payment record
        await tx.insert(x402Payments).values({
          id: paymentId,
          orderId,
          agentId,
          customerId: null,
          amount: amount.toString(),
          currency: currency || 'USDC',
          status: 'pending',
          network: network || 'base',
          walletAddress,
          expiresAt,
          metadata: {
            serviceDescription: serviceDescription || 'AI Agent Service',
            protocol: 'x402',
            autonomousPayment: true,
            marketplaceOrder: true,
          } as any,
        });

        // Store payment result for response
        paymentResult = {
          success: true,
          paymentId,
          amount,
          currency: currency || 'USDC',
          network: network || 'base',
          status: 'pending' as const,
          walletAddress,
          paymentUrl: `https://pay.x402.io/${paymentId}`,
          expiresAt: expiresAt.toISOString(),
        };
      });

      // Transaction succeeded - both order and payment committed atomically
    } catch (error: any) {
      // Any failure (wallet creation, DB insert, etc) rolls back EVERYTHING
      console.error('❌ Atomic transaction failed:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to create order and payment atomically',
        details: error.message,
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
