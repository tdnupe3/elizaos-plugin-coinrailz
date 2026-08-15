/**
 * Service Handler Registry - AI-POWERED SERVICES ✅
 * All 6 services use OpenAI + existing integrations for profitable delivery
 */

import { serviceDeliveryFramework } from '../serviceDeliveryFramework';
import { SmartContractAuditHandler } from './SmartContractAuditHandler';
import { PaymentProcessorHandler } from './PaymentProcessorHandler';
import { ComplianceConsultantHandler } from './ComplianceConsultantHandler';
import { MultiChainBalanceHandler } from './MultiChainBalanceHandler';
import { GasPriceOracleHandler } from './GasPriceOracleHandler';
import { TokenPriceLookupHandler } from './TokenPriceLookupHandler';

// Initialize and register all handlers
export function initializeServiceHandlers(): void {
  console.log('🔧 Initializing AI-powered service delivery handlers...');

  // Register Smart Contract Auditor ($10.00)
  serviceDeliveryFramework.registerHandler(
    'smart-contract-auditor',
    new SmartContractAuditHandler()
  );

  // Register Payment Processor ($0.50)
  serviceDeliveryFramework.registerHandler(
    'payment-processor',
    new PaymentProcessorHandler()
  );

  // Register Compliance Consultant ($5.00)
  serviceDeliveryFramework.registerHandler(
    'compliance-consultant',
    new ComplianceConsultantHandler()
  );

  // Register Multi-Chain Balance Checker ($0.50)
  serviceDeliveryFramework.registerHandler(
    'multi-chain-balance-checker',
    new MultiChainBalanceHandler()
  );

  // Register Gas Price Oracle ($0.10)
  serviceDeliveryFramework.registerHandler(
    'gas-price-oracle',
    new GasPriceOracleHandler()
  );

  // Register Token Price Lookup ($0.25)
  serviceDeliveryFramework.registerHandler(
    'token-price-lookup',
    new TokenPriceLookupHandler()
  );

  console.log(`✅ Service delivery framework initialized with ${serviceDeliveryFramework.getRegisteredAgents().length} AI-powered handlers`);
  console.log(`   Registered agents: ${serviceDeliveryFramework.getRegisteredAgents().join(', ')}`);
  console.log(`   🤖 All services powered by OpenAI GPT-4o/GPT-4o-mini`);
  console.log(`   💰 Profit margins: 97-99.99% on all services`);
}

// Export initialization function for explicit server startup
// DO NOT auto-initialize on import - must be called explicitly from server/index.ts
