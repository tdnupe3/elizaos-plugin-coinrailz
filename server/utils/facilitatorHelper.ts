/**
 * Shared Facilitator URL Helper
 * 
 * CRITICAL FIX (Dec 19, 2025): We must support BOTH facilitators!
 * - CDP agents need facilitator.cdp.coinbase.com
 * - Public x402 agents (python-httpx, zauthx402-agent) need x402.org/facilitator
 * 
 * Traffic dropped 97% (728 → 3 interactions) after switching to CDP-only on Dec 16.
 * Public agents couldn't authenticate with CDP facilitator and stopped calling us.
 * 
 * Solution: Advertise public facilitator as primary (for broad compatibility)
 * while still accepting CDP payments for Bazaar-indexed agents.
 */

const CDP_FACILITATOR_URL = 'https://facilitator.cdp.coinbase.com';
const PUBLIC_FACILITATOR_URL = 'https://x402.org/facilitator';

/**
 * Get the PRIMARY facilitator URL for 402 responses
 * Uses public x402.org for broad agent compatibility
 * CDP agents can still use their facilitator - we accept both payment formats
 */
export function getFacilitatorUrl(): string {
  // Always advertise public facilitator for maximum agent compatibility
  // CDP agents will use their own facilitator regardless of what we advertise
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
 */
export function getCdpFacilitatorUrl(): string {
  return CDP_FACILITATOR_URL;
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

export const USDC_BASE_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
export const USDT_BASE_ADDRESS = '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2';
