import { privateKeyToAccount } from "viem/accounts";

const privateKey = process.env.X402_BUYER_PRIVATE_KEY || process.env.EVM_PRIVATE_KEY;
if (!privateKey) { console.error("No key"); process.exit(1); }

const pk = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
const account = privateKeyToAccount(pk as `0x${string}`);

async function testService(name: string, body: any) {
  const { wrapFetchWithPaymentFromConfig } = await import("@x402/fetch");
  const { ExactEvmScheme } = await import("@x402/evm");
  
  const schemeClient = new ExactEvmScheme(account);
  const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [{ network: "eip155:*", client: schemeClient }],
  });
  
  const url = `https://coinrailz.com/x402/${name}`;
  console.log(`\nTesting ${name}...`);
  const start = Date.now();
  
  try {
    const response = await fetchWithPayment(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json", "User-Agent": "SatelliteTestAgent/1.0 (x402)" },
      body: JSON.stringify(body),
    });
    
    const elapsed = Date.now() - start;
    const data = await response.json();
    
    if (response.status === 200) {
      console.log(`  ✅ ${name}: ${elapsed}ms`);
      // Show key data fields
      const keys = Object.keys(data).filter(k => !['success', 'timestamp', 'product', 'paymentId'].includes(k));
      for (const k of keys.slice(0, 5)) {
        const val = typeof data[k] === 'object' ? JSON.stringify(data[k]).substring(0, 120) : data[k];
        console.log(`     ${k}: ${val}`);
      }
    } else {
      console.log(`  ❌ ${name}: HTTP ${response.status} (${elapsed}ms)`);
      console.log(`     ${JSON.stringify(data).substring(0, 200)}`);
    }
    return { name, status: response.status, elapsed, success: response.status === 200 };
  } catch (e: any) {
    const elapsed = Date.now() - start;
    console.log(`  ❌ ${name}: EXCEPTION (${elapsed}ms): ${e.message.substring(0, 150)}`);
    return { name, status: 0, elapsed, success: false, error: e.message };
  }
}

async function main() {
  console.log("=== Testing ALL 5 satellite services via live x402 payments ===");
  console.log(`Buyer: ${account.address}`);
  
  // Test the 3 services we haven't hit yet
  const results = [];
  results.push(await testService("air-quality", { lat: 40.71, lon: -74.01, pollutant: "NO2" }));
  results.push(await testService("flood-detection", { lat: 29.76, lon: -95.37, radius_km: 25 }));
  results.push(await testService("land-use", { lat: 41.88, lon: -87.63, radius_km: 5 }));
  
  console.log("\n=== SUMMARY ===");
  const ok = results.filter(r => r.success);
  console.log(`${ok.length}/${results.length} succeeded`);
  console.log(`Total cost: $${(ok.length * 0.10).toFixed(2)} approx`);
}

main().catch(console.error);
