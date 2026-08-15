/**
 * vltUSDC Deposit Builder — x402 service handler
 *
 * Builds unsigned calldata for a BALANCED deposit into the Bankroll Network
 * vltUSDC vault on Ethereum mainnet.
 *
 * Vault contract (= vltUSDC ERC-20 share token):
 *   0xee8d4c5c768AadCd3517Aa8C908De300305D0A7f
 *   deposit(uint256 vltAmount, uint256 usdcAmount, uint256 minShares, uint256 deadline, address recipient)
 *
 * ZapHelper (USDC-only periphery):
 *   0x348A57b1dc6E3dCAa645DE6e4E864924B410525D
 *   zapDeposit(uint256 usdcAmount, uint256 swapUsdcToVlt, uint256 minVltOut, uint256 deadline, address recipient, bytes swapData)
 *   NOTE: zapDeposit requires live swap routing data (encoded Universal Router path).
 *   AI agents should use the balanced deposit path (both tokens) via this builder,
 *   or use the Bankroll UI at https://bankroll.network/vltUSDC.html for USDC-only.
 *
 * Underlying pool: VLT/USDC · full-range · Uniswap V4 · 1% fee
 *   VLT  (currency0): 0x6b785a0322126826d8226d77e173d75DAfb84d11
 *   USDC (currency1): 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
 *
 * Steps returned (balanced deposit):
 *   1. VLT.approve(vault, vltAmount)    — grant vault permission to spend VLT
 *   2. USDC.approve(vault, usdcAmount)  — grant vault permission to spend USDC
 *   3. vault.deposit(vltAmount, usdcAmount, minShares=0, deadline, recipient)
 *
 * The vault uses both tokens in proportion to the current pool price.
 * Any excess of one token is automatically returned to the recipient.
 * No custody — funds never leave the agent's wallet until they submit tx 3.
 */

import { ethers } from 'ethers';
import { getVltMarketData } from './vltMarketCache.js';
import { getVltUsdcStatsFresh } from './vltUsdcVaultService.js';
import { VAULT_ADDRESS, VLT_TOKEN, USDC_ETH, ZAP_HELPER, VAULT_DEPOSIT_ABI, ERC20_APPROVE_ABI } from './vltSharedAbi.js';

const SHARE_SLIPPAGE_BPS = 200n; // 2% — matches zap service
const CHAIN_ID            = 1;
const DEADLINE_SECONDS    = 30 * 60; // 30 minutes — stale-tx guard matching Bankroll's UI default

// ethers.Interface instances built from the shared canonical ABI source
const ERC20_IFACE = new ethers.Interface(ERC20_APPROVE_ABI);
// VAULT_DEPOSIT_ABI covers both previewDeposit and deposit — used for reads and calldata encoding
const VAULT_IFACE = new ethers.Interface(VAULT_DEPOSIT_ABI);

export interface DepositCalldataResult {
  success: boolean;
  amountUsdc: string;
  amountUsdcRaw: string;
  amountVlt: string;
  amountVltRaw: string;
  recipient: string;
  network: string;
  chainId: number;
  steps: Array<{
    step: number;
    action: string;
    to: string;
    data: string;
    value: string;
    gasEstimate: string;
    note: string;
  }>;
  vaultStats: {
    tvlUsd: number;
    lPerShare: number;
    aprDisplay: string;
    vltPriceUsd: number;
  };
  zapHelperNote: string;
  agentInstructions: string;
  error?: string;
}

export async function buildVltUsdcDeposit(
  amountUsdc: string | number,
  recipient: string,
): Promise<DepositCalldataResult> {
  if (!recipient || !/^0x[0-9a-fA-F]{40}$/.test(recipient)) {
    return errorResult(amountUsdc, recipient, 'recipient must be a valid Ethereum address (0x + 40 hex chars)');
  }

  // Normalize to EIP-55 checksum form — accepts lowercase, uppercase, or mixed-case addresses.
  // ethers.encodeFunctionData calls ethers.getAddress() internally and throws on bad checksum;
  // normalizing via toLowerCase() → getAddress() avoids 500s for valid-hex non-checksummed input.
  let normalizedRecipient: string;
  try {
    normalizedRecipient = ethers.getAddress(recipient.toLowerCase());
  } catch {
    return errorResult(amountUsdc, recipient, 'recipient is not a valid Ethereum address (must be 0x + 40 hex characters)');
  }

  const amount = parseFloat(String(amountUsdc));
  if (isNaN(amount) || amount <= 0) {
    return errorResult(amountUsdc, recipient, 'amountUsdc must be a positive number');
  }

  // Fetch VLT price to estimate how much VLT pairs with the given USDC amount.
  // For a full-range V4 pool, roughly half the value sits in each token at the midpoint.
  // We use a 1:1 value split as the estimate, with 5% extra VLT as slippage buffer.
  // The vault returns any excess token to the recipient automatically.
  const vlt = getVltMarketData();
  const vltPriceUsd = vlt.priceUsd > 0 ? vlt.priceUsd : 0.32;

  // Estimate: deposit equal USD value of each token (split 50/50 by value)
  // Add 5% buffer on VLT in case ratio has shifted toward USDC
  const usdcHalf = amount * 0.5;
  const vltEstimate = (usdcHalf / vltPriceUsd) * 1.05;

  // USDC: 6 decimals; VLT: 18 decimals
  const usdcRaw = ethers.parseUnits(amount.toFixed(6), 6);
  const vltRaw  = ethers.parseUnits(vltEstimate.toFixed(18), 18);

  const deadline = BigInt(Math.floor(Date.now() / 1000) + DEADLINE_SECONDS);

  // Fetch minShares via vault.previewDeposit with 2% slippage — same pattern as zap service.
  // Fails gracefully: if RPC unavailable, falls back to 1n (non-zero minimum) and warns.
  let minSharesRaw = 1n;
  let minSharesSource = 'non-zero-fallback';
  try {
    const rpcUrl = `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY ?? ''}`;
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const vault = new ethers.Contract(VAULT_ADDRESS, VAULT_DEPOSIT_ABI, provider);
    const preview = await vault.previewDeposit(vltRaw, usdcRaw);
    const previewShares = BigInt(preview.toString());
    if (previewShares > 0n) {
      const slipped = previewShares * (10000n - SHARE_SLIPPAGE_BPS) / 10000n;
      minSharesRaw = slipped > 0n ? slipped : 1n;
      minSharesSource = 'vault-preview-2pct';
    }
  } catch {
    // Non-fatal — balanced deposit still works but with minimal slippage protection
    console.warn('[vltUSDC Deposit] vault.previewDeposit unavailable — using minShares=1 fallback');
  }

  // Build calldata
  const vltApproveData  = ERC20_IFACE.encodeFunctionData('approve', [VAULT_ADDRESS, vltRaw]);
  const usdcApproveData = ERC20_IFACE.encodeFunctionData('approve', [VAULT_ADDRESS, usdcRaw]);
  const depositData     = VAULT_IFACE.encodeFunctionData('deposit', [
    vltRaw,
    usdcRaw,
    minSharesRaw,   // slippage-protected: vault.previewDeposit × 0.98 (or 1n fallback)
    deadline,
    normalizedRecipient,
  ]);

  let vaultStats = { tvlUsd: 0, lPerShare: 1.0, aprDisplay: 'New', vltPriceUsd };
  try {
    const stats = await getVltUsdcStatsFresh();
    vaultStats = {
      tvlUsd:      stats.stats.tvlUsd,
      lPerShare:   stats.stats.lPerShare,
      aprDisplay:  stats.stats.aprDisplay,
      vltPriceUsd: stats.stats.vltPriceUsd,
    };
  } catch { /* non-fatal */ }

  return {
    success: true,
    amountUsdc: amount.toFixed(6),
    amountUsdcRaw: usdcRaw.toString(),
    amountVlt: vltEstimate.toFixed(6),
    amountVltRaw: vltRaw.toString(),
    recipient: normalizedRecipient,
    network: 'Ethereum Mainnet',
    chainId: CHAIN_ID,
    steps: [
      {
        step: 1,
        action: 'Approve VLT to vltUSDC Vault',
        to: VLT_TOKEN,
        data: vltApproveData,
        value: '0x0',
        gasEstimate: '0xCB20', // ~52,000 gas
        note: `Grant the vault (${VAULT_ADDRESS}) permission to spend ~${vltEstimate.toFixed(4)} VLT. Must confirm before Step 3.`,
      },
      {
        step: 2,
        action: 'Approve USDC to vltUSDC Vault',
        to: USDC_ETH,
        data: usdcApproveData,
        value: '0x0',
        gasEstimate: '0xCB20', // ~52,000 gas
        note: `Grant the vault permission to spend ${amount.toFixed(6)} USDC. Must confirm before Step 3.`,
      },
      {
        step: 3,
        action: 'Deposit VLT + USDC → vltUSDC shares',
        to: VAULT_ADDRESS,
        data: depositData,
        value: '0x0',
        gasEstimate: '0x61A80', // ~400,000 gas (V4 liquidity provision)
        note: `Vault adds VLT + USDC as liquidity into the Uniswap V4 VLT/USDC position and mints vltUSDC shares to ${normalizedRecipient}. Any token excess is returned automatically.`,
      },
    ],
    vaultStats,
    zapHelperNote: `USDC-only deposits are also possible via the ZapHelper at ${ZAP_HELPER} (function zapDeposit), which buys VLT on-market first. This requires live swap routing data from the Uniswap Universal Router and is best done via the Bankroll UI at https://bankroll.network/vltUSDC.html or by fetching a swap quote from the Uniswap routing API.`,
    agentInstructions: [
      `You need both VLT and USDC on Ethereum mainnet (chainId ${CHAIN_ID}).`,
      `VLT token: ${VLT_TOKEN}. USDC token: ${USDC_ETH}.`,
      `Step 1: sign and broadcast the VLT approve transaction. Wait for confirmation.`,
      `Step 2: sign and broadcast the USDC approve transaction. Wait for confirmation.`,
      `Step 3: sign and broadcast the vault deposit transaction. The vault mints vltUSDC shares to your address.`,
      `vltUSDC (${VAULT_ADDRESS}) auto-compounds LP fees from the VLT/USDC Uniswap V4 pool — no claiming needed.`,
      `Redeem anytime: vault.redeem(shares, minVltOut, minUsdcOut, deadline, receiver) to get both tokens back.`,
      `VLT amounts are estimated at current price ($${vltPriceUsd.toFixed(4)}). The vault returns any excess token to you automatically.`,
    ].join(' '),
  };
}

function errorResult(amountUsdc: string | number, recipient: string, error: string): DepositCalldataResult {
  return {
    success: false,
    amountUsdc: String(amountUsdc),
    amountUsdcRaw: '0',
    amountVlt: '0',
    amountVltRaw: '0',
    recipient,
    network: 'Ethereum Mainnet',
    chainId: CHAIN_ID,
    steps: [],
    vaultStats: { tvlUsd: 0, lPerShare: 1, aprDisplay: 'New', vltPriceUsd: 0 },
    zapHelperNote: '',
    agentInstructions: '',
    error,
  };
}
