/**
 * VLT (Bankroll Vault) live market data cache.
 * Fetches from CoinGecko (price/vol/mcap) + DexScreener (pool liquidity)
 * every 5 minutes. Returns the last known good values on failure.
 * All consumers call getVltMarketData() — zero latency for callers
 * because the refresh is always background.
 */

export interface VltMarketData {
  priceUsd: number;
  priceEth: number;
  vol24hUsd: number;
  marketCapUsd: number;
  liquidityUsd: number;
  supply: number;
  priceChangePercent24h: number;
  updatedAt: Date;
  source: 'live' | 'seed';
}

// Seed values — updated Jun 27 2026. Only used until first live fetch completes.
const SEED: VltMarketData = {
  priceUsd: 0.3212,
  priceEth: 0.00020076,
  vol24hUsd: 179340,
  marketCapUsd: 578217,
  liquidityUsd: 561632,
  supply: 1800000,
  priceChangePercent24h: 0,
  updatedAt: new Date(),
  source: 'seed',
};

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const VLT_ADDRESS = '0x6b785a0322126826d8226d77e173d75DAfb84d11';
const CG_COIN_URL =
  'https://api.coingecko.com/api/v3/coins/bankroll-vault?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false';
const DS_URL = `https://api.dexscreener.com/latest/dex/tokens/${VLT_ADDRESS}`;

let cached: VltMarketData = { ...SEED };
let lastFetchAt = 0;
let fetchInProgress = false;

async function fetchLive(): Promise<void> {
  if (fetchInProgress) return;
  fetchInProgress = true;
  try {
    const [cgResult, dsResult] = await Promise.allSettled([
      fetch(CG_COIN_URL, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10_000) }),
      fetch(DS_URL,       { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10_000) }),
    ]);

    let { priceUsd, priceEth, vol24hUsd, marketCapUsd, priceChangePercent24h } = cached;

    if (cgResult.status === 'fulfilled' && cgResult.value.ok) {
      try {
        const d = await cgResult.value.json();
        const m = d?.market_data;
        if (m?.current_price?.usd)              priceUsd              = Number(m.current_price.usd);
        if (m?.current_price?.eth)              priceEth              = Number(m.current_price.eth);
        if (m?.total_volume?.usd)               vol24hUsd             = Number(m.total_volume.usd);
        if (m?.market_cap?.usd)                 marketCapUsd          = Number(m.market_cap.usd);
        if (m?.price_change_percentage_24h != null)
          priceChangePercent24h = Number(m.price_change_percentage_24h);
      } catch { /* keep prev values */ }
    }

    let { liquidityUsd } = cached;
    if (dsResult.status === 'fulfilled' && dsResult.value.ok) {
      try {
        const d = await dsResult.value.json();
        const pairs: any[] = d?.pairs ?? [];
        const best = pairs.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
        if (best?.liquidity?.usd) liquidityUsd = Number(best.liquidity.usd);
      } catch { /* keep prev values */ }
    }

    cached = {
      priceUsd,
      priceEth,
      vol24hUsd,
      marketCapUsd,
      liquidityUsd,
      supply: 1_800_000,
      priceChangePercent24h,
      updatedAt: new Date(),
      source: 'live',
    };
    lastFetchAt = Date.now();
    console.log(`[VLT cache] refreshed — $${priceUsd.toFixed(4)} | mcap $${Math.round(marketCapUsd).toLocaleString()} | liq $${Math.round(liquidityUsd).toLocaleString()}`);
  } catch (err: any) {
    console.warn('[VLT cache] refresh error:', err?.message);
  } finally {
    fetchInProgress = false;
  }
}

/** Returns the latest cached VLT market data. Triggers a background refresh if stale. */
export function getVltMarketData(): VltMarketData {
  if (Date.now() - lastFetchAt > CACHE_TTL_MS) {
    fetchLive().catch(() => {});
  }
  return cached;
}

// Warm the cache immediately on module load (non-blocking)
fetchLive().catch(() => {});

// Periodic background refresh
setInterval(() => fetchLive().catch(() => {}), CACHE_TTL_MS).unref();
