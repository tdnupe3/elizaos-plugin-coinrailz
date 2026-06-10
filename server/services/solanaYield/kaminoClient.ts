/**
 * Kamino Lending Client — Coin Railz Solana Yield Portal
 * ISOLATED: No shared code with Base/EVM yield vault.
 * Uses @kamino-finance/klend-sdk v5.10.25 (web3.js v1 compatible)
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
  DEFAULT_MARKET:      '7u3HeL2w6R5n41F89LGa5bCXJxmMTMGSFjcP6A9WDvNR',
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

  const marketAddr = process.env.SOLANA_YIELD_KAMINO_MARKET || SOLANA_YIELD_CONFIG.DEFAULT_MARKET;
  const connection = getSolanaYieldConnection();

  const market = await KaminoMarket.load(
    connection,
    new PublicKey(marketAddr),
    DEFAULT_RECENT_SLOT_DURATION_MS,
    KAMINO_PROGRAM_ID,
    false,
    true,
  );

  if (!market) throw new Error(`Failed to load Kamino market: ${marketAddr}`);

  _cachedMarket  = market;
  _cacheExpiry   = Date.now() + CACHE_TTL_MS;
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
}

export async function getUsdcReserveStats(): Promise<ReserveStats> {
  const market  = await getKaminoMarket();
  const reserve = market.getReserveByMint(USDC_MINT);
  if (!reserve) throw new Error('USDC reserve not found in Kamino market');

  const depositTvl     = Number(reserve.getDepositTvl().toString());
  const available      = Number(reserve.getLiquidityAvailableAmount().toString());
  const total          = depositTvl > 0 ? depositTvl : 1;
  const utilizationPct = ((total - available) / total) * 100;

  return {
    market:                  market.address.toString(),
    reserve:                 reserve.address.toString(),
    collateralMint:          reserve.state.collateral.mintPubkey.toString(),
    depositTvlUsdc:          depositTvl,
    availableLiquidityUsdc:  available,
    utilizationPct:          Math.max(0, Math.min(100, utilizationPct)),
  };
}
