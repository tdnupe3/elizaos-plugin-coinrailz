import { KaminoAction, KaminoMarket, KaminoObligation, KaminoReserve } from '../classes';
// Import from specific sub-modules instead of the `../leverage` barrel so we don't pull in
// `flashBorrowType.ts` (which in turn imports back into `repay_with_collateral_calcs.ts` → here),
// which would form an import cycle and leave intent-helper exports undefined at evaluation time.
import { getFlashLoanInstructions } from '../leverage/instructions';
import {
  FlashBorrowType,
  FlashLoanInfo,
  LeverageIxsOutput,
  SwapInputs,
  SwapIxs,
  SwapIxsProvider,
  SwapQuote,
  SwapQuoteProvider,
} from '../leverage/types';
import {
  createAtasIdempotent,
  getComputeBudgetAndPriorityFeeIxs,
  removeBudgetIxs,
  U64_MAX,
  uniqueAccountsWithProgramIds,
} from '../utils';
import { AddressLookupTable } from '@solana-program/address-lookup-table';
import { Account, Address, Instruction, none, Option, Slot, TransactionSigner } from '@solana/kit';
import Decimal from 'decimal.js';
import {
  calcMaxWithdrawCollateral,
  calcRepayAmountWithSlippage,
  calcRepayWithCollCollFlashSwap,
  getMaxCollateralFromRepayAmount,
  getMaxWithdrawLtvCheck,
  MaxWithdrawLtvCheck,
  validateCollFlashWithdrawCap,
} from './repay_with_collateral_calcs';

export type RepayWithCollIxsResponse<QuoteResponse> = {
  ixs: Instruction[];
  lookupTables: Account<AddressLookupTable>[];
  flashLoanInfo: FlashLoanInfo;
  swapInputs: SwapInputs;
  initialInputs: RepayWithCollInitialInputs<QuoteResponse>;
  quote?: QuoteResponse;
};

interface RepayWithCollInitialInputsCommon<QuoteResponse> {
  /** Debt-token-denominated amount being repaid to the obligation. */
  debtRepayAmountLamports: Decimal;
  /**
   * Flash-loan repay amount in the lamports of the FLASH-BORROWED reserve.
   *  - debt-flash: debt lamports = `debtRepayAmountLamports` + flash fee.
   *  - coll-flash: coll lamports = `collSwapInLamports * (1 + collFlashLoanFee)`.
   * Use the `flashBorrowType` discriminant on the parent type to know which denomination.
   */
  flashRepayAmountLamports: Decimal;
  /**
   * The amount of collateral available to withdraw, if this is less than the swap input amount, then the swap may fail due to slippage, or tokens may be debited from the user's ATA, so the caller needs to check this
   */
  maxCollateralWithdrawLamports: Decimal;
  /**
   * The quote from the provided quoter
   */
  swapQuote: SwapQuote<QuoteResponse>;
  currentSlot: Slot;
  klendAccounts: Array<Address>;
}

export interface DebtFlashRepayWithCollInitialInputs<QuoteResponse>
  extends RepayWithCollInitialInputsCommon<QuoteResponse> {
  flashBorrowType: 'debt';
}

export interface CollFlashRepayWithCollInitialInputs<QuoteResponse>
  extends RepayWithCollInitialInputsCommon<QuoteResponse> {
  flashBorrowType: 'coll';
}

export type RepayWithCollInitialInputs<QuoteResponse> =
  | DebtFlashRepayWithCollInitialInputs<QuoteResponse>
  | CollFlashRepayWithCollInitialInputs<QuoteResponse>;

interface RepayWithCollSwapInputsProps<QuoteResponse> {
  kaminoMarket: KaminoMarket;
  debtReserveAddress: Address;
  collReserveAddress: Address;
  owner: TransactionSigner;
  obligation: KaminoObligation;
  referrer: Option<Address>;
  currentSlot: Slot;
  repayAmount: Decimal;
  isClosingPosition: boolean;
  budgetAndPriorityFeeIxs?: Instruction[];
  scopeRefreshIx: Instruction[]; // no longer optional, can be empty
  useV2Ixs: boolean;
  quoter: SwapQuoteProvider<QuoteResponse>;
  /**
   * Which side to flash borrow on:
   *  - `'debt'` (default): flash borrow debt → repay+withdraw → swap coll→debt → flash repay debt.
   *  - `'coll'`: flash borrow coll → swap coll→debt → repay+withdraw → flash repay coll.
   * Useful when the default reserve has flash loans disabled or insufficient liquidity.
   */
  flashBorrowType?: FlashBorrowType;
}

export async function getRepayWithCollSwapInputs<QuoteResponse>({
  collReserveAddress,
  currentSlot,
  debtReserveAddress,
  kaminoMarket,
  owner,
  obligation,
  quoter,
  referrer,
  repayAmount,
  isClosingPosition,
  budgetAndPriorityFeeIxs,
  scopeRefreshIx,
  useV2Ixs,
  flashBorrowType,
}: RepayWithCollSwapInputsProps<QuoteResponse>): Promise<{
  swapInputs: SwapInputs;
  flashLoanInfo: FlashLoanInfo;
  initialInputs: RepayWithCollInitialInputs<QuoteResponse>;
}> {
  const collReserve = kaminoMarket.getExistingReserveByAddress(collReserveAddress);
  const debtReserve = kaminoMarket.getExistingReserveByAddress(debtReserveAddress);
  const collTokenMint = collReserve.getLiquidityMint();
  const debtTokenMint = debtReserve.getLiquidityMint();

  const {
    repayAmountLamports,
    flashRepayAmountLamports,
    repayAmount: finalRepayAmount,
  } = calcRepayAmountWithSlippage(kaminoMarket, debtReserve, currentSlot, obligation, repayAmount, referrer);

  const debtPosition = obligation.getBorrowByReserve(debtReserve.address);
  const collPosition = obligation.getDepositByReserve(collReserve.address);
  if (!debtPosition) {
    throw new Error(
      `Debt position not found for ${debtReserve.stats.symbol} reserve ${debtReserve.address} in obligation ${obligation.obligationAddress}`
    );
  }
  if (!collPosition) {
    throw new Error(
      `Collateral position not found for ${collReserve.stats.symbol} reserve ${collReserve.address} in obligation ${obligation.obligationAddress}`
    );
  }
  const { maxWithdrawableCollLamports } = calcMaxWithdrawCollateral(
    kaminoMarket,
    obligation,
    collReserve.address,
    debtReserve.address,
    repayAmountLamports
  );

  const maxCollNeededFromOracle = getMaxCollateralFromRepayAmount(finalRepayAmount, debtReserve, collReserve);
  const inputAmountLamports = Decimal.min(maxWithdrawableCollLamports, maxCollNeededFromOracle);

  // Use the debt-flash builder for quote-time account discovery. The repay/withdraw account
  // footprint is shared between routes; the flash-loan-side accounts differ by `flashBorrowType`
  // and are layered in by the final route-specific builder in `getRepayWithCollIxs`.
  const klendIxs: LeverageIxsOutput = (
    await buildRepayWithCollateralIxsDebtFlash(
      kaminoMarket,
      debtReserve,
      collReserve,
      owner,
      obligation,
      referrer,
      currentSlot,
      budgetAndPriorityFeeIxs,
      scopeRefreshIx,
      [
        {
          preActionIxs: [],
          swapIxs: [],
          lookupTables: [],
          quote: {} as SwapQuote<QuoteResponse>,
        },
      ],
      isClosingPosition,
      repayAmountLamports,
      inputAmountLamports,
      useV2Ixs
    )
  )[0];
  const uniqueKlendAccounts = uniqueAccountsWithProgramIds(klendIxs.instructions);

  const swapQuoteInputs: SwapInputs = {
    inputAmountLamports,
    inputMint: collTokenMint,
    outputMint: debtTokenMint,
  };

  const swapQuote = await quoter(swapQuoteInputs, uniqueKlendAccounts);

  const swapQuotePxDebtToColl = swapQuote.priceAInB;

  if (flashBorrowType === 'coll') {
    // Coll-flash sizing: swap exactly the flash-borrowed coll → at least `repayAmountLamports` debt
    // after slippage; withdraw flashBorrow * (1 + collFlashFee) coll to repay the flash loan.
    const { collSwapInLamports, debtMinOutLamports, collWithdrawForFlashRepayLamports } =
      calcRepayWithCollCollFlashSwap({
        repayAmountLamports,
        swapPriceCollToDebt: swapQuotePxDebtToColl,
        slippagePct: new Decimal(0), // swap-side slippage handled by the swapper; quote already reflects realised price
        collFlashLoanFee: collReserve.getFlashLoanFee(),
        collMintFactor: collReserve.getMintFactor(),
        debtMintFactor: debtReserve.getMintFactor(),
      });
    return {
      swapInputs: {
        inputAmountLamports: collSwapInLamports,
        minOutAmountLamports: debtMinOutLamports,
        inputMint: collTokenMint,
        outputMint: debtTokenMint,
      },
      flashLoanInfo: {
        flashBorrowReserve: collReserve.address,
        flashLoanFee: collReserve.getFlashLoanFee(),
      },
      initialInputs: {
        flashBorrowType: 'coll',
        debtRepayAmountLamports: repayAmountLamports,
        flashRepayAmountLamports: collWithdrawForFlashRepayLamports,
        maxCollateralWithdrawLamports: maxWithdrawableCollLamports,
        swapQuote,
        currentSlot,
        klendAccounts: uniqueKlendAccounts,
      },
    };
  }

  // Debt-flash sizing (default): swap enough coll to produce flashRepayAmountLamports of debt.
  const collSwapInLamports = flashRepayAmountLamports
    .div(debtReserve.getMintFactor())
    .div(swapQuotePxDebtToColl)
    .mul(collReserve.getMintFactor())
    .ceil();

  return {
    swapInputs: {
      inputAmountLamports: collSwapInLamports,
      minOutAmountLamports: flashRepayAmountLamports,
      inputMint: collTokenMint,
      outputMint: debtTokenMint,
    },
    flashLoanInfo: klendIxs.flashLoanInfo,
    initialInputs: {
      flashBorrowType: 'debt',
      debtRepayAmountLamports: repayAmountLamports,
      flashRepayAmountLamports,
      maxCollateralWithdrawLamports: maxWithdrawableCollLamports,
      swapQuote,
      currentSlot,
      klendAccounts: uniqueKlendAccounts,
    },
  };
}

interface RepayWithCollIxsProps<QuoteResponse> extends RepayWithCollSwapInputsProps<QuoteResponse> {
  swapper: SwapIxsProvider<QuoteResponse>;
  logger?: (msg: string, ...extra: any[]) => void;
}

export async function getRepayWithCollIxs<QuoteResponse>({
  repayAmount,
  isClosingPosition,
  budgetAndPriorityFeeIxs,
  collReserveAddress,
  currentSlot,
  debtReserveAddress,
  kaminoMarket,
  owner,
  obligation,
  quoter,
  swapper,
  referrer,
  scopeRefreshIx,
  useV2Ixs,
  flashBorrowType,
  logger = console.log,
}: RepayWithCollIxsProps<QuoteResponse>): Promise<Array<RepayWithCollIxsResponse<QuoteResponse>>> {
  const { swapInputs, initialInputs } = await getRepayWithCollSwapInputs({
    collReserveAddress,
    currentSlot,
    debtReserveAddress,
    kaminoMarket,
    owner,
    obligation,
    quoter,
    referrer,
    repayAmount,
    isClosingPosition,
    budgetAndPriorityFeeIxs,
    scopeRefreshIx,
    useV2Ixs,
    flashBorrowType,
  });
  const { debtRepayAmountLamports, flashRepayAmountLamports, maxCollateralWithdrawLamports, swapQuote } = initialInputs;
  const { inputAmountLamports: collSwapInLamports } = swapInputs;

  const collReserve = kaminoMarket.getExistingReserveByAddress(collReserveAddress);
  const debtReserve = kaminoMarket.getExistingReserveByAddress(debtReserveAddress);

  if (initialInputs.flashBorrowType === 'coll') {
    // `flashRepayAmountLamports` on the coll-flash variant is the realised coll withdrawal.
    validateCollFlashWithdrawCap({
      collWithdrawLamports: flashRepayAmountLamports,
      maxCollateralWithdrawLamports,
    });
  } else if (collSwapInLamports.greaterThan(maxCollateralWithdrawLamports)) {
    // Debt-flash: silently clamping the swap input would leave `flashRepayAmountLamports` /
    // `minOutAmountLamports` sized to the original amount, producing an inconsistent tx that
    // either fails on flash-repay or consumes pre-existing debt tokens from the user ATA. Throw
    // so the caller can reduce the repay amount or fall back to the coll-flash route.
    throw new Error(
      `Collateral swap in amount ${collSwapInLamports} exceeds max withdrawable collateral ${maxCollateralWithdrawLamports}. ` +
        `Reduce the repay amount or use \`flashBorrowType: 'coll'\`.`
    );
  }

  if (initialInputs.flashBorrowType === 'coll') {
    logger(
      `Expected to swap in: ${collSwapInLamports.div(collReserve.getMintFactor())} ${
        collReserve.symbol
      }, repay debt: ${debtRepayAmountLamports.div(debtReserve.getMintFactor())} ${
        debtReserve.symbol
      }, flash repay: ${flashRepayAmountLamports.div(collReserve.getMintFactor())} ${collReserve.symbol}, quoter px: ${
        swapQuote.priceAInB
      } ${debtReserve.symbol}/${collReserve.symbol}, required px: ${debtRepayAmountLamports
        .div(debtReserve.getMintFactor())
        .div(collSwapInLamports.div(collReserve.getMintFactor()))} ${debtReserve.symbol}/${collReserve.symbol}`
    );
  } else {
    logger(
      `Expected to swap in: ${collSwapInLamports.div(collReserve.getMintFactor())} ${
        collReserve.symbol
      }, for: ${flashRepayAmountLamports.div(debtReserve.getMintFactor())} ${debtReserve.symbol}, quoter px: ${
        swapQuote.priceAInB
      } ${debtReserve.symbol}/${collReserve.symbol}, required px: ${flashRepayAmountLamports
        .div(debtReserve.getMintFactor())
        .div(collSwapInLamports.div(collReserve.getMintFactor()))} ${debtReserve.symbol}/${collReserve.symbol}`
    );
  }

  const swapResponses = await swapper(swapInputs, initialInputs.klendAccounts, swapQuote);

  const repayWithCollateralIxs = await (initialInputs.flashBorrowType === 'coll'
    ? buildRepayWithCollateralIxsCollFlash(
        kaminoMarket,
        debtReserve,
        collReserve,
        owner,
        obligation,
        referrer,
        currentSlot,
        budgetAndPriorityFeeIxs,
        scopeRefreshIx,
        swapResponses,
        isClosingPosition,
        debtRepayAmountLamports,
        collSwapInLamports,
        flashRepayAmountLamports,
        useV2Ixs
      )
    : buildRepayWithCollateralIxsDebtFlash(
        kaminoMarket,
        debtReserve,
        collReserve,
        owner,
        obligation,
        referrer,
        currentSlot,
        budgetAndPriorityFeeIxs,
        scopeRefreshIx,
        swapResponses,
        isClosingPosition,
        debtRepayAmountLamports,
        collSwapInLamports,
        useV2Ixs
      ));

  return repayWithCollateralIxs.map((ixs, index) => {
    return {
      ixs: ixs.instructions,
      lookupTables: swapResponses[index].lookupTables,
      swapInputs,
      flashLoanInfo: ixs.flashLoanInfo,
      initialInputs,
      quote: swapResponses[index].quote.quoteResponse,
    };
  });
}

/**
 * Debt-flash repay-with-collateral builder (default).
 *
 * Instruction order:
 *   scopeRefresh → createAtas → flashBorrow(DEBT) → repay+withdraw → swap(coll→debt) → flashRepay(DEBT) → budget
 *
 * Used when `flashBorrowType` is `'debt'` or omitted. The flash-borrowed debt is paid into the
 * obligation immediately; the withdrawn collateral is then swapped back to debt to repay the flash.
 */
async function buildRepayWithCollateralIxsDebtFlash<QuoteResponse>(
  market: KaminoMarket,
  debtReserve: KaminoReserve,
  collReserve: KaminoReserve,
  owner: TransactionSigner,
  obligation: KaminoObligation,
  referrer: Option<Address>,
  currentSlot: Slot,
  budgetAndPriorityFeeIxs: Instruction[] | undefined,
  scopeRefreshIx: Instruction[],
  swapQuoteIxsArray: SwapIxs<QuoteResponse>[],
  isClosingPosition: boolean,
  debtRepayAmountLamports: Decimal,
  collWithdrawLamports: Decimal,
  useV2Ixs: boolean
): Promise<LeverageIxsOutput[]> {
  // 1. Create atas & budget txns
  const budgetIxs = budgetAndPriorityFeeIxs || getComputeBudgetAndPriorityFeeIxs(1_400_000);

  const atas = [
    { mint: collReserve.getLiquidityMint(), tokenProgram: collReserve.getLiquidityTokenProgram() },
    { mint: debtReserve.getLiquidityMint(), tokenProgram: debtReserve.getLiquidityTokenProgram() },
  ];

  const atasAndIxs = await createAtasIdempotent(owner, atas);
  const [, { ata: debtTokenAta }] = atasAndIxs;

  // 2. Flash borrow & repay the debt to repay amount needed
  const { flashBorrowIx, flashRepayIx } = getFlashLoanInstructions({
    borrowIxIndex: atasAndIxs.length + scopeRefreshIx.length,
    userTransferAuthority: owner,
    lendingMarketAuthority: await market.getLendingMarketAuthority(),
    lendingMarketAddress: market.getAddress(),
    reserve: debtReserve,
    amountLamports: debtRepayAmountLamports,
    destinationAta: debtTokenAta,
    // TODO(referrals): once we support referrals, we will have to replace the placeholder args below:
    referrerAccount: none(),
    referrerTokenState: none(),
    programId: market.programId,
  });

  const requestElevationGroup = !isClosingPosition && obligation.state.elevationGroup !== 0;

  const maxWithdrawLtvCheck = getMaxWithdrawLtvCheck(
    obligation,
    debtRepayAmountLamports,
    debtReserve,
    collWithdrawLamports,
    collReserve
  );

  // 3. Repay using the flash borrowed funds & withdraw collateral to swap and pay the flash loan
  let repayAndWithdrawAction;
  if (maxWithdrawLtvCheck === MaxWithdrawLtvCheck.MAX_LTV) {
    repayAndWithdrawAction = await KaminoAction.buildRepayAndWithdrawTxns({
      kaminoMarket: market,
      repayAmount: isClosingPosition ? U64_MAX : debtRepayAmountLamports.toString(),
      repayReserveAddress: debtReserve.address,
      withdrawAmount: isClosingPosition ? U64_MAX : collWithdrawLamports.toString(),
      withdrawReserveAddress: collReserve.address,
      payer: owner,
      currentSlot,
      obligation,
      useV2Ixs,
      scopeRefreshConfig: undefined,
      extraComputeBudget: 0,
      includeAtaIxs: false,
      requestElevationGroup,
      initUserMetadata: undefined,
      referrer,
    });
  } else {
    repayAndWithdrawAction = await KaminoAction.buildRepayAndWithdrawV2Txns({
      kaminoMarket: market,
      repayAmount: isClosingPosition ? U64_MAX : debtRepayAmountLamports.toString(),
      repayReserveAddress: debtReserve.address,
      withdrawAmount: isClosingPosition ? U64_MAX : collWithdrawLamports.toString(),
      withdrawReserveAddress: collReserve.address,
      payer: owner,
      currentSlot,
      obligation,
      scopeRefreshConfig: undefined,
      extraComputeBudget: 0,
      includeAtaIxs: false,
      requestElevationGroup,
      initUserMetadata: undefined,
      referrer,
    });
  }

  // 4. Swap collateral to debt to repay flash loan
  return swapQuoteIxsArray.map((swapQuoteIxs) => {
    const { preActionIxs, swapIxs } = swapQuoteIxs;
    const swapInstructions = removeBudgetIxs(swapIxs);

    const ixs = [
      ...scopeRefreshIx,
      ...atasAndIxs.map((x) => x.createAtaIx),
      flashBorrowIx,
      ...preActionIxs,
      ...KaminoAction.actionToIxs(repayAndWithdrawAction),
      ...swapInstructions,
      flashRepayIx,
      ...budgetIxs,
    ];

    const res: LeverageIxsOutput = {
      flashLoanInfo: {
        flashBorrowReserve: debtReserve.address,
        flashLoanFee: debtReserve.getFlashLoanFee(),
      },
      instructions: ixs,
    };

    return res;
  });
}

/**
 * Coll-flash repay-with-collateral builder.
 *
 * Instruction order:
 *   scopeRefresh → createAtas → flashBorrow(COLL) → swap(coll→debt) → repay+withdraw → flashRepay(COLL) → budget
 *
 * Vs the default debt-flash builder, the swap runs BEFORE repay+withdraw because the swap
 * output (debt) is what gets repaid to the obligation. The withdrawn coll is then used to
 * repay the flash loan.
 */
async function buildRepayWithCollateralIxsCollFlash<QuoteResponse>(
  market: KaminoMarket,
  debtReserve: KaminoReserve,
  collReserve: KaminoReserve,
  owner: TransactionSigner,
  obligation: KaminoObligation,
  referrer: Option<Address>,
  currentSlot: Slot,
  budgetAndPriorityFeeIxs: Instruction[] | undefined,
  scopeRefreshIx: Instruction[],
  swapQuoteIxsArray: SwapIxs<QuoteResponse>[],
  isClosingPosition: boolean,
  debtRepayAmountLamports: Decimal,
  flashBorrowInCollLamports: Decimal,
  collWithdrawForFlashRepayLamports: Decimal,
  useV2Ixs: boolean
): Promise<LeverageIxsOutput[]> {
  // 1. Create atas & budget txns
  const budgetIxs = budgetAndPriorityFeeIxs || getComputeBudgetAndPriorityFeeIxs(1_400_000);

  const atas = [
    { mint: collReserve.getLiquidityMint(), tokenProgram: collReserve.getLiquidityTokenProgram() },
    { mint: debtReserve.getLiquidityMint(), tokenProgram: debtReserve.getLiquidityTokenProgram() },
  ];

  const atasAndIxs = await createAtasIdempotent(owner, atas);
  const [{ ata: collTokenAta }] = atasAndIxs;

  // 2. Flash borrow the same amount of coll we will feed into the swap. The withdrawal that
  // funds the flash repay (`collWithdrawForFlashRepayLamports`) is computed once in
  // `calcRepayWithCollCollFlashSwap` and threaded down — keeps sizing logic colocated.
  const { flashBorrowIx, flashRepayIx } = getFlashLoanInstructions({
    borrowIxIndex: atasAndIxs.length + scopeRefreshIx.length,
    userTransferAuthority: owner,
    lendingMarketAuthority: await market.getLendingMarketAuthority(),
    lendingMarketAddress: market.getAddress(),
    reserve: collReserve,
    amountLamports: flashBorrowInCollLamports,
    destinationAta: collTokenAta,
    referrerAccount: none(),
    referrerTokenState: none(),
    programId: market.programId,
  });

  const requestElevationGroup = !isClosingPosition && obligation.state.elevationGroup !== 0;

  const maxWithdrawLtvCheck = getMaxWithdrawLtvCheck(
    obligation,
    debtRepayAmountLamports,
    debtReserve,
    collWithdrawForFlashRepayLamports,
    collReserve
  );

  // 3. Repay obligation debt with the swapped output, then withdraw coll to repay the flash loan.
  let repayAndWithdrawAction;
  if (maxWithdrawLtvCheck === MaxWithdrawLtvCheck.MAX_LTV) {
    repayAndWithdrawAction = await KaminoAction.buildRepayAndWithdrawTxns({
      kaminoMarket: market,
      repayAmount: isClosingPosition ? U64_MAX : debtRepayAmountLamports.toString(),
      repayReserveAddress: debtReserve.address,
      withdrawAmount: isClosingPosition ? U64_MAX : collWithdrawForFlashRepayLamports.toString(),
      withdrawReserveAddress: collReserve.address,
      payer: owner,
      currentSlot,
      obligation,
      useV2Ixs,
      scopeRefreshConfig: undefined,
      extraComputeBudget: 0,
      includeAtaIxs: false,
      requestElevationGroup,
      initUserMetadata: undefined,
      referrer,
    });
  } else {
    repayAndWithdrawAction = await KaminoAction.buildRepayAndWithdrawV2Txns({
      kaminoMarket: market,
      repayAmount: isClosingPosition ? U64_MAX : debtRepayAmountLamports.toString(),
      repayReserveAddress: debtReserve.address,
      withdrawAmount: isClosingPosition ? U64_MAX : collWithdrawForFlashRepayLamports.toString(),
      withdrawReserveAddress: collReserve.address,
      payer: owner,
      currentSlot,
      obligation,
      scopeRefreshConfig: undefined,
      extraComputeBudget: 0,
      includeAtaIxs: false,
      requestElevationGroup,
      initUserMetadata: undefined,
      referrer,
    });
  }

  return swapQuoteIxsArray.map((swapQuoteIxs) => {
    const { preActionIxs, swapIxs } = swapQuoteIxs;
    const swapInstructions = removeBudgetIxs(swapIxs);

    // Key difference vs debt-flash: swap BEFORE repay+withdraw (the swap output is what we repay).
    const ixs = [
      ...scopeRefreshIx,
      ...atasAndIxs.map((x) => x.createAtaIx),
      flashBorrowIx,
      ...preActionIxs,
      ...swapInstructions,
      ...KaminoAction.actionToIxs(repayAndWithdrawAction),
      flashRepayIx,
      ...budgetIxs,
    ];

    const res: LeverageIxsOutput = {
      flashLoanInfo: {
        flashBorrowReserve: collReserve.address,
        flashLoanFee: collReserve.getFlashLoanFee(),
      },
      instructions: ixs,
    };

    return res;
  });
}
