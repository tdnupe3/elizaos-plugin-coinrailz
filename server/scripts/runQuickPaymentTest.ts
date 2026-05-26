/**
 * Quick x402 Payment Test
 * Uses proper BIP-44 derivation from CDP wallet seed
 */

import { Coinbase, Wallet } from "@coinbase/coinbase-sdk";
import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { HDKey } from "@scure/bip32";
import { createWalletClient, createPublicClient, http, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import * as fs from "fs";

// Use dev server for testing fixes, then switch back to production
const BASE_URL = process.env.TEST_PROD === "true" 
  ? "https://coinrailz.com" 
  : "https://b9c7a16b-b90f-4d3c-b73c-bb8d49f9a8fd-00-2zmwe913s9fbf.picard.replit.dev";

// Test only the cheapest services first ($0.10-$0.25)
const TEST_SERVICES = [
  { name: "gas-price-oracle", endpoint: "/x402/gas-price-oracle", priceUSD: 0.10, payload: { chain: "ethereum" } },
  { name: "token-metadata", endpoint: "/x402/token-metadata", priceUSD: 0.10, payload: { tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", chain: "ethereum" } },
  { name: "ping", endpoint: "/x402/ping", priceUSD: 0.25, payload: { message: "production-payment-test" } },
];

async function runTest() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  x402 QUICK PAYMENT TEST");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("");
  
  // Load wallet from saved file
  const walletData = JSON.parse(fs.readFileSync("server/wallets/x402-test-wallet.json", "utf-8"));
  console.log(`CDP Wallet Address: ${walletData.address}`);
  
  // Configure CDP
  Coinbase.configure({
    apiKeyName: process.env.CDP_API_KEY_ID!,
    privateKey: process.env.CDP_PRIVATE_KEY!,
  });
  
  // Restore CDP wallet to check balances
  console.log("Restoring CDP wallet...");
  const cdpWallet = await Wallet.import(walletData.exportData);
  
  const usdcBalance = await cdpWallet.getBalance("usdc");
  const ethBalance = await cdpWallet.getBalance("eth");
  console.log(`USDC: $${usdcBalance}`);
  console.log(`ETH: ${ethBalance}`);
  console.log("");
  
  // Derive private key from CDP seed using BIP-44
  console.log("Deriving private key from CDP seed...");
  
  const seedHex = walletData.exportData.seed;
  const seedBytes = Buffer.from(seedHex, "hex");
  const hdKey = HDKey.fromMasterSeed(seedBytes);
  const derivedKey = hdKey.derive("m/44'/60'/0'/0/0");
  
  if (!derivedKey.privateKey) {
    throw new Error("Failed to derive private key");
  }
  
  const privateKeyHex = `0x${Buffer.from(derivedKey.privateKey).toString("hex")}` as `0x${string}`;
  
  // Create viem wallet client for Base mainnet
  console.log("Creating viem wallet client for Base...");
  const account = privateKeyToAccount(privateKeyHex);
  
  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(),
  }).extend(publicActions);
  
  console.log(`Derived address: ${account.address}`);
  console.log(`CDP address:     ${walletData.address}`);
  
  if (account.address.toLowerCase() !== walletData.address.toLowerCase()) {
    console.log("⚠️  Address mismatch!");
    return { passed: 0, failed: 0, totalSpent: 0 };
  }
  
  console.log("✅ Address matches! Proceeding with payment tests...");
  console.log("");
  
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
      reqs.filter((r: any) => { try { return BigInt(r.maxAmountRequired) <= BigInt(10 * 1_000_000); } catch { return false; } })
    );
  const x402Fetch = wrapFetchWithPayment(fetch, x402c);
  
  let passed = 0;
  let failed = 0;
  let totalSpent = 0;
  
  for (const service of TEST_SERVICES) {
    const url = `${BASE_URL}${service.endpoint}`;
    console.log(`Testing ${service.name} ($${service.priceUSD})...`);
    
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
        console.log(`  ✅ SUCCESS - Paid $${service.priceUSD}, response in ${responseTime}ms`);
        console.log(`  Data keys: ${Object.keys(data).join(", ")}`);
        passed++;
        totalSpent += service.priceUSD;
      } else {
        console.log(`  ❌ FAILED - Status ${response.status}`);
        console.log(`  Response: ${JSON.stringify(data).slice(0, 300)}`);
        failed++;
      }
    } catch (error: any) {
      console.log(`  ❌ ERROR - ${error.message}`);
      failed++;
    }
    
    await new Promise(r => setTimeout(r, 1500));
  }
  
  // Final balance check
  const finalUsdc = await cdpWallet.getBalance("usdc");
  const finalEth = await cdpWallet.getBalance("eth");
  
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  RESULTS");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  Passed: ${passed}/${TEST_SERVICES.length}`);
  console.log(`  Failed: ${failed}/${TEST_SERVICES.length}`);
  console.log(`  Total spent: $${totalSpent.toFixed(2)}`);
  console.log("");
  console.log(`  Starting USDC: $${usdcBalance}`);
  console.log(`  Ending USDC:   $${finalUsdc}`);
  console.log(`  Starting ETH:  ${ethBalance}`);
  console.log(`  Ending ETH:    ${finalEth}`);
  console.log("═══════════════════════════════════════════════════════════════");
  
  return { passed, failed, totalSpent };
}

runTest()
  .then(({ passed, failed }) => {
    process.exit(failed > 0 ? 1 : 0);
  })
  .catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
