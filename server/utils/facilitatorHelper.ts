/**
 * Shared Facilitator URL Helper
 * 
 * CRITICAL: Coinbase Bazaar ONLY indexes services advertising:
 * - facilitator.cdp.coinbase.com (production CDP)
 * 
 * When CDP_API_KEY_ID is configured, we use the CDP facilitator.
 * Otherwise, fall back to x402.org/facilitator for testing.
 * 
 * This hybrid approach ensures:
 * 1. Production services appear in Bazaar marketplace
 * 2. Local development still works with x402.org fallback
 */

const CDP_FACILITATOR_URL = 'https://facilitator.cdp.coinbase.com';
const FALLBACK_FACILITATOR_URL = 'https://x402.org/facilitator';

/**
 * Get the appropriate facilitator URL based on environment
 * @returns CDP facilitator URL if CDP credentials are configured, otherwise x402.org fallback
 */
export function getFacilitatorUrl(): string {
  return process.env.CDP_API_KEY_ID 
    ? CDP_FACILITATOR_URL 
    : FALLBACK_FACILITATOR_URL;
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
