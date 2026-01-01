export interface CoinRailzSolanaConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
}

export interface SendPaymentParams {
  to: string;
  amount: number;
  currency?: 'SOL' | 'USDC';
  memo?: string;
  metadata?: Record<string, any>;
}

export interface SendPaymentResult {
  success: boolean;
  transactionId: string;
  status: 'pending' | 'processing' | 'confirmed' | 'failed';
  signature: string | null;
  amount: {
    gross: number;
    fee: number;
    net: number;
  };
  currency: string;
  recipient: string;
  network: string;
  explorerUrl: string | null;
  timestamp: string;
}

export interface BalanceResult {
  success: boolean;
  address: string;
  balance: {
    sol: number;
    lamports: number;
  };
  network: string;
  timestamp: string;
}

export interface WalletResult {
  success: boolean;
  wallet: {
    address: string;
    publicKey: string;
    network: string;
    createdAt: string;
  };
  message: string;
  privateKey: string;
}

export interface TransactionResult {
  success: boolean;
  signature: string;
  status: 'pending' | 'confirmed' | 'failed';
  network: string;
  explorerUrl: string;
  timestamp: string;
}

export interface StatusResult {
  success: boolean;
  service: string;
  version: string;
  status: 'operational' | 'degraded' | 'down';
  features: {
    payments: boolean;
    walletCreation: boolean;
    solTransfers: boolean;
    usdcTransfers: boolean;
  };
  pricing: {
    processingFee: string;
  };
  network: string;
  currencies: string[];
  timestamp: string;
}

export interface ApiError {
  success: false;
  error: string;
  message: string;
}

export type ApiResponse<T> = T | ApiError;
