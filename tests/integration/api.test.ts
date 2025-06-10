
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { setupTestApp } from '../utils/testApp';

describe('API Integration Tests', () => {
  let app: express.Application;
  let server: any;

  beforeAll(async () => {
    app = await setupTestApp();
    server = app.listen(0); // Use random port for testing
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: expect.stringMatching(/healthy|warning|critical/),
        timestamp: expect.any(Number)
      });
    });
  });

  describe('AI Agent Endpoints', () => {
    it('should list available agents', async () => {
      const response = await request(app)
        .get('/api/ai-agents')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.agents)).toBe(true);
    });

    it('should register new agent with valid data', async () => {
      const agentData = {
        name: 'Test Trading Agent',
        description: 'Automated trading bot',
        serviceType: 'trading',
        pricingTier: 'premium',
        capabilities: ['market-analysis', 'risk-management']
      };

      const response = await request(app)
        .post('/api/ai-agents/register')
        .send(agentData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.agent.name).toBe(agentData.name);
    });
  });

  describe('Transaction Endpoints', () => {
    it('should process agent-to-agent transaction', async () => {
      const transactionData = {
        fromAgentId: 'test-agent-1',
        toAgentId: 'test-agent-2',
        amount: 50,
        currency: 'USD',
        description: 'Test transaction'
      };

      const response = await request(app)
        .post('/api/transactions/agent-to-agent')
        .send(transactionData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.transaction.amount).toBe(50);
      expect(response.body.transaction.platformFee).toBeGreaterThan(0);
    });
  });
});
