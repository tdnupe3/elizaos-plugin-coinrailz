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
import { getKaminoMarket, SOLANA_YIELD_CONFIG } from '../services/solanaYield/kaminoClient.js';
import { buildDepositTxBundle, buildWithdrawTxBundle } from '../services/solanaYield/txBuilder.js';
import { readPosition, getMarketSummary } from '../services/solanaYield/positionReader.js';
import { db } from '../db.js';
import { solanaYieldPositions, solanaYieldEvents, solanaYieldRateSnapshots } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { createHitTracker } from '../middleware/hitTracker.js';

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
  const { wallet, amount, amount_usdc, amount_raw } = req.body as {
    wallet?:       string;
    amount?:       number | string;
    amount_usdc?:  number | string;  // preferred: dollars, e.g. 10 = $10
    amount_raw?:   number | string;  // raw lamports, e.g. 10000000 = $10
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

  try {
    const bundle = await buildDepositTxBundle(wallet, amountRaw);

    // Record deposit intent
    await db.insert(solanaYieldEvents).values({
      wallet,
      eventType:     'deposit_intent',
      amountUsdcRaw: amountRaw.toString(),
      feeUsdcRaw:    bundle.feeRaw,
      status:        'pending',
    }).catch(() => {});

    return res.json({
      success: true,
      ...bundle,
      instructions: [
        '1. Sign and submit each transaction in order',
        '2. Wait for each to confirm before submitting the next',
        '3. Call POST /api/solana-yield/confirm with the final tx signature',
      ],
      agent_hint: 'Use @solana/web3.js sendRawTransaction or solana-pay compatible wallet',
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
    const bundle = await buildWithdrawTxBundle(wallet, amountParam);

    await db.insert(solanaYieldEvents).values({
      wallet,
      eventType:     'withdraw_intent',
      amountUsdcRaw: bundle.requestedRaw,
      feeUsdcRaw:    bundle.feeRaw,
      status:        'pending',
    }).catch(() => {});

    return res.json({ success: true, ...bundle });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /confirm ──────────────────────────────────────────────────────────────

router.post('/confirm', async (req: Request, res: Response) => {
  const { wallet, txSignature, eventType, amountUsdcRaw } = req.body as {
    wallet?:       string;
    txSignature?:  string;
    eventType?:    string;
    amountUsdcRaw?: string;
  };

  if (!wallet || !txSignature) {
    return res.status(400).json({ success: false, error: 'wallet and txSignature are required' });
  }

  try {
    const confirmedType = eventType === 'withdraw_intent' ? 'withdraw_confirmed' : 'deposit_confirmed';

    await db.insert(solanaYieldEvents).values({
      wallet,
      eventType:     confirmedType,
      txSignature,
      amountUsdcRaw: amountUsdcRaw ?? null,
      status:        'confirmed',
    });

    // Upsert position record for deposits
    if (confirmedType === 'deposit_confirmed') {
      const existing = await db
        .select()
        .from(solanaYieldPositions)
        .where(and(eq(solanaYieldPositions.wallet, wallet), eq(solanaYieldPositions.status, 'active')))
        .limit(1);

      const marketAddr  = process.env.SOLANA_YIELD_KAMINO_MARKET || SOLANA_YIELD_CONFIG.DEFAULT_MARKET;
      const collatMint  = SOLANA_YIELD_CONFIG.USDC_MINT.toString(); // placeholder; keeper refreshes

      if (existing.length === 0) {
        await db.insert(solanaYieldPositions).values({
          wallet,
          market:               marketAddr,
          reserveAddress:       'pending',
          collateralMint:       collatMint,
          depositedUsdcRaw:     amountUsdcRaw ?? '0',
          txSignatureDeposit:   txSignature,
          status:               'active',
        });
      } else {
        await db
          .update(solanaYieldPositions)
          .set({ txSignatureDeposit: txSignature, updatedAt: new Date() })
          .where(eq(solanaYieldPositions.id, existing[0].id));
      }
    }

    return res.json({
      success: true,
      message: `${confirmedType} recorded`,
      txSignature,
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
      step1_check_rate:  'GET /api/solana-yield/rates — confirm current APY before committing capital.',
      step2_deposit:     'POST /api/solana-yield/deposit-tx with {wallet, amount_usdc: 10} for $10 USDC. Returns array of base64 transactions.',
      step3_sign_submit: 'For each transaction in order: decode base64 → Transaction.from(Buffer.from(b64,"base64")) → tx.sign(keypair) → connection.sendRawTransaction(tx.serialize()) → wait for confirmation.',
      step4_confirm:     'POST /api/solana-yield/confirm with {wallet, txSignature, eventType:"deposit_intent", amountUsdcRaw:"10000000"}.',
      step5_check:       'GET /api/solana-yield/position/{wallet} — returns depositedUsdc and currentValueUsdc.',
      withdraw_partial:  'POST /api/solana-yield/withdraw-tx with {wallet, amount_usdc: 5} for $5 USDC.',
      withdraw_all:      'POST /api/solana-yield/withdraw-tx with {wallet, amount_usdc: "MAX"} to exit fully.',
    },
    signing_code_snippet: [
      'const { Connection, Keypair, Transaction } = require("@solana/web3.js");',
      'const conn = new Connection("https://api.mainnet-beta.solana.com");',
      'const keypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(process.env.SOLANA_PRIVATE_KEY)));',
      'for (const { base64 } of response.transactions) {',
      '  const tx = Transaction.from(Buffer.from(base64, "base64"));',
      '  tx.sign(keypair);',
      '  const sig = await conn.sendRawTransaction(tx.serialize());',
      '  await conn.confirmTransaction(sig, "confirmed");',
      '}',
    ],
    amount_formats: {
      preferred:  'amount_usdc: 10  (dollars, e.g. 10 = $10 USDC)',
      alternative: 'amount_raw: 10000000  (raw USDC lamports, 6 decimals)',
      legacy:     'amount: 10  (auto-detected: < 10000 treated as dollars)',
    },
    comparison: {
      solana_kamino: 'Typically 6-12% APY',
      base_aave:     '~3.17% APY',
    },
  });
});

export default router;
