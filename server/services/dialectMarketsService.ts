import axios from 'axios';

interface DialectToken {
  address: string;
  symbol: string;
  decimals: number;
  icon?: string;
}

interface DialectProvider {
  id: string;
  name: string;
  icon?: string;
}

interface DialectReward {
  type: string;
  apy: number;
  token: DialectToken;
  marketAction?: string;
}

interface DialectMarket {
  id: string;
  type: 'lending' | 'yield' | 'loop' | 'perpetual';
  provider?: DialectProvider;
  token?: DialectToken;
  tokenA?: DialectToken;
  tokenB?: DialectToken;
  borrowToken?: DialectToken;
  websiteUrl?: string;
  depositApy: number;
  baseDepositApy?: number;
  baseDepositApy30d?: number;
  baseDepositApy90d?: number;
  baseDepositApy180d?: number;
  borrowApy?: number;
  baseBorrowApy?: number;
  totalDeposit?: number;
  totalDepositUsd?: number;
  totalBorrow?: number;
  totalBorrowUsd?: number;
  maxDeposit?: number;
  maxBorrow?: number;
  rewards?: DialectReward[];
  maxLtv?: number;
  liquidationLtv?: number;
  liquidationPenalty?: number;
}

interface DialectMarketsResponse {
  markets: DialectMarket[];
}

interface YieldOpportunity {
  id: string;
  protocol: string;
  protocolIcon?: string;
  token: string;
  tokenAddress: string;
  tokenIcon?: string;
  type: 'lending' | 'yield' | 'loop' | 'perpetual';
  depositApy: number;
  depositApyFormatted: string;
  borrowApy?: number;
  borrowApyFormatted?: string;
  totalDepositUsd?: number;
  totalBorrowUsd?: number;
  rewardsApy?: number;
  totalApy: number;
  totalApyFormatted: string;
  websiteUrl?: string;
}

interface YieldFinderResponse {
  success: boolean;
  timestamp: string;
  cacheAge: string;
  network: 'solana';
  totalOpportunities: number;
  topYields: YieldOpportunity[];
  filters?: {
    type?: string;
    protocol?: string;
    minApy?: number;
  };
  dataSource: 'Dialect Markets API';
  attribution: 'Powered by Dialect (https://dialect.to)';
}

class DialectMarketsService {
  private readonly baseUrl = 'https://markets.dial.to/api/v0';
  private cache: {
    data: DialectMarket[] | null;
    timestamp: number;
  } = { data: null, timestamp: 0 };
  private readonly cacheTTL = 10 * 60 * 1000; // 10 minutes (matches Dialect's update cadence)

  private getApiKey(): string {
    const key = process.env.DIALECT_MARKETS_FE_KEY || process.env.DIALECT_BE_KEY;
    if (!key) {
      throw new Error('DIALECT_MARKETS_FE_KEY or DIALECT_BE_KEY not configured');
    }
    return key;
  }

  private isCacheValid(): boolean {
    return this.cache.data !== null && 
           (Date.now() - this.cache.timestamp) < this.cacheTTL;
  }

  async fetchMarkets(forceRefresh = false): Promise<DialectMarket[]> {
    if (!forceRefresh && this.isCacheValid()) {
      console.log('📊 Dialect Markets: Using cached data');
      return this.cache.data!;
    }

    console.log('🔄 Dialect Markets: Fetching fresh data from API...');
    
    try {
      const response = await axios.get<DialectMarketsResponse>(
        `${this.baseUrl}/markets`,
        {
          headers: {
            'x-dialect-api-key': this.getApiKey(),
          },
          timeout: 30000,
        }
      );

      const rawMarkets = response.data?.markets || (Array.isArray(response.data) ? response.data : []);
      
      const malformed = rawMarkets.filter((m: any) => !m.token || !m.token.symbol || !m.provider);
      if (malformed.length > 0) {
        console.log(`⚠️ Dialect Markets: ${malformed.length}/${rawMarkets.length} markets missing token/provider (types: ${[...new Set(malformed.map((m: any) => m.type))].join(', ')})`);
      }
      
      this.cache = {
        data: rawMarkets,
        timestamp: Date.now(),
      };

      console.log(`✅ Dialect Markets: Fetched ${rawMarkets.length} markets (${rawMarkets.length - malformed.length} with valid token)`);
      return rawMarkets;
    } catch (error: any) {
      console.error('❌ Dialect Markets API error:', error.message);
      
      if (this.cache.data) {
        console.log('⚠️ Dialect Markets: Using stale cache as fallback');
        return this.cache.data;
      }
      
      throw new Error(`Failed to fetch Dialect Markets data: ${error.message}`);
    }
  }

  async getTopYields(options: {
    limit?: number;
    type?: 'lending' | 'yield' | 'loop' | 'perpetual';
    protocol?: string;
    minApy?: number;
    token?: string;
  } = {}): Promise<YieldFinderResponse> {
    const { limit = 10, type, protocol, minApy, token } = options;
    
    const markets = await this.fetchMarkets();
    
    let filtered = markets.filter(m => m.depositApy > 0 && m.token && m.provider);
    
    if (type) {
      filtered = filtered.filter(m => m.type === type);
    }
    
    if (protocol) {
      filtered = filtered.filter(m => 
        m.provider?.id?.toLowerCase()?.includes(protocol.toLowerCase()) ||
        m.provider?.name?.toLowerCase()?.includes(protocol.toLowerCase())
      );
    }
    
    if (minApy !== undefined) {
      filtered = filtered.filter(m => {
        const totalApy = this.calculateTotalApy(m);
        return totalApy >= minApy;
      });
    }
    
    if (token) {
      filtered = filtered.filter(m => 
        m.token?.symbol?.toLowerCase()?.includes(token.toLowerCase()) ||
        m.token?.address?.toLowerCase() === token.toLowerCase()
      );
    }
    
    const sorted = filtered.sort((a, b) => {
      const apyA = this.calculateTotalApy(a);
      const apyB = this.calculateTotalApy(b);
      return apyB - apyA;
    });
    
    const topMarkets = sorted.slice(0, limit);
    
    const topYields: YieldOpportunity[] = topMarkets.map(m => {
      const totalApy = this.calculateTotalApy(m);
      const rewardsApy = m.rewards?.reduce((sum, r) => sum + (r.apy || 0), 0) || 0;
      
      return {
        id: m.id,
        protocol: m.provider?.name || m.provider?.id || 'Unknown',
        protocolIcon: m.provider?.icon,
        token: m.token?.symbol || 'Unknown',
        tokenAddress: m.token?.address || '',
        tokenIcon: m.token?.icon,
        type: m.type,
        depositApy: m.depositApy,
        depositApyFormatted: `${(m.depositApy * 100).toFixed(2)}%`,
        borrowApy: m.borrowApy,
        borrowApyFormatted: m.borrowApy ? `${(m.borrowApy * 100).toFixed(2)}%` : undefined,
        totalDepositUsd: m.totalDepositUsd,
        totalBorrowUsd: m.totalBorrowUsd,
        rewardsApy: rewardsApy > 0 ? rewardsApy : undefined,
        totalApy,
        totalApyFormatted: `${(totalApy * 100).toFixed(2)}%`,
        websiteUrl: m.websiteUrl,
      };
    });

    const cacheAgeMs = Date.now() - this.cache.timestamp;
    const cacheAgeMinutes = Math.floor(cacheAgeMs / 60000);
    const cacheAgeSeconds = Math.floor((cacheAgeMs % 60000) / 1000);

    return {
      success: true,
      timestamp: new Date().toISOString(),
      cacheAge: `${cacheAgeMinutes}m ${cacheAgeSeconds}s`,
      network: 'solana',
      totalOpportunities: sorted.length,
      topYields,
      filters: {
        type,
        protocol,
        minApy,
      },
      dataSource: 'Dialect Markets API',
      attribution: 'Powered by Dialect (https://dialect.to)',
    };
  }

  private calculateTotalApy(market: DialectMarket): number {
    let total = market.depositApy || 0;
    
    if (market.rewards && market.rewards.length > 0) {
      const depositRewards = market.rewards
        .filter(r => r.type === 'deposit')
        .reduce((sum, r) => sum + (r.apy || 0), 0);
      total += depositRewards;
    }
    
    return total;
  }

  async getMarketsByProtocol(protocol: string): Promise<DialectMarket[]> {
    const markets = await this.fetchMarkets();
    return markets.filter(m => 
      m.provider?.id?.toLowerCase() === protocol.toLowerCase()
    );
  }

  async getMarketsByToken(tokenSymbol: string): Promise<DialectMarket[]> {
    const markets = await this.fetchMarkets();
    return markets.filter(m => 
      m.token?.symbol?.toLowerCase() === tokenSymbol.toLowerCase()
    );
  }

  getCacheStatus(): { isCached: boolean; ageMs: number; expiresIn: number } {
    const ageMs = Date.now() - this.cache.timestamp;
    return {
      isCached: this.isCacheValid(),
      ageMs,
      expiresIn: Math.max(0, this.cacheTTL - ageMs),
    };
  }
}

export const dialectMarketsService = new DialectMarketsService();
