/**
 * INSTITUTIONAL CAPABILITIES ASSESSMENT
 * Tests platform readiness for large-scale institutional onboarding
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
        'User-Agent': 'Institutional-Assessment/1.0'
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

async function testInstitutionalCapabilities() {
  console.log('🏦 INSTITUTIONAL CAPABILITIES ASSESSMENT');
  console.log('=============================================================\n');

  const assessments = [
    {
      category: 'Circle Integration Infrastructure',
      tests: [
        {
          name: 'Circle Service Status',
          test: async () => {
            const response = await makeRequest('GET', '/api/circle/health');
            const operational = response.status === 200 && 
                              response.data.success && 
                              response.data.status.initialized;
            return { 
              passed: operational,
              details: operational ? 
                `Blockchains: ${response.data.status.supportedBlockchains.length}, Entity Secret: ${response.data.status.entitySecretRegistered}` : 
                'Circle service not operational'
            };
          }
        },
        {
          name: 'Multi-Chain USDC Support',
          test: async () => {
            const response = await makeRequest('GET', '/api/circle/health');
            const chains = response.data?.status?.supportedBlockchains || [];
            const hasInstitutionalChains = chains.includes('ETH') && chains.includes('MATIC') && chains.includes('BASE');
            return { 
              passed: hasInstitutionalChains && chains.length >= 5,
              details: `Supported chains: ${chains.join(', ')} (${chains.length} total)`
            };
          }
        }
      ]
    },
    {
      category: 'Transaction Volume Capabilities',
      tests: [
        {
          name: 'P2P Large Transaction Quote',
          test: async () => {
            const response = await makeRequest('POST', '/api/p2p/quote', {
              amount: 100000, // $100K test
              fromPlatform: 'usdc',
              toPlatform: 'usdc'
            });
            const canHandle = response.status === 200 && response.data.success;
            return { 
              passed: canHandle,
              details: canHandle ? 
                `Large transaction supported: $${response.data.quote?.amount || 'unknown'} quote generated` : 
                'Large transaction processing failed'
            };
          }
        },
        {
          name: 'DEX Institutional Volume',
          test: async () => {
            const response = await makeRequest('GET', '/api/dex/supported-chains');
            const chains = response.data?.chains || [];
            const hasInstitutionalLiquidity = chains.length >= 5;
            return { 
              passed: hasInstitutionalLiquidity,
              details: `DEX chains available: ${chains.length} (institutional threshold: 5+)`
            };
          }
        }
      ]
    },
    {
      category: 'KYC/AML Compliance',
      tests: [
        {
          name: 'Circle KYC Infrastructure',
          test: async () => {
            const response = await makeRequest('GET', '/api/circle/kyc/status');
            const hasKYC = response.status === 401; // Should require auth (KYC system exists)
            return { 
              passed: hasKYC,
              details: hasKYC ? 
                'KYC system operational (authentication required)' : 
                'KYC system not accessible'
            };
          }
        },
        {
          name: 'Institutional Authentication',
          test: async () => {
            const response = await makeRequest('GET', '/api/login');
            const hasAuth = response.status === 302 || response.status === 200;
            return { 
              passed: hasAuth,
              details: hasAuth ? 
                'OAuth authentication system operational' : 
                'Authentication system not working'
            };
          }
        }
      ]
    },
    {
      category: 'Enterprise API Infrastructure',
      tests: [
        {
          name: 'API Documentation Access',
          test: async () => {
            const response = await makeRequest('GET', '/api/docs');
            const hasAPIDocs = response.status === 200 && 
                             response.data.success && 
                             response.data.documentation;
            return { 
              passed: hasAPIDocs,
              details: hasAPIDocs ? 
                `API documentation available: ${response.data.documentation.endpoints.length} endpoint categories` : 
                'API documentation not available'
            };
          }
        },
        {
          name: 'Platform Statistics',
          test: async () => {
            const response = await makeRequest('GET', '/api/platform/stats');
            const hasStats = response.status === 200 && response.data.success;
            return { 
              passed: hasStats,
              details: hasStats ? 
                `Platform metrics: ${response.data.stats.totalUsers} users, ${response.data.stats.supportedNetworks} networks` : 
                'Platform statistics not available'
            };
          }
        }
      ]
    },
    {
      category: 'Institutional Revenue Streams',
      tests: [
        {
          name: 'AI Marketplace Enterprise Access',
          test: async () => {
            const response = await makeRequest('GET', '/api/agents/search');
            const hasMarketplace = response.status === 200 && response.data.success;
            return { 
              passed: hasMarketplace,
              details: hasMarketplace ? 
                'AI marketplace operational for enterprise automation' : 
                'AI marketplace not accessible'
            };
          }
        },
        {
          name: 'Platform Revenue Tracking',
          test: async () => {
            const response = await makeRequest('GET', '/api/platform/revenue');
            const hasRevenue = response.status === 200 && response.data.success;
            return { 
              passed: hasRevenue,
              details: hasRevenue ? 
                'Revenue tracking system operational' : 
                'Revenue tracking not available'
            };
          }
        }
      ]
    }
  ];

  let totalTests = 0;
  let passedTests = 0;
  let institutionalReadiness = {
    infrastructure: 0,
    compliance: 0,
    volume: 0,
    enterprise: 0,
    revenue: 0
  };

  for (const category of assessments) {
    console.log(`\n📊 ${category.category.toUpperCase()}`);
    console.log('─'.repeat(50));
    
    let categoryPassed = 0;
    let categoryTotal = category.tests.length;
    
    for (const test of category.tests) {
      totalTests++;
      try {
        const result = await test.test();
        if (result.passed) {
          console.log(`✅ ${test.name}: PASSED`);
          passedTests++;
          categoryPassed++;
        } else {
          console.log(`❌ ${test.name}: FAILED`);
        }
        console.log(`   ${result.details}`);
      } catch (error) {
        console.log(`❌ ${test.name}: ERROR - ${error.message}`);
      }
    }
    
    const categoryScore = (categoryPassed / categoryTotal) * 100;
    console.log(`\n📈 ${category.category} Score: ${categoryScore.toFixed(1)}%`);
    
    // Store category scores
    const categoryKey = category.category.toLowerCase().replace(/[^a-z]/g, '');
    if (categoryKey.includes('circle') || categoryKey.includes('infrastructure')) {
      institutionalReadiness.infrastructure = categoryScore;
    } else if (categoryKey.includes('kyc') || categoryKey.includes('compliance')) {
      institutionalReadiness.compliance = categoryScore;
    } else if (categoryKey.includes('volume') || categoryKey.includes('transaction')) {
      institutionalReadiness.volume = categoryScore;
    } else if (categoryKey.includes('api') || categoryKey.includes('enterprise')) {
      institutionalReadiness.enterprise = categoryScore;
    } else if (categoryKey.includes('revenue')) {
      institutionalReadiness.revenue = categoryScore;
    }
  }

  const overallScore = (passedTests / totalTests) * 100;
  
  console.log('\n' + '='.repeat(65));
  console.log('🏦 INSTITUTIONAL READINESS ASSESSMENT');
  console.log('='.repeat(65));
  console.log(`📊 Overall Score: ${overallScore.toFixed(1)}%`);
  console.log(`✅ Passed: ${passedTests}/${totalTests} tests`);
  
  console.log('\n📋 INSTITUTIONAL CAPABILITY BREAKDOWN:');
  console.log(`🔧 Infrastructure: ${institutionalReadiness.infrastructure.toFixed(1)}%`);
  console.log(`📋 Compliance: ${institutionalReadiness.compliance.toFixed(1)}%`);
  console.log(`💰 Volume Handling: ${institutionalReadiness.volume.toFixed(1)}%`);
  console.log(`🏢 Enterprise Features: ${institutionalReadiness.enterprise.toFixed(1)}%`);
  console.log(`📈 Revenue Systems: ${institutionalReadiness.revenue.toFixed(1)}%`);
  
  console.log('\n🎯 INSTITUTIONAL ONBOARDING ASSESSMENT:');
  
  if (overallScore >= 90) {
    console.log('✅ READY FOR INSTITUTIONAL CLIENTS');
    console.log('   Platform can handle large-scale institutional onboarding');
  } else if (overallScore >= 70) {
    console.log('⚠️  PARTIALLY READY FOR INSTITUTIONAL CLIENTS');
    console.log('   Some enhancements needed for full institutional support');
  } else {
    console.log('❌ NOT READY FOR INSTITUTIONAL CLIENTS');
    console.log('   Significant development required for institutional onboarding');
  }
  
  console.log('\n📝 KEY INSTITUTIONAL LIMITATIONS:');
  console.log('❌ Cannot mint USDC directly (Circle-only capability)');
  console.log('❌ Transaction volume limits may be restrictive');
  console.log('❌ No dedicated institutional support infrastructure');
  console.log('❌ Missing bulk processing capabilities');
  
  console.log('\n🚀 INSTITUTIONAL ENHANCEMENT RECOMMENDATIONS:');
  console.log('1. Increase transaction limits for verified institutions');
  console.log('2. Implement bulk transaction processing');
  console.log('3. Add institutional customer support tier');
  console.log('4. Create enterprise API access levels');
  console.log('5. Partner with Circle for large USDC procurement');
}

testInstitutionalCapabilities().catch(console.error);