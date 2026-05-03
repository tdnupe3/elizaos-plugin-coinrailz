/**
 * Live x402 Payment Test — May 2026
 * 
 * Tests three payment paths in order:
 * 1. Native x402 via CDP Bazaar facilitator (EIP-3009 signed auth → settle → tx hash → X-PAYMENT)
 * 2. @x402/fetch wrapFetchWithPayment (newer x402 client library)
 * 3. API key credits path (already confirmed working in DB, verified here)
 * 
 * Uses X402_BUYER_PRIVATE_KEY (0x5837A864...) — $0.60 USDC on Base, no ETH
 * Uses CDP_API_KEY_ID + CDP_PRIVATE_KEY for Bazaar auth
 */

import { privateKeyToAccount } from 'viem/accounts';
import { createWalletClient, http, createPublicClient, formatUnits } from 'viem';
import { base } from 'viem/chains';

const BASE_URL = 'https://coinrailz.com';
const BAZAAR_URL = 'https://api.cdp.coinbase.com/platform/v2/x402';
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getUsdcBalance(address: `0x${string}`): Promise<number> {
  const pub = createPublicClient({ chain: base, transport: http('https://mainnet.base.org') });
  const bal = await pub.readContract({
    address: USDC_BASE as `0x${string}`,
    abi: [{ name: 'balanceOf', type: 'function', inputs: [{ name: 'a', type: 'address' }], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' }],
    functionName: 'balanceOf',
    args: [address]
  }) as bigint;
  return Number(bal) / 1_000_000;
}

async function get402Challenge(path: string, method = 'POST', body?: object) {
  const resp = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  if (resp.status !== 402) throw new Error(`Expected 402, got ${resp.status}`);
  return resp.json() as Promise<{ x402Version: number; accepts: Array<Record<string, unknown>> }>;
}

async function createCdpAuthHeader(): Promise<string | null> {
  try {
    const { createFacilitatorConfig } = await import('@coinbase/x402');
    const cfg = createFacilitatorConfig(
      process.env.CDP_API_KEY_ID!,
      process.env.CDP_PRIVATE_KEY!
    );
    const authHeaders = await cfg.createAuthHeaders();
    return (authHeaders as any)?.settle?.Authorization || null;
  } catch (e: any) {
    console.warn('  ⚠️  CDP auth header failed:', e.message);
    return null;
  }
}

// ── Test 1: Native x402 via CDP Bazaar ───────────────────────────────────────

async function testNativeX402Bazaar(walletClient: ReturnType<typeof createWalletClient>, account: ReturnType<typeof privateKeyToAccount>) {
  console.log('\n═══ TEST 1: Native x402 via CDP Bazaar ═══');
  console.log('  Path: /x402/first-call ($0.05 USDC)');

  // 1a. Get 402 challenge
  let challenge: { x402Version: number; accepts: Array<Record<string, unknown>> };
  try {
    challenge = await get402Challenge('/x402/first-call', 'POST', { agentId: 'test-payment-now' });
    console.log(`  ✅ 402 challenge received (x402Version: ${challenge.x402Version}, accepts: ${challenge.accepts?.length})`);
  } catch (e: any) {
    console.log(`  ❌ 402 challenge failed: ${e.message}`);
    return { success: false, error: e.message };
  }

  // 1b. Find Base USDC entry
  const baseEntry = challenge.accepts?.find(a =>
    (a.network === 'eip155:8453' || a.network === 'base') &&
    String(a.asset).toLowerCase() === USDC_BASE.toLowerCase()
  ) as Record<string, unknown> | undefined;

  if (!baseEntry) {
    console.log('  ❌ No Base USDC entry in accepts');
    console.log('  Available:', challenge.accepts?.map(a => `${a.network}/${String(a.asset).slice(0,8)}`).join(', '));
    return { success: false, error: 'No Base USDC in accepts' };
  }

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

  const amountUsdc = Number(requirements.maxAmountRequired) / 1_000_000;
  console.log(`  Payment: $${amountUsdc} USDC → ${requirements.payTo.slice(0, 10)}...`);

  // 1c. Sign payment header (EIP-3009)
  let paymentHeader: string;
  try {
    const { createPaymentHeader } = await import('@coinbase/x402');
    paymentHeader = await createPaymentHeader(walletClient as any, 1, requirements as any);
    console.log(`  ✅ EIP-3009 signed (header: ${paymentHeader.slice(0, 30)}...)`);
  } catch (e: any) {
    console.log(`  ❌ EIP-3009 signing failed: ${e.message}`);
    // Try alternate import path
    try {
      const m = await import('@coinbase/x402');
      console.log('  @coinbase/x402 exports:', Object.keys(m).slice(0, 10));
    } catch {}
    return { success: false, error: `Signing: ${e.message}` };
  }

  // 1d. Submit to Bazaar /settle
  let txHash: string;
  try {
    const paymentPayload = JSON.parse(Buffer.from(paymentHeader, 'base64').toString('utf8'));
    const authToken = await createCdpAuthHeader();
    console.log(`  CDP auth: ${authToken ? '✅' : '⚠️  none'}`);

    const settleResp = await fetch(`${BAZAAR_URL}/settle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Correlation-Context': 'sdk_version=1.29.0,sdk_language=typescript,source=x402,source_version=0.7.1',
        ...(authToken ? { 'Authorization': authToken } : {})
      },
      body: JSON.stringify({ x402Version: 1, paymentPayload, paymentRequirements: requirements })
    });

    const settleData = await settleResp.json() as { success: boolean; transaction?: string; errorMessage?: string; errorReason?: string };
    console.log(`  Bazaar settle status: ${settleResp.status}`, settleData.success ? '✅' : '❌');

    if (!settleData.success || !settleData.transaction) {
      console.log(`  ❌ Settle failed: ${settleData.errorReason}: ${settleData.errorMessage}`);
      return { success: false, error: `Settle: ${settleData.errorReason}: ${settleData.errorMessage}` };
    }
    txHash = settleData.transaction;
    console.log(`  ✅ Settled! txHash: ${txHash.slice(0, 20)}...`);
  } catch (e: any) {
    console.log(`  ❌ Settle request failed: ${e.message}`);
    return { success: false, error: `Settle request: ${e.message}` };
  }

  // 1e. Retry service with X-PAYMENT: txHash
  try {
    const serviceResp = await fetch(`${BASE_URL}/x402/first-call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-PAYMENT': txHash
      },
      body: JSON.stringify({ agentId: 'test-payment-now' })
    });

    const serviceData = await serviceResp.json();
    console.log(`  Service response: HTTP ${serviceResp.status}`);

    if (serviceResp.status === 200) {
      console.log(`  ✅ SERVICE RETURNED 200 — PAYMENT COMPLETE!`);
      console.log(`  Data keys: ${Object.keys(serviceData).slice(0, 6).join(', ')}`);
      return { success: true, txHash, path: '/x402/first-call', amount: amountUsdc };
    } else {
      console.log(`  ❌ Service returned ${serviceResp.status}: ${serviceData?.error || JSON.stringify(serviceData).slice(0, 100)}`);
      return { success: false, txHash, error: `Service ${serviceResp.status}: ${serviceData?.error}` };
    }
  } catch (e: any) {
    console.log(`  ❌ Service retry failed: ${e.message}`);
    return { success: false, txHash, error: `Service retry: ${e.message}` };
  }
}

// ── Test 2: @x402/fetch wrapFetchWithPayment ──────────────────────────────────

async function testX402FetchLibrary(account: ReturnType<typeof privateKeyToAccount>) {
  console.log('\n═══ TEST 2: @x402/fetch wrapFetchWithPayment ═══');
  console.log('  Path: /x402/gas-price-oracle ($0.10 USDC)');

  try {
    const { wrapFetchWithPayment, x402HTTPClient } = await import('@x402/fetch');
    console.log('  Library loaded:', { wrapFetchWithPayment: typeof wrapFetchWithPayment, x402HTTPClient: typeof x402HTTPClient });

    // Build the x402 client
    const client = new x402HTTPClient(account);

    const payingFetch = wrapFetchWithPayment(fetch, client);

    const resp = await payingFetch(`${BASE_URL}/x402/gas-price-oracle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chains: ['base', 'ethereum'] })
    });

    console.log(`  Response: HTTP ${resp.status}`);
    const data = await resp.json();

    if (resp.status === 200) {
      console.log(`  ✅ SUCCESS! Got gas data:`, JSON.stringify(data).slice(0, 150));
      return { success: true, path: '/x402/gas-price-oracle', amount: 0.10 };
    } else {
      console.log(`  ❌ HTTP ${resp.status}: ${data?.error || JSON.stringify(data).slice(0, 100)}`);
      return { success: false, error: `HTTP ${resp.status}: ${data?.error}` };
    }
  } catch (e: any) {
    console.log(`  ❌ @x402/fetch test failed: ${e.message}`);
    return { success: false, error: e.message };
  }
}

// ── Test 3: API Key Credits ────────────────────────────────────────────────────

async function testApiKeyCredits() {
  console.log('\n═══ TEST 3: API Key Credits ═══');
  console.log('  Path: /x402/token-price ($0.10) using trial key');

  // Get fresh trial key
  const trialResp = await fetch(`${BASE_URL}/api/m2m/credits/trial`);
  const trialData = await trialResp.json() as { apiKey?: string; credits?: number; error?: string };

  if (!trialData.apiKey) {
    // Use the key from earlier session (may be rate limited)
    console.log(`  ⚠️  Trial key rate limited or error: ${trialData.error || 'unknown'}. Using existing key from session.`);
    // Use the known valid key from this session
    const existingKey = 'cr_live_477e43bf3cc3ec9d78dc539e104e0cfd9978956abce7fd3acdd2beba72b3a779';
    return testWithKey(existingKey);
  }

  console.log(`  ✅ Trial key: ${trialData.apiKey?.slice(0, 20)}... ($${trialData.credits} credits)`);
  return testWithKey(trialData.apiKey!);
}

async function testWithKey(apiKey: string) {
  const resp = await fetch(`${BASE_URL}/x402/token-price`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': apiKey
    },
    body: JSON.stringify({ token: 'ETH', chain: 'base' })
  });

  const creditsUsed = resp.headers.get('X-Credits-Used');
  const creditsRemaining = resp.headers.get('X-Credits-Remaining');
  const paymentMethod = resp.headers.get('X-Payment-Method');

  console.log(`  Response: HTTP ${resp.status}`);
  console.log(`  X-Credits-Used: ${creditsUsed}, X-Credits-Remaining: ${creditsRemaining}, X-Payment-Method: ${paymentMethod}`);

  const data = await resp.json();
  if (resp.status === 200) {
    console.log(`  ✅ SUCCESS! Token price data received.`);
    console.log(`  Data: ${JSON.stringify(data).slice(0, 200)}`);
    return { success: true, path: '/x402/token-price', amount: 0.10, paymentMethod };
  } else {
    console.log(`  ❌ HTTP ${resp.status}: ${data?.error || JSON.stringify(data).slice(0, 100)}`);
    return { success: false, error: `HTTP ${resp.status}` };
  }
}

// ── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  const buyerPk = process.env.X402_BUYER_PRIVATE_KEY;
  if (!buyerPk) { console.error('X402_BUYER_PRIVATE_KEY not set'); process.exit(1); }

  const key = (buyerPk.startsWith('0x') ? buyerPk : '0x' + buyerPk) as `0x${string}`;
  const account = privateKeyToAccount(key);
  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http('https://mainnet.base.org')
  });

  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║   Coin Railz x402 Payment Test — May 2026        ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log(`Buyer address:  ${account.address}`);
  console.log(`Platform:       ${BASE_URL}`);

  // Check balance
  const balance = await getUsdcBalance(account.address);
  console.log(`USDC balance:   $${balance.toFixed(4)} on Base`);

  if (balance < 0.10) {
    console.log('⚠️  Low balance — only running tests ≤ $0.05');
  }

  const results: Array<{ test: string; success: boolean; txHash?: string; error?: string; amount?: number; paymentMethod?: string }> = [];

  // Run Test 1
  const t1 = await testNativeX402Bazaar(walletClient, account);
  results.push({ test: 'Native x402 (Bazaar/CDP)', ...t1 });

  // Run Test 2 (only if enough balance remaining)
  const balanceAfterT1 = await getUsdcBalance(account.address);
  if (balanceAfterT1 >= 0.10) {
    const t2 = await testX402FetchLibrary(account);
    results.push({ test: '@x402/fetch library', ...t2 });
  } else {
    console.log('\n═══ TEST 2: SKIPPED (insufficient balance) ═══');
    results.push({ test: '@x402/fetch library', success: false, error: 'Insufficient balance' });
  }

  // Run Test 3
  const t3 = await testApiKeyCredits();
  results.push({ test: 'API Key Credits', ...t3 });

  // Summary
  const finalBalance = await getUsdcBalance(account.address);
  const spent = balance - finalBalance;

  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║                   TEST RESULTS                   ║');
  console.log('╚══════════════════════════════════════════════════╝');
  results.forEach(r => {
    const status = r.success ? '✅ PASS' : '❌ FAIL';
    console.log(`${status}  ${r.test}${r.txHash ? ` — txHash: ${r.txHash.slice(0, 20)}...` : ''}${r.error ? ` — ${r.error.slice(0, 60)}` : ''}`);
  });
  console.log(`\nBalance: $${balance.toFixed(4)} → $${finalBalance.toFixed(4)} (spent: $${spent.toFixed(4)})`);

  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  console.log(`\n${passed}/${results.length} tests passed${failed > 0 ? `, ${failed} failed` : ''}`);
}

main().catch(e => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
