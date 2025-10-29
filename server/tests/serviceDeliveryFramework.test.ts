/**
 * Service Delivery Framework Integration Tests
 * Tests all 3 AI marketplace agent handlers with mocking for CI/CD
 * 
 * To run: npm test -- serviceDeliveryFramework.test.ts
 */

import { describe, test, expect, beforeAll, jest, beforeEach } from '@jest/globals';
import { serviceDeliveryFramework } from '../services/serviceDeliveryFramework';
import { SmartContractAuditHandler } from '../services/handlers/SmartContractAuditHandler';
import { PaymentProcessorHandler } from '../services/handlers/PaymentProcessorHandler';
import { ComplianceConsultantHandler } from '../services/handlers/ComplianceConsultantHandler';
import { ServiceDeliveryRequest } from '../services/serviceDeliveryFramework';

// Mock Coinbase SDK for CI/CD environments (no real credentials/funds needed)
jest.mock('@coinbase/coinbase-sdk', () => ({
  Coinbase: {
    configure: jest.fn(),
  },
  Wallet: {
    create: jest.fn().mockResolvedValue({
      getDefaultAddress: jest.fn().mockResolvedValue({
        getId: () => '0xMOCKED_WALLET_ADDRESS_12345',
      }),
      createTransfer: jest.fn().mockResolvedValue({
        wait: jest.fn().mockResolvedValue(undefined),
        getTransactionHash: () => '0xMOCKED_TX_HASH_67890',
        getTransactionLink: () => 'https://basescan.org/tx/0xMOCKED_TX_HASH_67890',
      }),
      getBalance: jest.fn().mockResolvedValue(1000),
    }),
    fetch: jest.fn().mockResolvedValue({
      getDefaultAddress: jest.fn().mockResolvedValue({
        getId: () => '0xPLATFORM_WALLET_ADDRESS',
      }),
      getBalance: jest.fn().mockResolvedValue(10000),
      createTransfer: jest.fn().mockResolvedValue({
        wait: jest.fn().mockResolvedValue(undefined),
        getTransactionHash: () => '0xPLATFORM_TX_HASH',
        getTransactionLink: () => 'https://basescan.org/tx/0xPLATFORM_TX_HASH',
      }),
    }),
  },
}));

describe('Service Delivery Framework', () => {
  beforeAll(() => {
    // Mock CDP credentials for testing
    process.env.CDP_API_KEY_ID = 'test_api_key';
    process.env.CDP_PRIVATE_KEY = 'test_private_key';

    // Register all handlers
    serviceDeliveryFramework.registerHandler('smart-contract-auditor', new SmartContractAuditHandler());
    serviceDeliveryFramework.registerHandler('payment-processor', new PaymentProcessorHandler());
    serviceDeliveryFramework.registerHandler('compliance-consultant', new ComplianceConsultantHandler());
  });

  describe('Framework Registration', () => {
    test('should register all 3 handlers', () => {
      const agents = serviceDeliveryFramework.getRegisteredAgents();
      expect(agents).toHaveLength(3);
      expect(agents).toContain('smart-contract-auditor');
      expect(agents).toContain('payment-processor');
      expect(agents).toContain('compliance-consultant');
    });

    test('should check if handler exists for agent', () => {
      expect(serviceDeliveryFramework.hasHandler('smart-contract-auditor')).toBe(true);
      expect(serviceDeliveryFramework.hasHandler('payment-processor')).toBe(true);
      expect(serviceDeliveryFramework.hasHandler('compliance-consultant')).toBe(true);
      expect(serviceDeliveryFramework.hasHandler('nonexistent-agent')).toBe(false);
    });
  });

  describe('Smart Contract Auditor Handler', () => {
    test('should execute Slither analysis for Solidity contract', async () => {
      const request: ServiceDeliveryRequest = {
        orderId: 'test_order_001',
        agentId: 'smart-contract-auditor',
        serviceType: 'smart-contract-audit',
        contractDetails: {
          sourceCode: `
            pragma solidity ^0.8.0;
            contract SimpleToken {
              mapping(address => uint256) public balances;
              function transfer(address to, uint256 amount) public {
                balances[msg.sender] -= amount;
                balances[to] += amount;
              }
            }
          `,
          language: 'solidity',
          compilerVersion: '0.8.0'
        },
        metadata: {
          timestamp: new Date().toISOString()
        }
      };

      const result = await serviceDeliveryFramework.executeService(request);
      
      expect(result.success).toBe(true);
      expect(result.orderId).toBe('test_order_001');
      expect(result.agentId).toBe('smart-contract-auditor');
      expect(result.status).toBe('completed');
      expect(result.deliveryData).toBeDefined();
      expect(result.deliveryData.auditReport).toBeDefined();
    }, 60000); // Allow 60s for Slither analysis

    test('should handle invalid Solidity code', async () => {
      const request: ServiceDeliveryRequest = {
        orderId: 'test_order_002',
        agentId: 'smart-contract-auditor',
        serviceType: 'smart-contract-audit',
        contractDetails: {
          sourceCode: 'invalid solidity code',
          language: 'solidity'
        },
        metadata: {}
      };

      const result = await serviceDeliveryFramework.executeService(request);
      
      // Should complete but with compilation errors noted
      expect(result.orderId).toBe('test_order_002');
      expect(result.deliveryData).toBeDefined();
    }, 30000);
  });

  describe('Payment Processor Handler', () => {
    test('should validate payment details are required', async () => {
      const request: ServiceDeliveryRequest = {
        orderId: 'test_order_003',
        agentId: 'payment-processor',
        serviceType: 'payment_processing',
        metadata: {}
      };

      const result = await serviceDeliveryFramework.executeService(request);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Payment details required');
    });

    test('should validate recipient address is required', async () => {
      const request: ServiceDeliveryRequest = {
        orderId: 'test_order_004',
        agentId: 'payment-processor',
        serviceType: 'payment_processing',
        paymentDetails: {
          amount: 100,
          currency: 'USDC'
        },
        metadata: {}
      };

      const result = await serviceDeliveryFramework.executeService(request);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('recipientAddress');
    });

    test('should reject zero or negative amounts', async () => {
      const request: ServiceDeliveryRequest = {
        orderId: 'test_order_005',
        agentId: 'payment-processor',
        serviceType: 'payment_processing',
        paymentDetails: {
          recipientAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
          amount: 0,
          currency: 'USDC'
        },
        metadata: {}
      };

      const result = await serviceDeliveryFramework.executeService(request);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('greater than 0');
    });

    test('should create payment request with mocked CDP (no platform wallet)', async () => {
      const request: ServiceDeliveryRequest = {
        orderId: 'test_order_006',
        agentId: 'payment-processor',
        serviceType: 'payment_processing',
        paymentDetails: {
          recipientAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
          amount: 10,
          currency: 'USDC',
          network: 'base'
        },
        metadata: {}
      };

      const result = await serviceDeliveryFramework.executeService(request);
      
      expect(result.orderId).toBe('test_order_006');
      expect(result.agentId).toBe('payment-processor');
      expect(result.success).toBe(true); // Mocked always succeeds
      expect(result.status).toBe('completed');
      
      // Should create payment request (no platform wallet in test env)
      expect(result.deliveryData.paymentResult.method).toBe('payment_request');
      expect(result.deliveryData.paymentResult.paymentAddress).toBeDefined();
    }, 30000);

    test('should execute direct transfer with mocked platform wallet', async () => {
      // Temporarily set platform wallet for this test
      const originalWalletId = process.env.PLATFORM_CDP_WALLET_ID;
      process.env.PLATFORM_CDP_WALLET_ID = 'test_platform_wallet_123';

      // Need to reinstantiate handler to pick up new env var
      serviceDeliveryFramework.registerHandler('payment-processor', new PaymentProcessorHandler());

      const request: ServiceDeliveryRequest = {
        orderId: 'test_order_007',
        agentId: 'payment-processor',
        serviceType: 'payment_processing',
        paymentDetails: {
          recipientAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
          amount: 5,
          currency: 'USDC',
          network: 'base'
        },
        metadata: {}
      };

      const result = await serviceDeliveryFramework.executeService(request);
      
      expect(result.success).toBe(true);
      expect(result.status).toBe('completed');
      expect(result.deliveryData.paymentResult.method).toBe('direct_transfer');
      expect(result.deliveryData.paymentResult.transactionHash).toBeDefined();

      // Restore original env var
      if (originalWalletId) {
        process.env.PLATFORM_CDP_WALLET_ID = originalWalletId;
      } else {
        delete process.env.PLATFORM_CDP_WALLET_ID;
      }
    }, 30000);
  });

  describe('Compliance Consultant Handler', () => {
    test('should perform regulatory consulting', async () => {
      const request: ServiceDeliveryRequest = {
        orderId: 'test_order_008',
        agentId: 'compliance-consultant',
        serviceType: 'compliance_consulting',
        complianceRequirements: {
          jurisdiction: 'US',
          businessType: 'fintech',
          transactionVolume: 50000,
          customerType: 'retail'
        },
        metadata: {}
      };

      const result = await serviceDeliveryFramework.executeService(request);
      
      expect(result.success).toBe(true);
      expect(result.orderId).toBe('test_order_008');
      expect(result.agentId).toBe('compliance-consultant');
      expect(result.status).toBe('completed');
      expect(result.deliveryData).toBeDefined();
      expect(result.deliveryData.complianceReport).toBeDefined();
      expect(result.deliveryData.complianceReport.jurisdiction).toBe('US');
    });

    test('should perform AML screening with rule-based fallback', async () => {
      const request: ServiceDeliveryRequest = {
        orderId: 'test_order_009',
        agentId: 'compliance-consultant',
        serviceType: 'aml_screening',
        amlScreeningDetails: {
          address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
          amount: 10000,
          country: 'US'
        },
        metadata: {}
      };

      const result = await serviceDeliveryFramework.executeService(request);
      
      expect(result.success).toBe(true);
      expect(result.orderId).toBe('test_order_009');
      expect(result.status).toBe('completed');
      expect(result.deliveryData).toBeDefined();
      expect(result.deliveryData.amlScreeningResult).toBeDefined();
      expect(result.deliveryData.amlScreeningResult.riskLevel).toBeDefined();
      expect(result.deliveryData.amlScreeningResult.compliant).toBeDefined();
    });

    test('should flag high-risk jurisdictions', async () => {
      const request: ServiceDeliveryRequest = {
        orderId: 'test_order_010',
        agentId: 'compliance-consultant',
        serviceType: 'aml_screening',
        amlScreeningDetails: {
          address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
          amount: 5000,
          country: 'KP' // North Korea - high risk
        },
        metadata: {}
      };

      const result = await serviceDeliveryFramework.executeService(request);
      
      expect(result.success).toBe(true);
      expect(result.deliveryData.amlScreeningResult.riskLevel).not.toBe('low');
      expect(result.deliveryData.amlScreeningResult.riskScore).toBeGreaterThan(30);
    });

    test('should require either complianceRequirements or amlScreeningDetails', async () => {
      const request: ServiceDeliveryRequest = {
        orderId: 'test_order_011',
        agentId: 'compliance-consultant',
        serviceType: 'compliance_consulting',
        metadata: {}
      };

      const result = await serviceDeliveryFramework.executeService(request);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle requests for non-existent agents', async () => {
      const request: ServiceDeliveryRequest = {
        orderId: 'test_order_012',
        agentId: 'nonexistent-agent',
        serviceType: 'unknown',
        metadata: {}
      };

      const result = await serviceDeliveryFramework.executeService(request);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('No service handler');
    });

    test('should handle malformed requests gracefully', async () => {
      const request = {
        orderId: 'test_order_013',
        // Missing agentId
        metadata: {}
      } as any;

      const result = await serviceDeliveryFramework.executeService(request);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Rate Limiting', () => {
    beforeEach(() => {
      // Reset metrics before rate limit tests
      serviceDeliveryFramework.resetMetrics('compliance-consultant');
    });

    test('should enforce rate limits after 50 requests', async () => {
      const requests: Promise<any>[] = [];
      
      // Make 52 requests (limit is 50 per minute)
      for (let i = 0; i < 52; i++) {
        const request: ServiceDeliveryRequest = {
          orderId: `rate_limit_test_${i}`,
          agentId: 'compliance-consultant',
          serviceType: 'compliance_consulting',
          complianceRequirements: {
            jurisdiction: 'US',
            businessType: 'fintech'
          },
          metadata: {}
        };
        
        requests.push(serviceDeliveryFramework.executeService(request));
      }

      const results = await Promise.all(requests);
      
      // First 50 should succeed, next 2 should be rate limited
      const successful = results.filter(r => r.success).length;
      const rateLimited = results.filter(r => r.error?.includes('Rate limit')).length;
      
      expect(successful).toBe(50);
      expect(rateLimited).toBe(2);
    }, 60000);
  });

  describe('Metrics & Monitoring', () => {
    test('should track execution metrics', async () => {
      const request: ServiceDeliveryRequest = {
        orderId: 'metrics_test_001',
        agentId: 'compliance-consultant',
        serviceType: 'compliance_consulting',
        complianceRequirements: {
          jurisdiction: 'EU',
          businessType: 'exchange'
        },
        metadata: {}
      };

      await serviceDeliveryFramework.executeService(request);
      
      const metrics = serviceDeliveryFramework.getMetrics('compliance-consultant');
      
      expect(metrics).toBeDefined();
      expect(metrics?.totalExecutions).toBeGreaterThan(0);
      expect(metrics?.averageExecutionTime).toBeGreaterThan(0);
    });

    test('should provide health status', () => {
      const health = serviceDeliveryFramework.getHealthStatus();
      
      expect(health).toBeDefined();
      expect(health.status).toMatch(/healthy|degraded|unhealthy/);
      expect(health.registeredHandlers).toBe(3);
      expect(health.overallSuccessRate).toBeGreaterThanOrEqual(0);
      expect(health.overallSuccessRate).toBeLessThanOrEqual(100);
    });

    test('should track success and failure rates', async () => {
      serviceDeliveryFramework.resetMetrics('payment-processor');

      // Successful request
      await serviceDeliveryFramework.executeService({
        orderId: 'success_test',
        agentId: 'payment-processor',
        serviceType: 'payment_processing',
        paymentDetails: {
          recipientAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
          amount: 10,
          currency: 'USDC'
        },
        metadata: {}
      });

      // Failed request
      await serviceDeliveryFramework.executeService({
        orderId: 'failure_test',
        agentId: 'payment-processor',
        serviceType: 'payment_processing',
        paymentDetails: {
          amount: -5, // Invalid amount
        },
        metadata: {}
      });

      const metrics = serviceDeliveryFramework.getMetrics('payment-processor');
      
      expect(metrics?.totalExecutions).toBe(2);
      expect(metrics?.successfulExecutions).toBe(1);
      expect(metrics?.failedExecutions).toBe(1);
    }, 30000);
  });

  describe('Performance', () => {
    test('should execute compliance requests within reasonable time', async () => {
      const request: ServiceDeliveryRequest = {
        orderId: 'perf_test_001',
        agentId: 'compliance-consultant',
        serviceType: 'compliance_consulting',
        complianceRequirements: {
          jurisdiction: 'EU',
          businessType: 'exchange'
        },
        metadata: {}
      };

      const startTime = Date.now();
      const result = await serviceDeliveryFramework.executeService(request);
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds
    });
  });
});
