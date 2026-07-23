/**
 * vltUSDC Zap Deposit Builder — USDC-only path via ZapHelper
 *
 * Agent only needs USDC on Ethereum mainnet. No VLT required.
 * The ZapHelper swaps half the USDC to VLT internally, then deposits both.
 *
 * ZapHelper: 0x348A57b1dc6E3dCAa645DE6e4E864924B410525D
 * ABI (7-arg, verified via bytecode selector 0x9248013e):
 *   zapDeposit(
 *     uint256 usdcAmount,     — total USDC agent provides
 *     uint256 swapUsdcToVlt,  — portion of USDC to swap for VLT (≈50%)
 *     uint256 minVltOut,      — slippage floor on VLT received
 *     uint256 minShares,      — slippage floor on vltUSDC shares minted
 *     uint256 deadline,       — tx stale guard (unix timestamp)
 *     address recipient,      — receives vltUSDC shares
 *     bytes swapData          — Universal Router execute() calldata
 *   )
 *
 * Swap route (matching Bankroll's production bundle):
 *   USDC --[V3 0.05% fee]--> WETH --[V2 pair]--> VLT
 *   commands = 0x0008 = [V3_SWAP_EXACT_IN, V2_SWAP_EXACT_IN]
 *
 * Quote chain (live on-chain, two RPC calls):
 *   1. V3 QuoterV2 (0x61fFE014bA17989E743c5F6cB21bF9697530B21e): USDC → WETH
 *   2. V2 pair getReserves (0x966053Ca4fca049173eb1F27E4cb168CCb794534): WETH → VLT
 *
 * Returns 2 unsigned transactions:
 *   1. USDC.approve(zapHelper, usdcAmount)
 *   2. zapHelper.zapDeposit(7 args)
 *
 * Security:
 *   - Live quote is MANDATORY — fails closed if RPC unavailable (no stale fallback)
 *   - minVltOut enforces 1% slippage on VLT swap output
 *   - minShares enforces 2% slippage on vault share mint via vault.previewDeposit
 *   - Fails closed if vault.previewDeposit unavailable (no stale fallback tiers)
 */

import { ethers } from 'ethers';

// ── Addresses (all Ethereum mainnet) ────────────────────────────────────────

const ZAP_HELPER    = '0x348A57b1dc6E3dCAa645DE6e4E864924B410525D';
const VAULT         = '0xee8d4c5c768AadCd3517Aa8C908De300305D0A7f';
const VLT_TOKEN     = '0x6b785a0322126826d8226d77e173d75DAfb84d11';
const USDC_ETH      = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const WETH          = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const VLT_WETH_PAIR = '0x966053Ca4fca049173eb1F27E4cb168CCb794534'; // V2 pair: VLT=token0, WETH=token1
const QUOTER_V2     = '0x61fFE014bA17989E743c5F6cB21bF9697530B21e'; // Uniswap V3 QuoterV2 (mainnet)
const CHAIN_ID      = 1;
const V3_FEE_USDC_WETH = 500; // 0.05% — confirmed working via eth_call

// Universal Router constants
const ADDRESS_THIS = '0x0000000000000000000000000000000000000001'; // keep tokens in router
const MSG_SENDER   = '0x0000000000000000000000000000000000000002'; // send to caller (ZapHelper)
const MAX_UINT256  = ethers.MaxUint256; // use router's full balance of intermediate token

// ── ABIs ────────────────────────────────────────────────────────────────────

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function totalSupply() view returns (uint256)',
];

// 7-arg — verified via bytecode selector 0x9248013e
const ZAP_ABI = [
  'function zapDeposit(uint256 usdcAmount, uint256 swapUsdcToVlt, uint256 minVltOut, uint256 minShares, uint256 deadline, address recipient, bytes swapData) returns (uint256 shares)',
];

const QUOTER_ABI = [
  'function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96)) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)',
];

const V2_PAIR_ABI = [
  'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
];

const UR_ABI = [
  'function execute(bytes commands, bytes[] inputs, uint256 deadline) external payable',
];

// Common vault preview ABI — try both known patterns
const VAULT_PREVIEW_ABI = [
  'function previewDeposit(uint256 vltAmount, uint256 usdcAmount) view returns (uint256 shares)',
  'function totalSupply() view returns (uint256)',
];

const ZAP_IFACE   = new ethers.Interface(ZAP_ABI);
const ERC20_IFACE = new ethers.Interface(ERC20_ABI);
const UR_IFACE    = new ethers.Interface(UR_ABI);

// ── Types ────────────────────────────────────────────────────────────────────

export interface ZapDepositResult {
  success: boolean;
  mode: 'usdc-only-zap';
  amountUsdc: string;
  amountUsdcRaw: string;
  swapUsdcToVlt: string;
  swapUsdcToVltRaw: string;
  quotedVltOut: string;
  minVltOut: string;
  minVltOutRaw: string;
  minShares: string;
  minSharesRaw: string;
  minSharesSource: 'vault-preview';
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
  zapHelperAddress: string;
  vaultAddress: string;
  agentInstructions: string;
  quoteSource: 'live';
  error?: string;
}

// ── V3 path encoding (packed bytes: tokenIn + fee + tokenOut) ───────────────

function encodeV3Path(tokenIn: string, fee: number, tokenOut: string): string {
  // packed: address(20) + uint24(3) + address(20) = 43 bytes
  return (
    tokenIn.toLowerCase().replace('0x', '') +
    fee.toString(16).padStart(6, '0') +
    tokenOut.toLowerCase().replace('0x', '')
  );
}

// ── V2 getAmountOut formula ──────────────────────────────────────────────────

function v2AmountOut(amountIn: bigint, reserveIn: bigint, reserveOut: bigint): bigint {
  const amountInWithFee = amountIn * 997n;
  const numerator       = amountInWithFee * reserveOut;
  const denominator     = reserveIn * 1000n + amountInWithFee;
  return numerator / denominator;
}

// ── Live quote chain: USDC → WETH (V3) → VLT (V2) ──────────────────────────
// Fails closed — throws if RPC unavailable. No stale fallback.

async function quoteUsdcToVlt(
  swapUsdcRaw: bigint,
  provider: ethers.JsonRpcProvider,
): Promise<{ wethOut: bigint; vltOut: bigint }> {
  const quoter = new ethers.Contract(QUOTER_V2, QUOTER_ABI, provider);
  const pair   = new ethers.Contract(VLT_WETH_PAIR, V2_PAIR_ABI, provider);

  const [v3Result, reserves] = await Promise.all([
    quoter.quoteExactInputSingle.staticCall({
      tokenIn: USDC_ETH,
      tokenOut: WETH,
      amountIn: swapUsdcRaw,
      fee: V3_FEE_USDC_WETH,
      sqrtPriceLimitX96: 0n,
    }),
    pair.getReserves(),
  ]);

  const wethOut = BigInt(v3Result[0].toString());

  // VLT=token0, WETH=token1 (verified on-chain)
  const reserveWeth = BigInt(reserves[1].toString()); // token1
  const reserveVlt  = BigInt(reserves[0].toString()); // token0

  const vltOut = v2AmountOut(wethOut, reserveWeth, reserveVlt);

  return { wethOut, vltOut };
}

// ── minShares estimation ─────────────────────────────────────────────────────
// Uses vault.previewDeposit with 2% slippage. Fails closed if unavailable.
// No fallback tiers — economically weak fallbacks are removed per security review.

const SHARE_SLIPPAGE_BPS = 200n; // 2% on share mint

async function estimateMinShares(
  vltAmountRaw: bigint,
  usdcHalfRaw: bigint,
  provider: ethers.JsonRpcProvider,
): Promise<{ minSharesRaw: bigint; source: 'vault-preview' }> {
  const vault = new ethers.Contract(VAULT, VAULT_PREVIEW_ABI, provider);
  const preview = await vault.previewDeposit(vltAmountRaw, usdcHalfRaw);
  const previewShares = BigInt(preview.toString());
  if (previewShares === 0n) {
    throw new Error('vault.previewDeposit returned 0 shares — pool may be paused or empty');
  }
  const minSharesRaw = previewShares * (10000n - SHARE_SLIPPAGE_BPS) / 10000n;
  return { minSharesRaw: minSharesRaw > 0n ? minSharesRaw : 1n, source: 'vault-preview' };
}

// ── swapData encoder ─────────────────────────────────────────────────────────

function buildSwapData(
  swapUsdcRaw: bigint,
  minVltOutRaw: bigint,
  deadline: bigint,
): string {
  // V3_SWAP_EXACT_IN (0x00): USDC → WETH, keep WETH in router
  const v3Path  = '0x' + encodeV3Path(USDC_ETH, V3_FEE_USDC_WETH, WETH);
  const v3Input = ethers.AbiCoder.defaultAbiCoder().encode(
    ['address', 'uint256', 'uint256', 'bytes', 'bool'],
    [ADDRESS_THIS, swapUsdcRaw, 0n, v3Path, false],
  );

  // V2_SWAP_EXACT_IN (0x08): WETH (full router balance) → VLT, send to ZapHelper (MSG_SENDER)
  const v2Input = ethers.AbiCoder.defaultAbiCoder().encode(
    ['address', 'uint256', 'uint256', 'address[]', 'bool'],
    [MSG_SENDER, MAX_UINT256, minVltOutRaw, [WETH, VLT_TOKEN], false],
  );

  // commands: [0x00, 0x08] — 2 bytes as a hex string
  const commands = '0x0008';

  return UR_IFACE.encodeFunctionData('execute', [commands, [v3Input, v2Input], deadline]);
}

// ── Main export ──────────────────────────────────────────────────────────────

const DEADLINE_SECONDS = 20 * 60; // 20 min
const SLIPPAGE_BPS     = 100;     // 1% on VLT swap output

export async function buildZapDeposit(
  amountUsdc: string | number,
  recipient: string,
): Promise<ZapDepositResult> {
  if (!recipient || !/^0x[0-9a-fA-F]{40}$/i.test(recipient)) {
    return errorResult(amountUsdc, recipient, 'recipient must be a valid Ethereum address (0x + 40 hex chars)');
  }

  let normalizedRecipient: string;
  try {
    normalizedRecipient = ethers.getAddress(recipient); // normalize to EIP-55 checksum
  } catch {
    return errorResult(amountUsdc, recipient, 'recipient is not a valid Ethereum address');
  }

  const amount = parseFloat(String(amountUsdc));
  if (isNaN(amount) || amount < 1) {
    return errorResult(amountUsdc, recipient, 'amountUsdc must be ≥ 1 USDC');
  }

  const usdcRaw        = ethers.parseUnits(amount.toFixed(6), 6);
  const swapHalf       = usdcRaw / 2n;
  const depositHalf    = usdcRaw - swapHalf;
  const deadline       = BigInt(Math.floor(Date.now() / 1000) + DEADLINE_SECONDS);
  const addr           = normalizedRecipient; // EIP-55 normalized

  const rpcUrl  = `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY ?? ''}`;
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  // Live quote — MANDATORY. Throws if RPC unavailable. No stale fallback.
  let vltOut: bigint;
  try {
    const result = await quoteUsdcToVlt(swapHalf, provider);
    vltOut = result.vltOut;
  } catch (err: any) {
    console.error('[vltUSDC Zap] live quote failed — failing closed (no stale fallback):', err?.message);
    return errorResult(
      amountUsdc,
      recipient,
      `Live on-chain quote unavailable — cannot build safe calldata. Retry shortly or use Bankroll UI at https://bankroll.network/vltUSDC.html. (${err?.message ?? 'RPC error'})`,
    );
  }

  if (vltOut === 0n) {
    return errorResult(amountUsdc, recipient, 'Quote returned 0 VLT — pool may have insufficient liquidity for this amount');
  }

  // Slippage: 1% floor on VLT received from swap
  const minVltOutRaw = vltOut * BigInt(10000 - SLIPPAGE_BPS) / 10000n;
  const quotedVlt    = parseFloat(ethers.formatEther(vltOut)).toFixed(4);
  const minVltOut    = parseFloat(ethers.formatEther(minVltOutRaw)).toFixed(4);

  // minShares: vault.previewDeposit with 2% slippage — MANDATORY, fail closed.
  let minSharesRaw: bigint;
  try {
    const sharesResult = await estimateMinShares(minVltOutRaw, depositHalf, provider);
    minSharesRaw = sharesResult.minSharesRaw;
  } catch (err: any) {
    console.error('[vltUSDC Zap] vault.previewDeposit failed — failing closed:', err?.message);
    return errorResult(
      amountUsdc,
      recipient,
      `Vault share preview unavailable — cannot enforce share slippage. Retry shortly or use Bankroll UI at https://bankroll.network/vltUSDC.html. (${err?.message ?? 'RPC error'})`,
    );
  }
  const minSharesDisplay = ethers.formatEther(minSharesRaw);

  const swapData = buildSwapData(swapHalf, minVltOutRaw, deadline);

  // Calldata step 1: USDC.approve(zapHelper, usdcAmount)
  const approveData = ERC20_IFACE.encodeFunctionData('approve', [ZAP_HELPER, usdcRaw]);

  // Calldata step 2: zapHelper.zapDeposit(7 args)
  const zapData = ZAP_IFACE.encodeFunctionData('zapDeposit', [
    usdcRaw,        // total USDC
    swapHalf,       // swap ~50% to VLT
    minVltOutRaw,   // 1% slippage floor on VLT
    minSharesRaw,   // slippage floor on shares (never 0)
    deadline,
    addr,
    swapData,
  ]);

  return {
    success: true,
    mode: 'usdc-only-zap',
    amountUsdc: amount.toFixed(6),
    amountUsdcRaw: usdcRaw.toString(),
    swapUsdcToVlt: (amount / 2).toFixed(6),
    swapUsdcToVltRaw: swapHalf.toString(),
    quotedVltOut: quotedVlt,
    minVltOut,
    minVltOutRaw: minVltOutRaw.toString(),
    minShares: minSharesDisplay,
    minSharesRaw: minSharesRaw.toString(),
    minSharesSource: 'vault-preview' as const,
    slippagePct: SLIPPAGE_BPS / 100,
    recipient: addr,
    network: 'Ethereum Mainnet',
    chainId: CHAIN_ID,
    steps: [
      {
        step: 1,
        action: 'Approve USDC to ZapHelper',
        to: USDC_ETH,
        data: approveData,
        value: '0x0',
        gasEstimate: '0xCB20', // ~52,000 gas
        note: `Grant ZapHelper (${ZAP_HELPER}) permission to spend ${amount.toFixed(6)} USDC. Must confirm before Step 2.`,
      },
      {
        step: 2,
        action: 'ZapHelper — swap USDC→VLT and deposit VLT+USDC into vltUSDC vault',
        to: ZAP_HELPER,
        data: zapData,
        value: '0x0',
        gasEstimate: '0x927C0', // ~600,000 gas (V3 swap + V2 swap + V4 deposit; 500k is too tight on busy mainnet)
        note: [
          `ZapHelper swaps ~${(amount / 2).toFixed(2)} USDC → ≥${minVltOut} VLT via V3(USDC→WETH 0.05%) + V2(WETH→VLT).`,
          `Then deposits VLT + remaining ~${(amount / 2).toFixed(2)} USDC into the vltUSDC vault.`,
          `Vault mints vltUSDC shares to ${addr}. Quote: ${quotedVlt} VLT (live on-chain).`,
          `1% slippage on VLT, 2% slippage on shares (source: vault-preview). Calldata valid for 20 min.`,
        ].join(' '),
      },
    ],
    route: 'USDC –[V3 0.05%]→ WETH –[V2]→ VLT + USDC → vltUSDC vault (VLT/USDC Uniswap V4)',
    zapHelperAddress: ZAP_HELPER,
    vaultAddress: VAULT,
    agentInstructions: [
      `You only need USDC on Ethereum mainnet (chainId 1). No VLT required.`,
      `Step 1: sign and broadcast the USDC approve transaction. Wait for confirmation.`,
      `Step 2: sign and broadcast the zapDeposit transaction. The ZapHelper buys VLT on-market and deposits both tokens, minting vltUSDC shares to ${addr}.`,
      `vltUSDC auto-compounds VLT/USDC Uniswap V4 LP fees — no claiming needed.`,
      `Quote generated at ${new Date().toISOString()} (live on-chain). Slippage guards: 1% on VLT swap, 2% on share mint (vault-preview).`,
      `Calldata valid for 20 minutes. Redeem: vault.redeem(shares, minVltOut, minUsdcOut, deadline, receiver) at ${VAULT}.`,
    ].join(' '),
    quoteSource: 'live',
  };
}

function errorResult(amountUsdc: string | number, recipient: string, error: string): ZapDepositResult {
  return {
    success: false,
    mode: 'usdc-only-zap',
    amountUsdc: String(amountUsdc),
    amountUsdcRaw: '0',
    swapUsdcToVlt: '0',
    swapUsdcToVltRaw: '0',
    quotedVltOut: '0',
    minVltOut: '0',
    minVltOutRaw: '0',
    minShares: '0',
    minSharesRaw: '0',
    minSharesSource: 'vault-preview' as const,
    slippagePct: 1,
    recipient,
    network: 'Ethereum Mainnet',
    chainId: CHAIN_ID,
    steps: [],
    route: '',
    zapHelperAddress: ZAP_HELPER,
    vaultAddress: VAULT,
    agentInstructions: '',
    quoteSource: 'live',
    error,
  };
}
