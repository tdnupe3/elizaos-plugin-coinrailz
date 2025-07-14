/**
 * Circle USDC Integration Service
 * Implements comprehensive Circle Developer-Controlled Wallets integration
 */

import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';
import { registerEntitySecretCiphertext } from '@circle-fin/developer-controlled-wallets';
import forge from 'node-forge';
import crypto from 'crypto';

interface CircleConfig {
  apiKey: string;
  entitySecret: string;
  baseUrl?: string;
}

interface CircleWallet {
  id: string;
  walletSetId: string;
  blockchain: string;
  address: string;
  accountType: 'SCA' | 'EOA';
  state: 'LIVE' | 'PENDING' | 'FAILED';
  createDate: string;
  updateDate: string;
}

interface CircleWalletSet {
  id: string;
  custodyType: 'DEVELOPER';
  name: string;
  wallets: CircleWallet[];
  createDate: string;
  updateDate: string;
}

interface CircleBalance {
  tokenId: string;
  amount: string;
  blockchain: string;
}

interface CircleTransaction {
  id: string;
  walletId: string;
  sourceAddress: string;
  destinationAddress: string;
  tokenId: string;
  amount: string;
  transactionType: 'INBOUND' | 'OUTBOUND';
  state: 'PENDING' | 'CONFIRMED' | 'FAILED';
  blockchain: string;
  txHash?: string;
  createDate: string;
  updateDate: string;
}

class CircleService {
  private client: any;
  private config: CircleConfig;
  private entitySecretRegistered: boolean = false;

  constructor() {
    this.config = {
      apiKey: process.env.CIRCLE_API_KEY || '',
      entitySecret: process.env.CIRCLE_ENTITY_SECRET || '',
      baseUrl: process.env.CIRCLE_BASE_URL || 'https://api.circle.com'
    };

    if (!this.config.apiKey) {
      throw new Error('CIRCLE_API_KEY environment variable is required');
    }

    // Initialize client only if entity secret exists
    if (this.config.entitySecret) {
      this.initializeClient();
    }
  }

  /**
   * Initialize Circle client with API key and entity secret
   */
  private initializeClient() {
    try {
      this.client = initiateDeveloperControlledWalletsClient({
        apiKey: this.config.apiKey,
        entitySecret: this.config.entitySecret,
        baseUrl: this.config.baseUrl
      });
      this.entitySecretRegistered = true;
    } catch (error) {
      console.error('Failed to initialize Circle client:', error);
      throw error;
    }
  }

  /**
   * Generate a new 32-byte entity secret
   */
  public static generateEntitySecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Get public key for entity secret encryption
   */
  public async getPublicKey(): Promise<string> {
    if (!this.client) {
      throw new Error('Circle client not initialized. Entity secret required.');
    }

    try {
      const response = await this.client.getPublicKey();
      return response.data.publicKey;
    } catch (error) {
      console.error('Failed to get public key:', error);
      throw error;
    }
  }

  /**
   * Encrypt entity secret with Circle's public key
   */
  public static encryptEntitySecret(entitySecret: string, publicKey: string): string {
    try {
      const entitySecretBytes = forge.util.hexToBytes(entitySecret);
      const publicKeyObj = forge.pki.publicKeyFromPem(publicKey);
      
      const encryptedData = publicKeyObj.encrypt(entitySecretBytes, 'RSA-OAEP', {
        md: forge.md.sha256.create(),
        mgf1: { md: forge.md.sha256.create() }
      });

      return forge.util.encode64(encryptedData);
    } catch (error) {
      console.error('Failed to encrypt entity secret:', error);
      throw error;
    }
  }

  /**
   * Register entity secret with Circle
   */
  public async registerEntitySecret(entitySecret: string): Promise<{ recoveryFile: any }> {
    try {
      const response = await registerEntitySecretCiphertext({
        apiKey: this.config.apiKey,
        entitySecret: entitySecret
      });

      // Store entity secret in environment for future use
      process.env.CIRCLE_ENTITY_SECRET = entitySecret;
      this.config.entitySecret = entitySecret;
      
      // Initialize client now that we have entity secret
      this.initializeClient();

      return {
        recoveryFile: response.data?.recoveryFile
      };
    } catch (error) {
      console.error('Failed to register entity secret:', error);
      throw error;
    }
  }

  /**
   * Create a new wallet set
   */
  public async createWalletSet(name: string = 'CoinRailz Wallet Set'): Promise<CircleWalletSet> {
    if (!this.client) {
      throw new Error('Circle client not initialized. Entity secret required.');
    }

    try {
      const response = await this.client.createWalletSet({
        name: name
      });

      return response.data.walletSet;
    } catch (error) {
      console.error('Failed to create wallet set:', error);
      throw error;
    }
  }

  /**
   * Create a new wallet within a wallet set
   */
  public async createWallet(
    walletSetId: string, 
    blockchain: string = 'ETH',
    accountType: 'SCA' | 'EOA' = 'SCA'
  ): Promise<CircleWallet> {
    if (!this.client) {
      throw new Error('Circle client not initialized. Entity secret required.');
    }

    try {
      const response = await this.client.createWallet({
        walletSetId: walletSetId,
        blockchains: [blockchain],
        accountType: accountType
      });

      return response.data.wallet;
    } catch (error) {
      console.error('Failed to create wallet:', error);
      throw error;
    }
  }

  /**
   * Get wallet balance
   */
  public async getWalletBalance(walletId: string): Promise<CircleBalance[]> {
    if (!this.client) {
      throw new Error('Circle client not initialized. Entity secret required.');
    }

    try {
      const response = await this.client.getWalletBalance({
        walletId: walletId
      });

      return response.data.balances || [];
    } catch (error) {
      console.error('Failed to get wallet balance:', error);
      throw error;
    }
  }

  /**
   * Get wallet details
   */
  public async getWallet(walletId: string): Promise<CircleWallet> {
    if (!this.client) {
      throw new Error('Circle client not initialized. Entity secret required.');
    }

    try {
      const response = await this.client.getWallet({
        walletId: walletId
      });

      return response.data.wallet;
    } catch (error) {
      console.error('Failed to get wallet:', error);
      throw error;
    }
  }

  /**
   * List all wallets in a wallet set
   */
  public async listWallets(walletSetId: string): Promise<CircleWallet[]> {
    if (!this.client) {
      throw new Error('Circle client not initialized. Entity secret required.');
    }

    try {
      const response = await this.client.listWallets({
        walletSetId: walletSetId
      });

      return response.data.wallets || [];
    } catch (error) {
      console.error('Failed to list wallets:', error);
      throw error;
    }
  }

  /**
   * Create a USDC transfer transaction
   */
  public async createTransfer(
    walletId: string,
    destinationAddress: string,
    amount: string,
    tokenId: string = 'USDC'
  ): Promise<CircleTransaction> {
    if (!this.client) {
      throw new Error('Circle client not initialized. Entity secret required.');
    }

    try {
      const response = await this.client.createTransaction({
        walletId: walletId,
        destinationAddress: destinationAddress,
        amounts: [amount],
        tokenId: tokenId
      });

      return response.data.transaction;
    } catch (error) {
      console.error('Failed to create transfer:', error);
      throw error;
    }
  }

  /**
   * Get transaction details
   */
  public async getTransaction(transactionId: string): Promise<CircleTransaction> {
    if (!this.client) {
      throw new Error('Circle client not initialized. Entity secret required.');
    }

    try {
      const response = await this.client.getTransaction({
        id: transactionId
      });

      return response.data.transaction;
    } catch (error) {
      console.error('Failed to get transaction:', error);
      throw error;
    }
  }

  /**
   * List transactions for a wallet
   */
  public async listTransactions(walletId: string): Promise<CircleTransaction[]> {
    if (!this.client) {
      throw new Error('Circle client not initialized. Entity secret required.');
    }

    try {
      const response = await this.client.listTransactions({
        walletId: walletId
      });

      return response.data.transactions || [];
    } catch (error) {
      console.error('Failed to list transactions:', error);
      throw error;
    }
  }

  /**
   * Get supported blockchains
   */
  public async getSupportedBlockchains(): Promise<string[]> {
    // Circle supports these blockchains for developer-controlled wallets
    return ['ETH', 'MATIC', 'AVAX', 'ARB'];
  }

  /**
   * Get supported tokens
   */
  public async getSupportedTokens(): Promise<any[]> {
    // Circle primarily supports USDC across all chains
    return [
      { symbol: 'USDC', name: 'USD Coin', blockchain: 'ETH' },
      { symbol: 'USDC', name: 'USD Coin', blockchain: 'MATIC' },
      { symbol: 'USDC', name: 'USD Coin', blockchain: 'AVAX' },
      { symbol: 'USDC', name: 'USD Coin', blockchain: 'ARB' }
    ];
  }

  /**
   * Check if service is properly initialized
   */
  public isInitialized(): boolean {
    return this.entitySecretRegistered && !!this.client;
  }

  /**
   * Get service health status
   */
  public getHealthStatus(): any {
    return {
      initialized: this.isInitialized(),
      entitySecretRegistered: this.entitySecretRegistered,
      hasApiKey: !!this.config.apiKey,
      hasEntitySecret: !!this.config.entitySecret,
      supportedBlockchains: ['ETH', 'MATIC', 'AVAX', 'ARB'],
      supportedTokens: ['USDC']
    };
  }
}

export default CircleService;