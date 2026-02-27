import { createKeyPairSignerFromBytes } from "@solana/kit";
import { registerExactSvmScheme } from "@x402/svm/exact/client";
import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { base58 } from "@scure/base";
import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  TOKEN_PROGRAM_ID,
  getAccount,
} from "@solana/spl-token";

const BASE_URL = "https://coinrailz.com";
const FACILITATOR_URL = "https://x402.dexter.cash";
const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const SELLER_WALLET = new PublicKey("BmUPzSupHJu2kW4cL27dF7Vc2JaZTwXKzFsRuagPDtL8");
const HELIUS_KEY = process.env.HELIUS_API_KEY;
const RPC_URL = HELIUS_KEY
  ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`
  : "https://api.mainnet-beta.solana.com";

async function ensureSellerAtaExists(
  connection: Connection,
  payer: Keypair
): Promise<void> {
  const sellerATA = await getAssociatedTokenAddress(USDC_MINT, SELLER_WALLET, false, TOKEN_PROGRAM_ID);
  console.log(`🏦 Seller USDC ATA: ${sellerATA.toBase58()}`);

  let ataExists = false;
  try {
    await getAccount(connection, sellerATA, "confirmed", TOKEN_PROGRAM_ID);
    ataExists = true;
  } catch (_) {
    ataExists = false;
  }

  if (ataExists) {
    console.log("   ✅ Seller ATA already exists — no initialization needed");
    return;
  }

  console.log("   ⚠️  Seller ATA not found — initializing with 0.001 USDC seed transfer...");
  const buyerATA = await getAssociatedTokenAddress(USDC_MINT, payer.publicKey, false, TOKEN_PROGRAM_ID);

  const tx = new Transaction();
  tx.add(
    createAssociatedTokenAccountInstruction(
      payer.publicKey,
      sellerATA,
      SELLER_WALLET,
      USDC_MINT,
      TOKEN_PROGRAM_ID
    )
  );
  // Send 0.001 USDC (1000 micro-USDC, 6 decimals) as a seed
  tx.add(
    createTransferCheckedInstruction(
      buyerATA,
      USDC_MINT,
      sellerATA,
      payer.publicKey,
      1000n,
      6,
      [],
      TOKEN_PROGRAM_ID
    )
  );

  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.feePayer = payer.publicKey;
  tx.sign(payer);

  const sig = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
    preflightCommitment: "confirmed",
  });
  console.log(`   📤 ATA init tx sent: ${sig.substring(0, 20)}...`);

  await connection.confirmTransaction(sig, "confirmed");
  console.log("   ✅ Seller ATA initialized successfully");
}

async function verifyFeePayerPresent(buyerAddress: string): Promise<void> {
  console.log("🔍 Pre-check: verifying 402 response includes feePayer...");
  const res = await fetch(`${BASE_URL}/x402/ai-inference`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Solana-Wallet": buyerAddress },
    body: JSON.stringify({ prompt: "test" }),
  });
  if (res.status === 402) {
    const body = (await res.json()) as any;
    const solanaEntry = (body.accepts || []).find((a: any) => a.network?.includes("solana"));
    if (!solanaEntry) throw new Error("No Solana entry in 402 accepts");
    const fp = solanaEntry.extra?.feePayer;
    if (!fp) throw new Error(`feePayer missing in Solana extra: ${JSON.stringify(solanaEntry.extra)}`);
    if (fp !== buyerAddress) throw new Error(`feePayer mismatch: got ${fp}`);
    console.log(`   ✅ feePayer confirmed: ${fp}`);
  } else {
    console.log(`   ⚠️  Got ${res.status} (first-call-free may be active) — continuing`);
  }
}

async function runPayment(
  paidFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
  buyerAddress: string,
  label: string,
  path: string,
  body: object
): Promise<boolean> {
  const url = `${BASE_URL}${path}`;
  console.log(`\n${"─".repeat(60)}`);
  console.log(`📡 Payment ${label}`);
  console.log(`   URL:  ${url}`);
  console.log(`   Body: ${JSON.stringify(body)}`);
  console.log(`${"─".repeat(60)}`);

  try {
    const res = await (paidFetch as any)(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Solana-Wallet": buyerAddress },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    console.log(`   HTTP Status: ${res.status}`);

    let parsed: any = null;
    try { parsed = JSON.parse(text); } catch (_) {}

    if (res.status === 200 && parsed?.success) {
      console.log(`   ✅ SUCCESS — payment verified, service delivered`);
      if (parsed?.response) console.log(`   💬 AI: ${String(parsed.response).slice(0, 200)}`);
      if (parsed?.data) console.log(`   📦 Data: ${JSON.stringify(parsed.data).slice(0, 200)}...`);
      return true;
    } else if (res.status === 402) {
      console.log(`   ❌ PAYMENT FAILED — still receiving 402`);
      console.log(`   Detail: ${text.slice(0, 500)}`);
      return false;
    } else {
      console.log(`   ⚠️  HTTP ${res.status}`);
      console.log(`   Body: ${text.slice(0, 500)}`);
      return false;
    }
  } catch (err: any) {
    console.log(`   ❌ EXCEPTION: ${err.message || err}`);
    if (err.cause) console.log(`   Cause: ${String(err.cause).slice(0, 300)}`);
    return false;
  }
}

async function main() {
  const sk = process.env.SOLANA_PRIVATE_KEY;
  if (!sk) throw new Error("SOLANA_PRIVATE_KEY is not set");

  console.log("═".repeat(60));
  console.log("  DEXTER SOLANA x402 TEST — 2 live payments");
  console.log("═".repeat(60));

  // Load key for both @solana/web3.js (ATA init) and @solana/kit (x402 signing)
  const secretBytes = base58.decode(sk);
  const web3Keypair = Keypair.fromSecretKey(secretBytes);
  const kitSigner = await createKeyPairSignerFromBytes(secretBytes);

  console.log(`🔑 Buyer wallet:   ${kitSigner.address}`);
  console.log(`🏦 Seller wallet:  ${SELLER_WALLET.toBase58()}`);
  console.log(`⚡ Facilitator:    ${FACILITATOR_URL}`);
  console.log(`💵 Total cost:     ~$0.10 USDC`);
  console.log(`🖥️  Server:        ${BASE_URL}`);

  // Step 1: Ensure seller ATA exists
  console.log("\n── Step 1: Seller ATA Check ──────────────────────────");
  const connection = new Connection(RPC_URL, "confirmed");
  await ensureSellerAtaExists(connection, web3Keypair);

  // Step 2: Verify 402 response has feePayer
  console.log("\n── Step 2: 402 Response Check ────────────────────────");
  await verifyFeePayerPresent(kitSigner.address);

  // Step 3: Build x402 client and run payments
  console.log("\n── Step 3: Payments ──────────────────────────────────");
  const client = new x402Client();
  registerExactSvmScheme(client, {
    signer: kitSigner,
    networks: ["solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"],
  });
  const paidFetch = wrapFetchWithPayment(fetch, client);

  const results: { label: string; success: boolean }[] = [];

  results.push({
    label: "AI Inference",
    success: await runPayment(
      paidFetch as any,
      kitSigner.address,
      "1/2 — AI Inference  ($0.05)",
      "/x402/ai-inference",
      { prompt: "Reply with exactly: Coin Railz x402 Solana payment confirmed" }
    ),
  });

  results.push({
    label: "Fire Alerts",
    success: await runPayment(
      paidFetch as any,
      kitSigner.address,
      "2/2 — Fire Alerts   ($0.05)",
      "/x402/fire-alerts",
      { west: -118.7, south: 33.7, east: -117.8, north: 34.4, days: 1 }
    ),
  });

  console.log(`\n${"═".repeat(60)}`);
  const passed = results.filter((r) => r.success).length;
  console.log(`  RESULTS: ${passed}/${results.length} payments succeeded`);
  results.forEach((r) => console.log(`    ${r.success ? "✅" : "❌"} ${r.label}`));
  if (passed === results.length) {
    console.log("\n  🎉 Both Solana x402 payments verified on-chain!");
    console.log("  👉 Dexter seller: https://dexter.cash/sellers/BmUPzSupHJu2kW4cL27dF7Vc2JaZTwXKzFsRuagPDtL8");
  } else if (passed > 0) {
    console.log("\n  ⚠️  Partial success — see individual errors above");
  } else {
    console.log("\n  ❌ Both payments failed — see errors above");
  }
  console.log("═".repeat(60));
}

main().catch((err) => {
  console.error("\n❌ Fatal error:", err.message || err);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
