/**
 * Robinhood Chain Bootstrap Bridge Service
 *
 * Bridges a fixed 0.50 USDC from Base → USDG on Robinhood Chain (chainId 4663)
 * via Across Protocol on behalf of the calling AI agent.
 *
 * Flow:
 *   1. Agent POSTs { recipient: "0x..." } with x402 payment ($0.75 USDC on Base)
 *   2. We verify our Base USDC balance is sufficient
 *   3. We call Across depositV3 from our treasury wallet on Base
 *   4. Return Base deposit tx hash + estimated fill time
 *
 * Economics per call:
 *   Revenue:  $0.75 (x402 service fee)
 *   Outflow:  $0.50 (USDC bridged from treasury) + ~$0.03 Across relayer fee + ~$0.001 gas
 *   Margin:   ~$0.22 per call (treasury grows with volume)
 *
 * Treasury requirement: min $1 USDC on Base before each call (circuit breaker).
 */

import { createPublicClient, createWalletClient, http, isAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

const SPOKE_POOL   = "0x09aea4b2242abC8bb4BB78D537A67a245A7bEC64" as const;
const USDC_BASE    = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
const USDG_RH      = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168" as const;
const ZERO_ADDR    = "0x0000000000000000000000000000000000000000" as const;
const RH_CHAIN_ID  = 4663;
const BRIDGE_AMOUNT = 500_000n; // 0.50 USDC (6 decimals)
const MIN_RESERVE   = 1_000_000n; // 1.00 USDC minimum treasury balance before bridging

const ERC20_MIN_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "o", type: "address" }, { name: "s", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "s", type: "address" }, { name: "a", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

function getClients() {
  const rawKey = process.env.EVM_PRIVATE_KEY ?? "";
  if (!rawKey) throw new Error("EVM_PRIVATE_KEY not configured");
  const k = (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as `0x${string}`;
  const account = privateKeyToAccount(k);
  const pub = createPublicClient({ chain: base, transport: http() });
  const wal = createWalletClient({ account, chain: base, transport: http() });
  return { account, pub, wal };
}

async function fetchAcrossQuote(recipient: string): Promise<{
  data: `0x${string}`;
  value: bigint;
  outputAmount: bigint;
  estimatedFillTimeSec: number;
}> {
  const qUrl =
    `https://app.across.to/api/suggested-fees` +
    `?inputToken=${USDC_BASE}&outputToken=${USDG_RH}` +
    `&originChainId=8453&destinationChainId=${RH_CHAIN_ID}` +
    `&amount=${BRIDGE_AMOUNT.toString()}`;

  const qRes  = await fetch(qUrl, { signal: AbortSignal.timeout(10_000) });
  const quote = await qRes.json() as any;
  if (quote.type?.includes("Error")) throw new Error(`Across quote failed: ${JSON.stringify(quote)}`);

  const outputAmount = BigInt(quote.outputAmount);

  const { account } = getClients();
  const params = new URLSearchParams({
    originChainId:       "8453",
    destinationChainId:  String(RH_CHAIN_ID),
    inputToken:          USDC_BASE,
    outputToken:         USDG_RH,
    inputAmount:         BRIDGE_AMOUNT.toString(),
    outputAmount:        outputAmount.toString(),
    recipient,
    depositor:           account.address,
    quoteTimestamp:      String(quote.timestamp),
    fillDeadline:        String(quote.fillDeadline),
    exclusivityDeadline: "0",
    exclusiveRelayer:    quote.exclusiveRelayer ?? ZERO_ADDR,
    message:             "0x",
  });

  const txRes  = await fetch(`https://app.across.to/api/build-deposit-tx?${params}`, { signal: AbortSignal.timeout(10_000) });
  const txData = await txRes.json() as any;
  if (txData.type?.includes("Error")) throw new Error(`Across build-tx failed: ${JSON.stringify(txData)}`);

  return {
    data:                 txData.data as `0x${string}`,
    value:                BigInt(txData.value ?? "0"),
    outputAmount,
    estimatedFillTimeSec: Number(quote.estimatedFillTimeSec ?? 30),
  };
}

export async function rhBridgeService(body: { recipient?: string; note?: string }): Promise<{
  success:             boolean;
  depositTx:           string;
  recipient:           string;
  amountBridgedUSDC:   string;
  estimatedUSDGOutput: string;
  estimatedFillTimeSec:number;
  estimatedFillAt:     string;
  originChain:         string;
  destinationChain:    string;
  baseScan:            string;
  rhScan:              string;
  note:                string;
}> {
  const { recipient } = body;

  if (!recipient || typeof recipient !== "string") {
    throw new Error('Provide "recipient": a valid 0x wallet address on Robinhood Chain (chainId 4663).');
  }
  if (!isAddress(recipient)) {
    throw new Error(`Invalid recipient address: "${recipient}". Must be a checksummed 0x EVM address.`);
  }

  const { account, pub, wal } = getClients();

  const usdcBalance = await pub.readContract({
    address: USDC_BASE,
    abi: ERC20_MIN_ABI,
    functionName: "balanceOf",
    args: [account.address],
  }) as bigint;

  if (usdcBalance < BRIDGE_AMOUNT + MIN_RESERVE) {
    throw new Error(
      `Bridge service temporarily unavailable: treasury USDC balance (${Number(usdcBalance) / 1e6} USDC) ` +
      `below minimum required (${Number(BRIDGE_AMOUNT + MIN_RESERVE) / 1e6} USDC). Try again later.`
    );
  }

  const allowance = await pub.readContract({
    address: USDC_BASE,
    abi: ERC20_MIN_ABI,
    functionName: "allowance",
    args: [account.address, SPOKE_POOL],
  }) as bigint;

  if (allowance < BRIDGE_AMOUNT) {
    const MAX = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
    await wal.writeContract({
      address: USDC_BASE,
      abi: ERC20_MIN_ABI,
      functionName: "approve",
      args: [SPOKE_POOL, MAX],
    });
  }

  const { data, value, outputAmount, estimatedFillTimeSec } = await fetchAcrossQuote(recipient);

  const depositHash = await wal.sendTransaction({
    to:    SPOKE_POOL,
    data,
    value,
  });

  const fillAt = new Date(Date.now() + estimatedFillTimeSec * 1000).toISOString();

  return {
    success:             true,
    depositTx:           depositHash,
    recipient,
    amountBridgedUSDC:   `${Number(BRIDGE_AMOUNT) / 1e6} USDC`,
    estimatedUSDGOutput: `${Number(outputAmount) / 1e6} USDG`,
    estimatedFillTimeSec,
    estimatedFillAt:     fillAt,
    originChain:         "Base (chainId 8453)",
    destinationChain:    "Robinhood Chain (chainId 4663)",
    baseScan:            `https://basescan.org/tx/${depositHash}`,
    rhScan:              `https://robinhoodchain.blockscout.com/address/${recipient}`,
    note:                "Funds bridge via Across Protocol. USDG will arrive in the recipient wallet within the estimated fill time. This is a one-way bridge; bridging back requires a separate transaction.",
  };
}
