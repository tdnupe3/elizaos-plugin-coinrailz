/**
 * Demo Endpoints Test - Verify 404 Fix
 */
import fetch from 'node-fetch';

async function testDemoEndpoints() {
  console.log('Testing Demo Notification Endpoints...\n');
  
  const endpoints = [
    '/api/demo/notifications',
    '/api/demo/notifications/unread-count', 
    '/api/demo/notifications/settings',
    '/api/demo/notifications/mark-read',
    '/api/demo/notifications/mark-all-read'
  ];
  
  let passed = 0;
  let total = endpoints.length;
  
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`http://localhost:5000${endpoint}`, {
        headers: { 'Accept': 'application/json' }
      });
      
      const isJSON = response.headers.get('content-type')?.includes('application/json');
      const statusOK = response.status === 200;
      
      if (statusOK && isJSON) {
        console.log(`✓ ${endpoint} - Working (${response.status})`);
        passed++;
      } else {
        console.log(`❌ ${endpoint} - Failed (${response.status}, HTML: ${!isJSON})`);
      }
    } catch (error) {
      console.log(`❌ ${endpoint} - Error: ${error.message}`);
    }
  }
  
  console.log(`\nResults: ${passed}/${total} endpoints working`);
  
  if (passed === total) {
    console.log('🎉 All demo endpoints fixed!');
    return true;
  } else {
    console.log('⚠️  Some endpoints still failing');
    return false;
  }
}

testDemoEndpoints().then(success => {
  process.exit(success ? 0 : 1);
});