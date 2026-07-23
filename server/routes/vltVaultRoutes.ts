/**
 * vltUSDC Vault — Ethereum calldata lane
 *
 * FREE endpoint. No payment required.
 * Bankroll Network partnership — vault LP fees flow to VLT holders.
 *
 * Flow:
 *   1. Agent POSTs { amountUsdc, recipient }
 *   2. Returns 2 unsigned Ethereum transactions: USDC.approve + vault.deposit
 *   3. Agent signs and broadcasts both on Ethereum mainnet
 */

import { Router, Request, Response } from 'express';
import { buildVltUsdcDeposit } from '../services/vltUsdcDepositService.js';

const router = Router();

const VAULT_ADDRESS    = '0xee8d4c5c768AadCd3517Aa8C908De300305D0A7f'; // vault IS the vltUSDC ERC-20
const ZAP_HELPER       = '0x348A57b1dc6E3dCAa645DE6e4E864924B410525D'; // USDC-only periphery
const VLT_ADDRESS      = '0x6b785a0322126826d8226d77e173d75DAfb84d11';
const USDC_ETH_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';

/**
 * GET /api/vault/vlt-deposit-calldata
 * Machine-readable discovery — AI agents probe this before POSTing.
 */
router.get('/vlt-deposit-calldata', (_req: Request, res: Response) => {
  res.json({
    endpoint:    'POST /api/vault/vlt-deposit-calldata',
    description: 'FREE — Get unsigned VLT approve + USDC approve + vault.deposit calldata for the Bankroll Network vltUSDC vault on Ethereum mainnet. Underlying pool: VLT/USDC Uniswap V4 full-range 1% fee. Auto-compounds LP fees. No payment required. Your tokens stay in your wallet until you broadcast.',
    payment:     'none — this endpoint is free',
    pool:        'VLT/USDC · Uniswap V4 · full-range · 1% fee',
    audit:       'Shieldify — bankroll.network/security.html',
    request: {
      method:      'POST',
      contentType: 'application/json',
      body: {
        amountUsdc: 'string | number — USDC amount to deposit (agent must also hold equivalent VLT)',
        recipient:  'string — Ethereum address that will receive vltUSDC shares',
      },
    },
    response: {
      steps:      '3 unsigned Ethereum transactions in order: VLT.approve(vault), USDC.approve(vault), vault.deposit(vltAmount, usdcAmount, minShares, deadline, recipient)',
      vault:      VAULT_ADDRESS,
      zapHelper:  ZAP_HELPER,
      vlt:        VLT_ADDRESS,
      usdc:       USDC_ETH_ADDRESS,
      chainId:    1,
      note:       'Sign and broadcast each step in order on Ethereum mainnet. Vault returns any token excess automatically. For USDC-only deposits use the ZapHelper (requires live swap routing data — best via Bankroll UI).',
    },
    alsoAvailable: {
      x402:    'POST /x402/vlt-usdc-deposit — same calldata, also free, discoverable via x402scan and Coinbase Bazaar',
      bankrollUi: 'https://bankroll.network/vltUSDC.html — full UI with USDC-only zap, redeem, live stats',
    },
  });
});

/**
 * POST /api/vault/vlt-deposit-calldata
 * Body: { amountUsdc: string|number, recipient: string }
 * Free — no payment required.
 */
router.post('/vlt-deposit-calldata', async (req: Request, res: Response) => {
  try {
    const { amountUsdc, recipient } = req.body as {
      amountUsdc?: string | number;
      recipient?:  string;
    };

    if (amountUsdc === undefined || amountUsdc === null || amountUsdc === '') {
      return res.status(400).json({
        success: false,
        error:   'amountUsdc is required — the USDC amount you want to deposit',
        example: { amountUsdc: '100', recipient: '0x...' },
      });
    }

    const depositAmount = parseFloat(String(amountUsdc));
    if (isNaN(depositAmount) || depositAmount <= 0) {
      return res.status(400).json({
        success: false,
        error:   'amountUsdc must be a positive number',
      });
    }

    if (!recipient || !/^0x[0-9a-fA-F]{40}$/.test(recipient)) {
      return res.status(400).json({
        success: false,
        error:   'recipient must be a valid Ethereum address (0x + 40 hex characters)',
      });
    }

    console.log(`[vlt-vault] Building free calldata for ${depositAmount} USDC → ${recipient}`);
    const calldata = await buildVltUsdcDeposit(depositAmount, recipient);

    return res.json({
      success:       true,
      free:          true,
      depositAmount: `${depositAmount.toFixed(6)} USDC`,
      ...calldata,
    });

  } catch (err: any) {
    console.error('[vlt-vault] Unexpected error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
