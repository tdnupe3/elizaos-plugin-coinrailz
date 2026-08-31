/**
 * vltUSDC Vault — Ethereum calldata lane
 *
 * FREE endpoints. No payment required.
 * Bankroll Network partnership — vault LP fees flow to VLT holders.
 *
 * Two deposit paths:
 *   A) Balanced  (VLT + USDC): POST /vlt-deposit-calldata   → 3 txs (VLT approve + USDC approve + vault.deposit)
 *   B) USDC-only (ZapHelper):  POST /vlt-zap-deposit        → 2 txs (USDC approve + zapDeposit)
 *
 * Path B: ZapHelper swaps ~50% USDC→VLT on-market via V3(USDC→WETH)+V2(WETH→VLT),
 * then deposits both into the vltUSDC vault. Live quote + 1% slippage protection.
 */

import { Router, Request, Response } from 'express';
import { buildVltUsdcDeposit } from '../services/vltUsdcDepositService.js';

const router = Router();

const VAULT_ADDRESS    = '0xee8d4c5c768AadCd3517Aa8C908De300305D0A7f';
const ZAP_HELPER       = '0x348A57b1dc6E3dCAa645DE6e4E864924B410525D';
const VLT_ADDRESS      = '0x6b785a0322126826d8226d77e173d75DAfb84d11';
const USDC_ETH_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';

// ── GET /api/vault/vlt-deposit-calldata — discovery ──────────────────────────

router.get('/vlt-deposit-calldata', (_req: Request, res: Response) => {
  res.json({
    endpoint:    'POST /api/vault/vlt-deposit-calldata',
    description: 'FREE — Balanced deposit: returns VLT approve + USDC approve + vault.deposit calldata. Agent must hold both VLT and USDC on Ethereum mainnet.',
    payment:     'none — free',
    pool:        'VLT/USDC · Uniswap V4 · full-range · 1% fee',
    audit:       'Shieldify — bankroll.network/security.html',
    modes: {
      balanced: {
        endpoint:   'POST /api/vault/vlt-deposit-calldata',
        requires:   'VLT + USDC on Ethereum mainnet',
        steps:      3,
        txs:        'VLT.approve(vault) → USDC.approve(vault) → vault.deposit(vltAmount, usdcAmount, minShares, deadline, recipient)',
      },
      usdcOnly: {
        endpoint:   'POST /api/vault/vlt-zap-deposit',
        requires:   'USDC only on Ethereum mainnet — no VLT needed',
        steps:      2,
        txs:        'USDC.approve(zapHelper) → zapHelper.zapDeposit(..., swapData)',
        route:      'USDC –[V3 0.05%]→ WETH –[V2]→ VLT + USDC → vltUSDC vault',
        slippage:   '1% on VLT output, live on-chain quote',
      },
    },
    contracts: {
      vault:    VAULT_ADDRESS,
      zapHelper: ZAP_HELPER,
      vlt:      VLT_ADDRESS,
      usdc:     USDC_ETH_ADDRESS,
      chainId:  1,
    },
    alsoAvailable: {
      x402Balanced: 'POST /x402/vlt-usdc-deposit',
      x402UsdcOnly: 'POST /x402/vlt-usdc-deposit with body field usdcOnly:true',
      bankrollUi:   'https://bankroll.network/vltUSDC.html',
    },
  });
});

// ── POST /api/vault/vlt-deposit-calldata — balanced (VLT + USDC) ─────────────

router.post('/vlt-deposit-calldata', async (req: Request, res: Response) => {
  try {
    const { amountUsdc, recipient } = req.body as {
      amountUsdc?: string | number;
      recipient?:  string;
    };

    if (amountUsdc === undefined || amountUsdc === null || amountUsdc === '') {
      return res.status(400).json({
        success: false,
        error:   'amountUsdc is required',
        example: { amountUsdc: '100', recipient: '0x...' },
        tip:     'If you only have USDC (no VLT), use POST /api/vault/vlt-zap-deposit instead.',
      });
    }

    const depositAmount = parseFloat(String(amountUsdc));
    if (isNaN(depositAmount) || depositAmount <= 0) {
      return res.status(400).json({ success: false, error: 'amountUsdc must be a positive number' });
    }

    if (!recipient || !/^0x[0-9a-fA-F]{40}$/.test(recipient)) {
      return res.status(400).json({ success: false, error: 'recipient must be a valid Ethereum address (0x + 40 hex characters)' });
    }

    const calldata = await buildVltUsdcDeposit(depositAmount, recipient);
    return res.json({ ...calldata, success: true, free: true });

  } catch (err: any) {
    console.error('[vlt-vault] Balanced deposit error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/vault/vlt-zap-deposit — USDC-only discovery ─────────────────────

router.get('/vlt-zap-deposit', (_req: Request, res: Response) => {
  res.json({
    endpoint:    'POST /api/vault/vlt-zap-deposit',
    description: 'FREE — USDC-only deposit via ZapHelper. No VLT required. ZapHelper buys VLT on-market (V3 USDC→WETH 0.05% + V2 WETH→VLT) and deposits both into the vltUSDC vault in a single transaction. Live quote with 1% slippage protection.',
    payment:     'none — free',
    requires:    'USDC on Ethereum mainnet only',
    steps:       2,
    body: {
      amountUsdc: 'string | number — total USDC to deposit (minimum 1 USDC)',
      recipient:  'string — Ethereum address that will receive vltUSDC shares',
    },
    response: {
      steps:        '2 unsigned txs: step 1 USDC.approve(zapHelper, amount), step 2 zapHelper.zapDeposit(7 args including live swapData)',
      swapRoute:    'USDC –[Uniswap V3 0.05%]→ WETH –[Uniswap V2]→ VLT',
      zapHelper:    ZAP_HELPER,
      vaultAddress: VAULT_ADDRESS,
      chainId:      1,
    },
  });
});

// ── POST /api/vault/vlt-zap-deposit — USDC-only (ZapHelper) ─────────────────

router.post('/vlt-zap-deposit', async (req: Request, res: Response) => {
  try {
    const { amountUsdc, recipient } = req.body as {
      amountUsdc?: string | number;
      recipient?:  string;
    };

    if (amountUsdc === undefined || amountUsdc === null || amountUsdc === '') {
      return res.status(400).json({
        success: false,
        error:   'amountUsdc is required',
        example: { amountUsdc: '100', recipient: '0x...' },
      });
    }

    const depositAmount = parseFloat(String(amountUsdc));
    if (isNaN(depositAmount) || depositAmount < 1) {
      return res.status(400).json({ success: false, error: 'amountUsdc must be ≥ 1 USDC' });
    }

    if (!recipient || !/^0x[0-9a-fA-F]{40}$/.test(recipient)) {
      return res.status(400).json({ success: false, error: 'recipient must be a valid Ethereum address (0x + 40 hex characters)' });
    }

    console.log(`[vlt-zap] Building USDC-only zap for ${depositAmount} USDC → ${recipient}`);
    const { buildZapDeposit } = await import('../services/vltUsdcZapService.js');
    const result = await buildZapDeposit(depositAmount, recipient);

    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.json({ ...result, success: true, free: true });

  } catch (err: any) {
    console.error('[vlt-zap] Unexpected error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
