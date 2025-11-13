/**
 * REAL x402 Payment Execution
 * Executes actual on-chain USDC payment to x402 service
 */

import { ethers } from 'ethers';
import axios from 'axios';

const PLATFORM_WALLET = '0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91';
const USDC_CONTRACT = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const BASE_URL = 'https://coinrailz.com';

const USDC_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)'
];

async function main() {
  console.log('🚀 EXECUTING REAL x402 PAYMENT\n');
  
  // Step 1: Discover service
  console.log('📡 Step 1: Service Discovery (HTTP 402)');
  const discoveryResponse = await axios.post(
    `${BASE_URL}/x402/gas-price-oracle`,
    {},
    { validateStatus: (status) => status === 402 }
  );
  
  const paymentReq = discoveryResponse.data.accepts[0];
  const priceUSDC = parseInt(paymentReq.maxAmountRequired) / 1000000;
  
  console.log(`   Status: HTTP ${discoveryResponse.status}`);
  console.log(`   Service: Gas Price Oracle`);
  console.log(`   Price: $${priceUSDC} USDC`);
  console.log(`   Payment Address: ${paymentReq.payTo}`);
  console.log(`   Network: ${paymentReq.network}\n`);

  // Step 2: Setup wallet
  console.log('💼 Step 2: Initializing Payment Wallet');
  const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
  const wallet = new ethers.Wallet(process.argv[2], provider);
  const usdcContract = new ethers.Contract(USDC_CONTRACT, USDC_ABI, wallet);
  
  console.log(`   Payer Address: ${wallet.address}`);
  
  // Check balance
  const balance = await usdcContract.balanceOf(wallet.address);
  const balanceFormatted = ethers.formatUnits(balance, 6);
  console.log(`   USDC Balance: ${balanceFormatted}`);
  
  if (parseFloat(balanceFormatted) < priceUSDC) {
    console.log(`\n❌ Insufficient balance! Need ${priceUSDC} USDC`);
    return;
  }
  console.log(`   ✅ Sufficient funds\n`);

  // Step 3: Send payment
  console.log('💸 Step 3: Sending USDC Payment');
  const amountWei = ethers.parseUnits(priceUSDC.toString(), 6);
  console.log(`   Amount: ${priceUSDC} USDC (${amountWei} wei)`);
  console.log(`   To: ${paymentReq.payTo}`);
  console.log(`   Sending transaction...`);
  
  const tx = await usdcContract.transfer(paymentReq.payTo, amountWei);
  console.log(`   ✅ Transaction Hash: ${tx.hash}`);
  console.log(`   Waiting for confirmation...`);
  
  const receipt = await tx.wait();
  console.log(`   ✅ Confirmed in block ${receipt.blockNumber}\n`);

  // Step 4: Claim service with payment proof
  console.log('🔐 Step 4: Claiming Service (HTTP 200)');
  
  const paymentProof = {
    network: 'base',
    txHash: tx.hash,
    amount: Math.floor(priceUSDC * 1000000),
    asset: USDC_CONTRACT,
    from: wallet.address,
    to: paymentReq.payTo
  };
  
  console.log(`   Submitting payment proof...`);
  
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

  console.log(`   ✅ Service Response: HTTP ${serviceResponse.status}\n`);
  
  // Step 5: Display results
  console.log('📊 SERVICE DELIVERY COMPLETE!\n');
  console.log('Response Data:');
  console.log(JSON.stringify(serviceResponse.data, null, 2));
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ REAL x402 PAYMENT SUCCESSFUL!');
  console.log('='.repeat(60));
  console.log(`💰 Platform Revenue: +$${priceUSDC} USDC`);
  console.log(`🔍 Transaction: https://basescan.org/tx/${tx.hash}`);
  console.log(`📍 Platform Wallet: ${PLATFORM_WALLET}`);
  console.log('='.repeat(60));
}

main().catch((error) => {
  console.error('\n❌ Payment Failed:', error.message);
  process.exit(1);
});
