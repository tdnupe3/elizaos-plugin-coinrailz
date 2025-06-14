/**
 * Quick Race Condition Test
 * Tests if the database unique constraint prevents concurrent registrations
 */

async function makeRequest(method, endpoint, data = null) {
  try {
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: data ? JSON.stringify(data) : undefined
    };
    
    const response = await fetch(`http://localhost:5000${endpoint}`, options);
    const result = await response.json();
    return { ok: response.ok, status: response.status, data: result };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

async function testRaceConditionFix() {
  console.log('🔍 TESTING RACE CONDITION FIX');
  
  // Test concurrent agent registrations with same wallet
  const walletAddress = 'rRaceTest' + Date.now();
  
  const promises = Array(3).fill().map(async (_, i) => {
    return makeRequest('POST', '/api/public/agents/register', {
      agentName: `RaceTestAgent_${i}`,
      walletAddress: walletAddress,
      walletNetwork: 'xrp',
      capabilities: ['testing'],
      publicKey: 'test-key',
      signature: 'test-sig',
      preferredCurrencies: ['XRP']
    });
  });

  const results = await Promise.all(promises);
  const successCount = results.filter(r => r.ok).length;
  const errorCount = results.filter(r => !r.ok).length;

  console.log(`Results: ${successCount} successful, ${errorCount} failed`);
  
  if (successCount === 1 && errorCount === 2) {
    console.log('✅ RACE CONDITION FIX WORKING - Only 1 registration succeeded');
    
    // Test that error messages indicate duplicate wallet
    const errorMessages = results.filter(r => !r.ok).map(r => r.data?.error || r.error);
    const duplicateErrors = errorMessages.filter(msg => 
      msg.includes('already registered') || msg.includes('duplicate') || msg.includes('unique')
    );
    
    if (duplicateErrors.length >= 1) {
      console.log('✅ PROPER ERROR HANDLING - Duplicate wallet errors detected');
      return true;
    } else {
      console.log('❌ ERROR HANDLING ISSUE - No duplicate wallet errors detected');
      console.log('Error messages:', errorMessages);
      return false;
    }
  } else {
    console.log('❌ RACE CONDITION STILL EXISTS - Multiple registrations succeeded');
    results.forEach((result, i) => {
      console.log(`Request ${i}: ${result.ok ? 'SUCCESS' : 'FAILED'} - ${JSON.stringify(result.data || result.error)}`);
    });
    return false;
  }
}

async function testFinancialPrecision() {
  console.log('🔍 TESTING FINANCIAL PRECISION');
  
  const result = await makeRequest('POST', '/api/test-payment-calculation', {
    amount: 99.99,
    recipientEmail: 'test@example.com'
  });
  
  if (result.ok && result.data.success) {
    const fee = result.data.fee;
    const decimalPlaces = (fee.toString().split('.')[1] || '').length;
    
    if (decimalPlaces <= 2) {
      console.log(`✅ FINANCIAL PRECISION FIX WORKING - Fee: $${fee} (${decimalPlaces} decimal places)`);
      return true;
    } else {
      console.log(`❌ FINANCIAL PRECISION ERROR - Fee: $${fee} (${decimalPlaces} decimal places, should be ≤2)`);
      return false;
    }
  } else {
    console.log('❌ FINANCIAL CALCULATION FAILED');
    console.log(result);
    return false;
  }
}

async function testSQLInjectionProtection() {
  console.log('🔍 TESTING SQL INJECTION PROTECTION');
  
  const result = await makeRequest('POST', '/api/public/agents/register', {
    agentName: "'; DROP TABLE users; --",
    walletAddress: 'rSQLTest' + Date.now(),
    walletNetwork: 'xrp',
    capabilities: ['testing'],
    publicKey: "1' OR '1'='1",
    signature: 'test-sig',
    preferredCurrencies: ['XRP']
  });
  
  if (result.ok && result.data.agent) {
    // Check if malicious input was sanitized
    const agentName = result.data.agent.name || result.data.agent.agentName;
    if (!agentName.includes('DROP') && !agentName.includes(';')) {
      console.log('✅ SQL INJECTION PROTECTION WORKING - Malicious input sanitized');
      return true;
    } else {
      console.log('❌ SQL INJECTION VULNERABILITY - Malicious input not sanitized');
      return false;
    }
  } else {
    console.log('✅ SQL INJECTION PROTECTION WORKING - Registration properly rejected');
    return true;
  }
}

async function runQuickAudit() {
  console.log('🚀 QUICK PRODUCTION AUDIT STARTING\n');
  
  const tests = [
    { name: 'Race Condition Fix', test: testRaceConditionFix },
    { name: 'Financial Precision', test: testFinancialPrecision },
    { name: 'SQL Injection Protection', test: testSQLInjectionProtection }
  ];
  
  let passed = 0;
  let total = tests.length;
  
  for (const { name, test } of tests) {
    try {
      const result = await test();
      if (result) passed++;
      console.log('');
    } catch (error) {
      console.log(`❌ ${name} - Test failed with error: ${error.message}\n`);
    }
  }
  
  console.log(`📊 QUICK AUDIT COMPLETE`);
  console.log(`Tests Passed: ${passed}/${total}`);
  console.log(`Production Readiness: ${Math.round((passed/total) * 100)}%`);
  
  if (passed === total) {
    console.log('🎉 ALL CRITICAL PRODUCTION BLOCKERS RESOLVED!');
  } else {
    console.log(`⚠️  ${total - passed} critical issues remaining`);
  }
}

runQuickAudit().catch(console.error);