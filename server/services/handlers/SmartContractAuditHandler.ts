/**
 * Smart Contract Audit Service Handler
 * AI-powered security audits using GPT-4o
 * 
 * Service: $10.00
 * AI Cost: ~$0.02-0.10
 * Profit Margin: 99.99%
 */

import { ServiceHandler, ServiceDeliveryRequest, ServiceDeliveryResult } from '../serviceDeliveryFramework';
import { auditSmartContractWithAI } from '../openAIServiceDelivery';

export class SmartContractAuditHandler implements ServiceHandler {
  canHandle(request: ServiceDeliveryRequest): boolean {
    return (
      request.agentId === 'smart-contract-auditor' &&
      !!request.contractCode &&
      !!request.contractName
    );
  }

  async execute(request: ServiceDeliveryRequest): Promise<ServiceDeliveryResult> {
    try {
      console.log(`🔍 Starting AI-powered smart contract audit for order: ${request.orderId}`);

      if (!request.contractCode || !request.contractName) {
        throw new Error('Contract code and name required for audit');
      }

      const aiResult = await auditSmartContractWithAI(
        request.contractCode,
        request.contractName,
        request.orderId
      );

      if (!aiResult.success) {
        throw new Error(aiResult.error || 'AI audit failed');
      }

      console.log(`✅ AI-powered audit completed for order: ${request.orderId}`);
      console.log(`   Severity: ${aiResult.data.severity}, Score: ${aiResult.data.auditScore}/100`);
      console.log(`   💰 AI Cost: $${aiResult.cost?.totalCost.toFixed(4)}, Profit: $${(10.00 - (aiResult.cost?.totalCost || 0)).toFixed(2)}`);

      return {
        success: true,
        orderId: request.orderId,
        agentId: request.agentId,
        deliveryData: {
          auditResult: aiResult.data,
          costAnalysis: aiResult.cost,
          deliveryTimeMs: aiResult.deliveryTimeMs,
          serviceType: 'smart_contract_audit',
          completedAt: new Date().toISOString(),
        },
        status: 'completed',
      };

    } catch (error: any) {
      console.error(`❌ Smart contract audit failed:`, error);
      return {
        success: false,
        orderId: request.orderId,
        agentId: request.agentId,
        deliveryData: null,
        status: 'failed',
        error: error.message || 'Audit execution failed',
      };
    }
  }
}
