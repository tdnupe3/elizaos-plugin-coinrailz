/**
 * Fund test wallet and execute REAL x402 payment
 * 
 * This script:
 * 1. Uses platform CDP credentials to access existing funded wallet
 * 2. Makes a real USDC payment to x402 service
 * 3. Verifies service delivery
 */

import { Coinbase, Wallet } from '@coinbase/coinbase-sdk';
import { ethers } from 'ethers';
import axios from 'axios';

const PLATFORM_WALLET = '0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91';
const USDC_CONTRACT = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const BASE_URL = 'https://coinrailz.com';

// Test wallet created earlier
const TEST_WALLET_ID = 'dbfa2340-8812-45d0-80a4-6fcde74ed5bd';
const TEST_WALLET_ADDRESS = '0x225131480d261b2c448BE2189F954C6a5215839D';

async function main() {
  console.log('🚀 Starting REAL x402 Payment Flow...\n');
  
  // Initialize CDP
  Coinbase.configure({
    apiKeyName: process.env.CDP_API_KEY_ID!,
    privateKey: process.env.CDP_PRIVATE_KEY!,
  });
  console.log('✅ CDP SDK initialized\n');

  // Step 1: Discover service
  console.log('📡 Step 1: Discovering gas-price-oracle service...');
  const response = await axios.post(`${BASE_URL}/x402/gas-price-oracle`, {}, {
    validateStatus: (status) => status === 402
  });
  
  const paymentReq = response.data.accepts[0];
  const priceUSDC = parseInt(paymentReq.maxAmountRequired) / 1000000;
  
  console.log(`   ✅ HTTP ${response.status} - Payment Required`);
  console.log(`   Price: $${priceUSDC} USDC`);
  console.log(`   Pay To: ${paymentReq.payTo}\n`);

  // Step 2: Use ethers to send USDC from platform wallet
  console.log('💸 Step 2: Sending payment from platform wallet...');
  console.log(`   Using platform wallet private key from CDP_PRIVATE_KEY`);
  
  // Get the CDP private key (this is the wallet that controls the platform address)
  const privateKey = process.env.CDP_PRIVATE_KEY!;
  const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
  const wallet = new ethers.Wallet(privateKey, provider);
  
  console.log(`   Sender: ${wallet.address}`);
  console.log(`   Recipient: ${paymentReq.payTo}`);
  
  // USDC contract on Base
  const usdcAbi = [
    'function transfer(address to, uint256 amount) returns (bool)',
    'function balanceOf(address owner) view returns (uint256)',
    'function decimals() view returns (uint8)'
  ];
  
  const usdcContract = new ethers.Contract(USDC_CONTRACT, usdcAbi, wallet);
  
  // Check balance
  const balance = await usdcContract.balanceOf(wallet.address);
  const balanceFormatted = ethers.formatUnits(balance, 6);
  console.log(`   Current balance: ${balanceFormatted} USDC`);
  
  if (parseFloat(balanceFormatted) < priceUSDC) {
    console.log(`\n❌ Insufficient balance! Need ${priceUSDC} USDC, have ${balanceFormatted} USDC`);
    return;
  }
  
  // Send payment
  const amountWei = ethers.parseUnits(priceUSDC.toString(), 6);
  console.log(`   Sending ${priceUSDC} USDC...`);
  
  const tx = await usdcContract.transfer(paymentReq.payTo, amountWei);
  console.log(`   Transaction sent: ${tx.hash}`);
  console.log(`   Waiting for confirmation...`);
  
  const receipt = await tx.wait();
  console.log(`   ✅ Confirmed in block ${receipt.blockNumber}\n`);

  // Step 3: Call service with payment proof
  console.log('🔐 Step 3: Calling service with payment proof...');
  
  const paymentProof = {
    network: 'base',
    txHash: tx.hash,
    amount: Math.floor(priceUSDC * 1000000),
    asset: USDC_CONTRACT,
    from: wallet.address,
    to: paymentReq.payTo
  };
  
  const serviceResponse = await axios.post(
    `${BASE_URL}/x402/gas-price-oracle`,
    {},
    {
      headers: {
        'X-PAYMENT': Buffer.from(JSON.stringify(paymentProof)).toString('base64'),
        'Content-Type': 'application/json'
      }
    }
  );

  console.log(`   ✅ HTTP ${serviceResponse.status} - Service Delivered!`);
  console.log(`\n📊 Service Response:`);
  console.log(JSON.stringify(serviceResponse.data, null, 2));
  
  console.log('\n✅ REAL x402 PAYMENT COMPLETE!');
  console.log(`\n🔍 View transaction: https://basescan.org/tx/${tx.hash}`);
  console.log(`💰 Platform wallet received: $${priceUSDC} USDC`);
}

main().catch((error) => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
