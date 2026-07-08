// Export common utilities
export * from "./common";

// Export Real Estate services
export {
  propertyValuationService,
  leaseAnalysisService,
  constructionProgressService
} from "./realEstate";

// Export Banking/Finance services
export {
  creditRiskScoreService,
  fraudDetectionService,
  complianceCheckService
} from "./banking";

// Export Trading/Investment services
export {
  tradingSignalService,
  portfolioOptimizationService,
  sentimentAnalysisService
} from "./trading";

// Export Market Intelligence services
export {
  arbitrageScannerService,
  correlationMatrixService,
  riskMetricsService
} from "./intelligence";

// Export Traditional Markets services (Stocks & Forex)
export {
  stockSentimentService,
  forexSentimentService
} from "./markets";

// Export B20 Native Token Standard services (Base Beryl, July 8 2026)
export {
  b20TokenInfoService,
  b20TransferCheckService,
  b20ComplianceScanService,
} from "./b20Data";

// Updated pricing configuration with new services
export const NEW_SERVICE_PRICING = {
  // Real Estate Services
  "property-valuation": 0.50,
  "lease-analysis": 0.75,
  "construction-progress": 1.00,
  
  // Banking/Finance Services
  "credit-risk-score": 0.50,
  "fraud-detection": 0.25,
  "compliance-check": 0.40,
  
  // Trading/Investment Services
  "trading-signal": 1.00,
  "portfolio-optimization": 1.50,
  "sentiment-analysis": 0.20,
  
  // Market Intelligence Services
  "arbitrage-scanner": 0.75,
  "correlation-matrix": 0.50,
  "risk-metrics": 0.60,
};
