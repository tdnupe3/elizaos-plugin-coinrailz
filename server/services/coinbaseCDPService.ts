/**
 * Coinbase Developer Platform (CDP) Service - Server Wallet v2
 * Provides server-side account management for EVM and Solana networks
 * Following official Server Wallet v2 documentation
 */

import { CdpClient } from '@coinbase/cdp-sdk';

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
  private cdpClient: CdpClient | null = null;
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
      // Server Wallet v2 requires CDP_API_KEY_ID, CDP_API_KEY_SECRET, and CDP_WALLET_SECRET
      if (!process.env.CDP_API_KEY_ID || !process.env.CDP_PRIVATE_KEY || !process.env.CDP_WALLET_SECRET) {
        console.warn('⚠️ CDP Server Wallet credentials not configured - service will be limited');
        console.warn('Required: CDP_API_KEY_ID, CDP_PRIVATE_KEY (as CDP_API_KEY_SECRET), CDP_WALLET_SECRET');
        return;
      }

      // Set environment variables for CdpClient (it reads from env automatically)
      process.env.CDP_API_KEY_SECRET = process.env.CDP_PRIVATE_KEY;

      // Initialize CDP Client for Server Wallet v2
      this.cdpClient = new CdpClient();

      this.initialized = true;
      console.log('✅ Coinbase CDP Server Wallet v2 initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Coinbase CDP Server Wallet:', error);
      // Don't throw error - let the service continue without CDP functionality
    }
  }

  private ensureInitialized() {
    if (!this.initialized) {
      throw new Error('CDP service not initialized');
    }
  }

  /**
   * Create a new EVM account for a user using Server Wallet v2
   */
  async createWallet(userId: string, network: string = 'base-sepolia'): Promise<CDPWallet> {
    this.ensureInitialized();

    if (!this.cdpClient) {
      throw new Error('CDP Client not initialized');
    }

    try {
      // Server Wallet v2 pattern: const account = await cdp.evm.createAccount();
      const account = await this.cdpClient.evm.createAccount();
      
      const cdpWallet: CDPWallet = {
        id: account.address, // Use address as ID for Server Wallet v2
        address: account.address,
        network: network,
        balance: 0,
        currency: 'ETH',
        created_at: new Date().toISOString(),
        user_id: userId
      };

      console.log(`✅ Created CDP Server Wallet account for user ${userId}: ${account.address}`);
      return cdpWallet;
    } catch (error) {
      console.error('❌ Failed to create CDP account:', error);
      throw new Error('Failed to create CDP account');
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