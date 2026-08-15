/**
 * vltUSDC Vault — live stats reader (Ethereum Mainnet)
 *
 * Vault contract (= vltUSDC ERC-20 share token):
 *   0xee8d4c5c768AadCd3517Aa8C908De300305D0A7f
 *
 * ZapHelper (USDC-only periphery — NOT the vault):
 *   0x348A57b1dc6E3dCAa645DE6e4E864924B410525D
 *
 * Underlying pool: VLT/USDC full-range, Uniswap V4, 1% fee, tickSpacing=200
 *   VLT  (token0): 0x6b785a0322126826d8226d77e173d75DAfb84d11
 *   USDC (token1): 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
 *
 * V4 PoolManager: 0xe0554a476a092703abdb3ef35c80e0d76d32939f
 *
 * Shares are denominated in Uniswap V4 liquidity units (L), NOT USD.
 * L/share starts at 1.0 and grows as fees auto-compound.
 * No oracle — share value is a pro-rata claim on the V4 position.
 *
 * Stats derivation:
 *   1. vault.positionLiquidity() → L (uint128) = total position liquidity
 *   2. vault.totalSupply()       → total vltUSDC shares (same units as L)
 *   3. L/share = positionLiquidity / totalSupply
 *   4. TVL via DexScreener: find VLT/USDC pair on Ethereum, use liquidity USD
 */

import { ethers } from 'ethers';
import { getVltMarketData } from './vltMarketCache.js';
import { VAULT_ADDRESS, VLT_TOKEN, USDC_ETH, ZAP_HELPER, VAULT_STATS_ABI } from './vltSharedAbi.js';

export interface VltUsdcStats {
  vault: {
    address: string;
    shareToken: string;
    shareTokenAddress: string;
    zapHelper: string;
    underlyingPool: string;
    poolFee: string;
    network: string;
  };
  stats: {
    tvlUsd: number;
    positionLiquidity: string;
    totalSharesVltUsdc: string;
    lPerShare: number;
    aprPct: number | null;
    aprDisplay: string;
    vltPriceUsd: number;
    ethPriceUsd: number;
  };
  deposit: {
    acceptedTokens: string;
    vltAddress: string;
    usdcAddress: string;
    vaultAddress: string;
    zapHelperAddress: string;
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

const CACHE_TTL_MS = 2 * 60 * 1000;
let cachedStats: VltUsdcStats | null = null;
let lastFetchMs = 0;
let fetchInProgress = false;

async function getVltUsdcTvlFromDexScreener(): Promise<number> {
  try {
    const r = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${VLT_TOKEN}`,
      { signal: AbortSignal.timeout(8_000) }
    );
    if (!r.ok) throw new Error('DexScreener non-ok');
    const d = await r.json();
    const pairs: any[] = d?.pairs ?? [];

    // Deterministic match: VLT/USDC on Ethereum — both token addresses must match
    const usdcLower = USDC_ETH.toLowerCase();
    const vltUsdc = pairs.find((p: any) =>
      p.chainId === 'ethereum' &&
      (p.quoteToken?.address?.toLowerCase() === usdcLower ||
       p.baseToken?.address?.toLowerCase() === usdcLower)
    );
    if (vltUsdc?.liquidity?.usd) return Number(vltUsdc.liquidity.usd);

    // No VLT/USDC pair found yet — return 0 rather than reporting unrelated pair liquidity
    return 0;
  } catch {
    return 0;
  }
}

async function fetchLiveStats(): Promise<VltUsdcStats> {
  const rpcUrl = `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY ?? ''}`;
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const vault = new ethers.Contract(VAULT_ADDRESS, VAULT_STATS_ABI, provider);

  const [posLiqResult, totalSupplyResult, tvlUsd] = await Promise.all([
    vault.positionLiquidity().catch(() => null),
    vault.totalSupply().catch(() => null),
    getVltUsdcTvlFromDexScreener(),
  ]);

  const vlt = getVltMarketData();
  const vltPriceUsd = vlt.priceUsd;

  if (!posLiqResult || !totalSupplyResult) {
    console.warn('[vltUSDC] On-chain fetch incomplete — using fallback stats');
    return buildFallback(vltPriceUsd, tvlUsd);
  }

  const posLiq     = BigInt(posLiqResult.toString());
  const totalSupply = BigInt(totalSupplyResult.toString());

  // L/share: both in the same liquidity unit, ratio shows compound growth
  const lPerShare = totalSupply > 0n
    ? Number(posLiq) / Number(totalSupply)
    : 1.0;

  return {
    vault: {
      address: VAULT_ADDRESS,
      shareToken: 'vltUSDC',
      shareTokenAddress: VAULT_ADDRESS,
      zapHelper: ZAP_HELPER,
      underlyingPool: 'VLT/USDC · full-range · Uniswap V4 · 1% fee',
      poolFee: '1% per swap',
      network: 'Ethereum Mainnet',
    },
    stats: {
      tvlUsd: parseFloat(tvlUsd.toFixed(2)),
      positionLiquidity: posLiq.toString(),
      totalSharesVltUsdc: totalSupply.toString(),
      lPerShare: parseFloat(lPerShare.toFixed(6)),
      aprPct: null,
      aprDisplay: lPerShare > 1.0001 ? `${((lPerShare - 1) * 100).toFixed(3)}% lifetime L growth` : 'New (0% lifetime)',
      vltPriceUsd,
      ethPriceUsd: 0,
    },
    deposit: {
      acceptedTokens: 'VLT + USDC (balanced deposit direct to vault) or USDC-only via ZapHelper',
      vltAddress: VLT_TOKEN,
      usdcAddress: USDC_ETH,
      vaultAddress: VAULT_ADDRESS,
      zapHelperAddress: ZAP_HELPER,
      minDeposit: 'Any size',
      network: 'Ethereum Mainnet',
      chainId: 1,
    },
    x402Service: {
      endpoint: 'POST /x402/vlt-usdc-deposit',
      price: 'free',
      description: 'FREE — Returns unsigned VLT approve + USDC approve + vault.deposit calldata for Ethereum mainnet. Agent signs and broadcasts. Vault auto-compounds LP fees into the V4 VLT/USDC position.',
    },
    source: 'live',
    updatedAt: new Date().toISOString(),
  };
}

function buildFallback(vltPriceUsd: number, tvlUsd: number): VltUsdcStats {
  return {
    vault: {
      address: VAULT_ADDRESS,
      shareToken: 'vltUSDC',
      shareTokenAddress: VAULT_ADDRESS,
      zapHelper: ZAP_HELPER,
      underlyingPool: 'VLT/USDC · full-range · Uniswap V4 · 1% fee',
      poolFee: '1% per swap',
      network: 'Ethereum Mainnet',
    },
    stats: {
      tvlUsd: parseFloat(tvlUsd.toFixed(2)),
      positionLiquidity: '0',
      totalSharesVltUsdc: '0',
      lPerShare: 1.0,
      aprPct: null,
      aprDisplay: 'New',
      vltPriceUsd,
      ethPriceUsd: 0,
    },
    deposit: {
      acceptedTokens: 'VLT + USDC (balanced deposit direct to vault) or USDC-only via ZapHelper',
      vltAddress: VLT_TOKEN,
      usdcAddress: USDC_ETH,
      vaultAddress: VAULT_ADDRESS,
      zapHelperAddress: ZAP_HELPER,
      minDeposit: 'Any size',
      network: 'Ethereum Mainnet',
      chainId: 1,
    },
    x402Service: {
      endpoint: 'POST /x402/vlt-usdc-deposit',
      price: 'free',
      description: 'FREE — Returns unsigned VLT approve + USDC approve + vault.deposit calldata for Ethereum mainnet.',
    },
    source: 'fallback',
    updatedAt: new Date().toISOString(),
  };
}

export function getVltUsdcStats(): VltUsdcStats | null {
  if (Date.now() - lastFetchMs > CACHE_TTL_MS && !fetchInProgress) {
    fetchInProgress = true;
    fetchLiveStats()
      .then(stats => {
        cachedStats = stats;
        lastFetchMs = Date.now();
        console.log(`[vltUSDC] stats refreshed — TVL $${stats.stats.tvlUsd} | L/share ${stats.stats.lPerShare}`);
      })
      .catch(async (err) => {
        // On refresh failure: serve the last good cache if available, otherwise build a fallback.
        // Always update lastFetchMs so we back off and don't hammer the RPC on every request.
        console.warn('[vltUSDC] stats fetch error:', err?.message);
        if (!cachedStats) {
          const vlt = getVltMarketData();
          const tvl = await getVltUsdcTvlFromDexScreener().catch(() => 0);
          cachedStats = buildFallback(vlt.priceUsd, tvl);
        }
        lastFetchMs = Date.now(); // back off — don't retry until next TTL window
      })
      .finally(() => { fetchInProgress = false; });
  }
  return cachedStats;
}

export async function getVltUsdcStatsFresh(): Promise<VltUsdcStats> {
  try {
    const stats = await fetchLiveStats();
    cachedStats = stats;
    lastFetchMs = Date.now();
    return stats;
  } catch (err: any) {
    console.warn('[vltUSDC] fresh fetch failed:', err?.message);
    const vlt = getVltMarketData();
    const tvl = await getVltUsdcTvlFromDexScreener().catch(() => 0);
    return buildFallback(vlt.priceUsd, tvl);
  }
}

getVltUsdcStatsFresh().catch((err: any) => {
  console.error(
    '[vltUSDC] CRITICAL: Vault startup probe failed — vault services may return degraded data.',
    `Vault: ${VAULT_ADDRESS} | Error: ${err?.message ?? String(err)}`,
  );
});
