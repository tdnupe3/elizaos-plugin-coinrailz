export class FeeCalculator {
  // Base operational costs per transaction type
  private static readonly BASE_COSTS = {
    // API call costs (estimated)
    compliance_check: 0.02,    // AML/sanctions screening
    kyc_verification: 0.15,    // Identity verification
    bank_transfer: 0.25,       // ACH/wire transfer
    crypto_onramp: 0.30,      // Crypto purchase
    crypto_offramp: 0.30,     // Crypto sale
    crypto_swap: 0.10,        // DEX aggregator
    p2p_transfer: 0.05,       // Internal transfer

    // Processing overhead
    database_operations: 0.01,
    compliance_reporting: 0.03,
    fraud_monitoring: 0.02,
  };

  // Minimum profit margins per transaction type
  private static readonly MIN_PROFIT_MARGINS = {
    send_money: 0.25,         // $0.25 minimum profit
    buy_crypto: 0.50,         // $0.50 minimum profit
    sell_crypto: 0.50,        // $0.50 minimum profit
    swap_crypto: 0.30,        // $0.30 minimum profit
    deposit_funds: 0.15,      // $0.15 minimum profit
    withdraw_funds: 0.25,     // $0.25 minimum profit
  };

  static calculateSendMoneyFee(amount: number): { fee: number; breakdown: any } {
    const operationalCost = 
      this.BASE_COSTS.compliance_check +
      this.BASE_COSTS.p2p_transfer +
      this.BASE_COSTS.database_operations +
      this.BASE_COSTS.fraud_monitoring;

    const percentageFee = amount * 0.01; // 1% base fee
    const minimumFee = operationalCost + this.MIN_PROFIT_MARGINS.send_money;

    const finalFee = Math.max(percentageFee, minimumFee);

    return {
      fee: Number(finalFee.toFixed(2)),
      breakdown: {
        operationalCost: Number(operationalCost.toFixed(2)),
        minimumProfit: this.MIN_PROFIT_MARGINS.send_money,
        percentageFee: Number(percentageFee.toFixed(2)),
        finalFee: Number(finalFee.toFixed(2))
      }
    };
  }

  static calculateCryptoFee(amount: number, type: 'buy' | 'sell'): { fee: number; breakdown: any } {
    const operationalCost = 
      this.BASE_COSTS.compliance_check +
      this.BASE_COSTS.kyc_verification +
      (type === 'buy' ? this.BASE_COSTS.crypto_onramp : this.BASE_COSTS.crypto_offramp) +
      this.BASE_COSTS.database_operations +
      this.BASE_COSTS.compliance_reporting;

    const percentageFee = amount * 0.015; // 1.5% for crypto transactions
    const minimumFee = operationalCost + 
      (type === 'buy' ? this.MIN_PROFIT_MARGINS.buy_crypto : this.MIN_PROFIT_MARGINS.sell_crypto);

    const finalFee = Math.max(percentageFee, minimumFee);

    return {
      fee: Number(finalFee.toFixed(2)),
      breakdown: {
        operationalCost: Number(operationalCost.toFixed(2)),
        minimumProfit: type === 'buy' ? this.MIN_PROFIT_MARGINS.buy_crypto : this.MIN_PROFIT_MARGINS.sell_crypto,
        percentageFee: Number(percentageFee.toFixed(2)),
        finalFee: Number(finalFee.toFixed(2))
      }
    };
  }

  static calculateSwapFee(amount: number): { fee: number; breakdown: any } {
    const operationalCost = 
      this.BASE_COSTS.compliance_check +
      this.BASE_COSTS.crypto_swap +
      this.BASE_COSTS.database_operations;

    const percentageFee = amount * 0.005; // 0.5% for swaps
    const minimumFee = operationalCost + this.MIN_PROFIT_MARGINS.swap_crypto;

    const finalFee = Math.max(percentageFee, minimumFee);

    return {
      fee: Number(finalFee.toFixed(2)),
      breakdown: {
        operationalCost: Number(operationalCost.toFixed(2)),
        minimumProfit: this.MIN_PROFIT_MARGINS.swap_crypto,
        percentageFee: Number(percentageFee.toFixed(2)),
        finalFee: Number(finalFee.toFixed(2))
      }
    };
  }

  static calculateDepositFee(amount: number): { fee: number; breakdown: any } {
    const operationalCost = 
      this.BASE_COSTS.bank_transfer +
      this.BASE_COSTS.compliance_check +
      this.BASE_COSTS.database_operations;

    const percentageFee = amount * 0.005; // 0.5% for deposits
    const minimumFee = operationalCost + this.MIN_PROFIT_MARGINS.deposit_funds;

    const finalFee = Math.max(percentageFee, minimumFee);

    return {
      fee: Number(finalFee.toFixed(2)),
      breakdown: {
        operationalCost: Number(operationalCost.toFixed(2)),
        minimumProfit: this.MIN_PROFIT_MARGINS.deposit_funds,
        percentageFee: Number(percentageFee.toFixed(2)),
        finalFee: Number(finalFee.toFixed(2))
      }
    };
  }

  static calculateWithdrawFee(amount: number): { fee: number; breakdown: any } {
    const operationalCost = 
      this.BASE_COSTS.bank_transfer +
      this.BASE_COSTS.compliance_check +
      this.BASE_COSTS.compliance_reporting +
      this.BASE_COSTS.database_operations;

    const percentageFee = amount * 0.008; // 0.8% for withdrawals
    const minimumFee = operationalCost + this.MIN_PROFIT_MARGINS.withdraw_funds;

    const finalFee = Math.max(percentageFee, minimumFee);

    return {
      fee: Number(finalFee.toFixed(2)),
      breakdown: {
        operationalCost: Number(operationalCost.toFixed(2)),
        minimumProfit: this.MIN_PROFIT_MARGINS.withdraw_funds,
        percentageFee: Number(percentageFee.toFixed(2)),
        finalFee: Number(finalFee.toFixed(2))
      }
    };
  }

  static calculateAIAgentFee(amount: number): { fee: number; breakdown: any } {
    // Lower fees for AI agent transactions to encourage automation
    const baseFee = 0.25;
    const percentageFee = amount * 0.0005; // 0.05%
    const fee = Math.max(baseFee, percentageFee);

    return {
      fee: Number(fee.toFixed(2)),
      breakdown: {
        baseFee: baseFee,
        percentageFee: Number(percentageFee.toFixed(2)),
        finalFee: Number(fee.toFixed(2)),
        aiDiscount: true
      }
    };
  }
}