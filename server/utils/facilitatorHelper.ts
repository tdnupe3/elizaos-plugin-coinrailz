/**
 * Shared Facilitator URL Helper
 * 
 * CRITICAL FIX (Jan 11, 2026): x402.org is now DEAD (returns 404)
 * The x402 V2 migration made x402.org testnet-only.
 * 
 * NEW STRATEGY:
 * - Use CDP facilitator as PRIMARY (we have credentials, it works)
 * - Agents submit payments to CDP, which Coin Railz verifies using our API keys
 * - This means visiting agents don't need their own CDP auth - WE handle it
 * 
 * Previous Dec 19 fix was for compatibility, but x402.org being dead
 * means there's nothing to be compatible WITH anymore.
 */

const CDP_FACILITATOR_URL = 'https://api.cdp.coinbase.com/platform/v2/x402';
const PUBLIC_FACILITATOR_URL = 'https://x402.org/facilitator';
const DEXTER_FACILITATOR_URL = 'https://x402.dexter.cash';

/**
 * Get the PRIMARY facilitator URL for 402 responses
 * Uses CDP when we have credentials (which we do)
 * Falls back to x402.org only if no CDP credentials
 */
export function getFacilitatorUrl(): string {
  // Use CDP facilitator when we have credentials - x402.org is dead
  if (process.env.CDP_API_KEY_ID && process.env.CDP_API_KEY_SECRET) {
    return CDP_FACILITATOR_URL;
  }
  // Fallback to public (though it's currently broken)
  return PUBLIC_FACILITATOR_URL;
}

/**
 * Get the Dexter facilitator URL (dominant Solana + Base facilitator, ~50% of daily x402 volume)
 */
export function getDexterFacilitatorUrl(): string {
  return DEXTER_FACILITATOR_URL;
}

/**
 * Get all supported facilitator URLs (for discovery endpoints)
 * Includes CDP (primary) and Dexter (dominant market facilitator)
 */
export function getAllFacilitatorUrls(): string[] {
  return [CDP_FACILITATOR_URL, DEXTER_FACILITATOR_URL];
}

/**
 * Get the CDP facilitator URL specifically (for Bazaar registration)
 * Updated to V2 API endpoint (Jan 2026)
 */
export function getCdpFacilitatorUrl(): string {
  return 'https://api.cdp.coinbase.com/platform/v2/x402';
}

/**
 * Get the verification endpoint for the configured facilitator
 */
export function getFacilitatorVerifyUrl(): string {
  return `${getFacilitatorUrl()}/verify`;
}

/**
 * Check if we're using CDP facilitator (production mode)
 */
export function isUsingCdpFacilitator(): boolean {
  return !!process.env.CDP_API_KEY_ID;
}

/**
 * Network format for x402 V2 specification
 * CRITICAL: x402-fetch v0.7.3 only accepts legacy network names ("base", "polygon")
 * NOT the CAIP-2 format ("eip155:8453")
 * 
 * Always use DUAL format in 402 responses:
 * - network: "base" (legacy for x402-fetch compatibility)
 * - x402Network: "eip155:8453" (V2 spec compliance)
 * 
 * NOTE ON ARBITRUM: "arbitrum" is NOT in the x402 NetworkSchema enum (as of x402@1.2.0).
 * Adding it to the 402 accepts[] would break all x402-fetch clients (ZodError on parse).
 * Arbitrum is supported as a BACKEND-VERIFIED OUT-OF-BAND payment network only:
 * - Agents can send USDC on Arbitrum and submit the txHash in X-PAYMENT header
 * - We verify via Alchemy Arbitrum RPC and record the payment correctly
 * - Arbitrum does NOT appear in the 402 accepts[] until x402 ecosystem adds it to NetworkSchema
 */
export const NETWORK_LEGACY = 'base';
export const NETWORK_CAIP2 = 'eip155:8453';

export const ETHEREUM_NETWORK_LEGACY = 'ethereum';
export const ETHEREUM_NETWORK_CAIP2 = 'eip155:1';

export const ARBITRUM_NETWORK_LEGACY = 'arbitrum';
export const ARBITRUM_NETWORK_CAIP2 = 'eip155:42161';

export const SUPPORTED_EVM_NETWORKS = {
  ethereum: { caip2: 'eip155:1', chainId: 1, name: 'Ethereum' },
  base: { caip2: 'eip155:8453', chainId: 8453, name: 'Base' },
  arbitrum: { caip2: 'eip155:42161', chainId: 42161, name: 'Arbitrum One' },
} as const;

// Ethereum L1 Stablecoin Addresses
export const USDC_ETHEREUM_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
export const USDT_ETHEREUM_ADDRESS = '0xdAC17F958D2ee523a2206206994597C13D831ec7';

// Base (EVM) Stablecoin Addresses
export const USDC_BASE_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
export const USDT_BASE_ADDRESS = '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2';

// Arbitrum One Stablecoin Addresses (verified on-chain: 0xaf88... returns symbol "USDC")
export const USDC_ARBITRUM_ADDRESS = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';
export const USDT_ARBITRUM_ADDRESS = '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9';

// Solana Stablecoin Mint Addresses
export const USDC_SOLANA_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
export const USDT_SOLANA_MINT = 'Es9vMFrzaCERmnn4Xw4Jp9Dzk1XjCK8dygBBhPokv9wg';

// Platform wallet addresses for each chain (same EVM address works on Ethereum, Base, and Arbitrum)
export const PLATFORM_WALLETS = {
  ethereum: process.env.PLATFORM_WALLET_ADDRESS || '0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91',
  base: process.env.PLATFORM_WALLET_ADDRESS || '0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91',
  arbitrum: process.env.PLATFORM_WALLET_ADDRESS || '0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91',
  // Migration rule: DEXTER_SOLANA_WALLET is authoritative. SOLANA_PUBLIC_KEY
  // remains a lower-priority compatibility fallback until deployments migrate.
  // Every payment and discovery surface imports this single resolved recipient.
  solana:
    process.env.DEXTER_SOLANA_WALLET
    || process.env.SOLANA_PUBLIC_KEY
    || 'BmUPzSupHJu2kW4cL27dF7Vc2JaZTwXKzFsRuagPDtL8',
} as const;

// Accepted only when verifying historical Solana payments issued before the
// active-recipient migration. Never advertise these addresses to new payers.
export const LEGACY_SOLANA_PAYMENT_RECIPIENTS = [
  'Hgby7VEo6vaPayM1G7kkjTqMAo4aCARoXA3ftWKz1m4k',
] as const;

// Stablecoin configurations per chain
export const STABLECOIN_CONFIG = {
  ethereum: {
    USDC: { address: USDC_ETHEREUM_ADDRESS, decimals: 6, supportsEIP3009: true },
    USDT: { address: USDT_ETHEREUM_ADDRESS, decimals: 6, supportsEIP3009: false },
  },
  base: {
    USDC: { address: USDC_BASE_ADDRESS, decimals: 6, supportsEIP3009: true },
    USDT: { address: USDT_BASE_ADDRESS, decimals: 6, supportsEIP3009: false },
  },
  arbitrum: {
    USDC: { address: USDC_ARBITRUM_ADDRESS, decimals: 6, supportsEIP3009: true },
    USDT: { address: USDT_ARBITRUM_ADDRESS, decimals: 6, supportsEIP3009: false },
  },
  solana: {
    USDC: { mint: USDC_SOLANA_MINT, decimals: 6 },
    USDT: { mint: USDT_SOLANA_MINT, decimals: 6 },
  },
} as const;

export type SupportedChain = keyof typeof PLATFORM_WALLETS;
export type SupportedToken = 'USDC' | 'USDT';
