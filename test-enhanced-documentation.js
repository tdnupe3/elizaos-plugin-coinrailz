/**
 * ENHANCED DOCUMENTATION VALIDATION TEST
 * Tests all documentation endpoints and comprehensive API coverage
 */

import http from 'http';

async function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Documentation-Test/1.0'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', (err) => reject(err));
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function testDocumentationEndpoints() {
  console.log('🚀 STARTING ENHANCED DOCUMENTATION VALIDATION TEST');
  console.log('=============================================================\n');

  const tests = [
    {
      name: 'API Documentation Endpoint',
      test: async () => {
        const response = await makeRequest('GET', '/api/docs');
        const success = response.status === 200 && 
                       response.data.success && 
                       response.data.documentation &&
                       response.data.documentation.title === 'Coin Railz API Documentation';
        return { 
          passed: success, 
          details: success ? `Found ${response.data.documentation.endpoints.length} endpoint categories` : 'Documentation structure invalid'
        };
      }
    },
    {
      name: 'Platform Statistics Endpoint',
      test: async () => {
        const response = await makeRequest('GET', '/api/platform/stats');
        const success = response.status === 200 && 
                       response.data.success && 
                       response.data.stats &&
                       response.data.stats.totalUsers;
        return { 
          passed: success, 
          details: success ? `${response.data.stats.totalUsers} users, ${response.data.stats.supportedNetworks} networks` : 'Statistics invalid'
        };
      }
    },
    {
      name: 'All Core Endpoints Available',
      test: async () => {
        const coreEndpoints = [
          '/api/health',
          '/api/platform/health',
          '/api/xrp/health',
          '/api/dex/tokens',
          '/api/dex/supported-chains',
          '/api/agents/search',
          '/api/platform/revenue'
        ];
        
        let passed = 0;
        for (const endpoint of coreEndpoints) {
          try {
            const response = await makeRequest('GET', endpoint);
            if (response.status === 200) passed++;
          } catch (e) {
            // Skip failed endpoints
          }
        }
        
        return { 
          passed: passed === coreEndpoints.length, 
          details: `${passed}/${coreEndpoints.length} core endpoints operational`
        };
      }
    },
    {
      name: 'P2P Quote System',
      test: async () => {
        const response = await makeRequest('POST', '/api/p2p/quote', {
          amount: 100,
          fromPlatform: 'paypal',
          toPlatform: 'crypto'
        });
        const success = response.status === 200 && response.data.success;
        return { 
          passed: success, 
          details: success ? 'Quote system operational' : 'Quote system failed'
        };
      }
    },
    {
      name: 'Circle KYC Authentication Protection',
      test: async () => {
        const response = await makeRequest('GET', '/api/circle/kyc/status');
        const success = response.status === 401; // Should require auth
        return { 
          passed: success, 
          details: success ? 'Authentication protection active' : 'Authentication protection failed'
        };
      }
    },
    {
      name: 'Multi-Chain DEX Support',
      test: async () => {
        const response = await makeRequest('GET', '/api/dex/supported-chains');
        const success = response.status === 200 && 
                       response.data.success && 
                       response.data.chains &&
                       response.data.chains.length >= 7;
        return { 
          passed: success, 
          details: success ? `${response.data.chains.length} blockchain networks supported` : 'DEX chain support insufficient'
        };
      }
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      console.log(`📋 Testing ${test.name}...`);
      const result = await test.test();
      
      if (result.passed) {
        console.log(`✅ ${test.name}: PASSED`);
        if (result.details) console.log(`   ${result.details}`);
        passed++;
      } else {
        console.log(`❌ ${test.name}: FAILED`);
        if (result.details) console.log(`   ${result.details}`);
        failed++;
      }
    } catch (error) {
      console.log(`❌ ${test.name}: ERROR - ${error.message}`);
      failed++;
    }
    console.log();
  }

  console.log('============================================================');
  console.log('📊 ENHANCED DOCUMENTATION VALIDATION RESULTS');
  console.log('============================================================');
  console.log(`✅ PASSED: ${passed}`);
  console.log(`❌ FAILED: ${failed}`);
  console.log(`📈 SUCCESS RATE: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  
  if (failed === 0) {
    console.log('🚀 DOCUMENTATION STATUS: FULLY OPERATIONAL');
    console.log('\n📋 DOCUMENTATION SUMMARY:');
    console.log('✅ API documentation endpoint active');
    console.log('✅ Platform statistics endpoint active');
    console.log('✅ All core endpoints operational');
    console.log('✅ Authentication protection working');
    console.log('✅ Multi-chain DEX support confirmed');
    console.log('✅ P2P quote system functional');
  } else {
    console.log('⚠️  DOCUMENTATION STATUS: ISSUES FOUND');
    console.log(`\n📋 ISSUES REQUIRING ATTENTION: ${failed}`);
  }
}

testDocumentationEndpoints().catch(console.error);