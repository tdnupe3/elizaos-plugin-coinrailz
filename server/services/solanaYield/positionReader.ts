/**
 * Solana Yield Position Reader
 * ISOLATED: reads Kamino obligation state for a wallet — no shared EVM code.
 */

import { PublicKey } from '@solana/web3.js';
import { VanillaObligation } from '@kamino-finance/klend-sdk';
import { getKaminoMarket, SOLANA_YIELD_CONFIG } from './kaminoClient.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PositionSummary {
  wallet:              string;
  hasPosition:         boolean;
  depositedUsdc:       number;
  currentValueUsdc:    number;
  collateralMint:      string | null;
  obligationAddress:   string | null;
  protocol:            'Kamino Lending';
  chain:               'solana';
  network:             'mainnet-beta';
}

export interface MarketSummary {
  protocol:               string;
  chain:                  string;
  market:                 string;
  reserve:                string;
  collateralMint:         string;
  depositTvlUsdc:         number;
  availableLiquidityUsdc: number;
  utilizationPct:         number;
  minDepositUsdc:         number;
  depositFeePct:          string;
  withdrawFeePct:         string;
  performanceFeePct:      string;
}

// ── Position Reader ───────────────────────────────────────────────────────────

export async function readPosition(walletAddress: string): Promise<PositionSummary> {
  const base: PositionSummary = {
    wallet:            walletAddress,
    hasPosition:       false,
    depositedUsdc:     0,
    currentValueUsdc:  0,
    collateralMint:    null,
    obligationAddress: null,
    protocol:          'Kamino Lending',
    chain:             'solana',
    network:           'mainnet-beta',
  };

  try {
    const owner   = new PublicKey(walletAddress);
    const market  = await getKaminoMarket();
    const oblType = new VanillaObligation(SOLANA_YIELD_CONFIG.PROGRAM_ID);

    const obligation = await market.getObligationByWallet(owner, oblType);
    if (!obligation) return base;

    const deposited = await market.getObligationDepositByWallet(
      owner,
      SOLANA_YIELD_CONFIG.USDC_MINT,
      oblType,
    );

    const reserve      = market.getReserveByMint(SOLANA_YIELD_CONFIG.USDC_MINT);
    const collMint     = reserve?.state.collateral.mintPubkey.toString() ?? null;
    const currentValue = Number(deposited.toString()) / Math.pow(10, SOLANA_YIELD_CONFIG.USDC_DECIMALS);

    return {
      ...base,
      hasPosition:       currentValue > 0,
      depositedUsdc:     currentValue,
      currentValueUsdc:  currentValue,
      collateralMint:    collMint,
      obligationAddress: obligation.obligationAddress.toString(),
    };
  } catch {
    return base;
  }
}

// ── Market Summary ────────────────────────────────────────────────────────────

export async function getMarketSummary(): Promise<MarketSummary> {
  const market  = await getKaminoMarket();
  const reserve = market.getReserveByMint(SOLANA_YIELD_CONFIG.USDC_MINT);
  if (!reserve) throw new Error('USDC reserve not found in Kamino market');

  const depositTvlRaw = Number(reserve.getTotalSupply().toString());
  const availableRaw  = Number(reserve.getLiquidityAvailableAmount().toString());
  const depositTvl    = depositTvlRaw / 1e6;
  const available     = availableRaw  / 1e6;
  const total         = depositTvl > 0 ? depositTvl : 1;
  const utilPct       = Math.max(0, Math.min(100, ((total - available) / total) * 100));

  return {
    protocol:               'Kamino Lending',
    chain:                  'solana',
    market:                 market.address.toString(),
    reserve:                reserve.address.toString(),
    collateralMint:         reserve.state.collateral.mintPubkey.toString(),
    depositTvlUsdc:         depositTvl,
    availableLiquidityUsdc: available,
    utilizationPct:         utilPct,
    minDepositUsdc:         SOLANA_YIELD_CONFIG.MIN_DEPOSIT_RAW / 1e6,
    depositFeePct:          (SOLANA_YIELD_CONFIG.DEPOSIT_FEE_BPS / 100).toFixed(2),
    withdrawFeePct:         (SOLANA_YIELD_CONFIG.WITHDRAW_FEE_BPS / 100).toFixed(2),
    performanceFeePct:      (SOLANA_YIELD_CONFIG.PERF_FEE_BPS / 100).toFixed(0),
  };
}
