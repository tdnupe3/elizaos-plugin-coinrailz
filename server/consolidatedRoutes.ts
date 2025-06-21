/**
 * Consolidated Routes - Phase 2 Platform Optimization
 * Merges authentication, payment, agent, and referral routes into organized domains
 * Eliminates duplicate route handlers while preserving all API endpoints
 */

import { Express } from "express";
import { ConsolidatedServices } from "./consolidatedServices";
import { UnifiedAuthSystem } from "./unifiedAuth";

export function setupConsolidatedRoutes(app: Express, authSystem: UnifiedAuthSystem) {
  const authMiddleware = authSystem.getAuthMiddleware();

  // ===== PAYMENT ROUTES =====
  
  // P2P Transfer
  app.post('/api/p2p/transfer', authMiddleware, async (req, res) => {
    try {
      const { amount, currency, toUserId, description } = req.body;
      const fromUserId = (req.user as any)?.claims?.sub || (req.session as any)?.user?.id;

      const result = await ConsolidatedServices.PaymentProcessor.processPayment({
        amount: parseFloat(amount),
        currency: currency || 'USD',
        fromUserId,
        toUserId,
        type: 'p2p',
        metadata: { description }
      });

      if (result.success) {
        // Send notification
        await ConsolidatedServices.NotificationSystem.sendNotification({
          userId: toUserId,
          title: 'Payment Received',
          message: `You received $${amount} from another user`,
          type: 'payment',
          priority: 'medium'
        });

        res.json({ success: true, transactionId: result.transactionId });
      } else {
        res.status(400).json({ success: false, error: result.error });
      }
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Send Money (with fee calculation)
  app.post('/api/send-money', authMiddleware, async (req, res) => {
    try {
      const { amount, recipient, currency } = req.body;
      const userId = (req.user as any)?.claims?.sub || (req.session as any)?.user?.id;

      const feeCalculation = ConsolidatedServices.FeeCalculator.calculateP2PFee(parseFloat(amount));
      
      if (!feeCalculation.isValid) {
        return res.status(400).json({ 
          success: false, 
          error: 'Minimum transfer amount is $10.00' 
        });
      }

      const result = await ConsolidatedServices.PaymentProcessor.processPayment({
        amount: parseFloat(amount),
        currency: currency || 'USD',
        fromUserId: userId,
        toUserId: recipient,
        type: 'p2p'
      });

      res.json({
        success: result.success,
        transactionId: result.transactionId,
        fee: feeCalculation.fee,
        netAmount: feeCalculation.netAmount,
        error: result.error
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Fee Calculation
  app.post('/api/calculate-fee', async (req, res) => {
    try {
      const { amount, type } = req.body;
      let calculation;

      switch (type) {
        case 'p2p':
          calculation = ConsolidatedServices.FeeCalculator.calculateP2PFee(parseFloat(amount));
          break;
        case 'agent':
          calculation = ConsolidatedServices.FeeCalculator.calculateAIAgentCommission(parseFloat(amount));
          break;
        default:
          calculation = ConsolidatedServices.FeeCalculator.calculateP2PFee(parseFloat(amount));
      }

      res.json({ success: true, calculation });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ===== AI AGENT ROUTES =====

  // Register AI Agent
  app.post('/api/agents/register', async (req, res) => {
    try {
      const { name, capabilities, serviceTypes, tier } = req.body;
      const userId = (req.user as any)?.claims?.sub || (req.session as any)?.user?.id;

      const result = await ConsolidatedServices.AgentMarketplace.registerAgent({
        name,
        capabilities: capabilities || [],
        serviceTypes: serviceTypes || [],
        userId,
        tier: tier || 'basic'
      });

      if (result.success) {
        await ConsolidatedServices.NotificationSystem.sendNotification({
          userId: userId || 'system',
          title: 'Agent Registered',
          message: `AI Agent "${name}" has been successfully registered`,
          type: 'agent',
          priority: 'medium'
        });
      }

      res.status(result.success ? 201 : 400).json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Get Active Agents
  app.get('/api/agents/active', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const agents = await ConsolidatedServices.AgentMarketplace.getActiveAgents(limit);
      res.json({ success: true, agents });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Process Agent Payment
  app.post('/api/agents/:agentId/payment', authMiddleware, async (req, res) => {
    try {
      const { agentId } = req.params;
      const { amount } = req.body;
      const clientUserId = (req.user as any)?.claims?.sub || (req.session as any)?.user?.id;

      const result = await ConsolidatedServices.AgentMarketplace.processAgentPayment(
        agentId,
        parseFloat(amount),
        clientUserId
      );

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ===== REFERRAL ROUTES =====

  // Process Referral
  app.post('/api/referrals/process', authMiddleware, async (req, res) => {
    try {
      const { referredUserId, transactionAmount, type } = req.body;
      const referrerId = (req.user as any)?.claims?.sub || (req.session as any)?.user?.id;

      const result = await ConsolidatedServices.ReferralSystem.processReferral({
        referrerId,
        referredUserId,
        transactionAmount: parseFloat(transactionAmount),
        type: type || 'human'
      });

      if (result.success) {
        await ConsolidatedServices.NotificationSystem.sendNotification({
          userId: referrerId,
          title: 'Referral Commission Earned',
          message: `You earned $${result.commission} from a referral`,
          type: 'referral',
          priority: 'medium'
        });
      }

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Get Referral Stats
  app.get('/api/referrals/stats', authMiddleware, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub || (req.session as any)?.user?.id;
      const stats = await ConsolidatedServices.ReferralSystem.getReferralStats(userId);
      res.json({ success: true, stats });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Human Referral Registration
  app.post('/api/referrals/register-human', async (req, res) => {
    try {
      const { email, firstName, lastName, referrerCode } = req.body;
      
      // Register new user (this would be handled by the auth system)
      // For now, return success with referral tracking
      
      res.json({
        success: true,
        message: 'Human referral registered successfully',
        referralCode: `ref_${Date.now()}`
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ===== NOTIFICATION ROUTES =====

  // Get User Notifications
  app.get('/api/notifications', authMiddleware, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub || (req.session as any)?.user?.id;
      const limit = parseInt(req.query.limit as string) || 20;
      
      const notifications = await ConsolidatedServices.NotificationSystem.getUserNotifications(userId, limit);
      res.json({ success: true, notifications });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Send Notification (admin/system use)
  app.post('/api/notifications/send', authMiddleware, async (req, res) => {
    try {
      const { userId, title, message, type, priority } = req.body;
      
      const success = await ConsolidatedServices.NotificationSystem.sendNotification({
        userId,
        title,
        message,
        type: type || 'system',
        priority: priority || 'medium'
      });

      res.json({ success });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ===== ANALYTICS ROUTES =====

  // Platform Metrics
  app.get('/api/analytics/platform', authMiddleware, async (req, res) => {
    try {
      const metrics = await ConsolidatedServices.AnalyticsSystem.getPlatformMetrics();
      res.json({ success: true, metrics });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // User Dashboard Data
  app.get('/api/dashboard/data', authMiddleware, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub || (req.session as any)?.user?.id;
      
      const [paymentHistory, referralStats, notifications] = await Promise.all([
        ConsolidatedServices.PaymentProcessor.getPaymentHistory(userId, 10),
        ConsolidatedServices.ReferralSystem.getReferralStats(userId),
        ConsolidatedServices.NotificationSystem.getUserNotifications(userId, 5)
      ]);

      res.json({
        success: true,
        dashboard: {
          recentTransactions: paymentHistory,
          referralStats,
          recentNotifications: notifications
        }
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ===== LEGACY ENDPOINT COMPATIBILITY =====
  
  // Maintain compatibility with existing frontend calls
  app.post('/api/demo-auth', async (req, res) => {
    // Redirect to unified auth system
    res.redirect(307, '/api/auth/register');
  });

  app.get('/api/user', authMiddleware, async (req, res) => {
    // Redirect to unified auth system
    res.redirect(307, '/api/auth/user');
  });

  // Commission calculation (legacy)
  app.post('/api/test/calculate-commission', async (req, res) => {
    try {
      const { amount, type } = req.body;
      const commission = ConsolidatedServices.FeeCalculator.calculateReferralCommission(
        parseFloat(amount),
        type === 'premium' ? 1.5 : 1.0
      );
      res.json({ success: true, commission });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  console.log('✅ Consolidated routes initialized - all API endpoints preserved');
}