interface TronTransaction {
  txID: string;
  from: string;
  to: string;
  amount: number;
  token?: string;
  timestamp: number;
  status: 'confirmed' | 'pending' | 'failed';
}

interface TronWalletInfo {
  address: string;
  balance: {
    trx: number;
    usdt: number;
  };
  transactions: TronTransaction[];
}

class TronService {
  private usdtContractAddress = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'; // USDT-TRC20
  private apiBase = 'https://api.trongrid.io';

  constructor() {
    // Use REST API approach instead of TronWeb library
  }

  async getWalletInfo(address: string): Promise<TronWalletInfo> {
    try {
      // Get account info from TronGrid API
      const accountResponse = await fetch(`${this.apiBase}/v1/accounts/${address}`);
      const accountData = await accountResponse.json();

      if (!accountData.success) {
        throw new Error('Invalid Tron address or account not found');
      }

      // Parse TRX balance (TronGrid returns balance in sun, 1 TRX = 1,000,000 sun)
      const trxBalance = accountData.data?.[0]?.balance || 0;
      const trxAmount = trxBalance / 1000000;

      // Get USDT-TRC20 balance
      let usdtBalance = 0;
      try {
        const usdtResponse = await fetch(`${this.apiBase}/v1/accounts/${address}/tokens`);
        const usdtData = await usdtResponse.json();
        
        if (usdtData.success && usdtData.data) {
          const usdtToken = usdtData.data.find((token: any) => 
            token.tokenId === this.usdtContractAddress
          );
          if (usdtToken) {
            usdtBalance = parseFloat(usdtToken.balance) / 1000000; // USDT has 6 decimals
          }
        }
      } catch (error) {
        console.log('USDT balance fetch failed:', error);
      }

      // Get recent transactions
      const transactions = await this.getRecentTransactions(address);

      return {
        address,
        balance: {
          trx: trxAmount,
          usdt: usdtBalance
        },
        transactions
      };
    } catch (error: any) {
      console.error('Tron wallet info error:', error);
      throw new Error(`Failed to get Tron wallet info: ${error.message}`);
    }
  }

  async getRecentTransactions(address: string): Promise<TronTransaction[]> {
    try {
      const response = await fetch(`https://api.trongrid.io/v1/accounts/${address}/transactions?limit=20`);
      const data = await response.json();

      if (!data.data) return [];

      return data.data.map((tx: any) => ({
        txID: tx.txID,
        from: tx.raw_data.contract[0].parameter.value.owner_address || '',
        to: tx.raw_data.contract[0].parameter.value.to_address || '',
        amount: tx.raw_data.contract[0].parameter.value.amount || 0,
        timestamp: tx.block_timestamp,
        status: tx.ret[0].contractRet === 'SUCCESS' ? 'confirmed' : 'failed'
      }));
    } catch (error) {
      console.error('Transaction fetch error:', error);
      return [];
    }
  }

  async sendTRX(fromAddress: string, toAddress: string, amount: number): Promise<string> {
    try {
      const transaction = await this.tronWeb.transactionBuilder.sendTrx(
        toAddress,
        this.tronWeb.toSun(amount),
        fromAddress
      );

      const signedTransaction = await this.tronWeb.trx.sign(transaction);
      const broadcast = await this.tronWeb.trx.sendRawTransaction(signedTransaction);

      if (broadcast.result) {
        return broadcast.txid;
      } else {
        throw new Error('Transaction broadcast failed');
      }
    } catch (error: any) {
      console.error('TRX send error:', error);
      throw new Error(`TRX transaction failed: ${error.message}`);
    }
  }

  async sendUSDT(fromAddress: string, toAddress: string, amount: number): Promise<string> {
    try {
      const contract = await this.tronWeb.contract().at(this.usdtContractAddress);
      const usdtAmount = amount * 1000000; // USDT has 6 decimals

      const transaction = await contract.transfer(toAddress, usdtAmount).send({
        from: fromAddress,
        shouldPollResponse: false
      });

      return transaction;
    } catch (error: any) {
      console.error('USDT send error:', error);
      throw new Error(`USDT transaction failed: ${error.message}`);
    }
  }

  async validateAddress(address: string): Promise<boolean> {
    try {
      return this.tronWeb.isAddress(address);
    } catch (error) {
      return false;
    }
  }

  async getTransactionStatus(txId: string): Promise<'confirmed' | 'pending' | 'failed'> {
    try {
      const transaction = await this.tronWeb.trx.getTransaction(txId);
      
      if (!transaction) return 'pending';
      
      return transaction.ret[0].contractRet === 'SUCCESS' ? 'confirmed' : 'failed';
    } catch (error) {
      return 'pending';
    }
  }

  async estimateFee(type: 'TRX' | 'USDT'): Promise<number> {
    // Tron network fees are very low
    if (type === 'TRX') {
      return 1.1; // ~1.1 TRX for TRX transfers
    } else {
      return 13.5; // ~13.5 TRX for USDT-TRC20 transfers
    }
  }

  // Calculate transaction fee in USD
  async calculateFeeUSD(type: 'TRX' | 'USDT'): Promise<number> {
    try {
      const feeInTRX = await this.estimateFee(type);
      const trxPriceResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=tron&vs_currencies=usd');
      const trxPrice = await trxPriceResponse.json();
      
      return feeInTRX * (trxPrice.tron?.usd || 0.1);
    } catch (error) {
      // Fallback fee estimates
      return type === 'TRX' ? 0.11 : 1.35; // USD estimates
    }
  }
}

export const tronService = new TronService();
export type { TronTransaction, TronWalletInfo };