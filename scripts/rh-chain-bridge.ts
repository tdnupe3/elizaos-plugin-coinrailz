/**
 * Robinhood Chain Bridge Script
 *
 * Uses Across Protocol API calldata to bridge:
 *   1. 3 USDC  (Base) → ~2.99 USDG (Robinhood Chain, 6-dec stablecoin)
 *   2. 0.001 ETH WETH (Base) → ~0.00099 WETH (Robinhood Chain, for gas)
 *
 * Run with:  npx tsx scripts/rh-chain-bridge.ts
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  formatEther,
  formatUnits,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

// ─── Constants ─────────────────────────────────────────────────────────────
const SPOKE_POOL   = '0x09aea4b2242abC8bb4BB78D537A67a245A7bEC64' as const;
const USDC_BASE    = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;
const WETH_BASE    = '0x4200000000000000000000000000000000000006' as const;
const USDG_RH      = '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168' as const;
const WETH_RH      = '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73' as const;
const WALLET       = '0xa4bBE37f9A6Ae2dc36a607B91eB148C0ae163C91' as const;
const ZERO_ADDR    = '0x0000000000000000000000000000000000000000' as const;
const RH_CHAIN_ID  = 4663;
const USDC_AMOUNT  = 3_000_000n;               // 3.00 USDC
const WETH_AMOUNT  = 1_000_000_000_000_000n;   // 0.001 ETH

const ERC20_ABI = [
  { name:'balanceOf', type:'function', stateMutability:'view',
    inputs:[{name:'',type:'address'}], outputs:[{name:'',type:'uint256'}] },
  { name:'allowance', type:'function', stateMutability:'view',
    inputs:[{name:'o',type:'address'},{name:'s',type:'address'}], outputs:[{name:'',type:'uint256'}] },
  { name:'approve', type:'function', stateMutability:'nonpayable',
    inputs:[{name:'s',type:'address'},{name:'a',type:'uint256'}], outputs:[{name:'',type:'bool'}] },
  { name:'deposit', type:'function', stateMutability:'payable',
    inputs:[], outputs:[] },
] as const;

// ─── Helpers ────────────────────────────────────────────────────────────────

async function fetchAcrossCalldata(
  inputToken: string, outputToken: string, inputAmount: bigint
): Promise<{ data: `0x${string}`; value: bigint; outputAmount: bigint; fillTime: number }> {
  // Step 1: get quote
  const qUrl = `https://app.across.to/api/suggested-fees?inputToken=${inputToken}&outputToken=${outputToken}&originChainId=8453&destinationChainId=${RH_CHAIN_ID}&amount=${inputAmount.toString()}`;
  const qRes  = await fetch(qUrl);
  const quote = await qRes.json() as any;
  if (quote.type?.includes('Error')) throw new Error(`Quote failed: ${JSON.stringify(quote)}`);

  const outputAmount = BigInt(quote.outputAmount);

  // Step 2: build tx calldata with the fresh quote data
  const params = new URLSearchParams({
    originChainId:        '8453',
    destinationChainId:   RH_CHAIN_ID.toString(),
    inputToken,
    outputToken,
    inputAmount:          inputAmount.toString(),
    outputAmount:         outputAmount.toString(),
    recipient:            WALLET,
    depositor:            WALLET,
    quoteTimestamp:       quote.timestamp.toString(),
    fillDeadline:         quote.fillDeadline.toString(),
    exclusivityDeadline:  '0',
    exclusiveRelayer:     quote.exclusiveRelayer ?? ZERO_ADDR,
    message:              '0x',
  });

  const txRes  = await fetch(`https://app.across.to/api/build-deposit-tx?${params.toString()}`);
  const txData = await txRes.json() as any;
  if (txData.type?.includes('Error')) throw new Error(`Build-tx failed: ${JSON.stringify(txData)}`);

  return {
    data:         txData.data as `0x${string}`,
    value:        BigInt(txData.value ?? '0'),
    outputAmount,
    fillTime:     quote.estimatedFillTimeSec,
  };
}

async function ensureApproval(
  pub: ReturnType<typeof createPublicClient>,
  wal: ReturnType<typeof createWalletClient>,
  token: `0x${string}`,
  spender: `0x${string}`,
  amount: bigint,
  owner: `0x${string}`,
  label: string
) {
  const allowance = await pub.readContract({
    address: token, abi: ERC20_ABI, functionName: 'allowance', args: [owner, spender]
  }) as bigint;
  if (allowance >= amount) { console.log(`  ✓ ${label} already approved (${allowance})`); return; }
  console.log(`  → Approving ${label}…`);
  const hash = await wal.writeContract({
    address: token, abi: ERC20_ABI, functionName: 'approve',
    args: [spender, BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')]
  });
  console.log(`  Approve tx: ${hash}`);
  await pub.waitForTransactionReceipt({ hash, timeout: 90_000 });
  console.log(`  ✓ ${label} approved`);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const rawKey = process.env.EVM_PRIVATE_KEY;
  if (!rawKey) throw new Error('EVM_PRIVATE_KEY not set');
  const k = (rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`) as `0x${string}`;
  const account = privateKeyToAccount(k);
  console.log('\n🟢 Robinhood Chain Bridge — Across Protocol');
  console.log(`   Wallet: ${account.address}`);

  const pub = createPublicClient({ chain: base, transport: http() });
  const wal = createWalletClient({ account, chain: base, transport: http() });

  // Pre-flight
  const [ethBal, usdcBal, wethBal] = await Promise.all([
    pub.getBalance({ address: account.address }),
    pub.readContract({ address: USDC_BASE, abi: ERC20_ABI, functionName: 'balanceOf', args: [account.address] }) as Promise<bigint>,
    pub.readContract({ address: WETH_BASE, abi: ERC20_ABI, functionName: 'balanceOf', args: [account.address] }) as Promise<bigint>,
  ]);
  console.log(`\n   ETH  on Base: ${formatEther(ethBal)}`);
  console.log(`   USDC on Base: ${formatUnits(usdcBal, 6)}`);
  console.log(`   WETH on Base: ${formatEther(wethBal)}`);

  if (usdcBal < USDC_AMOUNT) throw new Error(`Need ≥3 USDC, have ${formatUnits(usdcBal,6)}`);

  // ═══════════════════════════════════════════════════════════════════════════
  // BRIDGE 1 — 3 USDC (Base) → USDG (Robinhood Chain)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n━━━ Bridge 1: 3 USDC → USDG on Robinhood Chain ━━━');
  await ensureApproval(pub, wal, USDC_BASE, SPOKE_POOL, USDC_AMOUNT, account.address, 'USDC → SpokePool');

  console.log('  Fetching fresh Across quote + calldata…');
  const { data: usdcData, value: usdcValue, outputAmount: usdcOut, fillTime: usdcFill } =
    await fetchAcrossCalldata(USDC_BASE, USDG_RH, USDC_AMOUNT);
  console.log(`  Output: ${formatUnits(usdcOut, 6)} USDG (${usdcFill}s fill)`);

  console.log('  → Sending depositV3…');
  const usdcTx = await wal.sendTransaction({
    to:    SPOKE_POOL,
    data:  usdcData,
    value: usdcValue,
  });
  console.log(`  ✅ Deposit tx (Base):   ${usdcTx}`);
  console.log(`     https://basescan.org/tx/${usdcTx}`);
  await pub.waitForTransactionReceipt({ hash: usdcTx, timeout: 90_000 });
  console.log(`  Mined. Relayer fills on Robinhood Chain in ~${usdcFill}s`);
  console.log(`  RH Chain: https://robinhoodchain.blockscout.com/address/${account.address}`);

  // ═══════════════════════════════════════════════════════════════════════════
  // BRIDGE 2 — 0.001 ETH (Base) → WETH (Robinhood Chain) for gas
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n━━━ Bridge 2: 0.001 ETH → WETH on Robinhood Chain (gas) ━━━');

  // Wrap ETH → WETH if needed
  if (wethBal < WETH_AMOUNT) {
    console.log('  → Wrapping 0.001 ETH → WETH…');
    const wrapHash = await wal.writeContract({
      address: WETH_BASE, abi: ERC20_ABI, functionName: 'deposit', value: WETH_AMOUNT
    });
    console.log(`  Wrap tx: ${wrapHash}`);
    await pub.waitForTransactionReceipt({ hash: wrapHash, timeout: 60_000 });
    console.log('  ✓ Wrapped');
  }

  await ensureApproval(pub, wal, WETH_BASE, SPOKE_POOL, WETH_AMOUNT, account.address, 'WETH → SpokePool');

  console.log('  Fetching fresh Across quote + calldata (WETH→WETH)…');
  const { data: wethData, value: wethValue, outputAmount: wethOut, fillTime: wethFill } =
    await fetchAcrossCalldata(WETH_BASE, WETH_RH, WETH_AMOUNT);
  console.log(`  Output: ${formatEther(wethOut)} WETH (${wethFill}s fill)`);

  console.log('  → Sending depositV3…');
  const wethTx = await wal.sendTransaction({
    to:    SPOKE_POOL,
    data:  wethData,
    value: wethValue,
  });
  console.log(`  ✅ Deposit tx (Base):   ${wethTx}`);
  console.log(`     https://basescan.org/tx/${wethTx}`);
  await pub.waitForTransactionReceipt({ hash: wethTx, timeout: 90_000 });
  console.log(`  Mined. Relayer fills on Robinhood Chain in ~${wethFill}s`);

  // ─── Final summary ────────────────────────────────────────────────────────
  console.log('\n🏁 Done!');
  console.log(`   Wallet: ${account.address}`);
  console.log(`   Robinhood Chain explorer: https://robinhoodchain.blockscout.com/address/${account.address}`);
  console.log(`   Base tx #1 (USDC→USDG): https://basescan.org/tx/${usdcTx}`);
  console.log(`   Base tx #2 (WETH→WETH): https://basescan.org/tx/${wethTx}`);
  console.log('\n   After ~5s the fills appear on Robinhood Chain.');
  console.log('   WETH on RH Chain can be unwrapped to ETH for gas at any WETH DEX or bridge portal.');
}

main().catch(e => { console.error('\n❌ Error:', e.shortMessage ?? e.message ?? e); process.exit(1); });
