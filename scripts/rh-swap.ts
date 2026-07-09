/**
 * On-chain transactions on Robinhood Chain (chainId 4663)
 * Tx 1: Approve USDG for Uniswap V3 SwapRouter02
 * Tx 2: exactInputSingle — 1 USDG → WETH (0.3% pool)
 */
import { createPublicClient, createWalletClient, http, formatEther, formatUnits, encodeAbiParameters, encodeFunctionData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const RH_CHAIN = {
  id: 4663, name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.mainnet.chain.robinhood.com'] } },
  blockExplorers: { default: { name: 'Blockscout', url: 'https://robinhoodchain.blockscout.com' } },
} as const;

const SWAP_ROUTER = '0xCaf681a66D020601342297493863E78C959E5cb2' as const;
const USDG        = '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168' as const;
const WETH        = '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73' as const;
const FEE_3000    = 3000; // 0.3%

const MAX_UINT256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
const SWAP_AMOUNT = 1_000_000n; // 1.00 USDG (6 decimals)

const ERC20_ABI = [
  { name:'balanceOf', type:'function', stateMutability:'view', inputs:[{name:'',type:'address'}], outputs:[{name:'',type:'uint256'}] },
  { name:'allowance', type:'function', stateMutability:'view', inputs:[{name:'o',type:'address'},{name:'s',type:'address'}], outputs:[{name:'',type:'uint256'}] },
  { name:'approve',   type:'function', stateMutability:'nonpayable', inputs:[{name:'s',type:'address'},{name:'a',type:'uint256'}], outputs:[{name:'',type:'bool'}] },
] as const;

const SWAP_ROUTER_ABI = [
  {
    name: 'exactInputSingle',
    type: 'function',
    stateMutability: 'payable',
    inputs: [{
      name: 'params', type: 'tuple',
      components: [
        { name: 'tokenIn',            type: 'address' },
        { name: 'tokenOut',           type: 'address' },
        { name: 'fee',                type: 'uint24'  },
        { name: 'recipient',          type: 'address' },
        { name: 'amountIn',           type: 'uint256' },
        { name: 'amountOutMinimum',   type: 'uint256' },
        { name: 'sqrtPriceLimitX96',  type: 'uint160' },
      ],
    }],
    outputs: [{ name: 'amountOut', type: 'uint256' }],
  },
] as const;

async function main() {
  const rawKey = process.env.EVM_PRIVATE_KEY!;
  const k = (rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`) as `0x${string}`;
  const account = privateKeyToAccount(k);

  const pub = createPublicClient({ chain: RH_CHAIN, transport: http() });
  const wal = createWalletClient({ account, chain: RH_CHAIN, transport: http() });

  const [ethBal, usdgBal, wethBal, gasPrice] = await Promise.all([
    pub.getBalance({ address: account.address }),
    pub.readContract({ address: USDG, abi: ERC20_ABI, functionName: 'balanceOf', args: [account.address] }) as Promise<bigint>,
    pub.readContract({ address: WETH, abi: ERC20_ABI, functionName: 'balanceOf', args: [account.address] }) as Promise<bigint>,
    pub.getGasPrice(),
  ]);

  console.log('\n🟢 Robinhood Chain — On-chain Transactions');
  console.log(`   Wallet:    ${account.address}`);
  console.log(`   ETH:       ${formatEther(ethBal)}`);
  console.log(`   USDG:      ${formatUnits(usdgBal, 6)}`);
  console.log(`   WETH:      ${formatEther(wethBal)}`);
  console.log(`   gasPrice:  ${Number(gasPrice)/1e9} gwei`);

  if (usdgBal < SWAP_AMOUNT) throw new Error(`Need ≥1 USDG, have ${formatUnits(usdgBal,6)}`);

  // ─── Tx 1: Approve USDG for SwapRouter ────────────────────────────────────
  console.log('\n━━━ Tx 1: Approve USDG for Uniswap V3 SwapRouter ━━━');
  const allowance = await pub.readContract({
    address: USDG, abi: ERC20_ABI, functionName: 'allowance',
    args: [account.address, SWAP_ROUTER],
  }) as bigint;

  if (allowance >= SWAP_AMOUNT) {
    console.log(`   ✓ Already approved (${formatUnits(allowance,6)} USDG)`);
  } else {
    console.log('   Sending approve(SwapRouter, MAX)…');
    const approveTx = await wal.writeContract({
      address: USDG, abi: ERC20_ABI, functionName: 'approve',
      args: [SWAP_ROUTER, MAX_UINT256],
    });
    console.log(`   ✅ Tx 1 (approve): ${approveTx}`);
    console.log(`      https://robinhoodchain.blockscout.com/tx/${approveTx}`);
    const receipt1 = await pub.waitForTransactionReceipt({ hash: approveTx, timeout: 30_000 });
    console.log(`   Mined in block ${receipt1.blockNumber}`);
  }

  // ─── Tx 2: Swap 1 USDG → WETH on V3 ──────────────────────────────────────
  console.log('\n━━━ Tx 2: Swap 1 USDG → WETH (Uniswap V3, 0.3% pool) ━━━');
  console.log('   Sending exactInputSingle…');

  const swapTx = await wal.writeContract({
    address: SWAP_ROUTER,
    abi: SWAP_ROUTER_ABI,
    functionName: 'exactInputSingle',
    args: [{
      tokenIn:           USDG,
      tokenOut:          WETH,
      fee:               FEE_3000,
      recipient:         account.address,
      amountIn:          SWAP_AMOUNT,
      amountOutMinimum:  0n,
      sqrtPriceLimitX96: 0n,
    }],
  });

  console.log(`   ✅ Tx 2 (swap): ${swapTx}`);
  console.log(`      https://robinhoodchain.blockscout.com/tx/${swapTx}`);
  const receipt2 = await pub.waitForTransactionReceipt({ hash: swapTx, timeout: 30_000 });
  console.log(`   Mined in block ${receipt2.blockNumber}  status: ${receipt2.status}`);

  // ─── Post-swap balances ────────────────────────────────────────────────────
  const [usdgAfter, wethAfter] = await Promise.all([
    pub.readContract({ address: USDG, abi: ERC20_ABI, functionName: 'balanceOf', args: [account.address] }) as Promise<bigint>,
    pub.readContract({ address: WETH, abi: ERC20_ABI, functionName: 'balanceOf', args: [account.address] }) as Promise<bigint>,
  ]);

  console.log('\n   Post-swap balances:');
  console.log(`   USDG:  ${formatUnits(usdgBal,6)} → ${formatUnits(usdgAfter,6)} (spent ${formatUnits(usdgBal-usdgAfter,6)})`);
  console.log(`   WETH:  ${formatEther(wethBal)} → ${formatEther(wethAfter)} (received ${formatEther(wethAfter-wethBal)})`);
  console.log(`\n   Explorer: https://robinhoodchain.blockscout.com/address/${account.address}`);
}

main().catch(e => { console.error('\n❌', e.shortMessage ?? e.message ?? e); process.exit(1); });
