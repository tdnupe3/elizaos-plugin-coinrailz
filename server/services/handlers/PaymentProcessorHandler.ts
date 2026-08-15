/**
 * Payment Processor Service Handler - AI-POWERED ✅
 * 
 * AI-powered payment validation and instruction generation
 * 
 * Service: $0.50
 * AI Cost: ~$0.01
 * Profit Margin: 99.98%
 */

import { ServiceHandler, ServiceDeliveryRequest, ServiceDeliveryResult } from '../serviceDeliveryFramework';
import { processPaymentWithAI } from '../openAIServiceDelivery';

export class PaymentProcessorHandler implements ServiceHandler {
  canHandle(request: ServiceDeliveryRequest): boolean {
    return (
      request.agentId === 'payment-processor' &&
      !!request.paymentDetails
    );
  }

  async execute(request: ServiceDeliveryRequest): Promise<ServiceDeliveryResult> {
    try {
      console.log(`💳 Starting AI-powered payment processing for order: ${request.orderId}`);

      const { paymentDetails } = request;
      
      if (!paymentDetails || !paymentDetails.recipientAddress || !paymentDetails.amount) {
        throw new Error('Payment details required: recipientAddress and amount');
      }

      if (paymentDetails.amount <= 0) {
        throw new Error('Payment amount must be greater than 0');
      }

      const network = paymentDetails.network || 'base';
      const currency = paymentDetails.currency || 'USDC';

      console.log(`💰 Processing payment: ${paymentDetails.amount} ${currency} to ${paymentDetails.recipientAddress} on ${network}`);

      const aiResult = await processPaymentWithAI(
        paymentDetails.amount,
        currency,
        paymentDetails.recipientAddress,
        network,
        request.orderId
      );

      if (!aiResult.success) {
        throw new Error(aiResult.error || 'AI payment processing failed');
      }

      console.log(`✅ AI-powered payment instructions generated for order: ${request.orderId}`);
      console.log(`   💰 AI Cost: $${aiResult.cost?.totalCost.toFixed(4)}, Profit: $${(50 - (aiResult.cost?.totalCost || 0)).toFixed(2)}`);

      return {
        success: true,
        orderId: request.orderId,
        agentId: request.agentId,
        deliveryData: {
          paymentInstructions: aiResult.data,
          costAnalysis: aiResult.cost,
          deliveryTimeMs: aiResult.deliveryTimeMs,
          serviceType: 'payment_processing',
          completedAt: new Date().toISOString(),
        },
        status: 'completed',
      };

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
}
