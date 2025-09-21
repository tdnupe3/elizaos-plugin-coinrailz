/**
 * COINRAILZ SDK CONSTANTS
 * Configuration constants for enterprise AI payment infrastructure
 */

export const SDK_VERSION = '1.0.0';

export const SUPPORTED_NETWORKS = {
  ETHEREUM: {
    name: 'Ethereum',
    chainId: 1,
    rpcUrl: 'https://eth-mainnet.alchemyapi.io/v2/',
    blockExplorer: 'https://etherscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }
  },
  POLYGON: {
    name: 'Polygon',
    chainId: 137,
    rpcUrl: 'https://polygon-rpc.com',
    blockExplorer: 'https://polygonscan.com',
    nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 }
  },
  BASE: {
    name: 'Base',
    chainId: 8453,
    rpcUrl: 'https://mainnet.base.org',
    blockExplorer: 'https://basescan.org',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }
  },
  ARBITRUM: {
    name: 'Arbitrum',
    chainId: 42161,
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    blockExplorer: 'https://arbiscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }
  },
  BNB: {
    name: 'BNB Chain',
    chainId: 56,
    rpcUrl: 'https://bsc-dataseed.binance.org',
    blockExplorer: 'https://bscscan.com',
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 }
  }
} as const;

export const DEFAULT_CONFIG = {
  environment: 'production' as const,
  platformUrl: 'https://api.coinrailz.com',
  enableAnalytics: true,
  enableCompliance: true,
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000
};

export const PAYMENT_METHODS = {
  USDC: {
    name: 'USDC',
    type: 'stablecoin',
    networks: ['ethereum', 'polygon', 'base', 'arbitrum'],
    symbol: 'USDC',
    decimals: 6,
    contractAddresses: {
      ethereum: '0xA0b86a33E6c8c4f8e6C4c6f93B9A8A9Dc9EA3A7b8',
      polygon: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
      base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      arbitrum: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831'
    }
  },
  STRIPE: {
    name: 'Stripe',
    type: 'traditional',
    supportedCurrencies: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'],
    fees: {
      cardProcessing: 0.029,
      fixedFee: 0.30
    }
  },
  PAYPAL: {
    name: 'PayPal',
    type: 'traditional',
    supportedCurrencies: ['USD', 'EUR', 'GBP', 'CAD', 'AUD'],
    fees: {
      standard: 0.0349,
      fixedFee: 0.49
    }
  }
} as const;

export const LICENSE_TIERS = {
  STARTUP: {
    name: 'Startup',
    monthlyVolumeLimit: 100000, // $100K
    maxAgents: 10,
    features: ['basic_payments', 'agent_registry', 'compliance_basic'],
    supportLevel: 'community'
  },
  GROWTH: {
    name: 'Growth', 
    monthlyVolumeLimit: 1000000, // $1M
    maxAgents: 50,
    features: ['all_payments', 'agent_marketplace', 'compliance_advanced', 'analytics'],
    supportLevel: 'business'
  },
  ENTERPRISE: {
    name: 'Enterprise',
    monthlyVolumeLimit: 10000000, // $10M
    maxAgents: 500,
    features: ['everything', 'custom_compliance', 'white_label', 'dedicated_support'],
    supportLevel: 'enterprise'
  },
  CUSTOM: {
    name: 'Custom',
    monthlyVolumeLimit: Infinity,
    maxAgents: Infinity,
    features: ['everything_plus', 'custom_development', 'on_premise'],
    supportLevel: 'white_glove'
  }
} as const;

export const API_ENDPOINTS = {
  LICENSE_VALIDATE: '/api/sdk/validate',
  LICENSE_USAGE: '/api/sdk/usage',
  PAYMENT_PROCESS: '/api/payments/process',
  PAYMENT_SESSION: '/api/payments/session',
  AGENT_REGISTER: '/api/agents/register',
  AGENT_DISCOVER: '/api/agents/discover',
  COMPLIANCE_CHECK: '/api/compliance/check',
  ANALYTICS_TRACK: '/api/analytics/track',
  METRICS_GET: '/api/metrics/get'
} as const;

export const ERROR_CODES = {
  // License errors
  LICENSE_INVALID: 'LICENSE_INVALID',
  LICENSE_EXPIRED: 'LICENSE_EXPIRED',
  LICENSE_VOLUME_EXCEEDED: 'LICENSE_VOLUME_EXCEEDED',
  LICENSE_FEATURE_DISABLED: 'LICENSE_FEATURE_DISABLED',
  
  // Payment errors
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  PAYMENT_INSUFFICIENT_FUNDS: 'PAYMENT_INSUFFICIENT_FUNDS',
  PAYMENT_METHOD_INVALID: 'PAYMENT_METHOD_INVALID',
  PAYMENT_AMOUNT_INVALID: 'PAYMENT_AMOUNT_INVALID',
  
  // Agent errors
  AGENT_NOT_FOUND: 'AGENT_NOT_FOUND',
  AGENT_UNAUTHORIZED: 'AGENT_UNAUTHORIZED',
  AGENT_CAPABILITY_MISSING: 'AGENT_CAPABILITY_MISSING',
  AGENT_RATE_LIMITED: 'AGENT_RATE_LIMITED',
  
  // Compliance errors
  COMPLIANCE_VIOLATION: 'COMPLIANCE_VIOLATION',
  COMPLIANCE_AML_FLAG: 'COMPLIANCE_AML_FLAG',
  COMPLIANCE_KYC_REQUIRED: 'COMPLIANCE_KYC_REQUIRED',
  COMPLIANCE_SANCTIONS_HIT: 'COMPLIANCE_SANCTIONS_HIT',
  
  // Network errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  NETWORK_TIMEOUT: 'NETWORK_TIMEOUT',
  NETWORK_RATE_LIMITED: 'NETWORK_RATE_LIMITED',
  
  // General errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
  INITIALIZATION_ERROR: 'INITIALIZATION_ERROR'
} as const;

export const RATE_LIMITS = {
  DEFAULT: {
    requests: 1000,
    window: '1h'
  },
  STARTUP: {
    requests: 5000,
    window: '1h'
  },
  GROWTH: {
    requests: 25000,
    window: '1h'
  },
  ENTERPRISE: {
    requests: 100000,
    window: '1h'
  },
  CUSTOM: {
    requests: Infinity,
    window: '1h'
  }
} as const;

export const WEBHOOK_EVENTS = {
  PAYMENT_COMPLETED: 'payment.completed',
  PAYMENT_FAILED: 'payment.failed',
  AGENT_REGISTERED: 'agent.registered',
  AGENT_CALLED: 'agent.called',
  COMPLIANCE_FLAGGED: 'compliance.flagged',
  LICENSE_UPDATED: 'license.updated',
  VOLUME_THRESHOLD: 'volume.threshold'
} as const;

export const COMPLIANCE_RULES = {
  AML_THRESHOLD: 10000, // $10K triggers enhanced AML
  DAILY_LIMIT: 50000,   // $50K daily limit
  MONTHLY_LIMIT: 1000000, // $1M monthly limit
  VELOCITY_CHECK: true,
  SANCTIONS_CHECK: true,
  PEP_CHECK: true
} as const;