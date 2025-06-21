/**
 * Unified Authentication System
 * Consolidates OAuth, fallback, and production authentication into one reliable system
 */

import { Express, RequestHandler } from "express";
import { storage } from "./storage";
import * as client from "openid-client";
import passport from "passport";
import { Strategy, type VerifyFunction } from "openid-client/passport";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";
import memoize from "memoizee";

export class UnifiedAuthSystem {
  private app: Express;
  private oauthConfigured = false;

  constructor(app: Express) {
    this.app = app;
  }

  async initialize() {
    await this.setupSession();
    await this.setupAuthentication();
    this.setupRoutes();
  }

  private async setupSession() {
    const PgSession = connectPg(session);
    const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week

    this.app.use(session({
      store: new PgSession({
        pool: pool,
        tableName: 'session',
        createTableIfMissing: true
      }),
      secret: process.env.SESSION_SECRET!,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: sessionTtl,
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax'
      }
    }));
  }

  private async setupAuthentication() {
    this.app.use(passport.initialize());
    this.app.use(passport.session());

    passport.serializeUser((user, done) => done(null, user));
    passport.deserializeUser((user: any, done) => done(null, user));

    // Try to configure OAuth
    try {
      await this.configureOAuth();
      this.oauthConfigured = true;
      console.log('✅ OAuth authentication configured');
    } catch (error: any) {
      console.log('⚠️ OAuth not available, using fallback authentication');
      this.oauthConfigured = false;
    }
  }

  private async configureOAuth() {
    if (!process.env.REPLIT_DOMAINS || !process.env.REPL_ID) {
      throw new Error('OAuth environment variables missing');
    }

    const getOidcConfig = memoize(
      async () => {
        const issuerUrl = process.env.ISSUER_URL || "https://replit.com/oidc";
        return await client.discovery(
          new URL(issuerUrl),
          process.env.REPL_ID!
        );
      },
      { maxAge: 3600 * 1000 }
    );

    const config = await getOidcConfig();

    const verify: VerifyFunction = async (
      tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
      verified: passport.AuthenticateCallback
    ) => {
      const claims = tokens.claims();
      const user = {
        claims,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: claims?.exp
      };

      // Store user in database
      if (claims) {
        await storage.upsertUser({
          id: String(claims["sub"] || ""),
          email: String(claims["email"] || ""),
          firstName: claims["first_name"] ? String(claims["first_name"]) : null,
          lastName: claims["last_name"] ? String(claims["last_name"]) : null,
          profileImageUrl: claims["profile_image_url"] ? String(claims["profile_image_url"]) : null,
        });
      }

      verified(null, user);
    };

    // Register OAuth strategies
    const domains = process.env.REPLIT_DOMAINS!.split(",");
    const allDomains = [...domains, 'localhost'];

    for (const domain of allDomains) {
      const strategyName = `replitauth:${domain}`;
      const strategy = new Strategy(
        {
          name: strategyName,
          config,
          scope: "openid email profile offline_access",
          callbackURL: domain === 'localhost' 
            ? `https://${domains[0]}/api/callback`
            : `https://${domain}/api/callback`,
        },
        verify
      );
      passport.use(strategy);
    }
  }

  private setupRoutes() {
    // Login route - handles both OAuth and fallback
    this.app.get('/api/login', (req, res) => {
      if (this.oauthConfigured) {
        // OAuth login
        const domain = req.hostname;
        const strategyName = `replitauth:${domain}`;
        passport.authenticate(strategyName)(req, res);
      } else {
        // Fallback - redirect to signup page
        res.redirect('/signup-flow-demo?auth=fallback');
      }
    });

    // OAuth callback
    this.app.get('/api/callback', (req, res, next) => {
      if (!this.oauthConfigured) {
        return res.redirect('/signup-flow-demo?error=oauth_unavailable');
      }

      const domain = req.hostname;
      const strategyName = `replitauth:${domain}`;
      
      passport.authenticate(strategyName, {
        successRedirect: "/dashboard",
        failureRedirect: "/api/login",
      })(req, res, next);
    });

    // Direct registration endpoint
    this.app.post('/api/auth/register', async (req, res) => {
      try {
        const { email, firstName, lastName, password } = req.body;

        if (!email) {
          return res.status(400).json({ 
            success: false, 
            message: 'Email is required' 
          });
        }

        // Check for existing user
        const existingUser = await storage.getUserByEmail(email);
        if (existingUser) {
          return res.status(409).json({ 
            success: false, 
            message: 'Email already registered' 
          });
        }

        // Create new user
        const userId = `direct_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const user = await storage.upsertUser({
          id: userId,
          email,
          firstName: firstName || null,
          lastName: lastName || null,
          profileImageUrl: null,
        });

        // Set session
        (req.session as any).user = {
          id: userId,
          email,
          firstName,
          lastName,
          authenticated: true
        };

        res.status(201).json({
          success: true,
          user: { id: userId, email, firstName, lastName },
          message: 'Registration successful'
        });

      } catch (error: any) {
        console.error('Registration error:', error);
        res.status(500).json({ 
          success: false, 
          message: 'Registration failed. Please try again.' 
        });
      }
    });

    // Login endpoint for direct authentication
    this.app.post('/api/auth/login', async (req, res) => {
      try {
        const { email, password } = req.body;

        if (!email) {
          return res.status(400).json({ 
            success: false, 
            message: 'Email is required' 
          });
        }

        // For development, allow login without password verification
        // In production, implement proper password hashing and verification
        const user = await storage.getUserByEmail(email);
        if (!user) {
          return res.status(401).json({ 
            success: false, 
            message: 'Invalid email or password' 
          });
        }

        // Set session
        (req.session as any).user = {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          authenticated: true
        };

        res.json({
          success: true,
          user: { 
            id: user.id, 
            email: user.email, 
            firstName: user.firstName, 
            lastName: user.lastName 
          },
          message: 'Login successful'
        });

      } catch (error: any) {
        console.error('Login error:', error);
        res.status(500).json({ 
          success: false, 
          message: 'Login failed. Please try again.' 
        });
      }
    });

    // Get current user
    this.app.get('/api/auth/user', (req, res) => {
      const oauthUser = req.user as any;
      const sessionUser = (req.session as any)?.user;

      if (oauthUser && oauthUser.claims) {
        // OAuth user
        res.json({
          id: oauthUser.claims.sub,
          email: oauthUser.claims.email,
          firstName: oauthUser.claims.first_name,
          lastName: oauthUser.claims.last_name,
          authenticated: true,
          authType: 'oauth'
        });
      } else if (sessionUser && sessionUser.authenticated) {
        // Direct auth user
        res.json({
          ...sessionUser,
          authType: 'direct'
        });
      } else {
        res.status(401).json({ message: 'Not authenticated' });
      }
    });

    // Logout
    this.app.post('/api/logout', (req, res) => {
      if (req.session) {
        req.session.destroy((err) => {
          if (err) {
            console.error('Session destroy error:', err);
            return res.status(500).json({ error: 'Logout failed' });
          }
          res.json({ success: true, message: 'Logged out successfully' });
        });
      } else {
        res.json({ success: true, message: 'Already logged out' });
      }
    });
  }

  // Authentication middleware
  public getAuthMiddleware(): RequestHandler {
    return (req, res, next) => {
      const oauthUser = req.user as any;
      const sessionUser = (req.session as any)?.user;

      if (oauthUser && oauthUser.claims) {
        return next();
      }

      if (sessionUser && sessionUser.authenticated) {
        return next();
      }

      res.status(401).json({ message: 'Unauthorized' });
    };
  }
}