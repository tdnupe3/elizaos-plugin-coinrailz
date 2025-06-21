/**
 * Consolidated Services - Phase 2 Platform Optimization
 * Merges 95+ duplicate services into unified, efficient systems
 * Preserves all functionality while eliminating conflicts and redundancy
 */

import { storage } from "./storage";
import { BusinessLogicValidator } from "./businessLogic";

// ===== UNIFIED FEE CALCULATOR =====
export class UnifiedFeeCalculator {
  // Standard platform fee rates
  private static readonly FEE_RATES = {
    P2P_TRANSFER: 0.01, // 1%
    AI_AGENT_COMMISSION: 0.15, // 15%
    CRYPTO_EXCHANGE: 0.005, // 0.5%
    REFERRAL_COMMISSION: 0.003, // 0.3%
    MINIMUM_AMOUNT: 10.00, // $10 minimum
    MINIMUM_PAYMENT: 5.00 // $5 minimum for payments
  };

  static calculateP2PFee(amount: number): { fee: number; netAmount: number; isValid: boolean } {
    if (amount < this.FEE_RATES.MINIMUM_AMOUNT) {
      return { fee: 0, netAmount: 0, isValid: false };
    }

    const fee = Math.round(amount * this.FEE_RATES.P2P_TRANSFER * 100) / 100;
    const netAmount = amount - fee;

    return { fee, netAmount, isValid: true };
  }

  static calculateAIAgentCommission(transactionAmount: number): { platformFee: number; agentShare: number } {
    const platformFee = Math.round(transactionAmount * this.FEE_RATES.AI_AGENT_COMMISSION * 100) / 100;
    const agentShare = transactionAmount - platformFee;
    
    return { platformFee, agentShare };
  }

  static calculateReferralCommission(transactionAmount: number, tierMultiplier: number = 1): number {
    return Math.round(transactionAmount * this.FEE_RATES.REFERRAL_COMMISSION * tierMultiplier * 100) / 100;
  }

  static validateTransactionAmount(amount: number, type: 'transfer' | 'payment'): boolean {
    const minimum = type === 'transfer' ? this.FEE_RATES.MINIMUM_AMOUNT : this.FEE_RATES.MINIMUM_PAYMENT;
    return amount >= minimum;
  }
}

// ===== UNIFIED PAYMENT PROCESSOR =====
export class UnifiedPaymentProcessor {
  private static instance: UnifiedPaymentProcessor;

  static getInstance(): UnifiedPaymentProcessor {
    if (!this.instance) {
      this.instance = new UnifiedPaymentProcessor();
    }
    return this.instance;
  }

  async processPayment(paymentData: {
    amount: number;
    currency: string;
    fromUserId: string;
    toUserId?: string;
    type: 'p2p' | 'agent_payment' | 'crypto_exchange';
    metadata?: any;
  }): Promise<{ success: boolean; transactionId?: string; error?: string }> {
    
    // Validate payment amount
    const isValidAmount = UnifiedFeeCalculator.validateTransactionAmount(
      paymentData.amount, 
      paymentData.type === 'p2p' ? 'transfer' : 'payment'
    );

    if (!isValidAmount) {
      return { 
        success: false, 
        error: `Minimum amount required: $${paymentData.type === 'p2p' ? '10.00' : '5.00'}` 
      };
    }

    // Calculate fees
    let feeCalculation;
    if (paymentData.type === 'p2p') {
      feeCalculation = UnifiedFeeCalculator.calculateP2PFee(paymentData.amount);
    } else if (paymentData.type === 'agent_payment') {
      feeCalculation = UnifiedFeeCalculator.calculateAIAgentCommission(paymentData.amount);
    }

    // Create transaction record
    const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      await storage.createTransaction({
        id: transactionId,
        fromUserId: paymentData.fromUserId,
        toUserId: paymentData.toUserId || null,
        amount: paymentData.amount.toString(),
        currency: paymentData.currency,
        type: paymentData.type,
        status: 'completed',
        platformFee: feeCalculation?.fee?.toString() || '0',
        metadata: paymentData.metadata || null
      });

      return { success: true, transactionId };
    } catch (error: any) {
      return { success: false, error: error.message || 'Payment processing failed' };
    }
  }

  async getPaymentHistory(userId: string, limit: number = 50): Promise<any[]> {
    return await storage.getUserTransactions(userId);
  }
}

// ===== UNIFIED AGENT MARKETPLACE =====
export class UnifiedAgentMarketplace {
  private static instance: UnifiedAgentMarketplace;

  static getInstance(): UnifiedAgentMarketplace {
    if (!this.instance) {
      this.instance = new UnifiedAgentMarketplace();
    }
    return this.instance;
  }

  async registerAgent(agentData: {
    name: string;
    capabilities: string[];
    serviceTypes: string[];
    userId?: string;
    tier: 'basic' | 'premium' | 'enterprise';
  }): Promise<{ success: boolean; agentId?: string; error?: string }> {

    // Validate agent data
    const validation = BusinessLogicValidator.validateAIAgentRegistration(agentData);
    if (!validation.isValid) {
      return { success: false, error: validation.errors[0] };
    }

    const agentId = `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      await storage.createGlobalAIAgent({
        id: agentId,
        name: agentData.name,
        capabilities: agentData.capabilities,
        serviceTypes: agentData.serviceTypes,
        userId: agentData.userId || null,
        tier: agentData.tier,
        status: 'active',
        totalRevenue: 0,
        totalTransactions: 0,
        averageRating: 5.0,
        isVerified: agentData.tier !== 'basic'
      });

      return { success: true, agentId };
    } catch (error: any) {
      return { success: false, error: error.message || 'Agent registration failed' };
    }
  }

  async getActiveAgents(limit: number = 20): Promise<any[]> {
    return await storage.getActiveAIAgents(limit);
  }

  async processAgentPayment(agentId: string, amount: number, clientUserId: string): Promise<any> {
    const commission = UnifiedFeeCalculator.calculateAIAgentCommission(amount);
    
    const paymentProcessor = UnifiedPaymentProcessor.getInstance();
    return await paymentProcessor.processPayment({
      amount: commission.agentShare,
      currency: 'USD',
      fromUserId: clientUserId,
      toUserId: agentId,
      type: 'agent_payment',
      metadata: { platformFee: commission.platformFee }
    });
  }
}

// ===== UNIFIED REFERRAL SYSTEM =====
export class UnifiedReferralSystem {
  private static instance: UnifiedReferralSystem;

  static getInstance(): UnifiedReferralSystem {
    if (!this.instance) {
      this.instance = new UnifiedReferralSystem();
    }
    return this.instance;
  }

  async processReferral(referralData: {
    referrerId: string;
    referredUserId: string;
    transactionAmount: number;
    type: 'human' | 'agent';
  }): Promise<{ success: boolean; commission?: number; error?: string }> {

    // Calculate tiered commission
    const tierMultiplier = referralData.type === 'human' ? 1.0 : 0.5; // Human referrals get full rate
    const commission = UnifiedFeeCalculator.calculateReferralCommission(
      referralData.transactionAmount, 
      tierMultiplier
    );

    try {
      await storage.createReferral({
        id: `ref_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        referrerId: referralData.referrerId,
        referredUserId: referralData.referredUserId,
        transactionAmount: referralData.transactionAmount.toString(),
        commissionAmount: commission.toString(),
        type: referralData.type,
        status: 'completed'
      });

      return { success: true, commission };
    } catch (error: any) {
      return { success: false, error: error.message || 'Referral processing failed' };
    }
  }

  async getReferralStats(userId: string): Promise<any> {
    const referrals = await storage.getUserReferrals(userId);
    const totalCommission = referrals.reduce((sum, ref) => sum + parseFloat(ref.commissionAmount || '0'), 0);
    
    return {
      totalReferrals: referrals.length,
      totalCommission,
      activeReferrals: referrals.filter(ref => ref.status === 'active').length,
      referralHistory: referrals.slice(0, 10) // Last 10 referrals
    };
  }
}

// ===== UNIFIED NOTIFICATION SYSTEM =====
export class UnifiedNotificationSystem {
  private static instance: UnifiedNotificationSystem;

  static getInstance(): UnifiedNotificationSystem {
    if (!this.instance) {
      this.instance = new UnifiedNotificationSystem();
    }
    return this.instance;
  }

  async sendNotification(notification: {
    userId: string;
    title: string;
    message: string;
    type: 'payment' | 'referral' | 'agent' | 'system';
    priority: 'low' | 'medium' | 'high';
    data?: any;
  }): Promise<boolean> {
    
    try {
      await storage.createNotification({
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: notification.userId,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        priority: notification.priority,
        isRead: false,
        data: notification.data || null
      });

      return true;
    } catch (error) {
      console.error('Notification failed:', error);
      return false;
    }
  }

  async getUserNotifications(userId: string, limit: number = 20): Promise<any[]> {
    return await storage.getUserNotifications(userId, limit);
  }
}

// ===== UNIFIED ANALYTICS SYSTEM =====
export class UnifiedAnalyticsSystem {
  private static instance: UnifiedAnalyticsSystem;

  static getInstance(): UnifiedAnalyticsSystem {
    if (!this.instance) {
      this.instance = new UnifiedAnalyticsSystem();
    }
    return this.instance;
  }

  async getPlatformMetrics(): Promise<any> {
    try {
      const [transactions, agents, users] = await Promise.all([
        storage.getTransactionStats(),
        storage.getActiveAIAgents(100),
        storage.getAllUsers()
      ]);

      const totalRevenue = transactions.reduce((sum, txn) => sum + parseFloat(txn.amount || '0'), 0);
      const totalFees = transactions.reduce((sum, txn) => sum + parseFloat(txn.platformFee || '0'), 0);

      return {
        totalUsers: users.length,
        totalAgents: agents.length,
        totalTransactions: transactions.length,
        totalRevenue,
        totalFees,
        profitMargin: totalRevenue > 0 ? (totalFees / totalRevenue) * 100 : 0,
        averageTransactionValue: transactions.length > 0 ? totalRevenue / transactions.length : 0
      };
    } catch (error) {
      console.error('Analytics error:', error);
      return {
        totalUsers: 0,
        totalAgents: 0,
        totalTransactions: 0,
        totalRevenue: 0,
        totalFees: 0,
        profitMargin: 0,
        averageTransactionValue: 0
      };
    }
  }
}

// ===== EXPORT CONSOLIDATED SERVICES =====
export const ConsolidatedServices = {
  FeeCalculator: UnifiedFeeCalculator,
  PaymentProcessor: UnifiedPaymentProcessor.getInstance(),
  AgentMarketplace: UnifiedAgentMarketplace.getInstance(),
  ReferralSystem: UnifiedReferralSystem.getInstance(),
  NotificationSystem: UnifiedNotificationSystem.getInstance(),
  AnalyticsSystem: UnifiedAnalyticsSystem.getInstance()
};

export default ConsolidatedServices;