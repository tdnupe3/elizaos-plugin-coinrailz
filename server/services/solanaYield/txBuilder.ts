/**
 * Kamino Transaction Builder — unsigned deposit/withdraw VersionedTransactions
 * ISOLATED: no shared code with Base/EVM vault.
 *
 * Returns base64-encoded legacy Transactions that the agent signs + submits.
 * Fee is deducted from the deposit amount (not charged separately).
 */

import { PublicKey, Transaction } from '@solana/web3.js';
import { KaminoAction, VanillaObligation } from '@kamino-finance/klend-sdk';
import BN from 'bn.js';
import { getKaminoMarket, getSolanaYieldConnection, SOLANA_YIELD_CONFIG } from './kaminoClient.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TxBundle {
  transactions:    Array<{ base64: string; description: string }>;
  requestedRaw:    string;
  feeRaw:          string;
  netAmountRaw:    string;
  feePct:          string;
  quoteExpiresAt:  number;   // unix ms — blockhash valid for ~90s
  warning?:        string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function serializeTx(txn: Transaction, owner: PublicKey, blockhash: string): string {
  txn.recentBlockhash = blockhash;
  txn.feePayer        = owner;
  return txn.serialize({ requireAllSignatures: false, verifySignatures: false }).toString('base64');
}

function collectTxns(
  txns: { preLendingTxn: Transaction | null; lendingTxn: Transaction | null; postLendingTxn: Transaction | null },
  owner: PublicKey,
  blockhash: string,
  labels: [string, string, string],
): Array<{ base64: string; description: string }> {
  const result: Array<{ base64: string; description: string }> = [];
  const pairs: Array<[Transaction | null, string]> = [
    [txns.preLendingTxn,  labels[0]],
    [txns.lendingTxn,     labels[1]],
    [txns.postLendingTxn, labels[2]],
  ];
  for (const [txn, desc] of pairs) {
    if (txn) result.push({ base64: serializeTx(txn, owner, blockhash), description: desc });
  }
  return result;
}

// ── Deposit ───────────────────────────────────────────────────────────────────

/**
 * Build an unsigned deposit transaction bundle.
 * amountUsdcRaw: raw USDC lamports (6 decimals), e.g. 10_000_000 = $10
 */
export async function buildDepositTxBundle(
  walletAddress: string,
  amountUsdcRaw: number,
): Promise<TxBundle> {
  if (amountUsdcRaw < SOLANA_YIELD_CONFIG.MIN_DEPOSIT_RAW) {
    throw new Error(
      `Minimum deposit is $5 USDC (${SOLANA_YIELD_CONFIG.MIN_DEPOSIT_RAW} raw). ` +
      `Received: ${amountUsdcRaw}`,
    );
  }

  const owner      = new PublicKey(walletAddress);
  const feeRaw     = Math.floor((amountUsdcRaw * SOLANA_YIELD_CONFIG.DEPOSIT_FEE_BPS) / 10_000);
  const netRaw     = amountUsdcRaw - feeRaw;
  const market     = await getKaminoMarket();
  const connection = getSolanaYieldConnection();

  const existingObligation = await market.getObligationByWallet(
    owner,
    new VanillaObligation(SOLANA_YIELD_CONFIG.PROGRAM_ID),
  );
  const obligation = existingObligation ?? new VanillaObligation(SOLANA_YIELD_CONFIG.PROGRAM_ID);

  const action = await KaminoAction.buildDepositTxns(
    market,
    new BN(netRaw.toString()),
    SOLANA_YIELD_CONFIG.USDC_MINT,
    owner,
    obligation,
    300_000,
  );

  const txns     = await action.getTransactions();
  const blockhash = (await connection.getLatestBlockhash('confirmed')).blockhash;
  const collected = collectTxns(txns, owner, blockhash, ['setup', 'deposit', 'cleanup']);

  if (collected.length === 0) {
    throw new Error('Kamino returned no transactions for deposit');
  }

  return {
    transactions:   collected,
    requestedRaw:   amountUsdcRaw.toString(),
    feeRaw:         feeRaw.toString(),
    netAmountRaw:   netRaw.toString(),
    feePct:         (SOLANA_YIELD_CONFIG.DEPOSIT_FEE_BPS / 100).toFixed(2),
    quoteExpiresAt: Date.now() + 60_000,
  };
}

// ── Withdraw ──────────────────────────────────────────────────────────────────

/**
 * Build an unsigned withdraw transaction bundle.
 * amountUsdcRaw: raw USDC lamports, or the string 'MAX' to withdraw everything.
 */
export async function buildWithdrawTxBundle(
  walletAddress: string,
  amountUsdcRaw: number | 'MAX',
): Promise<TxBundle> {
  const owner      = new PublicKey(walletAddress);
  const market     = await getKaminoMarket();
  const connection = getSolanaYieldConnection();

  const existingObligation = await market.getObligationByWallet(
    owner,
    new VanillaObligation(SOLANA_YIELD_CONFIG.PROGRAM_ID),
  );
  if (!existingObligation) {
    throw new Error('No active Kamino lending position found for this wallet address');
  }

  let requestedRaw: number;
  if (amountUsdcRaw === 'MAX') {
    const deposited = await market.getObligationDepositByWallet(
      owner,
      SOLANA_YIELD_CONFIG.USDC_MINT,
      new VanillaObligation(SOLANA_YIELD_CONFIG.PROGRAM_ID),
    );
    requestedRaw = Number(deposited.toString());
  } else {
    requestedRaw = amountUsdcRaw;
  }

  if (requestedRaw <= 0) throw new Error('Nothing to withdraw from this position');

  const feeRaw  = Math.floor((requestedRaw * SOLANA_YIELD_CONFIG.WITHDRAW_FEE_BPS) / 10_000);
  const netRaw  = requestedRaw - feeRaw;
  const slot    = await connection.getSlot('confirmed');

  const action = await KaminoAction.buildWithdrawTxns(
    market,
    new BN(requestedRaw.toString()),
    SOLANA_YIELD_CONFIG.USDC_MINT,
    owner,
    existingObligation,
    slot,
    300_000,
  );

  const txns      = await action.getTransactions();
  const blockhash  = (await connection.getLatestBlockhash('confirmed')).blockhash;
  const collected  = collectTxns(txns, owner, blockhash, ['setup', 'withdraw', 'cleanup']);

  if (collected.length === 0) {
    throw new Error('Kamino returned no transactions for withdrawal');
  }

  return {
    transactions:   collected,
    requestedRaw:   requestedRaw.toString(),
    feeRaw:         feeRaw.toString(),
    netAmountRaw:   netRaw.toString(),
    feePct:         (SOLANA_YIELD_CONFIG.WITHDRAW_FEE_BPS / 100).toFixed(2),
    quoteExpiresAt: Date.now() + 60_000,
  };
}
