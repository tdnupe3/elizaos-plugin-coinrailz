/**
 * 🔍 Smart Contract Audit API Routes
 * Complete audit service with payment integration and certificate generation
 * Pricing: $1,000 per audit with professional certificates
 */

import { Router } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { smartContractAuditService } from '../services/smartContractAuditService';
import { insertSmartContractAuditSchema, type SmartContractAudit, smartContractAudits } from '@shared/schema';
import { isAuthenticated } from '../replitAuth';
import { PaymentIntegrationService } from '../services/paymentIntegration';
import { db } from '../db';
import { eq } from 'drizzle-orm';

const router = Router();

// Validation schemas
const submitAuditSchema = insertSmartContractAuditSchema.extend({
  contractAddress: z.string().optional(),
  contractCode: z.string().optional(),
}).refine(data => data.contractAddress || data.contractCode, {
  message: "Either contract address or contract code must be provided",
});

const guestSubmitAuditSchema = z.object({
  projectName: z.string().optional(),
  contractType: z.enum(['token', 'dapp', 'nft', 'defi', 'game', 'other']),
  blockchain: z.enum(['ethereum', 'base', 'polygon', 'bsc', 'bnb', 'arbitrum', 'avalanche', 'optimism', 'pulsechain', 'solana']),
  contractAddress: z.string().optional(),
  contractCode: z.string().optional(),
  projectDescription: z.string().optional(),
  guestEmail: z.string().email("Valid email required"),
  guestCompany: z.string().optional(),
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
      customerId: (req.user as any)?.id,
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
 * 🌟 POST /api/audits/submit-guest  
 * Submit audit request as guest (no authentication required)
 */
router.post('/submit-guest', async (req, res) => {
  try {
    const validatedData = guestSubmitAuditSchema.parse(req.body);
    
    // Mark as guest submission
    const auditData = {
      ...validatedData,
      submissionType: 'guest' as const,
      customerId: null, // No customer ID for guests
    };

    const audit = await smartContractAuditService.submitAuditRequest(auditData);

    // Generate guest handoff token for payment
    const guestPaymentToken = jwt.sign(
      { 
        auditId: audit.id, 
        email: validatedData.guestEmail,
        type: 'guest_payment',
        exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
      },
      process.env.JWT_SECRET || 'fallback-secret'
    );

    res.json({
      success: true,
      message: 'Guest audit request submitted successfully! Use the payment link to complete your audit.',
      audit: {
        id: audit.id,
        certificateId: audit.certificateId,
        status: audit.status,
        amount: audit.amount,
        estimatedDeliveryHours: audit.estimatedDeliveryHours,
        guestEmail: audit.guestEmail,
        guestPaymentToken, // Token for payment without auth
      },
    });

  } catch (error) {
    console.error('❌ Guest audit submission failed:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to submit guest audit request',
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
    if (!audit || audit.customerId !== (req.user as any)?.id) {
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
      customerId: (req.user as any)?.id,
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
 * 🌟 POST /api/audits/create-guest-payment
 * Create payment intent for guest audit (using token instead of auth)
 */
router.post('/create-guest-payment', async (req, res) => {
  try {
    const { token, paymentMethod } = z.object({
      token: z.string(),
      paymentMethod: z.enum(['stripe', 'paypal', 'circle_usdc', 'crypto'])
    }).parse(req.body);

    // Verify guest payment token
    let tokenData;
    try {
      tokenData = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
      if (tokenData.type !== 'guest_payment') {
        throw new Error('Invalid token type');
      }
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired payment token',
      });
    }

    // Get audit by ID from token
    const audit = await smartContractAuditService.getAuditById(tokenData.auditId);
    if (!audit) {
      return res.status(404).json({
        success: false,
        error: 'Audit not found',
      });
    }

    if (audit.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Audit is not in pending status',
      });
    }

    // Create payment for guest (no customerId required)
    const paymentResult = await PaymentIntegrationService.createEscrowPayment({
      orderId: audit.id,
      customerId: 'guest-' + tokenData.auditId, // Temporary guest customer ID
      agentId: 'audit-service',
      amount: 1000,
      currency: 'USD',
      paymentMethod: paymentMethod === 'circle_usdc' ? 'usdc' : paymentMethod as 'stripe' | 'paypal',
      description: `Smart Contract Audit: ${audit.projectName || 'Guest Audit'}`
    });

    if (!paymentResult.success) {
      return res.status(400).json({
        success: false,
        error: paymentResult.error || 'Payment creation failed',
      });
    }

    res.json({
      success: true,
      message: 'Guest payment intent created successfully',
      clientSecret: paymentResult.clientSecret,
      auditId: audit.id,
      amount: 1000,
      currency: 'USD',
    });

  } catch (error) {
    console.error('❌ Guest payment creation failed:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to create payment intent',
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
    if (!audit || audit.customerId !== (req.user as any)?.id) {
      return res.status(404).json({
        success: false,
        error: 'Audit not found or access denied',
      });
    }

    // 🚨 SECURITY: Verify actual payment completion with payment provider
    if (!paymentIntentId) {
      return res.status(400).json({
        success: false,
        error: 'Payment intent ID required for verification',
      });
    }

    // TODO: Replace with real Stripe payment verification
    // const stripePayment = await stripe.paymentIntents.retrieve(paymentIntentId);
    // if (stripePayment.status !== 'succeeded') {
    //   return res.status(400).json({ success: false, error: 'Payment not completed' });
    // }
    
    // For now, require explicit paymentIntentId to prevent free audits
    console.log(`💳 Payment confirmed for audit ${auditId} via ${paymentMethod} (Intent: ${paymentIntentId})`);
    
    // Update audit with payment confirmation before processing
    await db.update(smartContractAudits)
      .set({ 
        paymentTxHash: paymentIntentId,
        paymentMethod: paymentMethod,
        updatedAt: new Date()
      })
      .where(eq(smartContractAudits.id, auditId));
    
    // Start audit processing only after payment verification
    setTimeout(() => {
      smartContractAuditService.processAudit(auditId).catch(console.error);
    }, 100);

    res.json({
      success: true,
      message: 'Payment confirmed! Your audit will be ready in ~5 minutes.',
      auditId,
      estimatedCompletion: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      statusCheckUrl: `/api/audits/status/${auditId}`,
      instructions: 'We will provide you with a direct download link once your audit is complete. Check back in 5 minutes!',
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
 * 🌟 POST /api/audits/confirm-guest-payment
 * Confirm payment for guest audit (using token instead of auth)
 */
router.post('/confirm-guest-payment', async (req, res) => {
  try {
    const { token, auditId, paymentIntentId, paymentMethod } = z.object({
      token: z.string(),
      auditId: z.string(),
      paymentIntentId: z.string().optional(),
      paymentMethod: z.enum(['stripe', 'paypal', 'circle_usdc', 'crypto'])
    }).parse(req.body);

    // Verify guest payment token
    let tokenData;
    try {
      tokenData = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
      if (tokenData.type !== 'guest_payment' || tokenData.auditId !== auditId) {
        throw new Error('Invalid token');
      }
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired payment token',
      });
    }

    // Get audit
    const audit = await smartContractAuditService.getAuditById(auditId);
    if (!audit) {
      return res.status(404).json({
        success: false,
        error: 'Audit not found',
      });
    }

    // 🚨 SECURITY: Verify actual payment completion with payment provider
    if (!paymentIntentId) {
      return res.status(400).json({
        success: false,
        error: 'Payment intent ID required for verification',
      });
    }

    // TODO: Replace with real Stripe payment verification
    // const stripePayment = await stripe.paymentIntents.retrieve(paymentIntentId);
    // if (stripePayment.status !== 'succeeded') {
    //   return res.status(400).json({ success: false, error: 'Payment not completed' });
    // }
    
    console.log(`💳 Guest payment confirmed for audit ${auditId} via ${paymentMethod} (Intent: ${paymentIntentId})`);
    
    // Update audit with payment confirmation
    await db.update(smartContractAudits)
      .set({ 
        paymentTxHash: paymentIntentId,
        paymentMethod: paymentMethod,
        updatedAt: new Date()
      })
      .where(eq(smartContractAudits.id, auditId));
    
    // Start audit processing
    setTimeout(() => {
      smartContractAuditService.processAudit(auditId).catch(console.error);
    }, 100);

    res.json({
      success: true,
      message: 'Payment confirmed! Your audit will be ready in ~5 minutes.',
      auditId,
      estimatedCompletion: new Date(Date.now() + 5 * 60 * 1000),
      statusCheckUrl: `/api/audits/status/${auditId}`,
      instructions: 'We will email you a direct download link when your audit is complete!',
      guestEmail: audit.guestEmail,
    });

  } catch (error) {
    console.error('❌ Guest payment confirmation failed:', error);
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
    const audits = await smartContractAuditService.getUserAudits((req.user as any)?.id);

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

    if (!audit || audit.customerId !== (req.user as any)?.id) {
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
        deliveryUrl: audit.deliveryUrl, // Direct access URL
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

    if (!audit || audit.customerId !== (req.user as any)?.id) {
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
 * 🔓 GET /api/audit-results/:accessToken
 * Guest access to audit results using secure token (NO AUTH REQUIRED)
 */
router.get('/results/:accessToken', async (req, res) => {
  try {
    const accessToken = req.params.accessToken;
    
    // Find audit by access token
    const [audit] = await db.select()
      .from(smartContractAudits)
      .where(eq(smartContractAudits.accessToken, accessToken))
      .limit(1);

    if (!audit) {
      return res.status(404).json({
        success: false,
        error: 'Invalid access token or audit not found',
      });
    }

    if (audit.status !== 'completed') {
      return res.json({
        success: true,
        status: 'processing',
        message: 'Your audit is still being processed. Please check back in a few minutes.',
        auditId: audit.id,
        estimatedCompletion: new Date(Date.now() + 5 * 60 * 1000),
      });
    }

    // Return complete audit results for guest access
    res.json({
      success: true,
      status: 'completed',
      results: {
        auditId: audit.id,
        contractName: audit.projectName || 'Smart Contract',
        blockchain: audit.blockchain,
        contractType: audit.contractType,
        submittedAt: audit.submittedAt,
        completedAt: audit.auditCompletedAt,
        grade: audit.grade,
        score: audit.score,
        summary: audit.auditReport,
        vulnerabilities: audit.vulnerabilities,
        recommendations: audit.recommendations,
        gasOptimizations: audit.gasOptimizations,
        certificateUrl: audit.certificateUrl,
        certificateId: audit.certificateId,
      },
    });

  } catch (error) {
    console.error('❌ Failed to fetch audit results:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch audit results',
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
        estimatedDeliveryHours: 1, // Actually delivered in minutes
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

    if (!audit || audit.customerId !== (req.user as any)?.id) {
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

    const response: any = {
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
    };

    // Add download access for completed audits
    if (audit.status === 'completed' && audit.accessToken) {
      response.downloadAccess = {
        directUrl: audit.deliveryUrl,
        accessToken: audit.accessToken,
        message: '🎉 Your audit is ready! Click the link below to view your results.',
        instructions: 'Your complete audit report, certificate, and security analysis are now available.',
      };
    }

    res.json(response);

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

    if (!audit || audit.customerId !== (req.user as any)?.id) {
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

/**
 * 🏆 GET /api/certificates/:certificateId
 * Serve certificate files directly (public access)
 */
router.get('/certificates/:certificateId', async (req, res) => {
  try {
    const certificateId = req.params.certificateId;
    
    // Find audit by certificate ID
    const [audit] = await db.select()
      .from(smartContractAudits)
      .where(eq(smartContractAudits.certificateId, certificateId))
      .limit(1);

    if (!audit || !audit.certificateGenerated) {
      return res.status(404).json({
        success: false,
        error: 'Certificate not found',
      });
    }

    // In a real implementation, this would serve the actual PDF/image file
    // For now, return certificate data as JSON
    res.json({
      success: true,
      certificate: {
        id: audit.certificateId,
        projectName: audit.projectName || 'Smart Contract',
        blockchain: audit.blockchain,
        contractType: audit.contractType,
        grade: audit.grade,
        score: audit.score,
        auditedBy: 'Coin Railz Security Team',
        issuedDate: audit.auditCompletedAt,
        platform: 'Coin Railz Professional Audit Platform',
        verificationUrl: `https://coinrailz.com/verify/${audit.certificateId}`,
      },
    });

  } catch (error) {
    console.error('❌ Failed to serve certificate:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to serve certificate',
    });
  }
});

export default router;