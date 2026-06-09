/**
 * CoinRailz Yield Vault — Coinbase AgentKit Action Provider
 * https://www.npmjs.com/package/coinrailz-agentkit
 *
 * Vault:    0x86e2508ca0de34530dc847645f60f0d46d95176a (Base mainnet, ERC-4626)
 * API docs: https://coinrailz.com/api/yield/manifest
 * Portal:   https://coinrailz.com/yield-portal
 *
 * 4 actions registered:
 *   coinrailz_yield_deposit       — approve + deposit USDC (2 txs)
 *   coinrailz_yield_deposit_permit — permit + deposit in 1 tx
 *   coinrailz_yield_redeem        — redeem crUSDC shares for USDC (1 tx)
 *   coinrailz_yield_check_position — live on-chain position query
 *   coinrailz_yield_get_rates     — live APY from all 3 protocols
 *
 * Usage:
 *   import { CoinRailzYieldActionProvider } from 'coinrailz-agentkit'
 *   const agentKit = await AgentKit.from({ walletProvider, actionProviders: [new CoinRailzYieldActionProvider()] })
 */

import { z } from 'zod';
import { encodeFunctionData, parseAbi, parseUnits, encodeAbiParameters, parseAbiParameters, keccak256, toBytes } from 'viem';

// ── Wallet provider interface (matches @coinbase/agentkit's EvmWalletProvider) ──

export interface EvmWalletProvider {
  getAddress(): string;
  sendTransaction(tx: { to: `0x${string}`; data: `0x${string}`; value?: bigint }): Promise<`0x${string}`>;
  waitForTransactionReceipt(hash: `0x${string}`): Promise<{ status: string; blockNumber: bigint }>;
  readContract(params: {
    address: `0x${string}`;
    abi: readonly unknown[];
    functionName: string;
    args?: readonly unknown[];
  }): Promise<unknown>;
  signTypedData?(params: {
    domain: Record<string, unknown>;
    types: Record<string, unknown>;
    primaryType: string;
    message: Record<string, unknown>;
  }): Promise<`0x${string}`>;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const VAULT_ADDRESS              = '0x86e2508ca0de34530dc847645f60f0d46d95176a' as const;
const USDC_ADDRESS               = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;
const PERMIT_AND_DEPOSIT_ADDRESS = '0x8d291ae2f9850c5c2899100f381ab43dc95b82cf' as const;
const BASE_URL                   = 'https://coinrailz.com';
const CHAIN_ID                   = 8453;

const ERC20_ABI = parseAbi([
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function nonces(address owner) external view returns (uint256)',
]);

const VAULT_ABI = parseAbi([
  'function deposit(uint256 assets, address receiver) external returns (uint256)',
  'function redeem(uint256 shares, address receiver, address shareOwner) external returns (uint256)',
  'function previewRedeem(uint256 shares) external view returns (uint256)',
  'function userPosition(address user) external view returns (uint256 shares, uint256 currentValue, uint256 estimatedYield)',
]);

const PERMIT_AND_DEPOSIT_ABI = parseAbi([
  'function depositWithPermit(uint256 amount, address receiver, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external returns (uint256)',
]);

// ── Schemas ───────────────────────────────────────────────────────────────────

const DepositSchema = z.object({
  amount_usd: z.number().min(10).max(50000)
    .describe('Amount of USDC to deposit in US dollars (10–50000). Example: 100 = $100 USDC.'),
  receiver: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional()
    .describe('Address to receive crUSDC shares. Defaults to the agent wallet.'),
}).describe('Deposit USDC into CoinRailz auto-routing yield vault on Base. Executes 2 transactions: approve + deposit.');

const DepositPermitSchema = z.object({
  amount_usd: z.number().min(10).max(50000)
    .describe('Amount of USDC to deposit in US dollars. Example: 100 = $100 USDC.'),
  receiver: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional()
    .describe('Address to receive crUSDC shares. Defaults to the agent wallet.'),
}).describe('Deposit USDC into CoinRailz yield vault using EIP-2612 permit — single transaction (no separate approve needed).');

const RedeemSchema = z.object({
  wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional()
    .describe('Wallet to redeem from. Defaults to agent wallet.'),
  shares: z.string().optional()
    .describe('Exact share amount in atomic units (6 decimals). If omitted, redeems full position.'),
}).describe('Withdraw USDC from CoinRailz vault by redeeming crUSDC shares. 1 transaction, 0% exit fee.');

const CheckPositionSchema = z.object({
  wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional()
    .describe('Wallet to check. Defaults to agent wallet.'),
}).describe('Check live USDC yield position: shares, current USD value, and earned yield.');

const GetRatesSchema = z.object({}).describe(
  'Get live APY from Aave v3, Compound v3, and Morpho Blue on Base. Returns best current protocol.'
);

// ── Provider ──────────────────────────────────────────────────────────────────

export class CoinRailzYieldActionProvider {
  readonly name = 'coinrailz_yield';

  getActions() {
    return [
      { name: 'coinrailz_yield_deposit',        schema: DepositSchema,       fn: this.deposit.bind(this) },
      { name: 'coinrailz_yield_deposit_permit',  schema: DepositPermitSchema, fn: this.depositPermit.bind(this) },
      { name: 'coinrailz_yield_redeem',          schema: RedeemSchema,        fn: this.redeem.bind(this) },
      { name: 'coinrailz_yield_check_position',  schema: CheckPositionSchema, fn: this.checkPosition.bind(this) },
      { name: 'coinrailz_yield_get_rates',       schema: GetRatesSchema,      fn: this.getRates.bind(this) },
    ];
  }

  // ── Deposit (2 tx: approve + deposit) ──────────────────────────────────────

  async deposit(wallet: EvmWalletProvider, args: z.infer<typeof DepositSchema>): Promise<string> {
    const receiver   = (args.receiver ?? wallet.getAddress()) as `0x${string}`;
    const amountUsdc = parseUnits(args.amount_usd.toString(), 6);
    try {
      const approveData = encodeFunctionData({ abi: ERC20_ABI, functionName: 'approve', args: [VAULT_ADDRESS, amountUsdc] });
      const approveTx   = await wallet.sendTransaction({ to: USDC_ADDRESS, data: approveData });
      await wallet.waitForTransactionReceipt(approveTx);

      const depositData = encodeFunctionData({ abi: VAULT_ABI, functionName: 'deposit', args: [amountUsdc, receiver] });
      const depositTx   = await wallet.sendTransaction({ to: VAULT_ADDRESS, data: depositData });
      await wallet.waitForTransactionReceipt(depositTx);

      const fee     = (args.amount_usd * 0.005).toFixed(2);
      const net     = (args.amount_usd * 0.995).toFixed(2);
      return [
        `✅ Deposited $${args.amount_usd} USDC into CoinRailz yield vault on Base.`,
        `Entry fee: $${fee} (0.5%). Net deposited: $${net} USDC earning yield.`,
        `Approve tx: ${approveTx}`,
        `Deposit tx: ${depositTx}`,
        `Position:   ${BASE_URL}/api/yield/position/${receiver}`,
        `Tip: use coinrailz_yield_deposit_permit for single-transaction deposits.`,
      ].join('\n');
    } catch (err) {
      return `Error depositing to CoinRailz vault: ${err}`;
    }
  }

  // ── Deposit with permit (1 tx) ──────────────────────────────────────────────

  async depositPermit(wallet: EvmWalletProvider, args: z.infer<typeof DepositPermitSchema>): Promise<string> {
    if (!wallet.signTypedData) {
      return 'Error: wallet provider does not support signTypedData. Use coinrailz_yield_deposit (2-tx) instead.';
    }
    const depositor  = wallet.getAddress() as `0x${string}`;
    const receiver   = (args.receiver ?? depositor) as `0x${string}`;
    const amountUsdc = parseUnits(args.amount_usd.toString(), 6);
    const deadline   = BigInt(Math.floor(Date.now() / 1000) + 3600);

    try {
      const nonce = (await wallet.readContract({
        address: USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'nonces',
        args: [depositor],
      })) as bigint;

      const sig = await wallet.signTypedData({
        domain: { name: 'USD Coin', version: '2', chainId: CHAIN_ID, verifyingContract: USDC_ADDRESS },
        types:  { Permit: [
          { name: 'owner',    type: 'address' },
          { name: 'spender',  type: 'address' },
          { name: 'value',    type: 'uint256' },
          { name: 'nonce',    type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ]},
        primaryType: 'Permit',
        message: {
          owner:    depositor,
          spender:  PERMIT_AND_DEPOSIT_ADDRESS,
          value:    amountUsdc,
          nonce,
          deadline,
        },
      });

      const v   = parseInt(sig.slice(-2), 16);
      const r   = `0x${sig.slice(2, 66)}`   as `0x${string}`;
      const s   = `0x${sig.slice(66, 130)}` as `0x${string}`;

      const data = encodeFunctionData({
        abi:          PERMIT_AND_DEPOSIT_ABI,
        functionName: 'depositWithPermit',
        args:         [amountUsdc, receiver, deadline, v, r, s],
      });

      const txHash = await wallet.sendTransaction({ to: PERMIT_AND_DEPOSIT_ADDRESS, data });
      await wallet.waitForTransactionReceipt(txHash);

      const fee = (args.amount_usd * 0.005).toFixed(2);
      const net = (args.amount_usd * 0.995).toFixed(2);
      return [
        `✅ Deposited $${args.amount_usd} USDC (single tx via EIP-2612 permit).`,
        `Entry fee: $${fee} (0.5%). Net deposited: $${net} USDC.`,
        `Tx: ${txHash}`,
        `Helper contract: ${PERMIT_AND_DEPOSIT_ADDRESS}`,
        `Position: ${BASE_URL}/api/yield/position/${receiver}`,
      ].join('\n');
    } catch (err) {
      return `Error in permit deposit: ${err}`;
    }
  }

  // ── Redeem (1 tx) ──────────────────────────────────────────────────────────

  async redeem(wallet: EvmWalletProvider, args: z.infer<typeof RedeemSchema>): Promise<string> {
    const owner = (args.wallet ?? wallet.getAddress()) as `0x${string}`;
    let sharesBI: bigint;

    if (args.shares) {
      sharesBI = BigInt(args.shares);
    } else {
      try {
        const pos = (await wallet.readContract({
          address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'userPosition', args: [owner],
        })) as [bigint, bigint, bigint];
        sharesBI = pos[0];
      } catch (err) { return `Error fetching position: ${err}`; }
      if (sharesBI === 0n) return `No position found for ${owner}. Use coinrailz_yield_deposit to start earning.`;
    }

    try {
      let expectedUsdc = 'unknown';
      try {
        const preview = (await wallet.readContract({
          address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'previewRedeem', args: [sharesBI],
        })) as bigint;
        expectedUsdc = (Number(preview) / 1e6).toFixed(2);
      } catch (_) {}

      const data   = encodeFunctionData({ abi: VAULT_ABI, functionName: 'redeem', args: [sharesBI, owner, owner] });
      const txHash = await wallet.sendTransaction({ to: VAULT_ADDRESS, data });
      await wallet.waitForTransactionReceipt(txHash);

      return [
        `✅ Redeemed ${(Number(sharesBI) / 1e6).toFixed(6)} crUSDC shares.`,
        `Expected USDC received: ~$${expectedUsdc}`,
        `Tx: ${txHash}  |  Chain: Base (${CHAIN_ID})`,
      ].join('\n');
    } catch (err) { return `Error redeeming: ${err}`; }
  }

  // ── Check position ──────────────────────────────────────────────────────────

  async checkPosition(wallet: EvmWalletProvider, args: z.infer<typeof CheckPositionSchema>): Promise<string> {
    const target = (args.wallet ?? wallet.getAddress()) as `0x${string}`;
    try {
      const resp = await fetch(`${BASE_URL}/api/yield/position/${target}`);
      const data = await resp.json() as {
        success: boolean;
        position: { sharesHeld: string; currentValueUsdc: string; netYieldUsdc: string } | null;
      };
      if (!data.success || !data.position) return `No yield position found for ${target}.`;
      const p = data.position;
      return [
        `CoinRailz yield position — ${target}:`,
        `  Shares:        ${p.sharesHeld} crUSDC`,
        `  Current value: $${p.currentValueUsdc} USDC`,
        `  Net yield:     $${p.netYieldUsdc} USDC`,
        `  Vault: ${VAULT_ADDRESS} on Base`,
      ].join('\n');
    } catch (err) { return `Error checking position: ${err}`; }
  }

  // ── Get rates ───────────────────────────────────────────────────────────────

  async getRates(_wallet: EvmWalletProvider, _args: z.infer<typeof GetRatesSchema>): Promise<string> {
    try {
      const resp = await fetch(`${BASE_URL}/api/yield/rates`);
      const data = await resp.json() as {
        success: boolean;
        rates:       { aave: { apyPercent: number }; compound: { apyPercent: number }; morpho: { apyPercent: number } };
        currentBest: { protocol: string; apyPercent: number };
        netAPY:      { currentNetApyPercent: number };
      };
      if (!data.success) return 'Error fetching rates.';
      const r = data.rates;
      return [
        `CoinRailz USDC yield rates on Base (live):`,
        `  Aave v3:     ${r.aave.apyPercent.toFixed(2)}%`,
        `  Compound v3: ${r.compound.apyPercent.toFixed(2)}%`,
        `  Morpho Blue: ${r.morpho.apyPercent.toFixed(2)}%`,
        `  Best:        ${data.currentBest.protocol} @ ${data.currentBest.apyPercent.toFixed(2)}% gross`,
        `  Net to you:  ~${data.netAPY.currentNetApyPercent.toFixed(2)}% after 15% performance fee`,
      ].join('\n');
    } catch (err) { return `Error fetching rates: ${err}`; }
  }
}
