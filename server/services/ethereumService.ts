/**
 * Ethereum Infrastructure Service - Alchemy Integration
 * Production-grade Ethereum blockchain access for DeFi, stablecoins, and RWA tokens
 */

import { ethers } from 'ethers';

export interface EthereumConfig {
  alchemyApiKey: string;
  network: 'mainnet' | 'goerli' | 'sepolia' | 'base';
  maxRetries: number;
  timeoutMs: number;
}

export interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
}

export interface SwapQuote {
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  gasEstimate: string;
  priceImpact: number;
  route: string[];
}

export class EthereumService {
  private provider: ethers.JsonRpcProvider;
  private config: EthereumConfig;

  constructor() {
    this.config = {
      alchemyApiKey: process.env.ALCHEMY_API_KEY || '',
      network: (process.env.ETHEREUM_NETWORK as any) || 'mainnet',
      maxRetries: 3,
      timeoutMs: 10000
    };

    if (!this.config.alchemyApiKey) {
      console.warn('Ethereum service initialized without Alchemy API key - some features will be limited');
      // Initialize with public RPC as fallback
      const publicRpcUrl = this.getPublicRpcUrl();
      this.provider = new ethers.JsonRpcProvider(publicRpcUrl);
    } else {
      const alchemyUrl = this.getAlchemyUrl();
      this.provider = new ethers.JsonRpcProvider(alchemyUrl);
    }
  }

  private getPublicRpcUrl(): string {
    switch (this.config.network) {
      case 'base':
        return 'https://mainnet.base.org';
      case 'mainnet':
        return 'https://ethereum.publicnode.com';
      case 'goerli':
        return 'https://goerli.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161';
      case 'sepolia':
        return 'https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161';
      default:
        return 'https://ethereum.publicnode.com';
    }
  }

  private getAlchemyUrl(): string {
    if (this.config.network === 'base') {
      return `https://base-mainnet.g.alchemy.com/v2/${this.config.alchemyApiKey}`;
    } else {
      return `https://eth-${this.config.network}.g.alchemy.com/v2/${this.config.alchemyApiKey}`;
    }
  }

  /**
   * Get current ETH price in USD
   */
  async getETHPrice(): Promise<number> {
    try {
      // Using a simple price oracle method - in production you'd use Chainlink or similar
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
      const data = await response.json();
      return data.ethereum.usd;
    } catch (error) {
      console.error('Error fetching ETH price:', error);
      throw new Error('Failed to fetch ETH price');
    }
  }

  /**
   * Get token information for ERC-20 tokens
   */
  async getTokenInfo(tokenAddress: string): Promise<TokenInfo> {
    try {
      const contract = new ethers.Contract(
        tokenAddress,
        [
          'function name() view returns (string)',
          'function symbol() view returns (string)', 
          'function decimals() view returns (uint8)',
          'function totalSupply() view returns (uint256)'
        ],
        this.provider
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
      console.error('Error fetching token info:', error);
      throw new Error(`Failed to fetch token info for ${tokenAddress}`);
    }
  }

  /**
   * Get token balance for an address
   */
  async getTokenBalance(tokenAddress: string, walletAddress: string): Promise<string> {
    try {
      const contract = new ethers.Contract(
        tokenAddress,
        ['function balanceOf(address) view returns (uint256)'],
        this.provider
      );

      const balance = await contract.balanceOf(walletAddress);
      return balance.toString();
    } catch (error) {
      console.error('Error fetching token balance:', error);
      throw new Error(`Failed to fetch token balance for ${tokenAddress}`);
    }
  }

  /**
   * Get ETH balance for an address
   */
  async getETHBalance(address: string): Promise<string> {
    try {
      const balance = await this.provider.getBalance(address);
      return ethers.formatEther(balance);
    } catch (error) {
      console.error('Error fetching ETH balance:', error);
      throw new Error(`Failed to fetch ETH balance for ${address}`);
    }
  }

  /**
   * Estimate gas for a transaction
   */
  async estimateGas(transaction: any): Promise<string> {
    try {
      const gasEstimate = await this.provider.estimateGas(transaction);
      return gasEstimate.toString();
    } catch (error) {
      console.error('Error estimating gas:', error);
      throw new Error('Failed to estimate gas');
    }
  }

  /**
   * Get current gas price
   */
  async getGasPrice(): Promise<string> {
    try {
      const feeData = await this.provider.getFeeData();
      return feeData.gasPrice?.toString() || '0';
    } catch (error) {
      console.error('Error fetching gas price:', error);
      throw new Error('Failed to fetch gas price');
    }
  }

  /**
   * Get transaction by hash
   */
  async getTransaction(txHash: string): Promise<any> {
    try {
      const tx = await this.provider.getTransaction(txHash);
      return tx;
    } catch (error) {
      console.error('Error fetching transaction:', error);
      throw new Error(`Failed to fetch transaction ${txHash}`);
    }
  }

  /**
   * Get transaction receipt
   */
  async getTransactionReceipt(txHash: string): Promise<any> {
    try {
      const receipt = await this.provider.getTransactionReceipt(txHash);
      return receipt;
    } catch (error) {
      console.error('Error fetching transaction receipt:', error);
      throw new Error(`Failed to fetch transaction receipt ${txHash}`);
    }
  }

  /**
   * Get current block number
   */
  async getBlockNumber(): Promise<number> {
    try {
      return await this.provider.getBlockNumber();
    } catch (error) {
      console.error('Error fetching block number:', error);
      throw new Error('Failed to fetch block number');
    }
  }

  /**
   * Validate Ethereum address
   */
  isValidAddress(address: string): boolean {
    return ethers.isAddress(address);
  }

  /**
   * Common stablecoin addresses on Ethereum mainnet
   */
  static getStablecoinAddresses() {
    return {
      USDC: '0xA0b86a33E6417c10b1b5C71A9a9F5F7F4b3B7A9D', // Circle USD Coin
      USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7', // Tether USD
      DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F',  // MakerDAO DAI
      FRAX: '0x853d955aCEf822Db058eb8505911ED77F175b99e', // Frax
      LUSD: '0x5f98805A4E8be255a32880FDeC7F6728C6568bA0'  // Liquity USD
    };
  }

  /**
   * Get service status and health
   */
  async getServiceHealth(): Promise<{ status: string; blockNumber: number; gasPrice: string; ethPrice: number }> {
    try {
      const [blockNumber, gasPrice, ethPrice] = await Promise.all([
        this.getBlockNumber(),
        this.getGasPrice(),
        this.getETHPrice()
      ]);

      return {
        status: 'healthy',
        blockNumber,
        gasPrice,
        ethPrice
      };
    } catch (error) {
      console.error('Ethereum service health check failed:', error);
      return {
        status: 'unhealthy',
        blockNumber: 0,
        gasPrice: '0',
        ethPrice: 0
      };
    }
  }
}

// Export singleton instance
export const ethereumService = new EthereumService();