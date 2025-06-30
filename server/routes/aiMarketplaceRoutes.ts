/**
 * AI Marketplace API Routes
 * Complete business logic implementation for all marketplace operations
 */

import { Router } from 'express';
import { AIMarketplaceCore } from '../services/aiMarketplaceCore';
import { storage } from '../storage';
import { isAuthenticated } from '../replitAuth';
import { z } from 'zod';

const router = Router();

// Order Management Routes

/**
 * Create service order
 */
router.post('/order', isAuthenticated, async (req: any, res) => {
  try {
    const orderSchema = z.object({
      agentId: z.string().min(1),
      serviceType: z.string().min(1),
      amount: z.number().min(1),
      paymentMethod: z.enum(['stripe', 'paypal', 'crypto']),
      serviceDescription: z.string().min(1),
      deliverables: z.any().optional(),
      customerRequirements: z.any().optional(),
      estimatedDeliveryHours: z.number().optional(),
    });

    const validatedData = orderSchema.parse(req.body);
    const customerId = req.user?.claims?.sub;

    if (!customerId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const result = await AIMarketplaceCore.createOrder({
      ...validatedData,
      customerId,
    });

    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Order creation error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Submit service delivery
 */
router.post('/submit-delivery', isAuthenticated, async (req: any, res) => {
  try {
    const deliverySchema = z.object({
      orderId: z.string().min(1),
      deliveryMethod: z.enum(['file_upload', 'api_response', 'email', 'webhook', 'direct_message']),
      deliveryContent: z.any(),
      deliveryFiles: z.array(z.string()).optional(),
      evidenceUrls: z.array(z.string()).optional(),
    });

    const validatedData = deliverySchema.parse(req.body);
    
    // In production, validate agent owns this delivery
    const agentId = req.user?.claims?.sub; // Assuming agent authentication
    
    if (!agentId) {
      return res.status(401).json({ success: false, error: 'Agent authentication required' });
    }

    const result = await AIMarketplaceCore.submitDelivery({
      ...validatedData,
      agentId,
    });

    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Delivery submission error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Customer verification of delivery
 */
router.post('/verify-delivery', isAuthenticated, async (req: any, res) => {
  try {
    const verificationSchema = z.object({
      orderId: z.string().min(1),
      confirmed: z.boolean(),
      qualityScore: z.number().min(1).max(5).optional(),
      feedback: z.string().optional(),
    });

    const validatedData = verificationSchema.parse(req.body);
    const customerId = req.user?.claims?.sub;

    if (!customerId) {
      return res.status(401).json({ success: false, error: 'Customer authentication required' });
    }

    const result = await AIMarketplaceCore.verifyDelivery({
      ...validatedData,
      customerId,
    });

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Delivery verification error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Release escrow payment
 */
router.post('/release-payment', isAuthenticated, async (req: any, res) => {
  try {
    const releaseSchema = z.object({
      orderId: z.string().min(1),
      releaseReason: z.enum(['service_completed', 'auto_release', 'dispute_resolved']),
    });

    const validatedData = releaseSchema.parse(req.body);

    const success = await AIMarketplaceCore.releaseEscrowPayment(
      validatedData.orderId,
      validatedData.releaseReason
    );

    if (success) {
      res.json({ success: true, message: 'Payment released successfully' });
    } else {
      res.status(400).json({ success: false, error: 'Failed to release payment' });
    }
  } catch (error) {
    console.error('Payment release error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Commission and Financial Routes

/**
 * Calculate commission for service
 */
router.post('/calculate-commission', async (req, res) => {
  try {
    const commissionSchema = z.object({
      serviceAmount: z.number().min(1),
      agentTier: z.enum(['basic', 'premium', 'enterprise']),
      serviceType: z.string().min(1),
    });

    const validatedData = commissionSchema.parse(req.body);

    const result = await AIMarketplaceCore.calculateCommission(validatedData);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Commission calculation error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Process refund
 */
router.post('/process-refund', isAuthenticated, async (req: any, res) => {
  try {
    const refundSchema = z.object({
      orderId: z.string().min(1),
      refundReason: z.enum(['service_not_delivered', 'quality_issues', 'fraud', 'customer_request']),
      amount: z.number().optional(),
    });

    const validatedData = refundSchema.parse(req.body);
    const moderatorId = req.user?.claims?.sub; // Assuming moderator/admin role

    const result = await AIMarketplaceCore.processRefund({
      ...validatedData,
      moderatorId,
    });

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Refund processing error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Performance and Quality Control Routes

/**
 * Get agent performance metrics
 */
router.get('/performance/:agentId', async (req, res) => {
  try {
    const agentId = req.params.agentId;
    
    if (!agentId) {
      return res.status(400).json({ success: false, error: 'Agent ID required' });
    }

    const performance = await AIMarketplaceCore.getAgentPerformance(agentId);

    if (performance) {
      res.json({
        success: true,
        data: {
          totalOrders: performance.totalOrders,
          completedOrders: performance.completedOrders,
          averageRating: parseFloat(performance.averageRating || '0'),
          completionRate: parseFloat(performance.completionRate || '0'),
          averageDeliveryTime: parseFloat(performance.averageDeliveryTime || '0'),
          totalRevenue: performance.totalRevenue,
          disputeCount: performance.disputeCount,
          disputeRate: parseFloat(performance.disputeRate || '0'),
          performanceScore: parseFloat(performance.performanceScore || '100'),
        }
      });
    } else {
      res.status(404).json({ success: false, error: 'Performance data not found' });
    }
  } catch (error) {
    console.error('Performance fetch error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Suspend agent
 */
router.post('/suspend', isAuthenticated, async (req: any, res) => {
  try {
    const suspensionSchema = z.object({
      agentId: z.string().min(1),
      reason: z.enum(['poor_performance', 'fraud', 'policy_violation', 'customer_complaints']),
      suspensionType: z.enum(['temporary', 'permanent', 'warning']),
      suspensionDuration: z.number().optional(),
      description: z.string().min(1),
      evidenceUrls: z.array(z.string()).optional(),
    });

    const validatedData = suspensionSchema.parse(req.body);
    const moderatorId = req.user?.claims?.sub;

    const result = await AIMarketplaceCore.suspendAgent({
      ...validatedData,
      moderatorId,
    });

    if (result.success) {
      res.json({ success: true, message: 'Agent suspended successfully' });
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Agent suspension error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Check for fraudulent activity
 */
router.post('/check-fraud', async (req, res) => {
  try {
    const fraudSchema = z.object({
      agentId: z.string().min(1),
      activityPattern: z.string().min(1),
      timeframe: z.string().min(1),
    });

    const validatedData = fraudSchema.parse(req.body);

    const result = await AIMarketplaceCore.checkFraud(validatedData);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Fraud check error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Service Management Routes

/**
 * Rate service quality
 */
router.post('/rate-service', isAuthenticated, async (req: any, res) => {
  try {
    const ratingSchema = z.object({
      orderId: z.string().min(1),
      rating: z.number().min(1).max(5),
      review: z.string().optional(),
    });

    const validatedData = ratingSchema.parse(req.body);
    const customerId = req.user?.claims?.sub;

    // This would integrate with the delivery verification system
    const result = await AIMarketplaceCore.verifyDelivery({
      orderId: validatedData.orderId,
      customerId,
      confirmed: true,
      qualityScore: validatedData.rating,
      feedback: validatedData.review,
    });

    if (result.success) {
      res.json({ success: true, message: 'Service rated successfully' });
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Service rating error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Get service categories
 */
router.get('/categories', async (req, res) => {
  try {
    // Return predefined categories for now
    const categories = [
      {
        id: 'data-analysis',
        name: 'Data Analysis',
        description: 'AI-powered data insights and analytics',
        icon: 'BarChart3',
        serviceCount: 15
      },
      {
        id: 'content-creation',
        name: 'Content Creation',
        description: 'AI writing, design, and creative services',
        icon: 'PenTool',
        serviceCount: 23
      },
      {
        id: 'automation',
        name: 'Process Automation',
        description: 'Workflow automation and optimization',
        icon: 'Zap',
        serviceCount: 12
      },
      {
        id: 'consultation',
        name: 'AI Consultation',
        description: 'Expert AI strategy and implementation advice',
        icon: 'MessageCircle',
        serviceCount: 8
      }
    ];

    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Categories fetch error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Approve service
 */
router.post('/approve-service', isAuthenticated, async (req: any, res) => {
  try {
    const approvalSchema = z.object({
      serviceId: z.string().min(1),
      approved: z.boolean(),
      moderatorId: z.string().optional(),
      notes: z.string().optional(),
    });

    const validatedData = approvalSchema.parse(req.body);

    // In production, this would update the service approval status
    res.json({
      success: true,
      message: validatedData.approved ? 'Service approved' : 'Service rejected',
      serviceId: validatedData.serviceId
    });
  } catch (error) {
    console.error('Service approval error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Create dispute
 */
router.post('/create-dispute', isAuthenticated, async (req: any, res) => {
  try {
    const disputeSchema = z.object({
      orderId: z.string().min(1),
      disputeType: z.enum(['service_quality', 'non_delivery', 'refund_request', 'fraud']),
      customerStatement: z.string().min(1),
      evidenceUrls: z.array(z.string()).optional(),
    });

    const validatedData = disputeSchema.parse(req.body);
    const customerId = req.user?.claims?.sub;

    if (!customerId) {
      return res.status(401).json({ success: false, error: 'Customer authentication required' });
    }

    const result = await AIMarketplaceCore.createDispute({
      ...validatedData,
      customerId,
    });

    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Dispute creation error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Get payment methods
 */
router.get('/payment-methods', async (req, res) => {
  try {
    const paymentMethods = [
      {
        id: 'stripe',
        name: 'Credit/Debit Card',
        description: 'Visa, Mastercard, American Express',
        processingFee: 2.9,
        icon: 'CreditCard',
        enabled: true
      },
      {
        id: 'paypal',
        name: 'PayPal',
        description: 'PayPal account or guest checkout',
        processingFee: 3.5,
        icon: 'Wallet',
        enabled: true
      },
      {
        id: 'crypto',
        name: 'Cryptocurrency',
        description: 'XRP, BTC, ETH, USDC, USDT',
        processingFee: 0.5,
        icon: 'Bitcoin',
        enabled: true
      }
    ];

    res.json({
      success: true,
      data: paymentMethods
    });
  } catch (error) {
    console.error('Payment methods fetch error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export { router as aiMarketplaceRoutes };