import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { ethers } from 'ethers';
import { db } from '../db';
import { esportsTransactions, aiAgentSubscriptions } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { coinbaseCDPService } from '../services/coinbaseCDPService';

const router = Router();

// ============================================================
// CONFIG
// ============================================================

const PLATFORM_WALLET = (
  process.env.PLATFORM_WALLET_ADDRESS || '0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91'
).toLowerCase();

const FEE_PCT = 0.015;

const CHAIN_CONFIG: Record<
  string,
  { cdpChain: string; usdcAddress: string; explorerBase: string; blocksToScan: number; rpcUrl: string }
> = {
  base: {
    cdpChain: 'base-mainnet',
    usdcAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    explorerBase: 'https://basescan.org/tx/',
    blocksToScan: 1500,
    rpcUrl: `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY || ''}`,
  },
  ethereum: {
    cdpChain: 'ethereum-mainnet',
    usdcAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    explorerBase: 'https://etherscan.io/tx/',
    blocksToScan: 250,
    rpcUrl: `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY || ''}`,
  },
};

const SUPPORTED_CHAINS = Object.keys(CHAIN_CONFIG).join(', ');

// ============================================================
// AUTH MIDDLEWARE
// ============================================================

async function requirePartnerKey(req: any, res: Response, next: NextFunction): Promise<void> {
  let apiKey: string | undefined;
  const auth = req.headers.authorization;
  const keyHeader = req.headers['x-api-key'];

  if (auth?.startsWith('Bearer ')) {
    apiKey = auth.substring(7);
  } else if (keyHeader) {
    apiKey = Array.isArray(keyHeader) ? keyHeader[0] : keyHeader;
  }

  if (!apiKey) {
    res.status(401).json({
      error: 'API key required',
      hint: 'Include Authorization: Bearer <key> or X-API-Key: <key>',
    });
    return;
  }

  const hash = crypto.createHash('sha256').update(apiKey).digest('hex');

  const [sub] = await db
    .select()
    .from(aiAgentSubscriptions)
    .where(eq(aiAgentSubscriptions.apiKey, hash))
    .limit(1);

  if (!sub) {
    res.status(401).json({ error: 'Invalid API key' });
    return;
  }

  req.partnerApiKeyHash = hash;
  next();
}

// ============================================================
// ON-CHAIN PAYMENT DETECTION
// Scans recent blocks for a USDC Transfer from a specific
// sender wallet to the platform wallet for the expected amount.
// Attribution is by fromAddress — no memo field needed.
// ============================================================

async function detectIncomingUsdc(params: {
  fromWallet: string;
  chain: string;
  expectedAmountUsdc: number;
  sessionCreatedAt: Date;
}): Promise<{ found: boolean; txHash?: string; amount?: string }> {
  const cfg = CHAIN_CONFIG[params.chain];
  if (!cfg) return { found: false };

  try {
    const provider = new ethers.JsonRpcProvider(cfg.rpcUrl);
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - cfg.blocksToScan);

    const transferTopic = ethers.id('Transfer(address,address,uint256)');
    const paddedFrom = '0x' + params.fromWallet.slice(2).toLowerCase().padStart(64, '0');
    const paddedTo = '0x' + PLATFORM_WALLET.slice(2).toLowerCase().padStart(64, '0');

    const logs = await provider.getLogs({
      address: cfg.usdcAddress,
      topics: [transferTopic, paddedFrom, paddedTo],
      fromBlock,
      toBlock: currentBlock,
    });

    for (const log of logs) {
      const amountBigInt = BigInt(log.data);
      const amountFormatted = ethers.formatUnits(amountBigInt, 6);
      const received = parseFloat(amountFormatted);
      const expected = params.expectedAmountUsdc;

      const block = await provider.getBlock(log.blockNumber);
      if (block?.timestamp && new Date(block.timestamp * 1000) < params.sessionCreatedAt) {
        continue;
      }

      if (received >= expected - 0.02 && received <= expected + 0.02) {
        return { found: true, txHash: log.transactionHash, amount: amountFormatted };
      }
    }

    return { found: false };
  } catch (err: any) {
    console.error('❌ [esports] USDC detection error:', err.message);
    return { found: false };
  }
}

// ============================================================
// ROUTE 1 — PRIZE PAYOUT
// POST /api/partner/esports/payout
// ============================================================

router.post('/payout', requirePartnerKey, async (req: any, res: Response) => {
  const { recipientWallet, amountUSD, chain = 'base', tournamentId, playerId } = req.body;

  if (!recipientWallet || amountUSD === undefined) {
    res.status(400).json({ error: 'recipientWallet and amountUSD are required' });
    return;
  }
  if (!ethers.isAddress(recipientWallet)) {
    res.status(400).json({ error: 'Invalid recipientWallet address' });
    return;
  }

  const chainKey = (chain as string).toLowerCase().replace('-mainnet', '');
  const cfg = CHAIN_CONFIG[chainKey];
  if (!cfg) {
    res.status(400).json({ error: `Unsupported chain. Supported: ${SUPPORTED_CHAINS}` });
    return;
  }

  const amount = parseFloat(amountUSD);
  if (isNaN(amount) || amount <= 0) {
    res.status(400).json({ error: 'amountUSD must be a positive number' });
    return;
  }

  const feeUsdc = parseFloat((amount * FEE_PCT).toFixed(6));
  const payoutUsdc = parseFloat((amount - feeUsdc).toFixed(6));
  const sessionId = uuidv4();

  await db.insert(esportsTransactions).values({
    sessionId,
    type: 'payout',
    status: 'pending',
    chain: chainKey,
    partnerApiKeyHash: req.partnerApiKeyHash,
    fromAddress: PLATFORM_WALLET,
    toAddress: recipientWallet.toLowerCase(),
    amountUsd: amount.toString(),
    amountUsdc: payoutUsdc.toString(),
    feeUsdc: feeUsdc.toString(),
    tournamentId: tournamentId || null,
    playerId: playerId || null,
  });

  console.log(`🎮 [esports] Payout initiated: ${payoutUsdc} USDC → ${recipientWallet} on ${chainKey}`);

  const result = await coinbaseCDPService.sendToken({
    toAddress: recipientWallet,
    amount: payoutUsdc.toFixed(6),
    token: 'USDC',
    chain: cfg.cdpChain,
    memo: `klic.gg prize payout - tournament: ${tournamentId || 'N/A'}`,
  });

  await db
    .update(esportsTransactions)
    .set({
      status: result.status === 'completed' ? 'confirmed' : 'failed',
      txHash: result.txHash || null,
      confirmedAt: result.status === 'completed' ? new Date() : null,
    })
    .where(eq(esportsTransactions.sessionId, sessionId));

  if (result.status === 'completed') {
    console.log(`✅ [esports] Payout confirmed: ${result.txHash}`);
    res.json({
      success: true,
      sessionId,
      txHash: result.txHash,
      explorerUrl: cfg.explorerBase + result.txHash,
      amountSent: payoutUsdc,
      feeCollected: feeUsdc,
      recipient: recipientWallet,
      chain: chainKey,
      network: cfg.cdpChain,
    });
  } else {
    console.error(`❌ [esports] Payout failed: ${result.error}`);
    res.status(502).json({
      success: false,
      sessionId,
      error: result.error || 'Payout transaction failed',
      status: result.status,
    });
  }
});

// ============================================================
// ROUTE 2 — CREATE PAYMENT SESSION (entry fee or tip)
// POST /api/partner/esports/session
// ============================================================

router.post('/session', requirePartnerKey, async (req: any, res: Response) => {
  const {
    type,
    payerWallet,
    amountUSD,
    chain = 'base',
    tournamentId,
    playerId,
    streamerId,
    streamerWallet,
  } = req.body;

  if (!type || !payerWallet || amountUSD === undefined) {
    res.status(400).json({ error: 'type, payerWallet, and amountUSD are required' });
    return;
  }
  if (!['entry_fee', 'tip'].includes(type)) {
    res.status(400).json({ error: 'type must be "entry_fee" or "tip"' });
    return;
  }
  if (!ethers.isAddress(payerWallet)) {
    res.status(400).json({ error: 'Invalid payerWallet address' });
    return;
  }
  if (type === 'tip' && streamerWallet && !ethers.isAddress(streamerWallet)) {
    res.status(400).json({ error: 'Invalid streamerWallet address' });
    return;
  }

  const chainKey = (chain as string).toLowerCase().replace('-mainnet', '');
  const cfg = CHAIN_CONFIG[chainKey];
  if (!cfg) {
    res.status(400).json({ error: `Unsupported chain. Supported: ${SUPPORTED_CHAINS}` });
    return;
  }

  const amount = parseFloat(amountUSD);
  if (isNaN(amount) || amount <= 0) {
    res.status(400).json({ error: 'amountUSD must be a positive number' });
    return;
  }

  const feeUsdc = parseFloat((amount * FEE_PCT).toFixed(6));
  const sessionId = uuidv4();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

  await db.insert(esportsTransactions).values({
    sessionId,
    type,
    status: 'pending',
    chain: chainKey,
    partnerApiKeyHash: req.partnerApiKeyHash,
    fromAddress: payerWallet.toLowerCase(),
    toAddress: PLATFORM_WALLET,
    amountUsd: amount.toString(),
    amountUsdc: amount.toString(),
    feeUsdc: feeUsdc.toString(),
    tournamentId: tournamentId || null,
    playerId: playerId || null,
    streamerId: streamerId || null,
    streamerWallet: streamerWallet ? streamerWallet.toLowerCase() : null,
    expiresAt,
  });

  console.log(`🎮 [esports] ${type} session created: ${amount} USDC from ${payerWallet} on ${chainKey}`);

  res.json({
    success: true,
    sessionId,
    type,
    paymentAddress: PLATFORM_WALLET,
    usdcContractAddress: cfg.usdcAddress,
    amountUsdc: amount,
    chain: chainKey,
    network: cfg.cdpChain,
    instructions: [
      `Send exactly ${amount} USDC to ${PLATFORM_WALLET}`,
      `You MUST send from wallet address ${payerWallet} — payment is attributed by sender address`,
      `Network: ${cfg.cdpChain}`,
      `USDC contract: ${cfg.usdcAddress}`,
      `Payment window: 30 minutes`,
    ],
    expiresAt: expiresAt.toISOString(),
    pollUrl: `/api/partner/esports/transaction/${sessionId}`,
    pollIntervalSeconds: 10,
  });
});

// ============================================================
// ROUTE 3 — CHECK TRANSACTION STATUS
// GET /api/partner/esports/transaction/:sessionId
// klic.gg polls this every 10s until status = confirmed or expired
// ============================================================

router.get('/transaction/:sessionId', requirePartnerKey, async (req: any, res: Response) => {
  const { sessionId } = req.params;

  const [tx] = await db
    .select()
    .from(esportsTransactions)
    .where(eq(esportsTransactions.sessionId, sessionId))
    .limit(1);

  if (!tx) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const cfg = CHAIN_CONFIG[tx.chain];

  if (tx.status === 'confirmed' || tx.status === 'failed' || tx.status === 'expired') {
    res.json({
      sessionId,
      status: tx.status,
      type: tx.type,
      txHash: tx.txHash || null,
      explorerUrl: tx.txHash && cfg ? cfg.explorerBase + tx.txHash : null,
      amountUsdc: tx.amountUsdc,
      feeUsdc: tx.feeUsdc,
      confirmedAt: tx.confirmedAt,
    });
    return;
  }

  if (tx.type !== 'payout' && tx.expiresAt && new Date() > tx.expiresAt) {
    await db
      .update(esportsTransactions)
      .set({ status: 'expired' })
      .where(eq(esportsTransactions.sessionId, sessionId));
    res.json({ sessionId, status: 'expired', message: '30-minute payment window has closed' });
    return;
  }

  if (tx.type === 'entry_fee' || tx.type === 'tip') {
    const detection = await detectIncomingUsdc({
      fromWallet: tx.fromAddress!,
      chain: tx.chain,
      expectedAmountUsdc: parseFloat(tx.amountUsdc!),
      sessionCreatedAt: tx.createdAt!,
    });

    if (detection.found) {
      await db
        .update(esportsTransactions)
        .set({ status: 'confirmed', txHash: detection.txHash, confirmedAt: new Date() })
        .where(eq(esportsTransactions.sessionId, sessionId));

      if (tx.type === 'tip' && tx.streamerWallet && cfg) {
        const netForStreamer = (parseFloat(tx.amountUsdc!) - parseFloat(tx.feeUsdc!)).toFixed(6);
        coinbaseCDPService
          .sendToken({
            toAddress: tx.streamerWallet,
            amount: netForStreamer,
            token: 'USDC',
            chain: cfg.cdpChain,
            memo: `klic.gg tip forward - session: ${sessionId}`,
          })
          .then((r) => console.log(`💸 [esports] Tip forwarded to streamer: ${r.txHash}`))
          .catch((err: Error) => console.error('❌ [esports] Tip forwarding error:', err.message));
      }

      res.json({
        sessionId,
        status: 'confirmed',
        type: tx.type,
        txHash: detection.txHash,
        explorerUrl: cfg ? cfg.explorerBase + detection.txHash : null,
        amountUsdc: detection.amount,
        feeUsdc: tx.feeUsdc,
        confirmedAt: new Date().toISOString(),
      });
      return;
    }
  }

  res.json({
    sessionId,
    status: 'pending',
    type: tx.type,
    chain: tx.chain,
    pollAgainIn: '10s',
  });
});

// ============================================================
// ROUTE 4 — INTEGRATION GUIDE (public, no auth)
// GET /api/partner/esports/guide
// ============================================================

router.get('/guide', (_req: Request, res: Response) => {
  res.json({
    title: 'Coin Railz — eSports Crypto Payment Integration',
    version: '1.0.0',
    baseUrl: 'https://coinrailz.com/api/partner/esports',
    authentication: {
      method: 'Bearer token or X-API-Key header',
      example: 'Authorization: Bearer cr_live_...',
      getApiKey: 'POST https://coinrailz.com/api/m2m/credits/purchase',
    },
    fee: '1.5% per transaction (deducted from payout amount or collected entry fee)',
    supportedChains: {
      base: {
        usdcAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        notes: 'Recommended — fast blocks, lowest gas fees',
      },
      ethereum: {
        usdcAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        notes: 'Highest security guarantees',
      },
    },
    endpoints: {
      'POST /payout': {
        description: 'Send a USDC prize payout to a tournament winner. Executes on-chain immediately.',
        body: {
          recipientWallet: '0x... (required)',
          amountUSD: '100 (required, number)',
          chain: 'base (optional, default: base)',
          tournamentId: 'string (optional)',
          playerId: 'string (optional)',
        },
        successResponse: {
          success: true,
          txHash: '0x...',
          explorerUrl: 'https://basescan.org/tx/0x...',
          amountSent: 98.5,
          feeCollected: 1.5,
        },
      },
      'POST /session': {
        description:
          'Create a payment session for an entry fee or viewer tip. Returns payment address and instructions. Player must send from their registered wallet address for automatic attribution.',
        body: {
          type: '"entry_fee" or "tip" (required)',
          payerWallet: '0x... (required — player must send FROM this address)',
          amountUSD: '5 (required, number)',
          chain: 'base (optional, default: base)',
          tournamentId: 'string (optional)',
          playerId: 'string (optional)',
          streamerId: 'string (optional, tips only)',
          streamerWallet: '0x... (optional, tips only — USDC auto-forwarded here minus fee)',
        },
        successResponse: {
          sessionId: 'uuid',
          paymentAddress: '0x...',
          usdcContractAddress: '0x...',
          amountUsdc: 5,
          expiresAt: '2026-04-01T13:00:00Z',
          pollUrl: '/api/partner/esports/transaction/:sessionId',
          pollIntervalSeconds: 10,
        },
        notes:
          'Payment window is 30 minutes. Player must send EXACTLY from payerWallet. Attribution is automatic by sender address — no txHash submission needed.',
      },
      'GET /transaction/:sessionId': {
        description:
          'Check payment status. Poll every 10 seconds. For entry fees and tips, auto-detects on-chain payment from the registered payerWallet. No manual txHash submission required.',
        statusValues: ['pending', 'confirmed', 'failed', 'expired'],
      },
    },
    flows: {
      prizePayouts: [
        '1. Tournament ends',
        '2. POST /payout with winnerId wallet and amount',
        '3. Coin Railz sends USDC on-chain via CDP',
        '4. Returns txHash in seconds',
      ],
      entryFees: [
        '1. Player selects "Pay with Crypto"',
        '2. Your backend: POST /session with payerWallet + amount',
        '3. Display paymentAddress + QR code to player',
        '4. Player sends USDC from their wallet',
        '5. Poll GET /transaction/:sessionId every 10s',
        '6. On status=confirmed: unlock tournament entry',
      ],
      tips: [
        '1. Viewer clicks "Tip Streamer"',
        '2. Your backend: POST /session with type=tip, payerWallet, streamerWallet, amount',
        '3. Display paymentAddress to viewer',
        '4. Viewer sends USDC from their wallet',
        '5. Poll GET /transaction/:sessionId every 10s',
        '6. On status=confirmed: USDC auto-forwarded to streamerWallet (minus 1.5% fee)',
      ],
    },
  });
});

export default router;
