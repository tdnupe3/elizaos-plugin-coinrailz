import { Address, Option, Slot, TransactionSigner } from '@solana/kit';
import BN from 'bn.js';
import { ObligationType, ScopePriceRefreshConfig } from '../utils';
import { KaminoObligation } from './obligation';
import { KaminoMarket } from './market';
import { KaminoReserve } from './reserve';
import { ActionType } from './action';
import { KaminoBorrowOrder } from './borrowOrder';
import { ProgressCallbackType } from '../@codegen/klend/types';

/**
 * Optional adjustments to the obligation snapshot that `KaminoAction` is built against.
 * Use when the obligation will be mutated by another instruction in the same transaction so that the action's internal
 * `refresh_obligation` / `refresh_reserve` accounts reflect the state at the time those instructions actually execute.
 */
export interface ObligationCustomizations {
  /** Reserves that will be deposit-side at execution time but are not in the obligation snapshot. */
  addedDepositReserves?: Address[];
  /** Reserves that will be borrow-side at execution time but are not in the obligation snapshot. */
  addedBorrowReserves?: Address[];
  /** Reserves that were borrow-side in the obligation snapshot but will be fully repaid by an earlier ix. */
  removedBorrowReserves?: Address[];
  /** Reserves that were deposit-side in the obligation snapshot but will be fully withdrawn by an earlier ix. */
  removedDepositReserves?: Address[];
}

/**
 * Props for KaminoAction.initialize
 */
export interface InitializeActionProps {
  kaminoMarket: KaminoMarket;
  action: ActionType;
  amount: string | BN;
  reserveAddress: Address;
  owner: TransactionSigner;
  obligation: KaminoObligation | ObligationType;
  referrer?: Option<Address>;
  currentSlot: Slot;
  payer?: TransactionSigner;
}

/**
 * Props for KaminoAction.buildDepositTxns
 */
export interface BuildDepositTxnsProps {
  kaminoMarket: KaminoMarket;
  amount: string | BN;
  reserveAddress: Address;
  owner: TransactionSigner;
  obligation: KaminoObligation | ObligationType;
  useV2Ixs: boolean;
  scopeRefreshConfig: ScopePriceRefreshConfig | undefined;
  extraComputeBudget?: number;
  includeAtaIxs?: boolean;
  requestElevationGroup?: boolean;
  initUserMetadata?: { skipInitialization: boolean; skipLutCreation: boolean };
  referrer?: Option<Address>;
  currentSlot: Slot;
  overrideElevationGroupRequest?: number;
  obligationCustomizations?: ObligationCustomizations;
}

/**
 * Props for KaminoAction.buildBorrowTxns
 */
export interface BuildBorrowTxnsProps {
  kaminoMarket: KaminoMarket;
  amount: string | BN;
  reserveAddress: Address;
  owner: TransactionSigner;
  obligation: KaminoObligation | ObligationType;
  useV2Ixs: boolean;
  scopeRefreshConfig: ScopePriceRefreshConfig | undefined;
  extraComputeBudget?: number;
  includeAtaIxs?: boolean;
  requestElevationGroup?: boolean;
  initUserMetadata?: { skipInitialization: boolean; skipLutCreation: boolean };
  referrer?: Option<Address>;
  currentSlot: Slot;
  overrideElevationGroupRequest?: number;
  rollOver?: boolean;
  obligationCustomizations?: ObligationCustomizations;
}

/**
 * Props for KaminoAction.buildBorrowRolloverConfigIxs
 */
export interface BuildBorrowRolloverConfigIxsProps {
  reserve: KaminoReserve;
  rollover: boolean;
  owner: TransactionSigner;
  obligation: Address;
  lendingMarket: Address;
  programId: Address;
}

/**
 * Props for KaminoAction.buildDepositReserveLiquidityTxns
 */
export interface BuildDepositReserveLiquidityTxnsProps {
  kaminoMarket: KaminoMarket;
  amount: string | BN;
  reserveAddress: Address;
  owner: TransactionSigner;
  obligation: KaminoObligation | ObligationType;
  scopeRefreshConfig: ScopePriceRefreshConfig | undefined;
  extraComputeBudget?: number;
  includeAtaIxs?: boolean;
  requestElevationGroup?: boolean;
  referrer?: Option<Address>;
  currentSlot: Slot;
}

/**
 * Props for KaminoAction.buildRedeemReserveCollateralTxns
 */
export interface BuildRedeemReserveCollateralTxnsProps {
  kaminoMarket: KaminoMarket;
  amount: string | BN;
  reserveAddress: Address;
  owner: TransactionSigner;
  obligation: KaminoObligation | ObligationType;
  scopeRefreshConfig: ScopePriceRefreshConfig | undefined;
  extraComputeBudget?: number;
  includeAtaIxs?: boolean;
  requestElevationGroup?: boolean;
  referrer?: Option<Address>;
  currentSlot: Slot;
}

/**
 * Props for KaminoAction.buildWithdrawTxns
 */
export interface BuildWithdrawTxnsProps {
  kaminoMarket: KaminoMarket;
  amount: string | BN;
  reserveAddress: Address;
  owner: TransactionSigner;
  obligation: KaminoObligation | ObligationType;
  useV2Ixs: boolean;
  scopeRefreshConfig: ScopePriceRefreshConfig | undefined;
  extraComputeBudget?: number;
  includeAtaIxs?: boolean;
  requestElevationGroup?: boolean;
  initUserMetadata?: { skipInitialization: boolean; skipLutCreation: boolean };
  referrer?: Option<Address>;
  currentSlot: Slot;
  overrideElevationGroupRequest?: number;
  obligationCustomizations?: ObligationCustomizations;
}

/**
 * Props for KaminoAction.buildWithdrawFromObligationAndEnqueueTxns
 */
export interface BuildWithdrawFromObligationAndEnqueueTxnsProps {
  kaminoMarket: KaminoMarket;
  /** Amount of liquidity to withdraw (in base units). */
  withdrawAmount: string | BN;
  reserveAddress: Address;
  owner: TransactionSigner;
  obligation: KaminoObligation | ObligationType;
  scopeRefreshConfig: ScopePriceRefreshConfig | undefined;
  extraComputeBudget?: number;
  includeAtaIxs?: boolean;
  requestElevationGroup?: boolean;
  initUserMetadata?: { skipInitialization: boolean; skipLutCreation: boolean };
  referrer?: Option<Address>;
  currentSlot: Slot;
  userDestinationLiquidityAta?: Address;
  progressCallbackType?: ProgressCallbackType.None | ProgressCallbackType.KlendQueueAccountingHandlerOnKvault;
  progressCallbackCustomAccount0?: Option<Address>;
  progressCallbackCustomAccount1?: Option<Address>;
}

/**
 * Props for KaminoAction.buildRepayTxns
 */
export interface BuildRepayTxnsProps {
  kaminoMarket: KaminoMarket;
  amount: string | BN;
  reserveAddress: Address;
  owner: TransactionSigner;
  obligation: KaminoObligation | ObligationType;
  useV2Ixs: boolean;
  scopeRefreshConfig: ScopePriceRefreshConfig | undefined;
  currentSlot: Slot;
  extraComputeBudget?: number;
  includeAtaIxs?: boolean;
  requestElevationGroup?: boolean;
  payer?: TransactionSigner;
  initUserMetadata?: { skipInitialization: boolean; skipLutCreation: boolean };
  referrer?: Option<Address>;
}

/**
 * Props for KaminoAction.buildDepositAndBorrowTxns
 */
export interface BuildDepositAndBorrowTxnsProps {
  kaminoMarket: KaminoMarket;
  depositAmount: string | BN;
  depositReserveAddress: Address;
  borrowAmount: string | BN;
  borrowReserveAddress: Address;
  owner: TransactionSigner;
  obligation: KaminoObligation | ObligationType;
  useV2Ixs: boolean;
  scopeRefreshConfig: ScopePriceRefreshConfig | undefined;
  extraComputeBudget?: number;
  includeAtaIxs?: boolean;
  requestElevationGroup?: boolean;
  initUserMetadata?: { skipInitialization: boolean; skipLutCreation: boolean };
  referrer?: Option<Address>;
  currentSlot: Slot;
  rollOver?: boolean;
}

/**
 * Props for KaminoAction.buildRefreshObligationTxns
 */
export interface BuildRefreshObligationTxnsProps {
  kaminoMarket: KaminoMarket;
  payer: TransactionSigner;
  obligation: KaminoObligation;
  extraComputeBudget?: number;
  currentSlot: Slot;
}

/**
 * Props for KaminoAction.buildRequestElevationGroupTxns
 */
export interface BuildRequestElevationGroupTxnsProps {
  kaminoMarket: KaminoMarket;
  owner: TransactionSigner;
  obligation: KaminoObligation;
  elevationGroup: number;
  extraComputeBudget?: number;
  currentSlot: Slot;
}

/**
 * Props for KaminoAction.buildDepositAndWithdrawV2Txns
 */
export interface BuildDepositAndWithdrawV2TxnsProps {
  kaminoMarket: KaminoMarket;
  depositAmount: string | BN;
  depositReserveAddress: Address;
  withdrawAmount: string | BN;
  withdrawReserveAddress: Address;
  owner: TransactionSigner;
  currentSlot: Slot;
  obligation: KaminoObligation | ObligationType;
  scopeRefreshConfig: ScopePriceRefreshConfig | undefined;
  extraComputeBudget?: number;
  includeAtaIxs?: boolean;
  requestElevationGroup?: boolean;
  initUserMetadata?: { skipInitialization: boolean; skipLutCreation: boolean };
  referrer?: Option<Address>;
}

/**
 * Props for KaminoAction.buildRepayAndWithdrawTxns
 */
export interface BuildRepayAndWithdrawTxnsProps {
  kaminoMarket: KaminoMarket;
  repayAmount: string | BN;
  repayReserveAddress: Address;
  withdrawAmount: string | BN;
  withdrawReserveAddress: Address;
  payer: TransactionSigner;
  currentSlot: Slot;
  obligation: KaminoObligation | ObligationType;
  useV2Ixs: boolean;
  scopeRefreshConfig: ScopePriceRefreshConfig | undefined;
  extraComputeBudget?: number;
  includeAtaIxs?: boolean;
  requestElevationGroup?: boolean;
  initUserMetadata?: { skipInitialization: boolean; skipLutCreation: boolean };
  referrer?: Option<Address>;
}

/**
 * Props for KaminoAction.buildRepayAndWithdrawV2Txns
 */
export interface BuildRepayAndWithdrawV2TxnsProps {
  kaminoMarket: KaminoMarket;
  repayAmount: string | BN;
  repayReserveAddress: Address;
  withdrawAmount: string | BN;
  withdrawReserveAddress: Address;
  payer: TransactionSigner;
  currentSlot: Slot;
  obligation: KaminoObligation | ObligationType;
  scopeRefreshConfig: ScopePriceRefreshConfig | undefined;
  extraComputeBudget?: number;
  includeAtaIxs?: boolean;
  requestElevationGroup?: boolean;
  initUserMetadata?: { skipInitialization: boolean; skipLutCreation: boolean };
  referrer?: Option<Address>;
}

/**
 * Props for KaminoAction.buildLiquidateTxns
 */
export interface BuildLiquidateTxnsProps {
  kaminoMarket: KaminoMarket;
  amount: string | BN;
  minCollateralReceiveAmount: string | BN;
  repayReserveAddress: Address;
  withdrawReserveAddress: Address;
  liquidator: TransactionSigner;
  obligationOwner: Address;
  obligation: KaminoObligation | ObligationType;
  useV2Ixs: boolean;
  scopeRefreshConfig?: ScopePriceRefreshConfig;
  extraComputeBudget?: number;
  includeAtaIxs?: boolean;
  requestElevationGroup?: boolean;
  initUserMetadata?: { skipInitialization: boolean; skipLutCreation: boolean };
  referrer?: Option<Address>;
  maxAllowedLtvOverridePercent?: number;
  currentSlot: Slot;
}

/**
 * Props for KaminoAction.buildWithdrawReferrerFeeTxns
 */
export interface BuildWithdrawReferrerFeeTxnsProps {
  owner: TransactionSigner;
  reserveAddress: Address;
  kaminoMarket: KaminoMarket;
  currentSlot: Slot;
}

/**
 * Props for KaminoAction.buildDepositObligationCollateralTxns
 */
export interface BuildDepositObligationCollateralTxnsProps {
  kaminoMarket: KaminoMarket;
  amount: string | BN;
  reserveAddress: Address;
  owner: TransactionSigner;
  obligation: KaminoObligation | ObligationType;
  useV2Ixs: boolean;
  scopeRefreshConfig: ScopePriceRefreshConfig | undefined;
  extraComputeBudget?: number;
  includeAtaIxs?: boolean;
  requestElevationGroup?: boolean;
  initUserMetadata?: { skipInitialization: boolean; skipLutCreation: boolean };
  referrer?: Option<Address>;
  currentSlot: Slot;
}

/**
 * Props for KaminoAction.buildEnqueueToWithdrawIx
 */
export interface BuildEnqueueToWithdrawIxProps {
  owner: TransactionSigner;
  kaminoMarket: KaminoMarket;
  reserve: KaminoReserve;
  collateralAmount: BN;
  userDestinationLiquidityTa: Address;
  progressCallbackType?: ProgressCallbackType.None | ProgressCallbackType.KlendQueueAccountingHandlerOnKvault;
  progressCallbackCustomAccount0?: Option<Address>;
  progressCallbackCustomAccount1?: Option<Address>;
}

/**
 * Props for KaminoAction.buildWithdrawQueuedLiquidityIx
 */
export interface BuildWithdrawQueuedLiquidityIxProps {
  payer: TransactionSigner;
  kaminoMarket: KaminoMarket;
  reserve: KaminoReserve;
  withdrawTicket: Address;
  withdrawTicketOwner: Address;
  userDestinationLiquidity: Address;
  progressCallbackProgram?: Option<Address>;
  progressCallbackCustomAccount0?: Option<Address>;
  progressCallbackCustomAccount1?: Option<Address>;
}

/**
 * Props for KaminoAction.buildDepositAndSetBorrowOrderTxns
 */
export interface BuildDepositAndSetBorrowOrderTxnsProps {
  kaminoMarket: KaminoMarket;
  amount: string | BN;
  reserveAddress: Address;
  owner: TransactionSigner;
  obligation: KaminoObligation | ObligationType;
  borrowOrder: KaminoBorrowOrder;
  useV2Ixs: boolean;
  scopeRefreshConfig: ScopePriceRefreshConfig | undefined;
  minExpectedCurrentRemainingDebtAmount?: BN;
  extraComputeBudget?: number;
  includeAtaIxs?: boolean;
  requestElevationGroup?: boolean;
  initUserMetadata?: { skipInitialization: boolean; skipLutCreation: boolean };
  referrer?: Option<Address>;
  currentSlot: Slot;
  overrideElevationGroupRequest?: number;
}
