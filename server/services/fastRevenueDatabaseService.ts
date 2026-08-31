/**
 * 💾 FAST REVENUE DATABASE SERVICE
 * FIXES CRITICAL ENTERPRISE GAPS - Replaces in-memory storage with real database persistence
 */

import { db } from '../db';
import { 
  fastRevenueRecords, 
  fastPremiumCredits, 
  fastCreditUsage,
  type InsertFastRevenueRecord,
  type InsertFastPremiumCredit,
  type InsertFastCreditUsage,
  type FastPremiumCredit
} from '../../shared/schema';
import { eq, sql } from 'drizzle-orm';

export class FastRevenueDatabaseService {
  private static instance: FastRevenueDatabaseService;

  private constructor() {}

  public static getInstance(): FastRevenueDatabaseService {
    if (!FastRevenueDatabaseService.instance) {
      FastRevenueDatabaseService.instance = new FastRevenueDatabaseService();
    }
    return FastRevenueDatabaseService.instance;
  }

  /**
   * 💰 Record Revenue Transaction (DATABASE PERSISTENCE)
   */
  async recordRevenue(
    amount: number, 
    transactionId: string, 
    userId: string, 
    service: string,
    paymentProvider: string = 'stripe'
  ): Promise<void> {
    try {
      const revenueRecord: InsertFastRevenueRecord = {
        stripePaymentIntentId: transactionId,
        amount: amount.toString(),
        currency: 'USD',
        service,
        userId,
        metadata: {
          timestamp: new Date().toISOString(),
          source: 'fast_revenue_service',
          paymentProvider,
        },
      };

      await db.insert(fastRevenueRecords).values(revenueRecord);
      console.log(`💾 Revenue recorded in database: $${amount} from ${service} (${transactionId})`);
    } catch (error) {
      console.error('❌ Failed to record revenue in database:', error);
      throw error;
    }
  }

  /**
   * 💳 Purchase Premium Credits (DATABASE PERSISTENCE)
   */
  async purchasePremiumCredits(
    userId: string,
    tier: 'basic' | 'premium' | 'enterprise',
    creditAmount: number,
    paymentIntentId: string,
    pricePerCredit: number
  ): Promise<{ packageId: string; creditsAdded: number; totalCost: number }> {
    try {
      const totalCost = creditAmount * pricePerCredit;
      const expiresAt = new Date(Date.now() + (365 * 24 * 60 * 60 * 1000)); // 1 year

      const creditPackage: InsertFastPremiumCredit = {
        userId,
        credits: creditAmount.toString(),
        tier,
        pricePerCredit: pricePerCredit.toString(),
        remainingCredits: creditAmount.toString(),
        purchaseTransactionId: paymentIntentId,
        expiresAt
      };

      const result = await db.insert(fastPremiumCredits).values(creditPackage).returning();
      const packageId = result[0]?.id || 'unknown';

      console.log(`💾 Premium credits stored in database: ${creditAmount} ${tier} credits for user ${userId}`);
      
      return {
        packageId,
        creditsAdded: creditAmount,
        totalCost
      };
    } catch (error) {
      console.error('❌ Failed to store premium credits in database:', error);
      throw error;
    }
  }

  /**
   * 💸 Spend Credits for A2A Messages (DATABASE PERSISTENCE)
   */
  async spendCreditsForMessage(
    userId: string, 
    creditCost: number,
    messageContent: string,
    targetAgent: string
  ): Promise<boolean> {
    try {
      // Get user's available credits
      const userCredits = await db
        .select()
        .from(fastPremiumCredits)
        .where(eq(fastPremiumCredits.userId, userId));

      const totalCredits = userCredits.reduce((sum, pkg) => sum + parseFloat(pkg.credits), 0);
      
      if (totalCredits < creditCost) {
        console.log(`❌ Insufficient credits: ${totalCredits} available, ${creditCost} required (User: ${userId})`);
        return false;
      }

      // Deduct credits from available packages (FIFO)
      let remainingCost = creditCost;
      
      for (const package_ of userCredits) {
        if (remainingCost <= 0) break;
        
        const deduction = Math.min(parseFloat(package_.credits), remainingCost);
        const newCredits = parseFloat(package_.credits) - deduction;
        
        // Update package credits
        await db
          .update(fastPremiumCredits)
          .set({ credits: newCredits.toString() })
          .where(eq(fastPremiumCredits.id, package_.id));

        // Log the usage
        const usage: InsertFastCreditUsage = {
          userId,
          creditsSpent: deduction.toString(),
          creditPackageId: package_.id,
          service: 'a2a_messaging',
          serviceDetails: {
            targetAgent,
            messageContent: messageContent.substring(0, 100), // Truncate for storage
            timestamp: new Date().toISOString()
          }
        };

        await db.insert(fastCreditUsage).values(usage);
        
        remainingCost -= deduction;
      }

      const remainingCredits = totalCredits - creditCost;
      console.log(`💳 Credits spent: ${creditCost} | Remaining: ${remainingCredits} (User: ${userId})`);
      return true;
      
    } catch (error) {
      console.error('❌ Failed to spend credits in database:', error);
      return false;
    }
  }

  /**
   * 📊 Get User Credit Balance (DATABASE PERSISTENCE)
   */
  async getUserCredits(userId: string): Promise<{ 
    credits: number; 
    tier: string; 
    packages: Array<{ id: string; credits: number; tier: string; expires_at: string }>;
    expires_at: string;
  } | null> {
    try {
      const userCredits = await db
        .select()
        .from(fastPremiumCredits)
        .where(eq(fastPremiumCredits.userId, userId));

      if (userCredits.length === 0) {
        return null;
      }

      const totalCredits = userCredits.reduce((sum, pkg) => sum + parseFloat(pkg.credits), 0);
      const highestTier = userCredits.reduce((highest, pkg) => {
        const tierPriority = { basic: 1, premium: 2, enterprise: 3 };
        return tierPriority[pkg.tier as keyof typeof tierPriority] > tierPriority[highest as keyof typeof tierPriority] 
          ? pkg.tier : highest;
      }, 'basic');

      const earliestExpiry = userCredits.reduce((earliest, pkg) => {
        return pkg.expiresAt < earliest ? pkg.expiresAt : earliest;
      }, userCredits[0].expiresAt);

      return {
        credits: totalCredits,
        tier: highestTier,
        packages: userCredits.map(pkg => ({
          id: pkg.id,
          credits: parseFloat(pkg.credits),
          tier: pkg.tier,
          expires_at: pkg.expiresAt.toISOString()
        })),
        expires_at: earliestExpiry.toISOString()
      };
    } catch (error) {
      console.error('❌ Failed to get user credits from database:', error);
      return null;
    }
  }

  /**
   * 🎯 Store Campaign Conversion (DATABASE PERSISTENCE)
   */
  async storeCampaignConversion(conversion: any): Promise<void> {
    try {
      // Store in fast revenue records for now - can be extended with dedicated table
      const revenueRecord = {
        stripePaymentIntentId: conversion.payment_intent_id || 'pending',
        amount: conversion.amount.toString(),
        currency: 'USD',
        service: `campaign_${conversion.campaign_type}`,
        userId: conversion.customer_email,
        paymentProvider: 'stripe',
        metadata: {
          ...conversion.metadata,
          conversion_id: conversion.id,
          campaign_id: conversion.campaign_id,
          session_id: conversion.session_id
        }
      };
      
      await db.insert(fastRevenueRecords).values(revenueRecord);
      console.log(`💾 Campaign conversion stored: ${conversion.id} (${conversion.campaign_type})`);
    } catch (error) {
      console.error('❌ Failed to store campaign conversion:', error);
      throw error;
    }
  }

  /**
   * 📊 Track Revenue Metric (DATABASE PERSISTENCE)
   */
  async trackRevenueMetric(metric: any): Promise<void> {
    try {
      // Store metric in revenue records with special service type
      const metricRecord = {
        stripePaymentIntentId: `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        amount: metric.value.toString(),
        currency: 'USD',
        service: `metric_${metric.metric_type}`,
        userId: 'system',
        paymentProvider: 'internal',
        metadata: metric.metadata || {}
      };
      
      await db.insert(fastRevenueRecords).values(metricRecord);
      console.log(`📊 Revenue metric tracked: ${metric.metric_type} = ${metric.value}`);
    } catch (error) {
      console.error('❌ Failed to track revenue metric:', error);
      // Don't throw - metrics tracking shouldn't break main flow
    }
  }

  /**
   * 🔄 Update Campaign Conversion (DATABASE PERSISTENCE)
   */
  async updateCampaignConversion(campaignId: string, customerEmail: string, updates: any): Promise<void> {
    try {
      // Update by matching campaign metadata
      await db
        .update(fastRevenueRecords)
        .set({
          metadata: sql`metadata || ${JSON.stringify(updates)}`,
          updatedAt: new Date()
        })
        .where(sql`metadata->>'campaign_id' = ${campaignId} AND user_id = ${customerEmail}`);
      
      console.log(`🔄 Campaign conversion updated: ${campaignId} for ${customerEmail}`);
    } catch (error) {
      console.error('❌ Failed to update campaign conversion:', error);
      throw error;
    }
  }

  /**
   * 💳 Update Campaign Conversion by Payment (DATABASE PERSISTENCE)
   */
  async updateCampaignConversionByPayment(paymentId: string, updates: any): Promise<void> {
    try {
      await db
        .update(fastRevenueRecords)
        .set({
          metadata: sql`metadata || ${JSON.stringify(updates)}`,
          updatedAt: new Date()
        })
        .where(eq(fastRevenueRecords.stripePaymentIntentId, paymentId));
      
      console.log(`💳 Campaign payment updated: ${paymentId}`);
    } catch (error) {
      console.error('❌ Failed to update campaign payment:', error);
      throw error;
    }
  }

  /**
   * 🎁 Store Conversion Offer (DATABASE PERSISTENCE)
   */
  async storeConversionOffer(offer: any): Promise<void> {
    try {
      const offerRecord = {
        stripePaymentIntentId: offer.id,
        amount: offer.amount.toString(),
        currency: 'USD',
        service: `offer_${offer.offer_type}`,
        userId: offer.session_id || 'anonymous',
        paymentProvider: 'pending',
        metadata: {
          offer_type: offer.offer_type,
          session_id: offer.session_id,
          session_type: offer.session_type,
          expires_at: offer.expires_at,
          status: offer.status
        }
      };
      
      await db.insert(fastRevenueRecords).values(offerRecord);
      console.log(`🎁 Conversion offer stored: ${offer.id}`);
    } catch (error) {
      console.error('❌ Failed to store conversion offer:', error);
      throw error;
    }
  }

  /**
   * 📈 Get Campaign Analytics (DATABASE PERSISTENCE)
   */
  async getCampaignAnalytics(): Promise<any> {
    try {
      const campaignData = await db
        .select()
        .from(fastRevenueRecords)
        .where(sql`service LIKE 'campaign_%' OR service LIKE 'metric_%'`);

      const conversions = campaignData.filter(r => r.service.startsWith('campaign_'));
      const metrics = campaignData.filter(r => r.service.startsWith('metric_'));

      return {
        total_conversions: conversions.length,
        total_revenue: conversions.reduce((sum, c) => sum + parseFloat(c.amount), 0),
        conversion_by_type: conversions.reduce((acc: any, c) => {
          const type = c.service.replace('campaign_', '');
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        }, {}),
        revenue_by_type: conversions.reduce((acc: any, c) => {
          const type = c.service.replace('campaign_', '');
          acc[type] = (acc[type] || 0) + parseFloat(c.amount);
          return acc;
        }, {}),
        recent_conversions: conversions.slice(-10)
      };
    } catch (error) {
      console.error('❌ Failed to get campaign analytics:', error);
      return {
        total_conversions: 0,
        total_revenue: 0,
        conversion_by_type: {},
        revenue_by_type: {},
        recent_conversions: []
      };
    }
  }

  /**
   * 📈 Get Revenue Statistics (DATABASE PERSISTENCE)
   */
  async getRevenueStats(): Promise<{
    totalRevenue: number;
    transactionCount: number;
    recentTransactions: Array<any>;
  }> {
    try {
      const revenueData = await db
        .select({
          totalRevenue: sql<number>`SUM(${fastRevenueRecords.amount})`,
          transactionCount: sql<number>`COUNT(*)`
        })
        .from(fastRevenueRecords);

      const recentTransactions = await db
        .select()
        .from(fastRevenueRecords)
        .orderBy(sql`${fastRevenueRecords.createdAt} DESC`)
        .limit(10);

      return {
        totalRevenue: revenueData[0]?.totalRevenue || 0,
        transactionCount: revenueData[0]?.transactionCount || 0,
        recentTransactions
      };
    } catch (error) {
      console.error('❌ Failed to get revenue stats from database:', error);
      return {
        totalRevenue: 0,
        transactionCount: 0,
        recentTransactions: []
      };
    }
  }
}