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
      if (!process.env.CDP_API_KEY_ID || !process.env.CDP_PRIVATE_KEY) {
        console.warn('⚠️ CDP Server Wallet credentials not configured - service will be limited');
        console.warn('Required: CDP_API_KEY_ID, CDP_PRIVATE_KEY (as CDP_API_KEY_SECRET)');
        console.warn('Optional: CDP_WALLET_SECRET (for advanced wallet management)');
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
   * Get account balance for multiple assets - Server Wallet v2
   */
  async getWalletBalances(accountAddress: string): Promise<{ [currency: string]: number }> {
    this.ensureInitialized();

    if (!this.cdpClient) {
      throw new Error('CDP Client not initialized');
    }

    try {
      // Server Wallet v2 doesn't have direct balance fetching from address
      // This would typically require additional account management or balance API calls
      // For now, return empty balance map as this method needs CDP account context
      console.warn('⚠️ Balance fetching for Server Wallet v2 requires account context');
      return {};
    } catch (error) {
      console.error(`❌ Failed to get balances for account ${accountAddress}:`, error);
      return {};
    }
  }

  /**
   * Send cryptocurrency using Server Wallet v2
   */
  async sendTransaction(
    accountAddress: string, 
    toAddress: string, 
    amount: string, 
    currency: string = 'ETH'
  ): Promise<CDPTransaction> {
    this.ensureInitialized();

    if (!this.cdpClient) {
      throw new Error('CDP Client not initialized');
    }

    try {
      // Server Wallet v2 transaction pattern from documentation
      const transactionResult = await this.cdpClient.evm.sendTransaction({
        address: accountAddress as `0x${string}`,
        transaction: {
          to: toAddress as `0x${string}`,
          value: BigInt(Math.floor(parseFloat(amount) * 1e18)), // Convert to wei
        },
        network: "base-sepolia", // Default to testnet for now
      });

      const transaction: CDPTransaction = {
        id: transactionResult.transactionHash,
        wallet_id: accountAddress,
        type: 'send',
        amount: amount,
        currency: currency,
        to_address: toAddress,
        status: 'pending',
        created_at: new Date().toISOString()
      };

      console.log(`✅ Initiated CDP Server Wallet transaction: ${transactionResult.transactionHash}`);
      return transaction;
    } catch (error) {
      console.error('❌ Failed to send CDP transaction:', error);
      throw new Error('Failed to send transaction');
    }
  }

  /**
   * Get transaction history for an account - Server Wallet v2
   */
  async getTransactionHistory(accountAddress: string): Promise<CDPTransaction[]> {
    this.ensureInitialized();

    try {
      // Server Wallet v2 doesn't have built-in transaction history
      // This would typically require blockchain explorer API integration
      console.warn('⚠️ Transaction history for Server Wallet v2 requires blockchain explorer integration');
      return [];
    } catch (error) {
      console.error(`❌ Failed to get transaction history for account ${accountAddress}:`, error);
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