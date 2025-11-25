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
  private fetchStats = { pagesRequested: 0, pagesFailed: 0, apiExhausted: false, hardLimitReached: false };
  
  private async fetchAllEvents(includeArchived: boolean = false, exhaustive: boolean = false): Promise<PolymarketEvent[]> {
    const allEvents: PolymarketEvent[] = [];
    const batchSize = 100;
    // Standard mode: top 5000 by volume (fast, covers most popular markets)
    // Exhaustive mode: NO LIMIT - fetches until API exhausted
    const maxPages = exhaustive ? Infinity : 50;
    const absoluteMaxPages = 500; // Safety limit to prevent infinite loops (50,000 events)
    const seenIds = new Set<string>();
    
    this.fetchStats = { pagesRequested: 0, pagesFailed: 0, apiExhausted: false, hardLimitReached: false };
    
    let consecutiveFailures = 0;
    const maxConsecutiveFailures = 3;
    
    for (let page = 0; page < maxPages && page < absoluteMaxPages; page++) {
      this.fetchStats.pagesRequested++;
      
      try {
        const params = new URLSearchParams({
          limit: String(batchSize),
          offset: String(page * batchSize),
          ascending: 'false',
          order: 'volume',
        });
        
        if (!includeArchived) {
          params.append('closed', 'false');
        }
        
        const response = await fetch(`${GAMMA_API_BASE}/events?${params}`, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'CoinRailz-x402/1.0',
          },
        });
        
        if (!response.ok) {
          this.fetchStats.pagesFailed++;
          consecutiveFailures++;
          console.error(`Polymarket API page ${page} failed: HTTP ${response.status}`);
          
          if (consecutiveFailures >= maxConsecutiveFailures) {
            console.error('Too many consecutive failures, stopping pagination');
            break;
          }
          continue;
        }
        
        consecutiveFailures = 0; // Reset on success
        const events: PolymarketEvent[] = await response.json();
        
        if (events.length === 0) {
          this.fetchStats.apiExhausted = true;
          break; // API exhausted - all data fetched
        }
        
        for (const event of events) {
          if (!seenIds.has(event.id)) {
            seenIds.add(event.id);
            allEvents.push(event);
          }
        }
        
        if (events.length < batchSize) {
          this.fetchStats.apiExhausted = true;
          break; // Last page - API exhausted
        }
        
        // Check if we hit the absolute safety limit
        if (page === absoluteMaxPages - 1) {
          this.fetchStats.hardLimitReached = true;
        }
      } catch (error) {
        this.fetchStats.pagesFailed++;
        consecutiveFailures++;
        console.error(`Polymarket fetch page ${page} error:`, error);
        
        if (consecutiveFailures >= maxConsecutiveFailures) {
          console.error('Too many consecutive failures, stopping pagination');
          break;
        }
        continue;
      }
    }
    
    return allEvents;
  }
  
  private searchScore(event: PolymarketEvent, queryTerms: string[]): number {
    let score = 0;
    const titleLower = event.title?.toLowerCase() || '';
    const descLower = event.description?.toLowerCase() || '';
    const slugLower = event.slug?.toLowerCase() || '';
    
    for (const term of queryTerms) {
      // Title matches are highest priority
      if (titleLower.includes(term)) {
        score += 10;
        // Bonus for exact word match
        if (titleLower.split(/\s+/).some(w => w === term || w.startsWith(term))) {
          score += 5;
        }
      }
      // Slug matches (often contains key topic)
      if (slugLower.includes(term)) {
        score += 5;
      }
      // Description matches
      if (descLower.includes(term)) {
        score += 2;
      }
    }
    
    // Bonus for higher volume (more popular markets)
    if (event.volume && event.volume > 1000000) {
      score += 3;
    }
    
    // Bonus for active markets
    if (event.active && !event.closed) {
      score += 2;
    }
    
    return score;
  }
  
  async execute(request: ServiceRequest): Promise<any> {
    const { query, limit = 10, includeArchived = false, exhaustive = false } = request;
    
    if (!query) {
      return {
        success: false,
        service: 'polymarket-search',
        error: 'Search query is required',
        example: { query: 'bitcoin', limit: 10, exhaustive: true },
        timestamp: new Date().toISOString(),
      };
    }
    
    try {
      // Fetch event dataset: standard (5000 top by volume) or exhaustive (all ~15,000+)
      const allEvents = await this.fetchAllEvents(includeArchived, exhaustive);
      
      // Parse query into search terms
      const queryTerms = query.toLowerCase().split(/\s+/).filter((t: string) => t.length > 2);
      
      if (queryTerms.length === 0) {
        return {
          success: false,
          service: 'polymarket-search',
          error: 'Search query must contain meaningful terms (3+ characters)',
          timestamp: new Date().toISOString(),
        };
      }
      
      // Score and rank all events by relevance
      const scoredEvents = allEvents
        .map(event => ({
          event,
          score: this.searchScore(event, queryTerms),
        }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, Math.min(limit, 50));
      
      const formattedResults = scoredEvents.map(({ event, score }) => ({
        id: event.id,
        title: event.title,
        slug: event.slug,
        description: event.description?.slice(0, 150),
        volume: event.volume ? `$${(event.volume / 1e6).toFixed(2)}M` : 'N/A',
        liquidity: event.liquidity ? `$${(event.liquidity / 1e6).toFixed(2)}M` : 'N/A',
        status: event.closed ? 'closed' : event.active ? 'active' : 'inactive',
        relevanceScore: score,
        url: `https://polymarket.com/event/${event.slug}`,
      }));
      
      // Build detailed coverage info
      const coverage = {
        eventsSearched: allEvents.length,
        pagesRequested: this.fetchStats.pagesRequested,
        pagesFailed: this.fetchStats.pagesFailed,
        apiExhausted: this.fetchStats.apiExhausted,
        hardLimitReached: this.fetchStats.hardLimitReached,
        searchMode: exhaustive ? 'exhaustive (until API exhausted)' : 'standard (top 5000 by volume)',
        fullCatalogSearched: exhaustive && this.fetchStats.apiExhausted,
      };
      
      let note = undefined;
      if (this.fetchStats.hardLimitReached) {
        note = `WARNING: Hit safety limit at ${allEvents.length} markets. Some events may be missing.`;
      } else if (exhaustive && !this.fetchStats.apiExhausted) {
        note = `WARNING: Exhaustive search stopped early (API errors). ${allEvents.length} markets searched, results may be incomplete.`;
      } else if (formattedResults.length === 0 && exhaustive && this.fetchStats.apiExhausted) {
        note = `No matching events found in entire catalog (${allEvents.length} markets). Try different search terms.`;
      } else if (formattedResults.length === 0 && !exhaustive) {
        note = `No matches in top ${allEvents.length} markets. Try exhaustive:true to search full catalog.`;
      } else if (!exhaustive) {
        note = `Searched top ${allEvents.length} markets by volume. Use exhaustive:true for full catalog.`;
      } else if (this.fetchStats.pagesFailed > 0) {
        note = `Some API pages failed (${this.fetchStats.pagesFailed}/${this.fetchStats.pagesRequested}). Results may be incomplete.`;
      }
      
      return {
        success: true,
        service: 'polymarket-search',
        timestamp: new Date().toISOString(),
        query,
        searchTerms: queryTerms,
        coverage,
        count: formattedResults.length,
        results: formattedResults,
        source: 'Polymarket Gamma API',
        note,
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
