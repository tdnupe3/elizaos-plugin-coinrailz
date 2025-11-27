/**
 * Create CDP Test Wallet for x402 Payment Testing
 */

import { Coinbase, Wallet } from "@coinbase/coinbase-sdk";
import * as fs from "fs";

async function createTestWallet() {
  console.log("Configuring CDP SDK...");
  
  const apiKeyId = process.env.CDP_API_KEY_ID;
  const privateKey = process.env.CDP_PRIVATE_KEY;
  
  if (!apiKeyId || !privateKey) {
    throw new Error("CDP credentials not configured");
  }
  
  Coinbase.configure({
    apiKeyName: apiKeyId,
    privateKey: privateKey,
  });
  
  console.log("Creating new wallet on Base mainnet...");
  const wallet = await Wallet.create({ networkId: "base-mainnet" });
  
  const address = await wallet.getDefaultAddress();
  const walletId = wallet.getId();
  
  // Export wallet data for persistence
  const walletData = wallet.export();
  
  // Create wallets directory if needed
  if (!fs.existsSync("server/wallets")) {
    fs.mkdirSync("server/wallets", { recursive: true });
  }
  
  // Save wallet data to file for later restoration
  const walletInfo = {
    walletId,
    address: address?.getId(),
    network: "base-mainnet",
    createdAt: new Date().toISOString(),
    exportData: walletData,
  };
  
  fs.writeFileSync("server/wallets/x402-test-wallet.json", JSON.stringify(walletInfo, null, 2));
  
  console.log("");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  CDP TEST WALLET CREATED SUCCESSFULLY");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("");
  console.log("  Network:   Base Mainnet (Chain ID: 8453)");
  console.log("  Wallet ID: " + walletId);
  console.log("  Address:   " + address?.getId());
  console.log("");
  console.log("  ┌─────────────────────────────────────────────────────────────┐");
  console.log("  │  SEND USDC TO THIS ADDRESS:                                 │");
  console.log("  │                                                             │");
  console.log("  │  " + address?.getId() + "  │");
  console.log("  │                                                             │");
  console.log("  └─────────────────────────────────────────────────────────────┘");
  console.log("");
  console.log("  ⚠️  IMPORTANT: Send USDC on BASE CHAIN (not Ethereum!)");
  console.log("═══════════════════════════════════════════════════════════════");
  
  return address?.getId();
}

createTestWallet().catch(err => {
  console.error("Error:", err.message);
  process.exit(1);
});
