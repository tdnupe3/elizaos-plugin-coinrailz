/**
 * Complete Bazaar Indexing Script — All Remaining 33 Services
 * 
 * Pays every x402 service not yet indexed through the Bazaar facilitator.
 * Features:
 *   - Auto top-up: transfers from platform when buyer balance is low
 *   - CDP auth: required for Bazaar /settle authorization
 *   - 2s delays between payments to prevent Bazaar batching
 *   - Sorted cheapest-first to maximize successful settlements
 *   - Handles services with paths like /service/smart-contract-audit
 */
import 'dotenv/config';
import { createWalletClient, createPublicClient, http, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { createPaymentHeader } from 'x402/client';
import { createFacilitatorConfig } from '@coinbase/x402';

const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`;
const PLATFORM_WALLET = '0xa4bBE37f9A6Ae2dc36a607B91eB148C0ae163C91' as `0x${string}`;
const BUYER_WALLET = '0x5837A864C03912ea14a5609968F73E75B9d42a7C' as `0x${string}`;
const BAZAAR_URL = 'https://api.cdp.coinbase.com/platform/v2/x402';
const BASE_URL = 'https://coinrailz.com';

const PLATFORM_PK = process.env.EVM_PRIVATE_KEY as string;
const BUYER_PK = process.env.X402_BUYER_PRIVATE_KEY as string;
const CDP_KEY_ID = process.env.CDP_API_KEY_ID as string;
const CDP_SECRET = (process.env.CDP_PRIVATE_KEY || process.env.CDP_API_KEY_SECRET) as string;
const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY || process.env.ALCHEMY_KEY || '';
const BASE_RPC = ALCHEMY_KEY
  ? `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`
  : BASE_RPC;

const ERC20_ABI = [
  { name: 'transfer', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }] }
] as const;

const publicClient = createPublicClient({ chain: base, transport: http(BASE_RPC) });

function toPk(pk: string): `0x${string}` {
  return pk.startsWith('0x') ? pk as `0x${string}` : `0x${pk}`;
}

const platformAccount = privateKeyToAccount(toPk(PLATFORM_PK));
const buyerAccount = privateKeyToAccount(toPk(BUYER_PK));
const platformWallet = createWalletClient({ account: platformAccount, chain: base, transport: http(BASE_RPC) });
const buyerWallet = createWalletClient({ account: buyerAccount, chain: base, transport: http(BASE_RPC) });

async function getBalance(addr: `0x${string}`): Promise<bigint> {
  return await publicClient.readContract({
    address: USDC, abi: ERC20_ABI, functionName: 'balanceOf', args: [addr]
  }) as bigint;
}

async function transfer(amountUsd: number): Promise<void> {
  const amountMicro = Math.round(amountUsd * 1_000_000);
  const tx = await platformWallet.writeContract({
    address: USDC, abi: ERC20_ABI, functionName: 'transfer',
    args: [BUYER_WALLET, BigInt(amountMicro)]
  });
  console.log(`  Transfer TX: https://basescan.org/tx/${tx}`);
  await publicClient.waitForTransactionReceipt({ hash: tx });
  await new Promise(r => setTimeout(r, 2000)); // Let RPC index
}

async function getCdpAuth(): Promise<string | null> {
  if (!CDP_KEY_ID || !CDP_SECRET) return null;
  try {
    const cfg = createFacilitatorConfig(CDP_KEY_ID, CDP_SECRET);
    const h = await cfg.createAuthHeaders();
    return (h as any).settle?.Authorization || null;
  } catch { return null; }
}

async function payService(path: string, name: string, auth: string | null): Promise<{ success: boolean; txHash?: string; error?: string }> {
  // Ensure buyer has enough for this service — top up if needed
  const buyerBal = await getBalance(BUYER_WALLET);
  
  // Get 402 challenge first to know the price
  const url = `${BASE_URL}/x402${path}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  
  if (resp.status !== 402) {
    // Try GET as fallback
    const respGet = await fetch(url);
    if (respGet.status !== 402) {
      return { success: false, error: `Not a 402 endpoint (got ${resp.status})` };
    }
    const challenge = await respGet.json() as any;
    return await settle(challenge, name, auth, path);
  }
  
  const challenge = await resp.json() as any;
  return await settle(challenge, name, auth, path);
}

async function settle(challenge: any, name: string, auth: string | null, path: string): Promise<{ success: boolean; txHash?: string; error?: string }> {
  const baseReq = challenge.accepts?.find((a: any) => a.network === 'base' || a.network === 'eip155:8453');
  if (!baseReq) return { success: false, error: 'No Base network in accepts' };

  const priceUsd = Number(baseReq.maxAmountRequired) / 1_000_000;
  console.log(`  price: $${priceUsd.toFixed(4)}`);

  // Check buyer balance and top up if needed
  const buyerBal = await getBalance(BUYER_WALLET);
  const buyerUsd = Number(buyerBal) / 1_000_000;
  const platformBal = await getBalance(PLATFORM_WALLET);
  const platformUsd = Number(platformBal) / 1_000_000;

  if (buyerUsd < priceUsd * 1.05) {
    const topUp = priceUsd * 1.1 + 0.01; // 10% buffer + $0.01 for rounding
    if (platformUsd < topUp) {
      return { success: false, error: `Insufficient platform balance ($${platformUsd.toFixed(4)}) for $${priceUsd} service` };
    }
    console.log(`  💸 Buyer low ($${buyerUsd.toFixed(4)}), topping up $${topUp.toFixed(4)}...`);
    await transfer(topUp);
  }

  const requirements = {
    scheme: 'exact' as const,
    network: 'base',
    maxAmountRequired: String(baseReq.maxAmountRequired),
    resource: String(baseReq.resource),
    description: String(baseReq.description ?? ''),
    mimeType: String(baseReq.mimeType ?? 'application/json'),
    payTo: String(baseReq.payTo),
    maxTimeoutSeconds: Number(baseReq.maxTimeoutSeconds ?? 300),
    asset: String(baseReq.asset),
    extra: baseReq.extra,
  };

  // Refresh auth
  const freshAuth = await getCdpAuth() || auth;
  
  const paymentHeader = await createPaymentHeader(buyerWallet as any, 1, requirements as any);
  const paymentPayload = JSON.parse(Buffer.from(paymentHeader, 'base64').toString('utf8'));

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Correlation-Context': 'sdk_version=1.29.0,sdk_language=typescript,source=x402,source_version=0.7.1'
  };
  if (freshAuth) headers['Authorization'] = freshAuth;

  const settleResp = await fetch(`${BAZAAR_URL}/settle`, {
    method: 'POST', headers,
    body: JSON.stringify({ x402Version: 1, paymentPayload, paymentRequirements: requirements })
  });

  const text = await settleResp.text();
  let data: any = {};
  try { data = JSON.parse(text); } catch {
    return { success: false, error: `Non-JSON (${settleResp.status}): ${text.slice(0, 80)}` };
  }

  if (settleResp.status === 200 && data.success) {
    return { success: true, txHash: data.transaction };
  }
  return { success: false, error: `${data.errorReason || settleResp.status}: ${data.errorMessage || ''}` };
}

// Round 3 — final 1 service that was interrupted mid-payment in round 1
const SERVICES = [
  { path: '/credit-risk-score', name: 'credit-risk-score' },   // $1.25
];

async function main() {
  console.log('=== Full Bazaar Indexing — Round 3 (credit-risk-score) ===\n');
  console.log('RPC:', BASE_RPC.includes('alchemy') ? '✅ Alchemy' : '⚠️ Public (rate-limited)');
  console.log('CDP auth:', CDP_KEY_ID ? '✅' : '⚠️ MISSING');

  const platBal = await getBalance(PLATFORM_WALLET);
  const buyBal = await getBalance(BUYER_WALLET);
  console.log(`Platform: $${(Number(platBal)/1e6).toFixed(4)} USDC`);
  console.log(`Buyer:    $${(Number(buyBal)/1e6).toFixed(4)} USDC`);
  console.log(`Total available: $${((Number(platBal)+Number(buyBal))/1e6).toFixed(4)} USDC\n`);

  const auth = await getCdpAuth();
  console.log(`CDP auth: ${auth ? '✅ ready' : '⚠️ none'}\n`);

  const results: Array<{ path: string; success: boolean; txHash?: string; error?: string }> = [];

  for (const svc of SERVICES) {
    process.stdout.write(`${svc.name.padEnd(32)} → `);
    try {
      const result = await payService(svc.path, svc.name, auth);
      results.push({ path: svc.path, ...result });
      if (result.success) {
        console.log(`✅ https://basescan.org/tx/${result.txHash}`);
      } else {
        console.log(`❌ ${result.error?.slice(0, 70)}`);
      }
    } catch (e: any) {
      console.log(`💥 Exception: ${e.message?.slice(0, 60)}`);
      results.push({ path: svc.path, success: false, error: e.message });
    }
    // 2-second delay to prevent Bazaar batching
    await new Promise(r => setTimeout(r, 2000));
  }

  const finalPlatBal = await getBalance(PLATFORM_WALLET);
  const finalBuyBal = await getBalance(BUYER_WALLET);

  console.log('\n=== SUMMARY ===');
  const succeeded = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  console.log(`✅ Succeeded: ${succeeded.length}/${SERVICES.length}`);
  console.log(`❌ Failed:    ${failed.length}`);
  console.log(`Platform USDC: $${(Number(finalPlatBal)/1e6).toFixed(4)}`);
  console.log(`Buyer USDC:    $${(Number(finalBuyBal)/1e6).toFixed(4)}`);

  if (succeeded.length > 0) {
    console.log('\nSucceeded:');
    for (const r of succeeded) console.log(`  ✅ ${r.path}  TX: ${r.txHash}`);
  }
  if (failed.length > 0) {
    console.log('\nFailed:');
    for (const r of failed) console.log(`  ❌ ${r.path}: ${r.error}`);
  }
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
