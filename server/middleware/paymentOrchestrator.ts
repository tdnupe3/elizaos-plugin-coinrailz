import { Request, Response, NextFunction } from "express";
import { 
  verifyTransactionPayment, 
  markPaymentIntentSucceeded, 
  markPaymentIntentFailed 
} from "./hybridPaymentMiddleware";
import { offerLinkService } from "../services/offerLinkService";
import { getFacilitatorUrl } from "../utils/facilitatorHelper";
import { Connection } from "@solana/web3.js";
import { SERVICE_PRICING_MICRO, SERVICE_PRICING_USD, microToUSD } from "../../shared/pricing";
import { getAuthContext, hasValidSession, resolveOrCreateSessionUser, refreshAndValidateAuthContext, AuthContext } from "../services/gptAuthResolver";
import { creditsService } from "../services/creditsService";
import { createWalletClient, http, parseAbi, Hex, createPublicClient } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { x402InteractionTracker } from "../services/x402InteractionTracker";
import { nanoid } from "nanoid";
import { db } from "../db";
import { sql, and, eq, gt, or, isNull } from "drizzle-orm";
import { x402Interactions, x402PaymentIntents } from "@shared/schema";
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

// Solana SPL token mints
const USDC_SOLANA = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDT_SOLANA = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";

// Accepted stablecoins for x402 payments (EVM)
const ACCEPTED_STABLECOINS = [USDC_BASE, USDT_BASE, USDC_ETHEREUM, USDT_ETHEREUM];
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
    const privateKey = process.env.PLATFORM_EOA_PRIVATE_KEY || process.env.CDP_PRIVATE_KEY;
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

    // FIRST-CALL FREE: Check if eligible for free call on cheapest services
    if (!xPayment && FIRST_CALL_FREE_SERVICES.includes(serviceName)) {
      const eligible = await isEligibleForFirstCallFree(ipAddress, userAgent);
      
      if (eligible) {
        console.log(`🎁 First-call FREE granted for ${serviceName} to ${knownAgent.name} (${ipAddress})`);
        
        res.locals.payment = { method: "first-call-free", amount: 0, status: 'complimentary' };
        
        try {
          await handler(req, res);
          
          // Track the free call for future eligibility checks
          await x402InteractionTracker.trackInteraction({
            serviceId: serviceName,
            ipAddress,
            userAgent,
            requestPath: req.originalUrl,
            requestMethod: req.method,
            responseStatus: 200,
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
              knownAgent: knownAgent.name,
              originalPrice: SERVICE_PRICING_USD[serviceName as keyof typeof SERVICE_PRICING_USD]
            }
          });
          
          // Update cache
          const cacheKey = `${ipAddress}:${userAgent?.substring(0, 50) || 'none'}`;
          FIRST_CALL_FREE_CACHE.set(cacheKey, { granted: true, timestamp: Date.now() });
          
          return;
        } catch (handlerError: any) {
          console.error(`❌ First-call-free handler error for ${serviceName}:`, handlerError.message);
          // Continue to 402 on error
        }
      }
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
        return generate402Response(req, res, serviceName, requiredAmount, knownAgent, requestId);
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
            await creditsService.deductCredits({
              userId: keyValidation.userId,
              amount: priceUsd,
              serviceName,
              description: `x402 Service: ${serviceName} ($${priceUsd.toFixed(2)}) via API key`
            });
            
            console.log(`💳 Orchestrator: API key payment for ${serviceName} - $${priceUsd.toFixed(2)} (user: ${keyValidation.userId})`);
            res.locals.payment = { method: "api-key", userId: keyValidation.userId, amount: priceUsd, status: 'paid' };
            
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
      
      return generate402Response(req, res, serviceName, requiredAmount, knownAgent, requestId);
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
    let paymentChain: 'base' | 'ethereum' | 'solana' | null = null;

    // Case 1: Raw EVM transaction hash (0x prefixed, 66 chars)
    // Default to 'base' for backward compat; agents can specify network via JSON payload instead
    if (xPayment.startsWith("0x") && xPayment.length === 66) {
      txHash = xPayment;
      paymentChain = 'base';
      console.log(`🔐 Orchestrator: Raw EVM hash payment detected for ${serviceName}: ${xPayment.substring(0, 10)}...`);
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
        
        // Return machine-readable error for Solana verification failure
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
        
        // Return machine-readable error instead of generic 402
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
            }
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
            console.error(`❌ Orchestrator: EIP-3009 execution failed:`, eip3009Error.message);
            
            // Check for insufficient balance error - return structured refuel response
            const errorMsg = eip3009Error.message?.toLowerCase() || '';
            if (errorMsg.includes('transfer amount exceeds balance') || 
                errorMsg.includes('insufficient balance') ||
                errorMsg.includes('erc20: transfer amount exceeds') ||
                errorMsg.includes('exceeds balance')) {
              
              const priceUsd = SERVICE_PRICING_USD[serviceName as keyof typeof SERVICE_PRICING_USD] || 1.00;
              console.log(`💰 Insufficient balance detected for ${serviceName} - returning refuel response`);
              
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
                offerTrackingId,
                metadata: { 
                  reason: 'insufficient-balance',
                  knownAgent: knownAgent.name,
                  requiredAmount: priceUsd
                }
              });
              
              return res.status(402).json({
                x402Version: 2,
                error: "insufficient_balance",
                hint: "Agent wallet has insufficient USDC to complete payment",
                service: serviceName,
                requiredAmount: requiredAmount,
                requiredAmountUsd: priceUsd,
                acceptedTokens: [
                  { symbol: "USDC", address: USDC_BASE, decimals: 6 },
                  { symbol: "USDT", address: USDT_BASE, decimals: 6 }
                ],
                network: "eip155:8453",
                chainId: 8453,
                fundingAddress: PLATFORM_WALLET,
                retryAfterFunding: true,
                fundingInstructions: {
                  step1: `Send at least $${priceUsd} USDC to your agent wallet`,
                  step2: "Wait for transaction confirmation (typically 2-3 seconds on Base)",
                  step3: "Retry the original request with the same X-PAYMENT header",
                  bridges: [
                    { name: "Base Bridge", url: "https://bridge.base.org" },
                    { name: "Coinbase", url: "https://coinbase.com" }
                  ]
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
                    errorCodes: { "400": "Invalid paymentMethodId or idempotencyKey too short", "409": "Already processed — use new idempotencyKey", "429": "Rate limit exceeded" }
                  }
                },
                requestId
              });
            }
            
            // Other EIP-3009 errors (expired, already used, invalid signature)
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
        } catch (handlerErr: any) {
          await db.update(x402PaymentIntents)
            .set({ status: 'FAILED', lastError: handlerErr.message, updatedAt: new Date() })
            .where(and(eq(x402PaymentIntents.txHash, txHash), eq(x402PaymentIntents.serviceName, serviceName)));
          console.error(`❌ Solana (Dexter) intent marked FAILED for ${serviceName}: ${handlerErr.message}`);
          throw handlerErr;
        }
        return;
      }

      // Solana verification failed
      console.warn(`❌ Orchestrator: Solana (Dexter) payment NOT verified for ${serviceName}: ${solanaResult.error}`);
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
        const evmChain = (paymentChain === 'ethereum' || paymentChain === 'base') ? paymentChain : 'base';
        const verificationResult = await verifyTransactionPayment(
          txHash,
          serviceName,
          requiredAmount,
          evmChain
        );

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
            `On-chain verification failed for transaction ${txHash?.substring(0, 20)}... - payment not confirmed on Ethereum or Base chain`,
            `Verify: (1) Transaction is confirmed on Ethereum or Base, (2) Payment sent to platform wallet 0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91, (3) Amount is at least $${microToUSD(requiredAmount)} USDC`,
            requestId,
            {
              recoverable: true,
              httpStatus: 402,
              expectedFormat: {
                txHash: 'Confirmed Ethereum or Base chain transaction hash (0x + 64 hex chars)',
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
    return generate402Response(req, res, serviceName, requiredAmount, knownAgent, requestId);
  };
}

/**
 * Generate a proper x402 402 response with payment requirements
 * Enhanced with partner CTA for known agents and first-call-free info
 */
function generate402Response(
  req: Request, 
  res: Response, 
  serviceName: string, 
  requiredAmount: number,
  knownAgent: { isKnown: boolean; name: string; partnerOffer: boolean } = { isKnown: false, name: 'unknown', partnerOffer: false },
  requestId?: string
) {
  const priceUsd = microToUSD(requiredAmount);
  const endpoint = req.originalUrl || `/x402/${serviceName}`;
  const baseUrl = getPublicBaseUrl(req);
  const resource = `${baseUrl}${endpoint}`;
  
  // Service descriptions
  const descriptions: Record<string, string> = {
    "first-call": "Golden Path — canonical first payment endpoint. $0.05 USDC on Base or Solana. Start here for x402 integration. Receive onboarding receipt + next-service templates.",
    "ping": "x402 Discovery Ping - verify payment infrastructure",
    "gas-price-oracle": "Real-time gas prices for multiple chains with USD cost estimates",
    "token-metadata": "Token contract metadata including name, symbol, decimals",
    "dex-liquidity": "DEX liquidity analysis across major decentralized exchanges",
    "token-price": "Real-time token price from multiple sources",
    "token-sentiment": "AI-powered sentiment analysis for any token",
    "whale-alerts": "Real-time whale movement alerts for any chain",
    "multi-chain-balance": "Multi-chain wallet balance aggregation",
    "trending-tokens": "Trending tokens across all supported chains",
    "portfolio-tracker": "Comprehensive portfolio tracking and analysis",
    "wallet-risk": "Wallet risk scoring and security analysis",
    "trade-signals": "AI-powered trade signals and recommendations",
    "transaction-builder": "Build and simulate transactions before execution",
    "batch-quote": "Batch token price quotes in single request",
    "approval-manager": "Token approval management and security",
    "payment-processing": "Instant USDC payment processing",
    "contract-scan": "Smart contract security scanning",
    "instant-agent-wallet": "Create CDP-managed agent wallet instantly",
    "agent-create-wallet": "Provision persistent CDP-managed wallet for AI agents ($2.00 USDC)",
    "seamless-chain-bridge": "Cross-chain bridging quotes and execution",
    "property-valuation": "AI-powered real estate property valuation",
    "lease-analysis": "Commercial lease analysis and recommendations",
    "construction-progress": "Construction project progress tracking",
    "fraud-detection": "Real-time transaction fraud detection",
    "credit-risk-score": "Credit risk scoring for DeFi positions",
    "compliance-check": "AML/KYC compliance verification",
    "sentiment-analysis": "Market sentiment analysis for any asset",
    "trading-signal": "Professional trading signals with entry/exit",
    "portfolio-optimization": "AI portfolio optimization recommendations",
    "correlation-matrix": "Asset correlation matrix analysis",
    "risk-metrics": "VaR, Sharpe ratio, and risk metrics",
    "arbitrage-scanner": "Cross-chain arbitrage opportunity detection",
    "polymarket-events": "Trending prediction market events",
    "polymarket-odds": "Current odds for prediction markets",
    "polymarket-search": "Search prediction markets by keyword",
    "prediction-market-odds": "Current odds for any prediction market event",
  };

  // Build base response - x402 V2 compliant with MULTI-CHAIN support
  // Per official Coinbase spec: x402Version is NUMBER (2), not string - matches Bazaar/facilitator/SDKs
  const baseDescription = descriptions[serviceName] || `${serviceName} micropayment service`;
  
  // Solana feePayer: must be the buyer's own address (they pay tx fee + sign).
  // Clients should send X-Solana-Wallet header with their public key.
  const solanaFeePayer = (req.headers['x-solana-wallet'] as string | undefined)?.trim() || null;

  // Multi-chain accepts array: Base/USDC, Base/USDT, Solana/USDC, Solana/USDT
  const acceptsArray = [
    // Base Chain - USDC (primary)
    {
      scheme: "exact",
      network: "eip155:8453",
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
          input: { type: "http" as const, method: "POST" as const, bodyType: "json" as const, body: { query: "example parameter" }, headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' } },
          output: { type: "application/json", format: "json", example: { success: true, result: {}, timestamp: new Date().toISOString() } }
        }
      }
    },
    // Base Chain - USDT
    {
      scheme: "exact",
      network: "eip155:8453",
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
      extra: {
        name: "Tether USD",
        version: "1",
        decimals: 6,
        chainId: 8453,
        chainName: "Base"
      },
      discoverable: false
    },
    // Ethereum L1 - USDC
    {
      scheme: "exact",
      network: "eip155:1",
      networkLegacy: "ethereum",
      x402Network: "eip155:1",
      amount: requiredAmount.toString(),
      maxAmountRequired: requiredAmount.toString(),
      maxAmountRequiredUSD: priceUsd,
      resource: resource,
      description: baseDescription,
      mimeType: "application/json",
      payTo: PLATFORM_WALLET,
      maxTimeoutSeconds: 60,
      asset: USDC_ETHEREUM,
      extra: {
        name: "USD Coin",
        version: "2",
        decimals: 6,
        chainId: 1,
        chainName: "Ethereum"
      },
      discoverable: false
    },
    // Ethereum L1 - USDT
    {
      scheme: "exact",
      network: "eip155:1",
      networkLegacy: "ethereum",
      x402Network: "eip155:1",
      amount: requiredAmount.toString(),
      maxAmountRequired: requiredAmount.toString(),
      maxAmountRequiredUSD: priceUsd,
      resource: resource,
      description: baseDescription,
      mimeType: "application/json",
      payTo: PLATFORM_WALLET,
      maxTimeoutSeconds: 60,
      asset: USDT_ETHEREUM,
      extra: {
        name: "Tether USD",
        version: "1",
        decimals: 6,
        chainId: 1,
        chainName: "Ethereum"
      },
      discoverable: false
    },
    // Solana - USDC
    {
      scheme: "exact",
      network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
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
      network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
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
    }
  ];
  
  const bazaarInput = {
    type: "http" as const,
    method: "POST" as const,
    bodyType: "json" as const,
    body: { query: "example parameter" },
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
  };
  const bazaarOutput = {
    type: "application/json",
    format: "json",
    example: { success: true, result: {}, timestamp: new Date().toISOString() }
  };
  
  const response: any = {
    x402Version: 2,
    error: "X-PAYMENT header is required",
    recommended_next_step: {
      action: "purchase_api_key",
      description: "Get an API key with a card — no crypto wallet required. Works on all 60 services.",
      endpoint: `${baseUrl}/api/m2m/credits/purchase`,
      method: "POST",
      body: { paymentMethodId: "pm_...", amountUsd: 10, idempotencyKey: "replace-with-uuid-v4" },
      expected_time: "~60 seconds from card to working API key",
      usage: "Attach to every request as: X-API-KEY: cr_live_...",
      advanced_alternative: "On-chain USDC payment via accepts[] below (crypto wallet required)"
    },
    accepts: acceptsArray,
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
        partnerOnboard: "https://coinrailz.com/partners",
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
      supportedChains: ["ethereum (eip155:1)", "base (eip155:8453)", "solana (solana:mainnet)"],
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
          solana: SOLANA_PLATFORM_WALLET
        }
      }
    },
    recommendedServices: [
      { id: "gas-price-oracle", name: "Gas Price Oracle", priceUSD: "$0.10", endpoint: "/x402/gas-price-oracle", note: "FIRST CALL FREE for new agents!" },
      { id: "token-metadata", name: "Token Metadata", priceUSD: "$0.10", endpoint: "/x402/token-metadata", note: "FIRST CALL FREE for new agents!" },
      { id: "trade-signals", name: "AI Trade Signals", priceUSD: "$0.75", endpoint: "/x402/trade-signals" },
      { id: "wallet-risk", name: "Wallet Risk Analysis", priceUSD: "$0.50", endpoint: "/x402/wallet-risk" },
      { id: "agent-create-wallet", name: "Agent Wallet Provisioning", priceUSD: "$2.00", endpoint: "/x402/agent-create-wallet" },
    ],
    catalogUrl: `${baseUrl}/x402/catalog`,
    totalServicesAvailable: 38,
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
      priceNormally: "$0.10",
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
        note: "MCP server for Claude Desktop - access all 38 services via tools"
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

  // Golden Path: inject dual-track payment recipe for first-call endpoint
  if (serviceName === 'first-call') {
    response.goldenPath = {
      onboarding: true,
      recommendedForFirstPayment: true,
      priceUSD: "0.05",
      amountMicroUSDC: 50000,
      paymentRecipe: {
        description: "Two payment paths — choose the chain your agent is on. Both lead to the same 200 OK response.",
        evmPath: {
          chain: "Base mainnet",
          chainId: 8453,
          network: "eip155:8453",
          asset: "USDC (0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)",
          amount: "50000 micro-USDC (0.05 USDC, 6 decimals)",
          payTo: PLATFORM_WALLET,
          facilitator: "https://api.cdp.coinbase.com/platform/v2/x402",
          steps: [
            "1. Authorize 50000 micro-USDC transfer via EIP-3009 OR send direct USDC tx on Base (chainId: 8453)",
            "2. Retry POST /x402/first-call with header: X-PAYMENT: <tx_hash_or_eip3009_payload>",
            "3. Receive 200 OK with onboarding receipt, sessionId, and next-service templates"
          ],
          curlExample: `curl -X POST ${baseUrl}/x402/first-call -H 'Content-Type: application/json' -H 'X-PAYMENT: <evm_tx_hash>' -d '{}'`,
          pythonExample: `import httpx\nresp = httpx.post('${baseUrl}/x402/first-call',\n  headers={'X-PAYMENT': tx_hash, 'Content-Type': 'application/json'},\n  json={})\nprint(resp.json())`
        },
        solanaPath: {
          network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
          asset: "USDC (EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v)",
          amount: "50000 micro-USDC (0.05 USDC, 6 decimals)",
          payTo: SOLANA_PLATFORM_WALLET,
          facilitator: "https://x402.dexter.cash",
          scheme: "ExactSvmScheme",
          steps: [
            "1. Include X-Solana-Wallet: <your_pubkey> header with initial request",
            "2. Use Dexter facilitator (x402.dexter.cash) to sign ExactSvmScheme payment of 50000 micro-USDC",
            "3. Retry POST /x402/first-call with header: X-PAYMENT: <solana_payment_payload>",
            "4. Receive 200 OK with onboarding receipt"
          ],
          curlExample: `curl -X POST ${baseUrl}/x402/first-call -H 'Content-Type: application/json' -H 'X-Solana-Wallet: <pubkey>' -H 'X-PAYMENT: <solana_payload>' -d '{}'`,
          pythonExample: `import httpx\nresp = httpx.post('${baseUrl}/x402/first-call',\n  headers={'X-PAYMENT': solana_payload, 'X-Solana-Wallet': pubkey},\n  json={})\nprint(resp.json())`
        }
      }
    };
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
        contact: "partners@coinrailz.com",
        quickOnboard: `${baseUrl}/partners/onboard?agent=${encodeURIComponent(knownAgent.name)}`
      }
    };
    
    console.log(`🤝 Partner CTA injected for ${knownAgent.name}`);
  }

  console.log(`📊 x402 Funnel: challenge-issued for ${serviceName} | IP: ${req.ip} | Agent: ${knownAgent.name} | RequestId: ${requestId || 'none'}`);
  
  res.status(402).json(response);
}
