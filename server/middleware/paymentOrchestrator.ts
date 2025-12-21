import { Request, Response, NextFunction } from "express";
import { 
  verifyTransactionPayment, 
  markPaymentIntentSucceeded, 
  markPaymentIntentFailed 
} from "./hybridPaymentMiddleware";
import { offerLinkService } from "../services/offerLinkService";
import { getFacilitatorUrl } from "../utils/facilitatorHelper";
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
import { x402Interactions } from "@shared/schema";
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

// Platform wallet to receive payments
const PLATFORM_WALLET = process.env.PLATFORM_WALLET_ADDRESS || "0xa4bBE37f9A6Ae2dc36a607B91eB148C0ae163C91";

// Stablecoin contract addresses on Base mainnet
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
const USDT_BASE = "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2" as const; // Bridged USDT on Base

// Accepted stablecoins for x402 payments
const ACCEPTED_STABLECOINS = [USDC_BASE, USDT_BASE];

// EIP-3009 ABI for USDC transferWithAuthorization
const EIP3009_ABI = parseAbi([
  "function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s) external"
]);

// Initialize platform wallet client for EIP-3009 execution
let platformWalletClient: ReturnType<typeof createWalletClient> | null = null;
let platformPublicClient: ReturnType<typeof createPublicClient> | null = null;

function getPlatformWalletClient() {
  if (!platformWalletClient) {
    const privateKey = process.env.XMTP_EOA_PRIVATE_KEY || process.env.CDP_PRIVATE_KEY;
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

    const xPayment = req.headers["x-payment"] as string | undefined;

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
        // GPT session resolution failed - return 402 (no silent fall-through)
        console.error(`⚠️ Orchestrator: GPT session resolution failed for ${serviceName}: ${gptErr.message}`);
        logGptAuthPath('resolve-failed', { error: gptErr.message, serviceName });
        return generate402Response(req, res, serviceName, requiredAmount, knownAgent, requestId);
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

    let txHash: string | null = null;

    // Case 1: Raw transaction hash (what agents actually send)
    if (xPayment.startsWith("0x") && xPayment.length === 66) {
      txHash = xPayment;
      console.log(`🔐 Orchestrator: Raw 0x hash payment detected for ${serviceName}: ${xPayment.substring(0, 10)}...`);
    } 
    // Case 2: Base64-encoded payload (JSON or CBOR) with txHash
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
          responseStatus: 402,
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
        
        return generate402Response(req, res, serviceName, requiredAmount, knownAgent, requestId);
      }
      
      const decoded = decodeResult.data;
      console.log(`🔐 Orchestrator: Decoded ${decodeResult.format.toUpperCase()} payment payload for ${serviceName}:`, JSON.stringify(decoded, null, 2).substring(0, 500));
        
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
              return generate402Response(req, res, serviceName, requiredAmount, knownAgent, requestId);
            }
            
            const auth = payloadObj.authorization;
            const sig = payloadObj.signature as string;
            
            // Parse v, r, s from the signature (65 bytes: r=32, s=32, v=1)
            const sigHex = sig.startsWith("0x") ? sig.slice(2) : sig;
            
            // Validate signature length
            if (sigHex.length !== 130) {
              console.error(`❌ Invalid signature length: ${sigHex.length}, expected 130`);
              return generate402Response(req, res, serviceName, requiredAmount, knownAgent, requestId);
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
                    description: "Use prepaid credits with an API key (no blockchain required)",
                    howToGet: "Purchase credits at https://coinrailz.com/credits",
                    usage: "Include X-API-KEY header instead of X-PAYMENT"
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
        
        if (txHash) {
          console.log(`🔐 Orchestrator: Extracted/executed txHash for ${serviceName}: ${txHash.substring(0, 10)}...`);
        } else {
          console.log(`🔐 Orchestrator: No txHash found in payload for ${serviceName}, payload keys: ${Object.keys(payloadObj).join(', ')}`);
          
          // FUNNEL TRACKING: Payment header parse failure - no txHash found
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
          
          return generate402Response(req, res, serviceName, requiredAmount, knownAgent, requestId);
        }
    }

    // If we have a transaction hash, verify it on-chain
    if (txHash) {
      try {
        const verified = await verifyTransactionPayment(
          txHash,
          serviceName,
          requiredAmount
        );

        if (verified) {
          const priceUsd = SERVICE_PRICING_USD[serviceName as keyof typeof SERVICE_PRICING_USD] || 1.00;
          console.log(`✅ Orchestrator: Payment verified for ${serviceName} ($${priceUsd}), executing handler directly`);
          res.locals.payment = { method: "raw-hash", txHash, verified: true, amount: priceUsd, status: 'paid' };
          
          try {
            await handler(req, res);
            await markPaymentIntentSucceeded(txHash, serviceName);
            
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
              metadata: { 
                txHash: txHash.substring(0, 20),
                knownAgent: knownAgent.name,
                verificationMethod: 'on-chain'
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
          
          return generate402Response(req, res, serviceName, requiredAmount, knownAgent, requestId);
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
          responseStatus: 402,
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
        
        return generate402Response(req, res, serviceName, requiredAmount, knownAgent, requestId);
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

  // Build base response - x402 V2 compliant
  // Per official Coinbase spec: x402Version is NUMBER (2), not string - matches Bazaar/facilitator/SDKs
  const response: any = {
    x402Version: 2,
    error: "X-PAYMENT header is required",
    accepts: [{
      scheme: "exact",
      network: "base", // Legacy format for x402-fetch v0.7.3 compatibility
      x402Network: "eip155:8453", // V2 CAIP-2 format for spec compliance
      maxAmountRequired: requiredAmount.toString(),
      maxAmountRequiredUSD: priceUsd,
      resource: resource,
      description: descriptions[serviceName] || `${serviceName} micropayment service`,
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
      // OFFICIAL BAZAAR EXTENSION FORMAT - spec-compliant for facilitator indexing
      // Using @x402/extensions/bazaar v2.0.0 DiscoveryInfo structure
      // CRITICAL: Use canonical method (POST for most x402 services) NOT req.method
      // Discovery crawlers probe POST services with GET - we must still advertise POST
      extensions: {
        bazaar: {
          input: {
            type: "http" as const,
            method: "POST" as const,
            bodyType: "json" as const,
            body: { query: "example parameter" },
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
          },
          output: {
            type: "application/json",
            format: "json",
            example: { success: true, result: {}, timestamp: new Date().toISOString() }
          }
        }
      }
    }],
    facilitatorUrl: getFacilitatorUrl(),
    paymentInstructions: {
      step1: "Obtain USDC on Base chain",
      step2: "Sign EIP-3009 authorization for the exact amount",
      step3: "Include Base64-encoded authorization in X-PAYMENT header",
      step4: "Retry the request with X-PAYMENT header",
      alternativeStep3: "Or include raw transaction hash (0x...) in X-PAYMENT header after sending USDC",
      supportedMethods: ["eip3009-authorization", "raw-transaction-hash", "api-key"]
    },
    alternativePaymentMethods: {
      apiKey: {
        description: "Use prepaid credits with an API key (EASIEST - no blockchain required)",
        howToGet: "Purchase credits at https://coinrailz.com/credits with Stripe (credit card) or USDC",
        usage: "Include X-API-KEY header or Authorization: Bearer <api-key> header",
        benefits: ["No blockchain knowledge required", "Instant setup with credit card", "Single API key for all 38 services", "50-70% higher conversion than manual USDC"],
        getStarted: `${baseUrl}/credits`,
        example: `curl -X GET "${resource}" -H "X-API-KEY: your-api-key-here"`
      },
      rawTransaction: {
        description: "Send USDC directly to platform wallet, include tx hash in X-PAYMENT header",
        usage: "X-PAYMENT: 0x... (raw transaction hash)",
        platformWallet: PLATFORM_WALLET
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
