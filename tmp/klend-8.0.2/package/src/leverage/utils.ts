import { KaminoReserve, lamportsToNumberDecimal } from '../classes';
import { Address, GetAccountInfoApi, Rpc, GetTokenAccountBalanceApi } from '@solana/kit';
import Decimal from 'decimal.js';
import { getTokenAccountBalanceDecimal, U64_MAX } from '../utils';
import BN from 'bn.js';
import { FlashBorrowType } from './types';

export const getExpectedTokenBalanceAfterBorrow = async (
  rpc: Rpc<GetAccountInfoApi & GetTokenAccountBalanceApi>,
  mint: Address,
  owner: Address,
  amountToBorrowLamports: Decimal,
  amountToBorrowMintDecimals: number
): Promise<Decimal> => {
  const initialUserTokenABalance = await getTokenAccountBalanceDecimal(rpc, mint, owner);

  return initialUserTokenABalance
    .add(lamportsToNumberDecimal(amountToBorrowLamports, amountToBorrowMintDecimals))
    .toDecimalPlaces(amountToBorrowMintDecimals);
};

export const isBorrowingEnabled = (reserve: KaminoReserve) => {
  return reserve.state.config.borrowLimit.gt(new BN(0));
};

/**
 * Returns true if flash loans are enabled on this reserve.
 * Flash loans are disabled when flashLoanFeeSf === U64_MAX (sentinel value).
 * Note: getFlashLoanFee() returns 0 for both "free" and "disabled", so we check the raw field.
 */
export function isFlashLoanEnabled(reserve: KaminoReserve): boolean {
  return reserve.state.config.fees.flashLoanFeeSf.toString() !== U64_MAX;
}

/**
 * Determines which token to flash borrow based on reserve capabilities.
 *
 * Checks:
 * 1. Whether flash loans are enabled on the reserve (flashLoanFeeSf !== U64_MAX)
 * 2. Whether the reserve has sufficient available liquidity
 *
 * When both reserves are viable, prefers collateral (typically has more liquidity).
 *
 * @param collReserve - The collateral reserve
 * @param debtReserve - The debt reserve
 * @param requiredCollLamports - Amount needed if flash borrowing collateral
 * @param requiredDebtLamports - Amount needed if flash borrowing debt
 * @returns 'coll' or 'debt'
 * @throws if neither reserve supports flash borrowing the required amount
 */
export function determineFlashBorrowType(
  collReserve: KaminoReserve,
  debtReserve: KaminoReserve,
  requiredCollLamports: Decimal,
  requiredDebtLamports: Decimal
): FlashBorrowType {
  const collEnabled = isFlashLoanEnabled(collReserve);
  const debtEnabled = isFlashLoanEnabled(debtReserve);

  const collLiquidity = collReserve.getLiquidityAvailableAmount();
  const debtLiquidity = debtReserve.getLiquidityAvailableAmount();

  const collViable = collEnabled && collLiquidity.gte(requiredCollLamports);
  const debtViable = debtEnabled && debtLiquidity.gte(requiredDebtLamports);

  if (collViable && debtViable) {
    // Prefer collateral — collateral reserves typically have much more liquidity
    return 'coll';
  }
  if (collViable) return 'coll';
  if (debtViable) return 'debt';

  throw new Error(
    `Neither collateral nor debt reserve supports flash borrowing the required amount. ` +
      `Coll: enabled=${collEnabled}, available=${collLiquidity}, required=${requiredCollLamports}. ` +
      `Debt: enabled=${debtEnabled}, available=${debtLiquidity}, required=${requiredDebtLamports}.`
  );
}
