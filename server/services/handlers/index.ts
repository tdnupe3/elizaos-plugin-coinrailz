/**
 * Service Handler Registry
 * Registers all service handlers with the delivery framework
 */

import { serviceDeliveryFramework } from '../serviceDeliveryFramework';
import { SmartContractAuditHandler } from './SmartContractAuditHandler';
import { PaymentProcessorHandler } from './PaymentProcessorHandler';
import { ComplianceConsultantHandler } from './ComplianceConsultantHandler';

// Initialize and register all handlers
export function initializeServiceHandlers(): void {
  console.log('🔧 Initializing service delivery handlers...');

  // Register Smart Contract Auditor
  serviceDeliveryFramework.registerHandler(
    'smart-contract-auditor',
    new SmartContractAuditHandler()
  );

  // Register Payment Processor
  serviceDeliveryFramework.registerHandler(
    'payment-processor',
    new PaymentProcessorHandler()
  );

  // Register Compliance Consultant
  serviceDeliveryFramework.registerHandler(
    'compliance-consultant',
    new ComplianceConsultantHandler()
  );

  console.log(`✅ Service delivery framework initialized with ${serviceDeliveryFramework.getRegisteredAgents().length} handlers`);
  console.log(`   Registered agents: ${serviceDeliveryFramework.getRegisteredAgents().join(', ')}`);
}

// Auto-initialize on import
initializeServiceHandlers();
