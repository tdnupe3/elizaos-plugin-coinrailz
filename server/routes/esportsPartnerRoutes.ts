import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { ethers } from 'ethers';
import { db } from '../db';
import { esportsTransactions, esportsPartnerRecipients, aiAgentSubscriptions } from '../../shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { coinbaseCDPService, whitelistWallet } from '../services/coinbaseCDPService';
import { getVltMarketData } from '../services/vltMarketCache';
import { quoteEthForVlt, quoteUsdcForVlt } from '../services/uniswapV2Swap';

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
  try {
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
      .where(eq(aiAgentSubscriptions.apiKeyHash, hash))
      .limit(1);

    if (!sub) {
      res.status(401).json({ error: 'Invalid API key' });
      return;
    }

    req.partnerApiKeyHash = hash;
    next();
  } catch (err: any) {
    console.error('[esports] requirePartnerKey error:', err?.message);
    res.status(503).json({ error: 'Auth service temporarily unavailable', retry: true });
  }
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
// Supports currency: 'USDC' (default) or 'VLT'
// VLT payouts are always on Ethereum mainnet (only chain VLT exists on).
// Recipient must be pre-registered via POST /register-recipient first.
// ============================================================

router.post('/payout', requirePartnerKey, async (req: any, res: Response) => {
  const {
    recipientWallet,
    amountUSD,
    chain = 'base',
    tournamentId,
    playerId,
    currency = 'USDC',
  } = req.body;

  if (!recipientWallet || amountUSD === undefined) {
    res.status(400).json({ error: 'recipientWallet and amountUSD are required' });
    return;
  }
  if (!ethers.isAddress(recipientWallet)) {
    res.status(400).json({ error: 'Invalid recipientWallet address' });
    return;
  }

  const token = (currency as string).toUpperCase();
  if (!['USDC', 'VLT'].includes(token)) {
    res.status(400).json({ error: 'currency must be "USDC" or "VLT"' });
    return;
  }

  // VLT only exists on Ethereum mainnet — override chain
  const chainKey = token === 'VLT' ? 'ethereum' : (chain as string).toLowerCase().replace('-mainnet', '');
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

  // For VLT payouts: verify recipient is pre-registered with this partner
  const recipientLower = recipientWallet.toLowerCase();
  if (token === 'VLT') {
    const [registered] = await db
      .select()
      .from(esportsPartnerRecipients)
      .where(
        and(
          eq(esportsPartnerRecipients.partnerApiKeyHash, req.partnerApiKeyHash),
          eq(esportsPartnerRecipients.walletAddress, recipientLower),
          eq(esportsPartnerRecipients.active, true)
        )
      )
      .limit(1);

    if (!registered) {
      res.status(403).json({
        error: 'Recipient wallet not registered. Call POST /register-recipient first to pre-approve winner wallets.',
        hint: 'Register wallets when tournament ends, before calling payout.',
      });
      return;
    }

    const perTxLimit = parseFloat(registered.perTxLimitUsd ?? '500');
    if (amount > perTxLimit) {
      res.status(400).json({
        error: `Payout amount $${amount} exceeds per-tx limit $${perTxLimit} for this recipient`,
      });
      return;
    }
  }

  // Calculate fee and amounts
  const feeUsd = parseFloat((amount * FEE_PCT).toFixed(6));
  const payoutUsd = parseFloat((amount - feeUsd).toFixed(6));

  // Determine token-specific amounts
  let payoutTokenAmount: string;
  let feeTokenAmount: string;
  let cdpTokenSymbol: string;
  let cdpChain: string;

  if (token === 'VLT') {
    const vlt = getVltMarketData();
    if (!vlt.priceUsd || vlt.priceUsd <= 0) {
      res.status(503).json({ error: 'VLT price unavailable — cannot calculate payout amount' });
      return;
    }
    const vltPayout = payoutUsd / vlt.priceUsd;
    const vltFee    = feeUsd   / vlt.priceUsd;
    payoutTokenAmount = vltPayout.toFixed(4);
    feeTokenAmount    = vltFee.toFixed(4);
    cdpTokenSymbol    = 'VLT';
    cdpChain          = cfg.cdpChain;
    console.log(`🎮 [esports] VLT payout: $${payoutUsd} → ${payoutTokenAmount} VLT @ $${vlt.priceUsd.toFixed(4)}/VLT → ${recipientWallet}`);
  } else {
    payoutTokenAmount = payoutUsd.toFixed(6);
    feeTokenAmount    = feeUsd.toFixed(6);
    cdpTokenSymbol    = 'USDC';
    cdpChain          = cfg.cdpChain;
    console.log(`🎮 [esports] USDC payout: ${payoutTokenAmount} USDC → ${recipientWallet} on ${chainKey}`);
  }

  const sessionId = uuidv4();

  await db.insert(esportsTransactions).values({
    sessionId,
    type: 'payout',
    status: 'pending',
    chain: chainKey,
    partnerApiKeyHash: req.partnerApiKeyHash,
    fromAddress: PLATFORM_WALLET,
    toAddress: recipientLower,
    amountUsd: amount.toString(),
    amountUsdc: token === 'USDC' ? payoutTokenAmount : null,
    feeUsdc:    token === 'USDC' ? feeTokenAmount    : null,
    payoutToken: token,
    payoutAmountToken: payoutTokenAmount,
    feeToken: feeTokenAmount,
    tournamentId: tournamentId || null,
    playerId: playerId || null,
  });

  const result = await coinbaseCDPService.sendToken({
    toAddress: recipientWallet,
    amount: payoutTokenAmount,
    token: cdpTokenSymbol,
    chain: cdpChain,
    memo: `prize payout - tournament: ${tournamentId || 'N/A'} - ${token}`,
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
    console.log(`✅ [esports] ${token} payout confirmed: ${result.txHash}`);
    res.json({
      success: true,
      sessionId,
      txHash: result.txHash,
      explorerUrl: cfg.explorerBase + result.txHash,
      currency: token,
      amountSentToken: parseFloat(payoutTokenAmount),
      amountSentUsd: payoutUsd,
      feeCollectedToken: parseFloat(feeTokenAmount),
      feeCollectedUsd: feeUsd,
      recipient: recipientWallet,
      chain: chainKey,
      network: cdpChain,
    });
  } else {
    console.error(`❌ [esports] ${token} payout failed: ${result.error}`);
    res.status(502).json({
      success: false,
      sessionId,
      error: result.error || 'Payout transaction failed',
      status: result.status,
    });
  }
});

// ============================================================
// ROUTE 1b — REGISTER RECIPIENT
// POST /api/partner/esports/register-recipient
// Pre-registers tournament winner wallets so they can receive VLT/USDC payouts.
// Call this when tournament ends and winners are determined, before calling /payout.
// ============================================================

router.post('/register-recipient', requirePartnerKey, async (req: any, res: Response) => {
  const { walletAddress, label, perTxLimitUsd, dailyLimitUsd } = req.body;

  if (!walletAddress) {
    res.status(400).json({ error: 'walletAddress is required' });
    return;
  }
  if (!ethers.isAddress(walletAddress)) {
    res.status(400).json({ error: 'Invalid walletAddress' });
    return;
  }

  const wallet = walletAddress.toLowerCase();
  const perTx  = perTxLimitUsd  ? parseFloat(perTxLimitUsd)  : 500;
  const daily  = dailyLimitUsd  ? parseFloat(dailyLimitUsd)  : 2000;

  if (isNaN(perTx) || perTx <= 0 || isNaN(daily) || daily <= 0) {
    res.status(400).json({ error: 'perTxLimitUsd and dailyLimitUsd must be positive numbers' });
    return;
  }

  try {
    // Upsert — re-registering a wallet updates its limits
    await db
      .insert(esportsPartnerRecipients)
      .values({
        partnerApiKeyHash: req.partnerApiKeyHash,
        walletAddress: wallet,
        chain: 'ethereum',
        label: label || null,
        perTxLimitUsd: perTx.toString(),
        dailyLimitUsd: daily.toString(),
        active: true,
      })
      .onConflictDoUpdate({
        target: [esportsPartnerRecipients.partnerApiKeyHash, esportsPartnerRecipients.walletAddress],
        set: {
          active: true,
          label: label || null,
          perTxLimitUsd: perTx.toString(),
          dailyLimitUsd: daily.toString(),
        },
      });

    // Auto-whitelist in the global CDP wallet safety layer
    await whitelistWallet(wallet, label || `esports-partner-${wallet.slice(0, 8)}`, 'esports-api', 'pre-approved tournament winner');

    console.log(`✅ [esports] Recipient registered: ${wallet} (partner: ${req.partnerApiKeyHash.slice(0, 8)}...)`);
    res.json({
      success: true,
      walletAddress: wallet,
      perTxLimitUsd: perTx,
      dailyLimitUsd: daily,
      message: 'Wallet registered and approved for payouts. Call POST /payout to send.',
    });
  } catch (err: any) {
    console.error('[esports] register-recipient error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// ROUTE 1c — WALLET BALANCE
// GET /api/partner/esports/wallet-balance
// Returns platform wallet balances for USDC and VLT.
// Use this to know when to top up the VLT float.
// ============================================================

router.get('/wallet-balance', requirePartnerKey, async (_req: any, res: Response) => {
  try {
    const [usdcBalance, vltBalance] = await Promise.allSettled([
      coinbaseCDPService.getTokenBalance(PLATFORM_WALLET, 'USDC', 'base-mainnet'),
      coinbaseCDPService.getTokenBalance(PLATFORM_WALLET, 'VLT', 'ethereum-mainnet'),
    ]);

    const vlt = getVltMarketData();
    const vltAmt = vltBalance.status === 'fulfilled' ? parseFloat(vltBalance.value) : 0;
    const usdcAmt = usdcBalance.status === 'fulfilled' ? parseFloat(usdcBalance.value) : 0;

    res.json({
      success: true,
      platformWallet: PLATFORM_WALLET,
      balances: {
        VLT: {
          amount: vltAmt.toFixed(4),
          valueUsd: (vltAmt * vlt.priceUsd).toFixed(2),
          priceUsd: vlt.priceUsd,
          chain: 'ethereum',
          note: vltAmt < 5000 ? '⚠️ Low — consider topping up. Send VLT to platform wallet.' : '✅ Healthy',
        },
        USDC: {
          amount: usdcAmt.toFixed(2),
          valueUsd: usdcAmt.toFixed(2),
          chain: 'base',
          note: usdcAmt < 500 ? '⚠️ Low USDC balance' : '✅ Healthy',
        },
      },
      swapQuotes: {
        note: 'Use POST /api/partner/esports/swap-quote to get live ETH→VLT or USDC→VLT quotes',
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// ROUTE 1d — SWAP QUOTE
// GET /api/partner/esports/swap-quote?type=eth-vlt&amount=0.5
// Returns a live Uniswap V2 quote. Does NOT execute the swap.
// ============================================================

router.get('/swap-quote', requirePartnerKey, async (req: any, res: Response) => {
  const { type, amount } = req.query as Record<string, string>;
  if (!type || !amount) {
    res.status(400).json({ error: 'type (eth-vlt or usdc-vlt) and amount are required' });
    return;
  }
  const amtNum = parseFloat(amount);
  if (isNaN(amtNum) || amtNum <= 0) {
    res.status(400).json({ error: 'amount must be a positive number' });
    return;
  }
  try {
    if (type === 'eth-vlt') {
      const quote = await quoteEthForVlt(amount);
      res.json({ success: true, type, ...quote });
    } else if (type === 'usdc-vlt') {
      const quote = await quoteUsdcForVlt(amount);
      res.json({ success: true, type, ...quote });
    } else {
      res.status(400).json({ error: 'type must be "eth-vlt" or "usdc-vlt"' });
    }
  } catch (err: any) {
    res.status(502).json({ success: false, error: err.message });
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
    version: '2.0.0',
    baseUrl: 'https://coinrailz.com/api/partner/esports',
    authentication: {
      method: 'Bearer token or X-API-Key header',
      example: 'Authorization: Bearer cr_live_...',
      getApiKey: 'POST https://coinrailz.com/api/m2m/credits/purchase',
    },
    fee: '1.5% per transaction (deducted from payout amount or collected entry fee)',
    supportedTokens: {
      USDC: {
        chains: ['base', 'ethereum'],
        default: true,
        notes: 'Recommended for entry fees and tips',
      },
      VLT: {
        chains: ['ethereum'],
        contract: '0x6b785a0322126826d8226d77e173d75DAfb84d11',
        notes: 'Bankroll Network token — prize payouts in VLT. Amount converted from USD at live price.',
        requiresRecipientRegistration: true,
      },
    },
    supportedChains: {
      base: {
        usdcAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        notes: 'Recommended for USDC — fast blocks, lowest gas fees',
      },
      ethereum: {
        usdcAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        notes: 'Required for VLT payouts',
      },
    },
    endpoints: {
      'POST /payout': {
        description: 'Send a prize payout to a tournament winner in USDC or VLT. Executes on-chain immediately.',
        body: {
          recipientWallet: '0x... (required)',
          amountUSD: '100 (required, number — always denominated in USD regardless of token)',
          chain: 'base (optional, default: base — ignored for VLT which is always ethereum)',
          currency: '"USDC" or "VLT" (optional, default: "USDC")',
          tournamentId: 'string (optional)',
          playerId: 'string (optional)',
        },
        successResponse: {
          success: true,
          txHash: '0x...',
          explorerUrl: 'https://etherscan.io/tx/0x...',
          currency: 'VLT',
          amountSentToken: 308.6,
          amountSentUsd: 98.5,
          feeCollectedToken: 4.7,
          feeCollectedUsd: 1.5,
        },
        vltNote: 'For currency:"VLT", recipient must be pre-registered via POST /register-recipient first.',
      },
      'POST /register-recipient': {
        description: 'Pre-register a winner wallet for VLT payouts. Call when tournament ends and winners are determined. Auto-whitelists wallet in the CDP safety layer.',
        body: {
          walletAddress: '0x... (required)',
          label: '"winner-tournament-123" (optional)',
          perTxLimitUsd: '500 (optional, default: 500)',
          dailyLimitUsd: '2000 (optional, default: 2000)',
        },
        successResponse: {
          success: true,
          walletAddress: '0x...',
          perTxLimitUsd: 500,
          dailyLimitUsd: 2000,
          message: 'Wallet registered and approved for payouts.',
        },
        flow: [
          '1. Tournament ends, determine winners',
          '2. POST /register-recipient for each winner wallet',
          '3. POST /payout with currency:"VLT" — executes immediately',
        ],
      },
      'GET /wallet-balance': {
        description: 'Check platform wallet balances for USDC and VLT. Use this to know when to top up the VLT float.',
        successResponse: {
          platformWallet: '0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91',
          balances: {
            VLT: { amount: '20000.0000', valueUsd: '6468.00', priceUsd: 0.3234, chain: 'ethereum', note: '✅ Healthy' },
            USDC: { amount: '1000.00', valueUsd: '1000.00', chain: 'base', note: '✅ Healthy' },
          },
        },
        topUpNote: 'Send VLT to 0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91 on Ethereum mainnet to replenish the float.',
      },
      'GET /swap-quote': {
        description: 'Get a live Uniswap V2 quote for ETH→VLT or USDC→VLT. Does NOT execute the swap.',
        query: {
          type: '"eth-vlt" or "usdc-vlt"',
          amount: '0.5 (number, ETH or USDC depending on type)',
        },
        successResponse: {
          success: true,
          type: 'eth-vlt',
          amountIn: '0.5',
          amountOut: '1543.2',
          minAmountOut: '1512.3',
          priceImpactPct: 0.12,
          path: ['0xWETH', '0xVLT'],
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
      vltPrizePayouts: [
        '1. Tournament ends, determine winners',
        '2. POST /register-recipient for each winner wallet (one-time per wallet)',
        '3. POST /payout with currency:"VLT", recipientWallet, amountUSD',
        '4. Coin Railz converts USD→VLT at live price, sends on-chain via CDP',
        '5. Returns txHash in seconds. Check etherscan.io/tx/...',
        '6. Optional: GET /wallet-balance to monitor VLT float health',
      ],
      usdcPrizePayouts: [
        '1. Tournament ends',
        '2. POST /payout with recipientWallet and amountUSD (currency:"USDC" is default)',
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
    vltTopUp: {
      platformWallet: '0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91',
      chain: 'Ethereum mainnet only',
      contract: '0x6b785a0322126826d8226d77e173d75DAfb84d11',
      recommended: 'Keep ≥20,000 VLT in platform wallet (~$6,000 at $0.32/VLT) to cover ~40 × $150 prize payouts',
      monitoring: 'GET /wallet-balance shows live VLT balance + ⚠️ warning when below 5,000 VLT',
    },
  });
});

export default router;
