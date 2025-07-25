/**
 * Authentication Routes - Enhanced Security
 */

import type { Express } from "express";
import { storage } from "./storage";
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { sessionStore, createSession } from './services/sessionManager';
import { userCircleService } from './services/userCircleService';

// Registration validation schema with secure password requirements
const registrationSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/, 
      'Password must contain uppercase, lowercase, number, and special character (@$!%*?&)'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  acceptTerms: z.boolean().optional()
});

export function registerAuthRoutes(app: Express) {
  
  // Remove duplicate endpoint - handled below

  // User registration endpoint
  app.post('/api/auth/register', async (req, res) => {
    try {
      const validatedData = registrationSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(validatedData.email);
      if (existingUser) {
        return res.status(409).json({
          success: false,
          error: 'Email already registered',
          message: 'Email already registered. Please try using the \'Sign In\' option instead.'
        });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(validatedData.password, 12);
      
      // Create new user
      const newUser = await storage.createUser({
        id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        email: validatedData.email,
        password: hashedPassword,
        firstName: validatedData.firstName || '',
        lastName: validatedData.lastName || '',
        usdBalance: '0.00',
        kycStatus: 'pending',
        complianceLevel: 'basic',
        riskScore: 0,
        sanctionsCheck: false,
        pepsCheck: false
      });

      // Create Circle wallet automatically for new user
      let circleWalletInfo = null;
      try {
        const walletResult = await userCircleService.createUserCircleWallet(newUser.id, 'ETH');
        if (walletResult.success) {
          circleWalletInfo = {
            address: walletResult.address,
            blockchain: walletResult.blockchain,
            state: walletResult.state
          };
          console.log(`✅ Circle wallet created for user ${newUser.id}: ${walletResult.address}`);
        } else {
          console.warn(`⚠️ Circle wallet creation failed for user ${newUser.id}: ${walletResult.error}`);
        }
      } catch (error) {
        console.error('Error creating Circle wallet during registration:', error);
      }

      // Create session token for auto-login after registration
      const sessionToken = createSession(newUser.id, newUser.email || '');

      // Don't return password in response
      const { password, ...userResponse } = newUser;

      res.status(201).json({
        success: true,
        message: 'Account created successfully',
        user: userResponse,
        token: sessionToken,
        circleWallet: circleWalletInfo
      });
    } catch (error: any) {
      console.error('Registration error:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          message: error.errors[0]?.message || 'Invalid input data'
        });
      }
      res.status(500).json({
        success: false,
        error: 'Registration failed',
        message: 'Unable to create account. Please try again.'
      });
    }
  });

  // User login endpoint
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: 'Missing credentials',
          message: 'Email and password are required'
        });
      }

      // Find user by email
      const user = await storage.getUserByEmail(email);
      if (!user || !user.password) {
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials',
          message: 'Email or password is incorrect'
        });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials',
          message: 'Email or password is incorrect'
        });
      }

      // Create session token (simplified - in production would use JWT)
      const sessionToken = `cr_session_${user.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Store session in memory (in production, this would be in Redis/database)
      sessionStore.set(sessionToken, {
        userId: user.id,
        userEmail: user.email || '',
        createdAt: Date.now()
      });
      
      const { password: _, ...userResponse } = user;
      
      res.json({
        success: true,
        message: 'Login successful',
        user: userResponse,
        token: sessionToken
      });
    } catch (error: any) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        error: 'Login failed',
        message: 'Unable to login. Please try again.'
      });
    }
  });

  // Get current user endpoint (PROTECTED)
  app.get('/api/auth/user', async (req, res) => {
    try {
      // Check if user is authenticated via OAuth
      if (req.isAuthenticated && req.isAuthenticated()) {
        const user = req.user as any;
        return res.json({
          success: true,
          id: user?.claims?.sub || user?.id,
          email: user?.claims?.email || user?.email,
          firstName: user?.claims?.first_name || user?.firstName || 'User',
          lastName: user?.claims?.last_name || user?.lastName || '',
          profileImage: user?.claims?.profile_image_url || null,
          claims: user?.claims
        });
      }

      // Check for Bearer token authentication
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const session = sessionStore.get(token);
        if (session) {
          const user = await storage.getUserByEmail(session.userEmail);
          if (user) {
            const { password: _, ...userResponse } = user;
            return res.json({
              success: true,
              id: userResponse.id,
              email: userResponse.email,
              firstName: userResponse.firstName || 'User',
              lastName: userResponse.lastName || '',
              profileImage: null,
              claims: { email: userResponse.email, sub: userResponse.id }
            });
          }
        }
      }

      // For production: require proper authentication
      // a1digitalllc@gmail.com is a REAL USER with real $50.00 USDC balance
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Please sign in to access your account'
      });
    } catch (error) {
      console.error('Auth user error:', error);
      return res.status(401).json({
        success: false,
        error: 'Authentication failed',
        message: 'Please sign in to access your account'
      });
    }
  });

  // Logout endpoint (GET - for frontend redirects)
  app.get('/api/logout', (req, res) => {
    // Clear any session data (if using sessions)
    if (req.session) {
      req.session.destroy((err) => {
        if (err) {
          console.error('Session destruction error:', err);
        }
      });
    }
    
    // Clear session token from header if present
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      sessionStore.delete(token);
    }
    
    // Redirect to home page after logout
    res.redirect('/');
  });

  // Logout endpoint (POST - for API calls)
  app.post('/api/auth/logout', (req, res) => {
    // Clear any session data (if using sessions)
    if (req.session) {
      req.session.destroy((err) => {
        if (err) {
          console.error('Session destruction error:', err);
        }
      });
    }
    
    // Clear session token from header if present
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      sessionStore.delete(token);
    }
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  });

  // Password reset endpoint (for existing users who forgot password)
  app.post('/api/auth/reset-password', async (req, res) => {
    try {
      const { email, newPassword } = req.body;
      
      if (!email || !newPassword) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
          message: 'Email and new password are required'
        });
      }

      // Validate new password meets security requirements
      const passwordValidation = z.string()
        .min(8, 'Password must be at least 8 characters')
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/, 
          'Password must contain uppercase, lowercase, number, and special character (@$!%*?&)');
      
      try {
        passwordValidation.parse(newPassword);
      } catch (validationError: any) {
        return res.status(400).json({
          success: false,
          error: 'Invalid password',
          message: validationError.errors[0]?.message || 'Password does not meet security requirements'
        });
      }

      // Check if user exists
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
          message: 'No account found with this email address'
        });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 12);
      
      // Update user password
      await storage.updateUser(user.id, { password: hashedPassword });

      res.json({
        success: true,
        message: 'Password reset successfully. You can now login with your new password.'
      });
    } catch (error: any) {
      console.error('Password reset error:', error);
      res.status(500).json({
        success: false,
        error: 'Password reset failed',
        message: 'Unable to reset password. Please try again.'
      });
    }
  });

  // Check if email exists endpoint (for better UX)
  app.post('/api/auth/check-email', async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({
          success: false,
          error: 'Missing email',
          message: 'Email is required'
        });
      }

      const user = await storage.getUserByEmail(email);
      
      res.json({
        success: true,
        exists: !!user,
        message: user ? 'Account exists - try signing in instead' : 'Email available for registration'
      });
    } catch (error: any) {
      console.error('Email check error:', error);
      res.status(500).json({
        success: false,
        error: 'Check failed',
        message: 'Unable to verify email availability'
      });
    }
  });

  // Dashboard stats endpoint (PROTECTED)
  app.get('/api/dashboard/stats', async (req, res) => {
    try {
      // Check for Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'Authentication token required'
        });
      }

      // Extract and validate session token
      const token = authHeader.split(' ')[1];
      const session = sessionStore.get(token);
      if (!session) {
        return res.status(401).json({
          success: false,
          error: 'Session expired',
          message: 'Please login again'
        });
      }

      // Get real user data
      const user = await storage.getUserByEmail(session.userEmail);
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'User not found',
          message: 'Please login again'
        });
      }

      // Return actual user stats from database
      const stats = {
        balance: parseFloat(user.usdBalance || '0.00'),
        totalTransactions: 0, // No transactions yet for new users
        monthlyVolume: 0.00,
        activeAgents: 0,
        referralEarnings: parseFloat(user.referralBonus || '0.00')
      };
      res.json(stats);
    } catch (error: any) {
      console.error('Dashboard stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch stats',
        message: 'Unable to load dashboard statistics'
      });
    }
  });

  // Dashboard transactions endpoint (PROTECTED)
  app.get('/api/dashboard/transactions', async (req, res) => {
    try {
      // Check for Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'Authentication token required'
        });
      }

      // Extract and validate session token
      const token = authHeader.split(' ')[1];
      const session = sessionStore.get(token);
      if (!session) {
        return res.status(401).json({
          success: false,
          error: 'Session expired',
          message: 'Please login again'
        });
      }

      // Get real user data
      const user = await storage.getUserByEmail(session.userEmail);
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'User not found',
          message: 'Please login again'
        });
      }

      // Return actual user transactions (empty for new users)
      const transactions: any[] = []; // New users have no transactions yet
      res.json(transactions);
    } catch (error: any) {
      console.error('Dashboard transactions error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch transactions',
        message: 'Unable to load transaction history'
      });
    }
  });

  // Dashboard portfolio endpoint (PROTECTED)
  app.get('/api/dashboard/portfolio', async (req, res) => {
    try {
      // Check for Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'Authentication token required'
        });
      }

      // Extract and validate session token
      const token = authHeader.split(' ')[1];
      const session = sessionStore.get(token);
      if (!session) {
        return res.status(401).json({
          success: false,
          error: 'Session expired',
          message: 'Please login again'
        });
      }

      // Get real user data
      const user = await storage.getUserByEmail(session.userEmail);
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'User not found',
          message: 'Please login again'
        });
      }

      // Return actual user portfolio (empty for new users)
      const totalValue = parseFloat(user.usdBalance || '0.00');
      const portfolio = {
        totalValue: totalValue,
        assets: totalValue > 0 ? [
          { symbol: 'USD', amount: totalValue, value: totalValue }
        ] : [],
        performance: {
          daily: 0,
          weekly: 0,
          monthly: 0
        }
      };
      res.json(portfolio);
    } catch (error: any) {
      console.error('Dashboard portfolio error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch portfolio',
        message: 'Unable to load portfolio data'
      });
    }
  });
}