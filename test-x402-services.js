#!/usr/bin/env node

/**
 * Coin Railz x402 Service Validator
 * Tests all 18 micropayment services for proper HTTP 402 responses
 */

const services = [
  "multi-chain-balance",
  "gas-price-oracle", 
  "token-price",
  "contract-scan",
  "wallet-risk",
  "trade-signals",
  "token-sentiment",
  "trending-tokens",
  "whale-alerts",
  "dex-liquidity",
  "transaction-builder",
  "token-metadata",
  "approval-manager",
  "batch-quote",
  "portfolio-tracker",
  "instant-agent-wallet",
  "verified-agent-identity",
  "seamless-chain-bridge"
];

const BASE_URL = process.argv[2] || "https://coinrailz.com";

async function testService(serviceName) {
  const url = `${BASE_URL}/x402/${serviceName}`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    
    const statusCode = response.status;
    const body = await response.json();
    
    // Validate x402 protocol compliance
    const hasX402Version = body.x402Version === 1;
    const hasAccepts = Array.isArray(body.accepts) && body.accepts.length > 0;
    const hasPayTo = body.accepts?.[0]?.payTo === "0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91";
    const hasNetwork = body.accepts?.[0]?.network === "base";
    const hasAsset = body.accepts?.[0]?.asset === "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
    const isDiscoverable = body.accepts?.[0]?.outputSchema?.input?.discoverable === true;
    
    const isValid = statusCode === 402 && hasX402Version && hasAccepts && hasPayTo && hasNetwork && hasAsset && isDiscoverable;
    
    return {
      name: serviceName,
      status: statusCode,
      valid: isValid,
      x402Version: hasX402Version,
      discoverable: isDiscoverable,
      correctWallet: hasPayTo,
      correctNetwork: hasNetwork,
      correctAsset: hasAsset
    };
  } catch (error) {
    return {
      name: serviceName,
      status: 'ERROR',
      valid: false,
      error: error.message
    };
  }
}

async function runTests() {
  console.log(`\n🧪 Testing ${services.length} x402 services at ${BASE_URL}\n`);
  console.log('─'.repeat(80));
  
  const results = await Promise.all(services.map(testService));
  
  let passed = 0;
  let failed = 0;
  
  results.forEach(result => {
    if (result.valid) {
      console.log(`✅ ${result.name.padEnd(25)} HTTP ${result.status} - Discoverable: ${result.discoverable}`);
      passed++;
    } else {
      console.log(`❌ ${result.name.padEnd(25)} HTTP ${result.status} - ${result.error || 'Invalid response'}`);
      if (!result.discoverable && result.status === 402) {
        console.log(`   ⚠️  Missing discoverable flag!`);
      }
      failed++;
    }
  });
  
  console.log('─'.repeat(80));
  console.log(`\n📊 Results: ${passed}/${services.length} services valid`);
  
  if (failed === 0) {
    console.log('🎉 All services are Bazaar-ready!\n');
  } else {
    console.log(`⚠️  ${failed} service(s) need attention\n`);
  }
  
  return failed === 0;
}

runTests().then(success => process.exit(success ? 0 : 1));
