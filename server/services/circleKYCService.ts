/**
 * Circle KYC/AML Service
 * Handles identity verification and compliance through Circle's KYC infrastructure
 */

import { CircleService } from './circleService';
import { db } from '../db';
import { users } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { kycIncentiveService } from './kycIncentiveService.js';
import { kycCostTrackingService } from './kycCostTrackingService.js';

export interface KYCDocumentUpload {
  documentType: 'passport' | 'drivers_license' | 'national_id' | 'utility_bill' | 'bank_statement';
  documentSide?: 'front' | 'back';
  fileData: Buffer;
  fileName: string;
  contentType: string;
}

export interface KYCVerificationRequest {
  userId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string; // YYYY-MM-DD format
  country: string;
  address: {
    street: string;
    city: string;
    state?: string;
    postalCode: string;
    country: string;
  };
  phoneNumber?: string;
  documents: KYCDocumentUpload[];
}

export interface KYCStatus {
  userId: string;
  status: 'pending' | 'approved' | 'rejected' | 'review_required';
  verificationLevel: 'basic' | 'enhanced' | 'premium';
  transactionLimits: {
    daily: number;
    monthly: number;
    annual: number;
  };
  approvedAt?: Date;
  rejectionReason?: string;
  requiredDocuments?: string[];
}

class CircleKYCService {
  private readonly API_BASE = 'https://api.circle.com/v1';
  private readonly headers: Record<string, string>;

  constructor() {
    this.headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.CIRCLE_API_KEY}`
    };
  }

  /**
   * Submit KYC verification request to Circle
   */
  async submitKYCVerification(request: KYCVerificationRequest): Promise<{
    success: boolean;
    verificationId?: string;
    status?: string;
    error?: string;
  }> {
    try {
      // Update user record with KYC submission
      await db.update(users)
        .set({
          kycStatus: 'pending',
          kycSubmittedAt: new Date(),
          firstName: request.firstName,
          lastName: request.lastName,
          dateOfBirth: request.dateOfBirth,
          country: request.country,
          address: JSON.stringify(request.address),
          phoneNumber: request.phoneNumber
        })
        .where(eq(users.id, request.userId));

      // In production, this would submit to Circle's KYC API
      // For now, simulate the submission
      const verificationId = `kyc_${Date.now()}_${request.userId.slice(0, 8)}`;
      
      console.log('KYC verification submitted:', {
        userId: request.userId,
        verificationId,
        name: `${request.firstName} ${request.lastName}`,
        country: request.country,
        documents: request.documents.length
      });

      return {
        success: true,
        verificationId,
        status: 'pending'
      };

    } catch (error) {
      console.error('KYC submission error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get KYC verification status from Circle
   */
  async getKYCStatus(userId: string): Promise<KYCStatus | null> {
    try {
      const userResult = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      
      if (userResult.length === 0) {
        return null;
      }

      const user = userResult[0];
      
      // Determine verification level based on user data completeness
      let verificationLevel: 'basic' | 'enhanced' | 'premium' = 'basic';
      let transactionLimits = { daily: 1000, monthly: 10000, annual: 100000 };

      if (user.kycStatus === 'approved') {
        if (user.phoneNumber && user.address) {
          verificationLevel = 'enhanced';
          transactionLimits = { daily: 25000, monthly: 100000, annual: 500000 };
        }
        
        if (user.dateOfBirth && user.country) {
          verificationLevel = 'premium';
          transactionLimits = { daily: 100000, monthly: 500000, annual: 2000000 };
        }
      }

      return {
        userId,
        status: user.kycStatus as 'pending' | 'approved' | 'rejected' | 'review_required' || 'pending',
        verificationLevel,
        transactionLimits,
        approvedAt: user.kycApprovedAt ?? undefined,
        rejectionReason: user.kycRejectionReason ?? undefined,
        requiredDocuments: this.parseRequiredDocuments(user.kycRequiredDocuments)
      };

    } catch (error) {
      console.error('Error getting KYC status:', error);
      return null;
    }
  }

  private parseRequiredDocuments(value: unknown): string[] {
    if (Array.isArray(value) && value.every((document): document is string => typeof document === 'string')) {
      return value;
    }
    if (typeof value === 'string') {
      try {
        const parsed: unknown = JSON.parse(value);
        return Array.isArray(parsed) && parsed.every((document): document is string => typeof document === 'string')
          ? parsed
          : [];
      } catch {
        return [];
      }
    }
    return [];
  }

  /**
   * Process KYC submission - alternative method name for compatibility
   */
  async processKYCSubmission(request: KYCVerificationRequest): Promise<{
    success: boolean;
    verificationId?: string;
    status?: string;
    error?: string;
  }> {
    return this.submitKYCVerification(request);
  }

  /**
   * Update KYC status (typically called by Circle webhook)
   */
  async updateKYCStatus(userId: string, status: 'approved' | 'rejected' | 'review_required', metadata?: {
    rejectionReason?: string;
    requiredDocuments?: string[];
  }): Promise<boolean> {
    try {
      const updateData: any = {
        kycStatus: status,
        kycUpdatedAt: new Date()
      };

      if (status === 'approved') {
        updateData.kycApprovedAt = new Date();
      } else if (status === 'rejected' && metadata?.rejectionReason) {
        updateData.kycRejectionReason = metadata.rejectionReason;
      }

      if (metadata?.requiredDocuments) {
        updateData.kycRequiredDocuments = JSON.stringify(metadata.requiredDocuments);
      }

      await db.update(users)
        .set(updateData)
        .where(eq(users.id, userId));

      return true;

    } catch (error) {
      console.error('Error updating KYC status:', error);
      return false;
    }
  }

  /**
   * Check if user can perform transaction based on KYC status
   */
  async checkTransactionPermission(userId: string, amount: number): Promise<{
    allowed: boolean;
    reason?: string;
    requiresKYC?: boolean;
    currentLimit?: number;
  }> {
    try {
      const kycStatus = await this.getKYCStatus(userId);
      
      if (!kycStatus) {
        return { allowed: false, reason: 'User not found' };
      }

      // Allow small transactions without KYC
      if (amount <= 3000 && kycStatus.status !== 'rejected') {
        return { allowed: true };
      }

      // Require KYC for larger transactions
      if (kycStatus.status === 'pending') {
        return { 
          allowed: false, 
          reason: 'KYC verification pending', 
          requiresKYC: true 
        };
      }

      if (kycStatus.status === 'rejected') {
        return { 
          allowed: false, 
          reason: kycStatus.rejectionReason || 'KYC verification rejected' 
        };
      }

      if (kycStatus.status === 'review_required') {
        return { 
          allowed: false, 
          reason: 'Additional KYC documentation required',
          requiresKYC: true
        };
      }

      // Check transaction limits for approved users
      if (kycStatus.status === 'approved') {
        if (amount > kycStatus.transactionLimits.daily) {
          return { 
            allowed: false, 
            reason: 'Transaction exceeds daily limit',
            currentLimit: kycStatus.transactionLimits.daily
          };
        }
        
        return { allowed: true };
      }

      return { allowed: false, reason: 'KYC verification required', requiresKYC: true };

    } catch (error) {
      console.error('Error checking transaction permission:', error);
      return { allowed: false, reason: 'System error' };
    }
  }

  /**
   * Get KYC requirements for user's country
   */
  async getKYCRequirements(country: string): Promise<{
    required: boolean;
    documents: string[];
    limits: {
      withoutKYC: number;
      withKYC: number;
    };
  }> {
    // High-risk countries require enhanced KYC
    const enhancedKYCCountries = ['AF', 'BY', 'CF', 'CU', 'IR', 'KP', 'MM', 'RU', 'SY', 'VE'];
    const isHighRisk = enhancedKYCCountries.includes(country.toUpperCase());

    const baseRequirements = {
      required: isHighRisk,
      documents: ['passport', 'drivers_license', 'national_id'],
      limits: {
        withoutKYC: isHighRisk ? 500 : 3000,
        withKYC: isHighRisk ? 10000 : 100000
      }
    };

    if (isHighRisk) {
      baseRequirements.documents.push('utility_bill', 'bank_statement');
    }

    return baseRequirements;
  }

  /**
   * Generate KYC onboarding link for user
   */
  async generateKYCLink(userId: string): Promise<{
    success: boolean;
    kycUrl?: string;
    error?: string;
  }> {
    try {
      // In production, this would generate a secure KYC onboarding link
      const kycUrl = `${process.env.FRONTEND_URL || 'https://coinrailz.com'}/kyc/verify?userId=${userId}&token=${Buffer.from(userId).toString('base64')}`;
      
      return {
        success: true,
        kycUrl
      };

    } catch (error) {
      console.error('Error generating KYC link:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Handle webhook status updates from Circle KYC
   */
  async handleWebhookStatusUpdate(webhookData: any): Promise<void> {
    try {
      const { userId, status, verificationId } = webhookData;
      
      if (!userId || !status) {
        throw new Error('Invalid webhook data');
      }

      // Update KYC status in database
      await this.updateKYCStatus(userId, status);

      // Apply completion bonus if approved
      if (status === 'approved') {
        await kycIncentiveService.applyKYCCompletionBonus(userId);
      }

      console.log('Processing KYC webhook update:', {
        userId,
        status,
        verificationId,
        timestamp: new Date().toISOString()
      });

      // In production, this would:
      // 1. Validate webhook signature
      // 2. Update user KYC status in database
      // 3. Send notification to user
      // 4. Update transaction limits
      
    } catch (error) {
      console.error('KYC webhook processing error:', error);
      throw new Error('Failed to process KYC webhook');
    }
  }

  /**
   * Get KYC progress with incentives
   */
  async getKYCProgressWithIncentives(userId: string): Promise<{
    progress: any;
    incentives: any;
    costMetrics: any;
  }> {
    try {
      const progress = await kycIncentiveService.getKYCProgress(userId);
      const incentives = await kycIncentiveService.calculateKYCIncentives(userId, 1000);
      const costMetrics = await kycCostTrackingService.getKYCCostMetrics();

      return {
        progress,
        incentives,
        costMetrics
      };
    } catch (error) {
      console.error('Error getting KYC progress with incentives:', error);
      throw new Error('Failed to get KYC progress');
    }
  }

  /**
   * Apply KYC fee discount to transaction
   */
  async applyKYCFeeDiscount(userId: string, transactionAmount: number): Promise<{
    originalFee: number;
    discountedFee: number;
    savings: number;
    discountPercentage: number;
  }> {
    try {
      const incentives = await kycIncentiveService.calculateKYCIncentives(userId, transactionAmount);
      const baseFeeRate = 0.025; // 2.5% base fee
      const originalFee = transactionAmount * baseFeeRate;
      const discountedFee = originalFee * (1 - incentives.feeDiscount);
      const savings = originalFee - discountedFee;

      return {
        originalFee,
        discountedFee,
        savings,
        discountPercentage: incentives.feeDiscount * 100
      };
    } catch (error) {
      console.error('Error applying KYC fee discount:', error);
      return {
        originalFee: transactionAmount * 0.025,
        discountedFee: transactionAmount * 0.025,
        savings: 0,
        discountPercentage: 0
      };
    }
  }
}

export const circleKYCService = new CircleKYCService();