/**
 * Robinhood Chain Bootstrap Bridge Service
 *
 * Bridges a fixed 0.50 USDC from Base → USDG on Robinhood Chain (chainId 4663)
 * via Across Protocol on behalf of the calling AI agent.
 *
 * Flow:
 *   1. Agent POSTs { recipient: "0x..." } with x402 payment ($0.75 USDC on Base)
 *   2. We verify our Base USDC balance is sufficient (circuit breaker)
 *   3. Approve USDC for SpokePool — exact BRIDGE_AMOUNT only (bounded approval)
 *   4. Fetch Across quote + build-deposit-tx calldata
 *   5. Decode and verify calldata against invariants before broadcast (treasury safety)
 *   6. Execute depositV3 on Base and wait for on-chain receipt confirmation
 *   7. Return confirmed Base deposit tx + Across fill estimate
 *
 * Economics per call:
 *   Revenue:  $0.75 (x402 service fee)
 *   Outflow:  $0.50 (USDC bridged from treasury) + ~$0.03 Across relayer fee + ~$0.001 gas
 *   Margin:   ~$0.22 per call (treasury grows with volume)
 *
 * Safety:
 *   - Bounded approval: exact BRIDGE_AMOUNT per tx (no MAX_UINT256 open door)
 *   - Calldata validation: invariants decoded from raw ABI before any broadcast
 *   - Receipt wait: tx confirmed on Base before returning success to caller
 *   - Circuit breaker: min 1 USDC reserve check before each call
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  isAddress,
  decodeFunctionData,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

const SPOKE_POOL   = "0x09aea4b2242abC8bb4BB78D537A67a245A7bEC64" as const;
const USDC_BASE    = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
const USDG_RH      = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168" as const;
const ZERO_ADDR    = "0x0000000000000000000000000000000000000000" as const;
const RH_CHAIN_ID  = 4663n;
const BRIDGE_AMOUNT = 500_000n; // 0.50 USDC (6 decimals)
const MIN_RESERVE   = 1_000_000n; // 1.00 USDC minimum treasury balance before bridging
const RECEIPT_TIMEOUT_MS = 60_000; // 60s max wait for Base confirmation

/** Minimal Across SpokePool depositV3 ABI — used only for calldata decode + validation */
const DEPOSIT_V3_ABI = [
  {
    name: "depositV3",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "depositor",            type: "address" },
      { name: "recipient",            type: "address" },
      { name: "inputToken",           type: "address" },
      { name: "outputToken",          type: "address" },
      { name: "inputAmount",          type: "uint256" },
      { name: "outputAmount",         type: "uint256" },
      { name: "destinationChainId",   type: "uint256" },
      { name: "exclusiveRelayer",     type: "address" },
      { name: "quoteTimestamp",       type: "uint32"  },
      { name: "fillDeadline",         type: "uint32"  },
      { name: "exclusivityDeadline",  type: "uint32"  },
      { name: "message",              type: "bytes"   },
    ],
    outputs: [],
  },
] as const;

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

/**
 * Validates decoded depositV3 calldata against expected invariants.
 * Throws descriptively if anything is wrong — prevents malformed/tampered calldata from spending treasury funds.
 */
function assertDepositV3Invariants(
  args: Record<string, unknown>,
  expectedRecipient: string,
  expectedDepositor: string,
): void {
  const lower = (v: unknown) => String(v).toLowerCase();

  const checks: [string, boolean, string][] = [
    ["inputToken",         lower(args.inputToken)        === USDC_BASE.toLowerCase(),           `must be USDC on Base (${USDC_BASE}), got ${args.inputToken}`],
    ["outputToken",        lower(args.outputToken)       === USDG_RH.toLowerCase(),             `must be USDG on RH Chain (${USDG_RH}), got ${args.outputToken}`],
    ["inputAmount",        args.inputAmount              === BRIDGE_AMOUNT,                      `must be exactly ${BRIDGE_AMOUNT} (0.50 USDC), got ${args.inputAmount}`],
    ["destinationChainId", args.destinationChainId       === RH_CHAIN_ID,                       `must be 4663, got ${args.destinationChainId}`],
    ["recipient",          lower(args.recipient)         === expectedRecipient.toLowerCase(),    `must match request recipient ${expectedRecipient}, got ${args.recipient}`],
    ["depositor",          lower(args.depositor)         === expectedDepositor.toLowerCase(),    `must be our treasury ${expectedDepositor}, got ${args.depositor}`],
  ];

  for (const [field, ok, detail] of checks) {
    if (!ok) throw new Error(`Calldata validation failed — ${field}: ${detail}`);
  }
}

async function fetchAcrossQuote(
  recipient: string,
  depositor: string,
): Promise<{
  data: `0x${string}`;
  value: bigint;
  outputAmount: bigint;
  estimatedFillTimeSec: number;
}> {
  const qUrl =
    `https://app.across.to/api/suggested-fees` +
    `?inputToken=${USDC_BASE}&outputToken=${USDG_RH}` +
    `&originChainId=8453&destinationChainId=${Number(RH_CHAIN_ID)}` +
    `&amount=${BRIDGE_AMOUNT.toString()}`;

  const qRes  = await fetch(qUrl, { signal: AbortSignal.timeout(10_000) });
  const quote = await qRes.json() as any;
  if (quote.type?.includes("Error")) throw new Error(`Across quote failed: ${JSON.stringify(quote)}`);

  const outputAmount = BigInt(quote.outputAmount);

  const params = new URLSearchParams({
    originChainId:       "8453",
    destinationChainId:  String(RH_CHAIN_ID),
    inputToken:          USDC_BASE,
    outputToken:         USDG_RH,
    inputAmount:         BRIDGE_AMOUNT.toString(),
    outputAmount:        outputAmount.toString(),
    recipient,
    depositor,
    quoteTimestamp:      String(quote.timestamp),
    fillDeadline:        String(quote.fillDeadline),
    exclusivityDeadline: "0",
    exclusiveRelayer:    quote.exclusiveRelayer ?? ZERO_ADDR,
    message:             "0x",
  });

  const txRes  = await fetch(`https://app.across.to/api/build-deposit-tx?${params}`, { signal: AbortSignal.timeout(10_000) });
  const txData = await txRes.json() as any;
  if (txData.type?.includes("Error")) throw new Error(`Across build-tx failed: ${JSON.stringify(txData)}`);

  // ── Calldata validation ──────────────────────────────────────────────────────
  // Decode and verify before we hand this to the signer. If Across API ever
  // returns tampered/unexpected calldata, this throws and we never broadcast.
  const raw = txData.data as `0x${string}`;
  let decoded: ReturnType<typeof decodeFunctionData>;
  try {
    decoded = decodeFunctionData({ abi: DEPOSIT_V3_ABI, data: raw });
  } catch (e: any) {
    throw new Error(`Calldata ABI decode failed — expected depositV3 selector: ${e.message}`);
  }
  if (decoded.functionName !== "depositV3") {
    throw new Error(`Calldata calls ${decoded.functionName} not depositV3 — aborting.`);
  }
  const args = decoded.args as unknown[];
  const argMap = {
    depositor:           args[0],
    recipient:           args[1],
    inputToken:          args[2],
    outputToken:         args[3],
    inputAmount:         args[4],
    outputAmount:        args[5],
    destinationChainId:  args[6],
  };
  assertDepositV3Invariants(argMap, recipient, depositor);
  // ────────────────────────────────────────────────────────────────────────────

  return {
    data:                 raw,
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

  // ── Circuit breaker: check treasury balance ──────────────────────────────────
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

  // ── Bounded approval: exact BRIDGE_AMOUNT only ───────────────────────────────
  // We never grant unlimited approval. Each bridge call approves only what it needs.
  // This caps the blast radius to 0.50 USDC even if the Across API were ever compromised.
  const allowance = await pub.readContract({
    address: USDC_BASE,
    abi: ERC20_MIN_ABI,
    functionName: "allowance",
    args: [account.address, SPOKE_POOL],
  }) as bigint;

  if (allowance < BRIDGE_AMOUNT) {
    const approveTx = await wal.writeContract({
      address: USDC_BASE,
      abi: ERC20_MIN_ABI,
      functionName: "approve",
      args: [SPOKE_POOL, BRIDGE_AMOUNT], // exact amount — not MAX_UINT256
    });
    // Wait for approval to be mined before proceeding
    await pub.waitForTransactionReceipt({ hash: approveTx, timeout: RECEIPT_TIMEOUT_MS });
  }

  // ── Fetch quote + validate calldata before broadcast ─────────────────────────
  const { data, value, outputAmount, estimatedFillTimeSec } = await fetchAcrossQuote(
    recipient,
    account.address,
  );

  // ── Execute deposit and wait for on-chain confirmation ───────────────────────
  const depositHash = await wal.sendTransaction({ to: SPOKE_POOL, data, value });

  const receipt = await pub.waitForTransactionReceipt({
    hash: depositHash,
    timeout: RECEIPT_TIMEOUT_MS,
  });

  if (receipt.status !== "success") {
    throw new Error(
      `Bridge deposit tx ${depositHash} reverted on Base (status: ${receipt.status}). ` +
      `No USDG will be delivered. Service fee was still charged — please contact support.`
    );
  }

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
    note:                "Deposit confirmed on Base. USDG will arrive in the recipient wallet within the estimated fill time via Across relayers. This is a one-way bridge; bridging back requires a separate transaction.",
  };
}
