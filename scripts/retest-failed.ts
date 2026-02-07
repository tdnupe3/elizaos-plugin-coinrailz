import { SERVICES, CallResult } from "./organic-x402-traffic";
import { privateKeyToAccount } from "viem/accounts";

const BASE_URL = "https://coinrailz.com";

async function retestFailed() {
  const { wrapFetchWithPaymentFromConfig } = await import("@x402/fetch");
  const { ExactEvmScheme } = await import("@x402/evm");

  const pk = process.env.X402_BUYER_PRIVATE_KEY;
  if (!pk) { console.error("X402_BUYER_PRIVATE_KEY required"); process.exit(1); }

  const normalizedPk = pk.startsWith("0x") ? pk : `0x${pk}`;
  const account = privateKeyToAccount(normalizedPk as `0x${string}`);
  console.log(`Buyer: ${account.address}`);

  const schemeClient = new ExactEvmScheme(account);
  const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [{ network: "eip155:*", client: schemeClient }],
  });

  const failedNames = ["token-metadata", "trending-tokens", "dex-liquidity", "token-sentiment", "polymarket-search"];
  const testServices = SERVICES.filter(s => failedNames.includes(s.name));

  console.log(`\nRe-testing ${testServices.length} previously failed services with 5s delays\n`);

  for (let i = 0; i < testServices.length; i++) {
    const service = testServices[i];
    const url = `${BASE_URL}/x402/${service.name}`;

    console.log(`[${i + 1}/${testServices.length}] ${service.name} ($${service.priceUsd})...`);
    console.log(`  Body: ${JSON.stringify(service.body)}`);

    const start = Date.now();
    try {
      const response = await fetchWithPayment(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json", "User-Agent": "CoinRailz-Retest/1.0" },
        body: JSON.stringify(service.body),
      });
      const durationMs = Date.now() - start;
      const text = await response.text();
      const statusIcon = response.status >= 200 && response.status < 300 ? "OK" : `ERR:${response.status}`;
      console.log(`  [${statusIcon}] ${durationMs}ms`);
      if (response.status >= 400) {
        console.log(`  Response: ${text.substring(0, 300)}`);
      }
    } catch (err: any) {
      console.log(`  [FAIL] ${err.message?.substring(0, 200)}`);
    }

    if (i < testServices.length - 1) {
      console.log(`  Waiting 5s...\n`);
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

retestFailed().catch(console.error);
