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
  | "risk-metrics";

/**
 * Micro-USDC pricing (integers) for on-chain payment verification
 * USDC has 6 decimals: $1.00 = 1,000,000 micro-USDC
 * 
 * CRITICAL: These values MUST match the original SERVICE_PRICING from hybridPaymentMiddleware.ts
 */
export const SERVICE_PRICING_MICRO: Record<ServiceName, number> = {
  // Discovery/Testing Services (very low cost for discovery bots)
  "ping": 10000,                       // $0.01 - minimal cost for payment explorers
  
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
};

/**
 * USD pricing (floats) for analytics, displays, and logging
 */
export const SERVICE_PRICING_USD: Record<ServiceName, number> = {
  // Discovery/Testing Services
  "ping": 0.01,
  
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
