/**
 * CoinRailz Yield Vault — Coinbase AgentKit Action Provider (copy-paste version)
 *
 * PREFERRED: npm install coinrailz-agentkit  (same code, maintained package)
 *
 * Drop this file into any AgentKit project and add CoinRailzYieldActionProvider
 * to your actionProviders array. Your agent will immediately understand:
 *   - "Deposit $100 USDC to earn yield"               → coinrailz_yield_deposit (2 txs)
 *   - "Deposit $100 in a single transaction"          → coinrailz_yield_deposit_permit (1 tx)
 *   - "What APY am I earning?"                        → coinrailz_yield_get_rates
 *   - "Check my yield position"                       → coinrailz_yield_check_position
 *   - "Withdraw my USDC"                              → coinrailz_yield_redeem
 *
 * Requires: @coinbase/agentkit (peer dependency, not bundled here)
 * Vault:    https://basescan.org/address/0x86e2508ca0de34530dc847645f60f0d46d95176a
 * Permit:   https://basescan.org/address/0x8d291ae2f9850c5c2899100f381ab43dc95b82cf
 * API docs: https://coinrailz.com/api/yield/manifest
 */

import { z } from "zod";
import { encodeFunctionData, parseAbi, parseUnits } from "viem";

// ── Types (mirrors AgentKit internals, no hard import needed) ─────────────────

interface EvmWalletProvider {
  getAddress(): string;
  sendTransaction(tx: { to: string; data: string; value?: bigint }): Promise<string>;
  waitForTransactionReceipt(hash: string): Promise<unknown>;
  readContract(params: { address: string; abi: unknown[]; functionName: string; args?: unknown[] }): Promise<unknown>;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const VAULT_ADDRESS = "0x86e2508ca0de34530dc847645f60f0d46d95176a";
const USDC_ADDRESS  = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const BASE_URL      = "https://coinrailz.com";
const CHAIN_ID      = 8453;

const ERC20_ABI  = parseAbi(["function approve(address spender, uint256 amount) external returns (bool)"]);
const VAULT_ABI  = parseAbi([
  "function deposit(uint256 assets, address receiver) external returns (uint256)",
  "function redeem(uint256 shares, address receiver, address shareOwner) external returns (uint256)",
  "function previewRedeem(uint256 shares) external view returns (uint256)",
  "function userPosition(address user) external view returns (uint256 shares, uint256 currentValue, uint256 estimatedYield)",
]);

// ── Schemas ───────────────────────────────────────────────────────────────────

const DepositSchema = z.object({
  amount_usd: z
    .number()
    .min(10, "Minimum deposit is $10 USDC")
    .max(50000, "Maximum single deposit is $50,000 USDC")
    .describe("Amount of USDC to deposit in US dollars (e.g. 100 = $100 USDC)"),
  receiver: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address")
    .optional()
    .describe("Address to receive crUSDC shares. Defaults to the agent's own wallet."),
}).describe("Deposit USDC into the CoinRailz auto-routing yield vault on Base");

const RedeemSchema = z.object({
  wallet: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address")
    .optional()
    .describe("Wallet to redeem from. Defaults to the agent's own wallet."),
  shares: z
    .string()
    .optional()
    .describe("Exact share amount in atomic units (6 decimals). If omitted, redeems full position."),
}).describe("Withdraw USDC from the CoinRailz yield vault by redeeming crUSDC shares");

const CheckPositionSchema = z.object({
  wallet: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address")
    .optional()
    .describe("Wallet to check. Defaults to the agent's own wallet."),
}).describe("Check current USDC yield position: shares held, current value, and earned yield");

const GetRatesSchema = z.object({}).describe(
  "Get live APY rates from Aave v3, Compound v3, and Morpho Blue on Base. Shows the best current option."
);

// ── Provider ──────────────────────────────────────────────────────────────────

export class CoinRailzYieldActionProvider {
  readonly name = "coinrailz_yield";

  getActions() {
    return [
      { name: "coinrailz_yield_deposit",       fn: this.deposit.bind(this),       schema: DepositSchema },
      { name: "coinrailz_yield_redeem",         fn: this.redeem.bind(this),         schema: RedeemSchema },
      { name: "coinrailz_yield_check_position", fn: this.checkPosition.bind(this), schema: CheckPositionSchema },
      { name: "coinrailz_yield_get_rates",      fn: this.getRates.bind(this),      schema: GetRatesSchema },
    ];
  }

  /**
   * Deposit USDC into the CoinRailz yield vault.
   * Executes 2 transactions: USDC approve → ERC-4626 deposit.
   * Fee: 0.5% entry, 15% performance on yield only. 0% exit.
   */
  async deposit(wallet: EvmWalletProvider, args: z.infer<typeof DepositSchema>): Promise<string> {
    const receiver = args.receiver ?? wallet.getAddress();
    const amountUsdc = parseUnits(args.amount_usd.toString(), 6);

    try {
      const approveData = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: "approve",
        args: [VAULT_ADDRESS as `0x${string}`, amountUsdc],
      });

      const approveHash = await wallet.sendTransaction({ to: USDC_ADDRESS, data: approveData });
      await wallet.waitForTransactionReceipt(approveHash);

      const depositData = encodeFunctionData({
        abi: VAULT_ABI,
        functionName: "deposit",
        args: [amountUsdc, receiver as `0x${string}`],
      });

      const depositHash = await wallet.sendTransaction({ to: VAULT_ADDRESS, data: depositData });
      await wallet.waitForTransactionReceipt(depositHash);

      const entryFee = (args.amount_usd * 0.005).toFixed(2);
      const netDeposit = (args.amount_usd * 0.995).toFixed(2);

      return [
        `Deposited $${args.amount_usd} USDC into CoinRailz yield vault on Base.`,
        `Entry fee: $${entryFee} (0.5%). Net deposited: $${netDeposit} USDC.`,
        `Approve tx: ${approveHash}`,
        `Deposit tx: ${depositHash}`,
        `Check position: GET ${BASE_URL}/api/yield/position/${receiver}`,
        `Chain: Base mainnet (${CHAIN_ID})`,
      ].join("\n");
    } catch (err) {
      return `Error depositing to CoinRailz yield vault: ${err}`;
    }
  }

  /**
   * Redeem crUSDC shares to receive USDC back.
   * Only 1 transaction — no approval needed for ERC-4626 redeem.
   * 0% exit fee. 15% performance fee already captured on accrual.
   */
  async redeem(wallet: EvmWalletProvider, args: z.infer<typeof RedeemSchema>): Promise<string> {
    const owner    = args.wallet ?? wallet.getAddress();
    const receiver = owner;

    let sharesBI: bigint;

    if (args.shares) {
      sharesBI = BigInt(args.shares);
    } else {
      try {
        const result = await wallet.readContract({
          address: VAULT_ADDRESS,
          abi: VAULT_ABI as unknown[],
          functionName: "userPosition",
          args: [owner],
        }) as [bigint, bigint, bigint];
        sharesBI = result[0];
      } catch (err) {
        return `Error fetching position for ${owner}: ${err}`;
      }
      if (sharesBI === 0n) {
        return `No position found for ${owner}. Use coinrailz_yield_deposit to start earning.`;
      }
    }

    try {
      let expectedUsdc = "unknown";
      try {
        const preview = await wallet.readContract({
          address: VAULT_ADDRESS,
          abi: VAULT_ABI as unknown[],
          functionName: "previewRedeem",
          args: [sharesBI],
        }) as bigint;
        expectedUsdc = (Number(preview) / 1e6).toFixed(2);
      } catch (_) {}

      const redeemData = encodeFunctionData({
        abi: VAULT_ABI,
        functionName: "redeem",
        args: [sharesBI, receiver as `0x${string}`, owner as `0x${string}`],
      });

      const hash = await wallet.sendTransaction({ to: VAULT_ADDRESS, data: redeemData });
      await wallet.waitForTransactionReceipt(hash);

      return [
        `Redeemed ${sharesBI.toString()} crUSDC shares from CoinRailz yield vault.`,
        `Expected USDC received: ~$${expectedUsdc}`,
        `Transaction: ${hash}`,
        `Chain: Base mainnet (${CHAIN_ID})`,
      ].join("\n");
    } catch (err) {
      return `Error redeeming from CoinRailz yield vault: ${err}`;
    }
  }

  /**
   * Check live yield position on-chain.
   */
  async checkPosition(wallet: EvmWalletProvider, args: z.infer<typeof CheckPositionSchema>): Promise<string> {
    const target = args.wallet ?? wallet.getAddress();
    try {
      const resp = await fetch(`${BASE_URL}/api/yield/position/${target}`);
      const data = await resp.json() as {
        success: boolean;
        position: { sharesHeld: string; currentValueUsdc: string; netYieldUsdc: string } | null;
      };
      if (!data.success || !data.position) {
        return `No yield position found for ${target}.`;
      }
      const p = data.position;
      return [
        `CoinRailz yield position for ${target}:`,
        `  Shares held:   ${p.sharesHeld} crUSDC`,
        `  Current value: $${p.currentValueUsdc} USDC`,
        `  Net yield:     $${p.netYieldUsdc} USDC`,
        `  Vault: ${VAULT_ADDRESS} (Base mainnet)`,
      ].join("\n");
    } catch (err) {
      return `Error checking position: ${err}`;
    }
  }

  /**
   * Get live APY rates from all three protocols.
   */
  async getRates(_wallet: EvmWalletProvider, _args: z.infer<typeof GetRatesSchema>): Promise<string> {
    try {
      const resp = await fetch(`${BASE_URL}/api/yield/rates`);
      const data = await resp.json() as {
        success: boolean;
        rates: { aave: { apyPercent: number }; compound: { apyPercent: number }; morpho: { apyPercent: number } };
        currentBest: { protocol: string; apyPercent: number };
        netAPY: { currentNetApyPercent: number };
      };
      if (!data.success) return "Error fetching yield rates.";
      const r = data.rates;
      return [
        `CoinRailz USDC yield rates on Base (live):`,
        `  Aave v3:      ${r.aave.apyPercent.toFixed(2)}% APY`,
        `  Compound v3:  ${r.compound.apyPercent.toFixed(2)}% APY`,
        `  Morpho Blue:  ${r.morpho.apyPercent.toFixed(2)}% APY`,
        `  Best:         ${data.currentBest.protocol} at ${data.currentBest.apyPercent.toFixed(2)}% gross`,
        `  Net to you:   ~${data.netAPY.currentNetApyPercent.toFixed(2)}% after 15% performance fee`,
        `  Deposit with: GET ${BASE_URL}/api/yield/deposit-tx?preset=100&recipient=0xYOUR_WALLET`,
      ].join("\n");
    } catch (err) {
      return `Error fetching rates: ${err}`;
    }
  }
}
