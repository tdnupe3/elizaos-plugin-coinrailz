/**
 * Bazaar Bulk Payment Script
 * 
 * Pays for ALL x402 services through the Coinbase Bazaar facilitator
 * to trigger indexing of every service in Bazaar's registry.
 * 
 * Uses V1 format (proven to work from bazaar-direct-settle.ts):
 *   x402Version: 1, network: "base", scheme: "exact"
 * 
 * Budget estimate: ~$5 USDC (68 routes, mostly $0.05, 5 NASA routes at $0.25, 1 at $1.00)
 * Safety cap: skips any route priced above $1.00
 * Non-402 routes are automatically skipped with no USDC spent
 */

import { privateKeyToAccount } from 'viem/accounts';
import { createWalletClient, http, formatUnits } from 'viem';
import { base } from 'viem/chains';
import { createPaymentHeader } from 'x402/client';
import { createFacilitatorConfig } from '@coinbase/x402';

const BASE_URL = 'https://coinrailz.com';
const BAZAAR_URL = 'https://api.cdp.coinbase.com/platform/v2/x402';
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

// All x402 payment-gated services across the platform.
// Non-402 routes (admin/utility) are automatically skipped — no USDC wasted.
// Safety cap: any route priced above $1.00 is skipped automatically.
const TARGET_SERVICES = [
  // ── Core DeFi / Market Data ──────────────────────────────────────────
  { path: '/x402/gas-price-oracle',        method: 'GET',  body: null },
  { path: '/x402/token-price',             method: 'POST', body: { token: 'ETH', chain: 'base' } },
  { path: '/x402/token-price-lookup',      method: 'POST', body: { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', chain: 'base' } },
  { path: '/x402/token-metadata',          method: 'POST', body: { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', chain: 'base' } },
  { path: '/x402/token-sentiment',         method: 'POST', body: { token: 'ETH' } },
  { path: '/x402/trending-tokens',         method: 'GET',  body: null },
  { path: '/x402/whale-alerts',            method: 'GET',  body: null },
  { path: '/x402/trade-signals',           method: 'POST', body: { pair: 'ETH/USDC', chain: 'base' } },
  { path: '/x402/trading-signal',          method: 'POST', body: { pair: 'ETH/USDC' } },
  { path: '/x402/dex-liquidity',           method: 'POST', body: { pair: 'ETH/USDC', chain: 'base' } },
  { path: '/x402/arbitrage-scanner',       method: 'GET',  body: null },
  { path: '/x402/batch-quote',             method: 'POST', body: { tokens: ['ETH', 'USDC', 'BTC'] } },
  { path: '/x402/stock-sentiment',         method: 'POST', body: { ticker: 'COIN' } },
  { path: '/x402/forex-sentiment',         method: 'POST', body: { pair: 'EUR/USD' } },
  { path: '/x402/sentiment-analysis',      method: 'POST', body: { text: 'ETH looks bullish on Base' } },
  { path: '/x402/correlation-matrix',      method: 'POST', body: { assets: ['ETH', 'BTC', 'SOL'] } },
  { path: '/x402/risk-metrics',            method: 'POST', body: { portfolio: ['ETH', 'USDC'] } },
  { path: '/x402/portfolio-tracker',       method: 'POST', body: { address: '0x5837A864C03912ea14a5609968F73E75B9d42a7C' } },
  { path: '/x402/portfolio-optimization',  method: 'POST', body: { assets: ['ETH', 'BTC', 'USDC'] } },

  // ── Wallet / Chain Infrastructure ───────────────────────────────────
  { path: '/x402/wallet-risk',             method: 'POST', body: { address: '0x5837A864C03912ea14a5609968F73E75B9d42a7C', chain: 'base' } },
  { path: '/x402/multi-chain-balance',     method: 'POST', body: { address: '0x5837A864C03912ea14a5609968F73E75B9d42a7C' } },
  { path: '/x402/contract-scan',           method: 'POST', body: { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', chain: 'base' } },
  { path: '/x402/transaction-builder',     method: 'POST', body: { to: '0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91', amount: '1', token: 'USDC', chain: 'base' } },
  { path: '/x402/approval-manager',        method: 'POST', body: { token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', spender: '0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91', amount: '100' } },
  { path: '/x402/seamless-chain-bridge',   method: 'POST', body: { fromChain: 'base', toChain: 'ethereum', amount: '1', token: 'USDC' } },
  { path: '/x402/fraud-detection',         method: 'POST', body: { address: '0x5837A864C03912ea14a5609968F73E75B9d42a7C' } },
  { path: '/x402/compliance-check',        method: 'POST', body: { address: '0x5837A864C03912ea14a5609968F73E75B9d42a7C' } },
  { path: '/x402/compliance-consultation', method: 'POST', body: { query: 'DeFi compliance for Base' } },
  { path: '/x402/smart-contract-audit',    method: 'POST', body: { contractAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' } },
  { path: '/x402/credit-risk-score',       method: 'POST', body: { address: '0x5837A864C03912ea14a5609968F73E75B9d42a7C' } },
  { path: '/x402/payment-processing',      method: 'POST', body: { amount: '1.00', token: 'USDC', chain: 'base' } },

  // ── Agent Identity & Wallets ─────────────────────────────────────────
  { path: '/x402/first-call',              method: 'POST', body: { prompt: 'ping' } },
  { path: '/x402/ai-inference',            method: 'POST', body: { prompt: 'What is Base?', model: 'gpt-4o-mini' } },
  { path: '/x402/agent-create-wallet',     method: 'POST', body: { agentId: 'bazaar-probe-001' } },
  { path: '/x402/instant-agent-wallet',    method: 'POST', body: {} },
  { path: '/x402/verified-agent-identity', method: 'POST', body: { agentId: 'bazaar-probe-001' } },
  { path: '/x402/solana-yield-finder',     method: 'GET',  body: null },

  // ── Prediction Markets ───────────────────────────────────────────────
  { path: '/x402/polymarket-odds',         method: 'GET',  body: null },
  { path: '/x402/polymarket-events',       method: 'GET',  body: null },
  { path: '/x402/polymarket-search',       method: 'POST', body: { query: 'crypto' } },
  { path: '/x402/kalshi-markets',          method: 'GET',  body: null },
  { path: '/x402/kalshi-odds',             method: 'GET',  body: null },
  { path: '/x402/kalshi-search',           method: 'POST', body: { query: 'crypto' } },
  { path: '/x402/prediction-market-odds',  method: 'GET',  body: null },

  // ── Real Estate / Alternative Data ───────────────────────────────────
  { path: '/x402/property-valuation',      method: 'POST', body: { address: '123 Main St, San Francisco, CA' } },
  { path: '/x402/lease-analysis',          method: 'POST', body: { address: '123 Main St', squareFeet: 1000 } },
  { path: '/x402/construction-progress',   method: 'POST', body: { projectId: 'proj-001' } },

  // ── IoT / DePIN ──────────────────────────────────────────────────────
  { path: '/x402/iot-device-stream',       method: 'POST', body: { deviceId: 'test-device-001', dataType: 'temperature' } },
  { path: '/x402/iot-sensor-reading',      method: 'POST', body: { deviceId: 'test-device-001', sensorType: 'temperature' } },
  { path: '/x402/iot-bulk-data',           method: 'POST', body: { deviceId: 'test-device-001' } },
  { path: '/x402/fleet-telematics',        method: 'POST', body: { vehicleId: 'vehicle-001' } },
  { path: '/x402/weather-station-data',    method: 'POST', body: { stationId: 'station-001' } },

  // ── Satellite / Earth Observation ────────────────────────────────────
  { path: '/x402/satellite-earthdata',     method: 'POST', body: { lat: 37.7749, lon: -122.4194 } },
  { path: '/x402/fire-alerts',             method: 'POST', body: { lat: 37.7749, lon: -122.4194 } },
  { path: '/x402/flood-detection',         method: 'POST', body: { lat: 37.7749, lon: -122.4194 } },
  { path: '/x402/air-quality',             method: 'POST', body: { lat: 37.7749, lon: -122.4194 } },
  { path: '/x402/weather-imagery',         method: 'POST', body: { lat: 37.7749, lon: -122.4194 } },
  { path: '/x402/vegetation',              method: 'POST', body: { lat: 37.7749, lon: -122.4194 } },
  { path: '/x402/land-use',                method: 'POST', body: { lat: 37.7749, lon: -122.4194 } },

  // ── NASA Earthdata (priced at $0.25 each) ────────────────────────────
  { path: '/x402/earthdata-ocean-color',   method: 'POST', body: { lat: 37.7749, lon: -122.4194 } },
  { path: '/x402/earthdata-sst',           method: 'POST', body: { lat: 37.7749, lon: -122.4194 } },
  { path: '/x402/earthdata-precipitation', method: 'POST', body: { lat: 37.7749, lon: -122.4194 } },
  { path: '/x402/earthdata-soil-moisture', method: 'POST', body: { lat: 37.7749, lon: -122.4194 } },
  { path: '/x402/earthdata-granules',      method: 'POST', body: { collection: 'MOD11A1', bbox: '-122.5,37.5,-122.0,38.0' } },
];

async function getUsdcBalance(address: `0x${string}`, client: ReturnType<typeof createWalletClient>) {
  const publicClient = (await import('viem')).createPublicClient({
    chain: base, transport: http('https://mainnet.base.org')
  });
  const bal = await publicClient.readContract({
    address: USDC_BASE,
    abi: [{ name: 'balanceOf', type: 'function', inputs: [{ name: 'a', type: 'address' }], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' }],
    functionName: 'balanceOf',
    args: [address]
  }) as bigint;
  return bal;
}

async function payService(
  service: typeof TARGET_SERVICES[0],
  walletClient: ReturnType<typeof createWalletClient>,
  account: ReturnType<typeof privateKeyToAccount>,
  authToken: string | null
): Promise<{ success: boolean; txHash?: string; error?: string; skipped?: boolean }> {
  
  const url = BASE_URL + service.path;
  
  // Fetch 402 challenge
  let challenge: { x402Version: number; accepts: Array<Record<string, unknown>> };
  try {
    const resp = await fetch(url, {
      method: service.method,
      headers: { 'Content-Type': 'application/json' },
      body: service.body ? JSON.stringify(service.body) : undefined
    });
    
    if (resp.status !== 402) {
      return { success: false, skipped: true, error: `Got ${resp.status} (not a 402 endpoint)` };
    }
    challenge = await resp.json();
  } catch (e: any) {
    return { success: false, error: `Fetch error: ${e.message}` };
  }

  // Find Base entry
  const baseEntry = challenge.accepts?.find(a => 
    a.network === 'eip155:8453' || a.network === 'base'
  ) as Record<string, unknown>;

  if (!baseEntry) {
    return { success: false, skipped: true, error: 'No Base network in accepts' };
  }

  // Build V1 requirements (network: "base")
  const requirements = {
    scheme: 'exact' as const,
    network: 'base',
    maxAmountRequired: String(baseEntry.maxAmountRequired),
    resource: String(baseEntry.resource),
    description: String(baseEntry.description ?? ''),
    mimeType: String(baseEntry.mimeType ?? 'application/json'),
    payTo: String(baseEntry.payTo),
    maxTimeoutSeconds: Number(baseEntry.maxTimeoutSeconds ?? 60),
    asset: String(baseEntry.asset),
    extra: baseEntry.extra as Record<string, unknown> ?? undefined,
  };

  // Check amount — skip if > $1 (avoid paying expensive services automatically)
  const amountUsdc = Number(requirements.maxAmountRequired) / 1_000_000;
  if (amountUsdc > 1.0) {
    return { success: false, skipped: true, error: `Amount $${amountUsdc.toFixed(2)} exceeds $1 limit` };
  }

  // Sign payment
  let paymentHeader: string;
  try {
    paymentHeader = await createPaymentHeader(walletClient as any, 1, requirements as any);
  } catch (e: any) {
    return { success: false, error: `Signing error: ${e.message}` };
  }
  const paymentPayload = JSON.parse(Buffer.from(paymentHeader, 'base64').toString('utf8'));

  // Call Bazaar /settle
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Correlation-Context': 'sdk_version=1.29.0,sdk_language=typescript,source=x402,source_version=0.7.1'
  };
  if (authToken) headers['Authorization'] = authToken;

  try {
    const settleResp = await fetch(`${BAZAAR_URL}/settle`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ x402Version: 1, paymentPayload, paymentRequirements: requirements })
    });

    const data = await settleResp.json() as { success: boolean; transaction?: string; errorMessage?: string; errorReason?: string };
    
    if (settleResp.status === 200 && data.success) {
      return { success: true, txHash: data.transaction };
    } else {
      return { success: false, error: `${data.errorReason || settleResp.status}: ${data.errorMessage || ''}` };
    }
  } catch (e: any) {
    return { success: false, error: `Settle error: ${e.message}` };
  }
}

async function main() {
  const buyerPk = process.env.X402_BUYER_PRIVATE_KEY;
  const cdpKeyId = process.env.CDP_API_KEY_ID;
  const cdpSecret = process.env.CDP_PRIVATE_KEY || process.env.CDP_API_KEY_SECRET;

  if (!buyerPk) { console.error('X402_BUYER_PRIVATE_KEY not set'); process.exit(1); }

  const key = (buyerPk.startsWith('0x') ? buyerPk : '0x' + buyerPk) as `0x${string}`;
  const account = privateKeyToAccount(key);

  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http('https://mainnet.base.org')
  });

  // Check balance
  const startBalance = await getUsdcBalance(account.address, walletClient);
  console.log('=== Bazaar Bulk Payment ===');
  console.log('Buyer wallet:', account.address);
  console.log('Starting USDC balance:', (Number(startBalance) / 1_000_000).toFixed(6));
  console.log('Services to attempt:', TARGET_SERVICES.length);
  console.log('');

  // Get CDP auth
  let authToken: string | null = null;
  if (cdpKeyId && cdpSecret) {
    try {
      const cfg = createFacilitatorConfig(cdpKeyId, cdpSecret);
      const authHeaders = await cfg.createAuthHeaders();
      authToken = (authHeaders as any).settle?.Authorization || null;
    } catch (e) {}
  }
  console.log('CDP auth:', authToken ? '✅ ready' : '⚠️ none');
  console.log('');

  const results: Array<{ path: string; success: boolean; txHash?: string; error?: string; skipped?: boolean }> = [];

  for (const service of TARGET_SERVICES) {
    process.stdout.write(`${service.path.padEnd(36)} → `);
    
    // Refresh auth token before each payment (JWT expires)
    if (cdpKeyId && cdpSecret) {
      try {
        const cfg = createFacilitatorConfig(cdpKeyId, cdpSecret);
        const authHeaders = await cfg.createAuthHeaders();
        authToken = (authHeaders as any).settle?.Authorization || null;
      } catch (e) {}
    }
    
    const result = await payService(service, walletClient, account, authToken);
    results.push({ path: service.path, ...result });
    
    if (result.success) {
      console.log(`✅ ${result.txHash?.slice(0, 20)}...`);
    } else if (result.skipped) {
      console.log(`⏭️  SKIPPED (${result.error})`);
    } else {
      console.log(`❌ ${result.error?.slice(0, 60)}`);
    }

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 500));
  }

  // Final balance
  const endBalance = await getUsdcBalance(account.address, walletClient);
  const spent = Number(startBalance - endBalance) / 1_000_000;

  console.log('\n=== SUMMARY ===');
  const succeeded = results.filter(r => r.success);
  const failed = results.filter(r => !r.success && !r.skipped);
  const skipped = results.filter(r => r.skipped);
  
  console.log(`✅ Succeeded: ${succeeded.length}`);
  console.log(`❌ Failed:    ${failed.length}`);
  console.log(`⏭️  Skipped:   ${skipped.length}`);
  console.log(`💰 Spent:     $${spent.toFixed(4)} USDC`);
  console.log(`💰 Remaining: ${(Number(endBalance) / 1_000_000).toFixed(4)} USDC`);
  
  if (succeeded.length > 0) {
    console.log('\nSuccessful payments (Bazaar indexed):');
    for (const r of succeeded) {
      console.log(`  ${r.path}`);
      console.log(`    TX: https://basescan.org/tx/${r.txHash}`);
    }
  }
  
  if (failed.length > 0) {
    console.log('\nFailed payments:');
    for (const r of failed) {
      console.log(`  ${r.path}: ${r.error}`);
    }
  }
}

main().catch(err => {
  console.error('Fatal:', err.message || err);
  process.exit(1);
});
