import { ServiceHandler, ServiceRequest } from './types';

const KALSHI_API_BASE = 'https://api.elections.kalshi.com/trade-api/v2';

const VALID_STATUSES = ['open', 'closed', 'settled'] as const;
const TICKER_REGEX = /^[A-Za-z0-9\-_]{1,100}$/;
const CATEGORY_REGEX = /^[A-Za-z0-9\-_]{1,100}$/;
const MAX_LIMIT = 50;
const MAX_SEARCH_RESULTS = 20;
const MAX_QUERY_LENGTH = 200;

interface KalshiMarket {
  ticker: string;
  event_ticker: string;
  title: string;
  subtitle?: string;
  yes_price: number;
  no_price: number;
  volume: number;
  volume_24h?: number;
  open_interest?: number;
  status: string;
  close_time?: string;
  result?: string;
  category?: string;
  yes_sub_title?: string;
  no_sub_title?: string;
}

interface KalshiEvent {
  event_ticker: string;
  series_ticker: string;
  title: string;
  subtitle?: string;
  category?: string;
  markets?: KalshiMarket[];
  mutually_exclusive?: boolean;
  status?: string;
}

const CACHE_MAX_SIZE = 100;
const CACHE_TTL = 60_000;
const kalshiCache: Map<string, { data: any; expiry: number }> = new Map();

function getCached(key: string): any | null {
  const entry = kalshiCache.get(key);
  if (entry && Date.now() < entry.expiry) return entry.data;
  kalshiCache.delete(key);
  return null;
}

function setCache(key: string, data: any): void {
  if (kalshiCache.size >= CACHE_MAX_SIZE) {
    const oldestKey = kalshiCache.keys().next().value;
    if (oldestKey) kalshiCache.delete(oldestKey);
  }
  kalshiCache.set(key, { data, expiry: Date.now() + CACHE_TTL });
}

const RATE_WINDOW_MS = 10_000;
const MAX_UPSTREAM_CALLS = 15;
const upstreamCallLog: number[] = [];

function checkUpstreamRateLimit(): boolean {
  const now = Date.now();
  while (upstreamCallLog.length > 0 && upstreamCallLog[0] < now - RATE_WINDOW_MS) {
    upstreamCallLog.shift();
  }
  if (upstreamCallLog.length >= MAX_UPSTREAM_CALLS) {
    return false;
  }
  upstreamCallLog.push(now);
  return true;
}

let circuitOpen = false;
let circuitOpenUntil = 0;
let consecutiveFailures = 0;
const CIRCUIT_THRESHOLD = 5;
const CIRCUIT_COOLDOWN_MS = 30_000;

function checkCircuitBreaker(): boolean {
  if (circuitOpen && Date.now() < circuitOpenUntil) {
    return false;
  }
  if (circuitOpen) {
    circuitOpen = false;
    consecutiveFailures = 0;
  }
  return true;
}

function recordUpstreamSuccess(): void {
  consecutiveFailures = 0;
}

function recordUpstreamFailure(): void {
  consecutiveFailures++;
  if (consecutiveFailures >= CIRCUIT_THRESHOLD) {
    circuitOpen = true;
    circuitOpenUntil = Date.now() + CIRCUIT_COOLDOWN_MS;
    console.warn(`[Kalshi] Circuit breaker OPEN - ${consecutiveFailures} consecutive failures. Cooldown ${CIRCUIT_COOLDOWN_MS / 1000}s`);
  }
}

async function kalshiFetch(path: string): Promise<any> {
  const cached = getCached(path);
  if (cached) return cached;

  if (!checkCircuitBreaker()) {
    throw new Error('Kalshi API temporarily unavailable. Please retry in 30 seconds.');
  }

  if (!checkUpstreamRateLimit()) {
    throw new Error('Upstream rate limit reached. Please retry shortly.');
  }

  const response = await fetch(`${KALSHI_API_BASE}${path}`, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'CoinRailz-x402/1.0',
    },
  });

  if (!response.ok) {
    recordUpstreamFailure();
    const statusCode = response.status;
    if (statusCode === 429) {
      throw new Error('Kalshi API rate limited. Please retry in a few seconds.');
    }
    throw new Error(`Upstream service error (HTTP ${statusCode})`);
  }

  recordUpstreamSuccess();
  const data = await response.json();
  setCache(path, data);
  return data;
}

function sanitizeString(val: unknown): string | null {
  if (typeof val !== 'string') return null;
  return val.trim().slice(0, MAX_QUERY_LENGTH) || null;
}

function sanitizeLimit(val: unknown): number {
  const num = typeof val === 'number' ? val : parseInt(String(val), 10);
  if (isNaN(num) || num < 1) return 10;
  return Math.min(num, MAX_LIMIT);
}

function validateTicker(val: unknown): string | null {
  const str = sanitizeString(val);
  if (!str) return null;
  if (!TICKER_REGEX.test(str)) return null;
  return str;
}

function validateStatus(val: unknown): string {
  const str = sanitizeString(val);
  if (!str || !(VALID_STATUSES as readonly string[]).includes(str)) return 'open';
  return str;
}

function validateCategory(val: unknown): string | null {
  const str = sanitizeString(val);
  if (!str) return null;
  if (!CATEGORY_REGEX.test(str)) return null;
  return str;
}

function formatMarket(market: KalshiMarket) {
  const yesPrice = typeof market.yes_price === 'number' ? market.yes_price : 0;
  const noPrice = typeof market.no_price === 'number' ? market.no_price : 0;

  return {
    ticker: market.ticker || 'unknown',
    eventTicker: market.event_ticker || 'unknown',
    title: market.title || 'Untitled',
    subtitle: market.subtitle || null,
    yesPrice,
    noPrice,
    yesProbability: `${(yesPrice / 100).toFixed(1)}%`,
    noProbability: `${(noPrice / 100).toFixed(1)}%`,
    volume: typeof market.volume === 'number' ? market.volume : 0,
    volume24h: typeof market.volume_24h === 'number' ? market.volume_24h : 0,
    openInterest: typeof market.open_interest === 'number' ? market.open_interest : 0,
    status: market.status || 'unknown',
    closeTime: market.close_time || null,
    result: market.result || null,
    url: market.event_ticker
      ? `https://kalshi.com/markets/${encodeURIComponent(market.event_ticker.toLowerCase())}`
      : null,
  };
}

export class KalshiMarketsHandler implements ServiceHandler {
  async execute(request: ServiceRequest): Promise<any> {
    const limit = sanitizeLimit(request.limit ?? 10);
    const status = validateStatus(request.status ?? 'open');
    const category = validateCategory(request.category);

    try {
      const params = new URLSearchParams({
        limit: String(limit),
        status,
      });

      if (category) {
        params.append('series_ticker', category);
      }

      const data = await kalshiFetch(`/markets?${params}`);
      const markets: KalshiMarket[] = data.markets || [];

      const sorted = [...markets].sort((a, b) => (b.volume || 0) - (a.volume || 0));
      const formatted = sorted.slice(0, limit).map(formatMarket);

      return {
        success: true,
        service: 'kalshi-markets',
        timestamp: new Date().toISOString(),
        count: formatted.length,
        markets: formatted,
        source: 'Kalshi Exchange API (CFTC-regulated)',
        note: 'Kalshi is a CFTC-regulated prediction market. Prices are in cents (1-99). Volume is in contracts.',
      };
    } catch (error: any) {
      console.error('Kalshi markets fetch error:', error.message);
      return {
        success: false,
        service: 'kalshi-markets',
        error: error.message || 'Failed to fetch Kalshi markets',
        timestamp: new Date().toISOString(),
      };
    }
  }
}

export class KalshiOddsHandler implements ServiceHandler {
  async execute(request: ServiceRequest): Promise<any> {
    const ticker = validateTicker(request.ticker);
    const eventTicker = validateTicker(request.eventTicker);

    if (!ticker && !eventTicker) {
      return {
        success: false,
        service: 'kalshi-odds',
        error: 'Either ticker (market ticker) or eventTicker (event ticker) is required. Must contain only alphanumeric characters, hyphens, and underscores.',
        example: { ticker: 'KXBTC-26FEB14-B55500' },
        alternativeExample: { eventTicker: 'KXBTC-26FEB14' },
        timestamp: new Date().toISOString(),
      };
    }

    try {
      if (ticker) {
        const data = await kalshiFetch(`/markets/${encodeURIComponent(ticker)}`);
        const market: KalshiMarket = data.market;

        if (!market) {
          return {
            success: false,
            service: 'kalshi-odds',
            error: `Market not found: ${ticker}`,
            timestamp: new Date().toISOString(),
          };
        }

        let orderbook = null;
        try {
          const obData = await kalshiFetch(`/markets/${encodeURIComponent(ticker)}/orderbook`);
          orderbook = {
            yesBids: (obData.orderbook?.yes || []).slice(0, 5).map((b: number[]) => ({
              price: b[0],
              quantity: b[1],
            })),
            noBids: (obData.orderbook?.no || []).slice(0, 5).map((b: number[]) => ({
              price: b[0],
              quantity: b[1],
            })),
          };
        } catch (_e) {}

        return {
          success: true,
          service: 'kalshi-odds',
          timestamp: new Date().toISOString(),
          market: formatMarket(market),
          orderbook,
          source: 'Kalshi Exchange API (CFTC-regulated)',
        };
      }

      const data = await kalshiFetch(`/events/${encodeURIComponent(eventTicker!)}`);
      const event: KalshiEvent = data.event;

      if (!event) {
        return {
          success: false,
          service: 'kalshi-odds',
          error: `Event not found: ${eventTicker}`,
          timestamp: new Date().toISOString(),
        };
      }

      const eventMarkets = (event.markets || []).map(formatMarket);

      return {
        success: true,
        service: 'kalshi-odds',
        timestamp: new Date().toISOString(),
        event: {
          ticker: event.event_ticker,
          seriesTicker: event.series_ticker,
          title: event.title,
          subtitle: event.subtitle || null,
          category: event.category || null,
          status: event.status || null,
          mutuallyExclusive: event.mutually_exclusive || false,
          url: event.event_ticker
            ? `https://kalshi.com/markets/${encodeURIComponent(event.event_ticker.toLowerCase())}`
            : null,
        },
        markets: eventMarkets,
        source: 'Kalshi Exchange API (CFTC-regulated)',
      };
    } catch (error: any) {
      console.error('Kalshi odds fetch error:', error.message);
      return {
        success: false,
        service: 'kalshi-odds',
        error: error.message || 'Failed to fetch Kalshi odds',
        timestamp: new Date().toISOString(),
      };
    }
  }
}

export class KalshiSearchHandler implements ServiceHandler {
  async execute(request: ServiceRequest): Promise<any> {
    const query = sanitizeString(request.query);
    const limit = sanitizeLimit(request.limit ?? 10);
    const status = validateStatus(request.status ?? 'open');

    if (!query) {
      return {
        success: false,
        service: 'kalshi-search',
        error: 'Search query is required (max 200 characters)',
        example: { query: 'bitcoin', limit: 10 },
        timestamp: new Date().toISOString(),
      };
    }

    const cappedLimit = Math.min(limit, MAX_SEARCH_RESULTS);

    try {
      const params = new URLSearchParams({
        limit: '200',
        status,
      });

      const data = await kalshiFetch(`/markets?${params}`);
      const markets: KalshiMarket[] = data.markets || [];

      const queryTerms = query.toLowerCase().split(/\s+/).filter((t: string) => t.length > 1).slice(0, 10);

      if (queryTerms.length === 0) {
        return {
          success: false,
          service: 'kalshi-search',
          error: 'Query must contain at least one term with 2+ characters',
          timestamp: new Date().toISOString(),
        };
      }

      const scored = markets
        .map((market) => {
          let score = 0;
          const titleLower = (market.title || '').toLowerCase();
          const subtitleLower = (market.subtitle || '').toLowerCase();
          const tickerLower = (market.ticker || '').toLowerCase();
          const eventTickerLower = (market.event_ticker || '').toLowerCase();

          for (const term of queryTerms) {
            if (titleLower.includes(term)) {
              score += 10;
              if (titleLower.split(/\s+/).some((w) => w === term || w.startsWith(term))) {
                score += 5;
              }
            }
            if (subtitleLower.includes(term)) score += 3;
            if (tickerLower.includes(term.toUpperCase())) score += 4;
            if (eventTickerLower.includes(term.toUpperCase())) score += 4;
          }

          if (market.volume > 10000) score += 2;
          if (market.status === 'open') score += 1;

          return { market, score };
        })
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, cappedLimit);

      const formatted = scored.map(({ market, score }) => ({
        ...formatMarket(market),
        relevanceScore: score,
      }));

      return {
        success: true,
        service: 'kalshi-search',
        timestamp: new Date().toISOString(),
        query,
        searchTerms: queryTerms,
        count: formatted.length,
        results: formatted,
        source: 'Kalshi Exchange API (CFTC-regulated)',
        note: formatted.length === 0
          ? `No matches found for "${query}". Try broader terms.`
          : undefined,
      };
    } catch (error: any) {
      console.error('Kalshi search error:', error.message);
      return {
        success: false,
        service: 'kalshi-search',
        error: error.message || 'Failed to search Kalshi markets',
        timestamp: new Date().toISOString(),
      };
    }
  }
}
