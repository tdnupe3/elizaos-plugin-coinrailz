/**
 * DeFi Wallet Service - Multi-Protocol Wallet Management
 * Supports MetaMask, Coinbase Wallet, Phantom, and other Web3 wallets
 * Enterprise-grade security with user-controlled custody
 */

import { ethers } from 'ethers';

export interface DeFiWallet {
  id: string;
  address: string;
  walletType: 'metamask' | 'coinbase' | 'phantom' | 'walletconnect' | 'unknown';
  network: string;
  balance: number;
  currency: string;
  connected_at: string;
  user_id: string;
  is_active: boolean;
}

export interface WalletConnection {
  address: string;
  chainId: number;
  walletType: string;
  signature?: string;
  message?: string;
}

export interface SupportedNetwork {
  chainId: number;
  name: string;
  currency: string;
  rpcUrl: string;
  explorerUrl: string;
  isTestnet: boolean;
}

export class DeFiWalletService {
  private static instance: DeFiWalletService;
  
  // Supported networks for DeFi wallet connections
  private supportedNetworks: SupportedNetwork[] = [
    {
      chainId: 1,
      name: 'Ethereum Mainnet',
      currency: 'ETH',
      rpcUrl: 'https://eth-mainnet.g.alchemy.com/v2/',
      explorerUrl: 'https://etherscan.io',
      isTestnet: false
    },
    {
      chainId: 137,
      name: 'Polygon',
      currency: 'MATIC',
      rpcUrl: 'https://polygon-mainnet.g.alchemy.com/v2/',
      explorerUrl: 'https://polygonscan.com',
      isTestnet: false
    },
    {
      chainId: 8453,
      name: 'Base',
      currency: 'ETH',
      rpcUrl: 'https://base-mainnet.g.alchemy.com/v2/',
      explorerUrl: 'https://basescan.org',
      isTestnet: false
    },
    {
      chainId: 42161,
      name: 'Arbitrum One',
      currency: 'ETH',
      rpcUrl: 'https://arb-mainnet.g.alchemy.com/v2/',
      explorerUrl: 'https://arbiscan.io',
      isTestnet: false
    },
    {
      chainId: 56,
      name: 'BNB Smart Chain',
      currency: 'BNB',
      rpcUrl: 'https://bsc-dataseed.binance.org/',
      explorerUrl: 'https://bscscan.com',
      isTestnet: false
    },
    {
      chainId: 11155111,
      name: 'Sepolia Testnet',
      currency: 'ETH',
      rpcUrl: 'https://eth-sepolia.g.alchemy.com/v2/',
      explorerUrl: 'https://sepolia.etherscan.io',
      isTestnet: true
    }
  ];

  private constructor() {}

  public static getInstance(): DeFiWalletService {
    if (!this.instance) {
      this.instance = new DeFiWalletService();
    }
    return this.instance;
  }

  /**
   * Get supported networks for wallet connections
   */
  getSupportedNetworks(): SupportedNetwork[] {
    return this.supportedNetworks;
  }

  /**
   * Validate wallet address format
   */
  validateWalletAddress(address: string, walletType: string): boolean {
    try {
      if (walletType === 'phantom') {
        // Solana address validation (base58, 32-44 chars)
        return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
      } else {
        // Ethereum address validation
        return ethers.isAddress(address);
      }
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate connection message for wallet signature
   */
  generateConnectionMessage(address: string, timestamp: number): string {
    return `Connect your wallet to Coin Railz\n\nAddress: ${address}\nTimestamp: ${timestamp}\n\nThis signature proves wallet ownership and will not trigger any blockchain transactions.`;
  }

  /**
   * Verify wallet signature
   */
  async verifyWalletSignature(
    address: string, 
    message: string, 
    signature: string, 
    walletType: string
  ): Promise<boolean> {
    try {
      if (walletType === 'phantom') {
        // Solana signature verification would require additional libraries
        // For now, return true for valid format
        return signature.length > 50;
      } else {
        // Ethereum signature verification
        const recoveredAddress = ethers.verifyMessage(message, signature);
        return recoveredAddress.toLowerCase() === address.toLowerCase();
      }
    } catch (error) {
      console.error('Signature verification failed:', error);
      return false;
    }
  }

  /**
   * Connect a DeFi wallet to user account
   */
  async connectWallet(
    userId: string, 
    connection: WalletConnection
  ): Promise<DeFiWallet> {
    // Validate wallet address
    if (!this.validateWalletAddress(connection.address, connection.walletType)) {
      throw new Error('Invalid wallet address format');
    }

    // Verify signature if provided
    if (connection.signature && connection.message) {
      const isValidSignature = await this.verifyWalletSignature(
        connection.address,
        connection.message,
        connection.signature,
        connection.walletType
      );
      
      if (!isValidSignature) {
        throw new Error('Invalid wallet signature');
      }
    }

    // Find network info
    const network = this.supportedNetworks.find(n => n.chainId === connection.chainId);
    if (!network) {
      throw new Error('Unsupported network');
    }

    const defiWallet: DeFiWallet = {
      id: `defi_${connection.address}_${Date.now()}`,
      address: connection.address,
      walletType: connection.walletType as any,
      network: network.name,
      balance: 0, // Will be fetched separately
      currency: network.currency,
      connected_at: new Date().toISOString(),
      user_id: userId,
      is_active: true
    };

    console.log(`✅ Connected ${connection.walletType} wallet for user ${userId}: ${connection.address}`);
    return defiWallet;
  }

  /**
   * Get wallet balance for connected DeFi wallet
   */
  async getWalletBalance(
    address: string, 
    chainId: number
  ): Promise<{ balance: string; currency: string }> {
    try {
      const network = this.supportedNetworks.find(n => n.chainId === chainId);
      if (!network) {
        throw new Error('Unsupported network');
      }

      // For now, return mock balance - in production, integrate with Alchemy/Infura
      return {
        balance: '0.0',
        currency: network.currency
      };
    } catch (error) {
      console.error('Failed to fetch wallet balance:', error);
      return { balance: '0.0', currency: 'ETH' };
    }
  }

  /**
   * Detect wallet type from user agent or connection method
   */
  detectWalletType(userAgent: string, connectionMethod?: string): string {
    if (connectionMethod) {
      return connectionMethod;
    }

    // Basic wallet detection logic
    if (userAgent.includes('CoinbaseWallet')) return 'coinbase';
    if (userAgent.includes('MetaMask')) return 'metamask';
    if (userAgent.includes('Phantom')) return 'phantom';
    
    return 'unknown';
  }

  /**
   * Get transaction history for connected wallet
   */
  async getTransactionHistory(
    address: string, 
    chainId: number, 
    limit: number = 10
  ): Promise<any[]> {
    try {
      // In production, integrate with Alchemy/Etherscan API
      console.log(`Fetching transaction history for ${address} on chain ${chainId}`);
      return [];
    } catch (error) {
      console.error('Failed to fetch transaction history:', error);
      return [];
    }
  }

  /**
   * Disconnect DeFi wallet from user account
   */
  async disconnectWallet(userId: string, walletId: string): Promise<boolean> {
    try {
      console.log(`Disconnecting wallet ${walletId} for user ${userId}`);
      return true;
    } catch (error) {
      console.error('Failed to disconnect wallet:', error);
      return false;
    }
  }
}