/**
 * USDT Payment Flow Test Script
 * 
 * Tests the complete x402 USDT payment verification:
 * 1. Creates secondary test wallet if needed
 * 2. Sends USDT from platform wallet → test wallet
 * 3. Sends small ETH for gas to test wallet
 * 4. Sends USDT back from test wallet → platform wallet
 * 5. Uses that tx hash to verify x402 payment flow
 */

import { ethers } from "ethers";
import { CoinbaseCDPService } from "../services/coinbaseCDPService";

// Base mainnet configuration
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || "";
const BASE_RPC = `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
const provider = new ethers.JsonRpcProvider(BASE_RPC);

// Token addresses on Base
const USDT_BASE = "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2";
const PLATFORM_WALLET = "0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91";

// ERC-20 ABI for transfers
const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)"
];

async function testUsdtPaymentFlow() {
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  USDT PAYMENT FLOW TEST");
  console.log("═══════════════════════════════════════════════════════════════\n");

  try {
    // Step 1: Get platform wallet signer
    console.log("Step 1: Getting platform wallet signer...");
    const platformSigner = await CoinbaseCDPService.getPlatformSigner('base');
    console.log(`  Platform wallet: ${platformSigner.address}`);
    
    // Check if derived address matches expected platform wallet
    if (platformSigner.address.toLowerCase() !== PLATFORM_WALLET.toLowerCase()) {
      console.log(`\n  ⚠️  WARNING: Derived signer (${platformSigner.address}) differs from configured PLATFORM_WALLET (${PLATFORM_WALLET})`);
      console.log(`  This may indicate a key derivation mismatch.`);
    }

    // Step 2: Check USDT balance
    console.log("\nStep 2: Checking USDT balance...");
    const usdtContract = new ethers.Contract(USDT_BASE, ERC20_ABI, provider);
    const decimals = await usdtContract.decimals();
    const symbol = await usdtContract.symbol();
    const balance = await usdtContract.balanceOf(PLATFORM_WALLET);
    const balanceFormatted = ethers.formatUnits(balance, decimals);
    console.log(`  ${symbol} Balance: ${balanceFormatted}`);

    // Step 3: Check ETH balance for gas
    console.log("\nStep 3: Checking ETH balance for gas...");
    const ethBalance = await provider.getBalance(platformSigner.address);
    const ethFormatted = ethers.formatEther(ethBalance);
    console.log(`  ETH Balance: ${ethFormatted}`);

    if (parseFloat(balanceFormatted) < 0.30) {
      console.log("\n  ❌ Insufficient USDT balance for test (need at least $0.30)");
      return;
    }

    // Step 4: Create or load test wallet
    console.log("\nStep 4: Creating test wallet...");
    const testWallet = ethers.Wallet.createRandom().connect(provider);
    console.log(`  Test wallet: ${testWallet.address}`);

    // Step 5: Send small ETH to test wallet for gas
    console.log("\nStep 5: Sending ETH to test wallet for gas...");
    const gasAmount = ethers.parseEther("0.0002"); // ~$0.50 worth of ETH
    
    if (ethBalance < gasAmount * 2n) {
      console.log("  ❌ Insufficient ETH for gas funding");
      return;
    }

    const ethTx = await platformSigner.sendTransaction({
      to: testWallet.address,
      value: gasAmount,
    });
    console.log(`  ETH tx sent: ${ethTx.hash}`);
    await ethTx.wait();
    console.log("  ✅ ETH funded to test wallet");

    // Step 6: Send USDT to test wallet
    console.log("\nStep 6: Sending USDT to test wallet...");
    const usdtWithSigner = new ethers.Contract(USDT_BASE, ERC20_ABI, platformSigner);
    const testAmount = ethers.parseUnits("0.30", decimals); // $0.30 USDT
    
    const usdtOutTx = await usdtWithSigner.transfer(testWallet.address, testAmount);
    console.log(`  USDT out tx: ${usdtOutTx.hash}`);
    await usdtOutTx.wait();
    console.log("  ✅ USDT sent to test wallet");

    // Step 7: Send USDT back to platform wallet
    console.log("\nStep 7: Sending USDT back to platform wallet...");
    const usdtWithTestWallet = new ethers.Contract(USDT_BASE, ERC20_ABI, testWallet);
    const returnAmount = ethers.parseUnits("0.25", decimals); // $0.25 USDT
    
    const usdtReturnTx = await usdtWithTestWallet.transfer(PLATFORM_WALLET, returnAmount);
    console.log(`  USDT return tx: ${usdtReturnTx.hash}`);
    const receipt = await usdtReturnTx.wait();
    console.log("  ✅ USDT sent back to platform wallet");

    // Step 8: Test x402 payment verification
    console.log("\nStep 8: Testing x402 payment verification...");
    console.log(`\n  ┌─────────────────────────────────────────────────────────────┐`);
    console.log(`  │  TEST THIS TX HASH IN X-PAYMENT HEADER:                     │`);
    console.log(`  │                                                             │`);
    console.log(`  │  ${usdtReturnTx.hash}  │`);
    console.log(`  │                                                             │`);
    console.log(`  └─────────────────────────────────────────────────────────────┘`);
    
    console.log("\n  Test with curl:");
    console.log(`  curl -X GET "https://coinrailz.com/x402/service/ping" \\`);
    console.log(`       -H "X-PAYMENT: ${usdtReturnTx.hash}"`);

    // Step 9: Verify transaction on-chain details
    console.log("\n\nStep 9: Verifying transaction on-chain...");
    if (receipt) {
      console.log(`  Block: ${receipt.blockNumber}`);
      console.log(`  Status: ${receipt.status === 1 ? "✅ Success" : "❌ Failed"}`);
      console.log(`  From: ${testWallet.address}`);
      console.log(`  To: ${PLATFORM_WALLET}`);
      console.log(`  Amount: 0.25 USDT`);
    }

    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("  TEST COMPLETE - Use the tx hash above to verify payment flow");
    console.log("═══════════════════════════════════════════════════════════════\n");

    return usdtReturnTx.hash;

  } catch (error: any) {
    console.error("\n❌ Test failed:", error.message);
    if (error.code) console.error("  Error code:", error.code);
    throw error;
  }
}

// Run the test
testUsdtPaymentFlow()
  .then((txHash) => {
    if (txHash) {
      console.log(`\n✅ Test completed successfully. TX Hash: ${txHash}`);
    }
    process.exit(0);
  })
  .catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
  });
