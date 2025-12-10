import { callOpenAI, formatJSONResponse, getCachedData, setCachedData } from "./common";
import axios from "axios";

const MARKET_SYSTEM_PROMPTS = {
  stockSentiment: `You are an expert equity market analyst specializing in stock sentiment analysis. Analyze the provided stock symbol and return comprehensive sentiment insights in JSON format.

Your response MUST be valid JSON with this exact structure:
{
  "symbol": string,
  "companyName": string,
  "overallSentiment": string ("Bullish" | "Bearish" | "Neutral"),
  "sentimentScore": number (-100 to 100),
  "confidence": number (0-100),
  "keyDrivers": [{"driver": string, "impact": string, "sentiment": string}],
  "newsAnalysis": {
    "recentHeadlines": [string],
    "overallTone": string,
    "majorEvents": [string]
  },
  "technicalOutlook": {
    "trend": string,
    "support": string,
    "resistance": string,
    "momentum": string
  },
  "institutionalActivity": {
    "recentFilings": [string],
    "insiderActivity": string,
    "institutionalSentiment": string
  },
  "socialMediaTrend": string,
  "analystConsensus": string,
  "riskFactors": [string],
  "recommendation": string,
  "priceTarget": {
    "low": string,
    "median": string,
    "high": string
  }
}`,

  forexSentiment: `You are an expert forex market analyst specializing in currency pair sentiment analysis. Analyze the provided currency pair and return comprehensive sentiment insights in JSON format.

Your response MUST be valid JSON with this exact structure:
{
  "pair": string,
  "baseCurrency": string,
  "quoteCurrency": string,
  "overallSentiment": string ("Bullish" | "Bearish" | "Neutral"),
  "sentimentScore": number (-100 to 100),
  "confidence": number (0-100),
  "keyDrivers": [{"driver": string, "currency": string, "impact": string}],
  "economicFactors": {
    "baseEconomy": {
      "interestRate": string,
      "inflation": string,
      "gdpGrowth": string,
      "outlook": string
    },
    "quoteEconomy": {
      "interestRate": string,
      "inflation": string,
      "gdpGrowth": string,
      "outlook": string
    }
  },
  "centralBankPolicy": {
    "baseCentralBank": string,
    "quoteCentralBank": string,
    "rateExpectations": string
  },
  "technicalOutlook": {
    "trend": string,
    "support": string,
    "resistance": string,
    "momentum": string
  },
  "geopoliticalFactors": [string],
  "tradingRecommendation": string,
  "volatilityAssessment": string,
  "correlations": [{"pair": string, "correlation": string}]
}`
};

export async function stockSentimentService(data: {
  symbol: string;
  includeNews?: boolean;
  includeTechnicals?: boolean;
  includeInstitutional?: boolean;
}) {
  const cacheKey = `stock-sentiment-${data.symbol.toUpperCase()}`;
  const cached = getCachedData(cacheKey);
  if (cached) return cached;

  const symbol = data.symbol.toUpperCase();
  
  let marketContext = '';
  
  try {
    const response = await axios.get(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`,
      { timeout: 5000, headers: { 'User-Agent': 'CoinRailz/1.0' } }
    );
    
    const result = response.data?.chart?.result?.[0];
    if (result) {
      const meta = result.meta;
      const quotes = result.indicators?.quote?.[0];
      const latestClose = quotes?.close?.filter((c: any) => c !== null).pop();
      const previousClose = meta.chartPreviousClose || meta.previousClose;
      const change = latestClose && previousClose ? ((latestClose - previousClose) / previousClose * 100).toFixed(2) : 'N/A';
      
      marketContext = `
Real-time Market Data for ${symbol}:
- Company: ${meta.shortName || meta.symbol}
- Exchange: ${meta.exchangeName}
- Current Price: $${latestClose?.toFixed(2) || meta.regularMarketPrice || 'N/A'}
- Previous Close: $${previousClose?.toFixed(2) || 'N/A'}
- Change: ${change}%
- Currency: ${meta.currency}
- Market State: ${meta.marketState || 'Unknown'}`;
    }
  } catch (error: any) {
    console.log(`Could not fetch Yahoo Finance data for ${symbol}: ${error.message}`);
    marketContext = `Symbol: ${symbol} (Live market data unavailable - using general market knowledge)`;
  }

  const userPrompt = `Analyze market sentiment for stock ${symbol}:

${marketContext}

Analysis Scope:
- News Analysis: ${data.includeNews !== false ? 'Include recent headlines and news impact' : 'Skip'}
- Technical Analysis: ${data.includeTechnicals !== false ? 'Include technical outlook' : 'Skip'}
- Institutional Activity: ${data.includeInstitutional !== false ? 'Include institutional and insider activity' : 'Skip'}

Provide comprehensive stock sentiment analysis with actionable insights for traders and investors. Base your analysis on current market conditions, recent news, analyst opinions, and market trends for this specific equity.`;

  const response = await callOpenAI(
    MARKET_SYSTEM_PROMPTS.stockSentiment,
    userPrompt,
    "json_object"
  );
  
  const result = formatJSONResponse(JSON.parse(response));
  result.data.assetClass = 'equity';
  result.data.market = 'stocks';
  result.data.dataSource = 'AI analysis with market data';
  
  setCachedData(cacheKey, result, 10 * 60 * 1000);
  return result;
}

export async function forexSentimentService(data: {
  pair: string;
  includeEconomic?: boolean;
  includeCentralBank?: boolean;
  includeGeopolitical?: boolean;
}) {
  const pair = data.pair.toUpperCase().replace('/', '');
  const cacheKey = `forex-sentiment-${pair}`;
  const cached = getCachedData(cacheKey);
  if (cached) return cached;

  const baseCurrency = pair.substring(0, 3);
  const quoteCurrency = pair.substring(3, 6);
  const formattedPair = `${baseCurrency}/${quoteCurrency}`;
  
  let marketContext = '';
  
  try {
    const response = await axios.get(
      `https://api.exchangerate.host/latest?base=${baseCurrency}&symbols=${quoteCurrency}`,
      { timeout: 5000 }
    );
    
    if (response.data?.success !== false && response.data?.rates?.[quoteCurrency]) {
      const rate = response.data.rates[quoteCurrency];
      marketContext = `
Current Exchange Rate Data:
- Pair: ${formattedPair}
- Rate: ${rate.toFixed(5)}
- Base Currency: ${baseCurrency}
- Quote Currency: ${quoteCurrency}
- Date: ${response.data.date || new Date().toISOString().split('T')[0]}`;
    }
  } catch (error: any) {
    console.log(`Could not fetch exchange rate for ${formattedPair}: ${error.message}`);
  }

  if (!marketContext) {
    try {
      const ecbResponse = await axios.get(
        `https://api.frankfurter.app/latest?from=${baseCurrency}&to=${quoteCurrency}`,
        { timeout: 5000 }
      );
      
      if (ecbResponse.data?.rates?.[quoteCurrency]) {
        const rate = ecbResponse.data.rates[quoteCurrency];
        marketContext = `
ECB Reference Rate Data:
- Pair: ${formattedPair}
- Rate: ${rate.toFixed(5)}
- Base Currency: ${baseCurrency}
- Quote Currency: ${quoteCurrency}
- Date: ${ecbResponse.data.date}
- Source: European Central Bank`;
      }
    } catch (error: any) {
      console.log(`Could not fetch ECB data for ${formattedPair}: ${error.message}`);
      marketContext = `Currency Pair: ${formattedPair} (Live rate data unavailable - using general market knowledge)`;
    }
  }

  const userPrompt = `Analyze forex market sentiment for currency pair ${formattedPair}:

${marketContext}

Analysis Scope:
- Economic Factors: ${data.includeEconomic !== false ? 'Include GDP, inflation, interest rates for both economies' : 'Skip'}
- Central Bank Policy: ${data.includeCentralBank !== false ? 'Include monetary policy outlook and rate expectations' : 'Skip'}
- Geopolitical Factors: ${data.includeGeopolitical !== false ? 'Include geopolitical risks and trade relations' : 'Skip'}

Provide comprehensive forex sentiment analysis with actionable insights for currency traders. Consider:
- Interest rate differentials
- Economic strength comparison
- Trade balance impacts
- Risk sentiment (risk-on vs risk-off)
- Technical levels and momentum`;

  const response = await callOpenAI(
    MARKET_SYSTEM_PROMPTS.forexSentiment,
    userPrompt,
    "json_object"
  );
  
  const result = formatJSONResponse(JSON.parse(response));
  result.data.assetClass = 'forex';
  result.data.market = 'foreign exchange';
  result.data.dataSource = 'AI analysis with ECB/market data';
  
  setCachedData(cacheKey, result, 15 * 60 * 1000);
  return result;
}
