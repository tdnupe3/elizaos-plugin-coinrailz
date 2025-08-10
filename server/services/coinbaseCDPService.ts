/**
 * Coinbase Developer Platform (CDP) Service
 * Provides wallet creation, balance monitoring, and transaction capabilities
 */

import { Coinbase, Wallet } from '@coinbase/coinbase-sdk';

export interface CDPWallet {
  id: string;
  address: string;
  network: string;
  balance: number;
  currency: string;
  created_at: string;
  user_id?: string;
}

export interface CDPTransaction {
  id: string;
  wallet_id: string;
  type: 'send' | 'receive';
  amount: string;
  currency: string;
  to_address?: string;
  from_address?: string;
  status: 'pending' | 'completed' | 'failed';
  transaction_hash?: string;
  created_at: string;
  fee?: string;
}

export class CoinbaseCDPService {
  private static instance: CoinbaseCDPService;
  // Note: Coinbase SDK uses global configuration, no instance needed
  private initialized = false;

  private constructor() {
    this.initialize();
  }

  public static getInstance(): CoinbaseCDPService {
    if (!this.instance) {
      this.instance = new CoinbaseCDPService();
    }
    return this.instance;
  }

  private async initialize() {
    try {
      // According to the official Coinbase documentation:
      // Coinbase.configure({ apiKeyName: apiKeyName, privateKey: privateKey });
      
      if (!process.env.CDP_PRIVATE_KEY) {
        console.warn('⚠️ CDP credentials not configured - service will be limited');
        return;
      }

      // Use the official Coinbase SDK configuration method with your actual API key
      // From your CDP JSON: id is the API key name, privateKey is the private key
      Coinbase.configure({ 
        apiKeyName: "026e8b3d-053b-48eb-898a-ee8d4658af04",
        privateKey: process.env.CDP_PRIVATE_KEY!
      });

      this.initialized = true;
      console.log('✅ Coinbase CDP service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Coinbase CDP service:', error);
      // Don't throw error - let the service continue without CDP functionality
    }
  }

  private ensureInitialized() {
    if (!this.initialized) {
      throw new Error('CDP service not initialized');
    }
  }

  /**
   * Create a new wallet for a user
   */
  async createWallet(userId: string, network: string = 'base-sepolia'): Promise<CDPWallet> {
    this.ensureInitialized();

    try {
      // Follow the official documentation pattern: const wallet = await Wallet.create();
      const wallet = await Wallet.create({ 
        networkId: network === 'base-mainnet' ? Coinbase.networks.BaseMainnet : Coinbase.networks.BaseSepolia 
      });

      const address = await wallet.getDefaultAddress();
      
      const cdpWallet: CDPWallet = {
        id: wallet.getId(),
        address: address?.getId() || '',
        network: network,
        balance: 0,
        currency: 'ETH',
        created_at: new Date().toISOString(),
        user_id: userId
      };

      console.log(`✅ Created CDP wallet for user ${userId}: ${address.getId()}`);
      return cdpWallet;
    } catch (error) {
      console.error('❌ Failed to create CDP wallet:', error);
      throw new Error('Failed to create CDP wallet');
    }
  }

  /**
   * Get wallet balance for multiple assets
   */
  async getWalletBalances(walletId: string): Promise<{ [currency: string]: number }> {
    this.ensureInitialized();

    try {
      // Follow the official documentation: const resp = await Wallet.listWallets();
      const wallet = await Wallet.fetch(walletId);
      const balances = await wallet.listBalances();
      
      const balanceMap: { [currency: string]: number } = {};
      
      // Convert balances to array and iterate
      const balanceArray = Array.from(balances.values());
      for (const balance of balanceArray) {
        const asset = balance.getAsset();
        const amount = parseFloat(balance.getAmount().toString());
        balanceMap[asset.getAssetId()] = amount;
      }

      return balanceMap;
    } catch (error) {
      console.error(`❌ Failed to get balances for wallet ${walletId}:`, error);
      return {};
    }
  }

  /**
   * Send cryptocurrency to an address
   */
  async sendTransaction(
    walletId: string, 
    toAddress: string, 
    amount: string, 
    currency: string = 'ETH'
  ): Promise<CDPTransaction> {
    this.ensureInitialized();

    try {
      const wallet = await Wallet.fetch(walletId);
      const transfer = await wallet.createTransfer({
        amount: parseFloat(amount),
        assetId: currency === 'ETH' ? Coinbase.assets.Eth : currency === 'USDC' ? Coinbase.assets.Usdc : currency,
        destination: toAddress
      });

      const transaction: CDPTransaction = {
        id: transfer.getId(),
        wallet_id: walletId,
        type: 'send',
        amount: amount,
        currency: currency,
        to_address: toAddress,
        status: 'pending',
        created_at: new Date().toISOString()
      };

      console.log(`✅ Initiated CDP transaction: ${transfer.getId()}`);
      return transaction;
    } catch (error) {
      console.error('❌ Failed to send CDP transaction:', error);
      throw new Error('Failed to send transaction');
    }
  }

  /**
   * Get transaction history for a wallet
   */
  async getTransactionHistory(walletId: string): Promise<CDPTransaction[]> {
    this.ensureInitialized();

    try {
      const wallet = await this.coinbase.getWallet(walletId);
      const transfers = await wallet.listTransfers();
      
      const transactions: CDPTransaction[] = [];
      
      for (const transfer of transfers) {
        const transaction: CDPTransaction = {
          id: transfer.getId(),
          wallet_id: walletId,
          type: transfer.getDestination() ? 'send' : 'receive',
          amount: transfer.getAmount(),
          currency: transfer.getAsset().getAssetId(),
          to_address: transfer.getDestination(),
          from_address: transfer.getFrom(),
          status: this.mapTransferStatus(transfer.getStatus()),
          transaction_hash: transfer.getTransactionHash(),
          created_at: transfer.getCreatedAt(),
          fee: transfer.getFee()
        };
        transactions.push(transaction);
      }

      return transactions;
    } catch (error) {
      console.error(`❌ Failed to get transaction history for wallet ${walletId}:`, error);
      return [];
    }
  }

  /**
   * Get supported networks
   */
  async getSupportedNetworks(): Promise<string[]> {
    return [
      'base-mainnet',
      'base-sepolia',
      'ethereum-mainnet', 
      'ethereum-sepolia',
      'polygon-mainnet',
      'arbitrum-mainnet'
    ];
  }

  /**
   * Get supported assets for a network
   */
  async getSupportedAssets(network: string): Promise<string[]> {
    const assetsByNetwork: { [key: string]: string[] } = {
      'base-mainnet': ['ETH', 'USDC', 'CBETH'],
      'base-sepolia': ['ETH', 'USDC'],
      'ethereum-mainnet': ['ETH', 'USDC', 'USDT', 'WBTC'],
      'ethereum-sepolia': ['ETH', 'USDC'],
      'polygon-mainnet': ['MATIC', 'USDC', 'USDT'],
      'arbitrum-mainnet': ['ETH', 'USDC', 'ARB']
    };

    return assetsByNetwork[network] || ['ETH'];
  }

  private mapTransferStatus(status: string): 'pending' | 'completed' | 'failed' {
    switch (status?.toLowerCase()) {
      case 'complete':
      case 'confirmed':
        return 'completed';
      case 'failed':
      case 'error':
        return 'failed';
      default:
        return 'pending';
    }
  }
}

export const coinbaseCDPService = CoinbaseCDPService.getInstance();