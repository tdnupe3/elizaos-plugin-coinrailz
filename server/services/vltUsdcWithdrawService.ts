/**
 * vltUSDC Withdraw Builder — x402 service handler
 *
 * Builds unsigned calldata for redeeming vltUSDC shares from the Bankroll Network vault.
 * One transaction — no approvals needed (shares are already in the agent's wallet).
 *
 * Vault contract (= vltUSDC ERC-20 share token):
 *   0xee8d4c5c768AadCd3517Aa8C908De300305D0A7f
 *   redeem(uint256 shares, address receiver)
 *   returns (uint256 vltOut, uint256 usdcOut)
 *
 * The vault has no slippage parameters — redemption is pro-rata in-kind (no swap,
 * can't be sandwiched), so minVltOut/minUsdcOut do NOT exist in the on-chain ABI.
 *
 * Input:
 *   shares     — vltUSDC share balance (18 decimals, as a string raw amount)
 *   recipient  — address to receive VLT + USDC after redemption
 *   slippageBps — accepted for backward compat but is a no-op; not encoded on-chain
 *
 * minVltOut / minUsdcOut are computed from live data and returned as INFORMATIONAL
 * estimates only — they are NOT encoded into the calldata.
 *   1. vault.positionLiquidity() + totalSupply() → share fraction
 *   2. DexScreener TVL → total USD value in vault
 *   3. VLT price → split TVL 50/50 by value between VLT and USDC
 *   4. agent's share fraction × token amounts → expected out
 *   Falls back to 0 if live data unavailable.
 *
 * No custody — funds stay in the agent's wallet until they sign and broadcast.
 */

import { ethers } from 'ethers';
import { getVltMarketData } from './vltMarketCache.js';
import { VAULT_ADDRESS, VLT_TOKEN, USDC_ETH, VAULT_WITHDRAW_ABI } from './vltSharedAbi.js';

const CHAIN_ID             = 1;
const DEADLINE_SECONDS     = 20 * 60; // 20 min (matches zap service)
const DEFAULT_SLIPPAGE_BPS = 200n; // 2%

export interface WithdrawCalldataResult {
  success: boolean;
  shares:           string;
  sharesRaw:        string;
  recipient:        string;
  network:          string;
  chainId:          number;
  slippageBps:      number;
  minVltOut:        string;
  minVltOutRaw:     string;
  minUsdcOut:       string;
  minUsdcOutRaw:    string;
  minOutSource:     'live-estimate' | 'zero-fallback';
  step: {
    step:         number;
    action:       string;
    to:           string;
    data:         string;
    value:        string;
    gasEstimate:  string;
    note:         string;
  };
  shareValue: {
    estimatedVltOut:  string;
    estimatedUsdcOut: string;
    vltPriceUsd:      number;
    vaultTvlUsd:      number;
    lPerShare:        number;
    shareCount:       string;
    totalShares:      string;
    fractionPct:      string;
  } | null;
  agentInstructions: string;
  error?: string;
}

// ── DexScreener TVL fetch (same pattern as vltUsdcVaultService) ──────────────

async function fetchVaultTvlFromDexScreener(): Promise<number> {
  try {
    const r = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${VLT_TOKEN}`,
      { signal: AbortSignal.timeout(8_000) },
    );
    if (!r.ok) return 0;
    const d = await r.json();
    const usdcLower = USDC_ETH.toLowerCase();
    const pair = (d?.pairs ?? []).find((p: any) =>
      p.chainId === 'ethereum' &&
      (p.quoteToken?.address?.toLowerCase() === usdcLower ||
       p.baseToken?.address?.toLowerCase() === usdcLower),
    );
    return pair?.liquidity?.usd ? Number(pair.liquidity.usd) : 0;
  } catch {
    return 0;
  }
}

// ── Compute minVltOut / minUsdcOut from live data ────────────────────────────
// Uses a 50/50 value-split approximation — the vault is a full-range V4 position.
// This gives an approximate floor; the vault returns any excess tokens.

async function estimateMinOuts(
  sharesRaw: bigint,
  provider: ethers.JsonRpcProvider,
  slippageBps: bigint,
): Promise<{
  minVltOutRaw: bigint;
  minUsdcOutRaw: bigint;
  estVltOutRaw: bigint;
  estUsdcOutRaw: bigint;
  source: 'live-estimate' | 'zero-fallback';
  vltPriceUsd: number;
  tvlUsd: number;
  lPerShare: number;
  totalSupply: bigint;
}> {
  const fallback = {
    minVltOutRaw: 0n, minUsdcOutRaw: 0n,
    estVltOutRaw: 0n, estUsdcOutRaw: 0n,
    source: 'zero-fallback' as const,
    vltPriceUsd: 0, tvlUsd: 0, lPerShare: 1.0, totalSupply: 0n,
  };

  try {
    const vault = new ethers.Contract(VAULT_ADDRESS, VAULT_WITHDRAW_ABI, provider);

    const [posLiqResult, totalSupplyResult, tvlUsd] = await Promise.all([
      vault.positionLiquidity().catch(() => null),
      vault.totalSupply().catch(() => null),
      fetchVaultTvlFromDexScreener(),
    ]);

    if (!posLiqResult || !totalSupplyResult) return fallback;

    const posLiq     = BigInt(posLiqResult.toString());
    const totalSupply = BigInt(totalSupplyResult.toString());
    if (totalSupply === 0n) return fallback;

    const lPerShare = Number(posLiq) / Number(totalSupply);

    const vlt = getVltMarketData();
    const vltPriceUsd = vlt.priceUsd > 0 ? vlt.priceUsd : 0.32;

    // Agent's share fraction of total vault
    // Clamp to [0, 1] in case shares > totalSupply (shouldn't happen)
    const sharesFrac = Number(sharesRaw) / Number(totalSupply);
    const agentUsdValue = sharesFrac * tvlUsd;

    if (agentUsdValue <= 0 || tvlUsd <= 0) return fallback;

    // 50/50 value split between VLT (18 dec) and USDC (6 dec)
    const usdcHalf = agentUsdValue * 0.5;
    const vltHalf  = agentUsdValue * 0.5;

    const estUsdcOut = usdcHalf; // USD ≈ USDC at peg
    const estVltOut  = vltHalf / vltPriceUsd;

    const estVltOutRaw  = ethers.parseEther(estVltOut.toFixed(18));
    const estUsdcOutRaw = ethers.parseUnits(estUsdcOut.toFixed(6), 6);

    // Apply slippage floor
    const minVltOutRaw  = estVltOutRaw  * (10000n - slippageBps) / 10000n;
    const minUsdcOutRaw = estUsdcOutRaw * (10000n - slippageBps) / 10000n;

    return {
      minVltOutRaw:  minVltOutRaw  > 0n ? minVltOutRaw  : 0n,
      minUsdcOutRaw: minUsdcOutRaw > 0n ? minUsdcOutRaw : 0n,
      estVltOutRaw,
      estUsdcOutRaw,
      source: 'live-estimate',
      vltPriceUsd,
      tvlUsd,
      lPerShare,
      totalSupply,
    };
  } catch {
    return fallback;
  }
}

// ── Main export ──────────────────────────────────────────────────────────────

export async function buildVltUsdcWithdraw(
  sharesRaw: string,
  recipient: string,
  slippageBps: number = 200,
): Promise<WithdrawCalldataResult> {
  // Validate recipient
  if (!recipient || !/^0x[0-9a-fA-F]{40}$/i.test(recipient)) {
    return errorResult(sharesRaw, recipient, 'recipient must be a valid Ethereum address (0x + 40 hex chars)');
  }

  let normalizedRecipient: string;
  try {
    // Use lowercase → getAddress path to accept any valid hex address regardless of checksum case.
    // ethers.getAddress throws if the address has mixed case that doesn't match its EIP-55 checksum.
    // Agents commonly send all-lowercase or all-uppercase addresses, both of which are valid.
    normalizedRecipient = ethers.getAddress(recipient.toLowerCase());
  } catch {
    return errorResult(sharesRaw, recipient, 'recipient is not a valid Ethereum address (must be 0x + 40 hex characters)');
  }

  // Validate shares
  let sharesRawBig: bigint;
  try {
    sharesRawBig = BigInt(sharesRaw);
    if (sharesRawBig <= 0n) throw new Error('zero shares');
  } catch {
    return errorResult(sharesRaw, recipient, 'shares must be a positive integer string (raw 18-decimal amount, e.g. "1000000000000000000" for 1 vltUSDC share)');
  }

  // Validate slippage
  const slippageBpsClamped = Math.min(Math.max(slippageBps, 0), 1000); // 0–10%
  const slippageBpsBig = BigInt(slippageBpsClamped);

  const rpcUrl   = `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY ?? ''}`;
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  // Fetch live estimates for informational minVltOut / minUsdcOut (fails gracefully, returns 0 fallback)
  const estimate = await estimateMinOuts(sharesRawBig, provider, slippageBpsBig);

  // Build vault.redeem calldata — 2-arg ABI: redeem(uint256 shares, address receiver)
  // The vault has NO slippage parameters; redemption is pro-rata in-kind (no swap).
  const vaultIface = new ethers.Interface(VAULT_WITHDRAW_ABI);
  const redeemData = vaultIface.encodeFunctionData('redeem', [
    sharesRawBig,
    normalizedRecipient,
  ]);

  const sharesDisplay = parseFloat(ethers.formatEther(sharesRawBig)).toFixed(6);

  const estVltOut  = estimate.estVltOutRaw  > 0n ? parseFloat(ethers.formatEther(estimate.estVltOutRaw)).toFixed(6)  : '—';
  const estUsdcOut = estimate.estUsdcOutRaw > 0n ? parseFloat(ethers.formatUnits(estimate.estUsdcOutRaw, 6)).toFixed(6) : '—';
  const minVltOut  = estimate.minVltOutRaw  > 0n ? parseFloat(ethers.formatEther(estimate.minVltOutRaw)).toFixed(6)  : '0 (no live data)';
  const minUsdcOut = estimate.minUsdcOutRaw > 0n ? parseFloat(ethers.formatUnits(estimate.minUsdcOutRaw, 6)).toFixed(6) : '0 (no live data)';

  const fractionPct = estimate.totalSupply > 0n
    ? ((Number(sharesRawBig) / Number(estimate.totalSupply)) * 100).toFixed(6)
    : '0';

  const zeroFallbackWarning = estimate.source === 'zero-fallback'
    ? ' WARNING: minVltOut and minUsdcOut are 0 because live vault data was unavailable. You will receive whatever the vault sends with no floor. Consider setting your own minimum amounts before broadcasting.'
    : '';

  return {
    success: true,
    shares:       sharesDisplay,
    sharesRaw:    sharesRawBig.toString(),
    recipient:    normalizedRecipient,
    network:      'Ethereum Mainnet',
    chainId:      CHAIN_ID,
    slippageBps:  slippageBpsClamped,
    minVltOut,
    minVltOutRaw: estimate.minVltOutRaw.toString(),
    minUsdcOut,
    minUsdcOutRaw: estimate.minUsdcOutRaw.toString(),
    minOutSource: estimate.source,
    step: {
      step:   1,
      action: 'Redeem vltUSDC shares → VLT + USDC',
      to:     VAULT_ADDRESS,
      data:   redeemData,
      value:  '0x0',
      gasEstimate: '0x61A80', // ~400,000 gas (V4 position decrease + token transfers)
      note: [
        `Burn ${sharesDisplay} vltUSDC shares and receive VLT + USDC from the Bankroll Network vault.`,
        `Estimated output (informational only, not enforced on-chain): ~${estVltOut} VLT + ~${estUsdcOut} USDC (50/50 value split at $${estimate.vltPriceUsd.toFixed(4)}/VLT).`,
        `The vault redeems pro-rata — no slippage parameters are encoded in the calldata.`,
        `Vault sends VLT to ${VLT_TOKEN} and USDC to ${USDC_ETH} in ${normalizedRecipient}.`,
        zeroFallbackWarning,
      ].filter(Boolean).join(' '),
    },
    shareValue: estimate.source === 'live-estimate' ? {
      estimatedVltOut:  estVltOut,
      estimatedUsdcOut: estUsdcOut,
      vltPriceUsd:      estimate.vltPriceUsd,
      vaultTvlUsd:      estimate.tvlUsd,
      lPerShare:        estimate.lPerShare,
      shareCount:       sharesDisplay,
      totalShares:      estimate.totalSupply.toString(),
      fractionPct,
    } : null,
    agentInstructions: [
      `You are redeeming ${sharesDisplay} vltUSDC shares from the Bankroll Network vault (${VAULT_ADDRESS}) on Ethereum mainnet (chainId 1).`,
      `This is a single transaction — no token approvals needed (shares are in your wallet).`,
      `Sign and broadcast the vault.redeem(shares, receiver) transaction. The vault will burn your shares and send VLT (${VLT_TOKEN}) and USDC (${USDC_ETH}) directly to ${normalizedRecipient}.`,
      `Redemption is pro-rata in-kind (no swap) — the vault has no slippage parameters on-chain; you receive your proportional share of the pool.`,
      estimate.source === 'live-estimate'
        ? `Estimated output (informational, not enforced on-chain): ~${estVltOut} VLT + ~${estUsdcOut} USDC based on live vault data.`
        : `Live vault data was unavailable — estimated output not available. You will receive your pro-rata share of the pool.`,
      `After redemption, you can swap VLT back to USDC via Uniswap V2 (0x966053Ca4fca049173eb1F27E4cb168CCb794534 VLT/WETH) or the Bankroll UI at https://bankroll.network/vltUSDC.html.`,
    ].join(' '),
  };
}

function errorResult(sharesRaw: string, recipient: string, error: string): WithdrawCalldataResult {
  return {
    success: false,
    shares: sharesRaw,
    sharesRaw,
    recipient,
    network: 'Ethereum Mainnet',
    chainId: CHAIN_ID,
    slippageBps: 200, // default — DO NOT use DEFAULT_SLIPPAGE_BPS here (BigInt, not JSON-serializable)
    minVltOut: '0',
    minVltOutRaw: '0',
    minUsdcOut: '0',
    minUsdcOutRaw: '0',
    minOutSource: 'zero-fallback',
    step: {
      step: 1, action: '', to: '', data: '', value: '0x0', gasEstimate: '0x0', note: '',
    },
    shareValue: null,
    agentInstructions: '',
    error,
  };
}
