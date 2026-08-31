import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";
import { pool } from "./db";
import { z } from 'zod';

type OAuthSessionUser = Express.User & {
  claims: {
    sub?: string;
    email?: string;
    first_name?: string;
    last_name?: string;
    profile_image_url?: string;
    exp?: number;
  };
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
};

type OidcUserClaims = {
  sub: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  profile_image_url?: string;
  exp?: number;
};

function optionalStringClaim(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function getUserClaims(
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
): OidcUserClaims {
  const claims = tokens.claims();
  if (!claims || typeof claims.sub !== "string") {
    throw new Error("OIDC token is missing the required subject claim");
  }

  return {
    sub: claims.sub,
    email: optionalStringClaim(claims.email),
    first_name: optionalStringClaim(claims.first_name),
    last_name: optionalStringClaim(claims.last_name),
    profile_image_url: optionalStringClaim(claims.profile_image_url),
    exp: typeof claims.exp === "number" ? claims.exp : undefined,
  };
}

if (!process.env.REPLIT_DOMAINS && !process.env.REPLIT_DEPLOYMENT) {
  console.warn("Warning: REPLIT_DOMAINS not set. Replit OAuth will be disabled in this environment.");
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

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  
  // Use PostgreSQL session store for persistence
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true, // Auto-create sessions table
    ttl: sessionTtl / 1000, // Convert to seconds
    tableName: 'sessions',
  });

  return session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'default-dev-secret-2024',
    resave: false,
    saveUninitialized: false,
    rolling: true, // Extend session on activity
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Only secure in production
      maxAge: sessionTtl,
      sameSite: 'lax' // Allow cross-site requests
    },
    name: 'coinrailz.session' // Custom session name
  });
}

function updateUserSession(
  user: OAuthSessionUser,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = getUserClaims(tokens);
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims.exp;
}

async function upsertUser(
  claims: OidcUserClaims,
) {
  // Check if user already exists to determine if this is a new registration
  const existingUser = await storage.getUser(claims["sub"]);
  const isNewUser = !existingUser;
  
  const user = await storage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });

  // Send welcome email for new users
  if (isNewUser && claims["email"]) {
    try {
      const { EmailService } = await import('./services/emailService');
      const emailService = EmailService.getInstance();
      await emailService.sendUserWelcomeEmail(user);
      console.log(`📧 Welcome email sent to new user: ${claims["email"]}`);
    } catch (error) {
      console.error('Failed to send welcome email:', error);
    }
  }
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  let config;
  try {
    config = await getOidcConfig();
    console.log('✅ OAuth configuration loaded successfully');
  } catch (error: any) {
    console.error('❌ OAuth configuration failed:', error?.message || error);
    // Provide fallback registration for development
    if (process.env.NODE_ENV === 'development') {
      console.log('Using fallback authentication for development');
      return setupFallbackAuth(app);
    }
    // Production: OIDC discovery failed - skip Replit OAuth gracefully
    // Other auth methods (email, Coinbase OAuth) will still work
    console.warn('⚠️ Replit OAuth skipped (OIDC discovery failed). Email/Coinbase auth still active.');
    return;
  }

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const claims = getUserClaims(tokens);
    const user: OAuthSessionUser = {
      id: claims.sub ?? "",
      email: claims.email,
      claims: {
        sub: claims.sub,
        email: claims.email,
        first_name: claims.first_name,
        last_name: claims.last_name,
        profile_image_url: claims.profile_image_url,
      },
    };
    updateUserSession(user, tokens);
    await upsertUser(claims);
    verified(null, user);
  };

  // Register strategies for all domains AND localhost
  // In production deployments, REPLIT_DOMAINS may not be set
  const domainsEnv = process.env.REPLIT_DOMAINS;
  if (!domainsEnv) {
    console.log('⚠️ REPLIT_DOMAINS not set - Replit OAuth disabled in this environment');
    console.log('   Users can still authenticate via other methods (email, Coinbase, etc.)');
    return; // Skip OAuth setup in production deployments without REPLIT_DOMAINS
  }
  
  const domains = domainsEnv.split(",");
  const allDomains = [...domains, 'localhost'];
  
  console.log('Registering authentication strategies for domains:', allDomains);
  
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
      verify,
    );
    passport.use(strategy);
    console.log(`Registered strategy: ${strategyName}`);
  }

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    console.log(`OAuth login requested for hostname: ${req.hostname}`);
    
    // Always use localhost strategy for local testing, actual domain for production
    const strategyName = `replitauth:${req.hostname}`;
    console.log(`Using authentication strategy: ${strategyName} for hostname: ${req.hostname}`);
    
    passport.authenticate(strategyName, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    // Use consistent strategy name matching the login endpoint
    const strategyName = `replitauth:${req.hostname}`;
    console.log(`OAuth callback received for strategy: ${strategyName}, hostname: ${req.hostname}`);
      
    passport.authenticate(strategyName, {
      successReturnToOrRedirect: "/",
      failureRedirect: "/api/login",
    })(req, res, next);
  });

  // OAuth logout disabled - using authRoutes.ts simple logout instead
  // app.get("/api/logout", (req, res) => {
  //   req.logout(() => {
  //     res.redirect(
  //       client.buildEndSessionUrl(config, {
  //         client_id: process.env.REPL_ID!,
  //         post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
  //       }).href
  //     );
  //   });
  // });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;
  const sessionUser = req.session?.user;

  // Check for Bearer token authentication (for API requests)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    
    if (token) {
      const { getSessionSync } = await import('./services/sessionManager');
      const session = getSessionSync(token);
      if (session) {
        req.user = {
          id: session.userId,
          email: session.userEmail,
          claims: {
            sub: session.userId,
            email: session.userEmail,
            first_name: 'User',
            last_name: ''
          }
        };
        return next();
      }
    }
  }

  // Check for Coinbase OAuth session first - these users are automatically authenticated and KYC verified
  if (sessionUser?.coinbase?.accessToken && sessionUser.coinbase.isVerified) {
    return next();
  }

  // Check for Replit OAuth session
  if (!req.isAuthenticated() || !user?.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized" });
  }
};

// Fallback authentication for development/testing
function setupFallbackAuth(app: Express) {
  console.log('Setting up fallback authentication system');
  
  // Simple login endpoint for testing
  app.get('/api/login', (req, res) => {
    res.redirect('/signup-flow-demo?auth=fallback');
  });
  
  // Fallback registration endpoint
  app.post('/api/auth/register', async (req, res) => {
    try {
      const registrationSchema = z.object({
        email: z.string().email('Valid email is required'),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        password: z.string().optional(), // Optional for OAuth flows
        acceptTerms: z.boolean().optional(),
      });

      const validatedData = registrationSchema.parse(req.body);
      const { email, firstName, lastName } = validatedData;
      
      // Check if user already exists (simplified check)
      const existingUser = await storage.getUserByEmail?.(email);
      
      if (existingUser) {
        return res.status(409).json({ 
          success: false, 
          error: 'Email already registered',
          message: 'Email already registered. Please try using the \'Sign In\' option instead.',
          code: 'USER_EXISTS'
        });
      }
      
      const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const newUser = await storage.upsertUser({
        id: userId,
        email,
        firstName: firstName || null,
        lastName: lastName || null,
        profileImageUrl: null,
      });

      // Send welcome email for new user registration
      try {
        const { EmailService } = await import('./services/emailService');
        const emailService = EmailService.getInstance();
        await emailService.sendUserWelcomeEmail(newUser);
        console.log(`📧 Welcome email sent to new user: ${email}`);
      } catch (error) {
        console.error('Failed to send welcome email:', error);
      }
      
      // Set session
      (req.session as any).user = {
        claims: {
          sub: userId,
          email,
          first_name: firstName,
          last_name: lastName
        }
      };
      
      res.status(201).json({
        success: true,
        user: newUser,
        message: 'Registration successful'
      });
    } catch (error) {
      console.error('Registration error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          success: false, 
          message: 'Validation failed',
          errors: error.errors
        });
      }
      res.status(500).json({ success: false, message: 'Registration failed' });
    }
  });
  
  // User endpoint moved to authRoutes.ts for consistent session handling
};