import type { Action, IAgentRuntime, Memory, State } from '@elizaos/core';
import { BaseYieldClient } from '../utils/baseYieldClient';

export type BaseYieldOperation =
  | 'GET_RATES'
  | 'GET_STATS'
  | 'GET_POSITION'
  | 'GET_CONTRACT'
  | 'BUILD_DEPOSIT_TX'
  | 'BUILD_REDEEM_TX';

const VALID_OPERATIONS: BaseYieldOperation[] = [
  'GET_RATES', 'GET_STATS', 'GET_POSITION', 'GET_CONTRACT',
  'BUILD_DEPOSIT_TX', 'BUILD_REDEEM_TX',
];
const WALLET_REQUIRED: BaseYieldOperation[] = ['GET_POSITION', 'BUILD_DEPOSIT_TX', 'BUILD_REDEEM_TX'];

/**
 * ElizaOS action: COINRAILZ_BASE_YIELD
 *
 * Gives any ElizaOS agent access to the Coin Railz Base USDC Yield Vault —
 * an ERC-4626 smart contract on Base mainnet that auto-routes USDC across
 * Aave v3, Compound v3, and Morpho for the highest APY.
 *
 * Unlike the Solana portal (non-custodial pass-through), this is a Coin Railz
 * managed vault: agents deposit USDC and receive crUSDC shares in return.
 * The vault auto-rebalances; no agent intervention needed.
 *
 * Supported operations:
 *   GET_RATES       — live APY from all 3 protocols + best protocol. No wallet.
 *   GET_STATS       — vault TVL, share price, fee config. No wallet.
 *   GET_POSITION    — agent's crUSDC balance + yield earned. Requires: wallet (0x...).
 *   GET_CONTRACT    — ABI + vault address for direct on-chain integration.
 *   BUILD_DEPOSIT_TX — pre-built calldata for USDC approve + vault deposit (or EIP-2612
 *                      permit in one tx). Requires: wallet, amount_usdc (≥1).
 *                      Optional: mode="permit" for single-tx EIP-2612 path (~50% less gas).
 *   BUILD_REDEEM_TX  — pre-built calldata to redeem all crUSDC shares for USDC.
 *                      Requires: wallet.
 */
export const baseYieldAction: Action = {
  name: 'COINRAILZ_BASE_YIELD',
  similes: [
    'BASE_YIELD',
    'DEPOSIT_USDC_BASE',
    'GET_BASE_APY',
    'BASE_VAULT_DEPOSIT',
    'EARN_YIELD_BASE',
    'CHECK_BASE_YIELD',
    'REDEEM_CRUSDC',
    'BASE_USDC_YIELD',
    'COINRAILZ_VAULT',
  ],
  description:
    'Access the Coin Railz Base USDC Yield Vault (ERC-4626) — auto-routes USDC across Aave v3, Compound v3, and Morpho for the best APY on Base. Get live rates, check your crUSDC position, and build deposit/redeem transactions without needing to parse an ABI.',

  examples: [
    [
      {
        user: '{{user1}}',
        content: { text: 'What is the current USDC yield rate on Base?' },
      },
      {
        user: '{{agent}}',
        content: {
          text: "I'll check the live USDC APY across Aave, Compound, and Morpho on Base.",
          action: 'COINRAILZ_BASE_YIELD',
          content: { operation: 'GET_RATES' },
        },
      },
    ],
    [
      {
        user: '{{user1}}',
        content: { text: 'Build a deposit tx for $100 USDC into the Base yield vault, wallet 0xAbC123' },
      },
      {
        user: '{{agent}}',
        content: {
          text: 'Building the USDC approve + vault deposit calldata for $100 on Base.',
          action: 'COINRAILZ_BASE_YIELD',
          content: {
            operation:   'BUILD_DEPOSIT_TX',
            wallet:      '0xAbC123',
            amount_usdc: 100,
          },
        },
      },
    ],
    [
      {
        user: '{{user1}}',
        content: { text: 'Check my crUSDC position on Base for 0xAbC123' },
      },
      {
        user: '{{agent}}',
        content: {
          text: "Fetching your current crUSDC balance and yield earned on Base.",
          action: 'COINRAILZ_BASE_YIELD',
          content: {
            operation: 'GET_POSITION',
            wallet:    '0xAbC123',
          },
        },
      },
    ],
    [
      {
        user: '{{user1}}',
        content: { text: 'Redeem my crUSDC shares on Base, wallet 0xAbC123' },
      },
      {
        user: '{{agent}}',
        content: {
          text: "Building the redeem transaction to convert your crUSDC back to USDC.",
          action: 'COINRAILZ_BASE_YIELD',
          content: {
            operation: 'BUILD_REDEEM_TX',
            wallet:    '0xAbC123',
          },
        },
      },
    ],
  ],

  validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const content = message.content as any;
    const op: BaseYieldOperation = content?.operation;
    if (!op || !VALID_OPERATIONS.includes(op)) return false;
    if (WALLET_REQUIRED.includes(op) && !content?.wallet) return false;
    if (op === 'BUILD_DEPOSIT_TX') {
      const amt = Number(content?.amount_usdc);
      if (!amt || amt < 1) return false;
    }
    return true;
  },

  handler: async (
    runtime:  IAgentRuntime,
    message:  Memory,
    _state?:  State,
  ): Promise<boolean> => {
    const content = message.content as any;
    const op: BaseYieldOperation = content.operation;
    const client = new BaseYieldClient();

    try {
      let result: any;

      switch (op) {
        case 'GET_RATES':
          result = await client.getRates();
          break;

        case 'GET_STATS':
          result = await client.getStats();
          break;

        case 'GET_POSITION':
          result = await client.getPosition(content.wallet);
          break;

        case 'GET_CONTRACT':
          result = await client.getContract();
          break;

        case 'BUILD_DEPOSIT_TX':
          result = await client.buildDepositTx({
            wallet:      content.wallet,
            amount_usdc: content.amount_usdc,
            mode:        content.mode,
          });
          break;

        case 'BUILD_REDEEM_TX':
          result = await client.buildRedeemTx(content.wallet);
          break;

        default:
          result = { success: false, error: `Unknown operation: ${op}` };
      }

      await _storeResult(runtime, message, { ...result, operation: op, success: true });
      return true;

    } catch (err: any) {
      console.error('[COINRAILZ_BASE_YIELD] Error:', err?.message);
      await _storeResult(runtime, message, {
        success:   false,
        operation: op,
        error:     err?.message || 'Unexpected error in Base yield action',
      });
      return false;
    }
  },
};

async function _storeResult(runtime: IAgentRuntime, message: Memory, data: any): Promise<void> {
  const ok = data.success !== false;
  await runtime.messageManager.createMemory({
    userId:  message.userId,
    agentId: message.agentId,
    roomId:  message.roomId,
    content: {
      text:   `Base yield ${data.operation}: ${ok ? 'success' : 'failed — ' + data.error}`,
      data,
      action: 'COINRAILZ_BASE_YIELD_RESPONSE',
    },
  });
}
