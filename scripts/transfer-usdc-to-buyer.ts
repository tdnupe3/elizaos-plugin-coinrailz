/**
 * Transfer USDC from platform wallet to buyer test wallet
 * Platform: 0xa4bBE37f9A6Ae2dc36a607B91eB148C0ae163C91 (EVM_PRIVATE_KEY)
 * Buyer:    0x5837A864C03912ea14a5609968F73E75B9d42a7C (X402_BUYER_PRIVATE_KEY)
 */
import 'dotenv/config';
import { createWalletClient, createPublicClient, http, parseUnits, encodeFunctionData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`;
const BUYER_WALLET = '0x5837A864C03912ea14a5609968F73E75B9d42a7C' as `0x${string}`;
const PLATFORM_WALLET = '0xa4bBE37f9A6Ae2dc36a607B91eB148C0ae163C91' as `0x${string}`;

const ERC20_ABI = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }]
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }]
  }
] as const;

async function main() {
  const rawKey = process.env.EVM_PRIVATE_KEY;
  if (!rawKey) throw new Error('EVM_PRIVATE_KEY not set');

  const privateKey = rawKey.startsWith('0x') ? rawKey as `0x${string}` : `0x${rawKey}` as `0x${string}`;
  const account = privateKeyToAccount(privateKey);
  console.log(`✅ Platform wallet: ${account.address}`);

  if (account.address.toLowerCase() !== PLATFORM_WALLET.toLowerCase()) {
    throw new Error(`❌ Key mismatch! Expected ${PLATFORM_WALLET}, got ${account.address}`);
  }

  const publicClient = createPublicClient({ chain: base, transport: http('https://mainnet.base.org') });
  const walletClient = createWalletClient({ account, chain: base, transport: http('https://mainnet.base.org') });

  // Check balances
  const platformBalance = await publicClient.readContract({
    address: USDC_BASE, abi: ERC20_ABI, functionName: 'balanceOf', args: [PLATFORM_WALLET]
  });
  const buyerBalance = await publicClient.readContract({
    address: USDC_BASE, abi: ERC20_ABI, functionName: 'balanceOf', args: [BUYER_WALLET]
  });

  const platformUsdc = Number(platformBalance) / 1e6;
  const buyerUsdc = Number(buyerBalance) / 1e6;

  console.log(`\n💰 Platform wallet USDC: $${platformUsdc.toFixed(6)}`);
  console.log(`💰 Buyer wallet USDC:    $${buyerUsdc.toFixed(6)}`);

  // We need ~$3.00 for the remaining services (8 services × ~$0.25-0.35 avg)
  // Transfer $4.00 USDC to give margin
  const TRANSFER_AMOUNT = parseUnits('4', 6); // 4 USDC
  const transferUsd = Number(TRANSFER_AMOUNT) / 1e6;

  if (platformUsdc < transferUsd) {
    throw new Error(`❌ Insufficient platform balance. Have $${platformUsdc.toFixed(2)}, need $${transferUsd}`);
  }

  console.log(`\n🚀 Transferring $${transferUsd.toFixed(2)} USDC to buyer wallet...`);

  const hash = await walletClient.writeContract({
    address: USDC_BASE,
    abi: ERC20_ABI,
    functionName: 'transfer',
    args: [BUYER_WALLET, TRANSFER_AMOUNT]
  });

  console.log(`📤 TX submitted: ${hash}`);
  console.log(`🔗 https://basescan.org/tx/${hash}`);

  console.log('⏳ Waiting for confirmation...');
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`✅ CONFIRMED! Block: ${receipt.blockNumber}, Status: ${receipt.status}`);

  // Final balances
  const finalPlatform = await publicClient.readContract({
    address: USDC_BASE, abi: ERC20_ABI, functionName: 'balanceOf', args: [PLATFORM_WALLET]
  });
  const finalBuyer = await publicClient.readContract({
    address: USDC_BASE, abi: ERC20_ABI, functionName: 'balanceOf', args: [BUYER_WALLET]
  });

  console.log(`\n✅ Transfer complete!`);
  console.log(`   Platform: $${(Number(finalPlatform)/1e6).toFixed(6)} USDC`);
  console.log(`   Buyer:    $${(Number(finalBuyer)/1e6).toFixed(6)} USDC`);
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
