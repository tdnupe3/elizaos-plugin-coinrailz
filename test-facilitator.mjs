// Test if @coinbase/x402 facilitator can be imported and configured
import { facilitator } from "@coinbase/x402";

console.log("=== TESTING @coinbase/x402 FACILITATOR ===");
console.log("Facilitator object:", typeof facilitator);
console.log("Facilitator keys:", Object.keys(facilitator || {}));
console.log("\nCDP Environment Variables:");
console.log("CDP_API_KEY_ID:", process.env.CDP_API_KEY_ID ? "SET" : "MISSING");
console.log("CDP_API_KEY_SECRET:", process.env.CDP_API_KEY_SECRET ? "SET" : "MISSING");  
console.log("CDP_PRIVATE_KEY:", process.env.CDP_PRIVATE_KEY ? "SET" : "MISSING");

// Check if facilitator is a function or object
if (typeof facilitator === 'function') {
  console.log("\n✅ Facilitator is a function - should be called");
} else if (typeof facilitator === 'object') {
  console.log("\n✅ Facilitator is an object - can be passed directly");
} else {
  console.log("\n❌ Facilitator is neither function nor object:", typeof facilitator);
}
