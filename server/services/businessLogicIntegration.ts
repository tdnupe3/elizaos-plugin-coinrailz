/**
 * Business Logic Integration Service - Applies All Safety Mechanisms
 * Integrates transaction wrapper, tiered commissions, exchange protection, and safe math
 * Based on comprehensive business logic audit requirements
 */

import { TransactionWrapper } from './transactionWrapper';
import { TieredCommissionCalculator } from './tieredCommissionCalculator';
import { ExchangeRateProtection } from './exchangeRateProtection';
import { SafeMath } from '../utils/safeMath';

interface InputValidationResult {
  valid: boolean;
  error?: string;
  sanitized?: any;
  amountCents?: number;
}

/**
 * Validation is kept next to the operations it protects.  The former import
 * pointed at a module that does not exist, leaving these payment paths without
 * a concrete validation implementation.
 */
const InputValidation = {
  validateTransactionAmount(value: unknown): InputValidationResult {
    const amount = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(amount) && amount > 0 && Math.round(amount * 100) === amount * 100
      ? { valid: true, amountCents: Math.round(amount * 100), sanitized: amount }
      : { valid: false, error: 'Amount must be a positive value with at most two decimal places' };
  },
  validateUserId(value: unknown): InputValidationResult {
    return typeof value === 'string' && value.trim().length > 0
      ? { valid: true, sanitized: value.trim() }
      : { valid: false, error: 'User ID is required' };
  },
  validateCurrencyCode(value: unknown): InputValidationResult {
    return typeof value === 'string' && /^[A-Za-z]{3}$/.test(value)
      ? { valid: true, sanitized: value.toUpperCase() }
      : { valid: false, error: 'Currency must be a three-letter code' };
  },
  validateCommissionPayout(value: { agentId: string; amount: number; transactionId: string }): InputValidationResult {
    const amount = this.validateTransactionAmount(value.amount);
    return value.agentId.trim() && value.transactionId.trim() && amount.valid
      ? { valid: true, sanitized: { ...value, amount: value.amount } }
      : { valid: false, error: 'A valid agent, transaction, and amount are required' };
  },
  validateAgentRegistration(value: { name: string; email: string; capabilities: string[] }): InputValidationResult {
    const email = value.email.trim();
    return value.name.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
      Array.isArray(value.capabilities) && value.capabilities.every(capability => typeof capability === 'string')
      ? { valid: true, sanitized: { name: value.name.trim(), email, capabilities: value.capabilities } }
      : { valid: false, error: 'A name, valid email, and string capabilities are required' };
  },
};

interface EnhancedTransactionResult {
  success: boolean;
  data?: any;
  error?: string;
  validation?: {
    inputValid: boolean;
    amountValid: boolean;
    rateValid: boolean;
  };
}

export class BusinessLogicIntegration {
  /**
   * Enhanced P2P Transfer with all safety mechanisms
   */
  static async processP2PTransfer(request: {
    fromUserId: string;
    toUserId: string;
    amount: number;
    currency?: string;
  }): Promise<EnhancedTransactionResult> {
    try {
      // Step 1: Comprehensive input validation
      // Basic validation for P2P transfer
      const amountValidation = InputValidation.validateTransactionAmount(request.amount);
      const validation = {
        valid: Boolean(request.fromUserId && request.toUserId && amountValidation.valid),
        sanitized: { ...request, fromUserId: request.fromUserId.trim(), toUserId: request.toUserId.trim() },
      };
      if (!validation.valid) {
        return {
          success: false,
          error: 'Invalid P2P transfer parameters',
          validation: { inputValid: false, amountValid: false, rateValid: false }
        };
      }

      const sanitized = validation.sanitized!;

      // Step 2: Calculate fees using safe math
      const feeCalculation = SafeMath.calculateFee(sanitized.amount, 0.01); // 1% platform fee

      // Step 3: Calculate commission using tiered structure
      const commission = TieredCommissionCalculator.calculateCommission(sanitized.amount);

      // Step 4: Validate total doesn't exceed limits
      const totalValidation = TieredCommissionCalculator.validateTotalCommissions(
        sanitized.amount,
        [commission]
      );

      if (!totalValidation.valid) {
        return {
          success: false,
          error: `Commission overflow: ${totalValidation.totalCommission} exceeds max ${totalValidation.maxAllowed}`,
          validation: { inputValid: true, amountValid: false, rateValid: false }
        };
      }

      // Step 5: Execute atomic transaction
      const transferResult = await TransactionWrapper.executeP2PTransfer(
        sanitized.fromUserId,
        sanitized.toUserId,
        sanitized.amount,
        feeCalculation.feeDollars
      );

      if (!transferResult.success) {
        return {
          success: false,
          error: transferResult.error,
          validation: { inputValid: true, amountValid: true, rateValid: true }
        };
      }

      return {
        success: true,
        data: {
          transferId: transferResult.data!.transferId,
          amount: feeCalculation.formatted.amount,
          fee: feeCalculation.formatted.fee,
          total: feeCalculation.formatted.total,
          commission: {
            amount: commission.amount,
            rate: commission.rate,
            tier: commission.tier
          },
          fromUserId: sanitized.fromUserId,
          toUserId: sanitized.toUserId,
          currency: sanitized.currency
        },
        validation: { inputValid: true, amountValid: true, rateValid: true }
      };

    } catch (error) {
      console.error('P2P transfer processing error:', error);
      return {
        success: false,
        error: 'Transfer processing failed',
        validation: { inputValid: false, amountValid: false, rateValid: false }
      };
    }
  }

  /**
   * Enhanced Fee Calculation with validation and safe math
   */
  static calculateTransactionFee(amount: any): EnhancedTransactionResult {
    try {
      // Step 1: Validate input amount
      const validation = InputValidation.validateTransactionAmount(amount);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
          validation: { inputValid: false, amountValid: false, rateValid: true }
        };
      }

      const validatedAmount = validation.amountCents! / 100;

      // Step 2: Calculate fee using safe math
      const feeCalculation = SafeMath.calculateFee(validatedAmount, 0.01); // 1% fee

      // Step 3: Calculate tiered commission
      const commission = TieredCommissionCalculator.calculateCommission(validatedAmount);

      // Step 4: Calculate break-even analysis
      const breakEven = TieredCommissionCalculator.calculateBreakEvenAnalysis(validatedAmount);

      return {
        success: true,
        data: {
          amount: feeCalculation.formatted.amount,
          fee: feeCalculation.formatted.fee,
          total: feeCalculation.formatted.total,
          amountCents: feeCalculation.amountCents,
          feeCents: feeCalculation.feeCents,
          totalCents: feeCalculation.totalCents,
          commission: {
            amount: commission.amount,
            rate: commission.rate,
            tier: commission.tier,
            profitable: commission.profitable
          },
          breakEven: {
            platformFee: SafeMath.formatMoney(SafeMath.dollarsToCents(breakEven.platformFee)),
            processingCost: SafeMath.formatMoney(SafeMath.dollarsToCents(breakEven.processingCost)),
            netProfit: SafeMath.formatMoney(SafeMath.dollarsToCents(breakEven.netProfit)),
            profitMargin: `${(breakEven.profitMargin * 100).toFixed(1)}%`
          }
        },
        validation: { inputValid: true, amountValid: true, rateValid: true }
      };

    } catch (error) {
      console.error('Fee calculation error:', error);
      return {
        success: false,
        error: 'Fee calculation failed',
        validation: { inputValid: false, amountValid: false, rateValid: false }
      };
    }
  }

  /**
   * Enhanced Currency Exchange with rate protection
   */
  static async processCurrencyExchange(request: {
    userId: string;
    fromCurrency: string;
    toCurrency: string;
    amount: number;
  }): Promise<EnhancedTransactionResult> {
    try {
      // Step 1: Validate inputs
      const userValidation = InputValidation.validateUserId(request.userId);
      const fromCurrencyValidation = InputValidation.validateCurrencyCode(request.fromCurrency);
      const toCurrencyValidation = InputValidation.validateCurrencyCode(request.toCurrency);
      const amountValidation = InputValidation.validateTransactionAmount(request.amount);

      if (!userValidation.valid || !fromCurrencyValidation.valid || 
          !toCurrencyValidation.valid || !amountValidation.valid) {
        const errors = [
          userValidation.error,
          fromCurrencyValidation.error,
          toCurrencyValidation.error,
          amountValidation.error
        ].filter(Boolean);

        return {
          success: false,
          error: errors.join('; '),
          validation: { inputValid: false, amountValid: false, rateValid: false }
        };
      }

      // Step 2: Get validated exchange rate
      const rateValidation = await ExchangeRateProtection.validateRateForTransaction(
        fromCurrencyValidation.sanitized!,
        toCurrencyValidation.sanitized!,
        amountValidation.amountCents! / 100
      );

      if (!rateValidation.valid) {
        return {
          success: false,
          error: rateValidation.error,
          validation: { inputValid: true, amountValid: true, rateValid: false }
        };
      }

      // Step 3: Calculate exchange using safe math
      const exchangeCalculation = SafeMath.calculateExchange(
        amountValidation.amountCents! / 100,
        rateValidation.rate!,
        0.005 // 0.5% exchange fee
      );

      // Step 4: Execute atomic exchange transaction
      const exchangeResult = await TransactionWrapper.executeCurrencyExchange(
        userValidation.sanitized!,
        fromCurrencyValidation.sanitized!,
        toCurrencyValidation.sanitized!,
        amountValidation.amountCents! / 100,
        exchangeCalculation.netAmountCents / 100,
        rateValidation.rate!
      );

      if (!exchangeResult.success) {
        return {
          success: false,
          error: exchangeResult.error,
          validation: { inputValid: true, amountValid: true, rateValid: true }
        };
      }

      return {
        success: true,
        data: {
          exchangeId: exchangeResult.data!.exchangeId,
          fromCurrency: fromCurrencyValidation.sanitized,
          toCurrency: toCurrencyValidation.sanitized,
          fromAmount: exchangeCalculation.formatted.fromAmount,
          toAmount: exchangeCalculation.formatted.toAmount,
          exchangeRate: rateValidation.rate,
          fee: exchangeCalculation.formatted.fee,
          netAmount: exchangeCalculation.formatted.netAmount
        },
        validation: { inputValid: true, amountValid: true, rateValid: true }
      };

    } catch (error) {
      console.error('Currency exchange processing error:', error);
      return {
        success: false,
        error: 'Exchange processing failed',
        validation: { inputValid: false, amountValid: false, rateValid: false }
      };
    }
  }

  /**
   * Enhanced Commission Payout with atomic protection
   */
  static async processCommissionPayout(request: {
    agentId: string;
    amount: number;
    transactionId: string;
  }): Promise<EnhancedTransactionResult> {
    try {
      // Step 1: Validate input
      const validation = InputValidation.validateCommissionPayout(request);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
          validation: { inputValid: false, amountValid: false, rateValid: true }
        };
      }

      const sanitized = validation.sanitized!;

      // Step 2: Validate commission amount using safe math
      const commissionMoney = SafeMath.createMoney(sanitized.amount);

      // Step 3: Execute atomic commission payout
      const payoutResult = await TransactionWrapper.executeCommissionPayout(
        sanitized.agentId,
        sanitized.amount,
        sanitized.transactionId
      );

      if (!payoutResult.success) {
        return {
          success: false,
          error: payoutResult.error,
          validation: { inputValid: true, amountValid: true, rateValid: true }
        };
      }

      return {
        success: true,
        data: {
          payoutId: payoutResult.data!.payoutId,
          agentId: sanitized.agentId,
          amount: commissionMoney.formatted,
          amountCents: commissionMoney.cents,
          transactionId: sanitized.transactionId,
          status: 'completed'
        },
        validation: { inputValid: true, amountValid: true, rateValid: true }
      };

    } catch (error) {
      console.error('Commission payout processing error:', error);
      return {
        success: false,
        error: 'Commission payout failed',
        validation: { inputValid: false, amountValid: false, rateValid: false }
      };
    }
  }

  /**
   * Enhanced Agent Registration with comprehensive validation
   */
  static processAgentRegistration(request: {
    name: string;
    email: string;
    capabilities: string[];
  }): EnhancedTransactionResult {
    try {
      // Step 1: Validate input
      const validation = InputValidation.validateAgentRegistration(request);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
          validation: { inputValid: false, amountValid: true, rateValid: true }
        };
      }

      const sanitized = validation.sanitized!;

      // Step 2: Determine commission tier based on capabilities
      const tierInfo = this.determineAgentTier(sanitized.capabilities);

      // Step 3: Generate agent ID and response
      const agentId = `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      return {
        success: true,
        data: {
          agentId,
          name: sanitized.name,
          email: sanitized.email,
          capabilities: sanitized.capabilities,
          tier: tierInfo.tier,
          commissionRate: tierInfo.commissionRate,
          status: 'pending_verification',
          registeredAt: new Date().toISOString()
        },
        validation: { inputValid: true, amountValid: true, rateValid: true }
      };

    } catch (error) {
      console.error('Agent registration processing error:', error);
      return {
        success: false,
        error: 'Agent registration failed',
        validation: { inputValid: false, amountValid: false, rateValid: false }
      };
    }
  }

  /**
   * Determine agent tier based on capabilities
   */
  private static determineAgentTier(capabilities: string[]): {
    tier: string;
    commissionRate: number;
  } {
    const premiumCapabilities = ['portfolio', 'consulting'];
    const standardCapabilities = ['trading', 'analysis'];

    const hasPremium = capabilities.some(cap => premiumCapabilities.includes(cap));
    const hasStandard = capabilities.some(cap => standardCapabilities.includes(cap));

    if (hasPremium) {
      return { tier: 'Premium', commissionRate: 0.0075 }; // 0.75%
    } else if (hasStandard) {
      return { tier: 'Standard', commissionRate: 0.005 }; // 0.5%
    } else {
      return { tier: 'Basic', commissionRate: 0.0025 }; // 0.25%
    }
  }

  /**
   * Get system health status including all business logic components
   */
  static getSystemHealthStatus(): {
    healthy: boolean;
    components: Record<string, boolean>;
    exchangeRates: any;
  } {
    try {
      const exchangeStatus = ExchangeRateProtection.getCacheStatus();
      
      return {
        healthy: true,
        components: {
          transactionWrapper: true,
          tieredCommissions: true,
          exchangeProtection: !exchangeStatus.circuitBreakerStatus,
          inputValidation: true,
          safeMath: true
        },
        exchangeRates: exchangeStatus
      };
    } catch (error) {
      return {
        healthy: false,
        components: {
          transactionWrapper: false,
          tieredCommissions: false,
          exchangeProtection: false,
          inputValidation: false,
          safeMath: false
        },
        exchangeRates: { error: 'Health check failed' }
      };
    }
  }
}