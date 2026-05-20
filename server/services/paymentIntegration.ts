/**
 * Payment Integration Service
 * Connects marketplace orders with payment processing (Stripe, PayPal, Circle USDC)
 */

import type Stripe from 'stripe';
import { stripe as stripeClient } from './stripeClient';
import { storage } from '../storage';

interface PaymentOrderData {
  orderId: string;
  customerId: string;
  agentId: string;
  amount: number;
  currency: string;
  paymentMethod: 'stripe' | 'paypal' | 'usdc';
  description: string;
}

interface EscrowRelease {
  orderId: string;
  agentId: string;
  amount: number;
  platformFee: number;
  agentPayout: number;
}

export class PaymentIntegrationService {
  private static stripe: Stripe | null = null;

  static initialize() {
    this.stripe = stripeClient;
  }

  /**
   * Create escrow payment intent for marketplace order
   */
  static async createEscrowPayment(orderData: PaymentOrderData): Promise<{
    success: boolean;
    paymentIntent?: any;
    clientSecret?: string;
    error?: string;
  }> {
    try {
      if (orderData.paymentMethod === 'stripe' && this.stripe) {
        const paymentIntent = await this.stripe.paymentIntents.create({
          amount: Math.round(orderData.amount * 100), // Convert to cents
          currency: orderData.currency.toLowerCase(),
          metadata: {
            orderId: orderData.orderId,
            customerId: orderData.customerId,
            agentId: orderData.agentId,
            type: 'marketplace_escrow'
          },
          description: `Marketplace Order: ${orderData.description}`,
          capture_method: 'manual' // Don't capture immediately - hold in escrow
        });

        return {
          success: true,
          paymentIntent,
          clientSecret: paymentIntent.client_secret || undefined
        };
      }

      // For other payment methods, return success for now
      return {
        success: true,
        clientSecret: `mock_${orderData.paymentMethod}_${orderData.orderId}`
      };

    } catch (error: any) {
      console.error('Payment creation error:', error);
      return {
        success: false,
        error: error.message || 'Payment creation failed'
      };
    }
  }

  /**
   * Release escrow payment to agent after customer approval
   */
  static async releaseEscrowPayment(releaseData: EscrowRelease): Promise<{
    success: boolean;
    transaction?: any;
    error?: string;
  }> {
    try {
      // Find the payment intent for this order
      if (this.stripe) {
        // In a real implementation, you would:
        // 1. Find the payment intent by order metadata
        // 2. Capture the payment
        // 3. Create a transfer to the agent's connected account
        // 4. Deduct platform fee

        console.log(`Releasing escrow payment for order ${releaseData.orderId}`);
        console.log(`Agent payout: $${releaseData.agentPayout}`);
        console.log(`Platform fee: $${releaseData.platformFee}`);

        // Simulate successful payment release
        return {
          success: true,
          transaction: {
            id: `txn_${Date.now()}`,
            orderId: releaseData.orderId,
            agentPayout: releaseData.agentPayout,
            platformFee: releaseData.platformFee,
            status: 'completed',
            releasedAt: new Date().toISOString()
          }
        };
      }

      return {
        success: true,
        transaction: {
          id: `mock_txn_${Date.now()}`,
          orderId: releaseData.orderId,
          status: 'completed'
        }
      };

    } catch (error: any) {
      console.error('Escrow release error:', error);
      return {
        success: false,
        error: error.message || 'Escrow release failed'
      };
    }
  }

  /**
   * Create PayPal order for marketplace payment
   */
  static async createPayPalOrder(orderData: PaymentOrderData): Promise<{
    success: boolean;
    orderId?: string;
    error?: string;
  }> {
    try {
      // This would integrate with PayPal's Orders API
      // For now, return a mock order ID
      return {
        success: true,
        orderId: `PAYPAL_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'PayPal order creation failed'
      };
    }
  }

  /**
   * Process USDC payment for marketplace order
   */
  static async processUSDCPayment(orderData: PaymentOrderData): Promise<{
    success: boolean;
    transactionId?: string;
    error?: string;
  }> {
    try {
      // This would integrate with Circle's API for USDC transfers
      // For now, return a mock transaction ID
      return {
        success: true,
        transactionId: `USDC_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'USDC payment failed'
      };
    }
  }

  /**
   * Get payment status for an order
   */
  static async getPaymentStatus(orderId: string): Promise<{
    status: 'pending' | 'held' | 'released' | 'failed';
    amount?: number;
    currency?: string;
    paymentMethod?: string;
  }> {
    try {
      // In a real implementation, check actual payment status
      // For now, return mock status based on order existence
      const allOrders = (global as any).orders || [];
      const order = allOrders.find((o: any) => o.orderId === orderId);

      if (!order) {
        return { status: 'failed' };
      }

      return {
        status: order.escrowStatus === 'released' ? 'released' : 'held',
        amount: order.amount,
        currency: 'USD',
        paymentMethod: order.paymentMethod || 'stripe'
      };
    } catch (error) {
      console.error('Payment status check error:', error);
      return { status: 'failed' };
    }
  }
}

// Initialize the service
PaymentIntegrationService.initialize();