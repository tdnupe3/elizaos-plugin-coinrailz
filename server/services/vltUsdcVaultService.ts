/**
 * vltUSDC Vault — live stats reader (Ethereum Mainnet)
 *
 * Vault contract:   0x348A57b1dc6E3dCAa645DE6e4E864924B410525D (receives USDC, issues vltUSDC)
 * Share token:      0xee8d4c5c768AadCd3517Aa8C908De300305D0A7f (vltUSDC ERC-20)
 * Underlying pair:  0x966053Ca4fca049173eb1F27E4cb168CCb794534 (VLT/WETH Uniswap V2)
 * VLT token:        0x6b785a0322126826d8226d77e173d75DAfb84d11
 * WETH:             0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
 * USDC (Eth):       0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
 *
 * Token order in VLT/WETH pair: VLT (0x6b...) is token0, WETH (0xC0...) is token1.
 * getReserves() → [reserve0=VLT, reserve1=WETH, blockTimestampLast]
 *
 * TVL derivation:
 *   1. Read pair.getReserves() → total VLT + WETH in the pool
 *   2. Read pair.totalSupply() → total LP tokens
 *   3. Read pair.balanceOf(vault) → LP tokens held by vault
 *   4. vaultShare = vaultLP / totalLP
 *   5. vaultVLT = reserve0 * vaultShare; vaultWETH = reserve1 * vaultShare
 *   6. TVL = (vaultVLT * vltPriceUsd) + (vaultWETH * ethPriceUsd)
 *
 * Cache: 2 minutes (vault is new, low trading volume)
 */

import { ethers } from 'ethers';
import { getVltMarketData } from './vltMarketCache.js';

const VAULT_ADDRESS    = '0x348A57b1dc6E3dCAa645DE6e4E864924B410525D';
const VLT_USDC_TOKEN  = '0xee8d4c5c768AadCd3517Aa8C908De300305D0A7f';
const VLT_WETH_PAIR   = '0x966053Ca4fca049173eb1F27E4cb168CCb794534';
const USDC_ETH        = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';

const PAIR_ABI = [
  'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
  'function totalSupply() external view returns (uint256)',
  'function balanceOf(address) external view returns (uint256)',
];
const ERC20_ABI = [
  'function totalSupply() external view returns (uint256)',
  'function balanceOf(address) external view returns (uint256)',
];

export interface VltUsdcStats {
  vault: {
    address: string;
    shareToken: string;
    shareTokenAddress: string;
    underlyingPair: string;
    pairAddress: string;
    network: string;
  };
  stats: {
    tvlUsd: number;
    vltInVault: number;
    wethInVault: number;
    wethUsd: number;
    totalSharesVltUsdc: string;
    lPerShare: number;
    aprPct: number | null;
    aprDisplay: string;
    vltPriceUsd: number;
    ethPriceUsd: number;
    poolVltTotal: number;
    poolWethTotal: number;
  };
  deposit: {
    acceptedToken: string;
    usdcAddress: string;
    vaultAddress: string;
    minDeposit: string;
    network: string;
    chainId: number;
  };
  x402Service: {
    endpoint: string;
    price: string;
    description: string;
  };
  source: 'live' | 'cached' | 'fallback';
  updatedAt: string;
}

// ── In-memory cache ──────────────────────────────────────────────────────────

const CACHE_TTL_MS = 2 * 60 * 1000;
let cachedStats: VltUsdcStats | null = null;
let lastFetchMs = 0;
let fetchInProgress = false;

// ── ETH price helper ─────────────────────────────────────────────────────────

async function getEthPriceUsd(): Promise<number> {
  try {
    const r = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
      { signal: AbortSignal.timeout(5_000) }
    );
    if (!r.ok) throw new Error('CG non-ok');
    const d = await r.json();
    const price = d?.ethereum?.usd;
    if (typeof price === 'number' && price > 0) return price;
    throw new Error('No price in response');
  } catch {
    // Fallback: derive from VLT/WETH pair price and VLT's USD price
    const vlt = getVltMarketData();
    if (vlt.priceEth > 0 && vlt.priceUsd > 0) {
      return vlt.priceUsd / vlt.priceEth;
    }
    return 3500; // last-resort seed
  }
}

// ── Core fetch ───────────────────────────────────────────────────────────────

async function fetchLiveStats(): Promise<VltUsdcStats> {
  const rpcUrl = `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY ?? ''}`;
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  const pair       = new ethers.Contract(VLT_WETH_PAIR, PAIR_ABI, provider);
  const shareToken = new ethers.Contract(VLT_USDC_TOKEN, ERC20_ABI, provider);

  const [reservesResult, pairTotalSupplyResult, vaultLPResult, shareTotalSupplyResult, ethPriceUsd] =
    await Promise.all([
      pair.getReserves().catch(() => null),
      pair.totalSupply().catch(() => null),
      pair.balanceOf(VAULT_ADDRESS).catch(() => null),
      shareToken.totalSupply().catch(() => null),
      getEthPriceUsd(),
    ]);

  const vlt = getVltMarketData();
  const vltPriceUsd = vlt.priceUsd;

  // If any on-chain call failed, return fallback
  if (!reservesResult || !pairTotalSupplyResult || !vaultLPResult || !shareTotalSupplyResult) {
    console.warn('[vltUSDC] On-chain fetch incomplete — using fallback stats');
    return buildFallback(vltPriceUsd, ethPriceUsd);
  }

  const reserve0    = Number(ethers.formatUnits(reservesResult[0], 18)); // VLT (token0)
  const reserve1    = Number(ethers.formatUnits(reservesResult[1], 18)); // WETH (token1)
  const totalLP     = Number(ethers.formatUnits(pairTotalSupplyResult, 18));
  const vaultLP     = Number(ethers.formatUnits(vaultLPResult, 18));
  const totalShares = shareTotalSupplyResult as bigint;

  const vaultShare  = totalLP > 0 ? vaultLP / totalLP : 0;
  const vaultVLT    = reserve0 * vaultShare;
  const vaultWETH   = reserve1 * vaultShare;
  const tvlUsd      = (vaultVLT * vltPriceUsd) + (vaultWETH * ethPriceUsd);

  const lPerShare   = Number(totalShares) > 0
    ? vaultLP / (Number(ethers.formatUnits(totalShares, 18)))
    : 1.0;

  return {
    vault: {
      address: VAULT_ADDRESS,
      shareToken: 'vltUSDC',
      shareTokenAddress: VLT_USDC_TOKEN,
      underlyingPair: 'VLT/WETH',
      pairAddress: VLT_WETH_PAIR,
      network: 'Ethereum Mainnet',
    },
    stats: {
      tvlUsd: parseFloat(tvlUsd.toFixed(2)),
      vltInVault: parseFloat(vaultVLT.toFixed(4)),
      wethInVault: parseFloat(vaultWETH.toFixed(6)),
      wethUsd: parseFloat((vaultWETH * ethPriceUsd).toFixed(2)),
      totalSharesVltUsdc: totalShares.toString(),
      lPerShare: parseFloat(lPerShare.toFixed(6)),
      aprPct: null,
      aprDisplay: 'New',
      vltPriceUsd,
      ethPriceUsd,
      poolVltTotal: parseFloat(reserve0.toFixed(4)),
      poolWethTotal: parseFloat(reserve1.toFixed(6)),
    },
    deposit: {
      acceptedToken: 'USDC (Ethereum Mainnet)',
      usdcAddress: USDC_ETH,
      vaultAddress: VAULT_ADDRESS,
      minDeposit: '1 USDC',
      network: 'Ethereum Mainnet',
      chainId: 1,
    },
    x402Service: {
      endpoint: 'POST /x402/vlt-usdc-deposit',
      price: 'free',
      description: 'FREE — Returns unsigned USDC approve + vault deposit calldata for Ethereum mainnet. No payment required. Agent signs and broadcasts.',
    },
    source: 'live',
    updatedAt: new Date().toISOString(),
  };
}

function buildFallback(vltPriceUsd: number, ethPriceUsd: number): VltUsdcStats {
  return {
    vault: {
      address: VAULT_ADDRESS,
      shareToken: 'vltUSDC',
      shareTokenAddress: VLT_USDC_TOKEN,
      underlyingPair: 'VLT/WETH',
      pairAddress: VLT_WETH_PAIR,
      network: 'Ethereum Mainnet',
    },
    stats: {
      tvlUsd: 0,
      vltInVault: 0,
      wethInVault: 0,
      wethUsd: 0,
      totalSharesVltUsdc: '0',
      lPerShare: 1.0,
      aprPct: null,
      aprDisplay: 'New',
      vltPriceUsd,
      ethPriceUsd,
      poolVltTotal: 0,
      poolWethTotal: 0,
    },
    deposit: {
      acceptedToken: 'USDC (Ethereum Mainnet)',
      usdcAddress: USDC_ETH,
      vaultAddress: VAULT_ADDRESS,
      minDeposit: '1 USDC',
      network: 'Ethereum Mainnet',
      chainId: 1,
    },
    x402Service: {
      endpoint: 'POST /x402/vlt-usdc-deposit',
      price: 'free',
      description: 'FREE — Returns unsigned USDC approve + vault deposit calldata for Ethereum mainnet. No payment required. Agent signs and broadcasts.',
    },
    source: 'fallback',
    updatedAt: new Date().toISOString(),
  };
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Returns cached stats, triggers background refresh if stale. */
export function getVltUsdcStats(): VltUsdcStats | null {
  if (Date.now() - lastFetchMs > CACHE_TTL_MS && !fetchInProgress) {
    fetchInProgress = true;
    fetchLiveStats()
      .then(stats => {
        cachedStats = stats;
        lastFetchMs = Date.now();
        console.log(`[vltUSDC] stats refreshed — TVL $${stats.stats.tvlUsd} | lPerShare ${stats.stats.lPerShare}`);
      })
      .catch(err => console.warn('[vltUSDC] stats fetch error:', err?.message))
      .finally(() => { fetchInProgress = false; });
  }
  return cachedStats;
}

/** Force-fetches fresh stats (used by the API endpoint on first call). */
export async function getVltUsdcStatsFresh(): Promise<VltUsdcStats> {
  try {
    const stats = await fetchLiveStats();
    cachedStats = stats;
    lastFetchMs = Date.now();
    return stats;
  } catch (err: any) {
    console.warn('[vltUSDC] fresh fetch failed:', err?.message);
    const vlt = getVltMarketData();
    return buildFallback(vlt.priceUsd, 3500);
  }
}

// Warm the cache on module load (non-blocking)
getVltUsdcStatsFresh().catch(() => {});
