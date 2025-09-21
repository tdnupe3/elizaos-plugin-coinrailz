/**
 * @coinrailz/ai-payments-sdk
 * Enterprise-grade AI payment infrastructure for fintech startups and AI agents
 * 
 * Revenue: $2K-$200K annually per license
 * Targets: AI companies, fintech startups, payment processors
 */

export { CoinRailzSDK } from './core/CoinRailzSDK';
export { PaymentProcessor } from './payments/PaymentProcessor';
export { AIAgentRegistry } from './agents/AIAgentRegistry';
export { ComplianceEngine } from './compliance/ComplianceEngine';
export { AnalyticsCollector } from './analytics/AnalyticsCollector';

// Type exports
export type {
  SDKConfiguration,
  PaymentMethod,
  PaymentResult,
  AIAgent,
  AgentCapability,
  ComplianceRule,
  TransactionReport,
  LicenseInfo,
  PlatformMetrics
} from './types';

// Error exports
export {
  CoinRailzError,
  PaymentError,
  LicenseError,
  ComplianceError,
  AgentError
} from './errors';

// Constants
export { SDK_VERSION, SUPPORTED_NETWORKS, DEFAULT_CONFIG } from './constants';

// Utilities
export { validateLicense, formatCurrency, generateTransactionId } from './utils';