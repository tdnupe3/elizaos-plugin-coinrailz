/**
 * Solana Yield Keeper — Coin Railz Solana Yield Portal
 * ISOLATED: no shared code with Base/EVM yieldVaultKeeper.
 *
 * Responsibilities (v1 — no protocol rebalancing):
 *   - Hourly APY snapshots → solana_yield_rate_snapshots
 *   - Reserve health checks (utilization, liquidity)
 *   - Pause-flag monitoring
 *   - Position valuation refresh for active wallets
 *
 * Uses recursive setTimeout (not setInterval) so cycles never overlap.
 */

import axios from 'axios';
import { dialectMarketsService } from '../services/dialectMarketsService.js';
import { getKaminoMarket, invalidateMarketCache, SOLANA_YIELD_CONFIG, getSolanaYieldConnection } from '../services/solanaYield/kaminoClient.js';
import { db } from '../db.js';
import { solanaYieldRateSnapshots, solanaYieldPositions, solanaYieldEvents } from '@shared/schema';
import { eq, and, gte } from 'drizzle-orm';

const INTERVAL_MS = 60 * 60 * 1_000; // 1 hour

let _keeperRunning = false;
let _keeperTimeout: ReturnType<typeof setTimeout> | null = null;

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

    let apyPct: number | null = kaminoRate?.apy ?? null;

    // Fallback: DeFiLlama if Dialect unavailable (Dialect returns 401 when key missing)
    if (apyPct == null) {
      try {
        const KAMINO_USDC_LLAMA_POOL = 'd2141a59-c199-4be7-8d4b-c8223954836b';
        const { data } = await axios.get(
          `https://yields.llama.fi/chart/${KAMINO_USDC_LLAMA_POOL}`,
          { timeout: 6000 },
        );
        const pts: any[] = data?.data ?? [];
        const latest = pts[pts.length - 1];
        if (latest?.apy != null && latest.apy > 0) {
          apyPct = latest.apy;
          console.log(`[SolanaYieldKeeper] APY from DeFiLlama fallback: ${apyPct?.toFixed(2)}%`);
        }
      } catch (llamaErr: any) {
        console.warn('[SolanaYieldKeeper] DeFiLlama fallback failed:', llamaErr?.message);
      }
    }

    const apyBps  = apyPct != null ? Math.round(apyPct * 100) : 0;

    // ── 2. Force-refresh on-chain market data ─────────────────────────────────
    let reserveAddr    = 'unknown';
    let tvlUsdc        = 0;
    let liquidityUsdc  = 0;
    let utilizationPct = 0;

    try {
      invalidateMarketCache();
      const market  = await getKaminoMarket(true);
      const reserve = market.getReserveByMint(SOLANA_YIELD_CONFIG.USDC_MINT);
      if (reserve) {
        reserveAddr    = reserve.address.toString();
        tvlUsdc        = Number(reserve.getTotalSupply().toString()) / 1e6;
        liquidityUsdc  = Number(reserve.getLiquidityAvailableAmount().toString()) / 1e6;
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

    // ── 6. Reconcile pending_verification events ─────────────────────────────
    // Re-check sigs that /confirm couldn't fully verify (node unavailable/pruned).
    // Only look back 2 hours — events older than that are stale and should be
    // left as-is (manual investigation).
    try {
      const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1_000);
      const pendingEvts = await db
        .select()
        .from(solanaYieldEvents)
        .where(and(eq(solanaYieldEvents.status, 'pending_verification'), gte(solanaYieldEvents.createdAt, cutoff)))
        .limit(20);

      if (pendingEvts.length > 0) {
        const conn = getSolanaYieldConnection();
        let promoted = 0;

        for (const evt of pendingEvts) {
          if (!evt.txSignature || !evt.wallet) continue;
          try {
            const statuses = await conn.getSignatureStatuses([evt.txSignature], { searchTransactionHistory: true });
            const sigStatus = statuses?.value?.[0];
            if (!sigStatus) continue; // still propagating — leave as pending_verification

            if (sigStatus.err) {
              await db.update(solanaYieldEvents)
                .set({ status: 'failed', errorMessage: `On-chain tx failed: ${JSON.stringify(sigStatus.err)}` })
                .where(eq(solanaYieldEvents.id, evt.id));
              continue;
            }

            if (sigStatus.confirmationStatus !== 'confirmed' && sigStatus.confirmationStatus !== 'finalized') continue;

            // Verify signer — required before promotion to confirmed
            let signerVerified = false;
            try {
              const txDetail = await conn.getTransaction(evt.txSignature, {
                maxSupportedTransactionVersion: 0,
                commitment: 'confirmed',
              });
              if (txDetail) {
                const accountKeys = txDetail.transaction.message.getAccountKeys?.()?.staticAccountKeys
                                 ?? (txDetail.transaction.message as any).accountKeys ?? [];
                const signerAddrs = accountKeys
                  .slice(0, txDetail.transaction.message.header?.numRequiredSignatures ?? accountKeys.length)
                  .map((k: any) => k.toString?.() ?? k);
                signerVerified = signerAddrs.includes(evt.wallet);
              }
            } catch { /* pruned — skip this round, retry next cycle */ }

            if (!signerVerified) continue;

            // Promote to confirmed
            await db.update(solanaYieldEvents)
              .set({
                status:       'confirmed',
                errorMessage: `Keeper verified on-chain at slot ${sigStatus.slot ?? 'unknown'}`,
              })
              .where(eq(solanaYieldEvents.id, evt.id));

            // Upsert active position for deposit confirmations
            if (evt.eventType === 'deposit_confirmed') {
              const existingPos = await db
                .select()
                .from(solanaYieldPositions)
                .where(and(eq(solanaYieldPositions.wallet, evt.wallet), eq(solanaYieldPositions.status, 'active')))
                .limit(1);

              if (existingPos.length === 0) {
                const mktAddr     = process.env.SOLANA_YIELD_KAMINO_MARKET || SOLANA_YIELD_CONFIG.DEFAULT_MARKET;
                const collatMint  = SOLANA_YIELD_CONFIG.USDC_MINT.toString();
                await db.insert(solanaYieldPositions).values({
                  wallet:             evt.wallet,
                  market:             mktAddr,
                  reserveAddress:     'pending',
                  collateralMint:     collatMint,
                  depositedUsdcRaw:   evt.amountUsdcRaw ?? '0',
                  txSignatureDeposit: evt.txSignature,
                  status:             'active',
                });
              } else {
                const prev = BigInt(existingPos[0].depositedUsdcRaw ?? '0');
                const add  = BigInt(evt.amountUsdcRaw ?? '0');
                await db.update(solanaYieldPositions)
                  .set({ depositedUsdcRaw: (prev + add).toString(), updatedAt: new Date() })
                  .where(eq(solanaYieldPositions.id, existingPos[0].id));
              }
            }

            promoted++;
          } catch { /* non-fatal per-event — continue loop */ }
        }

        if (promoted > 0) {
          console.log(`[SolanaYieldKeeper] Reconciled ${promoted}/${pendingEvts.length} pending_verification events`);
        } else if (pendingEvts.length > 0) {
          console.log(`[SolanaYieldKeeper] ${pendingEvts.length} pending_verification event(s) still awaiting on-chain confirmation`);
        }
      }
    } catch (reconcileErr: any) {
      console.warn('[SolanaYieldKeeper] Reconciliation step failed (non-fatal):', reconcileErr.message);
    }

  } catch (err: any) {
    console.error('[SolanaYieldKeeper] Cycle error:', err.message);
  }
}

// ── Recursive scheduler — ensures no cycle overlap ───────────────────────────

function scheduleNextCycle(): void {
  if (!_keeperRunning) return;

  _keeperTimeout = setTimeout(async () => {
    try {
      await runKeeperCycle();
    } catch (err: any) {
      console.warn('[SolanaYieldKeeper] Uncaught cycle error:', err.message);
    } finally {
      scheduleNextCycle();
    }
  }, INTERVAL_MS);
}

export function startSolanaYieldKeeper(): void {
  if (_keeperRunning) {
    console.warn('[SolanaYieldKeeper] Already running — skipping duplicate start');
    return;
  }

  const enabled = process.env.SOLANA_YIELD_ENABLED === 'true';
  if (!enabled) {
    console.log('[SolanaYieldKeeper] Disabled (SOLANA_YIELD_ENABLED != true) — not starting');
    return;
  }

  _keeperRunning = true;
  console.log(`[SolanaYieldKeeper] Starting (interval: ${INTERVAL_MS / 1000 / 60}min, recursive-setTimeout)`);

  // Run immediately on start, then schedule recursive chain
  runKeeperCycle()
    .catch(err => console.warn('[SolanaYieldKeeper] Initial cycle failed (non-fatal):', err.message))
    .finally(() => scheduleNextCycle());

  console.log('[SolanaYieldKeeper] Keeper registered (1h recursive interval)');
}

export function stopSolanaYieldKeeper(): void {
  _keeperRunning = false;
  if (_keeperTimeout) {
    clearTimeout(_keeperTimeout);
    _keeperTimeout = null;
  }
  console.log('[SolanaYieldKeeper] Stopped');
}
