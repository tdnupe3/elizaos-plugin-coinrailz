import axios, { AxiosError } from 'axios';
import type { PaymentRequest, PaymentResponse } from '../types';

const COIN_RAILZ_BASE_URL = process.env.COIN_RAILZ_URL || 'https://coinrailz.com';
const PLATFORM_WALLET = '0x4dB56acDA064eab99BbC9F2AD1021Cd5d126C321';

export class X402Client {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || COIN_RAILZ_BASE_URL;
  }

  async callService(request: PaymentRequest): Promise<PaymentResponse> {
    const { serviceId, payload, walletAddress } = request;

    try {
      // Step 1: Try to call service without payment (will get 402)
      const endpoint = `${this.baseUrl}/x402/${serviceId}`;
      
      try {
        const response = await axios.post(endpoint, payload, {
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        // If we got here, service was free or payment already made
        return {
          success: true,
          serviceResponse: response.data
        };
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 402) {
          // Payment required - extract payment details
          const paymentDetails = error.response.data;
          
          console.log(`💳 Payment required for ${serviceId}:`, paymentDetails);
          console.log(`ℹ️  To pay:`);
          console.log(`   1. Send ${paymentDetails.accepts[0].maxAmountRequired / 10000} USDC to ${PLATFORM_WALLET}`);
          console.log(`   2. Include transaction hash in X-PAYMENT header`);
          console.log(`   3. Retry the request`);
          
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
      
      const response = await axios.post(endpoint, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-PAYMENT': transactionHash
        }
      });
      
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
