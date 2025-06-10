
import express from 'express';
import { vi } from 'vitest';

export async function setupTestApp(): Promise<express.Application> {
  const app = express();
  
  // Basic middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Mock authentication middleware
  app.use((req, res, next) => {
    req.user = {
      id: 'test-user-123',
      email: 'test@example.com',
      isVerified: true
    };
    next();
  });

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: Date.now(),
      environment: 'test'
    });
  });

  // Mock AI agents endpoints
  app.get('/api/ai-agents', (req, res) => {
    res.json({
      success: true,
      agents: [
        {
          id: 'test-agent-1',
          name: 'Test Agent 1',
          serviceType: 'trading',
          isActive: true
        }
      ]
    });
  });

  app.post('/api/ai-agents/register', (req, res) => {
    res.status(201).json({
      success: true,
      agent: {
        id: 'new-agent-' + Date.now(),
        ...req.body,
        isActive: true,
        createdAt: new Date().toISOString()
      }
    });
  });

  // Mock transaction endpoints
  app.post('/api/transactions/agent-to-agent', (req, res) => {
    const { amount } = req.body;
    const platformFee = amount * 0.035; // 3.5% fee
    
    res.status(201).json({
      success: true,
      transaction: {
        id: 'txn-' + Date.now(),
        ...req.body,
        platformFee,
        netAmount: amount - platformFee,
        status: 'completed',
        createdAt: new Date().toISOString()
      }
    });
  });

  return app;
}
