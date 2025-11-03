import { createPublicClient, http, parseAbi } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const PLATFORM_WALLET = '0x4dB56acDA064eab99BbC9F2AD1021Cd5d126C321';

console.log('=== WALLET BALANCE CHECK ===\n');

// Check if we have CDP private key
const testPrivateKey = process.env.CDP_PRIVATE_KEY;

if (!testPrivateKey) {
  console.log('❌ No CDP_PRIVATE_KEY found - cannot create test wallet');
  console.log('\n📊 Checking platform wallet instead:', PLATFORM_WALLET);
  
  const client = createPublicClient({
    chain: base,
    transport: http()
  });

  const ethBalance = await client.getBalance({ address: PLATFORM_WALLET });
  console.log(`   ETH Balance: ${(Number(ethBalance) / 1e18).toFixed(6)} ETH`);

  const usdcBalance = await client.readContract({
    address: USDC_BASE,
    abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
    functionName: 'balanceOf',
    args: [PLATFORM_WALLET]
  });

  console.log(`   USDC Balance: ${(Number(usdcBalance) / 1e6).toFixed(2)} USDC`);
  
  console.log('\n💡 To test payments, you would need to:');
  console.log('   1. Create a separate test wallet with USDC');
  console.log('   2. Or fund this wallet with USDC on Base mainnet');
  
  process.exit(0);
}

const account = privateKeyToAccount(testPrivateKey);
console.log(`📧 Test Wallet: ${account.address}\n`);

const client = createPublicClient({
  chain: base,
  transport: http()
});

// Check ETH balance
const ethBalance = await client.getBalance({ address: account.address });
const ethAmount = Number(ethBalance) / 1e18;
console.log(`💰 ETH Balance: ${ethAmount.toFixed(6)} ETH`);

// Check USDC balance
const usdcBalance = await client.readContract({
  address: USDC_BASE,
  abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
  functionName: 'balanceOf',
  args: [account.address]
});

const usdcAmount = Number(usdcBalance) / 1e6;
console.log(`💵 USDC Balance: ${usdcAmount.toFixed(2)} USDC`);

console.log('\n📊 Payment Test Readiness:');

if (usdcAmount >= 0.10) {
  console.log('   ✅ Sufficient USDC to test cheapest service ($0.10)');
} else if (usdcAmount > 0) {
  console.log(`   ⚠️  Low USDC balance - need at least $0.10 for testing`);
  console.log(`   📌 Current balance only covers: $${usdcAmount.toFixed(2)}`);
} else {
  console.log('   ❌ Zero USDC balance - cannot make payments!');
}

if (ethAmount > 0) {
  console.log('   ✅ Has ETH for gas fees');
} else {
  console.log('   ❌ Zero ETH balance - cannot pay gas!');
}

if (usdcAmount >= 0.10 && ethAmount > 0) {
  console.log('\n🎯 READY TO TEST PAYMENTS! ✅');
} else {
  console.log('\n⚠️  CANNOT TEST: Need USDC + ETH on Base mainnet');
  console.log('\n💡 Alternative: Check if platform wallet has funds to receive test payments');
  
  console.log(`\n📊 Platform Wallet: ${PLATFORM_WALLET}`);
  const platformEth = await client.getBalance({ address: PLATFORM_WALLET });
  const platformUsdc = await client.readContract({
    address: USDC_BASE,
    abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
    functionName: 'balanceOf',
    args: [PLATFORM_WALLET]
  });
  
  console.log(`   ETH: ${(Number(platformEth) / 1e18).toFixed(6)} ETH`);
  console.log(`   USDC: ${(Number(platformUsdc) / 1e6).toFixed(2)} USDC`);
}

