#!/usr/bin/env node

/**
 * Comprehensive endpoint testing script
 * Tests all critical blockers mentioned in deployment checklist
 */

import http from 'http';

const testEndpoint = (path, method = 'GET', headers = {}, data = null) => {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({ status: res.statusCode, data: json, path, method });
        } catch (e) {
          resolve({ status: res.statusCode, data: body, path, method, error: 'Invalid JSON' });
        }
      });
    });

    req.on('error', (error) => {
      resolve({ status: 0, error: error.message, path, method });
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
};

async function runTests() {
  console.log('🧪 Testing Critical Deployment Blockers\n');

  const tests = [
    // Authentication & Data Flow Tests
    { path: '/api/ai-marketplace/stats', name: 'AI Marketplace Stats (404 issue)' },
    { path: '/api/dashboard/transactions', name: 'Dashboard Transactions', headers: { 'Authorization': 'Bearer demo-token-12345' } },
    { path: '/api/dashboard/portfolio', name: 'Dashboard Portfolio', headers: { 'Authorization': 'Bearer demo-token-12345' } },
    { path: '/api/user-circle/wallet/create', name: 'Circle Wallet Creation', method: 'POST', headers: { 'Authorization': 'Bearer demo-token-12345' }, data: {} },
    
    // Working endpoints for comparison
    { path: '/api/health', name: 'Health Check (should work)' },
    { path: '/api/crypto/prices', name: 'Crypto Prices (should work)' },
  ];

  const results = [];
  for (const test of tests) {
    const result = await testEndpoint(test.path, test.method, test.headers, test.data);
    results.push({ ...test, result });
    
    const status = result.status === 200 ? '✅' : result.status === 401 ? '🔑' : '❌';
    console.log(`${status} ${test.name}`);
    console.log(`   ${test.method || 'GET'} ${test.path} → ${result.status}`);
    if (result.status !== 200 && result.status !== 401) {
      console.log(`   Error: ${result.data?.error || result.data?.message || result.error || 'Unknown'}`);
    }
    console.log('');
  }

  console.log('📊 Summary:');
  console.log(`✅ Working: ${results.filter(r => r.result.status === 200).length}`);
  console.log(`🔑 Auth Required: ${results.filter(r => r.result.status === 401).length}`);
  console.log(`❌ Broken: ${results.filter(r => r.result.status !== 200 && r.result.status !== 401).length}`);
}

runTests().catch(console.error);