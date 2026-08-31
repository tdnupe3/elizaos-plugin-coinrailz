/**
 * PRE-DEPLOYMENT VERIFICATION SCRIPT
 * Run this before publishing to ensure all critical services are working
 */

import fetch from 'node-fetch';

const BASE_URL = process.env.REPLIT_DEPLOYMENT === '1' 
  ? 'https://coinrailz.com'
  : process.env.REPLIT_DOMAINS 
    ? `https://${process.env.REPLIT_DOMAINS}`
    : 'http://localhost:5000';

interface TestResult {
  name: string;
  passed: boolean;
  details?: string;
}

interface MicroserviceResponse {
  success?: boolean;
  data?: {
    symbol?: string;
    price?: number;
    ethereum?: { standard?: { gwei?: number } };
  };
}

const results: TestResult[] = [];

async function testEndpoint(name: string, url: string, validator: (data: any) => boolean): Promise<void> {
  try {
    const response = await fetch(url, {
      method: url.includes('/x402/service/') ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const data = await response.json();
    const passed = validator(data);
    
    results.push({ name, passed, details: passed ? 'OK' : JSON.stringify(data).slice(0, 100) });
  } catch (error: any) {
    results.push({ name, passed: false, details: error.message });
  }
}

async function runTests() {
  console.log('🔍 Pre-Deployment Verification\n');
  console.log(`Testing: ${BASE_URL}\n`);
  
  // 1. A2A Discovery
  await testEndpoint(
    'Agent Card (A2A Discovery)',
    `${BASE_URL}/.well-known/agent-card.json`,
    (data) => data.protocolVersion === '0.3.0' && Array.isArray(data.skills) && data.skills.length === 18
  );
  
  // 2. x402 Payment-Gated Services (V2 format)
  await testEndpoint(
    'x402: Smart Contract Audit',
    `${BASE_URL}/x402/service/smart-contract-audit`,
    (data) => data.x402Version === 2
  );
  
  await testEndpoint(
    'x402: Payment Processing',
    `${BASE_URL}/x402/service/payment-processing`,
    (data) => data.x402Version === 2
  );
  
  await testEndpoint(
    'x402: Gas Price Oracle',
    `${BASE_URL}/x402/service/gas-price-oracle`,
    (data) => data.x402Version === 2
  );
  
  // 3. Real Microservices
  const tokenPriceResponse = await fetch(`${BASE_URL}/api/microservices/token-price`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tokenAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7', chain: 'ethereum' })
  });
  const tokenData = await tokenPriceResponse.json() as MicroserviceResponse;
  results.push({
    name: 'Token Price (CoinGecko)',
    passed: tokenData.success === true && tokenData.data?.symbol === 'USDT',
    details: tokenData.success ? `$${tokenData.data?.price}` : 'Failed'
  });
  
  const gasResponse = await fetch(`${BASE_URL}/api/microservices/gas-price-oracle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chain: 'ethereum' })
  });
  const gasData = await gasResponse.json() as MicroserviceResponse;
  results.push({
    name: 'Gas Price Oracle',
    passed: gasData.success === true && gasData.data?.ethereum?.standard !== undefined,
    details: gasData.success ? `${gasData.data?.ethereum?.standard?.gwei} gwei` : 'Failed'
  });
  
  // Print results
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  results.forEach(result => {
    const icon = result.passed ? '✅' : '❌';
    console.log(`${icon} ${result.name}`);
    if (result.details) console.log(`   ${result.details}`);
  });
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  console.log(`\nRESULTS: ${passed}/${total} tests passed\n`);
  
  if (passed === total) {
    console.log('✅ ALL TESTS PASSED - READY FOR PRODUCTION DEPLOYMENT\n');
    process.exit(0);
  } else {
    console.log('❌ SOME TESTS FAILED - FIX ISSUES BEFORE DEPLOYING\n');
    process.exit(1);
  }
}

runTests().catch(error => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
});
