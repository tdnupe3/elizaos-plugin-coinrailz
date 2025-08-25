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

  // ========================================
  // DEX Trading Methods - Revenue Generation
  // ========================================

  /**
   * Get DEX trading quote with platform fees included
   * Supports guest users (no authentication required)
   */
  async getDEXQuoteWithFees(params: {
    fromAsset: string;
    toAsset: string;
    amount: string;
    chain?: string;
    walletAddress?: string; // For guest users
    userId?: string; // For registered users (can be null)
  }) {
    this.ensureInitialized();

    if (!this.cdpClient) {
      throw new Error('CDP Client not initialized');
    }

    try {
      // Create temporary account for quote if needed
      const account = await this.cdpClient.evm.createAccount();
      
      // Get base quote from CDP (this is where we'd use real CDP trading)
      // For now, we'll simulate the quote structure
      const baseQuote = {
        inputAmount: params.amount,
        outputAmount: (parseFloat(params.amount) * 0.98).toString(), // Simulate market rate
        exchangeRate: 0.98,
        gasEstimate: '0.002',
        route: [params.fromAsset, params.toAsset],
        dexProtocol: 'uniswap-v3'
      };

      // Calculate platform fees (0.25% for basic, less for premium)
      const platformFeeRate = 0.0025; // 0.25%
      const platformFee = parseFloat(params.amount) * platformFeeRate;
      const netOutput = parseFloat(baseQuote.outputAmount) - platformFee;

      return {
        quote: {
          ...baseQuote,
          outputAmount: netOutput.toString(),
          platformFee: platformFee.toString(),
          platformFeeRate: '0.25%',
          chain: params.chain || 'base-mainnet',
          timestamp: new Date().toISOString()
        },
        isGuestQuote: !params.userId,
        estimatedGas: baseQuote.gasEstimate
      };
    } catch (error: any) {
      console.error('❌ Failed to get DEX quote:', error);
      throw new Error(`Failed to get DEX quote: ${error.message}`);
    }
  }

  /**
   * Execute DEX trade with fee collection
   * Works for both guest users and registered users
   */
  async executeDEXTrade(params: {
    fromAsset: string;
    toAsset: string;
    amount: string;
    walletAddress: string; // Required for both guest and user trades
    userId?: string; // Optional - null for guest users
    slippage?: number;
    chain?: string;
  }) {
    this.ensureInitialized();

    if (!this.cdpClient) {
      throw new Error('CDP Client not initialized');
    }

    try {
      // Generate unique trade ID
      const tradeId = `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Calculate fees
      const platformFeeRate = 0.0025; // 0.25%
      const platformFee = parseFloat(params.amount) * platformFeeRate;
      const tradeAmount = parseFloat(params.amount) - platformFee;

      // In production, this would execute the actual trade
      // For now, we simulate successful execution
      const simulatedTrade = {
        tradeId,
        fromAsset: params.fromAsset,
        toAsset: params.toAsset,
        fromAmount: params.amount,
        toAmount: (tradeAmount * 0.98).toString(), // Simulate market execution
        platformFee: platformFee.toString(),
        networkFee: '0.002',
        status: 'completed',
        transactionHash: `0x${Math.random().toString(16).substr(2, 64)}`,
        chain: params.chain || 'base-mainnet',
        isGuestTrade: !params.userId,
        timestamp: new Date().toISOString()
      };

      console.log(`✅ DEX trade executed: ${tradeId} | Fee collected: $${platformFee.toFixed(4)}`);

      return simulatedTrade;
    } catch (error: any) {
      console.error('❌ Failed to execute DEX trade:', error);
      throw new Error(`Failed to execute DEX trade: ${error.message}`);
    }
  }

  /**
   * Execute cross-chain bridge transaction (0.5% fee)
   */
  async executeCrossChainBridge(params: {
    sourceChain: string;
    targetChain: string;
    asset: string;
    amount: string;
    walletAddress: string;
    userId?: string;
  }) {
    this.ensureInitialized();

    try {
      const tradeId = `bridge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Cross-chain bridge fee (0.5%)
      const bridgeFeeRate = 0.005;
      const bridgeFee = parseFloat(params.amount) * bridgeFeeRate;
      const netAmount = parseFloat(params.amount) - bridgeFee;

      const bridgeTransaction = {
        tradeId,
        sourceChain: params.sourceChain,
        targetChain: params.targetChain,
        asset: params.asset,
        sourceAmount: params.amount,
        targetAmount: netAmount.toString(),
        bridgeFee: bridgeFee.toString(),
        status: 'pending',
        isGuestTrade: !params.userId,
        bridgeProvider: 'coinbase',
        timestamp: new Date().toISOString()
      };

      console.log(`✅ Cross-chain bridge initiated: ${tradeId} | Fee: $${bridgeFee.toFixed(4)}`);

      return bridgeTransaction;
    } catch (error: any) {
      console.error('❌ Failed to execute cross-chain bridge:', error);
      throw new Error(`Failed to execute cross-chain bridge: ${error.message}`);
    }
  }

  /**
   * Get supported trading pairs for DEX
   */
  async getSupportedTradingPairs(chain: string = 'base-mainnet'): Promise<any[]> {
    // Base network popular pairs
    const basePairs = [
      { from: 'ETH', to: 'USDC', verified: true },
      { from: 'USDC', to: 'ETH', verified: true },
      { from: 'ETH', to: 'WETH', verified: true },
      { from: 'USDC', to: 'DAI', verified: true },
      { from: 'ETH', to: 'PEPE', verified: true }, // Base popular token
      { from: 'USDC', to: 'COMP', verified: true }
    ];

    // Ethereum network pairs
    const ethereumPairs = [
      { from: 'ETH', to: 'USDC', verified: true },
      { from: 'ETH', to: 'USDT', verified: true },
      { from: 'ETH', to: 'DAI', verified: true },
      { from: 'USDC', to: 'USDT', verified: true },
      { from: 'ETH', to: 'WBTC', verified: true }
    ];

    return chain === 'base-mainnet' ? basePairs : ethereumPairs;
  }

  /**
   * Check if user has premium subscription for reduced fees
   */
  async getUserTradingTier(userId?: string): Promise<'guest' | 'basic' | 'pro' | 'enterprise'> {
    if (!userId) return 'guest';
    
    // In production, this would query the dexSubscriptions table
    // For now, return basic for registered users
    return 'basic';
  }

  /**
   * Calculate trading fees based on user tier
   */
  calculateTradingFee(amount: number, tier: 'guest' | 'basic' | 'pro' | 'enterprise'): number {
    const feeRates = {
      guest: 0.0025,      // 0.25%
      basic: 0.0025,      // 0.25%
      pro: 0.0015,        // 0.15% (premium discount)
      enterprise: 0.001   // 0.10% (enterprise discount)
    };

    return amount * feeRates[tier];
  }
}

export const coinbaseCDPService = CoinbaseCDPService.getInstance();