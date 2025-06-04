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
      throw new Error('NOWPayments API key is required');
    }
    this.apiKey = env.NOWPAYMENTS_API_KEY;
  }

  private async makeRequest(endpoint: string, method: 'GET' | 'POST' = 'GET', data?: any) {
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

    const response = await fetch(url, config);
    
    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`NOWPayments API error: ${response.status} - ${errorData}`);
    }

    return response.json();
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
}

export const nowPaymentsService = new NOWPaymentsService();