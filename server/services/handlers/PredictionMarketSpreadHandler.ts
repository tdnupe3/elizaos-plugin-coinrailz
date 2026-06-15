/**
 * PredictionMarketSpreadHandler.ts
 *
 * Cross-platform prediction market spread analysis.
 * Fetches live binary markets from Polymarket (/markets endpoint) and Kalshi,
 * identifies matching real-world events using a 2-stage matcher,
 * computes YES probability spread, and ranks arbitrage opportunities by magnitude.
 *
 * API field reality (verified against live APIs):
 *   Polymarket /markets:   outcomePrices as decimal strings ["0.65","0.35"], outcomes ["Yes","No"]
 *   Kalshi     /markets:   yes_ask_dollars, yes_bid_dollars, last_price_dollars (decimal 0-1 USD strings)
 *                          NO yes_price field exists in the current API
 *
 * Matching strategy (architect review):
 *   Stage 1 — Candidate gate: require shared strong token (numbers, entity names ≥6 chars)
 *   Stage 2 — Token Jaccard similarity ≥ 0.28; tier labels the result (high/medium/low)
 *
 * Cache: 30 s hot, 120 s stale-if-error fallback.
 */

import { ServiceHandler, ServiceRequest } from './types';

const GAMMA_MARKETS_API = 'https://gamma-api.polymarket.com/markets';
const KALSHI_API_BASE   = 'https://api.elections.kalshi.com/trade-api/v2';

// ─── Cache ────────────────────────────────────────────────────────────────────

const CACHE_TTL_MS  = 30_000;
const STALE_TTL_MS  = 120_000;

interface CacheEntry { data: any; fetchedAt: number }
const spreadCache = new Map<string, CacheEntry>();

function getCached(key: string): { data: any; fresh: boolean } | null {
  const entry = spreadCache.get(key);
  if (!entry) return null;
  const age = Date.now() - entry.fetchedAt;
  if (age < CACHE_TTL_MS)  return { data: entry.data, fresh: true };
  if (age < STALE_TTL_MS)  return { data: entry.data, fresh: false };
  spreadCache.delete(key);
  return null;
}

function setCache(key: string, data: any): void {
  spreadCache.set(key, { data, fetchedAt: Date.now() });
}

// ─── Stop words ───────────────────────────────────────────────────────────────
// Month names and years are deliberately excluded: they appear across completely
// unrelated events that happen to trade in the same time window and would create
// false-positive matches if allowed to drive Jaccard scores.

const STOP_WORDS = new Set([
  // Articles, prepositions, conjunctions
  'a','an','the','to','in','on','at','by','for','of','or','and','is','it','be',
  'as','if','do','will','has','was','are','not','can','no','who','how',
  'any','our','new','get','may','its','from','with','that','this','than','then',
  'have','been','more','when','what','some','were','they','but','into','over',
  'such','also','just','about','after','before','would','could','should','their',
  'there','which','these','those','each','most','other','between','during',
  'much','being','until','while','where','through',
  // Domain-generic words
  'market','markets','election','elections','win','winner','first','per',
  'day','week','month','year','end','up','down','out','all','one','two',
  'use','had','so','go','see','did','now','old','too','very','here','like',
  'long','make','many','only','take','time','way','man','score','goals','goal',
  'yes','no','pro',
  // Finance/prediction-market generic verbs/adjectives that appear on both platforms
  // without meaning the markets are the same event
  'greater','lower','upper','bound','reach','price','range','rate','rise',
  'official','real','overall','total','high','low','close','open','above',
  // Month names (full and abbreviated)
  'january','february','march','april','june','july','august',
  'september','october','november','december',
  'jan','feb','mar','apr','jun','jul','aug','sep','oct','nov','dec',
]);

// ─── Synonym normalization ────────────────────────────────────────────────────
// Normalizes common abbreviations so "btc" and "bitcoin" produce the same token
// and Kalshi/Polymarket vocabulary differences don't prevent valid matches.

const SYNONYMS: Record<string, string> = {
  btc:    'bitcoin',  eth:   'ethereum', sol:   'solana',
  fed:    'federal',  funds: 'federal',
  cpi:    'inflation',gdp:   'economy',
  nba:    'basketball',wnba: 'basketball',
  mlb:    'baseball', nhl:   'hockey',
  nfl:    'football', nfc:   'football',  afc:   'football',
  nascar: 'racing',   pga:   'golf',
  sp500:  'stocks',   nasdaq:'stocks',
  us:     'united',   usa:   'united',
  finals: 'championship', series: 'championship',
};

function applySynonyms(word: string): string {
  return SYNONYMS[word] || word;
}

// ─── Matching utilities ───────────────────────────────────────────────────────

const MIN_JACCARD = 0.20; // calibrated for cross-platform vocabulary diversity

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map(applySynonyms)
    .filter(t => {
      if (t.length < 3) return false;
      if (STOP_WORDS.has(t)) return false;
      if (/^20[2-9]\d$/.test(t)) return false; // skip year numbers 2020-2099
      if (/^\d{1,2}$/.test(t)) return false;    // skip 1-2 digit day numbers
      return true;
    });
}

function jaccardSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const t of setA) if (setB.has(t)) intersection++;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function hasTopicOverlap(tokA: string[], tokB: string[]): boolean {
  // Require at least one topic token (≥4 chars) in common.
  // With months/years in stop words, only genuine topic words reach this gate.
  const setB = new Set(tokB);
  return tokA.some(t => t.length >= 4 && setB.has(t));
}

function confidenceTier(score: number): 'high' | 'medium' | 'low' {
  if (score >= 0.45) return 'high';
  if (score >= 0.30) return 'medium';
  return 'low';
}

// ─── Polymarket types & fetch ─────────────────────────────────────────────────
// Uses /markets endpoint (not /events) because it returns outcomePrices directly

interface PolyMarket {
  id: string;
  question: string;
  slug: string;
  outcomes: string;       // JSON string: '["Yes","No"]'
  outcomePrices: string;  // JSON string: '["0.65","0.35"]'
  volume: string;         // decimal string
  liquidity: string;
  endDate?: string;
  active: boolean;
  closed: boolean;
}

function isBinaryYesNo(m: PolyMarket): boolean {
  if (m.closed || !m.active) return false;
  try {
    const outcomes: string[] = typeof m.outcomes === 'string'
      ? JSON.parse(m.outcomes)
      : (m.outcomes || []);
    const lower = outcomes.map((o: string) => o.toLowerCase());
    return lower.includes('yes') && lower.includes('no');
  } catch { return false; }
}

async function fetchPolyPageBinary(offset: number): Promise<PolyMarket[]> {
  const params = new URLSearchParams({
    limit: '100', active: 'true', closed: 'false',
    order: 'volume', ascending: 'false', offset: String(offset),
  });
  const resp = await fetch(`${GAMMA_MARKETS_API}?${params}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'CoinRailz-x402/1.0' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!resp.ok) throw new Error(`Polymarket HTTP ${resp.status}`);
  const markets: PolyMarket[] = await resp.json();
  return markets.filter(isBinaryYesNo);
}

async function fetchPolymarketBinaryMarkets(): Promise<PolyMarket[]> {
  const key = 'spread:poly:v2';
  const cached = getCached(key);
  if (cached?.fresh) return cached.data as PolyMarket[];

  // Fetch 4 pages (400 markets) in parallel to capture econ/sports markets
  // that appear beyond the top-100 World Cup markets by volume.
  const results = await Promise.allSettled([
    fetchPolyPageBinary(0),
    fetchPolyPageBinary(100),
    fetchPolyPageBinary(200),
    fetchPolyPageBinary(300),
  ]);

  const binary: PolyMarket[] = [];
  const seen = new Set<string>();
  for (const r of results) {
    if (r.status === 'fulfilled') {
      for (const m of r.value) {
        if (!seen.has(m.slug)) { seen.add(m.slug); binary.push(m); }
      }
    }
  }

  setCache(key, binary);
  return binary;
}

// Parse Polymarket price fields (stored as JSON strings)
function parsePolyPrices(m: PolyMarket): { outcomes: string[]; prices: number[] } | null {
  try {
    const outcomes: string[] = typeof m.outcomes === 'string'
      ? JSON.parse(m.outcomes)
      : (m.outcomes || []);
    const priceStrs: string[] = typeof m.outcomePrices === 'string'
      ? JSON.parse(m.outcomePrices)
      : (m.outcomePrices || []);
    const prices = priceStrs.map(parseFloat);
    if (outcomes.length !== prices.length) return null;
    return { outcomes, prices };
  } catch { return null; }
}

// ─── Kalshi types & fetch ─────────────────────────────────────────────────────
// NOTE: Kalshi API v2 (2026) no longer returns yes_price (cents).
// It returns yes_ask_dollars, yes_bid_dollars, last_price_dollars (USD decimal strings, 0-1).

interface KalshiMarket {
  ticker: string;
  event_ticker: string;
  title: string;
  yes_ask_dollars: string;   // e.g. "0.67" = 67% ask price
  yes_bid_dollars: string;   // e.g. "0.63" = 63% bid price
  last_price_dollars: string;// e.g. "0.65" = last trade price
  volume_fp: string;         // float string, e.g. "12345.50"
  close_time?: string;
  status: string;
  market_type?: string;
}

// Derive YES probability from Kalshi price fields
function kalshiYesProb(m: KalshiMarket): number {
  const last = parseFloat(m.last_price_dollars || '0');
  if (last > 0 && last < 1) return last;

  const ask = parseFloat(m.yes_ask_dollars || '0');
  const bid = parseFloat(m.yes_bid_dollars || '0');
  if (ask > 0 && bid > 0) return (ask + bid) / 2;
  if (ask > 0) return ask;
  if (bid > 0) return bid;
  return 0;
}

// Kalshi series that are confirmed to have real bid/ask prices.
// The default /markets?status=open sort returns newest markets first,
// which are currently all World Cup game markets with zero liquidity.
// Targeting known liquid series bypasses this ordering issue.
const KALSHI_LIQUID_SERIES = [
  'KXBTC',   // Bitcoin daily/weekly price
  'KXETH',   // Ethereum price
  'KXFED',   // Federal funds rate
  'KXCPI',   // CPI / inflation
  'KXGDP',   // GDP growth
  'KXNBA',   // NBA championship
  'KXMLB',   // MLB / World Series
  'KXNHL',   // Stanley Cup
  'KXNFL',   // NFL / Super Bowl
  'KXSOL',   // Solana price
  'KXSP500', // S&P 500
  'KXWC',    // World Cup (for when liquidity develops)
];

async function fetchKalshiSeries(series: string): Promise<KalshiMarket[]> {
  const params = new URLSearchParams({
    limit: '50', status: 'open', series_ticker: series,
  });
  const resp = await fetch(`${KALSHI_API_BASE}/markets?${params}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'CoinRailz-x402/1.0' },
    signal: AbortSignal.timeout(8_000),
  });
  if (!resp.ok) return [];
  const data = await resp.json();
  return (data.markets || []).filter((m: KalshiMarket) => {
    const prob = kalshiYesProb(m);
    return prob > 0.01 && prob < 0.99;
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchKalshiBinaryMarkets(): Promise<KalshiMarket[]> {
  const key = 'spread:kalshi:v2';
  const cached = getCached(key);
  if (cached?.fresh) return cached.data as KalshiMarket[];

  // Fetch series sequentially with 200ms delay between each to avoid Kalshi 429.
  // Parallel fetching of 12 series reliably triggers rate limiting.
  const allMarkets: KalshiMarket[] = [];
  const seenTickers = new Set<string>();

  for (let i = 0; i < KALSHI_LIQUID_SERIES.length; i++) {
    if (i > 0) await sleep(200);
    try {
      const markets = await fetchKalshiSeries(KALSHI_LIQUID_SERIES[i]);
      for (const m of markets) {
        if (!seenTickers.has(m.ticker)) {
          seenTickers.add(m.ticker);
          allMarkets.push(m);
        }
      }
    } catch { /* skip failed series */ }
  }

  // Sort by volume descending, cap at 150
  const sorted = allMarkets
    .sort((a, b) => parseFloat(b.volume_fp || '0') - parseFloat(a.volume_fp || '0'))
    .slice(0, 150);

  setCache(key, sorted);
  return sorted;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export class PredictionMarketSpreadHandler implements ServiceHandler {
  async execute(request: ServiceRequest): Promise<any> {
    const limit        = Math.min(typeof request.limit        === 'number' ? request.limit        : 10, 25);
    const minSpreadPct = typeof request.minSpreadPct === 'number' ? request.minSpreadPct : 0;
    const minConf      = request.minConfidence as 'high' | 'medium' | 'low' | undefined;

    // ── Parallel fetch with stale-if-error fallback ───────────────────────────
    let polyMarkets:   PolyMarket[]    | null = null;
    let kalshiMarkets: KalshiMarket[]  | null = null;
    let polyError:     string | null = null;
    let kalshiError:   string | null = null;
    let polyStale    = false;
    let kalshiStale  = false;

    await Promise.allSettled([
      (async () => {
        try {
          polyMarkets = await fetchPolymarketBinaryMarkets();
          const ce = getCached('spread:poly:v2');
          if (ce && !ce.fresh) polyStale = true;
        } catch (err: any) {
          polyError = err.message;
          const stale = spreadCache.get('spread:poly:v2');
          if (stale) { polyMarkets = stale.data; polyStale = true; }
        }
      })(),
      (async () => {
        try {
          kalshiMarkets = await fetchKalshiBinaryMarkets();
          const ce = getCached('spread:kalshi:v2');
          if (ce && !ce.fresh) kalshiStale = true;
        } catch (err: any) {
          kalshiError = err.message;
          const stale = spreadCache.get('spread:kalshi:v2');
          if (stale) { kalshiMarkets = stale.data; kalshiStale = true; }
        }
      })(),
    ]);

    if (!polyMarkets && !kalshiMarkets) {
      return {
        success: false,
        service: 'prediction-market-spread',
        error: 'Both Polymarket and Kalshi APIs are currently unavailable. Retry in 30 seconds.',
        polymarketError: polyError,
        kalshiError,
        timestamp: new Date().toISOString(),
      };
    }

    if (!polyMarkets || !kalshiMarkets) {
      return {
        success: true,
        service: 'prediction-market-spread',
        partial: true,
        stale: polyStale || kalshiStale,
        opportunities: [],
        count: 0,
        sourceStatus: {
          polymarket: polyError ? `error: ${polyError}` : (polyStale ? 'stale' : 'live'),
          kalshi:     kalshiError ? `error: ${kalshiError}` : (kalshiStale ? 'stale' : 'live'),
        },
        note: 'Cross-platform spread requires both sources. One is currently unavailable.',
        timestamp: new Date().toISOString(),
      };
    }

    // ── Cross-reference: Kalshi × Polymarket ─────────────────────────────────
    const candidates: Array<{
      polySlug:        string;
      polyQuestion:    string;
      polyYesProb:     number;
      polyVolume:      string;
      polyLiquidity:   string;
      polyCloseDate:   string | null;
      kalshiTicker:    string;
      kalshiEventTick: string;
      kalshiTitle:     string;
      kalshiYesProb:   number;
      kalshiVolumeFp:  number;
      kalshiCloseDate: string | null;
      eventKey:        string;
      matchConfidence: number;
      matchTier:       'high' | 'medium' | 'low';
      matchReasons:    string[];
      spreadPctPoints: number;
      cheaperYesOn:    'polymarket' | 'kalshi';
    }> = [];

    for (const kalshi of kalshiMarkets) {
      const kProb = kalshiYesProb(kalshi);
      if (kProb <= 0.01 || kProb >= 0.99) continue;
      const kalshiTokens = tokenize(kalshi.title);

      for (const poly of polyMarkets) {
        const parsed = parsePolyPrices(poly);
        if (!parsed) continue;

        const yesIdx = parsed.outcomes.findIndex(
          (o: string) => o.toLowerCase() === 'yes'
        );
        if (yesIdx === -1) continue;

        const pProb = parsed.prices[yesIdx];
        if (!isFinite(pProb) || pProb <= 0.01 || pProb >= 0.99) continue;

        const polyTokens = tokenize(poly.question);

        // Stage 1 — topic gate: at least one topic token (≥4 chars, non-date) must overlap.
        // With months/years in stop words only genuine topic words (bitcoin, federal, etc.) reach here.
        if (!hasTopicOverlap(kalshiTokens, polyTokens) &&
            !hasTopicOverlap(polyTokens, kalshiTokens)) {
          continue;
        }

        // Stage 2 — Jaccard similarity (synonym-normalized, threshold tuned for
        // cross-platform vocabulary diversity)
        const score = jaccardSimilarity(kalshiTokens, polyTokens);
        if (score < MIN_JACCARD) continue;

        const spreadPctPoints = Math.abs(pProb - kProb) * 100;
        if (spreadPctPoints < minSpreadPct) continue;

        const tier = confidenceTier(score);
        if (minConf === 'high'   && tier !== 'high')   continue;
        if (minConf === 'medium' && tier === 'low')     continue;

        const shared       = kalshiTokens.filter(t => new Set(polyTokens).has(t) && t.length >= 4);
        const matchReasons = [`Jaccard similarity: ${(score * 100).toFixed(0)}%`];
        if (shared.length) matchReasons.push(`Shared key terms: ${shared.slice(0, 4).join(', ')}`);

        candidates.push({
          polySlug:        poly.slug,
          polyQuestion:    poly.question,
          polyYesProb:     parseFloat(pProb.toFixed(4)),
          polyVolume:      parseFloat(poly.volume || '0') > 0
                             ? `$${(parseFloat(poly.volume) / 1e6).toFixed(2)}M`
                             : 'N/A',
          polyLiquidity:   parseFloat(poly.liquidity || '0') > 0
                             ? `$${(parseFloat(poly.liquidity) / 1e6).toFixed(2)}M`
                             : 'N/A',
          polyCloseDate:   poly.endDate ?? null,
          kalshiTicker:    kalshi.ticker,
          kalshiEventTick: kalshi.event_ticker || kalshi.ticker,
          kalshiTitle:     kalshi.title,
          kalshiYesProb:   parseFloat(kProb.toFixed(4)),
          kalshiVolumeFp:  parseFloat(kalshi.volume_fp || '0'),
          kalshiCloseDate: kalshi.close_time ?? null,
          eventKey:        `${kalshi.ticker}↔${poly.slug}`,
          matchConfidence: parseFloat(score.toFixed(4)),
          matchTier:       tier,
          matchReasons,
          spreadPctPoints: parseFloat(spreadPctPoints.toFixed(2)),
          cheaperYesOn:    pProb < kProb ? 'polymarket' : 'kalshi',
        });
      }
    }

    // Deduplicate: keep best match per Polymarket slug
    const bestBySlug = new Map<string, typeof candidates[0]>();
    for (const c of candidates) {
      const existing = bestBySlug.get(c.polySlug);
      if (!existing || c.matchConfidence > existing.matchConfidence) {
        bestBySlug.set(c.polySlug, c);
      }
    }

    const ranked = [...bestBySlug.values()]
      .sort((a, b) => b.spreadPctPoints - a.spreadPctPoints)
      .slice(0, limit);

    const opportunities = ranked.map(c => {
      const caveats: string[] = [];
      if (c.matchTier === 'low')    caveats.push('Low confidence — verify these are the same event before acting.');
      if (c.matchTier === 'medium') caveats.push('Medium confidence — verify event identity before acting.');
      if (c.spreadPctPoints < 3)    caveats.push('Spread may be within bid-ask margin — net edge could be near zero.');
      if (polyStale)   caveats.push('Polymarket data is up to 2 min stale (cached).');
      if (kalshiStale) caveats.push('Kalshi data is up to 2 min stale (cached).');
      caveats.push('Cross-platform arb carries execution risk and regulatory differences (Polymarket = offshore; Kalshi = CFTC-regulated US).');

      const hedgeOn: 'polymarket' | 'kalshi' = c.cheaperYesOn === 'polymarket' ? 'kalshi' : 'polymarket';

      return {
        eventKey:        c.eventKey,
        matchConfidence: c.matchConfidence,
        matchTier:       c.matchTier,
        matchReasons:    c.matchReasons,
        polymarket: {
          question:  c.polyQuestion,
          url:       `https://polymarket.com/event/${c.polySlug}`,
          yesProb:   c.polyYesProb,
          yesProbPct:`${(c.polyYesProb * 100).toFixed(1)}%`,
          volume:    c.polyVolume,
          liquidity: c.polyLiquidity,
          closeDate: c.polyCloseDate,
        },
        kalshi: {
          ticker:         c.kalshiTicker,
          title:          c.kalshiTitle,
          url:            `https://kalshi.com/markets/${encodeURIComponent(c.kalshiEventTick.toLowerCase())}`,
          yesProb:        c.kalshiYesProb,
          yesProbPct:     `${(c.kalshiYesProb * 100).toFixed(1)}%`,
          volumeContracts:c.kalshiVolumeFp,
          closeDate:      c.kalshiCloseDate,
        },
        spread: {
          absPctPoints:  c.spreadPctPoints,
          direction:     `${c.cheaperYesOn === 'polymarket' ? 'Polymarket' : 'Kalshi'} YES is ${c.spreadPctPoints.toFixed(1)}pp cheaper`,
          cheaperYesOn:  c.cheaperYesOn,
          edgeBps:       Math.round(c.spreadPctPoints * 100),
        },
        actionHint: {
          buyYesOn: c.cheaperYesOn,
          hedgeOn,
          caveats,
        },
      };
    });

    const highConf = opportunities.filter(o => o.matchTier === 'high').length;
    const medConf  = opportunities.filter(o => o.matchTier === 'medium').length;
    const lowConf  = opportunities.length - highConf - medConf;

    return {
      success: true,
      service: 'prediction-market-spread',
      timestamp: new Date().toISOString(),
      partial: false,
      stale:   polyStale || kalshiStale,
      count:   opportunities.length,
      summary: {
        highConfidenceMatches:    highConf,
        mediumConfidenceMatches:  medConf,
        lowConfidenceMatches:     lowConf,
        candidatesCrossReferenced:`${kalshiMarkets.length} Kalshi × ${polyMarkets.length} Polymarket`,
        widestSpread: opportunities[0]
          ? `${opportunities[0].spread.absPctPoints.toFixed(1)}pp on "${opportunities[0].kalshi.title}"`
          : 'No cross-platform matches found',
      },
      opportunities,
      sourceStatus: {
        polymarket: polyStale ? 'stale' : 'live',
        kalshi:     kalshiStale ? 'stale' : 'live',
      },
      sources: [
        'Polymarket Gamma Markets API (gamma-api.polymarket.com/markets)',
        'Kalshi Exchange API CFTC-regulated (api.elections.kalshi.com)',
      ],
      note: opportunities.length === 0
        ? `No cross-platform matches found. Both exchanges may be trading on different event slates. Searched ${kalshiMarkets.length} Kalshi × ${polyMarkets.length} Polymarket active markets.`
        : 'Verify match identity before acting. This is a data signal, not financial advice. Execution risk and regulatory differences apply.',
    };
  }
}
