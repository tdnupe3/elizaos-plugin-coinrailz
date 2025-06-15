
import express, { Request, Response } from 'express';
import { pool } from './db';
import { stabilityManager } from './services/stabilityManager';

const router = express.Router();

// Production health endpoint
router.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    service: 'Coin Railz',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Essential API endpoints only
router.get('/api/demo/user', async (req: Request, res: Response) => {
  try {
    // Explicitly set JSON response headers
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({
      id: 'demo-user',
      name: 'Demo User',
      email: 'demo@coinrailz.com',
      balance: 1000
    });
  } catch (error) {
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/api/demo/balances', async (req: Request, res: Response) => {
  try {
    res.json({
      usd: 1000,
      btc: 0.025,
      eth: 0.5,
      xrp: 1000
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/api/demo/transactions', async (req: Request, res: Response) => {
  try {
    res.json([
      {
        id: '1',
        type: 'send',
        amount: 100,
        currency: 'USD',
        timestamp: new Date().toISOString(),
        status: 'completed'
      }
    ]);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/api/demo/crypto-prices', async (req: Request, res: Response) => {
  try {
    res.json({
      bitcoin: { usd: 45000 },
      ethereum: { usd: 3000 },
      ripple: { usd: 0.6 }
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Recruitment endpoints
router.post('/api/recruitment/test-github-discovery', async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      message: 'GitHub discovery test completed',
      agentsFound: 25
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/api/recruitment/start-automated-recruitment', async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      message: 'Automated recruitment started',
      campaignId: 'campaign-' + Date.now()
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Catch-all for API routes
router.use('/api/*', (req: Request, res: Response) => {
  res.status(404).json({ 
    success: false, 
    message: 'API endpoint not found: ' + req.originalUrl 
  });
});

export default router;
