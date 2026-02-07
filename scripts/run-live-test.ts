import { runOrganicTraffic } from "./organic-x402-traffic";

const privateKey = process.env.X402_BUYER_PRIVATE_KEY || process.env.EVM_PRIVATE_KEY;
if (!privateKey) {
  console.error("ERROR: No private key found");
  process.exit(1);
}

console.log("Starting live x402 traffic test...");
console.log("Target: https://coinrailz.com");
console.log("Services: token-price, gas-oracle, dex-liquidity");
console.log("DryRun: false (LIVE PAYMENTS)\n");

runOrganicTraffic({
  maxCalls: 3,
  minDelayMs: 5000,
  maxDelayMs: 15000,
  dryRun: false,
  privateKey,
  targetUrl: "https://coinrailz.com",
  excludeServices: [],
  onlyServices: ["token-price", "gas-oracle", "dex-liquidity"],
}).then(results => {
  console.log("\n=== RESULTS ===");
  const successes = results.filter(r => r.success);
  const failures = results.filter(r => !r.success);
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
