import Decimal from 'decimal.js';
import { KaminoReserve } from '../classes';

/**
 * Expected output details when swapping source collateral into target collateral.
 */
export interface SwapCollExpectedOutput {
  /**
   * Target collateral amount that will be deposited into the obligation, in token units (not lamports).
   */
  expectedTargetCollAmount: Decimal;

  /**
   * Flash-loan fee amount in units of the flash-borrowed token.
   */
  flashLoanFeeAmount: Decimal;

  /**
   * For the 'debt' flash-borrow flow, the net increase in the obligation's debt position vs. the starting
   * outstanding amount, in debt-token units. Includes both the flash-loan fee AND the target debt reserve's
   * origination/borrow fee on the re-borrow (matches `getDebtWithFeesForBorrowAmount` semantics used on-chain).
   * 0 for the coll-side flash-borrow flows.
   */
  additionalDebtFromFee: Decimal;
}

/**
 * Inputs shared by every flow.
 */
interface BaseCalculateSwapCollExpectedOutputInputs {
  sourceCollAmount: Decimal;
  sourceCollReserve: KaminoReserve;
  targetCollReserve: KaminoReserve;
  /**
   * Price of 1 source coll denominated in target coll (e.g. 20 USDC = 1 MSOL → price = 1/20 = 0.05 when source=USDC,
   * target=MSOL).
   */
  priceSourceCollToTargetColl: Decimal;
  slippagePct: Decimal;
}

/**
 * Inputs for the coll-side flash-borrow flows ('targetColl' default, or 'sourceColl').
 */
export interface CalculateSwapCollExpectedOutputInputsCollFlow extends BaseCalculateSwapCollExpectedOutputInputs {
  flashBorrowToken?: 'sourceColl' | 'targetColl';
}

/**
 * Inputs for the 'debt' flash-borrow flow; both `debtReserve` and `outstandingDebtAmount` are required so that the
 * resulting flash-loan fee (paid as additional debt) can be computed.
 */
export interface CalculateSwapCollExpectedOutputInputsDebtFlow extends BaseCalculateSwapCollExpectedOutputInputs {
  flashBorrowToken: 'debt';
  debtReserve: KaminoReserve;
  /**
   * Outstanding debt amount (token units) of the user in the debt reserve. Used to estimate the flash-borrow size
   * (and thus the resulting fee).
   */
  outstandingDebtAmount: Decimal;
}

export type CalculateSwapCollExpectedOutputInputs =
  | CalculateSwapCollExpectedOutputInputsCollFlow
  | CalculateSwapCollExpectedOutputInputsDebtFlow;

/**
 * Calculates the expected amount of target collateral that will end up in the obligation after a swap, taking into
 * account the flash-loan fee and slippage. For the 'debt' flash-borrow flow, also reports the (small) additional debt
 * the user will incur as a consequence of the flash-loan fee.
 *
 * Note: this is an estimate only; the actual on-chain result is subject to real DEX slippage.
 */
export function calculateSwapCollExpectedOutput(inputs: CalculateSwapCollExpectedOutputInputs): SwapCollExpectedOutput {
  const { sourceCollAmount, sourceCollReserve, targetCollReserve, priceSourceCollToTargetColl, slippagePct } = inputs;

  if (sourceCollReserve.address === targetCollReserve.address) {
    throw new Error('Cannot swap from/to the same collateral');
  }
  if (sourceCollAmount.lte(0)) {
    throw new Error('sourceCollAmount must be positive');
  }

  const flashBorrowToken = inputs.flashBorrowToken ?? 'targetColl';
  const slippageFactor = new Decimal(1).sub(slippagePct.div(100));
  const grossSwapOutput = sourceCollAmount.mul(priceSourceCollToTargetColl).mul(slippageFactor);

  if (flashBorrowToken === 'targetColl') {
    const flashLoanFeeRate = targetCollReserve.getFlashLoanFee();
    // Inclusive fee: flashRepay = flashBorrow + fee, where fee = flashRepay * rate / (1 + rate).
    const flashLoanFeeAmount = grossSwapOutput.mul(flashLoanFeeRate.div(flashLoanFeeRate.add(1)));
    const expectedTargetCollAmount = grossSwapOutput.sub(flashLoanFeeAmount);
    return {
      expectedTargetCollAmount,
      flashLoanFeeAmount,
      additionalDebtFromFee: new Decimal(0),
    };
  }

  if (flashBorrowToken === 'sourceColl') {
    const flashLoanFeeRate = sourceCollReserve.getFlashLoanFee();
    // Inclusive fee: the requested source collateral amount is withdrawn to repay the flash loan, while only the
    // fee-net flash-borrowed amount is sent to the external swap.
    const flashLoanFeeAmount = sourceCollAmount.mul(flashLoanFeeRate.div(flashLoanFeeRate.add(1)));
    const expectedTargetCollAmount = sourceCollAmount
      .sub(flashLoanFeeAmount)
      .mul(priceSourceCollToTargetColl)
      .mul(slippageFactor);
    return {
      expectedTargetCollAmount,
      flashLoanFeeAmount,
      additionalDebtFromFee: new Decimal(0),
    };
  }

  // 'debt' flash-borrow flow: the input union requires `debtReserve` and `outstandingDebtAmount`.
  const debtInputs = inputs as CalculateSwapCollExpectedOutputInputsDebtFlow;
  if (debtInputs.outstandingDebtAmount.lte(0)) {
    throw new Error(`outstandingDebtAmount must be positive when flashBorrowToken === 'debt'`);
  }
  const flashLoanFeeRate = debtInputs.debtReserve.getFlashLoanFee();
  // Flow on-chain: flash borrow outstanding debt → repay (debt cancels) → ... → re-borrow `flashRepay = outstanding +
  // flashFee` → pay back the flash loan. The re-borrow goes through `borrow_obligation_liquidity` which adds the
  // target reserve's `originationFee` on top, so the obligation's debt actually grows by
  //   newDebt = flashRepay × (1 + originationFee)
  // and the net change vs. the starting outstanding is
  //   additionalDebt = newDebt − outstanding = flashFee + originationFee × flashRepay
  // For reserves with `originationFee === 0` this collapses to just `flashFee` (matches the original behavior).
  const borrowFeeRate = debtInputs.debtReserve.getBorrowFee();
  const flashLoanFeeAmount = debtInputs.outstandingDebtAmount.mul(flashLoanFeeRate);
  const flashRepayAmount = debtInputs.outstandingDebtAmount.add(flashLoanFeeAmount);
  const borrowOriginationFeeAmount = flashRepayAmount.mul(borrowFeeRate);
  const additionalDebtFromFee = flashRepayAmount.add(borrowOriginationFeeAmount).sub(debtInputs.outstandingDebtAmount);
  return {
    expectedTargetCollAmount: grossSwapOutput,
    flashLoanFeeAmount,
    additionalDebtFromFee,
  };
}

/**
 * Expected output details when swapping source debt into target debt.
 */
export interface SwapDebtExpectedOutput {
  /**
   * Target debt amount the obligation will owe after the swap settles, in target-debt token units. Includes the
   * target reserve's borrow/origination fee on top of the receive amount (matching how the on-chain obligation
   * actually grows), so this value mirrors `getDebtWithFeesForBorrowAmount` used by the LTV checks. UIs should
   * surface this number rather than the pre-fee receive amount.
   */
  expectedTargetDebtAmount: Decimal;

  /**
   * Flash-loan fee amount in units of the flash-borrowed token.
   */
  flashLoanFeeAmount: Decimal;

  /**
   * Origination fee applied by the target debt reserve on top of the borrow receive amount, in target-debt token
   * units. Zero for reserves with `originationFeeSf === 0`. Included inside `expectedTargetDebtAmount`.
   */
  borrowOriginationFeeAmount: Decimal;
}

export interface CalculateSwapDebtExpectedOutputInputs {
  sourceDebtSwapAmount: Decimal;
  sourceDebtReserve: KaminoReserve;
  targetDebtReserve: KaminoReserve;
  flashBorrowToken: 'sourceDebt' | 'targetDebt';
  /**
   * Price of 1 source debt denominated in target debt.
   */
  priceSourceDebtToTargetDebt: Decimal;
  slippagePct: Decimal;
}

/**
 * Calculates the expected amount of target debt that the obligation will owe after a debt swap, taking into account
 * the flash-loan fee and slippage.
 */
export function calculateSwapDebtExpectedOutput(inputs: CalculateSwapDebtExpectedOutputInputs): SwapDebtExpectedOutput {
  const {
    sourceDebtSwapAmount,
    sourceDebtReserve,
    targetDebtReserve,
    flashBorrowToken,
    priceSourceDebtToTargetDebt,
    slippagePct,
  } = inputs;

  if (sourceDebtReserve.address === targetDebtReserve.address) {
    throw new Error('Cannot swap from/to the same debt');
  }
  if (sourceDebtSwapAmount.lte(0)) {
    throw new Error('sourceDebtSwapAmount must be positive');
  }

  const slippageFactor = new Decimal(1).sub(slippagePct.div(100));
  // The target reserve charges an origination fee on the borrow's *receive amount*; the obligation's debt grows by
  // `receive + originationFee`. Mirror that here so the reported `expectedTargetDebtAmount` matches what the on-chain
  // LTV checks see (`KaminoObligation.getDebtWithFeesForBorrowAmount`).
  const targetBorrowFeeRate = targetDebtReserve.getBorrowFee();

  if (flashBorrowToken === 'targetDebt') {
    const flashLoanFeeRate = targetDebtReserve.getFlashLoanFee();
    // Flash borrow X of targetDebt, swap → sourceDebt. Need swap output ≥ sourceDebtSwapAmount:
    //   X * (1 / priceSourceToTarget) * slippageFactor ≥ sourceDebtSwapAmount
    //   X ≥ sourceDebtSwapAmount * priceSourceToTarget / slippageFactor
    const flashBorrowAmount = sourceDebtSwapAmount.mul(priceSourceDebtToTargetDebt).div(slippageFactor);
    const flashLoanFeeAmount = flashBorrowAmount.mul(flashLoanFeeRate);
    const targetBorrowReceiveAmount = flashBorrowAmount.add(flashLoanFeeAmount);
    const borrowOriginationFeeAmount = targetBorrowReceiveAmount.mul(targetBorrowFeeRate);
    return {
      expectedTargetDebtAmount: targetBorrowReceiveAmount.add(borrowOriginationFeeAmount),
      flashLoanFeeAmount,
      borrowOriginationFeeAmount,
    };
  }

  // flashBorrowToken === 'sourceDebt'
  const flashLoanFeeRate = sourceDebtReserve.getFlashLoanFee();
  // Flash borrow sourceDebtSwapAmount of sourceDebt, repay obligation, borrow Y targetDebt, swap → sourceDebt.
  // Need swap output ≥ flashRepay = sourceDebtSwapAmount * (1 + fee):
  //   Y * (1 / priceSourceToTarget) * slippageFactor ≥ sourceDebtSwapAmount * (1 + fee)
  //   Y ≥ sourceDebtSwapAmount * (1 + fee) * priceSourceToTarget / slippageFactor
  const flashLoanFeeAmount = sourceDebtSwapAmount.mul(flashLoanFeeRate);
  const flashRepayAmount = sourceDebtSwapAmount.add(flashLoanFeeAmount);
  const targetBorrowReceiveAmount = flashRepayAmount.mul(priceSourceDebtToTargetDebt).div(slippageFactor);
  const borrowOriginationFeeAmount = targetBorrowReceiveAmount.mul(targetBorrowFeeRate);
  return {
    expectedTargetDebtAmount: targetBorrowReceiveAmount.add(borrowOriginationFeeAmount),
    flashLoanFeeAmount,
    borrowOriginationFeeAmount,
  };
}
