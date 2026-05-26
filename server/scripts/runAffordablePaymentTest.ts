/**
 * Affordable x402 Payment Test - All services except premium tier
 * Tests 34 micropayment services (excludes 3 premium $5-$10 services)
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

// All affordable services ($0.10 - $2.00) - 34 services total
const AFFORDABLE_SERVICES = [
  // Discovery/Testing ($0.25)
  { name: "ping", endpoint: "/x402/ping", priceUSD: 0.25, payload: { message: "full-test" } },
  
  // Trading Intelligence ($0.10-$0.75) - 14 services
  { name: "gas-price-oracle", endpoint: "/x402/gas-price-oracle", priceUSD: 0.10, payload: { chain: "ethereum" } },
  { name: "token-metadata", endpoint: "/x402/token-metadata", priceUSD: 0.10, payload: { tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", chain: "ethereum" } },
  { name: "dex-liquidity", endpoint: "/x402/dex-liquidity", priceUSD: 0.20, payload: { tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", chain: "ethereum" } },
  { name: "approval-manager", endpoint: "/x402/approval-manager", priceUSD: 0.20, payload: { walletAddress: "0x92Ca4CEF1Ba55a218F88e0318Cfa015ea92Db6f9", chain: "ethereum" } },
  { name: "token-price", endpoint: "/x402/token-price", priceUSD: 0.25, payload: { tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", chain: "ethereum" } },
  { name: "token-sentiment", endpoint: "/x402/token-sentiment", priceUSD: 0.25, payload: { tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" } },
  { name: "transaction-builder", endpoint: "/x402/transaction-builder", priceUSD: 0.30, payload: { type: "transfer", from: "0x92Ca4CEF1Ba55a218F88e0318Cfa015ea92Db6f9", to: "0xa4bBE37f9A6Ae2dc36a607B91eB148C0ae163C91", amount: "1", chain: "ethereum" } },
  { name: "whale-alerts", endpoint: "/x402/whale-alerts", priceUSD: 0.35, payload: { chain: "ethereum", minAmount: 1000000 } },
  { name: "batch-quote", endpoint: "/x402/batch-quote", priceUSD: 0.40, payload: { tokens: ["0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"], chain: "ethereum" } },
  { name: "multi-chain-balance", endpoint: "/x402/multi-chain-balance", priceUSD: 0.50, payload: { walletAddress: "0x92Ca4CEF1Ba55a218F88e0318Cfa015ea92Db6f9" } },
  { name: "trending-tokens", endpoint: "/x402/trending-tokens", priceUSD: 0.50, payload: { chain: "ethereum", limit: 10 } },
  { name: "portfolio-tracker", endpoint: "/x402/portfolio-tracker", priceUSD: 0.50, payload: { walletAddress: "0x92Ca4CEF1Ba55a218F88e0318Cfa015ea92Db6f9" } },
  { name: "wallet-risk", endpoint: "/x402/wallet-risk", priceUSD: 0.50, payload: { walletAddress: "0x92Ca4CEF1Ba55a218F88e0318Cfa015ea92Db6f9" } },
  { name: "trade-signals", endpoint: "/x402/trade-signals", priceUSD: 0.75, payload: { token: "ETH", timeframe: "1h" } },
  
  // Execution & Infrastructure ($0.50-$2.00) - 4 services
  { name: "payment-processing", endpoint: "/x402/payment-processing", priceUSD: 0.50, payload: { amount: 10, currency: "USDC", destination: "0xa4bBE37f9A6Ae2dc36a607B91eB148C0ae163C91" } },
  { name: "contract-scan", endpoint: "/x402/contract-scan", priceUSD: 1.00, payload: { contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", chain: "ethereum" } },
  { name: "instant-agent-wallet", endpoint: "/x402/instant-agent-wallet", priceUSD: 1.00, payload: { agentId: "test-agent-full" } },
  { name: "seamless-chain-bridge", endpoint: "/x402/seamless-chain-bridge", priceUSD: 2.00, payload: { fromChain: "ethereum", toChain: "base", amount: 100, token: "USDC" } },
  
  // Real Estate ($0.75-$1.50) - 3 services
  { name: "property-valuation", endpoint: "/x402/property-valuation", priceUSD: 0.75, payload: { address: "123 Main St, New York, NY" } },
  { name: "lease-analysis", endpoint: "/x402/lease-analysis", priceUSD: 1.00, payload: { propertyType: "commercial", sqft: 5000, location: "Manhattan" } },
  { name: "construction-progress", endpoint: "/x402/construction-progress", priceUSD: 1.50, payload: { projectId: "test-project-1" } },
  
  // Banking/Finance ($0.75-$1.75) - 3 services
  { name: "fraud-detection", endpoint: "/x402/fraud-detection", priceUSD: 0.75, payload: { transactionId: "tx-123", amount: 1000 } },
  { name: "credit-risk-score", endpoint: "/x402/credit-risk-score", priceUSD: 1.25, payload: { entityId: "entity-123" } },
  { name: "compliance-check", endpoint: "/x402/compliance-check", priceUSD: 1.75, payload: { walletAddress: "0x92Ca4CEF1Ba55a218F88e0318Cfa015ea92Db6f9" } },
  
  // Trading/Investment ($0.50-$2.00) - 3 services
  { name: "sentiment-analysis", endpoint: "/x402/sentiment-analysis", priceUSD: 0.50, payload: { token: "ETH" } },
  { name: "trading-signal", endpoint: "/x402/trading-signal", priceUSD: 1.00, payload: { token: "ETH", timeframe: "4h" } },
  { name: "portfolio-optimization", endpoint: "/x402/portfolio-optimization", priceUSD: 2.00, payload: { walletAddress: "0x92Ca4CEF1Ba55a218F88e0318Cfa015ea92Db6f9" } },
  
  // Market Intelligence ($0.75-$1.25) - 3 services
  { name: "correlation-matrix", endpoint: "/x402/correlation-matrix", priceUSD: 0.75, payload: { tokens: ["ETH", "BTC", "USDC"] } },
  { name: "risk-metrics", endpoint: "/x402/risk-metrics", priceUSD: 1.00, payload: { token: "ETH" } },
  { name: "arbitrage-scanner", endpoint: "/x402/arbitrage-scanner", priceUSD: 1.25, payload: { token: "USDC", chains: ["ethereum", "base"] } },
  
  // Prediction Markets ($0.25-$0.50) - 3 services
  { name: "polymarket-events", endpoint: "/x402/polymarket-events", priceUSD: 0.25, payload: { category: "crypto" } },
  { name: "polymarket-odds", endpoint: "/x402/polymarket-odds", priceUSD: 0.50, payload: { eventId: "will-btc-reach-100k" } },
  { name: "polymarket-search", endpoint: "/x402/polymarket-search", priceUSD: 0.25, payload: { query: "bitcoin" } },
];

async function runTest() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  x402 AFFORDABLE SERVICES TEST (34 services)");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`Target URL: ${BASE_URL}`);
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
  
  const totalCost = AFFORDABLE_SERVICES.reduce((sum, s) => sum + s.priceUSD, 0);
  console.log(`\nTotal test cost: $${totalCost.toFixed(2)}`);
  console.log(`(Excludes 3 premium services: verified-agent-identity $5, compliance-consultation $5, smart-contract-audit $10)`);
  
  if (startUSDC < totalCost) {
    console.log(`\n⚠️  Insufficient funds! Need $${totalCost.toFixed(2)}, have $${startUSDC.toFixed(2)}`);
    return;
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
    return;
  }
  
  console.log("✅ Address matches! Starting test suite...\n");
  
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
      reqs.filter((r: any) => { try { return BigInt(r.maxAmountRequired) <= BigInt(3 * 1_000_000); } catch { return false; } })
    );
  const x402Fetch = wrapFetchWithPayment(fetch, x402c);
  
  let passed = 0;
  let failed = 0;
  let totalSpent = 0;
  const failures: string[] = [];
  const successes: string[] = [];
  
  for (let i = 0; i < AFFORDABLE_SERVICES.length; i++) {
    const service = AFFORDABLE_SERVICES[i];
    const url = `${BASE_URL}${service.endpoint}`;
    console.log(`[${i + 1}/${AFFORDABLE_SERVICES.length}] ${service.name} ($${service.priceUSD})...`);
    
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
        failures.push(`${service.name}: Status ${response.status}`);
      }
    } catch (error: any) {
      console.log(`  ❌ ERROR - ${error.message.slice(0, 100)}`);
      failed++;
      failures.push(`${service.name}: ${error.message.slice(0, 50)}`);
    }
  }
  
  const endUSDC = parseFloat((await cdpWallet.getBalance("usdc")).toString());
  const endETH = parseFloat((await cdpWallet.getBalance("eth")).toString());
  
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  TEST RESULTS - 34 AFFORDABLE SERVICES");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  Passed: ${passed}/${AFFORDABLE_SERVICES.length}`);
  console.log(`  Failed: ${failed}/${AFFORDABLE_SERVICES.length}`);
  console.log(`  Total spent: $${totalSpent.toFixed(2)}`);
  console.log("");
  console.log(`  Starting USDC: $${startUSDC.toFixed(2)}`);
  console.log(`  Ending USDC:   $${endUSDC.toFixed(2)}`);
  console.log(`  USDC Used:     $${(startUSDC - endUSDC).toFixed(2)}`);
  console.log("");
  
  if (failures.length > 0) {
    console.log("  Failed services:");
    failures.forEach(f => console.log(`    ❌ ${f}`));
    console.log("");
  }
  
  console.log("═══════════════════════════════════════════════════════════════");
  
  if (passed === AFFORDABLE_SERVICES.length) {
    console.log("\n🎉 ALL 34 AFFORDABLE SERVICES VERIFIED WITH REAL PAYMENTS!");
    console.log("   (3 premium services not tested - would need additional $20 USDC)");
    console.log("   Platform ready for production deployment.");
  } else {
    console.log(`\n⚠️  ${failed} services failed - review errors above`);
  }
}

runTest().catch(console.error);
