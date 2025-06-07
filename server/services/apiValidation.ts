/**
 * API Key Validation and External Service Testing
 * Validates all production APIs and provides health check endpoints
 */

import fetch from 'node-fetch';

export interface APIHealthCheck {
  service: string;
  status: 'healthy' | 'degraded' | 'error';
  responseTime: number;
  error?: string;
}

export class APIValidationService {
  /**
   * Test NOWPayments API connection and authentication
   */
  static async testNOWPaymentsAPI(): Promise<APIHealthCheck> {
    const startTime = Date.now();
    
    try {
      const response = await fetch('https://api.nowpayments.io/v1/status', {
        method: 'GET',
        headers: {
          'x-api-key': process.env.NOWPAYMENTS_API_KEY!,
          'Content-Type': 'application/json',
        },
      });

      const responseTime = Date.now() - startTime;

      if (response.ok) {
        const data = await response.json();
        return {
          service: 'NOWPayments',
          status: 'healthy',
          responseTime,
        };
      } else {
        return {
          service: 'NOWPayments',
          status: 'error',
          responseTime,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }
    } catch (error) {
      return {
        service: 'NOWPayments',
        status: 'error',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Test CoinGecko API connection
   */
  static async testCoinGeckoAPI(): Promise<APIHealthCheck> {
    const startTime = Date.now();
    
    try {
      const response = await fetch('https://api.coingecko.com/api/v3/ping', {
        method: 'GET',
        headers: {
          'x-cg-demo-api-key': process.env.COINGECKO_API_KEY!,
          'Content-Type': 'application/json',
        },
      });

      const responseTime = Date.now() - startTime;

      if (response.ok) {
        return {
          service: 'CoinGecko',
          status: 'healthy',
          responseTime,
        };
      } else {
        return {
          service: 'CoinGecko',
          status: 'error',
          responseTime,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }
    } catch (error) {
      return {
        service: 'CoinGecko',
        status: 'error',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Test ChangeNOW API connection
   */
  static async testChangeNOWAPI(): Promise<APIHealthCheck> {
    const startTime = Date.now();
    
    try {
      const response = await fetch('https://api.changenow.io/v1/currencies?active=true', {
        method: 'GET',
        headers: {
          'x-changenow-api-key': process.env.CHANGENOW_API_KEY!,
          'Content-Type': 'application/json',
        },
      });

      const responseTime = Date.now() - startTime;

      if (response.ok) {
        return {
          service: 'ChangeNOW',
          status: 'healthy',
          responseTime,
        };
      } else {
        return {
          service: 'ChangeNOW',
          status: 'error',
          responseTime,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }
    } catch (error) {
      return {
        service: 'ChangeNOW',
        status: 'error',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Test Stripe API connection
   */
  static async testStripeAPI(): Promise<APIHealthCheck> {
    const startTime = Date.now();
    
    try {
      const Stripe = require('stripe');
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      
      // Test with a simple account retrieval
      await stripe.accounts.list({ limit: 1 });
      
      const responseTime = Date.now() - startTime;
      
      return {
        service: 'Stripe',
        status: 'healthy',
        responseTime,
      };
    } catch (error) {
      return {
        service: 'Stripe',
        status: 'error',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Run comprehensive API health check
   */
  static async runFullHealthCheck(): Promise<APIHealthCheck[]> {
    const checks = await Promise.all([
      this.testNOWPaymentsAPI(),
      this.testCoinGeckoAPI(),
      this.testChangeNOWAPI(),
      this.testStripeAPI(),
    ]);

    return checks;
  }

  /**
   * Get real-time cryptocurrency prices from CoinGecko
   */
  static async getCryptoPrices(coinIds: string[]): Promise<any> {
    try {
      const idsParam = coinIds.join(',');
      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${idsParam}&vs_currencies=usd&include_24hr_change=true`,
        {
          headers: {
            'x-cg-demo-api-key': process.env.COINGECKO_API_KEY!,
          },
        }
      );

      if (response.ok) {
        return await response.json();
      } else {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }
    } catch (error) {
      console.error('Error fetching crypto prices:', error);
      throw error;
    }
  }

  /**
   * Create NOWPayments payment for crypto processing
   */
  static async createNOWPayment(params: {
    price_amount: number;
    price_currency: string;
    pay_currency: string;
    order_id: string;
    order_description: string;
  }): Promise<any> {
    try {
      const response = await fetch('https://api.nowpayments.io/v1/payment', {
        method: 'POST',
        headers: {
          'x-api-key': process.env.NOWPAYMENTS_API_KEY!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      if (response.ok) {
        return await response.json();
      } else {
        const errorData = await response.text();
        throw new Error(`NOWPayments API error: ${response.status} - ${errorData}`);
      }
    } catch (error) {
      console.error('Error creating NOWPayments payment:', error);
      throw error;
    }
  }

  /**
   * Get exchange estimate from ChangeNOW
   */
  static async getExchangeEstimate(params: {
    from: string;
    to: string;
    amount: number;
  }): Promise<any> {
    try {
      const response = await fetch(
        `https://api.changenow.io/v1/exchange-amount/${params.amount}/${params.from}_${params.to}`,
        {
          headers: {
            'x-changenow-api-key': process.env.CHANGENOW_API_KEY!,
          },
        }
      );

      if (response.ok) {
        return await response.json();
      } else {
        const errorData = await response.text();
        throw new Error(`ChangeNOW API error: ${response.status} - ${errorData}`);
      }
    } catch (error) {
      console.error('Error getting exchange estimate:', error);
      throw error;
    }
  }
}