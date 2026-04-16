/**
 * Direct Bazaar Facilitator Settlement Script
 * 
 * KEY DISCOVERY from /supported endpoint:
 *   V1: network = "base" (legacy), x402Version = 1
 *   V2: network = "eip155:8453" (CAIP-2), x402Version = 2
 * 
 * Strategy: Try V1 (sign with "base", settle with x402Version:1)
 *           Then V2 (sign with "base", override network to "eip155:8453")
 * 
 * Buyer:    0x5837A864C03912ea14a5609968F73E75B9d42a7C  (3.5 USDC)
 * Receiver: 0xa4bBE37f9A6Ae2dc36a607B91eB148C0ae163C91
 * Cost:     $0.05 USDC on Base
 */

import { privateKeyToAccount } from 'viem/accounts';
import { createWalletClient, http } from 'viem';
import { base } from 'viem/chains';
import { createPaymentHeader } from 'x402/client';
import { createFacilitatorConfig } from '@coinbase/x402';

const BAZAAR_URL = 'https://api.cdp.coinbase.com/platform/v2/x402';

async function getCdpAuth(cdpKeyId: string, cdpSecret: string) {
  const cfg = createFacilitatorConfig(cdpKeyId, cdpSecret);
  const authHeaders = await cfg.createAuthHeaders();
  return (authHeaders as any).settle?.Authorization as string | undefined;
}

async function settle(body: object, auth: string | null) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Correlation-Context': 'sdk_version=1.29.0,sdk_language=typescript,source=x402,source_version=0.7.1'
  };
  if (auth) headers['Authorization'] = auth;

  const resp = await fetch(`${BAZAAR_URL}/settle`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
  const text = await resp.text();
  return { status: resp.status, body: text };
}

async function main() {
  const buyerPk = process.env.X402_BUYER_PRIVATE_KEY;
  const cdpKeyId = process.env.CDP_API_KEY_ID;
  const cdpSecret = process.env.CDP_PRIVATE_KEY || process.env.CDP_API_KEY_SECRET;

  if (!buyerPk) { console.error('X402_BUYER_PRIVATE_KEY not set'); process.exit(1); }

  const key = (buyerPk.startsWith('0x') ? buyerPk : '0x' + buyerPk) as `0x${string}`;
  const account = privateKeyToAccount(key);

  console.log('=== Direct Bazaar Settlement ===');
  console.log('Buyer:    ', account.address);
  console.log('CDP auth: ', cdpKeyId ? '✅ set' : '⚠️  none');
  console.log('');

  // Fetch 402 challenge
  const probe = await fetch('https://coinrailz.com/x402/ai-inference', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: 'What is x402?', model: 'gpt-4o-mini' })
  });
  const challenge = await probe.json() as { x402Version: number; accepts: Array<Record<string, unknown>> };
  const baseEntry = challenge.accepts.find(a => a.network === 'eip155:8453') as Record<string, unknown>;
  
  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http('https://mainnet.base.org')
  });

  // ============================================================
  // Attempt 1: V1 format (network: "base", x402Version: 1)
  // ============================================================
  console.log('--- Attempt 1: V1 format (network: "base", x402Version: 1) ---');
  
  const reqV1 = {
    scheme: 'exact',
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
  
  // Sign with x402Version: 1 (override challenge version)
  const headerV1 = await createPaymentHeader(walletClient as any, 1, reqV1 as any);
  const payloadV1 = JSON.parse(Buffer.from(headerV1, 'base64').toString('utf8'));
  console.log('Signed V1 payload: version =', payloadV1.x402Version, 'network =', payloadV1.network);
  
  const authV1 = cdpKeyId && cdpSecret ? await getCdpAuth(cdpKeyId, cdpSecret) : null;
  const r1 = await settle({ x402Version: 1, paymentPayload: payloadV1, paymentRequirements: reqV1 }, authV1 || null);
  console.log('V1 response:', r1.status);
  console.log(r1.body.slice(0, 400));
  
  if (r1.status === 200) {
    console.log('\n🎉 SUCCESS via V1!');
    return;
  }

  // ============================================================
  // Attempt 2: V2 format (network: "eip155:8453", x402Version: 2)
  //            Sign with "base" (library compat), then override network string
  // ============================================================
  console.log('\n--- Attempt 2: V2 format (network: "eip155:8453") ---');
  
  const reqV2 = {
    scheme: 'exact',
    network: 'eip155:8453',   // V2 CAIP-2 format
    maxAmountRequired: String(baseEntry.maxAmountRequired),
    resource: String(baseEntry.resource),
    description: String(baseEntry.description ?? ''),
    mimeType: String(baseEntry.mimeType ?? 'application/json'),
    payTo: String(baseEntry.payTo),
    maxTimeoutSeconds: Number(baseEntry.maxTimeoutSeconds ?? 60),
    asset: String(baseEntry.asset),
    extra: baseEntry.extra as Record<string, unknown> ?? undefined,
  };

  // Sign with "base" (library only accepts legacy), then fix network in payload
  const headerV2Raw = await createPaymentHeader(walletClient as any, 2, { ...reqV2, network: 'base' } as any);
  const payloadV2 = JSON.parse(Buffer.from(headerV2Raw, 'base64').toString('utf8'));
  // Override network to CAIP-2 for V2 compatibility
  payloadV2.network = 'eip155:8453';
  console.log('Signed V2 payload: version =', payloadV2.x402Version, 'network =', payloadV2.network);
  
  const authV2 = cdpKeyId && cdpSecret ? await getCdpAuth(cdpKeyId, cdpSecret) : null;
  const r2 = await settle({ x402Version: 2, paymentPayload: payloadV2, paymentRequirements: reqV2 }, authV2 || null);
  console.log('V2 response:', r2.status);
  console.log(r2.body.slice(0, 400));
  
  if (r2.status === 200) {
    const parsed = JSON.parse(r2.body);
    console.log('\n🎉 SUCCESS via V2!');
    console.log('Bazaar indexed https://coinrailz.com/x402/ai-inference');
    if (parsed.txHash) console.log('TX:', parsed.txHash);
    return;
  }

  // ============================================================
  // Attempt 3: V2 upto scheme with facilitator contract
  // ============================================================
  console.log('\n--- Attempt 3: V2 "upto" scheme with on-chain facilitator ---');
  console.log('(Note: "upto" requires USDC allowance to facilitator contract)');
  // The "upto" scheme uses a different flow (on-chain approval + pull) 
  // We skip this for now as it requires pre-approval setup
  
  console.log('\n❌ Both V1 and V2 "exact" approaches failed.');
  console.log('\nDiagnosis: The Bazaar facilitator handles the EIP-3009 transfer itself.');
  console.log('Our buyer wallet may need to have the USDC allowance pre-approved to the');
  console.log('Bazaar facilitator contract addresses:');
  console.log('  eip155:8453 exact: no specific address (EIP-3009 gasless)');
  console.log('\nNext best path: Fix production server + make payment through it.');
  console.log('The fix: change getPlatformWalletClient() to use EVM_PRIVATE_KEY');
}

main().catch(err => {
  console.error('Fatal:', err.message || err);
  process.exit(1);
});
