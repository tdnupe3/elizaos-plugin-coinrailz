/**
 * Canary wallet address utility
 *
 * Lazily derives the canary payer address from X402_BUYER_PRIVATE_KEY.
 * Import `isCanaryPayer(address)` anywhere a payment intent is recorded to tag
 * canary payments so they are excluded from organic analytics.
 */
import { privateKeyToAccount } from "viem/accounts";
import type { Hex } from "viem";

let _cached: string | null | undefined = undefined;

export function getCanaryPayerAddress(): string | null {
  if (_cached !== undefined) return _cached;

  const key = process.env.X402_BUYER_PRIVATE_KEY;
  if (!key) {
    _cached = null;
    return null;
  }

  try {
    const hex: Hex = key.startsWith("0x") ? (key as Hex) : (`0x${key}` as Hex);
    _cached = privateKeyToAccount(hex).address.toLowerCase();
  } catch {
    _cached = null;
  }

  return _cached;
}

export function isCanaryPayer(address: string | null | undefined): boolean {
  if (!address) return false;
  const canary = getCanaryPayerAddress();
  return !!canary && address.toLowerCase() === canary;
}
