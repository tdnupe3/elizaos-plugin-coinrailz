/**
 * @coinrailz/agent-payments - Easy AI Agent Payment Integration
 * 
 * Production-ready payment system for AI agents using Circle USDC + Coinbase CDP
 * Competitive 0.99%-1.75% fees vs 2.9% Stripe rates
 */

export interface PaymentConfig {
  apiKey: string; // Your CoinRailz API key (not Circle/CDP keys!)
  webhookUrl?: string;
  baseUrl?: string;
}

export interface PaymentRequest {
  amount: number; // USD amount
  agentId: string;
  serviceDescription: string;
  customerWalletAddress?: string;
  pricingTier?: 'early_adopter' | 'standard' | 'volume' | 'enterprise'; // NEW: Pricing tier selection
}

export interface PaymentResponse {
  success: boolean;
  paymentId: string;
  walletAddress: string;
  amount: number;
  platformFee: number; // NEW: Show actual fee charged
  feeRate: string; // NEW: Show fee percentage (e.g., "1.75% + $0.10")
  netAmount: number; // NEW: Amount after fees
  status: 'pending' | 'completed' | 'failed';
  transactionHash?: string;
}

export interface AgentEarnings {
  totalEarnings: number;
  platformFee: number;
  netEarnings: number;
  transactionCount: number;
}

export class CoinRailzAgentPayments {
  private config: PaymentConfig;
  private baseUrl: string;

  constructor(config: PaymentConfig, baseUrl = 'https://coinrailz.com') {
    this.config = config;
    this.baseUrl = config.baseUrl || baseUrl;
  }

  /**
   * Create a payment request for an AI agent service
   * Returns wallet address for customer to send USDC
   */
  async createPayment(request: PaymentRequest): Promise<PaymentResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/agent-payments/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.config.apiKey
        },
        body: JSON.stringify({
          ...request,
          webhookUrl: this.config.webhookUrl
        })
      });

      if (!response.ok) {
        throw new Error(`Payment creation failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Payment creation failed: ${error}`);
    }
  }

  /**
   * Check payment status
   */
  async checkPaymentStatus(paymentId: string): Promise<PaymentResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/agent-payments/status/${paymentId}`, {
        method: 'GET',
        headers: {
          'X-API-Key': this.config.apiKey
        }
      });

      if (!response.ok) {
        throw new Error(`Status check failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Status check failed: ${error}`);
    }
  }

  /**
   * Get agent earnings summary
   */
  async getAgentEarnings(agentId: string): Promise<AgentEarnings> {
    try {
      const response = await fetch(`${this.baseUrl}/api/agent-payments/earnings/${agentId}`, {
        method: 'GET',
        headers: {
          'X-API-Key': this.config.apiKey
        }
      });

      if (!response.ok) {
        throw new Error(`Earnings fetch failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Earnings fetch failed: ${error}`);
    }
  }

  /**
   * Withdraw agent earnings to external wallet
   */
  async withdrawEarnings(agentId: string, toAddress: string, amount: number): Promise<PaymentResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/agent-payments/withdraw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.config.apiKey
        },
        body: JSON.stringify({
          agentId,
          toAddress,
          amount
        })
      });

      if (!response.ok) {
        throw new Error(`Withdrawal failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Withdrawal failed: ${error}`);
    }
  }

  /**
   * Enable webhook notifications for payment events
   */
  async enableWebhooks(webhookUrl: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/agent-payments/webhooks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.config.apiKey
        },
        body: JSON.stringify({
          webhookUrl
        })
      });

      return response.ok;
    } catch (error) {
      console.error('Webhook setup failed:', error);
      return false;
    }
  }
}

/**
 * Quick setup function for easy integration
 */
export function createAgentPayments(config: PaymentConfig): CoinRailzAgentPayments {
  return new CoinRailzAgentPayments(config);
}

/**
 * Example usage:
 * 
 * ```typescript
 * import { createAgentPayments } from '@coinrailz/agent-payments';
 * 
 * const payments = createAgentPayments({
 *   apiKey: process.env.COINRAILZ_API_KEY!, // Your CoinRailz API key
 *   webhookUrl: 'https://myagent.com/payments/webhook'
 * });
 * 
 * // Create a payment for your AI service
 * const payment = await payments.createPayment({
 *   amount: 25.00,
 *   agentId: 'my-ai-agent-v1',
 *   serviceDescription: 'AI data analysis and report generation',
 *   customerWalletAddress: '0x...' // optional
 * });
 * 
 * console.log(`Payment created! Send USDC to: ${payment.walletAddress}`);
 * console.log(`Payment ID: ${payment.paymentId}`);
 * 
 * // Check payment status
 * const status = await payments.checkPaymentStatus(payment.paymentId);
 * console.log(`Payment status: ${status.status}`);
 * 
 * // Get earnings
 * const earnings = await payments.getAgentEarnings('my-ai-agent-v1');
 * console.log(`Total earnings: $${earnings.totalEarnings}`);
 * console.log(`Net after fees: $${earnings.netEarnings}`);
 * 
 * // Withdraw to your wallet
 * const withdrawal = await payments.withdrawEarnings(
 *   'my-ai-agent-v1',
 *   '0x742d35Cc6577C1e8C52B1dd57F9c9C33F7Af2A8A',
 *   100.00
 * );
 * ```
 */