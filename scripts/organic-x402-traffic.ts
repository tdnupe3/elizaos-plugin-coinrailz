import { privateKeyToAccount } from "viem/accounts";

const BASE_URL = process.env.COINRAILZ_BASE_URL || "https://coinrailz.com";
const CDP_FACILITATOR_URL = "https://api.cdp.coinbase.com/platform/v2/x402";

function getPlatformWallet(): string {
  return process.env.PLATFORM_WALLET_ADDRESS || "0xa4bBE37f9A6Ae2dc36a607B91eB148C0ae163C91";
}

interface ServiceConfig {
  name: string;
  priceUsd: number;
  weight: number;
  method: "POST" | "GET";
  body: Record<string, any>;
  userAgentCategory: "defi-bot" | "research-agent" | "infrastructure" | "data-agent" | "trading-bot";
}

const USER_AGENTS: Record<string, string[]> = {
  "defi-bot": [
    "DeFiAgent/2.1 (Base; x402-compatible)",
    "AutoTrader/1.4.0 (EVM; autonomous)",
    "YieldBot/3.0 x402/2.0",
    "MEV-Agent/0.9.1 (Base-mainnet)",
  ],
  "research-agent": [
    "ResearchGPT/1.0 (market-analysis; x402)",
    "DataMiner/2.3 (blockchain-intelligence)",
    "AgentLISA-clone/0.1 (research)",
    "CryptoAnalyst/1.2.0 x402-client",
  ],
  "infrastructure": [
    "InfraBot/1.0 (wallet-ops; CDP)",
    "ChainOps/2.0 (multi-chain; automated)",
    "DevOpsAgent/0.8 x402-enabled",
  ],
  "data-agent": [
    "SatelliteReader/1.0 (earth-observation; x402)",
    "IoTCollector/2.1 (sensor-data)",
    "WeatherAgent/1.3 (climate-data; automated)",
    "FleetMonitor/0.5 (telematics; realtime)",
  ],
  "trading-bot": [
    "AlphaSeeker/3.2 (signals; x402)",
    "PolyBot/1.0 (prediction-markets; automated)",
    "SentimentTrader/2.0 (NLP; x402-client)",
    "ArbitrageAgent/1.1 (cross-chain)",
  ],
};

const SERVICES: ServiceConfig[] = [
  { name: "gas-price-oracle", priceUsd: 0.10, weight: 12, method: "POST", body: { chain: "base", urgency: "standard" }, userAgentCategory: "defi-bot" },
  { name: "token-metadata", priceUsd: 0.10, weight: 11, method: "POST", body: { token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", chain: "base" }, userAgentCategory: "defi-bot" },
  { name: "token-price", priceUsd: 0.25, weight: 10, method: "POST", body: { token: "ETH", vs: "usd" }, userAgentCategory: "trading-bot" },
  { name: "trade-signals", priceUsd: 0.75, weight: 8, method: "POST", body: { pair: "ETH/USDC", timeframe: "1h", indicators: ["RSI", "MACD"] }, userAgentCategory: "trading-bot" },
  { name: "wallet-risk", priceUsd: 0.50, weight: 7, method: "POST", body: { address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", chain: "ethereum" }, userAgentCategory: "research-agent" },
  { name: "trending-tokens", priceUsd: 0.50, weight: 7, method: "POST", body: { chain: "base", limit: 10, timeframe: "24h" }, userAgentCategory: "defi-bot" },
  { name: "multi-chain-balance", priceUsd: 0.50, weight: 5, method: "POST", body: { address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", chains: ["base", "ethereum", "polygon"] }, userAgentCategory: "infrastructure" },
  { name: "dex-liquidity", priceUsd: 0.20, weight: 6, method: "POST", body: { pair: "ETH/USDC", dex: "uniswap-v3", chain: "base" }, userAgentCategory: "defi-bot" },
  { name: "token-sentiment", priceUsd: 0.25, weight: 6, method: "POST", body: { token: "ETH", sources: ["twitter", "reddit"] }, userAgentCategory: "research-agent" },
  { name: "whale-alerts", priceUsd: 0.35, weight: 5, method: "POST", body: { chain: "base", minValueUsd: 100000, token: "USDC" }, userAgentCategory: "trading-bot" },
  { name: "batch-quote", priceUsd: 0.40, weight: 4, method: "POST", body: { pairs: ["ETH/USDC", "WBTC/USDC"], chain: "base" }, userAgentCategory: "defi-bot" },
  { name: "portfolio-tracker", priceUsd: 0.50, weight: 4, method: "POST", body: { address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", includeDefi: true }, userAgentCategory: "research-agent" },
  { name: "contract-scan", priceUsd: 1.00, weight: 3, method: "POST", body: { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", chain: "base" }, userAgentCategory: "infrastructure" },
  { name: "payment-processing", priceUsd: 0.50, weight: 3, method: "POST", body: { amount: "1.00", token: "USDC", chain: "base", recipient: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" }, userAgentCategory: "infrastructure" },
  { name: "transaction-builder", priceUsd: 0.30, weight: 4, method: "POST", body: { type: "transfer", token: "USDC", amount: "10", to: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", chain: "base" }, userAgentCategory: "defi-bot" },
  { name: "approval-manager", priceUsd: 0.20, weight: 4, method: "POST", body: { token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", spender: "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD", chain: "base" }, userAgentCategory: "defi-bot" },
  { name: "fire-alerts", priceUsd: 0.05, weight: 6, method: "POST", body: { lat: 34.05, lon: -118.24, radius_km: 50 }, userAgentCategory: "data-agent" },
  { name: "weather-imagery", priceUsd: 0.05, weight: 5, method: "POST", body: { lat: 37.77, lon: -122.42, layer: "MODIS_Terra_CorrectedReflectance_TrueColor" }, userAgentCategory: "data-agent" },
  { name: "air-quality", priceUsd: 0.05, weight: 5, method: "POST", body: { lat: 40.71, lon: -74.01, pollutant: "NO2" }, userAgentCategory: "data-agent" },
  { name: "vegetation", priceUsd: 0.10, weight: 3, method: "POST", body: { lat: 38.90, lon: -77.04, radius_km: 10 }, userAgentCategory: "data-agent" },
  { name: "flood-detection", priceUsd: 0.10, weight: 3, method: "POST", body: { lat: 29.76, lon: -95.37, radius_km: 25 }, userAgentCategory: "data-agent" },
  { name: "land-use", priceUsd: 0.15, weight: 2, method: "POST", body: { lat: 41.88, lon: -87.63, radius_km: 5 }, userAgentCategory: "data-agent" },
  { name: "polymarket-events", priceUsd: 0.25, weight: 5, method: "POST", body: { category: "politics", limit: 5 }, userAgentCategory: "trading-bot" },
  { name: "polymarket-search", priceUsd: 0.25, weight: 4, method: "POST", body: { query: "bitcoin price", limit: 5 }, userAgentCategory: "trading-bot" },
  { name: "polymarket-odds", priceUsd: 0.50, weight: 3, method: "POST", body: { marketId: "will-bitcoin-reach-100k", resolution: "yes" }, userAgentCategory: "trading-bot" },
  { name: "prediction-market-odds", priceUsd: 0.50, weight: 2, method: "POST", body: { market: "presidential-election-2028", outcome: "democrat" }, userAgentCategory: "trading-bot" },
  { name: "stock-sentiment", priceUsd: 0.40, weight: 4, method: "POST", body: { ticker: "COIN", sources: ["news", "social"] }, userAgentCategory: "research-agent" },
  { name: "forex-sentiment", priceUsd: 0.40, weight: 3, method: "POST", body: { pair: "EUR/USD", timeframe: "1d" }, userAgentCategory: "research-agent" },
  { name: "sentiment-analysis", priceUsd: 0.50, weight: 4, method: "POST", body: { text: "Bitcoin is showing strong bullish momentum", context: "crypto" }, userAgentCategory: "research-agent" },
  { name: "fraud-detection", priceUsd: 0.75, weight: 3, method: "POST", body: { address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", chain: "base" }, userAgentCategory: "infrastructure" },
  { name: "credit-risk-score", priceUsd: 1.25, weight: 2, method: "POST", body: { address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", chain: "ethereum" }, userAgentCategory: "infrastructure" },
  { name: "compliance-check", priceUsd: 1.75, weight: 1, method: "POST", body: { address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", jurisdiction: "US" }, userAgentCategory: "infrastructure" },
  { name: "correlation-matrix", priceUsd: 0.75, weight: 3, method: "POST", body: { tokens: ["ETH", "BTC", "SOL"], timeframe: "30d" }, userAgentCategory: "research-agent" },
  { name: "risk-metrics", priceUsd: 1.00, weight: 2, method: "POST", body: { portfolio: ["ETH", "USDC", "BTC"], weights: [0.5, 0.3, 0.2] }, userAgentCategory: "research-agent" },
  { name: "arbitrage-scanner", priceUsd: 1.25, weight: 2, method: "POST", body: { token: "USDC", chains: ["base", "polygon", "arbitrum"], minSpreadBps: 10 }, userAgentCategory: "trading-bot" },
  { name: "property-valuation", priceUsd: 0.75, weight: 2, method: "POST", body: { address: "123 Main St, San Francisco, CA", type: "residential" }, userAgentCategory: "research-agent" },
  { name: "lease-analysis", priceUsd: 1.00, weight: 1, method: "POST", body: { propertyType: "commercial", sqft: 2000, location: "Manhattan, NY" }, userAgentCategory: "research-agent" },
  { name: "construction-progress", priceUsd: 1.50, weight: 1, method: "POST", body: { projectId: "proj-001", milestone: "foundation" }, userAgentCategory: "data-agent" },
  { name: "trading-signal", priceUsd: 1.00, weight: 3, method: "POST", body: { asset: "ETH", strategy: "momentum", timeframe: "4h" }, userAgentCategory: "trading-bot" },
  { name: "portfolio-optimization", priceUsd: 2.00, weight: 1, method: "POST", body: { assets: ["ETH", "BTC", "SOL", "USDC"], riskTolerance: "moderate" }, userAgentCategory: "research-agent" },
  { name: "fleet-telematics", priceUsd: 0.10, weight: 3, method: "POST", body: { vehicleId: "truck-042", dataType: "location" }, userAgentCategory: "data-agent" },
  { name: "weather-station-data", priceUsd: 0.05, weight: 4, method: "POST", body: { stationId: "ws-nyc-01", metrics: ["temperature", "humidity"] }, userAgentCategory: "data-agent" },
  { name: "iot-sensor-reading", priceUsd: 0.025, weight: 5, method: "POST", body: { deviceId: "sensor-temp-001", sensorType: "temperature" }, userAgentCategory: "data-agent" },
  { name: "iot-device-stream", priceUsd: 0.25, weight: 2, method: "POST", body: { deviceId: "cam-001", streamType: "telemetry", duration: 60 }, userAgentCategory: "data-agent" },
  { name: "iot-bulk-data", priceUsd: 0.50, weight: 1, method: "POST", body: { deviceId: "fleet-gps-001", from: "2025-01-01", to: "2025-01-31", format: "csv" }, userAgentCategory: "data-agent" },
  { name: "ping", priceUsd: 0.25, weight: 3, method: "POST", body: { echo: "health-check" }, userAgentCategory: "infrastructure" },
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function weightedRandomService(services: ServiceConfig[]): ServiceConfig {
  const totalWeight = services.reduce((sum, s) => sum + s.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const svc of services) {
    roll -= svc.weight;
    if (roll <= 0) return svc;
  }
  return services[services.length - 1];
}

function randomDelay(minMs: number, maxMs: number): number {
  return Math.floor(minMs + Math.random() * (maxMs - minMs));
}

function jitterBody(body: Record<string, any>): Record<string, any> {
  const jittered = { ...body };
  if (jittered.lat && typeof jittered.lat === "number") {
    jittered.lat += (Math.random() - 0.5) * 0.1;
    jittered.lat = parseFloat(jittered.lat.toFixed(4));
  }
  if (jittered.lon && typeof jittered.lon === "number") {
    jittered.lon += (Math.random() - 0.5) * 0.1;
    jittered.lon = parseFloat(jittered.lon.toFixed(4));
  }
  if (jittered.limit && typeof jittered.limit === "number") {
    jittered.limit = Math.max(1, jittered.limit + Math.floor(Math.random() * 5) - 2);
  }
  return jittered;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface RunConfig {
  maxCalls: number;
  minDelayMs: number;
  maxDelayMs: number;
  dryRun: boolean;
  privateKey: string;
  targetUrl: string;
  excludeServices: string[];
  onlyServices: string[];
}

interface CallResult {
  service: string;
  priceUsd: number;
  status: number;
  success: boolean;
  txHash?: string;
  error?: string;
  durationMs: number;
  timestamp: string;
  userAgent: string;
}

async function runOrganicTraffic(config: RunConfig): Promise<CallResult[]> {
  const { wrapFetchWithPaymentFromConfig } = await import("@x402/fetch");
  const { ExactEvmScheme } = await import("@x402/evm");

  const pk = config.privateKey.startsWith("0x") ? config.privateKey : `0x${config.privateKey}`;
  const account = privateKeyToAccount(pk as `0x${string}`);
  const buyerAddress = account.address;
  const platformWallet = getPlatformWallet();

  console.log(`Buyer wallet: ${buyerAddress}`);
  console.log(`Platform wallet: ${platformWallet}`);
  console.log(`CDP Facilitator: ${CDP_FACILITATOR_URL}`);

  if (buyerAddress.toLowerCase() === platformWallet.toLowerCase()) {
    if (!config.dryRun) {
      throw new Error("ABORT: Buyer wallet is the same as platform wallet. Use a different EVM_PRIVATE_KEY for live runs.");
    }
    console.log("⚠️ WARNING: Buyer wallet matches platform wallet. OK for dry run, would fail in live mode.");
  }

  const schemeClient = new ExactEvmScheme(account);

  const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [
      {
        network: "eip155:*",
        client: schemeClient,
      },
    ],
  });

  let availableServices = SERVICES.filter(
    s => !config.excludeServices.includes(s.name)
  );
  if (config.onlyServices.length > 0) {
    availableServices = availableServices.filter(s => config.onlyServices.includes(s.name));
  }

  if (availableServices.length === 0) {
    throw new Error("No services available after filtering");
  }

  const results: CallResult[] = [];
  let totalSpent = 0;

  console.log(`\nStarting organic traffic run:`);
  console.log(`  Target: ${config.targetUrl}`);
  console.log(`  Max calls: ${config.maxCalls}`);
  console.log(`  Delay range: ${config.minDelayMs/1000}s - ${config.maxDelayMs/1000}s`);
  console.log(`  Available services: ${availableServices.length}`);
  console.log(`  Dry run: ${config.dryRun}`);
  console.log(`  Buyer: ${buyerAddress}\n`);

  for (let i = 0; i < config.maxCalls; i++) {
    const service = weightedRandomService(availableServices);
    const userAgent = pickRandom(USER_AGENTS[service.userAgentCategory]);
    const body = jitterBody(service.body);
    const url = `${config.targetUrl}/x402/${service.name}`;
    const timestamp = new Date().toISOString();

    console.log(`[${i + 1}/${config.maxCalls}] ${service.name} ($${service.priceUsd}) via ${userAgent.split("/")[0]}...`);

    if (config.dryRun) {
      results.push({
        service: service.name,
        priceUsd: service.priceUsd,
        status: 0,
        success: false,
        error: "DRY_RUN",
        durationMs: 0,
        timestamp,
        userAgent,
      });
      console.log(`  [DRY RUN] Would call ${url} with body: ${JSON.stringify(body).substring(0, 80)}...`);
    } else {
      const start = Date.now();
      try {
        const response = await fetchWithPayment(url, {
          method: service.method,
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": userAgent,
          },
          body: JSON.stringify(body),
        });

        const durationMs = Date.now() - start;
        const responseData = await response.text();
        let txHash: string | undefined;

        const paymentResponse = response.headers.get("payment-response");
        if (paymentResponse) {
          try {
            const decoded = JSON.parse(
              Buffer.from(paymentResponse, "base64").toString()
            );
            txHash = decoded?.txHash || decoded?.transactionHash;
          } catch {
            // not base64 json, might be raw
          }
        }

        const result: CallResult = {
          service: service.name,
          priceUsd: service.priceUsd,
          status: response.status,
          success: response.status >= 200 && response.status < 300,
          txHash,
          durationMs,
          timestamp,
          userAgent,
        };

        if (!result.success) {
          result.error = responseData.substring(0, 200);
        }

        results.push(result);
        totalSpent += service.priceUsd;

        const statusIcon = result.success ? "OK" : `ERR:${response.status}`;
        console.log(`  [${statusIcon}] ${durationMs}ms${txHash ? ` tx:${txHash.substring(0, 10)}...` : ""}`);
      } catch (err: any) {
        const durationMs = Date.now() - start;
        results.push({
          service: service.name,
          priceUsd: service.priceUsd,
          status: 0,
          success: false,
          error: err.message?.substring(0, 200),
          durationMs,
          timestamp,
          userAgent,
        });
        console.log(`  [FAIL] ${err.message?.substring(0, 100)}`);
      }
    }

    if (i < config.maxCalls - 1) {
      const delay = randomDelay(config.minDelayMs, config.maxDelayMs);
      console.log(`  Waiting ${(delay / 1000).toFixed(1)}s before next call...\n`);
      await sleep(delay);
    }
  }

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success && r.error !== "DRY_RUN").length;

  console.log(`\n=== Run Complete ===`);
  console.log(`  Total calls: ${results.length}`);
  console.log(`  Successful: ${successCount}`);
  console.log(`  Failed: ${failCount}`);
  console.log(`  Total spent: $${totalSpent.toFixed(2)} USDC`);
  console.log(`  Unique services hit: ${new Set(results.map(r => r.service)).size}`);

  return results;
}

if (typeof require !== "undefined" && require.main === module) {
  const privateKey = process.env.X402_BUYER_PRIVATE_KEY || process.env.EVM_PRIVATE_KEY;
  if (!privateKey) {
    console.error("ERROR: X402_BUYER_PRIVATE_KEY or EVM_PRIVATE_KEY environment variable required");
    process.exit(1);
  }

  const maxCalls = parseInt(process.env.X402_MAX_CALLS || "5", 10);
  const minDelay = parseInt(process.env.X402_MIN_DELAY_MS || "30000", 10);
  const maxDelay = parseInt(process.env.X402_MAX_DELAY_MS || "180000", 10);
  const dryRun = process.env.X402_DRY_RUN === "true";
  const targetUrl = process.env.X402_TARGET_URL || BASE_URL;
  const excludeStr = process.env.X402_EXCLUDE_SERVICES || "verified-agent-identity,compliance-consultation,smart-contract-audit,instant-agent-wallet,agent-create-wallet,seamless-chain-bridge,instant-api-key";
  const onlyStr = process.env.X402_ONLY_SERVICES || "";

  runOrganicTraffic({
    maxCalls,
    minDelayMs: minDelay,
    maxDelayMs: maxDelay,
    dryRun,
    privateKey,
    targetUrl,
    excludeServices: excludeStr.split(",").filter(Boolean),
    onlyServices: onlyStr.split(",").filter(Boolean),
  })
    .then(results => {
      console.log("\nResults JSON:");
      console.log(JSON.stringify(results, null, 2));
    })
    .catch(err => {
      console.error("FATAL:", err.message);
      process.exit(1);
    });
}

export { runOrganicTraffic, RunConfig, CallResult, SERVICES, USER_AGENTS };
