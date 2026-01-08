/**
 * Test Payment Flow Script
 * Sends a real USDC payment and verifies the x402 payment flow works correctly
 * 
 * Usage: npx tsx server/scripts/testPaymentFlow.ts
 */

import { createWalletClient, createPublicClient, http, parseAbi, parseUnits, formatUnits } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// USDC on Base
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const PLATFORM_WALLET = '0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91';

// ERC20 ABI for transfer
const ERC20_ABI = parseAbi([
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)'
]);

async function main() {
  console.log('🧪 Testing Payment Flow...\n');

  // Check for private key
  const privateKey = process.env.EVM_PRIVATE_KEY;
  if (!privateKey) {
    console.error('❌ EVM_PRIVATE_KEY not set');
    process.exit(1);
  }

  try {
    // Create account from private key
    const account = privateKeyToAccount(privateKey.startsWith('0x') ? privateKey as `0x${string}` : `0x${privateKey}` as `0x${string}`);
    console.log(`📍 Test wallet: ${account.address}`);

    // Create clients
    const publicClient = createPublicClient({
      chain: base,
      transport: http('https://mainnet.base.org')
    });

    const walletClient = createWalletClient({
      account,
      chain: base,
      transport: http('https://mainnet.base.org')
    });

    // Check USDC balance
    const balance = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [account.address]
    }) as bigint;

    const balanceFormatted = formatUnits(balance, 6);
    console.log(`💰 USDC Balance: $${balanceFormatted}`);

    if (balance < parseUnits('0.10', 6)) {
      console.error('❌ Insufficient USDC balance (need at least $0.10 for gas-price-oracle test)');
      console.log('\nTo fund this wallet, send USDC on Base to:');
      console.log(`   ${account.address}`);
      process.exit(1);
    }

    // Send $0.10 USDC to platform wallet (gas-price-oracle price)
    const testAmount = parseUnits('0.10', 6); // $0.10 = 100000 micro USDC
    console.log(`\n📤 Sending $0.10 USDC to platform wallet...`);
    console.log(`   From: ${account.address}`);
    console.log(`   To: ${PLATFORM_WALLET}`);
    console.log(`   Amount: $0.10 USDC`);

    const hash = await walletClient.writeContract({
      address: USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [PLATFORM_WALLET, testAmount]
    });

    console.log(`\n✅ Transaction sent!`);
    console.log(`   TX Hash: ${hash}`);

    // Wait for confirmation
    console.log(`\n⏳ Waiting for confirmation...`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`✅ Confirmed in block ${receipt.blockNumber}`);
    console.log(`   Status: ${receipt.status === 'success' ? 'SUCCESS' : 'FAILED'}`);

    if (receipt.status !== 'success') {
      console.error('❌ Transaction failed on-chain');
      process.exit(1);
    }

    // Now test the x402 endpoint with this tx hash
    console.log(`\n🔐 Testing x402 payment verification...`);
    console.log(`   Endpoint: /x402/gas-price-oracle`);
    console.log(`   X-PAYMENT: ${hash}`);

    const response = await fetch('http://localhost:5000/x402/gas-price-oracle', {
      method: 'GET',
      headers: {
        'X-PAYMENT': hash
      }
    });

    const responseData = await response.json();
    
    console.log(`\n📊 Response:`);
    console.log(`   Status: ${response.status}`);
    console.log(`   Body: ${JSON.stringify(responseData, null, 2)}`);

    if (response.status === 200) {
      console.log('\n🎉 PAYMENT FLOW TEST PASSED!');
      console.log('✅ Payment verification working correctly');
      console.log('✅ Service delivery working correctly');
      
      // Check if we got real data
      if (responseData.ethereum || responseData.base || responseData.success) {
        console.log('✅ Real service data returned');
      }
      
      console.log(`\n📊 Service Response Summary:`);
      console.log(`   Chains covered: ${Object.keys(responseData).filter(k => k !== 'timestamp').length}`);
      console.log(`   Timestamp: ${responseData.timestamp || 'N/A'}`);
    } else if (response.status === 402) {
      console.error('\n❌ PAYMENT VERIFICATION FAILED');
      console.error('   The payment was not recognized');
      console.error('   Response:', responseData);
    } else {
      console.log(`\n⚠️ Unexpected response status: ${response.status}`);
      console.log('   Response:', responseData);
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.cause) {
      console.error('   Cause:', error.cause);
    }
    process.exit(1);
  }
}

main();
