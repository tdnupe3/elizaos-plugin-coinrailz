#!/usr/bin/env node

/**
 * Final deployment readiness test for Circle meeting
 */

import http from 'http';

const criticalEndpoints = [
  { path: '/api/health', name: 'Health Check', required: true },
  { path: '/api/ai-marketplace/stats', name: 'Marketplace Stats', required: true },
  { path: '/api/crypto/prices', name: 'Crypto Prices', required: true },
  { path: '/api/dashboard/transactions', name: 'Dashboard Data', auth: true },
  { path: '/api/user-circle/wallet/create', name: 'Circle Wallet', auth: true, method: 'POST' }
];

const testEndpoint = (endpoint) => {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: endpoint.path,
      method: endpoint.method || 'GET',
      headers: { 'Content-Type': 'application/json' }
    };

    if (endpoint.auth) {
      options.headers['Authorization'] = 'Bearer invalid-token-test';
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({ 
          status: res.statusCode, 
          body: body.substring(0, 200),
          endpoint: endpoint.name 
        });
      });
    });

    req.on('error', (error) => {
      resolve({ error: error.message, endpoint: endpoint.name });
    });

    if (endpoint.method === 'POST') {
      req.write('{}');
    }
    req.end();
  });
};

async function finalTest() {
  console.log('🚀 FINAL DEPLOYMENT READINESS TEST\n');
  console.log('Testing critical endpoints for Circle meeting...\n');

  let working = 0;
  let authRequired = 0;
  let broken = 0;

  for (const endpoint of criticalEndpoints) {
    const result = await testEndpoint(endpoint);
    
    if (result.error) {
      console.log(`❌ ${endpoint.name}: Connection Error`);
      broken++;
    } else if (result.status === 200) {
      console.log(`✅ ${endpoint.name}: Working (${result.status})`);
      working++;
    } else if (result.status === 401 && endpoint.auth) {
      console.log(`🔑 ${endpoint.name}: Auth Required (${result.status}) ✓`);
      authRequired++;
    } else if (result.status === 404) {
      console.log(`❌ ${endpoint.name}: Not Found (${result.status})`);
      broken++;
    } else {
      console.log(`⚠️  ${endpoint.name}: Status ${result.status}`);
    }
  }

  console.log('\n📊 DEPLOYMENT READINESS SUMMARY:');
  console.log(`✅ Working Endpoints: ${working}`);
  console.log(`🔑 Auth Protected: ${authRequired}`);
  console.log(`❌ Broken Endpoints: ${broken}`);
  
  const totalExpected = working + authRequired;
  const readinessScore = Math.round((totalExpected / criticalEndpoints.length) * 100);
  
  console.log(`\n🎯 Platform Readiness: ${readinessScore}%`);
  
  if (readinessScore >= 80) {
    console.log('🚀 DEPLOYMENT APPROVED - Ready for Circle meeting!');
  } else if (readinessScore >= 60) {
    console.log('⚠️  Deployment ready with minor issues');
  } else {
    console.log('❌ Critical issues need resolution before deployment');
  }
}

finalTest().catch(console.error);