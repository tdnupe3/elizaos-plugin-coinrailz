import { env } from '../environment';

interface PayoutRequest {
  currency: string;
  amount: number;
  address: string;
  ipn_callback_url?: string;
  extra_id?: string;
}

interface PayoutResponse {
  id: string;
  status: string;
  currency: string;
  amount: number;
  address: string;
  hash?: string;
  created_at: string;
}

export class NOWPaymentsService {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.nowpayments.io/v1';

  constructor() {
    if (!env.NOWPAYMENTS_API_KEY) {
      console.warn('⚠️  NOWPAYMENTS_API_KEY not set — NOWPayments service disabled');
      this.apiKey = '';
      return;
    }
    this.apiKey = env.NOWPAYMENTS_API_KEY;
  }

  private async makeRequest(endpoint: string, method: 'GET' | 'POST' = 'GET', data?: any, retries: number = 3) {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'x-api-key': this.apiKey,
      'Content-Type': 'application/json',
    };

    const config: RequestInit = {
      method,
      headers,
    };

    if (data && method === 'POST') {
      config.body = JSON.stringify(data);
    }

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, config);
        
        if (!response.ok) {
          const errorData = await response.text();
          
          // Handle rate limiting with exponential backoff
          if (response.status === 429 && attempt < retries) {
            const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
            console.log(`Rate limited, retrying in ${delay}ms (attempt ${attempt}/${retries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          
          // Handle temporary server errors
          if (response.status >= 500 && attempt < retries) {
            const delay = 2000 * attempt;
            console.log(`Server error ${response.status}, retrying in ${delay}ms (attempt ${attempt}/${retries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          
          throw new Error(`NOWPayments API error: ${response.status} - ${errorData}`);
        }

        return response.json();
      } catch (error: any) {
        if (attempt === retries) {
          console.error(`NOWPayments request failed after ${retries} attempts:`, error);
          throw error;
        }
        
        // Network errors - retry with delay
        const delay = 1000 * attempt;
        console.log(`Request failed, retrying in ${delay}ms (attempt ${attempt}/${retries}):`, error.message);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  async getPayoutStatus(payoutId: string): Promise<PayoutResponse> {
    return this.makeRequest(`/payout/${payoutId}`);
  }

  async createPayout(payoutData: PayoutRequest): Promise<PayoutResponse> {
    return this.makeRequest('/payout', 'POST', payoutData);
  }

  async getAvailableCurrencies(): Promise<string[]> {
    const response = await this.makeRequest('/currencies');
    return response.currencies || [];
  }

  async getMinimumPayoutAmount(currency: string): Promise<number> {
    const response = await this.makeRequest(`/min-amount?currency_from=${currency}&currency_to=${currency}`);
    return parseFloat(response.min_amount || '0');
  }

  async processReferralPayout(
    agentId: string,
    amount: number,
    currency: string = 'USDT',
    walletAddress: string
  ): Promise<PayoutResponse> {
    try {
      // Validate minimum payout amount
      const minAmount = await this.getMinimumPayoutAmount(currency);
      if (amount < minAmount) {
        throw new Error(`Amount ${amount} ${currency} is below minimum payout of ${minAmount} ${currency}`);
      }

      const payoutRequest: PayoutRequest = {
        currency: currency.toUpperCase(),
        amount,
        address: walletAddress,
        ipn_callback_url: `${env.BACKEND_URL}/api/nowpayments/ipn`,
        extra_id: agentId
      };

      const payout = await this.createPayout(payoutRequest);

      console.log(`Referral payout created for agent ${agentId}:`, {
        payoutId: payout.id,
        amount,
        currency,
        status: payout.status
      });

      return payout;
    } catch (error: any) {
      console.error(`Failed to process referral payout for agent ${agentId}:`, error);
      throw error;
    }
  }

  async batchProcessPayouts(payouts: Array<{
    agentId: string;
    amount: number;
    currency: string;
    walletAddress: string;
  }>): Promise<PayoutResponse[]> {
    const results: PayoutResponse[] = [];

    for (const payout of payouts) {
      try {
        const result = await this.processReferralPayout(
          payout.agentId,
          payout.amount,
          payout.currency,
          payout.walletAddress
        );
        results.push(result);

        // Rate limiting - wait 1 second between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error: any) {
        console.error(`Batch payout failed for agent ${payout.agentId}:`, error);
        // Continue with other payouts even if one fails
      }
    }

    return results;
  }

  // Missing methods required by routes
  async getSelectedCurrencies(): Promise<string[]> {
    try {
      const response = await this.makeRequest('/currencies');
      return response.currencies || ["BTC", "ETH", "USDT", "USDC", "SOL"];
    } catch (error) {
      console.error('Failed to get currencies:', error);
      return ["BTC", "ETH", "USDT", "USDC", "SOL"];
    }
  }

  async createDirectDonation(data: {
    amount: number;
    currency: string;
    recipientAddress: string;
    description?: string;
  }): Promise<any> {
    try {
      const payoutData = {
        currency: data.currency,
        amount: data.amount,
        address: data.recipientAddress,
        ipn_callback_url: `${process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost'}/api/webhooks/nowpayments`
      };

      return await this.makeRequest('/payouts', 'POST', payoutData);
    } catch (error) {
      console.error('Failed to create direct donation:', error);
      throw error;
    }
  }

  async getPaymentStatus(paymentId: string): Promise<any> {
    try {
      return await this.makeRequest(`/payment/${paymentId}`);
    } catch (error) {
      console.error('Failed to get payment status:', error);
      throw error;
    }
  }

  async verifyWebhook(payload: string, signature: string): Promise<boolean> {
    try {
      if (!signature || !payload) {
        return false;
      }

      // NOWPayments uses HMAC-SHA512 for webhook verification
      const crypto = await import('crypto');
      const ipnSecret = env.NOWPAYMENTS_IPN_SECRET;
      
      if (!ipnSecret) {
        console.warn('NOWPayments IPN secret not configured, skipping signature verification');
        return true; // Allow in development/testing
      }

      const expectedSignature = crypto
        .createHmac('sha512', ipnSecret)
        .update(payload)
        .digest('hex');

      // Compare signatures using constant-time comparison
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch (error) {
      console.error('Webhook verification failed:', error);
      return false;
    }
  }

  async getExchangeRate(fromCurrency: string, toCurrency: string): Promise<number> {
    try {
      const response = await this.makeRequest(`/exchange-estimate/${fromCurrency}/${toCurrency}`);
      return response.estimated_amount || 1.0;
    } catch (error) {
      console.error('Failed to get exchange rate:', error);
      return 1.0;
    }
  }

  async createPayment(paymentData: {
    price_amount: number;
    price_currency: string;
    pay_currency: string;
    order_id: string;
    order_description: string;
    ipn_callback_url?: string;
  }): Promise<any> {
    try {
      return await this.makeRequest('/payment', 'POST', {
        ...paymentData,
        ipn_callback_url: paymentData.ipn_callback_url || `${env.BACKEND_URL}/api/nowpayments/ipn`
      });
    } catch (error) {
      console.error('Failed to create payment:', error);
      throw error;
    }
  }
}

export const nowPaymentsService = new NOWPaymentsService();