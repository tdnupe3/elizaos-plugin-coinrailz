import { db } from "../db";
import { subscriptions, users, type Subscription } from "@shared/schema";
import { eq, and, gte, lte, desc, isNull } from "drizzle-orm";
import { subscriptionNotificationService } from "./subscriptionNotificationService";

export interface Promotion {
  id: string;
  name: string;
  description: string;
  type: 'percentage_off' | 'fixed_discount' | 'free_trial' | 'upgrade_discount';
  value: number; // Percentage or fixed amount
  targetPlans: string[];
  validFrom: Date;
  validUntil: Date;
  maxUses?: number;
  currentUses: number;
  active: boolean;
  eligibilityCriteria: {
    newUsersOnly?: boolean;
    existingUsersOnly?: boolean;
    minAccountAge?: number; // days
    maxAccountAge?: number; // days
    requiredCurrentPlan?: string;
  };
}

export interface PromoCode {
  code: string;
  promotionId: string;
  uses: number;
  maxUses?: number;
  createdAt: Date;
  active: boolean;
}

export interface DiscountCalculation {
  originalPrice: number;
  discountAmount: number;
  finalPrice: number;
  discountPercentage: number;
  validUntil: Date;
  promotionName: string;
}

export class SubscriptionPromotionsService {

  /**
   * Create a new promotion
   */
  async createPromotion(promotion: Omit<Promotion, 'id' | 'currentUses'>): Promise<Promotion> {
    try {
      const newPromotion: Promotion = {
        ...promotion,
        id: this.generatePromotionId(),
        currentUses: 0
      };

      // TODO: Store in database
      console.log('🎯 Created promotion:', newPromotion);
      
      return newPromotion;

    } catch (error) {
      console.error('Failed to create promotion:', error);
      throw new Error('Failed to create promotion');
    }
  }

  /**
   * Generate promo code for a promotion
   */
  async generatePromoCode(
    promotionId: string, 
    customCode?: string, 
    maxUses?: number
  ): Promise<PromoCode> {
    try {
      const code = customCode || this.generateRandomCode();
      
      const promoCode: PromoCode = {
        code: code.toUpperCase(),
        promotionId,
        uses: 0,
        maxUses,
        createdAt: new Date(),
        active: true
      };

      // TODO: Store in database
      console.log('🎫 Generated promo code:', promoCode);
      
      return promoCode;

    } catch (error) {
      console.error('Failed to generate promo code:', error);
      throw new Error('Failed to generate promo code');
    }
  }

  /**
   * Apply promotion to subscription
   */
  async applyPromotion(
    userId: string, 
    planId: string, 
    promoCode?: string,
    promotionId?: string
  ): Promise<DiscountCalculation | null> {
    try {
      let promotion: Promotion | null = null;

      if (promoCode) {
        promotion = await this.getPromotionByCode(promoCode);
      } else if (promotionId) {
        promotion = await this.getPromotionById(promotionId);
      }

      if (!promotion) {
        return null;
      }

      // Check eligibility
      const isEligible = await this.checkEligibility(userId, promotion);
      if (!isEligible) {
        return null;
      }

      // Calculate discount
      const originalPrice = this.getPlanPrice(planId);
      const discountCalculation = this.calculateDiscount(originalPrice, promotion);

      // Track promo code usage
      if (promoCode) {
        await this.trackPromoCodeUsage(promoCode);
      }

      // Track promotion usage
      await this.trackPromotionUsage(promotion.id);

      return discountCalculation;

    } catch (error) {
      console.error('Failed to apply promotion:', error);
      return null;
    }
  }

  /**
   * Get active promotions for a user
   */
  async getActivePromotions(userId: string): Promise<Promotion[]> {
    try {
      // TODO: Get from database
      // For now, return sample promotions
      const samplePromotions: Promotion[] = [
        {
          id: 'new-user-50',
          name: 'New User Special',
          description: '50% off your first month',
          type: 'percentage_off',
          value: 50,
          targetPlans: ['starter', 'pro'],
          validFrom: new Date('2025-01-01'),
          validUntil: new Date('2025-12-31'),
          maxUses: 1000,
          currentUses: 150,
          active: true,
          eligibilityCriteria: {
            newUsersOnly: true,
            maxAccountAge: 7 // 7 days max
          }
        },
        {
          id: 'upgrade-bonus',
          name: 'Upgrade Bonus',
          description: '$20 off when upgrading to Pro',
          type: 'fixed_discount',
          value: 20,
          targetPlans: ['pro'],
          validFrom: new Date('2025-01-01'),
          validUntil: new Date('2025-03-31'),
          currentUses: 45,
          active: true,
          eligibilityCriteria: {
            requiredCurrentPlan: 'starter'
          }
        },
        {
          id: 'enterprise-trial',
          name: 'Enterprise Trial',
          description: '14-day free trial of Enterprise features',
          type: 'free_trial',
          value: 14,
          targetPlans: ['enterprise'],
          validFrom: new Date('2025-01-01'),
          validUntil: new Date('2025-06-30'),
          currentUses: 12,
          active: true,
          eligibilityCriteria: {
            existingUsersOnly: true,
            minAccountAge: 30
          }
        }
      ];

      // Filter promotions based on user eligibility
      const eligiblePromotions: Promotion[] = [];
      
      for (const promotion of samplePromotions) {
        const isEligible = await this.checkEligibility(userId, promotion);
        if (isEligible && promotion.active) {
          eligiblePromotions.push(promotion);
        }
      }

      return eligiblePromotions;

    } catch (error) {
      console.error('Failed to get active promotions:', error);
      return [];
    }
  }

  /**
   * Validate promo code
   */
  async validatePromoCode(code: string, userId: string, planId: string): Promise<{
    valid: boolean;
    promotion?: Promotion;
    discount?: DiscountCalculation;
    error?: string;
  }> {
    try {
      const promotion = await this.getPromotionByCode(code);
      
      if (!promotion) {
        return { valid: false, error: 'Invalid promo code' };
      }

      if (!promotion.active) {
        return { valid: false, error: 'Promo code is no longer active' };
      }

      const now = new Date();
      if (now < promotion.validFrom || now > promotion.validUntil) {
        return { valid: false, error: 'Promo code has expired' };
      }

      if (promotion.maxUses && promotion.currentUses >= promotion.maxUses) {
        return { valid: false, error: 'Promo code usage limit reached' };
      }

      if (!promotion.targetPlans.includes(planId)) {
        return { valid: false, error: 'Promo code not valid for this plan' };
      }

      const isEligible = await this.checkEligibility(userId, promotion);
      if (!isEligible) {
        return { valid: false, error: 'You are not eligible for this promotion' };
      }

      const originalPrice = this.getPlanPrice(planId);
      const discount = this.calculateDiscount(originalPrice, promotion);

      return {
        valid: true,
        promotion,
        discount
      };

    } catch (error) {
      console.error('Failed to validate promo code:', error);
      return { valid: false, error: 'Failed to validate promo code' };
    }
  }

  /**
   * Get promotion usage analytics
   */
  async getPromotionAnalytics(promotionId: string): Promise<{
    totalUses: number;
    totalRevenue: number;
    totalDiscount: number;
    conversionRate: number;
    topPlans: { plan: string; uses: number }[];
    usageByDay: { date: string; uses: number }[];
  }> {
    try {
      // TODO: Get real analytics from database
      // For now, return mock data
      return {
        totalUses: 150,
        totalRevenue: 4250.00,
        totalDiscount: 2125.00,
        conversionRate: 85.2,
        topPlans: [
          { plan: 'pro', uses: 95 },
          { plan: 'starter', uses: 55 }
        ],
        usageByDay: [
          { date: '2025-01-01', uses: 12 },
          { date: '2025-01-02', uses: 18 },
          { date: '2025-01-03', uses: 15 }
        ]
      };

    } catch (error) {
      console.error('Failed to get promotion analytics:', error);
      return {
        totalUses: 0,
        totalRevenue: 0,
        totalDiscount: 0,
        conversionRate: 0,
        topPlans: [],
        usageByDay: []
      };
    }
  }

  /**
   * Send targeted promotion notifications
   */
  async sendTargetedPromotions(criteria: {
    userSegment?: 'new' | 'existing' | 'churned' | 'high_value';
    currentPlan?: string;
    accountAge?: { min?: number; max?: number };
    lastActiveDate?: { before?: Date; after?: Date };
  }): Promise<{ sent: number; failed: number }> {
    try {
      console.log('🎯 Sending targeted promotions with criteria:', criteria);
      
      // Get eligible users based on criteria
      const targetUsers = await this.getTargetUsers(criteria);
      
      // Get relevant promotions
      const relevantPromotions = await this.getRelevantPromotions(criteria);
      
      let sent = 0;
      let failed = 0;

      for (const user of targetUsers) {
        try {
          const userPromotions = await this.getActivePromotions(user.id);
          
          if (userPromotions.length > 0) {
            const bestPromotion = userPromotions[0]; // Get best promotion
            
            const success = await subscriptionNotificationService.sendNotification({
              type: 'subscription_created', // Would use promotion type
              userId: user.id,
              email: user.email || '',
              data: {
                promotionName: bestPromotion.name,
                promotionDescription: bestPromotion.description,
                discountValue: bestPromotion.value,
                validUntil: bestPromotion.validUntil.toLocaleDateString(),
                ctaUrl: 'https://coinrailz.com/subscription'
              }
            });

            if (success) {
              sent++;
            } else {
              failed++;
            }
          }

        } catch (error) {
          failed++;
          console.error(`Failed to send promotion to user ${user.id}:`, error);
        }
      }

      console.log(`🎯 Targeted promotions sent: ${sent} successful, ${failed} failed`);
      return { sent, failed };

    } catch (error) {
      console.error('Failed to send targeted promotions:', error);
      return { sent: 0, failed: 0 };
    }
  }

  // Helper methods
  private async getPromotionByCode(code: string): Promise<Promotion | null> {
    try {
      // TODO: Get from database
      // For now, return sample promotion if code matches
      if (code.toUpperCase() === 'WELCOME50') {
        return {
          id: 'new-user-50',
          name: 'Welcome Offer',
          description: '50% off your first month',
          type: 'percentage_off',
          value: 50,
          targetPlans: ['starter', 'pro'],
          validFrom: new Date('2025-01-01'),
          validUntil: new Date('2025-12-31'),
          maxUses: 1000,
          currentUses: 150,
          active: true,
          eligibilityCriteria: {
            newUsersOnly: true
          }
        };
      }
      return null;

    } catch (error) {
      console.error('Failed to get promotion by code:', error);
      return null;
    }
  }

  private async getPromotionById(id: string): Promise<Promotion | null> {
    try {
      // TODO: Get from database
      return null;
    } catch (error) {
      return null;
    }
  }

  private async checkEligibility(userId: string, promotion: Promotion): Promise<boolean> {
    try {
      const criteria = promotion.eligibilityCriteria;
      
      // Get user info
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) return false;

      // Check new users only
      if (criteria.newUsersOnly) {
        const hasSubscription = await db
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.userId, userId))
          .limit(1);
        
        if (hasSubscription.length > 0) return false;
      }

      // Check existing users only
      if (criteria.existingUsersOnly) {
        const hasSubscription = await db
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.userId, userId))
          .limit(1);
        
        if (hasSubscription.length === 0) return false;
      }

      // Check account age
      if (criteria.minAccountAge || criteria.maxAccountAge) {
        const accountAge = Math.floor(
          (Date.now() - (user.createdAt?.getTime() || Date.now())) / (1000 * 60 * 60 * 24)
        );

        if (criteria.minAccountAge && accountAge < criteria.minAccountAge) return false;
        if (criteria.maxAccountAge && accountAge > criteria.maxAccountAge) return false;
      }

      // Check required current plan
      if (criteria.requiredCurrentPlan) {
        const [currentSub] = await db
          .select()
          .from(subscriptions)
          .where(
            and(
              eq(subscriptions.userId, userId),
              eq(subscriptions.status, 'active')
            )
          )
          .orderBy(desc(subscriptions.createdAt))
          .limit(1);

        if (!currentSub || currentSub.planId !== criteria.requiredCurrentPlan) {
          return false;
        }
      }

      return true;

    } catch (error) {
      console.error('Failed to check eligibility:', error);
      return false;
    }
  }

  private calculateDiscount(originalPrice: number, promotion: Promotion): DiscountCalculation {
    let discountAmount = 0;
    
    switch (promotion.type) {
      case 'percentage_off':
        discountAmount = originalPrice * (promotion.value / 100);
        break;
      case 'fixed_discount':
        discountAmount = Math.min(promotion.value, originalPrice);
        break;
      case 'free_trial':
        discountAmount = originalPrice; // Full discount for trial
        break;
      case 'upgrade_discount':
        discountAmount = promotion.value;
        break;
    }

    const finalPrice = Math.max(0, originalPrice - discountAmount);
    const discountPercentage = originalPrice > 0 ? (discountAmount / originalPrice) * 100 : 0;

    return {
      originalPrice,
      discountAmount,
      finalPrice,
      discountPercentage,
      validUntil: promotion.validUntil,
      promotionName: promotion.name
    };
  }

  private getPlanPrice(planId: string): number {
    const prices: Record<string, number> = {
      'starter': 29,
      'pro': 99,
      'enterprise': 299
    };
    return prices[planId] || 0;
  }

  private generatePromotionId(): string {
    return `promo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateRandomCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private async trackPromoCodeUsage(code: string): Promise<void> {
    try {
      // TODO: Update promo code usage in database
      console.log(`📊 Tracked promo code usage: ${code}`);
    } catch (error) {
      console.error('Failed to track promo code usage:', error);
    }
  }

  private async trackPromotionUsage(promotionId: string): Promise<void> {
    try {
      // TODO: Update promotion usage in database
      console.log(`📊 Tracked promotion usage: ${promotionId}`);
    } catch (error) {
      console.error('Failed to track promotion usage:', error);
    }
  }

  private async getTargetUsers(criteria: any): Promise<{ id: string; email: string }[]> {
    try {
      // TODO: Query database based on criteria
      // For now, return mock users
      return [
        { id: 'user1', email: 'user1@example.com' },
        { id: 'user2', email: 'user2@example.com' }
      ];
    } catch (error) {
      return [];
    }
  }

  private async getRelevantPromotions(criteria: any): Promise<Promotion[]> {
    try {
      // TODO: Get promotions relevant to criteria
      return [];
    } catch (error) {
      return [];
    }
  }
}

export const subscriptionPromotionsService = new SubscriptionPromotionsService();