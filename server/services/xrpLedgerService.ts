/**
 * XRP Ledger Service - Complete XRPL Integration
 * Provides XRP wallet management, payments, escrow, and multi-signing capabilities
 */

import { Client, Wallet, xrpToDrops, dropsToXrp, TxResponse } from 'xrpl';
import { cacheService } from '../cacheService';

interface XRPWallet {
  address: string;
  seed: string;
  publicKey: string;
  privateKey: string;
}

interface XRPTransaction {
  hash: string;
  account: string;
  destination: string;
  amount: string;
  fee: string;
  sequence: number;
  memo?: string;
  ledgerIndex: number;
  validated: boolean;
}

interface XRPEscrow {
  account: string;
  destination: string;
  amount: string;
  condition?: string;
  fulfillment?: string;
  cancelAfter?: number;
  finishAfter?: number;
}

interface XRPPaymentChannel {
  account: string;
  destination: string;
  amount: string;
  settleDelay: number;
  publicKey: string;
}

export class XRPLedgerService {
  private static client: Client;
  private static isConnected = false;

  /**
   * Initialize XRP Ledger connection
   */
  static async initialize(): Promise<void> {
    try {
      // Use testnet for development, mainnet for production
      const server = process.env.NODE_ENV === 'production' 
        ? 'wss://xrplcluster.com/' 
        : 'wss://s.altnet.rippletest.net:51233';
      
      this.client = new Client(server);
      await this.client.connect();
      this.isConnected = true;
      console.log(`XRP Ledger connected to ${process.env.NODE_ENV === 'production' ? 'mainnet' : 'testnet'}`);
    } catch (error) {
      console.error('Failed to connect to XRP Ledger:', error);
      throw new Error('XRP Ledger connection failed');
    }
  }

  /**
   * Ensure client is connected
   */
  private static async ensureConnected(): Promise<void> {
    if (!this.isConnected || !this.client.isConnected()) {
      await this.initialize();
    }
  }

  /**
   * Create new XRP wallet
   */
  static async createWallet(): Promise<XRPWallet> {
    await this.ensureConnected();
    
    try {
      const wallet = Wallet.generate();
      
      // For testnet, fund the wallet automatically
      if (process.env.NODE_ENV !== 'production') {
        try {
          await this.client.fundWallet(wallet);
        } catch (error) {
          console.log('Testnet funding failed (expected in some cases):', error);
        }
      }

      return {
        address: wallet.address,
        seed: wallet.seed!,
        publicKey: wallet.publicKey,
        privateKey: wallet.privateKey
      };
    } catch (error) {
      console.error('Error creating XRP wallet:', error);
      throw new Error('Failed to create XRP wallet');
    }
  }

  /**
   * Get wallet from seed
   */
  static getWalletFromSeed(seed: string): Wallet {
    return Wallet.fromSeed(seed);
  }

  /**
   * Get account balance in XRP
   */
  static async getBalance(address: string): Promise<number> {
    await this.ensureConnected();
    
    // Check cache first
    const cacheKey = `xrp_balance_${address}`;
    const cachedBalance = cacheService.get(cacheKey);
    if (cachedBalance !== null) {
      return cachedBalance;
    }

    try {
      const response = await this.client.request({
        command: 'account_info',
        account: address,
        ledger_index: 'validated'
      });

      const balanceDrops = response.result.account_data.Balance;
      const balanceXRP = Number(dropsToXrp(String(balanceDrops)));
      
      // Cache for 30 seconds
      cacheService.set(cacheKey, balanceXRP, 30000);
      
      return balanceXRP;
    } catch (error: any) {
      if (error.data?.error === 'actNotFound') {
        return 0; // Account doesn't exist yet
      }
      console.error('Error getting XRP balance:', error);
      throw new Error('Failed to get XRP balance');
    }
  }

  /**
   * Send XRP payment
   */
  static async sendPayment(
    senderSeed: string,
    destinationAddress: string,
    amount: number,
    memo?: string
  ): Promise<XRPTransaction> {
    await this.ensureConnected();

    try {
      const wallet = Wallet.fromSeed(senderSeed);
      
      // Prepare payment transaction
      const payment: any = {
        TransactionType: 'Payment',
        Account: wallet.address,
        Amount: xrpToDrops(amount.toString()),
        Destination: destinationAddress
      };

      // Add memo if provided
      if (memo) {
        payment.Memos = [{
          Memo: {
            MemoData: Buffer.from(memo, 'utf8').toString('hex').toUpperCase()
          }
        }];
      }

      // Submit and wait for validation
      const response = await this.client.submitAndWait(payment, { wallet });
      
      const meta = response.result.meta as any;
      if (meta && typeof meta === 'object' && meta.TransactionResult !== 'tesSUCCESS') {
        throw new Error(`Transaction failed: ${meta.TransactionResult}`);
      }

      return {
        hash: response.result.hash,
        account: payment.Account,
        destination: payment.Destination,
        amount: dropsToXrp(payment.Amount).toString(),
        fee: dropsToXrp(((response.result as any).Fee || '12').toString()).toString(),
        sequence: (response.result as any).Sequence || 0,
        memo,
        ledgerIndex: (response.result as any).ledger_index || 0,
        validated: (response.result as any).validated || true
      };
    } catch (error) {
      console.error('Error sending XRP payment:', error);
      throw new Error('Failed to send XRP payment');
    }
  }

  /**
   * Create escrow transaction for secure P2P transfers
   */
  static async createEscrow(
    senderSeed: string,
    destinationAddress: string,
    amount: number,
    finishAfter?: Date,
    cancelAfter?: Date,
    condition?: string
  ): Promise<string> {
    await this.ensureConnected();

    try {
      const wallet = Wallet.fromSeed(senderSeed);
      
      const escrowCreate: any = {
        TransactionType: 'EscrowCreate',
        Account: wallet.address,
        Destination: destinationAddress,
        Amount: xrpToDrops(amount)
      };

      if (finishAfter) {
        escrowCreate.FinishAfter = Math.floor(finishAfter.getTime() / 1000) - 946684800; // Ripple epoch
      }

      if (cancelAfter) {
        escrowCreate.CancelAfter = Math.floor(cancelAfter.getTime() / 1000) - 946684800; // Ripple epoch
      }

      if (condition) {
        escrowCreate.Condition = condition;
      }

      const response = await this.client.submitAndWait(escrowCreate, { wallet });
      
      const escrowMeta = response.result.meta as any;
      if (escrowMeta && typeof escrowMeta === 'object' && escrowMeta.TransactionResult !== 'tesSUCCESS') {
        throw new Error(`Escrow creation failed: ${escrowMeta.TransactionResult}`);
      }

      return response.result.hash;
    } catch (error) {
      console.error('Error creating XRP escrow:', error);
      throw new Error('Failed to create XRP escrow');
    }
  }

  /**
   * Finish escrow transaction
   */
  static async finishEscrow(
    finisherSeed: string,
    ownerAddress: string,
    escrowSequence: number,
    fulfillment?: string
  ): Promise<string> {
    await this.ensureConnected();

    try {
      const wallet = Wallet.fromSeed(finisherSeed);
      
      const escrowFinish: any = {
        TransactionType: 'EscrowFinish',
        Account: wallet.address,
        Owner: ownerAddress,
        OfferSequence: escrowSequence
      };

      if (fulfillment) {
        escrowFinish.Fulfillment = fulfillment;
      }

      const response = await this.client.submitAndWait(escrowFinish, { wallet });
      
      const finishMeta = response.result.meta as any;
      if (finishMeta && typeof finishMeta === 'object' && finishMeta.TransactionResult !== 'tesSUCCESS') {
        throw new Error(`Escrow finish failed: ${finishMeta.TransactionResult}`);
      }

      return response.result.hash;
    } catch (error) {
      console.error('Error finishing XRP escrow:', error);
      throw new Error('Failed to finish XRP escrow');
    }
  }

  /**
   * Create payment channel for micro-transactions
   */
  static async createPaymentChannel(
    senderSeed: string,
    destinationAddress: string,
    amount: number,
    settleDelay: number = 3600 // 1 hour default
  ): Promise<string> {
    await this.ensureConnected();

    try {
      const wallet = Wallet.fromSeed(senderSeed);
      
      const channelCreate: any = {
        TransactionType: 'PaymentChannelCreate',
        Account: wallet.address,
        Destination: destinationAddress,
        Amount: xrpToDrops(amount.toString()),
        SettleDelay: settleDelay,
        PublicKey: wallet.publicKey
      };

      const response = await this.client.submitAndWait(channelCreate, { wallet });
      
      const transactionResult = response.result.meta && typeof response.result.meta === 'object'
        ? (response.result.meta as { TransactionResult?: string }).TransactionResult
        : undefined;
      if (transactionResult !== 'tesSUCCESS') {
        throw new Error(`Payment channel creation failed: ${transactionResult ?? 'unknown'}`);
      }

      return response.result.hash;
    } catch (error) {
      console.error('Error creating XRP payment channel:', error);
      throw new Error('Failed to create XRP payment channel');
    }
  }

  /**
   * Get current XRP/USD exchange rate
   */
  static async getXRPUSDRate(): Promise<number> {
    const cacheKey = 'xrp_usd_rate';
    const cachedRate = cacheService.get(cacheKey);
    if (cachedRate !== null) {
      return cachedRate;
    }

    try {
      // Use CoinGecko API for reliable rate data
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=usd');
      const data = await response.json();
      const rate = data.ripple.usd;
      
      // Cache for 1 minute
      cacheService.set(cacheKey, rate, 60000);
      
      return rate;
    } catch (error) {
      console.error('Error fetching XRP/USD rate:', error);
      // Fallback rate if API fails
      return 0.50;
    }
  }

  /**
   * Convert USD to XRP
   */
  static async usdToXRP(usdAmount: number): Promise<number> {
    const rate = await this.getXRPUSDRate();
    return usdAmount / rate;
  }

  /**
   * Convert XRP to USD
   */
  static async xrpToUSD(xrpAmount: number): Promise<number> {
    const rate = await this.getXRPUSDRate();
    return xrpAmount * rate;
  }

  /**
   * Validate XRP address
   */
  static validateAddress(address: string): boolean {
    try {
      // XRP addresses start with 'r' and are 25-34 characters long
      if (!address.startsWith('r') || address.length < 25 || address.length > 34) {
        return false;
      }
      
      // Additional validation can be added here using xrpl library functions
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get transaction history for address
   */
  static async getTransactionHistory(address: string, limit: number = 20): Promise<XRPTransaction[]> {
    await this.ensureConnected();

    try {
      const response = await this.client.request({
        command: 'account_tx',
        account: address,
        limit,
        ledger_index_min: -1,
        ledger_index_max: -1
      });

      return response.result.transactions.map((tx: any): XRPTransaction => ({
        hash: tx.tx.hash,
        account: tx.tx.Account,
        destination: tx.tx.Destination,
        amount: tx.tx.Amount ? (typeof tx.tx.Amount === 'string' ? String(dropsToXrp(tx.tx.Amount)) : tx.tx.Amount.toString()) : '0',
        fee: String(dropsToXrp(tx.tx.Fee?.toString() || '12')),
        sequence: tx.tx.Sequence,
        memo: tx.tx.Memos?.[0]?.Memo?.MemoData ? 
          Buffer.from(tx.tx.Memos[0].Memo.MemoData, 'hex').toString('utf8') : undefined,
        ledgerIndex: tx.ledger_index,
        validated: tx.validated
      }));
    } catch (error) {
      console.error('Error getting XRP transaction history:', error);
      return [];
    }
  }

  static async getTransactionInfo(transactionHash: string): Promise<XRPTransaction | null> {
    await this.ensureConnected();
    try {
      const response = await this.client.request({ command: 'tx', transaction: transactionHash });
      const transaction = response.result as any;
      return {
        hash: transaction.hash,
        account: transaction.Account,
        destination: transaction.Destination ?? '',
        amount: transaction.Amount ? (typeof transaction.Amount === 'string' ? String(dropsToXrp(transaction.Amount)) : String(transaction.Amount)) : '0',
        fee: String(dropsToXrp(String(transaction.Fee ?? '0'))),
        sequence: transaction.Sequence ?? 0,
        ledgerIndex: transaction.ledger_index ?? 0,
        validated: Boolean(transaction.validated),
      };
    } catch (error: any) {
      if (error?.data?.error === 'txnNotFound') return null;
      throw error;
    }
  }

  /**
   * Calculate XRP transaction fee (ultra-low ~$0.0002)
   */
  static async calculateTransactionFee(): Promise<number> {
    await this.ensureConnected();

    try {
      const response = await this.client.request({
        command: 'server_info'
      });

      const feeDrops = response.result.info.validated_ledger?.base_fee_xrp || '0.00001';
      return parseFloat(feeDrops.toString());
    } catch (error) {
      console.error('Error calculating XRP fee:', error);
      return 0.00001; // Default minimal fee
    }
  }

  /**
   * Get ledger info
   */
  static async getLedgerInfo(): Promise<any> {
    await this.ensureConnected();

    try {
      const response = await this.client.request({
        command: 'ledger',
        ledger_index: 'validated'
      });

      return response.result.ledger;
    } catch (error) {
      console.error('Error getting ledger info:', error);
      throw new Error('Failed to get ledger info');
    }
  }

  /**
   * Disconnect from XRP Ledger
   */
  static async disconnect(): Promise<void> {
    if (this.client && this.isConnected) {
      await this.client.disconnect();
      this.isConnected = false;
    }
  }
}