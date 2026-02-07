async function testPremium() {
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
  
  console.log(`Buyer: ${account.address}\n`);
  
  const tests = [
    {
      name: "verified-agent-identity",
      url: "https://coinrailz.com/x402/verified-agent-identity",
      price: 5,
      body: { agentId: "test-bot-premium", walletAddress: "0x5837A864C03912ea14a5609968F73E75B9d42a7C", metadata: { name: "TestBot", capabilities: ["trading", "data"] } }
    },
    {
      name: "smart-contract-audit",
      url: "https://coinrailz.com/x402/service/smart-contract-audit",
      price: 10,
      body: { contractCode: "pragma solidity ^0.8.0; contract Test { uint256 public value; function set(uint256 v) public { value = v; } }", contractName: "TestContract" }
    },
    {
      name: "compliance-consultation",
      url: "https://coinrailz.com/x402/service/compliance-consultation",
      price: 5,
      body: { businessType: "crypto-exchange", jurisdiction: "US", transactionVolume: 100000 }
    }
  ];
  
  for (let i = 0; i < tests.length; i++) {
    const t = tests[i];
    console.log(`[${i+1}/${tests.length}] ${t.name} ($${t.price})...`);
    console.log(`  URL: ${t.url}`);
    console.log(`  Body: ${JSON.stringify(t.body).substring(0, 150)}`);
    
    const start = Date.now();
    try {
      const response = await fetchWithPayment(t.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json", "User-Agent": "CoinRailz-PremiumTest/1.0" },
        body: JSON.stringify(t.body),
      });
      const durationMs = Date.now() - start;
      const text = await response.text();
      const statusIcon = response.status >= 200 && response.status < 300 ? "OK" : `ERR:${response.status}`;
      console.log(`  [${statusIcon}] ${durationMs}ms`);
      
      if (response.status >= 400) {
        console.log(`  Response: ${text.substring(0, 400)}`);
      } else {
        try {
          const data = JSON.parse(text);
          console.log(`  Success: ${JSON.stringify(data).substring(0, 300)}`);
        } catch {
          console.log(`  Response (non-JSON): ${text.substring(0, 200)}`);
        }
      }
    } catch (err: any) {
      console.log(`  [FAIL] ${err.message?.substring(0, 300)}`);
    }
    
    if (i < tests.length - 1) {
      console.log(`  Waiting 12s...\n`);
      await new Promise(r => setTimeout(r, 12000));
    }
  }
}

testPremium().catch(console.error);
