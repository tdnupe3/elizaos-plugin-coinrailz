import { callOpenAI, formatJSONResponse, getCachedData, setCachedData, safeParseJSON } from "./common";
import { z } from "zod";
import axios from "axios";
// Robinhood Chain helpers from the shared module — no circular dependency.
// fetchRobinhoodPoolData: subgraph-first (Uniswap V3), DexScreener fallback.
import { fetchRobinhoodPoolData, normalizeRobinhoodChainSlug } from "./robinhoodData";

// Zod schemas for validating AI responses
const arbitrageOpportunitySchema = z.object({
  asset: z.string(),
  buyExchange: z.string(),
  sellExchange: z.string(),
  priceDiff: z.number(),
  profitPercentage: z.number(),
  estimatedProfit: z.number(),
  executionRisk: z.string()
}).partial();

const arbitrageResponseSchema = z.object({
  opportunities: z.array(arbitrageOpportunitySchema).default([]),
  totalOpportunities: z.number().default(0),
  bestOpportunity: z.object({
    asset: z.string(),
    profit: z.number(),
    confidence: z.number()
  }).partial().optional(),
  marketConditions: z.string().optional(),
  gasEstimate: z.number().optional(),
  netProfitAfterFees: z.number().optional(),
  recommendations: z.string().optional()
});

const correlationResponseSchema = z.object({
  correlationPairs: z.array(z.object({
    asset1: z.string(),
    asset2: z.string(),
    correlation: z.number(),
    strength: z.string().optional(),
    relationship: z.string().optional()
  })).default([]),
  strongCorrelations: z.array(z.any()).optional(),
  divergences: z.array(z.any()).optional(),
  hedgingOpportunities: z.array(z.any()).optional(),
  portfolioInsights: z.string().optional(),
  riskImplications: z.string().optional()
});

const riskMetricsResponseSchema = z.object({
  valueAtRisk: z.object({
    var95: z.number(),
    var99: z.number(),
    cvar: z.number().optional(),
    timeHorizon: z.string().optional()
  }).partial().optional(),
  sharpeRatio: z.number().optional(),
  sortinoRatio: z.number().optional(),
  maxDrawdown: z.number().optional(),
  beta: z.number().optional(),
  volatility: z.object({
    daily: z.number(),
    monthly: z.number(),
    annualized: z.number()
  }).partial().optional(),
  riskLevel: z.string().optional(),
  stressScenarios: z.array(z.any()).optional(),
  recommendations: z.string().optional()
});

const INTELLIGENCE_SYSTEM_PROMPTS = {
  arbitrageScanner: `You are a DeFi arbitrage specialist. Analyze cross-exchange price differentials and identify profitable opportunities in JSON format.
Your response MUST be valid JSON with this exact structure:
{
  "opportunities": [{"asset": string, "buyExchange": string, "sellExchange": string, "priceDiff": number, "profitPercentage": number, "estimatedProfit": number, "executionRisk": string}],
  "totalOpportunities": number,
  "bestOpportunity": {"asset": string, "profit": number, "confidence": number},
  "marketConditions": string,
  "gasEstimate": number,
  "netProfitAfterFees": number,
  "recommendations": string
}`,
  
  correlationMatrix: `You are a quantitative analyst specializing in cross-asset correlation analysis. Generate correlation insights in JSON format.
Your response MUST be valid JSON with this exact structure:
{
  "correlationPairs": [{"asset1": string, "asset2": string, "correlation": number, "strength": string, "relationship": string}],
  "strongCorrelations": [{"pair": string, "coefficient": number, "implication": string}],
  "divergences": [{"pair": string, "historicalCorr": number, "currentCorr": number, "significance": string}],
  "hedgingOpportunities": [{"position": string, "hedge": string, "reason": string}],
  "portfolioInsights": string,
  "riskImplications": string
}`,
  
  riskMetrics: `You are a risk management expert calculating VaR, Sharpe ratio, and portfolio risk metrics in JSON format.
Your response MUST be valid JSON with this exact structure:
{
  "valueAtRisk": {"var95": number, "var99": number, "cvar": number, "timeHorizon": string},
  "sharpeRatio": number,
  "sortinoRatio": number,
  "maxDrawdown": number,
  "beta": number,
  "volatility": {"daily": number, "monthly": number, "annualized": number},
  "riskLevel": string ("Low" | "Medium" | "High" | "Extreme"),
  "stressScenarios": [{"scenario": string, "impact": number, "probability": string}],
  "recommendations": string
}`
};

// ============= ROBINHOOD CHAIN + CROSS-CHAIN PRICE FETCHING =============

// Chain slug normalization: maps user-supplied chain names to DexScreener chainId slugs.
// Robinhood Chain (eip155:4663, Arbitrum Orbit L2) uses slug "robinhood" on DexScreener.
const CHAIN_SLUG_MAP: Record<string, string> = {
  ethereum: "ethereum",
  eth: "ethereum",
  base: "base",
  polygon: "polygon",
  matic: "polygon",
  arbitrum: "arbitrum",
  arb: "arbitrum",
  optimism: "optimism",
  op: "optimism",
  robinhood: "robinhood",
  robinhoodchain: "robinhood",
  "4663": "robinhood",
};

// Human-readable chain labels for opportunity output
const CHAIN_LABELS: Record<string, string> = {
  ethereum: "Ethereum",
  base: "Base",
  polygon: "Polygon",
  arbitrum: "Arbitrum",
  optimism: "Optimism",
  robinhood: "Robinhood Chain",
};

function normalizeChainSlug(chain: string): string {
  const key = chain.toLowerCase().replace(/[-_\s]/g, "");
  return CHAIN_SLUG_MAP[key] || chain.toLowerCase();
}

// Estimated gas cost in USD to swap + bridge + swap cross-chain (conservative).
// Robinhood Chain is an Arbitrum Orbit L2 — bridging costs are lower than mainnet.
const GAS_COST_USD: Record<string, number> = {
  "ethereum-base": 12,
  "ethereum-arbitrum": 11,
  "ethereum-polygon": 11,
  "ethereum-robinhood": 14,
  "base-robinhood": 6,
  "arbitrum-robinhood": 7,
  "polygon-robinhood": 8,
  default: 12,
};

function estimateGasUSD(buyChain: string, sellChain: string): number {
  const key = `${buyChain}-${sellChain}`;
  const reverseKey = `${sellChain}-${buyChain}`;
  return GAS_COST_USD[key] ?? GAS_COST_USD[reverseKey] ?? GAS_COST_USD.default;
}

// Bridge name for the execution path
function bridgeName(from: string, to: string): string {
  const bridges: Record<string, string> = {
    "ethereum-base": "Coinbase Bridge",
    "base-ethereum": "Coinbase Bridge",
    "ethereum-arbitrum": "Arbitrum Bridge",
    "arbitrum-ethereum": "Arbitrum Bridge",
    "ethereum-polygon": "Polygon PoS Bridge",
    "polygon-ethereum": "Polygon PoS Bridge",
    "robinhood-base": "Robinhood Chain Bridge (Arbitrum Orbit)",
    "base-robinhood": "Robinhood Chain Bridge (Arbitrum Orbit)",
    "robinhood-ethereum": "Robinhood Chain Bridge → Ethereum",
    "ethereum-robinhood": "Ethereum → Robinhood Chain Bridge",
    "robinhood-arbitrum": "Robinhood Chain Bridge (Arbitrum Orbit)",
    "arbitrum-robinhood": "Robinhood Chain Bridge (Arbitrum Orbit)",
    "robinhood-polygon": "Robinhood Chain → CCTP → Polygon",
    "polygon-robinhood": "Polygon → CCTP → Robinhood Chain",
  };
  return bridges[`${from}-${to}`] ?? "Cross-Chain Bridge";
}

/** Parse a price/liquidity string that may be formatted as "$1,234.56" or "1234.56" */
function parseFormattedNumber(value: string | number | undefined): number {
  if (value === undefined || value === null) return 0;
  if (typeof value === "number") return value;
  return parseFloat(String(value).replace(/[$,\s]/g, "")) || 0;
}

interface PoolSample {
  priceUSD: number;
  chain: string;
  dexLabel: string;
  pairAddress: string;
  tokenAddress?: string;
  liquidityUSD: number;
  volume24h: number;
  source: string;
}

/**
 * Fetch the best-priced pool for a token symbol on non-Robinhood chains using DexScreener search.
 *
 * Asset matching: only accepts pairs where the base token's symbol exactly matches the requested
 * symbol (case-insensitive). This prevents unrelated assets from being compared across chains,
 * which would generate false arbitrage opportunities.
 *
 * Also captures the token address on Robinhood Chain (from base or quote token in search results)
 * so that fetchRobinhoodPoolData can be called with the correct address.
 *
 * @returns prices — one PoolSample per non-Robinhood chain (highest-liquidity base-token match)
 * @returns robinhoodTokenAddress — on-chain address of the token on Robinhood Chain, or null
 */
async function fetchNonRobinhoodPrices(
  symbol: string,
  chains: string[]
): Promise<{ prices: Map<string, PoolSample>; robinhoodTokenAddress: string | null }> {
  const targetSlug = symbol.toUpperCase();
  const allowedSlugs = new Set(chains.filter(c => c !== "robinhood").map(normalizeChainSlug));
  const prices = new Map<string, PoolSample>();
  let robinhoodTokenAddress: string | null = null;

  try {
    const resp = await axios.get(
      `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(symbol)}`,
      { timeout: 7000 }
    );
    const pairs: any[] = resp.data?.pairs ?? [];

    for (const pair of pairs) {
      const chainSlug = normalizeChainSlug(pair.chainId || "");
      const baseSymbol = (pair.baseToken?.symbol || "").toUpperCase();
      const quoteSymbol = (pair.quoteToken?.symbol || "").toUpperCase();

      // Capture Robinhood Chain token address for fetchRobinhoodPoolData (base token preferred)
      if (chainSlug === "robinhood" && !robinhoodTokenAddress) {
        if (baseSymbol === targetSlug && pair.baseToken?.address) {
          robinhoodTokenAddress = pair.baseToken.address;
        } else if (quoteSymbol === targetSlug && pair.quoteToken?.address) {
          robinhoodTokenAddress = pair.quoteToken.address;
        }
      }

      // Only process non-Robinhood chains
      if (!allowedSlugs.has(chainSlug)) continue;

      // STRICT ASSET MATCHING: only accept pairs where the base token is the requested symbol.
      // DexScreener priceUsd = USD price of the base token, so this gives us the correct price
      // directly without any inversion arithmetic that could introduce errors.
      if (baseSymbol !== targetSlug) continue;

      const priceUSD = parseFloat(pair.priceUsd || "0");
      if (priceUSD <= 0) continue;

      const liquidityUSD = parseFloat(pair.liquidity?.usd || "0");
      const volume24h = parseFloat(pair.volume?.h24 || "0");

      const existing = prices.get(chainSlug);
      if (!existing || liquidityUSD > existing.liquidityUSD) {
        prices.set(chainSlug, {
          priceUSD,
          chain: chainSlug,
          dexLabel: pair.dexId || "Unknown DEX",
          pairAddress: pair.pairAddress || "",
          tokenAddress: pair.baseToken?.address,
          liquidityUSD,
          volume24h,
          source: "dexscreener",
        });
      }
    }
  } catch (err: any) {
    console.warn(`[arbitrage-scanner] DexScreener search failed for ${symbol}: ${err.message}`);
  }

  return { prices, robinhoodTokenAddress };
}

/**
 * Fetch Robinhood Chain price for a token using fetchRobinhoodPoolData (the Task #8 helper).
 * Strategy: Uniswap V3 subgraph (once ROBINHOOD_SUBGRAPH_DEPLOYED = true), DexScreener fallback.
 * Requires a token address. Returns null if no valid pool found.
 */
async function fetchRobinhoodChainPrice(tokenAddress: string): Promise<PoolSample | null> {
  try {
    const pools = await fetchRobinhoodPoolData(tokenAddress);
    if (!pools || pools.length === 0) return null;

    // Pick highest-liquidity pool
    const best = pools.reduce((a: any, b: any) => {
      const liqA = parseFormattedNumber(a.liquidityUSD);
      const liqB = parseFormattedNumber(b.liquidityUSD);
      return liqB > liqA ? b : a;
    });

    const priceUSD = parseFormattedNumber(best.priceUSD);
    if (priceUSD <= 0) return null;

    return {
      priceUSD,
      chain: "robinhood",
      dexLabel: best.dex || "Uniswap V3",
      pairAddress: best.pairAddress || "",
      tokenAddress,
      liquidityUSD: parseFormattedNumber(best.liquidityUSD),
      volume24h: parseFormattedNumber(best.volume24h),
      source: best.source || "dexscreener",
    };
  } catch (err: any) {
    console.warn(`[arbitrage-scanner] fetchRobinhoodPoolData failed for ${tokenAddress}: ${err.message}`);
    return null;
  }
}

/**
 * Compute cross-chain arbitrage opportunities from a map of chain → pool data.
 *
 * Only surfaces opportunities where at least one leg is Robinhood Chain (eip155:4663).
 *
 * estimatedProfit and fees are always computed from maxCapital (the liquidity-capped deployable
 * amount), not from the full capitalUSD, so profit is never overstated relative to requiredCapital.
 *
 * maxGasPrice (Gwei): when includeGasCosts is true, gas cost is scaled by this relative to a
 * 50 Gwei baseline. When includeGasCosts is false, gas cost is excluded from profit calculation.
 */
function computeArbitrageOpportunities(
  symbol: string,
  prices: Map<string, PoolSample>,
  minProfitPercent: number,
  capitalUSD: number,
  maxGasPrice: number,
  includeGasCosts: boolean
): any[] {
  const entries = Array.from(prices.entries());
  const opportunities: any[] = [];

  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const [chainA, poolA] = entries[i];
      const [chainB, poolB] = entries[j];

      // Only include opportunities where Robinhood Chain is one of the legs
      if (chainA !== "robinhood" && chainB !== "robinhood") continue;

      // Determine buy/sell direction (buy on cheaper chain, sell on more expensive)
      const [buyChain, buyPool, sellChain, sellPool] =
        poolA.priceUSD < poolB.priceUSD
          ? [chainA, poolA, chainB, poolB]
          : [chainB, poolB, chainA, poolA];

      const priceDiff = sellPool.priceUSD - buyPool.priceUSD;
      const grossPct = (priceDiff / buyPool.priceUSD) * 100;

      if (grossPct < minProfitPercent) continue;

      // Capital capped to 20% of shallower pool's liquidity to limit slippage impact
      const maxCapital = Math.min(
        capitalUSD,
        Math.min(buyPool.liquidityUSD, sellPool.liquidityUSD) * 0.20
      );
      if (maxCapital <= 0) continue;

      // Gas cost: base estimate scaled by maxGasPrice / 50 Gwei baseline.
      // When includeGasCosts is false, treat gas as $0 (gross profit only view).
      const baseGasUSD = estimateGasUSD(buyChain, sellChain);
      const scaledGasUSD = includeGasCosts ? baseGasUSD * (maxGasPrice / 50) : 0;

      // DEX fee: 0.3% buy + 0.3% sell = 0.6% round-trip, applied to maxCapital
      const feeUSD = maxCapital * 0.006;

      // All profit calculations use maxCapital — never overstates profit vs requiredCapital
      const grossProfit = maxCapital * (grossPct / 100);
      const netProfit = grossProfit - scaledGasUSD - feeUSD;

      if (netProfit <= 0) continue;

      const bridge = bridgeName(buyChain, sellChain);
      const buyLabel = CHAIN_LABELS[buyChain] ?? buyChain;
      const sellLabel = CHAIN_LABELS[sellChain] ?? sellChain;

      opportunities.push({
        asset: symbol,
        buyChain: buyLabel,
        sellChain: sellLabel,
        buyExchange: `${buyPool.dexLabel} (${buyLabel})`,
        sellExchange: `${sellPool.dexLabel} (${sellLabel})`,
        buyPriceUSD: parseFloat(buyPool.priceUSD.toFixed(6)),
        sellPriceUSD: parseFloat(sellPool.priceUSD.toFixed(6)),
        priceDiff: parseFloat(priceDiff.toFixed(6)),
        profitPercentage: parseFloat(grossPct.toFixed(4)),
        netProfitPercentage: parseFloat(((netProfit / maxCapital) * 100).toFixed(4)),
        estimatedProfit: parseFloat(netProfit.toFixed(2)),
        requiredCapital: parseFloat(maxCapital.toFixed(2)),
        gasEstimate: parseFloat(scaledGasUSD.toFixed(2)),
        feesEstimate: parseFloat(feeUSD.toFixed(2)),
        includeGasCosts,
        executionPath: [
          `Buy ${symbol} on ${buyPool.dexLabel} (${buyLabel}) at $${buyPool.priceUSD.toFixed(6)}`,
          `Bridge via ${bridge}`,
          `Sell ${symbol} on ${sellPool.dexLabel} (${sellLabel}) at $${sellPool.priceUSD.toFixed(6)}`,
        ],
        liquidityBuyChain: `$${buyPool.liquidityUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
        liquiditySellChain: `$${sellPool.liquidityUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
        volume24hBuyChain: `$${buyPool.volume24h.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
        robinhoodDataSource: (buyChain === "robinhood" ? buyPool : sellPool).source,
        executionRisk: grossPct > 5 ? "High (stale price likely)" : grossPct > 2 ? "Medium" : "Low",
        pairAddresses: {
          [buyChain]: buyPool.pairAddress,
          [sellChain]: sellPool.pairAddress,
        },
      });
    }
  }

  // Sort by estimated net profit descending
  return opportunities.sort((a, b) => b.estimatedProfit - a.estimatedProfit);
}

export async function arbitrageScannerService(data: {
  assets?: string[];
  minProfitPercent?: number;
  maxGasPrice?: number;
  chains?: string[];
  includeGasCosts?: boolean;
  capitalUSD?: number;
}) {
  const assetsToScan = data.assets || ["WETH", "USDC", "DAI", "WBTC"];
  // Always include Robinhood Chain — the scanner's primary value is finding
  // cross-chain price gaps between Robinhood Chain's Uniswap V3 and other DEXes.
  const requestedChains = data.chains || ["ethereum", "base", "polygon", "arbitrum"];
  const chainsToScan = Array.from(new Set([...requestedChains.map(normalizeChainSlug), "robinhood"]));
  const minProfit = data.minProfitPercent ?? 0.5;
  const capitalUSD = data.capitalUSD ?? 10000;
  // maxGasPrice in Gwei: scales gas cost estimate relative to a 50 Gwei baseline.
  const maxGasPrice = data.maxGasPrice ?? 50;
  // includeGasCosts: when false, gas is excluded from net profit (gross-only view).
  const includeGasCosts = data.includeGasCosts !== false;

  const cacheKey = `arbitrage-rhc-${assetsToScan.join("-")}-${chainsToScan.sort().join("-")}-${minProfit}-${maxGasPrice}-${includeGasCosts}`;
  const cached = getCachedData(cacheKey);
  if (cached) return cached;

  console.log(`[arbitrage-scanner] Scanning ${assetsToScan.length} assets across: ${chainsToScan.join(", ")}`);

  // ── Phase 1: Fetch real on-chain prices ───────────────────────────────────
  // For non-Robinhood chains: DexScreener search API (strict base-token symbol matching).
  // For Robinhood Chain: fetchRobinhoodPoolData (subgraph-first via Task #8 helper,
  //   DexScreener fallback). Token address resolved from non-Robinhood search results.
  const realOpportunities: any[] = [];
  const priceSnapshot: Record<string, Record<string, number>> = {};

  await Promise.allSettled(
    assetsToScan.map(async (symbol) => {
      try {
        // Step 1: non-Robinhood prices + Robinhood token address discovery
        const { prices, robinhoodTokenAddress } = await fetchNonRobinhoodPrices(symbol, chainsToScan);

        // Step 2: Robinhood Chain price via fetchRobinhoodPoolData (subgraph → DexScreener)
        if (robinhoodTokenAddress) {
          const rhcPool = await fetchRobinhoodChainPrice(robinhoodTokenAddress);
          if (rhcPool) {
            prices.set("robinhood", rhcPool);
          }
        }

        // Build snapshot for AI context
        priceSnapshot[symbol] = {};
        for (const [chain, pool] of prices.entries()) {
          priceSnapshot[symbol][chain] = pool.priceUSD;
        }

        const opps = computeArbitrageOpportunities(
          symbol, prices, minProfit, capitalUSD, maxGasPrice, includeGasCosts
        );
        realOpportunities.push(...opps);
      } catch (err: any) {
        console.warn(`[arbitrage-scanner] Scan skipped for ${symbol}: ${err.message}`);
      }
    })
  );

  realOpportunities.sort((a, b) => b.estimatedProfit - a.estimatedProfit);
  console.log(`[arbitrage-scanner] Found ${realOpportunities.length} real opportunities involving Robinhood Chain`);

  // ── Phase 2: AI enrichment for market context and recommendations ─────────
  let marketConditions = "Real-time cross-chain price data from DexScreener (Robinhood Chain via Uniswap V3 subgraph helper).";
  let recommendations = "Execute quickly — cross-chain arbitrage windows are narrow (typically < 60s). Verify on-chain prices before committing capital.";
  let gasEstimate = estimateGasUSD("robinhood", "base") * (maxGasPrice / 50);

  const priceLines = Object.entries(priceSnapshot)
    .map(([sym, chains]) =>
      `${sym}: ` +
      Object.entries(chains)
        .map(([c, p]) => `${CHAIN_LABELS[c] ?? c}=$${p.toFixed(6)}`)
        .join(", ")
    )
    .join("\n");

  try {
    const aiContext = `
Real-time price snapshot (base-token-matched, Robinhood Chain via fetchRobinhoodPoolData):
${priceLines || "No live price data returned from DexScreener"}

Scan parameters: minProfitPercent=${minProfit}%, maxGasPrice=${maxGasPrice} Gwei, includeGasCosts=${includeGasCosts}, capital=$${capitalUSD.toLocaleString()}
Chains: ${chainsToScan.map(c => CHAIN_LABELS[c] ?? c).join(", ")}

${realOpportunities.length > 0
  ? `Top opportunity: ${realOpportunities[0].asset} — buy on ${realOpportunities[0].buyChain} at $${realOpportunities[0].buyPriceUSD}, sell on ${realOpportunities[0].sellChain} at $${realOpportunities[0].sellPriceUSD} (+${realOpportunities[0].profitPercentage.toFixed(2)}% gross, est. $${realOpportunities[0].estimatedProfit} net on $${realOpportunities[0].requiredCapital} capital).`
  : `No price-gap opportunities above ${minProfit}% threshold found. Prices appear well-arbitraged.`}

Provide brief market context and execution recommendations for AI agents pursuing these cross-chain arbitrage gaps.`;

    const aiResponse = await callOpenAI(
      INTELLIGENCE_SYSTEM_PROMPTS.arbitrageScanner,
      aiContext,
      "json_object"
    );

    const parseResult = safeParseJSON(aiResponse);
    if (parseResult.success && parseResult.data) {
      marketConditions = parseResult.data.marketConditions ?? marketConditions;
      recommendations = parseResult.data.recommendations ?? recommendations;
      gasEstimate = parseResult.data.gasEstimate ?? gasEstimate;
    }
  } catch (aiErr: any) {
    console.warn(`[arbitrage-scanner] AI enrichment skipped: ${aiErr.message}`);
  }

  // ── Phase 3: Build final response ─────────────────────────────────────────
  const bestOpp = realOpportunities[0];
  const result = formatJSONResponse({
    opportunities: realOpportunities,
    totalOpportunities: realOpportunities.length,
    bestOpportunity: bestOpp
      ? {
          asset: bestOpp.asset,
          profit: bestOpp.estimatedProfit,
          confidence: bestOpp.executionRisk === "Low" ? 80 : bestOpp.executionRisk === "Medium" ? 60 : 35,
          buyChain: bestOpp.buyChain,
          sellChain: bestOpp.sellChain,
          requiredCapital: bestOpp.requiredCapital,
          netProfitPercentage: bestOpp.netProfitPercentage,
          executionPath: bestOpp.executionPath,
        }
      : null,
    chainsScanned: chainsToScan.map(c => ({ slug: c, label: CHAIN_LABELS[c] ?? c })),
    assetsScanned: assetsToScan,
    robinhoodChainIncluded: true,
    robinhoodChainId: "eip155:4663",
    robinhoodDataSource: "fetchRobinhoodPoolData (Uniswap V3 subgraph → DexScreener fallback)",
    priceSnapshot,
    marketConditions,
    gasEstimate,
    capitalUSD,
    minProfitPercent: minProfit,
    maxGasPrice,
    includeGasCosts,
    netProfitAfterFees: bestOpp?.estimatedProfit ?? 0,
    recommendations,
    note: "Robinhood Chain (eip155:4663) prices sourced via fetchRobinhoodPoolData. Uniswap V3 subgraph is preferred; DexScreener chainId='robinhood' is the active fallback while subgraph is not yet deployed.",
  });

  setCachedData(cacheKey, result, 2 * 60 * 1000); // 2 min cache (volatile)
  return result;
}

export async function correlationMatrixService(data: {
  assets: string[];
  timeframe?: string;
  includeTraditionalMarkets?: boolean;
  benchmark?: string;
}) {
  const cacheKey = `correlation-${data.assets.join('-')}-${data.timeframe || '30d'}`;
  const cached = getCachedData(cacheKey);
  if (cached) return cached;

  const userPrompt = `Generate correlation analysis:

Assets: ${data.assets.join(', ')}
Timeframe: ${data.timeframe || '30 days'}
Include Traditional Markets: ${data.includeTraditionalMarkets ? 'Yes (S&P 500, Gold, Bonds)' : 'No'}
Benchmark: ${data.benchmark || 'Bitcoin'}

Calculate and analyze:
- Pairwise correlation coefficients
- Strength and direction of relationships
- Historical vs current correlation shifts
- Hedging opportunities
- Portfolio diversification insights
- Risk concentration warnings

Provide comprehensive correlation insights for risk management and portfolio construction.`;

  const response = await callOpenAI(
    INTELLIGENCE_SYSTEM_PROMPTS.correlationMatrix,
    userPrompt,
    "json_object"
  );
  
  const parseResult = safeParseJSON(response);
  if (!parseResult.success) {
    console.error(`[correlation-matrix] JSON parse failed: ${parseResult.error}`);
    throw new Error(`AI response parsing failed: ${parseResult.error}`);
  }
  
  const validated = correlationResponseSchema.safeParse(parseResult.data);
  const resultData = validated.success ? validated.data : {
    correlationPairs: parseResult.data.correlationPairs || [],
    portfolioInsights: parseResult.data.portfolioInsights || "Analysis completed",
    ...parseResult.data
  };
  
  const result = formatJSONResponse(resultData);
  setCachedData(cacheKey, result, 15 * 60 * 1000); // 15 min cache
  return result;
}

export async function riskMetricsService(data: {
  portfolioValue: number;
  holdings: Array<{
    asset: string;
    value: number;
    volatility?: number;
  }>;
  timeHorizon?: number; // days
  confidenceLevel?: number; // 95 or 99
  benchmarkAsset?: string;
}) {
  const totalValue = data.portfolioValue;
  const holdingsSummary = data.holdings.map(h =>
    `${h.asset}: $${h.value.toLocaleString()} (${((h.value / totalValue) * 100).toFixed(2)}%)`
  ).join('\n');

  const userPrompt = `Calculate comprehensive risk metrics:

Portfolio Value: $${totalValue.toLocaleString()}
Holdings:
${holdingsSummary}

Parameters:
- Time Horizon: ${data.timeHorizon || 1} day(s)
- Confidence Level: ${data.confidenceLevel || 95}%
- Benchmark: ${data.benchmarkAsset || 'Bitcoin'}

Calculate:
1. Value at Risk (VaR) at ${data.confidenceLevel || 95}% and 99% confidence
2. Conditional VaR (CVaR/Expected Shortfall)
3. Sharpe Ratio (risk-adjusted returns)
4. Sortino Ratio (downside risk)
5. Maximum Drawdown potential
6. Beta (relative to benchmark)
7. Portfolio volatility (daily, monthly, annualized)
8. Stress test scenarios (market crash, crypto winter, etc.)

Provide actionable risk management recommendations.`;

  const response = await callOpenAI(
    INTELLIGENCE_SYSTEM_PROMPTS.riskMetrics,
    userPrompt,
    "json_object"
  );
  
  const parseResult = safeParseJSON(response);
  if (!parseResult.success) {
    console.error(`[risk-metrics] JSON parse failed: ${parseResult.error}`);
    throw new Error(`AI response parsing failed: ${parseResult.error}`);
  }
  
  const validated = riskMetricsResponseSchema.safeParse(parseResult.data);
  const resultData = validated.success ? validated.data : {
    riskLevel: parseResult.data.riskLevel || "Analysis completed",
    recommendations: parseResult.data.recommendations || "See metrics above",
    ...parseResult.data
  };
  
  return formatJSONResponse(resultData);
}
