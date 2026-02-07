async function drainWallet() {
  const { wrapFetchWithPaymentFromConfig } = await import("@x402/fetch");
  const { ExactEvmScheme } = await import("@x402/evm");
  const { privateKeyToAccount } = await import("viem/accounts");
  
  const pk = process.env.X402_BUYER_PRIVATE_KEY!;
  const normalizedPk = pk.startsWith("0x") ? pk : `0x${pk}`;
  const account = privateKeyToAccount(normalizedPk as `0x${string}`);
  const schemeClient = new ExactEvmScheme(account);
  const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [{ network: "eip155:*", client: schemeClient }],
  });

  console.log(`Buyer: ${account.address}`);
  console.log(`Starting drain sequence...\n`);

  const BASE = "https://coinrailz.com/x402/service";
  
  // Phase 1: Premium services to drain fast ($5 each)
  const premiumCalls = [
    { name: "verified-agent-identity", price: "$5.00", url: `${BASE}/verified-agent-identity`, body: { agentName: "DrainTest-Agent", capabilities: ["payments", "trading"], contactUrl: "https://test.agent" } },
    { name: "compliance-consultation", price: "$5.00", url: `${BASE}/compliance-consultation`, body: { businessType: "crypto-exchange", jurisdiction: "US", transactionVolume: 50000 } },
  ];

  // Phase 2: Mid-tier services ($0.50-$2.00)
  const midCalls = [
    { name: "agent-create-wallet", price: "$2.00", url: `${BASE}/agent-create-wallet`, body: { agentName: "drain-test-wallet", network: "base" } },
    { name: "seamless-chain-bridge", price: "$2.00", url: `${BASE}/seamless-chain-bridge`, body: { fromChain: "ethereum", toChain: "base", token: "USDC", amount: "10" } },
    { name: "instant-api-key", price: "$1.00", url: `${BASE}/instant-api-key`, body: { projectName: "drain-test", tier: "standard" } },
    { name: "portfolio-optimization", price: "$2.00", url: `${BASE}/portfolio-optimization`, body: { portfolio: [{ token: "ETH", allocation: 0.5 }, { token: "BTC", allocation: 0.5 }] } },
  ];

  // Phase 3: Low-cost volume burst ($0.025-$0.50)
  const volumeCalls = [
    { name: "fire-alerts", price: "$0.05", url: `${BASE}/fire-alerts`, body: { lat: 37.7749, lng: -122.4194, radius: 100 } },
    { name: "weather-imagery", price: "$0.05", url: `${BASE}/weather-imagery`, body: { lat: 40.7128, lng: -74.0060, layer: "MODIS_Terra_CorrectedReflectance_TrueColor" } },
    { name: "air-quality", price: "$0.05", url: `${BASE}/air-quality`, body: { lat: 51.5074, lng: -0.1278 } },
    { name: "solana-yield-finder", price: "$0.05", url: `${BASE}/solana-yield-finder`, body: { token: "SOL" } },
    { name: "iot-sensor-reading", price: "$0.025", url: `${BASE}/iot-sensor-reading`, body: { deviceId: "drain-sensor-001", sensorType: "temperature" } },
    { name: "weather-station-data", price: "$0.05", url: `${BASE}/weather-station-data`, body: { stationId: "drain-wx-001", metrics: ["temperature", "humidity"] } },
    { name: "gas-price-oracle", price: "$0.10", url: `${BASE}/gas-price-oracle`, body: { chain: "ethereum" } },
    { name: "token-metadata", price: "$0.10", url: `${BASE}/token-metadata`, body: { token: "USDC", chain: "base" } },
    { name: "polymarket-events", price: "$0.25", url: `${BASE}/polymarket-events`, body: { category: "crypto" } },
    { name: "polymarket-search", price: "$0.25", url: `${BASE}/polymarket-search`, body: { query: "bitcoin" } },
  ];

  const allCalls = [...premiumCalls, ...midCalls, ...volumeCalls];
  let totalSpent = 0;
  let successes = 0;
  let failures = 0;
  let insufficientBalance = 0;

  for (let i = 0; i < allCalls.length; i++) {
    const t = allCalls[i];
    const phase = i < premiumCalls.length ? "PREMIUM" : i < premiumCalls.length + midCalls.length ? "MID-TIER" : "VOLUME";
    console.log(`[${i+1}/${allCalls.length}] [${phase}] ${t.name} (${t.price})...`);
    const start = Date.now();
    try {
      const res = await fetchWithPayment(t.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json", "User-Agent": "CoinRailz-DrainTest/1.0" },
        body: JSON.stringify(t.body),
      });
      const durationMs = Date.now() - start;
      const text = await res.text();
      
      if (res.status >= 200 && res.status < 300) {
        successes++;
        const priceNum = parseFloat(t.price.replace("$", ""));
        totalSpent += priceNum;
        console.log(`  ✅ 200 OK (${durationMs}ms) — Spent: $${totalSpent.toFixed(2)} total`);
      } else if (res.status === 402) {
        try {
          const d = JSON.parse(text);
          if (d.error === "insufficient_balance") {
            insufficientBalance++;
            console.log(`  💰 INSUFFICIENT BALANCE — wallet depleted!`);
            console.log(`\n=== WALLET DEPLETED ===`);
            break;
          }
        } catch {}
        failures++;
        console.log(`  ❌ 402 (${durationMs}ms): ${text.substring(0, 200)}`);
      } else {
        failures++;
        console.log(`  ❌ ${res.status} (${durationMs}ms): ${text.substring(0, 200)}`);
      }
    } catch (err: any) {
      failures++;
      console.log(`  ❌ FAIL: ${err.message?.substring(0, 200)}`);
    }
    
    // Pace: 8s between premium, 6s between mid, 3s between volume
    const delay = i < premiumCalls.length ? 8000 : i < premiumCalls.length + midCalls.length ? 6000 : 3000;
    if (i < allCalls.length - 1) {
      await new Promise(r => setTimeout(r, delay));
    }
  }

  console.log(`\n════════════════════════════════════════`);
  console.log(`DRAIN RESULTS`);
  console.log(`════════════════════════════════════════`);
  console.log(`Successful paid calls: ${successes}`);
  console.log(`Failed calls:          ${failures}`);
  console.log(`Insufficient balance:  ${insufficientBalance}`);
  console.log(`Total spent this run:  $${totalSpent.toFixed(2)}`);
  console.log(`════════════════════════════════════════`);
}

drainWallet().catch(console.error);
