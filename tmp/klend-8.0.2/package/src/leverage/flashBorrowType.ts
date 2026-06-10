import { Address, Option, Slot } from '@solana/kit';
import Decimal from 'decimal.js';

import { KaminoMarket, KaminoObligation, lamportsToNumberDecimal as fromLamports } from '../classes';
import { WRAPPED_SOL_MINT } from '../utils';
import {
  adjustDepositLeverageCalcsDebtFlash,
  adjustWithdrawLeverageCalcsCollFlash,
  calcAdjustAmounts,
  depositLeverageCalcs,
  depositLeverageCalcsDebtFlash,
  withdrawLeverageCalcs,
  withdrawLeverageCalcsCollFlash,
} from './calcs';
import { FlashBorrowType } from './types';
import { determineFlashBorrowType } from './utils';
import {
  calcRepayAmountWithSlippage,
  calcRepayWithCollCollFlashSwap,
} from '../lending_operations/repay_with_collateral_calcs';

/**
 * Intent-level helpers that pick a viable `FlashBorrowType` for each leverage operation.
 *
 * Callers provide only the intent (amounts, target leverage, price); the SDK computes the
 * required-lamport size for each candidate flash side, then runs the existing
 * `determineFlashBorrowType` viability check (flash loans enabled + sufficient liquidity, prefer
 * coll when both are viable).
 *
 * Each helper throws with a diagnostic message if neither side is viable.
 */

/**
 * Picks a viable `FlashBorrowType` for a leveraged DEPOSIT (open / scale-into position).
 *
 *  - debt-flash flash-borrows the loan-side; coll-flash flash-borrows the collateral side.
 *  - Sizes are derived from `depositLeverageCalcs` (coll-flash) and `depositLeverageCalcsDebtFlash`
 *    (debt-flash), both at the requested target leverage and the provided price.
 *  - `selectedTokenMint` follows the operation's "I'm paying X with this token" convention.
 *
 * @throws if neither side is viable.
 */
export function determineDepositLeverageFlashBorrowType(props: {
  kaminoMarket: KaminoMarket;
  collReserveAddress: Address;
  debtReserveAddress: Address;
  /** Amount the user is depositing, in `selectedTokenMint` decimals (NOT lamports). */
  depositAmount: Decimal;
  /** Which token the user is paying with — must equal coll mint or debt mint (or SOL). */
  selectedTokenMint: Address;
  targetLeverage: Decimal;
  /** Price expressed as coll-per-debt, i.e. 1 unit of debt = `priceDebtToColl` units of coll. */
  priceDebtToColl: Decimal;
  /** Swap slippage tolerance, percent (e.g. 0.5 = 0.5%). */
  slippagePct: Decimal;
}): FlashBorrowType {
  const {
    kaminoMarket,
    collReserveAddress,
    debtReserveAddress,
    depositAmount,
    selectedTokenMint,
    targetLeverage,
    slippagePct,
  } = props;
  const collReserve = kaminoMarket.getExistingReserveByAddress(collReserveAddress);
  const debtReserve = kaminoMarket.getExistingReserveByAddress(debtReserveAddress);

  const collTokenMint = collReserve.getLiquidityMint();
  const [solTokenReserve] = kaminoMarket.getReservesByMint(WRAPPED_SOL_MINT);
  const depositTokenIsCollToken = selectedTokenMint === collTokenMint;
  const depositTokenIsSol = solTokenReserve ? selectedTokenMint === solTokenReserve.getLiquidityMint() : false;

  // Coll-flash sizing.
  const collFlashCalcs = depositLeverageCalcs({
    depositAmount,
    depositTokenIsCollToken,
    depositTokenIsSol,
    priceDebtToColl: props.priceDebtToColl,
    targetLeverage,
    slippagePct,
    flashLoanFee: collReserve.getFlashLoanFee(),
  });
  const requiredCollLamports = collFlashCalcs.flashBorrowInCollToken.mul(collReserve.getMintFactor()).ceil();

  // Debt-flash sizing.
  const debtFlashCalcs = depositLeverageCalcsDebtFlash({
    depositAmount,
    depositTokenIsCollToken,
    depositTokenIsSol,
    priceDebtToColl: props.priceDebtToColl,
    targetLeverage,
    slippagePct,
    flashLoanFee: debtReserve.getFlashLoanFee(),
  });
  const requiredDebtLamports = debtFlashCalcs.flashBorrowInDebtToken.mul(debtReserve.getMintFactor()).ceil();

  return determineFlashBorrowType(collReserve, debtReserve, requiredCollLamports, requiredDebtLamports);
}

/**
 * Picks a viable `FlashBorrowType` for a leveraged WITHDRAW (partial unwind or close-position).
 *
 *  - debt-flash flash-borrows the repay amount in debt lamports.
 *  - coll-flash flash-borrows the swap-in amount in coll lamports.
 *  - Sizes come from `withdrawLeverageCalcs` and `withdrawLeverageCalcsCollFlash`.
 *
 * @throws if neither side is viable.
 */
export function determineWithdrawLeverageFlashBorrowType(props: {
  kaminoMarket: KaminoMarket;
  obligation: KaminoObligation;
  collReserveAddress: Address;
  debtReserveAddress: Address;
  /** Withdraw amount in selectedToken decimals — ignored when `isClosingPosition=true`. */
  withdrawAmount: Decimal;
  /** Which token the user wants back — must equal coll mint or debt mint. */
  selectedTokenMint: Address;
  isClosingPosition: boolean;
  /** Price expressed as debt-per-coll. */
  priceCollToDebt: Decimal;
  /** Current obligation deposit (coll lamports decimal). Defaults to obligation's coll position. */
  depositedLamports?: Decimal;
  /** Current obligation borrow (debt lamports decimal). Defaults to obligation's debt position. */
  borrowedLamports?: Decimal;
  currentSlot: Slot;
  slippagePct: Decimal;
}): FlashBorrowType {
  const {
    kaminoMarket,
    obligation,
    collReserveAddress,
    debtReserveAddress,
    withdrawAmount,
    selectedTokenMint,
    isClosingPosition,
    priceCollToDebt,
    currentSlot,
    slippagePct,
  } = props;
  const collReserve = kaminoMarket.getExistingReserveByAddress(collReserveAddress);
  const debtReserve = kaminoMarket.getExistingReserveByAddress(debtReserveAddress);

  const deposited =
    props.depositedLamports !== undefined
      ? fromLamports(props.depositedLamports, collReserve.stats.decimals)
      : fromLamports(
          obligation.getDepositByReserve(collReserveAddress)?.amount ?? new Decimal(0),
          collReserve.stats.decimals
        );
  const borrowed =
    props.borrowedLamports !== undefined
      ? fromLamports(props.borrowedLamports, debtReserve.stats.decimals)
      : fromLamports(
          obligation.getBorrowByReserve(debtReserveAddress)?.amount ?? new Decimal(0),
          debtReserve.stats.decimals
        );

  const selectedTokenIsCollToken = selectedTokenMint === collReserve.getLiquidityMint();

  // Debt-flash: flash borrow = repayAmount.
  const debtFlashCalcs = withdrawLeverageCalcs(
    kaminoMarket,
    collReserve,
    debtReserve,
    priceCollToDebt,
    withdrawAmount,
    deposited,
    borrowed,
    currentSlot,
    isClosingPosition,
    selectedTokenIsCollToken,
    selectedTokenMint,
    obligation,
    debtReserve.getFlashLoanFee(),
    slippagePct
  );
  const requiredDebtLamports = debtFlashCalcs.repayAmount.mul(debtReserve.getMintFactor()).ceil();

  // Coll-flash: flash borrow = flashBorrowInCollToken.
  const collFlashCalcs = withdrawLeverageCalcsCollFlash(
    kaminoMarket,
    collReserve,
    debtReserve,
    priceCollToDebt,
    withdrawAmount,
    deposited,
    borrowed,
    currentSlot,
    isClosingPosition,
    selectedTokenIsCollToken,
    selectedTokenMint,
    obligation,
    collReserve.getFlashLoanFee(),
    slippagePct
  );
  const requiredCollLamports = collFlashCalcs.flashBorrowInCollToken.mul(collReserve.getMintFactor()).ceil();

  return determineFlashBorrowType(collReserve, debtReserve, requiredCollLamports, requiredDebtLamports);
}

/**
 * Picks a viable `FlashBorrowType` for a leveraged ADJUST (increase or decrease).
 *
 * Auto-detects increase vs decrease from the sign of the position deltas returned by
 * `calcAdjustAmounts`:
 *  - increase (current < target): coll-flash borrows `adjustDepositPosition` coll lamports,
 *    debt-flash borrows `flashBorrowInDebtToken` debt lamports;
 *  - decrease (current > target): debt-flash borrows |`adjustBorrowPosition`| debt lamports,
 *    coll-flash borrows `flashBorrowInCollToken` coll lamports.
 *
 * @throws if neither side is viable, or if `targetLeverage` equals the current leverage exactly
 *   (nothing to adjust — caller should skip the op).
 */
export function determineAdjustLeverageFlashBorrowType(props: {
  kaminoMarket: KaminoMarket;
  obligation: KaminoObligation;
  collReserveAddress: Address;
  debtReserveAddress: Address;
  targetLeverage: Decimal;
  /** Price expressed as debt-per-coll. */
  priceCollToDebt: Decimal;
  /** Price expressed as coll-per-debt. */
  priceDebtToColl: Decimal;
  slippagePct: Decimal;
}): FlashBorrowType {
  const {
    kaminoMarket,
    obligation,
    collReserveAddress,
    debtReserveAddress,
    targetLeverage,
    priceCollToDebt,
    slippagePct,
  } = props;
  const collReserve = kaminoMarket.getExistingReserveByAddress(collReserveAddress);
  const debtReserve = kaminoMarket.getExistingReserveByAddress(debtReserveAddress);

  const deposited = fromLamports(
    obligation.getDepositByReserve(collReserveAddress)?.amount ?? new Decimal(0),
    collReserve.stats.decimals
  );
  const borrowed = fromLamports(
    obligation.getBorrowByReserve(debtReserveAddress)?.amount ?? new Decimal(0),
    debtReserve.stats.decimals
  );

  // Direction is determined by the sign of the position deltas — the flash-loan-fee on this call
  // is a tiny perturbation that won't flip the sign; using the coll fee here is incidental.
  const { adjustDepositPosition, adjustBorrowPosition } = calcAdjustAmounts({
    currentDepositPosition: deposited,
    currentBorrowPosition: borrowed,
    targetLeverage,
    priceCollToDebt,
    flashLoanFee: new Decimal(collReserve.getFlashLoanFee()),
  });
  const isIncrease = adjustDepositPosition.gte(0) && adjustBorrowPosition.gte(0);
  const isDecrease = adjustDepositPosition.lte(0) && adjustBorrowPosition.lte(0);
  if (!isIncrease && !isDecrease) {
    throw new Error(
      'determineAdjustLeverageFlashBorrowType: ambiguous direction (deposit/borrow deltas have opposite signs)'
    );
  }
  if (adjustDepositPosition.isZero() && adjustBorrowPosition.isZero()) {
    throw new Error('determineAdjustLeverageFlashBorrowType: nothing to adjust — current leverage matches target');
  }

  let requiredCollLamports: Decimal;
  let requiredDebtLamports: Decimal;

  if (isIncrease) {
    // Coll-flash borrows enough coll to deposit; debt-flash borrows the debt-side calc.
    requiredCollLamports = adjustDepositPosition.mul(collReserve.getMintFactor()).ceil();
    const debtFlashCalcs = adjustDepositLeverageCalcsDebtFlash(
      debtReserve,
      adjustDepositPosition,
      adjustBorrowPosition,
      props.priceDebtToColl,
      debtReserve.getFlashLoanFee(),
      slippagePct
    );
    requiredDebtLamports = debtFlashCalcs.flashBorrowInDebtToken.mul(debtReserve.getMintFactor()).ceil();
  } else {
    // Debt-flash borrows the absolute borrow delta; coll-flash uses the coll-side calc.
    requiredDebtLamports = Decimal.abs(adjustBorrowPosition).mul(debtReserve.getMintFactor()).ceil();
    const collFlashCalcs = adjustWithdrawLeverageCalcsCollFlash(
      adjustDepositPosition,
      adjustBorrowPosition,
      priceCollToDebt,
      collReserve.getFlashLoanFee(),
      slippagePct
    );
    requiredCollLamports = collFlashCalcs.flashBorrowInCollToken.mul(collReserve.getMintFactor()).ceil();
  }

  return determineFlashBorrowType(collReserve, debtReserve, requiredCollLamports, requiredDebtLamports);
}

/**
 * Picks a viable `FlashBorrowType` for a repay-with-collateral op given only the client-level intent
 * (which obligation, which reserves, how much debt to repay, the swap price). The SDK computes
 * the per-side required lamports internally — the caller does NOT need to size the flash borrow.
 *
 * Semantics (matches the build flows):
 *  - debt-flash needs to flash borrow the IR-adjusted debt repay amount in debt lamports;
 *  - coll-flash needs to flash borrow enough coll to swap into that same IR-adjusted repay amount.
 *
 * Both sides are then validated against `isFlashLoanEnabled(reserve)` and against the reserve's
 * available liquidity by `determineFlashBorrowType`. Preference is coll when both work.
 *
 * @throws if neither reserve supports flash borrowing the required amount.
 */
export function determineRepayWithCollFlashBorrowType(props: {
  kaminoMarket: KaminoMarket;
  obligation: KaminoObligation;
  debtReserveAddress: Address;
  collReserveAddress: Address;
  /** Debt-token-denominated repay amount (decimal — not lamports). */
  repayAmount: Decimal;
  /** Price expressed as debt-per-coll, i.e. 1 unit of coll = `priceCollToDebt` units of debt. */
  priceCollToDebt: Decimal;
  /** Swap slippage tolerance for the coll→debt swap, percent (e.g. `0.5` = 0.5%). */
  slippagePct: Decimal;
  currentSlot: Slot;
  referrer: Option<Address>;
}): FlashBorrowType {
  const {
    kaminoMarket,
    obligation,
    debtReserveAddress,
    collReserveAddress,
    repayAmount,
    priceCollToDebt,
    currentSlot,
    referrer,
    slippagePct,
  } = props;

  const collReserve = kaminoMarket.getExistingReserveByAddress(collReserveAddress);
  const debtReserve = kaminoMarket.getExistingReserveByAddress(debtReserveAddress);

  if (priceCollToDebt.isZero()) {
    throw new Error('determineRepayWithCollFlashBorrowType: priceCollToDebt is zero');
  }

  const { repayAmountLamports } = calcRepayAmountWithSlippage(
    kaminoMarket,
    debtReserve,
    currentSlot,
    obligation,
    repayAmount,
    referrer
  );

  // Debt-flash borrows the same IR-adjusted repay amount used by the transaction builder.
  const requiredDebtLamports = repayAmountLamports;

  const { flashBorrowInCollLamports: requiredCollLamports } = calcRepayWithCollCollFlashSwap({
    repayAmountLamports,
    swapPriceCollToDebt: priceCollToDebt,
    slippagePct,
    collFlashLoanFee: collReserve.getFlashLoanFee(),
    collMintFactor: collReserve.getMintFactor(),
    debtMintFactor: debtReserve.getMintFactor(),
  });

  return determineFlashBorrowType(collReserve, debtReserve, requiredCollLamports, requiredDebtLamports);
}
