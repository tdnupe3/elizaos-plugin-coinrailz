async function testEnterprise() {
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
      name: "smart-contract-audit",
      url: "https://coinrailz.com/x402/service/smart-contract-audit",
      body: { contractCode: "pragma solidity ^0.8.0; contract Test { uint256 public value; function set(uint256 v) public { value = v; } }", contractName: "TestContract" }
    },
    {
      name: "compliance-consultation",
      url: "https://coinrailz.com/x402/service/compliance-consultation",
      body: { businessType: "crypto-exchange", jurisdiction: "US", transactionVolume: 100000 }
    }
  ];
  
  for (let i = 0; i < tests.length; i++) {
    const t = tests[i];
    console.log(`[${i+1}/${tests.length}] ${t.name}...`);
    const start = Date.now();
    try {
      const res = await fetchWithPayment(t.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json", "User-Agent": "CoinRailz-EnterpriseTest/1.0" },
        body: JSON.stringify(t.body),
      });
      const durationMs = Date.now() - start;
      const text = await res.text();
      const status = res.status >= 200 && res.status < 300 ? "OK" : `ERR:${res.status}`;
      console.log(`  [${status}] ${durationMs}ms`);
      if (res.status >= 400) {
        console.log(`  Response: ${text.substring(0, 400)}`);
      } else {
        try {
          const data = JSON.parse(text);
          console.log(`  Success: ${JSON.stringify(data).substring(0, 400)}`);
        } catch {
          console.log(`  Response: ${text.substring(0, 300)}`);
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
testEnterprise().catch(console.error);
