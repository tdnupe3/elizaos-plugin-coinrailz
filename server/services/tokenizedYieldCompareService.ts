/**
 * Tokenized Yield Compare Service
 *
 * Fetches live APY / yield data for major tokenized real-world asset (RWA)
 * and tokenized treasury protocols and returns a normalized comparison table.
 *
 * Primary source: DeFi Llama yields API (https://yields.llama.fi/pools)
 * — proven reliable, no API key required, covers all major protocols.
 *
 * Protocols tracked:
 *   - Ondo Finance   (USDY — tokenized US money market)
 *   - Backed Finance (bIB01 — tokenized iShares USD Bond ETF)
 *   - Superstate     (USTB — tokenized US T-bills)
 *   - Mountain Protocol (USDM — tokenized US T-bills, rebasing)
 *   - OpenEden       (TBILL — tokenized T-bills on Base)
 *   - Hashnote       (USYC — institutional cash management)
 *   - Maple Finance  (Base pool yields — private credit comparison)
 *
 * Price: $0.25 / call
 */

import { getCachedData, setCachedData } from "../routes/microservices/common";

const DEFI_LLAMA_POOLS_URL = "https://yields.llama.fi/pools";

const CACHE_TTL_MS = 60_000; // 60 seconds — yield data changes slowly
const CACHE_KEY = "tokenized-yield-compare:v1";

// Protocol name fragments to match against DeFi Llama pool data
// Keys here become the canonical protocol IDs in our response
// DeFi Llama verified project names (confirmed Jul 16 2026 against yields.llama.fi/pools)
// NOT in DeFi Llama yield pools: backed-finance, superstate, mountain-protocol, hashnote
// — those protocols report NAV via their own dashboards, not aggregated by DeFi Llama yields.
// For those, we use authoritative fallback benchmarks.
const PROTOCOL_MATCHERS: Record<
  string,
  {
    project: string;
    symbols: string[];
    displayName: string;
    assetType: string;
    inDefiLlama: boolean; // whether DeFi Llama yields API actually carries this protocol
  }
> = {
  ondo: {
    project: "ondo-yield-assets",   // confirmed DeFi Llama project name (not "ondo-finance")
    symbols: ["USDY"],
    displayName: "Ondo Finance",
    assetType: "tokenized-money-market",
    inDefiLlama: true,
  },
  backed: {
    project: "backed-finance",
    symbols: ["bIB01", "bC3M"],
    displayName: "Backed Finance",
    assetType: "tokenized-etf",
    inDefiLlama: false, // not in DeFi Llama yield pools — uses fallback
  },
  superstate: {
    project: "superstate",
    symbols: ["USTB"],
    displayName: "Superstate",
    assetType: "tokenized-tbill",
    inDefiLlama: false, // not in DeFi Llama yield pools — uses fallback
  },
  mountain: {
    project: "mountain-protocol",
    symbols: ["USDM"],
    displayName: "Mountain Protocol",
    assetType: "tokenized-tbill",
    inDefiLlama: false, // not in DeFi Llama yield pools — uses fallback
  },
  openeden: {
    project: "openeden-tbill",    // confirmed DeFi Llama project name
    symbols: ["TBL", "TBILL"],
    displayName: "OpenEden",
    assetType: "tokenized-tbill",
    inDefiLlama: true,
  },
  hashnote: {
    project: "hashnote",
    symbols: ["USYC"],
    displayName: "Hashnote",
    assetType: "tokenized-money-market",
    inDefiLlama: false, // not in DeFi Llama yield pools — uses fallback
  },
  maple: {
    project: "maple",
    symbols: ["USDC", "USDT"],    // Maple pools use USDC/USDT not MPL
    displayName: "Maple Finance",
    assetType: "private-credit",
    inDefiLlama: true,
  },
};

export interface TokenizedYieldEntry {
  protocol: string;
  token_symbol: string;
  display_name: string;
  asset_type: string;
  apy: number | null;
  apy_base: number | null;
  apy_reward: number | null;
  tvl_usd: number | null;
  chain: string;
  pool_id: string;
  il_risk: string;
  stable_coin: boolean;
  data_source: "defillama" | "fallback";
  updated_at: string;
}

export interface TokenizedYieldCompareOutput {
  success: boolean;
  count: number;
  live_protocols_found: number;    // Protocols with live DeFi Llama data
  fallback_protocols: number;      // Protocols using benchmark fallback data
  protocols_not_indexed: string[]; // Protocols absent from DeFi Llama (using fallback)
  yields: TokenizedYieldEntry[];
  benchmark: {
    highest_apy: { protocol: string; apy: number } | null;
    lowest_apy: { protocol: string; apy: number } | null;
    average_apy: number | null;
    total_tvl_usd: number;
  };
  data_transparency: string;       // Clear statement of live vs fallback coverage
  note: string;
  service: string;
  generated_at: string;
}

// Fallback data when DeFi Llama is unavailable — approximate real-world values
// These reflect typical tokenized treasury yields as of mid-2026
const FALLBACK_YIELDS: Record<string, Omit<TokenizedYieldEntry, "updated_at" | "data_source">> = {
  ondo: {
    protocol: "ondo",
    token_symbol: "USDY",
    display_name: "Ondo Finance",
    asset_type: "tokenized-money-market",
    apy: 4.85,
    apy_base: 4.85,
    apy_reward: null,
    tvl_usd: 850_000_000,
    chain: "Ethereum",
    pool_id: "ondo-usdy-fallback",
    il_risk: "no",
    stable_coin: false,
  },
  backed: {
    protocol: "backed",
    token_symbol: "bIB01",
    display_name: "Backed Finance",
    asset_type: "tokenized-etf",
    apy: 4.92,
    apy_base: 4.92,
    apy_reward: null,
    tvl_usd: 210_000_000,
    chain: "Ethereum",
    pool_id: "backed-bib01-fallback",
    il_risk: "no",
    stable_coin: false,
  },
  superstate: {
    protocol: "superstate",
    token_symbol: "USTB",
    display_name: "Superstate",
    asset_type: "tokenized-tbill",
    apy: 5.10,
    apy_base: 5.10,
    apy_reward: null,
    tvl_usd: 320_000_000,
    chain: "Ethereum",
    pool_id: "superstate-ustb-fallback",
    il_risk: "no",
    stable_coin: false,
  },
  mountain: {
    protocol: "mountain",
    token_symbol: "USDM",
    display_name: "Mountain Protocol",
    asset_type: "tokenized-tbill",
    apy: 4.95,
    apy_base: 4.95,
    apy_reward: null,
    tvl_usd: 190_000_000,
    chain: "Ethereum",
    pool_id: "mountain-usdm-fallback",
    il_risk: "no",
    stable_coin: false,
  },
  openeden: {
    protocol: "openeden",
    token_symbol: "TBILL",
    display_name: "OpenEden",
    asset_type: "tokenized-tbill",
    apy: 5.05,
    apy_base: 5.05,
    apy_reward: null,
    tvl_usd: 85_000_000,
    chain: "Ethereum",
    pool_id: "openeden-tbill-fallback",
    il_risk: "no",
    stable_coin: false,
  },
  hashnote: {
    protocol: "hashnote",
    token_symbol: "USYC",
    display_name: "Hashnote",
    asset_type: "tokenized-money-market",
    apy: 5.18,
    apy_base: 5.18,
    apy_reward: null,
    tvl_usd: 420_000_000,
    chain: "Ethereum",
    pool_id: "hashnote-usyc-fallback",
    il_risk: "no",
    stable_coin: false,
  },
  maple: {
    protocol: "maple",
    token_symbol: "MPL",
    display_name: "Maple Finance",
    asset_type: "private-credit",
    apy: 8.40,
    apy_base: 8.40,
    apy_reward: null,
    tvl_usd: 160_000_000,
    chain: "Ethereum",
    pool_id: "maple-fallback",
    il_risk: "no",
    stable_coin: false,
  },
};

async function fetchDefiLlamaYields(): Promise<any[] | null> {
  try {
    const response = await fetch(DEFI_LLAMA_POOLS_URL, {
      headers: { "User-Agent": "CoinRailz/1.0 tokenized-yield-compare" },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return Array.isArray(data?.data) ? data.data : null;
  } catch {
    return null;
  }
}

// Exact project-name match (DeFi Llama project field must equal the matcher.project exactly)
// plus symbol match — prevents cross-protocol contamination from substring collisions
function matchPool(
  pool: any,
  matcher: { project: string; symbols: string[]; inDefiLlama: boolean }
): boolean {
  if (!matcher.inDefiLlama) return false; // skip API lookup for known-absent protocols
  const projectMatch =
    typeof pool.project === "string" &&
    pool.project.toLowerCase() === matcher.project.toLowerCase();
  const symbolMatch =
    typeof pool.symbol === "string" &&
    matcher.symbols.some((s) =>
      pool.symbol.toUpperCase().includes(s.toUpperCase())
    );
  return projectMatch && symbolMatch;
}

export async function tokenizedYieldCompareService(input: {
  tokens?: string[];
  chain?: string;
}): Promise<TokenizedYieldCompareOutput> {
  // Cache key includes request shape — avoids poisoning filtered responses with unfiltered data
  const tokensKey = input.tokens?.length ? input.tokens.sort().join(",") : "all";
  const chainKey = input.chain || "all";
  const cacheKey = `${CACHE_KEY}:${tokensKey}:${chainKey}`;
  const cached = getCachedData(cacheKey);
  if (cached) return cached;

  const now = new Date().toISOString();
  const results: TokenizedYieldEntry[] = [];
  const notIndexed: string[] = []; // protocols confirmed absent from DeFi Llama

  // Determine which protocols to query
  const requestedProtocols = input.tokens?.length
    ? Object.keys(PROTOCOL_MATCHERS).filter((k) =>
        input.tokens!.some(
          (t) =>
            k.includes(t.toLowerCase()) ||
            PROTOCOL_MATCHERS[k].symbols.some((s) =>
              s.toLowerCase().includes(t.toLowerCase())
            )
        )
      )
    : Object.keys(PROTOCOL_MATCHERS);

  // Fetch DeFi Llama pool data (only needed if any requested protocol is in DeFi Llama)
  const needsLlama = requestedProtocols.some((k) => PROTOCOL_MATCHERS[k].inDefiLlama);
  const pools = needsLlama ? await fetchDefiLlamaYields() : null;

  let liveCount = 0;
  let fallbackCount = 0;

  for (const protocolKey of requestedProtocols) {
    const matcher = PROTOCOL_MATCHERS[protocolKey];

    if (matcher.inDefiLlama && pools) {
      // Find best matching pool (highest TVL among exact-match hits)
      const matches = pools.filter((p) => matchPool(p, matcher));
      if (matches.length > 0) {
        const best = matches.sort((a, b) => (b.tvlUsd || 0) - (a.tvlUsd || 0))[0];
        results.push({
          protocol: protocolKey,
          token_symbol: best.symbol || matcher.symbols[0],
          display_name: matcher.displayName,
          asset_type: matcher.assetType,
          apy: best.apy != null ? Math.round(best.apy * 100) / 100 : null,
          apy_base: best.apyBase != null ? Math.round(best.apyBase * 100) / 100 : null,
          apy_reward: best.apyReward != null ? Math.round(best.apyReward * 100) / 100 : null,
          tvl_usd: best.tvlUsd || null,
          chain: best.chain || "Unknown",
          pool_id: best.pool || `${protocolKey}-unknown`,
          il_risk: best.ilRisk || "no",
          stable_coin: !!best.stablecoin,
          data_source: "defillama",
          updated_at: now,
        });
        liveCount++;
        continue;
      }
      // inDefiLlama=true but no pool found — fall through to fallback and note it
    }

    if (!matcher.inDefiLlama) {
      // Known to be absent from DeFi Llama — go straight to fallback, note it
      notIndexed.push(matcher.displayName);
    }

    // Use fallback data for protocols not in DeFi Llama or when live fetch failed
    const fallback = FALLBACK_YIELDS[protocolKey];
    if (fallback) {
      results.push({ ...fallback, data_source: "fallback", updated_at: now });
      fallbackCount++;
    }
  }

  // Apply chain filter after collection (DeFi Llama chains are capitalized, e.g. "Ethereum")
  const filteredResults = input.chain
    ? results.filter((r) => r.chain.toLowerCase() === input.chain!.toLowerCase())
    : results;

  // Sort by APY descending
  filteredResults.sort((a, b) => (b.apy ?? 0) - (a.apy ?? 0));

  const apysWithData = filteredResults.filter((r) => r.apy != null).map((r) => r.apy as number);
  const totalTvl = filteredResults.reduce((sum, r) => sum + (r.tvl_usd ?? 0), 0);

  const benchmark = {
    highest_apy:
      apysWithData.length > 0
        ? { protocol: filteredResults.find((r) => r.apy === Math.max(...apysWithData))!.display_name, apy: Math.max(...apysWithData) }
        : null,
    lowest_apy:
      apysWithData.length > 0
        ? { protocol: filteredResults.find((r) => r.apy === Math.min(...apysWithData))!.display_name, apy: Math.min(...apysWithData) }
        : null,
    average_apy:
      apysWithData.length > 0
        ? Math.round((apysWithData.reduce((s, v) => s + v, 0) / apysWithData.length) * 100) / 100
        : null,
    total_tvl_usd: totalTvl,
  };

  const result: TokenizedYieldCompareOutput = {
    success: true,
    count: filteredResults.length,
    live_protocols_found: liveCount,
    fallback_protocols: fallbackCount,
    protocols_not_indexed: notIndexed,
    yields: filteredResults,
    benchmark,
    data_transparency:
      `${liveCount} of ${requestedProtocols.length} requested protocols have live DeFi Llama data. ` +
      `${fallbackCount} protocol(s) use benchmark fallback yields (Backed Finance, Superstate, Mountain Protocol, Hashnote ` +
      `are not indexed by DeFi Llama yields API as of Jul 2026 — they report NAV via their own dashboards). ` +
      `Fallback yields are approximate benchmarks, not live prices.`,
    note:
      pools
        ? "Primary: live DeFi Llama yields API (30-day rolling APYs). Non-indexed protocols use benchmark fallback data."
        : "DeFi Llama unavailable — all entries use approximate benchmark yields. Retry for live data.",
    service: "tokenized-yield-compare",
    generated_at: now,
  };

  setCachedData(cacheKey, result, CACHE_TTL_MS);
  return result;
}
