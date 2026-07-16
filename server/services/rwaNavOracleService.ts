/**
 * RWA NAV Oracle Service
 *
 * Produces a SYNTHETIC, MARKET-BASED net asset value estimate for real-world
 * asset (RWA) tokens. This is an informational / AI-assisted estimate derived
 * from on-chain supply data and public market prices — it is NOT a verified,
 * audited, or title-backed oracle. Every response includes an explicit
 * synthetic_disclaimer so callers understand the provenance.
 *
 * Output is EIP-712 signed by the Coin Railz platform wallet on Base so that
 * the attestation can be verified on-chain, while the synthetic nature is
 * transparent.
 *
 * Price: $0.50 / call
 */

import OpenAI from "openai";
import { ethers } from "ethers";
import { getCachedData, setCachedData } from "../routes/microservices/common";
import { CoinbaseCDPService } from "./coinbaseCDPService";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });

// EIP-712 domain for Coin Railz RWA attestations on Base (chainId 8453)
const EIP712_DOMAIN = {
  name: "CoinRailzRWAOracle",
  version: "1",
  chainId: 8453,
  // No verifying contract — informational attestation only
  verifyingContract: "0x0000000000000000000000000000000000000000",
} as const;

const EIP712_TYPES = {
  RWANavAttestation: [
    { name: "assetName", type: "string" },
    { name: "assetType", type: "string" },
    { name: "syntheticNavUsdCents", type: "uint256" },
    { name: "confidenceScore", type: "uint8" },
    { name: "timestamp", type: "uint256" },
    { name: "methodology", type: "string" },
  ],
};

export interface RwaNavOracleInput {
  asset_name?: string;
  rwa_address?: string;
  asset_type?: "real-estate" | "private-credit" | "treasury" | "commodity" | "other";
  chain?: string;
  include_signature?: boolean;
  context?: string;
}

export interface RwaNavOracleOutput {
  success: boolean;
  synthetic_disclaimer: string;
  asset: {
    name: string;
    type: string;
    address?: string;
    chain: string;
  };
  nav_estimate: {
    value_usd: number;
    value_per_token_usd: number | null;
    confidence_score: number;
    confidence_label: "low" | "medium" | "high";
    valuation_range: { low: number; high: number };
    methodology: string;
  };
  market_context: {
    comparable_yields: string[];
    risk_factors: string[];
    liquidity_assessment: string;
    market_sentiment: string;
  };
  attestation?: {
    signer: string;
    signature: string;
    domain: typeof EIP712_DOMAIN;
    message: Record<string, unknown>;
    verified_on_chain: boolean;
  };
  service: string;
  generated_at: string;
}

const SYSTEM_PROMPT = `You are an expert RWA (Real World Asset) financial analyst specializing in tokenized asset valuation. 
Produce a SYNTHETIC, MARKET-BASED NAV estimate using publicly available market data and comparable analysis.

CRITICAL: This is informational only — NOT a verified title search, audited financials, or regulatory-compliant appraisal.
Always acknowledge data limitations and use conservative confidence scores unless strong market comparables exist.

Return valid JSON with this exact structure:
{
  "value_usd": number (total estimated NAV in USD, use best estimate from market data),
  "value_per_token_usd": number or null (per-token price if token context provided),
  "confidence_score": number 0-100 (be conservative: 20-40 for opaque assets, 50-70 for tokenized treasuries with public data, 70-85 for exchange-listed RWA tokens),
  "confidence_label": "low" | "medium" | "high",
  "valuation_range": { "low": number, "high": number },
  "methodology": "string explaining approach (e.g. 'market-implied from DEX price', 'comparable yield-adjusted', 'protocol-reported NAV')",
  "comparable_yields": ["array of comparable yield benchmarks with percentages"],
  "risk_factors": ["list of key risk factors"],
  "liquidity_assessment": "string: illiquid / restricted / semi-liquid / liquid",
  "market_sentiment": "string: bullish / neutral / cautious / uncertain"
}`;

export async function rwaNavOracleService(
  input: RwaNavOracleInput
): Promise<RwaNavOracleOutput> {
  const assetName = input.asset_name || input.rwa_address || "Unknown RWA Asset";
  const assetType = input.asset_type || "other";
  const chain = input.chain || "base";
  const includeSignature = input.include_signature !== false;

  const cacheKey = `rwa-nav:${assetName}:${assetType}:${chain}`;
  const cached = getCachedData(cacheKey);
  if (cached) return cached;

  const userPrompt = `Provide a synthetic NAV estimate for the following RWA token:

Asset Name / Identifier: ${assetName}
${input.rwa_address ? `Contract Address: ${input.rwa_address}` : ""}
Asset Type: ${assetType}
Chain: ${chain}
${input.context ? `Additional Context: ${input.context}` : ""}

Use publicly available information about this asset class and any known market data. 
If this is a tokenized treasury (like USDY, USTB, USDM, TBILL), use current T-bill/short-duration bond market rates.
If real estate, use recent comparable sales + cap rate analysis for the relevant market.
If private credit, use comparable private credit fund yields and default-adjusted valuations.
Be explicit about data limitations in your methodology description.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
  });

  const raw = JSON.parse(response.choices[0].message.content || "{}");

  const confidenceScore = Math.min(100, Math.max(0, raw.confidence_score || 30));
  const syntheticNavUsdCents = Math.round((raw.value_usd || 0) * 100);
  const timestamp = Math.floor(Date.now() / 1000);
  const methodology = raw.methodology || "synthetic-market-based";

  let attestation: RwaNavOracleOutput["attestation"] | undefined;

  if (includeSignature) {
    try {
      const wallet = await CoinbaseCDPService.getPlatformSigner("base");
      const message = {
        assetName,
        assetType,
        syntheticNavUsdCents: BigInt(syntheticNavUsdCents),
        confidenceScore,
        timestamp: BigInt(timestamp),
        methodology,
      };
      const signature = await wallet.signTypedData(
        EIP712_DOMAIN,
        EIP712_TYPES,
        message
      );
      attestation = {
        signer: wallet.address,
        signature,
        domain: EIP712_DOMAIN,
        message: {
          assetName,
          assetType,
          syntheticNavUsdCents,
          confidenceScore,
          timestamp,
          methodology,
        },
        verified_on_chain: false,
      };
    } catch (sigErr: any) {
      console.warn("[rwa-nav-oracle] EIP-712 signing failed (non-fatal):", sigErr.message);
    }
  }

  const result: RwaNavOracleOutput = {
    success: true,
    synthetic_disclaimer:
      "INFORMATIONAL ONLY — This NAV estimate is synthetic and market-based. " +
      "It is NOT a verified, audited, title-backed, or regulatory-compliant appraisal. " +
      "Do not use for investment decisions, collateral calculations, or protocol liquidation triggers " +
      "without independent verification. Coin Railz provides no warranty on accuracy.",
    asset: {
      name: assetName,
      type: assetType,
      ...(input.rwa_address ? { address: input.rwa_address } : {}),
      chain,
    },
    nav_estimate: {
      value_usd: raw.value_usd || 0,
      value_per_token_usd: raw.value_per_token_usd ?? null,
      confidence_score: confidenceScore,
      confidence_label:
        confidenceScore >= 65 ? "high" : confidenceScore >= 40 ? "medium" : "low",
      valuation_range: raw.valuation_range || { low: 0, high: 0 },
      methodology,
    },
    market_context: {
      comparable_yields: raw.comparable_yields || [],
      risk_factors: raw.risk_factors || [],
      liquidity_assessment: raw.liquidity_assessment || "unknown",
      market_sentiment: raw.market_sentiment || "neutral",
    },
    ...(attestation ? { attestation } : {}),
    service: "rwa-nav-oracle",
    generated_at: new Date().toISOString(),
  };

  // Cache for 90 seconds — NAV estimates are not real-time
  setCachedData(cacheKey, result, 90_000);
  return result;
}
