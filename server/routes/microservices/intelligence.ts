import { callOpenAI, formatJSONResponse, getCachedData, setCachedData, safeParseJSON } from "./common";
import { z } from "zod";

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
import axios from "axios";

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

export async function arbitrageScannerService(data: {
  assets?: string[];
  minProfitPercent?: number;
  maxGasPrice?: number;
  chains?: string[];
  includeGasCosts?: boolean;
}) {
  const cacheKey = `arbitrage-${(data.assets || ['ETH', 'BTC', 'USDC']).join('-')}`;
  const cached = getCachedData(cacheKey);
  if (cached) return cached;

  // Use our existing multi-chain infrastructure
  const assetsToScan = data.assets || ['ETH', 'USDC', 'DAI', 'WBTC'];
  const chainsToScan = data.chains || ['ethereum', 'base', 'polygon', 'arbitrum'];

  const userPrompt = `Scan for arbitrage opportunities:

Assets: ${assetsToScan.join(', ')}
Chains/Exchanges: ${chainsToScan.join(', ')}
Minimum Profit: ${data.minProfitPercent || 0.5}%
Max Gas Price: ${data.maxGasPrice || 50} Gwei
Include Gas Costs: ${data.includeGasCosts !== false ? 'Yes' : 'No'}

Identify cross-exchange and cross-chain arbitrage opportunities considering:
- Price differentials across DEXes (Uniswap, Sushiswap, Curve, etc.)
- Cross-chain bridges and liquidity pools
- Gas costs and execution complexity
- Slippage and liquidity depth
- MEV protection considerations

Provide actionable opportunities with net profit estimates.`;

  const response = await callOpenAI(
    INTELLIGENCE_SYSTEM_PROMPTS.arbitrageScanner,
    userPrompt,
    "json_object"
  );
  
  // Safe parsing with validation
  const parseResult = safeParseJSON(response);
  if (!parseResult.success) {
    console.error(`[arbitrage-scanner] JSON parse failed: ${parseResult.error}`);
    throw new Error(`AI response parsing failed: ${parseResult.error}`);
  }
  
  // Validate against schema with coercion for missing fields
  const validated = arbitrageResponseSchema.safeParse(parseResult.data);
  if (!validated.success) {
    console.warn(`[arbitrage-scanner] Schema validation warning:`, validated.error.message);
    // Return raw data with defaults if validation fails (graceful degradation)
    const fallbackData = {
      opportunities: parseResult.data.opportunities || [],
      totalOpportunities: parseResult.data.totalOpportunities || 0,
      marketConditions: parseResult.data.marketConditions || "Analysis completed",
      recommendations: parseResult.data.recommendations || "See opportunities above",
      ...parseResult.data
    };
    const result = formatJSONResponse(fallbackData);
    setCachedData(cacheKey, result, 2 * 60 * 1000);
    return result;
  }
  
  const result = formatJSONResponse(validated.data);
  setCachedData(cacheKey, result, 2 * 60 * 1000); // 2 min cache (volatile data)
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
  
  // Safe parsing with validation
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
  
  // Safe parsing with validation
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
