/**
 * Coinbase DeFi Wallet Service - Coinbase Wallet SDK Integration
 * Enterprise-grade Coinbase self-custody wallets with advanced features
 * Supports both Coinbase Wallet mobile app and browser extension
 */

import { ethers } from 'ethers';

export interface CoinbaseDefiWallet {
  id: string;
  address: string;
  walletType: 'coinbase-defi' | 'coinbase-smart';
  network: string;
  balance: number;
  currency: string;
  connected_at: string;
  user_id: string;
  is_active: boolean;
  features: {
    canSwap: boolean;
    canStake: boolean;
    canBridge: boolean;
    hasAdvancedSecurity: boolean;
  };
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

export class CoinbaseDefiWalletService {
  private static instance: CoinbaseDefiWalletService;
  
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

  public static getInstance(): CoinbaseDefiWalletService {
    if (!this.instance) {
      this.instance = new CoinbaseDefiWalletService();
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
   * Validate Coinbase wallet address format
   */
  validateCoinbaseWalletAddress(address: string): boolean {
    try {
      // Coinbase wallets use standard Ethereum addresses
      return ethers.isAddress(address);
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate connection message for Coinbase wallet signature
   */
  generateCoinbaseConnectionMessage(address: string, timestamp: number): string {
    return `Connect your Coinbase Wallet to Coin Railz\n\nAddress: ${address}\nTimestamp: ${timestamp}\nPlatform: Coin Railz - AI-Powered Fintech\n\nThis signature proves wallet ownership and enables advanced DeFi features.\nNo blockchain transactions will be triggered.`;
  }

  /**
   * Verify Coinbase wallet signature with enhanced security
   */
  async verifyCoinbaseSignature(
    address: string, 
    message: string, 
    signature: string
  ): Promise<boolean> {
    try {
      // Ethereum signature verification for Coinbase wallets
      const recoveredAddress = ethers.verifyMessage(message, signature);
      const isValid = recoveredAddress.toLowerCase() === address.toLowerCase();
      
      if (isValid) {
        console.log(`✅ Coinbase wallet signature verified for address: ${address}`);
      } else {
        console.warn(`❌ Invalid Coinbase wallet signature for address: ${address}`);
      }
      
      return isValid;
    } catch (error) {
      console.error('Coinbase wallet signature verification failed:', error);
      return false;
    }
  }

  /**
   * Connect a Coinbase DeFi wallet to user account
   */
  async connectCoinbaseWallet(
    userId: string, 
    connection: WalletConnection
  ): Promise<CoinbaseDefiWallet> {
    // Validate Coinbase wallet address
    if (!this.validateCoinbaseWalletAddress(connection.address)) {
      throw new Error('Invalid Coinbase wallet address format');
    }

    // Verify signature (required for security)
    if (!connection.signature || !connection.message) {
      throw new Error('Wallet signature required for Coinbase wallet connection');
    }

    const isValidSignature = await this.verifyCoinbaseSignature(
      connection.address,
      connection.message,
      connection.signature
    );
    
    if (!isValidSignature) {
      throw new Error('Invalid Coinbase wallet signature');
    }

    // Find network info
    const network = this.supportedNetworks.find(n => n.chainId === connection.chainId);
    if (!network) {
      throw new Error('Unsupported network');
    }

    // Determine wallet type and features based on connection method
    const walletType = connection.walletType === 'coinbase-smart' ? 'coinbase-smart' : 'coinbase-defi';
    
    const coinbaseWallet: CoinbaseDefiWallet = {
      id: `coinbase_${connection.address}_${Date.now()}`,
      address: connection.address,
      walletType: walletType as any,
      network: network.name,
      balance: 0, // Will be fetched separately
      currency: network.currency,
      connected_at: new Date().toISOString(),
      user_id: userId,
      is_active: true,
      features: {
        canSwap: true,      // Coinbase wallets support native swapping
        canStake: true,     // Supports staking protocols
        canBridge: true,    // Cross-chain bridging
        hasAdvancedSecurity: true // Enhanced security features
      }
    };

    console.log(`✅ Connected Coinbase ${walletType} wallet for user ${userId}: ${connection.address}`);
    return coinbaseWallet;
  }

  /**
   * Get wallet balance for connected Coinbase wallet using Alchemy integration
   */
  async getCoinbaseWalletBalance(
    address: string, 
    chainId: number
  ): Promise<{ balance: string; currency: string; usdValue?: string }> {
    try {
      const network = this.supportedNetworks.find(n => n.chainId === chainId);
      if (!network) {
        throw new Error('Unsupported network');
      }

      // TODO: Integrate with Alchemy for real balance data
      // const provider = new ethers.providers.JsonRpcProvider(network.rpcUrl);
      // const balance = await provider.getBalance(address);
      // const formattedBalance = ethers.utils.formatEther(balance);

      // For now, return placeholder - will be updated with real Alchemy integration
      return {
        balance: '0.0',
        currency: network.currency,
        usdValue: '0.00'
      };
    } catch (error) {
      console.error('Failed to fetch Coinbase wallet balance:', error);
      return { 
        balance: '0.0', 
        currency: 'ETH',
        usdValue: '0.00'
      };
    }
  }

  /**
   * Detect Coinbase wallet type and capabilities
   */
  detectCoinbaseWalletType(userAgent: string, connectionMethod?: string): string {
    if (connectionMethod) {
      return connectionMethod;
    }

    // Coinbase wallet detection logic
    if (userAgent.includes('CoinbaseWallet')) {
      return 'coinbase-defi';
    }
    if (userAgent.includes('Coinbase')) {
      return 'coinbase-smart';
    }
    
    return 'coinbase-defi'; // Default to DeFi wallet
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
   * Disconnect Coinbase wallet from user account
   */
  async disconnectCoinbaseWallet(userId: string, walletId: string): Promise<boolean> {
    try {
      console.log(`✅ Disconnecting Coinbase wallet ${walletId} for user ${userId}`);
      // TODO: Add database cleanup logic here
      return true;
    } catch (error) {
      console.error('❌ Failed to disconnect Coinbase wallet:', error);
      return false;
    }
  }

  /**
   * Get Coinbase wallet features and capabilities
   */
  getCoinbaseWalletFeatures(walletType: string) {
    const baseFeatures = {
      canSwap: true,
      canStake: true,
      canBridge: true,
      hasAdvancedSecurity: true,
      supportedNetworks: this.supportedNetworks.filter(n => !n.isTestnet),
      nativeIntegrations: [
        'Uniswap V3',
        'Compound',
        'Aave',
        'Curve Finance',
        'Balancer'
      ]
    };

    if (walletType === 'coinbase-smart') {
      return {
        ...baseFeatures,
        hasSmartAccountFeatures: true,
        supportsBatchTransactions: true,
        hasGasOptimization: true
      };
    }

    return baseFeatures;
  }
}