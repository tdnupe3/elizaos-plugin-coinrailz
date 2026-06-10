import type { Action, IAgentRuntime, Memory, State } from '@elizaos/core';
import { SolanaYieldClient, SolanaDepositTxBundle } from '../utils/solanaYieldClient';

export type SolanaYieldOperation =
  | 'GET_RATES'
  | 'GET_MANIFEST'
  | 'GET_STATS'
  | 'GET_POSITION'
  | 'CREATE_DEPOSIT_TX'
  | 'CONFIRM_DEPOSIT';

const VALID_OPERATIONS: SolanaYieldOperation[] = [
  'GET_RATES', 'GET_MANIFEST', 'GET_STATS',
  'GET_POSITION', 'CREATE_DEPOSIT_TX', 'CONFIRM_DEPOSIT',
];
const WALLET_REQUIRED: SolanaYieldOperation[] = ['GET_POSITION', 'CREATE_DEPOSIT_TX', 'CONFIRM_DEPOSIT'];

/**
 * ElizaOS action: COINRAILZ_SOLANA_YIELD
 *
 * Gives any ElizaOS agent non-custodial access to the Coin Railz Solana USDC Yield
 * Portal (Kamino Lending, ~3.4% APY, $118M TVL on mainnet).
 *
 * Supported operations:
 *   GET_RATES         — live APY, TVL, utilization. No wallet required.
 *   GET_MANIFEST      — full integration guide for agents. No wallet required.
 *   GET_STATS         — reserve health (liquidity, utilization). No wallet required.
 *   GET_POSITION      — check an existing position. Requires: wallet.
 *   CREATE_DEPOSIT_TX — build unsigned tx bundle. Requires: wallet, amount_usdc (≥5).
 *                       Optional: idempotency_key (UUID) to prevent duplicate fees on retry.
 *                       If SOLANA_PRIVATE_KEY is set, auto-signs and submits.
 *   CONFIRM_DEPOSIT   — notify platform after on-chain submission. Requires: wallet, txSignature.
 */
export const solanaYieldAction: Action = {
  name: 'COINRAILZ_SOLANA_YIELD',
  similes: [
    'SOLANA_YIELD',
    'DEPOSIT_USDC_SOLANA',
    'GET_SOLANA_APY',
    'KAMINO_DEPOSIT',
    'SOLANA_TREASURY_YIELD',
    'EARN_YIELD_SOLANA',
    'CHECK_SOLANA_YIELD',
  ],
  description:
    'Access the Coin Railz Solana USDC Yield Portal — earn non-custodial yield on Kamino Lending, check live APY/TVL, create deposit transaction bundles, and manage positions. Agent signs transactions locally; Coin Railz never holds funds.',

  examples: [
    [
      {
        user: '{{user1}}',
        content: { text: 'What is the current USDC yield rate on Solana?' },
      },
      {
        user: '{{agent}}',
        content: {
          text: "I'll check the live USDC APY on Kamino Lending for you.",
          action: 'COINRAILZ_SOLANA_YIELD',
          content: { operation: 'GET_RATES' },
        },
      },
    ],
    [
      {
        user: '{{user1}}',
        content: { text: 'Build a deposit tx for $50 USDC into Solana yield, wallet DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' },
      },
      {
        user: '{{agent}}',
        content: {
          text: 'Building the unsigned transaction bundle for a $50 USDC deposit into Kamino Lending.',
          action: 'COINRAILZ_SOLANA_YIELD',
          content: {
            operation: 'CREATE_DEPOSIT_TX',
            wallet: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
            amount_usdc: 50,
          },
        },
      },
    ],
    [
      {
        user: '{{user1}}',
        content: { text: 'Check my Solana yield position for DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' },
      },
      {
        user: '{{agent}}',
        content: {
          text: "Checking your current USDC position in Kamino Lending.",
          action: 'COINRAILZ_SOLANA_YIELD',
          content: {
            operation: 'GET_POSITION',
            wallet: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
          },
        },
      },
    ],
  ],

  validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const content = message.content as any;
    const op: SolanaYieldOperation = content?.operation;
    if (!op || !VALID_OPERATIONS.includes(op)) return false;
    if (WALLET_REQUIRED.includes(op) && !content?.wallet) return false;
    if (op === 'CREATE_DEPOSIT_TX') {
      const amt = Number(content?.amount_usdc);
      if (!amt || amt < 5) return false;
    }
    if (op === 'CONFIRM_DEPOSIT' && !content?.txSignature) return false;
    return true;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State
  ): Promise<boolean> => {
    const content = message.content as any;
    const op: SolanaYieldOperation = content.operation;
    const client = new SolanaYieldClient();

    try {
      let result: any;

      switch (op) {
        case 'GET_RATES':
          result = await client.getRates();
          break;

        case 'GET_MANIFEST':
          result = await client.getManifest();
          break;

        case 'GET_STATS':
          result = await client.getStats();
          break;

        case 'GET_POSITION':
          result = await client.getPosition(content.wallet);
          break;

        case 'CREATE_DEPOSIT_TX': {
          const bundle = await client.createDepositTx({
            wallet:           content.wallet,
            amount_usdc:      content.amount_usdc,
            idempotency_key:  content.idempotency_key,
          });

          if (!bundle.success) {
            await _storeResult(runtime, message, { success: false, operation: op, error: (bundle as any).error || 'deposit-tx failed' });
            return false;
          }

          const solanaKey = process.env.SOLANA_PRIVATE_KEY;
          if (solanaKey && bundle.transactions?.length) {
            try {
              const signing = await _signAndSubmitBundle(solanaKey, bundle.transactions, bundle.bundle_expires_at);
              result = { ...bundle, signing };
            } catch (signErr: any) {
              result = {
                ...bundle,
                signing: {
                  attempted: true,
                  success:   false,
                  error:     signErr.message,
                  hint:      _signingHint(bundle),
                },
              };
            }
          } else {
            result = {
              ...bundle,
              signing: {
                attempted: false,
                reason:    solanaKey ? 'no transactions in bundle' : 'SOLANA_PRIVATE_KEY not set — sign manually',
                hint:      _signingHint(bundle),
              },
            };
          }
          break;
        }

        case 'CONFIRM_DEPOSIT':
          result = await client.confirmDeposit({
            wallet:        content.wallet,
            txSignature:   content.txSignature,
            amountUsdcRaw: content.amountUsdcRaw,
          });
          break;

        default:
          result = { success: false, error: `Unknown operation: ${op}` };
      }

      await _storeResult(runtime, message, { ...result, operation: op });
      return result?.success !== false;

    } catch (err: any) {
      console.error('[COINRAILZ_SOLANA_YIELD] Error:', err?.message);
      await _storeResult(runtime, message, {
        success:   false,
        operation: op,
        error:     err?.message || 'Unexpected error in Solana yield action',
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
      text:   `Solana yield ${data.operation}: ${ok ? 'success' : 'failed — ' + data.error}`,
      data,
      action: 'COINRAILZ_SOLANA_YIELD_RESPONSE',
    },
  });
}

function _signingHint(bundle: SolanaDepositTxBundle): string {
  return [
    `Bundle expires: ${bundle.bundle_expires_at}`,
    `Submit ${bundle.transactions.length} transaction(s) with your Solana wallet, then call CONFIRM_DEPOSIT with the txSignature.`,
    `Code snippet:`,
    `  for (const {base64} of transactions) {`,
    `    const tx = Transaction.from(Buffer.from(base64, "base64"));`,
    `    tx.sign(keypair);`,
    `    const sig = await connection.sendRawTransaction(tx.serialize());`,
    `    await connection.confirmTransaction(sig, "confirmed");`,
    `  }`,
  ].join('\n');
}

/**
 * Auto-sign and submit a transaction bundle using SOLANA_PRIVATE_KEY.
 * Supports both VersionedTransaction (v0) and legacy Transaction formats.
 * Key format: base58 string OR JSON uint8 array.
 * RPC: SOLANA_RPC_URL env (default: mainnet-beta public).
 */
async function _signAndSubmitBundle(
  privateKeyEnv: string,
  transactions: Array<{ base64: string }>,
  bundleExpiresAt: string
): Promise<{ submitted: boolean; signatures: string[]; expiresAt: string }> {
  const web3 = await import('@solana/web3.js');
  const { Connection, Keypair, Transaction, VersionedTransaction } = web3;
  const bs58 = await import('bs58');

  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
  const connection = new Connection(rpcUrl, 'confirmed');

  let secretKey: Uint8Array;
  try {
    secretKey = bs58.default.decode(privateKeyEnv);
  } catch {
    secretKey = Uint8Array.from(JSON.parse(privateKeyEnv));
  }
  const keypair = Keypair.fromSecretKey(secretKey);
  const signatures: string[] = [];

  for (const { base64 } of transactions) {
    const buf = Buffer.from(base64, 'base64');
    let sig: string;
    try {
      const vtx = VersionedTransaction.deserialize(buf);
      vtx.sign([keypair]);
      sig = await connection.sendRawTransaction(vtx.serialize());
    } catch {
      const tx = Transaction.from(buf);
      tx.sign(keypair);
      sig = await connection.sendRawTransaction(tx.serialize());
    }
    await connection.confirmTransaction(sig, 'confirmed');
    signatures.push(sig);
  }

  return { submitted: true, signatures, expiresAt: bundleExpiresAt };
}
