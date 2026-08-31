/**
 * Kamino Transaction Builder — unsigned deposit/withdraw Transactions
 * ISOLATED: no shared code with Base/EVM vault.
 *
 * Returns base64-encoded legacy Transactions that the agent signs + submits.
 *
 * Fee collection:
 *  - Deposit: fee deducted from amountRaw; SPL Transfer + idempotent ATA-create injected
 *    into preLendingTxn so platform wallet receives fee before Kamino deposit.
 *  - Withdraw: flat 0.5% fee PLUS 15% performance fee on yield earned (high-water mark).
 *    Performance fee = max(0, currentValue - depositedUsdc) * PERF_FEE_BPS / 10_000.
 *    Both fees combined into a single SPL Transfer in postLendingTxn.
 *  - Platform wallet: derived from SOLANA_PRIVATE_KEY (same key used for all other Solana ops).
 *    Override with SOLANA_FEE_WALLET env var if a separate treasury address is preferred.
 *  - If neither env var is set: fee is still deducted from deposit amount but NOT swept on-chain.
 */

import { PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import * as splTokenModule from '@solana/spl-token';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { KaminoAction, VanillaObligation } from '@kamino-finance/klend-sdk';
import BN from 'bn.js';
import {
  getKaminoMarket,
  getSolanaYieldConnection,
  getPlatformSolanaWallet,
  SOLANA_YIELD_CONFIG,
} from './kaminoClient.js';

const {
  createTransferInstruction,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} = splTokenModule as unknown as {
  createTransferInstruction: (
    source: PublicKey,
    destination: PublicKey,
    owner: PublicKey,
    amount: number | bigint,
    multiSigners?: PublicKey[],
    programId?: PublicKey,
  ) => TransactionInstruction;
  createAssociatedTokenAccountIdempotentInstruction: (
    payer: PublicKey,
    associatedToken: PublicKey,
    owner: PublicKey,
    mint: PublicKey,
    programId?: PublicKey,
    associatedTokenProgramId?: PublicKey,
  ) => TransactionInstruction;
  getAssociatedTokenAddressSync: (
    mint: PublicKey,
    owner: PublicKey,
    allowOwnerOffCurve?: boolean,
    programId?: PublicKey,
    associatedTokenProgramId?: PublicKey,
  ) => PublicKey;
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TxBundle {
  transactions:    Array<{ base64: string; description: string }>;
  requestedRaw:    string;
  feeRaw:          string;         // total fee (flat + perf) in USDC lamports
  flatFeeRaw:      string;         // flat 0.5% withdrawal fee
  perfFeeRaw:      string;         // 15% performance fee on yield earned (0 if no yield)
  yieldEarnedRaw:  string;         // gross yield = currentValue - deposited (0 if unknown)
  netAmountRaw:    string;
  feePct:          string;
  quoteExpiresAt:  number;         // unix ms — blockhash valid ~90s
  feeCollected:    boolean;        // true when a real SPL Transfer ix was included
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

/**
 * Build fee-collection instructions: idempotent ATA-create + SPL Transfer.
 * Returns null set if platform wallet is not configured or fee is zero.
 *
 * The ATA-create instruction is idempotent — safe to include even if the ATA
 * already exists on-chain (rent paid by depositor, ~0.002 SOL one-time only).
 */
function buildFeeInstructions(
  depositorOwner: PublicKey,
  feeRaw: number,
): {
  ataCreateIx: ReturnType<typeof createAssociatedTokenAccountIdempotentInstruction> | null;
  transferIx:  ReturnType<typeof createTransferInstruction> | null;
  treasuryAta: string | null;
} {
  if (feeRaw === 0) return { ataCreateIx: null, transferIx: null, treasuryAta: null };

  const platformWallet = getPlatformSolanaWallet();
  if (!platformWallet) {
    return { ataCreateIx: null, transferIx: null, treasuryAta: null };
  }

  try {
    const usdcMint     = SOLANA_YIELD_CONFIG.USDC_MINT;
    const depositorAta = getAssociatedTokenAddressSync(usdcMint, depositorOwner, false, TOKEN_PROGRAM_ID);
    const treasuryAta  = getAssociatedTokenAddressSync(usdcMint, platformWallet, false, TOKEN_PROGRAM_ID);

    // Idempotent: will succeed whether or not treasury ATA already exists on-chain
    const ataCreateIx = createAssociatedTokenAccountIdempotentInstruction(
      depositorOwner,    // payer (pays rent ~0.002 SOL one-time if ATA missing)
      treasuryAta,
      platformWallet,
      usdcMint,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );

    const transferIx = createTransferInstruction(
      depositorAta,
      treasuryAta,
      depositorOwner,
      BigInt(feeRaw),
      [],
      TOKEN_PROGRAM_ID,
    );

    return { ataCreateIx, transferIx, treasuryAta: treasuryAta.toString() };
  } catch (err: any) {
    console.warn('[txBuilder] buildFeeInstructions failed (non-fatal):', err.message);
    return { ataCreateIx: null, transferIx: null, treasuryAta: null };
  }
}

// ── Deposit ───────────────────────────────────────────────────────────────────

/**
 * Build an unsigned deposit transaction bundle.
 * amountUsdcRaw: raw USDC lamports (6 decimals), e.g. 10_000_000 = $10
 *
 * Flow:
 *  1. preLendingTxn: [idempotent treasury ATA-create] + [USDC Transfer feeRaw → treasury] + [setup]
 *  2. lendingTxn:    Kamino deposit for netRaw = amountRaw - feeRaw
 *  3. postLendingTxn: [cleanup if any]
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

  // ── Inject idempotent ATA-create + fee transfer into preLendingTxn ───────────
  const { ataCreateIx, transferIx, treasuryAta } = buildFeeInstructions(owner, feeRaw);
  let feeCollected = false;

  if (ataCreateIx && transferIx) {
    const feeBundle = new Transaction().add(ataCreateIx, transferIx);
    if (txns.preLendingTxn) {
      // Prepend fee ixs before existing setup ixs
      const existingIxs = txns.preLendingTxn.instructions;
      txns.preLendingTxn = new Transaction().add(ataCreateIx, transferIx, ...existingIxs);
    } else {
      txns.preLendingTxn = feeBundle;
    }
    feeCollected = true;
    console.log(`[txBuilder] Deposit fee: ${feeRaw} USDC lamports → ${treasuryAta}`);
  }

  const collected = collectTxns(txns, owner, blockhash, [
    'treasury-ata-create + fee-transfer + setup',
    'kamino-deposit',
    'cleanup',
  ]);

  if (collected.length === 0) {
    throw new Error('Kamino returned no transactions for deposit');
  }

  const warnings: string[] = [];
  if (!feeCollected && feeRaw > 0) {
    warnings.push(
      'Platform fee deducted from deposit but not swept to treasury ' +
      '(SOLANA_PRIVATE_KEY not configured — contact support)',
    );
  }

  return {
    transactions:   collected,
    requestedRaw:   amountUsdcRaw.toString(),
    feeRaw:         feeRaw.toString(),
    flatFeeRaw:     feeRaw.toString(),
    perfFeeRaw:     '0',
    yieldEarnedRaw: '0',
    netAmountRaw:   netRaw.toString(),
    feePct:         (SOLANA_YIELD_CONFIG.DEPOSIT_FEE_BPS / 100).toFixed(2),
    quoteExpiresAt: Date.now() + 60_000,
    feeCollected,
    warning:        warnings.length > 0 ? warnings.join('; ') : undefined,
  };
}

// ── Withdraw ──────────────────────────────────────────────────────────────────

/**
 * Build an unsigned withdraw transaction bundle.
 * amountUsdcRaw: raw USDC lamports, or the string 'MAX' to withdraw everything.
 * depositedUsdcRaw: the wallet's original deposited amount from our DB (used for perf fee).
 *
 * Fee model:
 *  - Flat:        0.5%  of requested withdrawal amount (WITHDRAW_FEE_BPS)
 *  - Performance: 15%   of yield earned (current value − original deposit, high-water mark)
 *                 Only charged when depositedUsdcRaw is provided and yield > 0.
 *  Both fees are swept to the platform treasury in a single SPL Transfer instruction.
 *
 * Flow:
 *  1. preLendingTxn:  [setup if any]
 *  2. lendingTxn:     Kamino withdrawal for requestedRaw
 *  3. postLendingTxn: [idempotent treasury ATA-create] + [USDC Transfer totalFeeRaw → treasury] + [cleanup]
 */
export async function buildWithdrawTxBundle(
  walletAddress:    string,
  amountUsdcRaw:    number | 'MAX',
  depositedUsdcRaw?: string,   // from DB: position.depositedUsdcRaw
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

  // ── Fee calculation ─────────────────────────────────────────────────────────
  // 1. Flat withdrawal fee (0.5%)
  const flatFeeRaw = Math.floor((requestedRaw * SOLANA_YIELD_CONFIG.WITHDRAW_FEE_BPS) / 10_000);

  // 2. Performance fee (15% of yield earned, high-water mark)
  //    Only calculated when the deposited amount is known from DB.
  //    yieldEarned = max(0, requestedRaw − depositedUsdcRaw)
  let yieldEarnedRaw = 0;
  let perfFeeRaw     = 0;

  if (depositedUsdcRaw) {
    const deposited = Number(depositedUsdcRaw);
    if (!isNaN(deposited) && deposited > 0 && requestedRaw > deposited) {
      yieldEarnedRaw = requestedRaw - deposited;
      perfFeeRaw     = Math.floor((yieldEarnedRaw * SOLANA_YIELD_CONFIG.PERF_FEE_BPS) / 10_000);
    }
  }

  const totalFeeRaw = flatFeeRaw + perfFeeRaw;
  const netRaw      = requestedRaw - totalFeeRaw;
  const slot        = await connection.getSlot('confirmed');

  if (perfFeeRaw > 0) {
    console.log(
      `[txBuilder] Perf fee: yield_earned=${(yieldEarnedRaw / 1e6).toFixed(4)} USDC → ` +
      `perf_fee=${(perfFeeRaw / 1e6).toFixed(4)} USDC (15%) + flat=${(flatFeeRaw / 1e6).toFixed(4)} USDC (0.5%) ` +
      `= total_fee=${(totalFeeRaw / 1e6).toFixed(4)} USDC`,
    );
  }

  const action = await KaminoAction.buildWithdrawTxns(
    market,
    new BN(requestedRaw.toString()),
    SOLANA_YIELD_CONFIG.USDC_MINT,
    owner,
    existingObligation,
    300_000,
    true,
    false,
    true,
    undefined,
    slot,
  );

  const txns      = await action.getTransactions();
  const blockhash = (await connection.getLatestBlockhash('confirmed')).blockhash;

  // ── Inject idempotent ATA-create + combined fee transfer into postLendingTxn ─
  const { ataCreateIx, transferIx, treasuryAta } = buildFeeInstructions(owner, totalFeeRaw);
  let feeCollected = false;

  if (ataCreateIx && transferIx) {
    if (txns.postLendingTxn) {
      const existingIxs = txns.postLendingTxn.instructions;
      txns.postLendingTxn = new Transaction().add(...existingIxs, ataCreateIx, transferIx);
    } else {
      txns.postLendingTxn = new Transaction().add(ataCreateIx, transferIx);
    }
    feeCollected = true;
    console.log(`[txBuilder] Withdraw total fee: ${totalFeeRaw} lamports → ${treasuryAta}`);
  }

  const collected = collectTxns(txns, owner, blockhash, [
    'setup',
    'kamino-withdraw',
    'cleanup + fee-transfer',
  ]);

  if (collected.length === 0) {
    throw new Error('Kamino returned no transactions for withdrawal');
  }

  const effectiveFeePct = requestedRaw > 0
    ? ((totalFeeRaw / requestedRaw) * 100).toFixed(2)
    : SOLANA_YIELD_CONFIG.WITHDRAW_FEE_BPS.toString();

  return {
    transactions:   collected,
    requestedRaw:   requestedRaw.toString(),
    feeRaw:         totalFeeRaw.toString(),
    flatFeeRaw:     flatFeeRaw.toString(),
    perfFeeRaw:     perfFeeRaw.toString(),
    yieldEarnedRaw: yieldEarnedRaw.toString(),
    netAmountRaw:   netRaw.toString(),
    feePct:         effectiveFeePct,
    quoteExpiresAt: Date.now() + 60_000,
    feeCollected,
  };
}
