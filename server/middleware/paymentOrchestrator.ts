import { Request, Response, NextFunction } from "express";
import { isCanaryPayer } from "../utils/canaryAddress";
import { getCanonicalServiceCount } from "../utils/serviceCount";
import { 
  verifyTransactionPayment, 
  markPaymentIntentSucceeded, 
  markPaymentIntentFailed 
} from "./hybridPaymentMiddleware";
import { offerLinkService } from "../services/offerLinkService";
import { getFacilitatorUrl } from "../utils/facilitatorHelper";
import { Connection } from "@solana/web3.js";
import { SERVICE_PRICING_MICRO, SERVICE_PRICING_USD, microToUSD, formatUSD, getServicePriceUSD } from "../../shared/pricing";
import { getAuthContext, hasValidSession, resolveOrCreateSessionUser, refreshAndValidateAuthContext, AuthContext } from "../services/gptAuthResolver";
import { creditsService } from "../services/creditsService";
import { createWalletClient, http, parseAbi, Hex, createPublicClient, formatUnits } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { x402InteractionTracker } from "../services/x402InteractionTracker";
import { emitFirstX402CallAsync } from "../services/funnelHelper";
import { nanoid } from "nanoid";
import { db } from "../db";
import { sql, and, eq, gt, or, isNull } from "drizzle-orm";
import { x402Interactions, x402PaymentIntents, creditsAccounts } from "@shared/schema";
import { stripe as _stripeForRecharge } from '../services/stripeClient';

/**
 * Fire-and-forget auto-recharge trigger.
 * Called after every successful API-key credit deduction.
 * If balance dropped below threshold and a vaulted card exists, charges it off-session.
 */
async function triggerAutoRechargeIfEnabled(userId: string, newBalance: number): Promise<void> {
  try {
    const account = await db.query.creditsAccounts.findFirst({
      where: eq(creditsAccounts.userId, userId),
    });
    if (!account?.autoTopUpEnabled || !account.autoRechargePaymentMethodId) return;

    const threshold = Number(account.autoTopUpThreshold ?? 5);
    const topUpAmount = Number(account.autoTopUpAmount ?? 25);
    if (newBalance > threshold) return;

    // Cooldown: skip if a recharge attempt was made within the last 5 minutes
    if (account.autoRechargeLastAttemptAt) {
      const msSinceLast = Date.now() - new Date(account.autoRechargeLastAttemptAt).getTime();
      if (msSinceLast < 5 * 60 * 1000) return;
    }

    // Mark attempt time immediately to prevent concurrent duplicate charges
    await db.update(creditsAccounts)
      .set({ autoRechargeLastAttemptAt: new Date() })
      .where(eq(creditsAccounts.userId, userId));

    // Deterministic idempotency key: one charge per user per 5-minute window
    const windowKey = Math.floor(Date.now() / (5 * 60 * 1000));
    const idempotencyKey = `ar:${userId}:${windowKey}`;

    const pi = await _stripeForRecharge.paymentIntents.create({
      amount: Math.round(topUpAmount * 100),
      currency: 'usd',
      payment_method: account.autoRechargePaymentMethodId,
      customer: account.stripeCustomerId || undefined,
      confirm: true,
      off_session: true,
      description: `Coin Railz M2M Auto-Recharge — $${topUpAmount} (balance was $${newBalance.toFixed(2)})`,
      metadata: { source: 'm2m-auto-recharge', userId, topUpAmount: String(topUpAmount) },
    }, { idempotencyKey });

    if (pi.status === 'succeeded') {
      await creditsService.addCredits({
        userId,
        amount: topUpAmount,
        referenceId: pi.id,
        paymentMethod: 'stripe',
        description: `Auto-recharge: $${topUpAmount} (balance was $${newBalance.toFixed(2)})`,
      });
      console.log(`🔄 Auto-recharge succeeded: $${topUpAmount} added for ${userId} (pi: ${pi.id})`);
    } else {
      console.warn(`⚠️ Auto-recharge PaymentIntent status: ${pi.status} for ${userId}`);
    }
  } catch (err: any) {
    // Non-fatal — log and continue. The agent's current request already succeeded.
    console.error(`⚠️ Auto-recharge failed for ${userId}:`, err?.message);
  }
}
// CBOR library - use createRequire for ESM compatibility
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const cbor = require("cbor");
// MessagePack library for agents using msgpack-encoded payloads
import { decode as msgpackDecode } from "@msgpack/msgpack";
// Node.js built-in zlib for gzip/deflate/brotli decompression (supports compressed payloads)
import * as zlib from "zlib";

// Feature flags for GPT session auth rollout
// Set GPT_SESSION_AUTH=true to enable zero-friction GPT session auth path
// Set GPT_SESSION_AUTH_LOG_ONLY=true to enable dual-write logging without changing behavior
const GPT_SESSION_AUTH_ENABLED = process.env.GPT_SESSION_AUTH === 'true';
const GPT_SESSION_AUTH_LOG_ONLY = process.env.GPT_SESSION_AUTH_LOG_ONLY === 'true';

// Dual-write logger for GPT session auth transitions
function logGptAuthPath(phase: string, details: Record<string, any>) {
  if (GPT_SESSION_AUTH_ENABLED || GPT_SESSION_AUTH_LOG_ONLY) {
    console.log(`🔐 [GPT Auth ${GPT_SESSION_AUTH_ENABLED ? 'ACTIVE' : 'LOG-ONLY'}] ${phase}:`, JSON.stringify(details));
  }
}

// ============================================================================
// MACHINE-READABLE ERROR RESPONSES (x402 Protocol Compatible)
// ============================================================================
// Error codes for AI agents to programmatically understand and self-correct
// These codes follow a registry pattern for stable machine parsing

export type X402ErrorCode = 
  | 'PAYMENT_HEADER_MISSING'
  | 'PAYMENT_INVALID_TX_HASH_FORMAT'
  | 'PAYMENT_INVALID_TX_HASH_LENGTH'
  | 'PAYMENT_DECODE_FAILED'
  | 'PAYMENT_VERIFICATION_FAILED'
  | 'PAYMENT_VERIFICATION_EXCEPTION'
  | 'PAYMENT_AMOUNT_INSUFFICIENT'
  | 'PAYMENT_EXPIRED'
  | 'SOLANA_VERIFICATION_FAILED';

interface X402ErrorResponse {
  success: false;
  error: {
    code: X402ErrorCode;
    httpStatus: number;
    x402ErrorVersion: 1;
    humanMessage: string;
    agentHint: string;
    recoverable: boolean;
    expectedFormat?: {
      txHash?: string;
      facilitatorPayload?: string;
      examples?: string[];
    };
    telemetryId: string;
  };
  x402Version: 2;
}

/**
 * Generate machine-readable + human-readable error response for payment failures
 * Designed for both AI agents (structured JSON) and human developers (clear messages)
 */
function generatePaymentErrorResponse(
  res: Response,
  code: X402ErrorCode,
  humanMessage: string,
  agentHint: string,
  telemetryId: string,
  options?: {
    recoverable?: boolean;
    expectedFormat?: X402ErrorResponse['error']['expectedFormat'];
    httpStatus?: number;
    /** Minimal accepts[] hint so agents can reformulate and retry after a decode failure */
    retryAccepts?: Array<{ network: string; asset: string; payTo: string; maxAmountRequired: string; facilitator?: string }>;
    /** Endpoint agent can GET to retrieve a fresh 402 challenge with full accepts[] */
    retryChallengeEndpoint?: string;
  }
): Response {
  const httpStatus = options?.httpStatus || 400;
  const response: X402ErrorResponse = {
    success: false,
    error: {
      code,
      httpStatus,
      x402ErrorVersion: 1,
      humanMessage,
      agentHint,
      recoverable: options?.recoverable ?? true,
      telemetryId
    },
    x402Version: 2
  };
  
  if (options?.expectedFormat) {
    response.error.expectedFormat = options.expectedFormat;
  }

  // For decode failures on payment attempts, inject a minimal accepts[] so the agent
  // can inspect the expected format and reformulate its X-PAYMENT header without needing
  // a second round-trip to get a fresh challenge. Also add a retryChallengeEndpoint for
  // agents that prefer to re-fetch the full 402 challenge.
  if (options?.retryAccepts) {
    (response as any).retry_accepts = options.retryAccepts;
  }
  if (options?.retryChallengeEndpoint) {
    (response as any).retry_challenge_endpoint = options.retryChallengeEndpoint;
    (response as any).retry_challenge_method = "GET";
    (response as any).retry_challenge_note = "GET this endpoint to receive a fresh 402 challenge with full payment instructions";
  }

  // Surface last_error_reason at top level so agents can parse exactly why
  // their payment attempt failed without unwrapping error.* or inspecting httpStatus.
  // Cover both 402 (re-issued challenge after bad payment) and payment-related 400s
  // (decode failures, format errors) — in all cases the agent sent X-PAYMENT and it failed.
  const isPaymentAttemptFailure = httpStatus === 402 ||
    (httpStatus === 400 && (code.startsWith('PAYMENT_') || code.startsWith('SOLANA_')));
  if (isPaymentAttemptFailure) {
    (response as any).last_error_reason = {
      code,
      message: humanMessage,
      hint: agentHint,
      recoverable: options?.recoverable ?? true,
      telemetryId
    };
  }
  
  console.log(`🔴 Payment error [${code}]: ${humanMessage} (telemetryId: ${telemetryId})`);
  
  return res.status(httpStatus).json(response);
}

/**
 * Validate X-PAYMENT header format before attempting decode
 * Returns null if valid, or error details if invalid
 * 
 * This function performs early validation to catch common user input errors:
 * - Truncated tx hashes (wrong length)
 * - Invalid hex characters
 * - Binary garbage (not valid text/base64)
 * - Empty or whitespace-only headers
 */
function validatePaymentHeaderFormat(xPayment: string): { 
  valid: boolean; 
  code?: X402ErrorCode; 
  message?: string; 
  hint?: string 
} {
  const trimmed = xPayment.trim();
  
  // Check for empty header
  if (!trimmed || trimmed.length === 0) {
    return {
      valid: false,
      code: 'PAYMENT_HEADER_MISSING',
      message: 'X-PAYMENT header is empty',
      hint: 'Provide a valid transaction hash or facilitator payload in the X-PAYMENT header'
    };
  }
  
  // Check for binary garbage across entire payload (not just first 10 chars)
  // Look for non-printable control characters that shouldn't appear in valid formats
  const hasBinaryGarbage = /[\x00-\x08\x0E-\x1F]/.test(trimmed);
  if (hasBinaryGarbage) {
    const firstNonPrintable = trimmed.match(/[\x00-\x08\x0E-\x1F]/);
    const charCode = firstNonPrintable ? trimmed.charCodeAt(trimmed.indexOf(firstNonPrintable[0])) : 0;
    return {
      valid: false,
      code: 'PAYMENT_DECODE_FAILED',
      message: `Payment header contains invalid binary data (control character: 0x${charCode.toString(16).padStart(2, '0')})`,
      hint: `X-PAYMENT header must be: (1) raw transaction hash (0x + 64 hex chars), (2) base64-encoded JSON/CBOR payload, or (3) raw JSON. Binary data is not accepted.`
    };
  }
  
  // Check for high-bit characters that indicate binary data (not UTF-8 text)
  // Allow common UTF-8 multibyte sequences but reject pure binary
  const highBitCount = (trimmed.match(/[\x80-\xFF]/g) || []).length;
  const highBitRatio = highBitCount / trimmed.length;
  // If >30% of characters are high-bit and it's not valid JSON/base64, likely binary
  if (highBitRatio > 0.3 && !trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    // Try base64 decode to see if it's valid
    const base64Regex = /^[A-Za-z0-9+/=]+$/;
    if (!base64Regex.test(trimmed)) {
      return {
        valid: false,
        code: 'PAYMENT_DECODE_FAILED',
        message: `Payment header appears to be binary data (${Math.round(highBitRatio * 100)}% non-ASCII bytes)`,
        hint: `X-PAYMENT header must be text-based. Use raw tx hash (0x...), base64-encoded payload, or JSON.`
      };
    }
  }
  
  // Check for 0x-prefixed values that aren't valid tx hashes
  if (trimmed.startsWith('0x')) {
    // Check for invalid hex characters first
    if (!/^0x[0-9a-fA-F]*$/.test(trimmed)) {
      const invalidMatch = trimmed.match(/[^0-9a-fA-Fx]/);
      const invalidChar = invalidMatch ? invalidMatch[0] : '?';
      return {
        valid: false,
        code: 'PAYMENT_INVALID_TX_HASH_FORMAT',
        message: `Invalid character '${invalidChar}' in transaction hash. Must be hex (0-9, a-f).`,
        hint: `Transaction hash must be hexadecimal only. Found invalid character at: ${trimmed.substring(0, 30)}`
      };
    }
    
    // Valid EVM tx hash: 0x + 64 hex chars = 66 total
    if (trimmed.length === 66) {
      return { valid: true };
    }
    
    // Valid raw tx hash range (40-130 chars for various EVM formats)
    if (trimmed.length >= 40 && trimmed.length <= 130) {
      return { valid: true };
    }
    
    // Too short
    if (trimmed.length < 40) {
      return {
        valid: false,
        code: 'PAYMENT_INVALID_TX_HASH_LENGTH',
        message: `Transaction hash too short: ${trimmed.length} chars (expected 66 for EVM tx hash)`,
        hint: `Provide complete transaction hash. EVM format: 0x + 64 hex chars = 66 total. You sent ${trimmed.length} chars.`
      };
    }
    
    // Too long for a tx hash
    if (trimmed.length > 130) {
      return {
        valid: false,
        code: 'PAYMENT_INVALID_TX_HASH_LENGTH',
        message: `Transaction hash too long: ${trimmed.length} chars (max expected ~130)`,
        hint: `EVM tx hash should be 66 chars (0x + 64 hex). If sending encoded payload, don't prefix with 0x.`
      };
    }
  }
  
  // Validate Solana-like signatures (base58, 87-88 chars)
  // Base58 alphabet: 123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
  if (trimmed.length >= 80 && trimmed.length <= 100 && base58Regex.test(trimmed)) {
    // Likely a Solana signature
    return { valid: true };
  }
  
  // Allow JSON payloads
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return { valid: true };
  }
  
  // Allow base64 payloads (for facilitator-encoded data)
  const base64Regex = /^[A-Za-z0-9+/]+=*$/;
  if (base64Regex.test(trimmed) && trimmed.length > 20) {
    return { valid: true };
  }
  
  // For anything else, let the decoder try to handle it
  return { valid: true };
}

// Multi-format payment payload decoder
// Supports: JSON, CBOR, MessagePack, and raw binary EIP-3009 formats for x402 protocol compatibility
interface DecodedPayload {
  success: boolean;
  format: 'json' | 'cbor' | 'msgpack' | 'eip3009-binary' | 'unknown';
  data: any;
  error?: string;
  fingerprint?: string;
}

// SECURITY GUARDRAILS: Size limits to prevent resource exhaustion attacks
// These values are conservative but allow legitimate x402 payment payloads
const MAX_HEADER_SIZE = 4096;              // 4KB max for uncompressed payloads
const MAX_COMPRESSED_INPUT_SIZE = 12288;   // 12KB max for compressed payloads (Coinbase facilitator uses ~5.8KB msgpack+gzip)
const MAX_DECOMPRESSED_SIZE = 65536;       // 64KB max decompressed payload size
const MIN_BROTLI_SIZE = 32;                // Don't attempt brotli on tiny payloads

// Helper to detect if buffer starts with compression magic bytes
// Used to allow larger inputs for known-compressed payloads (security-safe path)
function hasCompressionSignature(buffer: Buffer): { isCompressed: boolean; format?: string } {
  if (buffer.length < 2) return { isCompressed: false };
  
  // Gzip magic bytes: 0x1f 0x8b
  if (buffer[0] === 0x1f && buffer[1] === 0x8b) {
    return { isCompressed: true, format: 'gzip' };
  }
  
  // Zlib/deflate header: 0x78 followed by 0x01, 0x5e, 0x9c, or 0xda
  if (buffer[0] === 0x78 && [0x01, 0x5e, 0x9c, 0xda].includes(buffer[1])) {
    return { isCompressed: true, format: 'deflate' };
  }
  
  // CBOR/MessagePack prefixes that Coinbase facilitator uses
  // 0x82-0x9f = msgpack fixarray, 0xa0-0xbf = msgpack fixmap/fixstr, 0xb6 = specific facilitator prefix
  if ((buffer[0] >= 0x80 && buffer[0] <= 0xbf) || buffer[0] === 0xd9 || buffer[0] === 0xda || buffer[0] === 0xdb) {
    return { isCompressed: true, format: 'cbor-msgpack' };
  }
  
  return { isCompressed: false };
}

// OBSERVABILITY: Decode-path metrics counter (ChatGPT recommendation)
// Tracks which payment formats are being used for monitoring and analysis
const DECODE_PATH_METRICS = {
  json: 0,
  cbor: 0,
  msgpack: 0,
  'eip3009-binary': 0,
  'compressed-gzip': 0,
  'compressed-deflate': 0,
  'compressed-brotli': 0,
  unknown: 0,
  total: 0,
  lastReset: new Date().toISOString()
};

// OBSERVABILITY: Decompression-specific metrics for security monitoring
const DECOMPRESS_METRICS = {
  attempted: 0,
  succeeded: 0,
  rejected_input_too_large: 0,
  rejected_output_too_large: 0,
  bytes_in_total: 0,
  bytes_out_total: 0,
  by_format: {
    gzip: 0,
    deflate: 0,
    'deflate-raw': 0,
    brotli: 0
  },
  lastReset: new Date().toISOString()
};

// Try to decompress a buffer using common compression formats
// Returns { success, format, decompressed } or { success: false } if not compressed
// SECURITY: Uses maxOutputLength to abort decompression MID-STREAM before memory is allocated
// This prevents zip bomb attacks where a small compressed payload expands to gigabytes
function tryDecompress(buffer: Buffer): { success: boolean; format?: string; decompressed?: Buffer; rejected?: string } {
  DECOMPRESS_METRICS.attempted++;
  DECOMPRESS_METRICS.bytes_in_total += buffer.length;
  
  // SMART SIZE LIMIT: Use higher limit for buffers with compression/CBOR/msgpack signatures
  // This allows Coinbase facilitator payloads (~5.8KB msgpack+gzip) while blocking random large inputs
  const compressionCheck = hasCompressionSignature(buffer);
  const effectiveMaxSize = compressionCheck.isCompressed ? MAX_COMPRESSED_INPUT_SIZE : MAX_HEADER_SIZE;
  
  // GUARDRAIL: Reject oversized input buffers before any decompression attempt
  if (buffer.length > effectiveMaxSize) {
    DECOMPRESS_METRICS.rejected_input_too_large++;
    console.warn(`🛡️ GUARDRAIL: Rejected oversized input buffer (${buffer.length} > ${effectiveMaxSize} bytes, format=${compressionCheck.format || 'unknown'})`);
    return { success: false, rejected: 'input_too_large' };
  }
  
  // Log when we're allowing a larger payload through the compressed path
  if (buffer.length > MAX_HEADER_SIZE && compressionCheck.isCompressed) {
    console.log(`✅ Allowing larger payload (${buffer.length} bytes) - detected ${compressionCheck.format} signature`);
  }
  
  // CRITICAL: Use maxOutputLength option to abort decompression BEFORE full expansion
  // This is the key security fix - Node.js zlib throws ERR_BUFFER_TOO_LARGE when limit hit
  const safeDecompressOptions = { maxOutputLength: MAX_DECOMPRESSED_SIZE };
  
  // Check for gzip magic bytes (1f 8b)
  if (buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b) {
    try {
      const decompressed = zlib.gunzipSync(buffer, safeDecompressOptions);
      DECOMPRESS_METRICS.succeeded++;
      DECOMPRESS_METRICS.bytes_out_total += decompressed.length;
      DECOMPRESS_METRICS.by_format.gzip++;
      console.log(`🗜️ Decompressed gzip payload: ${buffer.length} → ${decompressed.length} bytes`);
      return { success: true, format: 'gzip', decompressed };
    } catch (e: any) {
      if (e.code === 'ERR_BUFFER_TOO_LARGE') {
        DECOMPRESS_METRICS.rejected_output_too_large++;
        console.warn(`🛡️ GUARDRAIL: Gzip decompression aborted - output exceeds ${MAX_DECOMPRESSED_SIZE} bytes (zip bomb blocked)`);
        return { success: false, rejected: 'output_too_large' };
      }
      console.log(`⚠️ Gzip magic bytes but decompress failed`);
    }
  }
  
  // Check for zlib/deflate header (78 01, 78 5e, 78 9c, 78 da)
  if (buffer.length >= 2 && buffer[0] === 0x78 && [0x01, 0x5e, 0x9c, 0xda].includes(buffer[1])) {
    try {
      const decompressed = zlib.inflateSync(buffer, safeDecompressOptions);
      DECOMPRESS_METRICS.succeeded++;
      DECOMPRESS_METRICS.bytes_out_total += decompressed.length;
      DECOMPRESS_METRICS.by_format.deflate++;
      console.log(`🗜️ Decompressed zlib/deflate payload: ${buffer.length} → ${decompressed.length} bytes`);
      return { success: true, format: 'deflate', decompressed };
    } catch (e: any) {
      if (e.code === 'ERR_BUFFER_TOO_LARGE') {
        DECOMPRESS_METRICS.rejected_output_too_large++;
        console.warn(`🛡️ GUARDRAIL: Deflate decompression aborted - output exceeds ${MAX_DECOMPRESSED_SIZE} bytes (zip bomb blocked)`);
        return { success: false, rejected: 'output_too_large' };
      }
      console.log(`⚠️ Zlib header but decompress failed`);
    }
  }
  
  // GUARDRAIL: Only try brotli on payloads >= MIN_BROTLI_SIZE bytes
  // Brotli has no magic bytes, so we apply heuristics to avoid unnecessary CPU usage
  if (buffer.length >= MIN_BROTLI_SIZE) {
    try {
      const decompressed = zlib.brotliDecompressSync(buffer, safeDecompressOptions);
      if (decompressed.length > 0 && decompressed.length !== buffer.length) {
        DECOMPRESS_METRICS.succeeded++;
        DECOMPRESS_METRICS.bytes_out_total += decompressed.length;
        DECOMPRESS_METRICS.by_format.brotli++;
        console.log(`🗜️ Decompressed brotli payload: ${buffer.length} → ${decompressed.length} bytes`);
        return { success: true, format: 'brotli', decompressed };
      }
    } catch (e: any) {
      if (e.code === 'ERR_BUFFER_TOO_LARGE') {
        DECOMPRESS_METRICS.rejected_output_too_large++;
        console.warn(`🛡️ GUARDRAIL: Brotli decompression aborted - output exceeds ${MAX_DECOMPRESSED_SIZE} bytes (zip bomb blocked)`);
        return { success: false, rejected: 'output_too_large' };
      }
      // Brotli failed - not brotli compressed
    }
  }
  
  // Try raw deflate (no header)
  try {
    const decompressed = zlib.inflateRawSync(buffer, safeDecompressOptions);
    if (decompressed.length > buffer.length) {
      DECOMPRESS_METRICS.succeeded++;
      DECOMPRESS_METRICS.bytes_out_total += decompressed.length;
      DECOMPRESS_METRICS.by_format['deflate-raw']++;
      console.log(`🗜️ Decompressed raw deflate payload: ${buffer.length} → ${decompressed.length} bytes`);
      return { success: true, format: 'deflate-raw', decompressed };
    }
  } catch (e: any) {
    if (e.code === 'ERR_BUFFER_TOO_LARGE') {
      DECOMPRESS_METRICS.rejected_output_too_large++;
      console.warn(`🛡️ GUARDRAIL: Raw deflate decompression aborted - output exceeds ${MAX_DECOMPRESSED_SIZE} bytes (zip bomb blocked)`);
      return { success: false, rejected: 'output_too_large' };
    }
    // Raw deflate failed
  }
  
  return { success: false };
}

// Get current decode metrics (can be exposed via /api/metrics if needed)
export function getDecodePathMetrics() {
  return { 
    decode: { ...DECODE_PATH_METRICS },
    decompress: { ...DECOMPRESS_METRICS }
  };
}

// EIP-3009 raw binary structure sizes (all values in bytes)
// Binary layout: from(20) + to(20) + value(32) + validAfter(32) + validBefore(32) + nonce(32) + signature(65) = 233 bytes
// Some implementations may use 64-byte signature (without v) = 232 bytes
// Or with padding = 224-256 bytes range
const EIP3009_MIN_SIZE = 220; // Minimum expected size
const EIP3009_MAX_SIZE = 260; // Maximum expected size with padding

// Parse raw binary EIP-3009 authorization payload
// Returns null if not a valid EIP-3009 structure
function parseRawEIP3009Binary(buffer: Buffer): { authorization: any; signature: string } | null {
  const len = buffer.length;
  
  // Check size bounds
  if (len < EIP3009_MIN_SIZE || len > EIP3009_MAX_SIZE) {
    return null;
  }
  
  try {
    // Binary layout (standard EIP-3009 transferWithAuthorization):
    // Offset 0:   from address (20 bytes)
    // Offset 20:  to address (20 bytes) 
    // Offset 40:  value (32 bytes, uint256)
    // Offset 72:  validAfter (32 bytes, uint256)
    // Offset 104: validBefore (32 bytes, uint256)
    // Offset 136: nonce (32 bytes, bytes32)
    // Offset 168: signature (65 bytes: r=32, s=32, v=1)
    
    const from = '0x' + buffer.slice(0, 20).toString('hex');
    const to = '0x' + buffer.slice(20, 40).toString('hex');
    const value = '0x' + buffer.slice(40, 72).toString('hex');
    const validAfter = '0x' + buffer.slice(72, 104).toString('hex');
    const validBefore = '0x' + buffer.slice(104, 136).toString('hex');
    const nonce = '0x' + buffer.slice(136, 168).toString('hex');
    
    // Signature is the remaining bytes (typically 65: r(32) + s(32) + v(1))
    const sigBytes = buffer.slice(168);
    const signature = '0x' + sigBytes.toString('hex');
    
    // Validate addresses look valid (non-zero)
    const fromNum = BigInt(from);
    const toNum = BigInt(to);
    if (fromNum === 0n || toNum === 0n) {
      console.log(`⚠️ EIP-3009 binary parse: zero address detected, rejecting`);
      return null;
    }
    
    // Validate signature length (64 or 65 bytes expected)
    if (sigBytes.length < 64 || sigBytes.length > 66) {
      console.log(`⚠️ EIP-3009 binary parse: unexpected signature length ${sigBytes.length}`);
      return null;
    }
    
    // OBSERVABILITY: Log signature-length anomalies for monitoring (ChatGPT recommendation)
    if (sigBytes.length === 64) {
      console.warn(`⚠️ EIP-3009 signature missing recovery byte (v)`, {
        sigLength: sigBytes.length,
        from: from.slice(0, 12),
        to: to.slice(0, 12),
        note: 'Agent may need v-recovery logic in Phase 2'
      });
    }
    
    console.log(`🔓 EIP-3009 binary parsed: from=${from.slice(0,10)}..., to=${to.slice(0,10)}..., sigLen=${sigBytes.length}`);
    
    return {
      authorization: {
        from,
        to,
        value,
        validAfter,
        validBefore,
        nonce
      },
      signature
    };
  } catch (parseError: any) {
    console.log(`⚠️ EIP-3009 binary parse failed: ${parseError.message}`);
    return null;
  }
}

// Convert CBOR Map objects to plain JavaScript objects recursively
function normalizeCborData(data: any): any {
  if (data instanceof Map) {
    const obj: Record<string, any> = {};
    for (const [key, value] of data.entries()) {
      obj[String(key)] = normalizeCborData(value);
    }
    return obj;
  }
  if (Array.isArray(data)) {
    return data.map(normalizeCborData);
  }
  if (data instanceof Buffer) {
    return data.toString('hex');
  }
  return data;
}

function decodePaymentPayload(base64Header: string): DecodedPayload {
  DECODE_PATH_METRICS.total++;
  
  const trimmed = base64Header.trim();
  
  // CRITICAL FIX #1: Check if header is a raw hex transaction hash (0x...)
  // Our 402 response tells agents: "Include raw transaction hash (0x...) in X-PAYMENT header"
  // When agents follow this instruction, we MUST accept the raw tx hash without base64 decoding
  // Without this check, "0xabc123..." gets base64-decoded into garbage bytes and rejected
  // This fix enables agents to pay using the direct transaction hash method
  if (/^0x[0-9a-fA-F]{40,130}$/.test(trimmed)) {
    // Track raw tx hash format for observability
    (DECODE_PATH_METRICS as any).rawTxHash = ((DECODE_PATH_METRICS as any).rawTxHash || 0) + 1;
    console.log(`🔓 Payment payload detected as RAW TRANSACTION HASH (${trimmed.slice(0, 20)}..., ${trimmed.length} chars) [metrics: rawTxHash=${(DECODE_PATH_METRICS as any).rawTxHash}/${DECODE_PATH_METRICS.total}]`);
    return { 
      success: true, 
      format: 'json', // Use 'json' format for compatibility with downstream verification
      data: { 
        transactionHash: trimmed,
        // Mark this as a raw tx hash payment for the verification logic
        paymentMethod: 'raw-transaction-hash'
      }
    };
  }
  
  // CRITICAL FIX #2: Check if header is already raw JSON (not base64 encoded)
  // Some agents (e.g., x402-autonomous-agent) send raw JSON directly in X-PAYMENT header
  // Without this check, raw JSON gets base64-decoded into garbage bytes
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || 
      (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      const data = JSON.parse(trimmed);
      // Track raw JSON format separately for observability
      (DECODE_PATH_METRICS as any).rawJson = ((DECODE_PATH_METRICS as any).rawJson || 0) + 1;
      console.log(`🔓 Payment payload decoded as RAW JSON (not base64, ${trimmed.length} chars) [metrics: rawJson=${(DECODE_PATH_METRICS as any).rawJson}/${DECODE_PATH_METRICS.total}]`);
      return { success: true, format: 'json', data };
    } catch (rawJsonError) {
      // Looks like JSON structure but invalid - continue with base64 decode
      console.log(`⚠️ Header looks like JSON but failed to parse, trying base64 decode...`);
    }
  }
  
  try {
    const buffer = Buffer.from(base64Header, "base64");
    
    // Try JSON first (most common, backwards compatible)
    try {
      const jsonStr = buffer.toString("utf-8");
      const data = JSON.parse(jsonStr);
      DECODE_PATH_METRICS.json++;
      console.log(`🔓 Payment payload decoded as JSON (${buffer.length} bytes) [metrics: json=${DECODE_PATH_METRICS.json}/${DECODE_PATH_METRICS.total}]`);
      return { success: true, format: 'json', data };
    } catch (jsonError) {
      // JSON failed, check for CBOR magic bytes
      const firstByte = buffer[0];
      
      // CBOR magic bytes: 0xBF (indefinite map), 0xA0-0xBF (finite maps), 0xD9 (tagged item)
      const isCborLikely = (
        firstByte === 0xBF || 
        (firstByte >= 0xA0 && firstByte <= 0xBF) ||
        firstByte === 0xD9 ||
        firstByte === 0xDA ||
        firstByte === 0xDB
      );
      
      if (isCborLikely) {
        try {
          const rawData = cbor.decodeFirstSync(buffer);
          const data = normalizeCborData(rawData);
          DECODE_PATH_METRICS.cbor++;
          console.log(`🔓 Payment payload decoded as CBOR (${buffer.length} bytes) [metrics: cbor=${DECODE_PATH_METRICS.cbor}/${DECODE_PATH_METRICS.total}]`);
          return { success: true, format: 'cbor', data };
        } catch (cborError: any) {
          console.log(`⚠️ CBOR decode failed despite magic bytes: ${cborError.message}`);
        }
      }
      
      // Try CBOR anyway for edge cases where first byte doesn't match common patterns
      try {
        const rawData = cbor.decodeFirstSync(buffer);
        const data = normalizeCborData(rawData);
        DECODE_PATH_METRICS.cbor++;
        console.log(`🔓 Payment payload decoded as CBOR (non-standard, ${buffer.length} bytes) [metrics: cbor=${DECODE_PATH_METRICS.cbor}/${DECODE_PATH_METRICS.total}]`);
        return { success: true, format: 'cbor', data };
      } catch (cborFallbackError) {
        // CBOR failed - try MessagePack (some agents use msgpack encoding)
        // MessagePack uses similar byte ranges to CBOR but different structure
        // 0xA0-0xBF in msgpack = fixstr (fixed-length string), not map like CBOR
        try {
          const msgpackData = msgpackDecode(buffer);
          DECODE_PATH_METRICS.msgpack++;
          console.log(`🔓 Payment payload decoded as MessagePack (${buffer.length} bytes) [metrics: msgpack=${DECODE_PATH_METRICS.msgpack}/${DECODE_PATH_METRICS.total}]`);
          return { success: true, format: 'msgpack', data: msgpackData };
        } catch (msgpackError: any) {
          console.log(`⚠️ MessagePack decode failed: ${msgpackError.message}`);
        }
        
        // Neither JSON, CBOR, nor MessagePack worked - try raw binary EIP-3009 format
        // This handles agents sending raw EIP-3009 transferWithAuthorization data
        const eip3009Data = parseRawEIP3009Binary(buffer);
        if (eip3009Data) {
          DECODE_PATH_METRICS['eip3009-binary']++;
          console.log(`🔓 Payment payload decoded as raw EIP-3009 binary (${buffer.length} bytes) [metrics: eip3009=${DECODE_PATH_METRICS['eip3009-binary']}/${DECODE_PATH_METRICS.total}]`);
          // Return in the format expected by the EIP-3009 executor downstream
          return { 
            success: true, 
            format: 'eip3009-binary', 
            data: {
              payload: eip3009Data  // { authorization, signature }
            }
          };
        }
        
        // All uncompressed formats failed - try DECOMPRESSION then re-decode
        // This handles agents that compress payloads (gzip, brotli, deflate) before base64 encoding
        const decompressResult = tryDecompress(buffer);
        
        // GUARDRAIL: Surface rejections from size limit checks
        if (decompressResult.rejected) {
          DECODE_PATH_METRICS.unknown++;
          const rejectionReason = decompressResult.rejected === 'input_too_large' 
            ? `Input payload exceeds ${MAX_HEADER_SIZE} bytes limit`
            : `Decompressed output exceeds ${MAX_DECOMPRESSED_SIZE} bytes limit`;
          console.error(`🛡️ SECURITY GUARDRAIL TRIGGERED: ${decompressResult.rejected} - ${rejectionReason}`);
          return {
            success: false,
            format: 'unknown',
            data: null,
            error: `Security guardrail: ${rejectionReason}. Potential zip bomb or abuse attempt blocked.`,
            fingerprint: `rejected=${decompressResult.rejected}, inputLen=${buffer.length}`
          };
        }
        
        if (decompressResult.success && decompressResult.decompressed) {
          const decompressed = decompressResult.decompressed;
          const compressionFormat = decompressResult.format || 'unknown';
          console.log(`🗜️ Trying to decode decompressed payload (${compressionFormat})...`);
          
          // Try JSON on decompressed data
          try {
            const jsonStr = decompressed.toString("utf-8");
            const data = JSON.parse(jsonStr);
            DECODE_PATH_METRICS[`compressed-${compressionFormat}` as keyof typeof DECODE_PATH_METRICS] = 
              ((DECODE_PATH_METRICS[`compressed-${compressionFormat}` as keyof typeof DECODE_PATH_METRICS] as number) || 0) + 1;
            console.log(`🔓 Payment payload decoded as compressed JSON (${compressionFormat}: ${buffer.length} → ${decompressed.length} bytes)`);
            return { success: true, format: 'json', data };
          } catch (jsonError) {
            // Not JSON
          }
          
          // Try CBOR on decompressed data
          try {
            const rawData = cbor.decodeFirstSync(decompressed);
            const data = normalizeCborData(rawData);
            DECODE_PATH_METRICS[`compressed-${compressionFormat}` as keyof typeof DECODE_PATH_METRICS] = 
              ((DECODE_PATH_METRICS[`compressed-${compressionFormat}` as keyof typeof DECODE_PATH_METRICS] as number) || 0) + 1;
            console.log(`🔓 Payment payload decoded as compressed CBOR (${compressionFormat}: ${buffer.length} → ${decompressed.length} bytes)`);
            return { success: true, format: 'cbor', data };
          } catch (cborError) {
            // Not CBOR
          }
          
          // Try MessagePack on decompressed data
          try {
            const msgpackData = msgpackDecode(decompressed);
            DECODE_PATH_METRICS[`compressed-${compressionFormat}` as keyof typeof DECODE_PATH_METRICS] = 
              ((DECODE_PATH_METRICS[`compressed-${compressionFormat}` as keyof typeof DECODE_PATH_METRICS] as number) || 0) + 1;
            console.log(`🔓 Payment payload decoded as compressed MessagePack (${compressionFormat}: ${buffer.length} → ${decompressed.length} bytes)`);
            return { success: true, format: 'msgpack', data: msgpackData };
          } catch (msgpackError) {
            // Not MessagePack
          }
          
          // Try EIP-3009 on decompressed data
          const eip3009Decompressed = parseRawEIP3009Binary(decompressed);
          if (eip3009Decompressed) {
            DECODE_PATH_METRICS[`compressed-${compressionFormat}` as keyof typeof DECODE_PATH_METRICS] = 
              ((DECODE_PATH_METRICS[`compressed-${compressionFormat}` as keyof typeof DECODE_PATH_METRICS] as number) || 0) + 1;
            console.log(`🔓 Payment payload decoded as compressed EIP-3009 (${compressionFormat}: ${buffer.length} → ${decompressed.length} bytes)`);
            return { 
              success: true, 
              format: 'eip3009-binary', 
              data: { payload: eip3009Decompressed }
            };
          }
          
          console.log(`⚠️ Decompression succeeded (${compressionFormat}) but inner format still unknown`);
        }
        
        // All formats failed - log FULL details for debugging (critical for diagnosing mystery agents)
        DECODE_PATH_METRICS.unknown++;
        const fingerprint = `len=${buffer.length}, first4bytes=${buffer.slice(0, 4).toString('hex')}, firstChar=${String.fromCharCode(firstByte) || '?'}`;
        // Log first 64 bytes hex dump and full base64 header for analysis
        const hexDump = buffer.slice(0, Math.min(64, buffer.length)).toString('hex');
        console.log(`❌ Unknown payment format: ${fingerprint} [metrics: unknown=${DECODE_PATH_METRICS.unknown}/${DECODE_PATH_METRICS.total}]`);
        console.log(`🔍 DEBUG: First 64 bytes (hex): ${hexDump}`);
        console.log(`🔍 DEBUG: Full base64 header (first 400 chars): ${base64Header.substring(0, 400)}`);
        
        return { 
          success: false, 
          format: 'unknown', 
          data: null, 
          error: `Unsupported payment format. Expected JSON, CBOR, MessagePack, or EIP-3009 binary.`,
          fingerprint 
        };
      }
    }
  } catch (base64Error: any) {
    return { 
      success: false, 
      format: 'unknown', 
      data: null, 
      error: `Base64 decode failed: ${base64Error.message}` 
    };
  }
}

// Known agent user-agents that are probing our endpoints
const KNOWN_AGENT_PATTERNS = [
  { pattern: /python-httpx/i, name: "Python HTTPX Agent", partnerOffer: true },
  { pattern: /x402-fetch/i, name: "x402 Native Client", partnerOffer: true },
  { pattern: /x402-autonomous-agent/i, name: "x402 Autonomous Agent", partnerOffer: true },
  { pattern: /coinbase/i, name: "Coinbase Agent", partnerOffer: true },
  { pattern: /eliza/i, name: "ElizaOS Agent", partnerOffer: true },
  { pattern: /virtuals/i, name: "Virtuals Protocol", partnerOffer: true },
  { pattern: /fere/i, name: "FereAI Agent", partnerOffer: true },
  { pattern: /langchain/i, name: "LangChain Agent", partnerOffer: true },
  { pattern: /autogpt/i, name: "AutoGPT Agent", partnerOffer: true },
  { pattern: /^node$/i, name: "Node.js Agent", partnerOffer: true },
  { pattern: /curl/i, name: "Curl Client", partnerOffer: false },
];

// First-call free eligibility - cheapest services at $0.10
const FIRST_CALL_FREE_SERVICES = ["gas-price-oracle", "token-metadata"];
const FIRST_CALL_FREE_CACHE = new Map<string, { granted: boolean; timestamp: number }>();

// Check if user-agent is a known agent
function detectKnownAgent(userAgent: string | undefined): { isKnown: boolean; name: string; partnerOffer: boolean } {
  if (!userAgent) return { isKnown: false, name: "unknown", partnerOffer: false };
  
  for (const agent of KNOWN_AGENT_PATTERNS) {
    if (agent.pattern.test(userAgent)) {
      return { isKnown: true, name: agent.name, partnerOffer: agent.partnerOffer };
    }
  }
  return { isKnown: false, name: "unknown", partnerOffer: false };
}

// Check if IP/User-Agent combo is eligible for first-call free
async function isEligibleForFirstCallFree(ipAddress: string, userAgent: string | undefined): Promise<boolean> {
  // UA guard: block empty/null user-agents from free tier.
  // Rotating-IP scanners with no UA (e.g. Cloudflare fleet) were claiming a fresh
  // free call on every sweep. Legitimate agents always supply a user-agent string.
  // Feature flag: set FIRST_CALL_FREE_REQUIRE_UA=false to disable if needed.
  const requireUA = process.env.FIRST_CALL_FREE_REQUIRE_UA !== 'false';
  if (requireUA && (!userAgent || userAgent.trim() === '')) {
    console.log(`🚫 First-call-free DENIED (no UA): IP=${ipAddress.substring(0, 15)}...`);
    return false;
  }

  const cacheKey = `${ipAddress}:${userAgent?.substring(0, 50) || 'none'}`;
  
  // Check in-memory cache first
  const cached = FIRST_CALL_FREE_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 3600000) { // 1 hour cache
    return !cached.granted; // If already granted, not eligible
  }
  
  try {
    // Check database for previous free calls from this IP/UA combo
    // Using Drizzle ORM to avoid raw SQL issues in Neon HTTP fetch mode
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const normalizedUserAgent = userAgent || '';
    
    // Build user-agent predicate: match exact UA, or if no UA provided, match null/empty
    const userAgentPredicate = normalizedUserAgent 
      ? eq(x402Interactions.userAgent, normalizedUserAgent)
      : or(isNull(x402Interactions.userAgent), eq(x402Interactions.userAgent, ''));
    
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(x402Interactions)
      .where(
        and(
          eq(x402Interactions.ipAddress, ipAddress),
          userAgentPredicate,
          eq(sql`metadata->>'first_call_free'`, 'granted'),
          gt(x402Interactions.createdAt, thirtyDaysAgo)
        )
      );
    
    const count = Number(result[0]?.count || 0);
    const eligible = count === 0;
    
    FIRST_CALL_FREE_CACHE.set(cacheKey, { granted: !eligible, timestamp: Date.now() });
    
    if (eligible) {
      console.log(`🎁 First-call-free eligibility CHECK: IP=${ipAddress.substring(0, 15)}... UA=${normalizedUserAgent.substring(0, 30) || '(none)'}... → ELIGIBLE (0 previous grants)`);
    }
    
    return eligible;
  } catch (error: any) {
    console.error(`❌ First-call-free eligibility check FAILED: ${error.message}`, { ipAddress: ipAddress.substring(0, 15), userAgent: userAgent?.substring(0, 30) });
    return false; // Fail closed
  }
}

// Platform wallets to receive payments (EVM and Solana)
const PLATFORM_WALLET = process.env.PLATFORM_WALLET_ADDRESS || "0xa4bBE37f9A6Ae2dc36a607B91eB148C0ae163C91";
// SOLANA_PLATFORM_WALLET: original platform Solana wallet
// DEXTER_SOLANA_WALLET: wallet assigned by Dexter facilitator during onboarding (receives Dexter-routed Solana payments)
const SOLANA_PLATFORM_WALLET = process.env.DEXTER_SOLANA_WALLET || "BmUPzSupHJu2kW4cL27dF7Vc2JaZTwXKzFsRuagPDtL8";
const SOLANA_PLATFORM_WALLET_LEGACY = "Hgby7VEo6vaPayM1G7kkjTqMAo4aCARoXA3ftWKz1m4k";

// Stablecoin contract addresses on Ethereum mainnet
const USDC_ETHEREUM = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as const;
const USDT_ETHEREUM = "0xdAC17F958D2ee523a2206206994597C13D831ec7" as const;

// Stablecoin contract addresses on Base mainnet
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
const USDT_BASE = "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2" as const; // Bridged USDT on Base

// Robinhood Chain (eip155:4663, Arbitrum Orbit L2) — launched July 1, 2026
// CCTP domain: NOT YET ASSIGNED by Circle. Watch: https://developers.circle.com/stablecoins/cctp-protocol-contract
// USDC address: set USDC_ROBINHOOD_ADDRESS env var once Circle publishes native USDC for eip155:4663
// Enable payments: set ROBINHOOD_CHAIN_CCTP_ENABLED=true once CCTP domain is confirmed
const ROBINHOOD_CHAIN_CCTP_ENABLED = process.env.ROBINHOOD_CHAIN_CCTP_ENABLED === 'true';
const USDC_ROBINHOOD = (process.env.USDC_ROBINHOOD_ADDRESS || "") as string;
// CCTP_DOMAIN_ROBINHOOD: placeholder — update with uint32 assigned by Circle for eip155:4663
const CCTP_DOMAIN_ROBINHOOD: number | null = process.env.CCTP_DOMAIN_ROBINHOOD
  ? parseInt(process.env.CCTP_DOMAIN_ROBINHOOD, 10)
  : null;

// Solana SPL token mints
const USDC_SOLANA = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDT_SOLANA = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";

// Accepted stablecoins for x402 payments (EVM)
const ACCEPTED_STABLECOINS = [
  USDC_BASE, USDT_BASE, USDC_ETHEREUM, USDT_ETHEREUM,
  ...(ROBINHOOD_CHAIN_CCTP_ENABLED && USDC_ROBINHOOD ? [USDC_ROBINHOOD] : [])
];
// Accepted stablecoins for Solana
const ACCEPTED_SOLANA_TOKENS = [USDC_SOLANA, USDT_SOLANA];

// Solana RPC connection (uses Helius if API key available, otherwise public RPC)
const _heliusApiKey = process.env.HELIUS_API_KEY;
const SOLANA_RPC_URL = (_heliusApiKey ? `https://mainnet.helius-rpc.com/?api-key=${_heliusApiKey}` : null)
  || process.env.HELIUS_RPC_URL
  || process.env.SOLANA_RPC_URL
  || "https://api.mainnet-beta.solana.com";

let solanaConnection: Connection | null = null;

function getSolanaConnection(): Connection {
  if (!solanaConnection) {
    solanaConnection = new Connection(SOLANA_RPC_URL, "confirmed");
    console.log(`✅ Solana connection initialized: ${SOLANA_RPC_URL.substring(0, 40)}...`);
  }
  return solanaConnection;
}

// Helper to detect if a string is a valid Solana signature (base58, 87-88 chars)
function isSolanaSignature(str: string): boolean {
  if (!str || str.startsWith("0x")) return false;
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{85,90}$/;
  return base58Regex.test(str);
}

// Verify Solana transaction payment
interface SolanaPaymentResult {
  verified: boolean;
  amount?: number;
  token?: string;
  tokenMint?: string;
  fromWallet?: string;
  error?: string;
}

// Known platform token accounts (ATAs) for USDC and USDT
// These are the actual Associated Token Accounts that receive tokens
// Derived from: getAssociatedTokenAddressSync(MINT, PLATFORM_WALLET)
// For production, these should be pre-computed or derived dynamically
const PLATFORM_TOKEN_ACCOUNTS: Record<string, string> = {};

// Initialize platform token accounts lazily
// Returns all valid ATAs for a given mint (Dexter wallet + legacy wallet)
async function getPlatformTokenAccount(mintAddress: string): Promise<string | null> {
  const cacheKey = `${SOLANA_PLATFORM_WALLET}:${mintAddress}`;
  if (PLATFORM_TOKEN_ACCOUNTS[cacheKey]) {
    return PLATFORM_TOKEN_ACCOUNTS[cacheKey];
  }
  
  try {
    const { PublicKey } = await import("@solana/web3.js");
    const { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } = await import("@solana/spl-token");
    
    const platformWallet = new PublicKey(SOLANA_PLATFORM_WALLET);
    const mint = new PublicKey(mintAddress);
    
    const ata = getAssociatedTokenAddressSync(mint, platformWallet, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
    PLATFORM_TOKEN_ACCOUNTS[cacheKey] = ata.toBase58();
    console.log(`✅ Platform ATA for ${mintAddress.substring(0,8)}...: ${ata.toBase58()}`);
    return ata.toBase58();
  } catch (error: any) {
    console.error(`❌ Failed to derive platform ATA: ${error.message}`);
    return null;
  }
}

// Get ALL valid ATAs for a given mint (Dexter wallet + legacy wallet for backward compat)
// CRITICAL: getAssociatedTokenAddressSync(mint, owner, ...) — mint FIRST, owner SECOND.
async function getAllPlatformTokenAccounts(mintAddress: string): Promise<string[]> {
  const accounts: string[] = [];
  try {
    const { PublicKey } = await import("@solana/web3.js");
    const { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } = await import("@solana/spl-token");
    const mint = new PublicKey(mintAddress);
    for (const walletAddr of [SOLANA_PLATFORM_WALLET, SOLANA_PLATFORM_WALLET_LEGACY]) {
      try {
        // Correct order: mint first, owner (wallet) second
        const ata = getAssociatedTokenAddressSync(mint, new PublicKey(walletAddr), false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
        accounts.push(ata.toBase58());
      } catch (_) {}
    }
  } catch (_) {}
  return [...new Set(accounts)]; // deduplicate
}

async function verifySolanaPayment(signature: string, expectedAmount: number, maxRetries: number = 6): Promise<SolanaPaymentResult> {
  const connection = getSolanaConnection();
  
  // Retry logic to handle transaction settlement delays
  // Solana block time is ~400ms, finality typically takes 2-3 blocks
  // We poll up to 6 times with 5-second intervals (30 seconds total)
  let tx: any = null;
  let lastError = "Transaction not found";
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      tx = await connection.getParsedTransaction(signature, { maxSupportedTransactionVersion: 0 });
      
      if (tx) {
        if (tx.meta?.err) {
          return { verified: false, error: "Transaction failed on-chain" };
        }
        break; // Transaction found and didn't fail, proceed to verification
      }
      
      // Transaction not found yet - wait and retry
      if (attempt < maxRetries) {
        console.log(`⏳ Solana tx ${signature.substring(0,12)}... not found yet, retry ${attempt}/${maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second delay
      }
    } catch (rpcError: any) {
      lastError = rpcError.message || "RPC error";
      console.warn(`⚠️ Solana RPC error on attempt ${attempt}: ${lastError}`);
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 3000)); // shorter delay for RPC errors
      }
    }
  }
  
  if (!tx) {
    return { verified: false, error: `Transaction not found after ${maxRetries} attempts: ${lastError}` };
  }
  
  try {
    
    // Get platform ATAs for accepted tokens — includes both Dexter wallet and legacy wallet
    const [usdcATAs, usdtATAs] = await Promise.all([
      getAllPlatformTokenAccounts(USDC_SOLANA),
      getAllPlatformTokenAccounts(USDT_SOLANA),
    ]);
    
    if (usdcATAs.length === 0 && usdtATAs.length === 0) {
      return { verified: false, error: "Cannot derive platform token accounts" };
    }
    
    // Build mapping of ATA -> mint for verification (all wallets)
    const ataToMint: Record<string, { mint: string; name: string }> = {};
    for (const ata of usdcATAs) ataToMint[ata] = { mint: USDC_SOLANA, name: 'USDC' };
    for (const ata of usdtATAs) ataToMint[ata] = { mint: USDT_SOLANA, name: 'USDT' };
    const platformATAs = Object.keys(ataToMint);
    
    // SECURITY: Verify balance increase via postTokenBalances
    // This is the authoritative source - instruction parsing can be spoofed
    const postTokenBalances = tx.meta?.postTokenBalances || [];
    const preTokenBalances = tx.meta?.preTokenBalances || [];
    
    let verifiedTransfer: { amount: number; mint: string; tokenName: string; from: string } | null = null;
    
    for (const postBalance of postTokenBalances) {
      // Check if this is one of our platform ATAs
      const accountKeys = tx.transaction.message.accountKeys;
      const accountIndex = postBalance.accountIndex;
      const accountKey = accountKeys[accountIndex];
      
      // Handle various account key formats from Solana RPC
      let accountAddress = '';
      if (typeof accountKey === 'string') {
        accountAddress = accountKey;
      } else if (accountKey && typeof accountKey === 'object') {
        // ParsedMessageAccount format: { pubkey: PublicKey, signer: boolean, source: string, writable: boolean }
        if ('pubkey' in accountKey) {
          const pubkey = accountKey.pubkey;
          accountAddress = typeof pubkey === 'string' ? pubkey : 
                           (pubkey?.toBase58?.() || pubkey?.toString?.() || '');
        }
        // Alternative: direct PublicKey object
        if (!accountAddress && accountKey.toBase58) {
          accountAddress = accountKey.toBase58();
        }
        if (!accountAddress && accountKey.toString) {
          accountAddress = accountKey.toString();
        }
      }
      
      if (!accountAddress || !platformATAs.includes(accountAddress)) continue;
      
      const ataInfo = ataToMint[accountAddress];
      if (!ataInfo) continue;
      
      // Verify the mint matches
      if (postBalance.mint !== ataInfo.mint) continue;
      
      // Get pre-balance for comparison
      const preBalance = preTokenBalances.find(
        pb => pb.accountIndex === accountIndex && pb.mint === postBalance.mint
      );
      
      const preAmount = preBalance?.uiTokenAmount?.uiAmount || 0;
      const postAmount = postBalance.uiTokenAmount?.uiAmount || 0;
      
      // SECURITY: Validate amounts are proper numbers
      if (!Number.isFinite(preAmount) || !Number.isFinite(postAmount)) {
        console.warn(`⚠️ Invalid balance amounts: pre=${preAmount}, post=${postAmount}`);
        continue;
      }
      
      const balanceIncrease = postAmount - preAmount;
      
      // SECURITY: Must have positive balance increase
      if (balanceIncrease <= 0) {
        console.warn(`⚠️ No balance increase: ${balanceIncrease}`);
        continue;
      }
      
      // Try to find the sender from instruction info
      let fromWallet = 'unknown';
      for (const ix of tx.transaction.message.instructions) {
        if ('parsed' in ix && ix.program === 'spl-token') {
          const info = ix.parsed?.info;
          if (info?.destination === accountAddress || info?.destination === accountAddress) {
            fromWallet = info?.authority || info?.source || 'unknown';
            break;
          }
        }
      }
      
      verifiedTransfer = {
        amount: balanceIncrease,
        mint: ataInfo.mint,
        tokenName: ataInfo.name,
        from: fromWallet
      };
      break;
    }
    
    if (!verifiedTransfer) {
      return { verified: false, error: "No verified balance increase to platform wallet" };
    }
    
    // SECURITY: Validate amount is a proper positive number
    if (!Number.isFinite(verifiedTransfer.amount) || verifiedTransfer.amount <= 0) {
      return { verified: false, error: `Invalid amount: ${verifiedTransfer.amount}` };
    }
    
    // Check amount (allow 5% tolerance for fees)
    const expectedUsd = expectedAmount / 1_000_000;
    if (verifiedTransfer.amount < expectedUsd * 0.95) {
      return { verified: false, error: `Insufficient amount: ${verifiedTransfer.amount} < ${expectedUsd}` };
    }
    
    console.log(`✅ Solana payment verified via balance change: +${verifiedTransfer.amount} ${verifiedTransfer.tokenName} to platform ATA`);
    
    return {
      verified: true,
      amount: verifiedTransfer.amount,
      token: verifiedTransfer.tokenName,
      tokenMint: verifiedTransfer.mint,
      fromWallet: verifiedTransfer.from
    };
  } catch (error: any) {
    console.error(`❌ Solana payment verification error:`, error.message);
    return { verified: false, error: error.message };
  }
}

// EIP-3009 ABI for USDC transferWithAuthorization
const EIP3009_ABI = parseAbi([
  "function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s) external"
]);

// Initialize platform wallet client for EIP-3009 execution
let platformWalletClient: ReturnType<typeof createWalletClient> | null = null;
let platformPublicClient: ReturnType<typeof createPublicClient> | null = null;

function getPlatformWalletClient() {
  if (!platformWalletClient) {
    const privateKey = process.env.PLATFORM_EOA_PRIVATE_KEY || process.env.EVM_PRIVATE_KEY;
    if (!privateKey) {
      console.error("❌ No platform wallet private key available for EIP-3009 execution");
      return null;
    }
    const account = privateKeyToAccount(privateKey.startsWith("0x") ? privateKey as Hex : `0x${privateKey}` as Hex);
    platformWalletClient = createWalletClient({
      account,
      chain: base,
      transport: http("https://mainnet.base.org"),
    });
    platformPublicClient = createPublicClient({
      chain: base,
      transport: http("https://mainnet.base.org"),
    });
    console.log(`✅ Platform wallet initialized for EIP-3009: ${account.address}`);
  }
  return platformWalletClient;
}

// CANONICAL_BASE_URL - Always use production domain for 402 responses
// This ensures agents receive consistent resource URLs regardless of which environment serves the request
const CANONICAL_BASE_URL = process.env.PUBLIC_URL || 'https://coinrailz.com';

// Helper to get the canonical public URL - always returns production domain
function getPublicBaseUrl(req: Request): string {
  // Always return canonical production URL for 402 resource consistency
  // Agents need stable URLs to match payment verification
  return CANONICAL_BASE_URL;
}

/**
 * Payment Orchestrator - SELF-CONTAINED x402 payment handling with full funnel instrumentation
 * 
 * ENHANCED: Full funnel tracking for Discovery → Probe → Pay conversion analysis
 * 
 * Decision tree:
 * 0. If first-call free eligible + cheapest service → execute handler directly (with tracking)
 * 1. If bundle subscription → execute handler directly
 * 2. If no X-PAYMENT header → generate 402 with payment requirements (TRACKED)
 * 3. If raw 0x transaction hash → verify on-chain, execute handler (TRACKED)
 * 4. If Base64 JSON with txHash → verify on-chain, execute handler (TRACKED)
 * 5. If EIP-712 signature → verify via facilitator (fallback to next middleware)
 */
export function createPaymentOrchestrator(
  serviceName: string,
  requiredAmount: number,
  handler: (req: Request, res: Response) => Promise<void>
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const requestId = nanoid();
    const startTime = Date.now();
    const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
    const userAgent = req.headers['user-agent'];
    const offerTrackingId = req.query?.offer_tracking as string;
    const knownAgent = detectKnownAgent(userAgent);
    
    // Check if bundle subscription exists (set by bundleAuthMiddleware)
    if (req.bundleSubscription) {
      const priceUsd = SERVICE_PRICING_USD[serviceName as keyof typeof SERVICE_PRICING_USD] || 1.00;
      console.log(`🎫 Bundle subscription detected for ${serviceName}, executing handler directly`);
      res.locals.payment = { method: "bundle-subscription", subscriptionId: req.bundleSubscription.id, amount: priceUsd, status: 'paid' };
      await handler(req, res);
      
      // Track bundle payment
      await x402InteractionTracker.trackInteraction({
        serviceId: serviceName,
        ipAddress,
        userAgent,
        requestPath: req.originalUrl,
        requestMethod: req.method,
        responseStatus: 200,
        paid: true,
        amount: priceUsd,
        interactionType: 'payment',
        requestId,
        eventType: 'bundle-payment',
        serviceName,
        latencyMs: Date.now() - startTime,
        paymentReceived: true,
        paymentAmount: priceUsd,
        offerTrackingId,
        metadata: { method: 'bundle-subscription', knownAgent: knownAgent.name }
      });

      emitFirstX402CallAsync({ ip: ipAddress, paymentRail: 'bundle_subscription', serviceName, userAgent: userAgent as string | undefined });
      
      if (offerTrackingId) {
        try {
          await offerLinkService.recordConversion(offerTrackingId, priceUsd);
        } catch (convErr: any) {
          console.error(`⚠️ Failed to record bundle conversion: ${convErr.message}`);
        }
      }
      return;
    }

    const xPayment = (req.headers["x-payment"] || req.headers["payment-signature"]) as string | undefined;
    // Detect MPP Authorization: Payment credential on the /x402/* path.
    // Agents routing through Cloudflare Workers/WARP often strip User-Agent but retain
    // Authorization headers. When hasMppCredential is true the agent is attempting to pay
    // (not claim a free trial), so the UA guard is irrelevant — bypass it.
    const hasMppCredential = /^Payment\s+/i.test((req.headers["authorization"] ?? '') as string);

    // Detect Cloudflare Wallet agent identity.
    // CF agents identify themselves via cloudflare-agent-id / cf-agent-id headers (cloudflare.id).
    // Using this as the eligibility key is more stable than IP+UA for roaming CF agents.
    const cfAgentId = (
      req.headers['cloudflare-agent-id'] ||
      req.headers['cf-agent-id'] ||
      req.headers['x-cloudflare-agent-id'] ||
      null
    ) as string | null;
    if (cfAgentId) {
      console.log(`☁️  Cloudflare Wallet agent detected: cfAgentId=${cfAgentId.substring(0, 32)} service=${serviceName}`);
    }

    // FIRST-CALL FREE: Check if eligible for free call on cheapest services
    // Skip when hasMppCredential — let the orchestrator issue a protocol-mismatch 402 below
    // so the agent receives clear guidance on the correct endpoint rather than a silent denial.
    // NOTE: cfAgentId is logged for attribution only — we deliberately do NOT use it to bypass
    // the UA guard or alter the eligibility key. The cloudflare-agent-id header is unverified
    // (any caller can forge it), and using it as an eligibility key creates a replay attack
    // vector because the DB stores the original userAgent, not the synthetic key.
    if (!xPayment && !hasMppCredential && FIRST_CALL_FREE_SERVICES.includes(serviceName)) {
      const eligible = await isEligibleForFirstCallFree(ipAddress, userAgent);
      
      if (eligible) {
        console.log(`🎁 First-call FREE granted for ${serviceName} to ${knownAgent.name} (${ipAddress})`);
        
        res.locals.payment = { method: "first-call-free", amount: 0, status: 'complimentary' };
        
        try {
          await handler(req, res);
          
          const actualStatus = res.statusCode;
          
          if (actualStatus >= 400) {
            // Handler rejected the request (malformed input etc.) — do NOT burn the free trial.
            // Actor can retry with a valid request body and still get their complimentary call.
            console.log(`⚠️ First-call-free NOT granted for ${serviceName}: handler returned ${actualStatus} (trial preserved for retry)`);
            await x402InteractionTracker.trackInteraction({
              serviceId: serviceName,
              ipAddress,
              userAgent,
              requestPath: req.originalUrl,
              requestMethod: req.method,
              responseStatus: actualStatus,
              paid: false,
              amount: 0,
              interactionType: 'payment',
              requestId,
              eventType: 'first-call-free-rejected',
              serviceName,
              latencyMs: Date.now() - startTime,
              paymentReceived: false,
              paymentAmount: 0,
              offerTrackingId,
              metadata: {
                freeGrantOutcome: 'failed-validation',
                knownAgent: knownAgent.name,
                originalPrice: SERVICE_PRICING_USD[serviceName as keyof typeof SERVICE_PRICING_USD]
              }
            });
            return;
          }

          // Track the free call for future eligibility checks
          await x402InteractionTracker.trackInteraction({
            serviceId: serviceName,
            ipAddress,
            userAgent,
            requestPath: req.originalUrl,
            requestMethod: req.method,
            responseStatus: actualStatus,
            paid: false,
            amount: 0,
            interactionType: 'payment',
            requestId,
            eventType: 'first-call-free',
            serviceName,
            latencyMs: Date.now() - startTime,
            paymentReceived: false,
            paymentAmount: 0,
            offerTrackingId,
            metadata: { 
              first_call_free: 'granted',
              freeGrantOutcome: 'success',
              knownAgent: knownAgent.name,
              originalPrice: SERVICE_PRICING_USD[serviceName as keyof typeof SERVICE_PRICING_USD],
              ...(cfAgentId ? { cfAgentId: cfAgentId.substring(0, 64), paymentRail: 'cloudflare-wallet' } : {})
            }
          });
          
          // Update cache (isEligibleForFirstCallFree manages its own cache under ip:ua;
          // this outer write uses the same key so it's consistent)
          const cacheKey = `${ipAddress}:${userAgent?.substring(0, 50) || 'none'}`;
          FIRST_CALL_FREE_CACHE.set(cacheKey, { granted: true, timestamp: Date.now() });
          
          return;
        } catch (handlerError: any) {
          console.error(`❌ First-call-free handler error for ${serviceName}:`, handlerError.message);
          // Continue to 402 on error
        }
      }
    }

    // PROTOCOL-MISMATCH: Agent submitted Authorization: Payment (MPP credential) on /x402/* path.
    // x402 requires X-PAYMENT header; MPP credential belongs on /mpp/* endpoints.
    // Return a clear 402 with routing guidance instead of a silent 402 challenge.
    if (hasMppCredential && !xPayment) {
      const baseUrl = getPublicBaseUrl(req);
      console.log(`[x402] MPP credential on /x402/* — protocol-mismatch 402: service=${serviceName} IP=${ipAddress} ua=${userAgent || 'none'} hasMppCredential=true hasXPayment=false`);
      return res.status(402).json({
        error: 'PROTOCOL_MISMATCH',
        message: 'Authorization: Payment header detected (MPP protocol). The /x402/* path requires an X-PAYMENT header instead.',
        resolution: {
          option_a: {
            description: 'Use the /mpp/* endpoint with your existing Authorization: Payment credential',
            endpoint: `${baseUrl}/mpp/${serviceName}`,
            method: 'POST',
            headers: { 'Authorization': 'Payment <your-credential>' },
          },
          option_b: {
            description: 'Send USDC on-chain then resubmit to /x402/* with the tx hash in X-PAYMENT',
            endpoint: `${baseUrl}/x402/${serviceName}`,
            method: 'POST',
            headers: { 'X-PAYMENT': '<base64-encoded-payment-proof>' },
          },
        },
        docs: `${baseUrl}/openapi.json`,
        x402Version: 2,
      });
    }

    // PREPAID CREDITS: Check for GPT session or API key authentication
    // Runs AFTER first-call-free so free trials are honored
    // This enables zero-friction payments for ChatGPT users and API key holders
    const priceUsd = SERVICE_PRICING_USD[serviceName as keyof typeof SERVICE_PRICING_USD] || requiredAmount / 1000000;
    
    // Priority: GPT session authentication (zero-friction for ChatGPT users)
    // Check for OpenAI GPT headers OR existing GPT session mode (from middleware)
    const currentCtx = getAuthContext(req);
    const hasGptHeaders = !!(req.headers['openai-conversation-id'] || req.headers['openai-ephemeral-user-id']);
    const isGptSessionMode = currentCtx.mode === 'gpt_session' || currentCtx.mode === 'gpt_provisional';
    const hasApiKeyHeader = !!(req.headers['x-api-key'] || (req.headers['authorization'] as string)?.startsWith('Bearer cr_live_'));
    
    // GPT flow: has GPT headers OR existing GPT mode, AND no API key header
    const shouldRunGptFlow = (hasGptHeaders || isGptSessionMode) && !hasApiKeyHeader;
    
    // Dual-write logging for rollout safety
    logGptAuthPath('detect', {
      hasGptHeaders,
      isGptSessionMode,
      hasApiKeyHeader,
      currentMode: currentCtx.mode,
      shouldRunGptFlow,
      serviceName
    });
    
    // Only process GPT flow if feature flag is enabled OR we're in log-only mode
    if (shouldRunGptFlow && GPT_SESSION_AUTH_ENABLED) {
      try {
        logGptAuthPath('resolve-start', { serviceName });
        // Use refreshAndValidateAuthContext - throws on failure (no silent fall-through)
        const { userId, authContext } = await refreshAndValidateAuthContext(req);
        logGptAuthPath('resolve-success', { userId, mode: authContext.mode });
        
        const balance = await creditsService.getBalance(userId);
        if (balance >= priceUsd) {
          await creditsService.deductCredits({
            userId,
            amount: priceUsd,
            serviceName,
            description: `x402 Service: ${serviceName} ($${priceUsd.toFixed(2)}) via GPT session`
          });
          
          console.log(`💳 Orchestrator: GPT session payment for ${serviceName} - $${priceUsd.toFixed(2)} (user: ${userId}, mode: ${authContext.mode})`);
          logGptAuthPath('payment-success', { userId, amount: priceUsd, serviceName, balance });
          // Attach full resolved auth context for downstream consumers
          res.locals.payment = { method: "gpt-session", userId, amount: priceUsd, status: 'paid', authContext };
          
          await handler(req, res);
          
          // Track GPT session payment
          await x402InteractionTracker.trackInteraction({
            serviceId: serviceName,
            ipAddress,
            userAgent,
            requestPath: req.originalUrl,
            requestMethod: req.method,
            responseStatus: 200,
            paid: true,
            amount: priceUsd,
            interactionType: 'payment',
            requestId,
            eventType: 'gpt-session-payment',
            serviceName,
            latencyMs: Date.now() - startTime,
            paymentReceived: true,
            paymentAmount: priceUsd,
            offerTrackingId,
            metadata: { method: 'gpt-session', userId, knownAgent: knownAgent.name }
          });

          emitFirstX402CallAsync({ ip: ipAddress, paymentRail: 'gpt_session', serviceName, userAgent: userAgent as string | undefined, metadata: { userId } });
          
          if (offerTrackingId) {
            try {
              await offerLinkService.recordConversion(offerTrackingId, priceUsd);
            } catch (convErr: any) {
              console.error(`⚠️ Failed to record GPT session conversion: ${convErr.message}`);
            }
          }
          return;
        }
        // Insufficient credits - return 402 with guidance for GPT users
        console.log(`⚠️ Orchestrator: GPT session user ${userId} has insufficient credits ($${balance.toFixed(2)} < $${priceUsd.toFixed(2)})`);
        logGptAuthPath('insufficient-credits', { userId, balance, required: priceUsd, serviceName });
        return await generate402Response(req, res, serviceName, requiredAmount, knownAgent, requestId);
      } catch (gptErr: any) {
        // GPT session resolution failed - return structured error (no silent fall-through)
        console.error(`⚠️ Orchestrator: GPT session resolution failed for ${serviceName}: ${gptErr.message}`);
        logGptAuthPath('resolve-failed', { error: gptErr.message, serviceName });
        return generatePaymentErrorResponse(
          res,
          'PAYMENT_VERIFICATION_EXCEPTION',
          `GPT session resolution failed: ${gptErr.message}`,
          `Try refreshing the ChatGPT conversation or purchase credits at our platform`,
          requestId,
          { recoverable: true, httpStatus: 402 }
        );
      }
    } else if (shouldRunGptFlow && GPT_SESSION_AUTH_LOG_ONLY) {
      // Log-only mode: log what WOULD happen without changing behavior
      logGptAuthPath('log-only-skip', { 
        reason: 'Feature flag GPT_SESSION_AUTH not enabled, only logging',
        serviceName
      });
    }
    
    // Priority: API key authentication
    const apiKey = req.headers['x-api-key'] as string || 
                   (req.headers['authorization'] as string)?.replace('Bearer ', '');
    
    if (apiKey && apiKey.startsWith('cr_live_')) {
      try {
        const keyValidation = await creditsService.validateApiKey(apiKey);
        if (keyValidation.valid && keyValidation.userId) {
          const balance = await creditsService.getBalance(keyValidation.userId);
          if (balance >= priceUsd) {
            const deductResult = await creditsService.deductCredits({
              userId: keyValidation.userId,
              amount: priceUsd,
              serviceName,
              description: `x402 Service: ${serviceName} ($${priceUsd.toFixed(2)}) via API key`
            });
            
            console.log(`💳 Orchestrator: API key payment for ${serviceName} - $${priceUsd.toFixed(2)} (user: ${keyValidation.userId})`);
            res.locals.payment = { method: "api-key", userId: keyValidation.userId, amount: priceUsd, status: 'paid' };

            // Billing headers — use atomic DB result to avoid TOCTOU race under concurrent requests
            const remainingBalance = Math.max(0, deductResult.newBalance);
            res.setHeader('X-Credits-Used', priceUsd.toFixed(4));
            res.setHeader('X-Credits-Remaining', remainingBalance.toFixed(4));
            res.setHeader('X-Recharge-Url', `${getPublicBaseUrl(req)}/api/m2m/credits/checkout/session`);
            res.setHeader('X-Payment-Method', 'api-key');

            // Fire auto-recharge check non-blocking — does NOT affect latency of this request
            void triggerAutoRechargeIfEnabled(keyValidation.userId, remainingBalance);

            await handler(req, res);
            
            // Track API key payment
            await x402InteractionTracker.trackInteraction({
              serviceId: serviceName,
              ipAddress,
              userAgent,
              requestPath: req.originalUrl,
              requestMethod: req.method,
              responseStatus: 200,
              paid: true,
              amount: priceUsd,
              interactionType: 'payment',
              requestId,
              eventType: 'api-key-payment',
              serviceName,
              latencyMs: Date.now() - startTime,
              paymentReceived: true,
              paymentAmount: priceUsd,
              offerTrackingId,
              metadata: { method: 'api-key', userId: keyValidation.userId, knownAgent: knownAgent.name }
            });

            emitFirstX402CallAsync({ ip: ipAddress, paymentRail: 'api_key', serviceName, userAgent: userAgent as string | undefined, metadata: { userId: keyValidation.userId } });
            
            if (offerTrackingId) {
              try {
                await offerLinkService.recordConversion(offerTrackingId, priceUsd);
              } catch (convErr: any) {
                console.error(`⚠️ Failed to record API key conversion: ${convErr.message}`);
              }
            }
            return;
          }
          // Insufficient credits - fall through to x402 payment
          console.log(`⚠️ Orchestrator: API key user ${keyValidation.userId} has insufficient credits ($${balance.toFixed(2)} < $${priceUsd.toFixed(2)})`);
        }
      } catch (apiKeyErr: any) {
        console.error(`⚠️ Orchestrator: API key payment error: ${apiKeyErr.message}`);
        // Fall through to x402 payment
      }
    }

    // No payment header → Generate 402 response ourselves (don't rely on x402-express)
    if (!xPayment) {
      console.log(`📊 Orchestrator: No payment for ${serviceName}, generating 402`);
      
      // FUNNEL TRACKING: Log 402 challenge issuance
      await x402InteractionTracker.trackInteraction({
        serviceId: serviceName,
        ipAddress,
        userAgent,
        requestPath: req.originalUrl,
        requestMethod: req.method,
        responseStatus: 402,
        paid: false,
        interactionType: 'attempt',
        requestId,
        eventType: 'challenge-issued',
        serviceName,
        latencyMs: Date.now() - startTime,
        paymentReceived: false,
        offerTrackingId,
        metadata: { 
          reason: 'no-payment-header',
          knownAgent: knownAgent.name,
          isKnownAgent: knownAgent.isKnown,
          priceUsd: SERVICE_PRICING_USD[serviceName as keyof typeof SERVICE_PRICING_USD]
        }
      });
      
      return await generate402Response(req, res, serviceName, requiredAmount, knownAgent, requestId);
    }

    // EARLY VALIDATION: Check payment header format before attempting decode
    // This catches malformed tx hashes and binary garbage with helpful error messages
    const headerValidation = validatePaymentHeaderFormat(xPayment);
    if (!headerValidation.valid) {
      console.log(`🔴 Orchestrator: Payment header validation failed for ${serviceName}: ${headerValidation.message}`);
      
      // Track the validation error
      await x402InteractionTracker.trackInteraction({
        serviceId: serviceName,
        ipAddress,
        userAgent,
        requestPath: req.originalUrl,
        requestMethod: req.method,
        responseStatus: 400,
        paid: false,
        interactionType: 'error',
        requestId,
        eventType: 'payment-format-invalid',
        serviceName,
        latencyMs: Date.now() - startTime,
        paymentReceived: false,
        errorMessage: headerValidation.message,
        offerTrackingId,
        metadata: { 
          reason: headerValidation.code,
          headerLength: xPayment.length,
          headerPreview: xPayment.substring(0, 30),
          knownAgent: knownAgent.name
        }
      });
      
      return generatePaymentErrorResponse(
        res,
        headerValidation.code!,
        headerValidation.message!,
        headerValidation.hint!,
        requestId,
        {
          recoverable: true,
          httpStatus: 400,
          expectedFormat: {
            txHash: '0x + 64 hex characters (66 total) for EVM, or base58 signature for Solana',
            facilitatorPayload: 'Base64-encoded JSON or CBOR payload from x402 facilitator',
            examples: [
              '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef (EVM tx hash)',
              '5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW (Solana signature)'
            ]
          }
        }
      );
    }

    let txHash: string | null = null;
    let paymentChain: 'base' | 'ethereum' | 'arbitrum' | 'robinhood' | 'solana' | null = null;

    // Case 1: Raw EVM transaction hash (0x prefixed, 66 chars)
    // No default chain — agents MUST specify network in JSON payload.
    // Raw 0x hashes without a network field are verified against Base first (most common),
    // then Ethereum, then Arbitrum. This prevents silent wrong-chain rejection.
    if (xPayment.startsWith("0x") && xPayment.length === 66) {
      txHash = xPayment;
      paymentChain = 'base'; // will attempt Base first, then fallback multi-chain below
      console.log(`🔐 Orchestrator: Raw EVM hash detected for ${serviceName}: ${xPayment.substring(0, 10)}... (will try Base→Ethereum→Arbitrum)`);
    } 
    // Case 2: Raw Solana transaction signature (base58, 87-88 chars)
    else if (isSolanaSignature(xPayment)) {
      txHash = xPayment;
      paymentChain = 'solana';
      console.log(`🔐 Orchestrator: Solana signature detected for ${serviceName}: ${xPayment.substring(0, 10)}...`);
      
      // REPLAY PROTECTION: Check for existing intent before verifying
      const solanaExisting = await db
        .select()
        .from(x402PaymentIntents)
        .where(and(eq(x402PaymentIntents.txHash, xPayment), eq(x402PaymentIntents.serviceName, serviceName)))
        .limit(1);
      if (solanaExisting.length > 0) {
        const existingStatus = solanaExisting[0].status;
        if (existingStatus === 'SUCCEEDED') {
          console.warn(`⚠️ Orchestrator: Solana signature replay rejected for ${serviceName}: ${xPayment.substring(0, 16)}...`);
          return generatePaymentErrorResponse(res, 'SOLANA_REPLAY_REJECTED', 'Payment signature already used for this service', 'Each Solana transaction signature can only be used once per service.', requestId, { recoverable: false, httpStatus: 402 });
        }
        if (existingStatus === 'PENDING') {
          console.warn(`⚠️ Orchestrator: Duplicate concurrent Solana request for ${serviceName}: ${xPayment.substring(0, 16)}...`);
          return generatePaymentErrorResponse(res, 'SOLANA_DUPLICATE_REQUEST', 'Concurrent payment request in progress', 'A payment with this signature is already being processed.', requestId, { recoverable: false, httpStatus: 402 });
        }
      }

      // Verify Solana payment directly
      const solanaResult = await verifySolanaPayment(xPayment, requiredAmount);
      
      if (solanaResult.verified) {
        console.log(`✅ Orchestrator: Solana payment verified! Amount: $${solanaResult.amount} ${solanaResult.token}`);
        
        // Set payment info in res.locals for handler
        res.locals.payment = {
          method: 'solana-transaction',
          chain: 'solana',
          network: 'solana:mainnet',
          token: solanaResult.token,
          tokenMint: solanaResult.tokenMint,
          amount: solanaResult.amount,
          txHash: xPayment,
          walletAddress: solanaResult.fromWallet,
          verified: true
        };

        // Write PENDING intent — unique constraint blocks any concurrent replay from here
        const solanaIntentId = nanoid();
        const solanaExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
        await db.insert(x402PaymentIntents).values({
          id: solanaIntentId,
          txHash: xPayment,
          network: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
          serviceName,
          payer: solanaResult.fromWallet || '',
          amount: solanaResult.amount.toString(),
          status: 'PENDING',
          retries: 0,
          expiresAt: solanaExpiresAt,
          metadata: { chain: 'solana', token: solanaResult.token, paymentScheme: 'direct' },
          isCanary: isCanaryPayer(solanaResult.fromWallet),
        }).onConflictDoNothing();
        console.log(`📝 Solana intent ${solanaIntentId} created as PENDING`);
        
        // Track successful Solana payment
        await x402InteractionTracker.trackInteraction({
          serviceId: serviceName,
          ipAddress,
          userAgent,
          requestPath: req.originalUrl,
          requestMethod: req.method,
          responseStatus: 200,
          paid: true,
          amount: solanaResult.amount,
          interactionType: 'payment',
          requestId,
          eventType: 'solana-payment',
          serviceName,
          latencyMs: Date.now() - startTime,
          paymentReceived: true,
          paymentAmount: solanaResult.amount,
          offerTrackingId,
          metadata: { 
            chain: 'solana',
            token: solanaResult.token,
            txHash: xPayment,
            fromWallet: solanaResult.fromWallet,
            knownAgent: knownAgent.name
          }
        });
        
        // Execute the handler — mark SUCCEEDED on completion, FAILED on error
        try {
          await handler(req, res);
          await db.update(x402PaymentIntents)
            .set({ status: 'SUCCEEDED', succeededAt: new Date(), updatedAt: new Date() })
            .where(and(eq(x402PaymentIntents.txHash, xPayment), eq(x402PaymentIntents.serviceName, serviceName)));
          console.log(`✅ Solana intent marked SUCCEEDED for ${serviceName}`);
          emitFirstX402CallAsync({ ip: ipAddress, paymentRail: 'solana', serviceName, userAgent: userAgent as string | undefined, walletAddress: solanaResult.fromWallet || undefined, metadata: { token: solanaResult.token } });
        } catch (handlerErr: any) {
          await db.update(x402PaymentIntents)
            .set({ status: 'FAILED', lastError: handlerErr.message, updatedAt: new Date() })
            .where(and(eq(x402PaymentIntents.txHash, xPayment), eq(x402PaymentIntents.serviceName, serviceName)));
          console.error(`❌ Solana intent marked FAILED for ${serviceName}: ${handlerErr.message}`);
          throw handlerErr;
        }
        return;
      } else {
        console.error(`❌ Orchestrator: Solana payment verification failed: ${solanaResult.error}`);

        // Detect underpayment from the trusted verifySolanaPayment result ONLY.
        // Match "Insufficient amount: X < Y" — the exact string emitted by verifySolanaPayment when a
        // confirmed on-chain transaction paid too little. This is NOT a wallet balance shortfall; the
        // payer may have ample USDC but simply authorized too small an amount.
        // Do NOT use broad patterns that could match arbitrary RPC errors at the catch-all.
        const isSolanaUnderpayment = (solanaResult.error || '').toLowerCase().includes('insufficient amount:');

        if (isSolanaUnderpayment) {
          const priceUsd = SERVICE_PRICING_USD[serviceName as keyof typeof SERVICE_PRICING_USD] || 1.00;
          const priceStr = priceUsd.toFixed(6);
          const knownPayerWallet = solanaResult.fromWallet || null;
          // Derive active network from RPC URL — never hardcode
          const activeSolNetwork = SOLANA_RPC_URL.includes('devnet') ? 'solana-devnet' : 'solana-mainnet';
          const activeSolMint = SOLANA_RPC_URL.includes('devnet')
            ? 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr'  // Solana devnet USDC
            : USDC_SOLANA;
          // Parse received amount from "Insufficient amount: X < Y" (X=received, Y=required in USD)
          const amtMatch = (solanaResult.error || '').match(/insufficient amount:\s*([\d.]+)\s*<\s*([\d.]+)/i);
          const receivedAmountStr = amtMatch ? parseFloat(amtMatch[1]).toFixed(6) : null;
          const shortfallStr = (amtMatch && receivedAmountStr !== null)
            ? Math.max(0, parseFloat(amtMatch[2]) - parseFloat(amtMatch[1])).toFixed(6)
            : null;
          console.log(`💳 Solana underpayment for ${serviceName} on ${activeSolNetwork}: received=${receivedAmountStr ?? '?'} required=${priceStr} (payer: ${knownPayerWallet ?? 'unknown'})`);

          await x402InteractionTracker.trackInteraction({
            serviceId: serviceName,
            ipAddress,
            userAgent,
            requestPath: req.originalUrl,
            requestMethod: req.method,
            responseStatus: 402,
            paid: false,
            interactionType: 'error',
            requestId,
            eventType: 'insufficient-balance',
            serviceName,
            latencyMs: Date.now() - startTime,
            paymentReceived: false,
            errorMessage: `Solana underpayment: received ${receivedAmountStr ?? '?'} USDC, required ${priceStr}`,
            walletAddress: knownPayerWallet || undefined,
            offerTrackingId,
            metadata: { reason: 'underpayment', network: activeSolNetwork, received: receivedAmountStr, required: priceStr, payerWallet: knownPayerWallet }
          });

          const _baseUrl = getPublicBaseUrl(req);
          const retryEndpoint = `${_baseUrl}/x402/${serviceName}`;
          res.setHeader('X-Agent-Instructions', 'https://coinrailz.com/.well-known/agent-instructions.json');
          res.setHeader('Link', '<https://coinrailz.com/.well-known/agent-instructions.json>; rel="agent-instructions"');
          return res.status(402).json({
            error: {
              code: "insufficient_payment_amount",
              message: `Payment for ${serviceName} was below the required amount.`,
              retryable: true
            },
            payment_required: {
              service: serviceName,
              network: activeSolNetwork,
              token: "USDC",
              token_mint: activeSolMint,
              payment_recipient: SOLANA_PLATFORM_WALLET,
              minimum_required_usdc: priceStr,
              ...(receivedAmountStr !== null ? { received_amount_usdc: receivedAmountStr } : {}),
              ...(shortfallStr !== null ? { shortfall_usdc: shortfallStr } : {}),
              ...(knownPayerWallet ? { payer_wallet: knownPayerWallet } : {}),
              retry: {
                method: "POST",
                endpoint: retryEndpoint,
                instruction: `Create a new signed X-PAYMENT transaction for at least ${priceStr} USDC to ${SOLANA_PLATFORM_WALLET} on ${activeSolNetwork} (mint: ${activeSolMint}). Fund ${knownPayerWallet ?? 'your payer wallet'} first if its available USDC balance is below ${priceStr}.`
              }
            },
            requestId
          });
        }
        
        // Other Solana verification errors (tx not found, wrong amount confirmed on chain, etc.)
        return generatePaymentErrorResponse(
          res,
          'SOLANA_VERIFICATION_FAILED',
          `Solana payment verification failed: ${solanaResult.error}`,
          `Ensure you sent USDC or USDT to wallet ${SOLANA_PLATFORM_WALLET}. Wait for transaction confirmation before submitting.`,
          requestId,
          {
            recoverable: true,
            httpStatus: 402,
            expectedFormat: {
              txHash: 'Solana transaction signature (base58, 87-88 characters)',
              examples: [
                `Send USDC/USDT to ${SOLANA_PLATFORM_WALLET}`,
                'Wait for transaction confirmation',
                'Submit confirmed tx signature in X-PAYMENT header'
              ]
            }
          }
        );
      }
    }
    // Case 3: Base64-encoded payload (JSON or CBOR) with txHash
    else {
      const decodeResult = decodePaymentPayload(xPayment);
      
      if (!decodeResult.success) {
        console.log(`🔐 Orchestrator: Failed to decode payment header for ${serviceName}: ${decodeResult.error}`);
        
        // FUNNEL TRACKING: Payment header decode failure with format info
        await x402InteractionTracker.trackInteraction({
          serviceId: serviceName,
          ipAddress,
          userAgent,
          requestPath: req.originalUrl,
          requestMethod: req.method,
          responseStatus: 400,
          paid: false,
          interactionType: 'error',
          requestId,
          eventType: 'payment-decode-failed',
          serviceName,
          latencyMs: Date.now() - startTime,
          paymentReceived: false,
          errorMessage: decodeResult.error,
          offerTrackingId,
          metadata: { 
            reason: 'multi-format-decode-failed',
            detectedFormat: decodeResult.format,
            fingerprint: decodeResult.fingerprint,
            knownAgent: knownAgent.name,
            headerLength: xPayment.length
          }
        });
        
        // Return machine-readable error instead of generic 402.
        // Include a minimal retry_accepts[] so agents can inspect the expected format
        // and a retry_challenge_endpoint so they can fetch a fresh full challenge without
        // another decode attempt. This prevents compatibility probers from marking the
        // service non-compliant after a single format mismatch.
        const _retryPriceUsd = SERVICE_PRICING_USD[serviceName as keyof typeof SERVICE_PRICING_USD] || 1.00;
        const _retryAmountStr = String(Math.round(_retryPriceUsd * 1_000_000));
        const _retryBaseUrl = getPublicBaseUrl(req);
        return generatePaymentErrorResponse(
          res,
          'PAYMENT_DECODE_FAILED',
          `Could not decode payment payload. Detected format: ${decodeResult.format}. ${decodeResult.error || 'Unknown decoding error.'}`,
          `Submit X-PAYMENT header as: (1) Raw transaction hash starting with 0x (66 chars), (2) Solana signature in base58, or (3) base64-encoded JSON/CBOR facilitator payload`,
          requestId,
          {
            recoverable: true,
            httpStatus: 400,
            expectedFormat: {
              txHash: 'EVM: 0x + 64 hex chars (66 total). Solana: base58 signature (87-88 chars)',
              facilitatorPayload: 'Base64-encoded JSON with { txHash, payload } or CBOR from x402 facilitator',
              examples: [
                'Raw EVM hash: 0xabcd...1234 (66 characters)',
                'Raw Solana: 5VERv8NM... (87-88 characters)',
                'JSON payload: {"txHash":"0x...","network":"eip155:8453"}'
              ]
            },
            retryAccepts: [
              {
                network: 'eip155:8453',
                asset: 'USDC',
                payTo: PLATFORM_WALLET,
                maxAmountRequired: _retryAmountStr,
                facilitator: 'https://api.cdp.coinbase.com/platform/v2/x402'
              }
            ],
            retryChallengeEndpoint: `${_retryBaseUrl}/x402/${serviceName}`
          }
        );
      }
      
      const decoded = decodeResult.data;
      console.log(`🔐 Orchestrator: Decoded ${decodeResult.format.toUpperCase()} payment payload for ${serviceName}:`, JSON.stringify(decoded, null, 2).substring(0, 2000));
        
        // x402-fetch sends: { x402Version, scheme, network, payload: { signature, ... } }
        // The actual txHash may be in nested structures
        const payloadObj = decoded.payload || {};
        
        // Extract txHash from various possible locations in x402-fetch payload
        txHash = decoded.txHash 
          || payloadObj.txHash 
          || payloadObj.authorization?.txHash
          || payloadObj.receipt?.transactionHash
          || payloadObj.transactionHash
          || decoded.authorization?.txHash
          || decoded.transactionHash
          || decoded.receipt?.transactionHash;
        
        // Also check for x402 facilitator format
        if (!txHash && decoded.x402 && decoded.x402.txHash) {
          txHash = decoded.x402.txHash;
        }

        // Dexter facilitator format: { x402Version, accepted: SettleResponse }
        // x402 SettleResponse uses 'transaction' (not 'txHash') for the confirmed on-chain hash.
        // Dexter settles payments before sending X-PAYMENT, wrapping the receipt in 'accepted'.
        if (!txHash && decoded.accepted) {
          const acc = decoded.accepted as any;
          txHash = acc.transaction                    // x402 SettleResponse primary field
            || acc.txHash                             // alternate naming fallback
            || acc.payload?.transaction
            || acc.payload?.txHash
            || acc.payload?.authorization?.txHash
            || acc.payload?.receipt?.transactionHash
            || acc.payload?.transactionHash
            || acc.receipt?.transactionHash;
          if (txHash) {
            console.log(`🔐 Orchestrator: Extracted txHash from Dexter accepted field for ${serviceName}: ${txHash.substring(0, 10)}...`);
          }
          // Infer chain from accepted.network (Dexter SettleResponse includes network)
          const accNetwork = acc.network || acc.payload?.network;
          if (accNetwork && !paymentChain) {
            const n = String(accNetwork).toLowerCase();
            if (n === 'eip155:8453' || n === 'base' || n === 'base-mainnet') paymentChain = 'base';
            else if (n === 'eip155:1' || n === 'ethereum' || n === 'ethereum-mainnet') paymentChain = 'ethereum';
            else if (n === 'eip155:42161' || n === 'arbitrum' || n === 'arbitrum-mainnet' || n === 'arb') paymentChain = 'arbitrum';
            else if (n === 'eip155:4663' || n === 'robinhood' || n === 'robinhood-mainnet') paymentChain = 'robinhood';
            else if (n.startsWith('solana:') || n === 'solana' || n === 'solana-mainnet') paymentChain = 'solana';
            if (paymentChain) console.log(`🔐 Orchestrator: Chain inferred from Dexter accepted.network: ${accNetwork} -> ${paymentChain}`);
          }
        }

        // Detect chain from decoded payload network field
        const payloadNetwork = decoded.network || payloadObj.network || decoded.chain;
        if (payloadNetwork) {
          const n = String(payloadNetwork).toLowerCase();
          if (n === 'ethereum' || n === 'eip155:1' || n === 'ethereum-mainnet') {
            paymentChain = 'ethereum';
          } else if (n === 'base' || n === 'eip155:8453' || n === 'base-mainnet') {
            paymentChain = 'base';
          } else if (n === 'arbitrum' || n === 'eip155:42161' || n === 'arbitrum-mainnet' || n === 'arb') {
            paymentChain = 'arbitrum';
          } else if (n === 'robinhood' || n === 'eip155:4663' || n === 'robinhood-mainnet') {
            if (!ROBINHOOD_CHAIN_CCTP_ENABLED) {
              console.log(`❌ Orchestrator: Robinhood Chain payments not yet enabled (CCTP domain pending Circle assignment)`);
              return res.status(400).json({
                error: "Payment network not yet supported",
                message: "Robinhood Chain (eip155:4663) USDC payments are pending Circle CCTP domain assignment. Use Base (eip155:8453) or Solana instead.",
                supportedNetworks: ["base", "eip155:8453", "ethereum", "eip155:1", "arbitrum", "eip155:42161", "solana"],
                comingSoon: { network: "eip155:4663", name: "Robinhood Chain", status: "Awaiting Circle CCTP domain assignment" }
              });
            }
            paymentChain = 'robinhood';
          } else if (n.startsWith('solana:') || n === 'solana' || n === 'solana-mainnet') {
            // Solana handled in its own path below — do not reject here
          } else {
            // Explicitly unsupported network — reject fast, don't default to Base
            console.log(`❌ Orchestrator: Unsupported network in payload: ${payloadNetwork}`);
            return res.status(400).json({
              error: "Invalid payment proof format",
              message: `Unsupported network: ${payloadNetwork}. Supported: base, eip155:8453, ethereum, eip155:1, arbitrum, eip155:42161`,
              supportedNetworks: ["base", "eip155:8453", "ethereum", "eip155:1", "arbitrum", "eip155:42161", "solana"]
            });
          }
          console.log(`🔐 Orchestrator: Network detected from payload: ${payloadNetwork} -> chain: ${paymentChain}`);
        }
        
        // Check for signature-based auth that includes tx hash
        if (!txHash && payloadObj.signature && payloadObj.message) {
          try {
            const msgData = typeof payloadObj.message === 'string' 
              ? JSON.parse(payloadObj.message) 
              : payloadObj.message;
            txHash = msgData.txHash || msgData.transactionHash;
          } catch {}
        }
        
        // Check if this is an EIP-3009 authorization that we need to execute
        if (!txHash && payloadObj.signature && payloadObj.authorization) {
          console.log(`🔐 Orchestrator: EIP-3009 authorization detected for ${serviceName}, executing transferWithAuthorization...`);
          
          try {
            const walletClient = getPlatformWalletClient();
            if (!walletClient) {
              console.error(`❌ Orchestrator: No wallet client available for EIP-3009 execution`);
              return generatePaymentErrorResponse(
                res,
                'PAYMENT_VERIFICATION_EXCEPTION',
                'Platform wallet not available for EIP-3009 authorization execution',
                'Platform configuration error. Use direct transaction payment instead of EIP-3009 authorization.',
                requestId,
                { recoverable: false, httpStatus: 500 }
              );
            }
            
            const auth = payloadObj.authorization;
            const sig = payloadObj.signature as string;
            
            // Parse v, r, s from the signature (65 bytes: r=32, s=32, v=1)
            const sigHex = sig.startsWith("0x") ? sig.slice(2) : sig;
            
            // Validate signature length
            if (sigHex.length !== 130) {
              console.error(`❌ Invalid signature length: ${sigHex.length}, expected 130`);
              return generatePaymentErrorResponse(
                res,
                'PAYMENT_INVALID_TX_HASH_FORMAT',
                `Invalid EIP-3009 signature length: ${sigHex.length} chars (expected 130)`,
                'EIP-3009 signature must be 65 bytes (130 hex chars). Check your signing implementation.',
                requestId,
                { recoverable: true, httpStatus: 400 }
              );
            }
            
            const r = `0x${sigHex.slice(0, 64)}` as Hex;
            const s = `0x${sigHex.slice(64, 128)}` as Hex;
            let v = parseInt(sigHex.slice(128, 130), 16);
            if (v < 27) v += 27; // Normalize v value
            
            // Ensure nonce is properly padded to bytes32
            const nonceHex = auth.nonce.startsWith('0x') ? auth.nonce.slice(2) : auth.nonce;
            const paddedNonce = `0x${nonceHex.padStart(64, '0')}` as Hex;
            
            console.log(`🔐 EIP-3009 params: from=${auth.from}, to=${auth.to}, value=${auth.value}`);
            console.log(`🔐 EIP-3009 validity: after=${auth.validAfter}, before=${auth.validBefore}, nonce=${paddedNonce}`);
            
            // Execute the transferWithAuthorization
            const hash = await walletClient.writeContract({
              address: USDC_BASE,
              abi: EIP3009_ABI,
              functionName: "transferWithAuthorization",
              args: [
                auth.from as Hex,
                auth.to as Hex,
                BigInt(auth.value),
                BigInt(auth.validAfter),
                BigInt(auth.validBefore),
                paddedNonce,
                v,
                r,
                s
              ],
            });
            
            console.log(`✅ Orchestrator: EIP-3009 transfer executed! TxHash: ${hash}`);
            txHash = hash;
            
            // Wait for confirmation
            if (platformPublicClient) {
              const receipt = await platformPublicClient.waitForTransactionReceipt({ hash });
              console.log(`✅ Orchestrator: EIP-3009 confirmed in block ${receipt.blockNumber}`);
            }
          } catch (eip3009Error: any) {
            console.error(`❌ Orchestrator: EIP-3009 execution failed:`, eip3009Error.message, txHash ? `(txHash already broadcast: ${txHash})` : '(tx not yet broadcast)');
            
            // Check for insufficient balance error - return structured refuel response
            const errorMsg = eip3009Error.message?.toLowerCase() || '';
            if (errorMsg.includes('transfer amount exceeds balance') || 
                errorMsg.includes('insufficient balance') ||
                errorMsg.includes('erc20: transfer amount exceeds') ||
                errorMsg.includes('exceeds balance')) {
              
              const priceUsd = SERVICE_PRICING_USD[serviceName as keyof typeof SERVICE_PRICING_USD] || 1.00;
              const priceStr = priceUsd.toFixed(6);
              // Capture payer wallet from EIP-3009 auth object (in scope here)
              const payerWallet: string | null = (auth?.from as string) || null;
              console.log(`💰 Insufficient balance detected for ${serviceName} (payer: ${payerWallet ?? 'unknown'}) - returning refuel response`);

              // Attempt an authoritative balanceOf(payer) read on Base USDC.
              // Required vs available lets us compute an exact shortfall.
              // Wrap in try/catch with a 3-second timeout — a read failure must not delay the 402.
              let availableBalanceStr: string | null = null;
              let shortfallBalanceStr: string | null = null;
              if (payerWallet && platformPublicClient) {
                try {
                  const BALANCE_OF_ABI = parseAbi(['function balanceOf(address account) view returns (uint256)']);
                  const balanceRaw = await Promise.race([
                    platformPublicClient.readContract({
                      address: USDC_BASE as `0x${string}`,
                      abi: BALANCE_OF_ABI,
                      functionName: 'balanceOf',
                      args: [payerWallet as `0x${string}`],
                    }),
                    new Promise<never>((_, reject) =>
                      setTimeout(() => reject(new Error('balanceOf timeout')), 3000)
                    ),
                  ]) as bigint;
                  // USDC has 6 decimals.
                  // Convert required price to base units via string to avoid binary-float drift.
                  // SERVICE_PRICING_USD values are constrained to ≤6 decimal places; multiply as
                  // integer math: e.g. 0.10 USD → "100000" base units.
                  const requiredBaseUnits = BigInt(Math.round(priceUsd * 1_000_000));
                  const shortfallBaseUnits = requiredBaseUnits > balanceRaw
                    ? requiredBaseUnits - balanceRaw
                    : 0n;
                  // Use viem formatUnits for bigint-safe decimal formatting (no Number() precision loss)
                  availableBalanceStr = formatUnits(balanceRaw, 6);
                  shortfallBalanceStr = formatUnits(shortfallBaseUnits, 6);
                  console.log(`💰 balanceOf(${payerWallet.slice(0, 10)}…) = ${availableBalanceStr} USDC, shortfall = ${shortfallBalanceStr}`);
                } catch (balErr: any) {
                  console.warn(`⚠️ balanceOf read skipped (${balErr.message}) — omitting available_balance_usdc from response`);
                }
              }

              // FUNNEL TRACKING: Insufficient balance error
              await x402InteractionTracker.trackInteraction({
                serviceId: serviceName,
                ipAddress,
                userAgent,
                requestPath: req.originalUrl,
                requestMethod: req.method,
                responseStatus: 402,
                paid: false,
                interactionType: 'error',
                requestId,
                eventType: 'insufficient-balance',
                serviceName,
                latencyMs: Date.now() - startTime,
                paymentReceived: false,
                errorMessage: 'Agent wallet has insufficient USDC balance',
                walletAddress: payerWallet || undefined,
                offerTrackingId,
                metadata: { 
                  reason: 'insufficient-balance',
                  network: 'base-mainnet',
                  knownAgent: knownAgent.name,
                  requiredAmount: priceUsd,
                  availableBalance: availableBalanceStr,
                  shortfall: shortfallBalanceStr,
                  payerWallet
                }
              });

              const _baseUrl = getPublicBaseUrl(req);
              const retryEndpoint = `${_baseUrl}/x402/${serviceName}`;
              
              res.setHeader('X-Agent-Instructions', 'https://coinrailz.com/.well-known/agent-instructions.json');
              res.setHeader('Link', '<https://coinrailz.com/.well-known/agent-instructions.json>; rel="agent-instructions"');
              return res.status(402).json({
                error: {
                  code: "insufficient_balance",
                  message: `Insufficient USDC balance for ${serviceName}.`,
                  retryable: true
                },
                funding_required: {
                  service: serviceName,
                  network: "base-mainnet",
                  token: "USDC",
                  token_contract: USDC_BASE,
                  payment_recipient: PLATFORM_WALLET,
                  minimum_required_usdc: priceStr,
                  ...(payerWallet ? { payer_wallet: payerWallet } : {}),
                  ...(availableBalanceStr !== null ? { available_balance_usdc: availableBalanceStr } : {}),
                  ...(shortfallBalanceStr !== null ? { shortfall_usdc: shortfallBalanceStr } : {}),
                  retry: {
                    method: "POST",
                    endpoint: retryEndpoint,
                    instruction: payerWallet
                      ? `Fund payer wallet ${payerWallet} with at least ${shortfallBalanceStr ?? priceStr} USDC on Base mainnet (eip155:8453), then generate a new signed X-PAYMENT header and submit it to this endpoint.`
                      : `Fund your agent wallet with at least ${priceStr} USDC on Base mainnet (eip155:8453), then generate a new signed X-PAYMENT header and submit it to this endpoint.`
                  }
                },
                alternative_payment_methods: {
                  api_key: {
                    recommended: true,
                    description: "Card-based M2M API key — no blockchain or crypto wallet required. Get a cr_live_ key in ~60 seconds.",
                    purchase_endpoint: `${_baseUrl}/api/m2m/credits/purchase`,
                    purchase_method: "POST",
                    purchase_body: { paymentMethodId: "pm_...", amountUsd: 10, idempotencyKey: "<uuid-v4>" },
                    idempotency_key_format: "Any unique string, min 8 chars. UUID v4 recommended. Reuse on retry — safe for duplicate prevention.",
                    success_response: { apiKey: "cr_live_...", creditsAdded: 200, note: "SAVE apiKey — returned once only" },
                    usage: "X-API-KEY: cr_live_... header or Authorization: Bearer cr_live_... on any /x402/* request instead of X-PAYMENT",
                    tiers: [
                      { amountUsd: 5,   label: "Intro",   calls: "~80-100 service calls", note: "Try it — no commitment" },
                      { amountUsd: 10,  label: "Starter", calls: "~200 service calls" },
                      { amountUsd: 25,  label: "Growth",  calls: "~500 service calls", recommended: true },
                      { amountUsd: 100, label: "Pro",     calls: "~2,000 service calls" }
                    ],
                    rate_limit: "5 purchases per IP per hour",
                    error_codes: { "400": "Invalid paymentMethodId or idempotencyKey too short", "409": "Already processed — use new idempotencyKey", "429": "Rate limit exceeded" }
                  }
                },
                requestId
              });
            }
            
            // Other EIP-3009 errors (expired, already used, invalid signature)
            res.setHeader('X-Agent-Instructions', 'https://coinrailz.com/.well-known/agent-instructions.json');
            res.setHeader('Link', '<https://coinrailz.com/.well-known/agent-instructions.json>; rel="agent-instructions"');
            return res.status(402).json({
              x402Version: 2,
              error: `Payment authorization failed: ${eip3009Error.message}`,
              hint: "The authorization may have expired or already been used. Please retry the request."
            });
          }
        }
        
        // Solana ExactSvmScheme: client sends a signed-but-unsubmitted wire transaction.
        // Submit it to Solana, then run standard verifySolanaPayment on the resulting signature.
        const solanaTxBase64 = payloadObj.transaction || decoded.transaction;
        if (!txHash && solanaTxBase64) {
          console.log(`🔐 Orchestrator: Solana ExactSvmScheme transaction detected for ${serviceName}, submitting to chain...`);
          try {
            const connection = getSolanaConnection();
            const txBytes = Buffer.from(solanaTxBase64, 'base64');
            const solanaSig = await connection.sendRawTransaction(txBytes, {
              skipPreflight: false,
              preflightCommitment: 'confirmed',
            });
            console.log(`🔐 Orchestrator: Solana tx submitted: ${solanaSig.substring(0, 16)}...`);

            // REPLAY PROTECTION: Check for existing intent on this signature before verifying
            const svmExisting = await db
              .select()
              .from(x402PaymentIntents)
              .where(and(eq(x402PaymentIntents.txHash, solanaSig), eq(x402PaymentIntents.serviceName, serviceName)))
              .limit(1);
            if (svmExisting.length > 0) {
              const svmStatus = svmExisting[0].status;
              if (svmStatus === 'SUCCEEDED') {
                console.warn(`⚠️ Orchestrator: ExactSvmScheme replay rejected for ${serviceName}: ${solanaSig.substring(0, 16)}...`);
                return generatePaymentErrorResponse(res, 'SOLANA_REPLAY_REJECTED', 'Payment signature already used for this service', 'Each Solana transaction signature can only be used once per service.', requestId, { recoverable: false, httpStatus: 402 });
              }
              if (svmStatus === 'PENDING') {
                console.warn(`⚠️ Orchestrator: Duplicate concurrent ExactSvmScheme request for ${serviceName}: ${solanaSig.substring(0, 16)}...`);
                return generatePaymentErrorResponse(res, 'SOLANA_DUPLICATE_REQUEST', 'Concurrent payment request in progress', 'A payment with this signature is already being processed.', requestId, { recoverable: false, httpStatus: 402 });
              }
            }

            const solanaResult = await verifySolanaPayment(solanaSig, requiredAmount);
            if (solanaResult.verified) {
              console.log(`✅ Orchestrator: Solana ExactSvmScheme payment verified! Amount: $${solanaResult.amount} ${solanaResult.token}`);
              res.locals.payment = {
                method: 'solana-transaction',
                chain: 'solana',
                network: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
                token: solanaResult.token,
                tokenMint: solanaResult.tokenMint,
                amount: solanaResult.amount,
                txHash: solanaSig,
                walletAddress: solanaResult.fromWallet,
                verified: true
              };

              // Write PENDING intent — unique constraint blocks any concurrent replay from here
              const svmIntentId = nanoid();
              const svmExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
              await db.insert(x402PaymentIntents).values({
                id: svmIntentId,
                txHash: solanaSig,
                network: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
                serviceName,
                payer: solanaResult.fromWallet || '',
                amount: solanaResult.amount.toString(),
                status: 'PENDING',
                retries: 0,
                expiresAt: svmExpiresAt,
                metadata: { chain: 'solana', token: solanaResult.token, paymentScheme: 'ExactSvmScheme' },
                isCanary: isCanaryPayer(solanaResult.fromWallet),
              }).onConflictDoNothing();
              console.log(`📝 ExactSvmScheme intent ${svmIntentId} created as PENDING`);

              await x402InteractionTracker.trackInteraction({
                serviceId: serviceName,
                ipAddress,
                userAgent,
                requestPath: req.originalUrl,
                requestMethod: req.method,
                responseStatus: 200,
                paid: true,
                amount: solanaResult.amount,
                interactionType: 'payment',
                requestId,
                eventType: 'solana-payment',
                serviceName,
                latencyMs: Date.now() - startTime,
                paymentReceived: true,
                paymentAmount: solanaResult.amount,
                offerTrackingId,
                metadata: {
                  chain: 'solana',
                  token: solanaResult.token,
                  txHash: solanaSig,
                  fromWallet: solanaResult.fromWallet,
                  knownAgent: knownAgent.name,
                  paymentScheme: 'ExactSvmScheme'
                }
              });

              // Execute handler — mark SUCCEEDED on completion, FAILED on error
              try {
                await handler(req, res);
                await db.update(x402PaymentIntents)
                  .set({ status: 'SUCCEEDED', succeededAt: new Date(), updatedAt: new Date() })
                  .where(and(eq(x402PaymentIntents.txHash, solanaSig), eq(x402PaymentIntents.serviceName, serviceName)));
                console.log(`✅ ExactSvmScheme intent marked SUCCEEDED for ${serviceName}`);
                emitFirstX402CallAsync({ ip: ipAddress, paymentRail: 'solana', serviceName, userAgent: userAgent as string | undefined, walletAddress: solanaResult.fromWallet || undefined, metadata: { scheme: 'ExactSvmScheme', token: solanaResult.token } });
              } catch (handlerErr: any) {
                await db.update(x402PaymentIntents)
                  .set({ status: 'FAILED', lastError: handlerErr.message, updatedAt: new Date() })
                  .where(and(eq(x402PaymentIntents.txHash, solanaSig), eq(x402PaymentIntents.serviceName, serviceName)));
                console.error(`❌ ExactSvmScheme intent marked FAILED for ${serviceName}: ${handlerErr.message}`);
                throw handlerErr;
              }
              return;
            } else {
              console.error(`❌ Orchestrator: Solana ExactSvmScheme verification failed: ${solanaResult.error}`);
              return generatePaymentErrorResponse(
                res,
                'SOLANA_VERIFICATION_FAILED',
                `Solana payment verification failed: ${solanaResult.error}`,
                `Ensure you sent USDC or USDT to wallet ${SOLANA_PLATFORM_WALLET}. Wait for confirmation before retrying.`,
                requestId,
                { recoverable: true, httpStatus: 402 }
              );
            }
          } catch (submitErr: any) {
            console.error(`❌ Orchestrator: Solana tx submission failed: ${submitErr.message}`);
            return generatePaymentErrorResponse(
              res,
              'SOLANA_VERIFICATION_FAILED',
              `Solana transaction submission failed: ${submitErr.message}`,
              'The signed Solana transaction could not be broadcast. Ensure the transaction is valid and the network is reachable.',
              requestId,
              { recoverable: true, httpStatus: 400 }
            );
          }
        }

        if (txHash) {
          console.log(`🔐 Orchestrator: Extracted/executed txHash for ${serviceName}: ${txHash.substring(0, 10)}...`);
        } else {
          const acceptedKeys = decoded.accepted ? Object.keys(decoded.accepted as any).join(', ') : 'none';
          console.log(`🔐 Orchestrator: No txHash found in payload for ${serviceName}. Top-level keys: ${Object.keys(decoded).join(', ')}; accepted keys: ${acceptedKeys}; payload keys: ${Object.keys(payloadObj).join(', ') || '(empty)'}`);
          
          // FUNNEL TRACKING: Payment header parse failure - no txHash found
          await x402InteractionTracker.trackInteraction({
            serviceId: serviceName,
            ipAddress,
            userAgent,
            requestPath: req.originalUrl,
            requestMethod: req.method,
            responseStatus: 400,
            paid: false,
            interactionType: 'error',
            requestId,
            eventType: 'payment-parse-failed',
            serviceName,
            latencyMs: Date.now() - startTime,
            paymentReceived: false,
            errorMessage: `No txHash found in payload. Keys: ${Object.keys(payloadObj).join(', ')}`,
            offerTrackingId,
            metadata: { 
              reason: 'no-txhash-in-payload',
              knownAgent: knownAgent.name,
              payloadKeys: Object.keys(payloadObj)
            }
          });
          
          // Return machine-readable error for missing txHash in payload
          return generatePaymentErrorResponse(
            res,
            'PAYMENT_DECODE_FAILED',
            `Decoded payload successfully but no transaction hash found. Payload keys: ${Object.keys(payloadObj).join(', ')}`,
            `Include 'txHash' field in your payment payload with a confirmed transaction hash`,
            requestId,
            {
              recoverable: true,
              httpStatus: 400,
              expectedFormat: {
                txHash: 'Include txHash field in JSON payload',
                facilitatorPayload: '{"txHash": "0x...", "payload": {...}}',
                examples: [
                  'Direct hash: Set X-PAYMENT to your raw 0x... transaction hash',
                  'JSON payload: {"txHash": "0x1234...", "network": "eip155:8453"}'
                ]
              }
            }
          );
        }
    }

    // Solana routing: if chain is solana or txHash looks like a Solana signature, use Solana verification.
    // This handles Dexter Solana payments where accepted.transaction is a base58 Solana signature.
    if (txHash && (paymentChain === 'solana' || isSolanaSignature(txHash))) {
      console.log(`🔐 Orchestrator: Routing to Solana verification for ${serviceName} (chain: ${paymentChain}, sig: ${txHash.substring(0, 10)}...)`);
      const solanaResult = await verifySolanaPayment(txHash, requiredAmount);

      if (solanaResult.verified) {
        console.log(`✅ Orchestrator: Solana payment (Dexter) verified! Amount: $${solanaResult.amount} ${solanaResult.token}`);
        res.locals.payment = {
          method: 'solana-transaction',
          chain: 'solana',
          network: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
          token: solanaResult.token,
          tokenMint: solanaResult.tokenMint,
          amount: solanaResult.amount,
          txHash,
          walletAddress: solanaResult.fromWallet,
          verified: true
        };
        const solanaIntentId = nanoid();
        await db.insert(x402PaymentIntents).values({
          id: solanaIntentId,
          txHash,
          network: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
          serviceName,
          payer: solanaResult.fromWallet || '',
          amount: solanaResult.amount.toString(),
          status: 'PENDING',
          retries: 0,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
          metadata: { chain: 'solana', token: solanaResult.token, paymentScheme: 'dexter-facilitator' },
          isCanary: isCanaryPayer(solanaResult.fromWallet),
        }).onConflictDoNothing();
        await x402InteractionTracker.trackInteraction({
          serviceId: serviceName,
          ipAddress,
          userAgent,
          requestPath: req.originalUrl,
          requestMethod: req.method,
          responseStatus: 200,
          paid: true,
          amount: solanaResult.amount,
          interactionType: 'payment',
          requestId,
          eventType: 'solana-payment',
          serviceName,
          latencyMs: Date.now() - startTime,
          paymentReceived: true,
          paymentAmount: solanaResult.amount,
          offerTrackingId,
          metadata: { chain: 'solana', token: solanaResult.token, txHash: txHash.substring(0, 20), fromWallet: solanaResult.fromWallet, knownAgent: knownAgent.name, facilitator: 'dexter' }
        });
        try {
          await handler(req, res);
          await db.update(x402PaymentIntents)
            .set({ status: 'SUCCEEDED', succeededAt: new Date(), updatedAt: new Date() })
            .where(and(eq(x402PaymentIntents.txHash, txHash), eq(x402PaymentIntents.serviceName, serviceName)));
          console.log(`✅ Solana (Dexter) intent marked SUCCEEDED for ${serviceName}`);
          emitFirstX402CallAsync({ ip: ipAddress, paymentRail: 'solana', serviceName, userAgent: userAgent as string | undefined, walletAddress: solanaResult.fromWallet || undefined, metadata: { facilitator: 'dexter', token: solanaResult.token } });
        } catch (handlerErr: any) {
          await db.update(x402PaymentIntents)
            .set({ status: 'FAILED', lastError: handlerErr.message, updatedAt: new Date() })
            .where(and(eq(x402PaymentIntents.txHash, txHash), eq(x402PaymentIntents.serviceName, serviceName)));
          console.error(`❌ Solana (Dexter) intent marked FAILED for ${serviceName}: ${handlerErr.message}`);
          throw handlerErr;
        }
        return;
      }

      // Solana (Dexter) verification failed — detect insufficient balance vs other errors
      console.warn(`❌ Orchestrator: Solana (Dexter) payment NOT verified for ${serviceName}: ${solanaResult.error}`);

      // Detect underpayment from the trusted verifySolanaPayment result ONLY.
      // Match "Insufficient amount: X < Y" — confirmed tx that paid too little.
      // This is NOT a wallet balance failure; do not assert top-up is required.
      const isDexterUnderpayment = (solanaResult.error || '').toLowerCase().includes('insufficient amount:');

      if (isDexterUnderpayment) {
        const priceUsd = SERVICE_PRICING_USD[serviceName as keyof typeof SERVICE_PRICING_USD] || 1.00;
        const priceStr = priceUsd.toFixed(6);
        const knownPayerWallet = solanaResult.fromWallet || null;
        // Derive active network from RPC URL — never hardcode
        const activeSolNetwork = SOLANA_RPC_URL.includes('devnet') ? 'solana-devnet' : 'solana-mainnet';
        const activeSolMint = SOLANA_RPC_URL.includes('devnet')
          ? 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr'  // Solana devnet USDC
          : USDC_SOLANA;
        // Parse received amount from "Insufficient amount: X < Y"
        const amtMatch = (solanaResult.error || '').match(/insufficient amount:\s*([\d.]+)\s*<\s*([\d.]+)/i);
        const receivedAmountStr = amtMatch ? parseFloat(amtMatch[1]).toFixed(6) : null;
        const shortfallStr = (amtMatch && receivedAmountStr !== null)
          ? Math.max(0, parseFloat(amtMatch[2]) - parseFloat(amtMatch[1])).toFixed(6)
          : null;
        console.log(`💳 Solana (Dexter) underpayment for ${serviceName} on ${activeSolNetwork}: received=${receivedAmountStr ?? '?'} required=${priceStr} (payer: ${knownPayerWallet ?? 'unknown'})`);

        await x402InteractionTracker.trackInteraction({
          serviceId: serviceName,
          ipAddress,
          userAgent,
          requestPath: req.originalUrl,
          requestMethod: req.method,
          responseStatus: 402,
          paid: false,
          interactionType: 'error',
          requestId,
          eventType: 'insufficient-balance',
          serviceName,
          latencyMs: Date.now() - startTime,
          paymentReceived: false,
          errorMessage: `Solana underpayment: received ${receivedAmountStr ?? '?'} USDC, required ${priceStr}`,
          walletAddress: knownPayerWallet || undefined,
          offerTrackingId,
          metadata: { reason: 'underpayment', network: activeSolNetwork, facilitator: 'dexter', received: receivedAmountStr, required: priceStr, payerWallet: knownPayerWallet }
        });

        const _baseUrl = getPublicBaseUrl(req);
        const retryEndpoint = `${_baseUrl}/x402/${serviceName}`;
        res.setHeader('X-Agent-Instructions', 'https://coinrailz.com/.well-known/agent-instructions.json');
        res.setHeader('Link', '<https://coinrailz.com/.well-known/agent-instructions.json>; rel="agent-instructions"');
        return res.status(402).json({
          error: {
            code: "insufficient_payment_amount",
            message: `Payment for ${serviceName} was below the required amount.`,
            retryable: true
          },
          payment_required: {
            service: serviceName,
            network: activeSolNetwork,
            token: "USDC",
            token_mint: activeSolMint,
            payment_recipient: SOLANA_PLATFORM_WALLET,
            minimum_required_usdc: priceStr,
            ...(receivedAmountStr !== null ? { received_amount_usdc: receivedAmountStr } : {}),
            ...(shortfallStr !== null ? { shortfall_usdc: shortfallStr } : {}),
            ...(knownPayerWallet ? { payer_wallet: knownPayerWallet } : {}),
            retry: {
              method: "POST",
              endpoint: retryEndpoint,
              instruction: `Create a new signed X-PAYMENT transaction for at least ${priceStr} USDC to ${SOLANA_PLATFORM_WALLET} on ${activeSolNetwork} (mint: ${activeSolMint}). Fund ${knownPayerWallet ?? 'your payer wallet'} first if its available USDC balance is below ${priceStr}.`
            }
          },
          requestId
        });
      }

      return generatePaymentErrorResponse(
        res,
        'SOLANA_VERIFICATION_FAILED',
        `Solana payment verification failed: ${solanaResult.error || 'Transaction not found or insufficient amount'}`,
        'Ensure the transaction is confirmed on Solana mainnet and paid the correct USDC amount.',
        requestId,
        { recoverable: true, httpStatus: 402 }
      );
    }

    // If we have a transaction hash, verify it on-chain (EVM)
    if (txHash) {
      try {
        // For raw 0x hashes with no explicit network: try Base first (most traffic),
        // then Ethereum, then Arbitrum. This prevents silent wrong-chain rejection
        // while preserving the common-case fast path.
        // Robinhood Chain (eip155:4663) is explicit-only — never used as a fallback.
        const explicitChain = (
          paymentChain === 'ethereum' ||
          paymentChain === 'base' ||
          paymentChain === 'arbitrum' ||
          (paymentChain === 'robinhood' && ROBINHOOD_CHAIN_CCTP_ENABLED)
        ) ? paymentChain : null;
        const evmChain = explicitChain || 'base';
        let verificationResult = await verifyTransactionPayment(
          txHash,
          serviceName,
          requiredAmount,
          evmChain
        );
        // If Base failed and no explicit chain was specified, try Ethereum then Arbitrum.
        // Do NOT fallback-probe Robinhood Chain — it must be explicit via network field.
        if (!verificationResult.verified && !explicitChain) {
          console.log(`🔄 Orchestrator: Base verification failed for raw hash, trying Ethereum...`);
          verificationResult = await verifyTransactionPayment(txHash, serviceName, requiredAmount, 'ethereum');
          if (!verificationResult.verified) {
            console.log(`🔄 Orchestrator: Ethereum verification failed for raw hash, trying Arbitrum...`);
            verificationResult = await verifyTransactionPayment(txHash, serviceName, requiredAmount, 'arbitrum');
          }
          if (verificationResult.verified) {
            console.log(`✅ Orchestrator: Raw hash verified on fallback chain for ${serviceName}`);
          }
        }

        if (verificationResult.verified) {
          const priceUsd = SERVICE_PRICING_USD[serviceName as keyof typeof SERVICE_PRICING_USD] || 1.00;
          const payerWallet = verificationResult.senderAddress || undefined;
          
          if (!payerWallet) {
            console.warn(`⚠️ Orchestrator: Payment verified but no payer wallet extracted for ${serviceName}`);
          } else {
            console.log(`✅ Orchestrator: Payment verified for ${serviceName} ($${priceUsd}), payer: ${payerWallet}, executing handler directly`);
          }
          
          res.locals.payment = { 
            method: "raw-hash", 
            txHash, 
            verified: true, 
            amount: priceUsd, 
            status: 'paid',
            payer: payerWallet,
            paymentToken: verificationResult.paymentToken
          };
          
          try {
            await handler(req, res);
            await markPaymentIntentSucceeded(txHash, serviceName, payerWallet);
            
            // FUNNEL TRACKING: Successful payment and service delivery
            await x402InteractionTracker.trackInteraction({
              serviceId: serviceName,
              ipAddress,
              userAgent,
              requestPath: req.originalUrl,
              requestMethod: req.method,
              responseStatus: 200,
              paid: true,
              amount: priceUsd,
              interactionType: 'payment',
              requestId,
              eventType: 'payment-verified',
              serviceName,
              latencyMs: Date.now() - startTime,
              paymentReceived: true,
              paymentAmount: priceUsd,
              offerTrackingId,
              walletAddress: payerWallet,
              metadata: { 
                txHash: txHash.substring(0, 20),
                knownAgent: knownAgent.name,
                verificationMethod: 'on-chain',
                payerWallet: payerWallet,
                paymentToken: verificationResult.paymentToken
              }
            });

            emitFirstX402CallAsync({ ip: ipAddress, paymentRail: 'evm', serviceName, userAgent: userAgent as string | undefined, walletAddress: payerWallet || undefined, metadata: { chain: evmChain, token: verificationResult.paymentToken } });
            
            if (offerTrackingId) {
              try {
                await offerLinkService.recordConversion(offerTrackingId, priceUsd);
              } catch (convErr: any) {
                console.error(`⚠️ Failed to record conversion: ${convErr.message}`);
              }
            }
          } catch (handlerError: any) {
            console.error(`❌ Handler error for ${serviceName}:`, handlerError.message);
            await markPaymentIntentFailed(txHash, serviceName, handlerError.message);
            throw handlerError;
          }
          return;
        } else {
          console.log(`❌ Orchestrator: Payment verification failed for ${serviceName}, returning 402`);
          
          // FUNNEL TRACKING: Payment verification failed
          await x402InteractionTracker.trackInteraction({
            serviceId: serviceName,
            ipAddress,
            userAgent,
            requestPath: req.originalUrl,
            requestMethod: req.method,
            responseStatus: 402,
            paid: false,
            interactionType: 'error',
            requestId,
            eventType: 'verification-failed',
            serviceName,
            latencyMs: Date.now() - startTime,
            paymentReceived: false,
            errorMessage: 'On-chain verification returned false',
            offerTrackingId,
            metadata: { 
              reason: 'verification-failed',
              knownAgent: knownAgent.name,
              txHash: txHash?.substring(0, 20)
            }
          });
          
          // Return machine-readable error for verification failure
          return generatePaymentErrorResponse(
            res,
            'PAYMENT_VERIFICATION_FAILED',
            `On-chain verification failed for transaction ${txHash?.substring(0, 20)}... - payment not confirmed on Ethereum, Base, or Arbitrum`,
            `Verify: (1) Transaction is confirmed on Ethereum, Base, or Arbitrum, (2) Payment sent to platform wallet 0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91, (3) Amount is at least $${microToUSD(requiredAmount)} USDC`,
            requestId,
            {
              recoverable: true,
              httpStatus: 402,
              expectedFormat: {
                txHash: 'Confirmed Ethereum, Base, or Arbitrum transaction hash (0x + 64 hex chars)',
                examples: [
                  `Send $${microToUSD(requiredAmount)}+ USDC to 0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91`,
                  'Wait for transaction confirmation',
                  'Submit confirmed tx hash in X-PAYMENT header'
                ]
              }
            }
          );
        }
      } catch (error: any) {
        console.error(`❌ Orchestrator: Payment verification error for ${serviceName}:`, error.message);
        
        // FUNNEL TRACKING: Verification threw error
        await x402InteractionTracker.trackInteraction({
          serviceId: serviceName,
          ipAddress,
          userAgent,
          requestPath: req.originalUrl,
          requestMethod: req.method,
          responseStatus: 400,
          paid: false,
          interactionType: 'error',
          requestId,
          eventType: 'verification-error',
          serviceName,
          latencyMs: Date.now() - startTime,
          paymentReceived: false,
          errorMessage: error.message,
          offerTrackingId,
          metadata: { 
            reason: 'verification-exception',
            knownAgent: knownAgent.name,
            txHash: txHash?.substring(0, 20)
          }
        });
        
        // Return machine-readable error for verification exception
        return generatePaymentErrorResponse(
          res,
          'PAYMENT_VERIFICATION_EXCEPTION',
          `Payment verification threw error: ${error.message}`,
          `Check that your transaction hash is valid and the transaction is confirmed. Error details have been logged for debugging.`,
          requestId,
          {
            recoverable: true,
            httpStatus: 400,
            expectedFormat: {
              txHash: 'Valid, confirmed transaction hash from Ethereum, Base, or Solana',
              examples: [
                'Ensure transaction is confirmed (not pending)',
                'Use complete 66-character hash for EVM',
                'For Solana, use base58 signature (87-88 chars)'
              ]
            }
          }
        );
      }
    }

    // No valid payment found - return 402
    console.log(`❌ Orchestrator: No valid payment found for ${serviceName}, returning 402`);
    return await generate402Response(req, res, serviceName, requiredAmount, knownAgent, requestId);
  };
}

/**
 * Build a service-specific execution_guide object for 402 response bodies.
 * All prices are derived from live requiredAmount / priceUsd — never hardcoded.
 * Prevents stale-price silent payment failures when service prices change (Task #55).
 */
export function buildExecutionGuide(params: {
  serviceName: string;
  requiredAmount: number;
  priceUsd: number | string;
  requestBody: Record<string, any>;
  paymentRecipeDescription: string;
  successDescription: string;
  baseUrl: string;
}) {
  const { serviceName, requiredAmount, priceUsd: priceUsdRaw, requestBody, paymentRecipeDescription, successDescription, baseUrl } = params;
  const priceUsd = typeof priceUsdRaw === 'string' ? parseFloat(priceUsdRaw) : priceUsdRaw;
  const endpoint = `/x402/${serviceName}`;
  const amountStr = `${requiredAmount} micro-USDC (${priceUsd.toFixed(2)} USDC, 6 decimals)`;
  const bodyJson = JSON.stringify(requestBody);

  const fullUrl = `${baseUrl}${endpoint}`;

  // Python signing example — primary path for autonomous agents (eth_account EIP-712)
  const pythonExample = [
    `# pip install requests eth-account`,
    `import requests, json, time, base64, secrets, os`,
    `from eth_account import Account`,
    ``,
    `wallet = Account.from_key(os.environ['PRIVATE_KEY'])`,
    `url = '${fullUrl}'`,
    `body = ${bodyJson}`,
    ``,
    `# 1. Get 402 challenge — read payTo and amount from response`,
    `r = requests.post(url, json=body)`,
    `assert r.status_code == 402`,
    `acc = r.json()['accepts'][0]  # has payTo, maxAmountRequired`,
    ``,
    `# 2. Build EIP-3009 authorization (no on-chain tx yet)`,
    `nonce = '0x' + secrets.token_hex(32)`,
    `auth = {'from': wallet.address, 'to': acc['payTo'], 'value': ${requiredAmount},`,
    `        'validAfter': 0, 'validBefore': int(time.time()) + 300, 'nonce': nonce}`,
    `domain = {'name': 'USD Coin', 'version': '2', 'chainId': 8453,`,
    `          'verifyingContract': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'}`,
    `types  = {'TransferWithAuthorization': [`,
    `    {'name': 'from', 'type': 'address'}, {'name': 'to', 'type': 'address'},`,
    `    {'name': 'value', 'type': 'uint256'}, {'name': 'validAfter', 'type': 'uint256'},`,
    `    {'name': 'validBefore', 'type': 'uint256'}, {'name': 'nonce', 'type': 'bytes32'}]}`,
    ``,
    `# 3. Sign off-chain — no gas required`,
    `sig = Account.sign_typed_data(wallet.key, domain, types, auth)`,
    ``,
    `# 4. Encode x402 v2 payment envelope`,
    `envelope = {'x402Version': 2, 'scheme': 'exact', 'network': 'eip155:8453',`,
    `            'payload': {'authorization': auth, 'signature': sig.signature.hex()}}`,
    `x_payment = base64.b64encode(json.dumps(envelope).encode()).decode()`,
    ``,
    `# 5. Retry with PAYMENT-SIGNATURE (x402 v2, preferred) or X-PAYMENT (x402 v1)`,
    `result = requests.post(url, json=body, headers={'PAYMENT-SIGNATURE': x_payment})`,
    `# Alternative (x402 v1 clients): headers={'X-PAYMENT': x_payment}`,
    `print(result.json())`,
  ].join('\n');

  // TypeScript SDK example — automatic signing via x402-fetch
  const typescriptExample = [
    `// npm install x402-fetch viem`,
    `import { wrapFetchWithPayment } from 'x402-fetch';`,
    `import { createWalletClient, http } from 'viem';`,
    `import { base } from 'viem/chains';`,
    `import { privateKeyToAccount } from 'viem/accounts';`,
    ``,
    `const account = privateKeyToAccount(process.env.PRIVATE_KEY as \`0x\${string}\`);`,
    `const walletClient = createWalletClient({ account, chain: base, transport: http() });`,
    `const paidFetch = wrapFetchWithPayment(fetch, walletClient);`,
    ``,
    `// SDK handles 402 → sign EIP-712 → encode envelope → X-PAYMENT → retry automatically`,
    `const res = await paidFetch('${fullUrl}', {`,
    `  method: 'POST',`,
    `  headers: { 'content-type': 'application/json' },`,
    `  body: JSON.stringify(${bodyJson})`,
    `});`,
    `console.log(await res.json());`,
  ].join('\n');

  return {
    priceUSD: priceUsd.toFixed(2),
    amountMicroUSDC: requiredAmount,
    endpoint,
    requestBody,
    paymentRecipe: {
      description: paymentRecipeDescription,
      evmPath: {
        chain: "Base mainnet",
        chainId: 8453,
        network: "eip155:8453",
        asset: "USDC (0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)",
        amount: amountStr,
        payTo: PLATFORM_WALLET,
        facilitator: "https://api.cdp.coinbase.com/platform/v2/x402",
        signingNote: `X-PAYMENT is base64(JSON.stringify({x402Version:2,scheme:'exact',network:'eip155:8453',payload:{authorization:{from,to,value,validAfter,validBefore,nonce},signature}})) — NOT a raw tx hash. Sign off-chain via EIP-712 (no gas). Use x402-fetch wrapFetchWithPayment for automatic handling, or follow the pythonExample for manual signing with eth_account.`,
        steps: [
          `1. POST ${endpoint} without payment header to receive 402 challenge — read accepts[0].payTo and maxAmountRequired`,
          `2. Build EIP-3009 authorization: {from:<your_wallet>, to:accepts[0].payTo, value:${requiredAmount}, validAfter:0, validBefore:<unix+300s>, nonce:<random_32_bytes>}`,
          `3. Sign with EIP-712: domain={name:'USD Coin',version:'2',chainId:8453,verifyingContract:'0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'} — no gas required`,
          `4. Encode payment envelope: base64(JSON.stringify({x402Version:2,scheme:'exact',network:'eip155:8453',payload:{authorization:<step2_object>,signature:<step3_sig>}}))`,
          `5. Retry POST ${endpoint} with PAYMENT-SIGNATURE (x402 v2, preferred) or X-PAYMENT (x402 v1) header set to the encoded envelope — receive 200 OK with ${successDescription}`
        ],
        pythonExample,
        typescriptExample,
        curlNote: `curl cannot sign EIP-712 inline. Compute x_payment with the Python example above, then: curl -X POST ${fullUrl} -H 'Content-Type: application/json' -H 'X-PAYMENT: <computed_x_payment>' -d '${bodyJson}'`
      },
      solanaPath: {
        network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
        asset: "USDC (EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v)",
        amount: amountStr,
        payTo: SOLANA_PLATFORM_WALLET,
        facilitator: "https://x402.dexter.cash",
        scheme: "ExactSvmScheme",
        steps: [
          `1. Include X-Solana-Wallet: <your_pubkey> header with initial POST ${endpoint}`,
          `2. Receive 402 — Dexter facilitator (x402.dexter.cash) will handle ExactSvmScheme signing for ${requiredAmount} micro-USDC`,
          `3. Retry POST ${endpoint} with X-PAYMENT: <solana_payload> returned by facilitator`,
          `4. Receive 200 OK with ${successDescription}`
        ],
        pythonExample: `# pip install requests\nimport requests\n\nurl = '${fullUrl}'\nbody = ${bodyJson}\npubkey = '<your_solana_pubkey>'\n\n# 1. Get challenge\nr = requests.post(url, json=body, headers={'X-Solana-Wallet': pubkey})\nassert r.status_code == 402\n\n# 2. Sign via Dexter facilitator\nfac = requests.post('https://x402.dexter.cash/sign', json={'challenge': r.json(), 'pubkey': pubkey})\nsolana_payload = fac.json()['payload']\n\n# 3. Retry with X-PAYMENT\nresult = requests.post(url, json=body, headers={'X-Solana-Wallet': pubkey, 'X-PAYMENT': solana_payload})\nprint(result.json())`
      },
      cloudflarePath: {
        description: "Cloudflare Wallet — zero setup if you already have one. Your wallet uses the same Coinbase CDP facilitator we accept (api.cdp.coinbase.com/platform/v2/x402).",
        compatible: true,
        facilitator: "https://api.cdp.coinbase.com/platform/v2/x402",
        steps: [
          `1. Your Cloudflare Wallet handles EIP-712 signing and X-PAYMENT construction automatically`,
          `2. Use the Cloudflare Agents SDK or wrapFetchWithPayment — no manual signing required`,
          `3. Send cloudflare-agent-id header to receive first-call-free grant on eligible services`,
          `4. Retry POST ${endpoint} with your wallet active — receive 200 OK with ${successDescription}`
        ],
        sdkExample: `// Cloudflare Agents SDK (automatic x402 payment)\nimport { Agent } from '@cloudflare/agents';\n\n// Your Cloudflare Wallet signs and pays automatically on 402 responses\nconst response = await agent.fetch('${fullUrl}', {\n  method: 'POST',\n  body: JSON.stringify(${bodyJson})\n});\nconsole.log(await response.json());`,
        note: "Cloudflare Wallets launched August 2026. Compatible because CF Wallets use the Coinbase CDP facilitator (api.cdp.coinbase.com/platform/v2/x402) that we already list in our accepts[] array. No configuration change needed. First-call-free is available on gas-price-oracle and token-metadata for first-time callers from any agent type."
      }
    }
  };
}

/**
 * Generate a proper x402 402 response with payment requirements
 * Enhanced with partner CTA for known agents and first-call-free info
 */
async function generate402Response(
  req: Request, 
  res: Response, 
  serviceName: string, 
  requiredAmount: number,
  knownAgent: { isKnown: boolean; name: string; partnerOffer: boolean } = { isKnown: false, name: 'unknown', partnerOffer: false },
  requestId?: string,
  lastErrorReason?: { code: string; message: string; hint: string; recoverable: boolean }
) {
  const priceUsd = requiredAmount / 1_000_000;
  const endpoint = req.originalUrl || `/x402/${serviceName}`;
  const baseUrl = getPublicBaseUrl(req);
  // When the internal MCP proxy forwards the original client-facing resource URL via
  // X-Forwarded-Resource, use it so the 402 challenge advertises /mcp or /mcp/tools/call
  // instead of the internal /x402/... path. Trust only requests from localhost (127.0.0.1
  // / ::1) and only exact canonical MCP paths — external callers cannot inject this header.
  const socketAddr  = (req.socket as any)?.remoteAddress ?? '';
  const isInternal  = socketAddr === '127.0.0.1' || socketAddr === '::1' || socketAddr === '::ffff:127.0.0.1';
  const fwdRaw      = req.headers['x-forwarded-resource'] as string | undefined;
  const MCP_PATHS   = ['/mcp', '/mcp/tools/call'];
  const isValidMcpResource = (u: string) => {
    try { const p = new URL(u).pathname; return MCP_PATHS.some(mp => p === mp); } catch { return false; }
  };
  const forwardedResource = isInternal && fwdRaw && isValidMcpResource(fwdRaw) ? fwdRaw : undefined;
  const resource = forwardedResource ?? `${baseUrl}${endpoint}`;
  
  // Service descriptions
  const descriptions: Record<string, string> = {
    "first-call": "Golden Path — canonical first payment endpoint. $0.05 USDC on Base or Solana. Start here for x402 integration. Receive onboarding receipt + next-service templates.",
    "ping": "x402 infrastructure health check. Returns 402 challenge with valid EIP-712 payment requirements — use to verify your x402 client can parse and sign challenges.",
    "gas-price-oracle": "Real-time gas prices for multiple chains with USD cost estimates",
    "token-metadata": "Token contract metadata including name, symbol, decimals",
    "dex-liquidity": "Liquidity depth at ±2%/±5% slippage from Uniswap v3, Curve, Balancer, Aerodrome. Best execution venue + price impact. Pass { tokenA, tokenB, chain? }.",
    "token-price": "Price aggregated from Uniswap v3, CoinGecko, and direct DEX pools. Returns USD price, 24h change %, volume, market cap. Pass { symbol } or { address, chain? }.",
    "token-sentiment": "Token dossier: contract audit findings, top-10 holder distribution, DEX liquidity depth, and 7-day social sentiment score. Pass any EVM token address or symbol.",
    "whale-alerts": "Wallets moving >$100K on Base, Ethereum, Arbitrum, Polygon. Returns recent large txns with counterparties, USD value, and accumulation/distribution direction.",
    "multi-chain-balance": "USDC/ETH/top-token balances across 8 EVM chains + Solana in one call (incl. Robinhood Chain). USD-denominated totals. Pass { address } — no chain parameter needed.",
    "trending-tokens": "Top trending tokens by volume momentum across Base, Ethereum, Arbitrum, Polygon. Price change %, volume spike ratio, social velocity, DEX trade count (1h/24h).",
    "portfolio-tracker": "Holdings and P&L for any EVM wallet across Base, Ethereum, Arbitrum, Polygon. Current USD value, cost basis, unrealized gains, 30-day performance. Pass { address }.",
    "wallet-risk": "On-chain risk score (0–100) for any EVM wallet. Flags mixers, blacklisted counterparties, rug-pull history, concentration risk, anomalous patterns. Pass { address, chain? }.",
    "trade-signals": "AI BUY/SELL/HOLD signal with confidence score (0–100), price targets, stop-loss, and multi-timeframe technical summary. GPT-4o. Pass { symbol } or { address }.",
    "transaction-builder": "Build and simulate transactions before execution",
    "batch-quote": "Batch token price quotes in single request",
    "approval-manager": "Token approval management and security",
    "payment-processing": "Route USDC/stablecoin payments across 8 EVM chains + Solana (incl. Robinhood Chain). Returns optimal network for lowest fees, estimated confirmation time, and payment receipt with txHash.",
    "contract-scan": "AI Solidity audit: reentrancy, integer overflow, access control gaps, known CVEs. Returns risk rating (Critical/High/Medium/Low) with line-level code findings.",
    "instant-agent-wallet": "Provision CDP-managed EVM wallet for any AI agent in one call. Returns address, private-key shard (non-custodial), USDC-ready on Base. Idempotent.",
    "agent-create-wallet": "Provision persistent CDP-managed wallet for AI agents ($2.00 USDC)",
    "seamless-chain-bridge": "Bridge quotes from Across, Stargate, Hop for any EVM-to-EVM transfer. Best route by cost+speed, estimated output, bridge fee, confirmation time.",
    "property-valuation": "AI-powered real estate property valuation",
    "lease-analysis": "Commercial lease analysis and recommendations",
    "construction-progress": "Construction project progress tracking",
    "fraud-detection": "Real-time transaction fraud detection",
    "credit-risk-score": "Credit risk scoring for DeFi positions",
    "compliance-check": "AML/KYC compliance verification",
    "sentiment-analysis": "Aggregate bullish score (0–100) for any token or topic. Sourced from Twitter/X, Reddit, and on-chain signals. Score breakdown by channel + trend direction.",
    "trading-signal": "Token trend direction, RSI/MACD summary, support/resistance levels, risk/reward ratio. $0.10 USDC. Pass { symbol } or { address }.",
    "portfolio-optimization": "MPT rebalancing for any EVM wallet. Optimal target weights, projected Sharpe ratio improvement, estimated rebalance cost. Pass { address } or { holdings }.",
    "correlation-matrix": "Asset correlation matrix analysis",
    "risk-metrics": "VaR, Sharpe ratio, and risk metrics",
    "arbitrage-scanner": "Cross-chain arbitrage opportunity scanner including Robinhood Chain (eip155:4663). Fetches real prices from DexScreener across Ethereum, Base, Polygon, Arbitrum, and Robinhood Chain's Uniswap V3. Returns opportunities with estimated profit, required capital, and step-by-step execution path. Pass { assets, chains, minProfitPercent, capitalUSD }.",
    "polymarket-events": "Trending prediction market events",
    "polymarket-odds": "Live probability-weighted odds for any Polymarket prediction market event. Returns Yes/No prices, total liquidity, 24h volume, and closing date. Pass { slug } (URL slug) or { eventId }. $0.10/call.",
    "stock-sentiment": "Aggregate social and news sentiment score (0–100) for any US equity ticker. Sources: Twitter/X, Reddit (r/stocks, r/investing), financial news NLP. Returns overall score, per-source breakdown, key bullish/bearish themes, and a momentum recommendation. Pass { symbol }.",
    "fleet-telematics": "Real-time telematics for any connected vehicle fleet. Returns per-vehicle GPS location, speed, heading, fuel level, engine status, odometer, and driver-behavior events (hard brakes, rapid acceleration). Aggregates fleet-level KPIs: total distance, idle time, avg speed, fuel efficiency. Pass { fleetId } and optional { vehicleIds[], timeRangeHours }. $0.10/call.",
    "polymarket-search": "Search prediction markets by keyword",
    "prediction-market-odds": "Current odds for any prediction market event",
    "satellite-earthdata": "NASA Earthdata Intelligence gateway — 5 real-time Earth observation products in one endpoint: precipitation (GPM IMERG), granule search (CMR/1B+ scenes), sea surface temperature (MUR-SST 1km), soil moisture (SMAP 36km), and ocean chlorophyll (MODIS-Aqua 4km). Use cases: climate risk underwriting, crop stress modeling, maritime route optimization, insurance event detection. Pass { product: 'precipitation'|'granules'|'sst'|'soil-moisture'|'ocean-color', lat?, lon? }. $0.25/call.",
    "earthdata-granules": "NASA CMR granule search — query 1B+ satellite imagery scenes (Landsat-8/9, Sentinel-2, MODIS, VIIRS, ASTER) by bounding box, date range, platform, and max cloud cover %. Returns granule IDs, acquisition times, and direct GeoTIFF/NetCDF download URLs. Ideal for AI agents building satellite analysis pipelines, change-detection workflows, or on-demand imagery retrieval. $0.25/call.",
    "earthdata-precipitation": "Actual satellite-observed rain rate at any global coordinate — not a weather model, not a forecast. NASA GPM IMERG half-hourly composites via GES DISC OPeNDAP point query. Returns mm/hr precipitation rate + 24h accumulation. Use cases: insurance loss estimation, flood trigger assessment, agricultural event detection, parametric weather derivatives. Pass { lat, lon, hours_back }. $0.25/call.",
    "earthdata-sst": "Sea surface temperature at any ocean coordinate. NASA MUR-JPL-L4 blended analysis (MODIS + AMSR-E + AVHRR), 1km resolution, daily composites. Returns °C + anomaly relative to climatological baseline. Use cases: maritime route optimization, fishery yield and migration modeling, coral bleaching risk assessment, climate pattern analysis. Pass { lat, lon, date? }. $0.25/call.",
    "earthdata-soil-moisture": "Volumetric soil water content at any land coordinate. NASA SMAP SPL3SMP Level-3 radiometric retrievals, 36km EASE-Grid, daily repeat cycle. Returns m³/m³ water fraction + retrieval quality flag. Use cases: drought early warning, crop stress and yield forecasting, wildfire fuel moisture, hydrological runoff prediction, agricultural risk modeling. Pass { lat, lon, date? }. $0.25/call.",
    "earthdata-ocean-color": "Chlorophyll-a concentration and ocean color at any coastal or open-ocean coordinate. MODIS-Aqua Level-3 daily 4km composites via NASA OB.DAAC. Returns mg/m³ chlorophyll + quality flag. Use cases: harmful algal bloom (HAB) early warning, fishery productivity, coastal water quality, ocean carbon flux modeling, aquaculture site scoring. Pass { lat, lon, date? }. $0.25/call.",
  };

  // Build base response - x402 V2 compliant with MULTI-CHAIN support
  // Per official Coinbase spec: x402Version is NUMBER (2), not string - matches Bazaar/facilitator/SDKs
  const baseDescription = descriptions[serviceName] || `${serviceName} micropayment service`;

  // Sample outputs per service — lets agents compute Cost vs. Utility before paying
  const sampleOutputs: Record<string, any> = {
    "first-call": {
      service: "x402 Golden Path — First Paid Call", sessionId: "gp-abc123def",
      payment: { verified: true, amount: "0.05 USDC", chain: "base" },
      nextServices: [
        { endpoint: "/x402/gas-price-oracle", price: "$0.01", description: "Real-time gas prices across 7 chains" },
        { endpoint: "/x402/token-price", price: "$0.01", description: "Token price from 3 aggregated sources" },
        { endpoint: "/x402/dex-liquidity", price: "$0.02", description: "Uniswap/Curve liquidity depth + APY" }
      ]
    },
    "ping": { status: "ok", x402Version: 2, services: 60, uptime: "99.9%", latencyMs: 12, timestamp: "2026-03-17T12:00:00Z" },
    "gas-price-oracle": {
      base: { fast: 0.0021, standard: 0.0012, slow: 0.0009, unit: "gwei", usdFast: "$0.004" },
      ethereum: { fast: 14.2, standard: 11.8, slow: 9.5, unit: "gwei", usdFast: "$0.42" },
      solana: { priorityFee: 25000, baseFee: 5000, unit: "lamports", usdTotal: "$0.0003" },
      timestamp: "2026-03-17T12:00:00Z"
    },
    "dex-liquidity": {
      protocol: "Uniswap V3", pair: "USDC/ETH", chain: "base",
      tvl: 4200000, volume24h: 890000, fee: 0.3, apy: 4.2,
      priceImpact1k: 0.02, priceImpact10k: 0.18
    },
    "token-price": {
      symbol: "ETH", price: 3421.50, change24h: 2.3, volume24h: 18200000000,
      sources: ["coingecko", "coinbase", "binance"], confidence: 0.99, timestamp: "2026-03-17T12:00:00Z"
    },
    "token-metadata": {
      address: "0x6b785a0322126826d8226d77e173d75DAfb84d11",
      chain: "ethereum", name: "Bankroll Vault", symbol: "VLT",
      decimals: 18, totalSupply: "1800000", verified: true,
      _note: "Required fields: tokenAddress (contract address) + chain (ethereum|base|polygon|arbitrum)"
    },
    "transaction-builder": {
      tx: { to: "0x...", value: "0", data: "0x...", gasLimit: 65000 },
      gasEstimate: "0.002 ETH ($6.84)", simulation: "success", warnings: []
    },
    "wallet-risk": {
      address: "0x...", riskScore: 12, riskLevel: "low",
      flags: [], sanctioned: false, protocols: ["uniswap", "aave"], lastActivity: "2026-03-17"
    },
    "token-sentiment": {
      symbol: "ETH", sentiment: "bullish", score: 72,
      signals: ["volume_spike", "social_momentum"], recommendation: "hold", confidence: 0.78
    },
    "whale-alerts": {
      alerts: [{ type: "large_transfer", amount: 1200000, token: "USDC", from: "0x...", to: "binance", timestamp: "2026-03-17T11:58:00Z" }],
      count: 3, chain: "ethereum"
    },
    "construction-progress": {
      projectId: "proj_001", progress: 67, status: "on_track",
      milestones: [{ name: "foundation", complete: true }, { name: "framing", complete: true }, { name: "roofing", complete: false }]
    },
    "arbitrage-scanner": {
      opportunities: [
        { asset: "WETH", buyChain: "Robinhood Chain", sellChain: "Base", buyPriceUSD: 3481.22, sellPriceUSD: 3498.67, profitPercentage: 0.50, estimatedProfit: 38.20, requiredCapital: 10000, executionPath: ["Buy WETH on Uniswap V3 (Robinhood Chain) at $3481.22", "Bridge via Robinhood Chain Bridge (Arbitrum Orbit)", "Sell WETH on Uniswap V3 (Base) at $3498.67"] }
      ],
      totalOpportunities: 1, robinhoodChainIncluded: true, robinhoodChainId: "eip155:4663",
      timestamp: "2026-07-08T12:00:00Z"
    },
    "contract-scan": {
      address: "0x...", risk: "low", issues: [], verified: true, auditScore: 94,
      checks: ["reentrancy", "overflow", "access-control", "flash-loan"]
    },
    "portfolio-tracker": {
      totalValue: 42180.50, change24h: 3.2, topHoldings: ["ETH", "USDC", "cbBTC"],
      chains: ["base", "ethereum", "arbitrum"], timestamp: "2026-03-17T12:00:00Z"
    },
    "trade-signals": {
      symbol: "ETH", signal: "buy", strength: "moderate", entry: 3380, target: 3650, stopLoss: 3200,
      confidence: 0.74, timeframe: "4h", reasoning: "RSI oversold + EMA crossover"
    },
    "sentiment-analysis": {
      asset: "BTC", overall: "bullish", score: 68, sources: { twitter: 71, reddit: 65, news: 68 },
      keyThemes: ["ETF_inflows", "halving_narrative"], timestamp: "2026-03-17T12:00:00Z"
    },
    "satellite-earthdata": {
      success: true, product: "precipitation",
      data: { lat: 40.71, lon: -74.01, precipRate_mm_hr: 2.4, qualityFlag: "good", granule: "3B-HHR.MS.MRG.3IMERG", hoursBack: 24 },
      availableProducts: ["precipitation","granules","ocean-temp","soil-moisture","ocean-color"],
      poweredBy: "NASA GPM IMERG via GES DISC", timestamp: "2026-04-16T00:00:00Z"
    },
    "earthdata-granules": {
      success: true,
      data: { count: 3, granules: [
        { id: "G2890123456-LPCLOUD", shortName: "HLSL30", version: "2.0", timeStart: "2026-04-15T10:22:00Z", cloudCover: 5, downloadUrl: "https://data.lpdaac.earthdatacloud.nasa.gov/..." },
        { id: "G2890123457-LPCLOUD", shortName: "HLSS30", version: "2.0", timeStart: "2026-04-15T10:44:00Z", cloudCover: 12, downloadUrl: "https://data.lpdaac.earthdatacloud.nasa.gov/..." }
      ]},
      poweredBy: "NASA CMR", timestamp: "2026-04-16T00:00:00Z"
    },
    "earthdata-precipitation": {
      success: true,
      data: { lat: 34.05, lon: -118.25, precipRate_mm_hr: 0.8, precipAccum_mm: 4.2, qualityFlag: "good", source: "GPM IMERG Final Run", hoursBack: 24 },
      poweredBy: "NASA GPM IMERG via GES DISC", timestamp: "2026-04-16T00:00:00Z"
    },
    "earthdata-sst": {
      success: true,
      data: { lat: 35.5, lon: -140.0, sst_celsius: 18.3, sst_fahrenheit: 64.9, anomaly_celsius: 1.2, resolution_km: 1, product: "MUR-SST L4", date: "2026-04-15" },
      poweredBy: "NASA MUR-SST via PODAAC", timestamp: "2026-04-16T00:00:00Z"
    },
    "earthdata-soil-moisture": {
      success: true,
      data: { lat: 40.0, lon: -95.0, soilMoisture_m3m3: 0.312, uncertainity: 0.04, retrievalQual: "good", product: "SMAP L3 SPL3SMP", date: "2026-04-15", resolution_km: 36 },
      poweredBy: "NASA SMAP via NSIDC", timestamp: "2026-04-16T00:00:00Z"
    },
    "earthdata-ocean-color": {
      success: true,
      data: { lat: 36.0, lon: -122.0, chlorophyll_mg_m3: 2.14, qualityFlag: "good", product: "MODISA_L3m_CHL", resolution_km: 4, date: "2026-04-15" },
      poweredBy: "NASA MODIS-Aqua via OB.DAAC", timestamp: "2026-04-16T00:00:00Z"
    },
  };
  const _extraSamples: Record<string, any> = {
    "multi-chain-balance": {
      wallet: "0xAbC123...", totalUSD: 18420.50,
      balances: [
        { chain: "base", token: "USDC", amount: 4200.00 },
        { chain: "ethereum", token: "ETH", amount: 2.84, usd: 9712.60 },
        { chain: "solana", token: "USDC", amount: 4507.90 }
      ],
      chainsQueried: 7, timestamp: "2026-04-16T12:00:00Z"
    },
    "trending-tokens": {
      tokens: [
        { symbol: "cbBTC", rank: 1, change24h: 4.8, volume24h: 920000000, chain: "base" },
        { symbol: "AERO", rank: 2, change24h: 12.3, volume24h: 180000000, chain: "base" },
        { symbol: "SOL", rank: 3, change24h: 3.1, volume24h: 2400000000, chain: "solana" }
      ],
      window: "24h", timestamp: "2026-04-16T12:00:00Z"
    },
    "batch-quote": {
      quotes: [
        { symbol: "ETH", price: 3421.50, source: "coingecko", confidence: 0.99 },
        { symbol: "SOL", price: 148.20, source: "coingecko", confidence: 0.99 },
        { symbol: "USDC", price: 1.0001, source: "coinbase", confidence: 1.0 }
      ],
      count: 3, latencyMs: 88, timestamp: "2026-04-16T12:00:00Z"
    },
    "approval-manager": {
      wallet: "0xAbC123...", approvals: [
        { token: "USDC", spender: "Uniswap V3", allowance: "unlimited", riskLevel: "medium", recommendation: "revoke" },
        { token: "WETH", spender: "Aave V3", allowance: "1.5", riskLevel: "low", recommendation: "keep" }
      ],
      totalApprovals: 2, riskySpendings: 1, timestamp: "2026-04-16T12:00:00Z"
    },
    "payment-processing": {
      success: true, txHash: "0x8f3c...", amount: "5.00 USDC", chain: "base",
      to: "0xa4bbe37...", confirmations: 1, settlementMs: 1200, timestamp: "2026-04-16T12:00:00Z"
    },
    "instant-agent-wallet": {
      success: true, walletAddress: "0xNewAgent...", chain: "base",
      initialBalance: "0 USDC", managed: true, provider: "Coinbase CDP", timestamp: "2026-04-16T12:00:00Z"
    },
    "agent-create-wallet": {
      success: true, walletId: "cdp_wallet_abc123", walletAddress: "0xAgent...",
      chain: "base", type: "evm", ready: true, provider: "Coinbase CDP", timestamp: "2026-04-16T12:00:00Z"
    },
    "seamless-chain-bridge": {
      from: { chain: "ethereum", token: "USDC", amount: 100 },
      to: { chain: "base", token: "USDC", estimatedAmount: 99.85 },
      bridgeFee: 0.15, estimatedTimeSeconds: 180, provider: "Across Protocol",
      quoteId: "bridge_xyz789", timestamp: "2026-04-16T12:00:00Z"
    },
    "property-valuation": {
      address: "123 Main St, Austin TX 78701",
      estimatedValue: 685000, confidence: 0.87, pricePerSqFt: 420,
      comparables: 8, marketTrend: "appreciating", yearlyAppreciation: 4.2,
      timestamp: "2026-04-16T12:00:00Z"
    },
    "lease-analysis": {
      property: "500 Broadway, NYC", leaseType: "NNN", monthlyRent: 18500,
      annualRent: 222000, pricePerSqFt: 74, marketRate: 71, variance: "+4.2%",
      redFlags: ["no_cap_on_cam_charges"], recommendation: "negotiate", timestamp: "2026-04-16T12:00:00Z"
    },
    "fraud-detection": {
      transaction: { from: "0xAbC123...", to: "0xDef456...", amount: "500 USDC" },
      fraudScore: 8, riskLevel: "low", flags: [], recommendation: "approve",
      confidence: 0.97, timestamp: "2026-04-16T12:00:00Z"
    },
    "credit-risk-score": {
      wallet: "0xAbC123...", creditScore: 720, tier: "A",
      metrics: { collateralizationRatio: 2.4, historicalDefault: false, protocolsUsed: ["aave", "compound"] },
      borrowLimit: "75% LTV", timestamp: "2026-04-16T12:00:00Z"
    },
    "compliance-check": {
      address: "0xAbC123...", status: "clear",
      checks: { ofac: "pass", chainalysis: "pass", elliptic: "pass" },
      sanctioned: false, pep: false, jurisdiction: "US", timestamp: "2026-04-16T12:00:00Z"
    },
    "compliance-consultation": {
      question: "Is this DeFi yield strategy compliant in the EU?",
      answer: "Based on MiCA regulations effective Jan 2025, yield-bearing stablecoin products are classified as e-money tokens...",
      confidence: 0.82, jurisdictions: ["EU", "MiCA"], disclaimer: "Not legal advice",
      timestamp: "2026-04-16T12:00:00Z"
    },
    "trading-signal": {
      symbol: "SOL/USDC", signal: "long", strength: "strong",
      entry: 145.50, target: 168.00, stopLoss: 138.00,
      riskReward: 2.9, confidence: 0.81, timeframe: "1d", reasoning: "breakout above key resistance + volume confirmation",
      timestamp: "2026-04-16T12:00:00Z"
    },
    "portfolio-optimization": {
      currentPortfolio: { ETH: 0.45, BTC: 0.30, SOL: 0.15, USDC: 0.10 },
      optimizedPortfolio: { ETH: 0.35, BTC: 0.35, SOL: 0.20, USDC: 0.10 },
      expectedAnnualReturn: 0.24, sharpeRatio: 1.42, maxDrawdown: 0.28,
      rebalanceActions: [{ asset: "BTC", action: "buy", amount: 0.05 }, { asset: "ETH", action: "sell", amount: 0.10 }],
      timestamp: "2026-04-16T12:00:00Z"
    },
    "correlation-matrix": {
      assets: ["BTC", "ETH", "SOL", "USDC"],
      matrix: { BTC: { ETH: 0.87, SOL: 0.74, USDC: -0.02 }, ETH: { SOL: 0.79, USDC: -0.03 }, SOL: { USDC: -0.01 } },
      window: "30d", timestamp: "2026-04-16T12:00:00Z"
    },
    "risk-metrics": {
      portfolio: "0xAbC123...", VaR95_1d: -0.043, CVaR95_1d: -0.072,
      sharpeRatio: 1.28, sortinoRatio: 1.84, maxDrawdown: -0.32, beta: 0.91,
      riskLevel: "moderate", window: "90d", timestamp: "2026-04-16T12:00:00Z"
    },
    "polymarket-events": {
      events: [
        { id: "evt_001", title: "Will BTC hit $100k before July 2026?", volume: 2400000, liquidity: 890000, endDate: "2026-07-01" },
        { id: "evt_002", title: "Will ETH ETF inflows exceed $2B in May?", volume: 760000, liquidity: 310000, endDate: "2026-05-31" }
      ],
      count: 2, timestamp: "2026-04-16T12:00:00Z"
    },
    "polymarket-odds": {
      eventId: "evt_001", title: "Will BTC hit $100k before July 2026?",
      outcomes: [{ label: "Yes", probability: 0.34, price: 0.34 }, { label: "No", probability: 0.66, price: 0.66 }],
      volume: 2400000, liquidity: 890000, timestamp: "2026-04-16T12:00:00Z"
    },
    "polymarket-search": {
      query: "bitcoin ETF", results: [
        { id: "evt_012", title: "Will spot Bitcoin ETF AUM exceed $100B?", probability_yes: 0.71, volume: 1200000 },
        { id: "evt_017", title: "Will BlackRock BTC ETF hit record inflows in Q2?", probability_yes: 0.44, volume: 480000 }
      ],
      count: 2, timestamp: "2026-04-16T12:00:00Z"
    },
    "prediction-market-odds": {
      market: "Will the Fed cut rates in June 2026?",
      outcomes: [{ label: "Yes", probability: 0.62 }, { label: "No", probability: 0.38 }],
      sources: ["polymarket", "kalshi"], volume: 3200000, timestamp: "2026-04-16T12:00:00Z"
    },
    "kalshi-markets": {
      markets: [
        { id: "KAL_FED_JUNE", title: "Fed rate cut June 2026", yesPrice: 0.62, noPrice: 0.38, volume: 1800000 },
        { id: "KAL_BTC_100K", title: "BTC above $100k by year end", yesPrice: 0.48, noPrice: 0.52, volume: 940000 }
      ],
      count: 2, timestamp: "2026-04-16T12:00:00Z"
    },
    "kalshi-search": {
      query: "inflation", results: [
        { id: "KAL_CPI_MARCH", title: "Will CPI exceed 3.5% in March 2026?", yesPrice: 0.29, volume: 620000 }
      ],
      count: 1, timestamp: "2026-04-16T12:00:00Z"
    },
    "kalshi-odds": {
      marketId: "KAL_FED_JUNE", title: "Fed rate cut June 2026",
      yes: { price: 0.62, shares: 180000 }, no: { price: 0.38, shares: 290000 },
      closingDate: "2026-06-15", timestamp: "2026-04-16T12:00:00Z"
    },
    "stock-sentiment": {
      symbol: "NVDA", sentiment: "bullish", score: 74,
      sources: { twitter: 78, reddit: 69, news: 75 },
      keyThemes: ["AI_demand", "data_center_growth", "earnings_beat"],
      recommendation: "positive_momentum", timestamp: "2026-04-16T12:00:00Z"
    },
    "forex-sentiment": {
      pair: "EUR/USD", sentiment: "bearish", score: 38,
      signals: ["dollar_strength", "ecb_dovish_stance"],
      bias: "short_eur", confidence: 0.71, timestamp: "2026-04-16T12:00:00Z"
    },
    "solana-yield-finder": {
      topOpportunities: [
        { protocol: "Kamino Finance", strategy: "SOL/USDC LP", apy: 18.4, tvl: 42000000, risk: "medium", chain: "solana" },
        { protocol: "MarginFi", strategy: "USDC lending", apy: 8.2, tvl: 180000000, risk: "low", chain: "solana" },
        { protocol: "Drift Protocol", strategy: "JLP vault", apy: 24.1, tvl: 28000000, risk: "high", chain: "solana" }
      ],
      bestRiskAdjusted: "MarginFi USDC lending (8.2% APY, low risk)",
      timestamp: "2026-04-16T12:00:00Z"
    },
    "smart-contract-audit": {
      contractAddress: "0x...", chain: "base", auditScore: 88,
      findings: [
        { severity: "low", title: "Missing zero-address check", line: 42, recommendation: "Add require(addr != address(0))" }
      ],
      criticalIssues: 0, highIssues: 0, mediumIssues: 0, lowIssues: 1,
      verdict: "safe_to_deploy_with_minor_fixes", timestamp: "2026-04-16T12:00:00Z"
    },
    "verified-agent-identity": {
      agentId: "agent_abc123", wallet: "0xAbC123...", chain: "base",
      erc8004: { registered: true, name: "YieldMaxAgent v2", version: "2.1.0" },
      reputation: { score: 94, totalTransactions: 1247, successRate: 0.997 },
      verified: true, timestamp: "2026-04-16T12:00:00Z"
    },
    "ai-inference": {
      model: "gpt-4o", prompt: "Summarize market conditions",
      response: "Current market shows strong momentum in AI-adjacent tokens with Base L2 volume hitting all-time highs...",
      tokens: { prompt: 18, completion: 64, total: 82 },
      latencyMs: 1240, timestamp: "2026-04-16T12:00:00Z"
    },
    "iot-sensor-reading": {
      deviceId: "sensor_xyz001", location: { lat: 37.77, lon: -122.41 },
      readings: { temperature_c: 22.4, humidity_pct: 58, pressure_hpa: 1013.2, pm25: 8.1 },
      quality: "good", batteryPct: 87, timestamp: "2026-04-16T12:00:00Z"
    },
    "iot-device-stream": {
      deviceId: "cam_fleet_001", streamUrl: "wss://stream.coinrailz.com/device/cam_fleet_001",
      format: "h264", resolution: "1080p", fps: 30, latencyMs: 45,
      sessionToken: "st_abc123", expiresIn: 3600, timestamp: "2026-04-16T12:00:00Z"
    },
    "iot-bulk-data": {
      deviceIds: ["sensor_001", "sensor_002", "sensor_003"], period: "1h",
      records: 180, format: "jsonl",
      downloadUrl: "https://data.coinrailz.com/bulk/export_abc123.jsonl.gz",
      expiresIn: 900, timestamp: "2026-04-16T12:00:00Z"
    },
    "fleet-telematics": {
      fleetId: "fleet_001", vehicles: 12, activeNow: 9,
      summary: { avgSpeedKph: 48, totalDistanceKm: 2847, idleTimeMin: 234, fuelEfficiencyLKm: 8.2 },
      alerts: [{ vehicleId: "truck_03", type: "hard_brake", timestamp: "2026-04-16T11:42:00Z" }],
      timestamp: "2026-04-16T12:00:00Z"
    },
    "weather-station-data": {
      stationId: "wx_sf_001", location: "San Francisco, CA",
      current: { temp_c: 14.8, humidity_pct: 72, wind_kph: 18, precip_mm_1h: 0.0, visibility_km: 16 },
      forecast6h: { temp_c: 13.2, precip_prob: 0.15 },
      dataSource: "ground_station", timestamp: "2026-04-16T12:00:00Z"
    },
  };
  const sampleOutput = sampleOutputs[serviceName] || _extraSamples[serviceName] || { success: true, data: {}, service: serviceName, timestamp: new Date().toISOString() };

  // Solana feePayer: must be the buyer's own address (they pay tx fee + sign).
  // Clients should send X-Solana-Wallet header with their public key.
  const solanaFeePayer = (req.headers['x-solana-wallet'] as string | undefined)?.trim() || null;

  // Multi-chain accepts array: Base/USDC, Base/USDT, Solana/USDC, Solana/USDT
  // Robinhood Chain (eip155:4663) entry appended when ROBINHOOD_CHAIN_CCTP_ENABLED=true
  const acceptsArray = [
    // Base Chain - USDC (primary)
    {
      scheme: "exact",
      network: "base",
      networkLegacy: "base",
      x402Network: "eip155:8453",
      amount: requiredAmount.toString(),
      maxAmountRequired: requiredAmount.toString(),
      maxAmountRequiredUSD: priceUsd,
      resource: resource,
      description: baseDescription,
      mimeType: "application/json",
      payTo: PLATFORM_WALLET,
      maxTimeoutSeconds: 60,
      asset: USDC_BASE,
      // REQUIRED by x402 spec: facilitator endpoint where the payer submits their signed EIP-3009
      // authorization for settlement verification. Cloudflare Agents SDK reads accepts[i].facilitator
      // directly — without it the SDK skips this entry and the agent cannot pay on Base.
      facilitator: getFacilitatorUrl(),
      extra: {
        name: "USD Coin",
        version: "2",
        decimals: 6,
        chainId: 8453,
        chainName: "Base"
      },
      discoverable: true,
      extensions: {
        bazaar: {
          info: {
            input: { type: "http" as const, method: "POST" as const, bodyType: "json" as const, body: { query: "example parameter" }, headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' } },
            output: { type: "application/json", format: "json", example: { success: true, result: {}, timestamp: new Date().toISOString() } }
          }
        }
      }
    },
    // Base Chain - USDT
    {
      scheme: "exact",
      network: "base",
      networkLegacy: "base",
      x402Network: "eip155:8453",
      amount: requiredAmount.toString(),
      maxAmountRequired: requiredAmount.toString(),
      maxAmountRequiredUSD: priceUsd,
      resource: resource,
      description: baseDescription,
      mimeType: "application/json",
      payTo: PLATFORM_WALLET,
      maxTimeoutSeconds: 60,
      asset: USDT_BASE,
      // REQUIRED by x402 spec: same CDP facilitator handles USDT on Base
      facilitator: getFacilitatorUrl(),
      extra: {
        name: "Tether USD",
        version: "1",
        decimals: 6,
        chainId: 8453,
        chainName: "Base"
      },
      discoverable: false
    },
    // Solana - USDC
    {
      scheme: "exact",
      network: "solana",
      networkLegacy: "solana",
      x402Network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
      amount: requiredAmount.toString(),
      maxAmountRequired: requiredAmount.toString(),
      maxAmountRequiredUSD: priceUsd,
      resource: resource,
      description: baseDescription,
      mimeType: "application/json",
      payTo: SOLANA_PLATFORM_WALLET,
      maxTimeoutSeconds: 60,
      asset: USDC_SOLANA,
      extra: {
        name: "USD Coin",
        version: "1",
        decimals: 6,
        chainId: "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
        chainName: "Solana",
        ...(solanaFeePayer ? { feePayer: solanaFeePayer } : {})
      },
      discoverable: false
    },
    // Solana - USDT
    {
      scheme: "exact",
      network: "solana",
      networkLegacy: "solana",
      x402Network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
      amount: requiredAmount.toString(),
      maxAmountRequired: requiredAmount.toString(),
      maxAmountRequiredUSD: priceUsd,
      resource: resource,
      description: baseDescription,
      mimeType: "application/json",
      payTo: SOLANA_PLATFORM_WALLET,
      maxTimeoutSeconds: 60,
      asset: USDT_SOLANA,
      extra: {
        name: "Tether USD",
        version: "1",
        decimals: 6,
        chainId: "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
        chainName: "Solana",
        ...(solanaFeePayer ? { feePayer: solanaFeePayer } : {})
      },
      discoverable: false
    },
    // Robinhood Chain (eip155:4663) - USDC
    // Gated by ROBINHOOD_CHAIN_CCTP_ENABLED=true + USDC_ROBINHOOD_ADDRESS env vars
    // Activate once Circle assigns a CCTP domain to eip155:4663 and publishes native USDC address
    ...(ROBINHOOD_CHAIN_CCTP_ENABLED && USDC_ROBINHOOD ? [{
      scheme: "exact",
      network: "robinhood",
      networkLegacy: "robinhood",
      x402Network: "eip155:4663",
      amount: requiredAmount.toString(),
      maxAmountRequired: requiredAmount.toString(),
      maxAmountRequiredUSD: priceUsd,
      resource: resource,
      description: baseDescription,
      mimeType: "application/json",
      payTo: PLATFORM_WALLET,
      maxTimeoutSeconds: 60,
      asset: USDC_ROBINHOOD,
      extra: {
        name: "USD Coin",
        version: "2",
        decimals: 6,
        chainId: 4663,
        chainName: "Robinhood Chain",
        ...(CCTP_DOMAIN_ROBINHOOD !== null ? { cctpDomain: CCTP_DOMAIN_ROBINHOOD } : {})
      },
      discoverable: true
    }] : [])
  ];
  
  const serviceExampleBodies: Record<string, any> = {
    "token-metadata": { tokenAddress: "0x6b785a0322126826d8226d77e173d75DAfb84d11", chain: "ethereum" },
    "gas-price-oracle": { chain: "base" },
    "wallet-risk": { address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" },
    "approval-manager": { tokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", spender: "0x...", amount: "unlimited", chain: "base" },
    "whale-alerts": { tokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", chain: "ethereum", threshold: 100000 },
    "trade-signals": { token: "ETH", timeframe: "4h", riskLevel: "medium" },
    "agent-create-wallet": { agent_id: "my-trading-bot-v1", purpose: "persistent", chain: "base-mainnet" },
    "credit-risk-score": { applicantInfo: { annualIncome: 85000, employmentYears: 5, currentDebt: 12000 }, requestedAmount: 50000 },
    // --- Services probed by the earthdata organic payer (Aug 2026) ---
    "fleet-telematics": { fleetId: "fleet_001", vehicleIds: ["truck_01", "truck_02", "truck_03"], timeRangeHours: 24 },
    "trading-signal": { symbol: "SOL/USDC", timeframe: "1d" },
    "dex-liquidity": { tokenA: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", tokenB: "0x4200000000000000000000000000000000000006", chain: "base" },
    "polymarket-odds": { slug: "will-btc-hit-100k-2026" },
    "portfolio-tracker": { walletAddress: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", chains: ["ethereum", "base", "polygon"] },
    "stock-sentiment": { symbol: "NVDA", includeNews: true, includeTechnicals: true },
  };
  const bazaarInput = {
    type: "http" as const,
    method: "POST" as const,
    bodyType: "json" as const,
    body: serviceExampleBodies[serviceName] || { query: "example parameter" },
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
  };
  const bazaarOutput = {
    type: "application/json",
    format: "json",
    example: { success: true, result: {}, timestamp: new Date().toISOString() }
  };
  
  // ── Returning-agent detection ────────────────────────────────────────────
  // Check whether this IP has made paid calls before. If it has a prior
  // payment history but is arriving without X-PAYMENT now (depleted wallet),
  // inject a top-up hint so the agent knows exactly what to do to resume.
  let returningAgentHint: {
    wallet: string;
    prior_payment_count: number;
    message: string;
    top_up_steps: string[];
  } | null = null;
  try {
    const requestIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '';
    if (requestIp && requestIp !== 'unknown') {
      const priorRows = await db
        .select({
          walletAddress: x402Interactions.walletAddress,
          count: sql<number>`count(*)`,
        })
        .from(x402Interactions)
        .where(
          and(
            eq(x402Interactions.ipAddress, requestIp),
            sql`${x402Interactions.walletAddress} IS NOT NULL`,
            or(
              eq(x402Interactions.paymentReceived, true),
              eq(x402Interactions.paid, true)
            )
          )
        )
        .groupBy(x402Interactions.walletAddress)
        .orderBy(sql`count(*) DESC`)
        .limit(1);

      if (priorRows.length > 0 && priorRows[0].walletAddress) {
        const wallet = priorRows[0].walletAddress;
        const count = Number(priorRows[0].count);
        const baseUrl_ = getPublicBaseUrl(req);
        returningAgentHint = {
          wallet,
          prior_payment_count: count,
          message: `We recognise your agent — this IP has ${count} prior paid call${count === 1 ? '' : 's'} from wallet ${wallet}. Your wallet appears to be depleted. Fund ${wallet} with USDC on Base (eip155:8453) to resume paying.`,
          top_up_steps: [
            `1. CHECK current balance: curl '${baseUrl_}/x402/multi-chain-balance' -H 'X-API-KEY: <trial_key>' -d '{"address":"${wallet}"}'`,
            `2. BUY USDC on Base: purchase on Coinbase and withdraw to Base, or swap at base.uniswap.org`,
            `3. SEND USDC to your wallet address (${wallet}) on Base mainnet (chain ID 8453) — you need ${(requiredAmount / 1_000_000).toFixed(2)} USDC per call + ~$0.001 ETH for gas`,
            `4. RETRY this request with X-PAYMENT header (use x402-fetch or the EIP-712 recipe in funding_guide)`,
          ],
        };
        console.log(`💰 Returning-agent hint injected for depleted wallet ${wallet} (${count} prior payments) | IP: ${requestIp}`);
      }
    }
  } catch (hintErr: any) {
    // Non-fatal — never block a 402 response over a hint lookup failure
    console.warn(`⚠️ generate402Response: returning-agent hint lookup failed: ${hintErr.message}`);
  }
  // ─────────────────────────────────────────────────────────────────────────

  const response: any = {
    x402Version: 2,
    error: "X-PAYMENT header is required",
    // Machine-readable trial access — fastest path to a working key (no payment needed)
    trial_access: {
      available: true,
      description: "Free $5 trial API key — no payment, no crypto wallet. 1 per IP per 7 days.",
      endpoint: `${baseUrl}/api/m2m/credits/trial`,
      method: "GET",
      returns: { apiKey: "cr_live_...", credits: 5.00, expiresIn: "7 days" },
      usage: "Retry this request with: X-API-KEY: <returned_key>",
      note: "SAVE the key — it is not stored in plaintext and cannot be retrieved again."
    },
    // Structured system prompt for LLM-based agents encountering this 402
    agent_instructions: {
      system_prompt: `402 Payment Required for ${resource}. Five paths to proceed:\n1. FREE TRIAL (fastest, no payment): GET ${baseUrl}/api/m2m/credits/trial → receive cr_live_ key with $5 credits (~80-100 calls). Retry with X-API-KEY header.\n2. HOSTED CHECKOUT (operator pays once, key auto-provisioned): POST ${baseUrl}/api/m2m/credits/checkout/session with {"amountUsd":10}. Response includes checkoutUrl (open in browser) + retrievalToken (save it). Poll statusEndpoint?token=<retrievalToken> for key after payment.\n3. DIRECT CARD (if you have a Stripe paymentMethodId): POST ${baseUrl}/api/m2m/credits/purchase with {paymentMethodId, amountUsd, idempotencyKey}.\n4. ON-CHAIN USDC: Send ${priceUsd} USDC to payTo address in accepts[] on Base (eip155:8453) or Solana, include signed payload in X-PAYMENT header and retry. Ethereum mainnet (eip155:1) is also accepted for verification — send USDC (0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48) or USDT (0xdAC17F958D2ee523a2206206994597C13D831ec7) to the platform_wallet in alternativePaymentMethods.rawTransaction.platformWallets.ethereum and include the tx hash as X-PAYMENT.\n5. CLOUDFLARE WALLET (if you are a CF Wallet agent): You are already set up — your wallet uses the Coinbase CDP facilitator we accept. Send cloudflare-agent-id header and retry with your wallet active via the Cloudflare Agents SDK or wrapFetchWithPayment. No manual signing required.`,
      recommended_action: "GET /api/m2m/credits/trial",
      docs: `${baseUrl}/.well-known/agent-instructions.json`,
      ...(req.method === 'POST' && !req.headers['x-payment'] && !req.headers['x-api-key'] ? {
        api_key_usage: `Your POST request arrived without an X-API-KEY or X-PAYMENT header — this is why you received 402. If you already have a trial or purchased key (starts with cr_live_), add it as a request header: X-API-KEY: <your-key>. To get a free $5 trial key instantly (no crypto wallet, no card): GET ${baseUrl}/api/m2m/credits/trial — returns {"apiKey":"cr_live_..."}. SAVE the key; it is shown once. Then retry this exact POST with the header included.`
      } : {})
    },
    // What the agent receives when payment succeeds — allows Cost vs. Utility computation before paying
    expected_output: {
      description: `What you receive for $${priceUsd} USDC`,
      format: "application/json",
      sample: sampleOutput
    },
    // Concrete wallet funding guide — for agents with x402 clients that lack funded wallets
    funding_guide: {
      fastest_path: `GET ${baseUrl}/api/m2m/credits/trial — free $5 API key, no wallet needed, works immediately`,
      on_chain_usdc: {
        preferred_network: "Base mainnet (chain ID 8453) — lowest gas",
        networks: [
          {
            name: "Base mainnet (chain ID 8453)",
            network: "eip155:8453",
            usdc_contract: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            usdt_contract: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
            minimum_balance: `${priceUsd} USDC + ~$0.001 ETH for gas`,
            platform_wallet: PLATFORM_WALLET,
            funding_steps: [
              "1. GET Base ETH for gas: bridge via bridge.base.org or buy on Coinbase and withdraw to Base",
              "2. GET USDC on Base: buy on Coinbase → withdraw to Base, or swap at base.uniswap.org",
              `3. VERIFY balance: curl '${baseUrl}/x402/multi-chain-balance' -H 'X-API-KEY: <trial_key>' -d '{"address":"YOUR_ADDRESS"}'`,
              "4. SEND payment using x402-fetch, x402-axios, or CDP SDK — include X-PAYMENT header and retry"
            ],
          },
          {
            name: "Ethereum mainnet (chain ID 1)",
            network: "eip155:1",
            usdc_contract: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
            usdt_contract: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
            minimum_balance: `${priceUsd} USDC + ~$0.02 ETH for gas`,
            platform_wallet: PLATFORM_WALLET,
            payment_method: "Send USDC or USDT to platform_wallet, then include the tx hash as X-PAYMENT: <0x...> and retry the request",
            note: "Ethereum verification is fully supported. Send the tx hash directly in X-PAYMENT."
          }
        ],
        sdk_quickstart: `// npm install x402-fetch\nimport { wrapFetchWithPayment } from 'x402-fetch';\n// maxValue must be set to cover the service price — default is too low for most services\nconst pay = wrapFetchWithPayment(fetch, wallet, { maxValue: BigInt(10 * 10 ** 6) });\nconst r = await pay('${baseUrl}/x402/${serviceName}', { method: 'POST', body: JSON.stringify({}) });\nconsole.log(await r.json());`,
        note: "Base is preferred for lowest gas. Ethereum mainnet also accepted — send tx hash in X-PAYMENT header."
      }
    },
    recommended_next_step_agent: {
      action: "get_free_trial_key",
      description: `Fastest autonomous path — no crypto wallet or card required. GET this URL to receive a cr_live_ API key with $5 credits (~80-100 calls). Then retry any /x402/* request with X-API-KEY: cr_live_... header.`,
      method: "GET",
      endpoint: `${baseUrl}/api/m2m/credits/trial`,
      usage: "X-API-KEY: cr_live_... on any /x402/* request instead of X-PAYMENT",
      note: "Use this if you have no funded wallet. For on-chain USDC payment see accepts[] below."
    },
    recommended_next_step: {
      action: "purchase_api_key",
      requires_human_interaction: true,
      description: `Human operator path — requires a browser and a Stripe card. Not executable by autonomous agents. Open checkoutUrl in a browser to purchase a cr_live_ key, or use recommended_next_step_agent for the autonomous path.`,
      checkout_endpoint: `${baseUrl}/api/m2m/credits/checkout/session`,
      checkout_method: "POST",
      checkout_body: { amountUsd: 10 },
      expected_time: "~60 seconds from card to working API key",
      usage: "Attach to every request as: X-API-KEY: cr_live_..."
    },
    non_x402: {
      description: `Card-first payment paths — no crypto wallet required. API key works on all ${getCanonicalServiceCount()} /x402/* services.`,
      checkoutUrl: `${baseUrl}/api/m2m/credits/checkout/session`,
      trialUrl: `${baseUrl}/api/m2m/credits/trial`,
      capabilitiesUrl: `${baseUrl}/api/auth/capabilities`,
      paths: {
        free_trial: { method: "GET", url: `${baseUrl}/api/m2m/credits/trial`, note: "$5 free, no payment" },
        hosted_checkout: { method: "POST", url: `${baseUrl}/api/m2m/credits/checkout/session`, body: { amountUsd: 10 }, note: "Open returned checkoutUrl in any browser. Key auto-provisioned via webhook." },
        direct_card: { method: "POST", url: `${baseUrl}/api/m2m/credits/purchase`, body: { paymentMethodId: "pm_...", amountUsd: 10, idempotencyKey: "uuid-v4" } },
      },
    },
    accepts: acceptsArray,
    // Top-level network capability discovery — informational, not the payment selection list.
    // Agents can read this to know which chains are supported before constructing a payment.
    // eip155:1 is listed here for discovery; Ethereum tx hashes are verified by the orchestrator.
    supportedNetworks: [
      {
        network: "eip155:8453",
        name: "Base",
        token: "USDC",
        contract: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        active: true
      },
      {
        network: "eip155:8453",
        name: "Base",
        token: "USDT",
        contract: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
        active: true
      },
      {
        network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
        name: "Solana",
        token: "USDC",
        contract: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        active: true
      },
      {
        network: "eip155:1",
        name: "Ethereum",
        token: "USDC",
        contract: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        active: true,
        note: "Send USDC to platform_wallet (see alternativePaymentMethods.rawTransaction.platformWallets.ethereum), include tx hash as X-PAYMENT header"
      },
      {
        network: "eip155:1",
        name: "Ethereum",
        token: "USDT",
        contract: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        active: true,
        note: "Send USDT to platform_wallet, include tx hash as X-PAYMENT header"
      }
    ],
    resource: {
      url: resource,
      description: baseDescription,
      mimeType: "application/json"
    },
    extensions: {
      bazaar: {
        info: { input: bazaarInput, output: bazaarOutput },
        schema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Query parameter for the service" }
          }
        }
      },
      coinrailzPartner: {
        schemaVersion: "1.0",
        email: "support@coinrailz.com",
        docs: "https://coinrailz.com/developers",
        partnerOnboard: "https://coinrailz.com/api/m2m/credits/trial",
        note: "Building an AI agent that needs payment infrastructure? Contact us for partner integration, revenue sharing, and priority API access."
      }
    },
    facilitatorUrl: getFacilitatorUrl(),
    paymentInstructions: {
      step1: "Obtain USDC or USDT on Ethereum, Base, or Solana",
      step2: "Send exact amount to platform wallet",
      step3: "Include transaction hash in X-PAYMENT header",
      step4: "Retry the request with X-PAYMENT header",
      supportedMethods: ["raw-transaction-hash", "eip3009-authorization", "api-key"],
      supportedChains: ["ethereum (eip155:1)", "base (eip155:8453)", "arbitrum (eip155:42161)", "solana (solana:mainnet)"],
      supportedTokens: ["USDC", "USDT"]
    },
    alternativePaymentMethods: {
      apiKey: {
        recommended: true,
        description: "Card-based M2M API key — no blockchain or crypto wallet required. Get a cr_live_ key in ~60 seconds.",
        purchaseEndpoint: `${baseUrl}/api/m2m/credits/purchase`,
        purchaseMethod: "POST",
        purchaseBody: { paymentMethodId: "pm_...", amountUsd: 10, idempotencyKey: "<uuid-v4>" },
        idempotencyKeyFormat: "Any unique string, min 8 chars. UUID v4 recommended. Reuse on retry — safe for duplicate prevention.",
        successResponse: { apiKey: "cr_live_...", creditsAdded: 200, note: "SAVE apiKey — returned once only" },
        usage: "X-API-KEY: cr_live_... header or Authorization: Bearer cr_live_... on any /x402/* request instead of X-PAYMENT",
        tiers: [
          { amountUsd: 5,   label: "Intro",   calls: "~80-100 service calls", note: "Try it — no commitment" },
          { amountUsd: 10,  label: "Starter", calls: "~200 service calls" },
          { amountUsd: 25,  label: "Growth",  calls: "~500 service calls", recommended: true },
          { amountUsd: 100, label: "Pro",     calls: "~2,000 service calls" }
        ],
        rateLimit: "5 purchases per IP per hour",
        errorCodes: { "400": "Invalid paymentMethodId or idempotencyKey too short", "409": "Already processed — use new idempotencyKey", "429": "Rate limit exceeded" },
        example: `curl -X POST "${resource}" -H "X-API-KEY: cr_live_..." -H "Content-Type: application/json" -d '{}'`
      },
      rawTransaction: {
        description: "Send USDC/USDT to platform wallet, include tx hash in X-PAYMENT header",
        usage: "X-PAYMENT: <transaction-hash> (0x... for EVM, base58 for Solana)",
        platformWallets: {
          base: PLATFORM_WALLET,
          ethereum: PLATFORM_WALLET,
          arbitrum: PLATFORM_WALLET,
          ...(ROBINHOOD_CHAIN_CCTP_ENABLED ? { robinhood: PLATFORM_WALLET } : {}),
          solana: SOLANA_PLATFORM_WALLET
        }
      }
    },
    recommendedServices: [
      { id: "gas-price-oracle", name: "Gas Price Oracle", priceUSD: formatUSD(SERVICE_PRICING_USD['gas-price-oracle']), endpoint: "/x402/gas-price-oracle", note: "FIRST CALL FREE for new agents!" },
      { id: "token-metadata", name: "Token Metadata", priceUSD: formatUSD(SERVICE_PRICING_USD['token-metadata']), endpoint: "/x402/token-metadata", note: "FIRST CALL FREE for new agents!" },
      { id: "trade-signals", name: "AI Trade Signals", priceUSD: formatUSD(SERVICE_PRICING_USD['trade-signals']), endpoint: "/x402/trade-signals" },
      { id: "wallet-risk", name: "Wallet Risk Analysis", priceUSD: formatUSD(SERVICE_PRICING_USD['wallet-risk']), endpoint: "/x402/wallet-risk" },
      { id: "agent-create-wallet", name: "Agent Wallet Provisioning", priceUSD: formatUSD(SERVICE_PRICING_USD['agent-create-wallet']), endpoint: "/x402/agent-create-wallet" },
    ],
    catalogUrl: `${baseUrl}/x402/catalog`,
    totalServicesAvailable: getCanonicalServiceCount(),
    requestId: requestId,
    
    inputSchema: {
      type: "object",
      description: `Input schema for ${serviceName}`,
      properties: {
        query: { type: "string", description: "Query parameter for the service" }
      },
      httpMethod: "POST",
      contentType: "application/json"
    },
    
    // FIRST-CALL FREE promotion
    firstCallFree: {
      eligible: FIRST_CALL_FREE_SERVICES.includes(serviceName),
      services: ["gas-price-oracle", "token-metadata"],
      priceNormally: formatUSD(getServicePriceUSD('gas-price-oracle')),
      note: "New agents get their first call FREE on gas-price-oracle or token-metadata! Just make the request - no payment needed."
    },
    
    // Quick start script for agents
    quickStart: {
      curlExample: `curl -X GET "${baseUrl}/x402/gas-price-oracle" -H "Content-Type: application/json"`,
      note: "First call is FREE - try it now! After that, include X-PAYMENT header with your transaction hash.",
      docsUrl: `${baseUrl}/docs/x402-quick-start`
    },
    
    // SDK integration options
    sdkOptions: {
      pythonMCP: {
        install: "pip install coinrailz-mcp",
        pypi: "https://pypi.org/project/coinrailz-mcp/",
        note: "MCP server for Claude Desktop - access all 69 services via tools"
      },
      typescript: {
        install: "npm install coinrailz",
        npm: "https://www.npmjs.com/package/coinrailz",
        note: "TypeScript/JavaScript SDK for Node.js and browser"
      },
      getDemoKey: {
        endpoint: `${baseUrl}/api/sdk/demo-key`,
        method: "POST",
        body: '{"installId": "your-unique-id", "sdkType": "python-mcp"}',
        credits: "$5 trial credits (72-hour expiry)",
        note: "Get a free trial API key to test all services"
      }
    }
  };

  // Inject last_error_reason when a previous payment attempt failed.
  // Lets agents see exactly why their X-PAYMENT was rejected without a separate call.
  if (lastErrorReason) {
    response.last_error_reason = lastErrorReason;
  }

  // Inject returning_agent_hint for known payers whose wallet appears depleted
  if (returningAgentHint) {
    response.returning_agent_hint = returningAgentHint;
  }

  // Golden Path: inject dual-track payment recipe for first-call endpoint
  // Prices derived from requiredAmount (live) — never hardcoded
  if (serviceName === 'first-call') {
    const gcAmountStr = `${requiredAmount} micro-USDC (${priceUsd.toFixed(2)} USDC, 6 decimals)`;
    response.goldenPath = {
      onboarding: true,
      recommendedForFirstPayment: true,
      priceUSD: priceUsd.toFixed(2),
      amountMicroUSDC: requiredAmount,
      paymentRecipe: {
        description: "Two payment paths — choose the chain your agent is on. Both lead to the same 200 OK response.",
        evmPath: {
          chain: "Base mainnet",
          chainId: 8453,
          network: "eip155:8453",
          asset: "USDC (0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)",
          amount: gcAmountStr,
          payTo: PLATFORM_WALLET,
          facilitator: "https://api.cdp.coinbase.com/platform/v2/x402",
          signingNote: `X-PAYMENT is base64(JSON.stringify({x402Version:2,scheme:'exact',network:'eip155:8453',payload:{authorization:{from,to,value,validAfter,validBefore,nonce},signature}})) — NOT a raw tx hash. Sign off-chain via EIP-712 (no gas). Use x402-fetch wrapFetchWithPayment for automatic handling, or follow the pythonExample for manual signing with eth_account.`,
          steps: [
            `1. POST /x402/first-call without X-PAYMENT to receive this 402 — read accepts[0].payTo and maxAmountRequired`,
            `2. Build EIP-3009 authorization: {from:<your_wallet>, to:accepts[0].payTo, value:${requiredAmount}, validAfter:0, validBefore:<unix+300s>, nonce:<random_32_bytes>}`,
            `3. Sign with EIP-712: domain={name:'USD Coin',version:'2',chainId:8453,verifyingContract:'0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'} — no gas required`,
            `4. Set X-PAYMENT: base64(JSON.stringify({x402Version:2,scheme:'exact',network:'eip155:8453',payload:{authorization:<step2_object>,signature:<step3_sig>}}))`,
            `5. Retry POST /x402/first-call with X-PAYMENT header — receive 200 OK with onboarding receipt, sessionId, and next-service templates`
          ],
          pythonExample: `# pip install requests eth-account\nimport requests, json, time, base64, secrets, os\nfrom eth_account import Account\nfrom eth_account.messages import encode_typed_data\n\nwallet = Account.from_key(os.environ['PRIVATE_KEY'])\nbase_url = '${baseUrl}'\n\n# Step 1: get the 402 challenge\nchallenge = requests.post(f'{base_url}/x402/first-call', json={}).json()\npay_to = challenge['accepts'][0]['payTo']\n\n# Step 2: build authorization\nnow = int(time.time())\nauth = {\n    'from': wallet.address,\n    'to': pay_to,\n    'value': ${requiredAmount},\n    'validAfter': 0,\n    'validBefore': now + 300,\n    'nonce': '0x' + secrets.token_hex(32)\n}\n\n# Step 3: sign EIP-712 (no gas)\ndomain = {'name': 'USD Coin', 'version': '2', 'chainId': 8453,\n           'verifyingContract': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'}\ntypes = {'TransferWithAuthorization': [\n    {'name': 'from', 'type': 'address'}, {'name': 'to', 'type': 'address'},\n    {'name': 'value', 'type': 'uint256'}, {'name': 'validAfter', 'type': 'uint256'},\n    {'name': 'validBefore', 'type': 'uint256'}, {'name': 'nonce', 'type': 'bytes32'}\n]}\nsig = Account.sign_typed_data(wallet.key, domain, types, auth)\n\n# Step 4: encode header\npayload = {'x402Version': 2, 'scheme': 'exact', 'network': 'eip155:8453',\n           'payload': {'authorization': auth, 'signature': sig.signature.hex()}}\nx_payment = base64.b64encode(json.dumps(payload).encode()).decode()\n\n# Step 5: call with payment\nresp = requests.post(f'{base_url}/x402/first-call',\n    headers={'X-PAYMENT': x_payment, 'Content-Type': 'application/json'}, json={})\nprint(resp.json())`,
          typescriptExample: `// npm install x402-fetch viem\nimport { wrapFetchWithPayment } from 'x402-fetch';\nimport { createWalletClient, http } from 'viem';\nimport { base } from 'viem/chains';\nimport { privateKeyToAccount } from 'viem/accounts';\n\nconst account = privateKeyToAccount(process.env.PRIVATE_KEY as \`0x\${string}\`);\nconst walletClient = createWalletClient({ account, chain: base, transport: http() });\nconst x402Fetch = wrapFetchWithPayment(fetch, walletClient as any, { maxValue: BigInt(10 * 10 ** 6) });\n\n// wrapFetchWithPayment handles EIP-712 signing and X-PAYMENT construction automatically\nconst resp = await x402Fetch('${baseUrl}/x402/first-call', {\n  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({})\n});\nconsole.log(await resp.json());`,
          curlNote: `curl cannot sign EIP-712 inline. Compute x_payment with the Python example above, then: curl -X POST ${baseUrl}/x402/first-call -H 'Content-Type: application/json' -H 'X-PAYMENT: <computed_x_payment>' -d '{}'`
        },
        solanaPath: {
          network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
          asset: "USDC (EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v)",
          amount: gcAmountStr,
          payTo: SOLANA_PLATFORM_WALLET,
          facilitator: "https://x402.dexter.cash",
          scheme: "ExactSvmScheme",
          steps: [
            "1. Include X-Solana-Wallet: <your_pubkey> header with initial request",
            `2. POST /x402/first-call without X-PAYMENT to receive 402 — Dexter facilitator will sign ExactSvmScheme payment of ${requiredAmount} micro-USDC on your behalf`,
            "3. Retry POST /x402/first-call with X-PAYMENT: <dexter_signed_payload> and X-Solana-Wallet: <pubkey>",
            "4. Receive 200 OK with onboarding receipt"
          ],
          pythonExample: `# Solana path via Dexter facilitator (x402.dexter.cash)\nimport requests, json, base64\n\nbase_url = '${baseUrl}'\npubkey = '<your_solana_pubkey>'\n\n# Step 1: get challenge\nchallenge = requests.post(f'{base_url}/x402/first-call',\n    headers={'X-Solana-Wallet': pubkey}, json={}).json()\n\n# Step 2: send to Dexter facilitator for signing\ndexter_resp = requests.post('https://x402.dexter.cash/sign',\n    json={'challenge': challenge, 'wallet': pubkey}).json()\nx_payment = dexter_resp['x_payment']\n\n# Step 3: call with signed payment\nresp = requests.post(f'{base_url}/x402/first-call',\n    headers={'X-PAYMENT': x_payment, 'X-Solana-Wallet': pubkey,\n             'Content-Type': 'application/json'}, json={})\nprint(resp.json())`,
          curlNote: `curl -X POST ${baseUrl}/x402/first-call -H 'Content-Type: application/json' -H 'X-Solana-Wallet: <pubkey>' -H 'X-PAYMENT: <dexter_signed_payload>' -d '{}'`
        },
        cloudflarePath: {
          description: "Cloudflare Wallet — zero setup if you already have one. Your wallet uses the Coinbase CDP facilitator we accept (api.cdp.coinbase.com/platform/v2/x402). Pay $0.05 USDC on Base automatically.",
          compatible: true,
          facilitator: "https://api.cdp.coinbase.com/platform/v2/x402",
          steps: [
            "1. Your Cloudflare Wallet handles EIP-712 signing and X-PAYMENT construction automatically — no manual signing",
            "2. Use the Cloudflare Agents SDK fetch() — it intercepts 402 responses and retries with payment",
            `3. Cost: $0.05 USDC on Base (eip155:8453) — deducted from your CF Wallet automatically`,
            `4. Receive 200 OK with onboarding receipt, sessionId, and next-service templates`
          ],
          sdkExample: `// Cloudflare Agents SDK — automatic x402 payment\nimport { Agent } from '@cloudflare/agents';\n\n// CF Wallet intercepts 402 and pays $0.05 USDC on Base automatically\nconst response = await agent.fetch('${baseUrl}/x402/first-call', {\n  method: 'POST',\n  body: JSON.stringify({})\n});\nconsole.log(await response.json()); // onboarding receipt + next-service templates`,
          note: "Cloudflare Wallets launched August 4, 2026. Compatible because CF Wallets use the Coinbase CDP facilitator (api.cdp.coinbase.com/platform/v2/x402) that we already list in our accepts[] array. No configuration change needed on either side. Note: first-call-free applies to gas-price-oracle and token-metadata (not this endpoint) — this service requires $0.05 payment."
        }
      }
    };
  }

  // Universal execution_guide — injected for ALL paid services.
  // Provides cloudflarePath + EVM + Solana signing recipes to every 402 body.
  // first-call is excluded: it already has a richer goldenPath block (superset).
  // Free services (vlt-usdc-deposit, vlt-usdc-withdraw, vlt-stats GET) never reach
  // generate402Response(), so they are naturally excluded with no guard needed.
  if (serviceName !== 'first-call') {
    response.execution_guide = buildExecutionGuide({
      serviceName,
      requiredAmount,
      priceUsd,
      requestBody: serviceExampleBodies[serviceName] || {},
      paymentRecipeDescription: `Two payment paths — choose the chain your agent is on. Both lead to the same 200 OK response with ${serviceName.replace(/-/g, ' ')} data.`,
      successDescription: `the ${serviceName.replace(/-/g, ' ')} response payload`,
      baseUrl
    });
  }

  // Add partner CTA for known agents
  if (knownAgent.isKnown && knownAgent.partnerOffer) {
    response.partnerProgram = {
      detected: knownAgent.name,
      message: `Welcome ${knownAgent.name}! We've detected you as a known AI agent platform.`,
      offer: {
        type: "partner-integration",
        benefits: [
          "Priority API access with higher rate limits",
          "10% revenue share on referred agent payments",
          "Custom integration support",
          "Featured listing in our agent directory"
        ],
        contact: "support@coinrailz.com",
        quickOnboard: `${baseUrl}/api/m2m/credits/trial`
      }
    };
    
    console.log(`🤝 Partner CTA injected for ${knownAgent.name}`);
  }

  console.log(`📊 x402 Funnel: challenge-issued for ${serviceName} | IP: ${req.ip} | Agent: ${knownAgent.name} | RequestId: ${requestId || 'none'}`);
  
  res.setHeader('X-Agent-Instructions', 'https://coinrailz.com/.well-known/agent-instructions.json');
  res.setHeader('Link', '<https://coinrailz.com/.well-known/agent-instructions.json>; rel="agent-instructions"');

  // Actionable payment headers — readable on HTTP HEAD without the body.
  // HEAD-probe agents (e.g. earthdata payer pattern) can read price + schema without doing a GET.
  res.setHeader('X-Payment-Price', `$${priceUsd.toFixed(2)} USDC`);
  res.setHeader('X-Payment-Network', 'eip155:8453 (Base mainnet)');
  const _exampleBody = serviceExampleBodies[serviceName];
  if (_exampleBody && Object.keys(_exampleBody).length > 0) {
    res.setHeader('X-Request-Example', JSON.stringify(_exampleBody));
  }
  res.setHeader('X-Payment-Recipe-URL', `${baseUrl}/x402/recipes/${serviceName}`);
  res.setHeader('X-Trial-Access', `${baseUrl}/api/m2m/credits/trial`);

  res.status(402).json(response);
}
