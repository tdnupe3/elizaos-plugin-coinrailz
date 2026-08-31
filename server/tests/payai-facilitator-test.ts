/**
 * PayAI Facilitator Compatibility Test Harness
 * 
 * Phase 1 of x402 facilitator migration: Validate PayAI before switching
 * 
 * Tests:
 * 1. Health endpoint availability
 * 2. Supported networks (confirm Base is included)
 * 3. /verify endpoint with sample EVM payload
 * 4. Rate limit burst test (25 rapid requests)
 * 5. Error handling for malformed payloads
 * 
 * Run: npx tsx server/tests/payai-facilitator-test.ts
 */

export {};

const PAYAI_FACILITATOR_URL = 'https://facilitator.payai.network';

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
  latencyMs?: number;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<{ passed: boolean; details: string; latencyMs?: number }>) {
  console.log(`\n🧪 Running: ${name}`);
  const start = Date.now();
  try {
    const result = await fn();
    const latency = Date.now() - start;
    results.push({ name, ...result, latencyMs: result.latencyMs || latency });
    console.log(result.passed ? `   ✅ PASS (${latency}ms)` : `   ❌ FAIL (${latency}ms)`);
    console.log(`   ${result.details}`);
  } catch (error: any) {
    const latency = Date.now() - start;
    results.push({ name, passed: false, details: `Exception: ${error.message}`, latencyMs: latency });
    console.log(`   ❌ ERROR (${latency}ms): ${error.message}`);
  }
}

// Test 1: Health Check
async function testHealthEndpoint() {
  const response = await fetch(`${PAYAI_FACILITATOR_URL}/health`, { method: 'GET' });
  const text = await response.text();
  
  return {
    passed: response.ok && text.includes('OK'),
    details: `Status: ${response.status}, Response: "${text.trim()}"`
  };
}

// Test 2: Supported Networks
async function testSupportedNetworks() {
  const response = await fetch(`${PAYAI_FACILITATOR_URL}/supported`, { method: 'GET' });
  
  if (!response.ok) {
    return { passed: false, details: `Status: ${response.status}` };
  }
  
  const data = await response.json();
  const hasBase = JSON.stringify(data).toLowerCase().includes('base');
  const hasSolana = JSON.stringify(data).toLowerCase().includes('solana');
  
  return {
    passed: hasBase,
    details: `Base: ${hasBase ? '✓' : '✗'}, Solana: ${hasSolana ? '✓' : '✗'}, Networks: ${JSON.stringify(data).substring(0, 200)}...`
  };
}

// Test 3: Verify endpoint with sample EVM payload (expect validation error, not 500)
async function testVerifyEndpointEvm() {
  // Sample x402 verify request structure based on PayAI docs
  const samplePayload = {
    x402Version: 1,
    scheme: "exact",
    network: "base",
    payload: {
      signature: "0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
      authorization: {
        from: "0x857b06519E91e3A54538791bDbb0E22373e36b66",
        to: "0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91", // Coin Railz platform wallet
        value: "1000",
        validAfter: "0",
        validBefore: String(Math.floor(Date.now() / 1000) + 3600),
        nonce: "0x" + "0".repeat(64)
      }
    }
  };

  const paymentRequirements = {
    scheme: "exact",
    network: "base",
    maxAmountRequired: "1000",
    asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
    payTo: "0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91",
    resource: "https://coinrailz.com/test",
    description: "Test payment"
  };

  const response = await fetch(`${PAYAI_FACILITATOR_URL}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      payload: samplePayload,
      paymentRequirements
    })
  });

  const data = await response.json().catch(() => ({}));
  
  // We expect this to fail (invalid signature), but it should fail gracefully
  // A 400 with clear error is good. A 500 is concerning.
  const isGracefulError = response.status === 400 || 
                          response.status === 422 || 
                          (response.status === 200 && data.isValid === false);
  
  return {
    passed: isGracefulError || response.status !== 500,
    details: `Status: ${response.status}, Response: ${JSON.stringify(data).substring(0, 300)}`
  };
}

// Test 4: Verify endpoint with Solana format
async function testVerifyEndpointSolana() {
  const samplePayload = {
    x402Version: 1,
    scheme: "exact",
    network: "solana",
    payload: {
      transaction: "SGVsbG8gV29ybGQ=" // Dummy base64
    }
  };

  const paymentRequirements = {
    scheme: "exact",
    network: "solana",
    maxAmountRequired: "1000000",
    asset: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC on Solana
    payTo: "Hgby7VEo6vaPayM1G7kkjTqMAo4aCARoXA3ftWKz1m4k", // Coin Railz Solana wallet
    resource: "https://coinrailz.com/test",
    description: "Test payment"
  };

  const response = await fetch(`${PAYAI_FACILITATOR_URL}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      payload: samplePayload,
      paymentRequirements
    })
  });

  const data = await response.json().catch(() => ({}));
  
  // Expect graceful failure (invalid transaction), not 500
  const isGracefulError = response.status !== 500;
  
  return {
    passed: isGracefulError,
    details: `Status: ${response.status}, Response: ${JSON.stringify(data).substring(0, 300)}`
  };
}

// Test 5: Malformed payload handling
async function testMalformedPayload() {
  const response = await fetch(`${PAYAI_FACILITATOR_URL}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ garbage: "data", invalid: true })
  });

  const data = await response.json().catch(() => ({}));
  
  // Should return 400/422, not 500
  return {
    passed: response.status === 400 || response.status === 422,
    details: `Status: ${response.status}, Error handling: ${response.status === 400 || response.status === 422 ? 'proper' : 'poor'}`
  };
}

// Test 6: Rate limit burst test (25 requests)
async function testRateLimitBurst() {
  const requests = 25;
  const promises = [];
  
  for (let i = 0; i < requests; i++) {
    promises.push(
      fetch(`${PAYAI_FACILITATOR_URL}/health`, { method: 'GET' })
        .then(r => ({ status: r.status, ok: r.ok }))
        .catch(e => ({ status: 0, ok: false, error: e.message }))
    );
  }
  
  const start = Date.now();
  const responses = await Promise.all(promises);
  const elapsed = Date.now() - start;
  
  const successful = responses.filter(r => r.ok).length;
  const rateLimited = responses.filter(r => r.status === 429).length;
  const failed = responses.filter(r => !r.ok && r.status !== 429).length;
  
  return {
    passed: successful >= 20 && failed === 0, // Allow some rate limiting, but no failures
    details: `${requests} requests in ${elapsed}ms: ${successful} OK, ${rateLimited} rate-limited, ${failed} failed`,
    latencyMs: elapsed
  };
}

// Test 7: Latency measurement (median of 5 requests)
async function testLatencyMedian() {
  const latencies: number[] = [];
  
  for (let i = 0; i < 5; i++) {
    const start = Date.now();
    await fetch(`${PAYAI_FACILITATOR_URL}/health`, { method: 'GET' });
    latencies.push(Date.now() - start);
  }
  
  latencies.sort((a, b) => a - b);
  const median = latencies[2]; // Middle value
  
  return {
    passed: median < 1000, // Architect requirement: <1s median latency
    details: `Latencies: ${latencies.join('ms, ')}ms. Median: ${median}ms (target: <1000ms)`,
    latencyMs: median
  };
}

async function runAllTests() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  PayAI Facilitator Compatibility Test Suite');
  console.log('  Target: https://facilitator.payai.network');
  console.log('═══════════════════════════════════════════════════════════════');
  
  await test('1. Health Endpoint', testHealthEndpoint);
  await test('2. Supported Networks (Base check)', testSupportedNetworks);
  await test('3. Verify Endpoint - EVM/Base', testVerifyEndpointEvm);
  await test('4. Verify Endpoint - Solana', testVerifyEndpointSolana);
  await test('5. Malformed Payload Handling', testMalformedPayload);
  await test('6. Rate Limit Burst (25 requests)', testRateLimitBurst);
  await test('7. Latency Median (<1s target)', testLatencyMedian);
  
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  results.forEach(r => {
    console.log(`  ${r.passed ? '✅' : '❌'} ${r.name} ${r.latencyMs ? `(${r.latencyMs}ms)` : ''}`);
  });
  
  console.log('\n───────────────────────────────────────────────────────────────');
  console.log(`  Total: ${passed}/${results.length} passed, ${failed} failed`);
  console.log('───────────────────────────────────────────────────────────────');
  
  if (failed === 0) {
    console.log('\n✅ ALL TESTS PASSED - PayAI facilitator appears ready for Phase 2');
  } else if (failed <= 2) {
    console.log('\n⚠️  SOME TESTS FAILED - Review failures before proceeding to Phase 2');
  } else {
    console.log('\n❌ MULTIPLE FAILURES - Do not proceed to Phase 2 without investigation');
  }
  
  return { passed, failed, results };
}

// Run tests
runAllTests().catch(console.error);
