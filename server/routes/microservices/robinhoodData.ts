/**
 * Robinhood Chain (eip155:4663) Uniswap V3 data helpers.
 *
 * Extracted into a standalone module so both the main microservices router
 * and the intelligence (arbitrage-scanner) service can import these helpers
 * without creating a circular dependency.
 *
 * Data strategy: subgraph-first (once deployed on The Graph), DexScreener fallback.
 *
 * SUBGRAPH STATUS (verified July 8, 2026):
 *   ROBINHOOD_SUBGRAPH_DEPLOYED = false because no Uniswap v3 subgraph
 *   exists for Robinhood Chain on The Graph hosted service (HTTP 301) or
 *   Goldsky (404). Set to true and update ROBINHOOD_UNISWAP_SUBGRAPH when
 *   a subgraph is published. All fetch functions prefer the subgraph once enabled.
 *   Live fallback: DexScreener chainId="robinhood" returns real tokens with
 *   non-zero volume since chain launch on July 1, 2026.
 */

import axios from "axios";

export const ROBINHOOD_SUBGRAPH_DEPLOYED = false;
export const ROBINHOOD_UNISWAP_SUBGRAPH =
  "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3-robinhood";

// Normalize Robinhood Chain aliases to the canonical DexScreener slug.
// Accepts: "robinhood" | "robinhoodchain" | "4663" | "eip155:4663"
export function normalizeRobinhoodChainSlug(chain: string): string {
  const lower = chain.toLowerCase().replace(/[-_\s]/g, "");
  if (lower === "robinhoodchain" || lower === "4663" || lower === "eip155:4663") return "robinhood";
  return lower;
}

export async function queryRobinhoodSubgraph(
  query: string,
  variables: Record<string, any> = {}
): Promise<any> {
  if (!ROBINHOOD_SUBGRAPH_DEPLOYED) {
    throw new Error("Robinhood Chain Uniswap v3 subgraph not yet deployed — using DexScreener");
  }
  const response = await axios.post(
    ROBINHOOD_UNISWAP_SUBGRAPH,
    { query, variables },
    { timeout: 8000, headers: { "Content-Type": "application/json" } }
  );
  if (response.data.errors) {
    throw new Error(`Subgraph error: ${JSON.stringify(response.data.errors)}`);
  }
  return response.data.data;
}

/**
 * Fetch pool data for a specific token from Robinhood Chain's Uniswap v3.
 * Primary: Uniswap v3 subgraph (active once ROBINHOOD_SUBGRAPH_DEPLOYED = true).
 * Fallback: DexScreener with chainId="robinhood".
 *
 * The subgraph path includes id on token0/token1 so we can compare addresses
 * (not symbols) to determine which side of the pool the requested token occupies,
 * then select the correct price field (token0Price = price of token0 in token1 units).
 */
export async function fetchRobinhoodPoolData(tokenAddress: string): Promise<any[]> {
  const addr = tokenAddress.toLowerCase();

  try {
    const data = await queryRobinhoodSubgraph(`
      {
        pools(
          where: { or: [{ token0: "${addr}" }, { token1: "${addr}" }] },
          orderBy: totalValueLockedUSD,
          orderDirection: desc,
          first: 10
        ) {
          id
          token0 { id symbol }
          token1 { id symbol }
          feeTier
          totalValueLockedUSD
          volumeUSD
          txCount
          token0Price
          token1Price
          poolDayData(first: 1, orderBy: date, orderDirection: desc) {
            volumeUSD
            feesUSD
          }
        }
      }
    `);

    const pools = data.pools || [];
    return pools.map((p: any) => {
      const isToken0 = p.token0.id.toLowerCase() === addr;
      const volume24h = parseFloat(p.poolDayData?.[0]?.volumeUSD || "0");
      const liquidity = parseFloat(p.totalValueLockedUSD || "0");
      const priceUSD = isToken0
        ? parseFloat(p.token0Price || "0")
        : parseFloat(p.token1Price || "0");
      return {
        dex: "Uniswap V3",
        pairAddress: p.id,
        baseToken: isToken0 ? p.token0.symbol : p.token1.symbol,
        quoteToken: isToken0 ? p.token1.symbol : p.token0.symbol,
        feeTier: `${parseInt(p.feeTier) / 10000}%`,
        liquidity,
        liquidityUSD: `$${liquidity.toLocaleString()}`,
        volume24h: `$${volume24h.toLocaleString()}`,
        priceUSD: `$${priceUSD.toFixed(6)}`,
        priceChange24h: "N/A",
        txns24h: parseInt(p.txCount || "0"),
        chain: "robinhood",
        source: "uniswap-v3-subgraph",
      };
    });
  } catch (subgraphErr: any) {
    console.warn(`[Robinhood] Pool subgraph unavailable (${subgraphErr.message}), falling back to DexScreener`);
  }

  // Fallback: DexScreener — filter by Robinhood Chain slug
  const dsResp = await axios.get(
    `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`,
    { timeout: 5000 }
  );
  const pairs: any[] = dsResp.data.pairs || [];
  return pairs
    .filter((p: any) => normalizeRobinhoodChainSlug(p.chainId || "") === "robinhood")
    .map((p: any) => ({
      dex: p.dexId || "Unknown",
      pairAddress: p.pairAddress,
      baseToken: p.baseToken?.symbol || "UNKNOWN",
      quoteToken: p.quoteToken?.symbol || "UNKNOWN",
      liquidity: parseFloat(p.liquidity?.usd || "0"),
      liquidityUSD: `$${parseFloat(p.liquidity?.usd || "0").toLocaleString()}`,
      volume24h: `$${parseFloat(p.volume?.h24 || "0").toLocaleString()}`,
      priceUSD: `$${parseFloat(p.priceUsd || "0").toFixed(6)}`,
      priceChange24h: `${parseFloat(p.priceChange?.h24 || "0").toFixed(2)}%`,
      txns24h: (p.txns?.h24?.buys || 0) + (p.txns?.h24?.sells || 0),
      chain: "robinhood",
      source: "dexscreener",
    }));
}

/**
 * Fetch top DEX pools on Robinhood Chain without requiring a specific token address.
 * Uses DexScreener search filtered to Robinhood Chain, sorted by liquidity.
 */
export async function fetchRobinhoodTopPools(minLiquidity: number = 0, limit: number = 20): Promise<any[]> {
  const resp = await axios.get(
    `https://api.dexscreener.com/latest/dex/search?q=USDC`,
    { timeout: 8000 }
  );
  const pairs: any[] = resp.data.pairs || [];
  return pairs
    .filter((p: any) => normalizeRobinhoodChainSlug(p.chainId || "") === "robinhood")
    .filter((p: any) => parseFloat(p.liquidity?.usd || "0") >= minLiquidity)
    .sort((a: any, b: any) => parseFloat(b.liquidity?.usd || "0") - parseFloat(a.liquidity?.usd || "0"))
    .slice(0, limit)
    .map((p: any) => ({
      dex: p.dexId || "Unknown",
      pairAddress: p.pairAddress,
      baseToken: p.baseToken?.symbol || "UNKNOWN",
      quoteToken: p.quoteToken?.symbol || "UNKNOWN",
      liquidity: parseFloat(p.liquidity?.usd || "0"),
      liquidityUSD: `$${parseFloat(p.liquidity?.usd || "0").toLocaleString()}`,
      volume24h: `$${parseFloat(p.volume?.h24 || "0").toLocaleString()}`,
      priceUSD: `$${parseFloat(p.priceUsd || "0").toFixed(6)}`,
      priceChange24h: `${parseFloat(p.priceChange?.h24 || "0").toFixed(2)}%`,
      txns24h: (p.txns?.h24?.buys || 0) + (p.txns?.h24?.sells || 0),
      chain: "robinhood",
      source: "dexscreener",
    }));
}

/**
 * Fetch chain-level health metrics for Robinhood Chain (chain ID 4663).
 * Uses Robinhood Chain RPC for block/gas data + DexScreener for DEX activity.
 */
export async function fetchRobinhoodChainStats(): Promise<{
  chainId: number;
  chainName: string;
  latestBlock: number | null;
  gasPriceGwei: string | null;
  totalPools: number;
  totalVolume24hUSD: string;
  totalLiquidityUSD: string;
  topTokens: string[];
  source: string;
  asOf: string;
  confidence: string;
  rpcNote: string;
}> {
  const ROBINHOOD_RPC = "https://rpc.mainnet.chain.robinhood.com";
  const asOf = new Date().toISOString();

  let latestBlock: number | null = null;
  let gasPriceGwei: string | null = null;
  let rpcNote = "ok";

  try {
    const [blockResp, gasResp] = await Promise.all([
      axios.post(ROBINHOOD_RPC, { jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 1 }, { timeout: 5000 }),
      axios.post(ROBINHOOD_RPC, { jsonrpc: "2.0", method: "eth_gasPrice", params: [], id: 2 }, { timeout: 5000 }),
    ]);
    latestBlock = parseInt(blockResp.data.result || "0x0", 16) || null;
    const gasWei = parseInt(gasResp.data.result || "0x0", 16);
    gasPriceGwei = gasWei > 0 ? (gasWei / 1e9).toFixed(4) : null;
  } catch (rpcErr: any) {
    rpcNote = `rpc-unavailable: ${rpcErr.message}`;
  }

  let totalPools = 0;
  let totalVolume24h = 0;
  let totalLiquidity = 0;
  const topTokenSymbols: string[] = [];

  try {
    const dsResp = await axios.get(
      `https://api.dexscreener.com/latest/dex/search?q=USDC`,
      { timeout: 8000 }
    );
    const pairs: any[] = (dsResp.data.pairs || []).filter(
      (p: any) => normalizeRobinhoodChainSlug(p.chainId || "") === "robinhood"
    );
    totalPools = pairs.length;
    for (const p of pairs) {
      totalVolume24h += parseFloat(p.volume?.h24 || "0");
      totalLiquidity += parseFloat(p.liquidity?.usd || "0");
      const sym = p.baseToken?.symbol;
      if (sym && !topTokenSymbols.includes(sym) && topTokenSymbols.length < 5) topTokenSymbols.push(sym);
    }
  } catch {}

  return {
    chainId: 4663,
    chainName: "Robinhood Chain",
    latestBlock,
    gasPriceGwei,
    totalPools,
    totalVolume24hUSD: `$${totalVolume24h.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    totalLiquidityUSD: `$${totalLiquidity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    topTokens: topTokenSymbols,
    source: latestBlock ? "dexscreener+rpc" : "dexscreener",
    asOf,
    confidence: totalPools > 0 ? "medium" : "low",
    rpcNote,
  };
}

/**
 * Fetch top trending tokens from Robinhood Chain's Uniswap v3 subgraph.
 * Falls back to DexScreener with chainId="robinhood" if subgraph is unavailable.
 */
export async function fetchRobinhoodTrendingTokens(limit: number = 20): Promise<any[]> {
  try {
    const data = await queryRobinhoodSubgraph(`
      {
        tokens(
          first: ${Math.min(limit * 2, 50)},
          orderBy: volumeUSD,
          orderDirection: desc,
          where: { volumeUSD_gt: "0" }
        ) {
          id
          symbol
          name
          decimals
          derivedETH
          volumeUSD
          totalLiquidity
          txCount
          tokenDayData(first: 2, orderBy: date, orderDirection: desc) {
            priceUSD
            dailyVolumeUSD
            date
          }
        }
        bundles(first: 1) {
          ethPriceUSD
        }
      }
    `);

    const ethPrice = parseFloat(data.bundles?.[0]?.ethPriceUSD || "0");
    const tokens = data.tokens || [];

    return tokens.map((t: any) => {
      const today = t.tokenDayData?.[0];
      const yesterday = t.tokenDayData?.[1];
      const priceUSD = parseFloat(today?.priceUSD || "0") || (parseFloat(t.derivedETH || "0") * ethPrice);
      const prevPrice = parseFloat(yesterday?.priceUSD || "0") || priceUSD;
      const priceChange = prevPrice > 0 ? ((priceUSD - prevPrice) / prevPrice) * 100 : 0;
      const volume24h = parseFloat(today?.dailyVolumeUSD || "0");
      const liquidity = parseFloat(t.totalLiquidity || "0") * priceUSD;
      return {
        symbol: t.symbol,
        name: t.name,
        address: t.id,
        chain: "robinhood",
        price: `$${priceUSD.toFixed(6)}`,
        priceChange24h: `${priceChange.toFixed(2)}%`,
        priceChangePct: priceChange,
        volume24h: `$${volume24h.toLocaleString()}`,
        liquidity: `$${liquidity.toLocaleString()}`,
        marketCap: "N/A",
        txns24h: parseInt(t.txCount || "0"),
        source: "uniswap-v3-subgraph",
      };
    });
  } catch (subgraphErr: any) {
    console.warn(`[Robinhood] Uniswap subgraph unavailable (${subgraphErr.message}), falling back to DexScreener`);
  }

  // Fallback: DexScreener with chainId filter
  const dsResp = await axios.get(
    `https://api.dexscreener.com/token-profiles/latest/v1`,
    { timeout: 10000 }
  );
  const all: any[] = dsResp.data || [];
  const robinhoodTokens = all.filter((t: any) => normalizeRobinhoodChainSlug(t.chainId || "") === "robinhood");

  const enriched: any[] = [];
  for (const token of robinhoodTokens.slice(0, Math.min(limit * 2, 40))) {
    try {
      const pairResp = await axios.get(
        `https://api.dexscreener.com/latest/dex/tokens/${token.tokenAddress}`,
        { timeout: 5000 }
      );
      const pair = pairResp.data.pairs?.find((p: any) => normalizeRobinhoodChainSlug(p.chainId || "") === "robinhood")
        || pairResp.data.pairs?.[0];
      if (!pair) continue;
      const priceChange = parseFloat(pair.priceChange?.h24 || "0");
      enriched.push({
        symbol: pair.baseToken?.symbol || "UNKNOWN",
        name: pair.baseToken?.name || "Unknown",
        address: token.tokenAddress,
        chain: "robinhood",
        price: `$${parseFloat(pair.priceUsd || "0").toFixed(6)}`,
        priceChange24h: `${priceChange.toFixed(2)}%`,
        priceChangePct: priceChange,
        volume24h: `$${parseFloat(pair.volume?.h24 || "0").toLocaleString()}`,
        liquidity: `$${parseFloat(pair.liquidity?.usd || "0").toLocaleString()}`,
        marketCap: `$${parseFloat(pair.fdv || "0").toLocaleString()}`,
        txns24h: (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0),
        source: "dexscreener",
      });
    } catch {
      continue;
    }
  }
  return enriched;
}
