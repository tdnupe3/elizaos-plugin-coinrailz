import axios, { AxiosError } from 'axios';
import type { PaymentRequest, PaymentResponse } from '../types';

const COIN_RAILZ_BASE_URL = process.env.COIN_RAILZ_URL || 'https://coinrailz.com';
const PLATFORM_WALLET = '0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91';

export interface X402ClientConfig {
  baseUrl?: string;
  apiKey?: string;
}

export class X402Client {
  private baseUrl: string;
  private apiKey?: string;

  constructor(config?: X402ClientConfig) {
    this.baseUrl = config?.baseUrl || COIN_RAILZ_BASE_URL;
    this.apiKey = config?.apiKey || process.env.COINRAILZ_API_KEY;
  }

  async callService(request: PaymentRequest): Promise<PaymentResponse> {
    const { serviceId, payload, walletAddress } = request;

    try {
      const endpoint = `${this.baseUrl}/x402/${serviceId}`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }
      
      try {
        const response = await axios.post(endpoint, payload, { headers });
        
        return {
          success: true,
          serviceResponse: response.data
        };
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 402) {
          const paymentDetails = error.response.data;
          
          if (this.apiKey) {
            console.log(`💳 Insufficient credits for ${serviceId}. Please top up your account.`);
          } else {
            console.log(`💳 Payment required for ${serviceId}:`, paymentDetails);
            console.log(`ℹ️  Option 1 (Recommended): Use prepaid credits`);
            console.log(`   1. Buy credits at ${this.baseUrl}/credits`);
            console.log(`   2. Generate an API key at ${this.baseUrl}/api-keys`);
            console.log(`   3. Initialize client with: new X402Client({ apiKey: 'your-key' })`);
            console.log(`ℹ️  Option 2 (Legacy): Pay with USDC`);
            console.log(`   1. Send ${paymentDetails.accepts[0].maxAmountRequired / 10000} USDC to ${PLATFORM_WALLET}`);
            console.log(`   2. Include transaction hash in X-PAYMENT header`);
            console.log(`   3. Retry the request`);
          }
          
          return {
            success: false,
            error: 'PAYMENT_REQUIRED',
            serviceResponse: paymentDetails
          };
        }
        throw error;
      }
    } catch (error) {
      const err = error as AxiosError;
      return {
        success: false,
        error: err.message || 'Unknown error occurred'
      };
    }
  }

  async callServiceWithPayment(
    request: PaymentRequest, 
    transactionHash: string
  ): Promise<PaymentResponse> {
    const { serviceId, payload } = request;

    try {
      const endpoint = `${this.baseUrl}/x402/${serviceId}`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-PAYMENT': transactionHash
      };

      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }
      
      const response = await axios.post(endpoint, payload, { headers });
      
      return {
        success: true,
        transactionHash,
        serviceResponse: response.data
      };
    } catch (error) {
      const err = error as AxiosError;
      return {
        success: false,
        transactionHash,
        error: err.response?.data || err.message
      };
    }
  }

  async verifyPayment(transactionHash: string): Promise<boolean> {
    try {
      // This would verify the transaction on Base mainnet
      // For now, we return true if tx hash looks valid
      return transactionHash.startsWith('0x') && transactionHash.length === 66;
    } catch (error) {
      return false;
    }
  }
}
