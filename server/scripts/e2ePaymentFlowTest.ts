/**
 * END-TO-END x402 V2 PAYMENT FLOW TEST
 * 
 * Tests the complete payment flow that agents must complete:
 * 1. GET request → 402 challenge with V2 format
 * 2. Parse 402 response for payment requirements
 * 3. Submit payment via x402-fetch (EIP-3009)
 * 4. Receive service response
 * 
 * This verifies agents CAN complete the V2 payment flow post-migration.
 */

import { Coinbase, Wallet } from "@coinbase/coinbase-sdk";
import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { HDKey } from "@scure/bip32";
import { createWalletClient, createPublicClient, http, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import * as fs from "fs";

const PRODUCTION_URL = "https://coinrailz.com";

interface TestResult {
  step: string;
  success: boolean;
  details: string;
  latencyMs?: number;
  data?: any;
}

async function runE2ETest(): Promise<void> {
  const results: TestResult[] = [];
  const startTime = Date.now();
  
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║   x402 V2 END-TO-END PAYMENT FLOW TEST                       ║");
  console.log("║   Testing: coinrailz.com (PRODUCTION)                        ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1: Verify 402 Challenge Response Format (V2 Compliance)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("📡 STEP 1: Testing 402 Challenge Response...\n");
  
  try {
    const challengeStart = Date.now();
    const response = await fetch(`${PRODUCTION_URL}/x402/ping`);
    const challengeLatency = Date.now() - challengeStart;
    
    if (response.status !== 402) {
      results.push({
        step: "402 Challenge",
        success: false,
        details: `Expected 402, got ${response.status}`,
        latencyMs: challengeLatency
      });
      throw new Error(`Invalid response status: ${response.status}`);
    }
    
    const challengeBody = await response.json();
    
    // Verify V2 format requirements
    const v2Checks = {
      hasX402Version: challengeBody.x402Version === 2,
      hasAccepts: Array.isArray(challengeBody.accepts) && challengeBody.accepts.length > 0,
      hasCorrectNetwork: challengeBody.accepts?.[0]?.network === "eip155:8453",
      hasCorrectScheme: challengeBody.accepts?.[0]?.scheme === "exact",
      hasFacilitatorUrl: challengeBody.facilitatorUrl === "https://x402.org/facilitator",
      hasPayTo: !!challengeBody.accepts?.[0]?.payTo,
      hasAsset: challengeBody.accepts?.[0]?.asset === "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      hasMaxAmount: !!challengeBody.accepts?.[0]?.maxAmountRequired,
      isDiscoverable: challengeBody.accepts?.[0]?.discoverable === true
    };
    
    const allChecksPass = Object.values(v2Checks).every(v => v === true);
    
    console.log("  ✅ Status: 402 Payment Required");
    console.log("  V2 Format Checks:");
    Object.entries(v2Checks).forEach(([key, value]) => {
      console.log(`    ${value ? '✅' : '❌'} ${key}: ${value}`);
    });
    
    results.push({
      step: "402 Challenge",
      success: allChecksPass,
      details: allChecksPass ? "V2 format verified" : `Failed checks: ${Object.entries(v2Checks).filter(([,v]) => !v).map(([k]) => k).join(", ")}`,
      latencyMs: challengeLatency,
      data: {
        network: challengeBody.accepts?.[0]?.network,
        amount: challengeBody.accepts?.[0]?.maxAmountRequired,
        amountUSD: challengeBody.accepts?.[0]?.maxAmountRequiredUSD,
        payTo: challengeBody.accepts?.[0]?.payTo,
        facilitatorUrl: challengeBody.facilitatorUrl
      }
    });
    
    console.log(`\n  Amount Required: ${challengeBody.accepts?.[0]?.maxAmountRequiredUSD} (${challengeBody.accepts?.[0]?.maxAmountRequired} micro USDC)`);
    console.log(`  Pay To: ${challengeBody.accepts?.[0]?.payTo}`);
    console.log(`  Facilitator: ${challengeBody.facilitatorUrl}`);
    console.log(`  Latency: ${challengeLatency}ms\n`);
    
  } catch (error: any) {
    console.log(`  ❌ ERROR: ${error.message}\n`);
    results.push({
      step: "402 Challenge",
      success: false,
      details: error.message
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2: Initialize CDP Wallet and Check Balance
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("🔑 STEP 2: Initializing CDP Wallet...\n");
  
  let cdpWallet: Wallet | null = null;
  let walletClient: any = null;
  let startBalance = 0;
  
  try {
    // Check for required environment variables
    if (!process.env.CDP_API_KEY_ID || !process.env.CDP_PRIVATE_KEY) {
      throw new Error("CDP_API_KEY_ID and CDP_PRIVATE_KEY must be set");
    }
    
    const walletData = JSON.parse(fs.readFileSync("server/wallets/x402-test-wallet.json", "utf-8"));
    console.log(`  Wallet Address: ${walletData.address}`);
    console.log(`  Network: ${walletData.network}`);
    
    Coinbase.configure({
      apiKeyName: process.env.CDP_API_KEY_ID,
      privateKey: process.env.CDP_PRIVATE_KEY,
    });
    
    console.log("  Restoring CDP wallet...");
    cdpWallet = await Wallet.import(walletData.exportData);
    
    const usdcBalance = await cdpWallet.getBalance("usdc");
    const ethBalance = await cdpWallet.getBalance("eth");
    startBalance = parseFloat(usdcBalance.toString());
    
    console.log(`  ✅ USDC Balance: $${startBalance.toFixed(4)}`);
    console.log(`  ✅ ETH Balance: ${parseFloat(ethBalance.toString()).toFixed(6)} ETH`);
    
    // Derive private key for x402-fetch
    const seedHex = walletData.exportData.seed;
    const seedBytes = Buffer.from(seedHex, "hex");
    const hdKey = HDKey.fromMasterSeed(seedBytes);
    const derivedKey = hdKey.derive("m/44'/60'/0'/0/0");
    
    if (!derivedKey.privateKey) throw new Error("Failed to derive private key");
    
    const privateKeyHex = `0x${Buffer.from(derivedKey.privateKey).toString("hex")}` as `0x${string}`;
    const account = privateKeyToAccount(privateKeyHex);
    
    if (account.address.toLowerCase() !== walletData.address.toLowerCase()) {
      throw new Error(`Address mismatch: derived ${account.address}, expected ${walletData.address}`);
    }
    
    walletClient = createWalletClient({
      account,
      chain: base,
      transport: http(),
    }).extend(publicActions);
    
    console.log(`  ✅ Wallet client initialized\n`);
    
    results.push({
      step: "Wallet Init",
      success: true,
      details: `Balance: $${startBalance.toFixed(4)} USDC`,
      data: { address: walletData.address, usdcBalance: startBalance }
    });
    
  } catch (error: any) {
    console.log(`  ❌ ERROR: ${error.message}\n`);
    results.push({
      step: "Wallet Init",
      success: false,
      details: error.message
    });
    printResults(results, startTime);
    return;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 3: Execute Real Payment via x402-fetch
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("💳 STEP 3: Executing x402 Payment Flow...\n");
  
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
  
  // Test services - start with cheapest (ping at $0.25)
  const testServices = [
    { name: "ping", endpoint: "/x402/ping", priceUSD: 0.25, payload: { message: "E2E test " + new Date().toISOString() } },
  ];
  
  for (const service of testServices) {
    console.log(`  Testing: ${service.name} ($${service.priceUSD})`);
    
    try {
      const paymentStart = Date.now();
      
      const response = await x402Fetch(`${PRODUCTION_URL}${service.endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(service.payload),
      });
      
      const paymentLatency = Date.now() - paymentStart;
      const responseText = await response.text();
      let responseData: any;
      
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = { rawResponse: responseText.slice(0, 500) };
      }
      
      if (response.status === 200) {
        console.log(`  ✅ SUCCESS - Status 200 (${paymentLatency}ms)`);
        console.log(`  Response: ${JSON.stringify(responseData).slice(0, 200)}`);
        
        results.push({
          step: `Payment: ${service.name}`,
          success: true,
          details: `Payment succeeded - ${paymentLatency}ms`,
          latencyMs: paymentLatency,
          data: responseData
        });
      } else if (response.status === 402) {
        console.log(`  ⚠️  STILL 402 - Payment not processed`);
        console.log(`  Response: ${JSON.stringify(responseData).slice(0, 300)}`);
        
        results.push({
          step: `Payment: ${service.name}`,
          success: false,
          details: `Got 402 after payment attempt - x402-fetch may not be completing payment`,
          latencyMs: paymentLatency,
          data: responseData
        });
      } else {
        console.log(`  ❌ UNEXPECTED - Status ${response.status}`);
        console.log(`  Response: ${JSON.stringify(responseData).slice(0, 300)}`);
        
        results.push({
          step: `Payment: ${service.name}`,
          success: false,
          details: `Unexpected status ${response.status}`,
          latencyMs: paymentLatency,
          data: responseData
        });
      }
      
    } catch (error: any) {
      console.log(`  ❌ ERROR: ${error.message}`);
      console.log(`  Stack: ${error.stack?.slice(0, 200)}`);
      
      results.push({
        step: `Payment: ${service.name}`,
        success: false,
        details: error.message
      });
    }
    
    console.log("");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 4: Verify Balance Change and Payment Intent
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("📊 STEP 4: Verifying Payment Telemetry...\n");
  
  try {
    if (cdpWallet) {
      const endBalance = parseFloat((await cdpWallet.getBalance("usdc")).toString());
      const balanceChange = startBalance - endBalance;
      
      console.log(`  Starting Balance: $${startBalance.toFixed(4)}`);
      console.log(`  Ending Balance:   $${endBalance.toFixed(4)}`);
      console.log(`  Change:           $${balanceChange.toFixed(4)}`);
      
      results.push({
        step: "Balance Verification",
        success: balanceChange > 0,
        details: balanceChange > 0 
          ? `$${balanceChange.toFixed(4)} spent` 
          : "No balance change detected",
        data: { startBalance, endBalance, change: balanceChange }
      });
    }
  } catch (error: any) {
    results.push({
      step: "Balance Verification",
      success: false,
      details: error.message
    });
  }

  // Print final results
  printResults(results, startTime);
}

function printResults(results: TestResult[], startTime: number): void {
  const totalDuration = Date.now() - startTime;
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║   TEST RESULTS SUMMARY                                       ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");
  
  results.forEach(result => {
    const icon = result.success ? "✅" : "❌";
    console.log(`  ${icon} ${result.step}`);
    console.log(`     ${result.details}`);
    if (result.latencyMs) {
      console.log(`     Latency: ${result.latencyMs}ms`);
    }
    console.log("");
  });
  
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  Total: ${passed} passed, ${failed} failed`);
  console.log(`  Duration: ${(totalDuration / 1000).toFixed(2)}s`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  
  if (failed === 0) {
    console.log("🎉 ALL TESTS PASSED - x402 V2 payment flow is WORKING!");
    console.log("   Agents CAN complete payments on coinrailz.com\n");
  } else {
    console.log("⚠️  SOME TESTS FAILED - Investigate payment flow issues\n");
    
    // Provide actionable insights
    const failedSteps = results.filter(r => !r.success);
    failedSteps.forEach(step => {
      console.log(`   ISSUE: ${step.step}`);
      console.log(`   DETAILS: ${step.details}`);
      if (step.data) {
        console.log(`   DATA: ${JSON.stringify(step.data).slice(0, 200)}`);
      }
      console.log("");
    });
  }
}

// Run the test
runE2ETest().catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
});
