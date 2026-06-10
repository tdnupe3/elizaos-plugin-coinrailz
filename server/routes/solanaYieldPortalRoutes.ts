/**
 * Solana USDC Yield Portal — API Routes
 * ISOLATED from Base/EVM vault — separate file, separate keeper, separate tables.
 *
 * GET  /api/solana-yield/rates          — live APY from Kamino (via Dialect + on-chain)
 * GET  /api/solana-yield/stats          — TVL, reserve health, protocol info
 * GET  /api/solana-yield/position/:wallet — agent's current position (free)
 * POST /api/solana-yield/deposit-tx     — build unsigned deposit transaction bundle
 * POST /api/solana-yield/withdraw-tx    — build unsigned withdraw transaction bundle
 * POST /api/solana-yield/confirm        — agent confirms after on-chain submission
 * GET  /api/solana-yield/manifest       — machine-readable manifest for AI agents
 */

import { Router, Request, Response } from 'express';
import axios from 'axios';
import { dialectMarketsService } from '../services/dialectMarketsService.js';
import { getKaminoMarket, SOLANA_YIELD_CONFIG, getSolanaYieldConnection } from '../services/solanaYield/kaminoClient.js';
import { buildDepositTxBundle, buildWithdrawTxBundle } from '../services/solanaYield/txBuilder.js';
import { readPosition, getMarketSummary } from '../services/solanaYield/positionReader.js';
import { db } from '../db.js';
import { solanaYieldPositions, solanaYieldEvents, solanaYieldRateSnapshots } from '@shared/schema';
import { eq, and, desc, isNotNull } from 'drizzle-orm';
import { createHitTracker } from '../middleware/hitTracker.js';

// ── Idempotency TTL: Solana blockhashes expire in ~150 slots (~60s). We keep
//    the intent alive for 120s to give the agent time to submit both txns.
const DEPOSIT_INTENT_TTL_MS = 120_000;

const router = Router();

// ── Analytics Middleware ──────────────────────────────────────────────────────

const trackSolanaYield = createHitTracker({
  endpointType: 'yield',
  extractResourceId: (req) => {
    const p = req.path.replace(/^\//, '');
    if (p.startsWith('position/')) return 'solana-position';
    if (p === 'deposit-tx')  return 'solana-deposit-tx';
    if (p === 'withdraw-tx') return 'solana-withdraw-tx';
    if (p === 'confirm')     return 'solana-confirm';
    if (p === 'stats')       return 'solana-stats';
    if (p === 'manifest')    return 'solana-manifest';
    return 'solana-rates';
  },
});

router.use(trackSolanaYield);

// ── GET /rates ─────────────────────────────────────────────────────────────────

router.get('/rates', async (req: Request, res: Response) => {
  try {
    const isPaused = process.env.SOLANA_YIELD_PAUSED === 'true';
    if (isPaused) {
      return res.status(503).json({ success: false, error: 'Solana yield portal is temporarily paused' });
    }

    // Source 1: Dialect Markets (10-min cache)
    const dialectData = await dialectMarketsService.getTopYields({
      token:    'USDC',
      protocol: 'kamino',
      type:     'lending',
      limit:    5,
    }).catch(() => null);

    const kaminoRate = dialectData?.topYields?.find(
      (y: any) => y.protocol?.toLowerCase().includes('kamino') || y.name?.toLowerCase().includes('kamino'),
    ) ?? dialectData?.topYields?.[0];
    const dialectApy: number | null = kaminoRate?.apy ?? null;

    // Source 2: DeFiLlama targeted chart endpoint (free, no key — ~KB response, fast fallback)
    // Pool ID: Kamino main market USDC on Solana (stable — use /pools to refresh if ever stale)
    const KAMINO_USDC_LLAMA_POOL = 'd2141a59-c199-4be7-8d4b-c8223954836b';
    let llamaApy: number | null = null;
    if (dialectApy == null) {
      try {
        const { data } = await axios.get(
          `https://yields.llama.fi/chart/${KAMINO_USDC_LLAMA_POOL}`,
          { timeout: 6000 },
        );
        const pts: any[] = data?.data ?? [];
        const latest = pts[pts.length - 1];
        if (latest?.apy != null && latest.apy > 0) {
          llamaApy = latest.apy;
        }
      } catch (e: any) {
        console.log('[SolanaYield] DeFiLlama fetch error:', e?.message ?? e);
      }
    }

    // Source 3: on-chain reserve TVL stats (always available)
    let reserveStats: any = null;
    try {
      const market  = await getKaminoMarket();
      const reserve = market.getReserveByMint(SOLANA_YIELD_CONFIG.USDC_MINT);
      if (reserve) {
        const totalSupplyRaw = Number(reserve.getTotalSupply().toString());
        const availableRaw   = Number(reserve.getLiquidityAvailableAmount().toString());
        reserveStats = {
          market:         market.address.toString(),
          reserve:        reserve.address.toString(),
          collateralMint: reserve.state.collateral.mintPubkey.toString(),
          depositTvlUsdc: totalSupplyRaw / 1e6,
          liquidityUsdc:  availableRaw   / 1e6,
        };
      }
    } catch { /* non-fatal */ }

    const apyPct = dialectApy ?? llamaApy ?? null;
    const apyBps = apyPct != null ? Math.round(apyPct * 100) : null;
    const apySource = dialectApy != null ? 'Dialect Markets' : llamaApy != null ? 'DeFiLlama' : null;

    return res.json({
      success:   true,
      timestamp: new Date().toISOString(),
      chain:     'solana',
      protocol:  'Kamino Lending',
      usdc: {
        apyPct:    apyPct != null ? parseFloat(apyPct.toFixed(2)) : null,
        apyBps,
        formatted: apyPct != null ? `${apyPct.toFixed(2)}%` : 'Loading...',
      },
      topOpportunities: dialectData?.topYields?.slice(0, 5) ?? [],
      onChain:    reserveStats,
      minDeposit: { raw: SOLANA_YIELD_CONFIG.MIN_DEPOSIT_RAW, usdc: 5 },
      fees: {
        deposit:     `${(SOLANA_YIELD_CONFIG.DEPOSIT_FEE_BPS / 100).toFixed(2)}%`,
        withdrawal:  `${(SOLANA_YIELD_CONFIG.WITHDRAW_FEE_BPS / 100).toFixed(2)}%`,
        performance: `${(SOLANA_YIELD_CONFIG.PERF_FEE_BPS / 100).toFixed(0)}% of yield`,
      },
      comparison: {
        solana:  apyPct != null ? `${apyPct.toFixed(2)}% (Kamino, ${apySource})` : 'Unavailable',
        base:    '~3.17% (Aave v3)',
        note:    'Solana rates are typically 1-4x higher due to higher utilization',
      },
      attribution: apySource
        ? `Rate data: ${apySource}${apySource === 'DeFiLlama' ? ' (https://defillama.com)' : ' (https://dialect.to)'}`
        : 'Rate data unavailable — Kamino API unreachable',
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /stats ─────────────────────────────────────────────────────────────────

router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const summary = await getMarketSummary();
    return res.json({ success: true, ...summary });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /position/:wallet ──────────────────────────────────────────────────────

router.get('/position/:wallet', async (req: Request, res: Response) => {
  const { wallet } = req.params;

  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet)) {
    return res.status(400).json({ success: false, error: 'Invalid Solana wallet address' });
  }

  try {
    const position  = await readPosition(wallet);
    const dbRecord  = await db
      .select()
      .from(solanaYieldPositions)
      .where(and(eq(solanaYieldPositions.wallet, wallet), eq(solanaYieldPositions.status, 'active')))
      .orderBy(desc(solanaYieldPositions.openedAt))
      .limit(1);

    return res.json({
      success: true,
      position,
      platformRecord: dbRecord[0] ?? null,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /deposit-tx ───────────────────────────────────────────────────────────

router.post('/deposit-tx', async (req: Request, res: Response) => {
  const { wallet, amount, amount_usdc, amount_raw, idempotency_key } = req.body as {
    wallet?:           string;
    amount?:           number | string;
    amount_usdc?:      number | string;  // preferred: dollars, e.g. 10 = $10
    amount_raw?:       number | string;  // raw lamports, e.g. 10000000 = $10
    idempotency_key?:  string;           // optional: same key within 120s returns same bundle
  };

  if (!wallet || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet)) {
    return res.status(400).json({ success: false, error: 'wallet: valid Solana public key required' });
  }

  // Accept amount_usdc (dollars), amount_raw (lamports), or amount (auto-detect by size)
  let amountRaw: number;
  if (amount_usdc != null) {
    amountRaw = Math.round(Number(amount_usdc) * 1e6);
  } else if (amount_raw != null) {
    amountRaw = Math.round(Number(amount_raw));
  } else {
    const n = typeof amount === 'string' ? parseFloat(amount) : Number(amount ?? 0);
    // Auto-detect: if < 10000 assume dollars (e.g. 10 → $10), otherwise raw lamports
    amountRaw = n < 10_000 ? Math.round(n * 1e6) : Math.round(n);
  }

  if (!amountRaw || amountRaw < SOLANA_YIELD_CONFIG.MIN_DEPOSIT_RAW) {
    return res.status(400).json({
      success: false,
      error:   `Minimum deposit is $5 USDC. ` +
               `Use amount_usdc=10 for $10, or amount_raw=10000000 for $10 in raw lamports.`,
    });
  }

  // ── Idempotency check ───────────────────────────────────────────────────────
  // If idempotency_key is provided and a live (non-expired, non-confirmed) intent
  // exists for the same wallet+amount+key, return the existing bundle instead of
  // building a new one (and charging a second fee).
  if (idempotency_key) {
    const iKey = idempotency_key.slice(0, 128); // truncate to column length
    const existing = await db
      .select()
      .from(solanaYieldEvents)
      .where(
        and(
          eq(solanaYieldEvents.wallet,         wallet),
          eq(solanaYieldEvents.idempotencyKey, iKey),
          eq(solanaYieldEvents.eventType,      'deposit_intent'),
          eq(solanaYieldEvents.status,         'pending'),
          eq(solanaYieldEvents.amountUsdcRaw,  amountRaw.toString()),
        ),
      )
      .orderBy(desc(solanaYieldEvents.createdAt))
      .limit(1);

    if (existing.length > 0) {
      const intent = existing[0];
      const expiresAt = intent.bundleExpiresAt;
      if (expiresAt && new Date(expiresAt) > new Date()) {
        // Live intent exists — but we can't re-serve the bundle (transactions aren't stored).
        // Return a clear 409 so agent knows to re-call without the same key after expiry.
        return res.status(409).json({
          success:        false,
          error:          'Duplicate idempotency_key: a pending deposit intent already exists for this wallet/amount/key.',
          hint:           'Wait for the current bundle to expire (see bundle_expires_at) then retry, or omit idempotency_key to force a new bundle.',
          bundle_expires_at: expiresAt,
          existing_intent_id: intent.id,
        });
      }
      // Expired — fall through to build a fresh bundle
    }
  }

  try {
    const bundle    = await buildDepositTxBundle(wallet, amountRaw);
    const expiresAt = new Date(Date.now() + DEPOSIT_INTENT_TTL_MS);
    const iKey      = idempotency_key ? idempotency_key.slice(0, 128) : null;

    // Record deposit intent with idempotency key and bundle expiry
    await db.insert(solanaYieldEvents).values({
      wallet,
      eventType:       'deposit_intent',
      amountUsdcRaw:   amountRaw.toString(),
      feeUsdcRaw:      bundle.feeRaw,
      status:          'pending',
      idempotencyKey:  iKey,
      bundleExpiresAt: expiresAt,
    }).catch(() => {});

    return res.json({
      success: true,
      ...bundle,
      bundle_expires_at: expiresAt.toISOString(),
      idempotency_key:   iKey ?? undefined,
      instructions: [
        '1. Sign and submit each transaction in order (tx1 first, wait for confirmation, then tx2)',
        '2. Both transactions must confirm within ~90 seconds of each other (Solana blockhash expiry)',
        '3. If tx1 confirms but tx2 fails: call /deposit-tx again WITHOUT the same idempotency_key to get a fresh bundle — the fee will be collected again; contact support@coinrailz.com with the failed tx1 signature for a fee refund',
        '4. Call POST /api/solana-yield/confirm with {wallet, txSignature} after tx2 confirms',
      ],
      agent_hint: 'Use @solana/web3.js sendRawTransaction. Both txns share the same blockhash — submit promptly.',
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /withdraw-tx ──────────────────────────────────────────────────────────

router.post('/withdraw-tx', async (req: Request, res: Response) => {
  const { wallet, amount, amount_usdc, amount_raw } = req.body as {
    wallet?:      string;
    amount?:      number | string | 'MAX';
    amount_usdc?: number | string;
    amount_raw?:  number | string;
  };

  if (!wallet || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet)) {
    return res.status(400).json({ success: false, error: 'wallet: valid Solana public key required' });
  }

  let amountParam: number | 'MAX';
  if (amount === 'MAX' || amount_usdc === 'MAX' || amount_raw === 'MAX') {
    amountParam = 'MAX';
  } else if (amount_usdc != null) {
    amountParam = Math.round(Number(amount_usdc) * 1e6);
  } else if (amount_raw != null) {
    amountParam = Math.round(Number(amount_raw));
  } else {
    const n = typeof amount === 'string' ? parseFloat(amount) : Number(amount ?? 0);
    amountParam = n < 10_000 ? Math.round(n * 1e6) : Math.round(n);
  }

  if (amountParam !== 'MAX' && (!amountParam || amountParam <= 0)) {
    return res.status(400).json({
      success: false,
      error:   'amount must be positive. Use amount_usdc=10 for $10, amount_raw=10000000, or "MAX" to withdraw all.',
    });
  }

  try {
    // Fetch the wallet's recorded deposit amount from DB — needed for perf fee calculation.
    // Non-fatal: if not found (new wallet, or DB miss), perf fee is simply not charged.
    let depositedUsdcRaw: string | undefined;
    try {
      const activePos = await db
        .select()
        .from(solanaYieldPositions)
        .where(and(eq(solanaYieldPositions.wallet, wallet), eq(solanaYieldPositions.status, 'active')))
        .limit(1);
      if (activePos.length > 0 && activePos[0].depositedUsdcRaw && activePos[0].depositedUsdcRaw !== '0') {
        depositedUsdcRaw = activePos[0].depositedUsdcRaw;
      }
    } catch { /* non-fatal — proceed without perf fee */ }

    const bundle = await buildWithdrawTxBundle(wallet, amountParam, depositedUsdcRaw);

    await db.insert(solanaYieldEvents).values({
      wallet,
      eventType:     'withdraw_intent',
      amountUsdcRaw: bundle.requestedRaw,
      feeUsdcRaw:    bundle.feeRaw,
      perfFeeUsdcRaw: bundle.perfFeeRaw !== '0' ? bundle.perfFeeRaw : null,
      status:        'pending',
    }).catch(() => {});

    return res.json({
      success:        true,
      fee_breakdown: {
        flat_fee_usdc:  (Number(bundle.flatFeeRaw) / 1e6).toFixed(6),
        perf_fee_usdc:  (Number(bundle.perfFeeRaw) / 1e6).toFixed(6),
        yield_earned_usdc: (Number(bundle.yieldEarnedRaw) / 1e6).toFixed(6),
        total_fee_usdc: (Number(bundle.feeRaw) / 1e6).toFixed(6),
      },
      ...bundle,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /confirm ──────────────────────────────────────────────────────────────

router.post('/confirm', async (req: Request, res: Response) => {
  const { wallet, txSignature, eventType, amountUsdcRaw } = req.body as {
    wallet?:        string;
    txSignature?:   string;
    eventType?:     string;
    amountUsdcRaw?: string;
  };

  if (!wallet || !txSignature) {
    return res.status(400).json({ success: false, error: 'wallet and txSignature are required' });
  }
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet)) {
    return res.status(400).json({ success: false, error: 'wallet: invalid Solana public key' });
  }
  if (!/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(txSignature)) {
    return res.status(400).json({ success: false, error: 'txSignature: invalid Solana signature format' });
  }

  // ── Dedupe guard: same txSignature already confirmed → return idempotently ─
  try {
    const existing = await db
      .select()
      .from(solanaYieldEvents)
      .where(and(eq(solanaYieldEvents.txSignature, txSignature), eq(solanaYieldEvents.status, 'confirmed')))
      .limit(1);
    if (existing.length > 0) {
      return res.json({
        success:            true,
        message:            'deposit_confirmed confirmed (already recorded)',
        onChainVerified:    true,
        verificationStatus: 'confirmed',
        verificationNote:   'Idempotent — this signature was already confirmed.',
        existingEventId:    existing[0].id,
      });
    }
  } catch { /* non-fatal — proceed to full verification */ }

  // ── On-chain verification ─────────────────────────────────────────────────
  // Verify the transaction actually confirmed on-chain and the claiming wallet
  // was a signer. If the RPC is unavailable, store as pending_verification for
  // the keeper to finalize rather than blindly marking confirmed.
  let onChainVerified = false;
  let verificationStatus: 'confirmed' | 'pending_verification' = 'pending_verification';
  let verificationNote: string | null = null;

  try {
    const conn = getSolanaYieldConnection();

    // Fast path: getSignatureStatuses is a single RPC call, ~50-100ms
    const statuses = await conn.getSignatureStatuses([txSignature], { searchTransactionHistory: true });
    const sigStatus = statuses?.value?.[0];

    if (!sigStatus) {
      // Not found yet — may still be propagating; store as pending_verification
      verificationNote = 'Signature not yet found on-chain; keeper will re-verify within 60 minutes.';
    } else if (sigStatus.err) {
      // Transaction found but it failed on-chain — reject
      return res.status(400).json({
        success: false,
        error:   'Transaction failed on-chain and cannot be confirmed.',
        onChainError: JSON.stringify(sigStatus.err),
        txSignature,
      });
    } else if (sigStatus.confirmationStatus === 'confirmed' || sigStatus.confirmationStatus === 'finalized') {
      // Confirmed — now verify the wallet was a signer in the transaction.
      // If txDetail is unavailable (pruned node / RPC blip), we CANNOT verify the signer,
      // so we degrade to pending_verification and let the keeper re-check.
      try {
        const txDetail = await conn.getTransaction(txSignature, {
          maxSupportedTransactionVersion: 0,
          commitment: 'confirmed',
        });
        if (txDetail) {
          const accountKeys = txDetail.transaction.message.getAccountKeys?.()?.staticAccountKeys
                           ?? (txDetail.transaction.message as any).accountKeys
                           ?? [];
          const signerAddrs = accountKeys
            .slice(0, txDetail.transaction.message.header?.numRequiredSignatures ?? accountKeys.length)
            .map((k: any) => k.toString?.() ?? k);
          const walletIsSigner = signerAddrs.includes(wallet);
          if (!walletIsSigner) {
            return res.status(403).json({
              success: false,
              error:   'Wallet address is not a signer in the provided transaction.',
              txSignature,
            });
          }
          // Signer confirmed — mark as verified
          onChainVerified    = true;
          verificationStatus = 'confirmed';
          verificationNote   = `On-chain ${sigStatus.confirmationStatus} at slot ${sigStatus.slot ?? 'unknown'}.`;
        } else {
          // Node doesn't have tx details yet — cannot prove signer; keeper will retry
          verificationNote = 'Transaction details not yet available on this node; keeper will re-verify signer within 60 minutes.';
        }
      } catch {
        // getTransaction threw (e.g. pruned/unavailable) — cannot prove signer; keeper will retry
        verificationNote = 'Signer verification temporarily unavailable (RPC); keeper will re-verify within 60 minutes.';
      }
    } else {
      // Processed but not confirmed yet
      verificationNote = `Transaction status: ${sigStatus.confirmationStatus}. Keeper will re-verify.`;
    }
  } catch (rpcErr: any) {
    // RPC unreachable — degrade gracefully; keeper reconciles
    verificationNote = `RPC unavailable during verification (${rpcErr?.message ?? 'unknown'}). Keeper will re-verify within 60 minutes.`;
    console.warn('[SolanaYield/confirm] RPC verification failed (non-fatal):', rpcErr?.message);
  }

  try {
    const confirmedType = eventType === 'withdraw_intent' ? 'withdraw_confirmed' : 'deposit_confirmed';

    await db.insert(solanaYieldEvents).values({
      wallet,
      eventType:     confirmedType,
      txSignature,
      amountUsdcRaw: amountUsdcRaw ?? null,
      status:        verificationStatus,
      errorMessage:  verificationNote,
    });

    // Upsert position record for deposits — only if on-chain verified
    if (confirmedType === 'deposit_confirmed' && onChainVerified) {
      const existing = await db
        .select()
        .from(solanaYieldPositions)
        .where(and(eq(solanaYieldPositions.wallet, wallet), eq(solanaYieldPositions.status, 'active')))
        .limit(1);

      const marketAddr = process.env.SOLANA_YIELD_KAMINO_MARKET || SOLANA_YIELD_CONFIG.DEFAULT_MARKET;
      const collatMint = SOLANA_YIELD_CONFIG.USDC_MINT.toString();

      if (existing.length === 0) {
        await db.insert(solanaYieldPositions).values({
          wallet,
          market:             marketAddr,
          reserveAddress:     'pending',
          collateralMint:     collatMint,
          depositedUsdcRaw:   amountUsdcRaw ?? '0',
          txSignatureDeposit: txSignature,
          status:             'active',
        });
      } else {
        await db
          .update(solanaYieldPositions)
          .set({ txSignatureDeposit: txSignature, updatedAt: new Date() })
          .where(eq(solanaYieldPositions.id, existing[0].id));
      }
    }

    return res.json({
      success:            true,
      message:            `${confirmedType} ${verificationStatus === 'confirmed' ? 'confirmed' : 'recorded (pending verification)'}`,
      txSignature,
      onChainVerified,
      verificationStatus,
      verificationNote,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /manifest ──────────────────────────────────────────────────────────────

router.get('/manifest', (_req: Request, res: Response) => {
  const baseUrl = process.env.PUBLIC_URL || 'https://coinrailz.com';
  res.json({
    name:         'Coin Railz — Solana USDC Yield Portal',
    description:  'Automated USDC yield for AI agents on Solana. Deposit USDC into Kamino Finance, earn real APY. 1-API-call transaction building. Optimized for ElizaOS agents.',
    chain:        'solana',
    protocol:     'Kamino Lending',
    version:      '1.0.0',
    endpoints: {
      rates:       `${baseUrl}/api/solana-yield/rates`,
      stats:       `${baseUrl}/api/solana-yield/stats`,
      position:    `${baseUrl}/api/solana-yield/position/{wallet}`,
      deposit_tx:  `${baseUrl}/api/solana-yield/deposit-tx`,
      withdraw_tx: `${baseUrl}/api/solana-yield/withdraw-tx`,
      confirm:     `${baseUrl}/api/solana-yield/confirm`,
    },
    fees: {
      deposit:     `${(SOLANA_YIELD_CONFIG.DEPOSIT_FEE_BPS / 100).toFixed(2)}%`,
      withdrawal:  `${(SOLANA_YIELD_CONFIG.WITHDRAW_FEE_BPS / 100).toFixed(2)}%`,
      performance: `${(SOLANA_YIELD_CONFIG.PERF_FEE_BPS / 100).toFixed(0)}% of yield earned`,
    },
    limits: {
      min_deposit_usdc: 5,
      token:            'USDC',
      mint:             'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    },
    agent_instructions: {
      step0_bridge_if_needed: 'ONLY NEEDED if your USDC is on Base/Ethereum: bridge to Solana first via https://app.debridge.finance or https://portalbridge.com (Wormhole). Target mint: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v. Skip if you already hold Solana USDC.',
      step1_check_rate:       'GET /api/solana-yield/rates — confirm current APY before committing capital.',
      step2_deposit:          'POST /api/solana-yield/deposit-tx with {wallet, amount_usdc: 10, idempotency_key: "<uuid>"}. Returns array of base64 unsigned transactions and a bundle_expires_at timestamp.',
      step3_sign_submit:      'Submit tx1 first, wait for confirmation, then submit tx2 — both must confirm before bundle_expires_at (~120s). Code: for (const {base64} of response.transactions) { const tx = Transaction.from(Buffer.from(base64,"base64")); tx.sign(keypair); const sig = await conn.sendRawTransaction(tx.serialize()); await conn.confirmTransaction(sig,"confirmed"); }',
      step4_confirm:          'POST /api/solana-yield/confirm with {wallet, txSignature} after tx2 confirms. The server verifies on-chain before recording the position.',
      step5_check:            'GET /api/solana-yield/position/{wallet} — returns depositedUsdc and currentValueUsdc.',
      withdraw_partial:       'POST /api/solana-yield/withdraw-tx with {wallet, amount_usdc: 5} for $5 USDC.',
      withdraw_all:           'POST /api/solana-yield/withdraw-tx with {wallet, amount: "MAX"} to exit fully.',
      retry_on_partial_fail:  'If tx1 (fee) confirmed but tx2 (deposit) failed: do NOT reuse idempotency_key. Call /deposit-tx with a fresh key. Email support@coinrailz.com with the failed tx1 signature for a fee refund.',
    },
    signing_code_snippet: [
      'const { Connection, Keypair, Transaction } = require("@solana/web3.js");',
      'const conn = new Connection(process.env.HELIUS_RPC || "https://api.mainnet-beta.solana.com");',
      'const keypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(process.env.SOLANA_PRIVATE_KEY)));',
      'const { transactions, bundle_expires_at } = await fetch("/api/solana-yield/deposit-tx", {',
      '  method: "POST", headers: {"Content-Type":"application/json"},',
      '  body: JSON.stringify({ wallet: keypair.publicKey.toString(), amount_usdc: 10, idempotency_key: crypto.randomUUID() })',
      '}).then(r => r.json());',
      'for (const { base64 } of transactions) {',
      '  const tx = Transaction.from(Buffer.from(base64, "base64"));',
      '  tx.sign(keypair);',
      '  const sig = await conn.sendRawTransaction(tx.serialize(), { skipPreflight: false });',
      '  await conn.confirmTransaction(sig, "confirmed");',
      '  // Call /confirm after the LAST transaction',
      '}',
    ],
    amount_formats: {
      preferred:   'amount_usdc: 10  (dollars — e.g. 10 = $10 USDC)',
      alternative: 'amount_raw: 10000000  (raw USDC lamports, 6 decimals)',
      legacy:      'amount: 10  (auto-detected: < 10000 treated as dollars)',
    },
    cross_chain_note: {
      supported_chain:    'Solana mainnet-beta only',
      evm_agents:         'EVM-native agents (Base, Ethereum) must bridge USDC to Solana before depositing.',
      recommended_bridge: 'deBridge (https://app.debridge.finance) — non-custodial, ~2min, supports Base→Solana USDC',
      alt_bridge:         'Wormhole Portal (https://portalbridge.com) — canonical bridge, ~2min',
      usdc_mint_solana:   'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      roadmap:            'Native CCTP (Circle cross-chain transfer protocol) support planned for v3 — no manual bridge needed.',
    },
    comparison: {
      solana_kamino:  'Current APY: see /rates (recently ~3-5%; historically up to 12%)',
      base_aave:      '~3.17% APY (Aave v3)',
      note:           'Solana rates fluctuate with utilization. Check /rates before every deposit decision.',
    },
  });
});

export default router;
