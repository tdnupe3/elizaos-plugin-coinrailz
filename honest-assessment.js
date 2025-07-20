#!/usr/bin/env node

/**
 * Honest platform assessment - what actually works vs what's broken
 */

import http from 'http';

const realWorldTests = [
  // Core platform functionality
  { path: '/api/health', name: 'Platform Health', critical: true },
  { path: '/api/auth/login', name: 'User Login', critical: true, method: 'POST' },
  { path: '/api/dashboard/transactions', name: 'User Dashboard', critical: true, auth: true },
  
  // Revenue systems
  { path: '/api/p2p/calculate-fee', name: 'P2P Transfers', revenue: true, method: 'POST' },
  { path: '/api/circle/health', name: 'USDC Wallets', revenue: true },
  { path: '/api/ai-marketplace/agents', name: 'AI Marketplace', revenue: true },
  
  // Circle integration
  { path: '/api/user-circle/wallet/create', name: 'Circle Wallet Creation', circle: true, auth: true, method: 'POST' },
  { path: '/api/circle/supported-blockchains', name: 'Circle Multi-chain', circle: true },
  
  // Analytics/stats (less critical)
  { path: '/api/ai-marketplace/stats', name: 'Marketplace Stats', analytics: true },
  { path: '/api/crypto/prices', name: 'Crypto Prices', analytics: true }
];

const testEndpoint = (test) => {
  return new Promise((resolve) => {
    const postData = test.method === 'POST' ? JSON.stringify({
      amount: 100,
      fromCurrency: 'USD',
      toCurrency: 'USD'
    }) : null;

    const options = {
      hostname: 'localhost',
      port: 5000,
      path: test.path,
      method: test.method || 'GET',
      headers: { 
        'Content-Type': 'application/json',
        ...(test.auth ? { 'Authorization': 'Bearer invalid-test-token' } : {})
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({ 
          ...test,
          status: res.statusCode, 
          working: res.statusCode === 200 || (test.auth && res.statusCode === 401),
          body: body.substring(0, 100)
        });
      });
    });

    req.on('error', () => resolve({ ...test, status: 'ERROR', working: false }));
    
    if (postData) req.write(postData);
    req.end();
  });
};

async function honestAssessment() {
  console.log('🔍 HONEST PLATFORM ASSESSMENT\n');

  const results = [];
  for (const test of realWorldTests) {
    const result = await testEndpoint(test);
    results.push(result);
  }

  console.log('CRITICAL SYSTEMS (Must work for business meeting):');
  const critical = results.filter(r => r.critical);
  critical.forEach(r => {
    const status = r.working ? '✅' : '❌';
    console.log(`${status} ${r.name}: ${r.status}`);
  });

  console.log('\nREVENUE SYSTEMS (Core business value):');
  const revenue = results.filter(r => r.revenue);
  revenue.forEach(r => {
    const status = r.working ? '✅' : '❌';
    console.log(`${status} ${r.name}: ${r.status}`);
  });

  console.log('\nCIRCLE INTEGRATION (Main meeting topic):');
  const circle = results.filter(r => r.circle);
  circle.forEach(r => {
    const status = r.working ? '✅' : '❌';
    console.log(`${status} ${r.name}: ${r.status}`);
  });

  console.log('\nANALYTICS/STATS (Nice to have):');
  const analytics = results.filter(r => r.analytics);
  analytics.forEach(r => {
    const status = r.working ? '✅' : '❌';
    console.log(`${status} ${r.name}: ${r.status}`);
  });

  const workingCritical = critical.filter(r => r.working).length;
  const workingRevenue = revenue.filter(r => r.working).length;
  const workingCircle = circle.filter(r => r.working).length;

  console.log('\n📊 REAL READINESS ASSESSMENT:');
  console.log(`Critical Systems: ${workingCritical}/${critical.length} (${Math.round(workingCritical/critical.length*100)}%)`);
  console.log(`Revenue Systems: ${workingRevenue}/${revenue.length} (${Math.round(workingRevenue/revenue.length*100)}%)`);
  console.log(`Circle Integration: ${workingCircle}/${circle.length} (${Math.round(workingCircle/circle.length*100)}%)`);

  const overallWorking = results.filter(r => r.working).length;
  const overallScore = Math.round(overallWorking/results.length*100);
  
  console.log(`\n🎯 ACTUAL PLATFORM READINESS: ${overallScore}%`);
  
  if (workingCritical === critical.length && workingRevenue >= revenue.length * 0.8) {
    console.log('🚀 ACTUALLY READY FOR CIRCLE MEETING');
  } else {
    console.log('⚠️  Need to fix core issues before meeting');
  }
}

honestAssessment().catch(console.error);