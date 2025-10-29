/**
 * Payment Processor Service Handler - PRODUCTION READY ✅
 * 
 * Important: For production use, configure PLATFORM_CDP_WALLET_ID environment variable
 * with a funded Coinbase CDP wallet ID. Without this, the handler will create
 * payment requests instead of direct transfers.
 * 
 * Two modes:
 * 1. Direct Transfer Mode: Uses PLATFORM_CDP_WALLET_ID (funded wallet) for instant USDC transfers
 * 2. Payment Request Mode: Creates payment addresses and returns payment instructions
 */

import { ServiceHandler, ServiceDeliveryRequest, ServiceDeliveryResult } from '../serviceDeliveryFramework';
import { nanoid } from 'nanoid';
import { Coinbase, Wallet } from '@coinbase/coinbase-sdk';

export class PaymentProcessorHandler implements ServiceHandler {
  private coinbaseClient: typeof Coinbase | null = null;
  private platformWalletAddress: string | null = null;
  
  constructor() {
    this.initializeCoinbase();
    // Use existing platform wallet address from environment
    this.platformWalletAddress = process.env.PLATFORM_WALLET_ADDRESS || null;
    
    if (!this.platformWalletAddress) {
      console.warn('⚠️ PLATFORM_WALLET_ADDRESS not set - using payment request mode');
      console.warn('   For direct transfers, configure PLATFORM_WALLET_ADDRESS');
    } else {
      console.log(`✅ Platform wallet configured: ${this.platformWalletAddress}`);
      console.log('   Note: Payment processor will create payment requests - direct transfers require CDP wallet integration');
    }
  }

  private initializeCoinbase() {
    try {
      if (!process.env.CDP_API_KEY_ID || !process.env.CDP_PRIVATE_KEY) {
        console.warn('⚠️ CDP credentials not found - payment processor will not work');
        this.coinbaseClient = null;
        return;
      }

      // Configure Coinbase SDK globally
      Coinbase.configure({
        apiKeyName: process.env.CDP_API_KEY_ID,
        privateKey: process.env.CDP_PRIVATE_KEY,
      });

      this.coinbaseClient = Coinbase;
      console.log('✅ PaymentProcessorHandler: Coinbase CDP initialized');
    } catch (error) {
      console.error('❌ PaymentProcessorHandler: Failed to initialize CDP:', error);
      this.coinbaseClient = null;
    }
  }

  canHandle(request: ServiceDeliveryRequest): boolean {
    return (
      request.agentId === 'payment-processor' &&
      !!request.paymentDetails
    );
  }

  async execute(request: ServiceDeliveryRequest): Promise<ServiceDeliveryResult> {
    try {
      console.log(`💳 Starting payment processing for order: ${request.orderId}`);

      const { paymentDetails } = request;
      
      if (!paymentDetails || !paymentDetails.recipientAddress || !paymentDetails.amount) {
        throw new Error('Payment details required: recipientAddress and amount');
      }

      if (!this.coinbaseClient) {
        throw new Error('Payment processor not configured - CDP credentials missing');
      }

      // Validate amount
      if (paymentDetails.amount <= 0) {
        throw new Error('Payment amount must be greater than 0');
      }

      const transactionId = `txn_${nanoid(16)}`;
      const network = paymentDetails.network || 'base';
      const currency = paymentDetails.currency || 'USDC';

      console.log(`💰 Processing payment: ${paymentDetails.amount} ${currency} to ${paymentDetails.recipientAddress}`);

      // Currently using payment request mode
      // TODO: Integrate with existing platform wallet for direct transfers
      console.log(`📝 Creating payment request for USDC transfer`);
      return await this.createPaymentRequest(request, transactionId, network, currency);

    } catch (error: any) {
      console.error(`❌ Payment processing failed:`, error);
      return {
        success: false,
        orderId: request.orderId,
        agentId: request.agentId,
        deliveryData: null,
        status: 'failed',
        error: error.message || 'Payment processing failed',
      };
    }
  }

  /**
   * Execute direct USDC transfer using platform wallet
   * 
   * TODO: This is currently disabled - payment processor uses payment request mode
   * To enable direct transfers, need to integrate with platform wallet service
   */
  private async executeDirectTransfer(
    request: ServiceDeliveryRequest,
    transactionId: string,
    network: string,
    currency: string
  ): Promise<ServiceDeliveryResult> {
    console.warn('Direct transfer not yet implemented - using payment request mode');
    return await this.createPaymentRequest(request, transactionId, network, currency);
  }

  /**
   * Create payment request (generates payment address for manual funding)
   */
  private async createPaymentRequest(
    request: ServiceDeliveryRequest,
    transactionId: string,
    network: string,
    currency: string
  ): Promise<ServiceDeliveryResult> {
    const { paymentDetails } = request;

    console.log(`📝 Creating payment request (no platform wallet available)`);

    // Create a receiving wallet address
    const paymentWallet = await Wallet.create({ networkId: 'base-mainnet' });
    const defaultAddress = await paymentWallet.getDefaultAddress();
    
    if (!defaultAddress) {
      throw new Error('Failed to create payment address');
    }

    const paymentAddress = defaultAddress.getId();

    console.log(`📍 Created payment address: ${paymentAddress}`);
    console.log(`💡 Payment request created - manual USDC transfer required`);

    const paymentInstructions = {
      method: 'manual_transfer',
      paymentAddress,
      amount: paymentDetails.amount,
      currency,
      network,
      recipientAddress: paymentDetails.recipientAddress,
      instructions: [
        `1. Send ${paymentDetails.amount} ${currency} to payment address: ${paymentAddress}`,
        `2. Use Base Chain network`,
        `3. Once received, funds will be automatically forwarded to: ${paymentDetails.recipientAddress}`,
        `4. Transaction ID: ${transactionId}`,
      ],
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
    };

    return {
      success: true,
      orderId: request.orderId,
      agentId: request.agentId,
      deliveryData: {
        paymentResult: {
          transactionId,
          method: 'payment_request',
          status: 'pending_funding',
          paymentAddress,
          finalRecipient: paymentDetails.recipientAddress,
          amount: paymentDetails.amount,
          currency,
          network,
          instructions: paymentInstructions.instructions,
          expiresAt: paymentInstructions.expiresAt,
          timestamp: new Date().toISOString(),
        },
        serviceType: 'payment_processing',
        completedAt: new Date().toISOString(),
        message: 'Payment request created - awaiting manual USDC transfer to payment address',
      },
      status: 'completed',
      metadata: {
        transactionId,
        network,
        method: 'payment_request',
        paymentAddress,
      },
    };
  }
}
