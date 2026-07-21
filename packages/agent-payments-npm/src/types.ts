/**
 * @coinrailz/agent-payments - Type Definitions
 * AI Agent Payment Processing SDK
 */

export interface CoinRailzConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  enableIntelligence?: boolean;
}

export interface SendPaymentParams {
  to: string;
  amount: number;
  currency?: 'USDC';
  memo?: string;
  metadata?: Record<string, any>;
}

export interface SendPaymentResult {
  success: boolean;
  transactionId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  amount: number;
  fee: number;
  netAmount: number;
  currency: string;
  to: string;
  memo: string | null;
  feeBreakdown: {
    percentageFee: number;
    fixedFee: number;
    totalFee: number;
    rate: string;
  };
  timestamp: string;
  network: string;
}

export interface CreateInvoiceParams {
  amount: number;
  currency?: 'USDC';
  description?: string;
  expiresIn?: number;
  metadata?: Record<string, any>;
}

export interface InvoiceResult {
  success: boolean;
  invoiceId: string;
  paymentAddress: string;
  amount: number;
  currency: string;
  description: string | null;
  status: 'pending' | 'paid' | 'expired';
  expiresAt: string;
  createdAt: string;
  network: string;
  paymentInstructions: {
    step1: string;
    step2: string;
    step3: string;
    network: string;
    token: string;
  };
}

export interface ReportParams {
  period?: 'daily' | 'weekly' | 'monthly';
  format?: 'json' | 'markdown';
}

export interface ReportResult {
  success: boolean;
  agentId: string;
  period: {
    type: string;
    start: string;
    end: string;
  };
  summary: {
    totalTransactions: number;
    successfulTransactions: number;
    failedTransactions: number;
    totalVolumeUSD: number;
    feesCollected: number;
    successRate: number;
  };
  transactions: TransactionRecord[];
  generatedAt: string;
  sdkVersion: string;
}

export interface TransactionRecord {
  id: string;
  type: 'send' | 'receive' | 'invoice';
  amount: number;
  fee: number;
  status: string;
  timestamp: string;
}

export interface BalanceResult {
  success: boolean;
  address: string | null;
  network: string;
  balances: {
    USDC: number;
    ETH: number;
  };
  lastUpdated: string;
  message?: string;
}

export interface WalletResult {
  success: boolean;
  walletId: string;
  address: string | null;
  network: string;
  status: 'creating' | 'active' | 'failed';
  createdAt: string;
}

export interface StatusResult {
  success: boolean;
  service: string;
  version: string;
  status: 'operational' | 'degraded' | 'down';
  features: {
    payments: boolean;
    invoices: boolean;
    reports: boolean;
    walletCreation: boolean;
    intelligence: boolean;
  };
  pricing: {
    processingFee: string;
    intelligenceBundle: string;
  };
  network: string;
  currency: string;
  timestamp: string;
}

export interface IntelligenceServiceResult<T = any> {
  success: boolean;
  service: string;
  result: T;
  timestamp: string;
}

export interface ApiError {
  success: false;
  error: string;
  message: string;
}

export type ApiResponse<T> = T | ApiError;
