import { FeeCalculator } from './feeCalculator';
import { BusinessLogicIntegration } from './businessLogicIntegration';

export interface P2PTransferRequest {
  senderMethod: string;
  recipientPlatform: string;
  recipientIdentifier: string;
  amount: number;
  message?: string;
  paymentIntentId?: string;
}

export interface P2PTransferResponse {
  success: boolean;
  transferId?: string;
  fee: number;
  total: number;
  estimatedDelivery?: string;
  error?: string;
}

export class P2PTransferService {
  
  /**
   * Calculate P2P transfer fee accounting for cross-platform processing costs
   */
  static calculateP2PFee(amount: number, senderMethod: string, recipientPlatform?: string): number {
    if (amount === 0) return 0;
    
    // Determine if this is a cross-platform transfer requiring dual processing fees
    const isCrossPlatform = this.isCrossPlatformTransfer(senderMethod, recipientPlatform);
    
    if (isCrossPlatform) {
      // Cross-platform transfers: 10% fee to cover dual processing costs
      return Math.round((amount * 0.10) * 100) / 100;
    } else {
      // Same-platform or internal transfers: original tiered structure
      if (amount < 25) {
        return Math.round((amount * 0.035 + 2.00) * 100) / 100;
      } else if (amount < 50) {
        return Math.round((amount * 0.032 + 1.10) * 100) / 100;
      } else {
        return Math.round((amount * 0.032 + 0.35) * 100) / 100;
      }
    }
  }

  /**
   * Determine if transfer requires cross-platform processing (dual fees)
   */
  private static isCrossPlatformTransfer(senderMethod: string, recipientPlatform?: string): boolean {
    if (!recipientPlatform) return false;
    
    // Define platform categories
    const externalPlatforms = ['paypal', 'stripe', 'credit', 'debit'];
    const internalPlatforms = ['coinrailz', 'crypto']; // Crypto is direct blockchain, no middleman fees
    
    const senderIsExternal = externalPlatforms.includes(senderMethod);
    const recipientIsExternal = externalPlatforms.includes(recipientPlatform);
    
    // Cross-platform if both sender and recipient involve external payment processors
    return senderIsExternal && recipientIsExternal;
  }

  /**
   * Calculate total processing costs for transparency
   */
  static calculateProcessingCosts(amount: number, senderMethod: string, recipientPlatform: string): {
    incomingFee: number;
    outgoingFee: number;
    totalProcessingCost: number;
  } {
    // Incoming processing fee
    let incomingFee = 0;
    if (['stripe', 'credit', 'debit', 'paypal'].includes(senderMethod)) {
      incomingFee = amount * 0.029 + 0.30;
    }
    
    // Outgoing processing fee
    let outgoingFee = 0;
    if (recipientPlatform === 'paypal') {
      outgoingFee = amount * 0.029 + 0.30; // PayPal payout fee
    } else if (recipientPlatform === 'stripe') {
      outgoingFee = amount * 0.029 + 0.30; // Stripe payout fee
    } else if (recipientPlatform === 'crypto') {
      outgoingFee = 15; // Network fees for crypto withdrawal
    } else if (recipientPlatform === 'coinrailz') {
      outgoingFee = 0; // Internal transfer
    }
    
    return {
      incomingFee: Math.round(incomingFee * 100) / 100,
      outgoingFee: Math.round(outgoingFee * 100) / 100,
      totalProcessingCost: Math.round((incomingFee + outgoingFee) * 100) / 100
    };
  }

  /**
   * Initiate P2P transfer with proper validation and fee calculation
   */
  static async initiateTransfer(request: P2PTransferRequest): Promise<P2PTransferResponse> {
    try {
      // Validate input
      if (!request.amount || request.amount < 2.50) {
        return {
          success: false,
          fee: 0,
          total: 0,
          error: 'Minimum transfer amount is $2.50'
        };
      }

      if (!request.recipientIdentifier || !request.senderMethod || !request.recipientPlatform) {
        return {
          success: false,
          fee: 0,
          total: 0,
          error: 'Missing required transfer details'
        };
      }

      // Calculate fee using profitable structure
      const fee = this.calculateP2PFee(request.amount, request.senderMethod);
      const total = request.amount + fee;

      // Process payment based on sender method
      let paymentResult;
      if (request.senderMethod === 'credit' || request.senderMethod === 'debit') {
        if (!request.paymentIntentId) {
          return {
            success: false,
            fee,
            total,
            error: 'Payment intent required for card payments'
          };
        }
        paymentResult = await this.processStripePayment(request.paymentIntentId, total);
      } else if (request.senderMethod === 'paypal') {
        paymentResult = await this.processPayPalPayment(total);
      } else {
        paymentResult = await this.processCryptoPayment(total);
      }

      if (!paymentResult.success) {
        return {
          success: false,
          fee,
          total,
          error: paymentResult.error || 'Payment processing failed'
        };
      }

      // Execute transfer using business logic integration
      const transferResult = await BusinessLogicIntegration.processP2PTransfer({
        fromUserId: 'current_user', // Would be from session in real implementation
        toUserId: request.recipientIdentifier,
        amount: request.amount,
        currency: 'USD'
      });

      if (!transferResult.success) {
        return {
          success: false,
          fee,
          total,
          error: transferResult.error || 'Transfer processing failed'
        };
      }

      // Determine delivery time based on platform
      const estimatedDelivery = this.getDeliveryEstimate(request.recipientPlatform);

      return {
        success: true,
        transferId: transferResult.data?.transferId || `p2p_${Date.now()}`,
        fee,
        total,
        estimatedDelivery
      };

    } catch (error) {
      console.error('P2P transfer error:', error);
      return {
        success: false,
        fee: 0,
        total: 0,
        error: 'Transfer service temporarily unavailable'
      };
    }
  }

  /**
   * Process Stripe payment for credit/debit cards
   */
  private static async processStripePayment(paymentIntentId: string, amount: number): Promise<{success: boolean, error?: string}> {
    try {
      // In real implementation, would confirm payment intent with Stripe
      // For now, simulate successful payment
      console.log(`Processing Stripe payment: ${paymentIntentId} for $${amount}`);
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Stripe payment failed' };
    }
  }

  /**
   * Process PayPal payment
   */
  private static async processPayPalPayment(amount: number): Promise<{success: boolean, error?: string}> {
    try {
      // In real implementation, would process PayPal payment
      console.log(`Processing PayPal payment for $${amount}`);
      return { success: true };
    } catch (error) {
      return { success: false, error: 'PayPal payment failed' };
    }
  }

  /**
   * Process crypto payment
   */
  private static async processCryptoPayment(amount: number): Promise<{success: boolean, error?: string}> {
    try {
      // In real implementation, would process crypto payment
      console.log(`Processing crypto payment for $${amount}`);
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Crypto payment failed' };
    }
  }

  /**
   * Get delivery time estimate based on recipient platform
   */
  private static getDeliveryEstimate(platform: string): string {
    switch (platform) {
      case 'paypal':
        return 'Instant';
      case 'crypto':
        return '5-15 minutes';
      case 'coinrailz':
        return 'Instant';
      case 'bank':
        return '1-3 business days';
      default:
        return '1-24 hours';
    }
  }

  /**
   * Get transfer status
   */
  static async getTransferStatus(transferId: string): Promise<{
    status: string;
    amount: number;
    fee: number;
    recipient: string;
    createdAt: string;
    completedAt?: string;
  }> {
    // In real implementation, would query database
    return {
      status: 'completed',
      amount: 100,
      fee: 3.55,
      recipient: 'test@example.com',
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString()
    };
  }
}