/**
 * Multi-Chain Balance Checker Handler - AI-POWERED ✅
 * 
 * Uses Alchemy RPC + GPT-4o-mini for intelligent portfolio analysis
 * 
 * Service: $0.50
 * AI Cost: ~$0.005
 * Profit Margin: 99%
 */

import { ServiceHandler, ServiceDeliveryRequest, ServiceDeliveryResult } from '../serviceDeliveryFramework';
import { analyzeMultiChainBalanceWithAI } from '../openAIServiceDelivery';

export class MultiChainBalanceHandler implements ServiceHandler {
  canHandle(request: ServiceDeliveryRequest): boolean {
    return (
      request.agentId === 'multi-chain-balance-checker' &&
      !!request.walletAddress
    );
  }

  async execute(request: ServiceDeliveryRequest): Promise<ServiceDeliveryResult> {
    try {
      console.log(`💼 Starting multi-chain balance check for order: ${request.orderId}`);

      if (!request.walletAddress) {
        throw new Error('Wallet address required for balance check');
      }

      const chains = request.chains || ['ethereum', 'base', 'polygon', 'arbitrum', 'optimism'];

      const aiResult = await analyzeMultiChainBalanceWithAI(
        request.walletAddress,
        chains,
        request.orderId
      );

      if (!aiResult.success) {
        throw new Error(aiResult.error || 'AI balance analysis failed');
      }

      console.log(`✅ Multi-chain balance check completed for order: ${request.orderId}`);
      console.log(`   💰 AI Cost: $${aiResult.cost?.totalCost.toFixed(4)}, Profit: $${(0.50 - (aiResult.cost?.totalCost || 0)).toFixed(2)}`);

      return {
        success: true,
        orderId: request.orderId,
        agentId: request.agentId,
        deliveryData: {
          balanceAnalysis: aiResult.data,
          costAnalysis: aiResult.cost,
          deliveryTimeMs: aiResult.deliveryTimeMs,
          serviceType: 'multi_chain_balance',
          completedAt: new Date().toISOString(),
        },
        status: 'completed',
      };

    } catch (error: any) {
      console.error(`❌ Multi-chain balance check failed:`, error);
      return {
        success: false,
        orderId: request.orderId,
        agentId: request.agentId,
        deliveryData: null,
        status: 'failed',
        error: error.message || 'Balance check failed',
      };
    }
  }
}
