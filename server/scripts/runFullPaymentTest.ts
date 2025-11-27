/**
 * FULL x402 Payment Test - All 34 Services
 * Tests every micropayment service with real USDC payments
 * 
 * Usage:
 *   npx tsx server/scripts/runFullPaymentTest.ts              # Run all untested services
 *   npx tsx server/scripts/runFullPaymentTest.ts --budget 1   # Limit to $1 spend
 *   npx tsx server/scripts/runFullPaymentTest.ts --all        # Retest all including already tested
 */

import { Coinbase, Wallet } from "@coinbase/coinbase-sdk";
import { wrapFetchWithPayment } from "x402-fetch";
import { HDKey } from "@scure/bip32";
import { createWalletClient, http, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import * as fs from "fs";

const BASE_URL = process.env.TEST_PROD === "true" 
  ? "https://coinrailz.com" 
  : "https://b9c7a16b-b90f-4d3c-b73c-bb8d49f9a8fd-00-2zmwe913s9fbf.picard.replit.dev";

// Command line args
const args = process.argv.slice(2);
const budgetIdx = args.indexOf("--budget");
const BUDGET_LIMIT = budgetIdx >= 0 ? parseFloat(args[budgetIdx + 1] || "999") : 999;
const TEST_ALL = args.includes("--all");

// All 34 x402 services - sorted by price for budget-aware testing
// 'tested: true' means already verified with real payment
const ALL_SERVICES = [
  // Already tested ($0.45 total)
  { name: "gas-price-oracle", endpoint: "/x402/gas-price-oracle", priceUSD: 0.10, payload: { chain: "ethereum" }, tested: true },
  { name: "token-metadata", endpoint: "/x402/token-metadata", priceUSD: 0.10, payload: { tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", chain: "ethereum" }, tested: true },
  { name: "ping", endpoint: "/x402/ping", priceUSD: 0.25, payload: { message: "full-test" }, tested: true },
  
  // Not yet tested - sorted by price (cheapest first)
  { name: "dex-liquidity", endpoint: "/x402/dex-liquidity", priceUSD: 0.20, payload: { tokenA: "0x4200000000000000000000000000000000000006", tokenB: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", chain: "base" }, tested: false },
  { name: "approval-manager", endpoint: "/x402/approval-manager", priceUSD: 0.20, payload: { walletAddress: "0x92Ca4CEF1Ba55a218F88e0318Cfa015ea92Db6f9", chain: "base" }, tested: false },
  { name: "token-price", endpoint: "/x402/token-price", priceUSD: 0.25, payload: { tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", chain: "ethereum" }, tested: false },
  { name: "token-sentiment", endpoint: "/x402/token-sentiment", priceUSD: 0.25, payload: { tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" }, tested: false },
  { name: "polymarket-events", endpoint: "/x402/polymarket-events", priceUSD: 0.25, payload: { category: "crypto" }, tested: false },
  { name: "polymarket-search", endpoint: "/x402/polymarket-search", priceUSD: 0.25, payload: { query: "bitcoin" }, tested: false },
  { name: "transaction-builder", endpoint: "/x402/transaction-builder", priceUSD: 0.30, payload: { chain: "base", type: "transfer", from: "0x92Ca4CEF1Ba55a218F88e0318Cfa015ea92Db6f9", to: "0xa4bBE37f9A6Ae2dc36a607B91eB148C0ae163C91", amount: "0.001" }, tested: false },
  { name: "whale-alerts", endpoint: "/x402/whale-alerts", priceUSD: 0.35, payload: { chain: "ethereum", minAmount: 1000000 }, tested: false },
  { name: "batch-quote", endpoint: "/x402/batch-quote", priceUSD: 0.40, payload: { tokens: ["0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"], chain: "ethereum" }, tested: false },
  { name: "multi-chain-balance", endpoint: "/x402/multi-chain-balance", priceUSD: 0.50, payload: { walletAddress: "0x92Ca4CEF1Ba55a218F88e0318Cfa015ea92Db6f9" }, tested: false },
  { name: "trending-tokens", endpoint: "/x402/trending-tokens", priceUSD: 0.50, payload: { chain: "ethereum", limit: 10 }, tested: false },
  { name: "portfolio-tracker", endpoint: "/x402/portfolio-tracker", priceUSD: 0.50, payload: { walletAddress: "0x92Ca4CEF1Ba55a218F88e0318Cfa015ea92Db6f9" }, tested: false },
  { name: "wallet-risk", endpoint: "/x402/wallet-risk", priceUSD: 0.50, payload: { walletAddress: "0x92Ca4CEF1Ba55a218F88e0318Cfa015ea92Db6f9" }, tested: false },
  { name: "payment-processing", endpoint: "/x402/payment-processing", priceUSD: 0.50, payload: { amount: 10, currency: "USDC", destination: "0xa4bBE37f9A6Ae2dc36a607B91eB148C0ae163C91" }, tested: false },
  { name: "sentiment-analysis", endpoint: "/x402/sentiment-analysis", priceUSD: 0.50, payload: { token: "ETH" }, tested: false },
  { name: "polymarket-odds", endpoint: "/x402/polymarket-odds", priceUSD: 0.50, payload: { eventId: "will-btc-reach-100k" }, tested: false },
  { name: "trade-signals", endpoint: "/x402/trade-signals", priceUSD: 0.75, payload: { token: "ETH", timeframe: "1h" }, tested: false },
  { name: "property-valuation", endpoint: "/x402/property-valuation", priceUSD: 0.75, payload: { address: "123 Main St, New York, NY" }, tested: false },
  { name: "fraud-detection", endpoint: "/x402/fraud-detection", priceUSD: 0.75, payload: { transactionId: "tx-123", amount: 1000 }, tested: false },
  { name: "correlation-matrix", endpoint: "/x402/correlation-matrix", priceUSD: 0.75, payload: { tokens: ["ETH", "BTC", "USDC"] }, tested: false },
  { name: "contract-scan", endpoint: "/x402/contract-scan", priceUSD: 1.00, payload: { contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", chain: "ethereum" }, tested: false },
  { name: "instant-agent-wallet", endpoint: "/x402/instant-agent-wallet", priceUSD: 1.00, payload: { agentId: "test-agent-full" }, tested: false },
  { name: "lease-analysis", endpoint: "/x402/lease-analysis", priceUSD: 1.00, payload: { propertyType: "commercial", sqft: 5000, location: "Manhattan" }, tested: false },
  { name: "trading-signal", endpoint: "/x402/trading-signal", priceUSD: 1.00, payload: { token: "ETH", timeframe: "4h" }, tested: false },
  { name: "risk-metrics", endpoint: "/x402/risk-metrics", priceUSD: 1.00, payload: { token: "ETH" }, tested: false },
  { name: "credit-risk-score", endpoint: "/x402/credit-risk-score", priceUSD: 1.25, payload: { entityId: "entity-123" }, tested: false },
  { name: "arbitrage-scanner", endpoint: "/x402/arbitrage-scanner", priceUSD: 1.25, payload: { token: "USDC", chains: ["ethereum", "base"] }, tested: false },
  { name: "construction-progress", endpoint: "/x402/construction-progress", priceUSD: 1.50, payload: { projectId: "test-project-1" }, tested: false },
  { name: "compliance-check", endpoint: "/x402/compliance-check", priceUSD: 1.75, payload: { walletAddress: "0x92Ca4CEF1Ba55a218F88e0318Cfa015ea92Db6f9" }, tested: false },
  { name: "seamless-chain-bridge", endpoint: "/x402/seamless-chain-bridge", priceUSD: 2.00, payload: { fromChain: "ethereum", toChain: "base", amount: 100, token: "USDC" }, tested: false },
  { name: "portfolio-optimization", endpoint: "/x402/portfolio-optimization", priceUSD: 2.00, payload: { walletAddress: "0x92Ca4CEF1Ba55a218F88e0318Cfa015ea92Db6f9" }, tested: false },
  // Premium Services ($5.00-$10.00) - Enterprise gated, test last
  { name: "verified-agent-identity", endpoint: "/x402/verified-agent-identity", priceUSD: 5.00, payload: { agentName: "TestAgent", agentUrl: "https://test.com" }, tested: false },
  { name: "compliance-consultation", endpoint: "/x402/compliance-consultation", priceUSD: 5.00, payload: { jurisdiction: "US", businessType: "crypto-exchange" }, tested: false },
  { name: "smart-contract-audit", endpoint: "/x402/smart-contract-audit", priceUSD: 10.00, payload: { contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", chain: "ethereum" }, tested: false },
];

async function runFullTest() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  FULL x402 PAYMENT TEST - ALL 34 SERVICES");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`Target URL: ${BASE_URL}`);
  console.log(`Budget limit: $${BUDGET_LIMIT}`);
  console.log(`Test all (including already tested): ${TEST_ALL}`);
  console.log("");
  
  // Filter services to test
  const servicesToTest = TEST_ALL 
    ? ALL_SERVICES 
    : ALL_SERVICES.filter(s => !s.tested);
  
  const alreadyTested = ALL_SERVICES.filter(s => s.tested);
  const totalCostToTest = servicesToTest.reduce((sum, s) => sum + s.priceUSD, 0);
  
  console.log(`Already tested: ${alreadyTested.length} services ($${alreadyTested.reduce((s, x) => s + x.priceUSD, 0).toFixed(2)})`);
  console.log(`Remaining to test: ${servicesToTest.length} services ($${totalCostToTest.toFixed(2)})`);
  console.log("");
  
  const walletData = JSON.parse(fs.readFileSync("server/wallets/x402-test-wallet.json", "utf-8"));
  console.log(`CDP Wallet Address: ${walletData.address}`);
  
  Coinbase.configure({
    apiKeyName: process.env.CDP_API_KEY_ID!,
    privateKey: process.env.CDP_PRIVATE_KEY!,
  });
  
  console.log("Restoring CDP wallet...");
  const cdpWallet = await Wallet.import(walletData.exportData);
  
  const startUSDC = parseFloat((await cdpWallet.getBalance("usdc")).toString());
  const startETH = parseFloat((await cdpWallet.getBalance("eth")).toString());
  console.log(`Starting USDC: $${startUSDC.toFixed(2)}`);
  console.log(`Starting ETH: ${startETH}`);
  
  const effectiveBudget = Math.min(BUDGET_LIMIT, startUSDC);
  console.log(`Effective budget: $${effectiveBudget.toFixed(2)}`);
  
  if (effectiveBudget < 0.10) {
    console.log(`\n❌ Insufficient funds! Need at least $0.10 to test any service.`);
    console.log(`\n📊 FUNDING REQUIREMENT SUMMARY:`);
    console.log(`   - Remaining 31 services cost: $${totalCostToTest.toFixed(2)}`);
    console.log(`   - Excluding premium ($20): $${(totalCostToTest - 20).toFixed(2)}`);
    console.log(`   - Current balance: $${startUSDC.toFixed(2)}`);
    console.log(`   - Additional needed: $${Math.max(0, totalCostToTest - startUSDC).toFixed(2)}`);
    return { passed: 0, failed: 0, skipped: servicesToTest.length, totalSpent: 0 };
  }
  
  console.log("\nDeriving private key from CDP seed...");
  const seedHex = walletData.exportData.seed;
  const seedBytes = Buffer.from(seedHex, "hex");
  const hdKey = HDKey.fromMasterSeed(seedBytes);
  const derivedKey = hdKey.derive("m/44'/60'/0'/0/0");
  
  if (!derivedKey.privateKey) throw new Error("Failed to derive private key");
  
  const privateKeyHex = `0x${Buffer.from(derivedKey.privateKey).toString("hex")}` as `0x${string}`;
  const account = privateKeyToAccount(privateKeyHex);
  
  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(),
  }).extend(publicActions);
  
  console.log(`Derived address: ${account.address}`);
  
  if (account.address.toLowerCase() !== walletData.address.toLowerCase()) {
    console.log("⚠️  Address mismatch!");
    return { passed: 0, failed: 0, skipped: 0, totalSpent: 0 };
  }
  
  console.log("✅ Address matches! Starting tests...\n");
  
  const x402Fetch = wrapFetchWithPayment(fetch, walletClient, BigInt(15 * 1_000_000));
  
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  let totalSpent = 0;
  const failures: string[] = [];
  const successes: string[] = [];
  
  for (let i = 0; i < servicesToTest.length; i++) {
    const service = servicesToTest[i];
    
    // Check if we have budget for this service
    if (totalSpent + service.priceUSD > effectiveBudget) {
      console.log(`⏭️  [${i + 1}/${servicesToTest.length}] ${service.name} ($${service.priceUSD}) - SKIPPED (over budget)`);
      skipped++;
      continue;
    }
    
    const url = `${BASE_URL}${service.endpoint}`;
    console.log(`[${i + 1}/${servicesToTest.length}] ${service.name} ($${service.priceUSD})...`);
    
    try {
      const startTime = Date.now();
      
      const response = await x402Fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(service.payload),
      });
      
      const responseTime = Date.now() - startTime;
      const data = await response.json().catch(() => ({}));
      
      if (response.status === 200) {
        console.log(`  ✅ SUCCESS - ${responseTime}ms`);
        passed++;
        totalSpent += service.priceUSD;
        successes.push(service.name);
      } else {
        console.log(`  ❌ FAILED - Status ${response.status}`);
        console.log(`     ${JSON.stringify(data).slice(0, 150)}`);
        failed++;
        failures.push(`${service.name}: HTTP ${response.status}`);
      }
    } catch (error: any) {
      console.log(`  ❌ ERROR - ${error.message.slice(0, 100)}`);
      failed++;
      failures.push(`${service.name}: ${error.message.slice(0, 50)}`);
    }
    
    // Small delay between requests
    await new Promise(r => setTimeout(r, 800));
  }
  
  const endUSDC = parseFloat((await cdpWallet.getBalance("usdc")).toString());
  const endETH = parseFloat((await cdpWallet.getBalance("eth")).toString());
  
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  FULL TEST RESULTS");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  Passed:  ${passed}/${servicesToTest.length}`);
  console.log(`  Failed:  ${failed}/${servicesToTest.length}`);
  console.log(`  Skipped: ${skipped}/${servicesToTest.length} (over budget)`);
  console.log(`  Total spent: $${totalSpent.toFixed(2)}`);
  console.log("");
  console.log(`  Starting USDC: $${startUSDC.toFixed(2)}`);
  console.log(`  Ending USDC:   $${endUSDC.toFixed(2)}`);
  console.log(`  USDC Used:     $${(startUSDC - endUSDC).toFixed(2)}`);
  console.log("");
  
  // Overall progress
  const totalTested = alreadyTested.length + passed;
  console.log(`  OVERALL PROGRESS: ${totalTested}/${ALL_SERVICES.length} services verified with real payments`);
  
  if (successes.length > 0) {
    console.log(`\n  ✅ Newly verified: ${successes.join(", ")}`);
  }
  
  if (failures.length > 0) {
    console.log("\n  ❌ Failed services:");
    failures.forEach(f => console.log(`    - ${f}`));
  }
  
  if (skipped > 0) {
    const remainingCost = servicesToTest
      .filter((_, idx) => idx >= passed + failed)
      .reduce((sum, s) => sum + s.priceUSD, 0);
    console.log(`\n  💰 ADDITIONAL FUNDING NEEDED: $${remainingCost.toFixed(2)} to complete remaining ${skipped} services`);
  }
  
  console.log("═══════════════════════════════════════════════════════════════");
  
  if (totalTested === ALL_SERVICES.length) {
    console.log("\n🎉 ALL 34 SERVICES VERIFIED WITH REAL PAYMENTS!");
    console.log("   Platform ready for production deployment.");
  }
  
  return { passed, failed, skipped, totalSpent };
}

runFullTest()
  .then(({ passed, failed }) => {
    process.exit(failed > 0 ? 1 : 0);
  })
  .catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
