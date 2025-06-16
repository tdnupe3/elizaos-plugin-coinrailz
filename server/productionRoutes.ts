import { Express, Request, Response } from 'express';
import { createServer } from 'http';
import { requireAuth, financialRateLimit, sanitizeInput } from './securityMiddleware';

// Enhanced SQL injection protection patterns
const SQL_INJECTION_PATTERNS = [
  /('|''|\-\-|;)/gi,
  /(DROP|DELETE|UPDATE|INSERT|SELECT|UNION|ALTER|CREATE|EXEC|EXECUTE)/gi,
  /(\%27|\%3B|\%2D\%2D)/gi,
  /(\x00|\x1a)/gi,
  /(<script|<\/script|javascript:|vbscript:|onload=|onerror=)/gi
];

function sanitizeForSQLInjection(input: string): { isValid: boolean; sanitized: string } {
  for (const pattern of SQL_INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      return { isValid: false, sanitized: '' };
    }
  }
  return { isValid: true, sanitized: input.trim() };
}

const validateAmount = (amount: any, userRegistrationStatus?: string): { 
  isValid: boolean; 
  sanitizedAmount?: number; 
  error?: string;
  requiresRegistrationValidation?: boolean;
  warning?: string;
} => {
  if (!amount) {
    return { isValid: false, error: 'Amount is required' };
  }

  const amountStr = String(amount);
  const sqlCheck = sanitizeForSQLInjection(amountStr);
  if (!sqlCheck.isValid) {
    return { isValid: false, error: 'Invalid amount format' };
  }

  const numericAmount = parseFloat(amount);
  if (isNaN(numericAmount)) {
    return { isValid: false, error: 'Amount must be a valid number' };
  }

  if (numericAmount <= 0) {
    return { isValid: false, error: 'Amount must be greater than zero' };
  }

  if (numericAmount < 0.01) {
    return { isValid: false, error: 'Amount must be at least $0.01' };
  }

  const maxAmount = parseFloat(process.env.MAX_TRANSACTION_AMOUNT || '500000');
  if (numericAmount > maxAmount) {
    return { isValid: false, error: `Amount exceeds maximum limit of $${maxAmount.toLocaleString()}` };
  }

  // High-value transaction validation requirement
  if (numericAmount > 100000) {
    if (!userRegistrationStatus || userRegistrationStatus !== 'verified') {
      return { 
        isValid: true,
        sanitizedAmount: numericAmount,
        requiresRegistrationValidation: true,
        warning: 'Transactions over $100,000 require user registration verification. Please complete your profile registration to proceed.'
      };
    }
  }

  return { isValid: true, sanitizedAmount: numericAmount };
};

const validateEmail = (email: any): { isValid: boolean; sanitizedEmail?: string; error?: string } => {
  if (!email || typeof email !== 'string') {
    return { isValid: false, error: 'Valid email address is required' };
  }

  const sqlCheck = sanitizeForSQLInjection(email);
  if (!sqlCheck.isValid) {
    return { isValid: false, error: 'Invalid email format' };
  }

  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  const sanitizedEmail = email.trim().toLowerCase();
  
  if (!emailRegex.test(sanitizedEmail)) {
    return { isValid: false, error: 'Invalid email format' };
  }

  if (sanitizedEmail.length > 320) {
    return { isValid: false, error: 'Email address too long' };
  }

  return { isValid: true, sanitizedEmail };
};

const validateAgentName = (name: any): { isValid: boolean; sanitizedName?: string; error?: string } => {
  if (!name || typeof name !== 'string') {
    return { isValid: false, error: 'Agent name is required' };
  }

  const sqlCheck = sanitizeForSQLInjection(name);
  if (!sqlCheck.isValid) {
    return { isValid: false, error: 'Agent name contains invalid characters' };
  }

  const sanitizedName = sqlCheck.sanitized;
  
  if (sanitizedName.length < 3) {
    return { isValid: false, error: 'Agent name must be at least 3 characters' };
  }

  if (sanitizedName.length > 100) {
    return { isValid: false, error: 'Agent name must be less than 100 characters' };
  }

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

  // Fee calculation with enhanced security
  app.post('/api/calculate-fees', financialRateLimit, (req: Request, res: Response) => {
    try {
      const { amount, type = 'send_money', currency = 'USD', userRegistrationStatus } = req.body;
      
      const amountValidation = validateAmount(amount, userRegistrationStatus);
      if (!amountValidation.isValid) {
        return res.status(400).json({
          success: false,
          message: amountValidation.error,
          code: 'INVALID_AMOUNT'
        });
      }

      const baseAmount = amountValidation.sanitizedAmount!;
      const platformFeeRate = 0.01;
      const platformFee = Math.round(baseAmount * platformFeeRate * 100) / 100;
      const totalAmount = Math.round((baseAmount + platformFee) * 100) / 100;

      const response: any = {
        success: true,
        calculation: {
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
        },
        type,
        currency,
        timestamp: new Date().toISOString()
      };

      if (amountValidation.requiresRegistrationValidation) {
        response.requiresRegistrationValidation = true;
        response.validationWarning = amountValidation.warning;
      }

      res.status(200).json(response);

    } catch (error: any) {
      console.error('Fee calculation error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        code: 'CALCULATION_ERROR'
      });
    }
  });

  // User registration status with enhanced security
  app.get('/api/user/registration-status/:userId', (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required',
          code: 'MISSING_USER_ID'
        });
      }

      const sqlCheck = sanitizeForSQLInjection(userId);
      if (!sqlCheck.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Invalid user ID format',
          code: 'INVALID_USER_ID'
        });
      }

      const isDemoUser = userId === 'demo_user' || userId.startsWith('user_verified_');
      const registrationStatus = isDemoUser ? 'verified' : 'pending';

      res.status(200).json({
        success: true,
        userId,
        registrationStatus,
        kycStatus: registrationStatus === 'verified' ? 'completed' : 'pending',
        highValueTransactionEnabled: registrationStatus === 'verified',
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('User registration status error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        code: 'SERVER_ERROR'
      });
    }
  });

  // Payment intent creation with AUTHENTICATION REQUIRED
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
      const fee = Math.round(baseAmount * 0.08 * 100) / 100;
      const totalAmount = Math.round((baseAmount + fee) * 100) / 100;

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

  // Agent payment intent with AUTHENTICATION REQUIRED
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

      if (!agentId) {
        return res.status(400).json({
          success: false,
          message: 'Agent ID is required',
          code: 'MISSING_AGENT_ID'
        });
      }

      const sqlCheck = sanitizeForSQLInjection(agentId);
      if (!sqlCheck.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Invalid agent ID format',
          code: 'INVALID_AGENT_ID'
        });
      }

      const baseAmount = amountValidation.sanitizedAmount!;
      const platformFee = Math.round(baseAmount * 0.15 * 100) / 100;
      const agentRevenue = Math.round(baseAmount * 0.85 * 100) / 100;

      const paymentIntentId = `pi_agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      res.status(200).json({
        success: true,
        clientSecret: `${paymentIntentId}_secret`,
        paymentIntentId,
        amount: baseAmount,
        platformFee,
        agentRevenue,
        agentId: sqlCheck.sanitized,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('Agent payment intent creation error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create agent payment intent',
        code: 'AGENT_PAYMENT_ERROR'
      });
    }
  });

  // AI Agent registration with enhanced security
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

      // Validate other string inputs for SQL injection
      const inputs = [description, serviceType].filter(Boolean);
      for (const input of inputs) {
        const sqlCheck = sanitizeForSQLInjection(String(input));
        if (!sqlCheck.isValid) {
          return res.status(400).json({
            success: false,
            message: 'Invalid input contains restricted characters',
            code: 'INVALID_INPUT'
          });
        }
      }

      const agentCapabilities = capabilities || services || (serviceType ? [serviceType] : ['general']);
      const agentId = `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      res.status(200).json({
        success: true,
        agent: {
          id: agentId,
          name: nameValidation.sanitizedName,
          capabilities: agentCapabilities,
          description: description ? sanitizeForSQLInjection(description).sanitized : '',
          serviceType: serviceType ? sanitizeForSQLInjection(serviceType).sanitized : 'general',
          status: 'registered',
          registrationDate: new Date().toISOString()
        },
        message: 'AI agent registered successfully',
        timestamp: new Date().toISOString()
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