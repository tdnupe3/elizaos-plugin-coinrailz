/**
 * Bazaar Bulk Payment Script
 * 
 * Pays for multiple x402 services through the Coinbase Bazaar facilitator
 * to trigger indexing of all services not yet in Bazaar's registry.
 * 
 * Uses V1 format (proven to work from bazaar-direct-settle.ts):
 *   x402Version: 1, network: "base", scheme: "exact"
 * 
 * Budget: ~$3.45 USDC remaining (69 calls at $0.05)
 * Focus: Services most likely missing from Bazaar's March 17 index
 */

import { privateKeyToAccount } from 'viem/accounts';
import { createWalletClient, http, formatUnits } from 'viem';
import { base } from 'viem/chains';
import { createPaymentHeader } from 'x402/client';
import { createFacilitatorConfig } from '@coinbase/x402';

const BASE_URL = 'https://coinrailz.com';
const BAZAAR_URL = 'https://api.cdp.coinbase.com/platform/v2/x402';
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

// Services to pay for — prioritized by revenue/visibility potential
// Each must return a 402 with valid EIP-3009 authorization support
const TARGET_SERVICES = [
  // Core AI services (highest agent traffic)
  { path: '/x402/gas-price-oracle',       method: 'GET',  body: null },
  { path: '/x402/token-price',            method: 'POST', body: { token: 'ETH', chain: 'base' } },
  { path: '/x402/token-metadata',         method: 'POST', body: { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', chain: 'base' } },
  { path: '/x402/wallet-risk',            method: 'POST', body: { address: '0x5837A864C03912ea14a5609968F73E75B9d42a7C', chain: 'base' } },
  { path: '/x402/trade-signals',          method: 'POST', body: { pair: 'ETH/USDC', chain: 'base' } },
  { path: '/x402/token-sentiment',        method: 'POST', body: { token: 'ETH' } },
  { path: '/x402/trending-tokens',        method: 'GET',  body: null },
  { path: '/x402/whale-alerts',           method: 'GET',  body: null },
  { path: '/x402/dex-liquidity',          method: 'POST', body: { pair: 'ETH/USDC', chain: 'base' } },
  { path: '/x402/multi-chain-balance',    method: 'POST', body: { address: '0x5837A864C03912ea14a5609968F73E75B9d42a7C' } },
  { path: '/x402/contract-scan',          method: 'POST', body: { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', chain: 'base' } },
  { path: '/x402/portfolio-tracker',      method: 'POST', body: { address: '0x5837A864C03912ea14a5609968F73E75B9d42a7C' } },
  { path: '/x402/arbitrage-scanner',      method: 'GET',  body: null },
  { path: '/x402/transaction-builder',    method: 'POST', body: { to: '0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91', amount: '1', token: 'USDC', chain: 'base' } },
  // IoT / DePIN services
  { path: '/x402/iot-device-stream',      method: 'POST', body: { deviceId: 'test-device-001', dataType: 'temperature' } },
  { path: '/x402/fleet-telematics',       method: 'POST', body: { vehicleId: 'vehicle-001' } },
  { path: '/x402/weather-station',        method: 'POST', body: { stationId: 'station-001' } },
  { path: '/x402/fire-alert',             method: 'GET',  body: null },
  // Satellite / Earth observation
  { path: '/x402/satellite-weather',      method: 'POST', body: { lat: 37.7749, lon: -122.4194 } },
  { path: '/x402/vegetation-health',      method: 'POST', body: { lat: 37.7749, lon: -122.4194 } },
  // Prediction markets
  { path: '/x402/polymarket-odds',        method: 'GET',  body: null },
  { path: '/x402/kalshi-markets',         method: 'GET',  body: null },
  // Golden path
  { path: '/x402/first-call',             method: 'POST', body: { prompt: 'ping' } },
  // AI inference (already paid, will verify indexing)  
  { path: '/x402/ai-inference',           method: 'POST', body: { prompt: 'What is Base?', model: 'gpt-4o-mini' } },
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
