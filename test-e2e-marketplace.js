#!/usr/bin/env node
/**
 * End-to-End Marketplace Testing Script
 * Tests all 3 AI agents with autonomous customer journey
 */

const BASE_URL = 'http://localhost:5000';

async function testEndpoint(name, method, path, body = null) {
  console.log(`\n🧪 Testing: ${name}`);
  console.log(`   ${method} ${path}`);
  
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(`${BASE_URL}${path}`, options);
    const data = await response.json();
    
    if (response.ok) {
      console.log(`   ✅ SUCCESS (${response.status})`);
      return { success: true, data, status: response.status };
    } else {
      console.log(`   ❌ FAILED (${response.status})`);
      console.log(`   Error: ${JSON.stringify(data, null, 2)}`);
      return { success: false, data, status: response.status };
    }
  } catch (error) {
    console.log(`   ❌ ERROR: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('🚀 Starting End-to-End Marketplace Tests\n');
  console.log('=' .repeat(60));
  
  const results = [];
  
  // Test 1: Agent Discovery
  console.log('\n📋 STEP 1: AGENT DISCOVERY (A2A Protocol)');
  console.log('='.repeat(60));
  
  const directoryTest = await testEndpoint(
    'Agent Directory',
    'GET',
    '/api/agents/directory'
  );
  results.push({ test: 'Agent Directory', ...directoryTest });
  
  if (directoryTest.success) {
    console.log(`   Found ${directoryTest.data.agents?.length || 0} agents`);
  }
  
  // Test agent cards for all 3 agents
  const agentIds = ['smart-contract-auditor', 'payment-processor', 'compliance-consultant'];
  
  for (const agentId of agentIds) {
    const cardTest = await testEndpoint(
      `Agent Card: ${agentId}`,
      'GET',
      `/agent/${agentId}/.well-known/agent-card.json`
    );
    results.push({ test: `Agent Card: ${agentId}`, ...cardTest });
    
    if (cardTest.success) {
      const card = cardTest.data;
      console.log(`   Capabilities: ${card.capabilities?.join(', ')}`);
      console.log(`   Pricing: ${JSON.stringify(card.pricing)}`);
    }
  }
  
  // Test 2: Smart Contract Auditor
  console.log('\n\n🔐 STEP 2: SMART CONTRACT AUDITOR TEST');
  console.log('='.repeat(60));
  
  const auditOrder = await testEndpoint(
    'Create Audit Order',
    'POST',
    '/api/marketplace/order',
    {
      agentId: 'smart-contract-auditor',
      customerRequirements: JSON.stringify({
        contractDetails: {
          sourceCode: `
            pragma solidity ^0.8.0;
            contract TestToken {
              mapping(address => uint256) public balances;
              function transfer(address to, uint256 amount) public {
                balances[msg.sender] -= amount;
                balances[to] += amount;
              }
            }
          `,
          language: 'solidity',
          compilerVersion: '0.8.0',
        },
      }),
      priceUSDC: 50,
    }
  );
  results.push({ test: 'Create Audit Order', ...auditOrder });
  
  if (auditOrder.success) {
    const orderId = auditOrder.data.order?.id;
    console.log(`   Order ID: ${orderId}`);
    console.log(`   Status: ${auditOrder.data.order?.status}`);
    console.log(`   Payment Address: ${auditOrder.data.paymentAddress}`);
  }
  
  // Test 3: Payment Processor
  console.log('\n\n💳 STEP 3: PAYMENT PROCESSOR TEST');
  console.log('='.repeat(60));
  
  const paymentOrder = await testEndpoint(
    'Create Payment Order',
    'POST',
    '/api/marketplace/order',
    {
      agentId: 'payment-processor',
      customerRequirements: JSON.stringify({
        paymentDetails: {
          recipientAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
          amount: 100,
          currency: 'USDC',
          network: 'base',
        },
      }),
      priceUSDC: 10,
    }
  );
  results.push({ test: 'Create Payment Order', ...paymentOrder });
  
  if (paymentOrder.success) {
    const orderId = paymentOrder.data.order?.id;
    console.log(`   Order ID: ${orderId}`);
    console.log(`   Status: ${paymentOrder.data.order?.status}`);
    console.log(`   Payment Address: ${paymentOrder.data.paymentAddress}`);
  }
  
  // Test 4: Compliance Consultant
  console.log('\n\n🔍 STEP 4: COMPLIANCE CONSULTANT TEST');
  console.log('='.repeat(60));
  
  const complianceOrder = await testEndpoint(
    'Create Compliance Order',
    'POST',
    '/api/marketplace/order',
    {
      agentId: 'compliance-consultant',
      customerRequirements: JSON.stringify({
        complianceRequirements: {
          jurisdiction: 'US',
          businessType: 'fintech',
          transactionVolume: 100000,
        },
      }),
      priceUSDC: 25,
    }
  );
  results.push({ test: 'Create Compliance Order', ...complianceOrder });
  
  if (complianceOrder.success) {
    const orderId = complianceOrder.data.order?.id;
    console.log(`   Order ID: ${orderId}`);
    console.log(`   Status: ${complianceOrder.data.order?.status}`);
    console.log(`   Payment Address: ${complianceOrder.data.paymentAddress}`);
  }
  
  // Test 5: AML Screening
  console.log('\n\n🛡️ STEP 5: AML SCREENING TEST');
  console.log('='.repeat(60));
  
  const amlOrder = await testEndpoint(
    'Create AML Screening Order',
    'POST',
    '/api/marketplace/order',
    {
      agentId: 'compliance-consultant',
      customerRequirements: JSON.stringify({
        amlScreeningDetails: {
          address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
          amount: 5000,
          country: 'US',
        },
      }),
      priceUSDC: 15,
    }
  );
  results.push({ test: 'Create AML Order', ...amlOrder });
  
  if (amlOrder.success) {
    const orderId = amlOrder.data.order?.id;
    console.log(`   Order ID: ${orderId}`);
    console.log(`   Status: ${amlOrder.data.order?.status}`);
  }
  
  // Summary
  console.log('\n\n📊 TEST SUMMARY');
  console.log('='.repeat(60));
  
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`\nTotal Tests: ${results.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / results.length) * 100).toFixed(1)}%`);
  
  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`   - ${r.test}`);
    });
  }
  
  // Return test order IDs for cleanup
  const orderIds = [];
  if (auditOrder.success) orderIds.push(auditOrder.data.order?.id);
  if (paymentOrder.success) orderIds.push(paymentOrder.data.order?.id);
  if (complianceOrder.success) orderIds.push(complianceOrder.data.order?.id);
  if (amlOrder.success) orderIds.push(amlOrder.data.order?.id);
  
  console.log('\n📝 Test Order IDs (for cleanup):');
  orderIds.forEach(id => console.log(`   - ${id}`));
  
  return {
    passed,
    failed,
    total: results.length,
    successRate: (passed / results.length) * 100,
    orderIds,
  };
}

// Run tests
runTests()
  .then(summary => {
    console.log('\n✅ Testing complete!\n');
    process.exit(summary.failed > 0 ? 1 : 0);
  })
  .catch(error => {
    console.error('\n❌ Testing failed with error:', error);
    process.exit(1);
  });
