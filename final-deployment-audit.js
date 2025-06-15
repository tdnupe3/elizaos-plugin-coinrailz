/**
 * Final Pre-Deployment Audit
 * Comprehensive validation of all critical platform systems
 */

import http from 'http';

async function makeRequest(method, endpoint, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: endpoint,
      method,
      headers: { 'Content-Type': 'application/json' }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function finalDeploymentAudit() {
  console.log('=== FINAL DEPLOYMENT READINESS AUDIT ===\n');
  
  const categories = {
    'Core Financial Systems': [
      {
        name: 'Fee Calculation Accuracy',
        test: async () => {
          const result = await makeRequest('POST', '/api/demo/calculate-fee', { amount: 1000, type: 'send_money' });
          return result.status === 200 && result.data.fee === 10 && result.data.feeRate === 1;
        }
      },
      {
        name: 'Commission System Profitability',
        test: async () => {
          const result = await makeRequest('POST', '/api/referrals/calculate-commission', { transactionAmount: 1000, referralTier: 'basic' });
          return result.status === 200 && result.data.commission === 3 && result.data.rate === 0.3;
        }
      },
      {
        name: 'Transaction Processing Security',
        test: async () => {
          const result = await makeRequest('POST', '/api/demo/send-money', { amount: -100, recipient: 'test@example.com' });
          return result.status === 400 && result.data.error === 'Amount must be positive';
        }
      }
    ],
    
    'User Management Systems': [
      {
        name: 'Demo User Access',
        test: async () => {
          const result = await makeRequest('GET', '/api/demo/user');
          return result.status === 200 && result.data.id === 'demo-user';
        }
      },
      {
        name: 'Balance Management',
        test: async () => {
          const result = await makeRequest('GET', '/api/demo/balances');
          return result.status === 200 && typeof result.data.usd === 'number';
        }
      },
      {
        name: 'Authentication Security',
        test: async () => {
          const result = await makeRequest('GET', '/api/admin/users', null);
          return result.status === 401;
        }
      }
    ],
    
    'Blockchain Integration': [
      {
        name: 'XRP Wallet Security',
        test: async () => {
          const result = await makeRequest('GET', '/api/xrp/wallet-info');
          return result.status === 200 && !JSON.stringify(result.data).toLowerCase().includes('private');
        }
      },
      {
        name: 'Transaction Initiation',
        test: async () => {
          const result = await makeRequest('POST', '/api/transactions/initiate', { 
            amount: 100, type: 'xrp_transfer', recipient: 'rXXXXXX' 
          });
          return result.status === 201 && result.data.success === true;
        }
      }
    ],
    
    'AI Agent Marketplace': [
      {
        name: 'Agent Registration',
        test: async () => {
          const result = await makeRequest('POST', '/api/ai-agents/register', {
            name: 'Test Agent',
            capabilities: ['data_analysis'],
            pricing: { hourly: 50 }
          });
          return result.status === 201 && result.data.success === true;
        }
      }
    ],
    
    'Platform Infrastructure': [
      {
        name: 'Health Check Response',
        test: async () => {
          const result = await makeRequest('GET', '/health');
          return result.status === 200 && result.data.status === 'ok';
        }
      },
      {
        name: 'SQL Injection Protection',
        test: async () => {
          const result = await makeRequest('GET', '/api/users/search?query=SELECT * FROM users');
          return result.status === 400;
        }
      }
    ]
  };

  let totalPassed = 0;
  let totalTests = 0;
  const results = {};

  for (const [category, tests] of Object.entries(categories)) {
    console.log(`\n${category}:`);
    results[category] = { passed: 0, total: tests.length, tests: [] };
    
    for (const test of tests) {
      totalTests++;
      try {
        const passed = await test.test();
        if (passed) {
          console.log(`  ✓ ${test.name}`);
          results[category].passed++;
          totalPassed++;
        } else {
          console.log(`  ✗ ${test.name}`);
        }
        results[category].tests.push({ name: test.name, passed });
      } catch (error) {
        console.log(`  ✗ ${test.name} - ERROR: ${error.message}`);
        results[category].tests.push({ name: test.name, passed: false, error: error.message });
      }
    }
  }

  const successRate = (totalPassed / totalTests * 100).toFixed(1);
  
  console.log('\n=== FINAL AUDIT RESULTS ===');
  console.log(`Overall Success Rate: ${totalPassed}/${totalTests} (${successRate}%)`);
  
  for (const [category, result] of Object.entries(results)) {
    const categoryRate = (result.passed / result.total * 100).toFixed(1);
    console.log(`${category}: ${result.passed}/${result.total} (${categoryRate}%)`);
  }

  console.log('\n=== DEPLOYMENT RECOMMENDATION ===');
  if (successRate >= '95.0') {
    console.log('🟢 APPROVED FOR PRODUCTION DEPLOYMENT');
    console.log('All critical systems operational and secure.');
    console.log('Platform ready for enterprise client onboarding.');
  } else if (successRate >= '85.0') {
    console.log('🟡 CONDITIONAL APPROVAL');
    console.log('Minor issues detected but core functionality intact.');
  } else {
    console.log('🔴 DEPLOYMENT BLOCKED');
    console.log('Critical issues must be resolved before deployment.');
  }

  return {
    successRate: parseFloat(successRate),
    totalPassed,
    totalTests,
    results,
    deploymentReady: parseFloat(successRate) >= 95.0
  };
}

// Wait for server startup then run audit
setTimeout(async () => {
  try {
    await finalDeploymentAudit();
  } catch (error) {
    console.error('Audit failed:', error);
  }
}, 2000);