import { ServiceHandler, ServiceRequest } from './types';

const KALSHI_API_BASE = 'https://api.elections.kalshi.com/trade-api/v2';

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

const kalshiCache: Map<string, { data: any; expiry: number }> = new Map();
const CACHE_TTL = 60_000;

function getCached(key: string): any | null {
  const entry = kalshiCache.get(key);
  if (entry && Date.now() < entry.expiry) return entry.data;
  kalshiCache.delete(key);
  return null;
}

function setCache(key: string, data: any): void {
  kalshiCache.set(key, { data, expiry: Date.now() + CACHE_TTL });
}

async function kalshiFetch(path: string): Promise<any> {
  const cached = getCached(path);
  if (cached) return cached;

  const response = await fetch(`${KALSHI_API_BASE}${path}`, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'CoinRailz-x402/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Kalshi API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  setCache(path, data);
  return data;
}

function formatMarket(market: KalshiMarket) {
  return {
    ticker: market.ticker,
    eventTicker: market.event_ticker,
    title: market.title,
    subtitle: market.subtitle || null,
    yesPrice: market.yes_price,
    noPrice: market.no_price,
    yesProbability: `${(market.yes_price / 100).toFixed(1)}%`,
    noProbability: `${(market.no_price / 100).toFixed(1)}%`,
    volume: market.volume,
    volume24h: market.volume_24h || 0,
    openInterest: market.open_interest || 0,
    status: market.status,
    closeTime: market.close_time || null,
    result: market.result || null,
    url: `https://kalshi.com/markets/${market.event_ticker?.toLowerCase()}`,
  };
}

export class KalshiMarketsHandler implements ServiceHandler {
  async execute(request: ServiceRequest): Promise<any> {
    const { limit = 10, status = 'open', category } = request;

    try {
      const params = new URLSearchParams({
        limit: String(Math.min(limit, 50)),
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
      console.error('Kalshi markets fetch error:', error);
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
    const { ticker, eventTicker } = request;

    if (!ticker && !eventTicker) {
      return {
        success: false,
        service: 'kalshi-odds',
        error: 'Either ticker (market ticker) or eventTicker (event ticker) is required',
        example: { ticker: 'KXBTC-26FEB14-B55500' },
        alternativeExample: { eventTicker: 'KXBTC-26FEB14' },
        timestamp: new Date().toISOString(),
      };
    }

    try {
      if (ticker) {
        const data = await kalshiFetch(`/markets/${ticker}`);
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
          const obData = await kalshiFetch(`/markets/${ticker}/orderbook`);
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

      const data = await kalshiFetch(`/events/${eventTicker}`);
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
          url: `https://kalshi.com/markets/${event.event_ticker?.toLowerCase()}`,
        },
        markets: eventMarkets,
        source: 'Kalshi Exchange API (CFTC-regulated)',
      };
    } catch (error: any) {
      console.error('Kalshi odds fetch error:', error);
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
    const { query, limit = 10, status = 'open' } = request;

    if (!query) {
      return {
        success: false,
        service: 'kalshi-search',
        error: 'Search query is required',
        example: { query: 'bitcoin', limit: 10 },
        timestamp: new Date().toISOString(),
      };
    }

    try {
      const params = new URLSearchParams({
        limit: '200',
        status,
      });

      const data = await kalshiFetch(`/markets?${params}`);
      const markets: KalshiMarket[] = data.markets || [];

      const queryTerms = query.toLowerCase().split(/\s+/).filter((t: string) => t.length > 1);

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
        .slice(0, Math.min(limit, 50));

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
        marketsSearched: markets.length,
        results: formatted,
        source: 'Kalshi Exchange API (CFTC-regulated)',
        note: formatted.length === 0
          ? `No matches found for "${query}" among ${markets.length} markets. Try broader terms.`
          : undefined,
      };
    } catch (error: any) {
      console.error('Kalshi search error:', error);
      return {
        success: false,
        service: 'kalshi-search',
        error: error.message || 'Failed to search Kalshi markets',
        timestamp: new Date().toISOString(),
      };
    }
  }
}
