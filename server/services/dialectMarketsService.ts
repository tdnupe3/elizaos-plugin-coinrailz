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

export interface YieldOpportunity {
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

export interface YieldFinderResponse {
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
  dataSource: string;
  attribution: string;
}

interface LlamaPool {
  pool: string;
  chain: string;
  project: string;
  symbol: string;
  tvlUsd: number;
  apy: number;
  apyBase?: number;
  apyReward?: number | null;
  url?: string;
  underlyingTokens?: string[];
}

function prettifyProtocol(slug: string): string {
  return slug
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

class DialectMarketsService {
  private readonly dialectBaseUrl = 'https://markets.dial.to/api/v0';
  private readonly cacheTTL = 10 * 60 * 1000;

  private dialectCache: { data: DialectMarket[] | null; timestamp: number } = { data: null, timestamp: 0 };
  private llamaCache: { data: LlamaPool[] | null; timestamp: number } = { data: null, timestamp: 0 };

  private _dialectAuthFailed = false;
  private _dialectWarnedAt = 0;

  private getApiKey(): string | null {
    return process.env.DIALECT_MARKETS_FE_KEY || process.env.DIALECT_BE_KEY || null;
  }

  private isDialectCacheValid(): boolean {
    return this.dialectCache.data !== null && (Date.now() - this.dialectCache.timestamp) < this.cacheTTL;
  }

  private isLlamaCacheValid(): boolean {
    return this.llamaCache.data !== null && (Date.now() - this.llamaCache.timestamp) < this.cacheTTL;
  }

  private async fetchDialect(forceRefresh = false): Promise<DialectMarket[] | null> {
    const key = this.getApiKey();
    if (!key) {
      const now = Date.now();
      if (now - this._dialectWarnedAt > 60 * 60 * 1000) {
        console.warn('⚠️  Dialect Markets: no API key configured (DIALECT_MARKETS_FE_KEY / DIALECT_BE_KEY). Using DeFiLlama fallback.');
        this._dialectWarnedAt = now;
      }
      return null;
    }

    if (this._dialectAuthFailed) return null;

    if (!forceRefresh && this.isDialectCacheValid()) {
      return this.dialectCache.data;
    }

    console.log('🔄 Dialect Markets: Fetching fresh data from API...');
    try {
      const response = await axios.get<DialectMarketsResponse>(
        `${this.dialectBaseUrl}/markets`,
        { headers: { 'x-dialect-api-key': key }, timeout: 15000 },
      );

      const rawMarkets = response.data?.markets || (Array.isArray(response.data) ? response.data : []);
      this.dialectCache = { data: rawMarkets, timestamp: Date.now() };
      this._dialectAuthFailed = false;

      const malformed = rawMarkets.filter((m: any) => !m.token || !m.token.symbol || !m.provider);
      if (malformed.length > 0) {
        console.log(`⚠️  Dialect Markets: ${malformed.length}/${rawMarkets.length} markets missing token/provider`);
      }
      console.log(`✅ Dialect Markets: Fetched ${rawMarkets.length} markets`);
      return rawMarkets;
    } catch (error: any) {
      const status = error?.response?.status;
      if (status === 401 || status === 403) {
        if (!this._dialectAuthFailed) {
          console.warn(`⚠️  Dialect Markets: API key rejected (${status}). Switching permanently to DeFiLlama fallback. Update DIALECT_MARKETS_FE_KEY or DIALECT_BE_KEY to re-enable.`);
          this._dialectAuthFailed = true;
        }
        return null;
      }
      if (this.dialectCache.data) {
        console.log('⚠️  Dialect Markets: request failed, using stale cache');
        return this.dialectCache.data;
      }
      console.warn(`⚠️  Dialect Markets: ${error.message} — falling back to DeFiLlama`);
      return null;
    }
  }

  private async fetchLlama(): Promise<LlamaPool[]> {
    if (this.isLlamaCacheValid()) return this.llamaCache.data!;

    try {
      const { data } = await axios.get<{ data: LlamaPool[] }>('https://yields.llama.fi/pools', { timeout: 15000 });
      const solanaPools = (data?.data ?? []).filter(
        (p: LlamaPool) => p.chain === 'Solana' && p.apy > 0,
      );
      this.llamaCache = { data: solanaPools, timestamp: Date.now() };
      return solanaPools;
    } catch (err: any) {
      console.warn(`⚠️  DeFiLlama fallback failed: ${err.message}`);
      return this.llamaCache.data ?? [];
    }
  }

  private dialectToOpportunity(m: DialectMarket): YieldOpportunity {
    const totalApy = this.calculateTotalApy(m);
    const rewardsApy = m.rewards?.reduce((s, r) => s + (r.apy || 0), 0) || 0;
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
  }

  private llamaToOpportunity(p: LlamaPool): YieldOpportunity {
    const depositApy = p.apy / 100;
    const rewardsApy = (p.apyReward ?? 0) / 100;
    const totalApy = depositApy + rewardsApy;
    return {
      id: p.pool,
      protocol: prettifyProtocol(p.project),
      token: p.symbol,
      tokenAddress: (p.underlyingTokens ?? [])[0] ?? '',
      type: 'lending',
      depositApy,
      depositApyFormatted: `${p.apy.toFixed(2)}%`,
      totalDepositUsd: p.tvlUsd,
      rewardsApy: rewardsApy > 0 ? rewardsApy : undefined,
      totalApy,
      totalApyFormatted: `${(totalApy * 100).toFixed(2)}%`,
      websiteUrl: p.url,
    };
  }

  async fetchMarkets(forceRefresh = false): Promise<DialectMarket[]> {
    const data = await this.fetchDialect(forceRefresh);
    return data ?? [];
  }

  async getTopYields(options: {
    limit?: number;
    type?: 'lending' | 'yield' | 'loop' | 'perpetual';
    protocol?: string;
    minApy?: number;
    token?: string;
  } = {}): Promise<YieldFinderResponse> {
    const { limit = 10, type, protocol, minApy, token } = options;

    const dialectMarkets = await this.fetchDialect();
    const usingDialect = dialectMarkets !== null && dialectMarkets.length > 0;
    const cacheTimestamp = usingDialect ? this.dialectCache.timestamp : this.llamaCache.timestamp;

    let opportunities: YieldOpportunity[];

    if (usingDialect) {
      let filtered = dialectMarkets.filter(m => m.depositApy > 0 && m.token && m.provider);
      if (type) filtered = filtered.filter(m => m.type === type);
      if (protocol) filtered = filtered.filter(m =>
        m.provider?.id?.toLowerCase().includes(protocol.toLowerCase()) ||
        m.provider?.name?.toLowerCase().includes(protocol.toLowerCase()),
      );
      if (minApy !== undefined) filtered = filtered.filter(m => this.calculateTotalApy(m) >= minApy);
      if (token) filtered = filtered.filter(m =>
        m.token?.symbol?.toLowerCase().includes(token.toLowerCase()) ||
        m.token?.address?.toLowerCase() === token.toLowerCase(),
      );
      filtered.sort((a, b) => this.calculateTotalApy(b) - this.calculateTotalApy(a));
      opportunities = filtered.slice(0, limit).map(m => this.dialectToOpportunity(m));
    } else {
      const llamaPools = await this.fetchLlama();
      let filtered = llamaPools.filter(p => p.apy > 0);
      if (protocol) filtered = filtered.filter(p =>
        p.project.toLowerCase().includes(protocol.toLowerCase()),
      );
      if (minApy !== undefined) filtered = filtered.filter(p => p.apy / 100 >= minApy);
      if (token) filtered = filtered.filter(p =>
        p.symbol.toLowerCase().includes(token.toLowerCase()),
      );
      filtered.sort((a, b) => b.apy - a.apy);
      opportunities = filtered.slice(0, limit).map(p => this.llamaToOpportunity(p));
    }

    const cacheAgeMs = Date.now() - (cacheTimestamp || Date.now());
    const cacheAgeMinutes = Math.floor(cacheAgeMs / 60000);
    const cacheAgeSeconds = Math.floor((cacheAgeMs % 60000) / 1000);

    return {
      success: true,
      timestamp: new Date().toISOString(),
      cacheAge: `${cacheAgeMinutes}m ${cacheAgeSeconds}s`,
      network: 'solana',
      totalOpportunities: opportunities.length,
      topYields: opportunities,
      filters: { type, protocol, minApy },
      dataSource: usingDialect ? 'Dialect Markets API' : 'DeFiLlama',
      attribution: usingDialect
        ? 'Powered by Dialect (https://dialect.to)'
        : 'Powered by DeFiLlama (https://defillama.com)',
    };
  }

  private calculateTotalApy(market: DialectMarket): number {
    let total = market.depositApy || 0;
    if (market.rewards?.length) {
      total += market.rewards
        .filter(r => r.type === 'deposit')
        .reduce((sum, r) => sum + (r.apy || 0), 0);
    }
    return total;
  }

  async getMarketsByProtocol(protocol: string): Promise<DialectMarket[]> {
    const markets = await this.fetchMarkets();
    return markets.filter(m => m.provider?.id?.toLowerCase() === protocol.toLowerCase());
  }

  async getMarketsByToken(tokenSymbol: string): Promise<DialectMarket[]> {
    const markets = await this.fetchMarkets();
    return markets.filter(m => m.token?.symbol?.toLowerCase() === tokenSymbol.toLowerCase());
  }

  getCacheStatus(): { isCached: boolean; ageMs: number; expiresIn: number } {
    const ageMs = Date.now() - this.dialectCache.timestamp;
    return {
      isCached: this.isDialectCacheValid(),
      ageMs,
      expiresIn: Math.max(0, this.cacheTTL - ageMs),
    };
  }
}

export const dialectMarketsService = new DialectMarketsService();
