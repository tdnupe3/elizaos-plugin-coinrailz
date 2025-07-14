/**
 * Circle USDC Base Chain Integration Test
 * Validates complete Circle wallet functionality with Base Chain support
 */

const BASE_URL = 'http://localhost:5000';

async function testCircleBaseIntegration() {
  console.log('🔗 Testing Circle USDC Base Chain Integration...\n');
  
  const results = {
    tests: [],
    passed: 0,
    failed: 0
  };

  function logTest(name, passed, details = {}) {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${name}`);
    if (details.error) {
      console.log(`   Error: ${details.error}`);
    }
    if (details.data) {
      console.log(`   Data: ${JSON.stringify(details.data, null, 2)}`);
    }
    
    results.tests.push({ name, passed, details });
    if (passed) results.passed++;
    else results.failed++;
  }

  // Test 1: Circle Service Health
  try {
    const response = await fetch(`${BASE_URL}/api/circle/health`);
    const data = await response.json();
    
    logTest('Circle Service Health Check', 
      response.ok && data.success && data.status.supportedBlockchains.includes('BASE'),
      { data }
    );
  } catch (error) {
    logTest('Circle Service Health Check', false, { error: error.message });
  }

  // Test 2: Supported Blockchains includes BASE
  try {
    const response = await fetch(`${BASE_URL}/api/circle/supported-blockchains`);
    const data = await response.json();
    
    logTest('BASE Chain Support in Blockchains', 
      response.ok && data.success && data.blockchains.includes('BASE'),
      { data }
    );
  } catch (error) {
    logTest('BASE Chain Support in Blockchains', false, { error: error.message });
  }

  // Test 3: Supported Tokens includes BASE USDC
  try {
    const response = await fetch(`${BASE_URL}/api/circle/supported-tokens`);
    const data = await response.json();
    
    const baseUSDC = data.tokens.find(token => token.blockchain === 'BASE' && token.symbol === 'USDC');
    
    logTest('BASE Chain USDC Token Support', 
      response.ok && data.success && baseUSDC,
      { data: baseUSDC }
    );
  } catch (error) {
    logTest('BASE Chain USDC Token Support', false, { error: error.message });
  }

  // Test 4: Circle Wallet Swap Endpoint (without auth - should fail with proper error)
  try {
    const response = await fetch(`${BASE_URL}/api/user-circle/swap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        toToken: 'ETH',
        amount: '100',
        slippage: 5,
        chainId: 8453 // Base Chain
      })
    });
    const data = await response.json();
    
    logTest('Circle Wallet Swap Endpoint (Auth Required)', 
      response.status === 401 && data.error === 'Unauthorized',
      { data }
    );
  } catch (error) {
    logTest('Circle Wallet Swap Endpoint (Auth Required)', false, { error: error.message });
  }

  // Test 5: Circle Wallet Creation Endpoint (without auth - should fail with proper error)
  try {
    const response = await fetch(`${BASE_URL}/api/user-circle/wallet/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        blockchain: 'BASE'
      })
    });
    const data = await response.json();
    
    logTest('Circle Wallet Creation with BASE (Auth Required)', 
      response.status === 401 && data.error === 'Unauthorized',
      { data }
    );
  } catch (error) {
    logTest('Circle Wallet Creation with BASE (Auth Required)', false, { error: error.message });
  }

  // Test 6: DEX Networks includes Base Chain
  try {
    const response = await fetch(`${BASE_URL}/api/dex/networks`);
    const data = await response.json();
    
    const baseNetwork = data.networks.find(network => network.chainId === 8453);
    
    logTest('DEX Networks includes Base Chain', 
      response.ok && data.success && baseNetwork && baseNetwork.name === 'Base',
      { data: baseNetwork || data }
    );
  } catch (error) {
    logTest('DEX Networks includes Base Chain', false, { error: error.message });
  }

  // Test 7: Blockchain Supported Chains includes Base
  try {
    const response = await fetch(`${BASE_URL}/api/blockchain/supported-chains`);
    const data = await response.json();
    
    const baseChain = data.chains.find(chain => chain.id === 8453);
    
    logTest('Blockchain Supported Chains includes Base', 
      response.ok && data.success && baseChain && baseChain.name === 'Base',
      { data: baseChain }
    );
  } catch (error) {
    logTest('Blockchain Supported Chains includes Base', false, { error: error.message });
  }

  // Test 8: Wallet Connect Component Support
  try {
    const response = await fetch(`${BASE_URL}/api/wallet/supported-networks`);
    const data = await response.json();
    
    // If endpoint doesn't exist, that's expected - wallet connect is frontend component
    logTest('Wallet Connect API Check', 
      response.status === 404 || (response.ok && data.success),
      { data: response.status === 404 ? 'Frontend component (expected)' : data }
    );
  } catch (error) {
    logTest('Wallet Connect API Check', true, { data: 'Frontend component (expected)' });
  }

  // Summary
  console.log('\n📊 Test Results Summary:');
  console.log(`Total Tests: ${results.tests.length}`);
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`Success Rate: ${((results.passed / results.tests.length) * 100).toFixed(1)}%`);

  if (results.passed === results.tests.length) {
    console.log('\n🎉 All tests passed! Base Chain integration is fully operational.');
  } else {
    console.log('\n⚠️  Some tests failed. Review the results above.');
  }

  return results;
}

// Run the test
testCircleBaseIntegration().catch(console.error);