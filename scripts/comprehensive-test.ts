import { SERVICES, USER_AGENTS, CallResult } from "./organic-x402-traffic";
import { privateKeyToAccount } from "viem/accounts";

const BASE_URL = "https://coinrailz.com";
const CDP_FACILITATOR_URL = "https://api.cdp.coinbase.com/platform/v2/x402";

async function testAllServices() {
  const { wrapFetchWithPaymentFromConfig } = await import("@x402/fetch");
  const { ExactEvmScheme } = await import("@x402/evm");

  const pk = process.env.X402_BUYER_PRIVATE_KEY;
  if (!pk) {
    console.error("ERROR: X402_BUYER_PRIVATE_KEY required");
    process.exit(1);
  }

  const normalizedPk = pk.startsWith("0x") ? pk : `0x${pk}`;
  const account = privateKeyToAccount(normalizedPk as `0x${string}`);
  console.log(`Buyer wallet: ${account.address}`);

  const schemeClient = new ExactEvmScheme(account);
  const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [{ network: "eip155:*", client: schemeClient }],
  });

  const results: CallResult[] = [];
  const expensiveServices = ["verified-agent-identity", "compliance-consultation", "smart-contract-audit"];
  const testServices = SERVICES.filter(s => !expensiveServices.includes(s.name));
  
  let totalEstCost = testServices.reduce((sum, s) => sum + s.priceUsd, 0);
  console.log(`\nTesting ${testServices.length} services (skipping ${expensiveServices.length} expensive ones)`);
  console.log(`Estimated total cost: $${totalEstCost.toFixed(2)} USDC\n`);

  for (let i = 0; i < testServices.length; i++) {
    const service = testServices[i];
    const userAgent = "CoinRailz-ComprehensiveTest/1.0";
    const url = `${BASE_URL}/x402/${service.name}`;

    console.log(`[${i + 1}/${testServices.length}] ${service.name} ($${service.priceUsd})...`);

    const start = Date.now();
    try {
      const response = await fetchWithPayment(url, {
        method: service.method,
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "User-Agent": userAgent,
        },
        body: JSON.stringify(service.body),
      });

      const durationMs = Date.now() - start;
      const responseData = await response.text();
      let txHash: string | undefined;

      const paymentResponse = response.headers.get("payment-response");
      if (paymentResponse) {
        try {
          const decoded = JSON.parse(Buffer.from(paymentResponse, "base64").toString());
          txHash = decoded?.txHash || decoded?.transactionHash;
        } catch {}
      }

      const result: CallResult = {
        service: service.name,
        priceUsd: service.priceUsd,
        status: response.status,
        success: response.status >= 200 && response.status < 300,
        txHash,
        durationMs,
        timestamp: new Date().toISOString(),
        userAgent,
      };

      if (!result.success) {
        result.error = responseData.substring(0, 300);
      }

      results.push(result);

      const statusIcon = result.success ? "OK" : `ERR:${response.status}`;
      console.log(`  [${statusIcon}] ${durationMs}ms${txHash ? ` tx:${txHash.substring(0, 14)}...` : ""}`);
      
      if (!result.success) {
        console.log(`  Error: ${result.error?.substring(0, 150)}`);
      }
    } catch (err: any) {
      const durationMs = Date.now() - start;
      results.push({
        service: service.name,
        priceUsd: service.priceUsd,
        status: 0,
        success: false,
        error: err.message?.substring(0, 300),
        durationMs,
        timestamp: new Date().toISOString(),
        userAgent,
      });
      console.log(`  [FAIL] ${err.message?.substring(0, 150)}`);
    }

    if (i < testServices.length - 1) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  const totalSpent = results.filter(r => r.success).reduce((sum, r) => sum + r.priceUsd, 0);

  console.log(`\n${"=".repeat(60)}`);
  console.log(`COMPREHENSIVE TEST RESULTS`);
  console.log(`${"=".repeat(60)}`);
  console.log(`Total services tested: ${results.length}`);
  console.log(`Successful (200): ${successCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(`Total spent: $${totalSpent.toFixed(2)} USDC`);
  console.log(`Success rate: ${((successCount / results.length) * 100).toFixed(1)}%`);
  
  if (failCount > 0) {
    console.log(`\nFAILED SERVICES:`);
    results.filter(r => !r.success).forEach(r => {
      console.log(`  - ${r.service} ($${r.priceUsd}): ${r.status} - ${r.error?.substring(0, 100)}`);
    });
  }

  console.log(`\nSUCCESSFUL SERVICES:`);
  results.filter(r => r.success).forEach(r => {
    console.log(`  - ${r.service} ($${r.priceUsd}) ${r.durationMs}ms${r.txHash ? ` tx:${r.txHash.substring(0, 14)}...` : ""}`);
  });
}

testAllServices().catch(err => {
  console.error("FATAL:", err.message);
  process.exit(1);
});
