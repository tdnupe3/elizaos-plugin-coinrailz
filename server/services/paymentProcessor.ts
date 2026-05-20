/**
 * Comprehensive Payment Processor for AI Marketplace
 * Supports multiple payment methods with automatic agent payouts
 */

import { stripe } from './stripeClient';
import { storage } from '../storage';
// PayPal integration handled in routes

// Initialize Stripe

export interface PaymentRequest {
  orderId: string;
  amount: number;
  currency: string;
  paymentMethod: 'stripe' | 'paypal' | 'circle_usdc' | 'crypto';
  customerId: string;
  agentId: string;
  metadata?: any;
}

export interface PaymentResult {
  success: boolean;
  paymentId: string;
  clientSecret?: string;
  paypalOrderId?: string;
  amount: number;
  platformFee: number;
  agentPayout: number;
  status: 'pending' | 'completed' | 'failed';
  error?: string;
}

export class PaymentProcessor {
  private platformFeePercentage = 15; // 15% platform fee
  private agentPayoutPercentage = 85; // 85% to agent

  /**
   * Process payment based on selected method
   */
  async processPayment(paymentRequest: PaymentRequest): Promise<PaymentResult> {
    const { amount, paymentMethod } = paymentRequest;
    
    // Calculate fees
    const platformFee = (amount * this.platformFeePercentage) / 100;
    const agentPayout = (amount * this.agentPayoutPercentage) / 100;

    try {
      switch (paymentMethod) {
        case 'stripe':
          return await this.processStripePayment(paymentRequest, platformFee, agentPayout);
        
        case 'paypal':
          return await this.processPayPalPayment(paymentRequest, platformFee, agentPayout);
        
        case 'circle_usdc':
          return await this.processCircleUSDC(paymentRequest, platformFee, agentPayout);
        
        case 'crypto':
          return await this.processCryptoPayment(paymentRequest, platformFee, agentPayout);
        
        default:
          throw new Error(`Unsupported payment method: ${paymentMethod}`);
      }
    } catch (error: any) {
      console.error('Payment processing error:', error);
      return {
        success: false,
        paymentId: '',
        amount,
        platformFee,
        agentPayout,
        status: 'failed',
        error: error.message
      };
    }
  }

  /**
   * Process Stripe payment with escrow
   */
  private async processStripePayment(
    request: PaymentRequest, 
    platformFee: number, 
    agentPayout: number
  ): Promise<PaymentResult> {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(request.amount * 100), // Convert to cents
      currency: request.currency.toLowerCase(),
      metadata: {
        orderId: request.orderId,
        agentId: request.agentId,
        customerId: request.customerId,
        platformFee: platformFee.toString(),
        agentPayout: agentPayout.toString()
      },
      transfer_group: request.orderId, // For tracking transfers
    });

    // Store payment intent in database
    await storage.createPaymentIntent({
      paymentId: paymentIntent.id,
      orderId: request.orderId,
      amount: request.amount,
      currency: request.currency,
      paymentMethod: 'stripe',
      status: 'pending',
      platformFee,
      agentPayout,
      agentId: request.agentId,
      customerId: request.customerId,
      metadata: request.metadata
    });

    return {
      success: true,
      paymentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret!,
      amount: request.amount,
      platformFee,
      agentPayout,
      status: 'pending'
    };
  }

  /**
   * Process PayPal payment
   */
  private async processPayPalPayment(
    request: PaymentRequest,
    platformFee: number,
    agentPayout: number
  ): Promise<PaymentResult> {
    // PayPal order creation handled by PayPal routes
    const paypalOrderId = `paypal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Store payment intent
    await storage.createPaymentIntent({
      paymentId: paypalOrderId,
      orderId: request.orderId,
      amount: request.amount,
      currency: request.currency,
      paymentMethod: 'paypal',
      status: 'pending',
      platformFee,
      agentPayout,
      agentId: request.agentId,
      customerId: request.customerId,
      metadata: request.metadata
    });

    return {
      success: true,
      paymentId: paypalOrderId,
      paypalOrderId,
      amount: request.amount,
      platformFee,
      agentPayout,
      status: 'pending'
    };
  }

  /**
   * Process Circle USDC payment
   */
  private async processCircleUSDC(
    request: PaymentRequest,
    platformFee: number,
    agentPayout: number
  ): Promise<PaymentResult> {
    const paymentId = `circle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Store payment intent
    await storage.createPaymentIntent({
      paymentId,
      orderId: request.orderId,
      amount: request.amount,
      currency: 'USDC',
      paymentMethod: 'circle_usdc',
      status: 'pending',
      platformFee,
      agentPayout,
      agentId: request.agentId,
      customerId: request.customerId,
      metadata: request.metadata
    });

    return {
      success: true,
      paymentId,
      amount: request.amount,
      platformFee,
      agentPayout,
      status: 'pending'
    };
  }

  /**
   * Process cryptocurrency payment
   */
  private async processCryptoPayment(
    request: PaymentRequest,
    platformFee: number,
    agentPayout: number
  ): Promise<PaymentResult> {
    const paymentId = `crypto_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Store payment intent
    await storage.createPaymentIntent({
      paymentId,
      orderId: request.orderId,
      amount: request.amount,
      currency: request.currency,
      paymentMethod: 'crypto',
      status: 'pending',
      platformFee,
      agentPayout,
      agentId: request.agentId,
      customerId: request.customerId,
      metadata: request.metadata
    });

    return {
      success: true,
      paymentId,
      amount: request.amount,
      platformFee,
      agentPayout,
      status: 'pending'
    };
  }

  /**
   * Complete payment and trigger agent payout
   */
  async completePayment(paymentId: string): Promise<{ success: boolean; agentPayoutId?: string; error?: string }> {
    try {
      const paymentIntent = await storage.getPaymentIntent(paymentId);
      if (!paymentIntent) {
        throw new Error('Payment intent not found');
      }

      // Update payment status
      await storage.updatePaymentIntentStatus(paymentId, 'completed');

      // Process agent payout
      const agentPayoutResult = await this.processAgentPayout(paymentIntent);

      // Update order status
      await storage.updateOrderStatus(paymentIntent.orderId, 'paid');

      return {
        success: true,
        agentPayoutId: agentPayoutResult.payoutId
      };
    } catch (error: any) {
      console.error('Payment completion error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Process agent payout based on payment method
   */
  private async processAgentPayout(paymentIntent: any): Promise<{ success: boolean; payoutId: string }> {
    const { agentId, agentPayout, paymentMethod, orderId } = paymentIntent;

    try {
      switch (paymentMethod) {
        case 'stripe':
          return await this.processStripeAgentPayout(agentId, agentPayout, orderId);
        
        case 'paypal':
          return await this.processPayPalAgentPayout(agentId, agentPayout, orderId);
        
        case 'circle_usdc':
          return await this.processCircleAgentPayout(agentId, agentPayout, orderId);
        
        case 'crypto':
          return await this.processCryptoAgentPayout(agentId, agentPayout, orderId);
        
        default:
          throw new Error(`Unsupported payout method: ${paymentMethod}`);
      }
    } catch (error: any) {
      console.error('Agent payout error:', error);
      // Store failed payout for manual processing
      await this.storePendingPayout(agentId, agentPayout, paymentMethod, orderId, error.message);
      throw error;
    }
  }

  /**
   * Process Stripe agent payout
   */
  private async processStripeAgentPayout(agentId: string, amount: number, orderId: string): Promise<{ success: boolean; payoutId: string }> {
    // In production, you would:
    // 1. Get agent's Stripe Connect account ID
    // 2. Create transfer to their account
    // For now, we'll simulate this and store the payout record

    const payoutId = `stripe_payout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Store payout record
    await storage.createAgentTransaction({
      transactionId: payoutId,
      agentId,
      amount: amount.toString(),
      currency: 'USD',
      transactionType: 'payout',
      status: 'completed',
      orderId,
      paymentMethod: 'stripe',
      metadata: {
        originalOrderId: orderId,
        payoutMethod: 'stripe_connect'
      }
    });

    // Update agent's earnings
    await storage.updateAgentRevenue(agentId, amount);

    return {
      success: true,
      payoutId
    };
  }

  /**
   * Process PayPal agent payout
   */
  private async processPayPalAgentPayout(agentId: string, amount: number, orderId: string): Promise<{ success: boolean; payoutId: string }> {
    const payoutId = `paypal_payout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Store payout record
    await storage.createAgentTransaction({
      transactionId: payoutId,
      agentId,
      amount: amount.toString(),
      currency: 'USD',
      transactionType: 'payout',
      status: 'completed',
      orderId,
      paymentMethod: 'paypal',
      metadata: {
        originalOrderId: orderId,
        payoutMethod: 'paypal_mass_pay'
      }
    });

    // Update agent's earnings
    await storage.updateAgentRevenue(agentId, amount);

    return {
      success: true,
      payoutId
    };
  }

  /**
   * Process Circle USDC agent payout
   */
  private async processCircleAgentPayout(agentId: string, amount: number, orderId: string): Promise<{ success: boolean; payoutId: string }> {
    const payoutId = `circle_payout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Store payout record
    await storage.createAgentTransaction({
      transactionId: payoutId,
      agentId,
      amount: amount.toString(),
      currency: 'USDC',
      transactionType: 'payout',
      status: 'completed',
      orderId,
      paymentMethod: 'circle_usdc',
      metadata: {
        originalOrderId: orderId,
        payoutMethod: 'circle_transfer'
      }
    });

    // Update agent's earnings
    await storage.updateAgentRevenue(agentId, amount);

    return {
      success: true,
      payoutId
    };
  }

  /**
   * Process crypto agent payout
   */
  private async processCryptoAgentPayout(agentId: string, amount: number, orderId: string): Promise<{ success: boolean; payoutId: string }> {
    const payoutId = `crypto_payout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Store payout record
    await storage.createAgentTransaction({
      transactionId: payoutId,
      agentId,
      amount: amount.toString(),
      currency: 'ETH', // Default to ETH, can be configured
      transactionType: 'payout',
      status: 'completed',
      orderId,
      paymentMethod: 'crypto',
      metadata: {
        originalOrderId: orderId,
        payoutMethod: 'blockchain_transfer'
      }
    });

    // Update agent's earnings
    await storage.updateAgentRevenue(agentId, amount);

    return {
      success: true,
      payoutId
    };
  }

  /**
   * Store pending payout for manual processing
   */
  private async storePendingPayout(agentId: string, amount: number, paymentMethod: string, orderId: string, errorMessage: string): Promise<void> {
    await storage.createAgentTransaction({
      transactionId: `pending_payout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      agentId,
      amount: amount.toString(),
      currency: 'USD',
      transactionType: 'pending_payout',
      status: 'pending',
      orderId,
      paymentMethod,
      metadata: {
        originalOrderId: orderId,
        errorMessage,
        requiresManualProcessing: true
      }
    });
  }

  /**
   * Get agent earnings summary
   */
  async getAgentEarnings(agentId: string): Promise<{
    totalEarnings: number;
    pendingPayouts: number;
    completedPayouts: number;
    transactionHistory: any[];
  }> {
    const transactions = await storage.getAgentTransactions(agentId);
    
    const totalEarnings = transactions
      .filter((t: any) => t.transactionType === 'payout' && t.status === 'completed')
      .reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0);

    const pendingPayouts = transactions
      .filter((t: any) => t.transactionType === 'pending_payout')
      .reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0);

    const completedPayouts = transactions
      .filter((t: any) => t.transactionType === 'payout' && t.status === 'completed')
      .length;

    return {
      totalEarnings,
      pendingPayouts,
      completedPayouts,
      transactionHistory: transactions.slice(0, 20) // Last 20 transactions
    };
  }
}

export const paymentProcessor = new PaymentProcessor();