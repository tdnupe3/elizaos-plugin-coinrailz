/**
 * Smart Contract Audit Service Handler
 * Handles automated security audits using Slither
 */

import { ServiceHandler, ServiceDeliveryRequest, ServiceDeliveryResult } from '../serviceDeliveryFramework';
import { auditSmartContract, AuditResult } from '../smartContractAuditor';

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
      console.log(`🔍 Starting smart contract audit for order: ${request.orderId}`);

      if (!request.contractCode || !request.contractName) {
        throw new Error('Contract code and name required for audit');
      }

      // Execute Slither audit
      const auditResult: AuditResult = await auditSmartContract({
        contractCode: request.contractCode,
        contractName: request.contractName,
        userId: request.customerId,
        orderId: request.orderId,
      });

      console.log(`✅ Smart contract audit completed for order: ${request.orderId}`);
      console.log(`   Issues found: ${auditResult.issuesFound}, Severity: ${auditResult.severity}, Score: ${auditResult.auditScore}/100`);

      return {
        success: true,
        orderId: request.orderId,
        agentId: request.agentId,
        deliveryData: {
          auditResult,
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
