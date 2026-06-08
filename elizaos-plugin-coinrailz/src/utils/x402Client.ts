import axios, { AxiosError } from 'axios';
import type { PaymentRequest, PaymentResponse } from '../types';

const COIN_RAILZ_BASE_URL = process.env.COIN_RAILZ_URL || 'https://coinrailz.com';

export interface X402ClientConfig {
  baseUrl?: string;
  apiKey?: string;
  privateKey?: string;
}

/**
 * Coin Railz x402 Client
 *
 * Supports two payment paths:
 *
 *   Path 1 — API Key (RECOMMENDED for most agents)
 *     Set COINRAILZ_API_KEY env var. Buy credits at coinrailz.com/credits.
 *     Uses Authorization: Bearer header. No blockchain interaction required.
 *
 *   Path 2 — Autonomous x402 (for truly self-sovereign agents)
 *     Set EVM_PRIVATE_KEY env var with a funded Base mainnet wallet.
 *     Uses x402-fetch to sign and submit EIP-712 USDC payments automatically.
 *
 * If neither is set, the client returns a descriptive error so the agent can
 * surface the configuration requirement to the operator.
 */
export class X402Client {
  private baseUrl: string;
  private apiKey?: string;
  private privateKey?: string;

  constructor(config?: X402ClientConfig) {
    this.baseUrl = config?.baseUrl || COIN_RAILZ_BASE_URL;
    this.apiKey = config?.apiKey || process.env.COINRAILZ_API_KEY;
    this.privateKey = config?.privateKey || process.env.EVM_PRIVATE_KEY;
  }

  /**
   * Call a Coin Railz service.
   * Automatically selects the appropriate payment path based on available credentials.
   */
  async callService(request: PaymentRequest): Promise<PaymentResponse> {
    if (this.apiKey) {
      return this._callWithApiKey(request);
    }
    if (this.privateKey) {
      return this._callWithX402(request);
    }
    return {
      success: false,
      error: [
        'No payment credentials configured.',
        'Set COINRAILZ_API_KEY (recommended: coinrailz.com/credits)',
        'or EVM_PRIVATE_KEY (funded Base wallet for autonomous x402 payments).'
      ].join(' ')
    };
  }

  /**
   * Path 1: API Key (Authorization: Bearer)
   * Platform accepts both "Authorization: Bearer <key>" and "x-api-key: <key>".
   * Bearer is used here for maximum compatibility.
   */
  private async _callWithApiKey(request: PaymentRequest): Promise<PaymentResponse> {
    const { serviceId, payload } = request;
    const endpoint = `${this.baseUrl}/x402/${serviceId}`;

    try {
      const response = await axios.post(endpoint, payload ?? {}, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'User-Agent': 'elizaos-plugin-coinrailz/2.0.0'
        }
      });
      return { success: true, serviceResponse: response.data };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 402) {
          return {
            success: false,
            error: 'INSUFFICIENT_CREDITS',
            serviceResponse: {
              message: `Insufficient credits for ${serviceId}. Top up at ${this.baseUrl}/credits`,
              rechargeUrl: `${this.baseUrl}/credits`
            }
          };
        }
        const msg = (error.response?.data as any)?.message || error.message;
        return { success: false, error: msg };
      }
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Path 2: Autonomous x402 with EIP-712 payment signing
   * Requires a funded Base mainnet wallet (EVM_PRIVATE_KEY).
   * Uses x402-fetch's wrapFetchWithPayment for automatic 402 handling.
   */
  private async _callWithX402(request: PaymentRequest): Promise<PaymentResponse> {
    const { serviceId, payload } = request;
    const endpoint = `${this.baseUrl}/x402/${serviceId}`;

    try {
      const { wrapFetchWithPayment } = await import('x402-fetch');
      const { privateKeyToAccount } = await import('viem/accounts');
      const { createWalletClient, http } = await import('viem');
      const { base } = await import('viem/chains');

      const account = privateKeyToAccount(this.privateKey as `0x${string}`);
      const walletClient = createWalletClient({
        account,
        chain: base,
        transport: http()
      });

      const x402Fetch = wrapFetchWithPayment(fetch, walletClient as any);

      const response = await x402Fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'elizaos-plugin-coinrailz/2.0.0' },
        body: JSON.stringify(payload ?? {})
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        return { success: false, error: `HTTP ${response.status}: ${(errBody as any)?.message || response.statusText}` };
      }

      const data = await response.json();
      return { success: true, serviceResponse: data };
    } catch (error) {
      const err = error as Error;
      if (err.message?.includes('exceeds maximum')) {
        return {
          success: false,
          error: `Payment amount exceeds the configured maximum. Service: ${serviceId}`
        };
      }
      return { success: false, error: err.message || 'Unknown x402 payment error' };
    }
  }

  /**
   * Call a service with an already-submitted transaction hash (legacy path).
   * Useful when the agent has separately submitted a USDC transfer.
   */
  async callServiceWithPayment(
    request: PaymentRequest,
    transactionHash: string
  ): Promise<PaymentResponse> {
    const { serviceId, payload } = request;
    const endpoint = `${this.baseUrl}/x402/${serviceId}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-PAYMENT': transactionHash,
      'User-Agent': 'elizaos-plugin-coinrailz/2.0.0'
    };
    if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

    try {
      const response = await axios.post(endpoint, payload ?? {}, { headers });
      return { success: true, transactionHash, serviceResponse: response.data };
    } catch (error) {
      const err = error as AxiosError;
      const errData = err.response?.data;
      const errMsg = typeof errData === 'string'
        ? errData
        : (typeof errData === 'object' && errData !== null && 'message' in errData)
          ? String((errData as any).message)
          : err.message || 'Unknown error';
      return { success: false, transactionHash, error: errMsg };
    }
  }
}
