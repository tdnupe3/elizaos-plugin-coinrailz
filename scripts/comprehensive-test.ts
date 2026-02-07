import { SERVICES, USER_AGENTS, CallResult } from "./organic-x402-traffic";
import { privateKeyToAccount } from "viem/accounts";
import { createPublicClient, http, formatUnits } from "viem";
import { base } from "viem/chains";

const BASE_URL = "https://coinrailz.com";
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const DELAY_MS = 5000;

async function checkBalance(address: string): Promise<number> {
  const client = createPublicClient({ chain: base, transport: http() });
  const balance = await client.readContract({
    address: USDC_ADDRESS,
    abi: [{ name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }] }],
    functionName: "balanceOf",
    args: [address as `0x${string}`],
  });
  return parseFloat(formatUnits(balance as bigint, 6));
}

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

  const startBalance = await checkBalance(account.address);
  console.log(`Starting USDC balance: $${startBalance.toFixed(2)}`);

  const schemeClient = new ExactEvmScheme(account);
  const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [{ network: "eip155:*", client: schemeClient }],
  });

  const results: CallResult[] = [];
  const expensiveServices = ["verified-agent-identity", "compliance-consultation", "smart-contract-audit"];
  const testServices = SERVICES.filter(s => !expensiveServices.includes(s.name));
  
  let totalEstCost = testServices.reduce((sum, s) => sum + s.priceUsd, 0);
  console.log(`\nTesting ${testServices.length} services (skipping ${expensiveServices.length} expensive: ${expensiveServices.join(", ")})`);
  console.log(`Estimated total cost: $${totalEstCost.toFixed(2)} USDC`);
  console.log(`Delay between tests: ${DELAY_MS}ms`);

  if (startBalance < totalEstCost) {
    console.log(`\nWARNING: Balance ($${startBalance.toFixed(2)}) may be insufficient for all tests ($${totalEstCost.toFixed(2)})`);
    console.log(`Will test as many as possible before running out.\n`);
  } else {
    console.log(`Balance sufficient. Starting tests...\n`);
  }

  const startTime = Date.now();

  for (let i = 0; i < testServices.length; i++) {
    const service = testServices[i];
    const userAgent = "CoinRailz-ComprehensiveTest/2.0";
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
        result.error = responseData.substring(0, 500);
      }

      results.push(result);

      const statusIcon = result.success ? "OK" : `ERR:${response.status}`;
      console.log(`  [${statusIcon}] ${durationMs}ms${txHash ? ` tx:${txHash.substring(0, 14)}...` : ""}`);
      
      if (!result.success) {
        console.log(`  Error: ${result.error?.substring(0, 200)}`);
      }
    } catch (err: any) {
      const durationMs = Date.now() - start;
      results.push({
        service: service.name,
        priceUsd: service.priceUsd,
        status: 0,
        success: false,
        error: err.message?.substring(0, 500),
        durationMs,
        timestamp: new Date().toISOString(),
        userAgent,
      });
      console.log(`  [FAIL] ${err.message?.substring(0, 200)}`);
    }

    if (i < testServices.length - 1) {
      await new Promise(r => setTimeout(r, DELAY_MS));
    }
  }

  const totalDuration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  const totalSpent = results.filter(r => r.success).reduce((sum, r) => sum + r.priceUsd, 0);

  let endBalance: number;
  try {
    endBalance = await checkBalance(account.address);
  } catch {
    endBalance = startBalance - totalSpent;
  }

  console.log(`\n${"=".repeat(70)}`);
  console.log(`  COMPREHENSIVE TEST RESULTS - ${new Date().toISOString()}`);
  console.log(`${"=".repeat(70)}`);
  console.log(`  Total services tested: ${results.length}`);
  console.log(`  Successful (200):      ${successCount}`);
  console.log(`  Failed:                ${failCount}`);
  console.log(`  Success rate:          ${((successCount / results.length) * 100).toFixed(1)}%`);
  console.log(`  Total spent:           $${totalSpent.toFixed(2)} USDC`);
  console.log(`  Start balance:         $${startBalance.toFixed(2)} USDC`);
  console.log(`  End balance:           $${endBalance.toFixed(2)} USDC`);
  console.log(`  Actual spent:          $${(startBalance - endBalance).toFixed(2)} USDC`);
  console.log(`  Total duration:        ${totalDuration} minutes`);
  console.log(`${"=".repeat(70)}`);
  
  if (failCount > 0) {
    console.log(`\n  FAILED SERVICES (${failCount}):`);
    results.filter(r => !r.success).forEach(r => {
      console.log(`    [${r.status}] ${r.service} ($${r.priceUsd}) - ${r.error?.substring(0, 120)}`);
    });
  }

  console.log(`\n  SUCCESSFUL SERVICES (${successCount}):`);
  results.filter(r => r.success).forEach(r => {
    console.log(`    [200] ${r.service} ($${r.priceUsd}) ${r.durationMs}ms${r.txHash ? ` tx:${r.txHash.substring(0, 14)}...` : ""}`);
  });

  console.log(`\n  SKIPPED EXPENSIVE SERVICES (${expensiveServices.length}):`);
  expensiveServices.forEach(name => {
    const s = SERVICES.find(sv => sv.name === name);
    console.log(`    [SKIP] ${name} ($${s?.priceUsd || "?"}) - too expensive for routine testing`);
  });

  console.log(`\n${"=".repeat(70)}`);
}

testAllServices().catch(err => {
  console.error("FATAL:", err.message);
  process.exit(1);
});
