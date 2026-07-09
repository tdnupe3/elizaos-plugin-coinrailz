/**
 * Bridge 0.001 ETH from Base → Robinhood Chain (for gas)
 * Uses Across Protocol native-ETH route (inputToken = 0x0000...0000, msg.value = 0.001 ETH)
 */

import { createPublicClient, createWalletClient, http, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

const SPOKE_POOL  = '0x09aea4b2242abC8bb4BB78D537A67a245A7bEC64' as const;
const NATIVE_ETH  = '0x0000000000000000000000000000000000000000' as const;
const WALLET      = '0xa4bBE37f9A6Ae2dc36a607B91eB148C0ae163C91' as const;
const RH_CHAIN_ID = 4663;
const AMOUNT      = 1_000_000_000_000_000n; // 0.001 ETH

async function main() {
  const rawKey = process.env.EVM_PRIVATE_KEY!;
  const k = (rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`) as `0x${string}`;
  const account = privateKeyToAccount(k);

  const pub = createPublicClient({ chain: base, transport: http() });
  const wal = createWalletClient({ account, chain: base, transport: http() });

  const ethBal = await pub.getBalance({ address: account.address });
  console.log(`\n🔵 ETH Bridge (native) — Across Protocol`);
  console.log(`   Wallet: ${account.address}`);
  console.log(`   ETH balance on Base: ${formatEther(ethBal)}`);

  if (ethBal < AMOUNT + 500_000_000_000_000n) {
    throw new Error(`Insufficient ETH: ${formatEther(ethBal)} — need >0.0015`);
  }

  // Step 1: Get fresh quote
  console.log('\n   Fetching Across quote for native ETH → RH Chain…');
  const qRes = await fetch(
    `https://app.across.to/api/suggested-fees?inputToken=${NATIVE_ETH}&outputToken=${NATIVE_ETH}&originChainId=8453&destinationChainId=${RH_CHAIN_ID}&amount=${AMOUNT.toString()}`
  );
  const quote = await qRes.json() as any;
  if (quote.type?.includes('Error')) throw new Error(`Quote: ${JSON.stringify(quote)}`);
  console.log(`   Output: ${Number(quote.outputAmount)/1e18} ETH on RH Chain`);
  console.log(`   Fill time: ${quote.estimatedFillTimeSec}s`);
  console.log(`   Fee: ${Number(quote.totalRelayFee.total)/1e18} ETH`);

  // Step 2: Build calldata
  const params = new URLSearchParams({
    originChainId:        '8453',
    destinationChainId:   RH_CHAIN_ID.toString(),
    inputToken:           NATIVE_ETH,
    outputToken:          NATIVE_ETH,
    inputAmount:          AMOUNT.toString(),
    outputAmount:         quote.outputAmount.toString(),
    recipient:            WALLET,
    depositor:            WALLET,
    quoteTimestamp:       quote.timestamp.toString(),
    fillDeadline:         quote.fillDeadline.toString(),
    exclusivityDeadline:  '0',
    exclusiveRelayer:     quote.exclusiveRelayer ?? NATIVE_ETH,
    message:              '0x',
  });

  console.log('\n   Building calldata…');
  const txRes = await fetch(`https://app.across.to/api/build-deposit-tx?${params}`);
  const txData = await txRes.json() as any;
  if (txData.type?.includes('Error')) throw new Error(`Build-tx: ${JSON.stringify(txData)}`);
  console.log(`   API value: ${txData.value} (will override with ${AMOUNT} for native ETH)`);

  // Step 3: Send with msg.value = AMOUNT (native ETH deposit requires this)
  console.log('\n   Sending native ETH depositV3…');
  const hash = await wal.sendTransaction({
    to:    SPOKE_POOL,
    data:  txData.data as `0x${string}`,
    value: AMOUNT,   // OVERRIDE: native ETH route requires msg.value
  });

  console.log(`\n   ✅ ETH deposit tx (Base): ${hash}`);
  console.log(`      https://basescan.org/tx/${hash}`);
  await pub.waitForTransactionReceipt({ hash, timeout: 90_000 });
  console.log(`   Mined! ETH fills on Robinhood Chain in ~${quote.estimatedFillTimeSec}s`);
  console.log(`   Check: https://robinhoodchain.blockscout.com/address/${account.address}`);
}

main().catch(e => { console.error('\n❌', e.shortMessage ?? e.message ?? e); process.exit(1); });
