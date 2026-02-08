import { privateKeyToAccount } from "viem/accounts";
import { SERVICES } from "./organic-x402-traffic";

const TARGET_URL = process.env.COINRAILZ_BASE_URL || "https://coinrailz.com";

interface ServiceResult {
  name: string;
  priceUsd: number;
  status: number;
  success: boolean;
  durationMs: number;
  error?: string;
}

async function runAllServicesOnce(phase: "cheap" | "expensive" | "all", startIdx = 0) {
  const privateKey = process.env.X402_BUYER_PRIVATE_KEY || process.env.EVM_PRIVATE_KEY;
  if (!privateKey) {
    console.error("ERROR: No private key found");
    process.exit(1);
  }

  const pk = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
  const account = privateKeyToAccount(pk as `0x${string}`);

  const { wrapFetchWithPaymentFromConfig } = await import("@x402/fetch");
  const { ExactEvmScheme } = await import("@x402/evm");

  const schemeClient = new ExactEvmScheme(account);
  const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [{ network: "eip155:*", client: schemeClient }],
  });

  const skipServices = ["fire-alerts"];

  let servicesToRun = SERVICES
    .filter(s => !skipServices.includes(s.name))
    .sort((a, b) => a.priceUsd - b.priceUsd);

  if (phase === "cheap") {
    servicesToRun = servicesToRun.filter(s => s.priceUsd < 1.00);
  } else if (phase === "expensive") {
    servicesToRun = servicesToRun.filter(s => s.priceUsd >= 1.00);
  }

  servicesToRun = servicesToRun.slice(startIdx);

  const totalCost = servicesToRun.reduce((s, sv) => s + sv.priceUsd, 0);
  console.log(`=== PRODUCTION TEST: ${phase.toUpperCase()} SERVICES (from idx ${startIdx}) ===`);
  console.log(`Buyer: ${account.address}`);
  console.log(`Services: ${servicesToRun.length} | Cost: $${totalCost.toFixed(2)} USDC\n`);

  const results: ServiceResult[] = [];
  let spent = 0;

  for (let i = 0; i < servicesToRun.length; i++) {
    const svc = servicesToRun[i];
    const url = `${TARGET_URL}/x402/${svc.name}`;
    process.stdout.write(`[${startIdx + i + 1}] ${svc.name} ($${svc.priceUsd})... `);

    const start = Date.now();
    try {
      const response = await fetchWithPayment(url, {
        method: svc.method,
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "User-Agent": `ProductionTestAgent/1.0 (x402; phase-${phase})`,
        },
        body: JSON.stringify(svc.body),
      });

      const elapsed = Date.now() - start;
      const success = response.status >= 200 && response.status < 300;

      if (success) {
        spent += svc.priceUsd;
        console.log(`OK ${elapsed}ms`);
      } else {
        const text = await response.text();
        console.log(`FAIL ${response.status} (${elapsed}ms): ${text.substring(0, 100)}`);
      }

      results.push({ name: svc.name, priceUsd: svc.priceUsd, status: response.status, success, durationMs: elapsed, error: success ? undefined : `HTTP ${response.status}` });
    } catch (err: any) {
      const elapsed = Date.now() - start;
      console.log(`ERR (${elapsed}ms): ${err.message?.substring(0, 120)}`);
      results.push({ name: svc.name, priceUsd: svc.priceUsd, status: 0, success: false, durationMs: elapsed, error: err.message?.substring(0, 200) });
    }

    if (i < servicesToRun.length - 1) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  const ok = results.filter(r => r.success);
  const fail = results.filter(r => !r.success);

  console.log(`\n=== RESULTS: ${ok.length}/${results.length} passed | $${spent.toFixed(2)} spent ===`);
  if (fail.length > 0) {
    console.log("FAILURES:");
    fail.forEach(f => console.log(`  ${f.name} ($${f.priceUsd}): ${f.error}`));
  }

  return results;
}

const phase = (process.argv[2] || "cheap") as "cheap" | "expensive" | "all";
const startIdx = parseInt(process.argv[3] || "0", 10);
runAllServicesOnce(phase, startIdx).catch(err => {
  console.error("FATAL:", err);
  process.exit(1);
});
