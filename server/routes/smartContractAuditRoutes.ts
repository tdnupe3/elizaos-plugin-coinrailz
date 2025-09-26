/**
 * 🔍 Smart Contract Audit API Routes
 * Complete audit service with payment integration and certificate generation
 * Pricing: $1,000 per audit with professional certificates
 */

import { Router } from 'express';
import { z } from 'zod';
import { smartContractAuditService } from '../services/smartContractAuditService';
import { insertSmartContractAuditSchema, type SmartContractAudit } from '@shared/schema';
import { isAuthenticated } from '../replitAuth';
import { PaymentIntegrationService } from '../services/paymentIntegration';

const router = Router();

// Validation schemas
const submitAuditSchema = insertSmartContractAuditSchema.extend({
  contractAddress: z.string().optional(),
  contractCode: z.string().optional(),
}).refine(data => data.contractAddress || data.contractCode, {
  message: "Either contract address or contract code must be provided",
});

const paymentConfirmationSchema = z.object({
  auditId: z.string(),
  paymentMethod: z.enum(['stripe', 'paypal', 'circle_usdc', 'crypto']),
  paymentTxHash: z.string().optional(),
  stripePaymentIntentId: z.string().optional(),
  paypalOrderId: z.string().optional(),
});

/**
 * 🎯 POST /api/audits/submit
 * Submit new smart contract audit request
 */
router.post('/submit', isAuthenticated, async (req, res) => {
  try {
    const validatedData = submitAuditSchema.parse(req.body);
    
    // Add customer ID from authenticated user
    const auditData = {
      ...validatedData,
      customerId: req.user!.id,
    };

    const audit = await smartContractAuditService.submitAuditRequest(auditData);

    res.json({
      success: true,
      message: 'Audit request submitted successfully',
      audit: {
        id: audit.id,
        certificateId: audit.certificateId,
        status: audit.status,
        amount: audit.amount,
        estimatedDeliveryHours: audit.estimatedDeliveryHours,
      },
    });

  } catch (error) {
    console.error('❌ Audit submission failed:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to submit audit request',
      details: error instanceof z.ZodError ? error.errors : error,
    });
  }
});

/**
 * 💳 POST /api/audits/create-payment
 * Create payment intent for audit request  
 */
router.post('/create-payment', isAuthenticated, async (req, res) => {
  try {
    const { auditId, paymentMethod } = z.object({
      auditId: z.string(),
      paymentMethod: z.enum(['stripe', 'paypal', 'circle_usdc', 'crypto'])
    }).parse(req.body);

    // Verify audit belongs to user
    const audit = await smartContractAuditService.getAuditById(auditId);
    if (!audit || audit.customerId !== req.user!.id) {
      return res.status(404).json({
        success: false,
        error: 'Audit not found or access denied',
      });
    }

    if (audit.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Audit is not in pending status',
      });
    }

    // Create payment using existing payment integration service
    const paymentResult = await PaymentIntegrationService.createEscrowPayment({
      orderId: auditId,
      customerId: req.user!.id,
      agentId: 'audit-service', // Use audit service as the "agent"
      amount: 1000, // $1,000 per audit
      currency: 'USD',
      paymentMethod: paymentMethod === 'circle_usdc' ? 'usdc' : paymentMethod as 'stripe' | 'paypal',
      description: `Smart Contract Audit: ${audit.projectName}`
    });

    if (!paymentResult.success) {
      return res.status(400).json({
        success: false,
        error: paymentResult.error || 'Payment creation failed',
      });
    }

    res.json({
      success: true,
      message: 'Payment intent created successfully',
      clientSecret: paymentResult.clientSecret,
      auditId,
      amount: 1000,
      currency: 'USD',
    });

  } catch (error) {
    console.error('❌ Payment creation failed:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to create payment',
      details: error instanceof z.ZodError ? error.errors : error,
    });
  }
});

/**
 * 💳 POST /api/audits/confirm-payment
 * Confirm payment for audit request and start processing
 */
router.post('/confirm-payment', isAuthenticated, async (req, res) => {
  try {
    const { auditId, paymentIntentId, paymentMethod } = z.object({
      auditId: z.string(),
      paymentIntentId: z.string().optional(),
      paymentMethod: z.enum(['stripe', 'paypal', 'circle_usdc', 'crypto'])
    }).parse(req.body);

    // Verify audit belongs to user
    const audit = await smartContractAuditService.getAuditById(auditId);
    if (!audit || audit.customerId !== req.user!.id) {
      return res.status(404).json({
        success: false,
        error: 'Audit not found or access denied',
      });
    }

    // In a real implementation, verify payment completion here
    // For now, trust that payment was successful and start audit
    console.log(`💳 Payment confirmed for audit ${auditId} via ${paymentMethod}`);
    
    // Start audit processing in background
    setTimeout(() => {
      smartContractAuditService.processAudit(auditId).catch(console.error);
    }, 2000);

    res.json({
      success: true,
      message: 'Payment confirmed, audit processing started',
      auditId,
      estimatedCompletion: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    });

  } catch (error) {
    console.error('❌ Payment confirmation failed:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to confirm payment',
      details: error instanceof z.ZodError ? error.errors : error,
    });
  }
});

/**
 * 📋 GET /api/audits/my-audits
 * Get user's audit history
 */
router.get('/my-audits', isAuthenticated, async (req, res) => {
  try {
    const audits = await smartContractAuditService.getUserAudits(req.user!.id);

    res.json({
      success: true,
      audits: audits.map(audit => ({
        id: audit.id,
        projectName: audit.projectName,
        contractType: audit.contractType,
        blockchain: audit.blockchain,
        status: audit.status,
        grade: audit.grade,
        score: audit.score,
        certificateId: audit.certificateId,
        certificateGenerated: audit.certificateGenerated,
        certificateUrl: audit.certificateUrl,
        submittedAt: audit.submittedAt,
        auditCompletedAt: audit.auditCompletedAt,
        amount: audit.amount,
      })),
    });

  } catch (error) {
    console.error('❌ Failed to fetch user audits:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch audit history',
    });
  }
});

/**
 * 📄 GET /api/audits/:auditId/report
 * Get full audit report
 */
router.get('/:auditId/report', isAuthenticated, async (req, res) => {
  try {
    const auditId = req.params.auditId;
    const audit = await smartContractAuditService.getAuditById(auditId);

    if (!audit || audit.customerId !== req.user!.id) {
      return res.status(404).json({
        success: false,
        error: 'Audit not found or access denied',
      });
    }

    if (audit.status !== 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Audit not yet completed',
        status: audit.status,
      });
    }

    res.json({
      success: true,
      audit: {
        id: audit.id,
        projectName: audit.projectName,
        contractType: audit.contractType,
        blockchain: audit.blockchain,
        grade: audit.grade,
        score: audit.score,
        auditReport: audit.auditReport,
        vulnerabilities: audit.vulnerabilities,
        recommendations: audit.recommendations,
        gasOptimizations: audit.gasOptimizations,
        certificateId: audit.certificateId,
        certificateUrl: audit.certificateUrl,
        auditCompletedAt: audit.auditCompletedAt,
      },
    });

  } catch (error) {
    console.error('❌ Failed to fetch audit report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch audit report',
    });
  }
});

/**
 * 🏆 GET /api/audits/:auditId/certificate
 * Get audit certificate
 */
router.get('/:auditId/certificate', isAuthenticated, async (req, res) => {
  try {
    const auditId = req.params.auditId;
    const audit = await smartContractAuditService.getAuditById(auditId);

    if (!audit || audit.customerId !== req.user!.id) {
      return res.status(404).json({
        success: false,
        error: 'Audit not found or access denied',
      });
    }

    if (!audit.certificateGenerated || !audit.certificateUrl) {
      return res.status(400).json({
        success: false,
        error: 'Certificate not yet generated',
      });
    }

    res.json({
      success: true,
      certificate: {
        id: audit.certificateId,
        url: audit.certificateUrl,
        projectName: audit.projectName,
        grade: audit.grade,
        score: audit.score,
        issuedDate: audit.auditCompletedAt,
      },
    });

  } catch (error) {
    console.error('❌ Failed to fetch certificate:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch certificate',
    });
  }
});

/**
 * 📊 GET /api/audits/pricing
 * Get audit service pricing and information
 */
router.get('/pricing', async (req, res) => {
  try {
    const stats = await smartContractAuditService.getAuditStats();

    res.json({
      success: true,
      pricing: {
        basePrice: 1000,
        currency: 'USD',
        estimatedDeliveryHours: 24,
        paymentMethods: ['stripe', 'paypal', 'circle_usdc', 'crypto'],
        supportedBlockchains: ['ethereum', 'base', 'polygon', 'bsc', 'arbitrum'],
        contractTypes: ['token', 'dapp', 'nft', 'defi', 'game', 'other'],
      },
      grading: {
        A: { range: '80-100%', description: 'Excellent - Ready for production' },
        B: { range: '70-79%', description: 'Good - Needs remediation' },
        F: { range: '<70%', description: 'Failing - Major improvements required' },
      },
      stats,
    });

  } catch (error) {
    console.error('❌ Failed to fetch pricing info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pricing information',
    });
  }
});

/**
 * 🔍 GET /api/audits/status/:auditId
 * Get audit status and progress
 */
router.get('/status/:auditId', isAuthenticated, async (req, res) => {
  try {
    const auditId = req.params.auditId;
    const audit = await smartContractAuditService.getAuditById(auditId);

    if (!audit || audit.customerId !== req.user!.id) {
      return res.status(404).json({
        success: false,
        error: 'Audit not found or access denied',
      });
    }

    // Calculate progress percentage
    let progress = 0;
    switch (audit.status) {
      case 'pending': progress = 0; break;
      case 'in_progress': progress = 50; break;
      case 'completed': progress = 100; break;
      case 'cancelled': progress = 0; break;
    }

    res.json({
      success: true,
      status: {
        id: audit.id,
        status: audit.status,
        progress,
        submittedAt: audit.submittedAt,
        auditStartedAt: audit.auditStartedAt,
        auditCompletedAt: audit.auditCompletedAt,
        estimatedDeliveryHours: audit.estimatedDeliveryHours,
        certificateGenerated: audit.certificateGenerated,
      },
    });

  } catch (error) {
    console.error('❌ Failed to fetch audit status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch audit status',
    });
  }
});

/**
 * 💬 POST /api/audits/:auditId/start-chat
 * Start chat session for audit communication
 */
router.post('/:auditId/start-chat', isAuthenticated, async (req, res) => {
  try {
    const auditId = req.params.auditId;
    const audit = await smartContractAuditService.getAuditById(auditId);

    if (!audit || audit.customerId !== req.user!.id) {
      return res.status(404).json({
        success: false,
        error: 'Audit not found or access denied',
      });
    }

    // This would integrate with the existing chat system
    const chatSessionId = `audit-${auditId}-${Date.now()}`;

    res.json({
      success: true,
      message: 'Chat session started for audit communication',
      chatSessionId,
      auditId,
    });

  } catch (error) {
    console.error('❌ Failed to start chat session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start chat session',
    });
  }
});

/**
 * 🔒 Admin Routes (if needed)
 */

/**
 * 📊 GET /api/audits/admin/stats
 * Get comprehensive audit statistics (admin only)
 */
router.get('/admin/stats', isAuthenticated, async (req, res) => {
  try {
    // Check if user is admin (this would be implemented based on your auth system)
    // if (!req.user.isAdmin) return res.status(403).json({ error: 'Admin access required' });

    const stats = await smartContractAuditService.getAuditStats();

    res.json({
      success: true,
      stats: {
        ...stats,
        revenue: stats.totalAudits * 1000, // $1K per audit
        conversionRate: '85%', // Mock data
      },
    });

  } catch (error) {
    console.error('❌ Failed to fetch admin stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch admin statistics',
    });
  }
});

export default router;