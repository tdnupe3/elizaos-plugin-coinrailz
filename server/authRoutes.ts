/**
 * Authentication Routes - Enhanced Security
 */

import type { Express } from "express";
import { storage } from "./storage";
import bcrypt from 'bcrypt';
import { z } from 'zod';

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
          error: 'Account exists',
          message: 'An account with this email already exists'
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

      // Don't return password in response
      const { password, ...userResponse } = newUser;

      res.status(201).json({
        success: true,
        message: 'Account created successfully',
        user: userResponse
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

      // Create session (simplified - in production would use JWT or sessions)
      const { password: _, ...userResponse } = user;
      
      res.json({
        success: true,
        message: 'Login successful',
        user: userResponse
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

  // Get current user endpoint
  app.get('/api/auth/user', async (req, res) => {
    try {
      // In a real app, this would verify JWT token or session
      // For now, we'll return a sample user to demonstrate the flow
      const sampleUser = {
        id: 'user_demo_123',
        email: 'demo@coinrailz.com',
        firstName: 'Demo',
        lastName: 'User',
        usdBalance: '2847.50',
        kycStatus: 'verified',
        complianceLevel: 'basic'
      };

      res.json(sampleUser);
    } catch (error: any) {
      console.error('User fetch error:', error);
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Please login to continue'
      });
    }
  });

  // Logout endpoint
  app.post('/api/auth/logout', (req, res) => {
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

  // Dashboard stats endpoint
  app.get('/api/dashboard/stats', async (req, res) => {
    try {
      const stats = {
        balance: 2847.50,
        totalTransactions: 47,
        monthlyVolume: 12840.00,
        activeAgents: 3,
        referralEarnings: 127.30
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

  // Dashboard transactions endpoint
  app.get('/api/dashboard/transactions', async (req, res) => {
    try {
      const transactions = [
        {
          id: "txn_001",
          type: "p2p",
          amount: 250.00,
          currency: "USD",
          status: "completed",
          timestamp: "2025-07-01T00:30:00Z",
          description: "P2P Transfer to Alice"
        },
        {
          id: "txn_002", 
          type: "dex",
          amount: 0.5,
          currency: "ETH",
          status: "completed",
          timestamp: "2025-06-30T18:45:00Z",
          description: "ETH to USDC Swap"
        },
        {
          id: "txn_003",
          type: "marketplace",
          amount: 150.00,
          currency: "USD",
          status: "pending",
          timestamp: "2025-06-30T14:20:00Z",
          description: "AI Analytics Service Payment"
        },
        {
          id: "txn_004",
          type: "p2p",
          amount: 75.00,
          currency: "USD",
          status: "completed",
          timestamp: "2025-06-29T16:15:00Z",
          description: "P2P Transfer to Bob"
        },
        {
          id: "txn_005",
          type: "dex",
          amount: 1000.00,
          currency: "USDC",
          status: "completed",
          timestamp: "2025-06-29T10:30:00Z",
          description: "USDC to ETH Swap"
        }
      ];
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

  // Dashboard portfolio endpoint
  app.get('/api/dashboard/portfolio', async (req, res) => {
    try {
      const portfolio = {
        totalValue: 2847.50,
        assets: [
          { symbol: 'USD', amount: 1847.50, value: 1847.50 },
          { symbol: 'ETH', amount: 0.3, value: 750.00 },
          { symbol: 'USDC', amount: 250.00, value: 250.00 }
        ],
        performance: {
          daily: +2.5,
          weekly: +12.3,
          monthly: +18.7
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