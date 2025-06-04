import { env } from "../environment";

export interface NOWPaymentsPayment {
  id: string;
  payment_id: string;
  payment_status: string;
  pay_address: string;
  pay_amount: number;
  pay_currency: string;
  price_amount: number;
  price_currency: string;
  order_id?: string;
  order_description?: string;
  purchase_id?: string;
  outcome_amount?: number;
  outcome_currency?: string;
}

export interface CreatePaymentRequest {
  price_amount: number;
  price_currency: string;
  pay_currency: string;
  order_id?: string;
  order_description?: string;
  success_url?: string;
  cancel_url?: string;
  partially_paid_url?: string;
  is_fixed_rate?: boolean;
  is_fee_paid_by_user?: boolean;
}

export interface DonationRequest {
  agentId: string;
  amount: number;
  currency: string;
  donorMessage?: string;
  targetWallet: 'ethereum' | 'solana';
}

export class NOWPaymentsService {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.nowpayments.io/v1';
  
  // Your specified wallet addresses for fee collection
  private readonly ETHEREUM_WALLET = "0x4dB56acDA064eab99BbC9F2AD1021Cd5d126C321";
  private readonly SOLANA_WALLET = "9Ev8LhxWLMxjtfEWkGuZRmg3w8Vokfh7Uk9L7UZ3mhA5";

  constructor() {
    if (!process.env.NOWPAYMENTS_API_KEY) {
      throw new Error('NOWPAYMENTS_API_KEY environment variable is required');
    }
    this.apiKey = process.env.NOWPAYMENTS_API_KEY;
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`NOWPayments API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  async getAvailableCurrencies(): Promise<string[]> {
    const response = await this.makeRequest('/currencies');
    return response.currencies;
  }

  async getSelectedCurrencies(): Promise<string[]> {
    const response = await this.makeRequest('/merchant/coins');
    return response.selectedCurrencies;
  }

  async getExchangeRate(fromCurrency: string, toCurrency: string): Promise<number> {
    const response = await this.makeRequest(`/exchange-amount/${fromCurrency}-${toCurrency}?from_amount=1`);
    return response.estimated_amount;
  }

  async createDonationPayment(request: DonationRequest): Promise<NOWPaymentsPayment> {
    // Determine target wallet based on currency or user preference
    const targetWallet = this.getTargetWallet(request.currency, request.targetWallet);
    
    const paymentRequest: CreatePaymentRequest = {
      price_amount: request.amount,
      price_currency: 'USD', // Base currency for pricing
      pay_currency: request.currency.toUpperCase(),
      order_id: `donation-${request.agentId}-${Date.now()}`,
      order_description: `Donation to AI Agent ${request.agentId}${request.donorMessage ? `: ${request.donorMessage}` : ''}`,
      is_fixed_rate: true,
      is_fee_paid_by_user: true,
    };

    const response = await this.makeRequest('/payment', {
      method: 'POST',
      body: JSON.stringify(paymentRequest),
    });

    return response;
  }

  async createDirectDonation(request: DonationRequest): Promise<{ paymentUrl: string; qrCode: string }> {
    // Create direct payment to your specified wallets
    const targetWallet = this.getTargetWallet(request.currency, request.targetWallet);
    
    const paymentRequest = {
      price_amount: request.amount,
      price_currency: 'USD',
      pay_currency: request.currency.toUpperCase(),
      pay_address: targetWallet, // Direct to your wallet
      order_id: `direct-donation-${request.agentId}-${Date.now()}`,
      order_description: `Direct donation to AI Agent ${request.agentId}`,
      is_fixed_rate: true,
    };

    const response = await this.makeRequest('/payment', {
      method: 'POST',
      body: JSON.stringify(paymentRequest),
    });

    // Generate QR code for mobile payments
    const qrCode = await this.generateQRCode(response.pay_address, response.pay_amount, request.currency);

    return {
      paymentUrl: `https://nowpayments.io/payment/?iid=${response.id}`,
      qrCode,
    };
  }

  async getPaymentStatus(paymentId: string): Promise<NOWPaymentsPayment> {
    return this.makeRequest(`/payment/${paymentId}`);
  }

  async getPaymentHistory(limit: number = 50): Promise<NOWPaymentsPayment[]> {
    const response = await this.makeRequest(`/payment/?limit=${limit}&sortBy=created_at&orderBy=desc`);
    return response.data || [];
  }

  async verifyWebhook(payload: string, signature: string): Promise<boolean> {
    // Implement webhook signature verification for security
    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha512', process.env.NOWPAYMENTS_IPN_SECRET || '');
    hmac.update(payload);
    const hash = hmac.digest('hex');
    return hash === signature;
  }

  private getTargetWallet(currency: string, preference: 'ethereum' | 'solana'): string {
    const ethereumCurrencies = ['ETH', 'USDT', 'USDC', 'BTC', 'LINK', 'UNI', 'AAVE'];
    const solanaCurrencies = ['SOL', 'USDTSOL', 'USDCSOL'];

    if (preference === 'solana' || solanaCurrencies.includes(currency.toUpperCase())) {
      return this.SOLANA_WALLET;
    }
    
    return this.ETHEREUM_WALLET; // Default to Ethereum wallet
  }

  private async generateQRCode(address: string, amount: number, currency: string): Promise<string> {
    // Generate payment URI for QR code
    const paymentUri = currency.toLowerCase() === 'btc' 
      ? `bitcoin:${address}?amount=${amount}`
      : `${currency.toLowerCase()}:${address}?value=${amount}`;
    
    // Return base64 QR code (you can implement actual QR generation)
    return `data:image/png;base64,QR_CODE_FOR_${paymentUri}`;
  }

  // Mass payout functionality for revenue sharing
  async createMassPayout(payouts: Array<{ address: string; currency: string; amount: number; }>) {
    const payoutRequest = {
      withdrawals: payouts.map(payout => ({
        address: payout.address,
        currency: payout.currency.toUpperCase(),
        amount: payout.amount,
        fiat_equivalent: payout.amount, // Assuming USD
        fee: 'included', // Platform pays fees
      })),
    };

    return this.makeRequest('/payout', {
      method: 'POST',
      body: JSON.stringify(payoutRequest),
    });
  }
}

export const nowPaymentsService = new NOWPaymentsService();