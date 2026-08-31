/**
 * KYC Management Routes
 * Handles KYC verification workflow and status management
 */

import { Router } from 'express';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { IStorage } from '../storage.js';

const router = Router();

// KYC submission schema
const kycSubmissionSchema = z.object({
  verificationType: z.enum(['enhanced', 'institutional']),
  personalInfo: z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    dateOfBirth: z.string(),
    nationality: z.string(),
    phoneNumber: z.string().optional(),
    address: z.object({
      street: z.string(),
      city: z.string(),
      state: z.string(),
      zipCode: z.string(),
      country: z.string()
    }).optional()
  }),
  documents: z.object({
    idType: z.enum(['passport', 'drivers_license', 'national_id']),
    idNumber: z.string(),
    expiryDate: z.string().optional()
  }),
  businessInfo: z.object({
    companyName: z.string(),
    registrationNumber: z.string(),
    businessType: z.string(),
    website: z.string().optional()
  }).optional()
});

export function setupKYCRoutes(app: any, storage: IStorage) {
  
  // Get user's current KYC status
  app.get('/api/kyc/status', async (req: any, res: any) => {
    try {
      // Check if user is authenticated
      if (!req.user && !req.session?.demoUser) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const userId = req.user?.id || req.session?.demoUser?.id;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID not found'
        });
      }

      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Get KYC verification record if exists
      let kycRecord: { createdAt: Date; updatedAt: Date } | null = null;
      try {
        // This would need to be implemented in storage
        // kycRecord = await storage.getKYCVerification(userId);
      } catch (error) {
        console.log('KYC record not found for user:', userId);
      }

      res.json({
        success: true,
        kyc: {
          status: user.kycStatus,
          complianceLevel: user.complianceLevel,
          riskScore: user.riskScore,
          submittedAt: null,
          lastUpdated: null,
          canUpgrade: user.kycStatus !== 'verified' || user.complianceLevel !== 'institutional'
        },
        features: {
          referralAccess: true,
          sendMoney: user.kycStatus === 'verified',
          receiveMoney: user.kycStatus === 'verified',
          cryptoTrading: user.kycStatus === 'verified',
          agentMarketplace: user.kycStatus === 'verified',
          commissionWithdrawal: user.kycStatus === 'verified',
          largeTransactions: user.kycStatus === 'verified' && ['enhanced', 'institutional'].includes(user.complianceLevel ?? ''),
          institutionalFeatures: user.kycStatus === 'verified' && user.complianceLevel === 'institutional'
        },
        limits: {
          maxTransactionAmount: getTransactionLimit(user.kycStatus ?? 'pending', user.complianceLevel ?? 'basic'),
          dailyLimit: getDailyLimit(user.kycStatus ?? 'pending', user.complianceLevel ?? 'basic'),
          monthlyLimit: getMonthlyLimit(user.kycStatus ?? 'pending', user.complianceLevel ?? 'basic')
        }
      });
    } catch (error) {
      console.error('KYC status check error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve KYC status'
      });
    }
  });

  // Submit KYC verification
  app.post('/api/kyc/submit', async (req: any, res: any) => {
    try {
      // Validate request body
      const validationResult = kycSubmissionSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          message: 'Invalid KYC submission data',
          errors: validationResult.error.errors
        });
      }

      const kycData = validationResult.data;

      // Check if user is authenticated
      if (!req.user && !req.session?.demoUser) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const userId = req.user?.id || req.session?.demoUser?.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Create KYC verification record
      const kycRecord = {
        id: nanoid(),
        userId,
        verificationType: kycData.verificationType,
        status: 'pending' as const,
        submittedAt: new Date(),
        personalInfo: kycData.personalInfo,
        documents: kycData.documents,
        businessInfo: kycData.businessInfo,
        reviewNotes: null,
        approvedAt: null,
        rejectedAt: null
      };

      // Update user status to pending
      await storage.updateUser(userId, {
        kycStatus: 'pending',
        complianceLevel: kycData.verificationType === 'institutional' ? 'institutional' : 'enhanced'
      });

      // In a real implementation, this would:
      // 1. Store documents securely
      // 2. Trigger verification workflow
      // 3. Send notifications to compliance team
      
      res.status(201).json({
        success: true,
        message: 'KYC verification submitted successfully',
        kyc: {
          id: kycRecord.id,
          status: 'pending',
          verificationType: kycData.verificationType,
          submittedAt: kycRecord.submittedAt,
          estimatedReviewTime: '2-5 business days'
        },
        nextSteps: {
          message: 'Your verification is being reviewed. You will be notified once approved.',
          estimatedTime: '2-5 business days',
          trackingUrl: `/kyc/status/${kycRecord.id}`
        }
      });
    } catch (error) {
      console.error('KYC submission error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to submit KYC verification'
      });
    }
  });

  // Update KYC status (admin endpoint)
  app.post('/api/kyc/update-status', async (req: any, res: any) => {
    try {
      const { userId, status, complianceLevel, reviewNotes } = req.body;

      // In production, this would require admin authentication
      // For now, we'll allow demo updates

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Update user KYC status
      await storage.updateUser(userId, {
        kycStatus: status,
        complianceLevel: complianceLevel || user.complianceLevel
      });

      res.json({
        success: true,
        message: 'KYC status updated successfully',
        kyc: {
          status,
          complianceLevel: complianceLevel || user.complianceLevel,
          updatedAt: new Date()
        }
      });
    } catch (error) {
      console.error('KYC status update error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update KYC status'
      });
    }
  });

  return router;
}

// Helper functions for limits calculation
function getTransactionLimit(kycStatus: string, complianceLevel: string): number {
  if (kycStatus !== 'verified') return 0;
  
  switch (complianceLevel) {
    case 'institutional': return 1000000; // $1M
    case 'enhanced': return 50000; // $50K
    case 'basic': return 10000; // $10K
    default: return 0;
  }
}

function getDailyLimit(kycStatus: string, complianceLevel: string): number {
  if (kycStatus !== 'verified') return 0;
  
  switch (complianceLevel) {
    case 'institutional': return 500000; // $500K
    case 'enhanced': return 25000; // $25K
    case 'basic': return 5000; // $5K
    default: return 0;
  }
}

function getMonthlyLimit(kycStatus: string, complianceLevel: string): number {
  if (kycStatus !== 'verified') return 0;
  
  switch (complianceLevel) {
    case 'institutional': return 10000000; // $10M
    case 'enhanced': return 500000; // $500K
    case 'basic': return 100000; // $100K
    default: return 0;
  }
}