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
   * Get service status for health checks
   */
  async getServiceStatus() {
    return {
      initialized: this.initialized,
      clientActive: !!this.cdpClient,
      hasCredentials: !!(process.env.CDP_API_KEY_ID && process.env.CDP_PRIVATE_KEY),
      network: 'base-mainnet'
    };
  }

  /**
   * List user wallets (placeholder for database integration)
   */
  async listUserWallets(userId: string): Promise<CDPWallet[]> {
    // In production, this would query the database for user's CDP wallets
    // For now, return empty array as we don't have wallet persistence yet
    console.log(`📋 Listing CDP wallets for user: ${userId}`);
    return [];
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
    } catch (error: any) {
      console.error('❌ Failed to create CDP wallet:', error);
      throw new Error(`Failed to create CDP wallet: ${error.message}`);
    }
  }

  /**
   * Get wallet balance for a specific wallet
   */
  async getWalletBalance(walletId: string, network: string = 'base-mainnet'): Promise<any> {
    this.ensureInitialized();

    // For now, return mock balance data
    // In production, this would query the actual CDP wallet balance
    return {
      walletId,
      network,
      balance: '0.00',
      currency: 'ETH',
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Get supported networks for CDP wallets
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
}

export const coinbaseCDPService = CoinbaseCDPService.getInstance();