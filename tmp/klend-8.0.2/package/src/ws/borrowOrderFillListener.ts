import { type Address, type Commitment, type GetProgramAccountsApi, type Rpc, type Slot } from '@solana/kit';
import BN from 'bn.js';

import { Obligation } from '../@codegen/klend/accounts';
import { type ObligationLiquidity } from '../@codegen/klend/types';
import { PROGRAM_ID } from '../@codegen/klend/programId';
import { isNotNullPubkey } from '../utils';

import { Fraction } from '../classes/fraction';
import type { KaminoMarket } from '../classes/market';
import { type AccountSubscriptionManager } from './accountSubscriptionManager';
import { toBuffer } from './utils';
import { createManagerSubscription } from './createManagerSubscription';
import { buildObligationFilters } from './obligationListener';
import type { SubscriptionHandle } from './subscriptionHandle';

export type BorrowOrderFillType = 'partial' | 'full';

export interface BorrowOrderFillEvent {
  obligation: Obligation;
  fillType: BorrowOrderFillType;
  debtLiquidityMint: Address;
  filledAmount: BN;
  remainingDebtAmount: BN;
  requestedDebtAmount: BN;
  slot: Slot;
}

export type BorrowOrderFillCallback = (event: BorrowOrderFillEvent) => void;
export type BorrowOrderFillErrorCallback = (error: unknown) => void;

export interface BorrowOrderFillListenerParams {
  /** Shared subscription manager — WS lifecycle is delegated here */
  manager: AccountSubscriptionManager;
  /** HTTP RPC for seeding initial obligation states */
  rpc: Rpc<GetProgramAccountsApi>;
  markets: KaminoMarket[];
  owner: Address;
  onFill: BorrowOrderFillCallback;
  onError?: BorrowOrderFillErrorCallback;
  programId?: Address;
  initialStates?: Map<Address, Obligation>;
  commitment?: Commitment;
}

// --- Fill detection helpers ---

const lamportsToSf = (lamports: BN): BN => lamports.shln(Fraction.FRACTIONS);

function hasBorrowForMintIncreasedByAtLeast(
  prevBorrows: ObligationLiquidity[],
  currBorrows: ObligationLiquidity[],
  debtLiquidityMint: Address,
  reserveToMint: Map<Address, Address>,
  minIncreaseLamports: BN
): boolean {
  const minIncreaseSf = lamportsToSf(minIncreaseLamports);
  for (const curr of currBorrows) {
    if (!isNotNullPubkey(curr.borrowReserve)) continue;
    if (reserveToMint.get(curr.borrowReserve) !== debtLiquidityMint) continue;

    const prev = prevBorrows.find((p) => p.borrowReserve === curr.borrowReserve);
    if (!prev || !isNotNullPubkey(prev.borrowReserve)) {
      if (curr.borrowedAmountSf.gte(minIncreaseSf)) return true;
      continue;
    }
    if (curr.borrowedAmountSf.sub(prev.borrowedAmountSf).gte(minIncreaseSf)) return true;
  }
  return false;
}

function buildReserveToMintMap(markets: KaminoMarket[]): Map<Address, Map<Address, Address>> {
  const marketMaps = new Map<Address, Map<Address, Address>>();
  for (const market of markets) {
    const reserveToMint = new Map<Address, Address>();
    for (const [reserveAddress, reserve] of market.reserves) {
      reserveToMint.set(reserveAddress, reserve.getLiquidityMint());
    }
    marketMaps.set(market.getAddress(), reserveToMint);
  }
  return marketMaps;
}

async function fetchInitialObligationStates(
  rpc: Rpc<GetProgramAccountsApi>,
  programId: Address,
  owner: Address,
  commitment: Commitment = 'confirmed'
): Promise<Map<Address, Obligation>> {
  const results = await rpc
    .getProgramAccounts(programId, {
      commitment,
      filters: buildObligationFilters(owner),
      encoding: 'base64',
    })
    .send();

  const states = new Map<Address, Obligation>();
  for (const result of results) {
    if (result.account.owner !== programId) continue;
    const obligation = Obligation.decode(Buffer.from(result.account.data[0], 'base64'));
    if (obligation) states.set(result.pubkey, obligation);
  }
  return states;
}

// --- Fill detection logic ---

function detectFill(
  current: Obligation,
  previous: Obligation,
  reserveToMintByMarket: Map<Address, Map<Address, Address>>
): Omit<BorrowOrderFillEvent, 'slot'> | null {
  const prevRemaining = previous.borrowOrder.remainingDebtAmount;
  if (prevRemaining.isZero()) return null;

  const currRemaining = current.borrowOrder.remainingDebtAmount;
  const reserveToMint = reserveToMintByMarket.get(current.lendingMarket);
  if (!reserveToMint) return null;

  // Partial fill: remaining decreased but still > 0
  if (currRemaining.gt(new BN(0)) && currRemaining.lt(prevRemaining)) {
    const debtMint = previous.borrowOrder.debtLiquidityMint;
    const filledAmount = prevRemaining.sub(currRemaining);
    if (hasBorrowForMintIncreasedByAtLeast(previous.borrows, current.borrows, debtMint, reserveToMint, filledAmount)) {
      return {
        obligation: current,
        fillType: 'partial',
        debtLiquidityMint: debtMint,
        filledAmount,
        remainingDebtAmount: currRemaining,
        requestedDebtAmount: current.borrowOrder.requestedDebtAmount,
      };
    }
  }

  // Full fill: order zeroed AND borrow increased
  if (currRemaining.isZero() && current.borrowOrder.active === 0) {
    const debtMint = previous.borrowOrder.debtLiquidityMint;
    if (hasBorrowForMintIncreasedByAtLeast(previous.borrows, current.borrows, debtMint, reserveToMint, prevRemaining)) {
      return {
        obligation: current,
        fillType: 'full',
        debtLiquidityMint: debtMint,
        filledAmount: prevRemaining,
        remainingDebtAmount: new BN(0),
        requestedDebtAmount: previous.borrowOrder.requestedDebtAmount,
      };
    }
  }

  return null;
}

/**
 * Listen for borrow order fills via the shared AccountSubscriptionManager.
 *
 * Seeds initial obligation states via HTTP, then subscribes to the manager
 * for real-time notifications. State diffing detects partial and full fills.
 *
 * On WS reconnect, re-fetches obligation states via HTTP to avoid stale diffs
 * (e.g. multiple fills during downtime being misclassified as one).
 */
export async function listenToBorrowOrderFills(params: BorrowOrderFillListenerParams): Promise<SubscriptionHandle> {
  const programId = params.programId ?? PROGRAM_ID;
  const commitment = params.commitment ?? 'confirmed';
  const reserveToMintByMarket = buildReserveToMintMap(params.markets);
  let previousStates =
    params.initialStates ?? (await fetchInitialObligationStates(params.rpc, programId, params.owner, commitment));

  return createManagerSubscription<BorrowOrderFillEvent>({
    manager: params.manager,
    programId,
    filters: buildObligationFilters(params.owner),
    commitment,
    onReconnect: async () => {
      previousStates = await fetchInitialObligationStates(params.rpc, programId, params.owner, commitment);
    },
    decode: (address, buffer, slot) => {
      // Raw Obligation.decode (not KaminoObligation.fromAccountData) — fill
      // detection only needs borrow positions, not full hydration.
      const current = Obligation.decode(toBuffer(buffer));
      const previous = previousStates.get(address);
      previousStates.set(address, current);
      if (!previous) return undefined;
      const fill = detectFill(current, previous, reserveToMintByMarket);
      return fill ? { ...fill, slot } : undefined;
    },
    onChange: params.onFill,
    onError: params.onError,
    errorPrefix: '[listenToBorrowOrderFills]',
  });
}
