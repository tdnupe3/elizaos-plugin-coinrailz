/**
 * AI Marketplace Core Service
 * Handles order processing, escrow payments, delivery verification, and commission calculation
 */

import { db } from '../db';
import { storage } from '../storage';
import {
  aiMarketplaceOrders,
  aiMarketplaceDeliveries,
  aiMarketplaceDisputes,
  aiMarketplaceCommissions,
  aiMarketplacePerformance,
  aiMarketplaceSuspensions,
  aiMarketplaceCategories,
  aiMarketplaceServices,
  globalAIAgents,
  users,
  type AIMarketplaceOrder,
  type InsertAIMarketplaceOrder,
  type AIMarketplaceDelivery,
  type InsertAIMarketplaceDelivery,
  type AIMarketplaceCommission,
  type InsertAIMarketplaceCommission,
  type AIMarketplacePerformance,
  type AIMarketplaceDispute,
  type InsertAIMarketplaceDispute,
} from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

export class AIMarketplaceCore {
  
  /**
   * Create a service order with escrow payment protection
   */
  static async createOrder(orderData: {
    agentId: string;
    customerId: string;
    serviceType: string;
    amount: number;
    paymentMethod: string;
    serviceDescription: string;
    deliverables?: any;
    customerRequirements?: any;
    estimatedDeliveryHours?: number;
  }): Promise<{ success: boolean; orderId?: string; error?: string }> {
    
    try {
      // Validate minimum transaction amount
      const MINIMUM_ORDER_AMOUNT = 25; // $25 minimum to ensure profitability
      if (orderData.amount < MINIMUM_ORDER_AMOUNT) {
        return { 
          success: false, 
          error: `Minimum order amount is $${MINIMUM_ORDER_AMOUNT}. This ensures quality service delivery and platform sustainability.` 
        };
      }

      // Validate agent exists and is active
      const agent = await db.select()
        .from(globalAIAgents)
        .where(eq(globalAIAgents.id, orderData.agentId))
        .limit(1);
      
      if (!agent.length || agent[0].status !== 'active') {
        return { success: false, error: 'Agent not found or inactive' };
      }

      // Calculate commission structure (85% agent, 15% platform)
      const agentCommission = Math.floor(orderData.amount * 85); // Cents
      const platformFee = orderData.amount * 100 - agentCommission; // Remaining cents

      const newOrder: InsertAIMarketplaceOrder = {
        agentId: orderData.agentId,
        customerId: orderData.customerId,
        serviceType: orderData.serviceType,
        amount: (orderData.amount * 100).toString(), // Store as cents
        agentCommission: agentCommission.toString(),
        platformFee: platformFee.toString(),
        status: 'pending',
        paymentMethod: orderData.paymentMethod,
        serviceDescription: orderData.serviceDescription,
        customerRequirements: orderData.customerRequirements
          ? JSON.stringify(orderData.customerRequirements)
          : null,
        estimatedDeliveryHours: orderData.estimatedDeliveryHours || 24,
      };

      const [order] = await db.insert(aiMarketplaceOrders)
        .values(newOrder)
        .returning();

      // Create commission record
      await this.createCommissionRecord(order.id, orderData.agentId, orderData.amount);

      // Update agent performance
      await this.updateAgentPerformance(orderData.agentId, 'new_order');

      return { success: true, orderId: order.id };
      
    } catch (error) {
      console.error('Error creating marketplace order:', error);
      return { success: false, error: 'Failed to create order' };
    }
  }

  /**
   * Process service delivery and verification
   */
  static async submitDelivery(deliveryData: {
    orderId: string;
    agentId: string;
    deliveryMethod: string;
    deliveryContent: any;
    deliveryFiles?: string[];
    evidenceUrls?: string[];
  }): Promise<{ success: boolean; deliveryId?: string; error?: string }> {
    
    try {
      // Validate order exists and agent owns it
      const order = await db.select()
        .from(aiMarketplaceOrders)
        .where(eq(aiMarketplaceOrders.id, deliveryData.orderId))
        .limit(1);
      
      if (!order.length || order[0].agentId !== deliveryData.agentId) {
        return { success: false, error: 'Order not found or access denied' };
      }

      if (order[0].status !== 'paid') {
        return { success: false, error: 'Order must be paid before delivery' };
      }

      // Create auto-release timestamp (72 hours from now)
      const autoReleaseAt = new Date();
      autoReleaseAt.setHours(autoReleaseAt.getHours() + 72);

      const newDelivery: InsertAIMarketplaceDelivery = {
        orderId: deliveryData.orderId,
        agentId: deliveryData.agentId,
        deliveryMethod: deliveryData.deliveryMethod,
        deliveryContent: deliveryData.deliveryContent,
        deliveryFiles: deliveryData.deliveryFiles || null,
        evidenceUrls: deliveryData.evidenceUrls || null,
        autoReleaseAt,
      };

      const [delivery] = await db.insert(aiMarketplaceDeliveries)
        .values(newDelivery)
        .returning();

      // Update order status
      await db.update(aiMarketplaceOrders)
        .set({ 
          status: 'delivered',
          completedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(aiMarketplaceOrders.id, deliveryData.orderId));

      return { success: true, deliveryId: delivery.id };
      
    } catch (error) {
      console.error('Error submitting delivery:', error);
      return { success: false, error: 'Failed to submit delivery' };
    }
  }

  /**
   * Customer verification of delivery and payment release
   */
  static async verifyDelivery(verificationData: {
    orderId: string;
    customerId: string;
    confirmed: boolean;
    qualityScore?: number;
    feedback?: string;
  }): Promise<{ success: boolean; paymentReleased?: boolean; error?: string }> {
    
    try {
      // Get delivery record
      const delivery = await db.select()
        .from(aiMarketplaceDeliveries)
        .innerJoin(aiMarketplaceOrders, eq(aiMarketplaceDeliveries.orderId, aiMarketplaceOrders.id))
        .where(eq(aiMarketplaceDeliveries.orderId, verificationData.orderId))
        .limit(1);
      
      if (!delivery.length) {
        return { success: false, error: 'Delivery not found' };
      }

      const order = delivery[0].ai_marketplace_orders;
      if (order.customerId !== verificationData.customerId) {
        return { success: false, error: 'Access denied' };
      }

      // Update delivery record
      await db.update(aiMarketplaceDeliveries)
        .set({
          customerConfirmed: verificationData.confirmed,
          confirmationTimestamp: new Date(),
          qualityScore: verificationData.qualityScore?.toString() || null,
          customerFeedback: verificationData.feedback || null,
        })
        .where(eq(aiMarketplaceDeliveries.orderId, verificationData.orderId));

      let paymentReleased = false;

      if (verificationData.confirmed) {
        // Release payment from escrow
        await this.releaseEscrowPayment(verificationData.orderId, 'customer_verified');
        paymentReleased = true;

        // Update agent performance
        await this.updateAgentPerformance(order.agentId, 'completed_order', verificationData.qualityScore);
      }

      return { success: true, paymentReleased };
      
    } catch (error) {
      console.error('Error verifying delivery:', error);
      return { success: false, error: 'Failed to verify delivery' };
    }
  }

  /**
   * Release escrow payment to agent
   */
  static async releaseEscrowPayment(orderId: string, reason: string): Promise<boolean> {
    try {
      // Update order status
      await db.update(aiMarketplaceOrders)
        .set({
          status: 'completed',
          updatedAt: new Date()
        })
        .where(eq(aiMarketplaceOrders.id, orderId));

      // Update commission payout status
      await db.update(aiMarketplaceCommissions)
        .set({
          payoutStatus: 'processing',
          paidAt: new Date()
        })
        .where(eq(aiMarketplaceCommissions.orderId, orderId));

      // In production, trigger actual payout via XRP/crypto
      // For now, mark as completed
      setTimeout(async () => {
        await db.update(aiMarketplaceCommissions)
          .set({ payoutStatus: 'completed' })
          .where(eq(aiMarketplaceCommissions.orderId, orderId));
      }, 1000);

      return true;
    } catch (error) {
      console.error('Error releasing escrow payment:', error);
      return false;
    }
  }

  /**
   * Calculate commission structure for order
   */
  static async calculateCommission(data: {
    serviceAmount: number;
    agentTier: string;
    serviceType: string;
  }): Promise<{
    success: boolean;
    commission?: number;
    platformFee?: number;
    commissionRate?: number;
    platformFeeRate?: number;
    error?: string;
  }> {
    
    try {
      // Tier-based commission rates
      const tierRates = {
        basic: 0.85,     // 85% to agent, 15% platform
        premium: 0.87,   // 87% to agent, 13% platform  
        enterprise: 0.90 // 90% to agent, 10% platform
      };

      const commissionRate = tierRates[data.agentTier as keyof typeof tierRates] || 0.85;
      const platformFeeRate = 1 - commissionRate;

      const commission = Math.floor(data.serviceAmount * commissionRate * 100); // Cents
      const platformFee = (data.serviceAmount * 100) - commission; // Remaining cents

      return {
        success: true,
        commission,
        platformFee,
        commissionRate,
        platformFeeRate
      };
      
    } catch (error) {
      console.error('Error calculating commission:', error);
      return { success: false, error: 'Failed to calculate commission' };
    }
  }

  /**
   * Process refund for disputed or cancelled orders
   */
  static async processRefund(refundData: {
    orderId: string;
    refundReason: string;
    amount?: number;
    moderatorId?: string;
  }): Promise<{ success: boolean; refundAmount?: number; error?: string }> {
    
    try {
      const order = await db.select()
        .from(aiMarketplaceOrders)
        .where(eq(aiMarketplaceOrders.id, refundData.orderId))
        .limit(1);
      
      if (!order.length) {
        return { success: false, error: 'Order not found' };
      }

      const refundAmount = refundData.amount || parseInt(order[0].amount);

      // Update order status
      await db.update(aiMarketplaceOrders)
        .set({
          status: 'refunded',
          updatedAt: new Date()
        })
        .where(eq(aiMarketplaceOrders.id, refundData.orderId));

      // Update commission status
      await db.update(aiMarketplaceCommissions)
        .set({ payoutStatus: 'cancelled' })
        .where(eq(aiMarketplaceCommissions.orderId, refundData.orderId));

      // Update agent performance (negative impact)
      await this.updateAgentPerformance(order[0].agentId, 'refund');

      return { success: true, refundAmount };
      
    } catch (error) {
      console.error('Error processing refund:', error);
      return { success: false, error: 'Failed to process refund' };
    }
  }

  /**
   * Create commission record for order
   */
  private static async createCommissionRecord(orderId: string, agentId: string, serviceAmount: number): Promise<void> {
    const commissionData: InsertAIMarketplaceCommission = {
      orderId,
      agentId,
      agentTier: 'basic', // Default tier, should be fetched from agent profile
      serviceAmount: (serviceAmount * 100).toString(),
      commissionRate: '0.85',
      commissionAmount: (Math.floor(serviceAmount * 85)).toString(),
      platformFeeRate: '0.15',
      platformFeeAmount: (serviceAmount * 100 - Math.floor(serviceAmount * 85)).toString(),
      payoutStatus: 'pending',
    };

    await db.insert(aiMarketplaceCommissions).values(commissionData);
  }

  /**
   * Update agent performance metrics
   */
  private static async updateAgentPerformance(
    agentId: string, 
    action: 'new_order' | 'completed_order' | 'refund', 
    rating?: number
  ): Promise<void> {
    
    try {
      // Get or create performance record
      let performance = await db.select()
        .from(aiMarketplacePerformance)
        .where(eq(aiMarketplacePerformance.agentId, agentId))
        .limit(1);

      if (!performance.length) {
        // Create new performance record
        await db.insert(aiMarketplacePerformance).values({
          agentId,
          totalOrders: action === 'new_order' ? 1 : 0,
          completedOrders: action === 'completed_order' ? 1 : 0,
          averageRating: rating ? rating.toString() : '0.0',
          totalRatings: rating ? 1 : 0,
        });
        return;
      }

      const current = performance[0];
      const updates: Partial<AIMarketplacePerformance> = {};

      switch (action) {
        case 'new_order':
          updates.totalOrders = current.totalOrders + 1;
          break;
          
        case 'completed_order':
          updates.completedOrders = current.completedOrders + 1;
          updates.completionRate = ((current.completedOrders + 1) / current.totalOrders).toString();
          
          if (rating) {
            const newTotalRatings = current.totalRatings + 1;
            const currentAverage = parseFloat(current.averageRating || '0');
            const newAverage = ((currentAverage * current.totalRatings) + rating) / newTotalRatings;
            updates.averageRating = newAverage.toFixed(2);
            updates.totalRatings = newTotalRatings;
          }
          break;
          
        case 'refund':
          updates.disputeCount = current.disputeCount + 1;
          updates.disputeRate = ((current.disputeCount + 1) / current.totalOrders).toString();
          const newPerformanceScore = Math.max(0, parseFloat(current.performanceScore) - 5);
          updates.performanceScore = newPerformanceScore.toString();
          break;
      }

      updates.updatedAt = new Date();

      await db.update(aiMarketplacePerformance)
        .set(updates)
        .where(eq(aiMarketplacePerformance.agentId, agentId));
        
    } catch (error) {
      console.error('Error updating agent performance:', error);
    }
  }

  /**
   * Get agent performance metrics
   */
  static async getAgentPerformance(agentId: string): Promise<AIMarketplacePerformance | null> {
    try {
      const performance = await db.select()
        .from(aiMarketplacePerformance)
        .where(eq(aiMarketplacePerformance.agentId, agentId))
        .limit(1);
        
      return performance.length ? performance[0] : null;
    } catch (error) {
      console.error('Error fetching agent performance:', error);
      return null;
    }
  }

  /**
   * Suspend agent for policy violations
   */
  static async suspendAgent(suspensionData: {
    agentId: string;
    reason: string;
    suspensionType: 'temporary' | 'permanent' | 'warning';
    suspensionDuration?: number;
    moderatorId?: string;
    description: string;
    evidenceUrls?: string[];
  }): Promise<{ success: boolean; error?: string }> {
    
    try {
      // Create suspension record
      const expiresAt = suspensionData.suspensionDuration
        ? new Date(Date.now() + suspensionData.suspensionDuration * 24 * 60 * 60 * 1000)
        : null;

      await db.insert(aiMarketplaceSuspensions).values({
        agentId: suspensionData.agentId,
        reason: suspensionData.reason,
        suspensionType: suspensionData.suspensionType,
        suspensionDuration: suspensionData.suspensionDuration || null,
        moderatorId: suspensionData.moderatorId || null,
        description: suspensionData.description,
        evidenceUrls: suspensionData.evidenceUrls || null,
        expiresAt,
      });

      // Update agent status
      const newStatus = suspensionData.suspensionType === 'permanent' ? 'suspended' : 'inactive';
      await db.update(globalAIAgents)
        .set({ status: newStatus })
        .where(eq(globalAIAgents.id, suspensionData.agentId));

      // Update performance record
      await this.updateAgentPerformance(suspensionData.agentId, 'refund'); // Negative impact

      return { success: true };
      
    } catch (error) {
      console.error('Error suspending agent:', error);
      return { success: false, error: 'Failed to suspend agent' };
    }
  }

  /**
   * Create dispute for order
   */
  static async createDispute(disputeData: {
    orderId: string;
    customerId: string;
    disputeType: string;
    customerStatement: string;
    evidenceUrls?: string[];
  }): Promise<{ success: boolean; disputeId?: string; error?: string }> {
    
    try {
      // Validate order and customer
      const order = await db.select()
        .from(aiMarketplaceOrders)
        .where(eq(aiMarketplaceOrders.id, disputeData.orderId))
        .limit(1);
      
      if (!order.length || order[0].customerId !== disputeData.customerId) {
        return { success: false, error: 'Order not found or access denied' };
      }

      const newDispute: InsertAIMarketplaceDispute = {
        orderId: disputeData.orderId,
        customerId: disputeData.customerId,
        agentId: order[0].agentId,
        disputeType: disputeData.disputeType,
        customerStatement: disputeData.customerStatement,
        evidenceUrls: disputeData.evidenceUrls || null,
      };

      const [dispute] = await db.insert(aiMarketplaceDisputes)
        .values(newDispute)
        .returning();

      // Update order status
      await db.update(aiMarketplaceOrders)
        .set({ 
          status: 'disputed',
          updatedAt: new Date()
        })
        .where(eq(aiMarketplaceOrders.id, disputeData.orderId));

      return { success: true, disputeId: dispute.id };
      
    } catch (error) {
      console.error('Error creating dispute:', error);
      return { success: false, error: 'Failed to create dispute' };
    }
  }

  /**
   * Check for fraudulent activity patterns
   */
  static async checkFraud(fraudData: {
    agentId: string;
    activityPattern: string;
    timeframe: string;
  }): Promise<{ success: boolean; fraudDetected?: boolean; riskScore?: number; error?: string }> {
    
    try {
      // Basic fraud detection - can be enhanced with ML models
      const performance = await this.getAgentPerformance(fraudData.agentId);
      
      if (!performance) {
        return { success: true, fraudDetected: false, riskScore: 0 };
      }

      let riskScore = 0;

      // High dispute rate indicates potential fraud
      if (performance.disputeRate && parseFloat(performance.disputeRate) > 0.2) {
        riskScore += 30;
      }

      // Low completion rate
      if (performance.completionRate && parseFloat(performance.completionRate) < 0.7) {
        riskScore += 25;
      }

      // Low average rating
      if (performance.averageRating && parseFloat(performance.averageRating) < 2.0) {
        riskScore += 20;
      }

      // Multiple suspensions
      if (performance.suspensionCount > 1) {
        riskScore += 25;
      }

      const fraudDetected = riskScore >= 50;

      return { 
        success: true, 
        fraudDetected, 
        riskScore 
      };
      
    } catch (error) {
      console.error('Error checking fraud:', error);
      return { success: false, error: 'Failed to check fraud' };
    }
  }
}