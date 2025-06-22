
const http = require('http');

async function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '0.0.0.0',
      port: 5000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: JSON.parse(body)
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: body
          });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function runAllStressTests() {
  console.log('🚀 STARTING ALL STRESS TESTS');
  console.log('='.repeat(50));

  const testScenarios = [
    'light-load-test',
    'medium-load-test', 
    'heavy-load-test',
    'extreme-load-test'
  ];

  for (const scenario of testScenarios) {
    console.log(`\n🧪 Starting ${scenario}...`);

    try {
      const response = await makeRequest('POST', `/api/stress-test/run/${scenario}`);

      if (response.status === 200) {
        console.log(`✅ ${scenario}: Started successfully`);
        console.log(`   Duration: ${response.data.estimatedDuration}s`);

        // Wait for test completion plus buffer
        const waitTime = (response.data.estimatedDuration + 10) * 1000;
        console.log(`   ⏳ Waiting ${response.data.estimatedDuration + 10}s for completion...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));

        // Check final status
        const statusResponse = await makeRequest('GET', '/api/stress-test/status');

        if (statusResponse.status === 200 && !statusResponse.data.running) {
          console.log(`   ✅ ${scenario}: Completed`);
        } else {
          console.log(`   ⚠️  ${scenario}: Still running, continuing...`);
        }

      } else {
        console.log(`❌ ${scenario}: Failed to start - ${response.data.error || 'Unknown error'}`);
      }

    } catch (error) {
      console.log(`❌ ${scenario}: Error - ${error.message}`);
    }
  }

  console.log('\n🎯 ALL STRESS TESTS INITIATED');
  console.log('Check server console for detailed progress logs');
}

runAllStressTests().catch(console.error);
