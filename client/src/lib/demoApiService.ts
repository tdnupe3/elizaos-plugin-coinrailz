import {
  DEMO_USER,
  DEMO_WALLET_BALANCES,
  DEMO_CRYPTO_HOLDINGS,
  DEMO_TRANSACTIONS,
  DEMO_FUNDING_TRANSACTIONS,
  DEMO_CRYPTO_TRANSACTIONS,
  DEMO_CRYPTO_PRICES,
  DEMO_REFERRALS,
  mockApiCall,
  calculateDemoFee,
  simulateTransactionResult
} from './demoData';

// Demo API service - NO REAL API CALLS OR CHARGES
export class DemoApiService {
  private static instance: DemoApiService;
  private demoState = {
    user: { ...DEMO_USER },
    walletBalances: [...DEMO_WALLET_BALANCES],
    cryptoHoldings: [...DEMO_CRYPTO_HOLDINGS],
    transactions: [...DEMO_TRANSACTIONS],
    fundingTransactions: [...DEMO_FUNDING_TRANSACTIONS],
    cryptoTransactions: [...DEMO_CRYPTO_TRANSACTIONS],
    referrals: [...DEMO_REFERRALS]
  };

  static getInstance(): DemoApiService {
    if (!DemoApiService.instance) {
      DemoApiService.instance = new DemoApiService();
    }
    return DemoApiService.instance;
  }

  // User operations
  async getUser() {
    return mockApiCall(this.demoState.user);
  }

  // Wallet operations
  async getWalletBalances() {
    return mockApiCall(this.demoState.walletBalances);
  }

  async depositFunds(amount: string, method: string) {
    const numAmount = parseFloat(amount);
    const fee = method === 'debit_card' ? numAmount * 0.029 : 0;
    
    // Simulate deposit processing
    const transaction = {
      id: Date.now(),
      type: 'deposit',
      method,
      amount,
      currency: 'USD',
      status: 'completed',
      platformFee: fee.toFixed(2),
      createdAt: new Date().toISOString()
    };

    this.demoState.fundingTransactions.unshift(transaction);
    
    // Update wallet balance
    const wallet = this.demoState.walletBalances.find(w => w.currency === 'USD');
    if (wallet) {
      wallet.balance = (parseFloat(wallet.balance) + numAmount).toFixed(2);
      wallet.availableBalance = (parseFloat(wallet.availableBalance) + numAmount).toFixed(2);
    }

    return mockApiCall({ 
      message: 'Deposit completed successfully',
      transactionId: transaction.id,
      status: 'completed'
    });
  }

  async withdrawFunds(amount: string, bankAccount: string) {
    const numAmount = parseFloat(amount);
    const fee = 2.50;

    const wallet = this.demoState.walletBalances.find(w => w.currency === 'USD');
    if (!wallet || parseFloat(wallet.availableBalance) < numAmount) {
      throw new Error('Insufficient funds');
    }

    const transaction = {
      id: Date.now(),
      type: 'withdrawal',
      method: 'bank_transfer',
      amount,
      currency: 'USD',
      status: 'processing',
      bankAccount,
      platformFee: fee.toFixed(2),
      createdAt: new Date().toISOString()
    };

    this.demoState.fundingTransactions.unshift(transaction);

    // Update wallet balance
    wallet.availableBalance = (parseFloat(wallet.availableBalance) - numAmount).toFixed(2);
    wallet.frozenBalance = (parseFloat(wallet.frozenBalance) + numAmount).toFixed(2);

    return mockApiCall({
      message: 'Withdrawal initiated successfully',
      transactionId: transaction.id,
      estimatedTime: '1-3 business days'
    });
  }

  // Transaction operations
  async getTransactions() {
    const allTransactions = [
      ...this.demoState.fundingTransactions.map(t => ({ ...t, category: 'funding' })),
      ...this.demoState.transactions.map(t => ({ ...t, category: 'transfer' }))
    ].sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());

    return mockApiCall(allTransactions);
  }

  async sendMoney(toEmail: string, amount: string, message: string) {
    const numAmount = parseFloat(amount);
    const fee = calculateDemoFee(numAmount, 'send_money');

    if (!simulateTransactionResult()) {
      throw new Error('Transaction failed. Please try again.');
    }

    const transaction = {
      id: Date.now(),
      type: 'send',
      amount,
      currency: 'USD',
      fromEmail: this.demoState.user.email,
      toEmail,
      date: new Date().toISOString(),
      message,
      status: 'completed',
      platform: 'Internal',
      fee: fee.toFixed(2)
    };

    this.demoState.transactions.unshift(transaction);

    // Update wallet balance
    const wallet = this.demoState.walletBalances.find(w => w.currency === 'USD');
    if (wallet) {
      const total = numAmount + fee;
      wallet.balance = (parseFloat(wallet.balance) - total).toFixed(2);
      wallet.availableBalance = (parseFloat(wallet.availableBalance) - total).toFixed(2);
    }

    return mockApiCall({
      message: 'Money sent successfully',
      transactionId: transaction.id,
      fee: fee.toFixed(2)
    });
  }

  // Crypto operations
  async getCryptoHoldings() {
    return mockApiCall(this.demoState.cryptoHoldings);
  }

  async getCryptoPrices() {
    return mockApiCall(DEMO_CRYPTO_PRICES);
  }

  async getCryptoTransactions() {
    return mockApiCall(this.demoState.cryptoTransactions);
  }

  async buyCrypto(coinSymbol: string, amount: string) {
    const numAmount = parseFloat(amount);
    const price = DEMO_CRYPTO_PRICES[coinSymbol as keyof typeof DEMO_CRYPTO_PRICES]?.price || 1;
    const cryptoAmount = numAmount / price;
    const fee = calculateDemoFee(numAmount, 'crypto_transaction');

    if (!simulateTransactionResult()) {
      throw new Error('Transaction failed. Please try again.');
    }

    const transaction = {
      id: Date.now(),
      type: 'buy',
      coinSymbol,
      coinName: this.getCoinName(coinSymbol),
      amount: cryptoAmount.toFixed(8),
      price,
      date: new Date().toISOString(),
      total: numAmount,
      fee: fee.toFixed(2),
      status: 'completed'
    };

    this.demoState.cryptoTransactions.unshift(transaction);

    // Update crypto holding
    let holding = this.demoState.cryptoHoldings.find(h => h.coinSymbol === coinSymbol);
    if (holding) {
      holding.amount = (parseFloat(holding.amount) + cryptoAmount).toFixed(8);
    } else {
      holding = {
        id: Date.now(),
        coinSymbol,
        coinName: this.getCoinName(coinSymbol),
        amount: cryptoAmount.toFixed(8),
        currentPrice: price,
        value: numAmount
      };
      this.demoState.cryptoHoldings.push(holding);
    }

    return mockApiCall({
      message: 'Crypto purchase completed',
      transactionId: transaction.id,
      amount: cryptoAmount.toFixed(8),
      fee: fee.toFixed(2)
    });
  }

  async sellCrypto(coinSymbol: string, amount: string) {
    const numAmount = parseFloat(amount);
    const price = DEMO_CRYPTO_PRICES[coinSymbol as keyof typeof DEMO_CRYPTO_PRICES]?.price || 1;
    const usdAmount = numAmount * price;
    const fee = calculateDemoFee(usdAmount, 'crypto_transaction');

    const holding = this.demoState.cryptoHoldings.find(h => h.coinSymbol === coinSymbol);
    if (!holding || parseFloat(holding.amount) < numAmount) {
      throw new Error('Insufficient crypto balance');
    }

    if (!simulateTransactionResult()) {
      throw new Error('Transaction failed. Please try again.');
    }

    const transaction = {
      id: Date.now(),
      type: 'sell',
      coinSymbol,
      coinName: this.getCoinName(coinSymbol),
      amount: numAmount.toFixed(8),
      price,
      date: new Date().toISOString(),
      total: usdAmount,
      fee: fee.toFixed(2),
      status: 'completed'
    };

    this.demoState.cryptoTransactions.unshift(transaction);

    // Update crypto holding
    holding.amount = (parseFloat(holding.amount) - numAmount).toFixed(8);

    return mockApiCall({
      message: 'Crypto sale completed',
      transactionId: transaction.id,
      usdAmount: usdAmount.toFixed(2),
      fee: fee.toFixed(2)
    });
  }

  async swapCrypto(fromCoin: string, toCoin: string, fromAmount: string) {
    const numFromAmount = parseFloat(fromAmount);
    const fromPrice = DEMO_CRYPTO_PRICES[fromCoin as keyof typeof DEMO_CRYPTO_PRICES]?.price || 1;
    const toPrice = DEMO_CRYPTO_PRICES[toCoin as keyof typeof DEMO_CRYPTO_PRICES]?.price || 1;
    const toAmount = (numFromAmount * fromPrice) / toPrice;
    const fee = calculateDemoFee(numFromAmount * fromPrice, 'swap');

    if (!simulateTransactionResult()) {
      throw new Error('Swap failed. Please try again.');
    }

    const transaction = {
      id: Date.now(),
      type: 'swap',
      fromCoin,
      toCoin,
      fromAmount: numFromAmount.toFixed(8),
      toAmount: toAmount.toFixed(8),
      date: new Date().toISOString(),
      fee: fee.toFixed(2),
      status: 'completed'
    };

    this.demoState.cryptoTransactions.unshift(transaction);

    return mockApiCall({
      message: 'Swap completed successfully',
      transactionId: transaction.id,
      toAmount: toAmount.toFixed(8),
      fee: fee.toFixed(2)
    });
  }

  // Referral operations
  async getReferrals() {
    return mockApiCall(this.demoState.referrals);
  }

  private getCoinName(symbol: string): string {
    const names: { [key: string]: string } = {
      BTC: 'Bitcoin',
      ETH: 'Ethereum',
      ADA: 'Cardano',
      DOT: 'Polkadot',
      SOL: 'Solana',
      XRP: 'XRP',
      USDC: 'USD Coin',
      USDT: 'Tether'
    };
    return names[symbol] || symbol;
  }
}

export const demoApi = DemoApiService.getInstance();