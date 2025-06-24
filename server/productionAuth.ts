/**
 * Production Authentication System
 * Simplified but secure authentication without external OAuth dependencies
 */

import type { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";
import { pool } from "./db";
import bcrypt from "bcrypt";
import { z } from "zod";

// Validation schemas
const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export function setupProductionAuth(app: Express) {
  // Session configuration with database storage
  const PgSession = connectPg(session);
  
  app.use(session({
    store: new PgSession({
      pool: pool,
      tableName: 'sessions'
    }),
    secret: process.env.SESSION_SECRET || 'coinrailz-production-secret',
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax'
    }
  }));

  // Consolidated signup endpoint - primary authentication method
  app.post('/api/auth/signup', async (req: Request, res: Response) => {
    try {
      const validation = signupSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Invalid input data',
          details: validation.error.issues
        });
      }

      const { email, password, firstName, lastName } = validation.data;

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({
          success: false,
          error: 'User already exists with this email'
        });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Create user
      const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await storage.createUser({
        id: userId,
        email,
        password: hashedPassword,
        firstName,
        lastName,
        usdBalance: '0.00',
        accountStatus: 'active',
        kycStatus: 'pending'
      });

      // Create session
      (req.session as any).userId = userId;
      (req.session as any).isAuthenticated = true;

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        user: {
          id: userId,
          email,
          firstName,
          lastName
        }
      });
    } catch (error) {
      console.error('Signup error:', error);
      res.status(500).json({
        success: false,
        error: 'Registration failed'
      });
    }
  });

  // User registration endpoint
  app.post('/api/auth/signup', async (req: Request, res: Response) => {
    try {
      const { email, password, firstName, lastName } = signupSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ 
          success: false, 
          message: "User already exists with this email" 
        });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Create user with unique ID
      const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const user = await storage.createUser({
        id: userId,
        email,
        password: hashedPassword,
        firstName,
        lastName,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Create session
      (req.session as any).userId = user.id;
      (req.session as any).user = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName
      };

      res.json({
        success: true,
        message: "Account created successfully",
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName
        }
      });

    } catch (error: any) {
      console.error('Signup error:', error);
      res.status(400).json({
        success: false,
        message: error.message || "Registration failed"
      });
    }
  });

  // User login endpoint
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      
      // Find user
      const user = await storage.getUserByEmail(email);
      if (!user || !user.password) {
        return res.status(401).json({ 
          success: false, 
          message: "Invalid email or password" 
        });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ 
          success: false, 
          message: "Invalid email or password" 
        });
      }

      // Create session
      (req.session as any).userId = user.id;
      (req.session as any).user = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName
      };

      res.json({
        success: true,
        message: "Login successful",
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName
        }
      });

    } catch (error: any) {
      console.error('Login error:', error);
      res.status(400).json({
        success: false,
        message: error.message || "Login failed"
      });
    }
  });

  // Logout endpoint
  app.post('/api/auth/logout', (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ success: false, message: "Logout failed" });
      }
      res.json({ success: true, message: "Logged out successfully" });
    });
  });

  // Get current user
  app.get('/api/auth/user', (req: Request, res: Response) => {
    const user = (req.session as any)?.user;
    if (!user) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }
    res.json({ success: true, user });
  });
}

// Production authentication middleware
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = (req.session as any)?.user;
  if (!user) {
    return res.status(401).json({ success: false, message: "Authentication required" });
  }
  (req as any).user = user;
  next();
}

// Optional authentication middleware (doesn't block if not authenticated)
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const user = (req.session as any)?.user;
  if (user) {
    (req as any).user = user;
  }
  next();
}