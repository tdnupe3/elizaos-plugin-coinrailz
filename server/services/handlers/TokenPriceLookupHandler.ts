/**
 * Token Price Lookup Handler - AI-POWERED ✅
 * 
 * Uses DEXScreener + GPT-4o-mini for intelligent token price analysis
 * 
 * Service: $0.25
 * AI Cost: ~$0.004
 * Profit Margin: 98%
 */

import { ServiceHandler, ServiceDeliveryRequest, ServiceDeliveryResult } from '../serviceDeliveryFramework';
import { getTokenPriceWithAI } from '../openAIServiceDelivery';

export class TokenPriceLookupHandler implements ServiceHandler {
  canHandle(request: ServiceDeliveryRequest): boolean {
    return (
      request.agentId === 'token-price-lookup' &&
      !!request.tokenAddress
    );
  }

  async execute(request: ServiceDeliveryRequest): Promise<ServiceDeliveryResult> {
    try {
      console.log(`💰 Starting token price lookup for order: ${request.orderId}`);

      if (!request.tokenAddress) {
        throw new Error('Token address required for price lookup');
      }

      const chain = request.chain || 'ethereum';

      const aiResult = await getTokenPriceWithAI(
        request.tokenAddress,
        chain,
        request.orderId
      );

      if (!aiResult.success) {
        throw new Error(aiResult.error || 'AI token price analysis failed');
      }

      console.log(`✅ Token price lookup completed for order: ${request.orderId}`);
      console.log(`   💰 AI Cost: $${aiResult.cost?.totalCost.toFixed(4)}, Profit: $${(0.25 - (aiResult.cost?.totalCost || 0)).toFixed(2)}`);

      return {
        success: true,
        orderId: request.orderId,
        agentId: request.agentId,
        deliveryData: {
          tokenPriceAnalysis: aiResult.data,
          costAnalysis: aiResult.cost,
          deliveryTimeMs: aiResult.deliveryTimeMs,
          serviceType: 'token_price_lookup',
          completedAt: new Date().toISOString(),
        },
        status: 'completed',
      };

    } catch (error: any) {
      console.error(`❌ Token price lookup failed:`, error);
      return {
        success: false,
        orderId: request.orderId,
        agentId: request.agentId,
        deliveryData: null,
        status: 'failed',
        error: error.message || 'Token price lookup failed',
      };
    }
  }
}
