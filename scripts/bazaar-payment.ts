/**
 * Bazaar Payment Script
 * 
 * Makes a real $0.05 USDC x402 payment through the Coinbase Bazaar facilitator
 * to https://coinrailz.com/x402/ai-inference using the X402_BUYER_PRIVATE_KEY wallet.
 * 
 * Buyer wallet: 0x5837A864C03912ea14a5609968F73E75B9d42a7C (3.5 USDC available)
 * Platform wallet: 0xa4bBE37f9A6Ae2dc36a607B91eB148C0ae163C91 (receives payment)
 * Cost: $0.05 USDC per call
 * 
 * Our 402 response sends network: "eip155:8453" (CAIP-2 format) but x402-fetch
 * expects "base" (shorthand). We parse the 402 manually and remap the network.
 */

import { privateKeyToAccount } from 'viem/accounts';
import { createWalletClient, http } from 'viem';
import { base } from 'viem/chains';
import { createPaymentHeader, selectPaymentRequirements } from 'x402/client';

// Map CAIP-2 chain IDs to x402 network shorthand names
const CAIP2_TO_X402: Record<string, string> = {
  'eip155:8453': 'base',
  'eip155:84532': 'base-sepolia',
  'eip155:1': 'ethereum',
  'eip155:137': 'polygon',
  'eip155:43114': 'avalanche',
};

async function run() {
  const pk = process.env.X402_BUYER_PRIVATE_KEY;
  if (!pk) {
    console.error('X402_BUYER_PRIVATE_KEY not set — aborting');
    process.exit(1);
  }

  const key = (pk.startsWith('0x') ? pk : '0x' + pk) as `0x${string}`;
  const account = privateKeyToAccount(key);

  console.log('=== Coinbase Bazaar x402 Payment ===');
  console.log('Buyer wallet:', account.address);
  console.log('Target:       https://coinrailz.com/x402/ai-inference');
  console.log('Cost:         $0.05 USDC on Base');
  console.log('Facilitator:  Coinbase Bazaar');
  console.log('');

  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http('https://mainnet.base.org')
  });

  // Step 1: Fetch the 402 challenge
  console.log('Step 1: Fetching 402 challenge...');
  const probe = await fetch('https://coinrailz.com/x402/ai-inference', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: 'What is x402 in one sentence?', model: 'gpt-4o-mini' })
  });

  if (probe.status !== 402) {
    console.error(`Expected 402, got ${probe.status}`);
    const body = await probe.text();
    console.error('Body:', body.slice(0, 300));
    process.exit(1);
  }

  const challenge = await probe.json() as {
    x402Version: number;
    accepts: Array<Record<string, unknown>>;
  };

  console.log('Got 402 challenge. x402Version:', challenge.x402Version);
  console.log('Accepts count:', challenge.accepts?.length);

  // Step 2: Fix the network field — remap "eip155:8453" → "base"
  const fixedAccepts = challenge.accepts.map(req => ({
    ...req,
    network: CAIP2_TO_X402[req.network as string] ?? req.network
  }));

  console.log('Fixed network:', fixedAccepts[0]?.network);

  // Step 3: Select the best payment requirement
  const selected = selectPaymentRequirements(fixedAccepts as any[], ['base'], 'exact');
  console.log('Selected requirement:', {
    network: selected.network,
    maxAmountRequired: selected.maxAmountRequired,
    payTo: selected.payTo,
    asset: selected.asset,
  });

  // Step 4: Create the payment header (signs EIP-3009 transferWithAuthorization)
  console.log('\nStep 2: Signing payment authorization (EIP-3009)...');
  const paymentHeader = await createPaymentHeader(walletClient as any, challenge.x402Version, selected);
  console.log('Payment header created (length:', paymentHeader.length, ')');

  // Step 5: Send the actual request with X-PAYMENT header
  console.log('\nStep 3: Submitting payment to production endpoint...');
  const response = await fetch('https://coinrailz.com/x402/ai-inference', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-PAYMENT': paymentHeader,
      'Access-Control-Expose-Headers': 'X-PAYMENT-RESPONSE'
    },
    body: JSON.stringify({ prompt: 'What is x402 in one sentence?', model: 'gpt-4o-mini' })
  });

  console.log('Response status:', response.status);
  const xPaymentResponse = response.headers.get('X-PAYMENT-RESPONSE');
  if (xPaymentResponse) {
    console.log('X-PAYMENT-RESPONSE:', xPaymentResponse);
  }

  if (response.status === 200) {
    const body = await response.json();
    console.log('\n✅ PAYMENT SUCCEEDED — Bazaar facilitator accepted & settled the payment!');
    console.log('Response:', JSON.stringify(body).slice(0, 300));
    console.log('\nBazaar will now index https://coinrailz.com/x402/ai-inference as a verified service.');
  } else if (response.status === 402) {
    const body = await response.json();
    console.log('\n❌ Payment rejected (still 402):');
    console.log(JSON.stringify(body, null, 2).slice(0, 500));
  } else {
    const body = await response.text();
    console.log(`\n❌ Unexpected response (${response.status}):`, body.slice(0, 300));
  }
}

run().catch(err => {
  console.error('\nFatal error:', err.message || err);
  process.exit(1);
});
