import axios from "axios";

const BASE = "https://coinrailz.com";

const wellknown = [
  "/.well-known/agent-card.json",
  "/.well-known/x402.json",
  "/.well-known/payment-methods.json",
  "/.well-known/pricing.json"
];

const services = [
  "gas-price-oracle",
  "token-metadata",
  "dex-liquidity",
  "approval-manager",
  "token-sentiment",
  "token-price",
  "transaction-builder",
  "whale-alerts",
  "batch-quote",
  "multi-chain-balance",
  "portfolio-tracker",
  "trending-tokens",
  "wallet-risk",
  "trade-signals",
  "contract-quick-scan",
  "instant-agent-wallet",
  "seamless-chain-bridge",
  "verified-agent-identity"
];

async function getJson(url) {
  try {
    const res = await axios.post(url, {}, { timeout: 7000, validateStatus: () => true });
    return { ok: true, status: res.status, data: res.data };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

(async () => {
  console.log("🔍 Checking .well-known endpoints:\n");
  for (const path of wellknown) {
    const url = `${BASE}${path}`;
    try {
      const res = await axios.get(url, { timeout: 7000 });
      console.log(`✅ ${url} — status=${res.status}`);
    } catch (e) {
      console.log(`❌ ${url} — ERROR: ${e.message}`);
    }
  }

  console.log("\n🔍 Checking x402 services:\n");

  for (const service of services) {
    const url = `${BASE}/x402/${service}`;
    const result = await getJson(url);

    if (!result.ok) {
      console.log(`❌ ${service} — ERROR: ${result.error}`);
      continue;
    }

    const body = result.data;
    const accepts = body?.accepts || [];
    const first = accepts[0];

    const resource = first?.resource;
    const discoverable = first?.discoverable;

    const resourceOk =
      typeof resource === "string" &&
      resource.startsWith("https://coinrailz.com/x402/");

    console.log(
      `${resourceOk && discoverable ? "✅" : "⚠️"} ${service} — status=${result.status} — resource=${resource} — discoverable=${discoverable}`
    );
  }

  console.log("\n🏁 Diagnostics complete.\n");
})();
