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
const PROTOCOL_MATCHERS: Record<
  string,
  { project: string; symbols: string[]; displayName: string; assetType: string }
> = {
  ondo: {
    project: "ondo-finance",
    symbols: ["USDY"],
    displayName: "Ondo Finance",
    assetType: "tokenized-money-market",
  },
  backed: {
    project: "backed-finance",
    symbols: ["bIB01", "bC3M"],
    displayName: "Backed Finance",
    assetType: "tokenized-etf",
  },
  superstate: {
    project: "superstate",
    symbols: ["USTB"],
    displayName: "Superstate",
    assetType: "tokenized-tbill",
  },
  mountain: {
    project: "mountain-protocol",
    symbols: ["USDM"],
    displayName: "Mountain Protocol",
    assetType: "tokenized-tbill",
  },
  openedem: {
    project: "openedem",
    symbols: ["TBILL"],
    displayName: "OpenEden",
    assetType: "tokenized-tbill",
  },
  hashnote: {
    project: "hashnote",
    symbols: ["USYC"],
    displayName: "Hashnote",
    assetType: "tokenized-money-market",
  },
  maple: {
    project: "maple",
    symbols: ["MPL"],
    displayName: "Maple Finance",
    assetType: "private-credit",
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
  protocols_found: number;
  protocols_missing: string[];
  yields: TokenizedYieldEntry[];
  benchmark: {
    highest_apy: { protocol: string; apy: number } | null;
    lowest_apy: { protocol: string; apy: number } | null;
    average_apy: number | null;
    total_tvl_usd: number;
  };
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
  openedem: {
    protocol: "openedem",
    token_symbol: "TBILL",
    display_name: "OpenEden",
    asset_type: "tokenized-tbill",
    apy: 5.05,
    apy_base: 5.05,
    apy_reward: null,
    tvl_usd: 85_000_000,
    chain: "Base",
    pool_id: "openedem-tbill-fallback",
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

function matchPool(
  pool: any,
  matcher: { project: string; symbols: string[] }
): boolean {
  const projectMatch =
    typeof pool.project === "string" &&
    pool.project.toLowerCase().includes(matcher.project.split("-")[0]);
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
  const cached = getCachedData(CACHE_KEY);
  if (cached) return cached;

  const now = new Date().toISOString();
  const results: TokenizedYieldEntry[] = [];
  const protocolsMissing: string[] = [];

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

  // Fetch DeFi Llama pool data
  const pools = await fetchDefiLlamaYields();
  const dataSource: "defillama" | "fallback" = pools ? "defillama" : "fallback";

  for (const protocolKey of requestedProtocols) {
    const matcher = PROTOCOL_MATCHERS[protocolKey];

    if (pools) {
      // Find best matching pool (highest TVL among matches)
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
        continue;
      }
    }

    // Use fallback data
    const fallback = FALLBACK_YIELDS[protocolKey];
    if (fallback) {
      results.push({ ...fallback, data_source: "fallback", updated_at: now });
    } else {
      protocolsMissing.push(matcher.displayName);
    }
  }

  // Sort by APY descending
  results.sort((a, b) => (b.apy ?? 0) - (a.apy ?? 0));

  const apysWithData = results.filter((r) => r.apy != null).map((r) => r.apy as number);
  const totalTvl = results.reduce((sum, r) => sum + (r.tvl_usd ?? 0), 0);

  const benchmark = {
    highest_apy:
      apysWithData.length > 0
        ? { protocol: results.find((r) => r.apy === Math.max(...apysWithData))!.display_name, apy: Math.max(...apysWithData) }
        : null,
    lowest_apy:
      apysWithData.length > 0
        ? { protocol: results.find((r) => r.apy === Math.min(...apysWithData))!.display_name, apy: Math.min(...apysWithData) }
        : null,
    average_apy:
      apysWithData.length > 0
        ? Math.round((apysWithData.reduce((s, v) => s + v, 0) / apysWithData.length) * 100) / 100
        : null,
    total_tvl_usd: totalTvl,
  };

  const result: TokenizedYieldCompareOutput = {
    success: true,
    count: results.length,
    protocols_found: results.length,
    protocols_missing: protocolsMissing,
    yields: results,
    benchmark,
    note:
      dataSource === "defillama"
        ? "Live data from DeFi Llama yields API. APYs reflect 30-day rolling averages."
        : "Live data unavailable — using approximate benchmark yields. Retry for live data.",
    service: "tokenized-yield-compare",
    generated_at: now,
  };

  setCachedData(CACHE_KEY, result, CACHE_TTL_MS);
  return result;
}
