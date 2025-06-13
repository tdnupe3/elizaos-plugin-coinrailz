/**
 * AI Agent Payment Service
 * Handles payments to AI agents with multiple payment options including XRP
 */

import { KelloggHoldingsRevenueService } from './kelloggHoldingsRevenue';

export interface PaymentOption {
  method: 'xrp' | 'stripe' | 'paypal' | 'crypto';
  address?: string;
  accountId?: string;
  currency: string;
}

export interface AgentPaymentRequest {
  agentId: string;
  serviceType: string;
  totalAmount: number;
  currency: string;
  customerPaymentMethod: string;
  agentPaymentPreference: PaymentOption;
}

export class AIAgentPaymentService {
  
  /**
   * Process complete AI agent marketplace transaction
   * Customer pays → Platform takes fee → Agent receives payment
   */
  static async processMarketplaceTransaction(request: AgentPaymentRequest): Promise<{
    success: boolean;
    agentPayment?: {
      amount: number;
      currency: string;
      method: string;
      transactionId: string;
      estimatedDelivery: string;
    };
    platformFee?: {
      amount: number;
      kelloggHoldingsRevenue: number;
    };
    error?: string;
  }> {
    try {
      console.log('Processing AI Agent Marketplace Transaction:', {
        agentId: request.agentId,
        serviceType: request.serviceType,
        totalAmount: request.totalAmount,
        currency: request.currency
      });

      // Step 1: Calculate platform fee and agent payment
      const result = await KelloggHoldingsRevenueService.processAIAgentCommission(
        request.agentId,
        request.totalAmount,
        request.serviceType,
        request.currency
      );

      if (!result.success) {
        throw new Error('Failed to process commission calculation');
      }

      // Step 2: Process payment to agent based on their preference
      const agentPayment = await this.payAgent(
        request.agentId,
        result.agentRevenue,
        request.currency,
        request.agentPaymentPreference
      );

      return {
        success: true,
        agentPayment,
        platformFee: {
          amount: result.kelloggRevenue,
          kelloggHoldingsRevenue: result.kelloggRevenue
        }
      };

    } catch (error: any) {
      console.error('Marketplace transaction processing failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Pay agent using their preferred payment method
   */
  private static async payAgent(
    agentId: string,
    amount: number,
    currency: string,
    paymentPreference: PaymentOption
  ): Promise<{
    amount: number;
    currency: string;
    method: string;
    transactionId: string;
    estimatedDelivery: string;
  }> {
    
    const transactionId = `AGENT_PAY_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
    
    switch (paymentPreference.method) {
      case 'xrp':
        return this.payAgentXRP(agentId, amount, currency, paymentPreference, transactionId);
        
      case 'stripe':
        return this.payAgentStripe(agentId, amount, currency, paymentPreference, transactionId);
        
      case 'paypal':
        return this.payAgentPayPal(agentId, amount, currency, paymentPreference, transactionId);
        
      case 'crypto':
        return this.payAgentCrypto(agentId, amount, currency, paymentPreference, transactionId);
        
      default:
        throw new Error(`Unsupported payment method: ${paymentPreference.method}`);
    }
  }

  /**
   * Pay agent via XRP (fastest, lowest cost)
   */
  private static async payAgentXRP(
    agentId: string,
    amount: number,
    currency: string,
    paymentPreference: PaymentOption,
    transactionId: string
  ): Promise<{
    amount: number;
    currency: string;
    method: string;
    transactionId: string;
    estimatedDelivery: string;
  }> {
    
    // Convert to XRP if needed (simplified - in production would use real exchange rates)
    const xrpAmount = currency === 'USD' ? amount / 0.50 : amount; // Assuming $0.50 per XRP
    
    console.log(`XRP Payment to Agent ${agentId}:`, {
      destinationAddress: paymentPreference.address,
      amount: xrpAmount,
      currency: 'XRP',
      transactionId,
      deliveryTime: '3-5 seconds'
    });
    
    // In production, this would execute actual XRP transaction
    // using xrpl library to send payment to agent's XRP address
    
    return {
      amount: xrpAmount,
      currency: 'XRP',
      method: 'XRP Ledger',
      transactionId,
      estimatedDelivery: '3-5 seconds'
    };
  }

  /**
   * Pay agent via Stripe Connect
   */
  private static async payAgentStripe(
    agentId: string,
    amount: number,
    currency: string,
    paymentPreference: PaymentOption,
    transactionId: string
  ): Promise<{
    amount: number;
    currency: string;
    method: string;
    transactionId: string;
    estimatedDelivery: string;
  }> {
    
    console.log(`Stripe Payment to Agent ${agentId}:`, {
      connectedAccountId: paymentPreference.accountId,
      amount,
      currency,
      transactionId
    });
    
    // In production, this would use Stripe Connect to transfer funds
    // to agent's connected Stripe account
    
    return {
      amount,
      currency: currency.toUpperCase(),
      method: 'Stripe Connect',
      transactionId,
      estimatedDelivery: '1-2 business days'
    };
  }

  /**
   * Pay agent via PayPal
   */
  private static async payAgentPayPal(
    agentId: string,
    amount: number,
    currency: string,
    paymentPreference: PaymentOption,
    transactionId: string
  ): Promise<{
    amount: number;
    currency: string;
    method: string;
    transactionId: string;
    estimatedDelivery: string;
  }> {
    
    console.log(`PayPal Payment to Agent ${agentId}:`, {
      paypalEmail: paymentPreference.accountId,
      amount,
      currency,
      transactionId
    });
    
    // In production, this would use PayPal Payouts API
    
    return {
      amount,
      currency: currency.toUpperCase(),
      method: 'PayPal',
      transactionId,
      estimatedDelivery: '1-3 business days'
    };
  }

  /**
   * Pay agent via cryptocurrency
   */
  private static async payAgentCrypto(
    agentId: string,
    amount: number,
    currency: string,
    paymentPreference: PaymentOption,
    transactionId: string
  ): Promise<{
    amount: number;
    currency: string;
    method: string;
    transactionId: string;
    estimatedDelivery: string;
  }> {
    
    console.log(`Crypto Payment to Agent ${agentId}:`, {
      cryptoAddress: paymentPreference.address,
      amount,
      currency: paymentPreference.currency,
      transactionId
    });
    
    // In production, this would execute crypto transaction
    // to agent's specified wallet address
    
    return {
      amount,
      currency: paymentPreference.currency,
      method: `${paymentPreference.currency} Transfer`,
      transactionId,
      estimatedDelivery: '5-30 minutes'
    };
  }

  /**
   * Get supported payment methods for agents
   */
  static getSupportedPaymentMethods(): PaymentOption[] {
    return [
      {
        method: 'xrp',
        currency: 'XRP',
        // address will be provided by agent
      },
      {
        method: 'stripe',
        currency: 'USD',
        // accountId will be agent's Stripe Connect account
      },
      {
        method: 'paypal',
        currency: 'USD',
        // accountId will be agent's PayPal email
      },
      {
        method: 'crypto',
        currency: 'BTC',
        // address will be agent's BTC wallet
      },
      {
        method: 'crypto',
        currency: 'ETH',
        // address will be agent's ETH wallet
      },
      {
        method: 'crypto',
        currency: 'USDC',
        // address will be agent's USDC wallet
      }
    ];
  }

  /**
   * Validate agent payment preferences
   */
  static validatePaymentPreference(preference: PaymentOption): { valid: boolean; error?: string } {
    const supportedMethods = this.getSupportedPaymentMethods();
    
    const isSupported = supportedMethods.some(method => 
      method.method === preference.method && 
      method.currency === preference.currency
    );
    
    if (!isSupported) {
      return {
        valid: false,
        error: `Unsupported payment method: ${preference.method} with ${preference.currency}`
      };
    }
    
    // Validate required fields based on payment method
    if ((preference.method === 'xrp' || preference.method === 'crypto') && !preference.address) {
      return {
        valid: false,
        error: `${preference.method.toUpperCase()} payment requires wallet address`
      };
    }
    
    if ((preference.method === 'stripe' || preference.method === 'paypal') && !preference.accountId) {
      return {
        valid: false,
        error: `${preference.method} payment requires account ID`
      };
    }
    
    return { valid: true };
  }
}