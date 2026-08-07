/**
 * vltUSDC Zap Withdraw Builder — USDC-only exit (3-tx)
 *
 * Converts vltUSDC shares entirely to USDC. No VLT remains in the agent's wallet.
 *
 * NOTE: The ZapHelper (0x348A57b1dc6E3dCAa645DE6e4E864924B410525D) only has
 * zapDeposit; it does not have a zapRedeem function. This service achieves the
 * same USDC-only exit goal through 3 standard on-chain transactions:
 *
 *   1. vault.redeem(shares, recipient)
 *      → Burns vltUSDC shares; recipient receives VLT + USDC directly.
 *
 *   2. VLT.approve(uniswapV2Router, previewVltOut)
 *      → Grants the V2 Router permission to spend the exact VLT amount.
 *
 *   3. v2Router.swapExactTokensForTokens(previewVltOut, minUsdcFromSwap, [VLT, WETH, USDC], recipient, deadline)
 *      → Two-hop V2 swap: VLT → WETH (VLT/WETH pair) → USDC (WETH/USDC pair).
 *         amountOutMin = quotedUsdcFromSwap × (1 − 2% slippage), enforced on-chain.
 *
 * After step 3 the recipient holds only USDC (vault USDC + swap USDC).
 *
 * VLT + USDC amounts from step 1: vault.previewRedeem(shares)
 *   — exact on-chain preview, no off-chain approximation.
 *   Fails closed if previewRedeem is unavailable.
 *
 * Swap quote (step 3): two-hop V2 getReserves math
 *   VLT/WETH pair  (0x966053Ca4fca049173eb1F27E4cb168CCb794534): VLT → WETH
 *   WETH/USDC pair (0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc): WETH → USDC
 *   Fails closed if reserves are unavailable.
 *
 * Addresses (Ethereum mainnet):
 *   Vault / vltUSDC ERC-20  0xee8d4c5c768AadCd3517Aa8C908De300305D0A7f
 *   VLT token               0x6b785a0322126826d8226d77e173d75DAfb84d11
 *   USDC                    0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
 *   WETH                    0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
 *   VLT/WETH V2 pair        0x966053Ca4fca049173eb1F27E4cb168CCb794534
 *   WETH/USDC V2 pair       0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc
 *   Uniswap V2 Router02     0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D
 *
 * Security:
 *   - vault.previewRedeem is MANDATORY — exact on-chain; no off-chain/external source.
 *   - V2 getReserves quotes are MANDATORY — fails closed if unavailable.
 *   - minUsdcFromSwap is encoded on-chain (step 3); stale or zero values are rejected.
 *   - VLT approval = exact previewVltOut: if actual vltOut > preview (rare, sub-block timing),
 *     excess VLT stays with recipient (not lost); step 3 swaps only previewVltOut.
 */

import { ethers } from 'ethers';

// ── Addresses (all Ethereum mainnet) ────────────────────────────────────────

const VAULT           = '0xee8d4c5c768AadCd3517Aa8C908De300305D0A7f'; // vault + vltUSDC ERC-20
const VLT_TOKEN       = '0x6b785a0322126826d8226d77e173d75DAfb84d11';
const USDC_ETH        = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const WETH            = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const VLT_WETH_PAIR   = '0x966053Ca4fca049173eb1F27E4cb168CCb794534'; // V2: VLT=token0, WETH=token1
const WETH_USDC_PAIR  = '0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc'; // V2: USDC=token0, WETH=token1
const V2_ROUTER       = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'; // Uniswap V2 Router02
const CHAIN_ID        = 1;

// ── ABIs ────────────────────────────────────────────────────────────────────

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
];

// vault.previewRedeem — confirmed on-chain (selector 0x4cdad506)
const VAULT_PREVIEW_ABI = [
  'function previewRedeem(uint256 shares) view returns (uint256 vltOut, uint256 usdcOut)',
];

// vault.redeem — 2-arg ABI (selector 0x7bde82f2)
const VAULT_REDEEM_ABI = [
  'function redeem(uint256 shares, address receiver) returns (uint256 vltOut, uint256 usdcOut)',
];

const V2_PAIR_ABI = [
  'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
];

// V2 Router swapExactTokensForTokens (selector 0x38ed1739)
const V2_ROUTER_ABI = [
  'function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) external returns (uint256[] memory amounts)',
];

const ERC20_IFACE       = new ethers.Interface(ERC20_ABI);
const VAULT_REDEEM_IFACE = new ethers.Interface(VAULT_REDEEM_ABI);
const V2_ROUTER_IFACE   = new ethers.Interface(V2_ROUTER_ABI);

// ── Types ────────────────────────────────────────────────────────────────────

export interface ZapWithdrawResult {
  success: boolean;
  mode: 'usdc-only-3tx-exit';
  shares: string;
  sharesRaw: string;
  previewVltOut: string;
  previewVltOutRaw: string;
  previewUsdcFromVault: string;
  previewUsdcFromVaultRaw: string;
  quotedUsdcFromSwap: string;
  quotedUsdcFromSwapRaw: string;
  minUsdcFromSwap: string;
  minUsdcFromSwapRaw: string;
  totalEstimatedUsdc: string;
  slippagePct: number;
  recipient: string;
  network: string;
  chainId: number;
  steps: Array<{
    step: number;
    action: string;
    to: string;
    data: string;
    value: string;
    gasEstimate: string;
    note: string;
  }>;
  route: string;
  vaultAddress: string;
  v2RouterAddress: string;
  agentInstructions: string;
  quoteSource: 'live-on-chain';
  error?: string;
}

// ── V2 getAmountOut formula ──────────────────────────────────────────────────

function v2AmountOut(amountIn: bigint, reserveIn: bigint, reserveOut: bigint): bigint {
  const amountInWithFee = amountIn * 997n;
  const numerator       = amountInWithFee * reserveOut;
  const denominator     = reserveIn * 1000n + amountInWithFee;
  return numerator / denominator;
}

// ── Step 1: vault.previewRedeem — exact on-chain VLT + USDC amounts ──────────
// Uses selector 0x4cdad506 (confirmed on mainnet). Fails closed.

async function previewVaultRedeem(
  sharesRaw: bigint,
  provider: ethers.JsonRpcProvider,
): Promise<{ vltOutRaw: bigint; usdcFromVaultRaw: bigint }> {
  const vault = new ethers.Contract(VAULT, VAULT_PREVIEW_ABI, provider);
  const [vltOut, usdcOut] = await vault.previewRedeem(sharesRaw);
  const vltOutRaw        = BigInt(vltOut.toString());
  const usdcFromVaultRaw = BigInt(usdcOut.toString());
  if (vltOutRaw === 0n && usdcFromVaultRaw === 0n) {
    throw new Error('vault.previewRedeem returned zero for both VLT and USDC — shares may be invalid or vault paused');
  }
  return { vltOutRaw, usdcFromVaultRaw };
}

// ── Step 2: Two-hop V2 quote VLT → WETH → USDC ──────────────────────────────
// Uses V2 getReserves on two pairs. Both pairs are confirmed on mainnet.
// VLT/WETH pair: VLT=token0, WETH=token1
// WETH/USDC pair: USDC=token0, WETH=token1
// Fails closed if reserves unavailable.

async function quoteVltToUsdcV2(
  vltRaw: bigint,
  provider: ethers.JsonRpcProvider,
): Promise<{ wethOutRaw: bigint; usdcFromSwapRaw: bigint }> {
  if (vltRaw === 0n) {
    return { wethOutRaw: 0n, usdcFromSwapRaw: 0n };
  }

  const vltWethPair  = new ethers.Contract(VLT_WETH_PAIR, V2_PAIR_ABI, provider);
  const wethUsdcPair = new ethers.Contract(WETH_USDC_PAIR, V2_PAIR_ABI, provider);

  const [vltWethReserves, wethUsdcReserves] = await Promise.all([
    vltWethPair.getReserves(),
    wethUsdcPair.getReserves(),
  ]);

  // VLT/WETH pair: VLT=token0, WETH=token1
  const reserveVlt  = BigInt(vltWethReserves[0].toString());
  const reserveWeth = BigInt(vltWethReserves[1].toString());
  const wethOutRaw  = v2AmountOut(vltRaw, reserveVlt, reserveWeth);

  if (wethOutRaw === 0n) {
    throw new Error('V2 VLT→WETH quote returned 0 WETH — VLT/WETH pair may lack liquidity for this amount');
  }

  // WETH/USDC pair: USDC=token0, WETH=token1 (confirmed on-chain)
  const reserveUsdc   = BigInt(wethUsdcReserves[0].toString());
  const reserveWeth2  = BigInt(wethUsdcReserves[1].toString());
  const usdcFromSwapRaw = v2AmountOut(wethOutRaw, reserveWeth2, reserveUsdc);

  if (usdcFromSwapRaw === 0n) {
    throw new Error('V2 WETH→USDC quote returned 0 USDC — WETH/USDC pair may lack liquidity for this amount');
  }

  return { wethOutRaw, usdcFromSwapRaw };
}

// ── Main export ──────────────────────────────────────────────────────────────

const DEADLINE_SECONDS = 20 * 60; // 20 min
const SLIPPAGE_BPS     = 200n;    // 2% on V2 swap USDC output

export async function buildZapWithdraw(
  sharesRaw: string,
  recipient: string,
): Promise<ZapWithdrawResult> {
  // Validate recipient
  if (!recipient || !/^0x[0-9a-fA-F]{40}$/i.test(recipient)) {
    return errorResult(sharesRaw, recipient, 'recipient must be a valid Ethereum address (0x + 40 hex chars)');
  }

  let normalizedRecipient: string;
  try {
    normalizedRecipient = ethers.getAddress(recipient.toLowerCase());
  } catch {
    return errorResult(sharesRaw, recipient, 'recipient is not a valid Ethereum address');
  }

  // Validate shares
  let sharesRawBig: bigint;
  try {
    sharesRawBig = BigInt(sharesRaw);
    if (sharesRawBig <= 0n) throw new Error('zero');
  } catch {
    return errorResult(
      sharesRaw,
      recipient,
      'shares must be a positive integer string (raw 18-decimal amount, e.g. "1000000000000000000" for 1 vltUSDC share)',
    );
  }

  const sharesDisplay = parseFloat(ethers.formatEther(sharesRawBig)).toFixed(6);
  const deadline      = BigInt(Math.floor(Date.now() / 1000) + DEADLINE_SECONDS);

  const rpcUrl   = `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY ?? ''}`;
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  // ── Step 1: vault.previewRedeem — exact on-chain VLT + USDC amounts ──────
  // MANDATORY. Fails closed if unavailable.
  let vltOutRaw: bigint;
  let usdcFromVaultRaw: bigint;
  try {
    ({ vltOutRaw, usdcFromVaultRaw } = await previewVaultRedeem(sharesRawBig, provider));
  } catch (err: any) {
    console.error('[vltUSDC ZapWithdraw] vault.previewRedeem failed — failing closed:', err?.message);
    return errorResult(
      sharesRaw,
      recipient,
      `vault.previewRedeem unavailable — cannot determine exact token amounts. ` +
      `Retry shortly or use POST /x402/vlt-usdc-withdraw (standard exit, 1 tx, returns VLT+USDC). ` +
      `(${err?.message ?? 'RPC error'})`,
    );
  }

  // ── Step 2: Two-hop V2 quote VLT → WETH → USDC ───────────────────────────
  // MANDATORY. Uses the exact vltOutRaw from previewRedeem. Fails closed.
  let usdcFromSwapRaw: bigint;
  try {
    ({ usdcFromSwapRaw } = await quoteVltToUsdcV2(vltOutRaw, provider));
  } catch (err: any) {
    console.error('[vltUSDC ZapWithdraw] V2 VLT→USDC quote failed — failing closed:', err?.message);
    return errorResult(
      sharesRaw,
      recipient,
      `Live V2 VLT→USDC quote unavailable — cannot build minUsdcFromSwap. ` +
      `Retry shortly or use POST /x402/vlt-usdc-withdraw (returns VLT+USDC, no swap). ` +
      `(${err?.message ?? 'RPC error'})`,
    );
  }

  // ── Compute minUsdcFromSwap ───────────────────────────────────────────────
  // Applied only to the swap output (step 3). Vault USDC (step 1) has no slippage.
  if (usdcFromSwapRaw === 0n) {
    return errorResult(sharesRaw, recipient, 'V2 swap quoted 0 USDC — VLT amount may be too small or pool lacks liquidity');
  }
  const minUsdcFromSwapRaw = usdcFromSwapRaw * (10000n - SLIPPAGE_BPS) / 10000n;

  // ── Build calldata ────────────────────────────────────────────────────────

  // Step 1: vault.redeem(shares, recipient)
  const redeemData = VAULT_REDEEM_IFACE.encodeFunctionData('redeem', [
    sharesRawBig,
    normalizedRecipient,
  ]);

  // Step 2: VLT.approve(v2Router, previewVltOut)
  // Exact amount: swaps exactly previewVltOut. Any excess VLT from block-timing stays with recipient.
  const approveData = ERC20_IFACE.encodeFunctionData('approve', [V2_ROUTER, vltOutRaw]);

  // Step 3: v2Router.swapExactTokensForTokens
  // path = [VLT, WETH, USDC] — two-hop via V2 pairs (confirmed liquid on mainnet)
  const swapData = V2_ROUTER_IFACE.encodeFunctionData('swapExactTokensForTokens', [
    vltOutRaw,
    minUsdcFromSwapRaw,
    [VLT_TOKEN, WETH, USDC_ETH],
    normalizedRecipient,
    deadline,
  ]);

  // ── Display values ────────────────────────────────────────────────────────
  const previewVltDisplay       = parseFloat(ethers.formatEther(vltOutRaw)).toFixed(6);
  const previewUsdcVaultDisplay = parseFloat(ethers.formatUnits(usdcFromVaultRaw, 6)).toFixed(6);
  const quotedUsdcSwapDisplay   = parseFloat(ethers.formatUnits(usdcFromSwapRaw, 6)).toFixed(6);
  const minUsdcSwapDisplay      = parseFloat(ethers.formatUnits(minUsdcFromSwapRaw, 6)).toFixed(6);
  const totalUsdcDisplay        = parseFloat(
    ethers.formatUnits(usdcFromVaultRaw + usdcFromSwapRaw, 6),
  ).toFixed(6);

  return {
    success: true,
    mode: 'usdc-only-3tx-exit',
    shares: sharesDisplay,
    sharesRaw: sharesRawBig.toString(),
    previewVltOut: previewVltDisplay,
    previewVltOutRaw: vltOutRaw.toString(),
    previewUsdcFromVault: previewUsdcVaultDisplay,
    previewUsdcFromVaultRaw: usdcFromVaultRaw.toString(),
    quotedUsdcFromSwap: quotedUsdcSwapDisplay,
    quotedUsdcFromSwapRaw: usdcFromSwapRaw.toString(),
    minUsdcFromSwap: minUsdcSwapDisplay,
    minUsdcFromSwapRaw: minUsdcFromSwapRaw.toString(),
    totalEstimatedUsdc: totalUsdcDisplay,
    slippagePct: Number(SLIPPAGE_BPS) / 100,
    recipient: normalizedRecipient,
    network: 'Ethereum Mainnet',
    chainId: CHAIN_ID,
    steps: [
      {
        step: 1,
        action: 'Redeem vltUSDC shares → VLT + USDC',
        to: VAULT,
        data: redeemData,
        value: '0x0',
        gasEstimate: '0x61A80', // ~400,000 gas (V4 position decrease + token transfers)
        note: [
          `Burns ${sharesDisplay} vltUSDC shares.`,
          `Sends ~${previewVltDisplay} VLT + ~${previewUsdcVaultDisplay} USDC to ${normalizedRecipient}`,
          `(vault.previewRedeem, on-chain exact amounts).`,
          `Confirm before Step 2. After this step your wallet holds VLT — proceed immediately to Step 3 to convert it.`,
        ].join(' '),
      },
      {
        step: 2,
        action: 'Approve VLT to Uniswap V2 Router',
        to: VLT_TOKEN,
        data: approveData,
        value: '0x0',
        gasEstimate: '0xCB20', // ~52,000 gas
        note: `Grant Uniswap V2 Router (${V2_ROUTER}) permission to spend ${previewVltDisplay} VLT. ` +
          `Approval is for the exact previewRedeem amount. If actual VLT received differs by a few wei due to block timing, ` +
          `any excess stays with recipient (not lost). Confirm before Step 3.`,
      },
      {
        step: 3,
        action: 'Swap VLT → WETH → USDC via Uniswap V2',
        to: V2_ROUTER,
        data: swapData,
        value: '0x0',
        gasEstimate: '0x3D090', // ~250,000 gas (two V2 hops + token transfers)
        note: [
          `Two-hop V2 swap: VLT → WETH (VLT/WETH pair) → USDC (WETH/USDC pair).`,
          `amountIn = ${previewVltDisplay} VLT (exact, from previewRedeem).`,
          `Expected USDC from swap: ~${quotedUsdcSwapDisplay} USDC (live V2 quote).`,
          `minAmountOut = ${minUsdcSwapDisplay} USDC (${Number(SLIPPAGE_BPS) / 100}% slippage, enforced on-chain).`,
          `USDC delivered to ${normalizedRecipient}. Calldata valid for 20 min.`,
        ].join(' '),
      },
    ],
    route: [
      'Step 1: vltUSDC shares → vault.redeem → VLT + USDC (to recipient)',
      'Step 3: VLT –[V2 VLT/WETH]→ WETH –[V2 WETH/USDC]→ USDC (to recipient)',
    ].join(' | '),
    vaultAddress: VAULT,
    v2RouterAddress: V2_ROUTER,
    agentInstructions: [
      `You are converting ${sharesDisplay} vltUSDC shares entirely to USDC in 3 sequential transactions on Ethereum mainnet (chainId 1).`,
      `Step 1: vault.redeem burns your shares and sends ~${previewVltDisplay} VLT + ~${previewUsdcVaultDisplay} USDC to ${normalizedRecipient}. Wait for confirmation.`,
      `Step 2: approve Uniswap V2 Router to spend your ${previewVltDisplay} VLT. Wait for confirmation.`,
      `Step 3: V2 Router swaps VLT → WETH → USDC, adding ~${quotedUsdcSwapDisplay} USDC to ${normalizedRecipient}. minAmountOut = ${minUsdcSwapDisplay} USDC enforced on-chain.`,
      `Total estimated USDC after all 3 steps: ~${totalUsdcDisplay} USDC.`,
      `For a 1-tx exit that keeps VLT: use POST /x402/vlt-usdc-withdraw instead (no swap, no slippage).`,
      `Calldata for Steps 2+3 valid for 20 minutes from build time.`,
    ].join(' '),
    quoteSource: 'live-on-chain',
  };
}

function errorResult(sharesRaw: string, recipient: string, error: string): ZapWithdrawResult {
  return {
    success: false,
    mode: 'usdc-only-3tx-exit',
    shares: sharesRaw,
    sharesRaw,
    previewVltOut: '0',
    previewVltOutRaw: '0',
    previewUsdcFromVault: '0',
    previewUsdcFromVaultRaw: '0',
    quotedUsdcFromSwap: '0',
    quotedUsdcFromSwapRaw: '0',
    minUsdcFromSwap: '0',
    minUsdcFromSwapRaw: '0',
    totalEstimatedUsdc: '0',
    slippagePct: Number(SLIPPAGE_BPS) / 100,
    recipient,
    network: 'Ethereum Mainnet',
    chainId: CHAIN_ID,
    steps: [],
    route: '',
    vaultAddress: VAULT,
    v2RouterAddress: V2_ROUTER,
    agentInstructions: '',
    quoteSource: 'live-on-chain',
    error,
  };
}
