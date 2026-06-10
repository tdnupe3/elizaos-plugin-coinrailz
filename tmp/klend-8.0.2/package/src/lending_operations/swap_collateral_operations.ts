import {
  ElevationGroupDescription,
  FeeCalculation,
  KaminoAction,
  KaminoMarket,
  KaminoObligation,
  KaminoReserve,
} from '../classes';
import { FlashLoanInfo, getFlashLoanInstructions, SwapIxsProvider, SwapQuoteProvider } from '../leverage';
import {
  createAtasIdempotent,
  DEFAULT_MAX_COMPUTE_UNITS,
  getAssociatedTokenAddress,
  getComputeBudgetAndPriorityFeeIxs,
  removeBudgetIxs,
  U64_MAX,
  uniqueAccountsWithProgramIds,
  WRAPPED_SOL_MINT,
} from '../utils';
import { Account, Address, Instruction, isSome, none, Option, Slot, TransactionSigner } from '@solana/kit';
import Decimal from 'decimal.js';
import { TOKEN_PROGRAM_ADDRESS } from '@solana-program/token';
import { AddressLookupTable } from '@solana-program/address-lookup-table';
import { getCloseAccountInstruction } from '@solana-program/token-2022';

/**
 * Which token to flash borrow for a swap-collateral operation.
 *
 * - `targetColl`: flash borrow target collateral, deposit it into the obligation, withdraw source collateral, swap
 *   source → target on external DEX, and use the swap output to repay the flash loan. Works even if the debt
 *   reserve's borrow limit is crossed. The flash-loan fee reduces the final amount of target collateral deposited.
 * - `sourceColl`: flash borrow source collateral, swap source → target on external DEX, deposit target collateral,
 *   withdraw source collateral, and use the withdrawn source collateral to repay the flash loan. The flash-loan fee
 *   reduces the source amount sent to the external DEX.
 * - `debt`: flash borrow the debt token, repay debt, withdraw source collateral, swap source → target on external DEX,
 *   deposit target, borrow debt back, and repay the flash loan. Useful when the target collateral reserve has low
 *   flash-loan liquidity. Requires the debt reserve borrow limit to have headroom; fails otherwise. The flash-loan fee
 *   is paid as a small increase in debt.
 */
export type SwapCollFlashBorrowToken = 'sourceColl' | 'targetColl' | 'debt';

/**
 * Inputs to the `getSwapCollIxs()` operation.
 */
export interface SwapCollIxsInputs<QuoteResponse> {
  /**
   * The amount of source collateral to be swapped-in for the target collateral.
   * This value will be treated exactly (i.e. slippage is not applied here) and thus must not exceed the collateral's
   * total amount.
   */
  sourceCollSwapAmount: Decimal;

  /**
   * If true, the source collateral will be closed - whatever amount is left after withdrawing `sourceCollSwapAmount`
   * will be transferred to the user.
   */
  isClosingSourceColl: boolean;

  /**
   * The address of the source collateral reserve (i.e. the current one).
   */
  sourceCollReserveAddress: Address;

  /**
   * The address of the target collateral reserve (i.e. the new one).
   */
  targetCollReserveAddress: Address;

  /**
   * An elevation group ID that the obligation should end up with after the collateral swap - it will be requested by
   * this operation (if different from the obligation's current elevation group).
   */
  newElevationGroup: number;

  /**
   * Which token to use for the flash loan. Defaults to `targetColl` (preserves pre-existing behavior).
   */
  flashBorrowToken?: SwapCollFlashBorrowToken;

  /**
   * The address of the debt reserve. Required when `flashBorrowToken === 'debt'`.
   */
  debtReserveAddress?: Address;

  // Note: the undocumented inputs below all have their most usual meaning used across the SDK.

  market: KaminoMarket;
  owner: TransactionSigner;
  obligation: KaminoObligation;
  referrer: Option<Address>;
  currentSlot: Slot;
  budgetAndPriorityFeeIxs?: Instruction[];
  scopeRefreshIx: Instruction[];
  useV2Ixs: boolean;
  quoter: SwapQuoteProvider<QuoteResponse>;
  swapper: SwapIxsProvider<QuoteResponse>;
  logger?: (msg: string, ...extra: unknown[]) => void;
}

/**
 * Outputs from the `getSwapCollIxs()` operation.
 */
export interface SwapCollIxsOutputs<QuoteResponse> {
  /**
   * Instructions for on-chain execution.
   */
  ixs: Instruction[];

  /**
   * Required LUTs.
   */
  lookupTables: Account<AddressLookupTable>[];

  /**
   * Whether the swap is using V2 instructions.
   */
  useV2Ixs: boolean;

  /**
   * Informational-only details of the token amounts/fees/rates that were used during construction of `ixs`.
   */
  simulationDetails: {
    /**
     * Details related to the flash-loan operation needed during collateral swap.
     */
    flashLoan: {
      /**
       * The mint of the flash-borrowed token.
       */
      flashBorrowReserveMint: Address;
      /**
       * The amount flash-borrowed (in token units).
       */
      flashBorrowedAmount: Decimal;
      /**
       * The amount flash-repaid (in token units). Equal to `flashBorrowedAmount` + flash-loan fee.
       */
      flashRepaidAmount: Decimal;
    };

    /**
     * Details related to the external DEX's swap operation (i.e. `swapper` input) needed during collateral swap.
     */
    externalSwap: {
      /**
       * The mint of the token swapped-in to an external DEX (source collateral).
       */
      swapInMint: Address;
      /**
       * The mint of the token swapped-out from an external DEX (target collateral).
       */
      swapOutMint: Address;
      /**
       * The amount swapped-in to an external DEX. Echoes the `sourceCollSwapAmount` input.
       */
      swapInAmount: Decimal;
      /**
       * The amount swapped-out from an external DEX (subject to on-chain slippage).
       */
      swapOutAmount: Decimal;
      /**
       * The verbatim response coming from the input `quoter`.
       */
      quoteResponse?: QuoteResponse;
    };
  };
}

/**
 * Constructs instructions needed to partially/fully swap the given source collateral for some other collateral type.
 *
 * Three flash-borrow flavors are supported via `inputs.flashBorrowToken`:
 *   - `targetColl` (default) uses a target-coll flash loan
 *   - `sourceColl` uses a source-coll flash loan
 *   - `debt` uses a debt-token flash loan (requires `inputs.debtReserveAddress`)
 */
export async function getSwapCollIxs<QuoteResponse>(
  inputs: SwapCollIxsInputs<QuoteResponse>
): Promise<Array<SwapCollIxsOutputs<QuoteResponse>>> {
  const flashBorrowToken = inputs.flashBorrowToken ?? 'targetColl';
  if (flashBorrowToken === 'targetColl') {
    return getSwapCollViaTargetColl(inputs);
  }
  if (flashBorrowToken === 'sourceColl') {
    return getSwapCollViaSourceColl(inputs);
  }
  return getSwapCollViaDebt(inputs);
}

// ===========================================================================================================
// Flow A: flash borrow the TARGET COLLATERAL (original implementation)
// ===========================================================================================================

async function getSwapCollViaTargetColl<QuoteResponse>(
  inputs: SwapCollIxsInputs<QuoteResponse>
): Promise<Array<SwapCollIxsOutputs<QuoteResponse>>> {
  const [args, context] = extractArgsAndContext(inputs);

  // Conceptually, we need to construct the following ixs:
  //  0. any set-up, like budgeting and ATAs
  //  1. `flash-borrowed target coll = targetCollReserve.flashBorrow()`
  //  2. `targetCollReserve.deposit(flash-borrowed target coll)`
  //  3. `sourceCollReserve.withdraw(requested amount to be coll-swapped)`
  //  4. `externally-swapped target coll = externalDex.swap(withdrawn current coll)`
  //  5. `flashRepay(externally-swapped target coll)`
  // However, there is a cyclic dependency:
  //  - To construct 4. (specifically, to query the external swap quote), we need to know all accounts used by Kamino's
  //    own ixs.
  //  - To construct 1. (i.e. flash-borrow), we need to know the target collateral swap-out from 4.

  // Construct the Klend's own ixs with a fake swap-out (only to learn the klend accounts used):
  const fakeKlendIxs = await getTargetCollKlendIxs(args, FAKE_TARGET_COLL_SWAP_OUT_AMOUNT, context);
  const klendAccounts = uniqueAccountsWithProgramIds(listTargetCollIxs(fakeKlendIxs));

  // Construct the external swap ixs (and learn the actual swap-out amount):
  const externalSwapIxsArray = await getExternalCollSwapIxs(args, klendAccounts, context);

  return Promise.all(
    externalSwapIxsArray.map(async (externalSwapIxs) => {
      context.logger(
        `Expected to swap ${args.sourceCollSwapAmount} ${context.sourceCollReserve.symbol} collateral into ${externalSwapIxs.swapOutAmount} ${context.targetCollReserve.symbol} collateral`
      );
      checkResultingObligationValid(args, externalSwapIxs.swapOutAmount, context);

      const klendIxs = await getTargetCollKlendIxs(args, externalSwapIxs.swapOutAmount, context);

      return {
        ixs: listTargetCollIxs(klendIxs, externalSwapIxs.ixs),
        lookupTables: externalSwapIxs.luts,
        useV2Ixs: context.useV2Ixs,
        simulationDetails: {
          flashLoan: {
            flashBorrowReserveMint: context.targetCollReserve.getLiquidityMint(),
            flashBorrowedAmount: klendIxs.simulationDetails.targetCollFlashBorrowedAmount,
            flashRepaidAmount: externalSwapIxs.swapOutAmount,
          },
          externalSwap: {
            swapInMint: context.sourceCollReserve.getLiquidityMint(),
            swapOutMint: context.targetCollReserve.getLiquidityMint(),
            swapInAmount: args.sourceCollSwapAmount,
            swapOutAmount: externalSwapIxs.swapOutAmount,
            quoteResponse: externalSwapIxs.simulationDetails.quoteResponse,
          },
        },
      };
    })
  );
}

// ===========================================================================================================
// Flow B: flash borrow the SOURCE COLLATERAL
// ===========================================================================================================

async function getSwapCollViaSourceColl<QuoteResponse>(
  inputs: SwapCollIxsInputs<QuoteResponse>
): Promise<Array<SwapCollIxsOutputs<QuoteResponse>>> {
  const [args, context] = extractArgsAndContext(inputs);
  const sourceCollFlashRepaidLamports = args.sourceCollSwapAmount
    .mul(context.sourceCollReserve.getMintFactor())
    .floor();
  const sourceCollFlashBorrowedLamports = calculateSourceCollFlashBorrowedLamports(
    sourceCollFlashRepaidLamports,
    context
  );
  const sourceCollFlashBorrowedAmount = sourceCollFlashBorrowedLamports.div(context.sourceCollReserve.getMintFactor());
  const sourceCollFlashRepaidAmount = sourceCollFlashRepaidLamports.div(context.sourceCollReserve.getMintFactor());

  const fakeKlendIxs = await getSourceCollKlendIxs(
    args,
    FAKE_TARGET_COLL_SWAP_OUT_AMOUNT,
    sourceCollFlashBorrowedLamports,
    context
  );
  const klendAccounts = uniqueAccountsWithProgramIds(listSourceCollIxs(fakeKlendIxs));
  const externalSwapIxsArray = await getExternalCollSwapIxs(
    args,
    klendAccounts,
    context,
    sourceCollFlashBorrowedAmount
  );

  return Promise.all(
    externalSwapIxsArray.map(async (externalSwapIxs) => {
      context.logger(
        `[source-coll] Expected to swap ${sourceCollFlashBorrowedAmount} ${context.sourceCollReserve.symbol} into ${externalSwapIxs.swapOutAmount} ${context.targetCollReserve.symbol}; flash-repaying ${sourceCollFlashRepaidAmount} ${context.sourceCollReserve.symbol}`
      );
      checkResultingObligationValid(args, externalSwapIxs.swapOutAmount, context);

      const klendIxs = await getSourceCollKlendIxs(
        args,
        externalSwapIxs.swapOutAmount,
        sourceCollFlashBorrowedLamports,
        context
      );

      return {
        ixs: listSourceCollIxs(klendIxs, externalSwapIxs.ixs),
        lookupTables: externalSwapIxs.luts,
        useV2Ixs: context.useV2Ixs,
        simulationDetails: {
          flashLoan: {
            flashBorrowReserveMint: context.sourceCollReserve.getLiquidityMint(),
            flashBorrowedAmount: sourceCollFlashBorrowedAmount,
            flashRepaidAmount: sourceCollFlashRepaidAmount,
          },
          externalSwap: {
            swapInMint: context.sourceCollReserve.getLiquidityMint(),
            swapOutMint: context.targetCollReserve.getLiquidityMint(),
            swapInAmount: sourceCollFlashBorrowedAmount,
            swapOutAmount: externalSwapIxs.swapOutAmount,
            quoteResponse: externalSwapIxs.simulationDetails.quoteResponse,
          },
        },
      };
    })
  );
}

function calculateSourceCollFlashBorrowedLamports(
  sourceCollFlashRepaidLamports: Decimal,
  context: SwapCollContext<any>
): Decimal {
  const { protocolFees, referrerFees } = context.sourceCollReserve.calculateFees(
    sourceCollFlashRepaidLamports,
    context.sourceCollReserve.getFlashLoanFee(),
    FeeCalculation.Inclusive,
    context.market.state.referralFeeBps,
    isSome(context.referrer)
  );
  return sourceCollFlashRepaidLamports.sub(protocolFees).sub(referrerFees).floor();
}

// ===========================================================================================================
// Flow C: flash borrow the DEBT TOKEN
// ===========================================================================================================

async function getSwapCollViaDebt<QuoteResponse>(
  inputs: SwapCollIxsInputs<QuoteResponse>
): Promise<Array<SwapCollIxsOutputs<QuoteResponse>>> {
  if (!inputs.debtReserveAddress) {
    throw new Error(`debtReserveAddress is required when flashBorrowToken === 'debt'`);
  }
  const [args, context] = extractArgsAndContext(inputs);
  const debtReserve = inputs.market.getExistingReserveByAddress(inputs.debtReserveAddress, 'Debt');

  const debtObligationLiquidity = context.obligation.state.borrows.find((b) => b.borrowReserve === debtReserve.address);
  if (!debtObligationLiquidity) {
    throw new Error(
      `Obligation ${context.obligation.obligationAddress} has no borrow in debt reserve ${debtReserve.address} - cannot flash-borrow via debt`
    );
  }

  // Flash-borrow amount: we want to repay most (not all) of the debt, so that the borrow reserve stays in the
  // obligation's borrow list and subsequent refresh ixs don't have a mismatched account count. We subtract 1 lamport
  // from the current (token-unit) outstanding balance converted to lamports. The on-chain repay is capped at
  // `min(passed_amount, outstanding_with_interest)`, so passing slightly under the outstanding keeps dust alive.
  const outstandingDebtTokens = context.obligation.getBorrowAmountByReserve(debtReserve);
  const outstandingDebtLamports = outstandingDebtTokens.mul(debtReserve.getMintFactor()).ceil();
  const flashBorrowDebtLamports = Decimal.max(outstandingDebtLamports.sub(1), new Decimal(1));
  const { flashRepayDebtLamports } = calculateViaDebtFlashLoanAmounts(flashBorrowDebtLamports, debtReserve, context);
  const debtIncreaseLamports = calculateDebtIncreaseWithBorrowFeesLamports(
    flashBorrowDebtLamports,
    flashRepayDebtLamports,
    debtReserve,
    context
  );

  // Build fake klend ixs to learn accounts for quoting.
  const fakeKlendIxs = await getViaDebtKlendIxs(
    args,
    FAKE_TARGET_COLL_SWAP_OUT_AMOUNT,
    flashBorrowDebtLamports,
    context,
    debtReserve
  );
  const klendAccounts = uniqueAccountsWithProgramIds(listViaDebtIxs(fakeKlendIxs));

  // Quote the external swap (same direction as Flow A: source coll → target coll).
  const externalSwapIxsArray = await getExternalCollSwapIxs(args, klendAccounts, context);

  return Promise.all(
    externalSwapIxsArray.map(async (externalSwapIxs) => {
      context.logger(
        `[via-debt] Expected to swap ${args.sourceCollSwapAmount} ${context.sourceCollReserve.symbol} into ${
          externalSwapIxs.swapOutAmount
        } ${context.targetCollReserve.symbol}; flash-borrowing ${flashBorrowDebtLamports.div(
          debtReserve.getMintFactor()
        )} ${debtReserve.symbol}`
      );
      checkResultingObligationValid(args, externalSwapIxs.swapOutAmount, context, {
        debtReserve,
        debtIncreaseLamports,
      });
      checkDebtReserveBorrowHeadroom(debtIncreaseLamports, debtReserve);

      const klendIxs = await getViaDebtKlendIxs(
        args,
        externalSwapIxs.swapOutAmount,
        flashBorrowDebtLamports,
        context,
        debtReserve
      );

      return {
        ixs: listViaDebtIxs(klendIxs, externalSwapIxs.ixs),
        lookupTables: externalSwapIxs.luts,
        useV2Ixs: context.useV2Ixs,
        simulationDetails: {
          flashLoan: {
            flashBorrowReserveMint: debtReserve.getLiquidityMint(),
            flashBorrowedAmount: flashBorrowDebtLamports.div(debtReserve.getMintFactor()),
            flashRepaidAmount: klendIxs.simulationDetails.debtFlashRepaidAmount,
          },
          externalSwap: {
            swapInMint: context.sourceCollReserve.getLiquidityMint(),
            swapOutMint: context.targetCollReserve.getLiquidityMint(),
            swapInAmount: args.sourceCollSwapAmount,
            swapOutAmount: externalSwapIxs.swapOutAmount,
            quoteResponse: externalSwapIxs.simulationDetails.quoteResponse,
          },
        },
      };
    })
  );
}

function checkDebtReserveBorrowHeadroom(debtIncreaseLamports: Decimal, debtReserve: KaminoReserve) {
  // The re-borrow we will do after the repay to restore the obligation's debt position cannot exceed the reserve's
  // remaining borrow headroom. The repay happens before the borrow, so the net reserve debt growth is only the
  // flash-loan fee plus any origination fees, not the full flash-borrowed amount.
  const borrowLimitLamports = new Decimal(debtReserve.state.config.borrowLimit.toString());
  if (borrowLimitLamports.isZero()) {
    return;
  }
  const currentBorrowedLamports = debtReserve.getBorrowedAmount();
  const headroomLamports = borrowLimitLamports.sub(currentBorrowedLamports);
  if (debtIncreaseLamports.gt(headroomLamports)) {
    throw new Error(
      `Debt reserve ${debtReserve.address} does not have enough borrow headroom (${headroomLamports} lamports) for the via-debt swap-collateral flow (needs ${debtIncreaseLamports}); consider using flashBorrowToken='targetColl' instead`
    );
  }
}

function calculateViaDebtFlashLoanAmounts(
  flashBorrowDebtLamports: Decimal,
  debtReserve: KaminoReserve,
  context: SwapCollContext<any>
): {
  flashLoanFeeLamports: Decimal;
  flashRepayDebtLamports: Decimal;
} {
  const { protocolFees, referrerFees } = debtReserve.calculateFees(
    flashBorrowDebtLamports,
    debtReserve.getFlashLoanFee(),
    FeeCalculation.Exclusive,
    context.market.state.referralFeeBps,
    isSome(context.referrer)
  );
  const flashLoanFeeLamports = protocolFees.add(referrerFees).ceil();
  return {
    flashLoanFeeLamports,
    flashRepayDebtLamports: flashBorrowDebtLamports.add(flashLoanFeeLamports),
  };
}

function calculateDebtIncreaseWithBorrowFeesLamports(
  flashBorrowDebtLamports: Decimal,
  flashRepayDebtLamports: Decimal,
  debtReserve: KaminoReserve,
  context: SwapCollContext<any>
): Decimal {
  return KaminoObligation.getDebtWithFeesForBorrowAmount(
    flashRepayDebtLamports,
    context.market,
    debtReserve,
    isSome(context.referrer)
  )
    .sub(flashBorrowDebtLamports)
    .ceil();
}

function tokenAmountToLamportsFloorString(tokenAmount: Decimal, reserve: KaminoReserve): string {
  return tokenAmount.mul(reserve.getMintFactor()).toDecimalPlaces(0, Decimal.ROUND_FLOOR).toFixed(0);
}

// ===========================================================================================================
// Shared args/context
// ===========================================================================================================

type SwapCollArgs = {
  sourceCollSwapAmount: Decimal;
  isClosingSourceColl: boolean;
  newElevationGroup: ElevationGroupDescription | null;
};

type SwapCollContext<QuoteResponse> = {
  budgetAndPriorityFeeIxs: Instruction[];
  market: KaminoMarket;
  sourceCollReserve: KaminoReserve;
  targetCollReserve: KaminoReserve;
  owner: TransactionSigner;
  obligation: KaminoObligation;
  quoter: SwapQuoteProvider<QuoteResponse>;
  swapper: SwapIxsProvider<QuoteResponse>;
  referrer: Option<Address>;
  currentSlot: Slot;
  useV2Ixs: boolean;
  scopeRefreshIx: Instruction[];
  logger: (msg: string, ...extra: unknown[]) => void;
};

function extractArgsAndContext<QuoteResponse>(
  inputs: SwapCollIxsInputs<QuoteResponse>
): [SwapCollArgs, SwapCollContext<QuoteResponse>] {
  if (inputs.sourceCollReserveAddress === inputs.targetCollReserveAddress) {
    throw new Error(`Cannot swap from/to the same collateral`);
  }
  if (inputs.sourceCollSwapAmount.lte(0)) {
    throw new Error(`Cannot swap a negative amount`);
  }
  const sourceCollReserve = inputs.market.getExistingReserveByAddress(
    inputs.sourceCollReserveAddress,
    'Current collateral'
  );
  const targetCollReserve = inputs.market.getExistingReserveByAddress(
    inputs.targetCollReserveAddress,
    'Target collateral'
  );
  return [
    {
      sourceCollSwapAmount: inputs.sourceCollSwapAmount,
      isClosingSourceColl: inputs.isClosingSourceColl,
      newElevationGroup: inputs.market.getExistingElevationGroup(inputs.newElevationGroup, 'Newly-requested'),
    },
    {
      budgetAndPriorityFeeIxs:
        inputs.budgetAndPriorityFeeIxs || getComputeBudgetAndPriorityFeeIxs(DEFAULT_MAX_COMPUTE_UNITS),
      sourceCollReserve,
      targetCollReserve,
      logger: inputs.logger ?? console.log,
      market: inputs.market,
      obligation: inputs.obligation,
      owner: inputs.owner,
      quoter: inputs.quoter,
      swapper: inputs.swapper,
      referrer: inputs.referrer,
      scopeRefreshIx: inputs.scopeRefreshIx,
      currentSlot: inputs.currentSlot,
      useV2Ixs: inputs.useV2Ixs,
    },
  ];
}

const FAKE_TARGET_COLL_SWAP_OUT_AMOUNT = new Decimal(1); // see the lengthy `getSwapCollIxs()` impl comment

// ===========================================================================================================
// Flow A helpers (target-coll flash borrow)
// ===========================================================================================================

type SwapCollKlendIxs = {
  setupIxs: Instruction[];
  targetCollFlashBorrowIx: Instruction;
  depositTargetCollIxs: Instruction[];
  withdrawSourceCollIxs: Instruction[];
  targetCollFlashRepayIx: Instruction;
  cleanupIxs: Instruction[];
  flashLoanInfo: FlashLoanInfo;
  simulationDetails: {
    targetCollFlashBorrowedAmount: Decimal;
  };
};

type SwapCollViaSourceKlendIxs = {
  setupIxs: Instruction[];
  sourceCollFlashBorrowIx: Instruction;
  depositTargetCollIxs: Instruction[];
  withdrawSourceCollIxs: Instruction[];
  sourceCollFlashRepayIx: Instruction;
  cleanupIxs: Instruction[];
  flashLoanInfo: FlashLoanInfo;
};

async function getTargetCollKlendIxs(
  args: SwapCollArgs,
  targetCollSwapOutAmount: Decimal,
  context: SwapCollContext<any>
): Promise<SwapCollKlendIxs> {
  const { ataCreationIxs, targetCollAta } = await getAtaCreationIxs(context);
  const setupIxs = [...ataCreationIxs];

  if (context.scopeRefreshIx?.length) {
    setupIxs.unshift(...context.scopeRefreshIx);
  }

  const targetCollFlashBorrowedAmount = calculateTargetCollFlashBorrowedAmount(targetCollSwapOutAmount, context);
  const { targetCollFlashBorrowIx, targetCollFlashRepayIx } = await getFlashLoanIxs(
    context.targetCollReserve,
    targetCollFlashBorrowedAmount.mul(context.targetCollReserve.getMintFactor()),
    setupIxs.length,
    targetCollAta,
    context
  );

  const depositTargetCollIxs = await getDepositTargetCollIxs(targetCollFlashBorrowedAmount, context);
  const withdrawSourceCollIxs = await getWithdrawSourceCollIxs(
    args,
    depositTargetCollIxs.removesElevationGroup,
    context
  );

  const cleanupIxs = [...(await getAtaCloseIxs(context)), ...context.budgetAndPriorityFeeIxs];

  return {
    setupIxs,
    flashLoanInfo: {
      flashBorrowReserve: context.targetCollReserve.address,
      flashLoanFee: context.targetCollReserve.getFlashLoanFee(),
    },
    targetCollFlashBorrowIx,
    depositTargetCollIxs: depositTargetCollIxs.ixs,
    withdrawSourceCollIxs,
    targetCollFlashRepayIx,
    cleanupIxs,
    simulationDetails: {
      targetCollFlashBorrowedAmount,
    },
  };
}

function calculateTargetCollFlashBorrowedAmount(
  targetCollFlashRepaidAmount: Decimal,
  context: SwapCollContext<any>
): Decimal {
  const { protocolFees, referrerFees } = context.targetCollReserve.calculateFees(
    targetCollFlashRepaidAmount.mul(context.targetCollReserve.getMintFactor()),
    context.targetCollReserve.getFlashLoanFee(),
    FeeCalculation.Inclusive,
    context.market.state.referralFeeBps,
    isSome(context.referrer)
  );
  const targetCollFlashLoanFee = protocolFees.add(referrerFees).div(context.targetCollReserve.getMintFactor());
  return targetCollFlashRepaidAmount.sub(targetCollFlashLoanFee);
}

function listTargetCollIxs(klendIxs: SwapCollKlendIxs, externalSwapIxs?: Instruction[]): Instruction[] {
  return [
    ...klendIxs.setupIxs,
    klendIxs.targetCollFlashBorrowIx,
    ...klendIxs.depositTargetCollIxs,
    ...klendIxs.withdrawSourceCollIxs,
    ...(externalSwapIxs || []),
    klendIxs.targetCollFlashRepayIx,
    ...klendIxs.cleanupIxs,
  ];
}

async function getSourceCollKlendIxs(
  args: SwapCollArgs,
  targetCollSwapOutAmount: Decimal,
  sourceCollFlashBorrowedLamports: Decimal,
  context: SwapCollContext<any>
): Promise<SwapCollViaSourceKlendIxs> {
  const { ataCreationIxs, sourceCollAta } = await getAtaCreationIxs(context);
  const setupIxs = [...ataCreationIxs];

  if (context.scopeRefreshIx?.length) {
    setupIxs.unshift(...context.scopeRefreshIx);
  }

  const { targetCollFlashBorrowIx: sourceCollFlashBorrowIx, targetCollFlashRepayIx: sourceCollFlashRepayIx } =
    await getFlashLoanIxs(
      context.sourceCollReserve,
      sourceCollFlashBorrowedLamports,
      setupIxs.length,
      sourceCollAta,
      context
    );

  const depositTargetCollIxs = await getDepositTargetCollIxs(targetCollSwapOutAmount, context);
  const withdrawSourceCollIxs = await getWithdrawSourceCollIxs(
    args,
    depositTargetCollIxs.removesElevationGroup,
    context
  );

  const cleanupIxs = [...(await getAtaCloseIxs(context)), ...context.budgetAndPriorityFeeIxs];

  return {
    setupIxs,
    sourceCollFlashBorrowIx,
    depositTargetCollIxs: depositTargetCollIxs.ixs,
    withdrawSourceCollIxs,
    sourceCollFlashRepayIx,
    cleanupIxs,
    flashLoanInfo: {
      flashBorrowReserve: context.sourceCollReserve.address,
      flashLoanFee: context.sourceCollReserve.getFlashLoanFee(),
    },
  };
}

function listSourceCollIxs(klendIxs: SwapCollViaSourceKlendIxs, externalSwapIxs?: Instruction[]): Instruction[] {
  return [
    ...klendIxs.setupIxs,
    klendIxs.sourceCollFlashBorrowIx,
    ...(externalSwapIxs || []),
    ...klendIxs.depositTargetCollIxs,
    ...klendIxs.withdrawSourceCollIxs,
    klendIxs.sourceCollFlashRepayIx,
    ...klendIxs.cleanupIxs,
  ];
}

// ===========================================================================================================
// Flow B helpers (debt-token flash borrow)
// ===========================================================================================================

type SwapCollViaDebtKlendIxs = {
  setupIxs: Instruction[];
  debtFlashBorrowIx: Instruction;
  repayDebtIxs: Instruction[];
  withdrawSourceCollIxs: Instruction[];
  depositTargetCollIxs: Instruction[];
  borrowDebtIxs: Instruction[];
  debtFlashRepayIx: Instruction;
  cleanupIxs: Instruction[];
  flashLoanInfo: FlashLoanInfo;
  simulationDetails: {
    debtFlashRepaidAmount: Decimal;
  };
};

async function getViaDebtKlendIxs(
  args: SwapCollArgs,
  targetCollSwapOutAmount: Decimal,
  flashBorrowDebtLamports: Decimal,
  context: SwapCollContext<any>,
  debtReserve: KaminoReserve
): Promise<SwapCollViaDebtKlendIxs> {
  // Setup: ATAs for sourceColl, targetColl, debt (3 tokens).
  const { ataCreationIxs, debtAta } = await getAtaCreationIxs(context, debtReserve);
  const setupIxs = [...ataCreationIxs];
  if (context.scopeRefreshIx?.length) {
    setupIxs.unshift(...context.scopeRefreshIx);
  }

  // Flash-loan ixs. Repay amount = borrow + fee (exclusive).
  const { flashRepayDebtLamports } = calculateViaDebtFlashLoanAmounts(flashBorrowDebtLamports, debtReserve, context);

  const { flashBorrowIx: debtFlashBorrowIx, flashRepayIx: debtFlashRepayIx } = getFlashLoanInstructions({
    borrowIxIndex: setupIxs.length,
    userTransferAuthority: context.owner,
    lendingMarketAuthority: await context.market.getLendingMarketAuthority(),
    lendingMarketAddress: context.market.getAddress(),
    reserve: debtReserve,
    amountLamports: flashBorrowDebtLamports,
    destinationAta: debtAta!,
    referrerAccount: none(),
    referrerTokenState: none(),
    programId: context.market.programId,
  });

  // 1. Repay debt using the flash-borrowed tokens (frees LTV headroom).
  const repayAction = await KaminoAction.buildRepayTxns({
    kaminoMarket: context.market,
    amount: flashBorrowDebtLamports.toFixed(0),
    reserveAddress: debtReserve.address,
    owner: context.owner,
    obligation: context.obligation,
    useV2Ixs: context.useV2Ixs,
    scopeRefreshConfig: undefined,
    currentSlot: context.currentSlot,
    payer: context.owner,
    extraComputeBudget: 0,
    includeAtaIxs: false,
    requestElevationGroup: false,
    initUserMetadata: { skipInitialization: true, skipLutCreation: true },
    referrer: context.referrer,
  });
  const repayDebtIxs = removeBudgetIxs(KaminoAction.actionToIxs(repayAction));

  // 2. Withdraw source coll. The target coll is not deposited until after the external swap, so it must not be
  // included in this withdraw's refresh_obligation account list. Debt was repaid in step 1, so the withdraw does not
  // need pending target collateral for borrow headroom.
  const needsTargetCollRefresh = !context.obligation.deposits.has(context.targetCollReserve.address);
  const withdrawAction = await KaminoAction.buildWithdrawTxns({
    kaminoMarket: context.market,
    amount: args.isClosingSourceColl
      ? U64_MAX
      : tokenAmountToLamportsFloorString(args.sourceCollSwapAmount, context.sourceCollReserve),
    reserveAddress: context.sourceCollReserve.address,
    owner: context.owner,
    obligation: context.obligation,
    useV2Ixs: context.useV2Ixs,
    scopeRefreshConfig: undefined,
    extraComputeBudget: 0,
    includeAtaIxs: false,
    requestElevationGroup: false,
    initUserMetadata: { skipInitialization: true, skipLutCreation: true },
    referrer: context.referrer,
    currentSlot: context.currentSlot,
    overrideElevationGroupRequest: undefined,
  });
  const withdrawSourceCollIxs = removeBudgetIxs(KaminoAction.actionToIxs(withdrawAction));

  // 3. Deposit target coll (received from external swap between withdraw and deposit).
  const finalElevationGroupId = args.newElevationGroup?.elevationGroup ?? 0;
  const targetCompatibleWithCurrentElevationGroup =
    context.obligation.state.elevationGroup === 0 ||
    context.targetCollReserve.state.config.elevationGroups.includes(context.obligation.state.elevationGroup);
  const requestsElevationGroupBeforeDeposit =
    finalElevationGroupId !== context.obligation.state.elevationGroup && !targetCompatibleWithCurrentElevationGroup;
  const depositAction = await KaminoAction.buildDepositTxns({
    kaminoMarket: context.market,
    amount: tokenAmountToLamportsFloorString(targetCollSwapOutAmount, context.targetCollReserve),
    reserveAddress: context.targetCollReserve.address,
    owner: context.owner,
    obligation: context.obligation,
    useV2Ixs: context.useV2Ixs,
    scopeRefreshConfig: undefined,
    extraComputeBudget: 0,
    includeAtaIxs: false,
    requestElevationGroup: requestsElevationGroupBeforeDeposit,
    initUserMetadata: { skipInitialization: true, skipLutCreation: true },
    referrer: context.referrer,
    currentSlot: context.currentSlot,
    overrideElevationGroupRequest: requestsElevationGroupBeforeDeposit ? finalElevationGroupId : undefined,
    obligationCustomizations: args.isClosingSourceColl
      ? { removedDepositReserves: [context.sourceCollReserve.address] }
      : undefined,
  });
  const depositTargetCollIxs = removeBudgetIxs(KaminoAction.actionToIxs(depositAction));

  // 4. Borrow debt back (amount = flash repay total, so we fully repay the flash loan from borrowed tokens).
  // Decide elevation group change for this final step.
  const requestsElevationGroupChange =
    finalElevationGroupId !== context.obligation.state.elevationGroup && !requestsElevationGroupBeforeDeposit;
  const borrowAction = await KaminoAction.buildBorrowTxns({
    kaminoMarket: context.market,
    amount: flashRepayDebtLamports.toFixed(0),
    reserveAddress: debtReserve.address,
    owner: context.owner,
    obligation: context.obligation,
    useV2Ixs: context.useV2Ixs,
    scopeRefreshConfig: undefined,
    extraComputeBudget: 0,
    includeAtaIxs: false,
    requestElevationGroup: requestsElevationGroupChange,
    initUserMetadata: { skipInitialization: true, skipLutCreation: true },
    referrer: context.referrer,
    currentSlot: context.currentSlot,
    overrideElevationGroupRequest: requestsElevationGroupChange ? finalElevationGroupId : undefined,
    obligationCustomizations: {
      // At the time the borrow ix runs on-chain, the obligation already has the target coll deposited; the borrow's
      // internal `refresh_obligation` ix must include that reserve in its account list.
      addedDepositReserves: needsTargetCollRefresh ? [context.targetCollReserve.address] : [],
      // If the source coll was fully withdrawn in the prior ix, it is no longer in the obligation's deposit list.
      removedDepositReserves: args.isClosingSourceColl ? [context.sourceCollReserve.address] : [],
    },
  });
  const borrowDebtIxs = removeBudgetIxs(KaminoAction.actionToIxs(borrowAction));

  const cleanupIxs = [...(await getAtaCloseIxs(context, debtReserve)), ...context.budgetAndPriorityFeeIxs];

  return {
    setupIxs,
    debtFlashBorrowIx,
    repayDebtIxs,
    withdrawSourceCollIxs,
    depositTargetCollIxs,
    borrowDebtIxs,
    debtFlashRepayIx,
    cleanupIxs,
    flashLoanInfo: {
      flashBorrowReserve: debtReserve.address,
      flashLoanFee: debtReserve.getFlashLoanFee(),
    },
    simulationDetails: {
      debtFlashRepaidAmount: flashRepayDebtLamports.div(debtReserve.getMintFactor()),
    },
  };
}

function listViaDebtIxs(klendIxs: SwapCollViaDebtKlendIxs, externalSwapIxs?: Instruction[]): Instruction[] {
  return [
    ...klendIxs.setupIxs,
    klendIxs.debtFlashBorrowIx,
    ...klendIxs.repayDebtIxs,
    ...klendIxs.withdrawSourceCollIxs,
    ...(externalSwapIxs || []),
    ...klendIxs.depositTargetCollIxs,
    ...klendIxs.borrowDebtIxs,
    klendIxs.debtFlashRepayIx,
    ...klendIxs.cleanupIxs,
  ];
}

// ===========================================================================================================
// Shared ATA / flash-loan / deposit / withdraw helpers
// ===========================================================================================================

async function getAtaCreationIxs(context: SwapCollContext<any>, debtReserve?: KaminoReserve) {
  const atasAndAtaCreationIxs = await createAtasIdempotent(context.owner, [
    {
      mint: context.sourceCollReserve.getLiquidityMint(),
      tokenProgram: context.sourceCollReserve.getLiquidityTokenProgram(),
    },
    {
      mint: context.targetCollReserve.getLiquidityMint(),
      tokenProgram: context.targetCollReserve.getLiquidityTokenProgram(),
    },
    ...(debtReserve
      ? [
          {
            mint: debtReserve.getLiquidityMint(),
            tokenProgram: debtReserve.getLiquidityTokenProgram(),
          },
        ]
      : []),
  ]);
  return {
    ataCreationIxs: atasAndAtaCreationIxs.map((tuple) => tuple.createAtaIx),
    sourceCollAta: atasAndAtaCreationIxs[0].ata,
    targetCollAta: atasAndAtaCreationIxs[1].ata,
    debtAta: atasAndAtaCreationIxs[2]?.ata,
  };
}

async function getAtaCloseIxs(context: SwapCollContext<any>, debtReserve?: KaminoReserve) {
  const ataCloseIxs: Instruction[] = [];
  const anyIsWsol =
    context.sourceCollReserve.getLiquidityMint() === WRAPPED_SOL_MINT ||
    context.targetCollReserve.getLiquidityMint() === WRAPPED_SOL_MINT ||
    debtReserve?.getLiquidityMint() === WRAPPED_SOL_MINT;
  if (anyIsWsol) {
    const owner = context.owner;
    const wsolAta = await getAssociatedTokenAddress(WRAPPED_SOL_MINT, owner.address);
    ataCloseIxs.push(
      getCloseAccountInstruction(
        { account: wsolAta, owner, destination: owner.address },
        { programAddress: TOKEN_PROGRAM_ADDRESS }
      )
    );
  }
  return ataCloseIxs;
}

async function getFlashLoanIxs(
  reserve: KaminoReserve,
  amountLamports: Decimal,
  flashBorrowIxIndex: number,
  destinationAta: Address,
  context: SwapCollContext<any>
) {
  const { flashBorrowIx, flashRepayIx } = getFlashLoanInstructions({
    borrowIxIndex: flashBorrowIxIndex,
    userTransferAuthority: context.owner,
    lendingMarketAuthority: await context.market.getLendingMarketAuthority(),
    lendingMarketAddress: context.market.getAddress(),
    reserve,
    amountLamports,
    destinationAta,
    referrerAccount: none(),
    referrerTokenState: none(),
    programId: context.market.programId,
  });
  return { targetCollFlashBorrowIx: flashBorrowIx, targetCollFlashRepayIx: flashRepayIx };
}

type DepositTargetCollIxs = {
  removesElevationGroup: boolean;
  ixs: Instruction[];
};

async function getDepositTargetCollIxs(
  targetCollAmount: Decimal,
  context: SwapCollContext<any>
): Promise<DepositTargetCollIxs> {
  const removesElevationGroup = mustRemoveElevationGroupBeforeDeposit(context);
  const depositCollAction = await KaminoAction.buildDepositTxns({
    kaminoMarket: context.market,
    amount: tokenAmountToLamportsFloorString(targetCollAmount, context.targetCollReserve),
    reserveAddress: context.targetCollReserve.address,
    owner: context.owner,
    obligation: context.obligation,
    useV2Ixs: context.useV2Ixs,
    scopeRefreshConfig: undefined,
    extraComputeBudget: 0,
    includeAtaIxs: false,
    requestElevationGroup: removesElevationGroup,
    initUserMetadata: { skipInitialization: true, skipLutCreation: true },
    referrer: context.referrer,
    currentSlot: context.currentSlot,
    overrideElevationGroupRequest: removesElevationGroup ? 0 : undefined,
  });
  return {
    ixs: KaminoAction.actionToIxs(depositCollAction),
    removesElevationGroup,
  };
}

function mustRemoveElevationGroupBeforeDeposit(context: SwapCollContext<any>): boolean {
  if (context.obligation.deposits.has(context.targetCollReserve.address)) {
    return false;
  }
  const currentElevationGroupId = context.obligation.state.elevationGroup;
  if (currentElevationGroupId == 0) {
    return false;
  }
  if (!context.targetCollReserve.state.config.elevationGroups.includes(currentElevationGroupId)) {
    return true;
  }
  const currentElevationGroup = context.market.getElevationGroup(currentElevationGroupId);
  if (context.obligation.deposits.size >= currentElevationGroup.maxReservesAsCollateral) {
    return true;
  }
  return false;
}

async function getWithdrawSourceCollIxs(
  args: SwapCollArgs,
  depositRemovedElevationGroup: boolean,
  context: SwapCollContext<any>
): Promise<Instruction[]> {
  const withdrawnSourceCollLamports = args.isClosingSourceColl
    ? U64_MAX
    : tokenAmountToLamportsFloorString(args.sourceCollSwapAmount, context.sourceCollReserve);
  const requestedElevationGroup = elevationGroupIdToRequestAfterWithdraw(args, depositRemovedElevationGroup, context);
  const withdrawCollAction = await KaminoAction.buildWithdrawTxns({
    kaminoMarket: context.market,
    amount: withdrawnSourceCollLamports,
    reserveAddress: context.sourceCollReserve.address,
    owner: context.owner,
    obligation: context.obligation,
    useV2Ixs: context.useV2Ixs,
    scopeRefreshConfig: undefined,
    extraComputeBudget: 0,
    includeAtaIxs: false,
    requestElevationGroup: requestedElevationGroup !== undefined,
    initUserMetadata: { skipInitialization: true, skipLutCreation: true },
    referrer: context.referrer,
    currentSlot: context.currentSlot,
    overrideElevationGroupRequest: requestedElevationGroup,
    obligationCustomizations: context.obligation.deposits.has(context.targetCollReserve.address)
      ? undefined
      : {
          addedDepositReserves: [context.targetCollReserve.address],
        },
  });
  return KaminoAction.actionToIxs(withdrawCollAction);
}

function elevationGroupIdToRequestAfterWithdraw(
  args: SwapCollArgs,
  depositRemovedElevationGroup: boolean,
  context: SwapCollContext<any>
): number | undefined {
  const obligationInitialElevationGroup = context.obligation.state.elevationGroup;
  const requestedElevationGroupId = args.newElevationGroup?.elevationGroup ?? 0;
  if (requestedElevationGroupId === 0) {
    if (obligationInitialElevationGroup === 0) {
      return undefined;
    }
    if (depositRemovedElevationGroup) {
      return undefined;
    }
    return 0;
  } else {
    if (depositRemovedElevationGroup) {
      return requestedElevationGroupId;
    }
    if (obligationInitialElevationGroup === requestedElevationGroupId) {
      return undefined;
    }
    return requestedElevationGroupId;
  }
}

type ExternalSwapIxs<QuoteResponse> = {
  swapOutAmount: Decimal;
  ixs: Instruction[];
  luts: Account<AddressLookupTable>[];
  simulationDetails: {
    quoteResponse?: QuoteResponse;
  };
};

async function getExternalCollSwapIxs<QuoteResponse>(
  args: SwapCollArgs,
  klendAccounts: Address[],
  context: SwapCollContext<QuoteResponse>,
  sourceCollSwapInputAmount: Decimal = args.sourceCollSwapAmount
): Promise<Array<ExternalSwapIxs<QuoteResponse>>> {
  const externalSwapInputs = {
    inputAmountLamports: sourceCollSwapInputAmount.mul(context.sourceCollReserve.getMintFactor()),
    inputMint: context.sourceCollReserve.getLiquidityMint(),
    outputMint: context.targetCollReserve.getLiquidityMint(),
  };
  const externalSwapQuote = await context.quoter(externalSwapInputs, klendAccounts);
  const externalSwapIxsAndLuts = await context.swapper(externalSwapInputs, klendAccounts, externalSwapQuote);

  return externalSwapIxsAndLuts.map((externalSwapIxsAndLuts) => {
    const swapOutAmount = externalSwapIxsAndLuts.quote.priceAInB.mul(sourceCollSwapInputAmount);
    return {
      swapOutAmount,
      ixs: [...externalSwapIxsAndLuts.preActionIxs, ...externalSwapIxsAndLuts.swapIxs],
      luts: externalSwapIxsAndLuts.lookupTables,
      simulationDetails: {
        quoteResponse: externalSwapIxsAndLuts.quote.quoteResponse,
      },
    };
  });
}

function checkResultingObligationValid(
  args: SwapCollArgs,
  targetCollAmount: Decimal,
  context: SwapCollContext<any>,
  viaDebt?: {
    debtReserve: KaminoReserve;
    debtIncreaseLamports: Decimal;
  }
): void {
  if (args.newElevationGroup !== null) {
    const debtReserveAddresses = [...context.obligation.borrows.keys()];
    if (debtReserveAddresses.length > 1) {
      throw new Error(
        `The obligation with ${debtReserveAddresses.length} debt reserves cannot request any elevation group`
      );
    }
    if (debtReserveAddresses.length == 1) {
      const debtReserveAddress = debtReserveAddresses[0];
      if (args.newElevationGroup.debtReserve !== debtReserveAddress) {
        throw new Error(
          `The obligation with debt reserve ${debtReserveAddress} cannot request elevation group ${args.newElevationGroup.elevationGroup}`
        );
      }
    }

    const collReserveAddresses = new Set<Address>([
      ...context.obligation.deposits.keys(),
      context.targetCollReserve.address,
    ]);
    if (args.isClosingSourceColl) {
      collReserveAddresses.delete(context.sourceCollReserve.address);
    }
    if (collReserveAddresses.size > args.newElevationGroup.maxReservesAsCollateral) {
      throw new Error(
        `The obligation with ${collReserveAddresses.size} collateral reserves cannot request elevation group ${args.newElevationGroup.elevationGroup}`
      );
    }
    for (const collReserveAddress of [...collReserveAddresses]) {
      if (!args.newElevationGroup.collateralReserves.has(collReserveAddress)) {
        throw new Error(
          `The obligation with collateral reserve ${collReserveAddress} cannot request elevation group ${args.newElevationGroup.elevationGroup}`
        );
      }
    }
  }

  const effectiveWithdrawAmount = args.isClosingSourceColl
    ? context.obligation.getDepositAmountByReserve(context.sourceCollReserve)
    : args.sourceCollSwapAmount;
  const resultingStats = context.obligation.getPostSwapCollObligationStats({
    withdrawAmountLamports: effectiveWithdrawAmount.mul(context.sourceCollReserve.getMintFactor()),
    withdrawReserveAddress: context.sourceCollReserve.address,
    depositAmountLamports: targetCollAmount.mul(context.targetCollReserve.getMintFactor()),
    depositReserveAddress: context.targetCollReserve.address,
    borrowAmountLamports: viaDebt?.debtIncreaseLamports,
    borrowReserveAddress: viaDebt?.debtReserve.address,
    market: context.market,
    newElevationGroup: args.newElevationGroup?.elevationGroup ?? 0,
    slot: context.currentSlot,
  });
  const maxLtv = resultingStats.borrowLimit.div(resultingStats.userTotalCollateralDeposit);
  if (resultingStats.loanToValue > maxLtv) {
    throw new Error(
      `Swapping collateral ${effectiveWithdrawAmount} ${context.sourceCollReserve.symbol} into ${targetCollAmount} ${context.targetCollReserve.symbol} would result in the obligation's LTV ${resultingStats.loanToValue} exceeding its max LTV ${maxLtv}`
    );
  }
}
