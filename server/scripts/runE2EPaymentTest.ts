/**
 * E2E Payment Test using Test Wallet
 * Tests the full 402 -> payment -> service delivery flow
 */

import { Coinbase, Wallet } from "@coinbase/coinbase-sdk";
import * as fs from "fs";

const TEST_SERVICE_URL = "https://coinrailz.com/x402/gas-price-oracle";
const USDC_CONTRACT = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

async function runPaymentTest(): Promise<void> {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  x402 END-TO-END PAYMENT TEST");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("");

  // Load test wallet
  const walletPath = "server/wallets/x402-test-wallet.json";
  if (!fs.existsSync(walletPath)) {
    throw new Error("Test wallet not found. Run createTestWallet.ts first.");
  }

  const walletInfo = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
  console.log(`📍 Test Wallet: ${walletInfo.address}`);
  console.log(`🌐 Network: ${walletInfo.network}`);
  console.log("");

  // Configure CDP
  const apiKeyId = process.env.CDP_API_KEY_ID;
  const privateKey = process.env.CDP_API_KEY_SECRET;

  if (!apiKeyId || !privateKey) {
    throw new Error("CDP credentials not configured (CDP_API_KEY_ID, CDP_API_KEY_SECRET)");
  }

  Coinbase.configure({
    apiKeyName: apiKeyId,
    privateKey: privateKey,
  });

  // Restore wallet using CDP fetch method
  console.log("🔄 Fetching test wallet from CDP...");
  let wallet: Wallet;
  try {
    wallet = await Wallet.fetch(walletInfo.walletId);
    console.log(`✅ Wallet fetched from CDP`);
  } catch (fetchError: any) {
    console.log(`   Fetch failed, trying import...`);
    wallet = await Wallet.import(walletInfo.exportData);
    console.log(`✅ Wallet imported from seed`);
  }
  const address = await wallet.getDefaultAddress();
  console.log(`   Address: ${address?.getId()}`);
  console.log("");

  // Check balances
  console.log("💰 Checking balances...");
  const ethBalance = await wallet.getBalance("eth");
  const usdcBalance = await wallet.getBalance("usdc");
  console.log(`   ETH:  ${ethBalance}`);
  console.log(`   USDC: ${usdcBalance}`);
  console.log("");

  if (parseFloat(usdcBalance.toString()) < 0.10) {
    console.log("❌ Insufficient USDC balance. Need at least $0.10 for test.");
    console.log("   Send USDC to: " + walletInfo.address);
    return;
  }

  if (parseFloat(ethBalance.toString()) < 0.0001) {
    console.log("❌ Insufficient ETH for gas. Need at least 0.0001 ETH.");
    console.log("   Send ETH to: " + walletInfo.address);
    return;
  }

  // Step 1: Get 402 challenge
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  STEP 1: Get 402 Challenge");
  console.log("═══════════════════════════════════════════════════════════════");

  const challengeResponse = await fetch(TEST_SERVICE_URL);
  console.log(`   Status: ${challengeResponse.status}`);

  if (challengeResponse.status !== 402) {
    console.log("❌ Expected 402 response, got: " + challengeResponse.status);
    return;
  }

  const challengeData = await challengeResponse.json();
  console.log(`   x402Version: ${challengeData.x402Version}`);
  console.log(`   Facilitator: ${challengeData.facilitatorUrl}`);

  const offer = challengeData.x402?.offers?.[0];
  if (!offer) {
    console.log("❌ No payment offer found in 402 response");
    console.log(JSON.stringify(challengeData, null, 2));
    return;
  }

  const priceInUsdc = parseFloat(offer.amount) / 1e6;
  console.log(`   Price: $${priceInUsdc} USDC`);
  console.log(`   PayTo: ${offer.payTo}`);
  console.log("");
  console.log("✅ 402 Challenge received successfully!");
  console.log("");

  // Step 2: Make payment via CDP facilitator
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  STEP 2: Execute Payment via Coinbase CDP Facilitator");
  console.log("═══════════════════════════════════════════════════════════════");

  try {
    // Create USDC transfer to the facilitator/payTo address
    console.log(`   Sending ${priceInUsdc} USDC to ${offer.payTo}...`);
    
    const transfer = await wallet.createTransfer({
      amount: priceInUsdc,
      assetId: "usdc",
      destination: offer.payTo,
    });

    await transfer.wait();
    
    const txHash = transfer.getTransactionHash();
    console.log(`   ✅ Transfer complete!`);
    console.log(`   TX Hash: ${txHash}`);
    console.log(`   View: https://basescan.org/tx/${txHash}`);
    console.log("");

    // Step 3: Retry request with payment proof
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("  STEP 3: Retry Request with Payment Header");
    console.log("═══════════════════════════════════════════════════════════════");

    // The x402 protocol expects a payment header with the transaction proof
    // For CDP facilitator, we need to construct the proper header
    const paymentHeader = JSON.stringify({
      x402Version: 2,
      scheme: "exact",
      network: "base-mainnet",
      payload: {
        signature: "", // CDP handles this
        authorization: {
          from: walletInfo.address,
          to: offer.payTo,
          value: offer.amount,
          validAfter: "0",
          validBefore: Math.floor(Date.now() / 1000 + 3600).toString(),
          nonce: txHash,
        },
      },
    });

    const serviceResponse = await fetch(TEST_SERVICE_URL, {
      headers: {
        "X-PAYMENT": Buffer.from(paymentHeader).toString("base64"),
        "X-PAYMENT-TX": txHash || "",
      },
    });

    console.log(`   Status: ${serviceResponse.status}`);
    
    if (serviceResponse.status === 200) {
      const serviceData = await serviceResponse.json();
      console.log("");
      console.log("✅ SERVICE DELIVERY SUCCESSFUL!");
      console.log("═══════════════════════════════════════════════════════════════");
      console.log(JSON.stringify(serviceData, null, 2).substring(0, 500));
    } else {
      const errorText = await serviceResponse.text();
      console.log(`   Response: ${errorText.substring(0, 300)}`);
      console.log("");
      console.log("⚠️  Payment made but service not delivered via header.");
      console.log("   This may require facilitator-based verification.");
    }

  } catch (error: any) {
    console.log(`❌ Payment failed: ${error.message}`);
  }

  console.log("");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  TEST COMPLETE");
  console.log("═══════════════════════════════════════════════════════════════");
}

runPaymentTest().catch((err) => {
  console.error("Test failed:", err.message);
  process.exit(1);
});
