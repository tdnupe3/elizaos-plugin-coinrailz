import { callOpenAI, formatJSONResponse, getCachedData, setCachedData } from "./common";
import axios from "axios";

const TRADING_SYSTEM_PROMPTS = {
  tradingSignal: `You are an elite quantitative analyst and algorithmic trader. Analyze market data and provide actionable trading signals in JSON format.
Your response MUST be valid JSON with this exact structure:
{
  "signal": string ("BUY" | "SELL" | "HOLD"),
  "confidence": number (0-100),
  "entryPrice": number,
  "targetPrice": number,
  "stopLoss": number,
  "timeframe": string,
  "reasoning": string,
  "technicalIndicators": [{"indicator": string, "value": string, "signal": string}],
  "fundamentalFactors": [string],
  "riskReward": number,
  "marketSentiment": string
}`,
  
  portfolioOptimization: `You are a portfolio manager specializing in Modern Portfolio Theory and risk-adjusted allocation. Optimize portfolio allocation in JSON format.
Your response MUST be valid JSON with this exact structure:
{
  "optimizedAllocation": [{"asset": string, "currentWeight": number, "recommendedWeight": number, "action": string}],
  "expectedReturn": number,
  "expectedRisk": number,
  "sharpeRatio": number,
  "diversificationScore": number (0-100),
  "rebalancingSteps": [{"action": string, "asset": string, "amount": string}],
  "riskAssessment": string,
  "recommendations": string
}`,
  
  sentimentAnalysis: `You are a market sentiment analyst using NLP and behavioral finance. Analyze market sentiment from news and data in JSON format.
Your response MUST be valid JSON with this exact structure:
{
  "overallSentiment": string ("Bullish" | "Bearish" | "Neutral"),
  "sentimentScore": number (-100 to 100),
  "confidence": number (0-100),
  "keyThemes": [{"theme": string, "sentiment": string, "impact": string}],
  "newsImpact": number (-100 to 100),
  "socialMediaTrend": string,
  "institutionalSentiment": string,
  "retailSentiment": string,
  "recommendations": string
}`
};

export async function tradingSignalService(data: {
  symbol: string;
  timeframe?: string;
  currentPrice?: number;
  marketData?: {
    volume?: number;
    high24h?: number;
    low24h?: number;
    priceChange24h?: number;
  };
  riskTolerance?: string;
}) {
  const cacheKey = `trading-signal-${data.symbol}-${data.timeframe || '1h'}`;
  const cached = getCachedData(cacheKey);
  if (cached) return cached;

  // Fetch real-time market data from CoinGecko
  let marketContext = '';
  try {
    const response = await axios.get(
      `https://api.coingecko.com/api/v3/simple/price?ids=${data.symbol.toLowerCase()}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true`,
      {
        headers: process.env.COINGECKO_API_KEY ? { "x-cg-pro-api-key": process.env.COINGECKO_API_KEY } : {},
        timeout: 5000
      }
    );
    const coinData = response.data[data.symbol.toLowerCase()];
    if (coinData) {
      marketContext = `
Real-time Market Data:
- Current Price: $${coinData.usd}
- 24h Change: ${coinData.usd_24h_change?.toFixed(2) || 0}%
- 24h Volume: $${coinData.usd_24h_vol?.toLocaleString() || 0}`;
    }
  } catch (error) {
    console.log('Could not fetch market data, using provided data');
  }

  const userPrompt = `Generate trading signal for ${data.symbol}:

${marketContext || `Provided Data:
- Current Price: $${data.currentPrice || 'Not specified'}
- 24h High: $${data.marketData?.high24h || 'Not specified'}
- 24h Low: $${data.marketData?.low24h || 'Not specified'}
- Volume: ${data.marketData?.volume || 'Not specified'}`}

Timeframe: ${data.timeframe || '1 hour'}
Risk Tolerance: ${data.riskTolerance || 'Moderate'}

Provide comprehensive technical and fundamental analysis with actionable signals.`;

  const response = await callOpenAI(
    TRADING_SYSTEM_PROMPTS.tradingSignal,
    userPrompt,
    "json_object"
  );
  
  const result = formatJSONResponse(JSON.parse(response));
  setCachedData(cacheKey, result, 5 * 60 * 1000); // 5 min cache
  return result;
}

export async function portfolioOptimizationService(data: {
  currentHoldings: Array<{
    asset: string;
    amount: number;
    currentValue: number;
  }>;
  investmentGoals?: string;
  riskTolerance?: string;
  timeHorizon?: string;
  constraints?: string[];
}) {
  const totalValue = data.currentHoldings.reduce((sum, h) => sum + h.currentValue, 0);
  const holdingsSummary = data.currentHoldings.map(h => 
    `${h.asset}: ${((h.currentValue / totalValue) * 100).toFixed(2)}% ($${h.currentValue.toLocaleString()})`
  ).join('\n');

  const userPrompt = `Optimize this investment portfolio:

Current Holdings (Total: $${totalValue.toLocaleString()}):
${holdingsSummary}

Investment Profile:
- Goals: ${data.investmentGoals || 'Capital appreciation'}
- Risk Tolerance: ${data.riskTolerance || 'Moderate'}
- Time Horizon: ${data.timeHorizon || 'Medium-term (1-3 years)'}
- Constraints: ${data.constraints?.join(', ') || 'None specified'}

Provide optimal asset allocation using Modern Portfolio Theory and risk-adjusted returns.`;

  const response = await callOpenAI(
    TRADING_SYSTEM_PROMPTS.portfolioOptimization,
    userPrompt,
    "json_object"
  );
  
  return formatJSONResponse(JSON.parse(response));
}

export async function sentimentAnalysisService(data: {
  symbol: string;
  sources?: string[];
  timeframe?: string;
  includeNews?: boolean;
  includeSocial?: boolean;
}) {
  const cacheKey = `sentiment-${data.symbol}-${data.timeframe || '24h'}`;
  const cached = getCachedData(cacheKey);
  if (cached) return cached;

  const userPrompt = `Analyze market sentiment for ${data.symbol}:

Analysis Scope:
- Timeframe: ${data.timeframe || 'Past 24 hours'}
- News Sources: ${data.includeNews !== false ? 'Financial news, press releases' : 'Excluded'}
- Social Media: ${data.includeSocial !== false ? 'Twitter, Reddit, crypto forums' : 'Excluded'}

Provide comprehensive sentiment analysis incorporating:
- News headlines and market-moving events
- Social media discussions and influencer commentary
- Institutional vs retail sentiment divergence
- Fear & Greed indicators
- Market momentum and psychological levels

Deliver actionable insights for trading decisions.`;

  const response = await callOpenAI(
    TRADING_SYSTEM_PROMPTS.sentimentAnalysis,
    userPrompt,
    "json_object"
  );
  
  const result = formatJSONResponse(JSON.parse(response));
  setCachedData(cacheKey, result, 10 * 60 * 1000); // 10 min cache
  return result;
}
