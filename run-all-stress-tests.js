const fetch = require('node-fetch');

async function runAllStressTests() {
  const baseUrl = 'http://localhost:5000';

  console.log('🚀 STARTING ALL STRESS TESTS');
  console.log('=' .repeat(50));

  const testScenarios = [
    'light-load-test',
    'medium-load-test', 
    'heavy-load-test',
    'extreme-load-test'
  ];

  for (const scenario of testScenarios) {
    console.log(`\n🧪 Starting ${scenario}...`);

    try {
      const response = await fetch(`${baseUrl}/api/stress-test/run/${scenario}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const result = await response.json();

      if (response.ok) {
        console.log(`✅ ${scenario}: Started successfully`);
        console.log(`   Duration: ${result.estimatedDuration}s`);

        // Wait for test completion plus buffer
        const waitTime = (result.estimatedDuration + 10) * 1000;
        console.log(`   ⏳ Waiting ${result.estimatedDuration + 10}s for completion...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));

        // Check final status
        const statusResponse = await fetch(`${baseUrl}/api/stress-test/status`);
        const status = await statusResponse.json();

        if (!status.running) {
          console.log(`   ✅ ${scenario}: Completed`);
        } else {
          console.log(`   ⚠️  ${scenario}: Still running, continuing...`);
        }

      } else {
        console.log(`❌ ${scenario}: Failed to start - ${result.error}`);
      }

    } catch (error) {
      console.log(`❌ ${scenario}: Error - ${error.message}`);
    }
  }

  console.log('\n🎯 ALL STRESS TESTS INITIATED');
  console.log('Check server console for detailed progress logs');
}

runAllStressTests().catch(console.error);