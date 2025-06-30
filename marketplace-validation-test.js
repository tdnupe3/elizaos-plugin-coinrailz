/**
 * MARKETPLACE VALIDATION TEST
 * Real-time validation of critical user flows after fixes
 */

import axios from 'axios';

const baseUrl = 'http://localhost:5000';

async function validateMarketplaceFlows() {
  console.log('🚀 VALIDATING MARKETPLACE CRITICAL FLOWS...\n');
  
  const results = { passed: 0, failed: 0, tests: [] };
  
  async function test(name, testFn) {
    try {
      const result = await testFn();
      if (result.success) {
        console.log(`✅ ${name}`);
        results.passed++;
        results.tests.push({ name, status: 'PASSED', details: result.data });
      } else {
        console.log(`❌ ${name}: ${result.error}`);
        results.failed++;
        results.tests.push({ name, status: 'FAILED', error: result.error });
      }
    } catch (error) {
      console.log(`❌ ${name}: ${error.message}`);
      results.failed++;
      results.tests.push({ name, status: 'FAILED', error: error.message });
    }
  }
  
  // Test 1: Agent Discovery
  await test('Agent Discovery System', async () => {
    const response = await axios.get(`${baseUrl}/api/agents/list`);
    const agents = response.data?.data?.agents || [];
    return { 
      success: agents.length > 0, 
      data: `Found ${agents.length} agents`,
      error: agents.length === 0 ? 'No agents found' : null
    };
  });
  
  // Test 2: Filtered Agent Search
  await test('Agent Search Filtering', async () => {
    const response = await axios.get(`${baseUrl}/api/agents/list?specialization=data`);
    const agents = response.data?.data?.agents || [];
    return { 
      success: agents.length > 0, 
      data: `Found ${agents.length} data analysis agents`,
      error: agents.length === 0 ? 'No data analysis agents found' : null
    };
  });
  
  // Test 3: Dispute Creation
  await test('Dispute System', async () => {
    const response = await axios.post(`${baseUrl}/api/disputes/create`, {
      orderId: 'order_validation_test',
      customerId: 'customer_test',
      agentId: 'agent_sarah_ai',
      reason: 'work_poor_quality',
      description: 'Validation test dispute',
      requestedResolution: 'revision'
    });
    return { 
      success: response.data?.success === true, 
      data: response.data?.data?.disputeId || 'Dispute created',
      error: response.data?.success ? null : 'Dispute creation failed'
    };
  });
  
  // Test 4: Messaging System
  await test('Customer-Agent Messaging', async () => {
    const response = await axios.post(`${baseUrl}/api/messaging/send`, {
      orderId: 'order_validation_test',
      fromId: 'customer_test',
      fromType: 'customer',
      toId: 'agent_sarah_ai',
      toType: 'agent',
      content: 'Validation test message'
    });
    return { 
      success: response.data?.success === true, 
      data: response.data?.data?.messageId || 'Message sent',
      error: response.data?.success ? null : 'Message sending failed'
    };
  });
  
  // Test 5: Order Creation
  await test('Order Processing', async () => {
    const response = await axios.post(`${baseUrl}/api/orders/create`, {
      serviceId: 'svc_validation_001',
      customerId: 'customer_test',
      requirements: 'Validation test order',
      deadline: '2025-07-15',
      budget: 150,
      priority: 'normal'
    });
    return { 
      success: response.data?.success === true, 
      data: response.data?.data?.orderId || 'Order created',
      error: response.data?.success ? null : 'Order creation failed'
    };
  });
  
  // Test 6: Review System (add endpoint if missing)
  await test('Review System', async () => {
    try {
      const response = await axios.post(`${baseUrl}/api/reviews/create`, {
        orderId: 'order_validation_test',
        customerId: 'customer_test',
        agentId: 'agent_sarah_ai',
        rating: 5,
        comment: 'Validation test review'
      });
      return { 
        success: response.data?.success === true, 
        data: 'Review created',
        error: response.data?.success ? null : 'Review creation failed'
      };
    } catch (error) {
      if (error.response?.status === 404) {
        return { success: false, error: 'Review endpoint not implemented' };
      }
      throw error;
    }
  });
  
  console.log('\n================================================================================');
  console.log('📊 MARKETPLACE VALIDATION RESULTS');
  console.log('================================================================================');
  console.log(`✅ Passed Tests: ${results.passed}`);
  console.log(`❌ Failed Tests: ${results.failed}`);
  console.log(`📈 Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);
  
  const readinessScore = (results.passed / (results.passed + results.failed)) * 100;
  
  if (readinessScore >= 90) {
    console.log('🎯 STATUS: PRODUCTION READY');
  } else if (readinessScore >= 75) {
    console.log('🎯 STATUS: NEARLY READY - Minor fixes needed');
  } else if (readinessScore >= 60) {
    console.log('🎯 STATUS: FUNCTIONAL - Some gaps remain');
  } else {
    console.log('🎯 STATUS: REQUIRES WORK');
  }
  
  console.log('\n📋 DETAILED RESULTS:');
  results.tests.forEach((test, index) => {
    const status = test.status === 'PASSED' ? '✅' : '❌';
    console.log(`   ${index + 1}. ${status} ${test.name}`);
    if (test.details) console.log(`      Details: ${test.details}`);
    if (test.error) console.log(`      Error: ${test.error}`);
  });
  
  console.log('================================================================================\n');
  
  return results;
}

validateMarketplaceFlows().catch(console.error);