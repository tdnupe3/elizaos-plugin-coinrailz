/**
 * vltUSDC Vault — Ethereum USDC payment lane
 *
 * Non-x402 REST endpoint for agents paying USDC on Ethereum mainnet.
 * No x402 library required — any HTTP client works.
 *
 * Flow:
 *   1. Agent sends (amountUsdc + $0.50 fee) USDC to the Coin Railz platform wallet on Ethereum
 *   2. Agent POSTs { txHash, amountUsdc, recipient } to this endpoint
 *   3. We verify the transfer on-chain (correct token, amount, destination, not replayed)
 *   4. We return unsigned vault deposit calldata — agent signs and broadcasts on Ethereum
 *
 * The $0.50 service fee stays with Coin Railz. The calldata is built for `amountUsdc`
 * (the deposit portion), so the agent receives vltUSDC shares proportional to amountUsdc.
 */

import { Router, Request, Response } from 'express';
import { verifyTransactionPayment } from '../middleware/hybridPaymentMiddleware.js';
import { buildVltUsdcDeposit } from '../services/vltUsdcDepositService.js';
import { PLATFORM_WALLETS } from '../utils/facilitatorHelper.js';

const router = Router();

const SERVICE_FEE_USD    = 0.50;
const SERVICE_NAME       = 'vlt-usdc-deposit-eth';
const PLATFORM_ETH_WALLET = PLATFORM_WALLETS.ethereum;
const USDC_ETH_ADDRESS   = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const VAULT_ADDRESS      = '0x348A57b1dc6E3dCAa645DE6e4E864924B410525D';

/**
 * GET /api/vault/vlt-deposit-calldata
 * Machine-readable discovery info — AI agents probe this before POSTing.
 */
router.get('/vlt-deposit-calldata', (_req: Request, res: Response) => {
  res.json({
    endpoint:    'POST /api/vault/vlt-deposit-calldata',
    description: 'Get unsigned ERC-4626 deposit calldata for the vltUSDC vault (Bankroll Network). Pay USDC on Ethereum mainnet — no x402 library required. Also available via x402 on Base.',
    payment: {
      token:       'USDC',
      network:     'Ethereum Mainnet (chainId 1)',
      usdcAddress: USDC_ETH_ADDRESS,
      payTo:       PLATFORM_ETH_WALLET,
      serviceFee:  '$0.50 USDC (added on top of deposit amount)',
      example:     'To deposit 100 USDC: send 100.50 USDC to payTo on Ethereum, then POST { txHash, amountUsdc: "100", recipient: "0x..." }',
    },
    request: {
      method:      'POST',
      contentType: 'application/json',
      body: {
        txHash:     'string — 0x-prefixed Ethereum tx hash of your USDC transfer to payTo',
        amountUsdc: 'string | number — deposit amount in USDC (do NOT include service fee)',
        recipient:  'string — Ethereum address that will receive vltUSDC shares',
      },
    },
    response: {
      steps:   '2 unsigned Ethereum transactions: Step 1 USDC.approve(vault), Step 2 vault.deposit(amount, recipient)',
      vault:   VAULT_ADDRESS,
      chainId: 1,
      note:    'Sign and broadcast each step on Ethereum mainnet in order. Wait for Step 1 to confirm before sending Step 2.',
    },
    alsoAvailable: {
      x402Base: 'POST /x402/vlt-usdc-deposit — same calldata, pay $0.50 USDC on Base via x402 protocol',
    },
  });
});

/**
 * POST /api/vault/vlt-deposit-calldata
 *
 * Body: { txHash: string, amountUsdc: string|number, recipient: string }
 *
 * Agent sends (amountUsdc + 0.50) USDC to PLATFORM_ETH_WALLET on Ethereum.
 * On verified payment, returns unsigned approve + deposit calldata for Ethereum.
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
        error:   'txHash is required and must be a 66-character 0x-prefixed Ethereum transaction hash',
        example: '0x' + 'a'.repeat(64),
      });
    }

    if (amountUsdc === undefined || amountUsdc === null || amountUsdc === '') {
      return res.status(400).json({
        success: false,
        error:   'amountUsdc is required — the USDC deposit amount (service fee of $0.50 is added separately)',
        example: { txHash: '0x...', amountUsdc: '100', recipient: '0x...' },
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
    // Total required: deposit amount + $0.50 service fee (6 USDC decimals)
    const totalRequired = depositAmount + SERVICE_FEE_USD;
    const totalRequiredMicro = Math.floor(totalRequired * 1_000_000);

    console.log(`[vlt-vault] Verifying Ethereum USDC payment: txHash=${txHash.slice(0, 18)}... required=${totalRequired} USDC`);

    const verification = await verifyTransactionPayment(
      txHash,
      SERVICE_NAME,
      totalRequiredMicro,
      'ethereum',
    );

    if (!verification.verified) {
      return res.status(402).json({
        success: false,
        error:   'Payment not verified',
        payment_required: {
          description:   `Send ${totalRequired.toFixed(6)} USDC on Ethereum mainnet to the payTo address, then retry with the txHash.`,
          payTo:         PLATFORM_ETH_WALLET,
          usdcAddress:   USDC_ETH_ADDRESS,
          network:       'Ethereum Mainnet',
          chainId:       1,
          amountBreakdown: {
            depositAmount: `${depositAmount.toFixed(6)} USDC → enters the vault, mints vltUSDC to recipient`,
            serviceFee:    `${SERVICE_FEE_USD.toFixed(2)} USDC → Coin Railz calldata fee`,
            total:         `${totalRequired.toFixed(6)} USDC`,
          },
          steps: [
            `1. On Ethereum mainnet, send ${totalRequired.toFixed(6)} USDC (token: ${USDC_ETH_ADDRESS}) to ${PLATFORM_ETH_WALLET}`,
            '2. Wait for the transaction to confirm (1–2 blocks, ~15–30 seconds)',
            `3. POST to this endpoint with { txHash: "<your_tx_hash>", amountUsdc: "${depositAmount}", recipient: "<your_eth_address>" }`,
          ],
        },
        alsoAvailable: {
          x402Base: 'POST /x402/vlt-usdc-deposit — pay $0.50 USDC on Base (faster, cheaper) via x402 protocol',
        },
      });
    }

    // ── Build calldata ──────────────────────────────────────────────────────
    console.log(`[vlt-vault] ✅ Payment verified. Building deposit calldata for ${depositAmount} USDC → ${recipient}`);
    const calldata = await buildVltUsdcDeposit(depositAmount, recipient);

    return res.json({
      success:          true,
      paymentVerified:  true,
      paymentNetwork:   'Ethereum Mainnet',
      txHash,
      serviceFee:       `${SERVICE_FEE_USD.toFixed(2)} USDC collected`,
      depositAmount:    `${depositAmount.toFixed(6)} USDC`,
      ...calldata,
    });

  } catch (err: any) {
    console.error('[vlt-vault] Unexpected error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
