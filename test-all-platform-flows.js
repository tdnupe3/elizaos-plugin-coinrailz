/**
 * Comprehensive Platform User Flow Test
 * Tests ALL platform features: P2P transfers, DEX aggregator, AI marketplace, commissions, etc.
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

async function testEndpoint(testName, method, endpoint, expectedStatus = 200, data = null) {
  try {
    const result = await makeRequest(method, endpoint, data);
    const passed = result.status === expectedStatus;
    
    console.log(`${passed ? '✓' : '✗'} ${testName}: ${result.status} ${passed ? 'PASS' : 'FAIL'}`);
    if (!passed && result.data) {
      console.log(`   Response: ${JSON.stringify(result.data).substring(0, 100)}`);
    }
    
    return { passed, result };
  } catch (error) {
    console.log(`✗ ${testName}: ERROR - ${error.message}`);
    return { passed: false, error: error.message };
  }
}

async function testAllPlatformFlows() {
  console.log('=== COMPREHENSIVE PLATFORM FLOW AUDIT ===\n');
  
  const flowTests = {
    'P2P Transfer System': [
      {
        name: 'Fee Calculation',
        test: () => testEndpoint('P2P Fee Calculation', 'POST', '/api/demo/calculate-fee', 
          200, { amount: 1000, type: 'send_money' })
      },
      {
        name: 'Send Money Transaction',
        test: () => testEndpoint('P2P Send Money', 'POST', '/api/demo/send-money',
          200, { amount: 500, recipient: 'user@example.com', note: 'Test transfer' })
      },
      {
        name: 'P2P Transfer Processing',
        test: () => testEndpoint('P2P Transfer', 'POST', '/api/p2p/transfer',
          200, { fromCurrency: 'USD', toCurrency: 'BTC', amount: 100, recipient: 'test@example.com' })
      },
      {
        name: 'Balance Updates',
        test: () => testEndpoint('Balance Update', 'POST', '/api/demo/update-balance',
          200, { userId: 'test-user', amount: 100 })
      }
    ],
    
    'DEX Aggregator': [
      {
        name: 'DEX Price Quotes',
        test: () => testEndpoint('DEX Quotes', 'GET', '/api/dex/quotes?from=ETH&to=USDC&amount=1')
      },
      {
        name: 'Swap Execution',
        test: () => testEndpoint('DEX Swap', 'POST', '/api/dex/swap',
          200, { fromToken: 'ETH', toToken: 'USDC', amount: 0.1, slippage: 0.5 })
      },
      {
        name: 'Liquidity Pool Data',
        test: () => testEndpoint('DEX Liquidity', 'GET', '/api/dex/liquidity')
      },
      {
        name: 'DEX Route Optimization',
        test: () => testEndpoint('DEX Routes', 'GET', '/api/dex/routes?from=BTC&to=ETH&amount=0.01')
      }
    ],
    
    'AI Agent Marketplace': [
      {
        name: 'Agent Registration',
        test: () => testEndpoint('AI Agent Registration', 'POST', '/api/ai-agents/register',
          201, { name: 'DataAnalyst', capabilities: ['analysis'], pricing: { hourly: 50 } })
      },
      {
        name: 'Agent Marketplace Listing',
        test: () => testEndpoint('Agent Marketplace', 'GET', '/api/ai-agents/marketplace')
      },
      {
        name: 'Agent Service Request',
        test: () => testEndpoint('Service Request', 'POST', '/api/ai-agents/request-service',
          200, { agentId: 'agent-123', serviceType: 'analysis', budget: 100 })
      },
      {
        name: 'Agent Commission Calculation',
        test: () => testEndpoint('Agent Commission', 'POST', '/api/ai-agents/calculate-commission',
          200, { transactionAmount: 1000, agentTier: 'premium' })
      }
    ],
    
    'XRP Integration': [
      {
        name: 'XRP Wallet Info',
        test: () => testEndpoint('XRP Wallet', 'GET', '/api/xrp/wallet-info')
      },
      {
        name: 'XRP Balance Check',
        test: () => testEndpoint('XRP Balance', 'GET', '/api/xrp/balance')
      },
      {
        name: 'XRP Transaction Demo',
        test: () => testEndpoint('XRP Demo Send', 'POST', '/api/xrp/demo-send',
          200, { amount: 10, destination: 'rXXXXXXXXXXXXXXXXXXXXXXXXXXX' })
      },
      {
        name: 'XRP Fee Estimation',
        test: () => testEndpoint('XRP Fees', 'GET', '/api/xrp/estimate-fee?amount=100')
      },
      {
        name: 'XRP Network Status',
        test: () => testEndpoint('XRP Network', 'GET', '/api/xrp/network-status')
      }
    ],
    
    'Ethereum Integration': [
      {
        name: 'ETH Wallet Creation',
        test: () => testEndpoint('ETH Wallet', 'POST', '/api/ethereum/create-wallet',
          201, { userId: 'test-user' })
      },
      {
        name: 'ETH Balance Check',
        test: () => testEndpoint('ETH Balance', 'GET', '/api/ethereum/balance/0x742d35Cc6634C0532925a3b8D430d8C5b6f3e234')
      },
      {
        name: 'ERC-20 Token Support',
        test: () => testEndpoint('ERC-20 Tokens', 'GET', '/api/ethereum/tokens')
      },
      {
        name: 'ETH Gas Price',
        test: () => testEndpoint('ETH Gas', 'GET', '/api/ethereum/gas-price')
      },
      {
        name: 'ETH Transaction Estimation',
        test: () => testEndpoint('ETH Estimate', 'POST', '/api/ethereum/estimate-transaction',
          200, { to: '0x742d35Cc6634C0532925a3b8D430d8C5b6f3e234', amount: '0.1' })
      }
    ],
    
    'Revenue & Commission Systems': [
      {
        name: 'Referral Commission Calculation',
        test: () => testEndpoint('Referral Commission', 'POST', '/api/referrals/calculate-commission',
          200, { transactionAmount: 1000, referralTier: 'basic' })
      },
      {
        name: 'Revenue Tracking',
        test: () => testEndpoint('Revenue Stats', 'GET', '/api/revenue/stats')
      },
      {
        name: 'Transaction History',
        test: () => testEndpoint('Transaction History', 'GET', '/api/demo/transactions')
      },
      {
        name: 'Platform Analytics',
        test: () => testEndpoint('Analytics', 'GET', '/api/analytics/dashboard')
      }
    ],
    
    'User Management & Security': [
      {
        name: 'User Profile',
        test: () => testEndpoint('User Profile', 'GET', '/api/demo/user')
      },
      {
        name: 'User Balances',
        test: () => testEndpoint('User Balances', 'GET', '/api/demo/balances')
      },
      {
        name: 'Authentication Security',
        test: () => testEndpoint('Auth Security', 'GET', '/api/admin/users', 401)
      },
      {
        name: 'SQL Injection Protection',
        test: () => testEndpoint('SQL Protection', 'GET', '/api/users/search?query=DROP TABLE users', 400)
      }
    ],
    
    'Crypto Trading & Exchange': [
      {
        name: 'Crypto Price Data',
        test: () => testEndpoint('Crypto Prices', 'GET', '/api/demo/crypto-prices')
      },
      {
        name: 'Exchange Rates',
        test: () => testEndpoint('Exchange Rates', 'GET', '/api/ramp/rates')
      },
      {
        name: 'Buy Crypto',
        test: () => testEndpoint('Buy Crypto', 'POST', '/api/ramp/buy',
          200, { amount: 100, currency: 'USD', cryptoCurrency: 'BTC' })
      },
      {
        name: 'Sell Crypto',
        test: () => testEndpoint('Sell Crypto', 'POST', '/api/ramp/sell',
          200, { amount: 0.001, cryptoCurrency: 'BTC', currency: 'USD' })
      }
    ]
  };

  let totalTests = 0;
  let totalPassed = 0;
  const results = {};

  for (const [category, tests] of Object.entries(flowTests)) {
    console.log(`\n=== ${category.toUpperCase()} ===`);
    
    let categoryPassed = 0;
    const categoryResults = [];
    
    for (const test of tests) {
      totalTests++;
      const result = await test.test();
      
      if (result.passed) {
        categoryPassed++;
        totalPassed++;
      }
      
      categoryResults.push({
        name: test.name,
        passed: result.passed,
        status: result.result?.status,
        error: result.error
      });
    }
    
    const categoryRate = (categoryPassed / tests.length * 100).toFixed(1);
    console.log(`${category} Success Rate: ${categoryPassed}/${tests.length} (${categoryRate}%)`);
    
    results[category] = {
      passed: categoryPassed,
      total: tests.length,
      rate: parseFloat(categoryRate),
      tests: categoryResults
    };
  }

  const overallRate = (totalPassed / totalTests * 100).toFixed(1);
  
  console.log('\n=== COMPREHENSIVE PLATFORM AUDIT RESULTS ===');
  console.log(`Overall Success Rate: ${totalPassed}/${totalTests} (${overallRate}%)`);
  
  console.log('\n=== CATEGORY BREAKDOWN ===');
  Object.entries(results).forEach(([category, result]) => {
    const status = result.rate >= 80 ? '🟢' : result.rate >= 60 ? '🟡' : '🔴';
    console.log(`${status} ${category}: ${result.rate}%`);
  });

  console.log('\n=== FAILED COMPONENTS ===');
  Object.entries(results).forEach(([category, result]) => {
    const failed = result.tests.filter(t => !t.passed);
    if (failed.length > 0) {
      console.log(`\n${category}:`);
      failed.forEach(test => {
        console.log(`  ✗ ${test.name}: ${test.error || `Status ${test.status}`}`);
      });
    }
  });

  console.log('\n=== PRODUCTION READINESS ASSESSMENT ===');
  if (overallRate >= 85) {
    console.log('🟢 PLATFORM READY FOR PRODUCTION');
    console.log('All major user flows operational');
  } else if (overallRate >= 70) {
    console.log('🟡 PLATFORM NEEDS MINOR FIXES');
    console.log('Core functionality working, some features need attention');
  } else {
    console.log('🔴 PLATFORM NEEDS MAJOR FIXES');
    console.log('Critical user flows require immediate attention');
  }

  return { totalPassed, totalTests, overallRate: parseFloat(overallRate), results };
}

// Wait for server startup then run comprehensive test
setTimeout(async () => {
  try {
    await testAllPlatformFlows();
  } catch (error) {
    console.error('Platform audit failed:', error);
  }
}, 2000);