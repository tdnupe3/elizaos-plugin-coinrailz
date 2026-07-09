import { createPublicClient, createWalletClient, http, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

const SPOKE = '0x09aea4b2242abC8bb4BB78D537A67a245A7bEC64' as const;
const WETH_BASE = '0x4200000000000000000000000000000000000006' as const;
const WETH_RH   = '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73' as const;
const AMOUNT = 1_000_000_000_000_000n; // 0.001 ETH

async function main() {
  const k = (process.env.EVM_PRIVATE_KEY!.startsWith('0x') ? process.env.EVM_PRIVATE_KEY! : `0x${process.env.EVM_PRIVATE_KEY!}`) as `0x${string}`;
  const account = privateKeyToAccount(k);
  const pub = createPublicClient({ chain: base, transport: http() });
  const wal = createWalletClient({ account, chain: base, transport: http() });

  const ethBal = await pub.getBalance({ address: account.address });
  console.log(`ETH on Base: ${formatEther(ethBal)}`);
  
  // Get fresh quote using WETH→WETH
  const q = await fetch(`https://app.across.to/api/suggested-fees?inputToken=${WETH_BASE}&outputToken=${WETH_RH}&originChainId=8453&destinationChainId=4663&amount=${AMOUNT}`).then(r=>r.json()) as any;
  if (q.type?.includes('Error')) { console.log('Quote failed:', q); return; }
  console.log(`Output: ${Number(q.outputAmount)/1e18} ETH, fill: ${q.estimatedFillTimeSec}s`);

  // Build calldata (WETH as inputToken)
  const params = new URLSearchParams({
    originChainId:'8453', destinationChainId:'4663',
    inputToken: WETH_BASE, outputToken: WETH_RH,
    inputAmount: AMOUNT.toString(), outputAmount: q.outputAmount,
    recipient: account.address, depositor: account.address,
    quoteTimestamp: q.timestamp.toString(), fillDeadline: q.fillDeadline.toString(),
    exclusivityDeadline:'0', exclusiveRelayer: q.exclusiveRelayer ?? '0x0000000000000000000000000000000000000000',
    message:'0x',
  });
  const tx = await fetch(`https://app.across.to/api/build-deposit-tx?${params}`).then(r=>r.json()) as any;
  if (tx.type?.includes('Error')) { console.log('Build failed:', tx); return; }

  // Send with msg.value = AMOUNT (native ETH → SpokePool wraps it to WETH internally)
  console.log('Sending WETH depositV3 with msg.value (wrap-and-deposit pattern)…');
  try {
    const hash = await wal.sendTransaction({
      to: SPOKE, data: tx.data as `0x${string}`, value: AMOUNT
    });
    console.log(`✅ TX: ${hash}`);
    await pub.waitForTransactionReceipt({ hash, timeout: 60_000 });
    console.log('✅ Mined!');
  } catch(e: any) {
    console.log('❌', e.shortMessage ?? e.message?.split('\n')[0]);
  }
}
main().catch(e=>{ console.error(e.message); process.exit(1); });
