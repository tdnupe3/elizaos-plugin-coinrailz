/**
 * Solana Yield Keeper — Coin Railz Solana Yield Portal
 * ISOLATED: no shared code with Base/EVM yieldVaultKeeper.
 *
 * Responsibilities (v1 — no protocol rebalancing):
 *   - Hourly APY snapshots → solana_yield_rate_snapshots
 *   - Reserve health checks (utilization, liquidity)
 *   - Pause-flag monitoring
 *   - Position valuation refresh for active wallets
 */

import { dialectMarketsService } from '../services/dialectMarketsService.js';
import { getKaminoMarket, invalidateMarketCache, SOLANA_YIELD_CONFIG } from '../services/solanaYield/kaminoClient.js';
import { db } from '../db.js';
import { solanaYieldRateSnapshots, solanaYieldPositions } from '@shared/schema';
import { eq } from 'drizzle-orm';

const INTERVAL_MS = 60 * 60 * 1_000; // 1 hour

let _keeperInterval: ReturnType<typeof setInterval> | null = null;

async function runKeeperCycle(): Promise<void> {
  const isPaused = process.env.SOLANA_YIELD_PAUSED === 'true';
  if (isPaused) {
    console.log('[SolanaYieldKeeper] Paused — skipping cycle');
    return;
  }

  console.log('[SolanaYieldKeeper] Starting keeper cycle...');
  const start = Date.now();

  try {
    // ── 1. Fetch live rates from Dialect ─────────────────────────────────────
    const dialectData = await dialectMarketsService.getTopYields({
      token:    'USDC',
      protocol: 'kamino',
      type:     'lending',
      limit:    3,
    }).catch(() => null);

    const kaminoRate = dialectData?.topYields?.find(
      (y: any) => y.protocol?.toLowerCase().includes('kamino') || y.name?.toLowerCase().includes('kamino'),
    ) ?? dialectData?.topYields?.[0];

    const apyPct  = kaminoRate?.apy ?? null;
    const apyBps  = apyPct != null ? Math.round(apyPct * 100) : 0;

    // ── 2. Force-refresh on-chain market data ─────────────────────────────────
    let reserveAddr  = 'unknown';
    let tvlUsdc      = 0;
    let liquidityUsdc = 0;
    let utilizationPct = 0;

    try {
      invalidateMarketCache();
      const market  = await getKaminoMarket(true);
      const reserve = market.getReserveByMint(SOLANA_YIELD_CONFIG.USDC_MINT);
      if (reserve) {
        reserveAddr    = reserve.address.toString();
        tvlUsdc        = Number(reserve.getDepositTvl().toString());
        liquidityUsdc  = Number(reserve.getLiquidityAvailableAmount().toString());
        const total    = tvlUsdc > 0 ? tvlUsdc : 1;
        utilizationPct = Math.max(0, Math.min(100, ((total - liquidityUsdc) / total) * 100));
      }
    } catch (onChainErr: any) {
      console.warn('[SolanaYieldKeeper] On-chain reserve fetch failed (non-fatal):', onChainErr.message);
    }

    // ── 3. Persist rate snapshot ──────────────────────────────────────────────
    const marketAddr = process.env.SOLANA_YIELD_KAMINO_MARKET || SOLANA_YIELD_CONFIG.DEFAULT_MARKET;

    await db.insert(solanaYieldRateSnapshots).values({
      market:         marketAddr,
      reserveAddress: reserveAddr,
      apyBps,
      supplyApyBps:   apyBps,
      liquidityUsdc:  liquidityUsdc.toFixed(2),
      utilizationPct: utilizationPct.toFixed(2),
      source:         'dialect+onchain',
    });

    console.log(
      `[SolanaYieldKeeper] Snapshot: APY=${(apyBps / 100).toFixed(2)}% ` +
      `TVL=$${tvlUsdc.toFixed(2)} Util=${utilizationPct.toFixed(1)}% ` +
      `(${Date.now() - start}ms)`,
    );

    // ── 4. Health check: warn on high utilization ─────────────────────────────
    if (utilizationPct > 95) {
      console.warn(
        `[SolanaYieldKeeper] ⚠️  HIGH UTILIZATION: ${utilizationPct.toFixed(1)}% — ` +
        'withdrawals may fail if liquidity is too low',
      );
    }

    // ── 5. Refresh last_valuation_usdc for active positions ───────────────────
    // This is best-effort — position value will be re-read on-demand via readPosition()
    const activePositions = await db
      .select()
      .from(solanaYieldPositions)
      .where(eq(solanaYieldPositions.status, 'active'))
      .limit(50);

    if (activePositions.length > 0) {
      const { readPosition } = await import('../services/solanaYield/positionReader.js');
      for (const pos of activePositions) {
        try {
          const position = await readPosition(pos.wallet);
          if (position.hasPosition) {
            await db
              .update(solanaYieldPositions)
              .set({
                lastValuationUsdc: position.currentValueUsdc.toFixed(6),
                updatedAt:         new Date(),
              })
              .where(eq(solanaYieldPositions.id, pos.id));
          }
        } catch { /* non-fatal — individual position refresh failure */ }
      }
      console.log(`[SolanaYieldKeeper] Refreshed ${activePositions.length} position valuations`);
    }

  } catch (err: any) {
    console.error('[SolanaYieldKeeper] Cycle error:', err.message);
  }
}

export function startSolanaYieldKeeper(): void {
  if (_keeperInterval) {
    console.warn('[SolanaYieldKeeper] Already running — skipping duplicate start');
    return;
  }

  const enabled = process.env.SOLANA_YIELD_ENABLED === 'true';
  if (!enabled) {
    console.log('[SolanaYieldKeeper] Disabled (SOLANA_YIELD_ENABLED != true) — not starting');
    return;
  }

  console.log(`[SolanaYieldKeeper] Starting (interval: ${INTERVAL_MS / 1000 / 60}min)`);

  // Run immediately on start, then on interval
  runKeeperCycle().catch(err =>
    console.warn('[SolanaYieldKeeper] Initial cycle failed (non-fatal):', err.message),
  );

  _keeperInterval = setInterval(() => {
    runKeeperCycle().catch(err =>
      console.warn('[SolanaYieldKeeper] Interval cycle failed (non-fatal):', err.message),
    );
  }, INTERVAL_MS);

  console.log('[SolanaYieldKeeper] Keeper registered (1h interval)');
}

export function stopSolanaYieldKeeper(): void {
  if (_keeperInterval) {
    clearInterval(_keeperInterval);
    _keeperInterval = null;
    console.log('[SolanaYieldKeeper] Stopped');
  }
}
