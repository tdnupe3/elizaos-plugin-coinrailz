/**
 * vltUSDC Vault — Ethereum USDC payment lane
 *
 * Non-x402 REST endpoint for agents paying USDC on Ethereum mainnet.
 * No x402 library required — any HTTP client works.
 *
 * Fee model (corrected):
 *   The $0.50 is the SERVICE FEE — the price of this API call.
 *   The agent sends ONLY $0.50 to the Coin Railz platform wallet.
 *   The deposit USDC stays in the agent's own wallet; amountUsdc is a
 *   calldata parameter, not a transfer to us.
 *
 * Flow:
 *   1. Agent sends $0.50 USDC to Coin Railz platform wallet on Ethereum
 *   2. Agent POSTs { txHash, amountUsdc, recipient }
 *      — txHash: the $0.50 fee transfer
 *      — amountUsdc: how much USDC the agent holds and wants to deposit (stays in their wallet)
 *      — recipient: Ethereum address to receive vltUSDC shares
 *   3. We verify the $0.50 on-chain, return calldata
 *   4. Agent executes: approve(vault, amountUsdc) + deposit(amountUsdc, recipient) from THEIR wallet
 *
 * This mirrors the x402 Base lane: pay $0.50 somewhere → get calldata → execute from your own wallet.
 * The difference is WHERE the $0.50 is paid (Ethereum vs Base).
 */

import { Router, Request, Response } from 'express';
import { verifyTransactionPayment } from '../middleware/hybridPaymentMiddleware.js';
import { buildVltUsdcDeposit } from '../services/vltUsdcDepositService.js';
import { PLATFORM_WALLETS } from '../utils/facilitatorHelper.js';

const router = Router();

const SERVICE_FEE_USD     = 0.50;
const SERVICE_FEE_MICRO   = 500_000; // $0.50 in USDC micros (6 decimals)
const SERVICE_NAME        = 'vlt-usdc-deposit-eth';
const PLATFORM_ETH_WALLET = PLATFORM_WALLETS.ethereum;
const USDC_ETH_ADDRESS    = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const VAULT_ADDRESS       = '0x348A57b1dc6E3dCAa645DE6e4E864924B410525D';

/**
 * GET /api/vault/vlt-deposit-calldata
 * Machine-readable discovery info — AI agents probe this before POSTing.
 */
router.get('/vlt-deposit-calldata', (_req: Request, res: Response) => {
  res.json({
    endpoint:    'POST /api/vault/vlt-deposit-calldata',
    description: 'Get unsigned ERC-4626 deposit calldata for the vltUSDC vault (Bankroll Network). Pay a $0.50 service fee in USDC on Ethereum mainnet — your deposit USDC stays in your wallet and is encoded into the returned calldata.',
    payment: {
      token:       'USDC',
      network:     'Ethereum Mainnet (chainId 1)',
      usdcAddress: USDC_ETH_ADDRESS,
      payTo:       PLATFORM_ETH_WALLET,
      serviceFee:  '$0.50 USDC — this is the API fee only. Your deposit USDC stays in your wallet.',
      example:     'Send $0.50 USDC to payTo on Ethereum. Then POST { txHash: "<fee_tx>", amountUsdc: "100", recipient: "0x..." } to get calldata for a 100 USDC deposit.',
    },
    request: {
      method:      'POST',
      contentType: 'application/json',
      body: {
        txHash:     'string — 0x-prefixed Ethereum tx hash of your $0.50 USDC fee transfer to payTo',
        amountUsdc: 'string | number — the USDC amount you want to deposit (must be in YOUR wallet, not sent to us)',
        recipient:  'string — Ethereum address that will receive vltUSDC shares',
      },
    },
    response: {
      steps:   '2 unsigned Ethereum transactions to sign from your own wallet: Step 1 USDC.approve(vault, amountUsdc), Step 2 vault.deposit(amountUsdc, recipient)',
      vault:   VAULT_ADDRESS,
      chainId: 1,
      note:    'Your USDC never touches Coin Railz. Only the $0.50 fee is sent to us. Sign and broadcast each step in order.',
    },
    alsoAvailable: {
      x402Base: 'POST /x402/vlt-usdc-deposit — same calldata, pay $0.50 USDC on Base via x402 protocol (cheaper gas for the fee)',
    },
  });
});

/**
 * POST /api/vault/vlt-deposit-calldata
 *
 * Body: { txHash: string, amountUsdc: string|number, recipient: string }
 *
 * txHash must be a confirmed $0.50 USDC transfer to PLATFORM_ETH_WALLET.
 * amountUsdc is the deposit amount in the agent's OWN wallet — it is encoded
 * into the calldata but never sent to Coin Railz.
 */
router.post('/vlt-deposit-calldata', async (req: Request, res: Response) => {
  try {
    const { txHash, amountUsdc, recipient } = req.body as {
      txHash?:     string;
      amountUsdc?: string | number;
      recipient?:  string;
    };

    // ── Input validation ────────────────────────────────────────────────────
    if (!txHash || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
      return res.status(400).json({
        success: false,
        error:   'txHash is required — the Ethereum tx hash of your $0.50 USDC fee transfer to the Coin Railz wallet',
        payTo:   PLATFORM_ETH_WALLET,
        example: '0x' + 'a'.repeat(64),
      });
    }

    if (amountUsdc === undefined || amountUsdc === null || amountUsdc === '') {
      return res.status(400).json({
        success: false,
        error:   'amountUsdc is required — the USDC amount you hold in your wallet and want to deposit into vltUSDC',
        note:    'This stays in your wallet. Only the $0.50 service fee is sent to Coin Railz.',
        example: { txHash: '0x...fee_transfer_hash', amountUsdc: '100', recipient: '0x...' },
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

    // ── Payment verification ────────────────────────────────────────────────
    // Only verify the $0.50 service fee — deposit USDC stays in the agent's wallet.
    // 12-second timeout: Ethereum block time is ~12s. If the tx isn't indexed in
    // that window, tell the agent to wait for on-chain confirmation and retry.
    console.log(`[vlt-vault] Verifying $0.50 fee tx on Ethereum: ${txHash.slice(0, 18)}...`);

    const VERIFY_TIMEOUT_MS = 12_000;
    const verifyWithTimeout = Promise.race([
      verifyTransactionPayment(txHash, SERVICE_NAME, SERVICE_FEE_MICRO, 'ethereum'),
      new Promise<{ verified: false; timedOut: true }>((resolve) =>
        setTimeout(() => resolve({ verified: false, timedOut: true }), VERIFY_TIMEOUT_MS)
      ),
    ]);

    const verification = await verifyWithTimeout;

    if (!verification.verified && (verification as any).timedOut) {
      return res.status(402).json({
        success: false,
        error:   'Transaction not confirmed yet',
        payment_required: {
          description:  'Your transaction was not found on-chain within 12 seconds. Wait for it to confirm (1–2 Ethereum blocks, ~15–30 seconds), then retry this endpoint with the same txHash.',
          txHash,
          payTo:        PLATFORM_ETH_WALLET,
          usdcAddress:  USDC_ETH_ADDRESS,
          amount:       `${SERVICE_FEE_USD.toFixed(2)} USDC`,
          network:      'Ethereum Mainnet',
          retryAfterMs: 15_000,
        },
      });
    }

    if (!verification.verified) {
      return res.status(402).json({
        success: false,
        error:   'Service fee payment not verified',
        payment_required: {
          description:  `Send exactly $${SERVICE_FEE_USD.toFixed(2)} USDC to the payTo address on Ethereum mainnet, then retry with that transaction hash.`,
          payTo:        PLATFORM_ETH_WALLET,
          usdcAddress:  USDC_ETH_ADDRESS,
          amount:       `${SERVICE_FEE_USD.toFixed(2)} USDC (service fee only — your deposit USDC stays in your wallet)`,
          network:      'Ethereum Mainnet',
          chainId:      1,
          steps: [
            `1. Send ${SERVICE_FEE_USD.toFixed(2)} USDC (token: ${USDC_ETH_ADDRESS}) to ${PLATFORM_ETH_WALLET} on Ethereum`,
            '2. Wait for confirmation (~15–30 seconds)',
            `3. POST here with { txHash: "<fee_tx_hash>", amountUsdc: "${depositAmount}", recipient: "<your_address>" }`,
            '4. Sign and broadcast the two returned calldata steps from your own wallet',
          ],
        },
        alsoAvailable: {
          x402Base: 'POST /x402/vlt-usdc-deposit — same result, pay $0.50 USDC on Base (lower gas for the fee transfer)',
        },
      });
    }

    // ── Build calldata ──────────────────────────────────────────────────────
    console.log(`[vlt-vault] ✅ Fee verified. Building calldata for ${depositAmount} USDC deposit → ${recipient}`);
    const calldata = await buildVltUsdcDeposit(depositAmount, recipient);

    return res.json({
      success:         true,
      paymentVerified: true,
      paymentNetwork:  'Ethereum Mainnet',
      feeTxHash:       txHash,
      serviceFee:      `$${SERVICE_FEE_USD.toFixed(2)} USDC collected`,
      depositAmount:   `${depositAmount.toFixed(6)} USDC (to be deposited from your wallet)`,
      ...calldata,
    });

  } catch (err: any) {
    console.error('[vlt-vault] Unexpected error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
