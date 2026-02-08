import { ethers } from 'ethers';

export const WALLET_REGISTRY = {
  PLATFORM: {
    label: "Platform Revenue Wallet (EVM_PRIVATE_KEY)",
    address: "0xa4bBE37f9A6Ae2dc36a607B91eB148C0ae163C91",
    role: "platform" as const,
    canSendFrom: true,
    canReceive: true,
  },
  BUYER_TEST: {
    label: "x402 Drain Test Buyer (X402_BUYER_PRIVATE_KEY)",
    address: "0x5837A864C03912ea14a5609968F73E75B9d42a7C",
    role: "buyer" as const,
    canSendFrom: true,
    canReceive: true,
  },
  SOLANA_PLATFORM: {
    label: "Solana Platform Wallet",
    address: "Hgby7VEo6vaPayM1G7kkjTqMAo4aCARoXA3ftWKz1m4k",
    role: "platform" as const,
    canSendFrom: false,
    canReceive: true,
  },
  CDP_LOST: {
    label: "LOST - CDP-created wallet, no longer accessible",
    address: "0x6341B240547d520a425ea58EF91b33692b12f356",
    role: "blacklisted" as const,
    canSendFrom: false,
    canReceive: false,
  },
} as const;

export type WalletName = keyof typeof WALLET_REGISTRY;

const ALL_ADDRESSES = Object.values(WALLET_REGISTRY).map(w => w.address.toLowerCase());
const BLACKLISTED = Object.values(WALLET_REGISTRY)
  .filter(w => w.role === 'blacklisted')
  .map(w => w.address.toLowerCase());

export function lookupWallet(address: string): (typeof WALLET_REGISTRY)[WalletName] | null {
  const lower = address.toLowerCase();
  for (const entry of Object.values(WALLET_REGISTRY)) {
    if (entry.address.toLowerCase() === lower) return entry;
  }
  return null;
}

export function validateTransferTarget(toAddress: string): { valid: boolean; error?: string; wallet?: (typeof WALLET_REGISTRY)[WalletName] } {
  if (!ethers.isAddress(toAddress)) {
    return { valid: false, error: `Invalid EVM address: ${toAddress}` };
  }

  const checksummed = ethers.getAddress(toAddress);
  const known = lookupWallet(toAddress);

  if (known && known.role === 'blacklisted') {
    return { valid: false, error: `BLOCKED: ${known.label} — this address is blacklisted` };
  }

  if (known && !known.canReceive) {
    return { valid: false, error: `Address ${checksummed} (${known.label}) is not configured to receive funds` };
  }

  if (!known) {
    return { valid: false, error: `UNKNOWN ADDRESS: ${checksummed} is not in the wallet registry. Add it to scripts/lib/walletRegistry.ts first.` };
  }

  return { valid: true, wallet: known };
}

export function validateTransferSource(fromAddress: string): { valid: boolean; error?: string; wallet?: (typeof WALLET_REGISTRY)[WalletName] } {
  const known = lookupWallet(fromAddress);

  if (!known) {
    return { valid: false, error: `UNKNOWN SOURCE: ${fromAddress} is not in the wallet registry.` };
  }

  if (!known.canSendFrom) {
    return { valid: false, error: `Address ${fromAddress} (${known.label}) cannot be used as a send source` };
  }

  return { valid: true, wallet: known };
}

export function requireConfirmation(): boolean {
  if (process.env.CONFIRM_TRANSFER === 'true') return true;
  console.error("\n=== SAFETY GATE ===");
  console.error("Set CONFIRM_TRANSFER=true to execute this transfer.");
  console.error("Run with: CONFIRM_TRANSFER=true npx tsx <script>");
  console.error("===================\n");
  return false;
}

export function printTransferSummary(params: {
  from: string;
  to: string;
  amount: string;
  token: string;
  chain: string;
  dryRun: boolean;
}) {
  const fromWallet = lookupWallet(params.from);
  const toWallet = lookupWallet(params.to);
  
  console.log("\n╔══════════════════════════════════════════════╗");
  console.log(  "║         TRANSFER SUMMARY                     ║");
  console.log(  "╠══════════════════════════════════════════════╣");
  console.log(`║ Mode:   ${params.dryRun ? "🔍 DRY RUN (no tx)" : "🔴 LIVE TRANSFER"}`);
  console.log(`║ From:   ${params.from}`);
  console.log(`║         ${fromWallet?.label || "⚠️ UNKNOWN"}`);
  console.log(`║ To:     ${params.to}`);
  console.log(`║         ${toWallet?.label || "⚠️ UNKNOWN"}`);
  console.log(`║ Amount: ${params.amount} ${params.token}`);
  console.log(`║ Chain:  ${params.chain}`);
  console.log(  "╚══════════════════════════════════════════════╝\n");
}
