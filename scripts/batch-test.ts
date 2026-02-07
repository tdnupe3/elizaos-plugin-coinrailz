import { SERVICES, CallResult } from "./organic-x402-traffic";
import { privateKeyToAccount } from "viem/accounts";
import { createPublicClient, http, formatUnits } from "viem";
import { base } from "viem/chains";
import * as fs from "fs";

const BASE_URL = "https://coinrailz.com";
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const DELAY_MS = 8000;
const RESULTS_FILE = "/tmp/x402-test-results.json";

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

function loadResults(): CallResult[] {
  try {
    if (fs.existsSync(RESULTS_FILE)) {
      return JSON.parse(fs.readFileSync(RESULTS_FILE, "utf-8"));
    }
  } catch {}
  return [];
}

function saveResults(results: CallResult[]) {
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
}

async function testBatch() {
  const { wrapFetchWithPaymentFromConfig } = await import("@x402/fetch");
  const { ExactEvmScheme } = await import("@x402/evm");

  const pk = process.env.X402_BUYER_PRIVATE_KEY;
  if (!pk) { console.error("X402_BUYER_PRIVATE_KEY required"); process.exit(1); }

  const normalizedPk = pk.startsWith("0x") ? pk : `0x${pk}`;
  const account = privateKeyToAccount(normalizedPk as `0x${string}`);

  const startBalance = await checkBalance(account.address);
  console.log(`Buyer: ${account.address} | Balance: $${startBalance.toFixed(2)} USDC`);

  const schemeClient = new ExactEvmScheme(account);
  const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [{ network: "eip155:*", client: schemeClient }],
  });

  const skipArg = process.argv.find(a => a.startsWith("--skip="));
  const skipCount = skipArg ? parseInt(skipArg.split("=")[1]) : 0;
  const batchArg = process.argv.find(a => a.startsWith("--batch="));
  const batchSize = batchArg ? parseInt(batchArg.split("=")[1]) : 10;
  const freshArg = process.argv.includes("--fresh");

  const expensiveServices = ["verified-agent-identity", "compliance-consultation", "smart-contract-audit"];
  const allTestServices = SERVICES.filter(s => !expensiveServices.includes(s.name));

  let previousResults = freshArg ? [] : loadResults();
  const testedNames = new Set(previousResults.filter(r => r.success).map(r => r.service));

  const remainingServices = allTestServices.filter(s => !testedNames.has(s.name));
  const batchServices = remainingServices.slice(skipCount, skipCount + batchSize);

  if (batchServices.length === 0) {
    console.log("\nAll services have been tested successfully! No more to test.");
    printSummary(previousResults, allTestServices, expensiveServices);
    return;
  }

  const batchCost = batchServices.reduce((sum, s) => sum + s.priceUsd, 0);
  console.log(`\nBatch: ${batchServices.length} services (skip=${skipCount}, batch=${batchSize})`);
  console.log(`Batch cost: ~$${batchCost.toFixed(2)} | Delay: ${DELAY_MS}ms`);
  console.log(`Previously passed: ${testedNames.size} | Remaining: ${remainingServices.length}\n`);

  const batchResults: CallResult[] = [];

  for (let i = 0; i < batchServices.length; i++) {
    const service = batchServices[i];
    const url = `${BASE_URL}/x402/${service.name}`;

    console.log(`[${i + 1}/${batchServices.length}] ${service.name} ($${service.priceUsd})...`);

    const start = Date.now();
    try {
      const response = await fetchWithPayment(url, {
        method: service.method,
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "User-Agent": "CoinRailz-BatchTest/2.0",
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
        userAgent: "CoinRailz-BatchTest/2.0",
      };

      if (!result.success) {
        result.error = responseData.substring(0, 500);
      }

      batchResults.push(result);

      const statusIcon = result.success ? "OK" : `ERR:${response.status}`;
      console.log(`  [${statusIcon}] ${durationMs}ms${txHash ? ` tx:${txHash.substring(0, 14)}...` : ""}`);
      
      if (!result.success) {
        console.log(`  Error: ${result.error?.substring(0, 150)}`);
      }
    } catch (err: any) {
      const durationMs = Date.now() - start;
      batchResults.push({
        service: service.name,
        priceUsd: service.priceUsd,
        status: 0,
        success: false,
        error: err.message?.substring(0, 500),
        durationMs,
        timestamp: new Date().toISOString(),
        userAgent: "CoinRailz-BatchTest/2.0",
      });
      console.log(`  [FAIL] ${err.message?.substring(0, 200)}`);
    }

    if (i < batchServices.length - 1) {
      await new Promise(r => setTimeout(r, DELAY_MS));
    }
  }

  const allResults = [...previousResults, ...batchResults];
  saveResults(allResults);

  const endBalance = await checkBalance(account.address);
  const batchSuccess = batchResults.filter(r => r.success).length;
  const batchFail = batchResults.filter(r => !r.success).length;

  console.log(`\n--- Batch Summary ---`);
  console.log(`Batch: ${batchSuccess} passed, ${batchFail} failed`);
  console.log(`Balance: $${startBalance.toFixed(2)} -> $${endBalance.toFixed(2)} (spent: $${(startBalance - endBalance).toFixed(2)})`);
  console.log(`Results saved to ${RESULTS_FILE}\n`);

  printSummary(allResults, allTestServices, expensiveServices);

  const newFails = batchResults.filter(r => !r.success);
  if (newFails.length > 0) {
    console.log(`\nTo retry failed: run again (failed services auto-included in next batch)`);
  }

  const totalPassed = allResults.filter(r => r.success);
  const stillRemaining = allTestServices.filter(s => !new Set(totalPassed.map(r => r.service)).has(s.name));
  if (stillRemaining.length > 0) {
    console.log(`\nTo continue: npx tsx scripts/batch-test.ts --batch=${batchSize}`);
    console.log(`Remaining services: ${stillRemaining.map(s => s.name).join(", ")}`);
  }
}

function printSummary(results: CallResult[], allServices: typeof SERVICES, expensive: string[]) {
  const passed = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const passedNames = new Set(passed.map(r => r.service));
  const untested = allServices.filter(s => !passedNames.has(s.name) && !failed.some(f => f.service === s.name));

  console.log(`${"=".repeat(70)}`);
  console.log(`  OVERALL STATUS - ${new Date().toISOString()}`);
  console.log(`${"=".repeat(70)}`);
  console.log(`  Passed:    ${passed.length}/${allServices.length}`);
  console.log(`  Failed:    ${failed.length}`);
  console.log(`  Untested:  ${untested.length}`);
  console.log(`  Skipped:   ${expensive.length} (expensive: ${expensive.join(", ")})`);
  console.log(`  Total USDC spent on successes: $${passed.reduce((s, r) => s + r.priceUsd, 0).toFixed(2)}`);

  if (passed.length > 0) {
    console.log(`\n  PASSED (${passed.length}):`);
    passed.forEach(r => console.log(`    [200] ${r.service} ($${r.priceUsd})`));
  }
  if (failed.length > 0) {
    console.log(`\n  FAILED (${failed.length}):`);
    failed.forEach(r => console.log(`    [${r.status}] ${r.service} ($${r.priceUsd}) - ${r.error?.substring(0, 80)}`));
  }
  if (untested.length > 0) {
    console.log(`\n  UNTESTED (${untested.length}):`);
    untested.forEach(s => console.log(`    [ - ] ${s.name} ($${s.priceUsd})`));
  }
  console.log(`${"=".repeat(70)}`);
}

testBatch().catch(err => {
  console.error("FATAL:", err.message);
  process.exit(1);
});
