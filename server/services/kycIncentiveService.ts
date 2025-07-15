import { db } from '../db';
import { users } from '../../shared/schema';
import { eq } from 'drizzle-orm';

export class KYCIncentiveService {
  /**
   * Calculate KYC completion incentives for user - SUSTAINABLE MODEL
   * Focus on enhanced features and reduced friction rather than financial discounts
   */
  async calculateKYCIncentives(userId: string, transactionAmount: number): Promise<{
    feeDiscount: number;
    completionBonus: number;
    premiumFeatures: string[];
    totalSavings: number;
    enhancedLimits: {
      dailyLimit: number;
      monthlyLimit: number;
      instantWithdrawal: boolean;
    };
  }> {
    try {
      const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      
      if (!user.length) {
        return {
          feeDiscount: 0,
          completionBonus: 0,
          premiumFeatures: [],
          totalSavings: 0,
          enhancedLimits: {
            dailyLimit: 1000,
            monthlyLimit: 5000,
            instantWithdrawal: false
          }
        };
      }

      const kycStatus = user[0].kycStatus;
      const complianceLevel = user[0].complianceLevel || 'basic';

      let feeDiscount = 0;
      let completionBonus = 0;
      let premiumFeatures: string[] = [];
      let enhancedLimits = {
        dailyLimit: 1000,
        monthlyLimit: 5000,
        instantWithdrawal: false
      };

      // SUSTAINABLE MODEL: Focus on enhanced features and limits rather than fee discounts
      switch (kycStatus) {
        case 'pending':
          feeDiscount = 0.005; // 0.5% discount for starting KYC
          premiumFeatures = ['basicAnalytics'];
          enhancedLimits = {
            dailyLimit: 2000,
            monthlyLimit: 10000,
            instantWithdrawal: false
          };
          break;
        case 'approved':
          switch (complianceLevel) {
            case 'basic':
              feeDiscount = 0.01; // 1% discount for basic KYC
              premiumFeatures = ['advancedAnalytics', 'prioritySupport', 'reducedHolds'];
              enhancedLimits = {
                dailyLimit: 10000,
                monthlyLimit: 50000,
                instantWithdrawal: true
              };
              break;
            case 'enhanced':
              feeDiscount = 0.015; // 1.5% discount for enhanced KYC
              premiumFeatures = ['advancedAnalytics', 'prioritySupport', 'institutionalFeatures', 'reducedHolds', 'bulkTransactions'];
              enhancedLimits = {
                dailyLimit: 50000,
                monthlyLimit: 250000,
                instantWithdrawal: true
              };
              break;
            case 'institutional':
              feeDiscount = 0.02; // 2% discount for institutional KYC
              premiumFeatures = ['advancedAnalytics', 'prioritySupport', 'institutionalFeatures', 'customLimits', 'reducedHolds', 'bulkTransactions', 'dedicatedSupport'];
              enhancedLimits = {
                dailyLimit: 250000,
                monthlyLimit: 1000000,
                instantWithdrawal: true
              };
              break;
          }
          break;
      }

      // Calculate total savings (fee discounts only)
      const feesSaved = transactionAmount * feeDiscount;
      const totalSavings = feesSaved;

      return {
        feeDiscount,
        completionBonus,
        premiumFeatures,
        totalSavings,
        enhancedLimits
      };

    } catch (error) {
      console.error('Error calculating KYC incentives:', error);
      return {
        feeDiscount: 0,
        completionBonus: 0,
        premiumFeatures: [],
        totalSavings: 0,
        enhancedLimits: {
          dailyLimit: 1000,
          monthlyLimit: 5000,
          instantWithdrawal: false
        }
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