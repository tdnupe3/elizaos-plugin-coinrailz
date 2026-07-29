/**
 * vlt-stats service — aggregates VLT token market data and vltUSDC vault stats
 * into a single agent-readable payload.
 *
 * Data sources (both are cached — zero latency for callers):
 *   • getVltMarketData()  → CoinGecko + DexScreener (5-min TTL, background refresh)
 *   • getVltUsdcStats()   → Alchemy RPC + DexScreener (2-min TTL, background refresh)
 *
 * APR estimate: 24h volume × 1% fee × 365 ÷ TVL
 * This is the standard LP fee APR formula. Actual yield depends on trading activity
 * and auto-compounds into each vltUSDC share (L/share grows over time).
 */

import { getVltMarketData } from './vltMarketCache.js';
import { getVltUsdcStats }   from './vltUsdcVaultService.js';

// Pool constants — Uniswap V4, VLT/USDC full-range, Ethereum Mainnet
const POOL_FEE_BPS    = 100;   // 1% fee tier
const POOL_TICK_SPACING = 200;
const POOL_MANAGER    = '0xe0554a476a092703abdb3ef35c80e0d76d32939f';
const VLT_ADDRESS     = '0x6b785a0322126826d8226d77e173d75DAfb84d11';
const USDC_ADDRESS    = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const VAULT_ADDRESS   = '0xee8d4c5c768AadCd3517Aa8C908De300305D0A7f';

export interface VltStatsResult {
  success: boolean;
  vlt: {
    priceUsd: number;
    marketCapUsd: number;
    liquidityUsd: number;
    vol24hUsd: number;
    priceChangePercent24h: number;
    supply: number;
    address: string;
    network: string;
    priceSource: string;
  };
  vltUsdc: {
    tvlUsd: number;
    aprPct: number | null;
    aprDisplay: string;
    aprNote: string;
    lPerShare: number;
    totalShares: string;
    positionLiquidity: string;
    vaultAddress: string;
    shareToken: string;
    underlyingPool: string;
  };
  pool: {
    fee: string;
    feeBps: number;
    tickSpacing: number;
    poolManagerAddress: string;
    vltAddress: string;
    usdcAddress: string;
    dex: string;
    network: string;
    chainId: number;
  };
  dataAge: {
    vltMarketAgeSeconds: number;
    vaultStatsUpdatedAt: string;
    vltMarketUpdatedAt: string;
    dataSource: string;
  };
  x402Services: {
    deposit: string;
    withdraw: string;
    stats: string;
  };
  agentInstructions: string;
}

/**
 * Returns a live snapshot of VLT + vltUSDC stats.
 * Both underlying caches are always warm — this call is synchronous and fast.
 */
export function getVltStats(): VltStatsResult {
  const vlt         = getVltMarketData();
  const vaultStats  = getVltUsdcStats();

  const now           = Date.now();
  const vltAgeSeconds = Math.round((now - vlt.updatedAt.getTime()) / 1000);

  // APR estimate: annual LP fee revenue ÷ TVL
  const tvlUsd  = vaultStats?.stats.tvlUsd ?? 0;
  const vol24h  = vlt.vol24hUsd;

  let aprPct: number | null = null;
  let aprDisplay = 'Insufficient data (vault or volume data not yet loaded)';
  const aprNote  =
    'Estimated LP fee APR: 24h trading volume × 1% pool fee × 365 ÷ TVL. ' +
    'Yield auto-compounds into each vltUSDC share — L/share grows over time without claiming.';

  if (tvlUsd > 0 && vol24h > 0) {
    const annualFeeRevenue = vol24h * (POOL_FEE_BPS / 10000) * 365;
    aprPct     = parseFloat(((annualFeeRevenue / tvlUsd) * 100).toFixed(2));
    aprDisplay = `~${aprPct.toFixed(0)}% estimated LP fee APR`;
  } else if (vaultStats?.stats.aprDisplay) {
    aprDisplay = vaultStats.stats.aprDisplay;
  }

  const vltPriceStr   = vlt.priceUsd > 0 ? `$${vlt.priceUsd.toFixed(4)}/VLT` : 'unknown';
  const tvlStr        = tvlUsd > 0 ? `$${Math.round(tvlUsd).toLocaleString()}` : 'unknown';
  const vol24hStr     = vol24h > 0 ? `$${Math.round(vol24h).toLocaleString()}` : 'unknown';

  return {
    success: true,

    vlt: {
      priceUsd:              vlt.priceUsd,
      marketCapUsd:          vlt.marketCapUsd,
      liquidityUsd:          vlt.liquidityUsd,
      vol24hUsd:             vlt.vol24hUsd,
      priceChangePercent24h: vlt.priceChangePercent24h,
      supply:                vlt.supply,
      address:               VLT_ADDRESS,
      network:               'Ethereum Mainnet',
      priceSource:           vlt.source,
    },

    vltUsdc: {
      tvlUsd,
      aprPct,
      aprDisplay,
      aprNote,
      lPerShare:          vaultStats?.stats.lPerShare ?? 1.0,
      totalShares:        vaultStats?.stats.totalSharesVltUsdc ?? '0',
      positionLiquidity:  vaultStats?.stats.positionLiquidity ?? '0',
      vaultAddress:       VAULT_ADDRESS,
      shareToken:         'vltUSDC',
      underlyingPool:     'VLT/USDC · full-range · Uniswap V4 · 1% fee',
    },

    pool: {
      fee:               '1% per swap',
      feeBps:            POOL_FEE_BPS,
      tickSpacing:       POOL_TICK_SPACING,
      poolManagerAddress: POOL_MANAGER,
      vltAddress:        VLT_ADDRESS,
      usdcAddress:       USDC_ADDRESS,
      dex:               'Uniswap V4',
      network:           'Ethereum Mainnet',
      chainId:           1,
    },

    dataAge: {
      vltMarketAgeSeconds: vltAgeSeconds,
      vaultStatsUpdatedAt: vaultStats?.updatedAt ?? new Date().toISOString(),
      vltMarketUpdatedAt:  vlt.updatedAt.toISOString(),
      dataSource:          vaultStats?.source ?? 'seed',
    },

    x402Services: {
      deposit:  'POST /x402/vlt-usdc-deposit (free — unsigned deposit calldata)',
      withdraw: 'POST /x402/vlt-usdc-withdraw (free — unsigned redeem calldata)',
      stats:    'POST /x402/vlt-stats ($0.05 — this service)',
    },

    agentInstructions: [
      'vlt-stats returns a live snapshot of VLT token market data and the vltUSDC Bankroll Network vault on Ethereum mainnet.',
      `VLT (${VLT_ADDRESS}) is the governance + yield-bearing token of the Bankroll Network. Current price: ${vltPriceStr}.`,
      'vltUSDC is an ERC-20 vault share token representing a full-range VLT/USDC position in Uniswap V4, with fees auto-compounding into each share (L/share grows over time).',
      `Vault TVL: ${tvlStr}. 24h trading volume: ${vol24hStr}.`,
      aprPct !== null
        ? `Estimated LP fee APR: ${aprDisplay}. ${aprNote}`
        : `APR estimate unavailable — vault TVL or volume not yet loaded. ${aprNote}`,
      'To enter the vault: call POST /x402/vlt-usdc-deposit (free) with {amountUsdc, recipient}.',
      'To exit the vault: call POST /x402/vlt-usdc-withdraw (free) with {shares, recipient}.',
    ].join(' '),
  };
}
