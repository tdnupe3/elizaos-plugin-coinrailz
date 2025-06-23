/**
 * BNB Chain (Binance Smart Chain) Infrastructure Service
 * Production-grade BSC blockchain access for BEP-20 tokens and DeFi
 */

import { ethers } from 'ethers';

export interface BNBConfig {
  network: 'mainnet' | 'testnet';
  maxRetries: number;
  timeoutMs: number;
  featureFlag: boolean;
}

export interface BEP20TokenInfo {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
}

export interface BNBSwapQuote {
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  gasEstimate: string;
  priceImpact: number;
  route: string[];
}

// Popular BEP-20 token addresses on BSC mainnet
export const POPULAR_BEP20_TOKENS = {
  USDT: '0x55d398326f99059fF775485246999027B3197955',
  USDC: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
  BUSD: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
  CAKE: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82',
  WBNB: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c'
};

export class BNBChainService {
  private provider: ethers.JsonRpcProvider;
  private fallbackProvider: ethers.JsonRpcProvider;
  private config: BNBConfig;

  constructor() {
    this.config = {
      network: (process.env.BNB_NETWORK as any) || 'mainnet',
      maxRetries: 3,
      timeoutMs: 10000,
      featureFlag: process.env.BNB_CHAIN_ENABLED !== 'false' // Default enabled
    };

    // Primary RPC endpoint
    const primaryRpcUrl = this.getPrimaryRpcUrl();
    this.provider = new ethers.JsonRpcProvider(primaryRpcUrl);

    // Fallback RPC endpoint  
    const fallbackRpcUrl = this.getFallbackRpcUrl();
    this.fallbackProvider = new ethers.JsonRpcProvider(fallbackRpcUrl);

    console.log('✅ BNB Chain service initialized:', {
      network: this.config.network,
      enabled: this.config.featureFlag
    });
  }

  private getPrimaryRpcUrl(): string {
    switch (this.config.network) {
      case 'mainnet':
        return 'https://bsc-dataseed.binance.org/';
      case 'testnet':
        return 'https://data-seed-prebsc-1-s1.binance.org:8545/';
      default:
        return 'https://bsc-dataseed.binance.org/';
    }
  }

  private getFallbackRpcUrl(): string {
    switch (this.config.network) {
      case 'mainnet':
        return 'https://bsc-dataseed1.defibit.io/';
      case 'testnet':
        return 'https://data-seed-prebsc-2-s1.binance.org:8545/';
      default:
        return 'https://bsc-dataseed1.defibit.io/';
    }
  }

  /**
   * Circuit breaker pattern - try primary, fallback to secondary
   */
  private async executeWithFallback<T>(operation: (provider: ethers.JsonRpcProvider) => Promise<T>): Promise<T> {
    if (!this.config.featureFlag) {
      throw new Error('BNB Chain service is currently disabled');
    }

    try {
      return await operation(this.provider);
    } catch (error) {
      console.warn('Primary BNB RPC failed, trying fallback:', error);
      try {
        return await operation(this.fallbackProvider);
      } catch (fallbackError) {
        console.error('Both BNB RPC endpoints failed:', fallbackError);
        throw new Error('BNB Chain service temporarily unavailable');
      }
    }
  }

  /**
   * Get current BNB price in USD
   */
  async getBNBPrice(): Promise<number> {
    try {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd');
      const data = await response.json();
      return data.binancecoin.usd;
    } catch (error) {
      console.error('Error fetching BNB price:', error);
      throw new Error('Failed to fetch BNB price');
    }
  }

  /**
   * Get BEP-20 token information
   */
  async getTokenInfo(tokenAddress: string): Promise<BEP20TokenInfo> {
    return this.executeWithFallback(async (provider) => {
      try {
        const contract = new ethers.Contract(
          tokenAddress,
          [
            'function name() view returns (string)',
            'function symbol() view returns (string)', 
            'function decimals() view returns (uint8)',
            'function totalSupply() view returns (uint256)'
          ],
          provider
        );

        const [name, symbol, decimals, totalSupply] = await Promise.all([
          contract.name(),
          contract.symbol(),
          contract.decimals(),
          contract.totalSupply()
        ]);

        return {
          address: tokenAddress,
          name,
          symbol,
          decimals,
          totalSupply: totalSupply.toString()
        };
      } catch (error) {
        console.error('Error fetching BEP-20 token info:', error);
        throw new Error(`Failed to fetch token info for ${tokenAddress}`);
      }
    });
  }

  /**
   * Get BEP-20 token balance for an address
   */
  async getTokenBalance(tokenAddress: string, walletAddress: string): Promise<string> {
    return this.executeWithFallback(async (provider) => {
      try {
        const contract = new ethers.Contract(
          tokenAddress,
          ['function balanceOf(address) view returns (uint256)'],
          provider
        );

        const balance = await contract.balanceOf(walletAddress);
        return balance.toString();
      } catch (error) {
        console.error('Error fetching BEP-20 token balance:', error);
        throw new Error(`Failed to fetch token balance for ${tokenAddress}`);
      }
    });
  }

  /**
   * Get BNB balance for an address
   */
  async getBNBBalance(address: string): Promise<string> {
    return this.executeWithFallback(async (provider) => {
      try {
        const balance = await provider.getBalance(address);
        return ethers.formatEther(balance);
      } catch (error) {
        console.error('Error fetching BNB balance:', error);
        throw new Error(`Failed to fetch BNB balance for ${address}`);
      }
    });
  }

  /**
   * Estimate gas for a transaction (much lower than Ethereum)
   */
  async estimateGas(transaction: any): Promise<string> {
    return this.executeWithFallback(async (provider) => {
      try {
        const gasEstimate = await provider.estimateGas(transaction);
        return gasEstimate.toString();
      } catch (error) {
        console.error('Error estimating BNB gas:', error);
        throw new Error('Failed to estimate gas');
      }
    });
  }

  /**
   * Get current gas price (typically 5 gwei on BSC vs 20-50+ on Ethereum)
   */
  async getGasPrice(): Promise<string> {
    return this.executeWithFallback(async (provider) => {
      try {
        const feeData = await provider.getFeeData();
        return feeData.gasPrice?.toString() || '5000000000'; // 5 gwei default
      } catch (error) {
        console.error('Error fetching BNB gas price:', error);
        throw new Error('Failed to fetch gas price');
      }
    });
  }

  /**
   * Get transaction by hash
   */
  async getTransaction(txHash: string): Promise<any> {
    return this.executeWithFallback(async (provider) => {
      try {
        const tx = await provider.getTransaction(txHash);
        return tx;
      } catch (error) {
        console.error('Error fetching BNB transaction:', error);
        throw new Error(`Failed to fetch transaction ${txHash}`);
      }
    });
  }

  /**
   * Get transaction receipt
   */
  async getTransactionReceipt(txHash: string): Promise<any> {
    return this.executeWithFallback(async (provider) => {
      try {
        const receipt = await provider.getTransactionReceipt(txHash);
        return receipt;
      } catch (error) {
        console.error('Error fetching BNB transaction receipt:', error);
        throw new Error(`Failed to fetch transaction receipt ${txHash}`);
      }
    });
  }

  /**
   * Validate BNB/BSC address
   */
  isValidAddress(address: string): boolean {
    try {
      return ethers.isAddress(address);
    } catch {
      return false;
    }
  }

  /**
   * Get network information
   */
  async getNetworkInfo(): Promise<any> {
    return this.executeWithFallback(async (provider) => {
      try {
        const network = await provider.getNetwork();
        const blockNumber = await provider.getBlockNumber();
        const gasPrice = await this.getGasPrice();

        return {
          chainId: Number(network.chainId),
          name: network.name,
          blockNumber,
          gasPrice,
          avgBlockTime: 3, // BSC ~3 second blocks
          nativeToken: 'BNB'
        };
      } catch (error) {
        console.error('Error fetching BNB network info:', error);
        throw new Error('Failed to fetch network information');
      }
    });
  }

  /**
   * Health check for BNB Chain service
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; details: any }> {
    try {
      const startTime = Date.now();
      
      // Test both primary and fallback providers
      const [primaryNetwork, fallbackNetwork] = await Promise.allSettled([
        this.provider.getNetwork(),
        this.fallbackProvider.getNetwork()
      ]);

      const responseTime = Date.now() - startTime;
      const primaryHealthy = primaryNetwork.status === 'fulfilled';
      const fallbackHealthy = fallbackNetwork.status === 'fulfilled';

      let status: 'healthy' | 'degraded' | 'unhealthy';
      if (primaryHealthy && fallbackHealthy) {
        status = 'healthy';
      } else if (primaryHealthy || fallbackHealthy) {
        status = 'degraded';
      } else {
        status = 'unhealthy';
      }

      return {
        status,
        details: {
          enabled: this.config.featureFlag,
          network: this.config.network,
          responseTime,
          primaryRPC: primaryHealthy,
          fallbackRPC: fallbackHealthy,
          chainId: primaryHealthy ? Number((primaryNetwork as any).value.chainId) : null
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          enabled: this.config.featureFlag,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  /**
   * Get popular BEP-20 token addresses
   */
  getPopularTokens(): typeof POPULAR_BEP20_TOKENS {
    return POPULAR_BEP20_TOKENS;
  }
}

// Create singleton instance
export const bnbChainService = new BNBChainService();