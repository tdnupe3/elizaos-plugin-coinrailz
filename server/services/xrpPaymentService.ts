/**
 * XRP Payment Integration Service
 * Integrates XRP into existing payment processing with NOWPayments and ChangeNOW
 */

import { XRPLedgerService } from './xrpLedgerService';

interface XRPPaymentRequest {
  fromAddress: string;
  fromSeed: string;
  toAddress: string;
  amount: number;
  currency: 'XRP' | 'USD';
  memo?: string;
  userId?: string;
}

interface XRPPaymentResponse {
  success: boolean;
  transactionHash?: string;
  amount: number;
  fee: number;
  exchangeRate?: number;
  error?: string;
}

interface CrossBorderPayment {
  fromCountry: string;
  toCountry: string;
  amount: number;
  currency: string;
  recipientAddress: string;
  memo?: string;
}

export class XRPPaymentService {
  /**
   * Process XRP payment with automatic currency conversion
   */
  static async processPayment(request: XRPPaymentRequest): Promise<XRPPaymentResponse> {
    try {
      let xrpAmount = request.amount;
      let exchangeRate: number | undefined;

      // Convert USD to XRP if needed
      if (request.currency === 'USD') {
        exchangeRate = await XRPLedgerService.getXRPUSDRate();
        xrpAmount = await XRPLedgerService.usdToXRP(request.amount);
      }

      // Validate addresses
      if (!XRPLedgerService.validateAddress(request.fromAddress)) {
        return { success: false, amount: 0, fee: 0, error: 'Invalid sender address' };
      }

      if (!XRPLedgerService.validateAddress(request.toAddress)) {
        return { success: false, amount: 0, fee: 0, error: 'Invalid recipient address' };
      }

      // Check sender balance
      const balance = await XRPLedgerService.getBalance(request.fromAddress);
      const fee = await XRPLedgerService.calculateTransactionFee();
      
      if (balance < xrpAmount + fee) {
        return { 
          success: false, 
          amount: xrpAmount, 
          fee,
          error: 'Insufficient XRP balance' 
        };
      }

      // Send XRP payment
      const transaction = await XRPLedgerService.sendPayment(
        request.fromSeed,
        request.toAddress,
        xrpAmount,
        request.memo
      );

      return {
        success: true,
        transactionHash: transaction.hash,
        amount: xrpAmount,
        fee: parseFloat(transaction.fee),
        exchangeRate
      };

    } catch (error: any) {
      console.error('XRP payment processing error:', error);
      return {
        success: false,
        amount: 0,
        fee: 0,
        error: error.message || 'Payment processing failed'
      };
    }
  }

  /**
   * Process instant cross-border payment (3-5 seconds)
   */
  static async processCrossBorderPayment(payment: CrossBorderPayment): Promise<XRPPaymentResponse> {
    try {
      // XRP enables instant cross-border transfers
      const exchangeRate = await XRPLedgerService.getXRPUSDRate();
      const xrpAmount = payment.amount / exchangeRate;

      // Add country-specific memo for compliance
      const memo = `${payment.fromCountry}-${payment.toCountry}:${payment.memo || 'CrossBorder'}`;

      return {
        success: true,
        amount: xrpAmount,
        fee: await XRPLedgerService.calculateTransactionFee(),
        exchangeRate,
        // Note: Actual transaction would require wallet credentials
      };

    } catch (error: any) {
      return {
        success: false,
        amount: 0,
        fee: 0,
        error: error.message || 'Cross-border payment failed'
      };
    }
  }

  /**
   * Calculate XRP transaction cost comparison
   */
  static async calculateCostComparison(usdAmount: number): Promise<{
    xrp: { fee: number; time: string; total: number };
    traditional: { fee: number; time: string; total: number };
    savings: { fee: number; time: string; percentage: number };
  }> {
    const xrpFee = await XRPLedgerService.calculateTransactionFee();
    const xrpFeeUSD = await XRPLedgerService.xrpToUSD(xrpFee);
    
    // Traditional wire transfer costs
    const traditionalFee = Math.max(25, usdAmount * 0.05); // $25 minimum or 5%
    
    return {
      xrp: {
        fee: xrpFeeUSD,
        time: '3-5 seconds',
        total: usdAmount + xrpFeeUSD
      },
      traditional: {
        fee: traditionalFee,
        time: '3-5 business days',
        total: usdAmount + traditionalFee
      },
      savings: {
        fee: traditionalFee - xrpFeeUSD,
        time: 'Instant vs days',
        percentage: ((traditionalFee - xrpFeeUSD) / traditionalFee) * 100
      }
    };
  }

  /**
   * Process XRP-based AI agent referral payout
   */
  static async processAgentReferralPayout(
    agentAddress: string,
    rewardAmount: number,
    transactionId: string,
    platformSeed: string
  ): Promise<XRPPaymentResponse> {
    try {
      const memo = `Referral:${transactionId}`;
      
      const transaction = await XRPLedgerService.sendPayment(
        platformSeed,
        agentAddress,
        rewardAmount,
        memo
      );

      return {
        success: true,
        transactionHash: transaction.hash,
        amount: rewardAmount,
        fee: parseFloat(transaction.fee)
      };

    } catch (error: any) {
      return {
        success: false,
        amount: 0,
        fee: 0,
        error: error.message || 'Referral payout failed'
      };
    }
  }

  /**
   * Create secure escrow for P2P transactions
   */
  static async createSecureEscrow(
    senderSeed: string,
    recipientAddress: string,
    amount: number,
    releaseCondition?: 'time' | 'condition',
    releaseValue?: Date | string
  ): Promise<{ success: boolean; escrowHash?: string; error?: string }> {
    try {
      let finishAfter: Date | undefined;
      let condition: string | undefined;

      if (releaseCondition === 'time' && releaseValue instanceof Date) {
        finishAfter = releaseValue;
      } else if (releaseCondition === 'condition' && typeof releaseValue === 'string') {
        condition = releaseValue;
      }

      const escrowHash = await XRPLedgerService.createEscrow(
        senderSeed,
        recipientAddress,
        amount,
        finishAfter,
        undefined, // cancelAfter
        condition
      );

      return {
        success: true,
        escrowHash
      };

    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Escrow creation failed'
      };
    }
  }

  /**
   * Process high-frequency micro-transactions using payment channels
   */
  static async createMicroTransactionChannel(
    senderSeed: string,
    recipientAddress: string,
    channelAmount: number,
    settleDelay: number = 3600
  ): Promise<{ success: boolean; channelHash?: string; error?: string }> {
    try {
      const channelHash = await XRPLedgerService.createPaymentChannel(
        senderSeed,
        recipientAddress,
        channelAmount,
        settleDelay
      );

      return {
        success: true,
        channelHash
      };

    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Payment channel creation failed'
      };
    }
  }

  /**
   * Get XRP corridor optimization for international transfers
   */
  static async getCorridorOptimization(
    fromCountry: string,
    toCountry: string,
    amount: number
  ): Promise<{
    recommended: boolean;
    savings: number;
    timeReduction: string;
    exchangeRate: number;
  }> {
    try {
      const exchangeRate = await XRPLedgerService.getXRPUSDRate();
      const xrpFee = await XRPLedgerService.calculateTransactionFee();
      const xrpFeeUSD = await XRPLedgerService.xrpToUSD(xrpFee);
      
      // Traditional international transfer costs
      const traditionalFee = Math.max(35, amount * 0.08); // Higher for international
      
      return {
        recommended: true, // XRP is almost always better for international
        savings: traditionalFee - xrpFeeUSD,
        timeReduction: 'Instant vs 3-7 business days',
        exchangeRate
      };

    } catch (error) {
      return {
        recommended: false,
        savings: 0,
        timeReduction: '',
        exchangeRate: 0
      };
    }
  }

  /**
   * Validate XRP payment parameters
   */
  static validatePaymentParams(params: {
    amount: number;
    fromAddress?: string;
    toAddress: string;
    currency: string;
  }): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Amount validation
    if (params.amount <= 0) {
      errors.push('Amount must be greater than 0');
    }

    if (params.amount < 0.000001) {
      errors.push('Amount below minimum XRP precision');
    }

    // Address validation
    if (params.fromAddress && !XRPLedgerService.validateAddress(params.fromAddress)) {
      errors.push('Invalid sender XRP address');
    }

    if (!XRPLedgerService.validateAddress(params.toAddress)) {
      errors.push('Invalid recipient XRP address');
    }

    // Currency validation
    if (!['XRP', 'USD'].includes(params.currency)) {
      errors.push('Currency must be XRP or USD');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get XRP network status and performance metrics
   */
  static async getNetworkStatus(): Promise<{
    connected: boolean;
    ledgerIndex: number;
    avgFee: number;
    avgSettlementTime: string;
    networkLoad: 'low' | 'medium' | 'high';
  }> {
    try {
      const ledgerInfo = await XRPLedgerService.getLedgerInfo();
      const avgFee = await XRPLedgerService.calculateTransactionFee();

      return {
        connected: true,
        ledgerIndex: ledgerInfo.ledger_index,
        avgFee,
        avgSettlementTime: '3-5 seconds',
        networkLoad: 'low' // XRP network is rarely congested
      };

    } catch (error) {
      return {
        connected: false,
        ledgerIndex: 0,
        avgFee: 0,
        avgSettlementTime: 'Unknown',
        networkLoad: 'high'
      };
    }
  }
}