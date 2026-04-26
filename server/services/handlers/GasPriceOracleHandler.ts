/**
 * Gas Price Oracle Handler - AI-POWERED ✅
 * 
 * Uses blockchain RPC + GPT-4o-mini for intelligent gas price analysis
 * 
 * Service: $0.10
 * AI Cost: ~$0.003
 * Profit Margin: 97%
 */

import { ServiceHandler, ServiceDeliveryRequest, ServiceDeliveryResult } from '../serviceDeliveryFramework';
import { getGasPricesWithAI } from '../openAIServiceDelivery';

export class GasPriceOracleHandler implements ServiceHandler {
  canHandle(request: ServiceDeliveryRequest): boolean {
    return request.agentId === 'gas-price-oracle';
  }

  async execute(request: ServiceDeliveryRequest): Promise<ServiceDeliveryResult> {
    try {
      console.log(`⛽ Starting gas price oracle for order: ${request.orderId}`);

      const chains = request.chains || ['ethereum', 'base', 'polygon', 'arbitrum', 'optimism'];

      console.log(`⛽ Requesting AI gas prices for chains: ${chains.join(', ')}`);
      const aiResult = await getGasPricesWithAI(
        chains,
        request.orderId
      );

      if (!aiResult.success) {
        throw new Error(aiResult.error || 'AI gas price analysis failed');
      }

      console.log(`✅ Gas price oracle completed for order: ${request.orderId}`);
      console.log(`   💰 AI Cost: $${aiResult.cost?.totalCost.toFixed(4)}, Profit: $${(0.10 - (aiResult.cost?.totalCost || 0)).toFixed(2)}`);

      return {
        success: true,
        orderId: request.orderId,
        agentId: request.agentId,
        deliveryData: {
          gasPriceAnalysis: aiResult.data,
          costAnalysis: aiResult.cost,
          deliveryTimeMs: aiResult.deliveryTimeMs,
          serviceType: 'gas_price_oracle',
          completedAt: new Date().toISOString(),
        },
        status: 'completed',
      };

    } catch (error: any) {
      console.error(`❌ Gas price oracle failed:`, error);
      return {
        success: false,
        orderId: request.orderId,
        agentId: request.agentId,
        deliveryData: null,
        status: 'failed',
        error: error.message || 'Gas price oracle failed',
      };
    }
  }
}
