/**
 * x402 Service Full Test Suite — RETIRED
 *
 * This script used x402-fetch@0.7.3 (wrapFetch 1-arg API) and @coinbase/coinbase-sdk.
 * Both are no longer in use. Replaced by:
 *   - server/scripts/runFullPaymentTest.ts   (all services, @x402/fetch 2.x)
 *   - server/scripts/runAffordablePaymentTest.ts (affordable tier)
 *   - server/scripts/runQuickPaymentTest.ts  (quick smoke test)
 *
 * DO NOT RUN — kept for historical reference only.
 */

// RETIRED — imports removed to prevent x402-fetch dependency
// import { Coinbase, Wallet } from "@coinbase/coinbase-sdk";
// import { wrapFetch } from "x402-fetch";

const BASE_URL = process.env.PUBLIC_BASE_URL || "https://coinrailz.com";

// Service definitions with test payloads
const SERVICES: Array<{
  name: string;
  endpoint: string;
  priceMicro: number;
  testPayload: Record<string, any>;
}> = [
  // Discovery/Testing
  { name: "ping", endpoint: "/x402/ping", priceMicro: 250000, testPayload: { message: "test" } },
  
  // Trading Intelligence
  { name: "gas-price-oracle", endpoint: "/x402/gas-price-oracle", priceMicro: 100000, testPayload: { chain: "ethereum" } },
  { name: "token-metadata", endpoint: "/x402/token-metadata", priceMicro: 100000, testPayload: { tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", chain: "ethereum" } },
  { name: "dex-liquidity", endpoint: "/x402/dex-liquidity", priceMicro: 200000, testPayload: { tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", chain: "ethereum" } },
  { name: "approval-manager", endpoint: "/x402/approval-manager", priceMicro: 200000, testPayload: { walletAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f5B5c5", chain: "ethereum" } },
  { name: "token-price", endpoint: "/x402/token-price", priceMicro: 250000, testPayload: { tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", chain: "ethereum" } },
  { name: "token-sentiment", endpoint: "/x402/token-sentiment", priceMicro: 250000, testPayload: { tokenSymbol: "ETH" } },
  { name: "transaction-builder", endpoint: "/x402/transaction-builder", priceMicro: 300000, testPayload: { type: "transfer", from: "0x742d35Cc6634C0532925a3b844Bc9e7595f5B5c5", to: "0xa4bBE37f9A6Ae2dc36a607B91eB148C0ae163C91", amount: "0.001", chain: "ethereum" } },
  { name: "whale-alerts", endpoint: "/x402/whale-alerts", priceMicro: 350000, testPayload: { chain: "ethereum", minValue: 1000000 } },
  { name: "batch-quote", endpoint: "/x402/batch-quote", priceMicro: 400000, testPayload: { pairs: [{ from: "ETH", to: "USDC", amount: "1" }], chain: "ethereum" } },
  { name: "multi-chain-balance", endpoint: "/x402/multi-chain-balance", priceMicro: 500000, testPayload: { walletAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f5B5c5" } },
  { name: "trending-tokens", endpoint: "/x402/trending-tokens", priceMicro: 500000, testPayload: { chain: "ethereum", limit: 10 } },
  { name: "portfolio-tracker", endpoint: "/x402/portfolio-tracker", priceMicro: 500000, testPayload: { walletAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f5B5c5" } },
  { name: "wallet-risk", endpoint: "/x402/wallet-risk", priceMicro: 500000, testPayload: { walletAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f5B5c5" } },
  { name: "trade-signals", endpoint: "/x402/trade-signals", priceMicro: 750000, testPayload: { tokenSymbol: "ETH", timeframe: "1h" } },
  
  // Execution & Infrastructure
  { name: "contract-scan", endpoint: "/x402/contract-scan", priceMicro: 1000000, testPayload: { contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", chain: "ethereum" } },
  { name: "instant-agent-wallet", endpoint: "/x402/instant-agent-wallet", priceMicro: 1000000, testPayload: { agentId: "test-agent-001", chain: "base" } },
  { name: "seamless-chain-bridge", endpoint: "/x402/seamless-chain-bridge", priceMicro: 2000000, testPayload: { fromChain: "ethereum", toChain: "base", token: "USDC", amount: "10" } },
  
  // Premium
  { name: "verified-agent-identity", endpoint: "/x402/verified-agent-identity", priceMicro: 5000000, testPayload: { agentId: "test-agent-001", agentName: "TestBot", capabilities: ["trading", "analysis"] } },
  
  // Real Estate
  { name: "property-valuation", endpoint: "/x402/property-valuation", priceMicro: 750000, testPayload: { address: "123 Main St, New York, NY 10001", propertyType: "residential" } },
  { name: "lease-analysis", endpoint: "/x402/lease-analysis", priceMicro: 1000000, testPayload: { propertyAddress: "123 Main St, New York, NY 10001", monthlyRent: 3000, leaseTerm: 12 } },
  { name: "construction-progress", endpoint: "/x402/construction-progress", priceMicro: 1500000, testPayload: { projectId: "test-project-001", address: "123 Main St, New York, NY 10001" } },
  
  // Banking/Finance
  { name: "fraud-detection", endpoint: "/x402/fraud-detection", priceMicro: 750000, testPayload: { transactionId: "tx-001", amount: 1000, source: "wallet-a", destination: "wallet-b" } },
  { name: "credit-risk-score", endpoint: "/x402/credit-risk-score", priceMicro: 1250000, testPayload: { walletAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f5B5c5", transactionHistory: [] } },
  { name: "compliance-check", endpoint: "/x402/compliance-check", priceMicro: 1750000, testPayload: { walletAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f5B5c5", jurisdiction: "US" } },
  
  // Trading/Investment
  { name: "sentiment-analysis", endpoint: "/x402/sentiment-analysis", priceMicro: 500000, testPayload: { query: "Bitcoin price prediction", sources: ["twitter", "reddit"] } },
  { name: "trading-signal", endpoint: "/x402/trading-signal", priceMicro: 1000000, testPayload: { tokenSymbol: "ETH", timeframe: "4h", strategy: "momentum" } },
  { name: "portfolio-optimization", endpoint: "/x402/portfolio-optimization", priceMicro: 2000000, testPayload: { assets: ["ETH", "BTC", "USDC"], targetRisk: "medium" } },
  
  // Market Intelligence
  { name: "correlation-matrix", endpoint: "/x402/correlation-matrix", priceMicro: 750000, testPayload: { tokens: ["ETH", "BTC", "SOL"], timeframe: "30d" } },
  { name: "risk-metrics", endpoint: "/x402/risk-metrics", priceMicro: 1000000, testPayload: { portfolio: [{ token: "ETH", allocation: 0.5 }, { token: "BTC", allocation: 0.5 }] } },
  { name: "arbitrage-scanner", endpoint: "/x402/arbitrage-scanner", priceMicro: 1250000, testPayload: { token: "USDC", chains: ["ethereum", "polygon", "base"] } },
  
  // Prediction Markets
  { name: "polymarket-events", endpoint: "/x402/polymarket-events", priceMicro: 250000, testPayload: { category: "politics", limit: 10 } },
  { name: "polymarket-odds", endpoint: "/x402/polymarket-odds", priceMicro: 500000, testPayload: { marketId: "will-bitcoin-reach-100k-2024" } },
  { name: "polymarket-search", endpoint: "/x402/polymarket-search", priceMicro: 250000, testPayload: { query: "bitcoin", limit: 5 } },
];

interface TestResult {
  service: string;
  success: boolean;
  status: number;
  responseTime: number;
  paid: boolean;
  error?: string;
  response?: any;
}

async function initializeTestWallet(): Promise<Wallet> {
  console.log("🔧 Initializing CDP wallet for testing...");
  
  if (!process.env.CDP_API_KEY_ID || !process.env.CDP_PRIVATE_KEY) {
    throw new Error("CDP credentials not configured");
  }
  
  Coinbase.configure({
    apiKeyName: process.env.CDP_API_KEY_ID,
    privateKey: process.env.CDP_PRIVATE_KEY,
  });
  
  // Create or import a test wallet
  const wallet = await Wallet.create({ networkId: "base-mainnet" });
  const address = await wallet.getDefaultAddress();
  
  console.log(`✅ Test wallet created: ${address?.getId()}`);
  
  // Check USDC balance
  const balance = await wallet.getBalance("usdc");
  console.log(`💰 USDC Balance: ${balance} USDC`);
  
  if (Number(balance) < 30) {
    console.warn(`⚠️ Low balance! Need ~$28.65 USDC to run full test suite`);
  }
  
  return wallet;
}

async function testService(
  service: typeof SERVICES[0],
  wrappedFetch: typeof fetch
): Promise<TestResult> {
  const startTime = Date.now();
  const url = `${BASE_URL}${service.endpoint}`;
  
  try {
    console.log(`\n🧪 Testing ${service.name} ($${service.priceMicro / 1000000} USDC)...`);
    
    const response = await wrappedFetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(service.testPayload),
    });
    
    const responseTime = Date.now() - startTime;
    const data = await response.json().catch(() => ({}));
    
    if (response.status === 200) {
      console.log(`  ✅ SUCCESS - ${responseTime}ms`);
      return {
        service: service.name,
        success: true,
        status: response.status,
        responseTime,
        paid: true,
        response: data,
      };
    } else if (response.status === 402) {
      console.log(`  ⚠️ 402 Payment Required - payment may not have processed`);
      return {
        service: service.name,
        success: false,
        status: response.status,
        responseTime,
        paid: false,
        error: "Payment not processed by facilitator",
        response: data,
      };
    } else {
      console.log(`  ❌ FAILED - Status ${response.status}`);
      return {
        service: service.name,
        success: false,
        status: response.status,
        responseTime,
        paid: false,
        error: data.error || `HTTP ${response.status}`,
        response: data,
      };
    }
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    console.log(`  ❌ ERROR - ${error.message}`);
    return {
      service: service.name,
      success: false,
      status: 0,
      responseTime,
      paid: false,
      error: error.message,
    };
  }
}

async function runFullTestSuite() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("    x402 Service Full Test Suite - REAL USDC PAYMENTS");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Services to test: ${SERVICES.length}`);
  
  const totalCost = SERVICES.reduce((sum, s) => sum + s.priceMicro, 0) / 1000000;
  console.log(`Total cost: $${totalCost.toFixed(2)} USDC (funds return to platform wallet)`);
  console.log("");
  
  try {
    // Initialize wallet
    const wallet = await initializeTestWallet();
    
    // Create wrapped fetch with x402 payment capability
    const wrappedFetch = wrapFetch(fetch, wallet);
    
    const results: TestResult[] = [];
    let successCount = 0;
    let failCount = 0;
    let totalPaid = 0;
    
    // Test each service sequentially (to avoid rate limiting)
    for (const service of SERVICES) {
      const result = await testService(service, wrappedFetch);
      results.push(result);
      
      if (result.success) {
        successCount++;
        totalPaid += service.priceMicro / 1000000;
      } else {
        failCount++;
      }
      
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Print summary
    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("                          RESULTS SUMMARY");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log(`✅ Successful: ${successCount}/${SERVICES.length}`);
    console.log(`❌ Failed: ${failCount}/${SERVICES.length}`);
    console.log(`💰 Total paid: $${totalPaid.toFixed(2)} USDC`);
    console.log("");
    
    // List failures
    const failures = results.filter(r => !r.success);
    if (failures.length > 0) {
      console.log("FAILED SERVICES:");
      failures.forEach(f => {
        console.log(`  - ${f.service}: ${f.error}`);
      });
    }
    
    // Save results to database or file
    console.log("\n📊 Test results saved.");
    
    return {
      success: failCount === 0,
      results,
      summary: {
        total: SERVICES.length,
        passed: successCount,
        failed: failCount,
        totalPaid,
      }
    };
    
  } catch (error: any) {
    console.error("❌ Test suite failed:", error.message);
    throw error;
  }
}

// Run if executed directly
runFullTestSuite()
  .then(result => {
    console.log("\n✅ Test suite completed");
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
