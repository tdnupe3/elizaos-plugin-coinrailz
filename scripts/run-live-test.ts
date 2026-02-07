import { runOrganicTraffic } from "./organic-x402-traffic";

const privateKey = process.env.X402_BUYER_PRIVATE_KEY || process.env.EVM_PRIVATE_KEY;
if (!privateKey) {
  console.error("ERROR: No private key found");
  process.exit(1);
}

console.log("Starting live x402 traffic test (LOCAL dev server)...");
console.log("Target: http://localhost:5000");
console.log("Services: token-price, gas-oracle");
console.log("DryRun: false (LIVE PAYMENTS)\n");

runOrganicTraffic({
  maxCalls: 2,
  minDelayMs: 3000,
  maxDelayMs: 8000,
  dryRun: false,
  privateKey,
  targetUrl: "http://localhost:5000",
  excludeServices: [],
  onlyServices: ["token-price", "gas-price-oracle"],
}).then(results => {
  console.log("\n=== RESULTS ===");
  const successes = results.filter(r => r.success);
  console.log(`Successes: ${successes.length}/${results.length}`);
  console.log(`Total spent: $${successes.reduce((s, r) => s + r.priceUsd, 0).toFixed(2)}`);
  results.forEach((r, i) => {
    console.log(`\n[${i+1}] ${r.service} - $${r.priceUsd}`);
    console.log(`    Status: ${r.status} | Success: ${r.success}`);
    if (r.error) console.log(`    Error: ${r.error}`);
    console.log(`    Duration: ${r.durationMs}ms`);
    console.log(`    UA: ${r.userAgent}`);
  });
}).catch(err => {
  console.error("FATAL:", err);
  process.exit(1);
});
