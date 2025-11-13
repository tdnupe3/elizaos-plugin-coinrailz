/**
 * REAL x402 Payment Test - Uses actual CDP wallet to pay for service
 */

import { Coinbase, Wallet } from '@coinbase/coinbase-sdk';
import axios from 'axios';

const PLATFORM_WALLET = '0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91';
const USDC_CONTRACT = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const BASE_URL = 'https://coinrailz.com';

async function main() {
  console.log('🚀 Starting REAL x402 payment test...\n');
  
  // Initialize CDP
  Coinbase.configure({
    apiKeyName: process.env.CDP_API_KEY_ID!,
    privateKey: process.env.CDP_PRIVATE_KEY!,
  });
  console.log('✅ CDP SDK initialized\n');

  // Step 1: Discover service (HTTP 402)
  console.log('📡 Step 1: Discovering gas-price-oracle service...');
  const response = await axios.post(`${BASE_URL}/x402/gas-price-oracle`, {}, {
    validateStatus: (status) => status === 402
  });
  
  const paymentReq = response.data.accepts[0];
  const priceUSDC = parseInt(paymentReq.maxAmountRequired) / 1000000;
  
  console.log(`   Status: HTTP ${response.status} (Payment Required)`);
  console.log(`   Price: $${priceUSDC} USDC`);
  console.log(`   Pay To: ${paymentReq.payTo}`);
  console.log(`   Network: ${paymentReq.network}\n`);

  // Step 2: Create or load wallet
  console.log('💼 Step 2: Loading CDP wallet...');
  let wallet: Wallet;
  
  if (process.env.CDP_WALLET_ID) {
    // Load existing wallet by ID
    wallet = await Wallet.fetch(process.env.CDP_WALLET_ID);
    console.log(`   ✅ Loaded wallet from CDP_WALLET_ID\n`);
  } else {
    // Create new wallet
    wallet = await Wallet.create({ networkId: 'base-mainnet' });
    const walletData = wallet.export();
    console.log(`   ⚠️  Created NEW wallet - save these to Replit Secrets:`);
    console.log(`   CDP_WALLET_ID=${wallet.getId()}`);
    console.log(`   CDP_WALLET_SECRET=${walletData.seed}\n`);
  }

  const address = await wallet.getDefaultAddress();
  console.log(`   Wallet Address: ${address.getId()}\n`);

  // Step 3: Check balance
  console.log('💰 Step 3: Checking USDC balance...');
  const balances = await wallet.listBalances();
  const balanceArray = Array.isArray(balances) ? balances : Object.values(balances);
  const usdcBalance = balanceArray.find((b: any) => 
    b.asset?.toLowerCase().includes('usdc') || b.assetId?.toLowerCase().includes('usdc')
  );
  
  const amount = usdcBalance ? parseFloat(usdcBalance.amount || '0') : 0;
  console.log(`   Balance: ${amount.toFixed(6)} USDC`);
  
  if (amount < priceUSDC) {
    console.log(`\n❌ Insufficient balance! Need ${priceUSDC} USDC, have ${amount} USDC`);
    console.log(`\n💡 Fund this wallet with USDC on Base:`);
    console.log(`   Address: ${address.getId()}`);
    console.log(`   Network: Base (ChainID 8453)`);
    console.log(`   Bridge: https://bridge.base.org`);
    return;
  }
  console.log(`   ✅ Sufficient balance\n`);

  // Step 4: Make payment
  console.log('💸 Step 4: Sending USDC payment...');
  const transfer = await wallet.createTransfer({
    amount: priceUSDC,
    assetId: 'usdc',
    destination: paymentReq.payTo,
    gasless: false
  });
  
  console.log(`   Transfer created: ${transfer.getId()}`);
  console.log(`   Waiting for confirmation...`);
  
  await transfer.wait();
  
  console.log(`   ✅ Payment confirmed!\n`);

  // Step 5: Call service with payment proof
  console.log('🔐 Step 5: Calling service with payment proof...');
  const txHash = transfer.getTransactionHash();
  console.log(`   Transaction Hash: ${txHash}`);
  
  const serviceResponse = await axios.post(
    `${BASE_URL}/x402/gas-price-oracle`,
    {},
    {
      headers: {
        'X-PAYMENT': Buffer.from(JSON.stringify({
          network: 'base',
          txHash: txHash,
          amount: Math.floor(priceUSDC * 1000000),
          asset: USDC_CONTRACT,
          from: address.getId(),
          to: paymentReq.payTo
        })).toString('base64')
      }
    }
  );

  console.log(`   Status: HTTP ${serviceResponse.status}`);
  console.log(`   Response:`);
  console.log(JSON.stringify(serviceResponse.data, null, 2));
  
  console.log('\n✅ REAL x402 PAYMENT COMPLETE!');
  console.log(`\n🔍 View on BaseScan: https://basescan.org/tx/${txHash}`);
}

main().catch(console.error);
