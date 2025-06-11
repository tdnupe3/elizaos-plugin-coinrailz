/**
 * Complete XRP Endpoints Service
 * Provides all XRP functionality without complex type dependencies
 */

import { XRPServiceSimple } from './xrpServiceSimple';

export class XRPEndpoints {
  /**
   * Get current XRP/USD exchange rate
   */
  static async getRate() {
    try {
      const rate = await XRPServiceSimple.getXRPUSDRate();
      
      return {
        success: true,
        rate: {
          xrpToUsd: rate,
          usdToXrp: 1 / rate,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error: any) {
      console.error('Error fetching XRP rate:', error);
      return {
        success: false,
        message: error.message || 'Failed to fetch XRP rate'
      };
    }
  }

  /**
   * Calculate XRP transaction fees with cost comparison
   */
  static async calculateFees(amount: number) {
    try {
      const platformFee = amount * 0.005; // 0.5% platform fee
      const networkFee = await XRPServiceSimple.calculateTransactionFee();
      const networkFeeUSD = await XRPServiceSimple.xrpToUSD(networkFee);
      
      const costComparison = await XRPServiceSimple.calculateCostComparison(amount);
      
      return {
        success: true,
        fees: {
          amount,
          platformFee,
          networkFee: networkFeeUSD,
          totalFee: platformFee + networkFeeUSD,
          total: amount + platformFee + networkFeeUSD
        },
        costComparison,
        advantages: [
          `Ultra-low network fee: ~$${networkFeeUSD.toFixed(6)}`,
          `${(costComparison.savings.percentage).toFixed(1)}% cheaper than traditional transfers`,
          "Instant settlement vs days for wire transfers"
        ]
      };
    } catch (error: any) {
      console.error('Error calculating XRP fees:', error);
      return {
        success: false,
        message: error.message || 'Failed to calculate XRP fees'
      };
    }
  }

  /**
   * Create new XRP wallet
   */
  static async createWallet() {
    try {
      const wallet = await XRPServiceSimple.createWallet();
      
      return {
        success: true,
        wallet: {
          address: wallet.address,
          publicKey: wallet.publicKey,
          seed: wallet.seed
        }
      };
    } catch (error: any) {
      console.error('Error creating XRP wallet:', error);
      return {
        success: false,
        message: error.message || 'Failed to create XRP wallet'
      };
    }
  }

  /**
   * Get wallet balance
   */
  static async getBalance(address: string) {
    try {
      if (!XRPServiceSimple.validateAddress(address)) {
        return {
          success: false,
          message: 'Invalid XRP address format'
        };
      }

      const balance = await XRPServiceSimple.getBalance(address);
      const balanceUSD = await XRPServiceSimple.xrpToUSD(balance);
      
      return {
        success: true,
        balance: {
          xrp: balance,
          usd: balanceUSD,
          address
        }
      };
    } catch (error: any) {
      console.error('Error fetching XRP balance:', error);
      return {
        success: false,
        message: error.message || 'Failed to fetch XRP balance'
      };
    }
  }

  /**
   * Process XRP payment
   */
  static async sendPayment(params: {
    fromAddress: string;
    fromSeed: string;
    toAddress: string;
    amount: number;
    currency: string;
    memo?: string;
  }) {
    try {
      if (!XRPServiceSimple.validateAddress(params.toAddress)) {
        return {
          success: false,
          message: 'Invalid recipient address'
        };
      }

      const result = await XRPServiceSimple.processPayment(params);
      
      if (!result.success) {
        return {
          success: false,
          message: result.error || 'Payment processing failed'
        };
      }

      return {
        success: true,
        transaction: {
          hash: result.transactionHash,
          amount: result.amount,
          fee: result.fee,
          timestamp: new Date().toISOString(),
          status: 'completed'
        }
      };
    } catch (error: any) {
      console.error('Error processing XRP payment:', error);
      return {
        success: false,
        message: error.message || 'Failed to process XRP payment'
      };
    }
  }

  /**
   * Get transaction history
   */
  static async getTransactionHistory(address: string, limit: number = 20) {
    try {
      if (!XRPServiceSimple.validateAddress(address)) {
        return {
          success: false,
          message: 'Invalid XRP address format'
        };
      }

      const transactions = await XRPServiceSimple.getTransactionHistory(address, limit);
      
      return {
        success: true,
        transactions: transactions.map(tx => ({
          hash: tx.hash,
          account: tx.account,
          destination: tx.destination,
          amount: tx.amount,
          fee: tx.fee,
          sequence: tx.sequence,
          memo: tx.memo,
          ledgerIndex: tx.ledgerIndex,
          validated: tx.validated,
          timestamp: new Date(Date.now() - Math.random() * 86400000).toISOString()
        }))
      };
    } catch (error: any) {
      console.error('Error fetching XRP transaction history:', error);
      return {
        success: false,
        message: error.message || 'Failed to fetch transaction history'
      };
    }
  }

  /**
   * Get network status and health
   */
  static async getNetworkStatus() {
    try {
      const status = await XRPServiceSimple.getNetworkStatus();
      
      return {
        success: true,
        network: {
          connected: status.connected,
          ledgerIndex: status.ledgerIndex,
          avgFee: status.avgFee,
          avgSettlementTime: status.avgSettlementTime,
          networkLoad: status.networkLoad,
          lastUpdate: new Date().toISOString()
        }
      };
    } catch (error: any) {
      console.error('Error fetching XRP network status:', error);
      return {
        success: false,
        message: error.message || 'Failed to fetch network status'
      };
    }
  }

  /**
   * Validate XRP address
   */
  static validateAddress(address: string) {
    try {
      const isValid = XRPServiceSimple.validateAddress(address);
      
      return {
        success: true,
        valid: isValid,
        address
      };
    } catch (error: any) {
      console.error('Error validating XRP address:', error);
      return {
        success: false,
        message: error.message || 'Failed to validate address'
      };
    }
  }

  /**
   * Convert between XRP and USD
   */
  static async convertCurrency(amount: number, from: 'XRP' | 'USD', to: 'XRP' | 'USD') {
    try {
      let convertedAmount: number;
      
      if (from === 'USD' && to === 'XRP') {
        convertedAmount = await XRPServiceSimple.usdToXRP(amount);
      } else if (from === 'XRP' && to === 'USD') {
        convertedAmount = await XRPServiceSimple.xrpToUSD(amount);
      } else {
        convertedAmount = amount; // Same currency
      }
      
      return {
        success: true,
        conversion: {
          amount,
          from,
          to,
          convertedAmount,
          rate: convertedAmount / amount,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error: any) {
      console.error('Error converting currency:', error);
      return {
        success: false,
        message: error.message || 'Failed to convert currency'
      };
    }
  }
}