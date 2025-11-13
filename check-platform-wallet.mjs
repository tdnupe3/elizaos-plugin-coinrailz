import { createPublicClient, http, parseAbi } from 'viem';
import { base } from 'viem/chains';

const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const PLATFORM_WALLET = '0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91';

console.log('=== PLATFORM WALLET STATUS (Base Mainnet) ===\n');
console.log(`Wallet Address: ${PLATFORM_WALLET}\n`);

const client = createPublicClient({
  chain: base,
  transport: http()
});

try {
  // Check ETH balance
  const ethBalance = await client.getBalance({ address: PLATFORM_WALLET });
  const ethAmount = Number(ethBalance) / 1e18;
  console.log(`💰 ETH Balance: ${ethAmount.toFixed(6)} ETH`);

  // Check USDC balance
  const usdcBalance = await client.readContract({
    address: USDC_BASE,
    abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
    functionName: 'balanceOf',
    args: [PLATFORM_WALLET]
  });

  const usdcAmount = Number(usdcBalance) / 1e6;
  console.log(`💵 USDC Balance: ${usdcAmount.toFixed(2)} USDC`);
  
  console.log('\n📊 Payment Receiving Status:');
  if (usdcAmount > 0) {
    console.log(`   ✅ Platform wallet has received payments: $${usdcAmount.toFixed(2)} USDC`);
  } else {
    console.log('   ℹ️  No USDC payments received yet (balance: $0.00)');
  }
  
  if (ethAmount > 0) {
    console.log(`   ✅ Has ETH for operations: ${ethAmount.toFixed(6)} ETH`);
  } else {
    console.log('   ⚠️  No ETH for gas fees');
  }
  
  console.log('\n💡 To Test Payment Processing:');
  console.log('   Since we cannot create a test wallet from CDP_PRIVATE_KEY,');
  console.log('   we need to either:');
  console.log('   1. Use Coinbase Wallet browser extension to pay manually');
  console.log('   2. Deploy to production where AI agents can pay');
  console.log('   3. Ask user to test payment with their own wallet');
  
} catch (error) {
  console.error('❌ Error checking wallet:', error.message);
}

