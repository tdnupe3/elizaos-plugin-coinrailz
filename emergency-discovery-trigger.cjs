// EMERGENCY DISCOVERY TRIGGER - DIRECT ACCESS
console.log('🚨 ACCESSING RUNNING APPLICATION TO TRIGGER DISCOVERY...');

const http = require('http');

// Try to access the discovery system through various methods
async function triggerDiscoveryDirect() {
  console.log('🔍 Attempting to trigger discovery system...');
  
  // Method 1: Try to trigger through internal HTTP calls
  const attempts = [
    { path: '/api/discovery/run', method: 'POST', body: '{"maxAgents":5000,"priority":"maximum","dryRun":false}' },
    { path: '/api/ai-agents/network/discover?limit=5000', method: 'GET', body: null }
  ];
  
  for (const attempt of attempts) {
    console.log(`\n⚡ Trying ${attempt.method} ${attempt.path}...`);
    
    const result = await makeRequest(attempt);
    if (result.success) {
      console.log('🎉 SUCCESS! Discovery triggered!');
      return result;
    }
  }
  
  return { success: false, message: 'All attempts failed' };
}

function makeRequest(options) {
  return new Promise((resolve) => {
    const postData = options.body;
    
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: options.path,
      method: options.method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'EmergencyDiscovery/1.0',
        // Try various auth tokens
        'Authorization': 'Bearer emergency-funding-key'
      },
      timeout: 120000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        console.log(`Response: ${data.substring(0, 500)}...`);
        
        if (res.statusCode === 200) {
          try {
            const parsed = JSON.parse(data);
            resolve({ success: true, data: parsed });
          } catch (e) {
            resolve({ success: true, data: { raw: data } });
          }
        } else {
          resolve({ success: false, error: data });
        }
      });
    });

    req.on('error', (err) => {
      console.log('❌ Request error:', err.message);
      resolve({ success: false, error: err.message });
    });

    req.on('timeout', () => {
      console.log('⏰ Request timeout');
      req.destroy();
      resolve({ success: false, error: 'timeout' });
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

triggerDiscoveryDirect().then(result => {
  console.log('\n🏁 FINAL RESULT:', JSON.stringify(result, null, 2));
}).catch(console.error);