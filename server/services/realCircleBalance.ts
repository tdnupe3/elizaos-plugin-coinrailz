/**
 * Real Circle Balance Checker - Using Production API Keys
 * Locates the actual missing $50 USDC using authentic Circle API
 */

import fetch from 'node-fetch';

interface CircleApiResponse {
  data?: { balances?: unknown[] } | unknown[];
  [key: string]: unknown;
}

export class RealCircleBalanceChecker {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.CIRCLE_API_KEY || '';
    this.baseUrl = 'https://api.circle.com/v1';
    
    if (!this.apiKey) {
      throw new Error('Circle API key not found in environment');
    }
  }

  /**
   * Check real wallet balance using Circle API
   */
  async checkRealWalletBalance(walletId: string) {
    try {
      const response = await fetch(`${this.baseUrl}/wallets/${walletId}/balances`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      const data = await response.json() as CircleApiResponse;
      
      if (!response.ok) {
        console.error('Circle API Error:', data);
        return { error: data, status: response.status };
      }

      return {
        success: true,
        balances: Array.isArray(data.data) ? data.data : data.data?.balances ?? [],
        raw: data
      };
    } catch (error) {
      console.error('Circle API request failed:', error);
        return { error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Get wallet transaction history
   */
  async getWalletTransactions(walletId: string) {
    try {
      const response = await fetch(`${this.baseUrl}/wallets/${walletId}/transactions`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      const data = await response.json() as CircleApiResponse;
      
      if (!response.ok) {
        console.error('Circle Transactions API Error:', data);
        return { error: data, status: response.status };
      }

      return {
        success: true,
        transactions: Array.isArray(data.data) ? data.data : [],
        raw: data
      };
    } catch (error) {
      console.error('Circle transactions request failed:', error);
        return { error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Locate missing $50 USDC for a1digital account
   */
  async locateMissingFiftyUSDC() {
    const walletId = '540d451e-d4b5-5abc-9f29-7a41214d37e0';
    const email = 'a1digitalllc@gmail.com';
    
    console.log(`🔍 Searching for real $50 USDC for ${email}`);
    console.log(`Wallet ID: ${walletId}`);
    
    // Check real balance
    const balanceResult = await this.checkRealWalletBalance(walletId);
    console.log('Real Circle Balance Result:', JSON.stringify(balanceResult, null, 2));
    
    // Check transaction history
    const transactionsResult = await this.getWalletTransactions(walletId);
    console.log('Circle Transactions Result:', JSON.stringify(transactionsResult, null, 2));
    
    // Look for $50 transactions
    if (transactionsResult.success && transactionsResult.transactions) {
      const fiftyDollarTxs = transactionsResult.transactions.filter((tx): tx is { amount: string } =>
        typeof tx === 'object' && tx !== null && 'amount' in tx && typeof tx.amount === 'string' && (
          parseFloat(tx.amount) === 50.0 ||
          tx.amount.includes('50') ||
          parseFloat(tx.amount) === 50
        )
      );
      
      console.log('Found $50 transactions:', fiftyDollarTxs);
      
      return {
        realBalance: balanceResult,
        transactions: transactionsResult,
        fiftyDollarTransactions: fiftyDollarTxs,
        walletId,
        email
      };
    }
    
    return {
      realBalance: balanceResult,
      transactions: transactionsResult,
      fiftyDollarTransactions: [],
      walletId,
      email
    };
  }
}

export const realCircleBalanceChecker = new RealCircleBalanceChecker();