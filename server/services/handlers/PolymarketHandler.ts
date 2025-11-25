/**
 * Polymarket Prediction Market Handler
 * 
 * Provides access to Polymarket prediction market data via their free public API.
 * No API key required - uses Gamma Markets API (https://gamma-api.polymarket.com)
 * 
 * Services:
 * - polymarket-events: Get trending/active prediction markets
 * - polymarket-odds: Get current odds for a specific market
 * - polymarket-search: Search prediction markets by keyword
 */

import { ServiceHandler, ServiceRequest } from './types';

const GAMMA_API_BASE = 'https://gamma-api.polymarket.com';

interface PolymarketEvent {
  id: string;
  slug: string;
  title: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  volume?: number;
  liquidity?: number;
  outcomes?: string[];
  outcomePrices?: string[];
  active?: boolean;
  closed?: boolean;
  archived?: boolean;
}

interface PolymarketMarket {
  id: string;
  question: string;
  conditionId: string;
  slug: string;
  resolutionSource?: string;
  endDate?: string;
  liquidity?: string;
  volume?: string;
  volume24hr?: string;
  outcomes?: string;
  outcomePrices?: string;
  active?: boolean;
  closed?: boolean;
}

export class PolymarketEventsHandler implements ServiceHandler {
  async execute(request: ServiceRequest): Promise<any> {
    const { limit = 10, active = true, sortBy = 'volume' } = request;
    
    try {
      const params = new URLSearchParams({
        limit: String(Math.min(limit, 50)),
        active: String(active),
        order: sortBy === 'volume' ? 'volume' : 'startDate',
        ascending: 'false',
      });
      
      const response = await fetch(`${GAMMA_API_BASE}/events?${params}`, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'CoinRailz-x402/1.0',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Polymarket API error: ${response.status}`);
      }
      
      const events: PolymarketEvent[] = await response.json();
      
      const formattedEvents = events.slice(0, limit).map((event) => ({
        id: event.id,
        slug: event.slug,
        title: event.title,
        description: event.description?.slice(0, 200),
        volume: event.volume ? `$${(event.volume / 1e6).toFixed(2)}M` : 'N/A',
        liquidity: event.liquidity ? `$${(event.liquidity / 1e6).toFixed(2)}M` : 'N/A',
        outcomes: event.outcomes || [],
        prices: event.outcomePrices || [],
        status: event.closed ? 'closed' : event.active ? 'active' : 'inactive',
        endDate: event.endDate,
        url: `https://polymarket.com/event/${event.slug}`,
      }));
      
      return {
        success: true,
        service: 'polymarket-events',
        timestamp: new Date().toISOString(),
        count: formattedEvents.length,
        events: formattedEvents,
        source: 'Polymarket Gamma API',
      };
    } catch (error: any) {
      console.error('Polymarket events fetch error:', error);
      return {
        success: false,
        service: 'polymarket-events',
        error: error.message || 'Failed to fetch Polymarket events',
        timestamp: new Date().toISOString(),
      };
    }
  }
}

export class PolymarketOddsHandler implements ServiceHandler {
  async execute(request: ServiceRequest): Promise<any> {
    const { slug, eventId } = request;
    
    if (!slug && !eventId) {
      return {
        success: false,
        service: 'polymarket-odds',
        error: 'Either slug or eventId is required',
        example: { slug: 'will-trump-win-2024' },
        timestamp: new Date().toISOString(),
      };
    }
    
    try {
      let endpoint = '';
      if (slug) {
        endpoint = `${GAMMA_API_BASE}/events?slug=${encodeURIComponent(slug)}`;
      } else {
        endpoint = `${GAMMA_API_BASE}/events/${eventId}`;
      }
      
      const response = await fetch(endpoint, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'CoinRailz-x402/1.0',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Polymarket API error: ${response.status}`);
      }
      
      const data = await response.json();
      const event = Array.isArray(data) ? data[0] : data;
      
      if (!event) {
        return {
          success: false,
          service: 'polymarket-odds',
          error: 'Event not found',
          timestamp: new Date().toISOString(),
        };
      }
      
      const outcomes = event.outcomes || [];
      const prices = event.outcomePrices ? 
        (typeof event.outcomePrices === 'string' ? JSON.parse(event.outcomePrices) : event.outcomePrices) 
        : [];
      
      const oddsBreakdown = outcomes.map((outcome: string, i: number) => {
        const price = prices[i] ? parseFloat(prices[i]) : 0;
        return {
          outcome,
          probability: `${(price * 100).toFixed(1)}%`,
          impliedOdds: price > 0 ? `${(1 / price).toFixed(2)}:1` : 'N/A',
          price: price.toFixed(4),
        };
      });
      
      return {
        success: true,
        service: 'polymarket-odds',
        timestamp: new Date().toISOString(),
        event: {
          id: event.id,
          title: event.title,
          slug: event.slug,
          status: event.closed ? 'closed' : event.active ? 'active' : 'inactive',
          volume: event.volume ? `$${(event.volume / 1e6).toFixed(2)}M` : 'N/A',
          liquidity: event.liquidity ? `$${(event.liquidity / 1e6).toFixed(2)}M` : 'N/A',
          endDate: event.endDate,
          url: `https://polymarket.com/event/${event.slug}`,
        },
        odds: oddsBreakdown,
        source: 'Polymarket Gamma API',
      };
    } catch (error: any) {
      console.error('Polymarket odds fetch error:', error);
      return {
        success: false,
        service: 'polymarket-odds',
        error: error.message || 'Failed to fetch Polymarket odds',
        timestamp: new Date().toISOString(),
      };
    }
  }
}

export class PolymarketSearchHandler implements ServiceHandler {
  async execute(request: ServiceRequest): Promise<any> {
    const { query, limit = 10 } = request;
    
    if (!query) {
      return {
        success: false,
        service: 'polymarket-search',
        error: 'Search query is required',
        example: { query: 'bitcoin', limit: 10 },
        timestamp: new Date().toISOString(),
      };
    }
    
    try {
      const params = new URLSearchParams({
        limit: String(Math.min(limit, 50)),
        active: 'true',
      });
      
      const response = await fetch(`${GAMMA_API_BASE}/events?${params}`, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'CoinRailz-x402/1.0',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Polymarket API error: ${response.status}`);
      }
      
      const events: PolymarketEvent[] = await response.json();
      
      const queryLower = query.toLowerCase();
      const matchingEvents = events.filter((event) => {
        const titleMatch = event.title?.toLowerCase().includes(queryLower);
        const descMatch = event.description?.toLowerCase().includes(queryLower);
        const slugMatch = event.slug?.toLowerCase().includes(queryLower);
        return titleMatch || descMatch || slugMatch;
      }).slice(0, limit);
      
      const formattedResults = matchingEvents.map((event) => ({
        id: event.id,
        title: event.title,
        slug: event.slug,
        description: event.description?.slice(0, 150),
        volume: event.volume ? `$${(event.volume / 1e6).toFixed(2)}M` : 'N/A',
        status: event.closed ? 'closed' : event.active ? 'active' : 'inactive',
        url: `https://polymarket.com/event/${event.slug}`,
      }));
      
      return {
        success: true,
        service: 'polymarket-search',
        timestamp: new Date().toISOString(),
        query,
        count: formattedResults.length,
        results: formattedResults,
        source: 'Polymarket Gamma API',
        note: formattedResults.length === 0 ? 'No matching events found. Try broader search terms.' : undefined,
      };
    } catch (error: any) {
      console.error('Polymarket search error:', error);
      return {
        success: false,
        service: 'polymarket-search',
        error: error.message || 'Failed to search Polymarket',
        timestamp: new Date().toISOString(),
      };
    }
  }
}
