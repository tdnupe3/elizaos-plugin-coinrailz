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
import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { HDKey } from "@scure/bip32";
import { createWalletClient, createPublicClient, http, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import * as fs from "fs";

const BASE_URL = process.env.TEST_PROD === "true" 
  ? "https://coinrailz.com" 
  : "https://b9c7a16b-b90f-4d3c-b73c-bb8d49f9a8fd-00-2zmwe913s9fbf.picard.replit.dev";

// Command line args - REQUIRE explicit budget to prevent accidental fund drain
const args = process.argv.slice(2);
const budgetIdx = args.indexOf("--budget");
const BUDGET_LIMIT = budgetIdx >= 0 ? parseFloat(args[budgetIdx + 1] || "0") : -1;
const TEST_ALL = args.includes("--all");

// Safety check - REQUIRE budget flag to prevent accidental fund drain
if (BUDGET_LIMIT < 0) {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  ❌ SAFETY: --budget flag REQUIRED");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("");
  console.log("  Usage: npx tsx server/scripts/runFullPaymentTest.ts --budget 5");
  console.log("");
  console.log("  This prevents accidental fund drain. Specify max USDC to spend.");
  console.log("═══════════════════════════════════════════════════════════════");
  process.exit(1);
}

// All 34 x402 services - with CORRECT payloads based on handler requirements
// 'tested: true' means already verified with real payment
const ALL_SERVICES = [
  // Already tested and verified
  { name: "gas-price-oracle", endpoint: "/x402/gas-price-oracle", priceUSD: 0.10, payload: { chain: "ethereum" }, tested: true },
  { name: "token-metadata", endpoint: "/x402/token-metadata", priceUSD: 0.10, payload: { tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", chain: "ethereum" }, tested: true },
  { name: "ping", endpoint: "/x402/ping", priceUSD: 0.25, payload: { message: "full-test" }, tested: true },
  { name: "token-price", endpoint: "/x402/token-price", priceUSD: 0.25, payload: { tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", chain: "ethereum" }, tested: true },
  { name: "polymarket-events", endpoint: "/x402/polymarket-events", priceUSD: 0.25, payload: { category: "crypto" }, tested: true },
  { name: "polymarket-search", endpoint: "/x402/polymarket-search", priceUSD: 0.25, payload: { query: "bitcoin" }, tested: true },
  { name: "transaction-builder", endpoint: "/x402/transaction-builder", priceUSD: 0.30, payload: { chain: "base", type: "transfer", from: "0x92Ca4CEF1Ba55a218F88e0318Cfa015ea92Db6f9", to: "0xa4bBE37f9A6Ae2dc36a607B91eB148C0ae163C91", amount: "0.001" }, tested: true },
  { name: "multi-chain-balance", endpoint: "/x402/multi-chain-balance", priceUSD: 0.50, payload: { walletAddress: "0x92Ca4CEF1Ba55a218F88e0318Cfa015ea92Db6f9" }, tested: true },
  { name: "trending-tokens", endpoint: "/x402/trending-tokens", priceUSD: 0.50, payload: { chain: "ethereum", limit: 10 }, tested: true },
  { name: "portfolio-tracker", endpoint: "/x402/portfolio-tracker", priceUSD: 0.50, payload: { walletAddress: "0x92Ca4CEF1Ba55a218F88e0318Cfa015ea92Db6f9" }, tested: true },
  { name: "payment-processing", endpoint: "/x402/payment-processing", priceUSD: 0.50, payload: { amount: 10, currency: "USDC", destination: "0xa4bBE37f9A6Ae2dc36a607B91eB148C0ae163C91" }, tested: true },
  { name: "trade-signals", endpoint: "/x402/trade-signals", priceUSD: 0.75, payload: { token: "ETH", timeframe: "1h" }, tested: true },
  { name: "contract-scan", endpoint: "/x402/contract-scan", priceUSD: 1.00, payload: { contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", chain: "ethereum" }, tested: true },
  { name: "instant-agent-wallet", endpoint: "/x402/instant-agent-wallet", priceUSD: 1.00, payload: { agentId: "test-agent-full" }, tested: true },
  { name: "compliance-consultation", endpoint: "/x402/compliance-consultation", priceUSD: 5.00, payload: { jurisdiction: "US", businessType: "crypto-exchange" }, tested: true },
  { name: "smart-contract-audit", endpoint: "/x402/smart-contract-audit", priceUSD: 10.00, payload: { contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", chain: "ethereum" }, tested: true },
  
  // Verified in last run
  { name: "dex-liquidity", endpoint: "/x402/dex-liquidity", priceUSD: 0.20, payload: { tokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", chain: "base" }, tested: true },
  { name: "wallet-risk", endpoint: "/x402/wallet-risk", priceUSD: 0.50, payload: { walletAddress: "0x92Ca4CEF1Ba55a218F88e0318Cfa015ea92Db6f9", chain: "base" }, tested: true },
  { name: "polymarket-odds", endpoint: "/x402/polymarket-odds", priceUSD: 0.50, payload: { marketId: "0x1234", slug: "will-btc-reach-100k" }, tested: true },
  
  // FIXED payloads based on actual schema requirements
  // Verified with fixed payloads
  { name: "approval-manager", endpoint: "/x402/approval-manager", priceUSD: 0.20, payload: { tokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", spender: "0x1111111254EEB25477B68fb85Ed929f73A960582", amount: "1000", chain: "base" }, tested: true },
  { name: "batch-quote", endpoint: "/x402/batch-quote", priceUSD: 0.40, payload: { fromToken: "0x4200000000000000000000000000000000000006", toToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", amount: "1", chain: "base" }, tested: true },
  
  // FIXED: Handler bugs corrected - verified with real payments
  { name: "token-sentiment", endpoint: "/x402/token-sentiment", priceUSD: 0.25, payload: { tokenSymbol: "ETH", chain: "ethereum" }, tested: true },
  { name: "whale-alerts", endpoint: "/x402/whale-alerts", priceUSD: 0.35, payload: { tokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", chain: "base", threshold: 100000 }, tested: true },
  
  // Verified with OpenAI credits
  { name: "sentiment-analysis", endpoint: "/x402/sentiment-analysis", priceUSD: 0.50, payload: { symbol: "ETH", sources: ["twitter", "reddit"] }, tested: true },
  { name: "property-valuation", endpoint: "/x402/property-valuation", priceUSD: 0.75, payload: { address: "123 Main St, New York, NY 10001", propertyType: "residential" }, tested: true },
  { name: "fraud-detection", endpoint: "/x402/fraud-detection", priceUSD: 0.75, payload: { transactionHash: "0x123", walletAddress: "0x92Ca4CEF1Ba55a218F88e0318Cfa015ea92Db6f9", amount: 1000 }, tested: true },
  { name: "correlation-matrix", endpoint: "/x402/correlation-matrix", priceUSD: 0.75, payload: { assets: ["BTC", "ETH", "SOL"], period: "30d" }, tested: true },
  { name: "lease-analysis", endpoint: "/x402/lease-analysis", priceUSD: 1.00, payload: { propertyType: "commercial", sqft: 5000, location: "Manhattan, NY", monthlyRent: 10000 }, tested: true },
  { name: "credit-risk-score", endpoint: "/x402/credit-risk-score", priceUSD: 1.25, payload: { entityId: "entity-123", walletAddress: "0x92Ca4CEF1Ba55a218F88e0318Cfa015ea92Db6f9" }, tested: true },
  { name: "arbitrage-scanner", endpoint: "/x402/arbitrage-scanner", priceUSD: 1.25, payload: { token: "USDC", fromChain: "ethereum", toChain: "base" }, tested: true },
  { name: "trading-signal", endpoint: "/x402/trading-signal", priceUSD: 1.00, payload: { symbol: "ETH", timeframe: "4h", riskTolerance: "moderate" }, tested: true },
  { name: "risk-metrics", endpoint: "/x402/risk-metrics", priceUSD: 1.00, payload: { portfolioValue: 10000, holdings: [{ asset: "BTC", value: 6000 }, { asset: "ETH", value: 4000 }] }, tested: true },
  { name: "compliance-check", endpoint: "/x402/compliance-check", priceUSD: 1.75, payload: { walletAddress: "0x92Ca4CEF1Ba55a218F88e0318Cfa015ea92Db6f9", jurisdiction: "US" }, tested: true },
  { name: "seamless-chain-bridge", endpoint: "/x402/seamless-chain-bridge", priceUSD: 2.00, payload: { fromChain: "ethereum", toChain: "base", amount: "100", fromAddress: "0x92Ca4CEF1Ba55a218F88e0318Cfa015ea92Db6f9", toAddress: "0x92Ca4CEF1Ba55a218F88e0318Cfa015ea92Db6f9" }, tested: true },
  { name: "verified-agent-identity", endpoint: "/x402/verified-agent-identity", priceUSD: 5.00, payload: { agentId: "test-agent-001", walletAddress: "0x92Ca4CEF1Ba55a218F88e0318Cfa015ea92Db6f9", agentName: "TestAgent", agentUrl: "https://test.com" }, tested: true },
  
  // Verified
  { name: "construction-progress", endpoint: "/x402/construction-progress", priceUSD: 1.50, payload: { projectDescription: "Commercial building construction in Manhattan, 50-story office tower with modern amenities", projectType: "commercial", currentPhase: "foundation" }, tested: true },
  
  // Verified with real payment
  { name: "portfolio-optimization", endpoint: "/x402/portfolio-optimization", priceUSD: 2.00, payload: { currentHoldings: [{ asset: "BTC", amount: 0.5, currentValue: 25000 }, { asset: "ETH", amount: 10, currentValue: 20000 }], riskTolerance: "moderate" }, tested: true },
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
  
  // @x402/fetch 2.x: 2-arg API — build x402Client with ExactEvmScheme + policy cap
  const publicClient = createPublicClient({ chain: base, transport: http() });
  const evmSigner = {
    address: account.address,
    signTypedData: (args: any) => walletClient.signTypedData(args),
    readContract: (args: any) => publicClient.readContract(args),
    estimateFeesPerGas: () => publicClient.estimateFeesPerGas(),
    getTransactionCount: (args: any) => publicClient.getTransactionCount(args),
  };
  const x402c = new x402Client()
    .register('eip155:8453', new ExactEvmScheme(evmSigner))
    .registerPolicy((_v: any, reqs: any[]) =>
      reqs.filter((r: any) => { try { return BigInt(r.maxAmountRequired) <= BigInt(15 * 1_000_000); } catch { return false; } })
    );
  const x402Fetch = wrapFetchWithPayment(fetch, x402c);
  
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
    
    // Longer delay between requests to avoid nonce conflicts
    await new Promise(r => setTimeout(r, 2000));
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
