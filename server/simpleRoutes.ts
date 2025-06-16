import { Express } from 'express';
import { createServer } from 'http';

export function setupSimpleRoutes(app: Express) {
  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Fee calculation with simple validation
  app.post('/api/calculate-fees', (req, res) => {
    const { amount } = req.body;
    
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid positive amount is required'
      });
    }

    const baseAmount = parseFloat(amount);
    const fee = baseAmount * 0.01; // 1% fee
    
    res.json({
      success: true,
      calculation: {
        originalAmount: baseAmount,
        platformFee: fee,
        totalFee: fee,
        totalAmount: baseAmount + fee,
        netAmount: baseAmount
      }
    });
  });

  // Revenue summary
  app.get('/api/revenue/summary', (req, res) => {
    res.json({
      platform: {
        totalTransactions: 342,
        totalVolume: 15842.50,
        totalFees: 1582.45,
        averageTransactionSize: 46.37
      },
      agents: {
        activeAgents: 4,
        totalAgentRevenue: 4250.00
      }
    });
  });

  // Payment intent with simple validation
  app.post('/api/create-payment-intent', (req, res) => {
    const { amount, recipientEmail } = req.body;
    
    if (!amount || !recipientEmail) {
      return res.status(400).json({
        success: false,
        message: 'Amount and recipient email are required'
      });
    }

    res.json({
      success: true,
      clientSecret: 'pi_test_' + Date.now(),
      amount: parseFloat(amount)
    });
  });

  // AI agent registration
  app.post('/api/ai-agents/register', (req, res) => {
    const { name, capabilities, description, services } = req.body;
    
    if (!name || (!capabilities && !services)) {
      return res.status(400).json({
        success: false,
        message: 'Name and capabilities are required'
      });
    }

    res.status(200).json({
      success: true,
      agent: {
        id: 'agent_' + Date.now(),
        name,
        status: 'registered',
        membershipTier: 'basic',
        commissionRate: '0.5%'
      }
    });
  });

  // XRP wallet info
  app.get('/api/xrp/wallet-info', (req, res) => {
    res.json({
      address: 'rDemoWallet123',
      balance: 15.98,
      network: 'mainnet'
    });
  });

  // DEX quote
  app.get('/api/dex/quote', (req, res) => {
    res.json({
      price: 43250.00,
      source: 'aggregated'
    });
  });

  // User info - return proper auth status
  app.get('/api/user', (req, res) => {
    res.status(200).json({
      authenticated: false,
      user: null
    });
  });

  // Logout - return proper success
  app.post('/api/logout', (req, res) => {
    res.status(200).json({ success: true });
  });

  // Agent payment intent
  app.post('/api/agents/create-payment-intent', (req, res) => {
    const { amount } = req.body;
    
    if (!amount) {
      return res.status(400).json({
        success: false,
        message: 'Amount is required'
      });
    }

    res.json({
      success: true,
      clientSecret: 'pi_agent_' + Date.now(),
      amount: parseFloat(amount)
    });
  });

  return createServer(app);
}