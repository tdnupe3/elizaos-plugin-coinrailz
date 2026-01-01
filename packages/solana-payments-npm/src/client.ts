/**
 * @coinrailz/agent-payments-solana - Client
 * Solana AI Agent Payment Processing SDK
 * 
 * Non-custodial SOL/USDC payments for AI agents.
 * Processing fee: 1.5% + $0.01 per transaction
 */

import type {
  CoinRailzSolanaConfig,
  SendPaymentParams,
  SendPaymentResult,
  BalanceResult,
  WalletResult,
  TransactionResult,
  StatusResult,
  ApiError,
  ApiResponse
} from './types';

const DEFAULT_BASE_URL = 'https://coinrailz.com';
const DEFAULT_TIMEOUT = 30000;
const SDK_VERSION = '1.0.5';

export class CoinRailzSolana {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(config: CoinRailzSolanaConfig) {
    if (!config.apiKey) {
      throw new Error('API key is required. Get one at https://coinrailz.com/dashboard/api-keys');
    }

    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || DEFAULT_BASE_URL;
    this.timeout = config.timeout || DEFAULT_TIMEOUT;
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: Record<string, any>
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}/api/sdk/solana${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'X-SDK-Version': SDK_VERSION
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const data: any = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || 'UNKNOWN_ERROR',
          message: data.message || `HTTP ${response.status}`
        } as ApiError;
      }

      return data as T;
    } catch (error: any) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        return {
          success: false,
          error: 'TIMEOUT',
          message: `Request timed out after ${this.timeout}ms`
        } as ApiError;
      }

      return {
        success: false,
        error: 'NETWORK_ERROR',
        message: error.message || 'Network request failed'
      } as ApiError;
    }
  }

  /**
   * Send SOL or USDC payment to a Solana address
   * Fee: 1.5% + $0.01
   */
  async send(params: SendPaymentParams): Promise<ApiResponse<SendPaymentResult>> {
    return this.request<SendPaymentResult>('POST', '/payments/send', {
      to: params.to,
      amount: params.amount,
      currency: params.currency || 'USDC',
      memo: params.memo,
      metadata: params.metadata
    });
  }

  /**
   * Get SOL balance for a Solana address
   */
  async getBalance(address: string): Promise<ApiResponse<BalanceResult>> {
    return this.request<BalanceResult>('GET', `/balance/${address}`);
  }

  /**
   * Create a new Solana wallet
   */
  async createWallet(): Promise<ApiResponse<WalletResult>> {
    return this.request<WalletResult>('POST', '/wallet');
  }

  /**
   * Get transaction status by signature
   */
  async getTransaction(signature: string): Promise<ApiResponse<TransactionResult>> {
    return this.request<TransactionResult>('GET', `/transaction/${signature}`);
  }

  /**
   * Check Solana SDK service status
   */
  async status(): Promise<ApiResponse<StatusResult>> {
    const url = `${this.baseUrl}/api/sdk/solana/status`;
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-SDK-Version': SDK_VERSION
        }
      });

      return await response.json() as StatusResult;
    } catch (error: any) {
      return {
        success: false,
        error: 'NETWORK_ERROR',
        message: error.message || 'Status check failed'
      } as ApiError;
    }
  }

  /**
   * Get SDK version
   */
  get version(): string {
    return SDK_VERSION;
  }
}
