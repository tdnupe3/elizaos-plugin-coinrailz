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
}