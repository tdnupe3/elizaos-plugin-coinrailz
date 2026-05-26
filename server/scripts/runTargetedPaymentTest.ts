/**
 * Targeted x402 Payment Test - Tests previously-failing services
 * Focus on services that returned 402/500 in last run
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

// Previously failing services - testing with correct payloads
const TARGET_SERVICES = [
  // Previously 402 failures - now should work
  { name: "gas-price-oracle", endpoint: "/x402/gas-price-oracle", priceUSD: 0.10, payload: { chain: "ethereum" } },
  { name: "token-metadata", endpoint: "/x402/token-metadata", priceUSD: 0.10, payload: { tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", chain: "ethereum" } },
  { name: "token-price", endpoint: "/x402/token-price", priceUSD: 0.25, payload: { tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", chain: "ethereum" } },
  { name: "whale-alerts", endpoint: "/x402/whale-alerts", priceUSD: 0.35, payload: { chain: "ethereum", minAmount: 1000000 } },
  { name: "property-valuation", endpoint: "/x402/property-valuation", priceUSD: 0.75, payload: { address: "123 Main St, New York, NY" } },
  { name: "lease-analysis", endpoint: "/x402/lease-analysis", priceUSD: 1.00, payload: { propertyType: "commercial", sqft: 5000, location: "Manhattan" } },
  { name: "fraud-detection", endpoint: "/x402/fraud-detection", priceUSD: 0.75, payload: { transactionId: "tx-123", amount: 1000 } },
  { name: "credit-risk-score", endpoint: "/x402/credit-risk-score", priceUSD: 1.25, payload: { entityId: "entity-123" } },
  { name: "sentiment-analysis", endpoint: "/x402/sentiment-analysis", priceUSD: 0.50, payload: { token: "ETH" } },
  { name: "trading-signal", endpoint: "/x402/trading-signal", priceUSD: 1.00, payload: { token: "ETH", timeframe: "4h" } },
  { name: "correlation-matrix", endpoint: "/x402/correlation-matrix", priceUSD: 0.75, payload: { tokens: ["ETH", "BTC", "USDC"] } },
  { name: "polymarket-events", endpoint: "/x402/polymarket-events", priceUSD: 0.25, payload: { category: "crypto" } },
  { name: "polymarket-search", endpoint: "/x402/polymarket-search", priceUSD: 0.25, payload: { query: "bitcoin" } },
  // Total: ~$7.30
];

async function runTest() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  TARGETED x402 PAYMENT TEST - Previously Failing Services");
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
  
  const totalCost = TARGET_SERVICES.reduce((sum, s) => sum + s.priceUSD, 0);
  console.log(`\nTotal test cost: $${totalCost.toFixed(2)}`);
  
  if (startUSDC < totalCost) {
    console.log(`\n⚠️  Insufficient funds! Need $${totalCost.toFixed(2)}, have $${startUSDC.toFixed(2)}`);
    console.log(`   Will run as many tests as possible...`);
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
  
  console.log("✅ Address matches! Starting targeted test suite...\n");
  
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
      reqs.filter((r: any) => { try { return BigInt(r.maxAmountRequired) <= BigInt(2 * 1_000_000); } catch { return false; } })
    );
  const x402Fetch = wrapFetchWithPayment(fetch, x402c);
  
  let passed = 0;
  let failed = 0;
  let totalSpent = 0;
  const failures: string[] = [];
  let runningBalance = startUSDC;
  
  for (let i = 0; i < TARGET_SERVICES.length; i++) {
    const service = TARGET_SERVICES[i];
    
    // Check if we have enough balance
    if (runningBalance < service.priceUSD) {
      console.log(`[${i + 1}/${TARGET_SERVICES.length}] ${service.name} - SKIPPED (insufficient funds)`);
      continue;
    }
    
    const url = `${BASE_URL}${service.endpoint}`;
    console.log(`[${i + 1}/${TARGET_SERVICES.length}] ${service.name} ($${service.priceUSD})...`);
    
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
        runningBalance -= service.priceUSD;
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
  console.log("  TARGETED TEST RESULTS");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  Passed: ${passed}/${TARGET_SERVICES.length}`);
  console.log(`  Failed: ${failed}/${TARGET_SERVICES.length}`);
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
  
  if (failed === 0) {
    console.log("\n🎉 ALL TARGETED SERVICES VERIFIED!");
    console.log("   The orchestrator fix resolved the facilitator 500 errors.");
  }
}

runTest().catch(console.error);
