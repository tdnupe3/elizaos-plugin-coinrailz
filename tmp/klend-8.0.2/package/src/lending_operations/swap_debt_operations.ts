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
 * Which debt token to flash borrow for a swap-debt operation.
 *
 * - `targetDebt`: flash borrow target debt → swap target → source → repay source → borrow target → flash repay.
 * - `sourceDebt`: flash borrow source debt → repay source → borrow target → swap target → source → flash repay.
 */
export type SwapDebtFlashBorrowToken = 'sourceDebt' | 'targetDebt';

export interface SwapDebtIxsInputs<QuoteResponse> {
  /**
   * Amount of source debt to be reduced (i.e. replaced with target debt), in source-debt token units.
   * The obligation's source debt will be repaid by this amount.
   */
  sourceDebtSwapAmount: Decimal;

  /**
   * If true, the full outstanding source debt will be repaid (regardless of `sourceDebtSwapAmount`).
   */
  isClosingSourceDebt: boolean;

  sourceDebtReserveAddress: Address;
  targetDebtReserveAddress: Address;

  flashBorrowToken: SwapDebtFlashBorrowToken;

  /**
   * Elevation group ID the obligation should end up with after the swap.
   */
  newElevationGroup: number;

  market: KaminoMarket;
  owner: TransactionSigner;
  obligation: KaminoObligation;
  referrer: Option<Address>;
  currentSlot: Slot;
  /**
   * Slippage percentage for the external swap (e.g. 0.5 for 0.5%). Used to size the flash loan above the strict
   * minimum so that the swap does not fail.
   */
  slippagePct: Decimal;
  budgetAndPriorityFeeIxs?: Instruction[];
  scopeRefreshIx: Instruction[];
  useV2Ixs: boolean;
  quoter: SwapQuoteProvider<QuoteResponse>;
  swapper: SwapIxsProvider<QuoteResponse>;
  logger?: (msg: string, ...extra: unknown[]) => void;
}

export interface SwapDebtIxsOutputs<QuoteResponse> {
  ixs: Instruction[];
  lookupTables: Account<AddressLookupTable>[];
  useV2Ixs: boolean;
  simulationDetails: {
    flashLoan: {
      flashBorrowReserveMint: Address;
      flashBorrowedAmount: Decimal;
      flashRepaidAmount: Decimal;
    };
    externalSwap: {
      swapInMint: Address;
      swapOutMint: Address;
      swapInAmount: Decimal;
      swapOutAmount: Decimal;
      quoteResponse?: QuoteResponse;
    };
  };
}

/**
 * Constructs instructions needed to partially/fully swap the given source debt for some other debt.
 */
export async function getSwapDebtIxs<QuoteResponse>(
  inputs: SwapDebtIxsInputs<QuoteResponse>
): Promise<Array<SwapDebtIxsOutputs<QuoteResponse>>> {
  if (inputs.flashBorrowToken === 'targetDebt') {
    return getSwapDebtViaTargetDebt(inputs);
  }
  return getSwapDebtViaSourceDebt(inputs);
}

// ===========================================================================================================
// Shared context
// ===========================================================================================================

type SwapDebtArgs = {
  sourceDebtSwapAmount: Decimal;
  isClosingSourceDebt: boolean;
  newElevationGroup: ElevationGroupDescription | null;
  slippagePct: Decimal;
};

type SwapDebtContext<QuoteResponse> = {
  market: KaminoMarket;
  sourceDebtReserve: KaminoReserve;
  targetDebtReserve: KaminoReserve;
  owner: TransactionSigner;
  obligation: KaminoObligation;
  quoter: SwapQuoteProvider<QuoteResponse>;
  swapper: SwapIxsProvider<QuoteResponse>;
  referrer: Option<Address>;
  currentSlot: Slot;
  budgetAndPriorityFeeIxs: Instruction[];
  scopeRefreshIx: Instruction[];
  useV2Ixs: boolean;
  logger: (msg: string, ...extra: unknown[]) => void;
};

function extractArgsAndContext<QuoteResponse>(
  inputs: SwapDebtIxsInputs<QuoteResponse>
): [SwapDebtArgs, SwapDebtContext<QuoteResponse>] {
  if (inputs.sourceDebtReserveAddress === inputs.targetDebtReserveAddress) {
    throw new Error('Cannot swap from/to the same debt');
  }
  if (inputs.sourceDebtSwapAmount.lte(0)) {
    throw new Error('Cannot swap a non-positive amount');
  }
  const sourceDebtReserve = inputs.market.getExistingReserveByAddress(inputs.sourceDebtReserveAddress, 'Source debt');
  const targetDebtReserve = inputs.market.getExistingReserveByAddress(inputs.targetDebtReserveAddress, 'Target debt');
  if (!inputs.obligation.getBorrowByReserve(sourceDebtReserve.address)) {
    throw new Error(
      `Obligation ${inputs.obligation.obligationAddress} has no borrow in source debt reserve ${sourceDebtReserve.address}`
    );
  }
  if (!inputs.isClosingSourceDebt) {
    // Partial swap: the caller must not size around an impossible repay. The on-chain repay is capped at the
    // outstanding amount anyway, but the flash-loan / external-swap / target-borrow sizing here would all be
    // built around the inflated input, producing confusing failures later. Fail fast.
    const outstandingSourceDebt = inputs.obligation.getBorrowAmountByReserve(sourceDebtReserve);
    if (inputs.sourceDebtSwapAmount.gt(outstandingSourceDebt)) {
      throw new Error(
        `sourceDebtSwapAmount ${inputs.sourceDebtSwapAmount} exceeds the obligation's current ${sourceDebtReserve.symbol} debt (${outstandingSourceDebt}); pass isClosingSourceDebt=true to swap the full position`
      );
    }
  }
  return [
    {
      sourceDebtSwapAmount: inputs.sourceDebtSwapAmount,
      isClosingSourceDebt: inputs.isClosingSourceDebt,
      newElevationGroup: inputs.market.getExistingElevationGroup(inputs.newElevationGroup, 'Newly-requested'),
      slippagePct: inputs.slippagePct,
    },
    {
      market: inputs.market,
      sourceDebtReserve,
      targetDebtReserve,
      owner: inputs.owner,
      obligation: inputs.obligation,
      quoter: inputs.quoter,
      swapper: inputs.swapper,
      referrer: inputs.referrer,
      currentSlot: inputs.currentSlot,
      budgetAndPriorityFeeIxs:
        inputs.budgetAndPriorityFeeIxs || getComputeBudgetAndPriorityFeeIxs(DEFAULT_MAX_COMPUTE_UNITS),
      scopeRefreshIx: inputs.scopeRefreshIx,
      useV2Ixs: inputs.useV2Ixs,
      logger: inputs.logger ?? console.log,
    },
  ];
}

// ===========================================================================================================
// Flow A: flash borrow TARGET debt
// ===========================================================================================================

async function getSwapDebtViaTargetDebt<QuoteResponse>(
  inputs: SwapDebtIxsInputs<QuoteResponse>
): Promise<Array<SwapDebtIxsOutputs<QuoteResponse>>> {
  const [args, context] = extractArgsAndContext(inputs);

  const sourceRepayLamports = resolveSourceDebtRepayLamports(args, context);
  const slippageFactor = new Decimal(1).sub(args.slippagePct.div(100));

  // Initial estimate using oracle prices so we can build klend ixs for account discovery.
  const oraclePx = context.sourceDebtReserve
    .getOracleMarketPrice()
    .div(context.targetDebtReserve.getOracleMarketPrice()); // price of 1 source denominated in target
  const estFlashBorrowLamports = sourceRepayLamports
    .div(context.sourceDebtReserve.getMintFactor())
    .mul(oraclePx)
    .div(slippageFactor)
    .mul(context.targetDebtReserve.getMintFactor())
    .ceil();

  // Build fake klend ixs to learn accounts.
  const estFlashRepayLamports = calculateFlashRepayLamports(context.targetDebtReserve, estFlashBorrowLamports, context);
  const fakeKlend = await getTargetDebtKlendIxs(
    args,
    context,
    estFlashBorrowLamports,
    estFlashRepayLamports,
    sourceRepayLamports
  );
  const klendAccounts = uniqueAccountsWithProgramIds(listTargetDebtIxs(fakeKlend));

  // Query the quoter with estFlashBorrow as the input amount (targetDebt → sourceDebt).
  const swapInputs = {
    inputAmountLamports: estFlashBorrowLamports,
    inputMint: context.targetDebtReserve.getLiquidityMint(),
    outputMint: context.sourceDebtReserve.getLiquidityMint(),
  };
  const swapQuote = await context.quoter(swapInputs, klendAccounts);
  // priceAInB = output/input = sourceDebt per 1 targetDebt (with expected slippage already factored in by the quoter).
  // Required: swapOut = flashBorrow * priceAInB ≥ sourceRepayLamports
  //           flashBorrow = sourceRepayLamports / priceAInB
  const actualFlashBorrowLamports = new Decimal(sourceRepayLamports)
    .div(context.sourceDebtReserve.getMintFactor())
    .div(swapQuote.priceAInB)
    .mul(context.targetDebtReserve.getMintFactor())
    .ceil();

  // Call swapper with the actual input amount.
  const actualSwapInputs = {
    inputAmountLamports: actualFlashBorrowLamports,
    inputMint: context.targetDebtReserve.getLiquidityMint(),
    outputMint: context.sourceDebtReserve.getLiquidityMint(),
  };
  const swapResponses = await context.swapper(actualSwapInputs, klendAccounts, swapQuote);

  const viableSwapResponses = swapResponses
    .map((swapResp) => {
      const swapOutLamports = swapResp.quote.priceAInB
        .mul(actualFlashBorrowLamports)
        .div(context.targetDebtReserve.getMintFactor())
        .mul(context.sourceDebtReserve.getMintFactor());

      return { swapResp, swapOutLamports };
    })
    .filter(({ swapOutLamports }) => swapOutLamports.gte(sourceRepayLamports));
  if (viableSwapResponses.length === 0) {
    throw new Error(
      `No targetDebt swap route returned enough ${context.sourceDebtReserve.symbol} to repay ${sourceRepayLamports} lamports`
    );
  }

  return Promise.all(
    viableSwapResponses.map(async ({ swapResp, swapOutLamports }) => {
      const actualFlashRepayLamports = calculateFlashRepayLamports(
        context.targetDebtReserve,
        actualFlashBorrowLamports,
        context
      );
      checkResultingObligationValid(args, sourceRepayLamports, actualFlashRepayLamports, context, 'targetDebt');

      const klendIxs = await getTargetDebtKlendIxs(
        args,
        context,
        actualFlashBorrowLamports,
        actualFlashRepayLamports,
        sourceRepayLamports
      );

      return {
        ixs: listTargetDebtIxs(klendIxs, [...swapResp.preActionIxs, ...removeBudgetIxs(swapResp.swapIxs)]),
        lookupTables: swapResp.lookupTables,
        useV2Ixs: context.useV2Ixs,
        simulationDetails: {
          flashLoan: {
            flashBorrowReserveMint: context.targetDebtReserve.getLiquidityMint(),
            flashBorrowedAmount: actualFlashBorrowLamports.div(context.targetDebtReserve.getMintFactor()),
            flashRepaidAmount: klendIxs.simulationDetails.flashRepayLamports.div(
              context.targetDebtReserve.getMintFactor()
            ),
          },
          externalSwap: {
            swapInMint: context.targetDebtReserve.getLiquidityMint(),
            swapOutMint: context.sourceDebtReserve.getLiquidityMint(),
            swapInAmount: actualFlashBorrowLamports.div(context.targetDebtReserve.getMintFactor()),
            swapOutAmount: swapOutLamports.div(context.sourceDebtReserve.getMintFactor()),
            quoteResponse: swapResp.quote.quoteResponse,
          },
        },
      };
    })
  );
}

type SwapDebtViaTargetKlendIxs = {
  setupIxs: Instruction[];
  targetDebtFlashBorrowIx: Instruction;
  repaySourceIxs: Instruction[];
  borrowTargetIxs: Instruction[];
  targetDebtFlashRepayIx: Instruction;
  cleanupIxs: Instruction[];
  flashLoanInfo: FlashLoanInfo;
  simulationDetails: {
    flashRepayLamports: Decimal;
  };
};

async function getTargetDebtKlendIxs(
  args: SwapDebtArgs,
  context: SwapDebtContext<any>,
  flashBorrowLamports: Decimal,
  flashRepayLamports: Decimal,
  sourceRepayLamports: Decimal
): Promise<SwapDebtViaTargetKlendIxs> {
  const { ataCreationIxs, targetDebtAta } = await getAtaCreationIxs(context);
  const setupIxs = [...ataCreationIxs];
  if (context.scopeRefreshIx?.length) {
    setupIxs.unshift(...context.scopeRefreshIx);
  }

  const { flashBorrowIx: targetDebtFlashBorrowIx, flashRepayIx: targetDebtFlashRepayIx } = getFlashLoanInstructions({
    borrowIxIndex: setupIxs.length,
    userTransferAuthority: context.owner,
    lendingMarketAuthority: await context.market.getLendingMarketAuthority(),
    lendingMarketAddress: context.market.getAddress(),
    reserve: context.targetDebtReserve,
    amountLamports: flashBorrowLamports,
    destinationAta: targetDebtAta,
    referrerAccount: none(),
    referrerTokenState: none(),
    programId: context.market.programId,
  });

  // Repay source debt with the swap output (swap happens between flash-borrow and repay in final instruction order).
  const repayAction = await KaminoAction.buildRepayTxns({
    kaminoMarket: context.market,
    amount: args.isClosingSourceDebt ? U64_MAX : sourceRepayLamports.toFixed(0),
    reserveAddress: context.sourceDebtReserve.address,
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
  const repaySourceIxs = removeBudgetIxs(KaminoAction.actionToIxs(repayAction));

  // Borrow target debt (amount = flashRepay) to pay the flash loan back.
  const finalElevationGroupId = args.newElevationGroup?.elevationGroup ?? 0;
  const requestsElevationGroupChange = finalElevationGroupId !== context.obligation.state.elevationGroup;
  const borrowAction = await KaminoAction.buildBorrowTxns({
    kaminoMarket: context.market,
    amount: flashRepayLamports.toFixed(0),
    reserveAddress: context.targetDebtReserve.address,
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
      // If we fully closed the source debt in the prior repay, the obligation no longer holds it and the refresh
      // accounts must reflect that.
      removedBorrowReserves: args.isClosingSourceDebt ? [context.sourceDebtReserve.address] : [],
    },
  });
  const borrowTargetIxs = removeBudgetIxs(KaminoAction.actionToIxs(borrowAction));

  const cleanupIxs = [...(await getAtaCloseIxs(context)), ...context.budgetAndPriorityFeeIxs];

  return {
    setupIxs,
    targetDebtFlashBorrowIx,
    repaySourceIxs,
    borrowTargetIxs,
    targetDebtFlashRepayIx,
    cleanupIxs,
    flashLoanInfo: {
      flashBorrowReserve: context.targetDebtReserve.address,
      flashLoanFee: context.targetDebtReserve.getFlashLoanFee(),
    },
    simulationDetails: {
      flashRepayLamports,
    },
  };
}

function listTargetDebtIxs(klend: SwapDebtViaTargetKlendIxs, externalSwapIxs?: Instruction[]): Instruction[] {
  return [
    ...klend.setupIxs,
    klend.targetDebtFlashBorrowIx,
    ...(externalSwapIxs || []),
    ...klend.repaySourceIxs,
    ...klend.borrowTargetIxs,
    klend.targetDebtFlashRepayIx,
    ...klend.cleanupIxs,
  ];
}

// ===========================================================================================================
// Flow B: flash borrow SOURCE debt
// ===========================================================================================================

async function getSwapDebtViaSourceDebt<QuoteResponse>(
  inputs: SwapDebtIxsInputs<QuoteResponse>
): Promise<Array<SwapDebtIxsOutputs<QuoteResponse>>> {
  const [args, context] = extractArgsAndContext(inputs);

  const sourceRepayLamports = resolveSourceDebtRepayLamports(args, context);
  const slippageFactor = new Decimal(1).sub(args.slippagePct.div(100));

  // Flash borrow = source repay amount. Repay amount = flashBorrow + fee.
  const flashRepayLamports = calculateFlashRepayLamports(context.sourceDebtReserve, sourceRepayLamports, context);

  // Estimate target debt borrow using oracle prices. priceSourceInTarget = oracle_source / oracle_target.
  const oraclePx = context.sourceDebtReserve
    .getOracleMarketPrice()
    .div(context.targetDebtReserve.getOracleMarketPrice());
  const estBorrowTargetLamports = flashRepayLamports
    .div(context.sourceDebtReserve.getMintFactor())
    .mul(oraclePx)
    .div(slippageFactor)
    .mul(context.targetDebtReserve.getMintFactor())
    .ceil();

  const fakeKlendIxs = await getSourceDebtKlendIxs(args, context, sourceRepayLamports, estBorrowTargetLamports);
  const klendAccounts = uniqueAccountsWithProgramIds(listSourceDebtIxs(fakeKlendIxs));

  // Query quoter with estBorrowTarget as swap input (targetDebt → sourceDebt).
  const swapInputs = {
    inputAmountLamports: estBorrowTargetLamports,
    inputMint: context.targetDebtReserve.getLiquidityMint(),
    outputMint: context.sourceDebtReserve.getLiquidityMint(),
  };
  const swapQuote = await context.quoter(swapInputs, klendAccounts);
  // Need swap output ≥ flashRepayLamports:
  //   borrowTarget * priceAInB ≥ flashRepayLamports
  //   borrowTarget = flashRepayLamports / priceAInB
  const actualBorrowTargetLamports = new Decimal(flashRepayLamports)
    .div(context.sourceDebtReserve.getMintFactor())
    .div(swapQuote.priceAInB)
    .mul(context.targetDebtReserve.getMintFactor())
    .ceil();

  const actualSwapInputs = {
    inputAmountLamports: actualBorrowTargetLamports,
    inputMint: context.targetDebtReserve.getLiquidityMint(),
    outputMint: context.sourceDebtReserve.getLiquidityMint(),
  };
  const swapResponses = await context.swapper(actualSwapInputs, klendAccounts, swapQuote);

  const viableSwapResponses = swapResponses
    .map((swapResp) => {
      const swapOutLamports = swapResp.quote.priceAInB
        .mul(actualBorrowTargetLamports)
        .div(context.targetDebtReserve.getMintFactor())
        .mul(context.sourceDebtReserve.getMintFactor());

      return { swapResp, swapOutLamports };
    })
    .filter(({ swapOutLamports }) => swapOutLamports.gte(flashRepayLamports));
  if (viableSwapResponses.length === 0) {
    throw new Error(
      `No sourceDebt swap route returned enough ${context.sourceDebtReserve.symbol} to repay the flash loan (${flashRepayLamports} lamports)`
    );
  }

  return Promise.all(
    viableSwapResponses.map(async ({ swapResp, swapOutLamports }) => {
      checkResultingObligationValid(args, sourceRepayLamports, actualBorrowTargetLamports, context, 'sourceDebt');

      const klendIxs = await getSourceDebtKlendIxs(args, context, sourceRepayLamports, actualBorrowTargetLamports);

      return {
        ixs: listSourceDebtIxs(klendIxs, [...swapResp.preActionIxs, ...removeBudgetIxs(swapResp.swapIxs)]),
        lookupTables: swapResp.lookupTables,
        useV2Ixs: context.useV2Ixs,
        simulationDetails: {
          flashLoan: {
            flashBorrowReserveMint: context.sourceDebtReserve.getLiquidityMint(),
            flashBorrowedAmount: sourceRepayLamports.div(context.sourceDebtReserve.getMintFactor()),
            flashRepaidAmount: flashRepayLamports.div(context.sourceDebtReserve.getMintFactor()),
          },
          externalSwap: {
            swapInMint: context.targetDebtReserve.getLiquidityMint(),
            swapOutMint: context.sourceDebtReserve.getLiquidityMint(),
            swapInAmount: actualBorrowTargetLamports.div(context.targetDebtReserve.getMintFactor()),
            swapOutAmount: swapOutLamports.div(context.sourceDebtReserve.getMintFactor()),
            quoteResponse: swapResp.quote.quoteResponse,
          },
        },
      };
    })
  );
}

type SwapDebtViaSourceKlendIxs = {
  setupIxs: Instruction[];
  sourceDebtFlashBorrowIx: Instruction;
  repaySourceIxs: Instruction[];
  borrowTargetIxs: Instruction[];
  sourceDebtFlashRepayIx: Instruction;
  cleanupIxs: Instruction[];
  flashLoanInfo: FlashLoanInfo;
};

async function getSourceDebtKlendIxs(
  args: SwapDebtArgs,
  context: SwapDebtContext<any>,
  flashBorrowLamports: Decimal,
  borrowTargetLamports: Decimal
): Promise<SwapDebtViaSourceKlendIxs> {
  const { ataCreationIxs, sourceDebtAta } = await getAtaCreationIxs(context);
  const setupIxs = [...ataCreationIxs];
  if (context.scopeRefreshIx?.length) {
    setupIxs.unshift(...context.scopeRefreshIx);
  }

  const { flashBorrowIx: sourceDebtFlashBorrowIx, flashRepayIx: sourceDebtFlashRepayIx } = getFlashLoanInstructions({
    borrowIxIndex: setupIxs.length,
    userTransferAuthority: context.owner,
    lendingMarketAuthority: await context.market.getLendingMarketAuthority(),
    lendingMarketAddress: context.market.getAddress(),
    reserve: context.sourceDebtReserve,
    amountLamports: flashBorrowLamports,
    destinationAta: sourceDebtAta,
    referrerAccount: none(),
    referrerTokenState: none(),
    programId: context.market.programId,
  });

  // 1. Repay source debt using flash-borrowed tokens.
  const repayAction = await KaminoAction.buildRepayTxns({
    kaminoMarket: context.market,
    amount: args.isClosingSourceDebt ? U64_MAX : flashBorrowLamports.toFixed(0),
    reserveAddress: context.sourceDebtReserve.address,
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
  const repaySourceIxs = removeBudgetIxs(KaminoAction.actionToIxs(repayAction));

  // 2. Borrow target debt.
  const finalElevationGroupId = args.newElevationGroup?.elevationGroup ?? 0;
  const requestsElevationGroupChange = finalElevationGroupId !== context.obligation.state.elevationGroup;
  const borrowAction = await KaminoAction.buildBorrowTxns({
    kaminoMarket: context.market,
    amount: borrowTargetLamports.toFixed(0),
    reserveAddress: context.targetDebtReserve.address,
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
      // If we fully closed the source debt in the prior repay, the obligation no longer holds it and the refresh
      // accounts must reflect that.
      removedBorrowReserves: args.isClosingSourceDebt ? [context.sourceDebtReserve.address] : [],
    },
  });
  const borrowTargetIxs = removeBudgetIxs(KaminoAction.actionToIxs(borrowAction));

  const cleanupIxs = [...(await getAtaCloseIxs(context)), ...context.budgetAndPriorityFeeIxs];

  return {
    setupIxs,
    sourceDebtFlashBorrowIx,
    repaySourceIxs,
    borrowTargetIxs,
    sourceDebtFlashRepayIx,
    cleanupIxs,
    flashLoanInfo: {
      flashBorrowReserve: context.sourceDebtReserve.address,
      flashLoanFee: context.sourceDebtReserve.getFlashLoanFee(),
    },
  };
}

function listSourceDebtIxs(klend: SwapDebtViaSourceKlendIxs, externalSwapIxs?: Instruction[]): Instruction[] {
  return [
    ...klend.setupIxs,
    klend.sourceDebtFlashBorrowIx,
    ...klend.repaySourceIxs,
    ...klend.borrowTargetIxs,
    ...(externalSwapIxs || []),
    klend.sourceDebtFlashRepayIx,
    ...klend.cleanupIxs,
  ];
}

// ===========================================================================================================
// Shared helpers
// ===========================================================================================================

function resolveSourceDebtRepayLamports(args: SwapDebtArgs, context: SwapDebtContext<any>): Decimal {
  if (args.isClosingSourceDebt) {
    // Include estimated interest accrual plus a small safety buffer so that the amount we size the flow around
    // covers the actual debt that will exist at the moment of the on-chain repay.
    const debtLiquidity = context.obligation.state.borrows.find(
      (b) => b.borrowReserve === context.sourceDebtReserve.address
    )!;
    const irRatio = context.obligation
      .estimateObligationInterestRate(context.market, context.sourceDebtReserve, debtLiquidity, context.currentSlot)
      .toDecimalPlaces(context.sourceDebtReserve.state.liquidity.mintDecimals.toNumber(), Decimal.ROUND_CEIL);
    const irMultiplier = irRatio.lte(0) ? new Decimal('1.001') : irRatio.mul(new Decimal('1.001'));
    return context.obligation
      .getBorrowAmountByReserve(context.sourceDebtReserve)
      .mul(context.sourceDebtReserve.getMintFactor())
      .mul(irMultiplier)
      .toDecimalPlaces(0, Decimal.ROUND_CEIL);
  }
  return args.sourceDebtSwapAmount.mul(context.sourceDebtReserve.getMintFactor()).ceil();
}

function calculateFlashRepayLamports(
  reserve: KaminoReserve,
  flashBorrowLamports: Decimal,
  context: SwapDebtContext<any>
): Decimal {
  return computeFlashRepayLamports(
    reserve,
    flashBorrowLamports,
    context.market.state.referralFeeBps,
    isSome(context.referrer)
  );
}

/**
 * Pure helper exposed for unit testing: computes the flash-repay amount (in lamports) for a flash-borrow of
 * `flashBorrowLamports` on `reserve`. Ceils the result so the resulting amount is always an integer number of
 * lamports that is at least the (potentially fractional) fee-included sum. The borrow ix later uses `.toFixed(0)`
 * which would otherwise round half-to-up and could under-borrow by 1 lamport, causing the flash repay to fail.
 */
export function computeFlashRepayLamports(
  reserve: KaminoReserve,
  flashBorrowLamports: Decimal,
  referralFeeBps: number,
  hasReferrer: boolean
): Decimal {
  const { protocolFees, referrerFees } = reserve.calculateFees(
    flashBorrowLamports,
    reserve.getFlashLoanFee(),
    FeeCalculation.Exclusive,
    referralFeeBps,
    hasReferrer
  );
  return flashBorrowLamports.add(protocolFees).add(referrerFees).ceil();
}

async function getAtaCreationIxs(context: SwapDebtContext<any>) {
  const atasAndIxs = await createAtasIdempotent(context.owner, [
    {
      mint: context.sourceDebtReserve.getLiquidityMint(),
      tokenProgram: context.sourceDebtReserve.getLiquidityTokenProgram(),
    },
    {
      mint: context.targetDebtReserve.getLiquidityMint(),
      tokenProgram: context.targetDebtReserve.getLiquidityTokenProgram(),
    },
  ]);
  return {
    ataCreationIxs: atasAndIxs.map((t) => t.createAtaIx),
    sourceDebtAta: atasAndIxs[0].ata,
    targetDebtAta: atasAndIxs[1].ata,
  };
}

async function getAtaCloseIxs(context: SwapDebtContext<any>) {
  const ataCloseIxs: Instruction[] = [];
  if (
    context.sourceDebtReserve.getLiquidityMint() === WRAPPED_SOL_MINT ||
    context.targetDebtReserve.getLiquidityMint() === WRAPPED_SOL_MINT
  ) {
    const wsolAta = await getAssociatedTokenAddress(WRAPPED_SOL_MINT, context.owner.address);
    ataCloseIxs.push(
      getCloseAccountInstruction(
        { account: wsolAta, owner: context.owner, destination: context.owner.address },
        { programAddress: TOKEN_PROGRAM_ADDRESS }
      )
    );
  }
  return ataCloseIxs;
}

function checkResultingObligationValid(
  args: SwapDebtArgs,
  sourceRepayLamports: Decimal,
  targetBorrowLamports: Decimal,
  context: SwapDebtContext<any>,
  flow: SwapDebtFlashBorrowToken
): void {
  // Elevation group validity:
  if (args.newElevationGroup !== null) {
    // Determine the resulting set of borrow reserves.
    const borrowReserveAddresses = new Set<Address>([
      ...context.obligation.borrows.keys(),
      context.targetDebtReserve.address,
    ]);
    if (args.isClosingSourceDebt) {
      borrowReserveAddresses.delete(context.sourceDebtReserve.address);
    }
    if (borrowReserveAddresses.size > 1) {
      throw new Error(
        `The obligation with ${borrowReserveAddresses.size} debt reserves cannot request any elevation group`
      );
    }
    if (borrowReserveAddresses.size === 1) {
      const only = [...borrowReserveAddresses][0];
      if (args.newElevationGroup.debtReserve !== only) {
        throw new Error(
          `The obligation with debt reserve ${only} cannot request elevation group ${args.newElevationGroup.elevationGroup}`
        );
      }
    }
    // Collateral reserves unchanged, but they must still all be compatible with the new group.
    for (const collReserveAddress of context.obligation.deposits.keys()) {
      if (!args.newElevationGroup.collateralReserves.has(collReserveAddress)) {
        throw new Error(
          `The obligation with collateral reserve ${collReserveAddress} cannot request elevation group ${args.newElevationGroup.elevationGroup}`
        );
      }
    }
    if (context.obligation.deposits.size > args.newElevationGroup.maxReservesAsCollateral) {
      throw new Error(
        `The obligation with ${context.obligation.deposits.size} collateral reserves cannot request elevation group ${args.newElevationGroup.elevationGroup}`
      );
    }
  }

  // Resulting LTV check. The on-chain obligation debt grows by `borrow.liquidityAmount + reserve.originationFee`,
  // so we feed the fee-included amount into the simulation. This single change addresses both consequences Silviu
  // flagged in PR comment #3268776841: "underestimates final LTV and borrow-limit usage" — the obligation-level
  // borrow-limit "usage" surfaces in `userTotalBorrowBorrowFactorAdjusted`, which `getPostSwapDebtObligationStats`
  // now computes from the fee-included amount. The reserve-level `borrow_limit` is enforced by the borrow ix
  // on-chain; we don't duplicate it client-side here (stale snapshot, no alternative-flow to recommend).
  const targetBorrowLamportsWithFees = KaminoObligation.getDebtWithFeesForBorrowAmount(
    targetBorrowLamports,
    context.market,
    context.targetDebtReserve,
    isSome(context.referrer)
  );
  const resultingStats = context.obligation.getPostSwapDebtObligationStats({
    repayAmountLamports: sourceRepayLamports,
    repayReserveAddress: context.sourceDebtReserve.address,
    borrowAmountLamports: targetBorrowLamportsWithFees,
    borrowReserveAddress: context.targetDebtReserve.address,
    newElevationGroup: args.newElevationGroup?.elevationGroup ?? 0,
    market: context.market,
    slot: context.currentSlot,
  });
  const maxLtv = resultingStats.borrowLimit.div(resultingStats.userTotalCollateralDeposit);
  if (resultingStats.loanToValue > maxLtv) {
    throw new Error(
      `Swap debt (${flow}) would result in the obligation's LTV ${resultingStats.loanToValue} exceeding its max LTV ${maxLtv}`
    );
  }
}
