/**
 * PulseChain Integration Service
 * Safe implementation following BNB Chain patterns
 * Chain ID: 369, Native Token: PLS
 */

interface PulseChainConfig {
  enabled: boolean;
  network: string;
  chainId: number;
  primaryRPC: string;
  fallbackRPC: string;
  nativeToken: string;
}

interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
}

interface PulseChainResponse {
  success: boolean;
  data?: any;
  error?: string;
  source?: 'primary' | 'fallback';
}

class PulseChainService {
  private config: PulseChainConfig;
  private currentRPC: string;
  private circuitBreakerCount: number = 0;
  private readonly maxFailures: number = 3;
  private lastFailureTime: number = 0;
  private readonly cooldownPeriod: number = 30000; // 30 seconds

  constructor() {
    this.config = {
      enabled: process.env.PULSE_CHAIN_ENABLED !== 'false',
      network: 'mainnet',
      chainId: 369,
      primaryRPC: 'https://rpc.pulsechain.com',
      fallbackRPC: 'https://rpc-pulsechain.g4mm4.io',
      nativeToken: 'PLS'
    };
    this.currentRPC = this.config.primaryRPC;
  }

  /**
   * Popular PRC-20 tokens on PulseChain
   */
  private readonly POPULAR_PRC20_TOKENS: Record<string, TokenInfo> = {
    WPLS: {
      address: '0xA1077a294dDE1B09bB078844df40758a5D0f9a27',
      symbol: 'WPLS',
      name: 'Wrapped PLS',
      decimals: 18
    },
    PLSX: {
      address: '0x95B303987A60C71504D99Aa1b13B4DA07b0790ab',
      symbol: 'PLSX',
      name: 'PulseX',
      decimals: 18
    },
    HEX: {
      address: '0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39',
      symbol: 'HEX',
      name: 'HEX',
      decimals: 8
    },
    INC: {
      address: '0x2fa878Ab3F87CC1C9737Fc071108F904c0B0C95d',
      symbol: 'INC',
      name: 'Incentive',
      decimals: 18
    }
  };

  /**
   * Check if PulseChain service is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Get network configuration
   */
  getConfig(): PulseChainConfig {
    return { ...this.config };
  }

  /**
   * Circuit breaker: Check if we should attempt RPC calls
   */
  private canMakeRequest(): boolean {
    if (this.circuitBreakerCount < this.maxFailures) {
      return true;
    }

    const now = Date.now();
    if (now - this.lastFailureTime > this.cooldownPeriod) {
      this.circuitBreakerCount = 0;
      return true;
    }

    return false;
  }

  /**
   * Handle RPC failure and circuit breaker logic
   */
  private handleRPCFailure(): void {
    this.circuitBreakerCount++;
    this.lastFailureTime = Date.now();

    // Switch to fallback RPC if primary fails
    if (this.currentRPC === this.config.primaryRPC) {
      this.currentRPC = this.config.fallbackRPC;
      console.log('🔄 PulseChain: Switching to fallback RPC');
    }
  }

  /**
   * Make RPC request with circuit breaker and fallback
   */
  private async makeRPCRequest(method: string, params: any[] = []): Promise<PulseChainResponse> {
    if (!this.isEnabled()) {
      return { success: false, error: 'PulseChain service is disabled' };
    }

    if (!this.canMakeRequest()) {
      return { success: false, error: 'Circuit breaker open - service temporarily unavailable' };
    }

    const payload = {
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params
    };

    try {
      const response = await fetch(this.currentRPC, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });

      if (!response.ok) {
        throw new Error(`RPC request failed: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error.message || 'RPC error');
      }

      // Reset circuit breaker on success
      this.circuitBreakerCount = 0;
      
      return {
        success: true,
        data: data.result,
        source: this.currentRPC === this.config.primaryRPC ? 'primary' : 'fallback'
      };

    } catch (error) {
      console.error(`PulseChain RPC Error (${this.currentRPC}):`, error);
      this.handleRPCFailure();
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown RPC error'
      };
    }
  }

  /**
   * Get PulseChain network information
   */
  async getNetworkInfo(): Promise<PulseChainResponse> {
    try {
      const [chainId, blockNumber, gasPrice] = await Promise.all([
        this.makeRPCRequest('eth_chainId'),
        this.makeRPCRequest('eth_blockNumber'),
        this.makeRPCRequest('eth_gasPrice')
      ]);

      if (!chainId.success || !blockNumber.success || !gasPrice.success) {
        return { success: false, error: 'Failed to fetch network info' };
      }

      return {
        success: true,
        data: {
          chainId: parseInt(chainId.data, 16),
          blockNumber: parseInt(blockNumber.data, 16),
          gasPrice: parseInt(gasPrice.data, 16),
          network: this.config.network,
          nativeToken: this.config.nativeToken
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network info request failed'
      };
    }
  }

  /**
   * Get PLS price from CoinGecko
   */
  async getPLSPrice(): Promise<PulseChainResponse> {
    try {
      const response = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=pulsechain&vs_currencies=usd',
        { signal: AbortSignal.timeout(5000) }
      );

      if (!response.ok) {
        throw new Error(`Price API failed: ${response.status}`);
      }

      const data = await response.json();
      const price = data.pulsechain?.usd;

      if (!price) {
        throw new Error('PLS price not found in response');
      }

      return {
        success: true,
        data: {
          symbol: 'PLS',
          price: price,
          currency: 'USD',
          source: 'coingecko',
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Price fetch failed'
      };
    }
  }

  /**
   * Get popular PRC-20 tokens
   */
  getPopularTokens(): TokenInfo[] {
    return Object.values(this.POPULAR_PRC20_TOKENS);
  }

  /**
   * Validate PulseChain address
   */
  validateAddress(address: string): boolean {
    if (!address || typeof address !== 'string') {
      return false;
    }

    // EVM address validation (same as Ethereum)
    const addressRegex = /^0x[a-fA-F0-9]{40}$/;
    return addressRegex.test(address);
  }

  /**
   * Get service health status
   */
  async getHealth(): Promise<PulseChainResponse> {
    const startTime = Date.now();
    
    try {
      const networkInfo = await this.getNetworkInfo();
      const responseTime = Date.now() - startTime;

      const health = {
        enabled: this.isEnabled(),
        network: this.config.network,
        chainId: this.config.chainId,
        responseTime,
        primaryRPC: this.currentRPC === this.config.primaryRPC,
        fallbackRPC: this.currentRPC === this.config.fallbackRPC,
        circuitBreakerCount: this.circuitBreakerCount,
        status: networkInfo.success ? 'healthy' : 'degraded'
      };

      return {
        success: true,
        data: health
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Health check failed'
      };
    }
  }

  /**
   * Estimate gas for a transaction
   */
  async estimateGas(transaction: any): Promise<PulseChainResponse> {
    return await this.makeRPCRequest('eth_estimateGas', [transaction]);
  }

  /**
   * Get current gas price
   */
  async getGasPrice(): Promise<PulseChainResponse> {
    return await this.makeRPCRequest('eth_gasPrice');
  }
}

// Export singleton instance
export const pulseChainService = new PulseChainService();
export default pulseChainService;