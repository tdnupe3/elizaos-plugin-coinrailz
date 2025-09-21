/**
 * COINRAILZ SDK TYPE DEFINITIONS
 * Enterprise-grade types for $2K-$200K AI payment infrastructure
 */

export interface SDKConfiguration {
  licenseKey: string;
  platformUrl?: string;
  environment?: 'production' | 'staging' | 'development';
  enableAnalytics?: boolean;
  enableCompliance?: boolean;
  circleApiKey?: string;
  stripePublicKey?: string;
  paypalClientId?: string;
}

export interface LicenseInfo {
  isValid: boolean;
  tier: 'Startup' | 'Growth' | 'Enterprise' | 'Custom';
  companyName: string;
  contactEmail: string;
  expiresAt: Date;
  monthlyVolumeLimit: number;
  featuresEnabled: string[];
  daysUntilRenewal: number;
  billingCycle: 'monthly' | 'yearly';
}

export interface PaymentMethod {
  type: 'usdc' | 'stripe' | 'paypal' | 'crypto' | 'bank_transfer';
  provider: string;
  configuration: Record<string, any>;
  enabled: boolean;
  fees: {
    percentage: number;
    fixed: number;
    currency: string;
  };
}

export interface PaymentResult {
  success: boolean;
  transactionId: string;
  amount: number;
  currency: string;
  method: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  fees: number;
  metadata: Record<string, any>;
  timestamp: Date;
  confirmationUrl?: string;
  error?: string;
}

export interface AIAgent {
  id: string;
  name: string;
  description: string;
  version: string;
  capabilities: AgentCapability[];
  endpoints: AgentEndpoint[];
  pricing: AgentPricing;
  owner: {
    companyName: string;
    contactEmail: string;
    licenseKey: string;
  };
  status: 'active' | 'inactive' | 'suspended';
  createdAt: Date;
  updatedAt: Date;
  metrics: AgentMetrics;
}

export interface AgentCapability {
  name: string;
  description: string;
  category: 'payment' | 'communication' | 'analytics' | 'compliance' | 'custom';
  inputs: CapabilityParameter[];
  outputs: CapabilityParameter[];
  pricing: {
    type: 'per_call' | 'subscription' | 'volume_based';
    amount: number;
    currency: string;
  };
}

export interface CapabilityParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  description: string;
  example?: any;
}

export interface AgentEndpoint {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  authentication: 'api_key' | 'oauth' | 'bearer_token';
  rateLimit: {
    requests: number;
    window: string;
  };
}

export interface AgentPricing {
  model: 'free' | 'freemium' | 'paid' | 'enterprise';
  baseFee: number;
  successFee: number;
  currency: string;
  volumeDiscounts: VolumeDiscount[];
}

export interface VolumeDiscount {
  minimumVolume: number;
  discountPercentage: number;
}

export interface AgentMetrics {
  totalCalls: number;
  successRate: number;
  averageResponseTime: number;
  monthlyRevenue: number;
  activeUsers: number;
  lastActive: Date;
}

export interface ComplianceRule {
  id: string;
  name: string;
  description: string;
  type: 'aml' | 'kyc' | 'sanctions' | 'limits' | 'custom';
  conditions: ComplianceCondition[];
  actions: ComplianceAction[];
  enabled: boolean;
  priority: number;
}

export interface ComplianceCondition {
  field: string;
  operator: 'equals' | 'greater_than' | 'less_than' | 'contains' | 'regex';
  value: any;
}

export interface ComplianceAction {
  type: 'block' | 'flag' | 'require_review' | 'notify' | 'log';
  parameters: Record<string, any>;
}

export interface TransactionReport {
  id: string;
  type: 'payment' | 'agent_call' | 'compliance_event';
  amount: number;
  currency: string;
  status: string;
  timestamp: Date;
  metadata: Record<string, any>;
  complianceFlags: string[];
}

export interface PlatformMetrics {
  payments: PaymentMetrics;
  agents: AgentPlatformMetrics;
  compliance: ComplianceMetrics;
  license: LicenseMetrics;
}

export interface PaymentMetrics {
  totalVolume: number;
  monthlyVolume: number;
  transactionCount: number;
  successRate: number;
  averageAmount: number;
  topMethods: Array<{ method: string; volume: number; percentage: number }>;
  revenueGenerated: number;
}

export interface AgentPlatformMetrics {
  totalAgents: number;
  activeAgents: number;
  totalCalls: number;
  successRate: number;
  revenueShared: number;
  topPerformers: Array<{ agentId: string; calls: number; revenue: number }>;
}

export interface ComplianceMetrics {
  totalChecks: number;
  flaggedTransactions: number;
  blockedTransactions: number;
  manualReviews: number;
  complianceScore: number;
  riskDistribution: Record<string, number>;
}

export interface LicenseMetrics {
  tier: string;
  monthlyVolumeUsed: number;
  monthlyVolumeLimit: number;
  daysUntilRenewal: number;
  usagePercentage: number;
}

// Utility types
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'refunded';
export type AgentStatus = 'active' | 'inactive' | 'suspended' | 'maintenance';
export type ComplianceStatus = 'approved' | 'flagged' | 'blocked' | 'under_review';

// Event types for real-time updates
export interface SDKEvent {
  type: string;
  timestamp: Date;
  data: Record<string, any>;
}

export interface PaymentEvent extends SDKEvent {
  type: 'payment_started' | 'payment_completed' | 'payment_failed';
  data: {
    transactionId: string;
    amount: number;
    currency: string;
    status: PaymentStatus;
  };
}

export interface AgentEvent extends SDKEvent {
  type: 'agent_called' | 'agent_responded' | 'agent_error';
  data: {
    agentId: string;
    capability: string;
    duration: number;
    success: boolean;
  };
}

export interface ComplianceEvent extends SDKEvent {
  type: 'compliance_check' | 'transaction_flagged' | 'manual_review_required';
  data: {
    transactionId: string;
    riskScore: number;
    flags: string[];
    action: string;
  };
}