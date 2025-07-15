import { db } from '../db/index.js';
import { users } from '../../shared/schema.js';
import { eq } from 'drizzle-orm';

export class KYCIncentiveService {
  /**
   * Calculate KYC completion incentives for user
   */
  async calculateKYCIncentives(userId: string, transactionAmount: number): Promise<{
    feeDiscount: number;
    completionBonus: number;
    premiumFeatures: string[];
    totalSavings: number;
  }> {
    try {
      const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      
      if (!user.length) {
        return {
          feeDiscount: 0,
          completionBonus: 0,
          premiumFeatures: [],
          totalSavings: 0
        };
      }

      const kycStatus = user[0].kycStatus;
      const complianceLevel = user[0].complianceLevel || 'basic';

      let feeDiscount = 0;
      let completionBonus = 0;
      let premiumFeatures: string[] = [];

      // Progressive fee discounts based on KYC level
      switch (kycStatus) {
        case 'pending':
          feeDiscount = 0.05; // 5% discount for starting KYC
          break;
        case 'approved':
          switch (complianceLevel) {
            case 'basic':
              feeDiscount = 0.15; // 15% discount for basic KYC
              completionBonus = 25; // $25 bonus
              premiumFeatures = ['advancedAnalytics', 'prioritySupport'];
              break;
            case 'enhanced':
              feeDiscount = 0.25; // 25% discount for enhanced KYC
              completionBonus = 50; // $50 bonus
              premiumFeatures = ['advancedAnalytics', 'prioritySupport', 'institutionalFeatures'];
              break;
            case 'institutional':
              feeDiscount = 0.35; // 35% discount for institutional KYC
              completionBonus = 100; // $100 bonus
              premiumFeatures = ['advancedAnalytics', 'prioritySupport', 'institutionalFeatures', 'customLimits'];
              break;
          }
          break;
      }

      // Calculate total savings
      const feesSaved = transactionAmount * feeDiscount;
      const totalSavings = feesSaved + completionBonus;

      return {
        feeDiscount,
        completionBonus,
        premiumFeatures,
        totalSavings
      };

    } catch (error) {
      console.error('Error calculating KYC incentives:', error);
      return {
        feeDiscount: 0,
        completionBonus: 0,
        premiumFeatures: [],
        totalSavings: 0
      };
    }
  }

  /**
   * Apply KYC completion bonus to user account
   */
  async applyKYCCompletionBonus(userId: string): Promise<boolean> {
    try {
      const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      
      if (!user.length || user[0].kycStatus !== 'approved') {
        return false;
      }

      const complianceLevel = user[0].complianceLevel || 'basic';
      let bonusAmount = 0;

      switch (complianceLevel) {
        case 'basic':
          bonusAmount = 25;
          break;
        case 'enhanced':
          bonusAmount = 50;
          break;
        case 'institutional':
          bonusAmount = 100;
          break;
      }

      if (bonusAmount > 0) {
        const currentBalance = parseFloat(user[0].usdBalance || '0');
        const newBalance = currentBalance + bonusAmount;

        await db.update(users)
          .set({ 
            usdBalance: newBalance.toFixed(2),
            kycUpdatedAt: new Date()
          })
          .where(eq(users.id, userId));

        return true;
      }

      return false;
    } catch (error) {
      console.error('Error applying KYC completion bonus:', error);
      return false;
    }
  }

  /**
   * Get user's KYC progress and next steps
   */
  async getKYCProgress(userId: string): Promise<{
    currentStage: string;
    nextStage: string;
    completionPercentage: number;
    availableIncentives: {
      feeDiscount: number;
      completionBonus: number;
      premiumFeatures: string[];
    };
    requiredDocuments: string[];
  }> {
    try {
      const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      
      if (!user.length) {
        return {
          currentStage: 'not_started',
          nextStage: 'basic',
          completionPercentage: 0,
          availableIncentives: {
            feeDiscount: 0,
            completionBonus: 0,
            premiumFeatures: []
          },
          requiredDocuments: []
        };
      }

      const kycStatus = user[0].kycStatus;
      const complianceLevel = user[0].complianceLevel || 'basic';
      const country = user[0].country || 'US';

      let currentStage = 'not_started';
      let nextStage = 'basic';
      let completionPercentage = 0;
      let requiredDocuments: string[] = [];

      // Determine current stage and progress
      if (kycStatus === 'pending') {
        currentStage = 'in_progress';
        completionPercentage = 25;
      } else if (kycStatus === 'approved') {
        switch (complianceLevel) {
          case 'basic':
            currentStage = 'basic_complete';
            nextStage = 'enhanced';
            completionPercentage = 50;
            break;
          case 'enhanced':
            currentStage = 'enhanced_complete';
            nextStage = 'institutional';
            completionPercentage = 75;
            break;
          case 'institutional':
            currentStage = 'institutional_complete';
            nextStage = 'complete';
            completionPercentage = 100;
            break;
        }
      }

      // Determine required documents for next stage
      switch (nextStage) {
        case 'basic':
          requiredDocuments = ['government_id', 'proof_of_address'];
          break;
        case 'enhanced':
          requiredDocuments = ['financial_statement', 'employment_verification'];
          break;
        case 'institutional':
          requiredDocuments = ['business_license', 'beneficial_ownership'];
          break;
      }

      // High-risk countries need additional documents
      const highRiskCountries = ['AF', 'BY', 'CF', 'CU', 'IR', 'KP', 'MM', 'RU', 'SY', 'VE'];
      if (highRiskCountries.includes(country.toUpperCase())) {
        requiredDocuments.push('enhanced_screening', 'source_of_funds');
      }

      // Calculate available incentives for next stage
      const availableIncentives = await this.calculateKYCIncentives(userId, 1000); // Sample amount

      return {
        currentStage,
        nextStage,
        completionPercentage,
        availableIncentives,
        requiredDocuments
      };

    } catch (error) {
      console.error('Error getting KYC progress:', error);
      return {
        currentStage: 'error',
        nextStage: 'basic',
        completionPercentage: 0,
        availableIncentives: {
          feeDiscount: 0,
          completionBonus: 0,
          premiumFeatures: []
        },
        requiredDocuments: []
      };
    }
  }
}

export const kycIncentiveService = new KYCIncentiveService();