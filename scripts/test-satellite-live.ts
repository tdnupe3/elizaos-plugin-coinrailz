import { runOrganicTraffic } from "./organic-x402-traffic";

const privateKey = process.env.X402_BUYER_PRIVATE_KEY || process.env.EVM_PRIVATE_KEY;
if (!privateKey) {
  console.error("ERROR: No private key found (X402_BUYER_PRIVATE_KEY or EVM_PRIVATE_KEY)");
  process.exit(1);
}

console.log("LIVE Satellite Service Test via x402 Payments");
console.log("Target: https://coinrailz.com (production)");
console.log("Services: weather-imagery, vegetation, air-quality, flood-detection, land-use");
console.log("Skipping: fire-alerts (needs NASA_FIRMS_MAP_KEY)");
console.log("Payment: REAL USDC on Base via x402 protocol\n");

runOrganicTraffic({
  maxCalls: 5,
  minDelayMs: 2000,
  maxDelayMs: 4000,
  dryRun: false,
  privateKey,
  targetUrl: "https://coinrailz.com",
  excludeServices: ["fire-alerts"],
  onlyServices: ["weather-imagery", "vegetation", "air-quality", "flood-detection", "land-use"],
}).then(results => {
  console.log("\n=== SATELLITE LIVE TEST RESULTS ===");
  const successes = results.filter(r => r.success);
  const failures = results.filter(r => !r.success);
  console.log(`Successes: ${successes.length}/${results.length}`);
  console.log(`Failures: ${failures.length}/${results.length}`);
  console.log(`Total spent: $${successes.reduce((s, r) => s + r.priceUsd, 0).toFixed(2)}`);
  
  results.forEach((r, i) => {
    console.log(`\n[${i+1}] ${r.service} - $${r.priceUsd}`);
    console.log(`    Status: ${r.status} | Success: ${r.success}`);
    if (r.txHash) console.log(`    TX: ${r.txHash}`);
    if (r.error) console.log(`    Error: ${r.error.substring(0, 200)}`);
    console.log(`    Duration: ${r.durationMs}ms`);
  });
}).catch(err => {
  console.error("FATAL:", err);
  process.exit(1);
});
