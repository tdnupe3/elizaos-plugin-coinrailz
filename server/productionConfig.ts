/**
 * Production Environment Configuration
 * Security and performance settings for production deployment
 */

import { env } from './environment';

export const ProductionConfig = {
  // Security Configuration
  security: {
    enforceHttps: true,
    sessionSecure: true,
    csrfProtection: true,
    rateLimiting: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000, // requests per window
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      standardHeaders: true,
      legacyHeaders: false
    },
    ipBlocking: {
      maxAttempts: 10,
      blockDuration: 3600000, // 1 hour
      whitelistCountries: ['US', 'CA', 'GB', 'AU', 'DE', 'FR', 'NL', 'JP']
    },
    ddosProtection: {
      enabled: true,
      threshold: 100, // requests per minute
      burst: 200,
      delay: 500 // milliseconds
    }
  },

  // Database Configuration
  database: {
    connectionLimit: 20,
    acquireTimeout: 60000,
    timeout: 60000,
    reconnect: true,
    reconnectTimeout: 2000,
    maxReconnects: 3,
    ssl: env.NODE_ENV === 'production',
    statementTimeout: 30000
  },

  // Performance Configuration
  performance: {
    enableGzip: true,
    enableBrotli: true,
    staticCacheMaxAge: 31536000, // 1 year
    apiCacheMaxAge: 300, // 5 minutes
    enableEtag: true,
    trustProxy: true,
    keepAliveTimeout: 65000,
    headersTimeout: 66000
  },

  // API Configuration
  api: {
    enableCors: true,
    corsOrigins: env.NODE_ENV === 'production' 
      ? ['https://coinrailz.com', 'https://www.coinrailz.com']
      : ['http://localhost:3000', 'http://localhost:5000'],
    maxRequestSize: '10mb',
    enableCompression: true,
    timeout: 30000
  },

  // Session Configuration
  session: {
    name: 'coinrailz-session',
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      secure: env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: 'strict' as const
    }
  }
};

/**
 * Validate production configuration
 */
export function validateProductionConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Required environment variables
  const requiredVars = [
    'DATABASE_URL',
    'SESSION_SECRET',
    'STRIPE_SECRET_KEY',
    'PAYPAL_CLIENT_ID',
    'PAYPAL_CLIENT_SECRET'
  ];

  for (const varName of requiredVars) {
    if (!(env as any)[varName]) {
      errors.push(`Missing required environment variable: ${varName}`);
    }
  }

  // Security validations
  if (env.SESSION_SECRET && env.SESSION_SECRET.length < 32) {
    errors.push('SESSION_SECRET must be at least 32 characters long');
  }

  // Database URL validation
  if (env.DATABASE_URL && !env.DATABASE_URL.startsWith('postgres')) {
    errors.push('DATABASE_URL must be a valid PostgreSQL connection string');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}