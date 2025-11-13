#!/usr/bin/env node

/**
 * x402 Demo Agent - Coin Railz Service Discovery Validator
 * 
 * Simulates an AI agent autonomously discovering all 18 Coin Railz x402
 * micropayment services on Base mainnet.
 * 
 * This script validates:
 * - HTTP 402 Payment Required responses
 * - Complete payment metadata (network, asset, payTo wallet)
 * - Discoverable flags for Bazaar registration
 * - Service pricing and schemas
 * 
 * Usage:
 *   node x402-demo-agent.js [service-name]  # Test single service
 *   node x402-demo-agent.js --all           # Test all 18 services (default)
 * 
 * Note: This is DISCOVERY-ONLY mode. For actual payment testing, you would need
 * to integrate with Coinbase CDP SDK directly.
 */

import axios from 'axios';

const USDC_ASSET = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const BASE_URL = process.env.BASE_URL || 'https://coinrailz.com';
const EXPECTED_WALLET = '0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91';

const SERVICES = [
  'multi-chain-balance',
  'gas-price-oracle',
  'token-price',
  'contract-scan',
  'wallet-risk',
  'trade-signals',
  'token-sentiment',
  'trending-tokens',
  'whale-alerts',
  'dex-liquidity',
  'transaction-builder',
  'token-metadata',
  'approval-manager',
  'batch-quote',
  'portfolio-tracker',
  'instant-agent-wallet',
  'verified-agent-identity',
  'seamless-chain-bridge'
];

async function callService(service) {
  const url = `${BASE_URL}/x402/${service}`;
  console.log(`\n🔍 Discovering: ${service}`);
  console.log(`   URL: ${url}`);

  try {
    const initialResponse = await axios.post(url, {}, {
      validateStatus: (status) => status === 402 || status === 200
    });

    if (initialResponse.status === 200) {
      console.log(`⚠️  ${service} returned 200 without payment (unexpected)`);
      return { service, status: 'warning', message: 'No payment required' };
    }

    if (initialResponse.status !== 402) {
      console.log(`❌ ${service} returned unexpected status: ${initialResponse.status}`);
      return { service, status: 'error', message: `Unexpected status ${initialResponse.status}` };
    }

    const paymentRequirements = initialResponse.data?.accepts?.[0];
    if (!paymentRequirements) {
      console.error(`❌ No payment info for ${service}`);
      return { service, status: 'error', message: 'Missing payment requirements' };
    }

    const priceUSD = parseInt(paymentRequirements.maxAmountRequired) / 1000000;
    const isDiscoverable = initialResponse.data?.accepts?.[0]?.outputSchema?.input?.discoverable === true;
    const hasCorrectWallet = paymentRequirements.payTo === EXPECTED_WALLET;
    const hasCorrectNetwork = paymentRequirements.network === 'base';
    const hasCorrectAsset = paymentRequirements.asset === USDC_ASSET;
    
    console.log(`✅ Payment requirements received:`);
    console.log(`   Price: $${priceUSD.toFixed(2)} USDC`);
    console.log(`   Network: ${paymentRequirements.network} ${hasCorrectNetwork ? '✓' : '✗ WRONG'}`);
    console.log(`   PayTo: ${paymentRequirements.payTo} ${hasCorrectWallet ? '✓' : '✗ WRONG'}`);
    console.log(`   Asset: ${paymentRequirements.asset.substring(0, 10)}... ${hasCorrectAsset ? '✓' : '✗ WRONG'}`);
    console.log(`   Discoverable: ${isDiscoverable ? '✓ YES' : '✗ NO'}`);

    const isValid = hasCorrectWallet && hasCorrectNetwork && hasCorrectAsset && isDiscoverable;

    return {
      service,
      status: isValid ? 'valid' : 'invalid',
      price: priceUSD,
      discoverable: isDiscoverable,
      correctWallet: hasCorrectWallet,
      correctNetwork: hasCorrectNetwork,
      correctAsset: hasCorrectAsset,
      message: isValid ? 'Fully Bazaar-compliant' : 'Configuration issues detected'
    };

  } catch (err) {
    console.error(`❌ Error calling ${service}:`, err.message);
    if (err.response) {
      console.error(`   HTTP ${err.response.status}: ${JSON.stringify(err.response.data)}`);
    }
    return {
      service,
      status: 'error',
      message: err.message
    };
  }
}

async function runDemo() {
  console.log('\n🤖 Coin Railz x402 Demo Agent - Discovery Validator');
  console.log('════════════════════════════════════════════════════════════════\n');
  
  const args = process.argv.slice(2);
  let servicesToTest = SERVICES;

  if (args.length > 0 && args[0] !== '--all') {
    const requestedService = args[0];
    if (!SERVICES.includes(requestedService)) {
      console.error(`❌ Unknown service: ${requestedService}`);
      console.log(`\nAvailable services:\n${SERVICES.map(s => `  - ${s}`).join('\n')}`);
      process.exit(1);
    }
    servicesToTest = [requestedService];
  }

  console.log(`Validating ${servicesToTest.length} service(s) at ${BASE_URL}`);
  console.log(`Expected wallet: ${EXPECTED_WALLET}`);
  console.log(`Expected network: base (ChainID 8453)`);
  console.log(`Expected asset: USDC (${USDC_ASSET})\n`);
  console.log('────────────────────────────────────────────────────────────────\n');

  const results = [];
  
  for (const service of servicesToTest) {
    const result = await callService(service);
    results.push(result);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('\n📊 VALIDATION SUMMARY\n');
  
  let totalCost = 0;
  const summary = {
    valid: 0,
    invalid: 0,
    error: 0,
    warning: 0
  };

  results.forEach(result => {
    summary[result.status]++;
    if (result.price) totalCost += result.price;
    
    const statusEmoji = {
      valid: '✅',
      invalid: '⚠️',
      error: '❌',
      warning: '⚠️'
    }[result.status];
    
    const price = result.price ? `$${result.price.toFixed(2)}` : 'N/A';
    const discoverable = result.discoverable ? '🔍' : '❌';
    console.log(`${statusEmoji} ${result.service.padEnd(25)} ${price.padStart(8)} ${discoverable} - ${result.message || result.status}`);
  });

  console.log('\n────────────────────────────────────────────────────────────────');
  console.log(`\n✅ Valid & Bazaar-ready: ${summary.valid}`);
  console.log(`⚠️  Invalid configuration: ${summary.invalid}`);
  console.log(`❌ Errors: ${summary.error}`);
  
  console.log(`\n💰 Total service value: $${totalCost.toFixed(2)} USDC`);
  console.log(`📡 Services marked discoverable: ${results.filter(r => r.discoverable).length}/${results.length}`);
  
  console.log('\n════════════════════════════════════════════════════════════════\n');

  if (summary.valid === results.length) {
    console.log('🎉 ALL SERVICES ARE BAZAAR-COMPLIANT AND READY FOR AI AGENTS!\n');
  } else {
    console.log(`⚠️  ${summary.invalid + summary.error} service(s) need attention\n`);
  }

  return summary.error === 0 && summary.invalid === 0;
}

runDemo()
  .then(success => process.exit(success ? 0 : 1))
  .catch(err => {
    console.error('\n💥 Fatal error:', err);
    process.exit(1);
  });
