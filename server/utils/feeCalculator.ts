import { env } from "../environment";

export interface FeeCalculation {
  amount: number;
  platformFee: number;
  gasFee: number;
  totalFee: number;
  netAmount: number;
  currency: string;
  fee: number;
  breakdown?: {
    platformFee: number;
    gasFee: number;
    agentCommission?: number;
    networkFee?: number;
  };
}

export interface AIAgentFeeCalculation extends FeeCalculation {
  agentCommission: number;
  networkFee: number;
}

export class FeeCalculator {
  // Standard platform fees
  static readonly SEND_MONEY_FEE_RATE = 0.01; // 1%
  static readonly CRYPTO_TRANSACTION_FEE_RATE = 0.015; // 1.5%
  static readonly SWAP_FEE_RATE = 0.005; // 0.5%
  static readonly P2P_CRYPTO_FEE_RATE = 0.0025; // 0.25%
  
  // AI Agent ecosystem fees
  static readonly AI_AGENT_FEE_RATE = 0.035; // 3.5% platform base fee for AI agent transactions
  static readonly NETWORK_DISCOVERY_FEE = 0.001; // 0.1% for network discovery
  
  // Tiered commission rates for AI agents
  static readonly BASIC_AGENT_COMMISSION_RATE = 0.005; // 0.5% for basic tier
  static readonly PREMIUM_AGENT_COMMISSION_RATE = 0.015; // 1.5% for premium tier
  
  // Minimum fees
  static readonly MIN_SEND_MONEY_FEE = 0.32;
  static readonly MIN_CRYPTO_FEE = 1.40;
  static readonly MIN_SWAP_FEE = 0.40;
  static readonly MIN_AI_AGENT_FEE = 1.00;

  // Platform wallet addresses for fee collection
  static readonly ETHEREUM_FEE_WALLET = "0x4dB56acDA064eab99BbC9F2AD1021Cd5d126C321";
  static readonly SOLANA_FEE_WALLET = "9Ev8LhxWLMxjtfEWkGuZRmg3w8Vokfh7Uk9L7UZ3mhA5";

  static calculateSendMoneyFee(amount: number, currency: string = "USD"): FeeCalculation {
    const platformFee = Math.max(amount * this.SEND_MONEY_FEE_RATE, this.MIN_SEND_MONEY_FEE);
    const gasFee = this.estimateGasFee(currency);
    const totalFee = platformFee + gasFee;
    
    return {
      amount,
      platformFee,
      gasFee,
      totalFee,
      netAmount: amount - totalFee,
      currency,
      fee: totalFee
    };
  }

  static calculateCryptoTransactionFee(amount: number, currency: string): FeeCalculation {
    const platformFee = Math.max(amount * this.CRYPTO_TRANSACTION_FEE_RATE, this.MIN_CRYPTO_FEE);
    const gasFee = this.estimateGasFee(currency);
    const totalFee = platformFee + gasFee;
    
    return {
      amount,
      platformFee,
      gasFee,
      totalFee,
      netAmount: amount - totalFee,
      currency,
      fee: totalFee
    };
  }

  static calculateSwapFee(amount: number, fromCurrency: string, toCurrency: string): FeeCalculation {
    const platformFee = Math.max(amount * this.SWAP_FEE_RATE, this.MIN_SWAP_FEE);
    const gasFee = this.estimateGasFee(fromCurrency);
    const totalFee = platformFee + gasFee;
    
    return {
      amount,
      platformFee,
      gasFee,
      totalFee,
      netAmount: amount - totalFee,
      currency: fromCurrency,
      fee: totalFee
    };
  }

  // Updated AI Agent fee calculation with tiered commission rates
  static calculateAIAgentFee(amount: number, currency: string, agentCommissionRate: number = 0.005): AIAgentFeeCalculation {
    const platformFee = Math.max(amount * this.AI_AGENT_FEE_RATE, this.MIN_AI_AGENT_FEE);
    const agentCommission = amount * agentCommissionRate;
    const networkFee = amount * this.NETWORK_DISCOVERY_FEE;
    const gasFee = this.estimateGasFee(currency);
    const totalFee = platformFee + agentCommission + networkFee + gasFee;
    
    return {
      amount,
      platformFee,
      agentCommission,
      networkFee,
      gasFee,
      totalFee,
      netAmount: amount - totalFee,
      currency,
      fee: totalFee
    };
  }

  // Tiered AI Agent fee calculation based on membership tier
  static calculateTieredAIAgentFee(amount: number, currency: string, membershipTier: 'basic' | 'premium'): AIAgentFeeCalculation {
    const commissionRate = membershipTier === 'premium' 
      ? this.PREMIUM_AGENT_COMMISSION_RATE 
      : this.BASIC_AGENT_COMMISSION_RATE;
    
    return this.calculateAIAgentFee(amount, currency, commissionRate);
  }

  static calculateNetworkDiscoveryFee(transactionValue: number, currency: string): FeeCalculation {
    const platformFee = transactionValue * this.NETWORK_DISCOVERY_FEE;
    const gasFee = this.estimateGasFee(currency);
    const totalFee = platformFee + gasFee;
    
    return {
      amount: transactionValue,
      platformFee,
      gasFee,
      totalFee,
      netAmount: transactionValue - totalFee,
      currency,
      fee: totalFee
    };
  }

  private static estimateGasFee(currency: string): number {
    // Gas fee estimates based on current network conditions
    const gasEstimates: Record<string, number> = {
      'ETH': 0.002, // ~$5-10 depending on network congestion
      'BTC': 0.0001, // ~$2-5 
      'SOL': 0.00025, // ~$0.01-0.05
      'USDC': 0.002, // Same as ETH for ERC-20
      'USDT': 0.002, // Same as ETH for ERC-20
      'USD': 0.01, // ACH/Wire processing fee
      'EUR': 0.015,
      'GBP': 0.015,
      'default': 0.01
    };

    return gasEstimates[currency.toUpperCase()] || gasEstimates.default;
  }

  static getFeeWalletAddress(currency: string): string {
    const cryptoCurrencies = ['ETH', 'USDC', 'USDT', 'BTC'];
    const solanaCurrencies = ['SOL'];
    
    if (solanaCurrencies.includes(currency.toUpperCase())) {
      return this.SOLANA_FEE_WALLET;
    } else if (cryptoCurrencies.includes(currency.toUpperCase())) {
      return this.ETHEREUM_FEE_WALLET;
    }
    
    // Default to Ethereum wallet for unknown cryptocurrencies
    return this.ETHEREUM_FEE_WALLET;
  }

  // Add missing methods for complete functionality
  static calculateCryptoFee(amount: number, currency: string): FeeCalculation {
    return this.calculateCryptoTransactionFee(amount, currency);
  }

  static calculateDepositFee(amount: number, currency: string): FeeCalculation {
    const platformFee = Math.max(amount * 0.01, 0.50); // 1% with $0.50 minimum
    const gasFee = this.estimateGasFee(currency);
    const totalFee = platformFee + gasFee;
    
    return {
      amount,
      platformFee,
      gasFee,
      totalFee,
      netAmount: amount - totalFee,
      currency,
      fee: totalFee
    };
  }

  static calculateWithdrawFee(amount: number, currency: string): FeeCalculation {
    const platformFee = Math.max(amount * 0.015, 1.00); // 1.5% with $1.00 minimum
    const gasFee = this.estimateGasFee(currency);
    const totalFee = platformFee + gasFee;
    
    return {
      amount,
      platformFee,
      gasFee,
      totalFee,
      netAmount: amount - totalFee,
      currency,
      fee: totalFee
    };
  }

  static formatFeeBreakdown(calculation: AIAgentFeeCalculation): string {
    return `
Transaction Amount: ${calculation.amount} ${calculation.currency}
Platform Fee (2%): ${calculation.platformFee} ${calculation.currency}
Agent Commission: ${calculation.agentCommission} ${calculation.currency}
Network Fee: ${calculation.networkFee} ${calculation.currency}
Gas Fee: ${calculation.gasFee} ${calculation.currency}
Total Fees: ${calculation.totalFee} ${calculation.currency}
Net Amount: ${calculation.netAmount} ${calculation.currency}
Fee Collection Wallet: ${this.getFeeWalletAddress(calculation.currency)}
    `.trim();
  }
}