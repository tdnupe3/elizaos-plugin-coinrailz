#!/usr/bin/env node

/**
 * Debug endpoint routing issue
 */

import http from 'http';

const testRequest = (path) => {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    };

    console.log(`🔍 Testing: GET ${path}`);
    
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        console.log(`   Status: ${res.statusCode}`);
        console.log(`   Response: ${body.substring(0, 200)}...`);
        console.log('');
        resolve({ status: res.statusCode, body });
      });
    });

    req.on('error', (error) => {
      console.log(`   Error: ${error.message}\n`);
      resolve({ error: error.message });
    });

    req.end();
  });
};

async function debugRouting() {
  console.log('🐛 Debugging Routing Issues\n');
  
  await testRequest('/api/health');
  await testRequest('/api/ai-marketplace/stats'); 
  await testRequest('/api/crypto/prices');
  await testRequest('/api/nonexistent');
  
  console.log('✅ Debug complete');
}

debugRouting().catch(console.error);