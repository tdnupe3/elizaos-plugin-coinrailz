/**
 * x402 Protocol Payment Service
 * Enables autonomous AI agent payments using HTTP 402 standard
 * 
 * Integration: Coinbase x402 Protocol + Base Chain
 * Use Case: AI agents pay for marketplace services autonomously
 */

import { db } from '../db';
import { x402Payments, aiMarketplaceOrders } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export interface X402PaymentRequest {
  amount: number;
  agentId: string;
  serviceDescription: string;
  orderId?: string;
  network?: 'base' | 'polygon' | 'ethereum' | 'near';
  currency?: string;
  metadata?: Record<string, any>;
}

export interface X402PaymentResponse {
  success: boolean;
  paymentId: string;
  amount: number;
  currency: string;
  network: string;
  status: 'pending' | 'completed' | 'failed';
  walletAddress?: string;
  paymentUrl?: string;
  expiresAt?: Date;
  error?: string;
  x402Headers?: {
    'X-PAYMENT-REQUEST'?: string;
    'Accept-Payment'?: string;
  };
}

export class X402PaymentService {
  private readonly DEFAULT_NETWORK = 'base';
  private readonly DEFAULT_CURRENCY = 'USDC';
  private readonly PAYMENT_TIMEOUT_MINUTES = 15;
  
  // Coinbase x402 Facilitator endpoint (production)
  private readonly FACILITATOR_URL = process.env.X402_FACILITATOR_URL || 'https://facilitator.x402.io';
  
  /**
   * Create x402 payment request for AI agent autonomous payment
   */
  async createPaymentRequest(params: X402PaymentRequest): Promise<X402PaymentResponse> {
    try {
      const {
        amount,
        agentId,
        serviceDescription,
        orderId,
        network = this.DEFAULT_NETWORK,
        currency = this.DEFAULT_CURRENCY,
        metadata = {},
      } = params;

      // Validate inputs
      if (amount <= 0) {
        return {
          success: false,
          paymentId: '',
          amount,
          currency,
          network,
          status: 'failed',
          error: 'Payment amount must be greater than 0',
        };
      }

      // Generate unique payment ID
      const paymentId = `x402_${nanoid(24)}`;
      
      // Calculate expiration (15 minutes from now)
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + this.PAYMENT_TIMEOUT_MINUTES);

      // Generate payment wallet address (for Base Chain USDC)
      // In production, this would come from Coinbase x402 Facilitator
      const walletAddress = await this.generatePaymentWallet(network);

      // Store payment in database
      await db.insert(x402Payments).values({
        id: paymentId,
        orderId: orderId || null,
        agentId,
        customerId: null, // Autonomous payments don't have traditional customers
        amount: amount.toString(),
        currency,
        status: 'pending',
        network,
        walletAddress,
        expiresAt,
        metadata: JSON.stringify({
          serviceDescription,
          protocol: 'x402',
          autonomousPayment: true,
          ...metadata,
        }),
      });

      console.log(`✅ x402 payment created: ${paymentId} for agent ${agentId} (${amount} ${currency})`);

      // Generate x402 protocol headers for HTTP 402 response
      const x402Headers = this.generateX402Headers({
        paymentId,
        amount,
        currency,
        walletAddress,
        network,
      });

      return {
        success: true,
        paymentId,
        amount,
        currency,
        network,
        status: 'pending',
        walletAddress,
        paymentUrl: `${this.FACILITATOR_URL}/pay/${paymentId}`,
        expiresAt,
        x402Headers,
      };
    } catch (error: any) {
      console.error('❌ x402 payment creation failed:', error);
      return {
        success: false,
        paymentId: '',
        amount: params.amount,
        currency: params.currency || this.DEFAULT_CURRENCY,
        network: params.network || this.DEFAULT_NETWORK,
        status: 'failed',
        error: error.message || 'Payment creation failed',
      };
    }
  }

  /**
   * Verify x402 payment completion
   */
  async verifyPayment(paymentId: string, paymentProof?: string): Promise<X402PaymentResponse> {
    try {
      // Fetch payment from database
      const payments = await db
        .select()
        .from(x402Payments)
        .where(eq(x402Payments.id, paymentId))
        .limit(1);

      if (!payments.length) {
        return {
          success: false,
          paymentId,
          amount: 0,
          currency: this.DEFAULT_CURRENCY,
          network: this.DEFAULT_NETWORK,
          status: 'failed',
          error: 'Payment not found',
        };
      }

      const payment = payments[0];

      // Check if payment is expired
      if (payment.expiresAt && new Date() > new Date(payment.expiresAt)) {
        await db
          .update(x402Payments)
          .set({ status: 'expired', errorMessage: 'Payment expired' })
          .where(eq(x402Payments.id, paymentId));

        return {
          success: false,
          paymentId,
          amount: parseFloat(payment.amount),
          currency: payment.currency || this.DEFAULT_CURRENCY,
          network: payment.network || this.DEFAULT_NETWORK,
          status: 'failed',
          error: 'Payment expired',
        };
      }

      // If payment proof provided, verify on-chain
      if (paymentProof) {
        const isValid = await this.verifyOnChainPayment(
          payment.walletAddress || '',
          parseFloat(payment.amount),
          payment.network || this.DEFAULT_NETWORK,
          paymentProof
        );

        if (isValid) {
          // Mark payment as completed
          await db
            .update(x402Payments)
            .set({
              status: 'completed',
              completedAt: new Date(),
              paymentProof,
            })
            .where(eq(x402Payments.id, paymentId));

          // If linked to marketplace order, mark order as paid
          if (payment.orderId) {
            await db
              .update(aiMarketplaceOrders)
              .set({
                status: 'paid',
                paymentMethod: 'x402',
              })
              .where(eq(aiMarketplaceOrders.id, payment.orderId));
          }

          console.log(`✅ x402 payment verified: ${paymentId}`);

          return {
            success: true,
            paymentId,
            amount: parseFloat(payment.amount),
            currency: payment.currency || this.DEFAULT_CURRENCY,
            network: payment.network || this.DEFAULT_NETWORK,
            status: 'completed',
          };
        } else {
          return {
            success: false,
            paymentId,
            amount: parseFloat(payment.amount),
            currency: payment.currency || this.DEFAULT_CURRENCY,
            network: payment.network || this.DEFAULT_NETWORK,
            status: 'failed',
            error: 'Payment verification failed',
          };
        }
      }

      // Return current payment status
      return {
        success: payment.status === 'completed',
        paymentId,
        amount: parseFloat(payment.amount),
        currency: payment.currency || this.DEFAULT_CURRENCY,
        network: payment.network || this.DEFAULT_NETWORK,
        status: payment.status as any,
        walletAddress: payment.walletAddress || undefined,
      };
    } catch (error: any) {
      console.error('❌ x402 payment verification failed:', error);
      return {
        success: false,
        paymentId,
        amount: 0,
        currency: this.DEFAULT_CURRENCY,
        network: this.DEFAULT_NETWORK,
        status: 'failed',
        error: error.message || 'Verification failed',
      };
    }
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(paymentId: string): Promise<X402PaymentResponse> {
    return this.verifyPayment(paymentId);
  }

  /**
   * Generate payment wallet address for specified network
   */
  private async generatePaymentWallet(network: string): Promise<string> {
    // In production, this would call Coinbase x402 Facilitator API
    // For now, generate a unique wallet address format
    
    switch (network) {
      case 'base':
      case 'ethereum':
      case 'polygon':
        // EVM-compatible address
        return `0x${nanoid(40)}`.toLowerCase();
      
      case 'near':
        // NEAR protocol address format
        return `payment-${nanoid(16)}.near`;
      
      default:
        return `0x${nanoid(40)}`.toLowerCase();
    }
  }

  /**
   * Verify on-chain payment using blockchain explorer or RPC
   */
  private async verifyOnChainPayment(
    walletAddress: string,
    expectedAmount: number,
    network: string,
    transactionHash: string
  ): Promise<boolean> {
    // In production, this would:
    // 1. Call blockchain RPC to verify transaction
    // 2. Check recipient address matches
    // 3. Verify amount matches
    // 4. Confirm transaction is confirmed
    
    // For now, accept any non-empty transaction hash as valid proof
    return transactionHash.length > 0;
  }

  /**
   * Generate x402 protocol headers for HTTP 402 response
   */
  private generateX402Headers(params: {
    paymentId: string;
    amount: number;
    currency: string;
    walletAddress: string;
    network: string;
  }): { 'X-PAYMENT-REQUEST'?: string; 'Accept-Payment'?: string } {
    const { paymentId, amount, currency, walletAddress, network } = params;

    // x402 protocol payment request header
    const paymentRequest = JSON.stringify({
      id: paymentId,
      amount: amount.toString(),
      currency,
      recipient: walletAddress,
      network,
      protocol: 'x402',
    });

    return {
      'X-PAYMENT-REQUEST': Buffer.from(paymentRequest).toString('base64'),
      'Accept-Payment': `x402/${currency}`,
    };
  }

  /**
   * Get x402 analytics for platform
   */
  async getAnalytics(): Promise<{
    totalPayments: number;
    totalVolume: number;
    successRate: number;
    averageAmount: number;
    paymentsByNetwork: Record<string, number>;
  }> {
    try {
      const allPayments = await db.select().from(x402Payments);

      const totalPayments = allPayments.length;
      const completedPayments = allPayments.filter((p) => p.status === 'completed');
      const totalVolume = completedPayments.reduce(
        (sum, p) => sum + parseFloat(p.amount),
        0
      );
      const successRate =
        totalPayments > 0 ? (completedPayments.length / totalPayments) * 100 : 0;
      const averageAmount = completedPayments.length > 0 ? totalVolume / completedPayments.length : 0;

      const paymentsByNetwork: Record<string, number> = {};
      allPayments.forEach((payment) => {
        const network = payment.network || 'unknown';
        paymentsByNetwork[network] = (paymentsByNetwork[network] || 0) + 1;
      });

      return {
        totalPayments,
        totalVolume,
        successRate,
        averageAmount,
        paymentsByNetwork,
      };
    } catch (error) {
      console.error('Failed to fetch x402 analytics:', error);
      return {
        totalPayments: 0,
        totalVolume: 0,
        successRate: 0,
        averageAmount: 0,
        paymentsByNetwork: {},
      };
    }
  }
}

export const x402PaymentService = new X402PaymentService();
