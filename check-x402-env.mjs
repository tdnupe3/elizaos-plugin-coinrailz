// Check what environment variables @coinbase/x402 actually uses
import { facilitator } from "@coinbase/x402";

console.log("=== @coinbase/x402 facilitator structure ===");
console.log("facilitator.url:", facilitator.url);
console.log("facilitator.createAuthHeaders:", typeof facilitator.createAuthHeaders);

// Check if there's any documentation in node_modules
import { readFileSync } from 'fs';
try {
  const packageJson = JSON.parse(readFileSync('./node_modules/@coinbase/x402/package.json', 'utf8'));
  console.log("\n=== Package info ===");
  console.log("Version:", packageJson.version);
  console.log("Description:", packageJson.description);
} catch (e) {}
