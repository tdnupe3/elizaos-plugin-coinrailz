/**
 * vltUSDC Deposit Builder — x402 service handler
 *
 * Builder pattern (architect-approved): agent pays $0.50 USDC on Base →
 * service returns unsigned ERC-4626-style calldata for Ethereum mainnet →
 * agent signs + broadcasts on Ethereum themselves.
 *
 * No cross-chain execution. No custody. Agent retains full control.
 *
 * Steps returned:
 *   1. USDC.approve(vaultAddress, amount) on Ethereum
 *   2. vault.deposit(amount, recipient) on Ethereum  [ERC-4626 selector]
 *
 * If the Bankroll vault uses a non-ERC-4626 interface, see alternativeCalldata
 * in the response for a zapIn() variant.
 */

import { ethers } from 'ethers';
import { getVltUsdcStatsFresh } from './vltUsdcVaultService.js';

const VAULT_ADDRESS = '0x348A57b1dc6E3dCAa645DE6e4E864924B410525D';
const USDC_ETH      = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const CHAIN_ID      = 1; // Ethereum mainnet

// ERC-20 approve(address,uint256) — selector 0x095ea7b3
const ERC20_IFACE = new ethers.Interface([
  'function approve(address spender, uint256 amount) returns (bool)',
]);

// ERC-4626 deposit(uint256 assets, address receiver) — selector 0x6e553f65
const ERC4626_IFACE = new ethers.Interface([
  'function deposit(uint256 assets, address receiver) returns (uint256 shares)',
]);

// Alternative: zapIn(uint256 usdcAmount) — common LP vault pattern
const ZAP_IFACE = new ethers.Interface([
  'function zapIn(uint256 usdcAmount) returns (uint256 shares)',
  'function deposit(uint256 amount) returns (uint256 shares)',
]);

export interface DepositCalldataResult {
  success: boolean;
  amountUsdc: string;
  amountUsdcRaw: string;
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
  alternativeCalldata: {
    note: string;
    zapInData: string;
    depositSingleData: string;
  };
  vaultStats: {
    tvlUsd: number;
    lPerShare: number;
    aprDisplay: string;
    vltPriceUsd: number;
  };
  agentInstructions: string;
  error?: string;
}

export async function buildVltUsdcDeposit(
  amountUsdc: string | number,
  recipient: string,
): Promise<DepositCalldataResult> {
  // Validate recipient
  if (!recipient || !/^0x[0-9a-fA-F]{40}$/.test(recipient)) {
    return {
      success: false,
      amountUsdc: String(amountUsdc),
      amountUsdcRaw: '0',
      recipient,
      network: 'Ethereum Mainnet',
      chainId: CHAIN_ID,
      steps: [],
      alternativeCalldata: { note: '', zapInData: '', depositSingleData: '' },
      vaultStats: { tvlUsd: 0, lPerShare: 1, aprDisplay: 'New', vltPriceUsd: 0 },
      agentInstructions: '',
      error: 'recipient must be a valid Ethereum address (0x...)',
    };
  }

  const amount = parseFloat(String(amountUsdc));
  if (isNaN(amount) || amount <= 0) {
    return {
      success: false,
      amountUsdc: String(amountUsdc),
      amountUsdcRaw: '0',
      recipient,
      network: 'Ethereum Mainnet',
      chainId: CHAIN_ID,
      steps: [],
      alternativeCalldata: { note: '', zapInData: '', depositSingleData: '' },
      vaultStats: { tvlUsd: 0, lPerShare: 1, aprDisplay: 'New', vltPriceUsd: 0 },
      agentInstructions: '',
      error: 'amountUsdc must be a positive number',
    };
  }

  // USDC has 6 decimals on Ethereum mainnet
  const amountRaw = ethers.parseUnits(amount.toFixed(6), 6);
  const amountRawStr = amountRaw.toString();

  // Build calldata
  const approveData = ERC20_IFACE.encodeFunctionData('approve', [VAULT_ADDRESS, amountRaw]);
  const depositData = ERC4626_IFACE.encodeFunctionData('deposit', [amountRaw, recipient]);

  // Alternative calldata variants (in case vault uses non-ERC-4626 interface)
  const zapInData         = ZAP_IFACE.encodeFunctionData('zapIn', [amountRaw]);
  const depositSingleData = ZAP_IFACE.encodeFunctionData('deposit(uint256)', [amountRaw]);

  // Fetch current vault stats (non-blocking — uses cache if warm)
  let vaultStats = { tvlUsd: 0, lPerShare: 1.0, aprDisplay: 'New', vltPriceUsd: 0 };
  try {
    const stats = await getVltUsdcStatsFresh();
    vaultStats = {
      tvlUsd: stats.stats.tvlUsd,
      lPerShare: stats.stats.lPerShare,
      aprDisplay: stats.stats.aprDisplay,
      vltPriceUsd: stats.stats.vltPriceUsd,
    };
  } catch { /* non-fatal */ }

  return {
    success: true,
    amountUsdc: amount.toFixed(6),
    amountUsdcRaw: amountRawStr,
    recipient,
    network: 'Ethereum Mainnet',
    chainId: CHAIN_ID,
    steps: [
      {
        step: 1,
        action: 'Approve USDC to vltUSDC Vault',
        to: USDC_ETH,
        data: approveData,
        value: '0x0',
        gasEstimate: '0xCB20', // ~52,000 gas
        note: 'Grant the Bankroll vault permission to spend your USDC. Must confirm before Step 2.',
      },
      {
        step: 2,
        action: 'Deposit USDC → vltUSDC shares',
        to: VAULT_ADDRESS,
        data: depositData,
        value: '0x0',
        gasEstimate: '0x493E0', // ~300,000 gas (vault performs internal swap + LP add)
        note: `Vault zaps USDC into VLT/WETH LP position and mints vltUSDC shares to ${recipient}.`,
      },
    ],
    alternativeCalldata: {
      note: 'If Step 2 reverts, the vault may use a non-ERC-4626 interface. Try these variants in order:',
      zapInData,
      depositSingleData,
    },
    vaultStats,
    agentInstructions: [
      `Sign and broadcast Step 1 (USDC approve) on Ethereum mainnet (chainId ${CHAIN_ID}).`,
      'Wait for Step 1 confirmation before sending Step 2.',
      'Sign and broadcast Step 2 (vault deposit) on Ethereum mainnet.',
      `After both confirm, check your vltUSDC balance at ${VAULT_ADDRESS.slice(0,10)}… using ERC-20 balanceOf(${recipient}).`,
      'vltUSDC accrues LP fees automatically. Redeem any time by calling vault.redeem(shares, receiver, owner).',
    ].join(' '),
  };
}
