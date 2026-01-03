/**
 * @coinrailz/agent-payments - Client
 * AI Agent Payment Processing SDK
 * 
 * Non-custodial USDC payments for AI agents with bundled intelligence services.
 * Processing fee: 1.5% + $0.01 per transaction
 */

import type {
  CoinRailzConfig,
  SendPaymentParams,
  SendPaymentResult,
  CreateInvoiceParams,
  InvoiceResult,
  ReportParams,
  ReportResult,
  BalanceResult,
  WalletResult,
  StatusResult,
  IntelligenceServiceResult,
  ApiError,
  ApiResponse
} from './types';

const DEFAULT_BASE_URL = 'https://coinrailz.com';
const DEFAULT_TIMEOUT = 30000;
const SDK_VERSION = '1.0.0';

export class CoinRailz {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly enableIntelligence: boolean;

  constructor(config: CoinRailzConfig) {
    if (!config.apiKey) {
      throw new Error('API key is required. Get one at https://coinrailz.com/api-keys');
    }

    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || DEFAULT_BASE_URL;
    this.timeout = config.timeout || DEFAULT_TIMEOUT;
    this.enableIntelligence = config.enableIntelligence ?? false;
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: Record<string, any>
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}/api/sdk${path}`;
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
   * Send USDC payment to an address
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
   * Create a payment invoice
   */
  async createInvoice(params: CreateInvoiceParams): Promise<ApiResponse<InvoiceResult>> {
    return this.request<InvoiceResult>('POST', '/payments/invoice', {
      amount: params.amount,
      currency: params.currency || 'USDC',
      description: params.description,
      expiresIn: params.expiresIn || 15,
      metadata: params.metadata
    });
  }

  /**
   * Get activity reports
   */
  async getReports(params?: ReportParams): Promise<ApiResponse<ReportResult>> {
    const query = new URLSearchParams();
    if (params?.period) query.set('period', params.period);
    if (params?.format) query.set('format', params.format);
    
    const queryString = query.toString();
    return this.request<ReportResult>('GET', `/payments/reports${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Get wallet balance
   */
  async getBalance(): Promise<ApiResponse<BalanceResult>> {
    return this.request<BalanceResult>('GET', '/balance');
  }

  /**
   * Create a new CDP wallet
   */
  async createWallet(): Promise<ApiResponse<WalletResult>> {
    return this.request<WalletResult>('POST', '/wallet');
  }

  /**
   * Check SDK service status
   */
  async status(): Promise<ApiResponse<StatusResult>> {
    const url = `${this.baseUrl}/api/sdk/status`;
    
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
   * Call an intelligence service (x402 microservice)
   * Requires enableIntelligence: true or +0.35% bundle subscription
   */
  async intelligence<T = any>(
    service: string,
    params?: Record<string, any>
  ): Promise<ApiResponse<IntelligenceServiceResult<T>>> {
    if (!this.enableIntelligence) {
      return {
        success: false,
        error: 'INTELLIGENCE_NOT_ENABLED',
        message: 'Enable intelligence bundle with enableIntelligence: true or subscribe at $79/mo'
      } as ApiError;
    }

    return this.request<IntelligenceServiceResult<T>>('POST', `/intelligence/${service}`, params);
  }

  /**
   * Get SDK version
   */
  get version(): string {
    return SDK_VERSION;
  }
}
