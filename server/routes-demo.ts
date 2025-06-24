/**
 * Demo API routes that mirror the main application functionality
 * Provides realistic demo data for all notification features
 */

import type { Express } from "express";

export function registerDemoRoutes(app: Express) {
  // Demo notification endpoints
  app.get('/api/demo/notifications', (req, res) => {
    const demoNotifications = [
      {
        id: '1',
        userId: 'demo-user',
        type: 'transaction_completed',
        title: 'Payment Received',
        message: 'You received $250.00 USD from Alex Johnson',
        priority: 'high',
        isRead: false,
        createdAt: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
        actionUrl: '/demo-transaction-history'
      },
      {
        id: '2',
        userId: 'demo-user',
        type: 'ai_agent_activity',
        title: 'AI Agent Update: Crypto Signals Agent',
        message: 'New trading signal: BTC bullish trend detected',
        priority: 'medium',
        isRead: false,
        createdAt: new Date(Date.now() - 900000).toISOString(), // 15 minutes ago
        actionUrl: '/ai-agents'
      },
      {
        id: '3',
        userId: 'demo-user',
        type: 'referral_earned',
        title: 'Referral Reward Earned!',
        message: 'You earned $12.50 USD from AI agent referral',
        priority: 'high',
        isRead: true,
        createdAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        actionUrl: '/referrals'
      },
      {
        id: '4',
        userId: 'demo-user',
        type: 'system_announcement',
        title: 'Platform Update',
        message: 'New features added to the AI Agent Marketplace',
        priority: 'medium',
        isRead: true,
        createdAt: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
        actionUrl: '/ai-agent-marketplace'
      },
      {
        id: '5',
        userId: 'demo-user',
        type: 'security_alert',
        title: 'Security Alert: Login from New Device',
        message: 'We detected a login from a new device in New York, NY',
        priority: 'critical',
        isRead: true,
        createdAt: new Date(Date.now() - 10800000).toISOString(), // 3 hours ago
        actionUrl: '/settings'
      }
    ];

    res.json(demoNotifications);
  });

  app.get('/api/demo/notifications/unread-count', (req, res) => {
    res.json({ count: 2 }); // Demo unread count
  });

  app.post('/api/demo/notifications/mark-read', (req, res) => {
    res.json({ success: true }); // Demo mark as read
  });

  app.post('/api/demo/notifications/mark-all-read', (req, res) => {
    res.json({ success: true, marked: 2 }); // Demo mark all as read
  });

  app.get('/api/demo/notifications/settings', (req, res) => {
    res.json({
      emailNotifications: true,
      pushNotifications: true,
      smsNotifications: false,
      transactionAlerts: true,
      securityAlerts: true,
      marketingEmails: false,
      agentNotifications: true,
      referralNotifications: true
    });
  });

  // Demo user data endpoint
  app.get('/api/demo/user', (req, res) => {
    res.json({
      id: 'demo-user-001',
      email: 'demo@coinrailz.com',
      firstName: 'Demo',
      lastName: 'User',
      name: 'Demo User',
      balance: 1000,
      usdBalance: '2847.52',
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      accountStatus: 'active',
      kycStatus: 'verified'
    });
  });

  // Demo balances endpoint
  app.get('/api/demo/balances', (req, res) => {
    res.json([
      {
        currency: 'USD',
        balance: '2847.52',
        availableBalance: '2800.00',
        frozenBalance: '47.52'
      },
      {
        currency: 'BTC',
        balance: '0.05432100',
        availableBalance: '0.05432100',
        frozenBalance: '0.00000000',
        usdValue: '2341.20'
      },
      {
        currency: 'ETH',
        balance: '0.89234500',
        availableBalance: '0.89234500',
        frozenBalance: '0.00000000',
        usdValue: '2156.80'
      },
      {
        currency: 'XRP',
        balance: '1247.50000000',
        availableBalance: '1247.50000000',
        frozenBalance: '0.00000000',
        usdValue: '849.12'
      }
    ]);
  });

  // Demo transactions endpoint
  app.get('/api/demo/transactions', (req, res) => {
    res.json([
      {
        id: 'tx-demo-001',
        type: 'received',
        amount: '250.00',
        currency: 'USD',
        from: 'Alex Johnson',
        to: 'Demo User',
        status: 'completed',
        timestamp: new Date(Date.now() - 300000).toISOString(),
        fee: '2.50',
        description: 'Payment for services'
      },
      {
        id: 'tx-demo-002',
        type: 'sent',
        amount: '0.00123456',
        currency: 'BTC',
        from: 'Demo User',
        to: 'Crypto Exchange',
        status: 'completed',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        fee: '0.00002000',
        description: 'Bitcoin transfer'
      },
      {
        id: 'tx-demo-003',
        type: 'received',
        amount: '150.00',
        currency: 'USD',
        from: 'AI Agent Commission',
        to: 'Demo User',
        status: 'completed',
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        fee: '0.00',
        description: 'Referral commission'
      }
    ]);
  });

  // Demo crypto prices endpoint
  app.get('/api/demo/crypto-prices', (req, res) => {
    res.json({
      BTC: {
        price: 43145.67,
        change24h: 2.34,
        changePercent24h: 5.72
      },
      ETH: {
        price: 2417.89,
        change24h: -15.23,
        changePercent24h: -0.63
      },
      XRP: {
        price: 0.6801,
        change24h: 0.0234,
        changePercent24h: 3.56
      }
    });
  });
}