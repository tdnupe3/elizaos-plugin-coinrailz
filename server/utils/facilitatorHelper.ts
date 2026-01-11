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
 * Get all supported facilitator URLs (for discovery endpoints)
 */
export function getAllFacilitatorUrls(): string[] {
  return [PUBLIC_FACILITATOR_URL, CDP_FACILITATOR_URL];
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
 */
export const NETWORK_LEGACY = 'base';
export const NETWORK_CAIP2 = 'eip155:8453';

// Base (EVM) Stablecoin Addresses
export const USDC_BASE_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
export const USDT_BASE_ADDRESS = '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2';

// Solana Stablecoin Mint Addresses
export const USDC_SOLANA_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
export const USDT_SOLANA_MINT = 'Es9vMFrzaCERmnn4Xw4Jp9Dzk1XjCK8dygBBhPokv9wg';

// Platform wallet addresses for each chain
export const PLATFORM_WALLETS = {
  base: '0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91',
  solana: 'Hgby7VEo6vaPayM1G7kkjTqMAo4aCARoXA3ftWKz1m4k',
} as const;

// Stablecoin configurations per chain
export const STABLECOIN_CONFIG = {
  base: {
    USDC: { address: USDC_BASE_ADDRESS, decimals: 6, supportsEIP3009: true },
    USDT: { address: USDT_BASE_ADDRESS, decimals: 6, supportsEIP3009: false },
  },
  solana: {
    USDC: { mint: USDC_SOLANA_MINT, decimals: 6 },
    USDT: { mint: USDT_SOLANA_MINT, decimals: 6 },
  },
} as const;

export type SupportedChain = keyof typeof PLATFORM_WALLETS;
export type SupportedToken = 'USDC' | 'USDT';
