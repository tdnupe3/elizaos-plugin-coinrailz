/**
 * b20Data.ts — B20 Native Token Standard service logic for Base mainnet
 *
 * Base's "Beryl" hardfork (July 8, 2026) activated the B20 precompile — a Rust
 * superset of ERC-20 adding freeze/seize/blocklist/allowlist/role-based access
 * and transfer memos. Fully ERC-20 backward compatible.
 *
 * All three services use Base RPC as the authoritative source for compliance state.
 * No centralized fallbacks for freeze/blocklist decisions — on-chain truth only.
 *
 * Graceful degradation: if B20 extension methods are unavailable (e.g. the token
 * is a plain ERC-20, not a B20 token), returns structured { b20_compatible: false }
 * rather than an error.
 *
 * Feature flag: B20_ENABLED=false disables all three services (default: enabled).
 */

import { ethers } from "ethers";

const B20_ENABLED = process.env.B20_ENABLED !== "false";

const BASE_RPC =
  process.env.ALCHEMY_API_KEY
    ? `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
    : "https://mainnet.base.org";

const BASE_CHAIN_ID = 8453;

let _provider: ethers.JsonRpcProvider | null = null;
function getBaseProvider(): ethers.JsonRpcProvider {
  if (!_provider) {
    _provider = new ethers.JsonRpcProvider(BASE_RPC, BASE_CHAIN_ID);
  }
  return _provider;
}

const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
];

const B20_EXTENSION_ABI = [
  "function isFrozen(address account) view returns (bool)",
  "function isBlocklisted(address account) view returns (bool)",
  "function isAllowlisted(address account) view returns (bool)",
  "function transferMemoRequired() view returns (bool)",
  "function complianceMode() view returns (string)",
  "function frozenUntil(address account) view returns (uint256)",
];

const B20_FULL_ABI = [...ERC20_ABI, ...B20_EXTENSION_ABI];

const TOKEN_CACHE = new Map<string, { data: any; ts: number }>();
const CACHE_TTL_MS = 2 * 60 * 1000;

function isValidEthAddress(addr: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(addr);
}

function cachedGet(key: string): any | null {
  const hit = TOKEN_CACHE.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > CACHE_TTL_MS) {
    TOKEN_CACHE.delete(key);
    return null;
  }
  return hit.data;
}

function cachedSet(key: string, data: any): void {
  TOKEN_CACHE.set(key, { data, ts: Date.now() });
}

async function tryCall<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

export type B20TokenInfoResult = {
  token_address: string;
  chain: "base";
  chain_id: 8453;
  b20_compatible: boolean;
  erc20: {
    name: string | null;
    symbol: string | null;
    decimals: number | null;
    total_supply: string | null;
  };
  compliance?: {
    compliance_mode: string | null;
    transfer_memo_required: boolean | null;
    precompile_status: "active" | "maturing";
  };
  note?: string;
};

export async function b20TokenInfoService(
  tokenAddress: string
): Promise<B20TokenInfoResult> {
  if (!B20_ENABLED) {
    return {
      token_address: tokenAddress,
      chain: "base",
      chain_id: 8453,
      b20_compatible: false,
      erc20: { name: null, symbol: null, decimals: null, total_supply: null },
      note: "B20_DISABLED — set B20_ENABLED=true to activate",
    };
  }

  if (!isValidEthAddress(tokenAddress)) {
    throw new Error("tokenAddress must be a valid Ethereum address (0x...)");
  }

  const cacheKey = `b20-info-${tokenAddress.toLowerCase()}`;
  const cached = cachedGet(cacheKey);
  if (cached) return cached;

  const provider = getBaseProvider();
  const erc20 = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
  const ext = new ethers.Contract(tokenAddress, B20_EXTENSION_ABI, provider);

  const [name, symbol, decimals, totalSupply] = await Promise.all([
    tryCall(() => erc20.name()),
    tryCall(() => erc20.symbol()),
    tryCall(() => erc20.decimals()),
    tryCall(() => erc20.totalSupply()),
  ]);

  const [complianceMode, transferMemoRequired] = await Promise.all([
    tryCall(() => ext.complianceMode()),
    tryCall(() => ext.transferMemoRequired()),
  ]);

  const b20Compatible = complianceMode !== null || transferMemoRequired !== null;

  const result: B20TokenInfoResult = {
    token_address: tokenAddress,
    chain: "base",
    chain_id: 8453,
    b20_compatible: b20Compatible,
    erc20: {
      name: name ?? null,
      symbol: symbol ?? null,
      decimals: decimals !== null ? Number(decimals) : null,
      total_supply: totalSupply !== null ? ethers.formatUnits(totalSupply, decimals ?? 18) : null,
    },
    ...(b20Compatible && {
      compliance: {
        compliance_mode: complianceMode ?? null,
        transfer_memo_required: transferMemoRequired ?? null,
        precompile_status: "active",
      },
    }),
    ...(!b20Compatible && {
      note:
        "Token is ERC-20 compatible but does not expose B20 compliance methods. " +
        "It may be a plain ERC-20 or a B20 token type that omits optional extension methods.",
    }),
  };

  cachedSet(cacheKey, result);
  return result;
}

export type B20TransferCheckResult = {
  token_address: string;
  from: string;
  to: string;
  amount: string;
  chain: "base";
  b20_compatible: boolean;
  will_succeed: boolean | null;
  blockers: string[];
  warnings: string[];
  compliance_checks: {
    from_frozen: boolean | null;
    to_frozen: boolean | null;
    from_blocklisted: boolean | null;
    to_blocklisted: boolean | null;
    from_allowlisted: boolean | null;
    to_allowlisted: boolean | null;
    memo_required: boolean | null;
  };
  note?: string;
};

export async function b20TransferCheckService(
  tokenAddress: string,
  from: string,
  to: string,
  amount: string
): Promise<B20TransferCheckResult> {
  if (!B20_ENABLED) {
    throw new Error("B20_DISABLED — set B20_ENABLED=true to activate");
  }

  if (!isValidEthAddress(tokenAddress)) throw new Error("tokenAddress must be a valid 0x address");
  if (!isValidEthAddress(from)) throw new Error("from must be a valid 0x address");
  if (!isValidEthAddress(to)) throw new Error("to must be a valid 0x address");

  const provider = getBaseProvider();
  const ext = new ethers.Contract(tokenAddress, B20_EXTENSION_ABI, provider);

  const [
    fromFrozen,
    toFrozen,
    fromBlocklisted,
    toBlocklisted,
    fromAllowlisted,
    toAllowlisted,
    memoRequired,
  ] = await Promise.all([
    tryCall(() => ext.isFrozen(from)),
    tryCall(() => ext.isFrozen(to)),
    tryCall(() => ext.isBlocklisted(from)),
    tryCall(() => ext.isBlocklisted(to)),
    tryCall(() => ext.isAllowlisted(from)),
    tryCall(() => ext.isAllowlisted(to)),
    tryCall(() => ext.transferMemoRequired()),
  ]);

  const isB20 =
    fromFrozen !== null ||
    toFrozen !== null ||
    fromBlocklisted !== null ||
    toBlocklisted !== null ||
    memoRequired !== null;

  const blockers: string[] = [];
  const warnings: string[] = [];

  if (fromFrozen === true) blockers.push("SENDER_FROZEN: from address is frozen and cannot send");
  if (toFrozen === true) blockers.push("RECIPIENT_FROZEN: to address is frozen and cannot receive");
  if (fromBlocklisted === true) blockers.push("SENDER_BLOCKLISTED: from address is on the issuer blocklist");
  if (toBlocklisted === true) blockers.push("RECIPIENT_BLOCKLISTED: to address is on the issuer blocklist");
  if (fromAllowlisted === false && fromAllowlisted !== null) {
    blockers.push("SENDER_NOT_ALLOWLISTED: allowlist is enforced and from is not allowlisted");
  }
  if (toAllowlisted === false && toAllowlisted !== null) {
    blockers.push("RECIPIENT_NOT_ALLOWLISTED: allowlist is enforced and to is not allowlisted");
  }
  if (memoRequired === true) {
    warnings.push("MEMO_REQUIRED: this token requires a transfer memo — ensure your transaction includes memo data");
  }

  const willSucceed = isB20 ? blockers.length === 0 : null;

  return {
    token_address: tokenAddress,
    from,
    to,
    amount,
    chain: "base",
    b20_compatible: isB20,
    will_succeed: willSucceed,
    blockers,
    warnings,
    compliance_checks: {
      from_frozen: fromFrozen ?? null,
      to_frozen: toFrozen ?? null,
      from_blocklisted: fromBlocklisted ?? null,
      to_blocklisted: toBlocklisted ?? null,
      from_allowlisted: fromAllowlisted ?? null,
      to_allowlisted: toAllowlisted ?? null,
      memo_required: memoRequired ?? null,
    },
    ...(!isB20 && {
      note:
        "Token does not expose B20 compliance methods. Transfer simulation is " +
        "not possible — use standard ERC-20 transfer rules.",
    }),
  };
}

export type B20ComplianceScanResult = {
  address: string;
  chain: "base";
  scanned_tokens: number;
  b20_tokens_found: number;
  scan_results: Array<{
    token_address: string;
    symbol: string | null;
    b20_compatible: boolean;
    frozen: boolean | null;
    blocklisted: boolean | null;
    allowlisted: boolean | null;
    frozen_until: string | null;
    risk_level: "clear" | "restricted" | "unknown";
  }>;
  overall_risk: "clear" | "restricted" | "mixed" | "unknown";
  note?: string;
};

const KNOWN_B20_ISSUERS: string[] = [
  ...(process.env.B20_ISSUER_ADDRESSES
    ? process.env.B20_ISSUER_ADDRESSES.split(",").map((a) => a.trim())
    : []),
];

export async function b20ComplianceScanService(
  walletAddress: string,
  additionalTokens: string[] = []
): Promise<B20ComplianceScanResult> {
  if (!B20_ENABLED) {
    throw new Error("B20_DISABLED — set B20_ENABLED=true to activate");
  }

  if (!isValidEthAddress(walletAddress)) {
    throw new Error("address must be a valid Ethereum address (0x...)");
  }

  const tokensToScan = [
    ...new Set(
      [...KNOWN_B20_ISSUERS, ...additionalTokens]
        .map((a) => a.toLowerCase())
        .filter((a) => isValidEthAddress(a))
    ),
  ].slice(0, 20);

  if (tokensToScan.length === 0) {
    return {
      address: walletAddress,
      chain: "base",
      scanned_tokens: 0,
      b20_tokens_found: 0,
      scan_results: [],
      overall_risk: "unknown",
      note:
        "No B20 token addresses provided and B20_ISSUER_ADDRESSES env var is not set. " +
        "Pass token addresses in the tokens[] request field to scan specific contracts. " +
        "The B20 ecosystem is brand new (launched July 8 2026) — issuer registry is forming.",
    };
  }

  const provider = getBaseProvider();

  const scanResults = await Promise.all(
    tokensToScan.map(async (tokenAddr) => {
      const erc20 = new ethers.Contract(tokenAddr, ERC20_ABI, provider);
      const ext = new ethers.Contract(tokenAddr, B20_EXTENSION_ABI, provider);

      const [symbol, frozen, blocklisted, allowlisted, frozenUntilRaw] =
        await Promise.all([
          tryCall(() => erc20.symbol()),
          tryCall(() => ext.isFrozen(walletAddress)),
          tryCall(() => ext.isBlocklisted(walletAddress)),
          tryCall(() => ext.isAllowlisted(walletAddress)),
          tryCall(() => ext.frozenUntil(walletAddress)),
        ]);

      const isB20 = frozen !== null || blocklisted !== null || allowlisted !== null;

      let riskLevel: "clear" | "restricted" | "unknown" = "unknown";
      if (isB20) {
        const hasRestriction = frozen === true || blocklisted === true || allowlisted === false;
        riskLevel = hasRestriction ? "restricted" : "clear";
      }

      const frozenUntilTs =
        frozenUntilRaw !== null && BigInt(frozenUntilRaw) > 0n
          ? new Date(Number(BigInt(frozenUntilRaw)) * 1000).toISOString()
          : null;

      return {
        token_address: tokenAddr,
        symbol: symbol ?? null,
        b20_compatible: isB20,
        frozen: frozen ?? null,
        blocklisted: blocklisted ?? null,
        allowlisted: allowlisted ?? null,
        frozen_until: frozenUntilTs,
        risk_level: riskLevel,
      };
    })
  );

  const b20Found = scanResults.filter((r) => r.b20_compatible).length;
  const restricted = scanResults.filter((r) => r.risk_level === "restricted").length;
  const clear = scanResults.filter((r) => r.risk_level === "clear").length;
  const unknown = scanResults.filter((r) => r.risk_level === "unknown").length;

  let overallRisk: "clear" | "restricted" | "mixed" | "unknown" = "unknown";
  if (b20Found === 0 || unknown === scanResults.length) {
    overallRisk = "unknown";
  } else if (restricted > 0 && clear > 0) {
    overallRisk = "mixed";
  } else if (restricted > 0) {
    overallRisk = "restricted";
  } else if (clear > 0) {
    overallRisk = "clear";
  }

  return {
    address: walletAddress,
    chain: "base",
    scanned_tokens: tokensToScan.length,
    b20_tokens_found: b20Found,
    scan_results: scanResults,
    overall_risk: overallRisk,
  };
}
