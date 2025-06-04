export interface EnvironmentConfig {
  // Core Application
  NODE_ENV: 'development' | 'staging' | 'production';
  PORT: number;
  FRONTEND_URL: string;
  BACKEND_URL: string;

  // Database
  DATABASE_URL: string;
  REDIS_URL?: string;

  // Authentication
  SESSION_SECRET: string;
  REPLIT_DOMAINS?: string;
  REPL_ID?: string;
  ISSUER_URL?: string;

  // Stripe Payment Processing
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  VITE_STRIPE_PUBLIC_KEY?: string;

  // Cryptocurrency APIs
  COINBASE_API_KEY?: string;
  COINBASE_API_SECRET?: string;
  COINBASE_PASSPHRASE?: string;
  COINGECKO_API_KEY?: string;
  COINMARKETCAP_API_KEY?: string;

  // Banking & Payment APIs
  PLAID_CLIENT_ID?: string;
  PLAID_SECRET?: string;
  PLAID_ENVIRONMENT?: 'sandbox' | 'development' | 'production';
  DWOLLA_KEY?: string;
  DWOLLA_SECRET?: string;
  DWOLLA_ENVIRONMENT?: 'sandbox' | 'production';

  // Compliance & KYC
  JUMIO_API_TOKEN?: string;
  JUMIO_API_SECRET?: string;
  JUMIO_BASE_URL?: string;
  CHAINALYSIS_API_KEY?: string;

  // Blockchain Networks
  INFURA_PROJECT_ID?: string;
  ALCHEMY_API_KEY?: string;
  QUICKNODE_ENDPOINT?: string;

  // Notifications
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_PHONE_NUMBER?: string;
  SENDGRID_API_KEY?: string;

  // NOWPayments Integration
  NOWPAYMENTS_API_KEY?: string;
  NOWPAYMENTS_IPN_SECRET?: string;

  // ChangeNOW Integration
  CHANGENOW_API_KEY?: string;

  // Monitoring
  LOG_LEVEL: 'error' | 'warn' | 'info' | 'debug';
  SENTRY_DSN?: string;
}

function validateEnvironment(): EnvironmentConfig {
  const config: EnvironmentConfig = {
    NODE_ENV: (process.env.NODE_ENV as EnvironmentConfig['NODE_ENV']) || 'development',
    PORT: parseInt(process.env.PORT || '5000', 10),
    FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
    BACKEND_URL: process.env.BACKEND_URL || 'http://localhost:5000',
    
    DATABASE_URL: process.env.DATABASE_URL || '',
    REDIS_URL: process.env.REDIS_URL,
    
    SESSION_SECRET: process.env.SESSION_SECRET || '',
    REPLIT_DOMAINS: process.env.REPLIT_DOMAINS,
    REPL_ID: process.env.REPL_ID,
    ISSUER_URL: process.env.ISSUER_URL,
    
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    VITE_STRIPE_PUBLIC_KEY: process.env.VITE_STRIPE_PUBLIC_KEY,
    
    COINBASE_API_KEY: process.env.COINBASE_API_KEY,
    COINBASE_API_SECRET: process.env.COINBASE_API_SECRET,
    COINBASE_PASSPHRASE: process.env.COINBASE_PASSPHRASE,
    COINGECKO_API_KEY: process.env.COINGECKO_API_KEY,
    COINMARKETCAP_API_KEY: process.env.COINMARKETCAP_API_KEY,
    
    PLAID_CLIENT_ID: process.env.PLAID_CLIENT_ID,
    PLAID_SECRET: process.env.PLAID_SECRET,
    PLAID_ENVIRONMENT: (process.env.PLAID_ENVIRONMENT as EnvironmentConfig['PLAID_ENVIRONMENT']) || 'sandbox',
    DWOLLA_KEY: process.env.DWOLLA_KEY,
    DWOLLA_SECRET: process.env.DWOLLA_SECRET,
    DWOLLA_ENVIRONMENT: (process.env.DWOLLA_ENVIRONMENT as EnvironmentConfig['DWOLLA_ENVIRONMENT']) || 'sandbox',
    
    JUMIO_API_TOKEN: process.env.JUMIO_API_TOKEN,
    JUMIO_API_SECRET: process.env.JUMIO_API_SECRET,
    JUMIO_BASE_URL: process.env.JUMIO_BASE_URL,
    CHAINALYSIS_API_KEY: process.env.CHAINALYSIS_API_KEY,
    
    INFURA_PROJECT_ID: process.env.INFURA_PROJECT_ID,
    ALCHEMY_API_KEY: process.env.ALCHEMY_API_KEY,
    QUICKNODE_ENDPOINT: process.env.QUICKNODE_ENDPOINT,
    
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
    SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,

    // NOWPayments Integration
    NOWPAYMENTS_API_KEY: process.env.NOWPAYMENTS_API_KEY,
    NOWPAYMENTS_IPN_SECRET: process.env.NOWPAYMENTS_IPN_SECRET,

    // ChangeNOW Integration
    CHANGENOW_API_KEY: process.env.CHANGENOW_API_KEY || 'ca3accd403855c72d0cb8eecdecf3477334875902197b7e02c689e9e626bd0db',
    
    LOG_LEVEL: (process.env.LOG_LEVEL as EnvironmentConfig['LOG_LEVEL']) || 'info',
    SENTRY_DSN: process.env.SENTRY_DSN,
  };

  // Validate required fields
  const requiredFields: (keyof EnvironmentConfig)[] = ['DATABASE_URL', 'SESSION_SECRET'];
  const missingFields = requiredFields.filter(field => !config[field]);
  
  if (missingFields.length > 0) {
    throw new Error(`Missing required environment variables: ${missingFields.join(', ')}`);
  }

  return config;
}

export const env = validateEnvironment();

export function isProductionMode(): boolean {
  return env.NODE_ENV === 'production';
}

export function isDevelopmentMode(): boolean {
  return env.NODE_ENV === 'development';
}

export function hasStripeCredentials(): boolean {
  return !!(env.STRIPE_SECRET_KEY && env.VITE_STRIPE_PUBLIC_KEY);
}

export function hasCryptoAPICredentials(): boolean {
  return !!(env.COINGECKO_API_KEY || env.COINMARKETCAP_API_KEY || env.COINBASE_API_KEY);
}

export function hasBlockchainCredentials(): boolean {
  return !!(env.INFURA_PROJECT_ID || env.ALCHEMY_API_KEY || env.QUICKNODE_ENDPOINT);
}

export function hasNotificationCredentials(): boolean {
  return !!(env.TWILIO_ACCOUNT_SID || env.SENDGRID_API_KEY);
}