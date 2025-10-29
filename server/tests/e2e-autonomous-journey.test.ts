/**
 * End-to-End Autonomous Customer Journey Test
 * 
 * Tests the complete AI agent workflow:
 * 1. Discovery (A2A protocol agent card retrieval)
 * 2. Order creation
 * 3. Payment processing (simulated x402 payment)
 * 4. Automated service delivery
 * 5. Results retrieval
 * 
 * Run: npm run test:e2e
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import axios from 'axios';

const BASE_URL = process.env.API_URL || 'http://localhost:5000';

// Mock CDP SDK for testing
jest.mock('@coinbase/coinbase-sdk', () => ({
  Coinbase: {
    configure: jest.fn(),
  },
  Wallet: {
    create: jest.fn().mockResolvedValue({
      getDefaultAddress: jest.fn().mockResolvedValue({
        getId: () => '0xMOCKED_PAYMENT_WALLET',
      }),
      createTransfer: jest.fn().mockResolvedValue({
        wait: jest.fn().mockResolvedValue(undefined),
        getTransactionHash: () => '0xMOCKED_PAYMENT_TX_HASH',
        getTransactionLink: () => 'https://basescan.org/tx/0xMOCKED_PAYMENT_TX_HASH',
      }),
    }),
    fetch: jest.fn().mockResolvedValue({
      getDefaultAddress: jest.fn().mockResolvedValue({
        getId: () => '0xPLATFORM_WALLET',
      }),
      getBalance: jest.fn().mockResolvedValue(10000),
      createTransfer: jest.fn().mockResolvedValue({
        wait: jest.fn().mockResolvedValue(undefined),
        getTransactionHash: () => '0xPLATFORM_TX',
        getTransactionLink: () => 'https://basescan.org/tx/0xPLATFORM_TX',
      }),
    }),
  },
}));

describe('E2E: Autonomous AI Agent Customer Journey', () => {
  const testAgentIds = [
    'smart-contract-auditor',
    'payment-processor',
    'compliance-consultant',
  ];

  describe('Step 1: Agent Discovery (A2A Protocol)', () => {
    test('should discover all 3 marketplace agents via agent directory', async () => {
      const response = await axios.get(`${BASE_URL}/api/agents/directory`);
      
      expect(response.status).toBe(200);
      expect(response.data.agents).toBeInstanceOf(Array);
      expect(response.data.agents.length).toBeGreaterThanOrEqual(3);
      
      // Verify all 3 deliverable agents are discoverable
      const agentIds = response.data.agents.map((a: any) => a.id);
      expect(agentIds).toContain('smart-contract-auditor');
      expect(agentIds).toContain('payment-processor');
      expect(agentIds).toContain('compliance-consultant');
    });

    test('should retrieve agent card for smart-contract-auditor (A2A protocol)', async () => {
      const response = await axios.get(
        `${BASE_URL}/agent/smart-contract-auditor/.well-known/agent-card.json`
      );
      
      expect(response.status).toBe(200);
      expect(response.data.id).toBe('smart-contract-auditor');
      expect(response.data.capabilities).toBeDefined();
      expect(response.data.capabilities).toContain('smart-contract-audit');
      expect(response.data.pricing).toBeDefined();
      expect(response.data.payment_methods).toBeDefined();
      expect(response.data.payment_methods).toContain('x402');
    });

    test('should retrieve agent card for payment-processor (A2A protocol)', async () => {
      const response = await axios.get(
        `${BASE_URL}/agent/payment-processor/.well-known/agent-card.json`
      );
      
      expect(response.status).toBe(200);
      expect(response.data.id).toBe('payment-processor');
      expect(response.data.capabilities).toContain('payment_processing');
    });

    test('should retrieve agent card for compliance-consultant (A2A protocol)', async () => {
      const response = await axios.get(
        `${BASE_URL}/agent/compliance-consultant/.well-known/agent-card.json`
      );
      
      expect(response.status).toBe(200);
      expect(response.data.id).toBe('compliance-consultant');
      expect(response.data.capabilities).toContain('aml_screening');
      expect(response.data.capabilities).toContain('compliance_consulting');
    });

    test('should check health status for each agent', async () => {
      for (const agentId of testAgentIds) {
        const response = await axios.get(`${BASE_URL}/api/agent/${agentId}/health`);
        
        expect(response.status).toBe(200);
        expect(response.data.status).toBe('active');
        expect(response.data.agent_id).toBe(agentId);
        expect(response.data.available).toBe(true);
      }
    });
  });

  describe('Step 2: Order Creation', () => {
    test('should create order for smart contract audit service', async () => {
      const orderPayload = {
        agentId: 'smart-contract-auditor',
        customerRequirements: JSON.stringify({
          contractDetails: {
            sourceCode: `
              pragma solidity ^0.8.0;
              contract TestToken {
                mapping(address => uint256) public balances;
                function transfer(address to, uint256 amount) public {
                  balances[msg.sender] -= amount;
                  balances[to] += amount;
                }
              }
            `,
            language: 'solidity',
            compilerVersion: '0.8.0',
          },
        }),
        priceUSDC: 50,
      };

      const response = await axios.post(`${BASE_URL}/api/marketplace/order`, orderPayload);
      
      expect(response.status).toBe(201);
      expect(response.data.success).toBe(true);
      expect(response.data.order).toBeDefined();
      expect(response.data.order.agentId).toBe('smart-contract-auditor');
      expect(response.data.order.status).toBe('pending_payment');
      expect(response.data.paymentAddress).toBeDefined();
    });

    test('should create order for payment processing service', async () => {
      const orderPayload = {
        agentId: 'payment-processor',
        customerRequirements: JSON.stringify({
          paymentDetails: {
            recipientAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
            amount: 100,
            currency: 'USDC',
            network: 'base',
          },
        }),
        priceUSDC: 10,
      };

      const response = await axios.post(`${BASE_URL}/api/marketplace/order`, orderPayload);
      
      expect(response.status).toBe(201);
      expect(response.data.success).toBe(true);
      expect(response.data.order.agentId).toBe('payment-processor');
    });

    test('should create order for compliance consulting service', async () => {
      const orderPayload = {
        agentId: 'compliance-consultant',
        customerRequirements: JSON.stringify({
          complianceRequirements: {
            jurisdiction: 'US',
            businessType: 'fintech',
            transactionVolume: 100000,
          },
        }),
        priceUSDC: 25,
      };

      const response = await axios.post(`${BASE_URL}/api/marketplace/order`, orderPayload);
      
      expect(response.status).toBe(201);
      expect(response.data.success).toBe(true);
      expect(response.data.order.agentId).toBe('compliance-consultant');
    });
  });

  describe('Step 3: Payment Processing (x402 Protocol)', () => {
    let testOrderId: string;

    beforeAll(async () => {
      // Create a test order
      const orderPayload = {
        agentId: 'compliance-consultant',
        customerRequirements: JSON.stringify({
          amlScreeningDetails: {
            address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
            amount: 5000,
            country: 'US',
          },
        }),
        priceUSDC: 15,
      };

      const orderResponse = await axios.post(`${BASE_URL}/api/marketplace/order`, orderPayload);
      testOrderId = orderResponse.data.order.id;
    });

    test('should process x402 payment and trigger service delivery', async () => {
      // Simulate x402 payment
      const paymentPayload = {
        orderId: testOrderId,
        amount: 15,
        currency: 'USDC',
        network: 'base',
        transactionHash: '0xMOCKED_X402_PAYMENT_HASH',
      };

      const response = await axios.post(`${BASE_URL}/api/x402/verify-payment`, paymentPayload);
      
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.order_status).toBe('processing');
    }, 30000); // Allow 30s for service delivery

    test('should verify order status changed to processing after payment', async () => {
      const response = await axios.get(`${BASE_URL}/api/marketplace/order/${testOrderId}`);
      
      expect(response.status).toBe(200);
      expect(['processing', 'completed']).toContain(response.data.order.status);
    });
  });

  describe('Step 4: Automated Service Delivery', () => {
    test('should execute smart contract audit service', async () => {
      // Create and pay for order
      const orderPayload = {
        agentId: 'smart-contract-auditor',
        customerRequirements: JSON.stringify({
          contractDetails: {
            sourceCode: `
              pragma solidity ^0.8.0;
              contract VulnerableToken {
                mapping(address => uint256) balances;
                function transfer(address to, uint256 amt) public {
                  balances[msg.sender] -= amt;
                  balances[to] += amt;
                }
              }
            `,
            language: 'solidity',
          },
        }),
        priceUSDC: 50,
      };

      const orderResponse = await axios.post(`${BASE_URL}/api/marketplace/order`, orderPayload);
      const orderId = orderResponse.data.order.id;

      // Simulate payment
      await axios.post(`${BASE_URL}/api/x402/verify-payment`, {
        orderId,
        amount: 50,
        transactionHash: '0xTEST_AUDIT_PAYMENT',
      });

      // Wait for service delivery (service executes automatically after payment)
      await new Promise((resolve) => setTimeout(resolve, 10000)); // 10s for Slither

      // Check order for delivery results
      const resultResponse = await axios.get(`${BASE_URL}/api/marketplace/order/${orderId}`);
      
      expect(resultResponse.data.order.status).toBe('completed');
      const requirements = JSON.parse(resultResponse.data.order.customerRequirements);
      expect(requirements.deliveryResult).toBeDefined();
      expect(requirements.deliveryResult.auditReport).toBeDefined();
    }, 60000); // Allow 60s for audit

    test('should execute payment processing service', async () => {
      const orderPayload = {
        agentId: 'payment-processor',
        customerRequirements: JSON.stringify({
          paymentDetails: {
            recipientAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
            amount: 25,
            currency: 'USDC',
            network: 'base',
          },
        }),
        priceUSDC: 5,
      };

      const orderResponse = await axios.post(`${BASE_URL}/api/marketplace/order`, orderPayload);
      const orderId = orderResponse.data.order.id;

      // Simulate payment
      await axios.post(`${BASE_URL}/api/x402/verify-payment`, {
        orderId,
        amount: 5,
        transactionHash: '0xTEST_PAYMENT_SERVICE',
      });

      // Wait for service delivery
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // Check results
      const resultResponse = await axios.get(`${BASE_URL}/api/marketplace/order/${orderId}`);
      
      expect(resultResponse.data.order.status).toBe('completed');
      const requirements = JSON.parse(resultResponse.data.order.customerRequirements);
      expect(requirements.deliveryResult).toBeDefined();
      expect(requirements.deliveryResult.paymentResult).toBeDefined();
    }, 30000);

    test('should execute compliance consulting service', async () => {
      const orderPayload = {
        agentId: 'compliance-consultant',
        customerRequirements: JSON.stringify({
          complianceRequirements: {
            jurisdiction: 'EU',
            businessType: 'exchange',
            transactionVolume: 500000,
          },
        }),
        priceUSDC: 30,
      };

      const orderResponse = await axios.post(`${BASE_URL}/api/marketplace/order`, orderPayload);
      const orderId = orderResponse.data.order.id;

      // Simulate payment
      await axios.post(`${BASE_URL}/api/x402/verify-payment`, {
        orderId,
        amount: 30,
        transactionHash: '0xTEST_COMPLIANCE',
      });

      // Wait for service delivery
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Check results
      const resultResponse = await axios.get(`${BASE_URL}/api/marketplace/order/${orderId}`);
      
      expect(resultResponse.data.order.status).toBe('completed');
      const requirements = JSON.parse(resultResponse.data.order.customerRequirements);
      expect(requirements.deliveryResult).toBeDefined();
      expect(requirements.deliveryResult.complianceReport).toBeDefined();
    }, 15000);
  });

  describe('Step 5: Results Retrieval', () => {
    test('should retrieve completed order with delivery results', async () => {
      // Create and complete a quick order
      const orderPayload = {
        agentId: 'compliance-consultant',
        customerRequirements: JSON.stringify({
          amlScreeningDetails: {
            address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
            amount: 1000,
            country: 'US',
          },
        }),
        priceUSDC: 10,
      };

      const orderResponse = await axios.post(`${BASE_URL}/api/marketplace/order`, orderPayload);
      const orderId = orderResponse.data.order.id;

      await axios.post(`${BASE_URL}/api/x402/verify-payment`, {
        orderId,
        amount: 10,
        transactionHash: '0xTEST_RESULTS',
      });

      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Retrieve results
      const resultResponse = await axios.get(`${BASE_URL}/api/marketplace/order/${orderId}`);
      
      expect(resultResponse.status).toBe(200);
      expect(resultResponse.data.order.id).toBe(orderId);
      expect(resultResponse.data.order.status).toBe('completed');
      
      const requirements = JSON.parse(resultResponse.data.order.customerRequirements);
      expect(requirements.deliveryResult).toBeDefined();
      expect(requirements.deliveryResult.amlScreeningResult).toBeDefined();
      expect(requirements.deliveryResult.amlScreeningResult.riskLevel).toBeDefined();
    }, 15000);
  });

  describe('Platform Health & Metrics', () => {
    test('should provide service delivery framework health status', async () => {
      // This would require an API endpoint to expose framework health
      // For now, verify framework is operational by successful service delivery
      const orderPayload = {
        agentId: 'compliance-consultant',
        customerRequirements: JSON.stringify({
          complianceRequirements: {
            jurisdiction: 'US',
            businessType: 'fintech',
          },
        }),
        priceUSDC: 10,
      };

      const orderResponse = await axios.post(`${BASE_URL}/api/marketplace/order`, orderPayload);
      const orderId = orderResponse.data.order.id;

      await axios.post(`${BASE_URL}/api/x402/verify-payment`, {
        orderId,
        amount: 10,
        transactionHash: '0xHEALTH_CHECK',
      });

      await new Promise((resolve) => setTimeout(resolve, 3000));

      const resultResponse = await axios.get(`${BASE_URL}/api/marketplace/order/${orderId}`);
      expect(resultResponse.data.order.status).toBe('completed');
    }, 15000);
  });
});

/**
 * Test Summary:
 * 
 * This E2E test validates the complete autonomous customer journey:
 * 
 * 1. ✅ Agent Discovery via A2A protocol
 * 2. ✅ Order creation for all 3 agents
 * 3. ✅ x402 payment processing
 * 4. ✅ Automated service delivery
 * 5. ✅ Results retrieval
 * 
 * All 3 marketplace agents (smart-contract-auditor, payment-processor, compliance-consultant)
 * are tested end-to-end with real service delivery execution.
 */
