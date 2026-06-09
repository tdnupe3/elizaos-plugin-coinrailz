import { createWalletClient, createPublicClient, http, parseAbi, formatUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

const RPC     = 'https://base-sepolia-rpc.publicnode.com';
const rawKey  = process.env.EVM_PRIVATE_KEY!;
const key     = (rawKey.startsWith('0x') ? rawKey : '0x' + rawKey) as `0x${string}`;
const account = privateKeyToAccount(key);

const wallet = createWalletClient({ account, chain: baseSepolia, transport: http(RPC) });
const pub    = createPublicClient({ chain: baseSepolia, transport: http(RPC) });

const WETH   = '0x4200000000000000000000000000000000000006' as const;
const USDC   = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as const;
const ROUTER = '0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4' as const;
const VAULT  = '0xedb63d0a32282649dd4fb98dbfc22bbbe1516164' as const;

const ERC20  = parseAbi(['function balanceOf(address) view returns (uint256)', 'function approve(address,uint256) returns (bool)']);
const WETHAB = parseAbi(['function deposit() payable', 'function approve(address,uint256) returns (bool)']);
const RABI   = parseAbi(['function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96) params) payable returns (uint256)']);
const VABI   = parseAbi([
  'function deposit(uint256,address) returns (uint256)',
  'function totalAssets() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function activeProtocol() view returns (uint8)',
  'function rebalance()',
  'function getAllAPYs() view returns (uint256,uint256,uint256)',
  'function previewDeposit(uint256) view returns (uint256)',
]);

async function step(label: string, fn: () => Promise<any>) {
  process.stdout.write(`[${label}] `);
  try { const r = await fn(); console.log('✅', r !== undefined ? String(r) : 'ok'); return r; }
  catch(e: any) { console.log('❌', (e.shortMessage || e.message || '').slice(0, 300)); return null; }
}

async function main() {
  const ethBal  = await pub.getBalance({ address: account.address });
  const usdcBal = await pub.readContract({ address: USDC, abi: ERC20, functionName: 'balanceOf', args: [account.address] });
  console.log('Wallet:', account.address);
  console.log('ETH:', formatUnits(ethBal, 18), '| USDC:', formatUnits(usdcBal, 6));

  // ── Swap ETH → USDC if needed ──────────────────────────────────────────
  if (usdcBal < 5_000_000n) {
    const swapAmt = 5_000_000_000_000_000n; // 0.005 ETH
    await step('Wrap 0.005 ETH → WETH', async () => {
      const h = await wallet.writeContract({ address: WETH, abi: WETHAB, functionName: 'deposit', value: swapAmt });
      return (await pub.waitForTransactionReceipt({ hash: h, timeout: 60_000 })).status;
    });
    await step('Approve WETH for router', async () => {
      const h = await wallet.writeContract({ address: WETH, abi: WETHAB, functionName: 'approve', args: [ROUTER, swapAmt] });
      return (await pub.waitForTransactionReceipt({ hash: h, timeout: 60_000 })).status;
    });
    await step('Swap WETH → USDC (pool fee=500)', async () => {
      const h = await wallet.writeContract({
        address: ROUTER, abi: RABI, functionName: 'exactInputSingle',
        args: [{ tokenIn: WETH, tokenOut: USDC, fee: 500, recipient: account.address,
                 amountIn: swapAmt, amountOutMinimum: 0n, sqrtPriceLimitX96: 0n }],
      });
      await pub.waitForTransactionReceipt({ hash: h, timeout: 60_000 });
      const nb = await pub.readContract({ address: USDC, abi: ERC20, functionName: 'balanceOf', args: [account.address] });
      return `USDC now: ${formatUnits(nb, 6)}`;
    });
  }

  // ── Vault state ────────────────────────────────────────────────────────
  await step('activeProtocol()', () => pub.readContract({ address: VAULT, abi: VABI, functionName: 'activeProtocol' }));
  await step('getAllAPYs()', async () => {
    const a = await pub.readContract({ address: VAULT, abi: VABI, functionName: 'getAllAPYs' });
    return `Aave=${a[0]}bps  Compound=${a[1]}bps  Morpho=${a[2]}bps`;
  });
  await step('previewDeposit(1 USDC)', () =>
    pub.readContract({ address: VAULT, abi: VABI, functionName: 'previewDeposit', args: [1_000_000n] }));

  // ── Try rebalance (auto-picks best APY) ───────────────────────────────
  await step('rebalance()', async () => {
    const h = await wallet.writeContract({ address: VAULT, abi: VABI, functionName: 'rebalance' });
    return (await pub.waitForTransactionReceipt({ hash: h, timeout: 60_000 })).status;
  });

  // ── Deposit ────────────────────────────────────────────────────────────
  const freshUSDC = await pub.readContract({ address: USDC, abi: ERC20, functionName: 'balanceOf', args: [account.address] });
  console.log('USDC available:', formatUnits(freshUSDC, 6));

  if (freshUSDC >= 1_000_000n) {
    await step('Approve 1 USDC for vault', async () => {
      const h = await wallet.writeContract({ address: USDC, abi: ERC20, functionName: 'approve', args: [VAULT, 1_000_000n] });
      return (await pub.waitForTransactionReceipt({ hash: h, timeout: 60_000 })).status;
    });
    await step('vault.deposit(1 USDC)', async () => {
      const h = await wallet.writeContract({ address: VAULT, abi: VABI, functionName: 'deposit', args: [1_000_000n, account.address] });
      const rx = await pub.waitForTransactionReceipt({ hash: h, timeout: 60_000 });
      return `status=${rx.status}  gasUsed=${rx.gasUsed}`;
    });
    await step('vault.totalAssets()', () =>
      pub.readContract({ address: VAULT, abi: VABI, functionName: 'totalAssets' }));
    await step('vault.balanceOf(wallet)', () =>
      pub.readContract({ address: VAULT, abi: VABI, functionName: 'balanceOf', args: [account.address] }));
  }
  console.log('\nDone.');
}

main().catch(console.error);
