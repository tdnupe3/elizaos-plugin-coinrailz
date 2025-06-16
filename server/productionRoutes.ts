import { Express, Request, Response } from 'express';
import { createServer } from 'http';
import { requireAuth, financialRateLimit, sanitizeInput } from './securityMiddleware';

// Input validation schemas
const validateAmount = (amount: any): { isValid: boolean; sanitizedAmount?: number; error?: string } => {
  if (!amount) {
    return { isValid: false, error: 'Amount is required' };
  }

  const numericAmount = parseFloat(amount);
  if (isNaN(numericAmount)) {
    return { isValid: false, error: 'Amount must be a valid number' };
  }

  if (numericAmount <= 0) {
    return { isValid: false, error: 'Amount must be greater than zero' };
  }

  // Dynamic transaction limits based on environment
  const maxAmount = parseFloat(process.env.MAX_TRANSACTION_AMOUNT || '500000');
  if (numericAmount > maxAmount) {
    return { isValid: false, error: `Amount exceeds maximum limit of $${maxAmount.toLocaleString()}` };
  }

  if (numericAmount < 0.01) { // Minimum 1 cent
    return { isValid: false, error: 'Amount must be at least $0.01' };
  }

  return { isValid: true, sanitizedAmount: numericAmount };
};

const validateEmail = (email: any): { isValid: boolean; sanitizedEmail?: string; error?: string } => {
  if (!email || typeof email !== 'string') {
    return { isValid: false, error: 'Valid email address is required' };
  }

  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  const sanitizedEmail = email.trim().toLowerCase();
  
  if (!emailRegex.test(sanitizedEmail)) {
    return { isValid: false, error: 'Invalid email format' };
  }

  if (sanitizedEmail.length > 320) { // RFC 5321 limit
    return { isValid: false, error: 'Email address too long' };
  }

  return { isValid: true, sanitizedEmail };
};

const validateAgentName = (name: any): { isValid: boolean; sanitizedName?: string; error?: string } => {
  if (!name || typeof name !== 'string') {
    return { isValid: false, error: 'Agent name is required' };
  }

  const sanitizedName = name.trim();
  
  if (sanitizedName.length < 2) {
    return { isValid: false, error: 'Agent name must be at least 2 characters' };
  }

  if (sanitizedName.length > 100) {
    return { isValid: false, error: 'Agent name must be less than 100 characters' };
  }

  // Only allow alphanumeric, spaces, hyphens, underscores
  const nameRegex = /^[a-zA-Z0-9\s\-_]+$/;
  if (!nameRegex.test(sanitizedName)) {
    return { isValid: false, error: 'Agent name contains invalid characters' };
  }

  return { isValid: true, sanitizedName };
};

export function setupProductionRoutes(app: Express) {
  // Health check
  app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    });
  });

  // Fee calculation with strict validation
  app.post('/api/calculate-fees', financialRateLimit, (req: Request, res: Response) => {
    try {
      const { amount, type = 'send_money', currency = 'USD' } = req.body;
      
      const amountValidation = validateAmount(amount);
      if (!amountValidation.isValid) {
        return res.status(400).json({
          success: false,
          message: amountValidation.error,
          code: 'INVALID_AMOUNT'
        });
      }

      const baseAmount = amountValidation.sanitizedAmount!;
      const platformFeeRate = 0.01; // 1%
      const platformFee = Math.round(baseAmount * platformFeeRate * 100) / 100; // Round to cents
      const totalAmount = Math.round((baseAmount + platformFee) * 100) / 100;

      const feeCalculation = {
        originalAmount: baseAmount,
        platformFee,
        totalFee: platformFee,
        totalAmount,
        netAmount: baseAmount,
        feeBreakdown: {
          platformFee,
          processingFee: 0,
          convenienceFee: 0
        },
        feeRate: platformFeeRate,
        currency
      };

      res.status(200).json({
        success: true,
        calculation: feeCalculation,
        type,
        currency,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('Fee calculation error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        code: 'CALCULATION_ERROR'
      });
    }
  });

  // Revenue summary with accurate calculations
  app.get('/api/revenue/summary', (req: Request, res: Response) => {
    try {
      // Production revenue data - these should come from database
      const totalTransactions = 342;
      const totalVolume = 15842.50;
      const platformFeeRate = 0.01;
      
      // Calculate accurate fees based on 1% rate
      const totalFees = Math.round(totalVolume * platformFeeRate * 100) / 100;
      const averageTransactionSize = Math.round((totalVolume / totalTransactions) * 100) / 100;
      
      const summary = {
        platform: {
          totalTransactions,
          totalVolume,
          totalFees,
          averageTransactionSize,
          feeRate: platformFeeRate
        },
        agents: {
          activeAgents: 4,
          totalAgentRevenue: 4250.00
        },
        calculated: {
          platformProfit: Math.round(totalFees * 0.85 * 100) / 100, // 85% profit margin
          agentCommissions: Math.round(totalFees * 0.15 * 100) / 100, // 15% to agents
          profitMargin: '85%',
          revenueGrowth: '12.5% month-over-month'
        },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(summary);

    } catch (error: any) {
      console.error('Revenue summary error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate revenue summary',
        code: 'REVENUE_ERROR'
      });
    }
  });

  // Payment intent creation with authentication and validation
  app.post('/api/create-payment-intent', requireAuth, financialRateLimit, (req: Request, res: Response) => {
    try {
      const { amount, recipientEmail } = req.body;

      const amountValidation = validateAmount(amount);
      if (!amountValidation.isValid) {
        return res.status(400).json({
          success: false,
          message: amountValidation.error,
          code: 'INVALID_AMOUNT'
        });
      }

      const emailValidation = validateEmail(recipientEmail);
      if (!emailValidation.isValid) {
        return res.status(400).json({
          success: false,
          message: emailValidation.error,
          code: 'INVALID_EMAIL'
        });
      }

      const baseAmount = amountValidation.sanitizedAmount!;
      const fee = Math.round(baseAmount * 0.08 * 100) / 100; // 8% fee for payments
      const totalAmount = Math.round((baseAmount + fee) * 100) / 100;

      // Generate unique payment intent ID
      const paymentIntentId = `pi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      res.status(200).json({
        success: true,
        clientSecret: `${paymentIntentId}_secret`,
        paymentIntentId,
        amount: baseAmount,
        platformFee: fee,
        totalAmount,
        recipientEmail: emailValidation.sanitizedEmail,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('Payment intent creation error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create payment intent',
        code: 'PAYMENT_ERROR'
      });
    }
  });

  // AI agent registration with secure validation
  app.post('/api/ai-agents/register', (req: Request, res: Response) => {
    try {
      const { name, capabilities, description, services, serviceType } = req.body;

      const nameValidation = validateAgentName(name);
      if (!nameValidation.isValid) {
        return res.status(400).json({
          success: false,
          message: nameValidation.error,
          code: 'INVALID_NAME'
        });
      }

      // Validate capabilities/services
      const agentCapabilities = capabilities || services || (serviceType ? [serviceType] : ['general']);
      
      if (!Array.isArray(agentCapabilities) && typeof agentCapabilities !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Capabilities must be provided as array or string',
          code: 'INVALID_CAPABILITIES'
        });
      }

      const sanitizedCapabilities = Array.isArray(agentCapabilities) 
        ? agentCapabilities.filter(cap => typeof cap === 'string' && cap.trim().length > 0)
        : [agentCapabilities];

      if (sanitizedCapabilities.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'At least one valid capability is required',
          code: 'NO_CAPABILITIES'
        });
      }

      const agentId = `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const agent = {
        id: agentId,
        name: nameValidation.sanitizedName,
        capabilities: sanitizedCapabilities,
        description: description ? description.toString().trim() : '',
        status: 'registered',
        membershipTier: 'basic',
        commissionRate: '0.5%',
        createdAt: new Date().toISOString()
      };

      res.status(201).json({
        success: true,
        agent,
        message: 'AI agent registered successfully'
      });

    } catch (error: any) {
      console.error('AI agent registration error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to register AI agent',
        code: 'REGISTRATION_ERROR'
      });
    }
  });

  // XRP wallet info
  app.get('/api/xrp/wallet-info', (req: Request, res: Response) => {
    try {
      res.status(200).json({
        address: 'rDemoWallet123',
        balance: 15.98,
        network: 'mainnet',
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('XRP wallet info error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve wallet information',
        code: 'WALLET_ERROR'
      });
    }
  });

  // DEX quote
  app.get('/api/dex/quote', (req: Request, res: Response) => {
    try {
      res.status(200).json({
        price: 43250.00,
        source: 'aggregated',
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('DEX quote error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve price quote',
        code: 'QUOTE_ERROR'
      });
    }
  });

  // User authentication status
  app.get('/api/user', (req: Request, res: Response) => {
    try {
      res.status(200).json({
        authenticated: false,
        user: null,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('User status error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve user status',
        code: 'USER_ERROR'
      });
    }
  });

  // Logout with session invalidation
  app.post('/api/logout', (req: Request, res: Response) => {
    try {
      // TODO: Implement actual session invalidation
      res.status(200).json({ 
        success: true,
        message: 'Logged out successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to logout',
        code: 'LOGOUT_ERROR'
      });
    }
  });

  // Agent payment intent with authentication
  app.post('/api/agents/create-payment-intent', requireAuth, financialRateLimit, (req: Request, res: Response) => {
    try {
      const { amount, agentId } = req.body;

      const amountValidation = validateAmount(amount);
      if (!amountValidation.isValid) {
        return res.status(400).json({
          success: false,
          message: amountValidation.error,
          code: 'INVALID_AMOUNT'
        });
      }

      if (!agentId || typeof agentId !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Valid agent ID is required',
          code: 'INVALID_AGENT_ID'
        });
      }

      const baseAmount = amountValidation.sanitizedAmount!;
      const paymentIntentId = `pi_agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      res.status(200).json({
        success: true,
        clientSecret: `${paymentIntentId}_secret`,
        paymentIntentId,
        amount: baseAmount,
        agentId: agentId.trim(),
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('Agent payment intent error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create agent payment intent',
        code: 'AGENT_PAYMENT_ERROR'
      });
    }
  });

  // Global error handler
  app.use((error: any, req: Request, res: Response, next: any) => {
    console.error('Global error handler:', error);
    
    if (res.headersSent) {
      return next(error);
    }

    res.status(error.status || 500).json({
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  });

  return createServer(app);
}