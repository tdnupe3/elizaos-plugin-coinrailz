// Check if our services are discoverable in Coinbase Bazaar
import { searchServices } from "@coinbase/x402";

console.log("=== BAZAAR DISCOVERY CHECK ===\n");

try {
  // Search for Coin Railz services
  const searchTerms = ["coin railz", "coinrailz", "multi-chain-balance", "gas-price-oracle"];
  
  for (const term of searchTerms) {
    console.log(`\n🔍 Searching Bazaar for: "${term}"`);
    try {
      const results = await searchServices({ query: term, limit: 10 });
      console.log(`   Found ${results.length} results`);
      if (results.length > 0) {
        console.log("   Results:", JSON.stringify(results.map(r => r.name || r.title || r.id).slice(0, 3), null, 2));
      }
    } catch (e) {
      console.log(`   Search error: ${e.message}`);
    }
  }
} catch (error) {
  console.error("Fatal error:", error.message);
}
