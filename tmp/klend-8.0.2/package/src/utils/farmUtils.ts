import { Address, Rpc, Slot, SolanaRpcApi } from '@solana/kit';
import { Decimal } from 'decimal.js';
import {
  DEFAULT_PUBLIC_KEY,
  FarmIncentives,
  Farms,
  FarmState,
  getFarmIncentives,
  getFarmIncentivesWithExistentState,
} from '@kamino-finance/farms-sdk';
import { Reserve } from '../@codegen/klend/accounts';
import { KaminoReserve } from '../lib';

// Keep caller-supplied farm clients structural so linked SDK consumers do not hit
// nominal type errors from duplicate @kamino-finance/farms-sdk installs.
export type FarmsClient = Pick<Farms, 'getConnection' | 'getProgramID' | 'getAllUserStatesForFarm'>;

export interface ReserveIncentives {
  collateralFarmIncentives: FarmIncentives;
  debtFarmIncentives: FarmIncentives;
}

function toFarmsClient(farmsClient: FarmsClient): Farms {
  return new Farms(farmsClient.getConnection(), farmsClient.getProgramID());
}

export async function getFarmIncentivesForClient(
  farmsClient: FarmsClient,
  farm: Address,
  stakedTokenPrice: Decimal,
  stakedTokenMintDecimals: number,
  pricesMap?: Map<Address, Decimal>
): Promise<FarmIncentives> {
  return getFarmIncentives(toFarmsClient(farmsClient), farm, stakedTokenPrice, stakedTokenMintDecimals, pricesMap);
}

export async function getFarmIncentivesWithExistentStateForClient(
  farmsClient: FarmsClient,
  farm: Address,
  farmState: FarmState,
  stakedTokenPrice: Decimal,
  stakedTokenMintDecimals: number,
  pricesMap?: Map<Address, Decimal>
): Promise<FarmIncentives> {
  return getFarmIncentivesWithExistentState(
    toFarmsClient(farmsClient),
    farm,
    farmState,
    stakedTokenPrice,
    stakedTokenMintDecimals,
    pricesMap
  );
}

export async function getReserveFarmRewardsAPY(
  rpc: Rpc<SolanaRpcApi>,
  recentSlotDurationMs: number,
  reserve: Address,
  reserveLiquidityTokenPrice: Decimal,
  farmsClient: FarmsClient,
  slot: Slot,
  reserveState: Reserve,
  tokensPrices?: Map<Address, Decimal>
): Promise<ReserveIncentives> {
  const reserveIncentives: ReserveIncentives = {
    collateralFarmIncentives: {
      incentivesStats: [],
      totalIncentivesApy: 0,
    },
    debtFarmIncentives: {
      incentivesStats: [],
      totalIncentivesApy: 0,
    },
  };

  const kaminoReserve = await KaminoReserve.initializeFromAddress(reserve, rpc, recentSlotDurationMs, reserveState);

  const farmCollateral = kaminoReserve.state.farmCollateral;
  const farmDebt = kaminoReserve.state.farmDebt;

  const stakedTokenMintDecimals = kaminoReserve.getMintDecimals();
  const reserveCtokenPrice = reserveLiquidityTokenPrice.div(kaminoReserve.getEstimatedCollateralExchangeRate(slot, 0));

  if (farmCollateral !== DEFAULT_PUBLIC_KEY) {
    const farmIncentivesCollateral = await getFarmIncentivesForClient(
      farmsClient,
      farmCollateral,
      reserveCtokenPrice,
      stakedTokenMintDecimals,
      tokensPrices
    );
    reserveIncentives.collateralFarmIncentives = farmIncentivesCollateral;
  }

  if (farmDebt !== DEFAULT_PUBLIC_KEY) {
    const farmIncentivesDebt = await getFarmIncentivesForClient(
      farmsClient,
      farmDebt,
      reserveLiquidityTokenPrice,
      stakedTokenMintDecimals,
      tokensPrices
    );
    reserveIncentives.debtFarmIncentives = farmIncentivesDebt;
  }

  return reserveIncentives;
}
