/**
 * Kamino Lending Client — Coin Railz Solana Yield Portal
 * ISOLATED: No shared code with Base/EVM yield vault.
 * Uses @kamino-finance/klend-sdk v5.10.25 (web3.js v1 compatible)
 *
 * Market loading strategy:
 *  - KaminoMarket.load() arg5 = setupLocalTest (true = skip Scope price oracle init)
 *  - KaminoMarket.load() arg6 = withReserves   (false = skip bulk loading all 55 reserves)
 *  - After load, call reloadSingleReserve(USDC_RESERVE) to load only the USDC reserve.
 *  - Loading all 55 reserves with prices causes a DecimalError in buildDepositTxns
 *    because one or more reserves has an undefined oracle config field.
 */

import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { KaminoMarket, DEFAULT_RECENT_SLOT_DURATION_MS } from '@kamino-finance/klend-sdk';
import bs58 from 'bs58';

// ── Constants ─────────────────────────────────────────────────────────────────

export const KAMINO_PROGRAM_ID = new PublicKey('KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD');
export const USDC_MINT         = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

export const SOLANA_YIELD_CONFIG = {
  USDC_MINT,
  USDC_DECIMALS:       6,
  MIN_DEPOSIT_RAW:     5_000_000,  // $5 USDC (6 decimals)
  DEPOSIT_FEE_BPS:     50,         // 0.50% — matches Base vault
  WITHDRAW_FEE_BPS:    50,         // 0.50% — matches Base vault
  PERF_FEE_BPS:        1500,       // 15% of yield — matches Base vault
  PROGRAM_ID:          KAMINO_PROGRAM_ID,
  // Kamino main market on Solana mainnet (from @kamino-finance/klend-sdk src/client.ts MAINNET_LENDING_MARKET)
  DEFAULT_MARKET:      '7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF',
  // USDC reserve within the main market (verified on-chain June 2026)
  DEFAULT_USDC_RESERVE: 'D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59',
};

// ── Platform Wallet ───────────────────────────────────────────────────────────

/**
 * Derive or look up the platform Solana wallet that receives fees.
 * Priority: SOLANA_FEE_WALLET env var (explicit pubkey) → derive from SOLANA_PRIVATE_KEY.
 * Returns null only if neither is configured (non-fatal — fee deducted but not swept).
 */
export function getPlatformSolanaWallet(): PublicKey | null {
  const explicit = process.env.SOLANA_FEE_WALLET;
  if (explicit) {
    try { return new PublicKey(explicit); } catch { /* fall through */ }
  }

  const raw = process.env.SOLANA_PRIVATE_KEY;
  if (!raw) return null;

  try {
    let secretKey: Uint8Array;
    // base58 keypair strings are 85–90 chars
    if (raw.length >= 85 && raw.length <= 90) {
      secretKey = bs58.decode(raw);
    } else {
      secretKey = new Uint8Array(JSON.parse(raw));
    }
    const kp = Keypair.fromSecretKey(secretKey);
    return kp.publicKey;
  } catch (err: any) {
    console.warn('[kaminoClient] getPlatformSolanaWallet failed to parse SOLANA_PRIVATE_KEY:', err.message);
    return null;
  }
}

// ── Connection ────────────────────────────────────────────────────────────────

export function getSolanaYieldConnection(): Connection {
  const rpcUrl =
    process.env.SOLANA_YIELD_RPC_URL ||
    process.env.SOLANA_RPC_URL ||
    (process.env.HELIUS_API_KEY
      ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
      : 'https://api.mainnet-beta.solana.com');
  return new Connection(rpcUrl, 'confirmed');
}

// ── Market Cache (5 min TTL) ──────────────────────────────────────────────────

let _cachedMarket: KaminoMarket | null = null;
let _cacheExpiry   = 0;
const CACHE_TTL_MS = 5 * 60 * 1_000;

export async function getKaminoMarket(forceRefresh = false): Promise<KaminoMarket> {
  if (!forceRefresh && _cachedMarket && Date.now() < _cacheExpiry) {
    return _cachedMarket;
  }

  const paused = process.env.SOLANA_YIELD_PAUSED === 'true';
  if (paused) throw new Error('Solana yield portal is currently paused');

  const marketAddr  = process.env.SOLANA_YIELD_KAMINO_MARKET  || SOLANA_YIELD_CONFIG.DEFAULT_MARKET;
  const reserveAddr = process.env.SOLANA_YIELD_USDC_RESERVE   || SOLANA_YIELD_CONFIG.DEFAULT_USDC_RESERVE;
  const connection  = getSolanaYieldConnection();

  // setupLocalTest=true  → skips Scope price-oracle initialisation (not needed for tx building)
  // withReserves=false   → skips bulk-loading all 55 market reserves; we load only USDC below
  // Loading all reserves with withReserves=true causes a DecimalError in buildDepositTxns
  // because at least one reserve in the 55-reserve set has an undefined oracle config field.
  const market = await KaminoMarket.load(
    connection,
    new PublicKey(marketAddr),
    DEFAULT_RECENT_SLOT_DURATION_MS,
    KAMINO_PROGRAM_ID,
    true,   // setupLocalTest — skips Scope init
    false,  // withReserves  — we load only the USDC reserve below
  );

  if (!market) throw new Error(`Failed to load Kamino market: ${marketAddr}`);

  // Load only the USDC reserve — verified to work with buildDepositTxns
  await market.reloadSingleReserve(new PublicKey(reserveAddr));

  _cachedMarket = market;
  _cacheExpiry  = Date.now() + CACHE_TTL_MS;
  return market;
}

export function invalidateMarketCache(): void {
  _cachedMarket = null;
  _cacheExpiry  = 0;
}

// ── Reserve Helpers ───────────────────────────────────────────────────────────

export interface ReserveStats {
  market:        string;
  reserve:       string;
  collateralMint: string;
  depositTvlUsdc: number;
  availableLiquidityUsdc: number;
  utilizationPct: number;
  supplyApr: number;
}

export async function getUsdcReserveStats(): Promise<ReserveStats> {
  const market  = await getKaminoMarket();
  const reserveAddr = process.env.SOLANA_YIELD_USDC_RESERVE || SOLANA_YIELD_CONFIG.DEFAULT_USDC_RESERVE;
  const reserve = market.getReserveByMint(USDC_MINT) || market.getReserveByAddress(new PublicKey(reserveAddr));
  if (!reserve) throw new Error('USDC reserve not found in Kamino market');

  // getTotalSupply() is the reliable total supply (doesn't need prices)
  // getLiquidityAvailableAmount() is available un-borrowed liquidity
  const supply    = Number(reserve.getTotalSupply().toString());
  const available = Number(reserve.getLiquidityAvailableAmount().toString());
  const utilizationPct = supply > 0 ? ((supply - available) / supply) * 100 : 0;

  // calculateSupplyAPR is the correct method in klend-sdk v5.10.25
  let supplyApr = 0;
  try {
    supplyApr = Number(reserve.calculateSupplyAPR().toString());
  } catch { /* non-fatal — APR not critical for tx building */ }

  return {
    market:                  market.address.toString(),
    reserve:                 reserve.address.toString(),
    collateralMint:          reserve.state.collateral.mintPubkey.toString(),
    depositTvlUsdc:          supply,
    availableLiquidityUsdc:  available,
    utilizationPct:          Math.max(0, Math.min(100, utilizationPct)),
    supplyApr,
  };
}
