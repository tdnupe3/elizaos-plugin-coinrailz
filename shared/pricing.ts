/**
 * Centralized Pricing System for x402 Micropayment Services
 * 
 * CRITICAL: USDC has 6 decimals, so $1.00 = 1,000,000 micro-USDC
 * 
 * This module provides:
 * 1. SERVICE_PRICING_MICRO: Integer values for on-chain payment verification
 * 2. SERVICE_PRICING_USD: Float values for analytics/display
 * 3. Helper functions to convert between formats safely
 * 
 * IMPORTANT: Service names MUST exactly match the slugs used in createPaymentOrchestrator() calls
 */

export type ServiceName = 
  // Discovery/Testing Services
  | "ping"
  | "first-call"
  // Trading Intelligence Services
  | "gas-price-oracle"
  | "token-metadata"
  | "dex-liquidity"
  | "approval-manager"
  | "token-price"
  | "token-sentiment"
  | "transaction-builder"
  | "whale-alerts"
  | "batch-quote"
  | "multi-chain-balance"
  | "trending-tokens"
  | "portfolio-tracker"
  | "wallet-risk"
  | "trade-signals"
  // Execution & Infrastructure Services
  | "payment-processing"
  | "contract-scan"
  | "instant-agent-wallet"
  | "instant-api-key"  // Frictionless API key via USDC payment
  | "agent-create-wallet"  // Agent Wallet Provisioning via CDP
  | "seamless-chain-bridge"
  // Premium Services
  | "verified-agent-identity"
  | "compliance-consultation"
  | "smart-contract-audit"
  // Real Estate vertical (3 services)
  | "property-valuation"
  | "lease-analysis"
  | "construction-progress"
  // Banking/Finance vertical (3 services)
  | "credit-risk-score"
  | "fraud-detection"
  | "compliance-check"
  // Trading/Investment vertical (3 services)
  | "trading-signal"
  | "portfolio-optimization"
  | "sentiment-analysis"
  // Market Intelligence vertical (3 services)
  | "arbitrage-scanner"
  | "correlation-matrix"
  | "risk-metrics"
  // Prediction Markets vertical (4 Polymarket + 3 Kalshi = 7 services)
  | "polymarket-events"
  | "polymarket-odds"
  | "polymarket-search"
  | "prediction-market-odds"
  | "kalshi-markets"
  | "kalshi-odds"
  | "kalshi-search"
  // Traditional Markets vertical (2 services) - Stocks & Forex
  | "stock-sentiment"
  | "forex-sentiment"
  // Solana DeFi vertical (Dialect integration)
  | "solana-yield-finder"
  // Satellite Data Services (NASA Earthdata + ESA Copernicus)
  | "fire-alerts"
  | "weather-imagery"
  | "vegetation"
  | "flood-detection"
  | "air-quality"
  | "land-use"
  // IoT/DePIN Services (Device Data Monetization)
  | "fleet-telematics"
  | "weather-station-data"
  | "iot-sensor-reading"
  | "iot-device-stream"
  | "iot-bulk-data"
  // AI Inference Services
  | "ai-inference";

/**
 * Type guard to check if a string is a valid ServiceName
 * Use this to safely index SERVICE_PRICING_MICRO or SERVICE_PRICING_USD
 */
export function isServiceName(name: string): name is ServiceName {
  return name in SERVICE_PRICING_MICRO;
}

/**
 * Safely get pricing for a service, returns undefined if service doesn't exist
 */
export function getServicePricing(name: string): number | undefined {
  if (isServiceName(name)) {
    return SERVICE_PRICING_MICRO[name];
  }
  return undefined;
}

/**
 * Micro-USDC pricing (integers) for on-chain payment verification
 * USDC has 6 decimals: $1.00 = 1,000,000 micro-USDC
 * 
 * CRITICAL: These values MUST match the original SERVICE_PRICING from hybridPaymentMiddleware.ts
 */
export const SERVICE_PRICING_MICRO: Record<ServiceName, number> = {
  // Discovery/Testing Services (very low cost for discovery bots)
  "ping": 250000,                      // $0.25 - industry standard discovery endpoint
  "first-call": 50000,                 // $0.05 - golden path first paid call for new agents
  
  // Trading Intelligence Services ($0.10-$0.75)
  "gas-price-oracle": 100000,          // $0.10
  "token-metadata": 100000,            // $0.10
  "dex-liquidity": 200000,             // $0.20
  "approval-manager": 200000,          // $0.20
  "token-price": 250000,               // $0.25
  "token-sentiment": 250000,           // $0.25
  "transaction-builder": 300000,       // $0.30
  "whale-alerts": 350000,              // $0.35
  "batch-quote": 400000,               // $0.40
  "multi-chain-balance": 500000,       // $0.50
  "trending-tokens": 500000,           // $0.50
  "portfolio-tracker": 500000,         // $0.50
  "wallet-risk": 500000,               // $0.50
  "trade-signals": 750000,             // $0.75
  
  // Execution & Infrastructure Services ($0.50-$2.00)
  "payment-processing": 500000,        // $0.50
  "contract-scan": 1000000,            // $1.00
  "instant-agent-wallet": 1000000,     // $1.00
  "instant-api-key": 1000000,          // $1.00 - Frictionless API key via USDC
  "agent-create-wallet": 2000000,      // $2.00 - Agent Wallet Provisioning via CDP
  "seamless-chain-bridge": 2000000,    // $2.00
  
  // Premium Services ($5.00-$10.00)
  "verified-agent-identity": 5000000,  // $5.00
  "compliance-consultation": 5000000,  // $5.00
  "smart-contract-audit": 10000000,    // $10.00
  
  // VERTICAL EXPANSION - Real Estate Services ($0.75-$1.50)
  "property-valuation": 750000,        // $0.75
  "lease-analysis": 1000000,           // $1.00
  "construction-progress": 1500000,    // $1.50
  
  // VERTICAL EXPANSION - Banking/Finance Services ($0.75-$1.75)
  "fraud-detection": 750000,           // $0.75
  "credit-risk-score": 1250000,        // $1.25
  "compliance-check": 1750000,         // $1.75
  
  // VERTICAL EXPANSION - Trading/Investment Services ($0.50-$2.00)
  "sentiment-analysis": 500000,        // $0.50
  "trading-signal": 1000000,           // $1.00
  "portfolio-optimization": 2000000,   // $2.00
  
  // VERTICAL EXPANSION - Market Intelligence Services ($0.75-$1.25)
  "correlation-matrix": 750000,        // $0.75
  "risk-metrics": 1000000,             // $1.00
  "arbitrage-scanner": 1250000,        // $1.25
  
  // VERTICAL EXPANSION - Prediction Markets Services ($0.25-$0.50)
  "polymarket-events": 250000,         // $0.25 - trending prediction markets
  "polymarket-odds": 500000,           // $0.50 - current odds for specific market
  "polymarket-search": 250000,         // $0.25 - search prediction markets
  "prediction-market-odds": 500000,    // $0.50 - generic prediction market odds (alias for polymarket-odds)
  "kalshi-markets": 250000,            // $0.25 - active Kalshi markets (CFTC-regulated)
  "kalshi-odds": 500000,               // $0.50 - odds for specific Kalshi market
  "kalshi-search": 250000,             // $0.25 - search Kalshi prediction markets
  
  // VERTICAL EXPANSION - Traditional Markets Services ($0.40)
  "stock-sentiment": 400000,           // $0.40 - AI stock sentiment analysis
  "forex-sentiment": 400000,           // $0.40 - AI forex sentiment analysis
  
  // VERTICAL EXPANSION - Solana DeFi Services (Dialect integration)
  "solana-yield-finder": 50000,        // $0.05 - Real-time Solana lending/yield rates via Dialect
  
  // SATELLITE DATA SERVICES (NASA Earthdata + ESA Copernicus)
  "fire-alerts": 50000,                // $0.05 - NASA FIRMS active fire detection
  "weather-imagery": 50000,            // $0.05 - NASA GIBS satellite imagery
  "vegetation": 100000,                // $0.10 - NASA MODIS + ESA Sentinel-2 NDVI
  "flood-detection": 100000,           // $0.10 - ESA Sentinel-1 SAR water detection
  "air-quality": 50000,                // $0.05 - ESA Sentinel-5P TROPOMI air quality
  "land-use": 150000,                  // $0.15 - NASA Landsat + ESA Sentinel-2 classification
  
  // IoT/DePIN VERTICAL - Device Data Monetization
  "fleet-telematics": 100000,          // $0.10 - GPS, fuel, driver behavior
  "weather-station-data": 50000,       // $0.05 - Temperature, humidity, pressure
  "iot-sensor-reading": 25000,         // $0.025 - Single sensor reading
  "iot-device-stream": 250000,         // $0.25 - Real-time data stream (per minute)
  "iot-bulk-data": 500000,             // $0.50 - Bulk historical data export
  
  // AI INFERENCE SERVICES (pay-per-call LLM access via x402)
  "ai-inference": 50000,               // $0.05 - GPT-4o-mini default (competitive with ecosystem avg $0.12)
};

/**
 * USD pricing (floats) for analytics, displays, and logging
 */
export const SERVICE_PRICING_USD: Record<ServiceName, number> = {
  // Discovery/Testing Services
  "ping": 0.25,
  "first-call": 0.05,
  
  // Trading Intelligence Services
  "gas-price-oracle": 0.10,
  "token-metadata": 0.10,
  "dex-liquidity": 0.20,
  "approval-manager": 0.20,
  "token-price": 0.25,
  "token-sentiment": 0.25,
  "transaction-builder": 0.30,
  "whale-alerts": 0.35,
  "batch-quote": 0.40,
  "multi-chain-balance": 0.50,
  "trending-tokens": 0.50,
  "portfolio-tracker": 0.50,
  "wallet-risk": 0.50,
  "trade-signals": 0.75,
  
  // Execution & Infrastructure Services
  "payment-processing": 0.50,
  "contract-scan": 1.00,
  "instant-agent-wallet": 1.00,
  "instant-api-key": 1.00,  // Frictionless API key via USDC
  "agent-create-wallet": 2.00,  // Agent Wallet Provisioning via CDP
  "seamless-chain-bridge": 2.00,
  
  // Premium Services
  "verified-agent-identity": 5.00,
  "compliance-consultation": 5.00,
  "smart-contract-audit": 10.00,
  
  // Real Estate vertical
  "property-valuation": 0.75,
  "lease-analysis": 1.00,
  "construction-progress": 1.50,
  
  // Banking/Finance vertical
  "fraud-detection": 0.75,
  "credit-risk-score": 1.25,
  "compliance-check": 1.75,
  
  // Trading/Investment vertical
  "sentiment-analysis": 0.50,
  "trading-signal": 1.00,
  "portfolio-optimization": 2.00,
  
  // Market Intelligence vertical
  "correlation-matrix": 0.75,
  "risk-metrics": 1.00,
  "arbitrage-scanner": 1.25,
  
  // Prediction Markets vertical
  "polymarket-events": 0.25,
  "polymarket-odds": 0.50,
  "polymarket-search": 0.25,
  "prediction-market-odds": 0.50,
  "kalshi-markets": 0.25,
  "kalshi-odds": 0.50,
  "kalshi-search": 0.25,
  
  // Traditional Markets vertical
  "stock-sentiment": 0.40,
  "forex-sentiment": 0.40,
  
  // Solana DeFi vertical (Dialect integration)
  "solana-yield-finder": 0.05,
  
  // Satellite Data Services (NASA Earthdata + ESA Copernicus)
  "fire-alerts": 0.05,
  "weather-imagery": 0.05,
  "vegetation": 0.10,
  "flood-detection": 0.10,
  "air-quality": 0.05,
  "land-use": 0.15,
  
  // IoT/DePIN Services - Device Data Monetization
  "fleet-telematics": 0.10,
  "weather-station-data": 0.05,
  "iot-sensor-reading": 0.025,
  "iot-device-stream": 0.25,
  "iot-bulk-data": 0.50,
  
  // AI Inference Services
  "ai-inference": 0.05,  // $0.05 for gpt-4o-mini (competitive with ecosystem avg $0.12)
};

/**
 * Convert micro-USDC (integer) to USD string for display
 * Example: 1000000 → "1.00"
 */
export function microToUSD(microAmount: number): string {
  return (microAmount / 1_000_000).toFixed(2);
}

/**
 * Convert USD (float) to micro-USDC (integer) for payment verification
 * Example: 1.00 → 1000000
 */
export function usdToMicro(usdAmount: number): number {
  return Math.round(usdAmount * 1_000_000);
}

/**
 * Get USD price for a service (safe accessor)
 */
export function getServicePriceUSD(serviceName: ServiceName): number {
  return SERVICE_PRICING_USD[serviceName];
}

/**
 * Get micro-USDC price for a service (safe accessor)
 */
export function getServicePriceMicro(serviceName: ServiceName): number {
  return SERVICE_PRICING_MICRO[serviceName];
}

/**
 * Format USD amount for display with currency symbol
 * Example: 1.50 → "$1.50"
 */
export function formatUSD(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/**
 * Get the canonical base URL for x402 services
 * SERVER-ONLY: Uses process.env which is not available in browser
 * 
 * IMPORTANT: This ensures 402 responses always include the correct
 * production URL that agents can use for payment and retry
 */
export function getCanonicalBaseUrl(): string {
  // Only access process.env on server side
  if (typeof process !== 'undefined' && process.env?.CANONICAL_BASE_URL) {
    // Remove trailing slash for consistency
    return process.env.CANONICAL_BASE_URL.replace(/\/$/, '');
  }
  
  // Production default - ensures agents always get the right URL
  return 'https://coinrailz.com';
}

/**
 * Build canonical resource URL for a service
 * SERVER-ONLY: Uses getCanonicalBaseUrl which requires process.env
 * Example: getCanonicalResourceUrl('gas-price-oracle') => 'https://coinrailz.com/x402/gas-price-oracle'
 */
export function getCanonicalResourceUrl(serviceName: string): string {
  return `${getCanonicalBaseUrl()}/x402/${serviceName}`;
}
