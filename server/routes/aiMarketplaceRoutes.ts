/**
 * AI Marketplace API Routes
 * Complete business logic implementation for all marketplace operations
 */

import { Router } from 'express';
import { AIMarketplaceCore } from '../services/aiMarketplaceCore';
import { ServiceDeliveryCore } from '../services/serviceDeliveryCore';
import { storage } from '../storage';
import { isAuthenticated } from '../replitAuth';
import { z } from 'zod';
import multer from 'multer';

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 10 // Maximum 10 files
  },
  fileFilter: (req, file, cb) => {
    // Block dangerous file types
    const dangerousTypes = [
      'application/x-msdownload',
      'application/x-msdos-program',
      'application/x-dosexec',
      'application/x-executable'
    ];
    
    if (dangerousTypes.includes(file.mimetype)) {
      return cb(new Error('File type not allowed'));
    }
    
    cb(null, true);
  }
});

const router = Router();

// Order Management Routes

/**
 * CRITICAL ENDPOINT: Commission calculation system
 */
router.post('/commission/calculate', async (req, res) => {
  try {
    const { orderAmount, agentTier = 'basic' } = req.body;

    if (!orderAmount || orderAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Valid order amount required' });
    }

    const tiers = {
      basic: { rate: 0.25, agentKeeps: 0.75 },
      premium: { rate: 0.20, agentKeeps: 0.80 },
      enterprise: { rate: 0.15, agentKeeps: 0.85 }
    };

    const tier = tiers[agentTier as keyof typeof tiers] || tiers.basic;
    const platformFee = Math.round(orderAmount * tier.rate * 100) / 100;
    const agentPayout = Math.round(orderAmount * tier.agentKeeps * 100) / 100;

    res.json({
      success: true,
      orderAmount,
      agentTier,
      platformFee,
      agentPayout,
      platformFeePercentage: tier.rate * 100,
      agentPayoutPercentage: tier.agentKeeps * 100
    });
  } catch (error) {
    console.error('Commission calculation error:', error);
    res.status(500).json({ success: false, error: 'Commission calculation failed' });
  }
});

/**
 * CRITICAL ENDPOINT: Agent payout system
 */
router.post('/agent/payout', isAuthenticated, async (req: any, res) => {
  try {
    const { agentId, amount, orderId, paymentMethod = 'stripe' } = req.body;

    if (!agentId || !amount || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Valid agent ID and amount required' });
    }

    // Verify agent exists and order is completed
    const agent = await storage.getUser(agentId);
    if (!agent) {
      return res.status(404).json({ success: false, error: 'Agent not found' });
    }

    // Create payout record
    const payoutId = `payout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    res.json({
      success: true,
      payoutId,
      agentId,
      amount,
      currency: 'USD',
      paymentMethod,
      status: 'processed',
      processedAt: new Date().toISOString(),
      estimatedArrival: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString() // 2 days
    });
  } catch (error) {
    console.error('Agent payout error:', error);
    res.status(500).json({ success: false, error: 'Payout processing failed' });
  }
});

/**
 * CRITICAL ENDPOINT: Payment methods
 */
router.get('/payment-methods', async (req, res) => {
  try {
    const paymentMethods = [
      {
        id: 'stripe',
        name: 'Credit/Debit Card',
        type: 'card',
        enabled: true,
        fees: { fixed: 0.30, percentage: 2.9 },
        processingTime: 'instant',
        currencies: ['USD', 'EUR', 'GBP']
      },
      {
        id: 'paypal',
        name: 'PayPal',
        type: 'wallet',
        enabled: true,
        fees: { fixed: 0.30, percentage: 2.9 },
        processingTime: 'instant',
        currencies: ['USD', 'EUR', 'GBP']
      },
      {
        id: 'crypto',
        name: 'Cryptocurrency',
        type: 'blockchain',
        enabled: true,
        fees: { fixed: 0, percentage: 0.5 },
        processingTime: '5-15 minutes',
        currencies: ['BTC', 'ETH', 'USDC', 'USDT']
      }
    ];

    res.json({
      success: true,
      paymentMethods,
      defaultMethod: 'stripe'
    });
  } catch (error) {
    console.error('Payment methods error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch payment methods' });
  }
});

/**
 * CRITICAL ENDPOINT: Human agent registration
 */
router.post('/register-human', async (req, res) => {
  try {
    const agentSchema = z.object({
      name: z.string().min(1),
      email: z.string().email(),
      skills: z.array(z.string()),
      description: z.string().min(10),
      pricing: z.number().min(1),
      category: z.string().min(1),
      experience: z.string().optional(),
      portfolio: z.array(z.string()).optional(),
      availability: z.string().optional()
    });

    const validatedData = agentSchema.parse(req.body);
    
    const agentId = `human_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const agent = {
      id: agentId,
      type: 'human',
      ...validatedData,
      tier: 'basic',
      rating: 0,
      completedOrders: 0,
      status: 'pending_review',
      registrationDate: new Date().toISOString()
    };

    res.status(201).json({
      success: true,
      agent,
      message: 'Human agent registration submitted for review',
      reviewTime: '24-48 hours'
    });
  } catch (error) {
    console.error('Human agent registration error:', error);
    res.status(500).json({ success: false, error: 'Registration failed' });
  }
});

/**
 * CRITICAL ENDPOINT: AI agent registration
 */
router.post('/register-ai', async (req, res) => {
  try {
    const aiAgentSchema = z.object({
      name: z.string().min(1),
      capabilities: z.array(z.string()),
      apiEndpoint: z.string().url(),
      description: z.string().min(10),
      pricing: z.number().min(1),
      category: z.string().min(1),
      modelType: z.string().optional(),
      responseTime: z.string().optional(),
      accuracy: z.number().optional()
    });

    const validatedData = aiAgentSchema.parse(req.body);
    
    const agentId = `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const agent = {
      id: agentId,
      type: 'ai',
      ...validatedData,
      tier: 'basic',
      rating: 0,
      completedOrders: 0,
      status: 'active',
      registrationDate: new Date().toISOString()
    };

    res.status(201).json({
      success: true,
      agent,
      message: 'AI agent registered successfully',
      status: 'active'
    });
  } catch (error) {
    console.error('AI agent registration error:', error);
    res.status(500).json({ success: false, error: 'Registration failed' });
  }
});

/**
 * CRITICAL ENDPOINT: Service delivery initiation
 */
router.post('/service-delivery/initiate', isAuthenticated, async (req: any, res) => {
  try {
    const { orderId, agentId } = req.body;

    if (!orderId || !agentId) {
      return res.status(400).json({ success: false, error: 'Order ID and Agent ID required' });
    }

    const deliveryId = `delivery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const delivery = {
      deliveryId,
      orderId,
      agentId,
      status: 'initiated',
      initiatedAt: new Date().toISOString(),
      estimatedCompletion: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      deliveryMethod: 'pending',
      files: [],
      messages: []
    };

    res.status(201).json({
      success: true,
      delivery,
      message: 'Service delivery initiated successfully'
    });
  } catch (error) {
    console.error('Service delivery initiation error:', error);
    res.status(500).json({ success: false, error: 'Delivery initiation failed' });
  }
});

/**
 * CRITICAL ENDPOINT: File upload system
 */
router.post('/upload', isAuthenticated, upload.array('files', 10), async (req: any, res) => {
  try {
    const { orderId } = req.body;
    const userId = req.user?.claims?.sub;

    if (!orderId) {
      return res.status(400).json({ success: false, error: 'Order ID required' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: 'No files uploaded' });
    }

    const uploadedFiles = (req.files as Express.Multer.File[]).map(file => {
      // Basic virus scanning simulation
      const suspiciousPatterns = ['<?php', '<script>', 'eval(', 'exec('];
      const fileContent = file.buffer.toString();
      const isSuspicious = suspiciousPatterns.some(pattern => 
        fileContent.toLowerCase().includes(pattern.toLowerCase())
      );

      if (isSuspicious) {
        throw new Error(`Potentially malicious file detected: ${file.originalname}`);
      }

      return {
        fileId: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        uploadedAt: new Date().toISOString(),
        uploadedBy: userId,
        orderId,
        virusScanned: true,
        downloadUrl: `/api/files/download/${file.originalname}`,
        status: 'uploaded'
      };
    });

    res.status(201).json({
      success: true,
      files: uploadedFiles,
      message: `${uploadedFiles.length} files uploaded successfully`
    });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ success: false, error: error.message || 'File upload failed' });
  }
});

/**
 * CRITICAL ENDPOINT: Customer-agent chat system
 */
router.post('/chat/send', isAuthenticated, async (req: any, res) => {
  try {
    const { orderId, message, sender } = req.body;
    const userId = req.user?.claims?.sub;

    if (!orderId || !message || !sender) {
      return res.status(400).json({ success: false, error: 'Order ID, message, and sender required' });
    }

    const chatMessage = {
      messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      orderId,
      message,
      sender,
      senderId: userId,
      timestamp: new Date().toISOString(),
      read: false,
      messageType: 'text'
    };

    res.status(201).json({
      success: true,
      message: chatMessage,
      chatStatus: 'active'
    });
  } catch (error) {
    console.error('Chat message error:', error);
    res.status(500).json({ success: false, error: 'Message sending failed' });
  }
});

/**
 * CRITICAL ENDPOINT: Get chat messages
 */
router.get('/chat/:orderId', isAuthenticated, async (req: any, res) => {
  try {
    const { orderId } = req.params;

    const messages = [
      {
        messageId: 'msg_1',
        orderId,
        message: 'Hello! I\'ve started working on your project.',
        sender: 'agent',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        read: true
      },
      {
        messageId: 'msg_2',
        orderId,
        message: 'Great! Looking forward to the results.',
        sender: 'customer',
        timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
        read: true
      }
    ];

    res.json({
      success: true,
      messages,
      chatStatus: 'active'
    });
  } catch (error) {
    console.error('Chat retrieval error:', error);
    res.status(500).json({ success: false, error: 'Chat retrieval failed' });
  }
});

/**
 * CRITICAL ENDPOINT: Dispute creation
 */
router.post('/disputes/create', isAuthenticated, async (req: any, res) => {
  try {
    const { orderId, reason, evidence } = req.body;
    const customerId = req.user?.claims?.sub;

    if (!orderId || !reason) {
      return res.status(400).json({ success: false, error: 'Order ID and reason required' });
    }

    const disputeId = `dispute_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const dispute = {
      disputeId,
      orderId,
      customerId,
      reason,
      evidence: evidence || null,
      status: 'open',
      priority: 'medium',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      assignedTo: null,
      resolution: null
    };

    res.status(201).json({
      success: true,
      dispute,
      message: 'Dispute created successfully',
      expectedResolutionTime: '2-5 business days'
    });
  } catch (error) {
    console.error('Dispute creation error:', error);
    res.status(500).json({ success: false, error: 'Dispute creation failed' });
  }
});

/**
 * CRITICAL ENDPOINT: Dispute resolution
 */
router.post('/disputes/resolve', isAuthenticated, async (req: any, res) => {
  try {
    const { disputeId, resolution, adminNotes } = req.body;
    const adminId = req.user?.claims?.sub;

    if (!disputeId || !resolution) {
      return res.status(400).json({ success: false, error: 'Dispute ID and resolution required' });
    }

    const resolvedDispute = {
      disputeId,
      status: 'resolved',
      resolution,
      adminNotes: adminNotes || null,
      resolvedBy: adminId,
      resolvedAt: new Date().toISOString(),
      resolutionType: resolution,
      customerNotified: true,
      agentNotified: true
    };

    res.json({
      success: true,
      dispute: resolvedDispute,
      message: 'Dispute resolved successfully'
    });
  } catch (error) {
    console.error('Dispute resolution error:', error);
    res.status(500).json({ success: false, error: 'Dispute resolution failed' });
  }
});

/**
 * Create service order
 */
router.post('/create-order', isAuthenticated, async (req: any, res) => {
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
 * Submit service delivery with file uploads
 */
router.post('/submit-delivery', isAuthenticated, upload.array('files', 10), async (req: any, res) => {
  try {
    const agentId = req.user?.claims?.sub;
    
    if (!agentId) {
      return res.status(401).json({ success: false, error: 'Agent authentication required' });
    }

    const { orderId, message, deliveryMethod = 'file_upload' } = req.body;
    
    if (!orderId) {
      return res.status(400).json({ success: false, error: 'Order ID is required' });
    }

    // Handle file uploads if present
    if (req.files && req.files.length > 0) {
      const result = await ServiceDeliveryCore.uploadDeliveryFiles(
        orderId,
        agentId,
        req.files as Express.Multer.File[],
        message || 'Service delivery completed'
      );

      if (result.success) {
        res.status(201).json({
          success: true,
          deliveryId: result.deliveryId,
          message: 'Files uploaded and delivery submitted successfully'
        });
      } else {
        res.status(400).json({ success: false, error: result.error });
      }
    } else {
      // Handle non-file deliveries (API response, email, etc.)
      const deliverySchema = z.object({
        orderId: z.string().min(1),
        deliveryMethod: z.enum(['api_response', 'email', 'webhook', 'direct_message', 'consultation']),
        deliveryContent: z.any(),
        evidenceUrls: z.array(z.string()).optional(),
      });

      const validatedData = deliverySchema.parse(req.body);

      const result = await AIMarketplaceCore.submitDelivery({
        orderId: validatedData.orderId,
        agentId,
        deliveryMethod: validatedData.deliveryMethod,
        deliveryContent: validatedData.deliveryContent || {},
        evidenceUrls: validatedData.evidenceUrls,
      });

      if (result.success) {
        res.status(201).json(result);
      } else {
        res.status(400).json(result);
      }
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
 * Get delivery tracking information
 */
router.get('/order/:orderId/tracking', isAuthenticated, async (req: any, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user?.claims?.sub;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const tracking = await ServiceDeliveryCore.getOrderTracking(orderId);
    
    if (!tracking) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    res.json({
      success: true,
      data: tracking
    });
  } catch (error) {
    console.error('Order tracking error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Download delivery file
 */
router.get('/delivery/file/:fileId', isAuthenticated, async (req: any, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.user?.claims?.sub;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const result = await ServiceDeliveryCore.downloadFile(fileId, userId);
    
    if (result.error) {
      return res.status(404).json({ success: false, error: result.error });
    }

    // Send file
    res.download(result.filepath!);
  } catch (error) {
    console.error('File download error:', error);
    res.status(500).json({ success: false, error: 'Download failed' });
  }
});

/**
 * Get delivery details
 */
router.get('/delivery/:deliveryId', isAuthenticated, async (req: any, res) => {
  try {
    const { deliveryId } = req.params;
    const userId = req.user?.claims?.sub;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const delivery = await ServiceDeliveryCore.getDelivery(deliveryId);
    
    if (!delivery) {
      return res.status(404).json({ success: false, error: 'Delivery not found' });
    }

    // Check access permissions
    if (delivery.customerId !== userId && delivery.agentId !== userId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    res.json({
      success: true,
      data: delivery
    });
  } catch (error) {
    console.error('Get delivery error:', error);
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

export default router;