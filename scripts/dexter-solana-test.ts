import { createKeyPairSignerFromBytes } from "@solana/kit";
import { registerExactSvmScheme } from "@x402/svm/exact/client";
import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { base58 } from "@scure/base";

// Target localhost so the updated paymentOrchestrator code runs immediately.
// Dexter verification is wallet-based (USDC to BmUPzSup...), not URL-based.
const BASE_URL = "http://localhost:5000";
const FACILITATOR_URL = "https://x402.dexter.cash";

async function verifyFeePayerPresent(buyerAddress: string): Promise<void> {
  console.log("🔍 Pre-check: verifying 402 response includes feePayer...");
  const res = await fetch(`${BASE_URL}/x402/ai-inference`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Solana-Wallet": buyerAddress,
    },
    body: JSON.stringify({ prompt: "test" }),
  });
  if (res.status === 402) {
    const body = await res.json() as any;
    const solanaEntry = (body.accepts || []).find((a: any) =>
      a.network?.includes("solana")
    );
    if (!solanaEntry) {
      throw new Error("No Solana entry in 402 accepts array");
    }
    const fp = solanaEntry.extra?.feePayer;
    if (!fp) {
      throw new Error(`feePayer missing in Solana extra. Got: ${JSON.stringify(solanaEntry.extra)}`);
    }
    if (fp !== buyerAddress) {
      throw new Error(`feePayer mismatch: expected ${buyerAddress}, got ${fp}`);
    }
    console.log(`   ✅ feePayer confirmed: ${fp}`);
  } else {
    console.log(`   ⚠️  Expected 402, got ${res.status} — first-call-free may be active`);
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
      headers: {
        "Content-Type": "application/json",
        "X-Solana-Wallet": buyerAddress,
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    console.log(`   HTTP Status: ${res.status}`);

    let parsed: any = null;
    try { parsed = JSON.parse(text); } catch (_) {}

    if (res.status === 200 && parsed?.success) {
      console.log(`   ✅ SUCCESS — payment verified, service delivered`);
      if (parsed?.response) {
        console.log(`   💬 AI response: ${String(parsed.response).slice(0, 200)}`);
      }
      if (parsed?.data) {
        const preview = JSON.stringify(parsed.data).slice(0, 200);
        console.log(`   📦 Data preview: ${preview}...`);
      }
      return true;
    } else if (res.status === 402) {
      console.log(`   ❌ PAYMENT FAILED — still receiving 402 after payment attempt`);
      console.log(`   Detail: ${text.slice(0, 500)}`);
      return false;
    } else {
      console.log(`   ⚠️  Unexpected HTTP ${res.status}`);
      console.log(`   Body: ${text.slice(0, 500)}`);
      return false;
    }
  } catch (err: any) {
    console.log(`   ❌ EXCEPTION: ${err.message || err}`);
    if (err.cause) console.log(`   Cause: ${String(err.cause).slice(0, 300)}`);
    if (err.stack) console.log(`   Stack: ${err.stack.split('\n').slice(0,4).join('\n')}`);
    return false;
  }
}

async function main() {
  const sk = process.env.SOLANA_PRIVATE_KEY;
  if (!sk) throw new Error("SOLANA_PRIVATE_KEY is not set");

  console.log("═".repeat(60));
  console.log("  DEXTER SOLANA x402 TEST — 2 live payments via Dexter");
  console.log("═".repeat(60));

  const secretBytes = base58.decode(sk);
  console.log(`🔑 Key length:     ${secretBytes.length} bytes`);

  const signer = await createKeyPairSignerFromBytes(secretBytes);
  console.log(`🔑 Buyer wallet:   ${signer.address}`);
  console.log(`🏦 Seller wallet:  BmUPzSupHJu2kW4cL27dF7Vc2JaZTwXKzFsRuagPDtL8`);
  console.log(`⚡ Facilitator:    ${FACILITATOR_URL}`);
  console.log(`💵 Total cost:     $0.10 USDC`);
  console.log(`🖥️  Server:        ${BASE_URL}`);

  // Verify the server is returning feePayer correctly before spending money
  await verifyFeePayerPresent(signer.address);

  const client = new x402Client();
  registerExactSvmScheme(client, {
    signer,
    networks: ["solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"],
  });

  const paidFetch = wrapFetchWithPayment(fetch, client);

  const results: { label: string; success: boolean }[] = [];

  results.push({
    label: "AI Inference",
    success: await runPayment(
      paidFetch as any,
      signer.address,
      "1/2 — AI Inference  ($0.05)",
      "/x402/ai-inference",
      { prompt: "Reply with exactly: Coin Railz x402 Solana payment confirmed" }
    ),
  });

  results.push({
    label: "Fire Alerts",
    success: await runPayment(
      paidFetch as any,
      signer.address,
      "2/2 — Fire Alerts   ($0.05)",
      "/x402/fire-alerts",
      { lat: 34.05, lon: -118.24, radius_km: 50, days: 1 }
    ),
  });

  console.log(`\n${"═".repeat(60)}`);
  const passed = results.filter((r) => r.success).length;
  console.log(`  RESULTS: ${passed}/${results.length} payments succeeded`);
  results.forEach((r) => console.log(`    ${r.success ? "✅" : "❌"} ${r.label}`));
  if (passed === results.length) {
    console.log("\n  🎉 Both Dexter settlements attested on-chain!");
    console.log("  👉 Check: https://dexter.cash/sellers/BmUPzSupHJu2kW4cL27dF7Vc2JaZTwXKzFsRuagPDtL8");
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
