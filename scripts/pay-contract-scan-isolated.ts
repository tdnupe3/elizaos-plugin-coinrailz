/**
 * Isolated payment for contract-scan ($1.00) + transaction-builder ($0.30)
 * Transfers $2 USDC to buyer, then pays services one at a time.
 * Includes CDP auth for Bazaar /settle (required).
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

const ERC20_ABI = [
  { name: 'transfer', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }] }
] as const;

const publicClient = createPublicClient({ chain: base, transport: http('https://mainnet.base.org') });

function toPk(pk: string): `0x${string}` {
  return pk.startsWith('0x') ? pk as `0x${string}` : `0x${pk}`;
}

const platformAccount = privateKeyToAccount(toPk(PLATFORM_PK));
const buyerAccount = privateKeyToAccount(toPk(BUYER_PK));

const platformWallet = createWalletClient({ account: platformAccount, chain: base, transport: http('https://mainnet.base.org') });
const buyerWallet = createWalletClient({ account: buyerAccount, chain: base, transport: http('https://mainnet.base.org') });

async function getBalance(addr: `0x${string}`): Promise<bigint> {
  return await publicClient.readContract({
    address: USDC, abi: ERC20_ABI, functionName: 'balanceOf', args: [addr]
  }) as bigint;
}

async function getCdpAuth(): Promise<string | null> {
  if (!CDP_KEY_ID || !CDP_SECRET) return null;
  try {
    const cfg = createFacilitatorConfig(CDP_KEY_ID, CDP_SECRET);
    const headers = await cfg.createAuthHeaders();
    return (headers as any).settle?.Authorization || null;
  } catch {
    return null;
  }
}

async function payService(path: string, name: string, auth: string | null): Promise<boolean> {
  console.log(`\n💳 Paying ${name} at ${path}...`);

  // Get 402 challenge (try POST first, fall back to GET)
  let challenge: any;
  for (const method of ['POST', 'GET']) {
    const resp = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: method === 'POST' ? JSON.stringify({}) : undefined
    });
    if (resp.status === 402) {
      challenge = await resp.json();
      break;
    }
  }
  if (!challenge) { console.error('  ❌ No 402 response'); return false; }

  const baseReq = challenge.accepts?.find((a: any) => a.network === 'base' || a.network === 'eip155:8453');
  if (!baseReq) { console.error('  ❌ No Base network in accepts'); return false; }

  console.log(`  amount: ${baseReq.maxAmountRequired} ($${Number(baseReq.maxAmountRequired)/1e6})`);
  console.log(`  payTo: ${baseReq.payTo}`);

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

  // Refresh auth before each payment
  const freshAuth = await getCdpAuth();
  const authToUse = freshAuth || auth;

  const paymentHeader = await createPaymentHeader(buyerWallet as any, 1, requirements as any);
  const paymentPayload = JSON.parse(Buffer.from(paymentHeader, 'base64').toString('utf8'));

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Correlation-Context': 'sdk_version=1.29.0,sdk_language=typescript,source=x402,source_version=0.7.1'
  };
  if (authToUse) headers['Authorization'] = authToUse;

  console.log(`  Submitting to Bazaar /settle${authToUse ? ' (with CDP auth)' : ' (no auth)'}...`);
  const settleResp = await fetch(`${BAZAAR_URL}/settle`, {
    method: 'POST', headers,
    body: JSON.stringify({ x402Version: 1, paymentPayload, paymentRequirements: requirements })
  });

  let data: any;
  const text = await settleResp.text();
  try { data = JSON.parse(text); } catch { console.error(`  ❌ Non-JSON response (${settleResp.status}): ${text.slice(0, 100)}`); return false; }

  if (settleResp.status === 200 && data.success) {
    console.log(`  ✅ ${name} INDEXED! TX: https://basescan.org/tx/${data.transaction}`);
    return true;
  } else {
    console.error(`  ❌ FAILED (${settleResp.status}): ${data.errorReason}: ${data.errorMessage}`);
    return false;
  }
}

const SERVICES = [
  { path: '/x402/arbitrage-scanner', name: 'arbitrage-scanner' },
];

async function main() {
  console.log('=== Isolated Service Payments ===');
  console.log('CDP auth key:', CDP_KEY_ID ? '✅' : '⚠️ missing');

  const platformBal = await getBalance(PLATFORM_WALLET);
  const buyerBal = await getBalance(BUYER_WALLET);
  console.log(`Platform: $${(Number(platformBal)/1e6).toFixed(4)} USDC`);
  console.log(`Buyer:    $${(Number(buyerBal)/1e6).toFixed(4)} USDC`);

  // Transfer $2 USDC (contract-scan $1.00 + transaction-builder $0.30 + others $0.25 each + buffer)
  const TRANSFER = parseUnits('2', 6);
  const needed = BigInt(2_000_000);
  if (buyerBal < needed) {
    const toSend = needed - buyerBal;
    console.log(`\n🚀 Transferring $${(Number(toSend)/1e6).toFixed(2)} USDC to buyer...`);
    const txHash = await platformWallet.writeContract({
      address: USDC, abi: ERC20_ABI, functionName: 'transfer', args: [BUYER_WALLET, toSend]
    });
    console.log(`TX: https://basescan.org/tx/${txHash}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    console.log(`✅ Confirmed block ${receipt.blockNumber}`);
    // Wait for RPC to index
    await new Promise(r => setTimeout(r, 3000));
  } else {
    console.log(`Buyer already has $${(Number(buyerBal)/1e6).toFixed(4)}, no transfer needed`);
  }

  const auth = await getCdpAuth();
  console.log(`CDP auth: ${auth ? '✅ ready' : '⚠️ none (will fail with 401)'}`);

  let succeeded = 0, failed = 0;
  for (const svc of SERVICES) {
    const ok = await payService(svc.path, svc.name, auth);
    if (ok) succeeded++; else failed++;
    // 2 second delay between payments to avoid Bazaar batching
    await new Promise(r => setTimeout(r, 2000));
  }

  const finalBal = await getBalance(BUYER_WALLET);
  console.log(`\n=== DONE ===`);
  console.log(`Succeeded: ${succeeded}, Failed: ${failed}`);
  console.log(`Buyer USDC remaining: $${(Number(finalBal)/1e6).toFixed(4)}`);
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
