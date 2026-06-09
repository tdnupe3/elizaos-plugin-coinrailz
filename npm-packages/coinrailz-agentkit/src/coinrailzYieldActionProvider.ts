/**
 * CoinRailz Yield Vault — Coinbase AgentKit Action Provider v1.1.0
 * https://www.npmjs.com/package/coinrailz-agentkit
 *
 * Fully compatible with Coinbase AgentKit via duck-typing:
 *   - Provides name, actionProviders, supportsNetwork(), getActions()
 *   - Does NOT hard-import @coinbase/agentkit so it stays an optional peer dep
 *   - Works with AgentKit.from({ actionProviders: [new CoinRailzYieldActionProvider()] })
 *
 * 6 actions:
 *   coinrailz_yield_deposit          — approve + deposit USDC (2 txs, any wallet)
 *   coinrailz_yield_deposit_permit   — EIP-2612 permit deposit (1 tx, ~50% less gas)
 *   coinrailz_yield_redeem           — redeem crUSDC for USDC (1 tx, 0% exit fee)
 *   coinrailz_yield_check_position   — live position with protocol exposure breakdown
 *   coinrailz_yield_get_rates        — live APY across Aave v3, Compound v3, Morpho Blue
 *   coinrailz_yield_get_contract_info— vault addresses, audit status, fee structure
 *
 * Vault:  0x86e2508ca0de34530dc847645f60f0d46d95176a (Base mainnet, ERC-4626)
 * Permit: 0x8d291ae2f9850c5c2899100f381ab43dc95b82cf (PermitAndDeposit helper)
 */

import { z } from 'zod';
import { encodeFunctionData, parseAbi, parseUnits } from 'viem';

// ── AgentKit compatibility (duck-typed — no hard import required) ──────────────

interface AgentKitNetwork {
  protocolFamily?: string;
  networkId?: string;
  chainId?: string | number;
}

interface AgentKitAction {
  name: string;
  description: string;
  schema: z.ZodSchema;
  invoke: (args: unknown) => Promise<string>;
}

// ── Wallet provider interface (matches AgentKit EvmWalletProvider shape) ──────

export interface EvmWalletProvider {
  getName?(): string;
  getAddress(): string;
  getNetwork?(): AgentKitNetwork;
  sendTransaction(tx: { to: `0x${string}`; data: `0x${string}`; value?: bigint }): Promise<`0x${string}`>;
  waitForTransactionReceipt(hash: `0x${string}`): Promise<{ status: string; blockNumber?: bigint }>;
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
const SUPPORTED_NETWORKS         = ['base-mainnet', 'base-sepolia'] as const;

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

// ── Action schemas ────────────────────────────────────────────────────────────

const DepositSchema = z.object({
  amount_usd: z.number().min(10).max(50000)
    .describe('Amount of USDC to deposit in US dollars (10–50000). Example: 100 = $100 USDC.'),
  receiver: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional()
    .describe('Address to receive crUSDC shares. Defaults to the agent wallet.'),
}).describe(
  'Deposit USDC into CoinRailz auto-routing yield vault on Base. Executes 2 transactions: ' +
  'approve USDC spend, then ERC-4626 deposit. 0.5% entry fee. Works with any EVM wallet.'
);

const DepositPermitSchema = z.object({
  amount_usd: z.number().min(10).max(50000)
    .describe('Amount of USDC to deposit in US dollars (10–50000). Example: 100 = $100 USDC.'),
  receiver: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional()
    .describe('Address to receive crUSDC shares. Defaults to the agent wallet.'),
}).describe(
  'Deposit USDC into CoinRailz yield vault using EIP-2612 permit — single transaction, no separate ' +
  'approve. ~50% less gas than standard deposit. Requires wallet.signTypedData support.'
);

const RedeemSchema = z.object({
  wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional()
    .describe('Wallet to redeem from. Defaults to the agent wallet.'),
  shares: z.string().optional()
    .describe('Exact share amount in atomic units (6 decimals). If omitted, redeems full position.'),
}).describe(
  'Withdraw USDC from CoinRailz yield vault by redeeming crUSDC shares. Single transaction. ' +
  '0% exit fee. Returns principal + all accrued yield immediately.'
);

const CheckPositionSchema = z.object({
  wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional()
    .describe('Wallet address to check. Defaults to the agent wallet.'),
}).describe(
  'Check live USDC yield position: shares held, current USD value, net yield earned, ' +
  'and current protocol allocation (which protocol is holding the funds right now).'
);

const GetRatesSchema = z.object({}).describe(
  'Get live APY from Aave v3, Compound v3, and Morpho Blue on Base. ' +
  'Returns best current protocol and net yield to depositor after 15% performance fee.'
);

const GetContractInfoSchema = z.object({}).describe(
  'Get CoinRailz vault contract addresses, Basescan verification links, audit status, ' +
  'and fee structure. Use before depositing to verify the non-custodial architecture.'
);

// ── Provider ──────────────────────────────────────────────────────────────────

export class CoinRailzYieldActionProvider {
  // AgentKit ActionProvider duck-typing — these properties match the abstract base class interface
  readonly name         = 'coinrailz_yield';
  readonly actionProviders: CoinRailzYieldActionProvider[] = [];

  /**
   * AgentKit network gating — Base mainnet and Base Sepolia only.
   * Called by AgentKit.getActions() before binding actions to the wallet.
   */
  supportsNetwork(network: AgentKitNetwork): boolean {
    return (
      network.protocolFamily === 'evm' &&
      SUPPORTED_NETWORKS.includes(network.networkId as (typeof SUPPORTED_NETWORKS)[number])
    );
  }

  /**
   * Returns AgentKit-compatible Action[] with the wallet injected via closure.
   * Fully compatible with AgentKit.from() without @CreateAction decorators or reflect-metadata.
   */
  getActions(walletProvider: EvmWalletProvider): AgentKitAction[] {
    return [
      {
        name:        'coinrailz_yield_deposit',
        description: DepositSchema.description!,
        schema:      DepositSchema,
        invoke:      (args) => this.deposit(walletProvider, args as z.infer<typeof DepositSchema>),
      },
      {
        name:        'coinrailz_yield_deposit_permit',
        description: DepositPermitSchema.description!,
        schema:      DepositPermitSchema,
        invoke:      (args) => this.depositPermit(walletProvider, args as z.infer<typeof DepositPermitSchema>),
      },
      {
        name:        'coinrailz_yield_redeem',
        description: RedeemSchema.description!,
        schema:      RedeemSchema,
        invoke:      (args) => this.redeem(walletProvider, args as z.infer<typeof RedeemSchema>),
      },
      {
        name:        'coinrailz_yield_check_position',
        description: CheckPositionSchema.description!,
        schema:      CheckPositionSchema,
        invoke:      (args) => this.checkPosition(walletProvider, args as z.infer<typeof CheckPositionSchema>),
      },
      {
        name:        'coinrailz_yield_get_rates',
        description: GetRatesSchema.description!,
        schema:      GetRatesSchema,
        invoke:      (_)   => this.getRates(walletProvider, {}),
      },
      {
        name:        'coinrailz_yield_get_contract_info',
        description: GetContractInfoSchema.description!,
        schema:      GetContractInfoSchema,
        invoke:      (_)   => this.getContractInfo(walletProvider, {}),
      },
    ];
  }

  // ── Action: Deposit (2 txs) ──────────────────────────────────────────────────

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

      const fee = (args.amount_usd * 0.005).toFixed(2);
      const net = (args.amount_usd * 0.995).toFixed(2);
      return [
        `Deposited $${args.amount_usd} USDC into CoinRailz yield vault on Base.`,
        `Entry fee: $${fee} (0.5%). Net earning yield: $${net} USDC.`,
        `Approve tx: ${approveTx}`,
        `Deposit tx: ${depositTx}`,
        `Position: ${BASE_URL}/api/yield/position/${receiver}`,
        `Tip: use coinrailz_yield_deposit_permit for single-transaction deposits (requires signTypedData).`,
      ].join('\n');
    } catch (err) {
      return `Error depositing to CoinRailz vault: ${err}`;
    }
  }

  // ── Action: Deposit via EIP-2612 permit (1 tx) ──────────────────────────────

  async depositPermit(wallet: EvmWalletProvider, args: z.infer<typeof DepositPermitSchema>): Promise<string> {
    if (!wallet.signTypedData) {
      return (
        'Error: wallet does not support signTypedData. ' +
        'Use coinrailz_yield_deposit (2-tx standard flow) instead.'
      );
    }
    const depositor  = wallet.getAddress() as `0x${string}`;
    const receiver   = (args.receiver ?? depositor) as `0x${string}`;
    const amountUsdc = parseUnits(args.amount_usd.toString(), 6);
    const deadline   = BigInt(Math.floor(Date.now() / 1000) + 3600);
    try {
      const nonce = (await wallet.readContract({
        address: USDC_ADDRESS, abi: ERC20_ABI, functionName: 'nonces', args: [depositor],
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
        message: { owner: depositor, spender: PERMIT_AND_DEPOSIT_ADDRESS, value: amountUsdc, nonce, deadline },
      });

      const v   = parseInt(sig.slice(-2), 16);
      const r   = `0x${sig.slice(2, 66)}`   as `0x${string}`;
      const s   = `0x${sig.slice(66, 130)}` as `0x${string}`;
      const data = encodeFunctionData({
        abi: PERMIT_AND_DEPOSIT_ABI, functionName: 'depositWithPermit',
        args: [amountUsdc, receiver, deadline, v, r, s],
      });

      const txHash = await wallet.sendTransaction({ to: PERMIT_AND_DEPOSIT_ADDRESS, data });
      await wallet.waitForTransactionReceipt(txHash);

      const fee = (args.amount_usd * 0.005).toFixed(2);
      const net = (args.amount_usd * 0.995).toFixed(2);
      return [
        `Deposited $${args.amount_usd} USDC via EIP-2612 permit (single transaction).`,
        `Entry fee: $${fee} (0.5%). Net earning yield: $${net} USDC.`,
        `Tx: ${txHash}`,
        `Helper contract: ${PERMIT_AND_DEPOSIT_ADDRESS} (PermitAndDeposit on Base)`,
        `Position: ${BASE_URL}/api/yield/position/${receiver}`,
      ].join('\n');
    } catch (err) {
      return `Error in permit deposit: ${err}`;
    }
  }

  // ── Action: Redeem (1 tx) ────────────────────────────────────────────────────

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
      if (sharesBI === 0n) {
        return `No position found for ${owner}. Use coinrailz_yield_deposit to start earning yield.`;
      }
    }

    let expectedUsdc = 'unknown';
    try {
      const preview = (await wallet.readContract({
        address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'previewRedeem', args: [sharesBI],
      })) as bigint;
      expectedUsdc = (Number(preview) / 1e6).toFixed(2);
    } catch (_) {}

    try {
      const data   = encodeFunctionData({ abi: VAULT_ABI, functionName: 'redeem', args: [sharesBI, owner, owner] });
      const txHash = await wallet.sendTransaction({ to: VAULT_ADDRESS, data });
      await wallet.waitForTransactionReceipt(txHash);
      return [
        `Redeemed ${(Number(sharesBI) / 1e6).toFixed(6)} crUSDC shares.`,
        `Expected USDC received: ~$${expectedUsdc} (principal + yield).`,
        `Tx: ${txHash}  |  Chain: Base (${CHAIN_ID})  |  Exit fee: 0%`,
      ].join('\n');
    } catch (err) { return `Error redeeming from CoinRailz vault: ${err}`; }
  }

  // ── Action: Check position ────────────────────────────────────────────────────

  async checkPosition(wallet: EvmWalletProvider, args: z.infer<typeof CheckPositionSchema>): Promise<string> {
    const target = (args.wallet ?? wallet.getAddress()) as `0x${string}`;
    try {
      const [posResp, statsResp] = await Promise.all([
        fetch(`${BASE_URL}/api/yield/position/${target}`),
        fetch(`${BASE_URL}/api/yield/stats`),
      ]);
      const posData   = await posResp.json()   as { success: boolean; position: { sharesHeld: string; currentValueUsdc: string; netYieldUsdc: string } | null };
      const statsData = await statsResp.json() as { success: boolean; stats?: { activeProtocol?: string; tvlUsdc?: string } };

      if (!posData.success || !posData.position) {
        return `No yield position found for ${target}. Use coinrailz_yield_deposit to start earning.`;
      }
      const p       = posData.position;
      const proto   = statsData.stats?.activeProtocol ?? 'unknown';
      const tvl     = statsData.stats?.tvlUsdc         ?? 'unknown';
      return [
        `CoinRailz yield position — ${target}:`,
        `  crUSDC shares:    ${p.sharesHeld}`,
        `  Current value:    $${p.currentValueUsdc} USDC`,
        `  Net yield earned: $${p.netYieldUsdc} USDC`,
        `  Protocol now:     ${proto} (current allocation)`,
        `  Vault TVL:        $${tvl} USDC`,
        `  Vault address:    ${VAULT_ADDRESS} on Base`,
        `  Exit fee:         0% — redeem any time`,
      ].join('\n');
    } catch (err) { return `Error checking position: ${err}`; }
  }

  // ── Action: Get rates ─────────────────────────────────────────────────────────

  async getRates(_wallet: EvmWalletProvider, _args: z.infer<typeof GetRatesSchema>): Promise<string> {
    try {
      const resp = await fetch(`${BASE_URL}/api/yield/rates`);
      const data = await resp.json() as {
        success: boolean;
        rates: { aave: { apyPercent: number }; compound: { apyPercent: number }; morpho: { apyPercent: number } };
        currentBest: { protocol: string; apyPercent: number };
        netAPY: { currentNetApyPercent: number };
      };
      if (!data.success) return 'Error fetching yield rates. The API may be temporarily unavailable.';
      const r = data.rates;
      return [
        `CoinRailz live USDC yield rates on Base:`,
        `  Aave v3:     ${r.aave.apyPercent.toFixed(2)}% gross APY`,
        `  Compound v3: ${r.compound.apyPercent.toFixed(2)}% gross APY`,
        `  Morpho Blue: ${r.morpho.apyPercent.toFixed(2)}% gross APY`,
        `  Best now:    ${data.currentBest.protocol} @ ${data.currentBest.apyPercent.toFixed(2)}% gross`,
        `  Net to you:  ~${data.netAPY.currentNetApyPercent.toFixed(2)}% after 15% performance fee`,
        `  Updated:     live from on-chain — auto-rebalances when a better rate is found`,
      ].join('\n');
    } catch (err) { return `Error fetching rates: ${err}`; }
  }

  // ── Action: Get contract info (trust/verification) ────────────────────────────

  async getContractInfo(_wallet: EvmWalletProvider, _args: z.infer<typeof GetContractInfoSchema>): Promise<string> {
    return [
      `CoinRailz Yield Vault — contract verification:`,
      ``,
      `  Vault (ERC-4626):`,
      `    Address:  ${VAULT_ADDRESS}`,
      `    Chain:    Base mainnet (chainId ${CHAIN_ID})`,
      `    Basescan: https://basescan.org/address/${VAULT_ADDRESS}`,
      `    Standard: ERC-4626 (tokenised vault — fully non-custodial)`,
      ``,
      `  PermitAndDeposit helper (EIP-2612 1-tx deposits):`,
      `    Address:  ${PERMIT_AND_DEPOSIT_ADDRESS}`,
      `    Basescan: https://basescan.org/address/${PERMIT_AND_DEPOSIT_ADDRESS}`,
      `    Note:     Immutable — constructor sets vault approval once, no admin functions`,
      ``,
      `  USDC (token deposited):`,
      `    Address:  ${USDC_ADDRESS}`,
      `    Issuer:   Circle (native USDC on Base, not bridged)`,
      ``,
      `  Fee structure:`,
      `    Entry fee:       0.5% of deposit (one-time)`,
      `    Performance fee: 15% of yield only — never touches principal`,
      `    Exit fee:        0% — withdraw any time`,
      `    Max fee caps:    2% entry / 30% performance (hard-coded in bytecode)`,
      ``,
      `  Audit status: unaudited (early deployment) — do not deposit more than you can risk`,
      `  API manifest: ${BASE_URL}/api/yield/manifest`,
    ].join('\n');
  }
}
