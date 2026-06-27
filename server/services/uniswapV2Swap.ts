/**
 * Uniswap V2 swap service — ETH→VLT and USDC→VLT
 * Used for auto-replenishing the platform VLT float when balance runs low.
 *
 * Router:  0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D (Ethereum mainnet)
 * WETH:    0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
 * VLT:     0x6b785a0322126826d8226d77e173d75DAfb84d11
 * USDC:    0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
 * VLT/WETH pair: 0x966053Ca4fca049173eb1F27E4cb168CCb794534
 */

import { ethers } from 'ethers';

const ROUTER_ADDRESS = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
const WETH_ADDRESS   = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const VLT_ADDRESS    = '0x6b785a0322126826d8226d77e173d75DAfb84d11';
const USDC_ADDRESS   = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';

const ETH_RPC = `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY || ''}`;

const ROUTER_ABI = [
  'function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)',
  'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
  'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
];
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
];

export interface SwapQuote {
  amountIn: string;
  amountOut: string;
  priceImpactPct: number;
  path: string[];
  minAmountOut: string;
}

export interface SwapResult {
  success: boolean;
  txHash?: string;
  amountOut?: string;
  error?: string;
}

function getProvider(): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(ETH_RPC);
}

function getPlatformSigner(provider: ethers.JsonRpcProvider): ethers.Wallet {
  const key = process.env.EVM_PRIVATE_KEY;
  if (!key) throw new Error('EVM_PRIVATE_KEY not configured');
  return new ethers.Wallet(key, provider);
}

function deadline(minutesFromNow = 10): number {
  return Math.floor(Date.now() / 1000) + minutesFromNow * 60;
}

/**
 * Get a quote for swapping ETH → VLT
 * amountEth: string like "0.5"
 * slippagePct: default 2 (2%)
 */
export async function quoteEthForVlt(amountEth: string, slippagePct = 2): Promise<SwapQuote> {
  const provider = getProvider();
  const router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, provider);
  const path = [WETH_ADDRESS, VLT_ADDRESS];
  const amountInWei = ethers.parseEther(amountEth);
  const amounts: bigint[] = await router.getAmountsOut(amountInWei, path);
  const amountOut = ethers.formatUnits(amounts[1], 18);
  const minAmountOut = ethers.formatUnits(
    amounts[1] * BigInt(Math.floor((100 - slippagePct) * 100)) / 10000n,
    18
  );
  const priceImpactPct = await estimatePriceImpact(amountInWei, amounts[1], path);
  return { amountIn: amountEth, amountOut, priceImpactPct, path, minAmountOut };
}

/**
 * Get a quote for swapping USDC → VLT (via WETH)
 * amountUsdc: string like "100.00"
 * slippagePct: default 2 (2%)
 */
export async function quoteUsdcForVlt(amountUsdc: string, slippagePct = 2): Promise<SwapQuote> {
  const provider = getProvider();
  const router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, provider);
  const path = [USDC_ADDRESS, WETH_ADDRESS, VLT_ADDRESS];
  const amountInUnits = ethers.parseUnits(amountUsdc, 6);
  const amounts: bigint[] = await router.getAmountsOut(amountInUnits, path);
  const amountOut = ethers.formatUnits(amounts[2], 18);
  const minAmountOut = ethers.formatUnits(
    amounts[2] * BigInt(Math.floor((100 - slippagePct) * 100)) / 10000n,
    18
  );
  const priceImpactPct = await estimatePriceImpact(amountInUnits, amounts[2], path);
  return { amountIn: amountUsdc, amountOut, priceImpactPct, path, minAmountOut };
}

/**
 * Swap ETH → VLT from platform wallet.
 * Sends ETH from the platform signer, receives VLT at the same address.
 */
export async function swapEthForVlt(
  amountEth: string,
  slippagePct = 2,
  recipient?: string
): Promise<SwapResult> {
  try {
    const provider = getProvider();
    const signer = getPlatformSigner(provider);
    const to = recipient ?? signer.address;
    const router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, signer);
    const path = [WETH_ADDRESS, VLT_ADDRESS];
    const amountInWei = ethers.parseEther(amountEth);

    const amounts: bigint[] = await router.getAmountsOut(amountInWei, path);
    const minOut = amounts[1] * BigInt(Math.floor((100 - slippagePct) * 100)) / 10000n;

    console.log(`[UniswapV2] Swapping ${amountEth} ETH → ~${ethers.formatUnits(amounts[1], 18)} VLT (min: ${ethers.formatUnits(minOut, 18)})`);

    const tx = await router.swapExactETHForTokens(
      minOut,
      path,
      to,
      deadline(),
      { value: amountInWei }
    );
    console.log(`[UniswapV2] ETH→VLT tx sent: ${tx.hash}`);
    const receipt = await tx.wait(1);
    if (receipt?.status !== 1) throw new Error('Transaction reverted');

    const vltOut = ethers.formatUnits(amounts[1], 18);
    console.log(`[UniswapV2] ✅ ETH→VLT confirmed: ${receipt.hash} | ~${vltOut} VLT received`);
    return { success: true, txHash: receipt.hash, amountOut: vltOut };
  } catch (err: any) {
    console.error('[UniswapV2] ETH→VLT swap failed:', err?.message);
    return { success: false, error: err?.message ?? String(err) };
  }
}

/**
 * Swap USDC → VLT from platform wallet (path: USDC → WETH → VLT).
 * Platform wallet must have sufficient USDC and ETH for gas.
 */
export async function swapUsdcForVlt(
  amountUsdc: string,
  slippagePct = 2,
  recipient?: string
): Promise<SwapResult> {
  try {
    const provider = getProvider();
    const signer = getPlatformSigner(provider);
    const to = recipient ?? signer.address;
    const router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, signer);
    const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, signer);
    const path = [USDC_ADDRESS, WETH_ADDRESS, VLT_ADDRESS];
    const amountIn = ethers.parseUnits(amountUsdc, 6);

    const amounts: bigint[] = await router.getAmountsOut(amountIn, path);
    const minOut = amounts[2] * BigInt(Math.floor((100 - slippagePct) * 100)) / 10000n;

    const allowance: bigint = await usdc.allowance(signer.address, ROUTER_ADDRESS);
    if (allowance < amountIn) {
      console.log(`[UniswapV2] Approving USDC for router...`);
      const approveTx = await usdc.approve(ROUTER_ADDRESS, ethers.MaxUint256);
      await approveTx.wait(1);
      console.log(`[UniswapV2] USDC approved`);
    }

    console.log(`[UniswapV2] Swapping ${amountUsdc} USDC → ~${ethers.formatUnits(amounts[2], 18)} VLT (min: ${ethers.formatUnits(minOut, 18)})`);

    const tx = await router.swapExactTokensForTokens(
      amountIn,
      minOut,
      path,
      to,
      deadline()
    );
    console.log(`[UniswapV2] USDC→VLT tx sent: ${tx.hash}`);
    const receipt = await tx.wait(1);
    if (receipt?.status !== 1) throw new Error('Transaction reverted');

    const vltOut = ethers.formatUnits(amounts[2], 18);
    console.log(`[UniswapV2] ✅ USDC→VLT confirmed: ${receipt.hash} | ~${vltOut} VLT received`);
    return { success: true, txHash: receipt.hash, amountOut: vltOut };
  } catch (err: any) {
    console.error('[UniswapV2] USDC→VLT swap failed:', err?.message);
    return { success: false, error: err?.message ?? String(err) };
  }
}

async function estimatePriceImpact(
  amountIn: bigint,
  amountOut: bigint,
  _path: string[]
): Promise<number> {
  try {
    const provider = getProvider();
    const router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, provider);
    const tiny = amountIn / 1000n;
    if (tiny === 0n) return 0;
    const tinyOut: bigint[] = await router.getAmountsOut(tiny, _path);
    const spotRate = Number(tinyOut[tinyOut.length - 1]) / Number(tiny);
    const executionRate = Number(amountOut) / Number(amountIn);
    return Math.max(0, (spotRate - executionRate) / spotRate * 100);
  } catch {
    return 0;
  }
}
