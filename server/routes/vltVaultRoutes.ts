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

const VAULT_ADDRESS    = '0x348A57b1dc6E3dCAa645DE6e4E864924B410525D';
const USDC_ETH_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';

/**
 * GET /api/vault/vlt-deposit-calldata
 * Machine-readable discovery — AI agents probe this before POSTing.
 */
router.get('/vlt-deposit-calldata', (_req: Request, res: Response) => {
  res.json({
    endpoint:    'POST /api/vault/vlt-deposit-calldata',
    description: 'FREE — Get unsigned ERC-4626 deposit calldata for the Bankroll Network vltUSDC vault on Ethereum mainnet. No payment required. Your deposit USDC stays in your wallet.',
    payment:     'none — this endpoint is free',
    request: {
      method:      'POST',
      contentType: 'application/json',
      body: {
        amountUsdc: 'string | number — USDC amount to deposit (stays in YOUR wallet until you execute)',
        recipient:  'string — Ethereum address that will receive vltUSDC shares',
      },
    },
    response: {
      steps:   '2 unsigned Ethereum transactions: Step 1 USDC.approve(vault, amountUsdc), Step 2 vault.deposit(amountUsdc, recipient)',
      vault:   VAULT_ADDRESS,
      chainId: 1,
      note:    'Sign and broadcast each step in order on Ethereum mainnet.',
    },
    alsoAvailable: {
      x402:    'POST /x402/vlt-usdc-deposit — same calldata, also free, discoverable via x402scan and Coinbase Bazaar',
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
